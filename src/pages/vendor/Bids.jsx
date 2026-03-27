import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';

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

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

function Thumbnail({ src, alt }) {
  return (
    <div className="relative h-40 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 overflow-hidden">
      <SafeImage src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
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
  const thumbnailUrl = pickThumbnailUrl(project);
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
  const abortRef = useRef(null);

  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
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
    async ({ nextPage = 1 } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadingActive(true);
      try {
        const res = await projectService.listBidParticipation({ page: nextPage, limit: 24, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const normalized = list.map(normalizeParticipationItem).filter((x) => x?.id && !x.vendorWithdrewAllBids);
        setItemsActive(normalized.filter((x) => x.isActive));
        const meta = res?.meta || { page: nextPage, totalPages: 1, total: null };
        setMetaActive(meta);
        setPageActive(meta.page || nextPage);
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load bids', 'error');
        setItemsActive([]);
      } finally {
        setLoadingActive(false);
      }
    },
    [addToast],
  );

  const loadCompleted = useCallback(
    async ({ nextPage = 1 } = {}) => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadingCompleted(true);
      try {
        const res = await projectService.listBidParticipation({ page: nextPage, limit: 24, signal: ctrl.signal });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const normalized = list.map(normalizeParticipationItem).filter((x) => x?.id && !x.vendorWithdrewAllBids);
        setItemsCompleted(normalized.filter((x) => !x.isActive));
        const meta = res?.meta || { page: nextPage, totalPages: 1, total: null };
        setMetaCompleted(meta);
        setPageCompleted(meta.page || nextPage);
      } catch (e) {
        if (isCanceledRequest(e)) return;
        addToast(e?.message || 'Failed to load bids', 'error');
        setItemsCompleted([]);
      } finally {
        setLoadingCompleted(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    if (tab === 'active') {
      loadActive({ nextPage: pageActive });
    } else {
      loadCompleted({ nextPage: pageCompleted });
    }
    return () => abortRef.current?.abort();
  }, [tab, pageActive, pageCompleted, loadActive, loadCompleted]);

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

  const currentPage = tab === 'active' ? pageActive : pageCompleted;
  const meta = tab === 'active' ? metaActive : metaCompleted;
  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const totalPages = Number(meta?.totalPages || 1) || 1;

  const loading = tab === 'active' ? loadingActive : loadingCompleted;

  return (
    <div className="w-full pb-[120px] lg:pb-[96px] animate-fade-in">
      {/* Tabs + search */}
      <div className="sticky top-0 z-30 isolate bg-[#F8F9FA] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-4 border-b border-gray-100/60">
        <div className="flex items-center justify-start">
          <div className="inline-flex rounded-2xl border border-gray-100 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => {
                setTab('active');
                navigate('/vendor/bids?tab=active', { replace: true });
              }}
              className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                tab === 'active' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('completed');
                navigate('/vendor/bids?tab=completed', { replace: true });
              }}
              className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                tab === 'completed' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="relative mt-4 max-w-md">
          <input
            value={tab === 'active' ? queryActive : queryCompleted}
            onChange={(e) => (tab === 'active' ? setQueryActive(e.target.value) : setQueryCompleted(e.target.value))}
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

      <div className="mt-5 min-h-[calc(100vh-260px)] flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
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
              <p className="mt-3 text-[14px] font-bold text-gray-900">
                {tab === 'active' ? 'No active bid participations' : 'No completed bid participations'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {filtered.map((x) => {
              const budgetPerPieceRaw = pickMetaValue(x.project, 'budgetPerPiece', 'budget_per_piece');
              const budgetPerPiece = Number(String(budgetPerPieceRaw || '').trim() || NaN);
              const quantityRequired = String(pickMetaValue(x.project, 'quantityRequired', 'quantity_required') || '').trim();
              const preferredDelivery = String(
                pickMetaValue(x.project, 'preferredDeliveryTimeline', 'preferred_delivery_timeline') || '',
              ).trim();
              return (
                <div
                  key={String(x.id)}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/vendor/bids/${encodeURIComponent(String(x.id))}?tab=${encodeURIComponent(tab)}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/vendor/bids/${encodeURIComponent(String(x.id))}?tab=${encodeURIComponent(tab)}`); }}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:border-gray-200 transition-colors"
                >
                  <div className="relative">
                    <Thumbnail src={x.thumbnailUrl} alt={x.title} />
                    {x.bestBid != null ? (
                      <span className="absolute left-3 top-3 px-3 py-1.5 rounded-full bg-white/90 border border-white text-[11px] font-extrabold text-gray-800">
                        Best bid: ₹{formatMoney(x.bestBid)}
                      </span>
                    ) : null}
                    {tab === 'active' && x.isCurrentlyWinning ? (
                      <span className="absolute left-3 top-12 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-[11px] font-extrabold text-green-700">
                        Winning
                      </span>
                    ) : null}
                    {tab === 'completed' && x.isWinnerSelected && x.isWinnerVendor ? (
                      <span className="absolute left-3 top-12 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-[11px] font-extrabold text-green-700">
                        Winner
                      </span>
                    ) : null}
                    <span className="absolute right-3 top-3 px-3 py-1.5 rounded-full bg-white/90 border border-white text-[11px] font-extrabold text-gray-800 inline-flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {(() => {
                        const ms = x.finishesMs != null ? Math.max(0, x.finishesMs - Date.now()) : null;
                        const ended = ms != null ? ms <= 0 : true;
                        return ended ? 'Bid Ended' : formatCountdown(ms);
                      })()}
                    </span>
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
                        Budget: <span className="font-extrabold text-gray-900">{Number.isFinite(budgetPerPiece) && budgetPerPiece > 0 ? `₹ ${formatMoney(budgetPerPiece)}` : '—'}</span>
                      </p>
                      <p>
                        Quantity: <span className="font-extrabold text-gray-900">{quantityRequired || '—'}</span>
                      </p>
                      <p>
                        Expected delivery:{' '}
                        <span className="font-extrabold text-gray-900">{preferredDelivery ? formatDateOnlyFromInput(preferredDelivery) : '—'}</span>
                      </p>
                      <p>
                        Bid Count: <span className="font-extrabold text-gray-900">{x.bidCount != null ? x.bidCount : '—'}</span>
                      </p>
                    </div>
                    <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/vendor/bids/${encodeURIComponent(String(x.id))}?tab=${encodeURIComponent(tab)}`)}
                        className="w-full px-4 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90"
                      >
                        {x.isActive ? 'Manage Bidding' : 'View Bids'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed pagination bar per tab */}
      {!loading && filtered.length > 0 ? (
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
                    if (tab === 'active') {
                      loadActive({ nextPage: next });
                    } else {
                      loadCompleted({ nextPage: next });
                    }
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
                    if (tab === 'active') {
                      loadActive({ nextPage: next });
                    } else {
                      loadCompleted({ nextPage: next });
                    }
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
