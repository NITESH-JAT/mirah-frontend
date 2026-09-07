import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRegion } from '../../context/RegionProvider';
import { projectService } from '../../services/projectService';
import ImageWithFullscreenZoom from '../../components/ImageWithFullscreenZoom';
import VendorProjectMetaCard from '../../components/vendor/VendorProjectMetaRows';
import VendorKycRequiredCard from '../../components/vendor/VendorKycRequiredCard';
import { BidsTableSkeleton, VendorExploreProjectSkeleton } from '../../components/project/VendorProjectPageSkeleton';
import { formatCurrency } from '../../utils/formatMoney';
import { projectPresentmentCurrency } from '../../utils/projectMoney';
import { buildVendorDeliveryDetailRows } from '../../utils/customerProjectDetailRows';

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
  const { currency: regionCurrency = 'INR' } = useRegion();
  const abortRef = useRef(null);

  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

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

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [details, setDetails] = useState(null);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [bids, setBids] = useState([]);
  const [hasOtherSealedBids, setHasOtherSealedBids] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [withdrawingAll, setWithdrawingAll] = useState(false);
  const [withdrawAllModalOpen, setWithdrawAllModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [assignmentConfirmOpen, setAssignmentConfirmOpen] = useState(false);
  const [assignmentConfirmType, setAssignmentConfirmType] = useState(null);
  const [assignmentActing, setAssignmentActing] = useState(false);

  const project = details?.project ?? details?.data?.project ?? details ?? null;
  const moneyCurrency = projectPresentmentCurrency(project, regionCurrency);
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
  // Sealed bidding: jewellers only see their own bid, so do not show a "winning" badge.
  const winningBidId = null;

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
      'confirmSpecs',
      'confirm_specs',
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
  const deliveryDetailRows = useMemo(() => buildVendorDeliveryDetailRows(project), [project]);
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
      if (abortRef.current !== ctrl) return;
      setDetails(res || null);
      setHasLoaded(true);
    } catch (e) {
      if (isCanceledRequest(e) || abortRef.current !== ctrl) return;
      addToast(e?.message || 'Failed to load project', 'error');
      setDetails(null);
      setHasLoaded(true);
    } finally {
      if (abortRef.current === ctrl) {
        setLoading(false);
      }
    }
  }, [addToast, projectId]);

  const loadBids = useCallback(async () => {
    if (!projectId) return;
    setBidsLoading(true);
    try {
      const result = await projectService.listBids(projectId);
      const list = Array.isArray(result?.bids) ? result.bids : Array.isArray(result) ? result : [];
      setBids(list);
      setHasOtherSealedBids(Boolean(result?.hasOtherSealedBids));
    } catch (e) {
      if (isCanceledRequest(e)) return;
      addToast(e?.message || 'Failed to load bids', 'error');
      setBids([]);
      setHasOtherSealedBids(false);
    } finally {
      setBidsLoading(false);
    }
  }, [addToast, projectId]);

  useEffect(() => {
    if (!kycAccepted) return;
    load();
    loadBids();
    return () => abortRef.current?.abort();
  }, [load, loadBids, kycAccepted]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredBids = bids;

  const handleWithdrawAll = async () => {
    if (!projectId || !isActive) return;
    setWithdrawAllModalOpen(true);
  };

  const confirmWithdrawAll = async () => {
    if (withdrawingAll || !projectId || !isActive) return;
    setWithdrawingAll(true);
    try {
      await projectService.withdrawAllBids(projectId);
      addToast('Bid withdrawn.', 'success');
      // If vendor withdrew, this project should disappear from vendor participation list (per PRD).
      // Take them back to the vendor bids list (Active tab).
      navigate('/vendor/bids?tab=active', { replace: true });
    } catch (e) {
      addToast(e?.message || 'Failed to withdraw bid', 'error');
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
                {budgetPerPieceRaw ? formatCurrency(Number(budgetPerPieceRaw) || 0, moneyCurrency) : '—'}
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

        <span className="shrink-0 px-3 py-1.5 rounded-full bg-walnut text-blush text-[11px] font-extrabold inline-flex items-center gap-1.5 tabular-nums">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2" />
            <path d="M5 3 2 6" />
            <path d="m22 6-3-3" />
            <path d="M6.38 18.7 4 21" />
            <path d="M17.64 18.67 20 21" />
          </svg>
          {loading && !project
            ? '—'
            : hasActiveWindow && finishesMs != null
              ? formatCountdown(timeLeftMs ?? 0)
              : 'Bid Ended'}
        </span>
      </div>
    </div>
  );

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

  if (!kycAccepted) {
    return <VendorKycRequiredCard message="Please complete your KYC to view bid details." />;
  }

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

      {!hasLoaded ? (
        <VendorExploreProjectSkeleton withSearch bidColumns={4} />
      ) : !project ? (
        <div className="min-h-[calc(100vh-260px)] flex flex-col items-center justify-center text-center">
          <p className="font-serif text-5xl font-extrabold text-ink">404</p>
          <p className="mt-2 text-[13px] text-muted">Project not found.</p>
        </div>
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
                  <div className="flex flex-row items-stretch gap-2">
                    {customerId ? (
                      <button
                        type="button"
                        onClick={chatWithCustomer}
                        className="flex-1 min-w-0 px-3 py-3 rounded-2xl bg-white border border-pale text-[13px] font-extrabold text-mid hover:bg-cream inline-flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Send Message
                      </button>
                    ) : null}
                    {isActive ? (
                      <button
                        type="button"
                        onClick={handleWithdrawAll}
                        disabled={withdrawingAll}
                        className="flex-1 min-w-0 px-3 py-3 rounded-2xl border border-red-200 text-[13px] font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {withdrawingAll ? 'Withdrawing…' : 'Withdraw Bid'}
                      </button>
                    ) : null}
                  </div>
                  {isActive ? (
                    <p className="text-[11px] text-muted text-center">
                      Your bid is sealed. It cannot be changed or replaced.
                    </p>
                  ) : null}
                </div>
                {bidEnded ? <p className="mt-2 text-[11px] text-muted text-center">Bidding window has ended.</p> : null}
              </div>
            </div>

            <div className="hidden lg:block mt-4 space-y-4">
              <VendorProjectMetaCard rows={remainingMetaRows} />
              <VendorProjectMetaCard rows={deliveryDetailRows} title="Delivery Details" />
              <AttachmentsCard />
            </div>
          </div>

          <div className="w-full lg:flex-1 min-w-0 space-y-4">
            <div className="lg:hidden">
              <DetailsCard />
              <div className="mt-4">
                <VendorProjectMetaCard rows={remainingMetaRows} />
              </div>
              <div className="mt-4">
                <VendorProjectMetaCard rows={deliveryDetailRows} title="Delivery Details" />
              </div>
              <div className="mt-4">
                <AttachmentsCard />
              </div>
            </div>

            <div className="hidden lg:block">
              <DetailsCard />
            </div>

            <div className="space-y-4">
              {bidsLoading ? (
              <BidsTableSkeleton columns={4} />
            ) : filteredBids.length === 0 && !(bids.length === 0 && hasOtherSealedBids) ? (
              <>
                <div className="md:hidden rounded-2xl border border-pale bg-white p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <p className="mt-3 text-[14px] font-bold text-ink">{bids.length === 0 ? 'No bid placed yet' : 'No bids found'}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {bids.length === 0 ? 'Only you can see your own sealed bid.' : 'Try adjusting search or sorting.'}
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
                              <p className="mt-3 text-[14px] font-bold text-ink">{bids.length === 0 ? 'No bid placed yet' : 'No bids found'}</p>
                              <p className="mt-1 text-[12px] text-muted">
                                {bids.length === 0 ? 'Only you can see your own sealed bid.' : 'Try adjusting search or sorting.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : filteredBids.length === 0 && hasOtherSealedBids ? (
              <>
                <div className="md:hidden space-y-3">
                  <div className="rounded-2xl border border-pale bg-cream/40 px-5 py-5 flex items-center justify-center">
                    <div className="inline-flex items-center justify-center gap-2.5 text-muted">
                      <span className="w-8 h-8 rounded-full border border-pale bg-white/80 flex items-center justify-center shrink-0 text-mid">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="16" height="16" aria-hidden>
                          <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
                          <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
                          <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
                          <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
                          <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
                          <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
                          <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
                        </svg>
                      </span>
                      <span className="text-[13px] font-semibold text-mid">Other jeweller bids exist for this project.</span>
                    </div>
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
                        <tr className="bg-cream/40">
                          <td colSpan={4} className="px-4 py-5 text-center align-middle">
                            <div className="inline-flex items-center justify-center gap-2.5 text-muted">
                              <span className="w-8 h-8 rounded-full border border-pale bg-white/80 flex items-center justify-center shrink-0 text-mid">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="16" height="16" aria-hidden>
                                  <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
                                  <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
                                  <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
                                  <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
                                  <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
                                  <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
                                  <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
                                </svg>
                              </span>
                              <span className="text-[13px] font-semibold text-mid">Other jeweller bids exist for this project.</span>
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
                  {hasOtherSealedBids ? (
                    <div className="rounded-2xl border border-pale bg-cream/40 px-5 py-5 flex items-center justify-center">
                      <div className="inline-flex items-center justify-center gap-2.5 text-muted">
                        <span className="w-8 h-8 rounded-full border border-pale bg-white/80 flex items-center justify-center shrink-0 text-mid">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="16" height="16" aria-hidden>
                            <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
                            <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
                            <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
                            <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
                            <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
                            <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
                            <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
                          </svg>
                        </span>
                        <span className="text-[13px] font-semibold text-mid">Other jeweller bids exist for this project.</span>
                      </div>
                    </div>
                  ) : null}
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
                              {price != null ? formatCurrency(price, moneyCurrency) : '—'}
                            </p>
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
                              <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-200 text-amber-800">
                                Assigned — awaiting customer payment
                              </span>
                            ) : null}
                            {isActive && isMe ? (
                              <button
                                type="button"
                                onClick={() => handleCancelBid(b)}
                                disabled={cancellingId != null}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {cancellingId != null ? '…' : 'Withdraw Bid'}
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
                          {hasOtherSealedBids ? (
                            <tr className="border-b border-pale last:border-b-0 bg-cream/40">
                              <td colSpan={4} className="px-4 py-5 text-center align-middle">
                                <div className="inline-flex items-center justify-center gap-2.5 text-muted">
                                  <span className="w-8 h-8 rounded-full border border-pale bg-white/80 flex items-center justify-center shrink-0 text-mid">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="16" height="16" aria-hidden>
                                      <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
                                      <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
                                      <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
                                      <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
                                      <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
                                      <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
                                      <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
                                    </svg>
                                  </span>
                                  <span className="text-[13px] font-semibold text-mid">Other jeweller bids exist for this project.</span>
                                </div>
                              </td>
                            </tr>
                          ) : null}
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
                                    {price != null ? formatCurrency(price, moneyCurrency) : '—'}
                                  </p>
                                </td>
                                <td className="px-4 py-3 align-middle text-right">
                                  <div className="inline-flex flex-col items-end gap-2">
                                    {isMe && myPendingAssignment ? (
                                      <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-200 text-amber-800">
                                        Awaiting customer payment
                                      </span>
                                    ) : null}
                                    {isActive && isMe ? (
                                      <button
                                        type="button"
                                        onClick={() => handleCancelBid(b)}
                                        disabled={cancellingId != null}
                                        className="px-3 py-1.5 rounded-lg border border-red-200 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                      >
                                        {cancellingId != null ? '…' : 'Withdraw Bid'}
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

      {/* Withdraw Bid confirm modal */}
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
                <p className="text-[14px] font-extrabold text-ink">Withdraw Bid</p>
                <p className="mt-1 text-[12px] text-muted">
                  This will withdraw your bid for this project. You can place a new bid from Explore while the auction is open.
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
                  {withdrawingAll ? 'Withdrawing…' : 'Withdraw Bid'}
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
                <p className="text-[14px] font-extrabold text-ink">Withdraw Bid</p>
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
                  {cancelSubmitting ? 'Withdrawing…' : 'Withdraw Bid'}
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
