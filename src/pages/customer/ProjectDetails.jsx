import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { projectService } from '../../services/projectService';
import { vendorService } from '../../services/vendorService';
import SafeImage from '../../components/SafeImage';
import { formatMoney } from '../../utils/formatMoney';

function isCanceledRequest(err) {
  const e = err ?? {};
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError';
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

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
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

function coerceUrlArray(input) {
  const raw = input ?? [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? [raw] : [];
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function isImageUrl(url) {
  const u = String(url || '').toLowerCase().split('?')[0];
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u);
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

function paymentStatusLabel(s) {
  const k = String(s ?? '').trim().toLowerCase();
  if (!k || k === '—') return '—';
  if (k === 'not_applicable') return 'Not Generated';
  return toTitleCase(k);
}

function paymentStatusPillClass(s) {
  const k = String(s ?? '').trim().toLowerCase();
  if (k === 'paid') return 'bg-green-50 text-green-700 border-green-200';
  if (k === 'due') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (k === 'not_applicable') return 'bg-cream text-mid border-pale';
  return 'bg-cream text-mid border-pale';
}

function coerceAssignments(input) {
  const asg = input ?? [];
  return Array.isArray(asg) ? asg.filter(Boolean) : asg ? [asg] : [];
}

function assignmentVendorIdOf(a) {
  return a?.vendorId ?? a?.vendor_id ?? a?.vendor?.id ?? a?.vendor?._id ?? null;
}

function assignmentVendorNameOf(a) {
  const joined = `${a?.vendor?.firstName ?? ''} ${a?.vendor?.lastName ?? ''}`.trim();
  const name = (
    a?.vendorName ??
    a?.vendor_name ??
    a?.vendor?.fullName ??
    a?.vendor?.name ??
    a?.vendor?.businessName ??
    (joined || null)
  );
  const trimmed = typeof name === 'string' ? name.trim() : name;
  return trimmed ? trimmed : null;
}

function assignmentAmountOf(a) {
  return (
    a?.agreedPrice ??
    a?.agreed_price ??
    a?.amount ??
    a?.price ??
    a?.bidAmount ??
    a?.bid_amount ??
    a?.selectedAmount ??
    a?.selected_amount ??
    null
  );
}

function assignmentDaysOf(a) {
  return (
    a?.agreedDaysToComplete ??
    a?.agreed_days_to_complete ??
    a?.noOfDays ??
    a?.daysToComplete ??
    a?.days_to_complete ??
    a?.no_of_days ??
    a?.timeline ??
    null
  );
}

function loadRazorpay() {
  return new Promise((resolve) => {
    try {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    } catch {
      resolve(false);
    }
  });
}

function parseProjectPaymentOrder(raw, envKeyId) {
  // Backend may return { keyId, order: { id, amount, currency, ... }, ledgerId }
  // or older/alternate shapes (direct order object, nested data, etc.)
  const root = raw ?? {};
  const data = root?.data ?? root?.result ?? root ?? {};

  const orderLike =
    data?.order ??
    data?.razorpayOrder ??
    data?.razorpay_order ??
    (data?.entity === 'order' ? data : null) ??
    null;

  const orderId =
    orderLike?.id ??
    orderLike?.orderId ??
    orderLike?.razorpayOrderId ??
    orderLike?.razorpay_order_id ??
    null;

  const amount =
    orderLike?.amount ??
    data?.amount ??
    data?.amountInPaise ??
    data?.amount_in_paise ??
    data?.amountInRupees ??
    null;

  const currency = orderLike?.currency ?? data?.currency ?? 'INR';

  const keyId =
    data?.keyId ??
    data?.key_id ??
    data?.key ??
    envKeyId ??
    null;

  return { orderId, amount, currency, keyId, raw: data };
}

export default function ProjectDetails() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorDetails, setVendorDetails] = useState(null);
  const abortRef = useRef(null);
  const vendorAbortRef = useRef(null);
  const PROJECTS_TAB_KEY = 'mirah_projects_last_tab';
  const PROJECTS_LIST_FILTER_KEY = 'mirah_projects_last_list_filter';

  const project = details?.project ?? details?.data?.project ?? details?.projectDetails ?? details?.item ?? details?.data ?? details ?? null;
  const activeBidWindow = details?.activeBidWindow ?? details?.active_bid_window ?? null;
  const advancePayment = details?.advancePayment ?? details?.advance_payment ?? null;
  const finalPayment = details?.finalPayment ?? details?.final_payment ?? null;
  const statusModel = details?.statusModel ?? details?.status_model ?? details?.data?.statusModel ?? details?.data?.status_model ?? null;
  const ledgerRaw = details?.ledger ?? details?.data?.ledger ?? null;
  const ledger = useMemo(() => coerceArray(ledgerRaw).filter(Boolean), [ledgerRaw]);

  const projectId = project?.id ?? project?._id ?? id ?? null;
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
  const projectStatusLabel = useMemo(() => {
    if (projectStatusKey === 'invoice') {
      if (advanceStatus === 'due') return 'Invoice (Advance)';
      if (finalStatus === 'due') return 'Invoice (Final)';
      return 'Invoice';
    }
    return toTitleCase(project?.projectStatus ?? project?.project_status ?? '—');
  }, [advanceStatus, finalStatus, project, projectStatusKey]);

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
    const baseRaw = currentKey !== 'cancelled' ? deduped.filter((s) => normalizeStatusKey(s?.key) !== 'cancelled') : deduped;

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

    const advanceMilestones = [{ key: 'invoice_advance', label: 'Invoice (Advance)' }, { key: 'paid_advance', label: 'Advance Paid' }];
    const finalMilestones = [{ key: 'invoice_final', label: 'Invoice (Final)' }, { key: 'paid_final', label: 'Final Paid' }];

    // Advance is relevant early; put it after started (or at top if missing).
    insertAfter('started', advanceMilestones);

    // Final is expected after QC; if QC missing, append near end.
    insertAfter('qc', finalMilestones);

    // Final dedupe in case steps already included similar keys
    const seen2 = new Set();
    return out.filter((s) => {
      const k = normalizeStatusKey(s?.key);
      if (!k || seen2.has(k)) return false;
      seen2.add(k);
      return true;
    });
  }, [project, statusModel]);

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
    const finishedAt = statusModel?.finishedAt ?? statusModel?.finished_at ?? project?.finishedAt ?? project?.finished_at ?? null;
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
        statusModel?.projectStatus ?? statusModel?.project_status ?? project?.projectStatus ?? project?.project_status ?? '',
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
    return best;
  }, [advancePayment, ledger]);

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

  const currentStepKey = useMemo(() => {
    if (currentOperationalStatusKey === 'invoice') {
      if (advanceStatus === 'due') return 'invoice_advance';
      if (finalStatus === 'due') return 'invoice_final';
      if (finalStatus === 'paid') return 'paid_final';
      if (advanceStatus === 'paid') return 'paid_advance';
      return 'invoice_advance';
    }
    if (currentOperationalStatusKey === 'paid') {
      if (finalStatus === 'paid') return 'paid_final';
      if (advanceStatus === 'paid') return 'paid_advance';
      return 'paid_final';
    }
    return currentOperationalStatusKey;
  }, [advanceStatus, currentOperationalStatusKey, finalStatus]);

  const assignmentsRaw =
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
    details?.data?.project?.assignments ??
    details?.data?.project?.assignmentRequests ??
    details?.data?.project?.projectAssignments ??
    null;

  const assignments = useMemo(
    () => coerceAssignments(assignmentsRaw ?? []),
    [assignmentsRaw],
  );
  const primaryAssignment = useMemo(() => {
    const accepted = assignments.find((x) => String(x?.status ?? '').trim().toLowerCase() === 'accepted') || null;
    return accepted ?? assignments[0] ?? null;
  }, [assignments]);
  const vendorId = useMemo(() => {
    const fromAssignment = assignmentVendorIdOf(primaryAssignment);
    if (fromAssignment != null && fromAssignment !== '') return fromAssignment;
    const v =
      details?.assignedVendor ??
      details?.vendor ??
      details?.data?.assignedVendor ??
      details?.data?.vendor ??
      details?.project?.assignedVendor ??
      details?.project?.vendor ??
      details?.data?.project?.assignedVendor ??
      details?.data?.project?.vendor ??
      null;
    return v?.id ?? v?._id ?? details?.vendorId ?? details?.vendor_id ?? null;
  }, [details, primaryAssignment]);

  useEffect(() => {
    if (vendorAbortRef.current) vendorAbortRef.current.abort();
    setVendorDetails(null);
    if (!vendorId) return;
    const ctrl = new AbortController();
    vendorAbortRef.current = ctrl;
    setVendorLoading(true);
    (async () => {
      try {
        const v = await vendorService.getDetails(vendorId, { signal: ctrl.signal });
        setVendorDetails(v || null);
      } catch {
        // ignore (header can fall back to assignment name)
      } finally {
        setVendorLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [vendorId]);

  const vendorFullName = useMemo(() => {
    const joined = `${vendorDetails?.firstName ?? ''} ${vendorDetails?.lastName ?? ''}`.trim();
    const fromFetch =
      vendorDetails?.fullName ??
      vendorDetails?.name ??
      vendorDetails?.businessName ??
      (joined || null);
    if (typeof fromFetch === 'string' && fromFetch.trim()) return fromFetch.trim();
    if (fromFetch) return fromFetch;

    const fromAssignment = assignmentVendorNameOf(primaryAssignment);
    if (fromAssignment) return fromAssignment;
    return null;
  }, [primaryAssignment, vendorDetails]);
  const assignedAmount = useMemo(() => assignmentAmountOf(primaryAssignment), [primaryAssignment]);
  const assignedDays = useMemo(() => assignmentDaysOf(primaryAssignment), [primaryAssignment]);
  const attachments = useMemo(() => coerceUrlArray(project?.attachments), [project]);
  const referenceImage = useMemo(() => {
    const raw = String(project?.referenceImage ?? project?.reference_image ?? '').trim();
    if (raw && isHttpUrl(raw)) return raw;
    const img = (attachments || []).find((u) => isHttpUrl(u) && isImageUrl(u));
    return img || '';
  }, [project, attachments]);
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

  const markAsCompleted = useCallback(async () => {
    if (!projectId) return;
    if (completeLoading) return;
    setCompleteLoading(true);
    try {
      const res = await projectService.complete(projectId);
      addToast(res?.message || 'Project marked as completed.', 'success');
      setCompleteConfirmOpen(false);
      await load();
    } catch (e) {
      addToast(e?.message || 'Failed to mark project as completed', 'error');
    } finally {
      setCompleteLoading(false);
    }
  }, [addToast, completeLoading, load, projectId]);

  const openCompleteConfirm = useCallback(() => {
    if (completeLoading) return;
    setCompleteConfirmOpen(true);
  }, [completeLoading]);

  const closeCompleteConfirm = useCallback(() => {
    if (completeLoading) return;
    setCompleteConfirmOpen(false);
  }, [completeLoading]);

  const downloadInvoice = useCallback(async () => {
    if (!projectId) return;
    if (invoiceLoading) return;
    setInvoiceLoading(true);
    try {
      await projectService.downloadInvoice(projectId);
    } catch (e) {
      addToast(e?.message || 'Failed to download invoice', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  }, [addToast, invoiceLoading, projectId]);

  useEffect(() => {
    load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  const goBackToProjects = useCallback(() => {
    const stateTab = String(location?.state?.fromProjectsTab ?? '').trim().toLowerCase();
    const stateFilter = String(location?.state?.fromListFilter ?? '').trim().toLowerCase();
    const filterFromState = ['all', 'action_required', 'active', 'completed', 'drafts'].includes(stateFilter) ? stateFilter : null;
    if (stateTab === 'list' || filterFromState) {
      const f =
        filterFromState ||
        (() => {
          try {
            const stored = String(sessionStorage.getItem(PROJECTS_LIST_FILTER_KEY) || '').trim().toLowerCase();
            return ['all', 'action_required', 'active', 'completed', 'drafts'].includes(stored) ? stored : 'all';
          } catch {
            return 'all';
          }
        })();
      navigate(`/customer/projects?tab=list&filter=${encodeURIComponent(f)}`);
      return;
    }
    try {
      const raw = sessionStorage.getItem(PROJECTS_TAB_KEY);
      const t = String(raw || '').trim().toLowerCase();
      if (t === 'assignments' || t === 'create' || t === 'list') {
        navigate(`/customer/projects?tab=${encodeURIComponent(t)}`);
        return;
      }
    } catch {
      // ignore
    }
    // Default: assignments (most common entry to tracking)
    navigate('/customer/projects?tab=assignments');
  }, [PROJECTS_LIST_FILTER_KEY, PROJECTS_TAB_KEY, location?.state, navigate]);

  const canShowTrackNav = useMemo(() => {
    const k = String(primaryAssignment?.status ?? '').trim().toLowerCase();
    return k === 'accepted' && Boolean(projectId);
  }, [primaryAssignment, projectId]);

  const navStateForProject = useCallback(
    () => ({
      ...location.state,
      projectTitle: project?.title ?? location.state?.projectTitle ?? '',
    }),
    [location.state, project?.title],
  );

  const pay = async (type) => {
    if (!projectId) return;
    if (payLoading) return;
    setPayLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Razorpay failed to load');

      const raw = await projectService.createPaymentOrder(projectId, { type });
      const envKeyId =
        import.meta.env?.VITE_RAZORPAY_KEY_ID ??
        import.meta.env?.VITE_RAZORPAY_KEY ??
        null;
      const parsed = parseProjectPaymentOrder(raw, envKeyId);

      if (!parsed.orderId) throw new Error('Payment init failed (missing Razorpay orderId)');
      if (!parsed.keyId) throw new Error('Payment init failed (missing Razorpay keyId)');

      let handlerInvoked = false;
      const options = {
        key: parsed.keyId,
        order_id: parsed.orderId,
        currency: parsed.currency || 'INR',
        name: 'Mirah',
        description: type === 'advance' ? 'Advance payment' : 'Final payment',
        modal: {
          ondismiss: () => {
            if (handlerInvoked) return;
            addToast('Payment not completed.', 'error');
          },
        },
        handler: async (response) => {
          handlerInvoked = true;
          try {
            setVerifyingPayment(true);
            await projectService.verifyPayment(projectId, {
              type,
              razorpay_order_id: response?.razorpay_order_id,
              razorpay_payment_id: response?.razorpay_payment_id,
              razorpay_signature: response?.razorpay_signature,
            });
            addToast('Payment successful', 'success');
            await load();
          } catch (e) {
            addToast(e?.message || 'Payment verification failed', 'error');
          } finally {
            setVerifyingPayment(false);
          }
        },
        theme: { color: '#6B5545' },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    } catch (e) {
      addToast(e?.message || 'Payment failed', 'error');
    } finally {
      setPayLoading(false);
    }
  };

  const amountRange = project?.amountRange ?? project?.amount_range ?? null;
  void amountRange;

  return (
    <div className="w-full pt-4 sm:pt-5 pb-10 animate-fade-in">
      {completeConfirmOpen
        ? (typeof document !== 'undefined'
            ? createPortal(
                <div
                  className="fixed inset-0 z-[210] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
                  onMouseDown={closeCompleteConfirm}
                >
                  <div
                    className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
                    onMouseDown={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-extrabold text-ink">Mark project as completed</p>
                        <p className="mt-1 text-[12px] text-muted">
                          This will mark the project as completed. You won’t be able to undo this action.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeCompleteConfirm}
                        disabled={completeLoading}
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
                        onClick={closeCompleteConfirm}
                        disabled={completeLoading}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={markAsCompleted}
                        disabled={completeLoading}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        {completeLoading ? 'Submitting…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null)
        : null}

      {verifyingPayment ? (
        <div className="fixed inset-0 z-[200] bg-ink/25 backdrop-blur-[1px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-pale bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-walnut/10 border border-walnut/15 flex items-center justify-center text-ink shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-extrabold text-ink">Verifying payment…</p>
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="mt-1 text-[12px] text-muted">Please wait, do not close the app.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBackToProjects}
          className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-extrabold text-mid hover:bg-cream inline-flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
        {canShowTrackNav ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/customer/projects/${projectId}/bids`, { state: navStateForProject() })}
              className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-extrabold text-mid hover:bg-cream"
            >
              View Bids
            </button>
            <button
              type="button"
              onClick={() => navigate(`/customer/projects/${projectId}`, { state: navStateForProject() })}
              className="px-3 py-2 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90"
            >
              Track
            </button>
          </div>
        ) : null}
      </div>

      <div className="w-full flex flex-col lg:flex-row gap-5 items-start">
        <div className="w-full lg:w-[400px] shrink-0 lg:self-start space-y-4">
          <div className="rounded-2xl border border-pale bg-white overflow-hidden shadow-sm">
            <div className="relative h-[280px] sm:h-[340px] bg-gradient-to-br from-cream via-blush to-pale overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : referenceImage ? (
                <SafeImage
                  src={referenceImage}
                  alt={project?.title || location?.state?.projectTitle || 'Project'}
                  className="absolute inset-0 w-full h-full object-cover"
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
          </div>

          {!loading && !project ? (
            <div className="rounded-2xl border border-pale bg-white p-5 text-[13px] text-mid shadow-sm">Unable to load project.</div>
          ) : null}

          {!loading && project ? (
            <>
              <div className="rounded-2xl border border-pale bg-white p-4 md:p-6 shadow-sm">
                <p className="text-[16px] md:text-[18px] font-extrabold text-ink break-words">{project?.title || 'Project'}</p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 text-[12px]">
                    <span className="text-muted font-semibold">Budget per piece</span>
                    <span className="text-ink font-extrabold text-right">
                      {budgetPerPieceRaw
                        ? (() => {
                            const n = Number(budgetPerPieceRaw);
                            if (Number.isNaN(n)) return budgetPerPieceRaw;
                            return `₹ ${formatMoney(n)}`;
                          })()
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-[12px]">
                    <span className="text-muted font-semibold">Quantity required</span>
                    <span className="text-ink font-extrabold text-right">{quantityRequiredRaw || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-[12px]">
                    <span className="text-muted font-semibold">Expected delivery</span>
                    <span className="text-ink font-extrabold text-right">
                      {preferredDeliveryRaw ? formatDateOnlyFromInput(preferredDeliveryRaw) : '—'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {vendorFullName ? (
                    <p className="text-[12px] text-muted">
                      Jeweller:{' '}
                      <span className="font-extrabold text-ink">{vendorLoading ? 'Loading…' : vendorFullName}</span>
                    </p>
                  ) : vendorId ? (
                    <p className="text-[12px] text-muted">
                      Jeweller:{' '}
                      <span className="font-extrabold text-ink">{vendorLoading ? 'Loading…' : `#${vendorId}`}</span>
                    </p>
                  ) : null}
                </div>

                {vendorId ? (
                  <div className="mt-4 flex flex-col gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => navigate(`/customer/vendors/${vendorId}`)}
                      className="w-full px-4 py-2 rounded-xl bg-white border border-pale text-[12px] font-extrabold text-ink hover:bg-cream inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      View Jeweller Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/messages', { state: { openRecipientId: vendorId } })}
                      className="w-full px-4 py-2 rounded-xl bg-walnut text-blush text-[12px] font-extrabold hover:opacity-90 inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Message Jeweller
                    </button>
                  </div>
                ) : null}

                {activeBidWindow ? (
                  <div className="mt-4 text-[12px] text-muted">
                    Active auction ends at:{' '}
                    <span className="font-semibold text-mid">
                      {formatDateTime(activeBidWindow?.finishingTimestamp ?? activeBidWindow?.finishingAt ?? activeBidWindow?.finishing_at)}
                    </span>
                  </div>
                ) : null}
              </div>

              {remainingMetaRows.length > 0 ? (
                <div className="rounded-2xl border border-pale bg-white overflow-hidden shadow-sm">
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
              ) : null}

              {attachments.length > 0 ? (
                <div className="rounded-2xl border border-pale bg-white p-5 shadow-sm">
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
                          onClick={(e) => e.stopPropagation()}
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
              ) : null}
            </>
          ) : null}
        </div>

        {/* Right column: payments (Agreed + Advance + Final as inner cards) */}
        <div className="w-full lg:flex-1 min-w-0 md:self-start">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-pale overflow-hidden">
              {loading ? (
                <div className="p-10 md:p-14 bg-cream flex items-center justify-center min-h-[220px]">
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : !project ? (
                <div className="p-8 text-[13px] text-mid">Unable to load project.</div>
              ) : (
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-extrabold text-ink">Payments</p>
                    <button
                      type="button"
                      onClick={downloadInvoice}
                      disabled={invoiceLoading || !projectId}
                      className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {invoiceLoading ? 'Downloading…' : 'Download invoice'}
                    </button>
                  </div>
                  <div
                    className={`mt-3 grid gap-3 ${
                      assignedAmount != null || assignedDays != null
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        : 'grid-cols-1 md:grid-cols-2'
                    }`}
                  >
                    {assignedAmount != null || assignedDays != null ? (
                      <div className="rounded-2xl border border-pale bg-cream/50 p-4">
                        <p className="text-[12px] font-bold text-ink">Agreed</p>
                        <div className="mt-3 space-y-2 text-[12px]">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted font-semibold">Agreed amount</span>
                            <span className="text-ink font-extrabold text-right">
                              {assignedAmount != null && Number.isFinite(Number(assignedAmount))
                                ? `₹ ${formatMoney(assignedAmount)}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted font-semibold">Agreed duration</span>
                            <span className="text-ink font-extrabold text-right">
                              {assignedDays != null && Number.isFinite(Number(assignedDays)) ? `${Number(assignedDays)} days` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-pale p-4">
                      <p className="text-[12px] font-bold text-ink">Advance</p>
                      <p className="mt-1 text-[12px] text-muted">
                        Status:{' '}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${paymentStatusPillClass(advanceStatus)}`}>
                        {paymentStatusLabel(advanceStatus)}
                      </span>
                      </p>
                      {advancePayment?.suggestedAmount != null ? (
                        <p className="mt-1 text-[12px] text-muted">
                          Suggested: <span className="font-semibold text-mid">₹ {formatMoney(advancePayment.suggestedAmount)}</span>
                        </p>
                      ) : null}
                      {advanceStatus === 'due' ? (
                        <button
                          type="button"
                          onClick={() => pay('advance')}
                          disabled={payLoading}
                          className="mt-3 w-full px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {payLoading ? 'Processing…' : 'Pay Advance'}
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-pale p-4">
                      <p className="text-[12px] font-bold text-ink">Final</p>
                      <p className="mt-1 text-[12px] text-muted">
                        Status:{' '}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${paymentStatusPillClass(finalStatus)}`}>
                        {paymentStatusLabel(finalStatus)}
                      </span>
                      </p>
                      {finalPayment?.suggestedAmount != null ? (
                        <p className="mt-1 text-[12px] text-muted">
                          Suggested: <span className="font-semibold text-mid">₹ {formatMoney(finalPayment.suggestedAmount)}</span>
                        </p>
                      ) : null}
                      {finalStatus === 'due' ? (
                        <button
                          type="button"
                          onClick={() => pay('final')}
                          disabled={payLoading}
                          className="mt-3 w-full px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {payLoading ? 'Processing…' : 'Pay Final'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-muted">
                    Note: Advance payment is required to start the project. Final payment can be paid after project completion.
                  </p>
                </div>
              )}
            </div>

            {!loading && project && currentOperationalStatusKey === 'delivered' ? (
              <div className="bg-white rounded-2xl border border-emerald-100 bg-emerald-50/40 overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-extrabold text-ink">Project Delivered</p>
                      <p className="mt-1 text-[12px] text-mid">
                        Your project is delivered. Please mark it as completed to finish the project.
                      </p>
                    </div>
                    <div className="shrink-0 w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={openCompleteConfirm}
                      disabled={completeLoading}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark as Completed
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="bg-white rounded-2xl border border-pale overflow-hidden">
              {loading ? (
                <div className="p-10 md:p-14 bg-cream flex items-center justify-center min-h-[220px]">
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : !project ? (
                <div className="p-8 text-[13px] text-mid">Unable to load project updates.</div>
              ) : (
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-extrabold text-ink">Project Updates</p>
                  </div>

                  <div className="mt-4">
                    {(() => {
                      const isPaymentKey = (k) => ['invoice_advance', 'paid_advance', 'invoice_final', 'paid_final'].includes(normalizeStatusKey(k));
                      const operationalSteps = statusSteps.filter((s) => !isPaymentKey(s?.key));
                      const currentOperationalIdx = operationalSteps.findIndex(
                        (s) => normalizeStatusKey(s?.key) === normalizeStatusKey(currentOperationalStatusKey),
                      );
                      const qcIdx = operationalSteps.findIndex((s) => normalizeStatusKey(s?.key) === 'qc');
                      const qcReached = qcIdx >= 0 && (currentOperationalIdx >= qcIdx || (statusTimelineMulti.get('qc') ?? []).length > 0);

                      const currentIdx = statusSteps.findIndex((s) => normalizeStatusKey(s?.key) === normalizeStatusKey(currentStepKey));
                      return (
                        <div className="space-y-5">
                          {statusSteps.map((s, idx) => {
                            const key = s?.key;
                            if (!key) return null;
                            const isLast = idx === statusSteps.length - 1;
                            const tsCandidate = (() => {
                              const k = normalizeStatusKey(key);
                              if (k === 'invoice_advance') {
                                const arr = statusTimelineMulti.get('invoice') ?? [];
                                return arr[0] ?? null;
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
                              if (k === 'paid_advance') return advancePaidAt ?? null;
                              if (k === 'paid_final') return finalPaidAt ?? null;
                              const arr = statusTimelineMulti.get(k) ?? [];
                              return arr.length ? arr[arr.length - 1] : null;
                            })();

                            const kNorm = normalizeStatusKey(key);
                            const isPayment = isPaymentKey(kNorm);
                            const completedByIdx = currentIdx >= 0 ? idx < currentIdx : false;

                            const advanceInvoiceReached =
                              (advanceStatus === 'due' || advanceStatus === 'paid') || (currentOperationalIdx > 0 && advanceStatus !== 'not_applicable');
                            const advancePaidReached = advanceStatus === 'paid' || Boolean(advancePaidAt);

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
                              return false;
                            })();

                            const ts = reachedByRule || !isPayment ? tsCandidate : null;
                            const isCurrent = normalizeStatusKey(key) === normalizeStatusKey(currentStepKey);
                            const isCompleted = isPayment ? Boolean(ts) : Boolean(ts) || completedByIdx;
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
                              if (k === 'invoice_advance') return 'Invoice (Advance)';
                              if (k === 'invoice_final') return 'Invoice (Final)';
                              if (k === 'paid_advance') return 'Advance Paid';
                              if (k === 'paid_final') return 'Final Paid';
                              if (k === 'qc') return 'Mirah QC Checks';
                              if (k === 'invoice') return projectStatusLabel;
                              return s?.label ?? toTitleCase(key);
                            })();
                            const label = String(labelRaw ?? key).toUpperCase();

                            const sub =
                              ts
                                ? formatDateOnly(ts)
                                : state === 'upcoming'
                                  ? 'Upcoming'
                                  : '—';

                            return (
                              <div key={`${key}-${idx}`} className="relative pl-10">
                                {!isLast ? (
                                  <span className={`absolute left-[12px] top-7 bottom-[-20px] w-[2px] ${lineClass}`} />
                                ) : null}
                                <span
                                  className={`absolute left-[4px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[12px] font-extrabold ${circleClass}`}
                                >
                                  {idx + 1}
                                </span>

                                <div className="space-y-0.5">
                                  <p className={`text-[12px] font-extrabold tracking-wide ${state === 'upcoming' ? 'text-muted' : 'text-ink'}`}>
                                    {label}
                                  </p>
                                  <p className={`text-[11px] ${state === 'upcoming' ? 'text-muted' : 'text-muted'}`}>{sub}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
