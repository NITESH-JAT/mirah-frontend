import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRegion } from '../../context/RegionProvider';
import { projectService } from '../../services/projectService';
import ImageWithFullscreenZoom from '../../components/ImageWithFullscreenZoom';
import VendorProjectMetaCard from '../../components/vendor/VendorProjectMetaRows';
import VendorKycRequiredCard from '../../components/vendor/VendorKycRequiredCard';
import { SkeletonBar, VendorManageProjectSkeleton } from '../../components/project/VendorProjectPageSkeleton';
import { formatCurrency } from '../../utils/formatMoney';
import { projectPresentmentCurrency } from '../../utils/projectMoney';
import { invoiceProjectStatusLabel } from '../../utils/invoiceProjectStatusLabel';
import { pickProjectThumbnailUrl } from '../../utils/projectThumbnail';
import { buildVendorDeliveryDetailRows } from '../../utils/customerProjectDetailRows';

function pickBreakdownNum(breakdown, ...keys) {
  if (!breakdown || typeof breakdown !== 'object') return null;
  for (const k of keys) {
    const n = Number(breakdown[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function MoneyRow({ label, value, currency = 'INR', tone = 'neutral', hint = null }) {
  const showSign = tone === 'plus' || tone === 'minus';
  const prefix = tone === 'plus' ? '+ ' : tone === 'minus' ? '− ' : '';
  const valueClass =
    tone === 'plus'
      ? 'text-emerald-700'
      : tone === 'minus'
        ? 'text-red-700'
        : tone === 'total'
          ? 'text-walnut'
          : 'text-ink';
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-[12px] font-semibold ${tone === 'total' ? 'text-ink font-extrabold' : 'text-mid'}`}>{label}</p>
        {hint ? <p className="mt-0.5 text-[10px] text-muted leading-snug">{hint}</p> : null}
      </div>
      <p className={`shrink-0 text-[12px] font-extrabold tabular-nums ${valueClass}`}>
        {value == null ? '—' : `${showSign ? prefix : ''}${formatCurrency(value, currency)}`}
      </p>
    </div>
  );
}


function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${datePart}, ${timePart}`;
}

function formatDateOnly(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
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

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeStatusKey(s) {
  const v = String(s ?? '')
    .trim()
    .toLowerCase();
  // Some backends/older payloads use a typo `in_transist`.
  if (v === 'in_transist') return 'in_transit';
  return v;
}

function statusKeyFromTimelineItem(item) {
  return normalizeStatusKey(
    item?.to ??
      item?.toStatus ??
      item?.to_status ??
      item?.status ??
      item?.projectStatus ??
      item?.project_status ??
      item?.operationalStatus ??
      item?.operational_status ??
      '',
  );
}

function timestampFromTimelineItem(item) {
  return (
    item?.changedAt ??
    item?.changed_at ??
    item?.createdAt ??
    item?.created_at ??
    item?.updatedAt ??
    item?.updated_at ??
    item?.timestamp ??
    item?.ts ??
    item?.at ??
    null
  );
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
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

function attachmentIcon(name) {
  const n = String(name || '');
  const base = n.split('?')[0] || n;
  const ext = (base.split('.').pop() || '').toLowerCase();
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

function isFinishedLike(project) {
  const status = String(project?.status ?? '').trim().toLowerCase();
  const projectStatus = String(project?.projectStatus ?? project?.project_status ?? '').trim().toLowerCase();
  return Boolean(project?.isFinished) || status === 'finished' || projectStatus === 'completed';
}

function normalizePaymentStatus(status, { finishedLike } = {}) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'not_applicble') return 'not_applicable';
  if (finishedLike && (!s || s === 'not_applicable')) return 'paid';
  return s || '—';
}

function statusStepsFromStatusModel(statusModel) {
  const m = statusModel ?? {};
  const raw =
    m?.steps ??
    m?.statuses ??
    m?.allStatuses ??
    m?.all_statuses ??
    m?.statusOrder ??
    m?.status_order ??
    m?.sequence ??
    m?.flow ??
    null;

  if (Array.isArray(raw) && raw.length > 0) {
    const items = raw
      .map((x) => {
        if (typeof x === 'string') {
          const key = normalizeStatusKey(x);
          return key ? { key, label: toTitleCase(x) } : null;
        }
        const key = normalizeStatusKey(x?.key ?? x?.status ?? x?.code ?? x?.name ?? x?.value ?? '');
        if (!key) return null;
        const label = x?.label ?? x?.title ?? x?.name ?? toTitleCase(key);
        return { key, label: String(label) };
      })
      .filter(Boolean);

    const seen = new Set();
    return items.filter((it) => {
      if (!it?.key || seen.has(it.key)) return false;
      seen.add(it.key);
      return true;
    });
  }

  // Fallback to PRD operational status dictionary order (plus cancelled at end if needed)
  return [
    { key: 'started', label: 'Started' },
    { key: 'invoice', label: 'Invoice' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'qc', label: 'QC' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'paid', label: 'Paid' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];
}

function paymentTypeOfLedgerEntry(entry) {
  return normalizeStatusKey(
    entry?.paymentType ??
      entry?.payment_type ??
      entry?.type ??
      entry?.meta?.paymentType ??
      entry?.meta?.payment_type ??
      entry?.notes?.paymentType ??
      entry?.notes?.payment_type ??
      '',
  );
}

function paymentStatusOfLedgerEntry(entry) {
  return normalizeStatusKey(entry?.status ?? entry?.paymentStatus ?? entry?.payment_status ?? entry?.state ?? '');
}

function paidAtFromPaymentBlock(block) {
  return (
    block?.paidAt ??
    block?.paid_at ??
    block?.paidOn ??
    block?.paid_on ??
    block?.successAt ??
    block?.success_at ??
    block?.updatedAt ??
    block?.updated_at ??
    null
  );
}

function timestampOfLedgerEntry(entry) {
  return (
    entry?.paidAt ??
    entry?.paid_at ??
    entry?.updatedAt ??
    entry?.updated_at ??
    entry?.createdAt ??
    entry?.created_at ??
    entry?.timestamp ??
    entry?.ts ??
    null
  );
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

function customerNameOf(project, root) {
  const p = project ?? {};
  const r = root ?? {};
  const c = p?.customerSummary ?? p?.customer ?? r?.customerSummary ?? r?.customer ?? r?.data?.customerSummary ?? null;
  const joined = `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
  const name = c?.fullName ?? c?.name ?? joined ?? null;
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed || null;
}

function customerIdOf(project, root) {
  const p = project ?? {};
  const r = root ?? {};
  const c = p?.customerSummary ?? p?.customer ?? r?.customerSummary ?? r?.customer ?? r?.data?.customerSummary ?? null;
  return c?.id ?? c?._id ?? null;
}

export default function VendorManageProject() {
  const { addToast } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { currency: regionCurrency = 'INR' } = useRegion();
  const VENDOR_PROJECTS_TAB_KEY = 'mirah_vendor_projects_last_tab';

  const vendorKycStatus = String(user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? '').toLowerCase();
  const kycAccepted = vendorKycStatus === 'accepted';

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [details, setDetails] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [statusConfirmType, setStatusConfirmType] = useState(null); // 'in_progress' | 'qc' | null
  const [statusConfirmSubmitting, setStatusConfirmSubmitting] = useState(false);
  const [shipmentWorking, setShipmentWorking] = useState(false);
  const [shipmentPackageModalOpen, setShipmentPackageModalOpen] = useState(false);
  const [shipmentDiscardModalOpen, setShipmentDiscardModalOpen] = useState(false);
  const [shipmentPackageForm, setShipmentPackageForm] = useState({
    weightGrams: '',
    lengthCm: '',
    breadthCm: '',
    heightCm: '',
    declaredValueInr: '',
  });
  const [shipmentPackageError, setShipmentPackageError] = useState('');
  const abortRef = useRef(null);
  const paymentAbortRef = useRef(null);

  const project = details?.project ?? details?.data?.project ?? details?.projectDetails ?? details?.item ?? details?.data ?? details ?? null;
  const moneyCurrency =
    paymentDetails?.presentmentCurrency ||
    paymentDetails?.presentment_currency ||
    projectPresentmentCurrency(project, regionCurrency);
  const ProjectMoneyRow = (props) => <MoneyRow {...props} currency={moneyCurrency} />;
  const advancePayment = details?.advancePayment ?? details?.advance_payment ?? null;
  const finalPayment = details?.finalPayment ?? details?.final_payment ?? null;
  const fullUpfront = Boolean(
    details?.fullUpfront ?? details?.full_upfront ?? Number(advancePayment?.percent) === 100,
  );
  const deferredProductionStarted = Boolean(
    details?.deferredProductionStarted ?? details?.deferred_production_started,
  );
  const deferredProductionStartedAt =
    details?.deferredProductionStartedAt ?? details?.deferred_production_started_at ?? null;
  const statusModel =
    details?.statusModel ?? details?.status_model ?? details?.data?.statusModel ?? details?.data?.status_model ?? null;
  const qcModel = details?.qcModel ?? details?.qc_model ?? details?.data?.qcModel ?? details?.data?.qc_model ?? null;
  const shipmentModel = details?.shipmentModel ?? details?.shipment_model ?? details?.data?.shipmentModel ?? null;
  const ledgerRaw = details?.ledger ?? details?.data?.ledger ?? null;
  const ledger = useMemo(() => coerceArray(ledgerRaw).filter(Boolean), [ledgerRaw]);

  const projectId = project?.id ?? project?._id ?? id ?? null;
  const customerName = customerNameOf(project, details);
  const customerId = customerIdOf(project, details);

  const attachments = useMemo(() => coerceUrlArray(project?.attachments), [project]);
  const thumbnailUrl = useMemo(() => pickProjectThumbnailUrl(project), [project]);
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
  const vendorContext = details?.vendorContext ?? details?.vendor_context ?? null;
  const agreedPriceRaw = useMemo(() => {
    const root = details ?? {};
    const p = project ?? {};
    const vc = vendorContext ?? root?.vendorContext ?? root?.vendor_context ?? null;
    const assignmentsRaw =
      p?.assignments ??
      vc?.assignmentRequests ??
      root?.data?.project?.assignments ??
      root?.project?.assignments ??
      null;
    const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw.filter(Boolean) : assignmentsRaw ? [assignmentsRaw] : [];
    const activeAssignment =
      vc?.activeAssignment ??
      assignments.find((x) => x?.isActive && String(x?.status || '').toLowerCase() === 'accepted') ??
      assignments.find((x) => x?.isActive) ??
      assignments.find((x) => String(x?.status || '').toLowerCase() === 'accepted') ??
      assignments[0] ??
      null;
    const a =
      activeAssignment ??
      root?.assignment ??
      root?.assignedProject ??
      root?.assigned_project ??
      root?.projectAssignment ??
      root?.project_assignment ??
      p?.assignment ??
      p?.assignedProject ??
      p?.assigned_project ??
      null;
    const latestBid = vc?.latestBidEntry ?? vc?.latest_bid_entry ?? null;
    const v =
      a?.agreedPrice ??
      a?.agreed_price ??
      a?.agreedAmount ??
      a?.agreed_amount ??
      latestBid?.bidPresentmentAmount ??
      latestBid?.bid_presentment_amount ??
      latestBid?.amount ??
      latestBid?.price ??
      p?.agreedPrice ??
      p?.agreed_price ??
      p?.agreedAmount ??
      p?.agreed_amount ??
      root?.agreedPrice ??
      root?.agreed_price ??
      root?.agreedAmount ??
      root?.agreed_amount ??
      null;
    return v == null ? '' : String(v).trim();
  }, [details, project, vendorContext]);
  const agreedDaysToCompleteRaw = useMemo(() => {
    const root = details ?? {};
    const p = project ?? {};
    const vc = vendorContext ?? root?.vendorContext ?? root?.vendor_context ?? null;
    const assignmentsRaw =
      p?.assignments ??
      vc?.assignmentRequests ??
      root?.data?.project?.assignments ??
      root?.project?.assignments ??
      null;
    const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw.filter(Boolean) : assignmentsRaw ? [assignmentsRaw] : [];
    const activeAssignment =
      vc?.activeAssignment ??
      assignments.find((x) => x?.isActive && String(x?.status || '').toLowerCase() === 'accepted') ??
      assignments.find((x) => x?.isActive) ??
      assignments.find((x) => String(x?.status || '').toLowerCase() === 'accepted') ??
      assignments[0] ??
      null;
    const a =
      activeAssignment ??
      root?.assignment ??
      root?.assignedProject ??
      root?.assigned_project ??
      root?.projectAssignment ??
      root?.project_assignment ??
      p?.assignment ??
      p?.assignedProject ??
      p?.assigned_project ??
      null;
    const latestBid = vc?.latestBidEntry ?? vc?.latest_bid_entry ?? null;
    const v =
      a?.agreedDaysToComplete ??
      a?.agreed_days_to_complete ??
      latestBid?.noOfDays ??
      latestBid?.no_of_days ??
      latestBid?.daysToComplete ??
      latestBid?.days_to_complete ??
      p?.agreedDaysToComplete ??
      p?.agreed_days_to_complete ??
      root?.agreedDaysToComplete ??
      root?.agreed_days_to_complete ??
      null;
    return v == null ? '' : String(v).trim();
  }, [details, project, vendorContext]);
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

  const finishedLike = useMemo(() => isFinishedLike(project), [project]);
  const advanceStatus = useMemo(
    () => normalizePaymentStatus(advancePayment?.status, { finishedLike }),
    [advancePayment?.status, finishedLike],
  );
  const finalStatus = useMemo(
    () => normalizePaymentStatus(finalPayment?.status, { finishedLike }),
    [finalPayment?.status, finishedLike],
  );

  const projectStatusKey = useMemo(
    () => String(project?.projectStatus ?? project?.project_status ?? '').trim().toLowerCase(),
    [project],
  );

  const vendorSettlementDone = useMemo(
    () =>
      Boolean(
        paymentDetails?.vendorSettlementDone ??
          paymentDetails?.vendor_settlement_done ??
          project?.vendorSettlementDone ??
          project?.vendor_settlement_done,
      ),
    [paymentDetails, project],
  );

  const projectStatusLabel = useMemo(() => {
    if (projectStatusKey === 'invoice') {
      return invoiceProjectStatusLabel(advanceStatus, finalStatus, { fullUpfront });
    }
    if (projectStatusKey === 'qc') {
      return 'QC';
    }
    if (
      vendorSettlementDone &&
      (finishedLike || projectStatusKey === 'completed' || projectStatusKey === 'finished')
    ) {
      return 'Payment Settled';
    }
    return toTitleCase(project?.projectStatus ?? project?.project_status ?? '—');
  }, [advanceStatus, finalStatus, finishedLike, fullUpfront, project, projectStatusKey, vendorSettlementDone]);

  const statusSteps = useMemo(() => {
    const steps = statusStepsFromStatusModel(statusModel);
    const currentKey = normalizeStatusKey(
      statusModel?.projectStatus ?? statusModel?.project_status ?? project?.projectStatus ?? project?.project_status ?? '',
    );
    const ensured = Array.isArray(steps) ? steps.slice() : [];
    if (currentKey && !ensured.some((s) => normalizeStatusKey(s?.key) === currentKey)) {
      ensured.push({ key: currentKey, label: toTitleCase(currentKey) });
    }
    const seen = new Set();
    const deduped = ensured.filter((s) => {
      const k = normalizeStatusKey(s?.key);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // If cancelled isn't current, hide cancelled to avoid confusing the normal flow.
    const baseRaw =
      currentKey !== 'cancelled' ? deduped.filter((s) => normalizeStatusKey(s?.key) !== 'cancelled') : deduped;

    // Always inject payment milestones (some backends don't include `invoice` in steps)
    // Keep `in_transit` as a real step (should appear before delivered).
    const base = baseRaw.filter((s) => !['invoice', 'paid'].includes(normalizeStatusKey(s?.key)));
    const out = base.slice();

    const insertAfter = (afterKey, items) => {
      const idx = out.findIndex((s) => normalizeStatusKey(s?.key) === normalizeStatusKey(afterKey));
      if (idx < 0) {
        out.push(...items);
        return;
      }
      out.splice(idx + 1, 0, ...items);
    };

    const advanceMilestones = fullUpfront
      ? [{ key: 'invoice_advance', label: 'Invoice' }, { key: 'paid_advance', label: 'Payment Received' }]
      : [
          { key: 'invoice_advance', label: 'Invoice (Advance)' },
          { key: 'paid_advance', label: 'Advance Paid' },
        ];
    const finalMilestones = fullUpfront
      ? []
      : [
          { key: 'invoice_final', label: 'Invoice (Final)' },
          { key: 'paid_final', label: 'Final Paid' },
        ];
    const settlementMilestone = { key: 'payment_settlement', label: 'Payment Settlement' };

    // Advance is relevant early; put it after started (or at top if missing).
    insertAfter('started', advanceMilestones);

    insertAfter('in_progress', [{ key: 'in_transit_to_arviah', label: 'In Transit to Arviah' }]);

    // Final is expected after QC; if QC missing, append near end.
    insertAfter('qc', finalMilestones);

    // Payment settlement should appear after Completed.
    insertAfter('completed', [settlementMilestone]);

    // Final dedupe in case steps already included similar keys
    const seen2 = new Set();
    return out.filter((s) => {
      const k = normalizeStatusKey(s?.key);
      if (!k || seen2.has(k)) return false;
      seen2.add(k);
      return true;
    });
  }, [project, statusModel, fullUpfront]);

  const statusTimelineMulti = useMemo(() => {
    const list = Array.isArray(statusModel?.timeline) ? statusModel.timeline : [];
    const map = new Map();
    for (const item of list) {
      const k = statusKeyFromTimelineItem(item);
      if (!k) continue;
      const ts = timestampFromTimelineItem(item);
      if (!ts) continue;
      const arr = map.get(k) ?? [];
      arr.push(ts);
      map.set(k, arr);
    }
    const startedLike = project?.startedAt ?? project?.started_at ?? project?.createdAt ?? project?.created_at ?? null;
    if (startedLike && !map.has('started')) map.set('started', [startedLike]);
    const finishedAt =
      statusModel?.finishedAt ?? statusModel?.finished_at ?? project?.finishedAt ?? project?.finished_at ?? null;
    if (finishedAt && !map.has('completed')) map.set('completed', [finishedAt]);
    // sort each bucket asc
    for (const [k, arr] of map.entries()) {
      const sorted = arr
        .map((x) => ({ raw: x, t: new Date(x).getTime() }))
        .filter((x) => Number.isFinite(x.t))
        .sort((a, b) => a.t - b.t)
        .map((x) => x.raw);
      map.set(k, sorted);
    }
    return map;
  }, [project, statusModel]);

  const currentOperationalStatusKey = useMemo(
    () =>
      normalizeStatusKey(
        statusModel?.projectStatus ??
          statusModel?.project_status ??
          project?.projectStatus ??
          project?.project_status ??
          '',
      ),
    [project, statusModel],
  );

  const advancePaidAt = useMemo(() => {
    const fromBlock = paidAtFromPaymentBlock(advancePayment);
    if (fromBlock) return fromBlock;
    let best = null;
    for (const e of ledger) {
      const type = paymentTypeOfLedgerEntry(e);
      const status = paymentStatusOfLedgerEntry(e);
      if (type !== 'advance') continue;
      if (status && status !== 'paid' && status !== 'success' && status !== 'completed') continue;
      const ts = timestampOfLedgerEntry(e);
      if (!ts) continue;
      if (!best) best = ts;
      else if (new Date(ts).getTime() > new Date(best).getTime()) best = ts;
    }
    if (best) return best;
    // Deferred production: treat admin start as clearing the payment milestone for the timeline.
    return deferredProductionStarted ? deferredProductionStartedAt : null;
  }, [advancePayment, deferredProductionStarted, deferredProductionStartedAt, ledger]);

  const finalPaidAt = useMemo(() => {
    const fromBlock = paidAtFromPaymentBlock(finalPayment);
    if (fromBlock) return fromBlock;
    let best = null;
    for (const e of ledger) {
      const type = paymentTypeOfLedgerEntry(e);
      const status = paymentStatusOfLedgerEntry(e);
      if (type !== 'final') continue;
      if (status && status !== 'paid' && status !== 'success' && status !== 'completed') continue;
      const ts = timestampOfLedgerEntry(e);
      if (!ts) continue;
      if (!best) best = ts;
      else if (new Date(ts).getTime() > new Date(best).getTime()) best = ts;
    }
    return best;
  }, [finalPayment, ledger]);

  const activeInbound = shipmentModel?.inbound ?? null;
  const inboundMode = String(shipmentModel?.inboundMode || shipmentModel?.inbound_mode || 'shiprocket').toLowerCase();
  const isSelfShipMode = inboundMode === 'self_ship';
  const qcHubAddress = shipmentModel?.qcHubAddress ?? shipmentModel?.qc_hub_address ?? null;
  const isSelfShipInbound =
    isSelfShipMode ||
    String(activeInbound?.freightSource || activeInbound?.freight_source || '').toLowerCase() === 'self_ship';
  const inboundReceivedAtArviah = Boolean(
    shipmentModel?.flags?.inboundReceivedAtArviah ||
      activeInbound?.receivedAt ||
      activeInbound?.received_at ||
      String(activeInbound?.status || '').toLowerCase() === 'received_at_arviah',
  );
  const inboundInFlight = Boolean(shipmentModel?.flags?.hasActiveInbound && !inboundReceivedAtArviah);
  const inboundDiscardBlocked = (() => {
    const st = String(activeInbound?.status || '').toLowerCase();
    if (!st || inboundReceivedAtArviah) return false;
    if (isSelfShipInbound && st === 'in_transit') return false;
    return ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'].includes(st);
  })();

  const qcEntries = useMemo(() => {
    const raw = qcModel?.logs ?? qcModel?.log ?? [];
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.filter(Boolean);
  }, [qcModel]);

  const qcFailedPendingRework = useMemo(() => {
    if (currentOperationalStatusKey !== 'in_progress') return false;
    const latest = qcEntries[0];
    if (!latest) return false;
    return String(latest?.status ?? '').toLowerCase() === 'failed';
  }, [currentOperationalStatusKey, qcEntries]);

  // After receive, hide Generate unless QC failed and a reship is needed.
  const canGenerateShipment = Boolean(
    !isSelfShipMode &&
      shipmentModel?.flags?.canGenerateInbound &&
      (!inboundReceivedAtArviah || qcFailedPendingRework),
  );
  const canMarkSelfShipped = Boolean(
    isSelfShipMode &&
      shipmentModel?.flags?.canMarkSelfShipped &&
      (!inboundReceivedAtArviah || qcFailedPendingRework),
  );
  const canDownloadShipment = Boolean(activeInbound?.labelAvailable && inboundInFlight);
  const canDiscardShipment = Boolean(
    inboundInFlight && !inboundDiscardBlocked && shipmentModel?.flags?.canDiscardInbound,
  );
  const showShippingCard =
    currentOperationalStatusKey === 'in_progress' ||
    inboundInFlight ||
    inboundReceivedAtArviah ||
    canGenerateShipment ||
    canMarkSelfShipped ||
    canDownloadShipment;

  const inboundPastTransitPhase = useMemo(() => {
    if (inboundReceivedAtArviah) return true;
    if (!activeInbound) return false;
    if (activeInbound.receivedAt ?? activeInbound.received_at) return true;
    return String(activeInbound.status ?? '').toLowerCase() === 'received_at_arviah';
  }, [activeInbound, inboundReceivedAtArviah]);

  const qcEverReached = useMemo(
    () => (statusTimelineMulti.get('qc') ?? []).length > 0,
    [statusTimelineMulti],
  );

  const inTransitToArviahReached = useMemo(() => {
    if (qcFailedPendingRework) return false;
    if (inboundReceivedAtArviah) return true;
    if (!activeInbound) return false;
    if (inboundPastTransitPhase) return true;
    if (shipmentModel?.flags?.inboundAwaitingReceive) return true;
    if (qcEverReached) return true;
    return false;
  }, [
    activeInbound,
    inboundPastTransitPhase,
    inboundReceivedAtArviah,
    qcEverReached,
    qcFailedPendingRework,
    shipmentModel,
  ]);

  const currentStepKey = useMemo(() => {
    if (currentOperationalStatusKey === 'invoice') {
      if (advanceStatus === 'due') return 'invoice_advance';
      if (!fullUpfront && finalStatus === 'due') return 'invoice_final';
      if (!fullUpfront && finalStatus === 'paid') return 'paid_final';
      if (advanceStatus === 'paid') return 'paid_advance';
      return 'invoice_advance';
    }
    if (currentOperationalStatusKey === 'paid') {
      if (!fullUpfront && finalStatus === 'paid') return 'paid_final';
      if (advanceStatus === 'paid') return 'paid_advance';
      return fullUpfront ? 'paid_advance' : 'paid_final';
    }
    // Admin deferred production: payment milestones are cleared; show In Progress as current.
    if (deferredProductionStarted && currentOperationalStatusKey === 'started') {
      return 'in_progress';
    }
    if (qcFailedPendingRework) return 'in_progress';
    // Past receive → stay on in_progress until QC status log advances the timeline.
    if (inTransitToArviahReached && !qcEverReached && currentOperationalStatusKey === 'in_progress') {
      return 'in_progress';
    }
    if (shipmentModel?.flags?.inboundInTransit) return 'in_transit_to_arviah';
    if (
      activeInbound &&
      currentOperationalStatusKey === 'in_progress' &&
      !inTransitToArviahReached &&
      shipmentModel?.flags?.hasActiveInbound
    ) {
      return 'in_transit_to_arviah';
    }
    return currentOperationalStatusKey;
  }, [
    advanceStatus,
    activeInbound,
    currentOperationalStatusKey,
    deferredProductionStarted,
    finalStatus,
    inTransitToArviahReached,
    qcEverReached,
    qcFailedPendingRework,
    fullUpfront,
    shipmentModel,
  ]);

  const canMarkInProgress = currentOperationalStatusKey === 'started' && !deferredProductionStarted;

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

  const loadPaymentDetails = useCallback(async () => {
    if (!projectId) return;
    if (paymentAbortRef.current) paymentAbortRef.current.abort();
    const ctrl = new AbortController();
    paymentAbortRef.current = ctrl;
    try {
      const res = await projectService.getVendorPaymentDetails(projectId, { signal: ctrl.signal });
      setPaymentDetails(res || null);
    } catch {
      // ignore; card can stay hidden or show missing data
      setPaymentDetails(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (!kycAccepted) return;
    load();
    loadPaymentDetails();
    return () => {
      abortRef.current?.abort();
      paymentAbortRef.current?.abort();
    };
  }, [load, loadPaymentDetails, kycAccepted]);

  const goBack = useCallback(() => {
    const stateTab = String(location?.state?.fromProjectsTab ?? '').trim().toLowerCase();
    const t =
      ['all', 'active', 'completed', 'pending', 'rejected', 'overridden'].includes(stateTab)
        ? stateTab
        : (() => {
            try {
              const stored = String(sessionStorage.getItem(VENDOR_PROJECTS_TAB_KEY) || '').trim().toLowerCase();
              return ['all', 'active', 'completed', 'pending', 'rejected', 'overridden'].includes(stored) ? stored : 'all';
            } catch {
              return 'all';
            }
          })();
    navigate(`/vendor/projects?tab=${encodeURIComponent(t)}`);
  }, [VENDOR_PROJECTS_TAB_KEY, location?.state, navigate]);

  const chatWithCustomer = useCallback(() => {
    if (!customerId) return;
    navigate('/vendor/messages', { state: { openRecipientId: customerId } });
  }, [customerId, navigate]);

  const updateStatus = async (nextStatus, { skipGuard = false } = {}) => {
    if (!projectId || !nextStatus) return;
    if (!skipGuard && statusUpdating) return;
    setStatusUpdating(true);
    try {
      await projectService.updateStatus(projectId, nextStatus);
      addToast('Project status updated.', 'success');
      await load();
    } catch (e) {
      addToast(e?.message || 'Failed to update status', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const openStatusConfirm = (type) => {
    if (statusUpdating) return;
    setStatusConfirmType(type);
  };

  const closeStatusConfirm = () => {
    if (statusUpdating) return;
    setStatusConfirmType(null);
  };

  const confirmStatusChange = async () => {
    if (!statusConfirmType) return;
    if (statusConfirmSubmitting || statusUpdating) return;
    const type = statusConfirmType;
    setStatusConfirmSubmitting(true);
    try {
      await updateStatus(type, { skipGuard: true });
      setStatusConfirmType(null);
    } finally {
      setStatusConfirmSubmitting(false);
    }
  };

  const openShipmentPackageModal = () => {
    const agreedAmount = Number(agreedPriceRaw);
    const defaultDeclaredValue =
      Number.isFinite(agreedAmount) && agreedAmount > 0 ? String(Math.round(agreedAmount)) : '';

    setShipmentPackageForm({
      weightGrams: '',
      lengthCm: '',
      breadthCm: '',
      heightCm: '',
      declaredValueInr: defaultDeclaredValue,
    });
    setShipmentPackageError('');
    setShipmentPackageModalOpen(true);
  };

  const parseShipmentPackageForm = () => {
    const fields = [
      ['weightGrams', 'Weight (grams)'],
      ['lengthCm', 'Length (cm)'],
      ['breadthCm', 'Breadth (cm)'],
      ['heightCm', 'Height (cm)'],
      ['declaredValueInr', 'Declared value (INR)'],
    ];
    for (const [key, label] of fields) {
      if (!String(shipmentPackageForm[key] ?? '').trim()) {
        return { ok: false, message: `${label} is required.` };
      }
    }

    const weightGrams = Number(shipmentPackageForm.weightGrams);
    const lengthCm = Number(shipmentPackageForm.lengthCm);
    const breadthCm = Number(shipmentPackageForm.breadthCm);
    const heightCm = Number(shipmentPackageForm.heightCm);
    const declaredValueInr = Number(shipmentPackageForm.declaredValueInr);

    if (!Number.isFinite(weightGrams) || weightGrams < 10 || weightGrams > 50000) {
      return { ok: false, message: 'Weight must be between 10 and 50,000 grams.' };
    }
    if (!Number.isFinite(lengthCm) || lengthCm < 1 || lengthCm > 200) {
      return { ok: false, message: 'Length must be between 1 and 200 cm.' };
    }
    if (!Number.isFinite(breadthCm) || breadthCm < 1 || breadthCm > 200) {
      return { ok: false, message: 'Breadth must be between 1 and 200 cm.' };
    }
    if (!Number.isFinite(heightCm) || heightCm < 1 || heightCm > 200) {
      return { ok: false, message: 'Height must be between 1 and 200 cm.' };
    }
    if (!Number.isFinite(declaredValueInr) || declaredValueInr < 1 || declaredValueInr > 10000000) {
      return { ok: false, message: 'Declared value must be between ₹1 and ₹1,00,00,000.' };
    }

    return {
      ok: true,
      payload: { weightGrams, lengthCm, breadthCm, heightCm, declaredValueInr },
    };
  };

  const handleGenerateShipment = async () => {
    if (!projectId || shipmentWorking) return;
    const parsed = parseShipmentPackageForm();
    if (!parsed.ok) {
      setShipmentPackageError(parsed.message);
      return;
    }

    setShipmentWorking(true);
    try {
      await projectService.generateInboundShipment(projectId, parsed.payload);
      addToast('Shipping tag generated.', 'success');
      setShipmentPackageModalOpen(false);
      await load();
      const refreshed = await projectService.getDetails(projectId);
      const inbound = refreshed?.shipmentModel?.inbound;
      if (inbound?.labelAvailable && inbound?.id) {
        await projectService.downloadShipmentLabel(projectId, inbound.id);
      }
    } catch (e) {
      addToast(e?.message || 'Failed to generate shipping tag', 'error');
    } finally {
      setShipmentWorking(false);
    }
  };

  const formatQcHubAddressText = (addr) => {
    if (!addr || typeof addr !== 'object') return '';
    const lines = [
      addr.contactName || addr.contact_name || addr.hubName || addr.hub_name,
      [addr.addressLine1 || addr.address_line1, addr.addressLine2 || addr.address_line2].filter(Boolean).join(', '),
      [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
      addr.country,
      addr.phone ? `Phone: ${addr.phone}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleCopyQcAddress = async () => {
    const text = formatQcHubAddressText(qcHubAddress);
    if (!text) {
      addToast('QC address is not available yet.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      addToast('Arviah QC address copied.', 'success');
    } catch {
      addToast('Could not copy address. Please copy it manually.', 'error');
    }
  };

  const handleMarkSelfShipped = async () => {
    if (!projectId || shipmentWorking || !canMarkSelfShipped) return;
    setShipmentWorking(true);
    try {
      await projectService.markInboundSelfShipped(projectId);
      addToast('Marked as shipped to Arviah QC.', 'success');
      await load();
    } catch (e) {
      addToast(e?.message || 'Failed to mark as shipped', 'error');
    } finally {
      setShipmentWorking(false);
    }
  };

  const handleDownloadShipmentLabel = async () => {
    if (!projectId || !activeInbound?.id || shipmentWorking) return;
    setShipmentWorking(true);
    try {
      await projectService.downloadShipmentLabel(projectId, activeInbound.id);
    } catch (e) {
      addToast(e?.message || 'Failed to download label', 'error');
    } finally {
      setShipmentWorking(false);
    }
  };

  const handleDiscardShipment = async () => {
    if (!projectId || !activeInbound?.id || shipmentWorking) return;
    setShipmentWorking(true);
    try {
      await projectService.discardShipment(projectId, activeInbound.id);
      addToast('Shipment discarded.', 'success');
      setShipmentDiscardModalOpen(false);
      await load();
    } catch (e) {
      addToast(e?.message || 'Cannot discard shipment', 'error');
    } finally {
      setShipmentWorking(false);
    }
  };

  const DetailsSummaryCard = ({ className = '' }) => (
    <div className={`rounded-2xl border border-pale bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold text-ink break-words">{project?.title || 'Project'}</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[12px] text-mid">
            <p>
              Budget per piece:{' '}
              <span className="font-extrabold text-ink">
                {budgetPerPieceRaw
                  ? (() => {
                      const n = Number(budgetPerPieceRaw);
                      if (Number.isNaN(n)) return budgetPerPieceRaw;
                      return formatCurrency(n, moneyCurrency);
                    })()
                  : '—'}
              </span>
            </p>
            <p>
              Agreed amount:{' '}
              <span className="font-extrabold text-ink">
                {agreedPriceRaw
                  ? (() => {
                      const n = Number(agreedPriceRaw);
                      if (Number.isNaN(n)) return agreedPriceRaw;
                      return formatCurrency(n, moneyCurrency);
                    })()
                  : '—'}
              </span>
            </p>
            <p>
              Quantity required: <span className="font-extrabold text-ink">{quantityRequiredRaw || '—'}</span>
            </p>
            <p>
              Agreed duration:{' '}
              <span className="font-extrabold text-ink">
                {agreedDaysToCompleteRaw ? `${agreedDaysToCompleteRaw} days` : '—'}
              </span>
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
        <span className="shrink-0 px-3 py-1.5 rounded-full bg-blush text-mid text-[11px] font-extrabold whitespace-nowrap self-start">
          {loading && !project ? '—' : projectStatusLabel}
        </span>
      </div>
    </div>
  );

  const DetailsCardsRow = ({ className = '' }) => (
    <div className={className}>
      <DetailsSummaryCard />
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
    return <VendorKycRequiredCard message="Please complete your KYC to manage this project." />;
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
        <VendorManageProjectSkeleton />
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
                    alt={project?.title || 'Project'}
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
                      Send Message
                    </button>
                  ) : null}
                </div>
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
              <DetailsCardsRow />
              <div className="mt-4">
                <VendorProjectMetaCard rows={remainingMetaRows} />
              </div>
              <div className="mt-4">
                <VendorProjectMetaCard rows={deliveryDetailRows} title="Delivery Details" />
              </div>
              <div className="mt-4 space-y-4">
                <AttachmentsCard />
              </div>
            </div>

            <div className="hidden lg:block">
              <DetailsCardsRow />
            </div>

            <div className="space-y-4">
              {/* Payable: settlement + customer side by side */}
              <div className="bg-white rounded-2xl border border-pale overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-extrabold text-ink">Payable to You</p>
                      <p className="mt-0.5 text-[11px] text-muted">How your settlement is calculated</p>
                    </div>
                    {paymentDetails?.vendorSettlementDone ? (
                      <span className="px-2 py-1 rounded-full border border-emerald-100 bg-emerald-50 text-[10px] font-extrabold text-emerald-700">
                        Payment Settled
                      </span>
                    ) : null}
                  </div>
                  {paymentDetails ? (
                    (() => {
                      const b = paymentDetails.pricingBreakdown || {};
                      const bid =
                        pickBreakdownNum(b, 'jewellerBidJ', 'jeweller_bid_j') ??
                        (paymentDetails.totalAmount != null ? Number(paymentDetails.totalAmount) : null);
                      const jewelleryTax = pickBreakdownNum(b, 'jewelleryGstGj', 'jewellery_gst_gj') ?? 0;
                      const commission =
                        pickBreakdownNum(b, 'commissionC', 'commission_c') ??
                        (paymentDetails.totalCommission != null ? Number(paymentDetails.totalCommission) : null);
                      const pgFee = pickBreakdownNum(b, 'paymentGatewayDeductionOnP', 'payment_gateway_deduction_on_p') ?? 0;
                      const inboundFee =
                        paymentDetails.inboundShippingInr != null
                          ? Number(paymentDetails.inboundShippingInr)
                          : pickBreakdownNum(b, 'inboundShippingInr', 'inbound_shipping_inr') ?? 0;
                      const inboundIsEstimate =
                        paymentDetails.inboundShippingIsEstimate ??
                        b.inboundShippingIsEstimate ??
                        b.inbound_shipping_is_estimate ??
                        true;
                      const returnFee =
                        paymentDetails.returnShippingInr != null
                          ? Number(paymentDetails.returnShippingInr)
                          : pickBreakdownNum(b, 'returnShippingInr', 'return_shipping_inr') ?? 0;
                      const inboundLegs = Array.isArray(paymentDetails.inboundShippingLegs)
                        ? paymentDetails.inboundShippingLegs
                        : Array.isArray(b.inboundShippingLegs)
                          ? b.inboundShippingLegs
                          : [];
                      const returnLegs = Array.isArray(paymentDetails.returnShippingLegs)
                        ? paymentDetails.returnShippingLegs
                        : Array.isArray(b.returnShippingLegs)
                          ? b.returnShippingLegs
                          : [];
                      const shippingTimeline = (() => {
                        const rows = [];
                        if (!inboundIsEstimate && inboundLegs.length > 0) {
                          inboundLegs.forEach((leg, idx) => {
                            const freight = Number(leg?.freightInr);
                            if (!Number.isFinite(freight) || freight <= 0) return;
                            rows.push({
                              kind: 'inbound',
                              key: `inbound-${leg?.shipmentId ?? idx}`,
                              sortAt: leg?.createdAt ? Date.parse(leg.createdAt) : Number.NaN,
                              inboundIndex: idx,
                              freight,
                              awb: leg?.awbCode ? String(leg.awbCode) : null,
                            });
                          });
                        } else if (inboundFee > 0) {
                          rows.push({
                            kind: 'inbound_estimate',
                            key: 'inbound-estimate',
                            sortAt: Number.NEGATIVE_INFINITY,
                            freight: inboundFee,
                          });
                        }

                        if (returnLegs.length > 0) {
                          returnLegs.forEach((leg, idx) => {
                            const freight = Number(leg?.freightInr);
                            if (!Number.isFinite(freight) || freight <= 0) return;
                            rows.push({
                              kind: 'return',
                              key: `return-${leg?.ledgerId ?? idx}`,
                              sortAt: leg?.createdAt ? Date.parse(leg.createdAt) : Number.NaN,
                              returnIndex: idx,
                              freight,
                            });
                          });
                        } else if (returnFee > 0) {
                          // Fallback when API has only a return total: place after first inbound.
                          const firstInboundMs = rows
                            .filter((r) => r.kind === 'inbound' && Number.isFinite(r.sortAt))
                            .map((r) => r.sortAt)
                            .sort((a, b) => a - b)[0];
                          rows.push({
                            kind: 'return',
                            key: 'return-total',
                            sortAt: Number.isFinite(firstInboundMs) ? firstInboundMs + 1 : Number.NaN,
                            returnIndex: 0,
                            freight: returnFee,
                          });
                        }

                        const dated = rows.filter((r) => Number.isFinite(r.sortAt));
                        const undated = rows.filter((r) => !Number.isFinite(r.sortAt));
                        dated.sort((a, b) => a.sortAt - b.sortAt || String(a.key).localeCompare(String(b.key)));

                        // If timestamps are missing, keep typical QC-fail order:
                        // first inbound → returns → remaining inbounds.
                        if (undated.length === rows.length) {
                          const inbounds = rows.filter((r) => r.kind === 'inbound' || r.kind === 'inbound_estimate');
                          const returns = rows.filter((r) => r.kind === 'return');
                          if (inbounds.length === 0) return [...returns];
                          return [inbounds[0], ...returns, ...inbounds.slice(1)];
                        }

                        return [...dated, ...undated];
                      })();
                      const inboundLegCount = shippingTimeline.filter((r) => r.kind === 'inbound').length;
                      const returnLegCount = shippingTimeline.filter((r) => r.kind === 'return').length;
                      const commissionGst = pickBreakdownNum(b, 'commissionGstGc', 'commission_gst_gc') ?? 0;
                      const delivery = pickBreakdownNum(b, 'deliveryFeeD', 'delivery_fee_d') ?? 0;
                      const deliveryGst = pickBreakdownNum(b, 'logisticsGstOnDelivery', 'logistics_gst_on_delivery') ?? 0;
                      const importDuty = pickBreakdownNum(b, 'importDutyInr', 'import_duty_inr') ?? 0;
                      const intlShipping = pickBreakdownNum(b, 'intlShippingInr', 'intl_shipping_inr') ?? 0;
                      const customerDue =
                        pickBreakdownNum(b, 'bundledCustomerDue', 'bundled_customer_due') ?? null;
                      const net =
                        paymentDetails.totalPayableToVendor != null
                          ? Number(paymentDetails.totalPayableToVendor)
                          : pickBreakdownNum(b, 'jewellerEstimatedNetAfterFees', 'jeweller_estimated_net_after_fees');
                      const taxKind = b.jewelleryTaxKind ?? b.jewellery_tax_kind ?? null;
                      const taxWaived =
                        Boolean(b.jewelleryGstWaived ?? b.jewellery_gst_waived) || taxKind === 'waived_seepz';
                      const taxLabel =
                        taxKind === 'local_tax'
                          ? 'Local tax on jewellery'
                          : taxWaived
                            ? 'GST on jewellery (waived)'
                            : 'GST on jewellery';

                      return (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <div className="rounded-2xl border border-pale bg-cream/40 px-3.5 py-3 space-y-2.5">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Your settlement</p>
                            <ProjectMoneyRow label="Your bid" value={bid} />
                            {taxWaived ? (
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[12px] font-semibold text-mid">{taxLabel}</p>
                                <p className="text-[12px] font-extrabold text-muted">{formatCurrency(0, moneyCurrency)}</p>
                              </div>
                            ) : jewelleryTax > 0 ? (
                              <ProjectMoneyRow
                                label={taxLabel}
                                value={jewelleryTax}
                                tone="plus"
                                hint="Collected from customer and passed to you for remittance"
                              />
                            ) : null}
                            {commission != null && commission > 0 ? (
                              <ProjectMoneyRow label="Arviah commission" value={commission} tone="minus" />
                            ) : null}
                            {pgFee > 0 ? (
                              <ProjectMoneyRow label="Est. payment gateway fee" value={pgFee} tone="minus" />
                            ) : null}
                            {shippingTimeline.map((row) => {
                              if (row.kind === 'inbound') {
                                return (
                                  <ProjectMoneyRow
                                    key={row.key}
                                    label={
                                      inboundLegCount > 1
                                        ? `Inbound shipping #${row.inboundIndex + 1} (to Arviah QC)`
                                        : 'Inbound shipping (to Arviah QC)'
                                    }
                                    value={row.freight}
                                    tone="minus"
                                    hint={row.awb ? `AWB ${row.awb}` : undefined}
                                  />
                                );
                              }
                              if (row.kind === 'inbound_estimate') {
                                return (
                                  <ProjectMoneyRow
                                    key={row.key}
                                    label="Est. inbound shipping (to Arviah QC)"
                                    value={row.freight}
                                    tone="minus"
                                  />
                                );
                              }
                              return (
                                <ProjectMoneyRow
                                  key={row.key}
                                  label={
                                    returnLegCount > 1
                                      ? `Return shipping #${row.returnIndex + 1} (to you)`
                                      : 'Return shipping (to you)'
                                  }
                                  value={row.freight}
                                  tone="minus"
                                />
                              );
                            })}
                            <div className="border-t border-dotted border-pale pt-2.5">
                              <ProjectMoneyRow label="You receive" value={net} tone="total" />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-pale px-3.5 py-3 space-y-2.5">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Customer pays</p>
                            <p className="text-[11px] text-muted leading-relaxed">
                              These lines are billed to the customer. Only jewellery tax above is passed through to you.
                            </p>
                            {commissionGst > 0 ? <ProjectMoneyRow label="GST on Arviah commission" value={commissionGst} /> : null}
                            {delivery > 0 ? <ProjectMoneyRow label="Delivery" value={delivery} /> : null}
                            {deliveryGst > 0 ? <ProjectMoneyRow label="GST on delivery" value={deliveryGst} /> : null}
                            {importDuty > 0 ? <ProjectMoneyRow label="Import duty" value={importDuty} /> : null}
                            {intlShipping > 0 ? <ProjectMoneyRow label="Intl. shipping" value={intlShipping} /> : null}
                            <div className="border-t border-pale pt-2.5">
                              <ProjectMoneyRow label="Customer total due" value={customerDue} tone="total" />
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="mt-3 text-[12px] text-muted">
                      Payable details are not available yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Mark In Progress + Shipping action cards */}
              <div className="space-y-4">
                {/* Mark In Progress — green promo card (only before in progress) */}
                {canMarkInProgress ? (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-white">
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-[46%] opacity-40"
                    aria-hidden
                    style={{
                      background:
                        'radial-gradient(ellipse 80% 70% at 70% 40%, rgba(16,185,129,0.18), transparent 70%)',
                    }}
                  />
                  <div className="relative grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:gap-6 md:p-5">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="8" y="2" width="8" height="4" rx="1" />
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                          <path d="m9 14 2 2 4-4" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-extrabold text-ink tracking-tight">Mark In Progress</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-mid">
                          Update the job status to mark it as in progress and let the team know work has started.
                        </p>
                        <button
                          type="button"
                          onClick={() => openStatusConfirm('in_progress')}
                          disabled={!canMarkInProgress || statusUpdating}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M8 5v14l11-7L8 5z" />
                          </svg>
                          {statusUpdating ? 'Updating…' : 'Mark In Progress'}
                        </button>
                      </div>
                    </div>

                    <div className="hidden min-w-[140px] items-center justify-center px-2 md:flex" aria-hidden>
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500 bg-white">
                          <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500" />
                          <span className="absolute top-0.5 left-[22%] h-1 w-1 rounded-full bg-emerald-400" />
                          <span className="absolute top-0.5 right-[22%] h-1 w-1 rounded-full bg-emerald-400" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-600">In Progress</span>
                      </div>
                    </div>
                  </div>
                </div>
                ) : null}

                {/* Shipping & Status — blue promo card (only once in progress / shipping active) */}
                {showShippingCard ? (
                <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-sky-50/80 to-white">
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-[46%] opacity-50"
                    aria-hidden
                    style={{
                      background:
                        'radial-gradient(circle at 75% 35%, rgba(14,165,233,0.16), transparent 55%), radial-gradient(circle at 85% 75%, rgba(56,189,248,0.12), transparent 50%)',
                    }}
                  />
                  <div className="relative grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:gap-6 md:p-5">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                          <path d="M15 18H9" />
                          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                          <circle cx="17" cy="18" r="2" />
                          <circle cx="7" cy="18" r="2" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-extrabold text-ink tracking-tight">Shipping &amp; Status</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-mid">
                          {inboundReceivedAtArviah && !qcFailedPendingRework
                            ? 'Jewellery has been received at Arviah QC. Quality checks will begin next.'
                            : qcFailedPendingRework
                              ? isSelfShipMode
                                ? 'QC needs a reship. Send again to the Arviah QC address below, then tap I’ve shipped.'
                                : 'QC needs a reship. Generate a new shipping tag to send jewellery back to Arviah QC.'
                              : isSelfShipMode
                                ? 'Ship the jewellery to Arviah QC yourself using the address below. Inbound shipping is not charged on your payout.'
                                : 'Generate a shipping tag to send jewellery to Arviah QC. The pickup address will be the same as configured in your Profile section.'}
                        </p>
                        {isSelfShipMode && qcHubAddress && (!activeInbound || qcFailedPendingRework) && !inboundInFlight ? (
                          <div className="mt-3 rounded-xl border border-sky-100 bg-white/80 px-3 py-2.5 text-[12px] text-ink">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-sky-800">Ship to Arviah QC</p>
                            <p className="mt-1 font-bold">
                              {qcHubAddress.contactName || qcHubAddress.contact_name || qcHubAddress.hubName || 'Arviah QC'}
                            </p>
                            <p className="mt-0.5 text-mid whitespace-pre-line">
                              {[
                                [qcHubAddress.addressLine1 || qcHubAddress.address_line1, qcHubAddress.addressLine2 || qcHubAddress.address_line2]
                                  .filter(Boolean)
                                  .join(', '),
                                [qcHubAddress.city, qcHubAddress.state, qcHubAddress.pincode].filter(Boolean).join(', '),
                                qcHubAddress.country,
                                qcHubAddress.phone ? `Phone: ${qcHubAddress.phone}` : null,
                              ]
                                .filter(Boolean)
                                .join('\n')}
                            </p>
                            <button
                              type="button"
                              onClick={handleCopyQcAddress}
                              className="mt-2 text-[11px] font-extrabold text-sky-700 underline"
                            >
                              Copy address
                            </button>
                          </div>
                        ) : null}
                        {inboundReceivedAtArviah && !qcFailedPendingRework ? (
                          <p className="mt-2 text-[12px] text-mid">
                            Status: <span className="font-extrabold text-ink">Received at Arviah QC</span>
                            {activeInbound?.awbCode ? (
                              <>
                                {' '}
                                · AWB <span className="font-extrabold text-ink">{activeInbound.awbCode}</span>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                        {isSelfShipInbound && inboundInFlight ? (
                          <p className="mt-2 text-[12px] text-mid">
                            Status:{' '}
                            <span className="font-extrabold text-ink">
                              {String(activeInbound.status || '').replace(/_/g, ' ') || 'in transit'}
                            </span>
                            {' · Awaiting Arviah QC receive'}
                          </p>
                        ) : null}
                        {!inboundReceivedAtArviah && activeInbound?.awbCode ? (
                          <p className="mt-2 text-[12px] text-mid">
                            AWB: <span className="font-extrabold text-ink">{activeInbound.awbCode}</span>
                            {activeInbound.trackingUrl ? (
                              <>
                                {' '}
                                ·{' '}
                                <a href={activeInbound.trackingUrl} target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline">
                                  Track
                                </a>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canMarkSelfShipped ? (
                            <button
                              type="button"
                              onClick={handleMarkSelfShipped}
                              disabled={shipmentWorking}
                              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {shipmentWorking ? 'Saving…' : 'I’ve shipped'}
                            </button>
                          ) : null}
                          {canGenerateShipment ? (
                            <button
                              type="button"
                              onClick={openShipmentPackageModal}
                              disabled={shipmentWorking}
                              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" x2="12" y1="15" y2="3" />
                              </svg>
                              {shipmentWorking ? 'Generating…' : 'Generate & Download Shipping Tag'}
                            </button>
                          ) : null}
                          {canDownloadShipment ? (
                            <button
                              type="button"
                              onClick={handleDownloadShipmentLabel}
                              disabled={shipmentWorking}
                              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-[12px] font-extrabold text-sky-800 hover:bg-sky-50 disabled:opacity-50"
                            >
                              Download Shipping Tag
                            </button>
                          ) : null}
                          {canDiscardShipment ? (
                            <button
                              type="button"
                              onClick={() => setShipmentDiscardModalOpen(true)}
                              disabled={shipmentWorking}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[12px] font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {isSelfShipInbound ? 'Undo shipped' : 'Discard Shipment'}
                            </button>
                          ) : null}
                        </div>
                        {inboundInFlight && inboundDiscardBlocked ? (
                          <p className="mt-2 text-[11px] text-muted">
                            Courier has picked up this shipment — discard is no longer available.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="hidden min-w-[200px] items-center justify-center px-2 md:flex" aria-hidden>
                      <div className="relative h-[120px] w-[160px]">
                        <div className="absolute bottom-2 right-3 h-16 w-20 rounded-md border border-sky-200 bg-sky-100/80 shadow-sm" />
                        <div className="absolute left-2 top-2 w-[118px] rotate-[-4deg] rounded-md border border-sky-100 bg-white p-2.5 shadow-md">
                          <p className="text-[8px] font-black tracking-[0.12em] text-sky-600">SHIPPING</p>
                          <div className="mt-2 space-y-1">
                            <div className="h-1 w-16 rounded bg-zinc-200" />
                            <div className="h-1 w-12 rounded bg-zinc-200" />
                            <div className="h-1 w-14 rounded bg-zinc-200" />
                          </div>
                          <div className="mt-2.5 flex h-5 items-end gap-px">
                            {Array.from({ length: 18 }).map((_, i) => (
                              <span
                                key={i}
                                className="w-[3px] rounded-sm bg-ink"
                                style={{ height: `${8 + ((i * 5) % 12)}px` }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white shadow">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                ) : null}
              </div>
            </div>

            {statusConfirmType ? (
              (typeof document !== 'undefined'
                ? createPortal(
                    <div
                      className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
                      onMouseDown={closeStatusConfirm}
                    >
                      <div
                        className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
                        onMouseDown={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                      >
                        <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-extrabold text-ink">
                              {statusConfirmType === 'in_progress' ? 'Mark as In Progress' : 'Put in QC Check'}
                            </p>
                            <p className="mt-1 text-[12px] text-muted">
                              {statusConfirmType === 'in_progress'
                                ? 'This will update the project status to In Progress and notify the system.'
                                : 'This will move the project into Arviah QC checks.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={closeStatusConfirm}
                            disabled={statusUpdating || statusConfirmSubmitting}
                            className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60"
                            aria-label="Close"
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
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="px-5 py-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                          <button
                            type="button"
                            onClick={closeStatusConfirm}
                            disabled={statusUpdating || statusConfirmSubmitting}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={confirmStatusChange}
                            disabled={statusUpdating || statusConfirmSubmitting}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
                          >
                            {statusUpdating || statusConfirmSubmitting ? 'Submitting…' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )
                : null)
            ) : null}

            {shipmentPackageModalOpen ? (
              (typeof document !== 'undefined'
                ? createPortal(
                    <div
                      className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
                      onMouseDown={() => !shipmentWorking && setShipmentPackageModalOpen(false)}
                    >
                      <div
                        className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
                        onMouseDown={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                      >
                        <div className="px-5 py-4 border-b border-pale">
                          <p className="text-[14px] font-extrabold text-ink">Package Details</p>
                          <p className="mt-1 text-[12px] text-muted">
                            Enter package weight, box size, and declared value for this shipment.
                          </p>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-[11px] font-bold text-mid">
                              Weight (grams)<span className="text-red-600"> *</span>
                            </span>
                            <input
                              type="number"
                              min="10"
                              max="50000"
                              step="1"
                              required
                              value={shipmentPackageForm.weightGrams}
                              onChange={(e) =>
                                setShipmentPackageForm((prev) => ({ ...prev, weightGrams: e.target.value }))
                              }
                              className="mt-1 w-full rounded-xl border border-pale px-3 py-2 text-[12px]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold text-mid">
                              Declared value (₹)<span className="text-red-600"> *</span>
                            </span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              value={shipmentPackageForm.declaredValueInr}
                              onChange={(e) =>
                                setShipmentPackageForm((prev) => ({ ...prev, declaredValueInr: e.target.value }))
                              }
                              className="mt-1 w-full rounded-xl border border-pale px-3 py-2 text-[12px]"
                            />
                          </label>
                          <div className="col-span-2 grid grid-cols-3 gap-3">
                            <label className="block">
                              <span className="text-[11px] font-bold text-mid">
                                Length (cm)<span className="text-red-600"> *</span>
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="200"
                                step="0.1"
                                required
                                value={shipmentPackageForm.lengthCm}
                                onChange={(e) =>
                                  setShipmentPackageForm((prev) => ({ ...prev, lengthCm: e.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-pale px-3 py-2 text-[12px]"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[11px] font-bold text-mid">
                                Breadth (cm)<span className="text-red-600"> *</span>
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="200"
                                step="0.1"
                                required
                                value={shipmentPackageForm.breadthCm}
                                onChange={(e) =>
                                  setShipmentPackageForm((prev) => ({ ...prev, breadthCm: e.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-pale px-3 py-2 text-[12px]"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[11px] font-bold text-mid">
                                Height (cm)<span className="text-red-600"> *</span>
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="200"
                                step="0.1"
                                required
                                value={shipmentPackageForm.heightCm}
                                onChange={(e) =>
                                  setShipmentPackageForm((prev) => ({ ...prev, heightCm: e.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-pale px-3 py-2 text-[12px]"
                              />
                            </label>
                          </div>
                        </div>
                        {shipmentPackageError ? (
                          <p className="px-5 pb-2 text-[12px] text-red-600">{shipmentPackageError}</p>
                        ) : null}
                        <div className="px-5 py-4 border-t border-pale flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShipmentPackageModalOpen(false)}
                            disabled={shipmentWorking}
                            className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-extrabold border border-pale bg-cream text-ink disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateShipment}
                            disabled={shipmentWorking}
                            className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-extrabold bg-walnut text-blush hover:opacity-90 disabled:opacity-50"
                          >
                            {shipmentWorking ? 'Generating…' : 'Generate Tag'}
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )
                : null)
            ) : null}

            {shipmentDiscardModalOpen ? (
              typeof document !== 'undefined'
                ? createPortal(
                    <div
                      className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
                      onMouseDown={() => !shipmentWorking && setShipmentDiscardModalOpen(false)}
                    >
                      <div
                        className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
                        onMouseDown={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                      >
                        <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-extrabold text-ink">
                              {isSelfShipInbound ? 'Undo shipped' : 'Discard shipment'}
                            </p>
                            <p className="mt-1 text-[12px] text-muted">
                              {isSelfShipInbound
                                ? 'This will clear the “I’ve shipped” status so you can mark it again after sending.'
                                : 'This will cancel the current shipping tag. You can generate a new one later if needed.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShipmentDiscardModalOpen(false)}
                            disabled={shipmentWorking}
                            className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60"
                            aria-label="Close"
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
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="px-5 py-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShipmentDiscardModalOpen(false)}
                            disabled={shipmentWorking}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardShipment}
                            disabled={shipmentWorking}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 disabled:opacity-50"
                          >
                            {shipmentWorking ? 'Discarding…' : isSelfShipInbound ? 'Undo shipped' : 'Discard shipment'}
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )
                : null
            ) : null}

            {/* QC logs card (only show when logs exist) */}
            {qcEntries.length > 0 ? (
              <div className="bg-white rounded-2xl border border-pale overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-extrabold text-ink">QC Updates</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {qcEntries.map((entry, idx) => {
                      const statusKey = normalizeStatusKey(entry?.status);
                      const statusLabel =
                        statusKey === 'passed'
                          ? 'Passed'
                          : statusKey === 'failed'
                            ? 'Failed'
                            : toTitleCase(entry?.status || 'QC');
                      const ts = entry?.createdAt ?? entry?.created_at ?? null;
                      const remarks = entry?.remarks ?? entry?.remark ?? null;
                      const pillClass =
                        statusKey === 'passed'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : statusKey === 'failed'
                            ? 'bg-red-50 border-red-100 text-red-700'
                            : 'bg-cream border-pale text-mid';

                      return (
                        <div key={idx} className="rounded-xl border border-pale bg-cream px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-semibold text-ink">Arviah QC Reviews</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${pillClass}`}
                              >
                                QC {statusLabel}
                              </span>
                              {ts ? (
                                <p className="text-[11px] text-muted whitespace-nowrap">{formatDateTime(ts)}</p>
                              ) : null}
                            </div>
                          </div>
                          {remarks ? (
                            <p className="mt-1 text-[12px] text-mid whitespace-pre-line">{String(remarks)}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Project updates timeline */}
            <div className="bg-white rounded-2xl border border-pale overflow-hidden">
              {loading ? (
                <div className="p-4 md:p-6">
                  <SkeletonBar className="h-3 w-36" />
                  <div className="mt-5 space-y-5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-start gap-3">
                        <SkeletonBar className="h-6 w-6 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2 pt-0.5">
                          <SkeletonBar className="h-3 w-40" />
                          <SkeletonBar className="h-2.5 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !project ? (
                <div className="p-8 text-[13px] text-mid">Unable to load project updates.</div>
              ) : (
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-extrabold text-ink">Project Updates</p>
                  </div>

                  <div className="mt-4">
                    <div className="space-y-5">
                      {statusSteps.map((s, idx) => {
                        const key = s?.key;
                        if (!key) return null;
                        const isLast = idx === statusSteps.length - 1;
                        const kNorm = normalizeStatusKey(key);
                        const isPaymentKey = (k) =>
                          ['invoice_advance', 'paid_advance', 'invoice_final', 'paid_final', 'payment_settlement'].includes(
                            normalizeStatusKey(k),
                          );
                        const paymentSettlementReached = Boolean(paymentDetails?.vendorSettlementDone);

                        const tsCandidate = (() => {
                          const k = normalizeStatusKey(key);
                          if (k === 'invoice_advance') {
                            const arr = statusTimelineMulti.get('invoice') ?? [];
                            return arr[0] ?? (deferredProductionStarted ? deferredProductionStartedAt : null);
                          }
                          if (k === 'invoice_final') {
                            const arr = statusTimelineMulti.get('invoice') ?? [];
                            // Some backends only emit a single `invoice` timeline entry.
                            // If final is already paid, treat Invoice (Final) as reached and
                            // fall back to the final paid timestamp (or QC timestamp) for display.
                            if (arr.length > 1) return arr[arr.length - 1] ?? null;
                            const qcArr = statusTimelineMulti.get('qc') ?? [];
                            return finalPaidAt ?? (qcArr.length ? qcArr[qcArr.length - 1] : null);
                          }
                          if (k === 'paid_advance') {
                            return advancePaidAt ?? (deferredProductionStarted ? deferredProductionStartedAt : null);
                          }
                          if (k === 'paid_final') return finalPaidAt ?? null;
                          if (k === 'payment_settlement') return paymentDetails?.settlementMarkedAt ?? null;
                          if ((k === 'in_transit_to_arviah' || k === 'qc') && qcFailedPendingRework) return null;
                          if (k === 'in_transit_to_arviah') {
                            const qcArr = statusTimelineMulti.get('qc') ?? [];
                            return (
                              activeInbound?.receivedAt ??
                              activeInbound?.received_at ??
                              (shipmentModel?.flags?.inboundReceivedAtArviah
                                ? activeInbound?.updatedAt ?? activeInbound?.updated_at ?? null
                                : null) ??
                              (shipmentModel?.flags?.inboundAwaitingReceive ? activeInbound?.updatedAt ?? null : null) ??
                              (qcArr.length ? qcArr[0] : null)
                            );
                          }
                          const arr = statusTimelineMulti.get(k) ?? [];
                          return arr.length ? arr[arr.length - 1] : null;
                        })();

                        const isPayment = isPaymentKey(kNorm);

                        const currentIdx = statusSteps.findIndex(
                          (st) => normalizeStatusKey(st?.key) === normalizeStatusKey(currentStepKey),
                        );


                        const advanceInvoiceReached =
                          deferredProductionStarted ||
                          (advanceStatus === 'due' || advanceStatus === 'paid') ||
                          (currentIdx > 0 && advanceStatus !== 'not_applicable');
                        const advancePaidReached =
                          deferredProductionStarted || advanceStatus === 'paid' || Boolean(advancePaidAt);

                        const qcIdx = statusSteps.findIndex(
                          (st) => normalizeStatusKey(st?.key) === 'qc',
                        );
                        const qcTimelineArr = statusTimelineMulti.get('qc') ?? [];
                        const qcReached =
                          !qcFailedPendingRework &&
                          qcIdx >= 0 &&
                          (currentIdx >= qcIdx || qcTimelineArr.length > 0);

                        const finalPaidReached = finalStatus === 'paid' || Boolean(finalPaidAt);
                        // Final invoice should be considered reached once QC is reached and final is due/paid.
                        // (After payment, operational status may move past `invoice`.)
                        const finalInvoiceReached =
                          qcReached &&
                          finalStatus !== 'not_applicable' &&
                          (finalStatus === 'due' || finalStatus === 'paid' || finalPaidReached);

                        const reachedByRule = (() => {
                          if (kNorm === 'invoice_advance') return advanceInvoiceReached;
                          if (kNorm === 'paid_advance') return advancePaidReached;
                          if (kNorm === 'invoice_final') return finalInvoiceReached;
                          if (kNorm === 'paid_final') return finalPaidReached;
                          if (kNorm === 'payment_settlement') return paymentSettlementReached;
                          if (kNorm === 'in_transit_to_arviah') return inTransitToArviahReached;
                          return false;
                        })();

                        const ts = reachedByRule || !isPayment ? tsCandidate : null;
                        const isCurrent = normalizeStatusKey(key) === normalizeStatusKey(currentStepKey);
                        const completedByIdx = currentIdx >= 0 ? idx < currentIdx : false;
                        const isCompleted = isPayment ? reachedByRule : reachedByRule || Boolean(ts) || completedByIdx;
                        const state = isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming';

                        const circleClass =
                          state === 'completed'
                            ? 'bg-walnut text-blush border-walnut'
                            : state === 'current'
                              ? 'bg-walnut text-blush border-walnut ring-2 ring-walnut/20'
                              : 'bg-white text-muted border-pale';

                        const lineClass = isCompleted || state === 'current' ? 'bg-walnut' : 'bg-pale';

                        const labelRaw = (() => {
                          const k = normalizeStatusKey(key);
                          if (k === 'invoice_advance') return fullUpfront ? 'Invoice' : 'Invoice (Advance)';
                          if (k === 'invoice_final') return 'Invoice (Final)';
                          if (k === 'paid_advance') return fullUpfront ? 'Payment Received' : 'Advance Paid';
                          if (k === 'paid_final') return 'Final Paid';
                          if (k === 'payment_settlement') return 'Payment Settlement';
                          if (k === 'in_transit_to_arviah') return 'In Transit to Arviah';
                          if (k === 'qc') return 'Arviah QC Checks';
                          if (k === 'invoice') return invoiceProjectStatusLabel(advanceStatus, finalStatus, { fullUpfront });
                          return s?.label ?? toTitleCase(key);
                        })();
                        const label = String(labelRaw ?? key).toUpperCase();
                        const settlementTxnId =
                          kNorm === 'payment_settlement'
                            ? String(
                                paymentDetails?.settlementTransactionId ||
                                  paymentDetails?.raw?.settlementTransactionId ||
                                  '',
                              ).trim() || null
                            : null;
                        const sub = (() => {
                          if (!ts) return 'Awaiting update';
                          const datePart = formatDateOnly(ts);
                          if (settlementTxnId) return `${datePart} · Txn ${settlementTxnId}`;
                          return datePart;
                        })();

                        return (
                          <div key={key} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-extrabold ${circleClass}`}
                              >
                                {idx + 1}
                              </div>
                              {!isLast ? (
                                <div className={`flex-1 w-px mt-1 mb-[-4px] ${lineClass}`} style={{ minHeight: 28 }} />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-[11px] font-extrabold text-ink tracking-wide">{label}</p>
                              <p className="mt-0.5 text-[11px] text-muted break-all">{sub}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
