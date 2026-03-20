import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
}

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function budgetValueOf(project) {
  const range = project?.amountRange ?? project?.amount_range ?? null;
  const min = Number(range?.min ?? range?.minAmount ?? range?.min_amount ?? project?.minAmount ?? project?.min_amount ?? NaN);
  const max = Number(range?.max ?? range?.maxAmount ?? range?.max_amount ?? project?.maxAmount ?? project?.max_amount ?? NaN);
  const v = Number.isFinite(max) ? max : Number.isFinite(min) ? min : NaN;
  return Number.isFinite(v) ? v : null;
}



function durationDaysOf(project) {
  const t = Number(project?.timelineExpected ?? project?.timeline_expected ?? project?.noOfDays ?? project?.no_of_days ?? NaN);
  if (!Number.isFinite(t) || t <= 0) return null;
  return t;
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

function projectOf(row) {
  return row?.project ?? row?.projectDetails ?? row?.projectModel ?? row?.projectSnapshot ?? row?.data?.project ?? null;
}

function assignmentOf(row) {
  return row?.assignment ?? row?.assignmentRequest ?? row?.data?.assignment ?? row ?? null;
}

function myProjectsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  );
}

function Thumbnail({ src, alt }) {
  return (
    <div className="relative h-40 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 overflow-hidden">
      <SafeImage src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

export default function VendorAssignedProjects() {
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();

  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

  const abortRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('amount_low');
  const [openSort, setOpenSort] = useState(false);

  const sortOptions = useMemo(
    () => [
      { id: 'amount_low', label: 'Amount: Low to High' },
      { id: 'amount_high', label: 'Amount: High to Low' },
      { id: 'duration_low', label: 'Duration: Low to High' },
      { id: 'duration_high', label: 'Duration: High to Low' },
    ],
    [],
  );

  const load = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await projectService.listAssignments({
          page: nextPage,
          limit: 24,
          status: 'accepted',
          isActive: true,
          signal: ctrl.signal,
        });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setItems((prev) => {
          if (!append) return list;
          const existing = Array.isArray(prev) ? prev : [];
          const seen = new Set(existing.map((x) => String(assignmentOf(x)?.id ?? assignmentOf(x)?._id ?? '')));
          const merged = [...existing];
          for (const row of list) {
            const a = assignmentOf(row);
            const id = String(a?.id ?? a?._id ?? '');
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
        addToast(e?.message || 'Failed to load assigned projects', 'error');
        if (!append) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const normalized = useMemo(() => {
    return (Array.isArray(items) ? items : []).map((r) => {
      const project = projectOf(r) || {};
      const a = assignmentOf(r) || {};
      return {
        raw: r,
        project,
        id: project?.id ?? project?._id ?? assignmentOf(r)?.projectId ?? assignmentOf(r)?.project_id ?? null,
        title: project?.title ?? project?.name ?? 'Project',
        description: project?.description ?? '—',
        customerName: customerNameOf(project, r),
        thumbnailUrl: pickThumbnailUrl(project),
        agreedAmount: a?.agreedAmount ?? a?.agreed_amount ?? a?.agreedBidAmount ?? a?.agreed_bid_amount ?? null,
        agreedDaysToComplete:
          a?.agreedDaysToComplete ??
          a?.agreed_days_to_complete ??
          a?.agreedNoOfDays ??
          a?.agreed_no_of_days ??
          a?.agreedDays ??
          a?.agreed_days ??
          null,
      };
    }).filter((x) => x.id != null);
  }, [items]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((x) => {
      const t = String(x?.title ?? '').toLowerCase();
      const d = String(x?.description ?? '').toLowerCase();
      const c = String(x?.customerName ?? '').toLowerCase();
      return t.includes(q) || d.includes(q) || c.includes(q);
    });
  }, [normalized, query]);

  const sorted = useMemo(() => {
    const base = filtered.slice();
    const key = String(sortKey || '').trim().toLowerCase();
    const byBudget = (a) => budgetValueOf(a?.project) ?? 0;
    const byDuration = (a) => durationDaysOf(a?.project) ?? 0;
    if (key === 'amount_high') base.sort((a, b) => byBudget(b) - byBudget(a));
    else if (key === 'duration_low') base.sort((a, b) => byDuration(a) - byDuration(b));
    else if (key === 'duration_high') base.sort((a, b) => byDuration(b) - byDuration(a));
    else base.sort((a, b) => byBudget(a) - byBudget(b));
    return base;
  }, [filtered, sortKey]);

  if (!kycAccepted) {
    return (
      <div className="w-full pb-10 animate-fade-in">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
          <div className="font-semibold text-gray-900 mb-1">KYC not accepted yet</div>
          <div>Please complete your KYC to access assigned projects.</div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/vendor/kyc')}
              className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Go to KYC
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Assigned projects should be visible regardless of selling approval.

  const empty = !loading && sorted.length === 0;
  const currentPage = Number(meta?.page || 1) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="w-full pb-[120px] lg:pb-[96px] animate-fade-in">
      <div className="sticky top-0 z-30 isolate bg-[#F8F9FA] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 border-b border-gray-100/60">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-full">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium focus:outline-none focus:border-primary-dark"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 flex-1 sm:flex-none">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenSort((v) => !v)}
                className="px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <span className="hidden xs:inline">Sort</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openSort ? (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-40"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortKey(opt.id);
                        setOpenSort(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-[12px] font-semibold hover:bg-gray-50 ${
                        sortKey === opt.id ? 'text-primary-dark' : 'text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => load({ nextPage: currentPage })}
              disabled={loading}
              className="w-10 h-10 rounded-xl border border-gray-100 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-[calc(100vh-260px)] flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : empty ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                {myProjectsIcon()}
              </div>
              <p className="mt-3 text-[14px] font-bold text-gray-900">No assigned projects yet</p>
              <p className="mt-1 text-[12px] text-gray-500">Accepted assignments will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sorted.map((x) => {
              const agreedAmountNum = Number(x?.agreedAmount ?? NaN);
              const agreedDaysNum = Number(x?.agreedDaysToComplete ?? NaN);
              return (
                <div key={String(x.id)} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="relative">
                    <Thumbnail src={x.thumbnailUrl} alt={x.title} />
                  </div>
                  <div className="p-4">
                    <p className="text-[14px] font-extrabold text-gray-900 truncate">{x.title}</p>

                    <div className="mt-3 space-y-1.5 text-[12px] text-gray-600">
                      {x.customerName ? (
                        <p>
                          Customer: <span className="font-extrabold text-gray-900">{x.customerName}</span>
                        </p>
                      ) : null}
                      <p>
                        Agreed No. of Duration:{' '}
                        <span className="font-extrabold text-gray-900">{Number.isFinite(agreedDaysNum) && agreedDaysNum > 0 ? `${agreedDaysNum} days` : '—'}</span>
                      </p>
                      <p>
                        Agreed Amount:{' '}
                        <span className="font-extrabold text-gray-900">
                          {Number.isFinite(agreedAmountNum) && agreedAmountNum > 0 ? `₹ ${formatMoney(agreedAmountNum)}` : '—'}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/projects/${x.id}`)}
                        className="w-full px-4 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90"
                      >
                        Manage Project
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed pagination bar */}
      {!loading && sorted.length > 0 ? (
        <div
          className="fixed left-0 right-0 z-40
                     bottom-0
                     lg:left-[240px]"
        >
          <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="max-w-5xl lg:max-w-none mx-auto">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => {
                    const next = Math.max(1, currentPage - 1);
                    load({ nextPage: next });
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Prev
                </button>

                <div className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] text-gray-500 shadow-sm whitespace-nowrap">
                  Page <span className="font-semibold text-gray-800">{currentPage}</span> of{' '}
                  <span className="font-semibold text-gray-800">{totalPages}</span>
                </div>

                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => {
                    const next = currentPage + 1;
                    load({ nextPage: next });
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

