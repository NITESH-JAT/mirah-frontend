import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
}

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const dd = Math.floor(t / (24 * 3600));
  const hh = Math.floor((t % (24 * 3600)) / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return `${dd}d ${hh}h ${mm}m ${ss}s`;
}



function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
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

function isPaymentPaid(block) {
  const s = String(block?.status ?? '').trim().toLowerCase();
  return s === 'paid';
}

function isProjectFinishedLike(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  return Boolean(p?.isFinished) || status === 'finished' || projectStatus === 'completed';
}

function avatarUrlFor(name) {
  const safe = name || 'Jeweller';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safe)}&background=0D8ABC&color=fff`;
}

function daysLabel(days) {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0) return '—';
  return `${d} days`;
}

function parseLocalDateInput(value) {
  const raw = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day, 0, 0, 0, 0);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateOnlyFromInput(value) {
  const d = parseLocalDateInput(value);
  if (!d) return String(value || '').trim() || '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function coerceUrlArray(input) {
  const raw = input ?? [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? [raw] : [];
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function isImageUrl(url) {
  const u = String(url || '').toLowerCase().split('?')[0];
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u);
}

function filenameFromUrl(url, fallback = 'Attachment') {
  const raw = String(url || '').trim();
  if (!raw) return fallback;
  const noQuery = raw.split('?')[0] || raw;
  const parts = noQuery.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || fallback;
  try {
    const decoded = decodeURIComponent(last);
    return decoded || fallback;
  } catch {
    return last || fallback;
  }
}

function extOfFilename(name) {
  const n = String(name || '');
  const base = n.split('?')[0] || n;
  const i = base.lastIndexOf('.');
  if (i <= 0) return '';
  return base.slice(i + 1).toLowerCase();
}

function metaRowsOf(project) {
  const meta = project?.meta ?? project?.projectMeta ?? null;
  const values = meta?.values ?? meta?.data ?? null;
  const schema = meta?.schema ?? meta?.fields ?? null;
  if (!values || typeof values !== 'object') return [];
  const rows = [];
  for (const [k, v] of Object.entries(values)) {
    if (!k) continue;
    const label = schema?.[k]?.label ?? toTitleCase(k);
    let value = v;
    if (Array.isArray(value)) value = value.filter(Boolean).join(', ');
    else if (value && typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch {
        value = String(value);
      }
    }
    rows.push({ key: k, label: String(label || k), value: value == null || value === '' ? '—' : String(value) });
  }
  return rows;
}

function attachmentIcon(name) {
  const ext = extOfFilename(name);
  const isPdf = ext === 'pdf';
  const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  if (isPdf) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
      </svg>
    );
  }
  if (isImg) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
    </svg>
  );
}

export default function ProjectBids() {
  const { addToast } = useOutletContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const projectId = id;
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bids, setBids] = useState([]);

  const [search, setSearch] = useState('');
  const [selectedBidId, setSelectedBidId] = useState(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('amount_asc'); // amount_asc | amount_desc | delivery_asc | delivery_desc
  const [projectCardOpen, setProjectCardOpen] = useState(true);
  const cardsWrapRef = useRef(null);
  const actionBarRef = useRef(null);

  const [endOpen, setEndOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideFor, setOverrideFor] = useState(null); // { vendorName, bidEntryId, amount, noOfDays }
  const [actionLoading, setActionLoading] = useState({});

  const [nowTs, setNowTs] = useState(Date.now());
  const abortRef = useRef(null);

  const project = details?.project ?? details?.data?.project ?? details?.item ?? details?.data ?? details ?? null;
  const activeBidWindow = details?.activeBidWindow ?? details?.active_bid_window ?? null;
  const finishingAt =
    activeBidWindow?.finishingTimestamp ??
    activeBidWindow?.finishingAt ??
    activeBidWindow?.finishing_at ??
    null;
  const hasActiveWindow = Boolean(activeBidWindow);
  const finishesMs = finishingAt ? new Date(finishingAt).getTime() : null;
  const timeLeftMs = finishesMs != null ? Math.max(0, finishesMs - nowTs) : 0;

  const assignments = useMemo(
    () => coerceAssignments(project?.assignments ?? project?.assignmentRequests ?? project?.projectAssignments ?? []),
    [project],
  );
  const activeAssignment = useMemo(() => assignments.find((a) => isAssignmentActive(a)) || null, [assignments]);
  const assignedVendorId = useMemo(() => assignmentVendorIdOf(activeAssignment), [activeAssignment]);
  const assignedStatus = useMemo(() => assignmentStatusText(activeAssignment), [activeAssignment]);
  const assignmentPending = useMemo(() => assignedStatus === 'pending', [assignedStatus]);
  const assignmentAccepted = useMemo(() => assignedStatus === 'accepted', [assignedStatus]);
  const finishedProject = useMemo(() => isProjectFinishedLike(project), [project]);
  const advancePayment = project?.advancePayment ?? project?.advance_payment ?? project?.payments?.advance ?? null;
  const advancePaid = useMemo(() => isPaymentPaid(advancePayment), [advancePayment]);
  const attachments = useMemo(() => coerceUrlArray(project?.attachments), [project]);
  const metaRows = useMemo(() => metaRowsOf(project), [project]);

  const metaIndex = useMemo(() => new Map(metaRows.map((r) => [String(r?.key || '').trim(), r])), [metaRows]);
  const budgetPerPieceRaw = String(metaIndex.get('budgetPerPiece')?.value ?? metaIndex.get('budget_per_piece')?.value ?? '').trim();
  const quantityRequiredRaw = String(metaIndex.get('quantityRequired')?.value ?? metaIndex.get('quantity_required')?.value ?? '').trim();
  const preferredDeliveryRaw = String(
    metaIndex.get('preferredDeliveryTimeline')?.value ?? metaIndex.get('preferred_delivery_timeline')?.value ?? '',
  ).trim();
  const remainingMetaRows = useMemo(() => {
    const skip = new Set([
      'budgetPerPiece',
      'budget_per_piece',
      'quantityRequired',
      'quantity_required',
      'preferredDeliveryTimeline',
      'preferred_delivery_timeline',
    ]);
    return (metaRows || []).filter((r) => !skip.has(String(r?.key || '').trim()));
  }, [metaRows]);

  const referenceImage = useMemo(() => {
    const raw = String(project?.referenceImage ?? project?.reference_image ?? '').trim();
    if (raw && isHttpUrl(raw)) return raw;
    const img = (attachments || []).find((u) => isHttpUrl(u) && isImageUrl(u));
    return img || '';
  }, [project, attachments]);

  const load = useCallback(async () => {
    if (!projectId) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await projectService.getDetails(projectId, { signal: ctrl.signal });
      setDetails(res || null);
    } catch (e) {
      if (isCanceledRequest(e)) return;
      addToast(e?.message || 'Failed to load project', 'error');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, projectId]);

  const loadBids = useCallback(async ({ activeOnly } = {}) => {
    if (!projectId) return;
    setBidsLoading(true);
    try {
      const items = activeOnly ? await projectService.listActiveBids(projectId) : await projectService.listBids(projectId);
      const list = Array.isArray(items) ? items : [];
      setBids(list);
    } catch (e) {
      if (isCanceledRequest(e)) return;
      addToast(e?.message || 'Failed to load bids', 'error');
      setBids([]);
    } finally {
      setBidsLoading(false);
    }
  }, [addToast, projectId]);

  useEffect(() => {
    load();
    loadBids({ activeOnly: hasActiveWindow });
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [hasActiveWindow, load, loadBids]);

  useEffect(() => {
    if (!hasActiveWindow || !finishesMs) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finishesMs, hasActiveWindow]);

  const lowest = useMemo(() => {
    const amountOf = (b) => Number(b?.amount ?? b?.price ?? b?.bidAmount ?? b?.bid_price ?? NaN);
    let best = null;
    for (const b of bids) {
      const a = amountOf(b);
      if (!Number.isFinite(a)) continue;
      const key = b?.bidEntryId ?? b?.bid_entry_id ?? b?.id ?? b?._id ?? null;
      if (!key) continue;
      if (!best || a < best.amount) best = { id: String(key), amount: a };
    }
    return best;
  }, [bids]);

  const filteredBids = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return bids;
    return bids.filter((b) => {
      const vendorName = String(b?.vendorName ?? b?.vendor_name ?? '').toLowerCase();
      const vendor = b?.vendor ?? null;
      const joined = `${vendor?.firstName ?? ''} ${vendor?.lastName ?? ''}`.trim().toLowerCase();
      return vendorName.includes(q) || joined.includes(q);
    });
  }, [bids, search]);

  const visibleBids = useMemo(() => {
    const list = Array.isArray(filteredBids) ? [...filteredBids] : [];
    const amountOf = (b) => Number(b?.amount ?? b?.price ?? b?.bidAmount ?? b?.bid_price ?? NaN);
    const daysOf = (b) => Number(b?.noOfDays ?? b?.daysToComplete ?? b?.days_to_complete ?? b?.no_of_days ?? NaN);

    list.sort((a, b) => {
      if (sortBy === 'delivery_asc' || sortBy === 'delivery_desc') {
        const dir = sortBy === 'delivery_desc' ? -1 : 1;
        const da = daysOf(a);
        const db = daysOf(b);
        if (Number.isFinite(da) && Number.isFinite(db)) return (da - db) * dir;
        if (Number.isFinite(da)) return -1;
        if (Number.isFinite(db)) return 1;
        return 0;
      }
      const dir = sortBy === 'amount_desc' ? -1 : 1;
      const aa = amountOf(a);
      const ab = amountOf(b);
      if (Number.isFinite(aa) && Number.isFinite(ab)) return (aa - ab) * dir;
      if (Number.isFinite(aa)) return -1;
      if (Number.isFinite(ab)) return 1;
      return 0;
    });

    return list;
  }, [filteredBids, sortBy]);

  const canEndBid = hasActiveWindow && !finishedProject;
  const ended = !hasActiveWindow;
  const overrideLocked = Boolean(assignmentAccepted && advancePaid);
  const canSelectBids = ended && !finishedProject && !overrideLocked;

  const assignmentForVendor = useCallback(
    (vendorId) => {
      if (!vendorId) return null;
      const list = Array.isArray(assignments) ? assignments : [];
      const matches = list.filter((a) => String(assignmentVendorIdOf(a) ?? '') === String(vendorId));
      if (matches.length === 0) return null;
      // latest first by updatedAt/assignedAt
      matches.sort((a, b) => {
        const ta = new Date(a?.updatedAt ?? a?.updated_at ?? a?.assignedAt ?? a?.assigned_at ?? 0).getTime() || 0;
        const tb = new Date(b?.updatedAt ?? b?.updated_at ?? b?.assignedAt ?? b?.assigned_at ?? 0).getTime() || 0;
        return tb - ta;
      });
      return matches[0] ?? null;
    },
    [assignments],
  );

  const assignmentBadge = useCallback(
    (a) => {
      if (!a) return null;
      const status = assignmentStatusText(a);
      const replacedById = a?.replacedById ?? a?.replaced_by_id ?? null;
      if (!isAssignmentActive(a) && replacedById != null) return { text: 'Overridden', tone: 'muted' };
      if (status === 'pending') return { text: 'Pending', tone: 'warn' };
      if (status === 'accepted') return { text: 'Accepted', tone: 'success' };
      if (status === 'rejected') return { text: 'Rejected', tone: 'danger' };
      if (status === 'reassigned' || status === 'replaced' || status === 'overridden') return { text: 'Overridden', tone: 'muted' };
      if (!status) return null;
      return { text: toTitleCase(status), tone: 'muted' };
    },
    [],
  );

  // Close sort menu when clicking outside
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = () => setSortOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [sortOpen]);

  useEffect(() => {
    if (!canSelectBids && selectedBidId != null) setSelectedBidId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSelectBids]);

  // Clear selection when clicking outside bid cards (ended only)
  useEffect(() => {
    if (!canSelectBids) return;
    if (!selectedBidId) return;
    if (endOpen || overrideOpen) return;
    const onDown = (e) => {
      const actionBar = actionBarRef.current;
      if (actionBar && actionBar.contains(e.target)) return;
      const card = e?.target?.closest?.('[data-bid-card="1"]');
      if (card) return;
      setSelectedBidId(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [canSelectBids, endOpen, overrideOpen, selectedBidId]);

  const openVendorProfile = (bid) => {
    const vendorId = bid?.vendorId ?? bid?.vendor_id ?? bid?.vendor?.id ?? bid?.vendor?._id ?? null;
    if (!vendorId) return;
    navigate(`/customer/vendors/${vendorId}`, {
      state: { fromProjectId: projectId, fromProjectTitle: project?.title ?? location?.state?.projectTitle ?? null },
    });
  };

  const openOverride = (bid) => {
    const vendorName = String(bid?.vendorName ?? bid?.vendor_name ?? '').trim() || 'Jeweller';
    const amount = Number(bid?.amount ?? bid?.price ?? bid?.bidAmount ?? bid?.bid_price ?? NaN);
    const noOfDays = Number(bid?.noOfDays ?? bid?.daysToComplete ?? bid?.days_to_complete ?? bid?.no_of_days ?? NaN);
    const bidEntryId = bid?.bidEntryId ?? bid?.bid_entry_id ?? bid?.id ?? bid?._id ?? null;
    if (!bidEntryId || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(noOfDays) || noOfDays <= 0) {
      addToast('Unable to assign (missing bid details).', 'error');
      return;
    }
    setOverrideFor({ vendorName, bidEntryId, amount, noOfDays });
    setOverrideOpen(true);
  };

  const confirmOverride = async () => {
    if (!projectId || !overrideFor?.bidEntryId) return;
    setActionLoading((p) => ({ ...(p || {}), override: true }));
    try {
      const payload = { bidEntryId: overrideFor.bidEntryId, amount: overrideFor.amount, noOfDays: overrideFor.noOfDays };
      if (activeAssignment) {
        await projectService.reassignWinner(projectId, payload);
        addToast('Assignment overridden.', 'success');
      } else {
        await projectService.selectWinner(projectId, payload);
        addToast('Assignment sent to Jeweller.', 'success');
      }
      setOverrideOpen(false);
      setOverrideFor(null);
      await load();
      await loadBids();
    } catch (e) {
      addToast(e?.message || 'Failed to assign Jeweller', 'error');
    } finally {
      setActionLoading((p) => ({ ...(p || {}), override: false }));
    }
  };

  const confirmManualEnd = async () => {
    if (!projectId) return;
    setActionLoading((p) => ({ ...(p || {}), end: true }));
    try {
      await projectService.manualEndBid(projectId);
      addToast('Bidding ended.', 'success');
      setEndOpen(false);
      await load();
      await loadBids({ activeOnly: false });
    } catch (e) {
      addToast(e?.message || 'Failed to end bidding', 'error');
    } finally {
      setActionLoading((p) => ({ ...(p || {}), end: false }));
    }
  };

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="w-full h-[calc(100dvh-110px)] md:h-[calc(100dvh-140px)] lg:h-[calc(100vh-150px)] flex flex-col md:flex-row gap-4">
        {/* Left column: project details */}
        <div className="w-full md:w-[360px] lg:w-[400px] shrink-0 md:self-start">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => navigate('/customer/projects')}
                className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {canEndBid ? (
                  <button
                    type="button"
                    onClick={() => setEndOpen(true)}
                    className="px-4 py-2 rounded-full border border-red-200 text-[12px] font-extrabold text-red-600 hover:bg-red-50 whitespace-nowrap"
                  >
                    Force End
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setProjectCardOpen((v) => !v)}
                  className="md:hidden p-2 rounded-xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
                  aria-label={projectCardOpen ? 'Collapse project details' : 'Expand project details'}
                >
                  {projectCardOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {projectCardOpen || window?.matchMedia?.('(min-width: 768px)')?.matches ? (
            <div className="mt-4">
              <p className="text-[16px] md:text-[18px] font-extrabold text-gray-900 break-words">
                {project?.title || location?.state?.projectTitle || 'Project'}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[12px] text-gray-500 font-semibold">
                  Biddings Ends in
                </p>
                {hasActiveWindow && finishesMs ? (
                  <span className="px-3 py-1.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold tabular-nums">
                    {formatCountdown(timeLeftMs)}
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold">
                    Bid Ended
                  </span>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                {referenceImage ? (
                  <img
                    src={referenceImage}
                    alt=""
                    className="w-full h-44 md:h-52 object-contain bg-white"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-44 md:h-52 flex items-center justify-center text-gray-300 bg-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-gray-500 font-semibold">Budget per piece</span>
                  <span className="text-gray-900 font-extrabold text-right">
                    {budgetPerPieceRaw ? `₹ ${formatMoney(Number(budgetPerPieceRaw) || 0)}` : '—'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-gray-500 font-semibold">Quantity required</span>
                  <span className="text-gray-900 font-extrabold text-right">{quantityRequiredRaw || '—'}</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-gray-500 font-semibold">Expected delivery</span>
                  <span className="text-gray-900 font-extrabold text-right">
                    {preferredDeliveryRaw ? formatDateOnlyFromInput(preferredDeliveryRaw) : '—'}
                  </span>
                </div>
              </div>

              {remainingMetaRows.length > 0 ? (
                <div className="mt-4">
                  <div className="rounded-2xl border border-gray-100 bg-white">
                    <div className="px-4 py-3 border-b border-gray-50">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Details</p>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      {remainingMetaRows.map((r) => (
                        <div key={r.key} className="space-y-1">
                          <p className="text-[12px] text-gray-500 font-semibold">{r.label}</p>
                          <p className="text-[12px] text-gray-800 font-extrabold break-words whitespace-pre-wrap">
                            {r.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

            {attachments.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Attachments</p>
                <div className="mt-2 space-y-2">
                  {attachments.map((u, idx) => {
                    const name = filenameFromUrl(u, `Attachment ${idx + 1}`);
                    return (
                      <a
                        key={`${u}-${idx}`}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                        title="Open attachment"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="min-w-0 inline-flex items-center gap-2 text-[12px] font-semibold text-gray-700">
                          <span className="text-gray-500 shrink-0">{attachmentIcon(name)}</span>
                          <span className="truncate">{name}</span>
                        </span>
                        <span className="shrink-0 text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17 17 7" />
                            <path d="M7 7h10v10" />
                          </svg>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null}

            </div>
            ) : null}
          </div>
        </div>

        {/* Right column: 3 cards (search/sort, bids, override/assign) */}
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Search/sort */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Search "Jewellers"'
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                />
              </div>
              <div className="flex items-center gap-2 justify-end shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSortOpen((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                  >
                    Sort
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {sortOpen ? (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-lg overflow-hidden z-20"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('amount_asc');
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50 ${
                          sortBy === 'amount_asc' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        Low amount
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('amount_desc');
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50 ${
                          sortBy === 'amount_desc' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        High amount
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('delivery_asc');
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50 ${
                          sortBy === 'delivery_asc' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        Low delivery duration
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('delivery_desc');
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50 ${
                          sortBy === 'delivery_desc' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        High delivery duration
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => loadBids({ activeOnly: hasActiveWindow })}
                  disabled={bidsLoading || loading}
                  title="Reload bids"
                  className="p-2 rounded-xl bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bidsLoading || loading ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bids list */}
          <div className="bg-white rounded-2xl border border-gray-100 flex-1 min-h-0 overflow-hidden">
            <div
              className="p-4 md:p-6 h-full min-h-0 overflow-y-auto md:overflow-y-scroll custom-scrollbar pr-1"
              style={{ scrollbarGutter: 'stable' }}
            >
            {loading || bidsLoading ? (
              <div className="h-full min-h-[240px] flex items-center justify-center">
                <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ) : visibleBids.length === 0 ? (
              <div className="h-full min-h-[240px] flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                      <path d="M8 10h8" />
                      <path d="M8 14h6" />
                    </svg>
                  </div>
                  <p className="mt-3 text-[13px] font-bold text-gray-700">No bids found</p>
                  <p className="mt-1 text-[12px] text-gray-400">Try adjusting search or sorting.</p>
                </div>
              </div>
            ) : (
              <div ref={cardsWrapRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleBids.map((b) => {
                  const bidId = String(b?.bidEntryId ?? b?.bid_entry_id ?? b?.id ?? b?._id ?? '');
                  const vendor = b?.vendor ?? null;
                  const vendorJoined = `${vendor?.firstName ?? ''} ${vendor?.lastName ?? ''}`.trim();
                  const vendorName = String(b?.vendorName ?? b?.vendor_name ?? vendor?.fullName ?? (vendorJoined || 'Jeweller'));
                  const amount = Number(b?.amount ?? b?.price ?? b?.bidAmount ?? b?.bid_price ?? NaN);
                  const days = Number(b?.noOfDays ?? b?.daysToComplete ?? b?.days_to_complete ?? b?.no_of_days ?? NaN);
                  const rating = b?.vendorOverallProjectRating?.averageRating ?? b?.vendorOverallProjectRating?.avg ?? null;
                  const isLowest = lowest?.id && bidId && String(lowest.id) === bidId;
                  const vendorId = b?.vendorId ?? b?.vendor_id ?? vendor?.id ?? vendor?._id ?? null;
                  const vendorAsg = vendorId != null ? assignmentForVendor(vendorId) : null;
                  const badge = assignmentBadge(vendorAsg);
                  const isAssigned =
                    vendorId != null && assignedVendorId != null && String(vendorId) === String(assignedVendorId);
                  const disableSelect = Boolean(canSelectBids && assignmentPending && isAssigned);
                  const selected = Boolean(!disableSelect && canSelectBids && bidId && String(selectedBidId) === bidId);

                  return (
                    <div
                      key={bidId || vendorId || Math.random()}
                      data-bid-card="1"
                      role={canSelectBids && !disableSelect ? 'button' : undefined}
                      tabIndex={canSelectBids && !disableSelect ? 0 : undefined}
                      onClick={
                        canSelectBids && !disableSelect
                          ? () =>
                              setSelectedBidId((prev) => {
                                const next = bidId || null;
                                if (!next) return null;
                                return String(prev ?? '') === String(next) ? null : next;
                              })
                          : undefined
                      }
                      onKeyDown={
                        canSelectBids && !disableSelect
                          ? (e) => {
                              if (e.key !== 'Enter') return;
                              setSelectedBidId((prev) => {
                                const next = bidId || null;
                                if (!next) return null;
                                return String(prev ?? '') === String(next) ? null : next;
                              });
                            }
                          : undefined
                      }
                      className={`rounded-2xl border p-4 bg-white transition-colors ${
                        canSelectBids ? (disableSelect ? 'cursor-not-allowed opacity-70' : 'cursor-pointer') : 'cursor-default'
                      } ${
                        selected
                          ? 'border-primary-dark'
                          : isLowest
                            ? 'border-green-300 bg-green-50/40'
                            : canSelectBids && !disableSelect
                              ? 'border-gray-100 hover:bg-gray-50'
                              : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-100 bg-white shrink-0">
                            <img src={avatarUrlFor(vendorName)} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13px] font-extrabold text-gray-900 truncate">{vendorName}</p>
                            </div>
                            <div className="mt-1 text-[12px] text-gray-500 space-y-1">
                              <span className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 6v6l4 2" />
                                </svg>
                                Delivery In: {daysLabel(days)}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                </svg>
                                Jeweler Rating: {rating != null ? Number(rating).toFixed(1) : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[14px] font-extrabold text-gray-900">
                            {Number.isFinite(amount) ? `₹${formatMoney(amount)}` : '—'}
                          </p>
                          <p className="text-[11px] text-gray-400 font-semibold">Bidding Price</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openVendorProfile(b);
                            }}
                            className="text-[12px] font-extrabold text-primary-dark hover:underline"
                          >
                            View Profile →
                          </button>

                          <div className="mt-2 flex flex-wrap items-center gap-2 min-h-[22px]">
                            {isLowest ? (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-green-50 border-green-200 text-green-700">
                                Lowest Bid
                              </span>
                            ) : null}
                            {isAssigned ? (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-indigo-50 border-indigo-100 text-indigo-700">
                                Assigned
                              </span>
                            ) : null}
                            {badge ? (
                              <span
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                  badge.tone === 'success'
                                    ? 'bg-green-50 border-green-100 text-green-700'
                                    : badge.tone === 'danger'
                                      ? 'bg-red-50 border-red-100 text-red-700'
                                      : badge.tone === 'warn'
                                        ? 'bg-amber-50 border-amber-100 text-amber-700'
                                        : 'bg-gray-50 border-gray-100 text-gray-700'
                                }`}
                              >
                                {badge.text}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {canSelectBids ? (
                          selected ? (
                            <div className="w-5 h-5 rounded-md border flex items-center justify-center border-primary-dark bg-primary-dark mt-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 mt-0.5" />
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

          {/* Override/Assign */}
          {ended && !finishedProject && !overrideLocked ? (
            <div
              ref={actionBarRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-gray-100 p-3 md:p-4 shrink-0 flex items-center justify-end"
            >
              {(() => {
                const canProceed = Boolean(selectedBidId) && !actionLoading?.override;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedBidId || Boolean(actionLoading?.override)) return;
                      const bid = bids.find((x) => String(x?.bidEntryId ?? x?.id ?? x?._id ?? '') === String(selectedBidId));
                      if (!bid) return;
                      const vendorId = bid?.vendorId ?? bid?.vendor_id ?? bid?.vendor?.id ?? bid?.vendor?._id ?? null;
                      const isAssigned = vendorId != null && assignedVendorId != null && String(vendorId) === String(assignedVendorId);
                      if (assignmentPending && isAssigned) {
                        addToast('Assignment is pending. Please wait for Jeweller response before overriding.', 'error');
                        return;
                      }
                      openOverride(bid);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={!canProceed}
                    title={!selectedBidId ? 'Select a bid to continue' : undefined}
                    className={`px-4 py-2 rounded-xl text-[12px] font-extrabold ${
                      canProceed ? 'bg-primary-dark text-white hover:opacity-90' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading?.override ? 'Updating…' : activeAssignment ? 'Override Assignment' : 'Assign Winner'}
                  </button>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>

      {/* Manual end modal */}
      {endOpen ? (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4" onMouseDown={() => setEndOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">Force End</p>
              <p className="mt-1 text-[12px] text-gray-500">This will force-end the current bid window now (does not cancel the project).</p>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEndOpen(false)} className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50">
                Keep running
              </button>
              <button
                type="button"
                onClick={confirmManualEnd}
                disabled={Boolean(actionLoading?.end)}
                className="px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading?.end ? 'Ending…' : 'Force End'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Override modal */}
      {overrideOpen ? (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4" onMouseDown={() => setOverrideOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">{activeAssignment ? 'Override Assignment' : 'Assign Winner'}</p>
              <p className="mt-1 text-[12px] text-gray-500">
                {activeAssignment ? (
                  <>
                    This will override the current assignment and assign to{' '}
                    <span className="font-semibold text-gray-800">{overrideFor?.vendorName || 'Jeweller'}</span>.
                  </>
                ) : (
                  <>
                    Assign this project to <span className="font-semibold text-gray-800">{overrideFor?.vendorName || 'Jeweller'}</span>?
                  </>
                )}
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-[12px] text-gray-700 space-y-1">
                <p>
                  Amount: <span className="font-semibold">₹ {formatMoney(overrideFor?.amount)}</span>
                </p>
                <p>
                  Timeline: <span className="font-semibold">{overrideFor?.noOfDays ? daysLabel(overrideFor.noOfDays) : '—'}</span>
                </p>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setOverrideOpen(false)} className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmOverride}
                  disabled={Boolean(actionLoading?.override)}
                  className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading?.override ? 'Updating…' : activeAssignment ? 'Confirm Override' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

