import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import ImageWithFullscreenZoom from '../../components/ImageWithFullscreenZoom';
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

function startOfLocalDay(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
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

function customerIdOf(project, details) {
  const p = project ?? {};
  const d = details ?? {};
  const c = p?.customer ?? p?.customerSummary ?? p?.user ?? d?.customer ?? d?.customerSummary ?? d?.data?.customer ?? null;
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

function bidStableId(b) {
  return b?.bidEntryId ?? b?.bid_entry_id ?? b?.id ?? b?._id ?? null;
}

function coerceAssignments(input) {
  const raw = input ?? [];
  return Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
}

function assignmentIdOfRecord(a) {
  return a?.id ?? a?._id ?? a?.assignmentId ?? a?.assignment_id ?? null;
}

function assignmentVendorIdFromRecord(a) {
  return a?.vendorId ?? a?.vendor_id ?? a?.vendor?.id ?? a?.vendor?._id ?? null;
}

function isAssignmentRowActive(a) {
  if (a?.isActive === undefined && a?.is_active === undefined) return true;
  const active = a?.isActive ?? a?.is_active ?? false;
  if (typeof active === 'boolean') return active;
  return String(active).trim().toLowerCase() === 'true';
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

  const VENDOR_PROJECTS_TAB_KEY = 'mirah_vendor_projects_last_tab';

  const goBack = useCallback(() => {
    const stateTab = String(location?.state?.fromProjectsTab ?? '').trim().toLowerCase();
    const t =
      ['all', 'active', 'completed', 'pending', 'rejected', 'overridden'].includes(stateTab)
        ? stateTab
        : (() => {
            try {
              const stored = String(sessionStorage.getItem(VENDOR_PROJECTS_TAB_KEY) || '').trim().toLowerCase();
              return ['all', 'active', 'completed', 'pending', 'rejected', 'overridden'].includes(stored) ? stored : null;
            } catch {
              return null;
            }
          })();
    if (t) {
      navigate(`/vendor/projects?tab=${encodeURIComponent(t)}`);
      return;
    }
    navigate(`/vendor/bids?tab=${encodeURIComponent(backTab)}`);
  }, [VENDOR_PROJECTS_TAB_KEY, backTab, location?.state, navigate]);

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
  const [assignmentConfirmOpen, setAssignmentConfirmOpen] = useState(false);
  const [assignmentConfirmType, setAssignmentConfirmType] = useState(null);
  const [assignmentActing, setAssignmentActing] = useState(false);

  const project = details?.project ?? details?.data?.project ?? details ?? null;
  const activeBidWindow = details?.activeBidWindow ?? details?.active_bid_window ?? null;
  const finishingAt =
    activeBidWindow?.finishingTimestamp ??
    activeBidWindow?.finishingAt ??
    activeBidWindow?.finishing_at ??
    null;
  const finishesMs = finishingAt ? new Date(finishingAt).getTime() : null;
  const hasActiveWindow = Boolean(activeBidWindow);
  const timeLeftMs = finishesMs != null ? Math.max(0, finishesMs - nowTs) : null;
  const bidEnded = timeLeftMs != null ? timeLeftMs <= 0 : false;
  const isActive = Boolean(activeBidWindow) && !bidEnded;

  const myVendorId = user?.id ?? user?._id ?? user?.vendorId ?? user?.vendor_id ?? null;
  const winningBid = useMemo(() => pickWinningBid(bids), [bids]);

  const assignments = useMemo(() => {
    const raw =
      project?.assignments ??
      project?.assignmentRequests ??
      project?.projectAssignments ??
      details?.assignments ??
      details?.assignmentRequests ??
      details?.projectAssignments ??
      details?.data?.assignments ??
      details?.data?.assignmentRequests ??
      details?.data?.projectAssignments ??
      details?.project?.assignments ??
      details?.project?.assignmentRequests ??
      details?.project?.projectAssignments ??
      [];
    return coerceAssignments(raw);
  }, [details, project]);

  const myPendingAssignment = useMemo(() => {
    if (!myVendorId) return null;
    return (
      assignments.find(
        (a) =>
          String(assignmentVendorIdFromRecord(a) ?? '') === String(myVendorId) &&
          String(a?.status ?? '').trim().toLowerCase() === 'pending' &&
          isAssignmentRowActive(a),
      ) ?? null
    );
  }, [assignments, myVendorId]);

  /** 'accepted' | 'rejected' | null — for badges on the current vendor's row (same slot as Winning). */
  const myAssignmentOutcomeBadge = useMemo(() => {
    if (!myVendorId) return null;
    const mine = assignments.filter(
      (a) => String(assignmentVendorIdFromRecord(a) ?? '') === String(myVendorId),
    );
    if (
      mine.some(
        (a) =>
          String(a?.status ?? '').trim().toLowerCase() === 'pending' && isAssignmentRowActive(a),
      )
    ) {
      return null;
    }
    if (
      mine.some(
        (a) =>
          String(a?.status ?? '').trim().toLowerCase() === 'accepted' && isAssignmentRowActive(a),
      )
    ) {
      return 'accepted';
    }
    if (mine.some((a) => String(a?.status ?? '').trim().toLowerCase() === 'rejected')) {
      return 'rejected';
    }
    return null;
  }, [assignments, myVendorId]);

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
  const customerId = useMemo(() => customerIdOf(project, details), [details, project]);
  const customerName = useMemo(() => customerNameOf(project, details), [details, project]);
  const winningBidId = useMemo(() => bidStableId(winningBid), [winningBid]);

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

  const openAssignmentConfirm = (type) => {
    if (!myPendingAssignment || assignmentActing) return;
    setAssignmentConfirmType(type);
    setAssignmentConfirmOpen(true);
  };

  const confirmAssignmentDecision = async () => {
    const id = assignmentIdOfRecord(myPendingAssignment);
    if (!id || !assignmentConfirmType || assignmentActing) return;
    setAssignmentActing(true);
    try {
      if (assignmentConfirmType === 'accept') {
        await projectService.acceptAssignment(id);
        addToast('Assignment accepted.', 'success');
      } else {
        await projectService.rejectAssignment(id);
        addToast('Assignment rejected.', 'success');
      }
      setAssignmentConfirmOpen(false);
      setAssignmentConfirmType(null);
      await load();
    } catch (e) {
      addToast(e?.message || 'Action failed', 'error');
    } finally {
      setAssignmentActing(false);
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

  const DetailsCard = ({ className = '' }) => (
    <div className={`rounded-2xl border border-pale bg-white p-5 shadow-sm ${className}`}>
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
          {loading && !project
            ? '—'
            : hasActiveWindow && finishesMs != null
              ? formatCountdown(timeLeftMs ?? 0)
              : 'Bid Ended'}
        </span>
      </div>
    </div>
  );

  const MetaCard = ({ className = '' }) =>
    remainingMetaRows.length > 0 ? (
      <div className={`rounded-2xl border border-pale bg-white overflow-hidden shadow-sm ${className}`}>
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
      <div className={`rounded-2xl border border-pale bg-white p-5 shadow-sm ${className}`}>
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
      <div className="mb-4">
        <button
          type="button"
          onClick={goBack}
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
          <div className="w-full lg:w-[400px] shrink-0 lg:self-start">
            <div className="rounded-2xl border border-pale bg-white overflow-hidden shadow-sm">
              <div className="relative h-[280px] sm:h-[340px] bg-gradient-to-br from-cream via-blush to-pale overflow-hidden">
                {thumbnailUrl ? (
                  <ImageWithFullscreenZoom
                    src={thumbnailUrl}
                    alt={project?.title ?? 'Project'}
                    imageClassName="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted bg-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-pale">
                <div className="flex flex-col gap-2">
                  {customerId ? (
                    <button
                      type="button"
                      onClick={chatWithCustomer}
                      className="w-full px-5 py-3 rounded-2xl bg-white border border-pale text-[13px] font-extrabold text-mid hover:bg-cream inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Send message
                    </button>
                  ) : null}
                  {isActive ? (
                    <>
                      <button
                        type="button"
                        onClick={handleWithdrawAll}
                        disabled={withdrawingAll}
                        className="w-full px-5 py-3 rounded-2xl border border-red-200 text-[13px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {withdrawingAll ? 'Withdrawing…' : 'Withdraw All Bids'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBidModalOpen(true)}
                        disabled={bidEnded}
                        className="w-full px-5 py-3 rounded-2xl bg-walnut text-blush text-[13px] font-extrabold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Update Bid
                      </button>
                    </>
                  ) : null}
                </div>
                {bidEnded ? <p className="mt-2 text-[11px] text-muted text-center">Bidding window has ended.</p> : null}
              </div>
            </div>

            <div className="hidden lg:block mt-4 space-y-4">
              <MetaCard />
              <AttachmentsCard />
            </div>
          </div>

          <div className="w-full lg:flex-1 min-w-0 space-y-4">
            <div className="lg:hidden">
              <DetailsCard />
              <div className="mt-4">
                <MetaCard />
              </div>
              <div className="mt-4">
                <AttachmentsCard />
              </div>
            </div>

            <div className="hidden lg:block">
              <DetailsCard />
            </div>

            <div className="space-y-4">
              <div className="flex flex-row items-center gap-2 sm:gap-3 w-full min-w-0 sm:justify-between">
                <div className="flex-1 min-w-0 sm:max-w-md">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Search "Jewellers"'
                    className="input-search-quiet-focus w-full px-4 py-2.5 rounded-xl border border-pale text-[13px] font-semibold text-mid bg-white"
                  />
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setSortOpen((v) => !v)}
                    className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-extrabold text-mid hover:bg-cream"
                  >
                    Sort
                  </button>
                  {sortOpen ? (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-2xl border border-pale bg-white shadow-sm overflow-hidden z-20"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button type="button" onClick={() => { setSortBy('amount_asc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-cream">Low amount</button>
                      <button type="button" onClick={() => { setSortBy('amount_desc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-cream">High amount</button>
                      <button type="button" onClick={() => { setSortBy('delivery_asc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-cream">Low delivery duration</button>
                      <button type="button" onClick={() => { setSortBy('delivery_desc'); setSortOpen(false); }} className="w-full text-left px-4 py-3 text-[12px] font-bold hover:bg-cream">High delivery duration</button>
                    </div>
                  ) : null}
                </div>
              </div>

              {bidsLoading ? (
              <>
                <div className="md:hidden rounded-2xl border border-pale bg-white p-10 flex items-center justify-center min-h-[200px]">
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="hidden md:block rounded-xl border border-pale bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-pale bg-walnut/[0.07]">
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Jeweller</th>
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Delivery</th>
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted text-right">Bid amount</th>
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center align-middle bg-cream/20">
                            <svg className="animate-spin text-ink inline-block" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : filteredBids.length === 0 ? (
              <>
                <div className="md:hidden rounded-2xl border border-pale bg-white p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <p className="mt-3 text-[14px] font-bold text-ink">{bids.length === 0 ? 'No bids yet' : 'No bids found'}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {bids.length === 0 ? 'Be the first to place a bid.' : 'Try adjusting search or sorting.'}
                    </p>
                  </div>
                </div>
                <div className="hidden md:block rounded-xl border border-pale bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-pale bg-walnut/[0.07]">
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Jeweller</th>
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Delivery</th>
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted text-right">Bid amount</th>
                          <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center align-middle bg-cream/20">
                            <div className="inline-flex flex-col items-center">
                              <div className="w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 11l3 3L22 4" />
                                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </svg>
                              </div>
                              <p className="mt-3 text-[14px] font-bold text-ink">{bids.length === 0 ? 'No bids yet' : 'No bids found'}</p>
                              <p className="mt-1 text-[12px] text-muted">
                                {bids.length === 0 ? 'Be the first to place a bid.' : 'Try adjusting search or sorting.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {filteredBids.map((b, idx) => {
                    const bidId = bidStableId(b);
                    const vendorId = bidVendorIdOf(b);
                    const vendorName = bidVendorNameOf(b);
                    const price = bidPriceOf(b);
                    const days = bidDaysOf(b);
                    const isMe = myVendorId != null && vendorId != null && String(vendorId) === String(myVendorId);
                    const displayName = isMe ? `${vendorName || 'Me'} (me)` : vendorName || `Jeweller #${vendorId ?? '—'}`;
                    const isWinning =
                      winningBidId != null && bidId != null && String(winningBidId) === String(bidId);
                    const cardHighlight =
                      isMe && myAssignmentOutcomeBadge === 'rejected'
                        ? 'border-red-200 bg-red-50/35'
                        : isMe && myAssignmentOutcomeBadge === 'accepted'
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : isWinning
                            ? 'border-green-300 bg-green-50/40'
                            : isMe
                              ? 'border-walnut/30 bg-walnut/5'
                              : 'border-pale';
                    return (
                      <div
                        key={String(bidId ?? idx)}
                        className={`rounded-2xl border px-5 py-4 bg-white ${cardHighlight}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex flex-1 items-start gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-pale bg-white shrink-0">
                              <img src={avatarUrlFor(displayName)} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-extrabold text-ink truncate">{displayName}</p>
                              <p className="mt-2 text-[11px] text-muted">
                                <span className="inline-flex items-center gap-1.5">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 shrink-0 text-muted"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                  </svg>
                                  Delivery: {daysLabel(days)}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right pl-1">
                            <p className="text-[15px] font-extrabold text-ink tabular-nums leading-tight">
                              {price != null ? `₹${formatMoney(price)}` : '—'}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted font-semibold leading-snug">Bidding Price</p>
                          </div>
                        </div>
                        {isMe && myAssignmentOutcomeBadge === 'rejected' ? (
                          <div className="mt-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold border bg-red-50 border-red-200 text-red-700">
                              Rejected
                            </span>
                          </div>
                        ) : isMe && myAssignmentOutcomeBadge === 'accepted' ? (
                          <div className="mt-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold border bg-emerald-50 border-emerald-200 text-emerald-800">
                              Accepted
                            </span>
                          </div>
                        ) : isWinning ? (
                          <div className="mt-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold border bg-green-50 border-green-200 text-green-700">
                              Winning
                            </span>
                          </div>
                        ) : null}
                        {(isMe && myPendingAssignment) || (isActive && isMe) ? (
                          <div className="mt-3 flex flex-col items-end gap-2">
                            {isMe && myPendingAssignment ? (
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => openAssignmentConfirm('reject')}
                                  disabled={assignmentActing}
                                  className="px-3 py-1.5 rounded-lg border border-pale bg-white text-[11px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAssignmentConfirm('accept')}
                                  disabled={assignmentActing}
                                  className="px-3 py-1.5 rounded-lg bg-walnut text-blush text-[11px] font-bold hover:opacity-90 disabled:opacity-50"
                                >
                                  Accept
                                </button>
                              </div>
                            ) : null}
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
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block">
                  <div className="rounded-xl border border-pale bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-pale bg-walnut/[0.07]">
                            <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Jeweller</th>
                            <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">Delivery</th>
                            <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted text-right">Bid amount</th>
                            <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBids.map((b, idx) => {
                            const bidId = bidStableId(b);
                            const vendorId = bidVendorIdOf(b);
                            const vendorName = bidVendorNameOf(b);
                            const price = bidPriceOf(b);
                            const days = bidDaysOf(b);
                            const isMe = myVendorId != null && vendorId != null && String(vendorId) === String(myVendorId);
                            const displayName = isMe ? `${vendorName || 'Me'} (me)` : vendorName || `Jeweller #${vendorId ?? '—'}`;
                            const isWinning =
                              winningBidId != null && bidId != null && String(winningBidId) === String(bidId);
                            const rowBg =
                              isMe && myAssignmentOutcomeBadge === 'rejected'
                                ? 'bg-red-50/45'
                                : isMe && myAssignmentOutcomeBadge === 'accepted'
                                  ? 'bg-emerald-50/40'
                                  : isWinning
                                    ? 'bg-green-50/50'
                                    : '';
                            return (
                              <tr
                                key={String(bidId ?? idx)}
                                className={`border-b border-pale last:border-b-0 transition-colors ${
                                  rowBg || 'odd:bg-white even:bg-cream/50'
                                }`}
                              >
                                <td className="px-4 py-3 align-top">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-pale bg-white shrink-0">
                                      <img src={avatarUrlFor(displayName)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0 pt-0.5">
                                      <p className="text-[13px] font-extrabold text-ink truncate">{displayName}</p>
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {isMe && myAssignmentOutcomeBadge === 'rejected' ? (
                                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-red-50 border-red-200 text-red-700">
                                            Rejected
                                          </span>
                                        ) : isMe && myAssignmentOutcomeBadge === 'accepted' ? (
                                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-emerald-50 border-emerald-200 text-emerald-800">
                                            Accepted
                                          </span>
                                        ) : isWinning ? (
                                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-green-50 border-green-200 text-green-700">
                                            Winning
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-middle">
                                  <span className="inline-flex items-center gap-2 text-[13px] text-mid">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-6 w-6 shrink-0 text-muted"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      aria-hidden
                                    >
                                      <circle cx="12" cy="12" r="10" />
                                      <path d="M12 6v6l4 2" />
                                    </svg>
                                    <span className="font-semibold text-ink">{daysLabel(days)}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-3 align-middle text-right">
                                  <p className="text-[14px] font-extrabold text-ink tabular-nums">
                                    {price != null ? `₹${formatMoney(price)}` : '—'}
                                  </p>
                                  <p className="text-[10px] text-muted font-semibold mt-0.5">Bidding Price</p>
                                </td>
                                <td className="px-4 py-3 align-middle text-right">
                                  <div className="inline-flex flex-col items-end gap-2">
                                    {isMe && myPendingAssignment ? (
                                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => openAssignmentConfirm('reject')}
                                          disabled={assignmentActing}
                                          className="px-3 py-1.5 rounded-lg border border-pale bg-white text-[11px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openAssignmentConfirm('accept')}
                                          disabled={assignmentActing}
                                          className="px-3 py-1.5 rounded-lg bg-walnut text-blush text-[11px] font-bold hover:opacity-90 disabled:opacity-50"
                                        >
                                          Accept
                                        </button>
                                      </div>
                                    ) : null}
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
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Update bid modal */}
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
              <p className="text-[14px] font-extrabold text-ink">Update Bid</p>
              <button
                type="button"
                onClick={() => setBidModalOpen(false)}
                disabled={bidSubmitting}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60"
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
                <button type="button" onClick={() => setBidModalOpen(false)} disabled={bidSubmitting} className="px-4 py-2.5 rounded-xl border border-pale text-[12px] font-extrabold text-mid hover:bg-cream disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={submitBid} disabled={bidSubmitting || bidEnded} className="px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {bidSubmitting ? 'Submitting…' : 'Update Bid'}
                </button>
              </div>
              {bidEnded ? <p className="mt-3 text-[11px] text-muted">Bidding window has ended.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Withdraw all bids confirm modal */}
      {withdrawAllModalOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !withdrawingAll && setWithdrawAllModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-ink">Withdraw All Bids</p>
                <p className="mt-1 text-[12px] text-muted">
                  This will withdraw all your bids for this project. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawAllModalOpen(false)}
                disabled={withdrawingAll}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60"
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
                  className="px-4 py-2.5 rounded-xl border border-pale text-[12px] font-extrabold text-mid hover:bg-cream disabled:opacity-50"
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
          className="fixed inset-0 z-[90] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !cancelSubmitting && setCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-ink">Cancel Bid</p>
                <p className="mt-1 text-[12px] text-muted">
                  This will withdraw your latest bid for this project.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelSubmitting}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60"
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
                  className="px-4 py-2.5 rounded-xl border border-pale text-[12px] font-extrabold text-mid hover:bg-cream disabled:opacity-50"
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

      {assignmentConfirmOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            if (!assignmentActing) {
              setAssignmentConfirmOpen(false);
              setAssignmentConfirmType(null);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">
                {assignmentConfirmType === 'accept' ? 'Accept assignment?' : 'Reject assignment?'}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {assignmentConfirmType === 'accept'
                  ? 'You will accept this assignment request.'
                  : 'You will decline this assignment request.'}
              </p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (assignmentActing) return;
                  setAssignmentConfirmOpen(false);
                  setAssignmentConfirmType(null);
                }}
                disabled={assignmentActing}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAssignmentDecision}
                disabled={assignmentActing}
                className={`px-4 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50 ${
                  assignmentConfirmType === 'accept'
                    ? 'bg-walnut text-blush hover:opacity-90'
                    : 'border border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {assignmentActing ? 'Working…' : assignmentConfirmType === 'accept' ? 'Accept' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
