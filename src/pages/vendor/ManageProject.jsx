import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import SafeImage from '../../components/SafeImage';
import { formatMoney } from '../../utils/formatMoney';
import { invoiceProjectStatusLabel } from '../../utils/invoiceProjectStatusLabel';

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
  const VENDOR_PROJECTS_TAB_KEY = 'mirah_vendor_projects_last_tab';

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [statusConfirmType, setStatusConfirmType] = useState(null); // 'in_progress' | 'qc' | null
  const [statusConfirmSubmitting, setStatusConfirmSubmitting] = useState(false);
  const abortRef = useRef(null);
  const paymentAbortRef = useRef(null);

  const project = details?.project ?? details?.data?.project ?? details?.projectDetails ?? details?.item ?? details?.data ?? details ?? null;
  const advancePayment = details?.advancePayment ?? details?.advance_payment ?? null;
  const finalPayment = details?.finalPayment ?? details?.final_payment ?? null;
  const statusModel =
    details?.statusModel ?? details?.status_model ?? details?.data?.statusModel ?? details?.data?.status_model ?? null;
  const qcModel = details?.qcModel ?? details?.qc_model ?? details?.data?.qcModel ?? details?.data?.qc_model ?? null;
  const ledgerRaw = details?.ledger ?? details?.data?.ledger ?? null;
  const ledger = useMemo(() => coerceArray(ledgerRaw).filter(Boolean), [ledgerRaw]);

  const projectId = project?.id ?? project?._id ?? id ?? null;
  const customerName = customerNameOf(project, details);
  const customerId = customerIdOf(project, details);

  const referenceImage = useMemo(
    () => String(project?.referenceImage ?? project?.reference_image ?? '').trim(),
    [project],
  );
  const attachments = useMemo(() => coerceUrlArray(project?.attachments), [project]);
  const thumbnailUrl = useMemo(
    () =>
      referenceImage && /^https?:\/\//i.test(referenceImage)
        ? referenceImage
        : pickThumbnailUrl(attachments),
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
  const agreedPriceRaw = useMemo(() => {
    const root = details ?? {};
    const p = project ?? {};
    const assignmentsRaw = p?.assignments ?? root?.data?.project?.assignments ?? root?.project?.assignments ?? null;
    const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw.filter(Boolean) : assignmentsRaw ? [assignmentsRaw] : [];
    const activeAssignment =
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
    const v =
      a?.agreedPrice ??
      a?.agreed_price ??
      a?.agreedAmount ??
      a?.agreed_amount ??
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
  }, [details, project]);
  const agreedDaysToCompleteRaw = useMemo(() => {
    const root = details ?? {};
    const p = project ?? {};
    const assignmentsRaw = p?.assignments ?? root?.data?.project?.assignments ?? root?.project?.assignments ?? null;
    const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw.filter(Boolean) : assignmentsRaw ? [assignmentsRaw] : [];
    const activeAssignment =
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
    const v =
      a?.agreedDaysToComplete ??
      a?.agreed_days_to_complete ??
      p?.agreedDaysToComplete ??
      p?.agreed_days_to_complete ??
      root?.agreedDaysToComplete ??
      root?.agreed_days_to_complete ??
      null;
    return v == null ? '' : String(v).trim();
  }, [details, project]);
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
      return invoiceProjectStatusLabel(advanceStatus, finalStatus);
    }
    if (projectStatusKey === 'qc') {
      return 'QC';
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

    const advanceMilestones = [
      { key: 'invoice_advance', label: 'Invoice (Advance)' },
      { key: 'paid_advance', label: 'Advance Paid' },
    ];
    const finalMilestones = [
      { key: 'invoice_final', label: 'Invoice (Final)' },
      { key: 'paid_final', label: 'Final Paid' },
    ];
    const settlementMilestone = { key: 'payment_settlement', label: 'Payment Settlement' };

    // Advance is relevant early; put it after started (or at top if missing).
    insertAfter('started', advanceMilestones);

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

  const canMarkInProgress = currentOperationalStatusKey === 'started';
  const canMarkQc = currentOperationalStatusKey === 'in_progress';

  const qcEntries = useMemo(() => {
    const raw = qcModel?.logs ?? qcModel?.log ?? [];
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.filter(Boolean);
  }, [qcModel]);

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
    load();
    loadPaymentDetails();
    return () => {
      abortRef.current?.abort();
      paymentAbortRef.current?.abort();
    };
  }, [load, loadPaymentDetails]);

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

  const DetailsSummaryCard = ({ className = '' }) => (
    <div className={`rounded-2xl border border-pale bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold text-ink break-words">{project?.title || 'Project'}</p>
          <div className="mt-3 space-y-1.5 text-[12px] text-mid">
            <p>
              Budget per piece:{' '}
              <span className="font-extrabold text-ink">
                {budgetPerPieceRaw
                  ? (() => {
                      const n = Number(budgetPerPieceRaw);
                      if (Number.isNaN(n)) return budgetPerPieceRaw;
                      return `₹ ${formatMoney(n)}`;
                    })()
                  : '—'}
              </span>
            </p>
            <p>
              Quantity required: <span className="font-extrabold text-ink">{quantityRequiredRaw || '—'}</span>
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

  const AgreedCard = ({ className = '' }) => (
    <div className={`rounded-2xl border border-pale bg-white p-5 shadow-sm flex flex-col justify-center min-h-[120px] ${className}`}>
      <div className="space-y-2.5 text-[15px] leading-snug text-mid">
        <p>
          Agreed amount:{' '}
          <span className="font-extrabold text-ink">
            {agreedPriceRaw
              ? (() => {
                  const n = Number(agreedPriceRaw);
                  if (Number.isNaN(n)) return agreedPriceRaw;
                  return `₹ ${formatMoney(n)}`;
                })()
              : '—'}
          </span>
        </p>
        <p>
          Agreed duration:{' '}
          <span className="font-extrabold text-ink">{agreedDaysToCompleteRaw ? `${agreedDaysToCompleteRaw} days` : '—'}</span>
        </p>
      </div>
    </div>
  );

  const DetailsCardsRow = ({ className = '' }) => (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      <DetailsSummaryCard />
      <AgreedCard />
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

      {loading && !details ? (
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
                  <SafeImage
                    src={thumbnailUrl}
                    alt={project?.title || 'Project'}
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
                </div>
              </div>
            </div>

            <div className="hidden lg:block mt-4 space-y-4">
              <MetaCard />
              <AttachmentsCard />
            </div>
          </div>

          <div className="w-full lg:flex-1 min-w-0 space-y-4">
            <div className="lg:hidden">
              <DetailsCardsRow />
              <div className="mt-4">
                <MetaCard />
              </div>
              <div className="mt-4">
                <AttachmentsCard />
              </div>
            </div>

            <div className="hidden lg:block">
              <DetailsCardsRow />
            </div>

            <div className="space-y-4">
            {/* Payable + Change status cards side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payable card */}
              <div className="bg-white rounded-2xl border border-pale overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-extrabold text-ink">Payable to You</p>
                    {paymentDetails?.vendorSettlementDone ? (
                      <span className="px-2 py-1 rounded-full border border-emerald-100 bg-emerald-50 text-[10px] font-extrabold text-emerald-700">
                        Payment Settled
                      </span>
                    ) : null}
                  </div>
                  {paymentDetails ? (
                    <div className="mt-3 space-y-1.5 text-[12px] text-mid">
                      <p>
                        Total Amount:{' '}
                        <span className="font-extrabold text-ink">
                          {paymentDetails.totalAmount != null ? `₹ ${formatMoney(paymentDetails.totalAmount)}` : '—'}
                        </span>
                      </p>
                      <p>
                        Total Commission:{' '}
                        <span className="font-extrabold text-ink">
                          {paymentDetails.totalCommission != null
                            ? `₹ ${formatMoney(paymentDetails.totalCommission)}`
                            : '—'}
                        </span>
                      </p>
                      <p>
                        Net Payable:{' '}
                        <span className="font-extrabold text-ink">
                          {paymentDetails.totalPayableToVendor != null
                            ? `₹ ${formatMoney(paymentDetails.totalPayableToVendor)}`
                            : '—'}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] text-muted">
                      Payable details are not available yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Change status card */}
              <div className="bg-white rounded-2xl border border-pale overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-extrabold text-ink">Change Status</p>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    Update the project operational status as work progresses.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => openStatusConfirm('in_progress')}
                      disabled={!canMarkInProgress || statusUpdating}
                      className="w-full px-4 py-2.5 rounded-xl text-[12px] font-extrabold border border-pale bg-cream text-ink hover:bg-blush disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark In Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => openStatusConfirm('qc')}
                      disabled={!canMarkQc || statusUpdating}
                      className="w-full px-4 py-2.5 rounded-xl text-[12px] font-extrabold border border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Put in QC Check
                    </button>
                  </div>
                </div>
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
                                : 'This will move the project into Mirah QC checks.'}
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
                            <p className="text-[12px] font-semibold text-ink">Mirah QC Reviews</p>
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
                <div className="p-10 md:p-14 bg-cream flex items-center justify-center min-h-[220px]">
                  <svg
                    className="animate-spin text-ink"
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
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
                          if (k === 'payment_settlement') return paymentDetails?.settlementMarkedAt ?? null;
                          const arr = statusTimelineMulti.get(k) ?? [];
                          return arr.length ? arr[arr.length - 1] : null;
                        })();

                        const isPayment = isPaymentKey(kNorm);

                        const currentIdx = statusSteps.findIndex(
                          (st) => normalizeStatusKey(st?.key) === normalizeStatusKey(currentStepKey),
                        );


                        const advanceInvoiceReached =
                          (advanceStatus === 'due' || advanceStatus === 'paid') ||
                          (currentIdx > 0 && advanceStatus !== 'not_applicable');
                        const advancePaidReached = advanceStatus === 'paid' || Boolean(advancePaidAt);

                        const qcIdx = statusSteps.findIndex(
                          (st) => normalizeStatusKey(st?.key) === 'qc',
                        );
                        const qcTimelineArr = statusTimelineMulti.get('qc') ?? [];
                        const qcReached =
                          qcIdx >= 0 &&
                          (currentIdx >= qcIdx || (qcTimelineArr.length > 0));

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
                          return false;
                        })();

                        const ts = reachedByRule || !isPayment ? tsCandidate : null;
                        const isCurrent = normalizeStatusKey(key) === normalizeStatusKey(currentStepKey);
                        const completedByIdx = currentIdx >= 0 ? idx < currentIdx : false;
                        const isCompleted = isPayment ? reachedByRule : Boolean(ts) || completedByIdx;
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
                          if (k === 'payment_settlement') return 'Payment Settlement';
                          if (k === 'qc') return 'Mirah QC Checks';
                          if (k === 'invoice') return invoiceProjectStatusLabel(advanceStatus, finalStatus);
                          return s?.label ?? toTitleCase(key);
                        })();
                        const label = String(labelRaw ?? key).toUpperCase();
                        const sub = ts ? formatDateOnly(ts) : 'Awaiting update';

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
                              <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
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
      </div>
      )}
    </div>
  );
}
