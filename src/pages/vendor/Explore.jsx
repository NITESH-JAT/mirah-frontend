import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
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

function formatCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const dd = Math.floor(t / (24 * 3600));
  const hh = Math.floor((t % (24 * 3600)) / 3600);
  const mm = Math.floor((t % 3600) / 60);
  if (dd > 0) return `${dd}d ${hh}h`;
  if (hh > 0) return `${hh}h ${mm}m`;
  return `${mm}m`;
}

function budgetValueOf(project) {
  const range = project?.amountRange ?? project?.amount_range ?? null;
  const min = Number(range?.min ?? range?.minAmount ?? range?.min_amount ?? project?.minAmount ?? project?.min_amount ?? NaN);
  const max = Number(range?.max ?? range?.maxAmount ?? range?.max_amount ?? project?.maxAmount ?? project?.max_amount ?? NaN);
  const v = Number.isFinite(max) ? max : Number.isFinite(min) ? min : NaN;
  return Number.isFinite(v) ? v : null;
}

function budgetTextOf(project) {
  const range = project?.amountRange ?? project?.amount_range ?? null;
  const min = Number(range?.min ?? range?.minAmount ?? range?.min_amount ?? project?.minAmount ?? project?.min_amount ?? NaN);
  const max = Number(range?.max ?? range?.maxAmount ?? range?.max_amount ?? project?.maxAmount ?? project?.max_amount ?? NaN);
  if (!Number.isFinite(min) && !Number.isFinite(max)) return '—';
  return `₹ ${formatMoney(Number.isFinite(min) ? min : 0)} - ₹ ${formatMoney(Number.isFinite(max) ? max : 0)}`;
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
  const list = project?.attachments ?? project?.attachmentUrls ?? project?.attachment_urls ?? [];
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  const img = arr.find((u) => isLikelyImageUrl(u));
  return img || null;
}

function Thumbnail({ src, alt }) {
  return (
    <div className="relative h-40 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 overflow-hidden">
      <SafeImage src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
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

function normalizeExploreItem(raw) {
  const root = raw ?? {};
  const project = root?.project ?? root?.data?.project ?? root?.item ?? root?.data ?? root ?? null;
  const bidWindow = root?.bidWindow ?? root?.bid_window ?? root?.activeBidWindow ?? root?.activeBidWindow ?? null;
  const stats = root?.stats ?? root?.biddingStats ?? root?.bidding_stats ?? root?.bidsStats ?? root?.bidStats ?? null;
  const id = project?.id ?? project?._id ?? root?.projectId ?? root?.id ?? null;
  const title = project?.title ?? project?.name ?? 'Project';
  const description = project?.description ?? '—';
  const finishingAt =
    bidWindow?.finishingTimestamp ??
    bidWindow?.finishingAt ??
    bidWindow?.finishing_at ??
    project?.activeBidWindow?.finishingTimestamp ??
    null;
  const finishesMs = finishingAt ? new Date(finishingAt).getTime() : null;

  const bidCount = Number(stats?.totalBids ?? stats?.total_bids ?? stats?.bidCount ?? stats?.bid_count ?? NaN);
  const bestBid = Number(stats?.lowestPrice ?? stats?.lowest_price ?? stats?.lowestBid ?? stats?.lowest_bid ?? NaN);
  const customerName = customerNameOf(project, root);
  const thumbnailUrl = pickThumbnailUrl(project);

  return {
    id,
    title,
    description,
    project,
    customerName,
    thumbnailUrl,
    finishesMs,
    bidCount: Number.isFinite(bidCount) ? bidCount : null,
    bestBid: Number.isFinite(bestBid) ? bestBid : null,
  };
}

export default function VendorExplore() {
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const abortRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
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
  const sortLabel = useMemo(() => sortOptions.find((x) => x.id === sortKey)?.label || 'Sort', [sortKey, sortOptions]);

  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const currentPage = Number(meta?.page || page) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;

  const load = useCallback(
    async ({ nextPage = 1 } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await projectService.listRunning({ page: nextPage, limit: 12, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setItems(list.map(normalizeExploreItem).filter((x) => x?.id));
        if (res?.meta) {
          setMeta(res.meta);
          setPage(res.meta.page || nextPage);
        } else {
          setMeta((prev) => ({ ...(prev || {}), page: nextPage }));
          setPage(nextPage);
        }
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load projects', 'error');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    load({ nextPage: page });
    return () => abortRef.current?.abort();
  }, [load, page]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const base = Array.isArray(items) ? items : [];
    if (!q) return base;
    return base.filter((x) => {
      const t = String(x?.title ?? '').toLowerCase();
      const d = String(x?.description ?? '').toLowerCase();
      return t.includes(q) || d.includes(q);
    });
  }, [items, query]);

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

  return (
    <div className="w-full pb-[120px] lg:pb-[96px] animate-fade-in">
      {/* Sticky top controls (search + sort + refresh) */}
      <div className="sticky top-0 z-30 isolate bg-[#F8F9FA] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 border-b border-gray-100/60">
        {/* Desktop: search left, sort right */}
        <div className="hidden md:flex items-center justify-between gap-3">
          {/* Desktop search */}
          <div className="relative hidden md:block w-[420px] max-w-[55vw]">
            <div className="relative">
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
          </div>

          <div className="flex items-center gap-2 w-full justify-end md:w-auto">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenSort((v) => !v)}
                className="px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h13" />
                  <path d="M3 12h9" />
                  <path d="M3 18h5" />
                  <path d="m19 8 2 2-2 2" />
                  <path d="M21 10h-5" />
                </svg>
                Sort
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openSort ? (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-40">
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
          </div>
        </div>

        {/* Mobile: search + sort in same row */}
        <div className="mt-4 flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenSort((v) => !v)}
              className="px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h13" />
                <path d="M3 12h9" />
                <path d="M3 18h5" />
                <path d="m19 8 2 2-2 2" />
                <path d="M21 10h-5" />
              </svg>
              <span className="hidden xs:inline">Sort</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {openSort ? (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-40">
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
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polygon
                    points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="currentColor" />
                </svg>
              </div>
              <p className="mt-3 text-[14px] font-bold text-gray-900">No projects found</p>
              <p className="mt-1 text-[12px] text-gray-500">Try a different search.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {sorted.map((x) => {
              const budgetText = budgetTextOf(x.project);
              const days = durationDaysOf(x.project);
              const finishesMs = x.finishesMs;
              const timeLeftMs = finishesMs != null ? Math.max(0, finishesMs - Date.now()) : null;
              const ended = timeLeftMs != null ? timeLeftMs <= 0 : false;
              return (
                <div key={String(x.id)} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="relative">
                    <Thumbnail src={x.thumbnailUrl} alt={x.title} />

                    {x.bestBid != null ? (
                      <span className="absolute left-3 top-3 px-3 py-1.5 rounded-full bg-white/90 border border-white text-[11px] font-extrabold text-gray-800">
                        Best bid: ₹{formatMoney(x.bestBid)}
                      </span>
                    ) : null}

                    <span className="absolute right-3 top-3 px-3 py-1.5 rounded-full bg-white/90 border border-white text-[11px] font-extrabold text-gray-800 inline-flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {timeLeftMs == null ? '—' : ended ? 'Bid Ended' : formatCountdown(timeLeftMs)}
                    </span>
                  </div>

                  <div className="p-4">
                    <p className="text-[14px] font-extrabold text-gray-900 truncate">{x.title}</p>
                    <p className="mt-1 text-[12px] text-gray-500 line-clamp-1">{x.description}</p>

                    <div className="mt-3 space-y-1.5 text-[12px] text-gray-600">
                      {x.customerName ? (
                        <p>
                          Customer:{' '}
                          <span className="font-extrabold text-gray-900">{x.customerName}</span>
                        </p>
                      ) : null}
                      <p>
                        Expected Timeline:{' '}
                        <span className="font-extrabold text-gray-900">{days != null ? `${days} days` : '—'}</span>
                      </p>
                      <p>
                        Budget:{' '}
                        <span className="font-extrabold text-gray-900">{budgetText}</span>
                      </p>
                      <p>
                        Bid Count:{' '}
                        <span className="font-extrabold text-gray-900">{x.bidCount != null ? x.bidCount : '—'}</span>
                      </p>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/explore/${encodeURIComponent(String(x.id))}`)}
                        className="w-full px-4 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed pagination bar (always visible when we have items) */}
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

