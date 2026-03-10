import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { projectService } from '../../services/projectService';

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

  return toTitleCase(status || 'draft');
}

export default function Projects() {
  const { addToast } = useOutletContext();

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

  const canLoadMore = listPage < Number(listMeta?.totalPages || 1);
  const empty = !listLoading && (projects || []).length === 0;

  const headerTitle = useMemo(() => {
    if (activeTab === 'create') return editingId ? 'Update Project' : 'Create Project';
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

            {activeTab === 'list' ? (
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
                    const minAmount =
                      Number(p?.amountRange?.min ?? p?.amount_range?.min ?? p?.minAmount ?? p?.min_amount ?? 0) || 0;
                    const maxAmount =
                      Number(p?.amountRange?.max ?? p?.amount_range?.max ?? p?.maxAmount ?? p?.max_amount ?? 0) || 0;
                    const timeline = p?.timelineExpected ?? p?.timeline_expected ?? '—';
                    const updatedAt = p?.updatedAt ?? p?.updated_at ?? null;
                    const statusLabel = projectStatusCardLabel(p);
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
    </div>
  );
}
