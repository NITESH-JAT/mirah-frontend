import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRegion } from '../../context/RegionProvider';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';
import VendorKycRequiredCard from '../../components/vendor/VendorKycRequiredCard';
import { formatCurrency } from '../../utils/formatMoney';
import { projectPresentmentCurrency } from '../../utils/projectMoney';
import { pickProjectThumbnailUrl } from '../../utils/projectThumbnail';

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



function customerNameOf(project, root) {
  const p = project ?? {};
  const r = root ?? {};
  const c = p?.customerSummary ?? p?.customer ?? r?.customerSummary ?? r?.customer ?? r?.data?.customerSummary ?? null;
  const joined = `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
  const name = c?.fullName ?? c?.name ?? joined ?? null;
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed ? trimmed : null;
}

function Thumbnail({ src, alt }) {
  return (
    <div className="relative h-40 bg-gradient-to-br from-cream via-blush to-pale overflow-hidden">
      <SafeImage src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

function mergeParticipationById(prev, next) {
  const seen = new Set(prev.map((x) => String(x?.id ?? '')));
  const out = [...prev];
  for (const x of next) {
    const id = String(x?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  return out;
}

function normalizeParticipationItem(raw) {
  const root = raw ?? {};
  const project = root?.project ?? root?.data?.project ?? root?.item ?? root?.data ?? root ?? null;
  const bidWindow = root?.activeBidWindow ?? root?.active_bid_window ?? root?.bidWindow ?? root?.bid_window ?? null;
  const finishingAt = bidWindow?.finishingTimestamp ?? bidWindow?.finishingAt ?? bidWindow?.finishing_at ?? null;
  const finishesMs = finishingAt ? new Date(finishingAt).getTime() : null;
  const now = Date.now();
  const windowEnded = finishesMs != null && finishesMs <= now;
  const hasActive = Boolean(root?.hasActiveBidWindow ?? root?.has_active_bid_window) || (Boolean(bidWindow) && !windowEnded);
  const vendorContext = root?.vendorContext ?? root?.vendor_context ?? null;
  const latestBidEntry =
    vendorContext != null
      ? vendorContext?.latestBidEntry ?? vendorContext?.latest_bid_entry ?? vendorContext?.latestBid ?? vendorContext?.latest_bid ?? null
      : undefined;
  const status = String(root?.bidParticipationStatus ?? root?.bid_participation_status ?? (hasActive ? 'active' : 'ended')).toLowerCase();
  const isActive = status === 'active';
  const id = project?.id ?? project?._id ?? root?.projectId ?? root?.id ?? null;
  const title = project?.title ?? project?.name ?? 'Project';
  const description = project?.description ?? '—';
  const customerName = customerNameOf(project, root);
  const thumbnailUrl = pickProjectThumbnailUrl(project);
  const stats = root?.stats ?? root?.biddingStats ?? root?.bidding_stats ?? null;
  const bidCount = Number(
    stats?.totalBids ??
      stats?.total_bids ??
      stats?.bidCount ??
      stats?.bid_count ??
      root?.totalBids ??
      root?.total_bids ??
      root?.bidCount ??
      root?.bid_count ??
      NaN,
  );
  const bestBid = Number(stats?.lowestPrice ?? stats?.lowest_price ?? stats?.lowestBid ?? stats?.lowest_bid ?? NaN);
  const isCurrentlyWinning = Boolean(root?.isCurrentlyWinning ?? root?.is_currently_winning);
  const winner = root?.winner ?? root?.winnerState ?? root?.winner_state ?? null;
  const isWinnerSelected = Boolean(winner?.isWinnerSelected ?? winner?.is_winner_selected);
  const isWinnerVendor = Boolean(winner?.isWinnerVendor ?? winner?.is_winner_vendor);
  return {
    id,
    title,
    description,
    project,
    customerName,
    thumbnailUrl,
    finishesMs,
    isActive,
    vendorWithdrewAllBids: vendorContext != null && latestBidEntry == null,
    bidCount: Number.isFinite(bidCount) ? bidCount : null,
    bestBid: Number.isFinite(bestBid) ? bestBid : null,
    isCurrentlyWinning,
    isWinnerSelected,
    isWinnerVendor,
  };
}

export default function VendorBids() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();
  const { currency: regionCurrency = 'INR' } = useRegion();
  const abortRef = useRef(null);

  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [loadingMoreActive, setLoadingMoreActive] = useState(false);
  const [loadingMoreCompleted, setLoadingMoreCompleted] = useState(false);
  const [itemsActive, setItemsActive] = useState([]);
  const [itemsCompleted, setItemsCompleted] = useState([]);
  const [tab, setTab] = useState('active'); // 'active' | 'completed'
  const [queryActive, setQueryActive] = useState('');
  const [queryCompleted, setQueryCompleted] = useState('');
  const [pageActive, setPageActive] = useState(1);
  const [pageCompleted, setPageCompleted] = useState(1);
  const [metaActive, setMetaActive] = useState({ page: 1, totalPages: 1, total: null });
  const [metaCompleted, setMetaCompleted] = useState({ page: 1, totalPages: 1, total: null });

  useEffect(() => {
    try {
      const urlTab = String(new URLSearchParams(location.search || '').get('tab') || '').toLowerCase();
      if (urlTab === 'active' || urlTab === 'completed') setTab(urlTab);
    } catch {
      // ignore
    }
  }, [location.search]);

  const loadActive = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      if (!kycAccepted) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (append) setLoadingMoreActive(true);
      else setLoadingActive(true);
      try {
        const res = await projectService.listBidParticipation({ page: nextPage, limit: 20, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const normalized = list.map(normalizeParticipationItem).filter((x) => x?.id && !x.vendorWithdrewAllBids);
        const slice = normalized.filter((x) => x.isActive);
        if (append) {
          setItemsActive((prev) => mergeParticipationById(prev, slice));
        } else {
          setItemsActive(slice);
        }
        const meta = res?.meta || { page: nextPage, totalPages: 1, total: null };
        setMetaActive(meta);
        setPageActive(meta.page || nextPage);
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load bids', 'error');
        if (!append) setItemsActive([]);
      } finally {
        setLoadingActive(false);
        setLoadingMoreActive(false);
      }
    },
    [addToast, kycAccepted],
  );

  const loadCompleted = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      if (!kycAccepted) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (append) setLoadingMoreCompleted(true);
      else setLoadingCompleted(true);
      try {
        const res = await projectService.listBidParticipation({ page: nextPage, limit: 6, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const normalized = list.map(normalizeParticipationItem).filter((x) => x?.id && !x.vendorWithdrewAllBids);
        const slice = normalized.filter((x) => !x.isActive);
        if (append) {
          setItemsCompleted((prev) => mergeParticipationById(prev, slice));
        } else {
          setItemsCompleted(slice);
        }
        const meta = res?.meta || { page: nextPage, totalPages: 1, total: null };
        setMetaCompleted(meta);
        setPageCompleted(meta.page || nextPage);
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load bids', 'error');
        if (!append) setItemsCompleted([]);
      } finally {
        setLoadingCompleted(false);
        setLoadingMoreCompleted(false);
      }
    },
    [addToast, kycAccepted],
  );

  useEffect(() => {
    if (!kycAccepted) return;
    if (tab === 'active') {
      setPageActive(1);
      loadActive({ nextPage: 1, append: false });
    } else {
      setPageCompleted(1);
      loadCompleted({ nextPage: 1, append: false });
    }
    return () => abortRef.current?.abort();
  }, [tab, loadActive, loadCompleted, kycAccepted]);

  const filteredActive = useMemo(() => {
    const q = String(queryActive || '').trim().toLowerCase();
    if (!q) return itemsActive;
    return itemsActive.filter((x) => {
      const t = String(x?.title ?? '').toLowerCase();
      return t.includes(q);
    });
  }, [itemsActive, queryActive]);

  const filteredCompleted = useMemo(() => {
    const q = String(queryCompleted || '').trim().toLowerCase();
    if (!q) return itemsCompleted;
    return itemsCompleted.filter((x) => {
      const t = String(x?.title ?? '').toLowerCase();
      return t.includes(q);
    });
  }, [itemsCompleted, queryCompleted]);

  const filtered = tab === 'active' ? filteredActive : filteredCompleted;

  const meta = tab === 'active' ? metaActive : metaCompleted;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);

  const loading = tab === 'active' ? loadingActive : loadingCompleted;
  const loadingMore = tab === 'active' ? loadingMoreActive : loadingMoreCompleted;

  const handleLoadMore = useCallback(() => {
    if (!canNext || loadingMore) return;
    if (tab === 'active') {
      loadActive({ nextPage: pageActive + 1, append: true });
    } else {
      loadCompleted({ nextPage: pageCompleted + 1, append: true });
    }
  }, [canNext, loadingMore, tab, pageActive, pageCompleted, loadActive, loadCompleted]);

  if (!kycAccepted) {
    return <VendorKycRequiredCard message="Please complete your KYC to access bids." />;
  }

  return (
    <div className="w-full pb-[120px] lg:pb-[96px] animate-fade-in">
      {/* Tabs + search */}
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 border-b border-pale/60">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="relative min-w-0 w-full md:w-[420px] md:max-w-[55vw] md:shrink-0">
            <input
              value={tab === 'active' ? queryActive : queryCompleted}
              onChange={(e) => (tab === 'active' ? setQueryActive(e.target.value) : setQueryCompleted(e.target.value))}
              placeholder="Search projects…"
              className="input-search-quiet-focus w-full rounded-2xl border border-pale bg-white py-2.5 pl-9 pr-2 text-[12px] font-medium md:py-3 md:pl-11 md:pr-4 md:text-[13px]"
            />
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted md:left-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="md:h-[18px] md:w-[18px]"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 border-t border-pale/70 pt-3 md:gap-2 md:flex-1 md:justify-end md:border-0 md:pt-0">
            {[
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Completed' },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    navigate(`/vendor/bids?tab=${t.id}`, { replace: true });
                  }}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-0.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold transition-colors md:min-h-[2.25rem] md:px-7 md:py-3 md:text-[12px] ${
                    active
                      ? 'border-walnut bg-[#F2E6D4] font-bold text-ink'
                      : 'border-pale bg-white text-mid hover:bg-[#F2E6D4] hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-[calc(100vh-260px)] flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="26" height="26">
                  <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
                  <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
                  <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
                  <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
                  <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
                  <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
                  <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
                </svg>
              </div>
              <p className="mt-3 text-[14px] font-bold text-ink">
                {tab === 'active' ? 'No active bid participations' : 'No completed bid participations'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {filtered.map((x) => {
                const budgetPerPieceRaw = pickMetaValue(x.project, 'budgetPerPiece', 'budget_per_piece');
                const budgetPerPiece = Number(String(budgetPerPieceRaw || '').trim() || NaN);
                const quantityRequired = String(pickMetaValue(x.project, 'quantityRequired', 'quantity_required') || '').trim();
                const preferredDelivery = String(
                  pickMetaValue(x.project, 'preferredDeliveryTimeline', 'preferred_delivery_timeline') || '',
                ).trim();
                const moneyCurrency = projectPresentmentCurrency(x.project, regionCurrency);
                return (
                  <div
                    key={String(x.id)}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/vendor/bids/${encodeURIComponent(String(x.id))}?tab=${encodeURIComponent(tab)}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/vendor/bids/${encodeURIComponent(String(x.id))}?tab=${encodeURIComponent(tab)}`); }}
                    className="bg-white rounded-2xl border border-pale overflow-hidden cursor-pointer hover:border-pale transition-colors"
                  >
                    <div className="relative">
                      <Thumbnail src={x.thumbnailUrl} alt={x.title} />
                      {tab === 'completed' && x.isWinnerSelected && x.isWinnerVendor ? (
                        <span className="absolute left-3 top-3 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-[11px] font-extrabold text-green-700">
                          Winner
                        </span>
                      ) : null}
                      <span className="absolute right-3 top-3 px-3 py-1.5 rounded-full bg-walnut text-blush text-[11px] font-extrabold inline-flex items-center gap-2 tabular-nums">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                          <circle cx="12" cy="13" r="8" />
                          <path d="M12 9v4l2 2" />
                          <path d="M5 3 2 6" />
                          <path d="m22 6-3-3" />
                          <path d="M6.38 18.7 4 21" />
                          <path d="M17.64 18.67 20 21" />
                        </svg>
                        {(() => {
                          const ms = x.finishesMs != null ? Math.max(0, x.finishesMs - Date.now()) : null;
                          const ended = ms != null ? ms <= 0 : true;
                          return ended ? 'Bid Ended' : formatCountdown(ms);
                        })()}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[14px] font-extrabold text-ink truncate">{x.title}</p>
                      <div className="mt-3 space-y-1.5 text-[12px] text-mid">
                        {x.customerName ? (
                          <p>
                            Customer: <span className="font-extrabold text-ink">{x.customerName}</span>
                          </p>
                        ) : null}
                        <p>
                          Budget: <span className="font-extrabold text-ink">{Number.isFinite(budgetPerPiece) && budgetPerPiece > 0 ? formatCurrency(budgetPerPiece, moneyCurrency) : '—'}</span>
                        </p>
                        <p>
                          Quantity: <span className="font-extrabold text-ink">{quantityRequired || '—'}</span>
                        </p>
                        <p>
                          Expected delivery:{' '}
                          <span className="font-extrabold text-ink">{preferredDelivery ? formatDateOnlyFromInput(preferredDelivery) : '—'}</span>
                        </p>
                      </div>
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/vendor/bids/${encodeURIComponent(String(x.id))}?tab=${encodeURIComponent(tab)}`)}
                          className="w-full px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90"
                        >
                          {x.isActive ? 'Manage Bidding' : 'View Bids'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {canNext ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-10 py-3 rounded-2xl border border-pale bg-white text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
