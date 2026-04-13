import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';
import { formatMoney } from '../../utils/formatMoney';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
}

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function assignmentOf(row) {
  return row?.assignment ?? row?.assignmentRequest ?? row?.data?.assignment ?? row ?? null;
}

function projectOf(row) {
  return row?.project ?? row?.projectDetails ?? row?.projectModel ?? row?.projectSnapshot ?? row?.data?.project ?? null;
}

function assignmentIdOf(a) {
  return a?.id ?? a?._id ?? a?.assignmentId ?? a?.assignment_id ?? null;
}

function projectIdOf(project, assignment, fallback) {
  const p = project ?? {};
  const a = assignment ?? {};
  return p?.id ?? p?._id ?? a?.projectId ?? a?.project_id ?? fallback ?? null;
}

function isLikelyImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  const base = (raw.split('?')[0] || raw).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].some((ext) => base.endsWith(ext));
}

function pickThumbnailUrl(project) {
  const referenceImage = String(project?.referenceImage ?? project?.reference_image ?? '').trim();
  if (referenceImage && /^https?:\/\//i.test(referenceImage)) return referenceImage;
  const list = project?.attachments ?? project?.attachmentUrls ?? project?.attachment_urls ?? [];
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  const img = arr.find((u) => isLikelyImageUrl(u));
  return img || null;
}

function customerNameOf(project, root) {
  const p = project ?? {};
  const r = root ?? {};
  const c = p?.customerSummary ?? p?.customer ?? r?.customerSummary ?? r?.customer ?? r?.data?.customerSummary ?? null;
  const joined = `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
  const name = c?.fullName ?? c?.name ?? joined ?? null;
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed ? trimmed : null;
}

function durationDaysOf(project, assignment) {
  const a = assignment ?? {};
  const p = project ?? {};
  const agreed =
    a?.agreedDaysToComplete ??
    a?.agreed_days_to_complete ??
    a?.agreedNoOfDays ??
    a?.agreed_no_of_days ??
    a?.agreedDays ??
    a?.agreed_days ??
    null;
  const t = Number(agreed ?? p?.timelineExpected ?? p?.timeline_expected ?? p?.noOfDays ?? p?.no_of_days ?? NaN);
  if (!Number.isFinite(t) || t <= 0) return null;
  return t;
}

function badgeForRow(row) {
  const a = row?.assignment ?? null;
  const status = String(a?.status ?? '').trim().toLowerCase();
  const isActive = a?.isActive ?? a?.is_active ?? null;
  const active = typeof isActive === 'boolean' ? isActive : String(isActive).toLowerCase() === 'true';
  const replacedById = a?.replacedById ?? a?.replaced_by_id ?? null;
  const overridden = !active && replacedById != null;

  if (overridden) return { text: 'Overridden', tone: 'muted' };
  if (status === 'pending') return { text: 'Pending', tone: 'warn' };
  if (status === 'accepted') return { text: 'Accepted', tone: 'success' };
  if (status === 'rejected') return { text: 'Rejected', tone: 'danger' };
  if (status) return { text: toTitleCase(status), tone: 'muted' };
  return null;
}

export default function VendorProjects() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();

  const isVendor = user?.userType === 'vendor' || user?.userType === 'jeweller';
  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

  const abortRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all'); // all | active | pending | rejected | overridden
  const VENDOR_PROJECTS_TAB_KEY = 'mirah_vendor_projects_last_tab';

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState(null); // accept | reject
  const [confirmRow, setConfirmRow] = useState(null);
  const [actingId, setActingId] = useState(null);

  const setUrlTab = useCallback(
    (nextTab) => {
      const t = String(nextTab || '').trim().toLowerCase();
      const normalized = ['all', 'active', 'pending', 'rejected', 'overridden'].includes(t) ? t : 'all';
      try {
        sessionStorage.setItem(VENDOR_PROJECTS_TAB_KEY, normalized);
      } catch {
        // ignore
      }
      const params = new URLSearchParams(location.search || '');
      params.set('tab', normalized);
      navigate(`/vendor/projects?${params.toString()}`, { replace: true });
    },
    [VENDOR_PROJECTS_TAB_KEY, location.search, navigate],
  );

  useEffect(() => {
    try {
      const fromUrl = String(new URLSearchParams(location.search || '').get('tab') || '').toLowerCase();
      if (['all', 'active', 'pending', 'rejected', 'overridden'].includes(fromUrl)) {
        setTab(fromUrl);
        try {
          sessionStorage.setItem(VENDOR_PROJECTS_TAB_KEY, fromUrl);
        } catch {
          // ignore
        }
        return;
      }
      const stored = String(sessionStorage.getItem(VENDOR_PROJECTS_TAB_KEY) || '').trim().toLowerCase();
      const normalized = ['all', 'active', 'pending', 'rejected', 'overridden'].includes(stored) ? stored : 'all';
      setTab(normalized);
    } catch {
      setTab('all');
    }
  }, [VENDOR_PROJECTS_TAB_KEY, location.search]);

  const load = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (append) setMoreLoading(true);
      else setLoading(true);
      try {
        const res = await projectService.listAssignments({ page: nextPage, limit: 4, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setItems((prev) => {
          if (!append) return list;
          const existing = Array.isArray(prev) ? prev : [];
          const seen = new Set(existing.map((x) => String(assignmentIdOf(assignmentOf(x)) ?? '')));
          const merged = [...existing];
          for (const row of list) {
            const id = String(assignmentIdOf(assignmentOf(row)) ?? '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            merged.push(row);
          }
          return merged;
        });
        if (res?.meta) {
          setMeta({
            page: res.meta.page ?? nextPage,
            totalPages: res.meta.totalPages ?? 1,
            total: res.meta.total ?? null,
          });
        } else {
          setMeta((prev) => ({ ...(prev || {}), page: nextPage }));
        }
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load projects', 'error');
        if (!append) setItems([]);
      } finally {
        if (append) setMoreLoading(false);
        else setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    if (!isVendor || !kycAccepted) return;
    load({ nextPage: 1, append: false });
    return () => abortRef.current?.abort();
  }, [isVendor, kycAccepted, load]);

  const normalizedRows = useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .map((r) => {
        const assignment = assignmentOf(r) || {};
        const project = projectOf(r) || {};
        const id = projectIdOf(project, assignment, assignment?.projectId ?? assignment?.project_id ?? null);
        const customerName = customerNameOf(project, r);
        const status = String(assignment?.status ?? '').trim().toLowerCase();
        const isActiveRaw = assignment?.isActive ?? assignment?.is_active ?? null;
        const isActive = typeof isActiveRaw === 'boolean' ? isActiveRaw : String(isActiveRaw).toLowerCase() === 'true';
        const replacedById = assignment?.replacedById ?? assignment?.replaced_by_id ?? null;
        const overridden = !isActive && replacedById != null;
        return {
          raw: r,
          assignment,
          project,
          id,
          title: project?.title ?? project?.name ?? 'Project',
          customerName,
          thumbnailUrl: pickThumbnailUrl(project),
          status,
          isActive,
          overridden,
          badge: badgeForRow({ assignment }),
        };
      })
      .filter((x) => x.id != null);
  }, [items]);

  const searched = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return normalizedRows;
    return normalizedRows.filter((x) => {
      const t = String(x?.title ?? '').toLowerCase();
      const d = String(x?.description ?? '').toLowerCase();
      const s = String(x?.status ?? '').toLowerCase();
      return t.includes(q) || d.includes(q) || s.includes(q);
    });
  }, [normalizedRows, query]);

  const visible = useMemo(() => {
    const list = Array.isArray(searched) ? searched : [];
    if (tab === 'active') return list.filter((x) => x.status === 'accepted' && x.isActive);
    if (tab === 'pending') return list.filter((x) => x.status === 'pending' && x.isActive);
    if (tab === 'rejected') return list.filter((x) => x.status === 'rejected');
    if (tab === 'overridden')
      return list.filter((x) => x.overridden || ['reassigned', 'replaced', 'overridden'].includes(x.status));
    return list;
  }, [searched, tab]);

  const openConfirm = (type, row) => {
    const a = row?.assignment ?? null;
    const id = assignmentIdOf(a);
    if (!id) return;
    setConfirmType(type);
    setConfirmRow(row);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (actingId) return;
    setConfirmOpen(false);
    setConfirmType(null);
    setConfirmRow(null);
  };

  const confirmAction = async () => {
    const row = confirmRow;
    const a = row?.assignment ?? null;
    const id = assignmentIdOf(a);
    if (!id || !confirmType || actingId) return;
    setActingId(String(id));
    try {
      if (confirmType === 'accept') {
        await projectService.acceptAssignment(id);
        addToast('Assignment accepted.', 'success');
      } else {
        await projectService.rejectAssignment(id);
        addToast('Assignment rejected.', 'success');
      }
      closeConfirm();
      await load({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Action failed', 'error');
    } finally {
      setActingId(null);
    }
  };

  const empty = !loading && visible.length === 0;
  const canLoadMore = !loading && meta.page < meta.totalPages;

  if (!isVendor) {
    return (
      <div className="w-full pb-10 animate-fade-in">
        <div className="rounded-2xl border border-pale bg-cream p-6 text-[13px] text-mid">
          This page is available for vendors only.
        </div>
      </div>
    );
  }

  if (!kycAccepted) {
    return (
      <div className="w-full pb-10 animate-fade-in">
        <div className="rounded-2xl border border-pale bg-cream p-6 text-[13px] text-mid">
          <div className="font-semibold text-ink mb-1">KYC not accepted yet</div>
          <div>Please complete your KYC to access projects.</div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/vendor/kyc')}
              className="px-5 py-2.5 rounded-xl bg-walnut text-blush text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Go to KYC
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-[120px] lg:pb-[96px] animate-fade-in">
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 border-b border-pale/60">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 lg:shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'pending', label: 'Pending' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'overridden', label: 'Overridden' },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setUrlTab(t.id)}
                  className={`min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-xl border text-[10px] md:gap-2 md:px-3 md:py-1.5 md:text-[12px] font-bold transition-colors ${
                    active
                      ? 'bg-walnut/10 border-walnut text-ink'
                      : 'bg-white border-pale text-muted hover:bg-cream hover:text-ink'
                  }`}
                >
                  <span className="min-w-0 truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="w-full bg-white border border-pale rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium focus:outline-none focus:border-walnut"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load({ nextPage: 1, append: false })}
              disabled={loading || moreLoading}
              title="Reload"
              className="shrink-0 p-3 rounded-2xl bg-white border border-pale text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || moreLoading ? (
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
          <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : empty ? (
        <div className="mt-4 flex min-h-[min(420px,calc(100vh-280px))] flex-col items-center justify-center rounded-2xl bg-cream px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-pale bg-white text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M8 13h8" />
              <path d="M8 17h8" />
            </svg>
          </div>
          <p className="mt-4 text-[14px] font-bold text-ink">No projects found for this filter.</p>
          <p className="mt-1 max-w-sm text-[12px] text-muted">Try another tab or adjust your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4">
          {visible.map((row) => {
            const project = row.project || {};
            const assignment = row.assignment || {};
            const projectId = row.id;
            const badge = badgeForRow({ assignment });
            const agreedAmount =
              assignment?.agreedAmount ??
              assignment?.agreed_amount ??
              assignment?.agreedBidAmount ??
              assignment?.agreed_bid_amount ??
              null;
            const days = durationDaysOf(project, assignment);

            const status = String(row.status || '').toLowerCase();
            const isActive = Boolean(row.isActive);
            const isPending = status === 'pending' && isActive;
            const isAccepted = status === 'accepted' && isActive;
            const isRejected = status === 'rejected';
            const isOverridden = Boolean(row.overridden) || ['reassigned', 'replaced', 'overridden'].includes(status);

            return (
              <div key={String(assignmentIdOf(assignment) ?? projectId)} className="rounded-2xl border border-pale bg-white overflow-hidden">
                <div className="relative h-40 bg-gradient-to-br from-cream via-blush to-pale overflow-hidden">
                  <SafeImage src={row.thumbnailUrl} alt={row.title} className="absolute inset-0 w-full h-full object-cover" />
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold text-ink truncate">{row.title}</p>
                      <div className="mt-2 space-y-1 text-[12px] text-mid">
                        <p className="truncate">
                          Customer:{' '}
                          <span className="font-semibold text-ink">{row.customerName || '—'}</span>
                        </p>
                        <p className="truncate">
                          Agreed No. of Duration:{' '}
                          <span className="font-semibold text-ink">{days ? `${days} days` : '—'}</span>
                        </p>
                        <p className="truncate">
                          Agreed Amount:{' '}
                          <span className="font-semibold text-ink">
                            {agreedAmount != null ? `₹ ${formatMoney(agreedAmount)}` : '—'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {badge ? (
                      <span
                        className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                          badge.tone === 'success'
                            ? 'bg-green-50 border-green-100 text-green-700'
                            : badge.tone === 'danger'
                              ? 'bg-red-50 border-red-100 text-red-700'
                              : badge.tone === 'warn'
                                ? 'bg-amber-50 border-amber-100 text-amber-700'
                                : 'bg-cream border-pale text-mid'
                        }`}
                      >
                        {badge.text}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openConfirm('reject', { assignment, project })}
                          disabled={Boolean(actingId)}
                          className="px-3 py-2 rounded-xl border border-pale bg-white text-[12px] font-extrabold text-mid hover:bg-cream disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => openConfirm('accept', { assignment, project })}
                          disabled={Boolean(actingId)}
                          className="px-3 py-2 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90 disabled:opacity-50"
                        >
                          Accept
                        </button>
                      </>
                    ) : isAccepted ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/projects/${projectId}`, { state: { fromProjectsTab: tab } })}
                        className="px-3 py-2 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90"
                      >
                        Manage Project
                      </button>
                    ) : isRejected || isOverridden ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/bids/${projectId}?tab=completed`, { state: { fromProjectsTab: tab } })}
                        className="px-3 py-2 rounded-xl border border-pale bg-white text-[12px] font-extrabold text-ink hover:bg-cream"
                      >
                        View Bids
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/bids/${projectId}`, { state: { fromProjectsTab: tab } })}
                        className="px-3 py-2 rounded-xl border border-pale bg-white text-[12px] font-extrabold text-ink hover:bg-cream"
                      >
                        View Bids
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canLoadMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => load({ nextPage: Number(meta?.page || 1) + 1, append: true })}
            disabled={moreLoading}
            className="px-10 py-3 rounded-2xl border border-pale bg-white text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
          >
            {moreLoading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4" onMouseDown={closeConfirm}>
          <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">
                {confirmType === 'accept' ? 'Accept assignment?' : 'Reject assignment?'}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {confirmType === 'accept'
                  ? 'You will accept this assignment request.'
                  : 'You will decline this assignment request.'}
              </p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={Boolean(actingId)}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction}
                disabled={Boolean(actingId)}
                className={`px-4 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50 ${
                  confirmType === 'accept'
                    ? 'bg-walnut text-blush hover:opacity-90'
                    : 'border border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {actingId ? 'Working…' : confirmType === 'accept' ? 'Accept' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
