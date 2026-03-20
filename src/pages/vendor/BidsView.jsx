import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
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

function formatCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(t / 3600)).padStart(2, '0');
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function bidVendorIdOf(b) {
  return b?.vendorId ?? b?.vendor_id ?? b?.vendor?.id ?? b?.vendor?._id ?? null;
}

function bidVendorNameOf(b) {
  const joined = `${b?.vendor?.firstName ?? ''} ${b?.vendor?.lastName ?? ''}`.trim();
  const name = b?.vendorName ?? b?.vendor_name ?? b?.vendor?.fullName ?? b?.vendor?.name ?? joined ?? null;
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed ? trimmed : null;
}

function bidPriceOf(b) {
  const v = b?.price ?? b?.amount ?? b?.bidAmount ?? b?.bid_amount ?? null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bidDaysOf(b) {
  const v = b?.daysToComplete ?? b?.days_to_complete ?? b?.noOfDays ?? b?.no_of_days ?? b?.timeline ?? null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bidCreatedAtOf(b) {
  return b?.createdAt ?? b?.created_at ?? b?.placedAt ?? b?.placed_at ?? b?.timestamp ?? null;
}

function pickWinningBid(bids) {
  const list = Array.isArray(bids) ? bids : [];
  let winner = null;
  for (const b of list) {
    const price = bidPriceOf(b);
    const days = bidDaysOf(b);
    if (price == null || days == null) continue;
    if (!winner) {
      winner = b;
      continue;
    }
    const wp = bidPriceOf(winner);
    const wd = bidDaysOf(winner);
    if (wp == null || wd == null) {
      winner = b;
      continue;
    }
    if (price < wp) winner = b;
    else if (price === wp && days < wd) winner = b;
    else if (price === wp && days === wd) {
      const tA = new Date(bidCreatedAtOf(b) || 0).getTime();
      const tW = new Date(bidCreatedAtOf(winner) || 0).getTime();
      if (Number.isFinite(tA) && Number.isFinite(tW) && tA < tW) winner = b;
    }
  }
  return winner;
}

function daysLabel(days) {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0) return '—';
  return `${d} days`;
}

function avatarUrlFor(name) {
  const safe = name || 'Jeweller';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safe)}&background=0D8ABC&color=fff`;
}

function coerceUrlArray(input) {
  const raw = input ?? [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? [raw] : [];
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

function isLikelyImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  const base = (raw.split('?')[0] || raw).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].some((ext) => base.endsWith(ext));
}

function pickThumbnailUrl(attachments) {
  const arr = Array.isArray(attachments) ? attachments : [];
  const img = arr.find((u) => isLikelyImageUrl(u));
  return img || null;
}

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
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

function customerIdOf(project, details) {
  const p = project ?? {};
  const d = details ?? {};
  const c = p?.customer ?? p?.customerSummary ?? p?.user ?? d?.customer ?? d?.customerSummary ?? d?.data?.customer ?? null;
  return c?.id ?? c?._id ?? p?.customerId ?? p?.customer_id ?? null;
}

export default function VendorBidsView() {
  const { id } = useParams();
  const projectId = id;
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();
  const abortRef = useRef(null);
  const backTab = useMemo(() => {
    try {
      const t = String(new URLSearchParams(location.search || '').get('tab') || '').toLowerCase();
      return t === 'completed' ? 'completed' : 'active';
    } catch {
      return 'active';
    }
  }, [location.search]);

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [search, setSearch] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('amount_asc');
  const [nowTs, setNowTs] = useState(Date.now());
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [bidForm, setBidForm] = useState({ price: '', daysToComplete: '' });
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [withdrawingAll, setWithdrawingAll] = useState(false);
  const [withdrawAllModalOpen, setWithdrawAllModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const project = details?.project ?? details?.data?.project ?? details ?? null;
  const activeBidWindow = details?.activeBidWindow ?? details?.active_bid_window ?? null;
  const finishingAt =
    activeBidWindow?.finishingTimestamp ??
    activeBidWindow?.finishingAt ??
    activeBidWindow?.finishing_at ??
    null;
  const finishesMs = finishingAt ? new Date(finishingAt).getTime() : null;
  const timeLeftMs = finishesMs != null ? Math.max(0, finishesMs - nowTs) : null;
  const bidEnded = timeLeftMs != null ? timeLeftMs <= 0 : false;
  const isActive = Boolean(activeBidWindow) && !bidEnded;

  const myVendorId = user?.id ?? user?._id ?? user?.vendorId ?? user?.vendor_id ?? null;
  const winningBid = useMemo(() => pickWinningBid(bids), [bids]);
  const budgetText = useMemo(() => {
    if (!project) return '—';
    const range = project?.amountRange ?? project?.amount_range ?? null;
    const min = Number(range?.min ?? range?.minAmount ?? project?.minAmount ?? NaN);
    const max = Number(range?.max ?? range?.maxAmount ?? project?.maxAmount ?? NaN);
    if (!Number.isFinite(min) && !Number.isFinite(max)) return '—';
    return `₹ ${formatMoney(Number.isFinite(min) ? min : 0)} - ₹ ${formatMoney(Number.isFinite(max) ? max : 0)}`;
  }, [project]);
  const durationText = useMemo(() => {
    const t = Number(project?.timelineExpected ?? project?.timeline_expected ?? project?.noOfDays ?? NaN);
    if (!Number.isFinite(t) || t <= 0) return '—';
    return `${t} days`;
  }, [project]);

  const attachments = useMemo(() => coerceUrlArray(project?.attachments), [project]);
  const thumbnailUrl = useMemo(() => pickThumbnailUrl(attachments), [attachments]);
  const metaRows = useMemo(() => metaRowsOf(project), [project]);
  const customerId = useMemo(() => customerIdOf(project, details), [details, project]);

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

  const loadBids = useCallback(async () => {
    if (!projectId) return;
    setBidsLoading(true);
    try {
      const list = await projectService.listBids(projectId);
      setBids(Array.isArray(list) ? list : []);
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
    loadBids();
    return () => abortRef.current?.abort();
  }, [load, loadBids]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredBids = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    let list = bids;
    if (q) {
      list = list.filter((b) => {
        const name = (bidVendorNameOf(b) || '').toLowerCase();
        return name.includes(q);
      });
    }
    const key = String(sortBy || '').trim().toLowerCase();
    const byPrice = (b) => bidPriceOf(b) ?? 0;
    const byDays = (b) => bidDaysOf(b) ?? 0;
    const arr = [...list];
    if (key === 'amount_desc') arr.sort((a, b) => byPrice(b) - byPrice(a));
    else if (key === 'delivery_asc') arr.sort((a, b) => byDays(a) - byDays(b));
    else if (key === 'delivery_desc') arr.sort((a, b) => byDays(b) - byDays(a));
    else arr.sort((a, b) => byPrice(a) - byPrice(b));
    return arr;
  }, [bids, search, sortBy]);

  const handleWithdrawAll = async () => {
    if (!projectId || !isActive) return;
    setWithdrawAllModalOpen(true);
  };

  const confirmWithdrawAll = async () => {
    if (withdrawingAll || !projectId || !isActive) return;
    setWithdrawingAll(true);
    try {
      await projectService.withdrawAllBids(projectId);
      addToast('All bids withdrawn.', 'success');
      // If vendor withdrew all bids, this project should disappear from vendor participation list (per PRD).
      // Take them back to the vendor bids list (Active tab).
      navigate('/vendor/bids?tab=active', { replace: true });
    } catch (e) {
      addToast(e?.message || 'Failed to withdraw bids', 'error');
    } finally {
      setWithdrawingAll(false);
      setWithdrawAllModalOpen(false);
    }
  };

  const handleCancelBid = async (bid) => {
    if (!projectId || !isActive) return;
    setCancellingId(bid?.id ?? bid?.bidEntryId ?? bid?.bid_entry_id ?? null);
    setCancelModalOpen(true);
  };

  const confirmCancelBid = async () => {
    if (cancelSubmitting || !projectId || !isActive) return;
    setCancelSubmitting(true);
    try {
      await projectService.withdrawLatestBid(projectId);
      addToast('Bid withdrawn.', 'success');
      // If that was their last bid, they should no longer stay on this page.
      // Always return to vendor bids list (Active tab) after withdrawing.
      navigate('/vendor/bids?tab=active', { replace: true });
    } catch (e) {
      addToast(e?.message || 'Failed to withdraw bid', 'error');
    } finally {
      setCancellingId(null);
      setCancelModalOpen(false);
      setCancelSubmitting(false);
    }
  };

  const submitBid = async () => {
    if (bidSubmitting || !projectId || bidEnded) return;
    const price = Number(bidForm.price);
    const daysToComplete = Number(bidForm.daysToComplete);
    if (!Number.isFinite(price) || price <= 0) {
      addToast('Enter a valid bid amount.', 'error');
      return;
    }
    if (!Number.isFinite(daysToComplete) || daysToComplete <= 0) {
      addToast('Enter a valid delivery duration (days).', 'error');
      return;
    }
    setBidSubmitting(true);
    try {
      await projectService.placeBid(projectId, { price, daysToComplete });
      addToast('Bid updated.', 'success');
      setBidModalOpen(false);
      setBidForm({ price: '', daysToComplete: '' });
      await loadBids();
      await load();
    } catch (e) {
      addToast(e?.message || 'Failed to update bid', 'error');
    } finally {
      setBidSubmitting(false);
    }
  };



  const chatWithCustomer = useCallback(() => {
    if (!customerId) return;
    navigate('/vendor/messages', { state: { openRecipientId: customerId } });
  }, [customerId, navigate]);

  if (loading && !details) {
    return (
      <div className="w-full min-h-[calc(100vh-260px)] flex items-center justify-center">
        <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!details && !loading) {
    return (
      <div className="w-full py-8">
        <button
          type="button"
          onClick={() => navigate(`/vendor/bids?tab=${encodeURIComponent(backTab)}`)}
          className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <p className="mt-4 text-[14px] text-gray-500">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="w-full flex flex-col lg:flex-row gap-4">
        {/* Left: project card */}
        <div className="w-full lg:w-[360px] shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate(`/vendor/bids?tab=${encodeURIComponent(backTab)}`)}
                className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              {isActive && finishesMs != null ? (
                <span className="px-3 py-1.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold tabular-nums">
                  {formatCountdown(timeLeftMs)}
                </span>
              ) : bidEnded ? (
                <span className="px-3 py-1.5 rounded-xl bg-gray-500 text-white text-[12px] font-extrabold">
                  Bid Ended
                </span>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-gray-100 overflow-hidden">
              <div className="relative h-[220px] bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 overflow-hidden">
                <SafeImage
                  src={thumbnailUrl}
                  alt={project?.title ?? 'Project'}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[16px] font-extrabold text-gray-900 break-words">{project?.title ?? 'Project'}</p>
              <p className="mt-2 text-[12px] text-gray-500 leading-relaxed whitespace-pre-wrap">{project?.description ?? '—'}</p>
              <div className="mt-4 space-y-1.5">
                <p className="text-[12px] text-gray-500">
                  Budget: <span className="font-extrabold text-gray-900">{budgetText}</span>
                </p>
                <p className="text-[12px] text-gray-500">
                  Duration: <span className="font-extrabold text-gray-900">{durationText}</span>
                </p>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={chatWithCustomer}
                disabled={!customerId}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[12px] font-extrabold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat with Customer
              </button>
            </div>

            {metaRows.length > 0 ? (
              <div className="mt-4">
                <p className="text-[12px] font-extrabold text-gray-900">Extra Details</p>
                <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  {metaRows.map((r) => (
                    <div key={r.key} className="space-y-0.5">
                      <p className="text-[12px] font-extrabold text-gray-900 break-words">{r.label}</p>
                      <p className="text-[12px] text-gray-600 font-semibold break-words whitespace-pre-wrap">{r.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {attachments.length > 0 ? (
              <div className="mt-4">
                <p className="text-[12px] font-extrabold text-gray-900">Attachments</p>
                <div className="mt-3 space-y-2">
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
        </div>

        {/* Right: Biddings */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] font-extrabold text-gray-900">Biddings</p>
              <div className="flex items-center gap-2 flex-wrap">
                {isActive && (
                  <>
                    <button
                      type="button"
                      onClick={handleWithdrawAll}
                      disabled={withdrawingAll}
                      className="px-4 py-2 rounded-xl border border-red-200 text-[12px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {withdrawingAll ? 'Withdrawing…' : 'Withdraw All Bids'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBidModalOpen(true)}
                      disabled={bidEnded}
                      className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90 disabled:opacity-50"
                    >
                      Update Bid
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 md:justify-between">
              <div className="flex-1 min-w-0 md:flex-none md:w-[360px] lg:w-[420px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Search "Jewellers"'
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                      <button type="button" onClick={() => { setSortBy('amount_asc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50">Low amount</button>
                      <button type="button" onClick={() => { setSortBy('amount_desc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50">High amount</button>
                      <button type="button" onClick={() => { setSortBy('delivery_asc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50">Low delivery duration</button>
                      <button type="button" onClick={() => { setSortBy('delivery_desc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-gray-50">High delivery duration</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 flex-1 min-h-0 overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <p className="text-[12px] font-extrabold text-gray-900">Bids</p>
              <button
                type="button"
                onClick={loadBids}
                disabled={bidsLoading}
                title="Reload bids"
                className="p-2 rounded-xl bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {bidsLoading ? (
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
            <div className="p-4 md:p-6 min-h-0 overflow-y-auto">
              {bidsLoading && bids.length === 0 ? (
                <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
                  <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : filteredBids.length === 0 ? (
                <div className="min-h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[13px] font-bold text-gray-700">No bids found</p>
                    <p className="mt-1 text-[12px] text-gray-400">Try adjusting search or sorting.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredBids.map((b, idx) => {
                    const bidId = String(b?.bidEntryId ?? b?.bid_entry_id ?? b?.id ?? b?._id ?? '');
                    const vendorId = bidVendorIdOf(b);
                    const vendorName = bidVendorNameOf(b) || 'Jeweller';
                    const amount = bidPriceOf(b);
                    const days = bidDaysOf(b);
                    const isMe = myVendorId != null && vendorId != null && String(vendorId) === String(myVendorId);
                    const winId = winningBid ? String(winningBid?.id ?? winningBid?.bidEntryId ?? winningBid?.bid_entry_id ?? winningBid?._id ?? '') : '';
                    const thisId = String(b?.id ?? b?.bidEntryId ?? b?.bid_entry_id ?? b?._id ?? '');
                    const isWinning = winId && thisId && winId === thisId;
                    const isLowest = isWinning;

                    return (
                      <div
                        key={bidId || idx}
                        className={`rounded-2xl border p-4 bg-white ${
                          isMe ? 'border-primary-dark/30 bg-primary-dark/5' : isLowest ? 'border-green-300 bg-green-50/40' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-100 bg-white shrink-0">
                              <img src={avatarUrlFor(vendorName)} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-extrabold text-gray-900 truncate">
                                  {isMe ? `${vendorName || 'Me'} (me)` : vendorName}
                                </p>
                              </div>
                              <div className="mt-1 text-[12px] text-gray-500 space-y-1">
                                <span className="flex items-center gap-1">
                                  Delivery In: {daysLabel(days)}
                                </span>
                                <p className="text-[12px] font-extrabold text-gray-800">
                                  ₹{amount != null ? formatMoney(amount) : '—'} Bidding Price
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {(isLowest || isWinning) ? (
                          <div className="mt-3 flex items-center justify-end gap-2 min-h-[22px]">
                            {isLowest ? (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-green-50 border-green-200 text-green-700">
                                Lowest
                              </span>
                            ) : null}
                            {isWinning ? (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-green-50 border-green-200 text-green-700">
                                Winning
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-3 min-h-[22px]" />
                        )}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span />
                          {isActive && isMe ? (
                            <button
                              type="button"
                              onClick={() => handleCancelBid(b)}
                              disabled={cancellingId != null}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {cancellingId != null ? '…' : 'Cancel bid'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update bid modal */}
      {bidModalOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !bidSubmitting && setBidModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <p className="text-[14px] font-extrabold text-gray-900">Update Bid</p>
              <button
                type="button"
                onClick={() => setBidModalOpen(false)}
                disabled={bidSubmitting}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-60"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">Bid amount</p>
                  <input
                    type="number"
                    value={bidForm.price}
                    onChange={(e) => setBidForm((p) => ({ ...(p || {}), price: e.target.value }))}
                    placeholder="e.g. 80000"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary-dark"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">Delivery duration (days)</p>
                  <input
                    type="number"
                    value={bidForm.daysToComplete}
                    onChange={(e) => setBidForm((p) => ({ ...(p || {}), daysToComplete: e.target.value }))}
                    placeholder="e.g. 10"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary-dark"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setBidModalOpen(false)} disabled={bidSubmitting} className="px-4 py-2.5 rounded-xl border border-gray-200 text-[12px] font-extrabold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={submitBid} disabled={bidSubmitting || bidEnded} className="px-4 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {bidSubmitting ? 'Submitting…' : 'Update Bid'}
                </button>
              </div>
              {bidEnded ? <p className="mt-3 text-[11px] text-gray-400">Bidding window has ended.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Withdraw all bids confirm modal */}
      {withdrawAllModalOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !withdrawingAll && setWithdrawAllModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Withdraw All Bids</p>
                <p className="mt-1 text-[12px] text-gray-500">
                  This will withdraw all your bids for this project. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawAllModalOpen(false)}
                disabled={withdrawingAll}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-60"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawAllModalOpen(false)}
                  disabled={withdrawingAll}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-[12px] font-extrabold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={confirmWithdrawAll}
                  disabled={withdrawingAll}
                  className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-[12px] font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {withdrawingAll ? 'Withdrawing…' : 'Withdraw All Bids'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancel bid confirm modal */}
      {cancelModalOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !cancelSubmitting && setCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Cancel Bid</p>
                <p className="mt-1 text-[12px] text-gray-500">
                  This will withdraw your latest bid for this project.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelSubmitting}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-60"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-[12px] font-extrabold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={confirmCancelBid}
                  disabled={cancelSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-[12px] font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelSubmitting ? 'Cancelling…' : 'Cancel Bid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
