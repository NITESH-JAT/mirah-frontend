import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRegion } from '../../context/RegionProvider';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';
import ListPaginationBar from '../../components/customer/ListPaginationBar';
import VendorKycRequiredCard from '../../components/vendor/VendorKycRequiredCard';
import { formatCurrency } from '../../utils/formatMoney';
import { projectPresentmentCurrency } from '../../utils/projectMoney';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
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

function pickMetaValue(project, ...keys) {
  const meta = project?.meta ?? null;
  const values = meta?.values ?? meta?.data ?? null;
  if (!values || typeof values !== 'object') return '';
  for (const k of keys) {
    const key = String(k || '').trim();
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const v = values[key];
      if (v == null) return '';
      if (Array.isArray(v)) return v.filter(Boolean).join(', ');
      if (typeof v === 'object') {
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      }
      return String(v).trim();
    }
  }
  return '';
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

function Thumbnail({ src, alt }) {
  return (
    <div className="relative h-40 bg-gradient-to-br from-cream via-blush to-pale overflow-hidden">
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
    hasMyBid: Boolean(root?.hasMyBid ?? root?.has_my_bid ?? false),
  };
}

export default function VendorExplore() {
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();
  const { currency: regionCurrency = 'INR' } = useRegion();
  const abortRef = useRef(null);

  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

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

  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const currentPage = Number(meta?.page || page) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;

  const load = useCallback(
    async ({ nextPage = 1 } = {}) => {
      if (!kycAccepted) return;
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
    [addToast, kycAccepted],
  );

  useEffect(() => {
    if (!kycAccepted) return;
    load({ nextPage: page });
    return () => abortRef.current?.abort();
  }, [load, page, kycAccepted]);

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

  if (!kycAccepted) {
    return <VendorKycRequiredCard message="Please complete your KYC to explore open commissions." />;
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col pb-0 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      {/* Sticky top controls (search + sort + refresh) */}
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 border-b border-pale/60">
        {/* Desktop: search left, sort right */}
        <div className="hidden md:flex items-center justify-between gap-3">
          {/* Desktop search */}
          <div className="relative hidden md:block w-[420px] max-w-[55vw]">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="input-search-quiet-focus w-full bg-white border border-pale rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full justify-end md:w-auto">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenSort((v) => !v)}
                className={`inline-flex min-h-[2.25rem] min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 transition-colors sm:min-w-[2.5rem] ${
                  openSort
                    ? 'border-walnut bg-[#F2E6D4] text-ink'
                    : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
                }`}
                aria-label="Sort"
                aria-expanded={openSort}
                title="Sort"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m3 8 4-4 4 4" />
                  <path d="M7 4v16" />
                  <path d="m21 16-4 4-4-4" />
                  <path d="M17 20V4" />
                </svg>
              </button>
              {openSort ? (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-pale rounded-2xl shadow-sm overflow-hidden z-40">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortKey(opt.id);
                        setOpenSort(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-[12px] font-semibold hover:bg-[#F2E6D4] ${
                        sortKey === opt.id ? 'bg-[#F2E6D4] text-ink' : 'text-mid'
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
              className="input-search-quiet-focus w-full bg-white border border-pale rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenSort((v) => !v)}
              className={`inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full border px-2.5 transition-colors ${
                openSort
                  ? 'border-walnut bg-[#F2E6D4] text-ink'
                  : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
              }`}
              aria-label="Sort"
              aria-expanded={openSort}
              title="Sort"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m3 8 4-4 4 4" />
                <path d="M7 4v16" />
                <path d="m21 16-4 4-4-4" />
                <path d="M17 20V4" />
              </svg>
            </button>
            {openSort ? (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-pale rounded-2xl shadow-sm overflow-hidden z-40">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortKey(opt.id);
                      setOpenSort(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-[12px] font-semibold hover:bg-[#F2E6D4] ${
                      sortKey === opt.id ? 'bg-[#F2E6D4] text-ink' : 'text-mid'
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

      <div
        className={`mt-5 flex min-h-0 flex-1 flex-col ${
          !loading && sorted.length > 0 ? 'justify-between gap-4' : ''
        }`}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
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
              <p className="mt-3 text-[14px] font-bold text-ink">No projects found</p>
              <p className="mt-1 text-[12px] text-muted">Try a different search.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {sorted.map((x) => {
                const finishesMs = x.finishesMs;
                const timeLeftMs = finishesMs != null ? Math.max(0, finishesMs - Date.now()) : null;
                const ended = timeLeftMs != null ? timeLeftMs <= 0 : false;
                const budgetPerPieceRaw = pickMetaValue(x.project, 'budgetPerPiece', 'budget_per_piece');
                const budgetPerPiece = Number(String(budgetPerPieceRaw || '').trim() || NaN);
                const quantityRequired = String(pickMetaValue(x.project, 'quantityRequired', 'quantity_required') || '').trim();
                const preferredDelivery = String(
                  pickMetaValue(x.project, 'preferredDeliveryTimeline', 'preferred_delivery_timeline') || '',
                ).trim();
                const moneyCurrency = projectPresentmentCurrency(x.project, regionCurrency);
                return (
                  <div key={String(x.id)} className="bg-white rounded-2xl border border-pale overflow-hidden">
                    <div className="relative">
                      <Thumbnail src={x.thumbnailUrl} alt={x.title} />

                      <span className="absolute right-3 top-3 px-3 py-1.5 rounded-full bg-walnut text-blush text-[11px] font-extrabold inline-flex items-center gap-2 tabular-nums">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                          <circle cx="12" cy="13" r="8" />
                          <path d="M12 9v4l2 2" />
                          <path d="M5 3 2 6" />
                          <path d="m22 6-3-3" />
                          <path d="M6.38 18.7 4 21" />
                          <path d="M17.64 18.67 20 21" />
                        </svg>
                        {timeLeftMs == null ? '—' : ended ? 'Bid Ended' : formatCountdown(timeLeftMs)}
                      </span>
                    </div>

                    <div className="p-4">
                      <p className="text-[14px] font-extrabold text-ink truncate">{x.title}</p>

                      <div className="mt-3 space-y-1.5 text-[12px] text-mid">
                        {x.customerName ? (
                          <p>
                            Customer:{' '}
                            <span className="font-extrabold text-ink">{x.customerName}</span>
                          </p>
                        ) : null}
                        <p>
                          Budget:{' '}
                          <span className="font-extrabold text-ink">
                            {Number.isFinite(budgetPerPiece) && budgetPerPiece > 0 ? formatCurrency(budgetPerPiece, moneyCurrency) : '—'}
                          </span>
                        </p>
                        <p>
                          Quantity:{' '}
                          <span className="font-extrabold text-ink">{quantityRequired || '—'}</span>
                        </p>
                        <p>
                          Expected delivery:{' '}
                          <span className="font-extrabold text-ink">{preferredDelivery ? formatDateOnlyFromInput(preferredDelivery) : '—'}</span>
                        </p>
                      </div>

                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            const id = encodeURIComponent(String(x.id));
                            // If this jeweller already bid, go straight to Manage Bidding (no Explore detail flash).
                            navigate(x.hasMyBid ? `/vendor/bids/${id}?tab=active` : `/vendor/explore/${id}`);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90"
                        >
                          {x.hasMyBid ? 'Manage Bidding' : 'View Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ListPaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={meta?.total}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => load({ nextPage: Math.max(1, currentPage - 1) })}
              onNext={() => load({ nextPage: currentPage + 1 })}
            />
          </>
        )}
      </div>
    </div>
  );
}

