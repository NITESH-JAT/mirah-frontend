import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';
import { formatMoney } from '../../utils/formatMoney';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
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
  const arr = Array.isArray(attachments) ? attachments : attachments ? [attachments] : [];
  const img = arr.find((u) => isLikelyImageUrl(u));
  return img || null;
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
    const key = String(k).trim();
    if ((key === 'sizeMode' || key === 'size_mode') && typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'custom') value = 'Custom';
      else if (normalized === 'standard') value = 'Standard';
    }
    rows.push({ key: k, label: String(label || k), value: value == null || value === '' ? '—' : String(value) });
  }
  return rows;
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

function startOfLocalDay(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateOnlyFromInput(value) {
  const d = parseLocalDateInput(value);
  if (!d) return String(value || '').trim() || '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function bidPlaceholderBudgetAmount(budgetPerPieceRaw) {
  const n = Number(String(budgetPerPieceRaw ?? '').replace(/,/g, '').trim());
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return 700000;
}

function bidPlaceholderDeliveryDays(preferredDeliveryRaw) {
  const raw = String(preferredDeliveryRaw || '').trim();
  if (!raw) return 23;
  const base = startOfLocalDay(new Date());
  const target = parseLocalDateInput(raw);
  if (!base || !target) return 23;
  const diffMs = startOfLocalDay(target)?.getTime() - base.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(diffDays) || diffDays <= 0) return 23;
  return diffDays;
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

function customerIdOf(project, details) {
  const p = project ?? {};
  const d = details ?? {};
  const c =
    p?.customer ??
    p?.customerSummary ??
    p?.user ??
    d?.customer ??
    d?.customerSummary ??
    d?.data?.customer ??
    null;
  return c?.id ?? c?._id ?? p?.customerId ?? p?.customer_id ?? null;
}

function customerNameOf(project, details) {
  const p = project ?? {};
  const d = details ?? {};
  const c =
    p?.customer ??
    p?.customerSummary ??
    p?.user ??
    d?.customer ??
    d?.customerSummary ??
    d?.data?.customer ??
    null;
  const joined = `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
  const name = c?.fullName ?? c?.name ?? joined ?? null;
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed ? trimmed : null;
}

export default function VendorExploreProject() {
  const { id } = useParams();
  const projectId = id;
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user } = useAuth();

  const abortRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [bidForm, setBidForm] = useState({ price: '', daysToComplete: '' });
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  const project = details?.project ?? details?.data?.project ?? details?.item ?? details?.data ?? details ?? null;
  const activeBidWindow = details?.activeBidWindow ?? details?.active_bid_window ?? details?.bidWindow ?? details?.bid_window ?? null;
  const finishingAt =
    activeBidWindow?.finishingTimestamp ??
    activeBidWindow?.finishingAt ??
    activeBidWindow?.finishing_at ??
    null;
  const finishesMs = finishingAt ? new Date(finishingAt).getTime() : null;
  const timeLeftMs = finishesMs != null ? Math.max(0, finishesMs - nowTs) : null;
  const bidEnded = timeLeftMs != null ? timeLeftMs <= 0 : false;

  const attachments = useMemo(() => coerceUrlArray(project?.attachments), [project]);
  const referenceImage = useMemo(
    () => String(project?.referenceImage ?? project?.reference_image ?? '').trim(),
    [project],
  );
  const thumbnailUrl = useMemo(
    () => (referenceImage && /^https?:\/\//i.test(referenceImage) ? referenceImage : pickThumbnailUrl(attachments)),
    [attachments, referenceImage],
  );
  const metaRows = useMemo(() => metaRowsOf(project), [project]);
  const metaIndex = useMemo(() => new Map(metaRows.map((r) => [String(r?.key || '').trim(), r])), [metaRows]);
  const budgetPerPieceRaw = String(metaIndex.get('budgetPerPiece')?.value ?? metaIndex.get('budget_per_piece')?.value ?? '').trim();
  const quantityRequiredRaw = String(metaIndex.get('quantityRequired')?.value ?? metaIndex.get('quantity_required')?.value ?? '').trim();
  const preferredDeliveryRaw = String(
    metaIndex.get('preferredDeliveryTimeline')?.value ?? metaIndex.get('preferred_delivery_timeline')?.value ?? '',
  ).trim();
  const sizeModeRaw = String(metaIndex.get('sizeMode')?.value ?? metaIndex.get('size_mode')?.value ?? '').trim().toLowerCase();
  const customSizeValueRaw = String(
    metaIndex.get('sizeCustomValue')?.value ?? metaIndex.get('size_custom_value')?.value ?? '',
  ).trim();
  const customSizeUnitRaw = String(
    metaIndex.get('sizeCustomUnit')?.value ?? metaIndex.get('size_custom_unit')?.value ?? '',
  ).trim();
  const customSizeDisplay = `${customSizeValueRaw}${customSizeUnitRaw ? ` ${customSizeUnitRaw}` : ''}`.trim();
  const remainingMetaRows = useMemo(() => {
    const skip = new Set([
      'budgetPerPiece',
      'budget_per_piece',
      'quantityRequired',
      'quantity_required',
      'preferredDeliveryTimeline',
      'preferred_delivery_timeline',
      'sizeCustomValue',
      'size_custom_value',
      'sizeCustomUnit',
      'size_custom_unit',
    ]);
    const rows = (metaRows || []).filter((r) => !skip.has(String(r?.key || '').trim()));
    if (sizeModeRaw === 'custom') {
      const customRow = { key: 'customSizeDisplay', label: 'Custom Size', value: customSizeDisplay || '—' };
      const sizeModeIndex = rows.findIndex((r) => {
        const key = String(r?.key || '').trim();
        return key === 'sizeMode' || key === 'size_mode';
      });
      if (sizeModeIndex >= 0) rows.splice(sizeModeIndex + 1, 0, customRow);
      else rows.unshift(customRow);
    }
    return rows;
  }, [customSizeDisplay, metaRows, sizeModeRaw]);

  const myVendorId = user?.id ?? user?._id ?? user?.vendorId ?? user?.vendor_id ?? null;
  const winningBid = useMemo(() => pickWinningBid(bids), [bids]);

  const customerId = useMemo(() => customerIdOf(project, details), [details, project]);
  const customerName = useMemo(() => customerNameOf(project, details), [details, project]);

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

  const submitBid = async () => {
    if (bidSubmitting || !projectId) return;
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
      addToast('Bid submitted.', 'success');
      setBidModalOpen(false);
      setBidForm({ price: '', daysToComplete: '' });
      await loadBids();
      await load();
    } catch (e) {
      addToast(e?.message || 'Failed to submit bid', 'error');
    } finally {
      setBidSubmitting(false);
    }
  };

  const DetailsCard = ({ className = '' }) => (
    <div className={`rounded-2xl border border-pale bg-white p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold text-ink break-words">{project?.title ?? 'Project'}</p>
          <div className="mt-3 space-y-1.5 text-[12px] text-mid">
            <p>
              Budget per piece:{' '}
              <span className="font-extrabold text-ink">
                {budgetPerPieceRaw ? `₹ ${formatMoney(Number(budgetPerPieceRaw) || 0)}` : '—'}
              </span>
            </p>
            <p>
              Quantity required:{' '}
              <span className="font-extrabold text-ink">{quantityRequiredRaw || '—'}</span>
            </p>
            <p>
              Expected delivery:{' '}
              <span className="font-extrabold text-ink">
                {preferredDeliveryRaw ? formatDateOnlyFromInput(preferredDeliveryRaw) : '—'}
              </span>
            </p>
            {customerName ? (
              <p>
                Customer: <span className="font-extrabold text-ink">{customerName}</span>
              </p>
            ) : null}
          </div>
        </div>

        <span className="shrink-0 px-3 py-1.5 rounded-full bg-walnut text-blush text-[11px] font-extrabold inline-flex items-center tabular-nums">
          {timeLeftMs == null ? '—' : bidEnded ? 'Bid Ended' : formatCountdown(timeLeftMs)}
        </span>
      </div>
    </div>
  );

  const MetaCard = ({ className = '' }) =>
    remainingMetaRows.length > 0 ? (
      <div className={`rounded-2xl border border-pale bg-white overflow-hidden ${className}`}>
        <div className="px-5 py-4 border-b border-pale">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Details</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {remainingMetaRows.map((r) => (
            <div key={r.key} className="space-y-1">
              <p className="text-[12px] text-muted font-semibold">{r.label}</p>
              <p className="text-[12px] text-ink font-extrabold break-words whitespace-pre-wrap">{r.value}</p>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  const AttachmentsCard = ({ className = '' }) =>
    attachments.length > 0 ? (
      <div className={`rounded-2xl border border-pale bg-white p-5 ${className}`}>
        <p className="text-[12px] font-extrabold text-ink">Attachments</p>
        <div className="mt-3 space-y-2">
          {attachments.map((u, idx) => {
            const name = filenameFromUrl(u, `Attachment ${idx + 1}`);
            return (
              <a
                key={`${u}-${idx}`}
                href={u}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-pale bg-cream hover:bg-blush transition-colors"
                title="Open attachment"
              >
                <span className="min-w-0 inline-flex items-center gap-2 text-[12px] font-semibold text-mid">
                  <span className="text-muted shrink-0">{attachmentIcon(name)}</span>
                  <span className="truncate">{name}</span>
                </span>
                <span className="shrink-0 text-muted">
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
    ) : null;

  return (
    <div className="w-full pt-4 sm:pt-5 pb-10 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-extrabold text-mid hover:bg-cream inline-flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
      </div>

      {loading ? (
        <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
          <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : !project ? (
        <div className="rounded-2xl border border-pale bg-cream p-6 text-[13px] text-mid">Unable to load project.</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Match customer View Bids ratio: fixed left, fluid right */}
          <div className="w-full lg:w-[400px] shrink-0 lg:self-start">
            <div className="rounded-2xl border border-pale bg-white overflow-hidden">
              <div className="relative h-[280px] sm:h-[340px] bg-gradient-to-br from-cream via-blush to-pale overflow-hidden">
                <SafeImage src={thumbnailUrl} alt={project?.title ?? 'Project'} className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="p-4 border-t border-pale">
                <div className="flex flex-col gap-2">
                  {customerId ? (
                    <button
                      type="button"
                      onClick={() => navigate('/vendor/messages', { state: { openRecipientId: customerId } })}
                      className="w-full px-5 py-3 rounded-2xl bg-white border border-pale text-[13px] font-extrabold text-mid hover:bg-cream inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Send message
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setBidModalOpen(true)}
                    disabled={bidEnded || bidSubmitting}
                    className="w-full px-5 py-3 rounded-2xl bg-walnut text-blush text-[13px] font-extrabold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bid Now
                  </button>
                </div>
                {bidEnded ? <p className="mt-2 text-[11px] text-muted text-center">Bidding window has ended.</p> : null}
              </div>
            </div>

            {/* Desktop-only: meta + attachments below image/buttons */}
            <div className="hidden lg:block mt-4 space-y-4">
              <MetaCard />
              <AttachmentsCard />
            </div>
          </div>

          <div className="w-full lg:flex-1 min-w-0 space-y-4">
            {/* Second action row + mobile-only details/meta/attachments */}
            <div className="lg:hidden">
              <DetailsCard />
              <div className="mt-4">
                <MetaCard />
              </div>
              <div className="mt-4">
                <AttachmentsCard />
              </div>
            </div>



            {/* Desktop-only: project details above bids */}
            <div className="hidden lg:block">
              <DetailsCard />
            </div>

            <div className="rounded-2xl border border-pale bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-extrabold text-ink">Bids</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadBids}
                    disabled={bidsLoading}
                    title="Reload bids"
                    className="p-2 rounded-xl bg-white border border-pale text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>

              {bidsLoading ? (
                <div className="mt-4 rounded-2xl border border-pale bg-cream p-10 flex items-center justify-center">
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : bids.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-pale bg-cream p-10 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-pale flex items-center justify-center text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <p className="mt-3 text-[14px] font-bold text-ink">No bids yet</p>
                    <p className="mt-1 text-[12px] text-muted">Be the first to place a bid.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {bids.map((b, idx) => {
                    const vendorId = bidVendorIdOf(b);
                    const vendorName = bidVendorNameOf(b);
                    const price = bidPriceOf(b);
                    const days = bidDaysOf(b);
                    const isMe = myVendorId != null && vendorId != null && String(vendorId) === String(myVendorId);
                    const isWinning = winningBid && String(winningBid?.id ?? winningBid?._id ?? idx) === String(b?.id ?? b?._id ?? idx);
                    return (
                      <div key={String(b?.id ?? b?._id ?? idx)} className="rounded-2xl border border-pale p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-extrabold text-ink truncate">
                              {isMe ? `${vendorName || 'Me'} (me)` : vendorName || `Jeweller #${vendorId ?? '—'}`}
                            </p>
                            <p className="mt-1 text-[12px] text-muted">
                              Amount:{' '}
                              <span className="font-extrabold text-ink">{price != null ? `₹ ${formatMoney(price)}` : '—'}</span>
                              {'  '}•{'  '}
                              Duration:{' '}
                              <span className="font-extrabold text-ink">{days != null ? `${days} days` : '—'}</span>
                            </p>
                          </div>
                          {isWinning ? (
                            <span className="shrink-0 px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-[11px] font-extrabold">
                              Winning
                            </span>
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
      )}

      {bidModalOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !bidSubmitting && setBidModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-ink">Place Your Bid</p>
                <p className="mt-1 text-[12px] text-muted truncate">{project?.title ?? 'Project'}</p>
              </div>
              <button
                type="button"
                onClick={() => setBidModalOpen(false)}
                disabled={bidSubmitting}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted mb-1">Bid amount (₹)</p>
                  <input
                    type="number"
                    value={bidForm.price}
                    onChange={(e) => setBidForm((p) => ({ ...(p || {}), price: e.target.value }))}
                    placeholder={`Budget is ₹ ${formatMoney(bidPlaceholderBudgetAmount(budgetPerPieceRaw))}`}
                    inputMode="numeric"
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 rounded-2xl border border-pale bg-white text-[13px] font-semibold text-ink placeholder:text-muted focus:outline-none focus:border-walnut"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted mb-1">Delivery duration (days)</p>
                  <input
                    type="number"
                    value={bidForm.daysToComplete}
                    onChange={(e) => setBidForm((p) => ({ ...(p || {}), daysToComplete: e.target.value }))}
                    placeholder={`Preferred delivery in ${bidPlaceholderDeliveryDays(preferredDeliveryRaw)} days`}
                    inputMode="numeric"
                    min="1"
                    step="1"
                    className="w-full px-4 py-3 rounded-2xl border border-pale bg-white text-[13px] font-semibold text-ink placeholder:text-muted focus:outline-none focus:border-walnut"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBidModalOpen(false)}
                  disabled={bidSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-pale text-[12px] font-extrabold text-mid hover:bg-cream disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitBid}
                  disabled={bidSubmitting || bidEnded}
                  className="px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bidSubmitting ? 'Submitting…' : 'Submit Bid'}
                </button>
              </div>

              {bidEnded ? (
                <p className="mt-3 text-[11px] text-muted">Bidding window has ended.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

