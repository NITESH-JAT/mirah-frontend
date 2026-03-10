import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { chatService } from '../../services/chatService';

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  // Format: 6 Mar 2026, 3:32 PM
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${datePart}, ${timePart}`;
}

function normalizeExtraFieldKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extraFieldsToArray(extraFields) {
  if (!extraFields) return [];
  // Preferred format:
  // { schema: { key: { type: "text", label: "Label" } }, values: { key: "Value" } }
  if (typeof extraFields === 'object' && extraFields?.schema && extraFields?.values) {
    const schema = extraFields.schema;
    const values = extraFields.values;
    if (schema && typeof schema === 'object' && values && typeof values === 'object') {
      const keys = new Set([...Object.keys(schema || {}), ...Object.keys(values || {})]);
      return Array.from(keys)
        .map((k) => ({
          key: String(k || '').trim(),
          label: String(schema?.[k]?.label || '').trim(),
          value: String(values?.[k] ?? '').trim(),
        }))
        .filter((x) => x.key && (x.label || x.value));
    }
  }
  // Back-compat: plain object meta { city: "Bengaluru" }
  if (typeof extraFields === 'object' && !Array.isArray(extraFields)) {
    return Object.entries(extraFields)
      .map(([k, v]) => ({ key: String(k), label: toTitleCase(k), value: String(v ?? '').trim() }))
      .filter((x) => x.key && x.value);
  }
  return [];
}

function buildExtraFieldsPayload(extraFieldRows) {
  const rows = Array.isArray(extraFieldRows) ? extraFieldRows : [];
  const normalized = rows
    .map((x) => {
      const label = String(x?.label || '').trim();
      const value = String(x?.value || '').trim();
      const key = String(x?.key || normalizeExtraFieldKey(label) || '').trim();
      return { key, label, value };
    })
    .filter((x) => x.label && x.value);

  if (!normalized.length) return undefined;

  const schema = {};
  const values = {};
  for (const item of normalized) {
    schema[item.key] = { type: 'text', label: item.label };
    values[item.key] = item.value;
  }
  return { schema, values };
}

function coerceUrlArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof input === 'string') return input.trim() ? [input.trim()] : [];
  return [];
}

function localProjectIdOf(p) {
  return p?.id ?? p?._id ?? null;
}

function isPdfUrl(url) {
  return String(url || '').toLowerCase().split('?')[0].endsWith('.pdf');
}

function isImageUrl(url) {
  const u = String(url || '').toLowerCase().split('?')[0];
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u);
}

function pickPreviewUrl(attachments) {
  const list = coerceUrlArray(attachments);
  const img = list.find((u) => isImageUrl(u));
  // Listing cards should show image preview only. If there's no image, show placeholder icon.
  return img || null;
}

function projectStatusCardLabel(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;

  // Rules requested:
  // - status=draft + projectStatus=started => Not Started
  // - status=running + projectStatus=started + latestBidWindowId=null => Not in Project Bid
  // - status=running + projectStatus=started + latestBidWindowId!=null => In Project Bid
  if (status === 'draft' && projectStatus === 'started') return 'Not Started';
  if (status === 'running' && projectStatus === 'started') {
    return latestBidWindowId == null ? 'Not in Project Bid' : 'In Project Bid';
  }

  // If project is running but operational status progressed (in_progress/qc/etc),
  // show the projectStatus instead of just "Running".
  if (status === 'running' && projectStatus && projectStatus !== 'started') {
    return toTitleCase(projectStatus);
  }

  return toTitleCase(status || 'draft');
}

function bidWindowsOf(p) {
  const bidModel = p?.bidModel ?? p?.bid_model ?? null;
  const windows =
    bidModel?.bidWindows ??
    bidModel?.bid_windows ??
    p?.bidWindows ??
    p?.bid_windows ??
    [];
  return Array.isArray(windows) ? windows.filter(Boolean) : windows ? [windows] : [];
}

function isBidWindowActive(w) {
  const active = w?.isActive ?? w?.is_active ?? false;
  if (typeof active === 'boolean') return active;
  return String(active).trim().toLowerCase() === 'true';
}

function bidWindowFinishingAt(w) {
  return (
    w?.finishingTimestamp ??
    w?.finishingAt ??
    w?.finishing_at ??
    w?.finishing_timestamp ??
    null
  );
}

function bidWindowFinishedAt(w) {
  return w?.finishedAt ?? w?.finished_at ?? null;
}

function activeBidWindowOf(p) {
  const windows = bidWindowsOf(p);
  return windows.find((w) => isBidWindowActive(w) && !bidWindowFinishedAt(w)) || null;
}

function latestFinishedBidAtOf(p) {
  const windows = bidWindowsOf(p);
  let best = null;
  for (const w of windows) {
    const ts = bidWindowFinishedAt(w);
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best ? best.toISOString() : null;
}

function allBidWindowsFinished(p) {
  const windows = bidWindowsOf(p);
  if (!windows.length) return false;
  return windows.every((w) => !isBidWindowActive(w) && Boolean(bidWindowFinishedAt(w)));
}

function coerceAssignments(input) {
  const asg = input ?? [];
  return Array.isArray(asg) ? asg.filter(Boolean) : asg ? [asg] : [];
}

function assignmentVendorIdOf(a) {
  return a?.vendorId ?? a?.vendor_id ?? a?.vendor?.id ?? a?.vendor?._id ?? null;
}

function isAssignmentActive(a) {
  const active = a?.isActive ?? a?.is_active ?? false;
  if (typeof active === 'boolean') return active;
  return String(active).trim().toLowerCase() === 'true';
}

function assignmentStatusText(a) {
  const raw = a?.status ?? a?.assignmentStatus ?? a?.assignment_status ?? '';
  return String(raw || '').trim().toLowerCase();
}

function isAssignmentOverridden(a) {
  const replacedBy = a?.replacedById ?? a?.replaced_by_id ?? null;
  return !isAssignmentActive(a) && replacedBy != null;
}

function isProjectFinishedLike(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  return Boolean(p?.isFinished) || status === 'finished' || projectStatus === 'completed';
}

export default function Projects() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();

  const [mobileView, setMobileView] = useState('menu'); // 'menu' | 'content'
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'

  const [listLoading, setListLoading] = useState(false);
  const [listMoreLoading, setListMoreLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [listMeta, setListMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [listPage, setListPage] = useState(1);

  const [editingId, setEditingId] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const [actionLoadingById, setActionLoadingById] = useState({});
  const setActionLoading = (id, key, value) => {
    const k = `${id}:${key}`;
    setActionLoadingById((prev) => ({ ...(prev || {}), [k]: value }));
  };
  const isActionLoading = (id, key) => Boolean(actionLoadingById?.[`${id}:${key}`]);

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    minAmount: '',
    maxAmount: '',
    timelineExpected: '',
    attachments: [],
    metaFields: [],
  });

  // Bidding / assignment UI
  const [startBidOpen, setStartBidOpen] = useState(false);
  const [startBidFor, setStartBidFor] = useState({ id: null, title: '' });
  const [startBidDays, setStartBidDays] = useState('3');

  const [forceStopOpen, setForceStopOpen] = useState(false);
  const [forceStopFor, setForceStopFor] = useState({ id: null, title: '' });

  const [bidsOpen, setBidsOpen] = useState(false);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsItems, setBidsItems] = useState([]);
  const [bidsFor, setBidsFor] = useState({ id: null, title: '' });
  const [bidsWindow, setBidsWindow] = useState(null);
  const [bidsAssignments, setBidsAssignments] = useState([]);
  const [bidsProjectFinished, setBidsProjectFinished] = useState(false);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideFor, setOverrideFor] = useState(null); // { projectId, vendorName, bidEntryId, amount, noOfDays }

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState({ id: null, title: '' });
  const [assignQuery, setAssignQuery] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignResults, setAssignResults] = useState([]);
  const [assignSelected, setAssignSelected] = useState(null);
  const [assignAmount, setAssignAmount] = useState('');
  const [assignDays, setAssignDays] = useState('');

  const attachmentInputRef = useRef(null);
  const listAbortRef = useRef(null);

  const loadProjects = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    if (listAbortRef.current) listAbortRef.current.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    if (append) setListMoreLoading(true);
    else setListLoading(true);

    try {
      const res = await projectService.list({ page: nextPage, limit: 10, signal: ctrl.signal });
      const incoming = Array.isArray(res?.items) ? res.items : [];
      setProjects((prev) => {
        if (!append) return incoming;
        const base = Array.isArray(prev) ? prev : [];
        const seen = new Set(base.map((x) => String(localProjectIdOf(x) ?? '')));
        const merged = [...base];
        for (const it of incoming) {
          const key = String(localProjectIdOf(it) ?? '');
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
        return merged;
      });
      setListMeta(res?.meta || { page: nextPage, totalPages: 1, total: null });
      setListPage(nextPage);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load projects', 'error');
      if (!append) setProjects([]);
    } finally {
      if (append) setListMoreLoading(false);
      else setListLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadProjects({ nextPage: 1, append: false });
    return () => {
      if (listAbortRef.current) listAbortRef.current.abort();
    };
  }, [loadProjects]);

  const MenuItem = ({ id, label, icon }) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => {
          setActiveTab(id);
          if (window.innerWidth < 768) setMobileView('content');
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left border transition-colors cursor-pointer
          ${isActive ? 'bg-primary-dark text-white border-primary-dark' : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50'}
        `}
      >
        <span className={`${isActive ? 'text-white' : 'text-gray-400'}`}>{icon}</span>
        <span className="text-[13px] font-semibold">{label}</span>
      </button>
    );
  };

  const InfoBox = ({ label, value, tone = 'default' }) => {
    const toneClass =
      tone === 'danger'
        ? 'bg-red-50 border-red-100 text-red-700'
        : tone === 'warn'
          ? 'bg-yellow-50 border-yellow-100 text-yellow-700'
          : 'bg-gray-50 border-gray-100 text-gray-700';
    return (
      <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-[12px] font-semibold mt-0.5 truncate">{value}</p>
      </div>
    );
  };

  const startCreateNew = () => {
    setEditingId(null);
    setCreateForm({
      title: '',
      description: '',
      minAmount: '',
      maxAmount: '',
      timelineExpected: '',
      attachments: [],
      metaFields: [],
    });
    setActiveTab('create');
    if (window.innerWidth < 768) setMobileView('content');
  };

  const startEdit = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    setEditingId(id);
    setCreateForm({
      title: String(p?.title ?? ''),
      description: String(p?.description ?? ''),
      minAmount: String(p?.amountRange?.min ?? p?.amount_range?.min ?? p?.minAmount ?? p?.min_amount ?? ''),
      maxAmount: String(p?.amountRange?.max ?? p?.amount_range?.max ?? p?.maxAmount ?? p?.max_amount ?? ''),
      timelineExpected: String(p?.timelineExpected ?? p?.timeline_expected ?? ''),
      attachments: coerceUrlArray(p?.attachments),
      metaFields: extraFieldsToArray(p?.meta),
    });
    setActiveTab('create');
    if (window.innerWidth < 768) setMobileView('content');
  };

  const handleUploadAttachments = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setAttachmentUploading(true);
    try {
      const valid = list.filter((f) => {
        const t = String(f?.type || '').toLowerCase();
        return t.startsWith('image/') || t === 'application/pdf';
      });
      if (!valid.length) {
        addToast('Only images and PDFs are allowed', 'error');
        return;
      }
      const res = await projectService.uploadAttachments(valid);
      const urls = Array.isArray(res?.urls) ? res.urls : [];
      if (!urls.length) {
        addToast('Upload succeeded but no URL returned.', 'error');
        return;
      }
      setCreateForm((prev) => ({ ...prev, attachments: [...coerceUrlArray(prev?.attachments), ...urls] }));
      addToast(urls.length > 1 ? 'Files uploaded' : 'File uploaded', 'success');
    } catch (e) {
      addToast(e?.message || 'Upload failed', 'error');
    } finally {
      setAttachmentUploading(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const saveProject = async () => {
    const title = String(createForm?.title || '').trim();
    const description = String(createForm?.description || '').trim();
    const minAmount = Number(createForm?.minAmount || 0);
    const maxAmount = Number(createForm?.maxAmount || 0);
    const timelineExpected = Number(createForm?.timelineExpected || 0);
    const attachments = coerceUrlArray(createForm?.attachments);
    const meta = buildExtraFieldsPayload(createForm?.metaFields);

    if (!title) return addToast('Project title is required', 'error');
    if (!description) return addToast('Project description is required', 'error');
    if (!Number.isFinite(minAmount) || minAmount <= 0) return addToast('Min amount is required', 'error');
    if (!Number.isFinite(maxAmount) || maxAmount <= 0) return addToast('Max amount is required', 'error');
    if (maxAmount < minAmount) return addToast('Max amount must be greater than Min amount', 'error');
    if (!Number.isFinite(timelineExpected) || timelineExpected <= 0) return addToast('Timeline (days) is required', 'error');

    if (createLoading) return;
    setCreateLoading(true);
    try {
      const payload = {
        title,
        description,
        attachments,
        meta,
        minAmount,
        maxAmount,
        timelineExpected,
      };
      if (editingId) {
        await projectService.update(editingId, payload);
        addToast('Project updated.', 'success');
      } else {
        await projectService.create(payload);
        addToast('Project created.', 'success');
      }
      setEditingId(null);
      setActiveTab('list');
      await loadProjects({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Failed to save project', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    const ok = window.confirm('Delete this project? This cannot be undone.');
    if (!ok) return;
    setActionLoading(id, 'delete', true);
    try {
      await projectService.delete(id);
      addToast('Project deleted.', 'success');
      await loadProjects({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Failed to delete project', 'error');
    } finally {
      setActionLoading(id, 'delete', false);
    }
  };

  const refreshList = useCallback(async () => {
    await loadProjects({ nextPage: 1, append: false });
  }, [loadProjects]);

  const onStartProject = async (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    setActionLoading(id, 'start', true);
    try {
      await projectService.start(id);
      addToast('Project started.', 'success');
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to start project', 'error');
    } finally {
      setActionLoading(id, 'start', false);
    }
  };

  const openStartBid = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    const windows = bidWindowsOf(p);
    const guess = windows?.[0]?.noOfDays ?? windows?.[0]?.no_of_days ?? 3;
    setStartBidFor({ id, title: String(p?.title ?? '') });
    setStartBidDays(String(Number(guess) || 3));
    setStartBidOpen(true);
  };

  const confirmStartBid = async () => {
    const id = startBidFor?.id;
    if (!id) return;
    const days = Math.max(1, Number(startBidDays) || 0);
    setActionLoading(id, 'startBid', true);
    try {
      await projectService.startBid(id, { noOfDays: days });
      addToast('Auction started.', 'success');
      setStartBidOpen(false);
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to start auction', 'error');
    } finally {
      setActionLoading(id, 'startBid', false);
    }
  };

  const openForceStop = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    setForceStopFor({ id, title: String(p?.title ?? '') });
    setForceStopOpen(true);
  };

  const confirmForceStop = async () => {
    const id = forceStopFor?.id;
    if (!id) return;
    setActionLoading(id, 'forceStop', true);
    try {
      await projectService.manualEndBid(id);
      addToast('Auction stopped.', 'success');
      setForceStopOpen(false);
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to stop auction', 'error');
    } finally {
      setActionLoading(id, 'forceStop', false);
    }
  };

  const openBids = async (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    const windows = bidWindowsOf(p);
    // PRD: bidWindows are latest-first, so use the first as the current/most recent window.
    setBidsWindow(windows?.[0] ?? null);
    setBidsAssignments(coerceAssignments(p?.assignments ?? p?.assignmentRequests ?? p?.projectAssignments ?? []));
    setBidsProjectFinished(isProjectFinishedLike(p));
    setBidsFor({ id, title: String(p?.title ?? '') });
    setBidsItems([]);
    setBidsOpen(true);
    setBidsLoading(true);
    try {
      const items = await projectService.listBids(id);
      setBidsItems(Array.isArray(items) ? items : []);
    } catch (e) {
      addToast(e?.message || 'Failed to load bids', 'error');
      setBidsItems([]);
    } finally {
      setBidsLoading(false);
    }
  };

  const openOverride = (projectId, bid) => {
    if (!projectId) return;
    const vendor = bid?.vendor ?? bid?.vendorDetails ?? bid?.user ?? bid?.vendorUser ?? null;
    const vendorJoined = `${vendor?.firstName ?? ''} ${vendor?.lastName ?? ''}`.trim();
    const vendorName = vendor?.fullName ?? (vendorJoined || vendor?.name || vendor?.username || 'Vendor');

    const amount = Number(bid?.amount ?? bid?.price ?? bid?.bidAmount ?? bid?.bid_price ?? NaN);
    const noOfDays = Number(bid?.noOfDays ?? bid?.daysToComplete ?? bid?.days_to_complete ?? bid?.no_of_days ?? NaN);
    const bidEntryId = bid?.bidEntryId ?? bid?.bid_entry_id ?? bid?.id ?? bid?._id ?? null;

    if (!bidEntryId) {
      addToast('Unable to override (missing bid id).', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('Unable to override (missing bid amount).', 'error');
      return;
    }
    if (!Number.isFinite(noOfDays) || noOfDays <= 0) {
      addToast('Unable to override (missing days).', 'error');
      return;
    }

    setOverrideFor({ projectId, vendorName, bidEntryId, amount, noOfDays });
    setOverrideOpen(true);
  };

  const confirmOverride = async () => {
    const projectId = overrideFor?.projectId;
    if (!projectId) return;
    const payload = {
      bidEntryId: overrideFor?.bidEntryId,
      amount: overrideFor?.amount,
      noOfDays: overrideFor?.noOfDays,
    };
    setActionLoading(projectId, 'override', true);
    try {
      const hasActive = coerceAssignments(bidsAssignments).some((a) => isAssignmentActive(a));
      if (hasActive) {
        await projectService.reassignWinner(projectId, payload);
        addToast('Assignment overridden.', 'success');
      } else {
        await projectService.selectWinner(projectId, payload);
        addToast('Assignment sent to vendor.', 'success');
      }

      setOverrideOpen(false);
      setOverrideFor(null);
      await refreshList();
      try {
        const updated = await projectService.getById(projectId);
        setBidsAssignments(
          coerceAssignments(updated?.assignments ?? updated?.assignmentRequests ?? updated?.projectAssignments ?? []),
        );
      } catch {
        // ignore
      }
    } catch (e) {
      addToast(e?.message || 'Failed to override assignment', 'error');
    } finally {
      setActionLoading(projectId, 'override', false);
    }
  };

  const openAssign = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    const minAmount = Number(p?.amountRange?.min ?? p?.amount_range?.min ?? 0) || 0;
    const timeline = Number(p?.timelineExpected ?? p?.timeline_expected ?? 0) || 0;
    setAssignFor({ id, title: String(p?.title ?? '') });
    setAssignQuery('');
    setAssignResults([]);
    setAssignSelected(null);
    setAssignAmount(minAmount ? String(minAmount) : '');
    setAssignDays(timeline ? String(timeline) : '');
    setAssignOpen(true);
  };

  useEffect(() => {
    if (!assignOpen) return;
    const q = String(assignQuery || '').trim();
    const t = setTimeout(async () => {
      if (!assignOpen) return;
      if (!q) {
        setAssignResults([]);
        return;
      }
      setAssignLoading(true);
      try {
        const users = await chatService.searchUsers({ type: 'vendor', search: q, page: 1, limit: 20 });
        setAssignResults(Array.isArray(users) ? users : []);
      } catch {
        setAssignResults([]);
      } finally {
        setAssignLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [assignOpen, assignQuery]);

  const confirmAssign = async () => {
    const id = assignFor?.id;
    const vendorId = assignSelected?.id ?? assignSelected?._id ?? null;
    const amount = Number(assignAmount || 0);
    const noOfDays = Number(assignDays || 0);
    if (!id) return;
    if (!vendorId) {
      addToast('Please select a vendor.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('Please enter an amount.', 'error');
      return;
    }
    if (!Number.isFinite(noOfDays) || noOfDays <= 0) {
      addToast('Please enter days to complete.', 'error');
      return;
    }
    setActionLoading(id, 'assign', true);
    try {
      await projectService.selectWinner(id, { vendorId, amount, noOfDays });
      addToast('Assignment sent to vendor.', 'success');
      setAssignOpen(false);
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to assign vendor', 'error');
    } finally {
      setActionLoading(id, 'assign', false);
    }
  };

  const canLoadMore = listPage < Number(listMeta?.totalPages || 1);
  const empty = !listLoading && (projects || []).length === 0;

  const assignmentRows = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const rows = [];
    for (const p of list) {
      const pid = localProjectIdOf(p);
      const asg = p?.assignments ?? p?.assignmentRequests ?? p?.projectAssignments ?? [];
      const arr = Array.isArray(asg) ? asg : asg ? [asg] : [];
      for (const a of arr) {
        rows.push({ project: p, projectId: pid, assignment: a });
      }
    }
    // Latest first
    rows.sort((ra, rb) => {
      const ta = new Date(ra?.assignment?.updatedAt ?? ra?.assignment?.updated_at ?? ra?.assignment?.assignedAt ?? 0).getTime() || 0;
      const tb = new Date(rb?.assignment?.updatedAt ?? rb?.assignment?.updated_at ?? rb?.assignment?.assignedAt ?? 0).getTime() || 0;
      return tb - ta;
    });
    return rows;
  }, [projects]);

  const headerTitle = useMemo(() => {
    if (activeTab === 'create') return editingId ? 'Update Project' : 'Create Project';
    if (activeTab === 'assignments') return 'Assignments';
    return 'My Projects';
  }, [activeTab, editingId]);

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="w-full h-[calc(100dvh-140px)] lg:h-[calc(100vh-150px)] flex gap-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Menu */}
        <div
          className={`w-full md:w-[320px] shrink-0 border-r border-gray-100 ${
            mobileView === 'content' ? 'hidden md:flex' : 'flex'
          } flex-col`}
        >
          <div className="px-5 pt-5 pb-3">
            <p className="text-[16px] font-extrabold text-gray-900">My Projects</p>
            <p className="mt-1 text-[12px] text-gray-400">Create and manage your projects.</p>
          </div>
          <div className="px-5 pb-5 space-y-2">
            <MenuItem
              id="create"
              label="Create Project"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              }
            />
            <MenuItem
              id="list"
              label="List Projects"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
                  <path d="M3.3 7 12 12l8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              }
            />
            <MenuItem
              id="assignments"
              label="Assignments"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12h6" />
                  <path d="M12 9v6" />
                  <path d="M7 2h10a2 2 0 0 1 2 2v18l-7-3-7 3V4a2 2 0 0 1 2-2z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Main */}
        <div className={`flex-1 ${mobileView === 'menu' ? 'hidden md:flex' : 'flex'} flex-col`}>
          <div className="h-14 border-b border-gray-100 px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileView('menu')}
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <p className="text-[13px] font-bold text-gray-800">{headerTitle}</p>
            </div>

            {activeTab === 'list' || activeTab === 'assignments' ? (
              <button
                type="button"
                onClick={() => loadProjects({ nextPage: 1, append: false })}
                disabled={listLoading}
                className="px-3 py-1.5 rounded-lg border border-gray-100 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {listLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            ) : editingId ? (
              <button
                type="button"
                onClick={startCreateNew}
                className="px-3 py-1.5 rounded-lg border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                New project
              </button>
            ) : null}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden p-5 bg-white">
            {activeTab === 'list' ? (
              listLoading ? (
                <div className="text-[13px] text-gray-400">Loading projects…</div>
              ) : empty ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
                  No projects yet. Create your first project.
                </div>
              ) : (
                <div className="h-full min-h-0 overflow-y-auto space-y-4 pr-1">
                  {projects.map((p) => {
                    const id = localProjectIdOf(p);
                    const attachments = coerceUrlArray(p?.attachments);
                    const preview = pickPreviewUrl(attachments);
                    const statusKey = String(p?.status ?? '').trim().toLowerCase();
                    const projectStatusKey = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
                    const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;
                    const windows = bidWindowsOf(p);
                    const activeWindow = activeBidWindowOf(p);
                    const biddingRunning = Boolean(activeWindow);
                    const biddingEndsAt = activeWindow ? bidWindowFinishingAt(activeWindow) : null;
                    const allWindowsFinished = allBidWindowsFinished(p);
                    const latestFinishedAt = latestFinishedBidAtOf(p);
                    const hasBidHistory = Boolean(latestBidWindowId != null) || windows.length > 0;
                    const startedDirect =
                      statusKey === 'running' &&
                      projectStatusKey === 'started' &&
                      latestBidWindowId == null &&
                      windows.length === 0;
                    const notStarted = statusKey === 'draft' && projectStatusKey === 'started';
                    const runningStarted = statusKey === 'running' && projectStatusKey === 'started';
                    const statusLabel = projectStatusCardLabel(p);
                    const minAmount =
                      Number(p?.amountRange?.min ?? p?.amount_range?.min ?? p?.minAmount ?? p?.min_amount ?? 0) || 0;
                    const maxAmount =
                      Number(p?.amountRange?.max ?? p?.amount_range?.max ?? p?.maxAmount ?? p?.max_amount ?? 0) || 0;
                    const timeline = p?.timelineExpected ?? p?.timeline_expected ?? '—';
                    const updatedAt = p?.updatedAt ?? p?.updated_at ?? null;
                    return (
                      <div key={String(id ?? Math.random())} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                        <div className="flex flex-col md:flex-row">
                          <div className="w-full md:w-[220px] h-[180px] md:h-[180px] bg-white border-b md:border-b-0 md:border-r border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {preview && isImageUrl(preview) ? (
                              <img src={preview} alt="" loading="lazy" className="w-full h-full object-contain p-2" />
                            ) : preview && isPdfUrl(preview) ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-red-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                  <path d="M14 2v6h6" />
                                  <path d="M8 13h8" />
                                  <path d="M8 17h8" />
                                </svg>
                                <div className="mt-2 text-[11px] font-bold">PDF</div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <path d="M21 15l-5-5L5 21" />
                                </svg>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 p-4 md:p-5">
                            <p className="text-[18px] md:text-[22px] font-bold text-gray-800 truncate">{p?.title || 'Project'}</p>
                            <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{p?.description || '—'}</p>

                            {runningStarted && (biddingRunning || allWindowsFinished) ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {biddingRunning ? (
                                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-100 text-amber-700">
                                    {biddingEndsAt ? `Bidding ends: ${formatDateTime(biddingEndsAt)}` : 'Bidding running'}
                                  </span>
                                ) : allWindowsFinished ? (
                                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-gray-50 border-gray-100 text-gray-600">
                                    {latestFinishedAt ? `Last bidding ended: ${formatDateTime(latestFinishedAt)}` : 'Bidding ended'}
                                  </span>
                                ) : null}
                                {hasBidHistory && !startedDirect ? (
                                  <span className="text-[11px] text-gray-400">
                                    Winner auto-assign happens when auction ends.
                                  </span>
                                ) : null}
                              </div>
                            ) : null}

                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
                              <InfoBox
                                label="Budget"
                                value={
                                  minAmount || maxAmount
                                    ? `₹ ${formatMoney(minAmount)} - ₹ ${formatMoney(maxAmount)}`
                                    : '—'
                                }
                              />
                              <InfoBox label="Timeline" value={timeline ? `${timeline} days` : '—'} />
                              <InfoBox label="Status" value={statusLabel} />
                              <InfoBox label="Last updated" value={formatDateTime(updatedAt)} />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 md:justify-end">
                              {notStarted ? (
                                <button
                                  type="button"
                                  onClick={() => onStartProject(p)}
                                  disabled={isActionLoading(id, 'start')}
                                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-primary-dark hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  {isActionLoading(id, 'start') ? 'Starting…' : 'Start without auction'}
                                </button>
                              ) : null}

                              {notStarted || runningStarted ? (
                                <button
                                  type="button"
                                  onClick={() => openStartBid(p)}
                                  disabled={
                                    isActionLoading(id, 'startBid') ||
                                    biddingRunning ||
                                    startedDirect ||
                                    (runningStarted && !hasBidHistory) ||
                                    (runningStarted && hasBidHistory && !allWindowsFinished)
                                  }
                                  title={
                                    startedDirect
                                      ? 'Project started without bidding'
                                      : biddingRunning
                                        ? 'Auction already running'
                                        : runningStarted && hasBidHistory && !allWindowsFinished
                                          ? 'Wait until current auction completes'
                                          : undefined
                                  }
                                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  {isActionLoading(id, 'startBid') ? 'Starting…' : 'Start Auction'}
                                </button>
                              ) : null}

                              {biddingRunning ? (
                                <button
                                  type="button"
                                  onClick={() => openForceStop(p)}
                                  disabled={isActionLoading(id, 'forceStop')}
                                  className="px-4 py-2 rounded-xl border border-red-100 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  {isActionLoading(id, 'forceStop') ? 'Stopping…' : 'Force Stop Auction'}
                                </button>
                              ) : null}

                              {hasBidHistory ? (
                                <button
                                  type="button"
                                  onClick={() => openBids(p)}
                                  disabled={bidsLoading && bidsFor?.id === id}
                                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  View bids
                                </button>
                              ) : null}

                              {runningStarted ? (
                                <button
                                  type="button"
                                  onClick={() => openAssign(p)}
                                  disabled={biddingRunning || isActionLoading(id, 'assign')}
                                  title={biddingRunning ? 'Wait until auction ends' : undefined}
                                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  Manual assignment
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => startEdit(p)}
                                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(p)}
                                disabled={isActionLoading(id, 'delete')}
                                className="px-4 py-2 rounded-xl border border-red-100 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                {isActionLoading(id, 'delete') ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {canLoadMore ? (
                    <button
                      type="button"
                      onClick={() => loadProjects({ nextPage: listPage + 1, append: true })}
                      disabled={listMoreLoading}
                      className="w-full py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {listMoreLoading ? 'Loading…' : 'Load more'}
                    </button>
                  ) : null}
                </div>
              )
            ) : activeTab === 'assignments' ? (
              <div className="h-full min-h-0 overflow-y-auto space-y-3 pr-1">
                {assignmentRows.length === 0 ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
                    No assignment requests yet.
                  </div>
                ) : (
                  assignmentRows.map((row, idx) => {
                    const p = row?.project || {};
                    const a = row?.assignment || {};
                    const pid = row?.projectId ?? localProjectIdOf(p);
                    const status = String(a?.status ?? '').trim().toLowerCase() || 'pending';
                    const when = a?.updatedAt ?? a?.updated_at ?? a?.assignedAt ?? a?.assigned_at ?? null;
                    const vendorJoined = `${a?.vendor?.firstName ?? ''} ${a?.vendor?.lastName ?? ''}`.trim();
                    const vendorName =
                      a?.vendorName ??
                      a?.vendor_name ??
                      a?.vendor?.fullName ??
                      (vendorJoined || null);
                    const vendorUsername = a?.vendorUsername ?? a?.vendor_username ?? a?.vendor?.username ?? null;
                    const vendorLabel = vendorName || (vendorUsername ? `Vendor (${vendorUsername})` : 'Vendor');
                    const statusClass =
                      status === 'accepted'
                        ? 'bg-green-50 border-green-100 text-green-700'
                        : status === 'rejected'
                          ? 'bg-red-50 border-red-100 text-red-700'
                          : 'bg-amber-50 border-amber-100 text-amber-700';
                    return (
                      <div key={String(a?.id ?? a?._id ?? `${pid}-${idx}`)} className="rounded-2xl border border-gray-100 p-4 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13px] font-bold text-gray-900 truncate max-w-[90vw] sm:max-w-none">
                                {p?.title || 'Project'}
                              </p>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusClass}`}>
                                {toTitleCase(status)}
                              </span>
                            </div>
                            <p className="mt-1 text-[12px] text-gray-400">
                              {status === 'pending' ? 'Pending with' : status === 'accepted' ? 'Accepted by' : 'Rejected by'}{' '}
                              <span className="font-semibold text-gray-600">{vendorLabel}</span>
                              {vendorUsername ? <span className="text-gray-400"> ({String(vendorUsername)})</span> : null}
                            </p>
                            {when ? <p className="mt-1 text-[12px] text-gray-400">{formatDateTime(when)}</p> : null}
                          </div>

                          <div className="shrink-0 flex flex-wrap justify-end gap-2">
                            {status === 'accepted' && pid ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/projects/${pid}`)}
                                className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-primary-dark hover:bg-gray-50"
                              >
                                Track
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="w-full h-full min-h-0 overflow-y-auto pr-1">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold text-gray-800">{editingId ? 'Update Project' : 'Create Project'}</p>
                    <p className="text-[12px] text-gray-400">
                      {editingId ? 'Editing an existing project (saved as draft).' : 'Creates a draft project.'}
                    </p>
                  </div>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={startCreateNew}
                      className="px-3 py-1.5 rounded-lg border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      New project
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Title *</label>
                    <input
                      value={createForm.title}
                      onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                      placeholder="Enter project title"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Min amount *</label>
                    <input
                      type="number"
                      value={createForm.minAmount}
                      onChange={(e) => setCreateForm((p) => ({ ...p, minAmount: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                      placeholder="10000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Max amount *</label>
                    <input
                      type="number"
                      value={createForm.maxAmount}
                      onChange={(e) => setCreateForm((p) => ({ ...p, maxAmount: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                      placeholder="20000"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Timeline (days) *</label>
                    <input
                      type="number"
                      value={createForm.timelineExpected}
                      onChange={(e) => setCreateForm((p) => ({ ...p, timelineExpected: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                      placeholder="7"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Description *</label>
                    <textarea
                      rows={3}
                      value={createForm.description}
                      onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                      placeholder="Enter project description"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">Meta fields</p>
                      <p className="text-[12px] text-gray-400">Add custom label/value pairs for this project.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm((p) => ({
                          ...p,
                          metaFields: [...(p.metaFields || []), { key: '', label: '', value: '' }],
                        }))
                      }
                      className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Add field
                    </button>
                  </div>

                  {(createForm.metaFields || []).length ? (
                    <div className="mt-4 space-y-3">
                      {(createForm.metaFields || []).map((ef, idx) => (
                        <div key={`mf-${idx}`} className="rounded-xl border border-gray-100 p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Label</label>
                              <input
                                value={ef?.label ?? ''}
                                onChange={(e) => {
                                  const label = e.target.value;
                                  const key = normalizeExtraFieldKey(label);
                                  setCreateForm((p) => ({
                                    ...p,
                                    metaFields: (p.metaFields || []).map((x, i) => (i === idx ? { ...(x || {}), label, key } : x)),
                                  }));
                                }}
                                className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                placeholder="e.g. Material"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Value</label>
                              <input
                                value={ef?.value ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setCreateForm((p) => ({
                                    ...p,
                                    metaFields: (p.metaFields || []).map((x, i) => (i === idx ? { ...(x || {}), value } : x)),
                                  }));
                                }}
                                className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                placeholder="e.g. Gold"
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setCreateForm((p) => ({
                                  ...p,
                                  metaFields: (p.metaFields || []).filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-[12px] font-bold text-red-600 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-[12px] text-gray-400">No meta fields added.</div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">Attachments</p>
                      <p className="text-[12px] text-gray-400">Upload project attachments (images/PDF).</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={attachmentUploading}
                      className="px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {attachmentUploading ? 'Uploading…' : 'Upload files'}
                    </button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) handleUploadAttachments(files);
                      }}
                    />
                  </div>

                  {coerceUrlArray(createForm.attachments).length ? (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {coerceUrlArray(createForm.attachments).map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          role={isPdfUrl(url) ? 'button' : undefined}
                          tabIndex={isPdfUrl(url) ? 0 : undefined}
                          onClick={() => {
                            if (!isPdfUrl(url)) return;
                            try {
                              window.open(url, '_blank', 'noopener,noreferrer');
                            } catch {
                              // ignore
                            }
                          }}
                          onKeyDown={(e) => {
                            if (!isPdfUrl(url)) return;
                            if (e.key !== 'Enter') return;
                            try {
                              window.open(url, '_blank', 'noopener,noreferrer');
                            } catch {
                              // ignore
                            }
                          }}
                          className={`relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50 ${
                            isPdfUrl(url) ? 'cursor-pointer' : ''
                          }`}
                          aria-label={isPdfUrl(url) ? 'Open PDF attachment' : undefined}
                        >
                          {isPdfUrl(url) ? (
                            <div className="w-full h-24 bg-white flex items-center justify-center text-red-400">
                              <div className="text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                  <path d="M14 2v6h6" />
                                </svg>
                                <div className="mt-1 text-[10px] font-bold">PDF</div>
                              </div>
                            </div>
                          ) : (
                            <img src={url} alt="" className="w-full h-24 object-contain bg-white p-2" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateForm((p) => ({ ...p, attachments: coerceUrlArray(p.attachments).filter((_, i) => i !== idx) }))
                            }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
                            aria-label="Remove"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-[12px] text-gray-400">No attachments uploaded.</div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setCreateForm({
                        title: '',
                        description: '',
                        minAmount: '',
                        maxAmount: '',
                        timelineExpected: '',
                        attachments: [],
                        metaFields: [],
                      });
                    }}
                    disabled={createLoading || attachmentUploading}
                    className="px-6 py-3 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={saveProject}
                    disabled={createLoading || attachmentUploading}
                    className="px-6 py-3 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {createLoading ? 'Saving…' : editingId ? 'Update Project' : 'Create Project'}
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-gray-400 text-center md:text-right">
                  Note: Projects are created as <span className="font-semibold">draft</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Start auction modal */}
      {startBidOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setStartBidOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Start Auction</p>
                {startBidFor?.title ? (
                  <p className="mt-1 text-[12px] text-gray-400 truncate">{startBidFor.title}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setStartBidOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">No of days *</label>
              <input
                type="number"
                min={1}
                value={startBidDays}
                onChange={(e) => setStartBidDays(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                placeholder="3"
              />
              <p className="mt-2 text-[12px] text-gray-400">
                Auction will run until the finishing timestamp based on these days.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => setStartBidOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStartBid}
                disabled={Boolean(startBidFor?.id) && isActionLoading(startBidFor.id, 'startBid')}
                className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Boolean(startBidFor?.id) && isActionLoading(startBidFor.id, 'startBid') ? 'Starting…' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Force stop auction modal */}
      {forceStopOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setForceStopOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Force Stop Auction</p>
                {forceStopFor?.title ? (
                  <p className="mt-1 text-[12px] text-gray-400 truncate">{forceStopFor.title}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setForceStopOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5 text-[13px] text-gray-700">
              This will stop the auction <span className="font-bold">now</span> (not at the original finishing time).
              Do you want to continue?
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => setForceStopOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmForceStop}
                disabled={Boolean(forceStopFor?.id) && isActionLoading(forceStopFor.id, 'forceStop')}
                className="px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Boolean(forceStopFor?.id) && isActionLoading(forceStopFor.id, 'forceStop') ? 'Stopping…' : 'Stop now'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* View bids modal */}
      {bidsOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setBidsOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Project bids</p>
                {bidsFor?.title ? <p className="mt-1 text-[12px] text-gray-400 truncate">{bidsFor.title}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setBidsOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {bidsWindow ? (
                (() => {
                  const startedAt =
                    bidsWindow?.startedAt ??
                    bidsWindow?.started_at ??
                    bidsWindow?.createdAt ??
                    bidsWindow?.created_at ??
                    null;
                  const finishingAt = bidWindowFinishingAt(bidsWindow);
                  const finishedAt = bidWindowFinishedAt(bidsWindow);
                  const finishingMs = finishingAt ? new Date(finishingAt).getTime() : NaN;
                  const finishedMs = finishedAt ? new Date(finishedAt).getTime() : NaN;
                  const manuallyFinished =
                    Number.isFinite(finishingMs) &&
                    Number.isFinite(finishedMs) &&
                    Math.abs(finishedMs - finishingMs) > 60_000; // 1 min tolerance
                  const active = isBidWindowActive(bidsWindow) && !finishedAt;
                  return (
                    <div className="mb-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] font-extrabold text-gray-900">Bid window</p>
                          <p className="mt-1 text-[12px] text-gray-500 truncate">
                            {bidsWindow ? `Window started: ${formatDateTime(startedAt)}` : '—'}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {active ? (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-blue-50 border-blue-100 text-blue-700">
                              Active
                            </span>
                          ) : null}
                          {manuallyFinished ? (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-100 text-amber-700">
                              Finished manually
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Started</p>
                          <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{formatDateTime(startedAt)}</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Finishing</p>
                          <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{formatDateTime(finishingAt)}</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Finished</p>
                          <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{formatDateTime(finishedAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : null}
              {bidsLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                  <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : bidsItems.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
                  No bids found.
                </div>
              ) : (
                (() => {
                  const amountOf = (b) => Number(b?.amount ?? b?.price ?? b?.bidAmount ?? b?.bid_price ?? NaN);
                  const ended = bidsWindow
                    ? Boolean(bidWindowFinishedAt(bidsWindow)) || !isBidWindowActive(bidsWindow)
                    : true;
                  const assignments = coerceAssignments(bidsAssignments);
                  const activeAssignment = assignments.find((a) => isAssignmentActive(a)) || null;
                  const assignedVendorId = assignmentVendorIdOf(activeAssignment);
                  const best = bidsItems.reduce(
                    (acc, b) => {
                      const a = amountOf(b);
                      if (!Number.isFinite(a)) return acc;
                      if (acc == null || a < acc.amount) return { amount: a, id: b?.id ?? b?._id ?? null };
                      return acc;
                    },
                    null
                  );
                  return (
                    <div className="space-y-3">
                      {bidsItems.map((b, idx) => {
                        const bidId = b?.id ?? b?._id ?? idx;
                        const vendor = b?.vendor ?? b?.vendorDetails ?? b?.user ?? b?.vendorUser ?? null;
                        const vendorJoined = `${vendor?.firstName ?? ''} ${vendor?.lastName ?? ''}`.trim();
                        const vendorName = vendor?.fullName ?? (vendorJoined || vendor?.name || vendor?.username || 'Vendor');
                        const vendorId = vendor?.id ?? vendor?._id ?? b?.vendorId ?? b?.vendor_id ?? null;
                        const amount = amountOf(b);
                        const days = Number(b?.noOfDays ?? b?.daysToComplete ?? b?.days_to_complete ?? b?.no_of_days ?? NaN);
                        const isWinning = best?.id != null && String(best.id) === String(b?.id ?? b?._id ?? '');
                        const vendorAssignments = vendorId
                          ? assignments
                              .filter((a) => String(assignmentVendorIdOf(a) ?? '') === String(vendorId))
                              .sort((aa, bb) => {
                                const ta =
                                  new Date(
                                    aa?.updatedAt ?? aa?.updated_at ?? aa?.assignedAt ?? aa?.assigned_at ?? aa?.createdAt ?? 0,
                                  ).getTime() || 0;
                                const tb =
                                  new Date(
                                    bb?.updatedAt ?? bb?.updated_at ?? bb?.assignedAt ?? bb?.assigned_at ?? bb?.createdAt ?? 0,
                                  ).getTime() || 0;
                                return tb - ta;
                              })
                          : [];
                        const latestAsg = vendorAssignments?.[0] ?? null;
                        const activeAsg = vendorAssignments.find((a) => isAssignmentActive(a)) || null;
                        const overridden = vendorAssignments.some((a) => isAssignmentOverridden(a));
                        const asgStatus = assignmentStatusText(activeAsg || latestAsg);
                        const isCurrentlyAssigned = vendorId != null && assignedVendorId != null && String(vendorId) === String(assignedVendorId);
                        const canOverride = ended && !bidsProjectFinished && Boolean(bidsFor?.id) && Boolean(vendorId);
                        return (
                          <div key={String(bidId)} className="rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[13px] font-bold text-gray-900 truncate">{vendorName || 'Vendor'}</p>
                                  {isWinning ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-green-50 border-green-100 text-green-700">
                                      Winning
                                    </span>
                                  ) : null}
                                  {isCurrentlyAssigned ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-indigo-50 border-indigo-100 text-indigo-700">
                                      Assigned
                                    </span>
                                  ) : null}
                                  {!isCurrentlyAssigned && overridden ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-100 text-amber-700">
                                      Overridden
                                    </span>
                                  ) : null}
                                  {asgStatus ? (
                                    <span
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                        asgStatus === 'accepted'
                                          ? 'bg-green-50 border-green-100 text-green-700'
                                          : asgStatus === 'rejected'
                                            ? 'bg-red-50 border-red-100 text-red-700'
                                            : 'bg-gray-50 border-gray-100 text-gray-700'
                                      }`}
                                    >
                                      {toTitleCase(asgStatus)}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[12px] text-gray-400">
                                  {Number.isFinite(days) ? `${days} days` : '—'}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[14px] font-extrabold text-gray-900">
                                  {Number.isFinite(amount) ? `₹ ${formatMoney(amount)}` : '—'}
                                </div>
                                {canOverride ? (
                                  <button
                                    type="button"
                                    onClick={() => openOverride(bidsFor?.id, b)}
                                    disabled={isActionLoading(bidsFor?.id, 'override') || isCurrentlyAssigned}
                                    title={isCurrentlyAssigned ? 'Already assigned to this vendor' : undefined}
                                    className="mt-2 px-3 py-1.5 rounded-xl border border-gray-100 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isActionLoading(bidsFor?.id, 'override')
                                      ? 'Updating…'
                                      : activeAssignment
                                        ? 'Override'
                                        : 'Assign'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Override assignment modal */}
      {overrideOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            setOverrideOpen(false);
            setOverrideFor(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">Override assignment</p>
              <p className="mt-1 text-[12px] text-gray-500">
                Assign project to <span className="font-semibold text-gray-800">{overrideFor?.vendorName || 'vendor'}</span>?
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-[12px] text-gray-700 space-y-1">
                <p>
                  Amount: <span className="font-semibold">₹ {formatMoney(overrideFor?.amount)}</span>
                </p>
                <p>
                  Timeline: <span className="font-semibold">{overrideFor?.noOfDays ? `${overrideFor.noOfDays} days` : '—'}</span>
                </p>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOverrideOpen(false);
                    setOverrideFor(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmOverride}
                  disabled={!overrideFor?.projectId || isActionLoading(overrideFor?.projectId, 'override')}
                  className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {overrideFor?.projectId && isActionLoading(overrideFor.projectId, 'override') ? 'Updating…' : 'Confirm'}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                Note: This will override the current assignment if one exists.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Manual assignment modal */}
      {assignOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setAssignOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Manual assignment</p>
                {assignFor?.title ? <p className="mt-1 text-[12px] text-gray-400 truncate">{assignFor.title}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Search vendor *</label>
                  <input
                    value={assignQuery}
                    onChange={(e) => setAssignQuery(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                    placeholder="Type vendor name…"
                  />
                  {assignLoading ? <p className="mt-2 text-[12px] text-gray-400">Searching…</p> : null}
                </div>

                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="max-h-[260px] overflow-y-auto">
                      {assignResults.length === 0 ? (
                        <div className="p-4 text-[12px] text-gray-400">No vendors.</div>
                      ) : (
                        assignResults.map((u) => {
                          const uid = u?.id ?? u?._id;
                          const joined = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim();
                          const name = u?.fullName ?? (joined || u?.name || (u?.username ? `Vendor (${u.username})` : 'Vendor'));
                          const active = assignSelected && String(assignSelected?.id ?? assignSelected?._id) === String(uid);
                          return (
                            <button
                              key={String(uid)}
                              type="button"
                              onClick={() => setAssignSelected(u)}
                              className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 ${
                                active ? 'bg-gray-50' : 'bg-white'
                              }`}
                            >
                              <p className="text-[13px] font-bold text-gray-800 truncate">{name}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Username: <span className="font-semibold text-gray-600">{String(u?.username ?? '—')}</span>
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Amount *</label>
                  <input
                    type="number"
                    value={assignAmount}
                    onChange={(e) => setAssignAmount(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Days to complete *</label>
                  <input
                    type="number"
                    value={assignDays}
                    onChange={(e) => setAssignDays(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                    placeholder="10"
                  />
                </div>

              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={confirmAssign}
                disabled={Boolean(assignFor?.id) && isActionLoading(assignFor.id, 'assign')}
                className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Boolean(assignFor?.id) && isActionLoading(assignFor.id, 'assign') ? 'Sending…' : 'Send assignment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
