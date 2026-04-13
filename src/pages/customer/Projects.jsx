import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { vendorService } from '../../services/vendorService';
import SafeImage from '../../components/SafeImage';
import { formatMoney } from '../../utils/formatMoney';

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  // Format: 6 Mar 2026, 3:32 PM
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${datePart}, ${timePart}`;
}

function formatDateOnlyFromInput(value) {
  const d = parseLocalDateInput(value);
  if (!d) return String(value || '').trim() || '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function normalizeExtraFieldKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extraFieldsToArray(extraFields) {
  if (!extraFields) return [];
  // Preferred format:
  // { schema: { key: { type: "text", label: "Label" } }, values: { key: "Value" } }
  if (typeof extraFields === 'object' && extraFields?.schema && extraFields?.values) {
    const schema = extraFields.schema;
    const values = extraFields.values;
    if (schema && typeof schema === 'object' && values && typeof values === 'object') {
      const keys = new Set([...Object.keys(schema || {}), ...Object.keys(values || {})]);
      return Array.from(keys)
        .map((k) => ({
          key: String(k || '').trim(),
          label: String(schema?.[k]?.label || '').trim(),
          value: String(values?.[k] ?? '').trim(),
        }))
        .filter((x) => x.key && (x.label || x.value));
    }
  }
  // Back-compat: plain object meta { city: "Bengaluru" }
  if (typeof extraFields === 'object' && !Array.isArray(extraFields)) {
    return Object.entries(extraFields)
      .map(([k, v]) => ({ key: String(k), label: toTitleCase(k), value: String(v ?? '').trim() }))
      .filter((x) => x.key && x.value);
  }
  return [];
}

function buildExtraFieldsPayload(extraFieldRows) {
  const rows = Array.isArray(extraFieldRows) ? extraFieldRows : [];
  const normalized = rows
    .map((x) => {
      const label = String(x?.label || '').trim();
      const value = String(x?.value || '').trim();
      const key = String(x?.key || normalizeExtraFieldKey(label) || '').trim();
      return { key, label, value };
    })
    .filter((x) => x.label && x.value);

  if (!normalized.length) return undefined;

  const schema = {};
  const values = {};
  for (const item of normalized) {
    schema[item.key] = { type: 'text', label: item.label };
    values[item.key] = item.value;
  }
  return { schema, values };
}

function buildStructuredSpecsPayload(specs) {
  const s = specs ?? {};
  const out = [];

  const push = (key, label, value) => {
    const v = value ?? '';
    const str = typeof v === 'string' ? v.trim() : v === true ? 'true' : v === false ? 'false' : String(v ?? '').trim();
    if (!key || !label) return;
    if (str === '') return;
    out.push({ key, label, value: str });
  };

  push('jewelleryType', 'Jewellery Type', s.jewelleryType);
  push('sizeMode', 'Size Mode', s.sizeMode);
  push('sizeStandard', 'Size', s.sizeStandard);
  push('sizeCustomValue', 'Custom Size', s.sizeCustomValue);
  push('sizeCustomUnit', 'Custom Size Unit', s.sizeCustomUnit);
  push('metalType', 'Metal type', s.metalType);
  push('metalPurity', 'Metal purity', s.metalPurity);
  push('metalColour', 'Metal colour', s.metalColour);
  push('twoToneDetails', 'Two-tone specification and additional metal details', s.twoToneDetails);
  push('metalFinish', 'Metal finish', s.metalFinish);
  push('stonesIncluded', 'Does your design include stones?', s.stonesIncluded);
  push('stoneType', 'Stone type', s.stoneType);
  push('stoneQualityBracket', 'Preferred stone quality bracket', s.stoneQualityBracket);
  push('engravingDetails', 'Stamping or engraving details', s.engravingDetails);
  push(
    'changesComparedToReference',
    'Changes compared to reference image',
    s.changesComparedToReference,
  );
  push('budgetPerPiece', 'Budget per piece', s.budgetPerPiece);
  push('quantityRequired', 'Quantity required', s.quantityRequired);
  push('preferredDeliveryTimeline', 'Preferred delivery timeline', s.preferredDeliveryTimeline);
  push('additionalNotes', 'Additional notes for the manufacturer', s.additionalNotes);
  push('confirmSpecs', 'Confirmation of specifications and terms', s.confirmSpecs);

  return buildExtraFieldsPayload(out);
}

function coerceUrlArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof input === 'string') return input.trim() ? [input.trim()] : [];
  return [];
}

function localProjectIdOf(p) {
  return p?.id ?? p?._id ?? null;
}

function isPdfUrl(url) {
  return String(url || '').toLowerCase().split('?')[0].endsWith('.pdf');
}

function isImageUrl(url) {
  const u = String(url || '').toLowerCase().split('?')[0];
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(u);
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function addDays(date, days) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function startOfLocalDay(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
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

function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function clampNumber(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function preferredDeliveryTimelineFromDays(days) {
  const d0 = startOfLocalDay(new Date()) || new Date();
  const d = addDays(d0, clampNumber(days, 20, 90)) || d0;
  return toDateInputValue(d);
}

function preferredDeliveryDaysFromTimeline(timelineValue) {
  const base = startOfLocalDay(new Date());
  const target = parseLocalDateInput(timelineValue);
  if (!base || !target) return 20;
  const diffMs = startOfLocalDay(target)?.getTime() - base.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return clampNumber(diffDays, 20, 90);
}

function dayOrdinalSuffix(day) {
  const d = Number(day);
  if (!Number.isFinite(d)) return '';
  const mod100 = d % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  const mod10 = d % 10;
  if (mod10 === 1) return 'st';
  if (mod10 === 2) return 'nd';
  if (mod10 === 3) return 'rd';
  return 'th';
}

function formatDateWithOrdinal(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day}${dayOrdinalSuffix(day)} ${month}, ${year}`;
}

function formatDateWithOrdinalFromInput(value) {
  const d = parseLocalDateInput(value);
  if (!d) return String(value || '').trim() || '—';
  return formatDateWithOrdinal(d);
}

function pickPreviewUrl(attachments) {
  const list = coerceUrlArray(attachments);
  const img = list.find((u) => isImageUrl(u));
  // Listing cards should show image preview only. If there's no image, show placeholder icon.
  return img || null;
}

function projectStatusCardLabel(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const statusModel = p?.statusModel ?? p?.status_model ?? p?.bidModel?.statusModel ?? p?.bid_model?.status_model ?? null;
  const statusModelKey = String(statusModel?.projectStatus ?? statusModel?.project_status ?? '').trim().toLowerCase();
  const projectStatusRaw = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  const projectStatus = statusModelKey || projectStatusRaw;
  const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;

  // Payment-aware statuses (match Track page / ProjectDetails)
  const finishedLike = isFinishedLike(p);
  const completedLike = Boolean(p?.isFinished) || status === 'finished' || projectStatus === 'completed' || statusModelKey === 'completed';
  if (completedLike) return 'Completed';
  const advancePayment = paymentBlockOf(p, 'advance');
  const finalPayment = paymentBlockOf(p, 'final');
  const adv = normalizePaymentStatus(advancePayment?.status, { finishedLike });
  const fin = normalizePaymentStatus(finalPayment?.status, { finishedLike });

  // If any payment is marked paid, prefer showing payment milestones over bidding labels.
  if (fin === 'paid') return 'Final Paid';
  if (adv === 'paid') return 'Advance Paid';

  if (projectStatus === 'invoice') {
    if (adv === 'due') return 'Invoice (Advance)';
    if (fin === 'due') return 'Invoice (Final)';
    return 'Invoice';
  }

  if (projectStatus === 'paid') {
    if (fin === 'paid') return 'Final Paid';
    if (adv === 'paid') return 'Advance Paid';
    return 'Paid';
  }

  // Rules requested:
  // - status=draft + projectStatus=started => Not Started
  // - status=running + projectStatus=started + latestBidWindowId=null => Not in Project Bid
  // - status=running + projectStatus=started + latestBidWindowId!=null => In Project Bid
  if (status === 'draft' && projectStatus === 'started') return 'Not Started';
  if (status === 'running' && projectStatus === 'started') {
    return latestBidWindowId == null ? 'Not in Project Bid' : 'In Project Bid';
  }

  // If project is running but operational status progressed (in_progress/qc/etc),
  // show the projectStatus instead of just "Running".
  if (status === 'running' && projectStatus && projectStatus !== 'started') {
    return toTitleCase(projectStatus);
  }

  return toTitleCase(status || 'draft');
}

function bidWindowsOf(p) {
  const bidModel = p?.bidModel ?? p?.bid_model ?? null;
  const windows =
    bidModel?.bidWindows ??
    bidModel?.bid_windows ??
    p?.bidWindows ??
    p?.bid_windows ??
    [];
  return Array.isArray(windows) ? windows.filter(Boolean) : windows ? [windows] : [];
}

function isBidWindowActive(w) {
  const active = w?.isActive ?? w?.is_active ?? false;
  if (typeof active === 'boolean') return active;
  return String(active).trim().toLowerCase() === 'true';
}

function bidWindowFinishingAt(w) {
  return (
    w?.finishingTimestamp ??
    w?.finishingAt ??
    w?.finishing_at ??
    w?.finishing_timestamp ??
    null
  );
}

function bidWindowFinishedAt(w) {
  return w?.finishedAt ?? w?.finished_at ?? null;
}

function activeBidWindowOf(p) {
  const windows = bidWindowsOf(p);
  return windows.find((w) => isBidWindowActive(w) && !bidWindowFinishedAt(w)) || null;
}

function latestFinishedBidAtOf(p) {
  const windows = bidWindowsOf(p);
  let best = null;
  for (const w of windows) {
    const ts = bidWindowFinishedAt(w);
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best ? best.toISOString() : null;
}

function allBidWindowsFinished(p) {
  const windows = bidWindowsOf(p);
  if (!windows.length) return false;
  return windows.every((w) => !isBidWindowActive(w) && Boolean(bidWindowFinishedAt(w)));
}

function coerceAssignments(input) {
  const asg = input ?? [];
  return Array.isArray(asg) ? asg.filter(Boolean) : asg ? [asg] : [];
}

function isProjectCompletedLike(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  return Boolean(p?.isFinished) || status === 'finished' || projectStatus === 'completed';
}

function assignmentVendorIdOf(a) {
  return a?.vendorId ?? a?.vendor_id ?? a?.vendor?.id ?? a?.vendor?._id ?? null;
}

function assignmentVendorNameOf(a) {
  const joined = `${a?.vendor?.firstName ?? ''} ${a?.vendor?.lastName ?? ''}`.trim();
  return (
    a?.vendorName ??
    a?.vendor_name ??
    a?.vendor?.fullName ??
    a?.vendor?.name ??
    a?.vendor?.businessName ??
    (joined || null)
  );
}

function primaryAssignmentOf(p) {
  const asg = coerceAssignments(p?.assignments ?? p?.assignmentRequests ?? p?.projectAssignments ?? []);
  const accepted = asg.find((x) => String(x?.status ?? '').trim().toLowerCase() === 'accepted') || null;
  return accepted ?? asg[0] ?? null;
}

function vendorReviewOf(p) {
  return p?.vendorReview ?? p?.vendor_review ?? p?.review ?? p?.vendorReviewModel ?? null;
}

function isPaymentPaid(block) {
  const s = String(block?.status ?? '').trim().toLowerCase();
  return s === 'paid';
}



function isFinishedLike(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  return Boolean(p?.isFinished) || status === 'finished' || projectStatus === 'completed';
}

function normalizePaymentStatus(status, { finishedLike } = {}) {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'not_applicble') return 'not_applicable';
  if (finishedLike && (!s || s === 'not_applicable')) return 'paid';
  return s || '—';
}

function paymentBlockOf(p, type) {
  const t = String(type || '').trim().toLowerCase();
  if (t !== 'advance' && t !== 'final') return null;
  const camel = t === 'advance' ? 'advancePayment' : 'finalPayment';
  const snake = t === 'advance' ? 'advance_payment' : 'final_payment';
  return (
    p?.[camel] ??
    p?.[snake] ??
    p?.payments?.[t] ??
    p?.payments?.[camel] ??
    p?.payments?.[snake] ??
    p?.payment?.[t] ??
    p?.payment?.[camel] ??
    p?.payment_details?.[t] ??
    p?.paymentDetails?.[t] ??
    null
  );
}

function canDeleteProject(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  if (!(status === 'draft' && projectStatus === 'started')) return false;

  const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;
  const windows = bidWindowsOf(p);
  const hasBidWindows = latestBidWindowId != null || (Array.isArray(windows) && windows.length > 0);
  if (hasBidWindows) return false;

  const assignments = coerceAssignments(p?.assignments ?? p?.assignmentRequests ?? p?.projectAssignments ?? []);
  if (assignments.length > 0) return false;

  const advancePayment = paymentBlockOf(p, 'advance');
  const finalPayment = paymentBlockOf(p, 'final');
  if (isPaymentPaid(advancePayment) || isPaymentPaid(finalPayment)) return false;

  return true;
}

function canEditProject(p) {
  // Editing is allowed only for not-started draft projects (same constraints as delete).
  // Once auction/bidding is started (project becomes running or a bid window exists), disable editing.
  return canDeleteProject(p);
}

function sanitizeDigitsInput(raw, { maxLen } = {}) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (typeof maxLen === 'number' && Number.isFinite(maxLen) && maxLen > 0) return digits.slice(0, maxLen);
  return digits;
}

function sanitizeDecimalInput(raw, { maxLen } = {}) {
  const s = String(raw ?? '');
  let out = '';
  let sawDot = false;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if (ch === '.' && !sawDot) {
      sawDot = true;
      out = out ? `${out}.` : '0.';
    }
  }
  if (typeof maxLen === 'number' && Number.isFinite(maxLen) && maxLen > 0) return out.slice(0, maxLen);
  return out;
}

function normalizeJewelleryTypeKey(t) {
  return String(t || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function sizeStandardOptionsForJewelleryType(jewelleryType) {
  const key = normalizeJewelleryTypeKey(jewelleryType);
  if (key === 'bracelet' || key === 'flexibangle') {
    return [
      'Extra Small (14-15 cm)',
      'Small (16-17 cm)',
      'Medium (18-19 cm)',
      'Large (20-21 cm)',
      'Extra Large (22-23 cm)',
    ];
  }
  if (key === 'ring') {
    return [
      'A (37.8 mm)', 'B (39.1 mm)', 'C (40.4 mm)', 'D (41.7 mm)', 'E (42.9 mm)', 'F (44.2 mm)',
      'G (45.5 mm)', 'H (46.8 mm)', 'I (48.0 mm)', 'J (49.3 mm)', 'K (50.6 mm)', 'L (51.9 mm)',
      'M (53.1 mm)', 'N (54.4 mm)', 'O (55.7 mm)', 'P (57.0 mm)', 'Q (58.3 mm)', 'R (59.5 mm)',
      'S (60.8 mm)', 'T (62.1 mm)', 'U (63.4 mm)', 'V (64.6 mm)', 'W (65.9 mm)', 'X (67.2 mm)',
      'Y (68.5 mm)', 'Z (69.7 mm)',
    ];
  }
  if (key === 'necklace' || key === 'pendant') {
    return [
      'Choker (14")',
      'Collarbone (16")',
      'Princess (18")',
      'Matinee (20")',
      'Opera (24")',
      'Rope (30")',
    ];
  }
  // Fallback (existing generic sizes)
  return ['XS', 'S', 'M', 'L', 'XL'];
}

function defaultSizeCustomUnitForJewelleryType(jewelleryType) {
  const key = normalizeJewelleryTypeKey(jewelleryType);
  if (key === 'ring') return 'mm';
  if (key === 'necklace' || key === 'pendant') return 'in';
  return 'cm';
}

function canCancelProject(p) {
  if (!p) return false;
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  if (Boolean(p?.isFinished) || status === 'finished' || projectStatus === 'completed' || projectStatus === 'cancelled') return false;

  // Show Cancel only once bidding window exists (active or ended).
  const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;
  const windows = bidWindowsOf(p);
  const hasBidHistory = Boolean(latestBidWindowId != null) || (Array.isArray(windows) && windows.length > 0);
  if (!hasBidHistory) return false;

  // PRD: Allowed only if no assignment exists and no successful advance/final payments exist.
  const assignments = coerceAssignments(p?.assignments ?? p?.assignmentRequests ?? p?.projectAssignments ?? []);
  // Backend may include assignment history (reassigned/rejected) even when there's no current assignment.
  // Allow cancel as long as there is no active/pending/accepted assignment.
  const hasBlockingAssignment = assignments.some((a) => {
    const s = String(a?.status ?? '').trim().toLowerCase();
    const active = a?.isActive ?? a?.is_active ?? false;
    const isActive = typeof active === 'boolean' ? active : String(active).trim().toLowerCase() === 'true';
    if (isActive) return true;
    if (s !== 'pending' && s !== 'accepted') return false;
    // If this assignment was replaced, it shouldn't block cancel.
    const replacedBy = a?.replacedById ?? a?.replaced_by_id ?? null;
    if (replacedBy != null && replacedBy !== '') return false;
    return true;
  });
  if (hasBlockingAssignment) return false;

  const advancePayment = p?.advancePayment ?? p?.advance_payment ?? null;
  const finalPayment = p?.finalPayment ?? p?.final_payment ?? null;
  if (isPaymentPaid(advancePayment) || isPaymentPaid(finalPayment)) return false;

  return true;
}

export default function Projects() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  const PROJECTS_TAB_KEY = 'mirah_projects_last_tab';
  const PROJECTS_LIST_FILTER_KEY = 'mirah_projects_last_list_filter';

  const RESERVED_META_KEYS = useMemo(
    () =>
      new Set([
        'jewelleryType',
        'jewellery_type',
        'sizeMode',
        'size_mode',
        'sizeStandard',
        'size_standard',
        'sizeCustomValue',
        'size_custom_value',
        'sizeCustomUnit',
        'size_custom_unit',
        'metalType',
        'metal_type',
        'metalPurity',
        'metal_purity',
        'metalColour',
        'metal_colour',
        'twoToneDetails',
        'two_tone_details',
        'metalFinish',
        'metal_finish',
        'stonesIncluded',
        'stones_included',
        'stoneType',
        'stone_type',
        'stoneQualityBracket',
        'stone_quality_bracket',
        'engravingDetails',
        'engraving_details',
        'changesComparedToReference',
        'changes_compared_to_reference',
        'budgetPerPiece',
        'budget_per_piece',
        'quantityRequired',
        'quantity_required',
        'preferredDeliveryTimeline',
        'preferred_delivery_timeline',
        'additionalNotes',
        'additional_notes',
        'confirmSpecs',
        'confirm_specs',
      ]),
    [],
  );

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const createModalOpen = activeTab === 'create';
  const mainTab = createModalOpen ? 'list' : activeTab;

  const urlTab = useMemo(() => {
    try {
      const t = new URLSearchParams(location.search || '').get('tab');
      return String(t || '').trim().toLowerCase() || null;
    } catch {
      return null;
    }
  }, [location.search]);

  useEffect(() => {
    if (!urlTab) return;
    if (urlTab !== 'list' && urlTab !== 'create' && urlTab !== 'assignments') return;
    setActiveTab(urlTab);
  }, [urlTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(PROJECTS_TAB_KEY, String(activeTab || 'list'));
    } catch {
      // ignore
    }
  }, [PROJECTS_TAB_KEY, activeTab]);

  useEffect(() => {
    if (!createModalOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [createModalOpen]);

  const [listLoading, setListLoading] = useState(false);
  const [listMoreLoading, setListMoreLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [listMeta, setListMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [listPage, setListPage] = useState(1);
  const [listSearchDraft, setListSearchDraft] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState('all'); // all | action_required | active | completed | drafts

  const urlListFilter = useMemo(() => {
    try {
      const raw = String(new URLSearchParams(location.search || '').get('filter') || '').trim().toLowerCase();
      if (!raw) return null;
      return ['all', 'action_required', 'active', 'completed', 'drafts'].includes(raw) ? raw : null;
    } catch {
      return null;
    }
  }, [location.search]);

  useEffect(() => {
    if (urlListFilter) {
      setListFilter(urlListFilter);
      try {
        sessionStorage.setItem(PROJECTS_LIST_FILTER_KEY, urlListFilter);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const stored = String(sessionStorage.getItem(PROJECTS_LIST_FILTER_KEY) || '').trim().toLowerCase();
      if (['all', 'action_required', 'active', 'completed', 'drafts'].includes(stored)) {
        setListFilter(stored);
      }
    } catch {
      // ignore
    }
  }, [PROJECTS_LIST_FILTER_KEY, urlListFilter]);

  const setListFilterPersist = useCallback(
    (next) => {
      const n = String(next || '').trim().toLowerCase();
      const normalized = ['all', 'action_required', 'active', 'completed', 'drafts'].includes(n) ? n : 'all';
      setListFilter(normalized);
      try {
        sessionStorage.setItem(PROJECTS_LIST_FILTER_KEY, normalized);
      } catch {
        // ignore
      }
      try {
        const params = new URLSearchParams(location.search || '');
        params.set('tab', 'list');
        params.set('filter', normalized);
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      } catch {
        // ignore
      }
    },
    [PROJECTS_LIST_FILTER_KEY, location.pathname, location.search, navigate],
  );

  const [needsListRefresh, setNeedsListRefresh] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const [actionLoadingById, setActionLoadingById] = useState({});
  const setActionLoading = (id, key, value) => {
    const k = `${id}:${key}`;
    setActionLoadingById((prev) => ({ ...(prev || {}), [k]: value }));
  };
  const isActionLoading = (id, key) => Boolean(actionLoadingById?.[`${id}:${key}`]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState(null); // { id, title }

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelFor, setCancelFor] = useState(null); // { id, title }

  const [vendorReviewOpen, setVendorReviewOpen] = useState(false);
  const [vendorReviewFor, setVendorReviewFor] = useState(null); // { projectId, projectTitle, vendorId, vendorName, hasReview }
  const [vendorReviewDraft, setVendorReviewDraft] = useState({
    rating: 0,
    comment: '',
    isAnonymous: false,
    submitting: false,
  });

  const [assignmentsSearch, setAssignmentsSearch] = useState('');

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    minAmount: '',
    maxAmount: '',
    timelineExpected: '',
    referenceImage: '',
    specs: {
      jewelleryType: '',
      sizeMode: 'standard', // 'standard' | 'custom'
      sizeStandard: '',
      sizeCustomValue: '',
      sizeCustomUnit: 'cm', // 'cm' | 'in'
      metalType: '',
      metalPurity: '',
      metalColour: '',
      twoToneDetails: '',
      metalFinish: '',
      stonesIncluded: 'no', // 'yes' | 'no'
      stoneType: '',
      stoneQualityBracket: '',
      engravingDetails: '',
      changesComparedToReference: '',
      budgetPerPiece: '',
      quantityRequired: '',
      preferredDeliveryDays: 20,
      preferredDeliveryTimeline: preferredDeliveryTimelineFromDays(20),
      additionalNotes: '',
      confirmSpecs: false,
    },
    attachments: [],
    metaFields: [],
  });

  const [createStep, setCreateStep] = useState(1); // 1..4
  const [mobileRefCollapsed, setMobileRefCollapsed] = useState(false);
  const prevRefImageRef = useRef('');
  const stepLabels = useMemo(
    () => [
      { id: 1, label: 'Design' },
      { id: 2, label: 'Specifications' },
      { id: 3, label: 'Details' },
      { id: 4, label: 'Review' },
    ],
    [],
  );

  useEffect(() => {
    if (!createModalOpen) return;
    setMobileRefCollapsed(createStep >= 2);
  }, [createModalOpen, createStep]);

  useEffect(() => {
    if (!createModalOpen) return;
    const next = String(createForm?.referenceImage || '').trim();
    const prev = String(prevRefImageRef.current || '').trim();
    if (prev !== next && createStep >= 2) {
      setMobileRefCollapsed(false);
    }
    prevRefImageRef.current = next;
  }, [createModalOpen, createStep, createForm?.referenceImage]);

  const validateStep = useCallback(
    (step) => {
      const s = createForm?.specs || {};

      if (step === 1) {
        const title = String(createForm?.title || '').trim();
        const referenceImage = String(createForm?.referenceImage || '').trim();

        if (!title) return 'Project title is required';
        if (!referenceImage) return 'Reference image is required';
        if (!isHttpUrl(referenceImage)) return 'Reference image must be a valid http/https URL';

        const jewelleryType = String(s?.jewelleryType || '').trim();
        if (!jewelleryType) return 'Jewellery type is required';

        const sizeMode = String(s?.sizeMode || 'standard').trim().toLowerCase();
        if (sizeMode === 'custom') {
          const v = Number(s?.sizeCustomValue || 0);
          if (!Number.isFinite(v) || v <= 0) return 'Custom measurement is required';
          const unit = String(s?.sizeCustomUnit || '').trim();
          if (!unit) return 'Custom measurement unit is required';
        } else {
          const sizeStandard = String(s?.sizeStandard || '').trim();
          if (!sizeStandard) return 'Size is required';
        }
        return null;
      }

      if (step === 2) {
        const metalType = String(s?.metalType || '').trim();
        if (!metalType) return 'Metal type is required';
        const isGold = metalType.toLowerCase() === 'gold';
        if (isGold) {
          if (!String(s?.metalPurity || '').trim()) return 'Metal purity is required';
          if (!String(s?.metalColour || '').trim()) return 'Metal colour is required';
        }
        if (String(s?.metalColour || '').trim().toLowerCase() === 'two-tone') {
          if (!String(s?.twoToneDetails || '').trim()) return 'Two-tone details are required';
        }
        if (!String(s?.metalFinish || '').trim()) return 'Metal finish is required';

        const stonesIncluded = String(s?.stonesIncluded || 'no').trim().toLowerCase();
        if (stonesIncluded !== 'yes' && stonesIncluded !== 'no') return 'Please select stones included (Yes/No)';
        if (stonesIncluded === 'yes') {
          const stoneType = String(s?.stoneType || '').trim();
          if (!stoneType) return 'Stone type is required';
          if (stoneType.toLowerCase().includes('natural')) {
            if (!String(s?.stoneQualityBracket || '').trim()) return 'Preferred stone quality bracket is required';
          }
        }

        return null;
      }

      if (step === 3) {
        const budgetRaw = String(s?.budgetPerPiece ?? '').trim();
        const budget = Number(budgetRaw || 0);
        const qty = Number(s?.quantityRequired || 0);
        const deliveryDays = Number(s?.preferredDeliveryDays ?? 0);

        if (!budgetRaw) return 'Budget per piece is required';
        if (!Number.isFinite(budget) || budget <= 0) return 'Budget per piece must be greater than 0';
        if (!Number.isFinite(qty) || qty <= 0) return 'Quantity required is required';
        if (!Number.isFinite(deliveryDays) || deliveryDays < 20 || deliveryDays > 90) {
          return 'Preferred delivery timeline must be between 20 and 90 days';
        }
        return null;
      }

      if (step === 4) {
        if (!s?.confirmSpecs) return 'Please confirm specifications and terms';
        return null;
      }

      return null;
    },
    [createForm],
  );

  const [feasibilityLoading, setFeasibilityLoading] = useState(false);
  const [feasibilitySuggestions, setFeasibilitySuggestions] = useState([]);
  const [feasibilityReview, setFeasibilityReview] = useState(null);
  const feasibilityAbortRef = useRef(null);

  const projectApiPayload = useMemo(() => {
    const title = String(createForm?.title || '').trim();
    const description = String(createForm?.description || '').trim();
    const referenceImage = String(createForm?.referenceImage || '').trim();
    const attachments = coerceUrlArray(createForm?.attachments);
    const specsMeta = buildStructuredSpecsPayload(createForm?.specs);
    const meta = buildExtraFieldsPayload([...(extraFieldsToArray(specsMeta) || [])]);

    const budgetPerPieceRaw = String(createForm?.specs?.budgetPerPiece ?? '').trim();
    const budgetPerPiece = Number(budgetPerPieceRaw || 0);

    const minAmountRaw = String(createForm?.minAmount ?? '').trim();
    const maxAmountRaw = String(createForm?.maxAmount ?? '').trim();
    const minAmountParsed = minAmountRaw ? Number(minAmountRaw) : null;
    const maxAmountParsed = maxAmountRaw ? Number(maxAmountRaw) : null;
    const minAmount =
      Number.isFinite(minAmountParsed) && minAmountParsed > 0
        ? minAmountParsed
        : budgetPerPieceRaw && Number.isFinite(budgetPerPiece) && budgetPerPiece > 0
          ? budgetPerPiece
          : null;
    const maxAmount =
      Number.isFinite(maxAmountParsed) && maxAmountParsed > 0
        ? maxAmountParsed
        : budgetPerPieceRaw && Number.isFinite(budgetPerPiece) && budgetPerPiece > 0
          ? budgetPerPiece
          : null;

    const timelineExpectedRaw = String(createForm?.timelineExpected ?? '').trim();
    const preferredDeliveryDays = Number(createForm?.specs?.preferredDeliveryDays ?? 0);
    const timelineExpectedParsed = timelineExpectedRaw ? Number(timelineExpectedRaw) : null;
    const timelineExpected =
      Number.isFinite(timelineExpectedParsed) && timelineExpectedParsed > 0
        ? timelineExpectedParsed
        : Number.isFinite(preferredDeliveryDays) && preferredDeliveryDays > 0
          ? preferredDeliveryDays
          : null;

    const payload = {
      title,
      description,
      referenceImage,
      attachments,
      meta,
    };
    if (minAmount != null) payload.minAmount = minAmount;
    if (maxAmount != null) payload.maxAmount = maxAmount;
    if (timelineExpected != null) payload.timelineExpected = timelineExpected;
    return payload;
  }, [createForm]);

  const [listMyProjectLoading, setListMyProjectLoading] = useState(false);
  const [projectLiveOpen, setProjectLiveOpen] = useState(false);
  const [projectLiveDays, setProjectLiveDays] = useState(null);

  const [forceStopOpen, setForceStopOpen] = useState(false);
  const [forceStopEndWithAutoWinner, setForceStopEndWithAutoWinner] = useState(true);
  const [forceStopFor, setForceStopFor] = useState({ id: null, title: '' });

  const [referenceUploading, setReferenceUploading] = useState(false);
  const [referenceDropActive, setReferenceDropActive] = useState(false);
  const attachmentInputRef = useRef(null);
  const referenceImageInputRef = useRef(null);
  const listAbortRef = useRef(null);
  const listSearchRef = useRef('');
  const listSearchDebounceRef = useRef(null);
  const listSearchDebounceSkipFirstRef = useRef(true);
  const listSearchDebounceSkipAfterClearRef = useRef(false);

  const [howToMeasureOpen, setHowToMeasureOpen] = useState(false);
  const howToMeasureText = useMemo(() => {
    const type = String(createForm?.specs?.jewelleryType || '').trim().toLowerCase();
    if (!type) {
      return 'Select a jewellery type first to see how to measure.';
    }
    if (type === 'ring') {
      return 'Use a ring sizer if you have one. Otherwise, measure the inner diameter of a ring that fits you and match it to standard ring size charts. For custom measurements, enter the circumference or diameter as instructed by your jeweller.';
    }
    if (type === 'necklace') {
      return 'Measure around your neck with a soft measuring tape at the length you prefer. For necklaces, the common lengths are typically 16–24 inches; choose what feels comfortable.';
    }
    if (type === 'bracelet' || type === 'flexi bangle') {
      return 'Wrap a soft measuring tape around your wrist where you’ll wear the bracelet/bangle. Add a little extra space for comfort depending on fit preference.';
    }
    if (type === 'earrings') {
      return 'Earrings are typically not sized like rings/necklaces. If you need a specific drop length, measure from your earlobe to the desired point and enter as custom measurement.';
    }
    if (type === 'pendant') {
      return 'For pendants, sizing is usually based on pendant dimensions. If you need a specific pendant size or chain length, measure the desired length and enter it as custom measurement.';
    }
    return 'Measure using a soft measuring tape and enter your custom measurement in cm or inches.';
  }, [createForm?.specs?.jewelleryType]);

  const loadProjects = useCallback(async ({ nextPage = 1, append = false, search } = {}) => {
    const resolvedSearch = search !== undefined ? search : listSearchRef.current;
    if (listAbortRef.current) listAbortRef.current.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    if (append) setListMoreLoading(true);
    else setListLoading(true);

    try {
      const res = await projectService.list({
        page: nextPage,
        limit: 10,
        search: String(resolvedSearch ?? '').trim() || undefined,
        signal: ctrl.signal,
      });
      const incoming = Array.isArray(res?.items) ? res.items : [];
      setProjects((prev) => {
        if (!append) return incoming;
        const base = Array.isArray(prev) ? prev : [];
        const seen = new Set(base.map((x) => String(localProjectIdOf(x) ?? '')));
        const merged = [...base];
        for (const it of incoming) {
          const key = String(localProjectIdOf(it) ?? '');
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
        return merged;
      });
      setListMeta(res?.meta || { page: nextPage, totalPages: 1, total: null });
      setListPage(nextPage);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load projects', 'error');
      if (!append) setProjects([]);
    } finally {
      if (append) setListMoreLoading(false);
      else setListLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    listSearchRef.current = listSearch;
  }, [listSearch]);

  // Debounced search (same pattern as Shop listing; skip first run — initial load handled separately)
  useEffect(() => {
    if (listSearchDebounceSkipFirstRef.current) {
      listSearchDebounceSkipFirstRef.current = false;
      return;
    }
    if (listSearchDebounceSkipAfterClearRef.current) {
      listSearchDebounceSkipAfterClearRef.current = false;
      return;
    }
    if (listSearchDebounceRef.current) clearTimeout(listSearchDebounceRef.current);
    const draft = listSearchDraft;
    listSearchDebounceRef.current = setTimeout(() => {
      const q = String(draft || '').trim();
      setListSearch(q);
      void loadProjects({ nextPage: 1, append: false, search: q });
    }, 250);
    return () => {
      if (listSearchDebounceRef.current) clearTimeout(listSearchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listSearchDraft]);

  useEffect(() => {
    void loadProjects({ nextPage: 1, append: false, search: String(listSearchDraft || '').trim() });
    return () => {
      if (listAbortRef.current) listAbortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== 'list') return;
    if (!needsListRefresh) return;
    setNeedsListRefresh(false);
    loadProjects({ nextPage: 1, append: false });
  }, [activeTab, loadProjects, needsListRefresh]);

  const InfoBox = ({ label, value, tone = 'default' }) => {
    const toneClass =
      tone === 'danger'
        ? 'bg-red-50 border-red-100 text-red-700'
        : tone === 'warn'
          ? 'bg-yellow-50 border-yellow-100 text-yellow-700'
          : 'bg-cream border-pale text-mid';
    return (
      <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-[12px] font-semibold mt-0.5 truncate">{value}</p>
      </div>
    );
  };

  const startCreateNew = () => {
    if (feasibilityAbortRef.current) {
      try {
        feasibilityAbortRef.current.abort();
      } catch {
        // ignore
      }
    }
    setFeasibilityLoading(false);
    setFeasibilitySuggestions([]);
    setFeasibilityReview(null);
    setEditingId(null);
    setCreateStep(1);
    setCreateForm({
      title: '',
      description: '',
      minAmount: '',
      maxAmount: '',
      timelineExpected: '',
      referenceImage: '',
      specs: {
        jewelleryType: '',
        sizeMode: 'standard',
        sizeStandard: '',
        sizeCustomValue: '',
        sizeCustomUnit: 'cm',
        metalType: '',
        metalPurity: '',
        metalColour: '',
        twoToneDetails: '',
        metalFinish: '',
        stonesIncluded: 'no',
        stoneType: '',
        stoneQualityBracket: '',
        engravingDetails: '',
        changesComparedToReference: '',
        budgetPerPiece: '',
        quantityRequired: '',
        preferredDeliveryDays: 20,
        preferredDeliveryTimeline: preferredDeliveryTimelineFromDays(20),
        additionalNotes: '',
        confirmSpecs: false,
      },
      attachments: [],
      metaFields: [],
    });
    setActiveTab('create');
    navigate('/customer/projects?tab=create');
  };

  const startEdit = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    if (!canEditProject(p)) {
      addToast('Editing is disabled once auction/bidding has started.', 'error');
      return;
    }
    setEditingId(id);
    setFeasibilitySuggestions([]);
    setFeasibilityReview(null);
    setCreateStep(1);
    const metaRowsAll = extraFieldsToArray(p?.meta);
    const metaIndex = new Map(metaRowsAll.map((r) => [String(r?.key || '').trim(), String(r?.value ?? '').trim()]));
    const pickMeta = (...keys) => {
      for (const k of keys) {
        const key = String(k || '').trim();
        if (!key) continue;
        if (metaIndex.has(key)) return metaIndex.get(key);
      }
      return '';
    };
    setCreateForm({
      title: String(p?.title ?? ''),
      description: String(p?.description ?? ''),
      minAmount: String(p?.amountRange?.min ?? p?.amount_range?.min ?? p?.minAmount ?? p?.min_amount ?? ''),
      maxAmount: String(p?.amountRange?.max ?? p?.amount_range?.max ?? p?.maxAmount ?? p?.max_amount ?? ''),
      timelineExpected: String(p?.timelineExpected ?? p?.timeline_expected ?? ''),
      referenceImage: String(p?.referenceImage ?? p?.reference_image ?? ''),
      attachments: coerceUrlArray(p?.attachments),
      specs: {
        jewelleryType: pickMeta('jewelleryType', 'jewellery_type'),
        sizeMode: pickMeta('sizeMode', 'size_mode') || 'standard',
        sizeStandard: pickMeta('sizeStandard', 'size_standard'),
        sizeCustomValue: sanitizeDigitsInput(pickMeta('sizeCustomValue', 'size_custom_value'), { maxLen: 10 }),
        sizeCustomUnit: pickMeta('sizeCustomUnit', 'size_custom_unit') || defaultSizeCustomUnitForJewelleryType(pickMeta('jewelleryType', 'jewellery_type')),
        metalType: pickMeta('metalType', 'metal_type'),
        metalPurity: pickMeta('metalPurity', 'metal_purity'),
        metalColour: pickMeta('metalColour', 'metal_colour'),
        twoToneDetails: pickMeta('twoToneDetails', 'two_tone_details'),
        metalFinish: pickMeta('metalFinish', 'metal_finish'),
        stonesIncluded: pickMeta('stonesIncluded', 'stones_included') || 'no',
        stoneType: pickMeta('stoneType', 'stone_type'),
        stoneQualityBracket: pickMeta('stoneQualityBracket', 'stone_quality_bracket'),
        engravingDetails: pickMeta('engravingDetails', 'engraving_details'),
        changesComparedToReference: pickMeta('changesComparedToReference', 'changes_compared_to_reference'),
        budgetPerPiece: sanitizeDecimalInput(pickMeta('budgetPerPiece', 'budget_per_piece'), { maxLen: 16 }),
        quantityRequired: sanitizeDigitsInput(pickMeta('quantityRequired', 'quantity_required'), { maxLen: 6 }),
        preferredDeliveryDays: preferredDeliveryDaysFromTimeline(pickMeta('preferredDeliveryTimeline', 'preferred_delivery_timeline')),
        preferredDeliveryTimeline: preferredDeliveryTimelineFromDays(
          preferredDeliveryDaysFromTimeline(pickMeta('preferredDeliveryTimeline', 'preferred_delivery_timeline'))
        ),
        additionalNotes: pickMeta('additionalNotes', 'additional_notes'),
        confirmSpecs:
          String(pickMeta('confirmSpecs', 'confirm_specs') || '')
            .trim()
            .toLowerCase() === 'true',
      },
      metaFields: [],
    });
    setActiveTab('create');
    navigate('/customer/projects?tab=create');
  };

  const closeCreateModal = ({ refreshList = true } = {}) => {
    if (createLoading || attachmentUploading || referenceUploading) return;
    const shouldRefresh = refreshList && Boolean(editingId);
    if (feasibilityAbortRef.current) {
      try {
        feasibilityAbortRef.current.abort();
      } catch {
        // ignore
      }
    }
    setFeasibilityLoading(false);
    setFeasibilitySuggestions([]);
    setFeasibilityReview(null);
    if (shouldRefresh) setNeedsListRefresh(true);
    setEditingId(null);
    setCreateStep(1);
    setCreateForm({
      title: '',
      description: '',
      minAmount: '',
      maxAmount: '',
      timelineExpected: '',
      referenceImage: '',
      specs: {
        jewelleryType: '',
        sizeMode: 'standard',
        sizeStandard: '',
        sizeCustomValue: '',
        sizeCustomUnit: 'cm',
        metalType: '',
        metalPurity: '',
        metalColour: '',
        twoToneDetails: '',
        metalFinish: '',
        stonesIncluded: 'no',
        stoneType: '',
        stoneQualityBracket: '',
        engravingDetails: '',
        changesComparedToReference: '',
        budgetPerPiece: '',
        quantityRequired: '',
        preferredDeliveryDays: 20,
        preferredDeliveryTimeline: preferredDeliveryTimelineFromDays(20),
        additionalNotes: '',
        confirmSpecs: false,
      },
      attachments: [],
      metaFields: [],
    });
    setActiveTab('list');
    navigate('/customer/projects?tab=list');
  };

  const handleUploadAttachments = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setAttachmentUploading(true);
    try {
      const valid = list.filter((f) => {
        const t = String(f?.type || '').toLowerCase();
        return t.startsWith('image/') || t === 'application/pdf';
      });
      if (!valid.length) {
        addToast('Only images and PDFs are allowed', 'error');
        return;
      }
      const res = await projectService.uploadAttachments(valid);
      const urls = Array.isArray(res?.urls) ? res.urls : [];
      if (!urls.length) {
        addToast('Upload succeeded but no URL returned.', 'error');
        return;
      }
      setCreateForm((prev) => ({ ...prev, attachments: [...coerceUrlArray(prev?.attachments), ...urls] }));
      addToast(urls.length > 1 ? 'Files uploaded' : 'File uploaded', 'success');
    } catch (e) {
      addToast(e?.message || 'Upload failed', 'error');
    } finally {
      setAttachmentUploading(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const handleUploadReferenceImage = async (file) => {
    const f = file || null;
    if (!f) return;
    const t = String(f?.type || '').toLowerCase();
    if (!t.startsWith('image/')) {
      addToast('Only images are allowed for reference image', 'error');
      return;
    }
    setReferenceUploading(true);
    try {
      const res = await projectService.uploadAttachments([f]);
      const url = Array.isArray(res?.urls) ? res.urls[0] : null;
      if (!url) {
        addToast('Upload succeeded but no URL returned.', 'error');
        return;
      }
      setCreateForm((prev) => ({ ...prev, referenceImage: String(url || '') }));
      addToast('Reference image uploaded', 'success');
    } catch (e) {
      addToast(e?.message || 'Upload failed', 'error');
    } finally {
      setReferenceUploading(false);
      if (referenceImageInputRef.current) referenceImageInputRef.current.value = '';
    }
  };

  const openReferenceFilePicker = () => {
    if (referenceUploading) return;
    referenceImageInputRef.current?.click();
  };

  const onReferenceDropZoneDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!referenceUploading) setReferenceDropActive(true);
  };

  const onReferenceDropZoneDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setReferenceDropActive(false);
  };

  const onReferenceDropZoneDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setReferenceDropActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleUploadReferenceImage(f);
  };

  const persistProject = async ({ validateUpToStep = 1, silent = true } = {}) => {
    const maxStep = Math.max(1, Math.min(4, Number(validateUpToStep || 1)));
    const err1 = maxStep >= 1 ? validateStep(1) : null;
    const err2 = err1 ? null : maxStep >= 2 ? validateStep(2) : null;
    const err3 = err1 || err2 ? null : maxStep >= 3 ? validateStep(3) : null;
    const err4 = err1 || err2 || err3 ? null : maxStep >= 4 ? validateStep(4) : null;
    const err = err1 || err2 || err3 || err4;
    if (err) {
      addToast(err, 'error');
      setCreateStep(err1 ? 1 : err2 ? 2 : err3 ? 3 : 4);
      return null;
    }

    if (createLoading) return null;
    setCreateLoading(true);
    try {
      const payload = projectApiPayload;
      let saved = null;
      if (editingId) {
        saved = await projectService.update(editingId, payload);
      } else {
        saved = await projectService.create(payload);
        const newId = localProjectIdOf(saved);
        if (newId) setEditingId(newId);
      }
      if (!silent) addToast(editingId ? 'Project updated.' : 'Project created.', 'success');
      return saved;
    } catch (e) {
      addToast(e?.message || 'Failed to save project', 'error');
      return null;
    } finally {
      setCreateLoading(false);
    }
  };

  const persistAndAdvance = async (fromStep) => {
    const step = Math.max(1, Math.min(3, Number(fromStep || createStep || 1)));
    const saved = await persistProject({ validateUpToStep: step, silent: true });
    if (!saved) return;
    setCreateStep((s) => Math.min(4, Number(s || step) + 1));
  };

  const prepareReviewStep = async () => {
    if (feasibilityLoading || createLoading) return;
    const saved = await persistProject({ validateUpToStep: 3, silent: true });
    if (!saved) return;

    if (feasibilityAbortRef.current) {
      try {
        feasibilityAbortRef.current.abort();
      } catch {
        // ignore
      }
    }
    const controller = new AbortController();
    feasibilityAbortRef.current = controller;

    setFeasibilityLoading(true);
    let shouldAdvance = true;
    try {
      const data = await projectService.reviewFeasibility(projectApiPayload, { signal: controller.signal });
      setFeasibilityReview(data || null);
      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setFeasibilitySuggestions(suggestions.filter((x) => String(x || '').trim()));
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
        shouldAdvance = false;
      } else {
        setFeasibilityReview(null);
        setFeasibilitySuggestions([]);
      }
    } finally {
      setFeasibilityLoading(false);
      if (shouldAdvance) setCreateStep(4);
    }
  };

  const listMyProject = async () => {
    if (listMyProjectLoading) return;
    setListMyProjectLoading(true);
    try {
      setProjectLiveDays(null);
      const saved = await persistProject({ validateUpToStep: 4, silent: true });
      if (!saved) return;
      const id = localProjectIdOf(saved) || editingId;
      if (!id) return;

      setActionLoading(id, 'startBid', true);
      try {
        await projectService.startBid(id);
      } catch (e) {
        addToast(e?.message || 'Failed to list project', 'error');
        return;
      } finally {
        setActionLoading(id, 'startBid', false);
      }

      try {
        const days = await projectService.getBidCloseDuration();
        setProjectLiveDays(days);
      } catch {
        setProjectLiveDays(null);
      }
      setProjectLiveOpen(true);
      closeCreateModal({ refreshList: false });
      await loadProjects({ nextPage: 1, append: false });
    } finally {
      setListMyProjectLoading(false);
    }
  };

  const openDelete = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    if (!canDeleteProject(p)) {
      addToast('Only not-started draft projects can be deleted.', 'error');
      return;
    }
    setDeleteFor({ id, title: String(p?.title ?? 'Project') });
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    const id = deleteFor?.id;
    if (!id) return;
    const p = (projects || []).find((x) => String(localProjectIdOf(x) ?? '') === String(id));
    if (p && !canDeleteProject(p)) {
      addToast('This project can no longer be deleted.', 'error');
      setDeleteOpen(false);
      setDeleteFor(null);
      return;
    }
    setActionLoading(id, 'delete', true);
    try {
      await projectService.delete(id);
      addToast('Project deleted.', 'success');
      await loadProjects({ nextPage: 1, append: false });
      setDeleteOpen(false);
      setDeleteFor(null);
    } catch (e) {
      addToast(e?.message || 'Failed to delete project', 'error');
    } finally {
      setActionLoading(id, 'delete', false);
    }
  };

  const openCancel = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    if (!canCancelProject(p)) {
      addToast('This project cannot be cancelled.', 'error');
      return;
    }
    setCancelFor({ id, title: String(p?.title ?? 'Project') });
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    const id = cancelFor?.id;
    if (!id) return;
    const p = (projects || []).find((x) => String(localProjectIdOf(x) ?? '') === String(id));
    if (p && !canCancelProject(p)) {
      addToast('This project can no longer be cancelled.', 'error');
      setCancelOpen(false);
      setCancelFor(null);
      return;
    }
    setActionLoading(id, 'cancel', true);
    try {
      await projectService.cancel(id);
      addToast('Project cancelled.', 'success');
      await loadProjects({ nextPage: 1, append: false });
      setCancelOpen(false);
      setCancelFor(null);
    } catch (e) {
      addToast(e?.message || 'Failed to cancel project', 'error');
    } finally {
      setActionLoading(id, 'cancel', false);
    }
  };

  const refreshList = useCallback(async () => {
    await loadProjects({ nextPage: 1, append: false });
  }, [loadProjects]);

  // When leaving the create tab, reset edit state so returning to create shows a fresh form
  useEffect(() => {
    if (activeTab !== 'create') {
      setEditingId(null);
      setCreateStep(1);
      setCreateForm({
        title: '',
        description: '',
        minAmount: '',
        maxAmount: '',
        timelineExpected: '',
        referenceImage: '',
        specs: {
          jewelleryType: '',
          sizeMode: 'standard',
          sizeStandard: '',
          sizeCustomValue: '',
          sizeCustomUnit: 'cm',
          metalType: '',
          metalPurity: '',
          metalColour: '',
          twoToneDetails: '',
          metalFinish: '',
          stonesIncluded: 'no',
          stoneType: '',
          stoneQualityBracket: '',
          engravingDetails: '',
          changesComparedToReference: '',
          budgetPerPiece: '',
          quantityRequired: '',
          preferredDeliveryTimeline: '',
          additionalNotes: '',
          confirmSpecs: false,
        },
        attachments: [],
        metaFields: [],
      });
    }
  }, [activeTab]);

  const openForceStop = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    setForceStopFor({ id, title: String(p?.title ?? '') });
    setForceStopEndWithAutoWinner(true);
    setForceStopOpen(true);
  };

  const confirmForceStop = async () => {
    const id = forceStopFor?.id;
    if (!id) return;
    setActionLoading(id, 'forceStop', true);
    try {
      await projectService.manualEndBid(id, { endWithAutoWinner: forceStopEndWithAutoWinner });
      addToast('Auction stopped.', 'success');
      setForceStopOpen(false);
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to stop auction', 'error');
    } finally {
      setActionLoading(id, 'forceStop', false);
    }
  };

  const goToBids = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    try {
      sessionStorage.setItem(PROJECTS_TAB_KEY, 'list');
      sessionStorage.setItem(PROJECTS_LIST_FILTER_KEY, String(listFilter || 'all'));
    } catch {
      // ignore
    }
    navigate(`/customer/projects/${id}/bids`, {
      state: { projectTitle: p?.title ?? '', fromProjectsTab: 'list', fromListFilter: listFilter || 'all' },
    });
  };

  const openVendorReview = (p) => {
    const pid = localProjectIdOf(p);
    if (!pid) return;
    if (!isProjectCompletedLike(p)) {
      addToast('Jeweller can be reviewed only after project is completed.', 'error');
      return;
    }
    const existing = vendorReviewOf(p);
    const hasReview = Boolean(p?.hasVendorReview) || Boolean(existing);
    const a = primaryAssignmentOf(p);
    const vendorId = assignmentVendorIdOf(a) ?? existing?.vendorId ?? existing?.vendor_id ?? existing?.vendor?.id ?? null;
    const vendorName = assignmentVendorNameOf(a) || 'Jeweller';
    if (!vendorId) {
      addToast('No Jeweller assignment found for this project.', 'error');
      return;
    }
    setVendorReviewFor({ projectId: pid, projectTitle: String(p?.title ?? 'Project'), vendorId, vendorName, hasReview });
    setVendorReviewDraft({
      rating: Number(existing?.rating ?? existing?.stars ?? 0) || 0,
      comment: String(existing?.comment ?? existing?.message ?? ''),
      isAnonymous: Boolean(existing?.isAnonymous),
      submitting: false,
    });
    setVendorReviewOpen(true);
  };

  const goToTrack = (id) => {
    if (!id) return;
    try {
      sessionStorage.setItem(PROJECTS_TAB_KEY, 'list');
      sessionStorage.setItem(PROJECTS_LIST_FILTER_KEY, String(listFilter || 'all'));
    } catch {
      // ignore
    }
    navigate(`/customer/projects/${id}`, { state: { fromProjectsTab: 'list', fromListFilter: listFilter || 'all' } });
  };

  const closeVendorReview = () => {
    if (vendorReviewDraft?.submitting) return;
    setVendorReviewOpen(false);
    setVendorReviewFor(null);
  };

  const submitVendorReview = async () => {
    const projectId = vendorReviewFor?.projectId;
    const vendorId = vendorReviewFor?.vendorId;
    const rating = Number(vendorReviewDraft?.rating || 0);
    const comment = String(vendorReviewDraft?.comment ?? '').trim();
    const isAnonymous = Boolean(vendorReviewDraft?.isAnonymous);

    if (!projectId || !vendorId) return;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      addToast('Please select a rating (1–5).', 'error');
      return;
    }

    setVendorReviewDraft((d) => ({ ...(d || {}), submitting: true }));
    try {
      await vendorService.submitVendorReview({ projectId, vendorId, rating, comment, isAnonymous });
      addToast(vendorReviewFor?.hasReview ? 'Review updated.' : 'Review submitted.', 'success');
      setVendorReviewOpen(false);
      setVendorReviewFor(null);
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to submit review', 'error');
    } finally {
      setVendorReviewDraft((d) => ({ ...(d || {}), submitting: false }));
    }
  };

  const canLoadMore = listPage < Number(listMeta?.totalPages || 1);
  const empty = !listLoading && (projects || []).length === 0;

  const projectCategories = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const out = { all: list, actionRequired: [], active: [], completed: [], drafts: [] };

    for (const p of list) {
      const statusKey = String(p?.status ?? '').trim().toLowerCase();
      const projectStatusKey = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
      const windows = bidWindowsOf(p);
      const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;
      const hasBidHistory = Boolean(latestBidWindowId != null) || (Array.isArray(windows) && windows.length > 0);
      const activeWindow = activeBidWindowOf(p);
      const biddingRunning = Boolean(activeWindow);
      const allWindowsFinished = allBidWindowsFinished(p);

      const isDraft =
        statusKey === 'draft' &&
        projectStatusKey === 'started' &&
        !hasBidHistory;
      const isActive =
        statusKey === 'running' &&
        projectStatusKey === 'started' &&
        biddingRunning;
      const isCompleted =
        projectStatusKey === 'cancelled' ||
        statusKey === 'cancelled' ||
        statusKey === 'canceled' ||
        isProjectCompletedLike(p) ||
        (statusKey === 'running' && projectStatusKey === 'started' && allWindowsFinished && !hasBidHistory);
      const isActionRequired =
        !isDraft &&
        !isActive &&
        !isCompleted &&
        (
          statusKey === 'running' ||
          projectStatusKey === 'invoice' ||
          (statusKey === 'running' && projectStatusKey === 'started' && allWindowsFinished && hasBidHistory)
        );

      if (isDraft) out.drafts.push(p);
      if (isActive) out.active.push(p);
      if (isCompleted) out.completed.push(p);
      if (isActionRequired) out.actionRequired.push(p);
    }

    return out;
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (listFilter === 'action_required') return projectCategories.actionRequired;
    if (listFilter === 'active') return projectCategories.active;
    if (listFilter === 'completed') return projectCategories.completed;
    if (listFilter === 'drafts') return projectCategories.drafts;
    return projectCategories.all;
  }, [listFilter, projectCategories]);

  const filterEmpty = !listLoading && (projects || []).length > 0 && (visibleProjects || []).length === 0;

  const assignmentRows = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const rows = [];
    for (const p of list) {
      const pid = localProjectIdOf(p);
      const asg = p?.assignments ?? p?.assignmentRequests ?? p?.projectAssignments ?? [];
      const arr = Array.isArray(asg) ? asg : asg ? [asg] : [];
      for (const a of arr) {
        rows.push({ project: p, projectId: pid, assignment: a });
      }
    }
    // Latest first
    rows.sort((ra, rb) => {
      const a = ra?.assignment ?? null;
      const b = rb?.assignment ?? null;
      const ta =
        new Date(
          a?.createdAt ?? a?.created_at ?? a?.assignedAt ?? a?.assigned_at ?? a?.updatedAt ?? a?.updated_at ?? 0,
        ).getTime() || 0;
      const tb =
        new Date(
          b?.createdAt ?? b?.created_at ?? b?.assignedAt ?? b?.assigned_at ?? b?.updatedAt ?? b?.updated_at ?? 0,
        ).getTime() || 0;
      return tb - ta;
    });
    return rows;
  }, [projects]);

  const filteredAssignmentRows = useMemo(() => {
    const q = String(assignmentsSearch || '').trim().toLowerCase();
    if (!q) return assignmentRows;
    return (Array.isArray(assignmentRows) ? assignmentRows : []).filter((row) => {
      const p = row?.project || {};
      const a = row?.assignment || {};
      const title = String(p?.title ?? '').trim().toLowerCase();
      const vendorJoined = `${a?.vendor?.firstName ?? ''} ${a?.vendor?.lastName ?? ''}`.trim();
      const vendorName =
        a?.vendorName ??
        a?.vendor_name ??
        a?.vendor?.fullName ??
        (vendorJoined || null);
      const vendorLabel = String(vendorName || '').trim().toLowerCase();
      return title.includes(q) || vendorLabel.includes(q);
    });
  }, [assignmentRows, assignmentsSearch]);



  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col pb-0 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      <div className="flex min-h-0 flex-1 flex-col w-full">
            {mainTab === 'list' ? (
              <>
                <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 border-b border-pale/60">
                  <div className="flex min-w-0 flex-col gap-3 pb-0.5 md:flex-row md:items-center md:justify-between md:gap-4 md:pb-0.5 md:overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 md:w-[420px] md:max-w-[55vw] md:shrink-0">
                      <div className="relative min-w-0 flex-1">
                        <input
                          type="text"
                          value={listSearchDraft}
                          onChange={(e) => setListSearchDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            if (listSearchDebounceRef.current) clearTimeout(listSearchDebounceRef.current);
                            const next = String(listSearchDraft || '').trim();
                            setListSearch(next);
                            void loadProjects({ nextPage: 1, append: false, search: next });
                          }}
                          placeholder="Search by title…"
                          className="input-search-quiet-focus w-full rounded-2xl border border-pale bg-white py-2.5 pl-9 pr-2 text-[12px] font-medium text-ink placeholder:text-muted focus:outline-none md:py-3 md:pl-11 md:pr-4 md:text-[13px] md:focus:border-walnut"
                          aria-label="Search by title"
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
                      {String(listSearch || '').trim() && !listLoading ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (listSearchDebounceRef.current) clearTimeout(listSearchDebounceRef.current);
                            listSearchDebounceSkipAfterClearRef.current = true;
                            const next = '';
                            setListSearchDraft(next);
                            setListSearch(next);
                            await loadProjects({ nextPage: 1, append: false, search: next });
                          }}
                          disabled={listLoading}
                          className="shrink-0 whitespace-nowrap px-0.5 py-1 text-[11px] md:text-[12px] font-semibold text-mid underline underline-offset-2 decoration-mid/80 hover:text-ink disabled:opacity-50"
                        >
                          Clear Search
                        </button>
                      ) : null}
                    </div>
                    <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 border-t border-pale/70 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-2 md:flex-1 md:min-w-0 md:justify-end md:border-0 md:pt-0">
                      <div className="order-3 flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:order-1 md:min-w-0 md:flex-initial md:max-w-full md:gap-2">
                        {[
                          { id: 'all', label: 'All', count: null },
                          { id: 'action_required', label: 'Action Required', count: projectCategories.actionRequired.length },
                          { id: 'active', label: 'Active', count: null },
                          { id: 'completed', label: 'Completed', count: null },
                          { id: 'drafts', label: 'Drafts', count: null },
                        ].map((t) => {
                          const active = listFilter === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setListFilterPersist(t.id)}
                              className={`shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-[10px] font-semibold transition-colors md:min-h-[2.25rem] md:gap-2 md:px-5 md:py-3 md:text-[12px] ${
                                active
                                  ? 'border-walnut bg-walnut/10 font-bold text-ink'
                                  : 'border-pale bg-white text-mid hover:bg-cream hover:text-ink'
                              }`}
                            >
                              <span className="whitespace-nowrap">{t.label}</span>
                              {typeof t.count === 'number' ? (
                                <span
                                  className={`min-w-[14px] h-[12px] px-0.5 rounded-full text-[8px] font-extrabold flex items-center justify-center md:min-h-[1.25rem] md:min-w-[22px] md:h-auto md:px-1.5 md:text-[11px] ${
                                    active ? 'bg-walnut text-blush' : 'bg-blush text-mid'
                                  }`}
                                >
                                  {t.count}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <span
                        className="order-2 shrink-0 text-[11px] font-light text-muted/90 select-none md:text-[13px]"
                        aria-hidden="true"
                      >
                        |
                      </span>
                      <button
                        type="button"
                        onClick={startCreateNew}
                        className="order-1 shrink-0 inline-flex items-center justify-center rounded-xl bg-walnut px-1.5 py-1.5 text-[10px] font-bold text-blush whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer md:order-3 md:min-h-[2.25rem] md:px-5 md:py-3 md:text-[12px]"
                      >
                        Create Project
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-4 flex min-h-0 flex-1 flex-col ${
                    !listLoading && !empty && !filterEmpty && visibleProjects.length > 0 ? 'justify-between gap-4' : ''
                  }`}
                >
                {listLoading ? (
                  <div
                    className="flex min-h-[min(420px,calc(100vh-260px))] flex-1 flex-col items-center justify-center px-4 py-12"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    aria-label="Loading projects"
                  >
                    <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : empty ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center px-4">
                    <div className="text-center">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <path d="M14 2v6h6" />
                          <path d="M8 13h8" />
                          <path d="M8 17h8" />
                        </svg>
                      </div>
                      <p className="mt-3 text-[14px] font-bold text-ink">No projects yet</p>
                      <p className="mt-1 text-[12px] text-muted">Create your first project to start bidding.</p>
                    </div>
                  </div>
                ) : filterEmpty ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-mid">No projects found for this filter.</p>
                    {canLoadMore ? (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => loadProjects({ nextPage: listPage + 1, append: true })}
                          disabled={listMoreLoading}
                          className="px-10 py-3 rounded-2xl border border-pale bg-white text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                        >
                          {listMoreLoading ? 'Loading…' : 'Load more'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleProjects.map((p) => {
                      const id = localProjectIdOf(p);
                      const attachments = coerceUrlArray(p?.attachments);
                      const referenceImageRaw = String(p?.referenceImage ?? p?.reference_image ?? '').trim();
                      const preview =
                        referenceImageRaw && isHttpUrl(referenceImageRaw)
                          ? referenceImageRaw
                          : pickPreviewUrl(attachments);
                      const statusKey = String(p?.status ?? '').trim().toLowerCase();
                      const projectStatusKey = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
                      const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;
                      const windows = bidWindowsOf(p);
                      const activeWindow = activeBidWindowOf(p);
                      const biddingRunning = Boolean(activeWindow);
                      const biddingEndsAt = activeWindow ? bidWindowFinishingAt(activeWindow) : null;
                      const allWindowsFinished = allBidWindowsFinished(p);
                      const latestFinishedAt = latestFinishedBidAtOf(p);
                      const hasBidHistory = Boolean(latestBidWindowId != null) || windows.length > 0;
                      const runningStarted = statusKey === 'running' && projectStatusKey === 'started';
                      const statusLabel = projectStatusCardLabel(p);
                      const statusCardValue =
                        runningStarted &&
                        hasBidHistory &&
                        allWindowsFinished &&
                        (statusLabel === 'In Project Bid' || statusLabel === 'Not in Project Bid')
                          ? 'Bid Ended'
                          : statusLabel;
                      const metaRowsAll = extraFieldsToArray(p?.meta);
                      const metaIndex = new Map(metaRowsAll.map((r) => [String(r?.key || '').trim(), String(r?.value ?? '').trim()]));
                      const pickMeta = (...keys) => {
                        for (const k of keys) {
                          const key = String(k || '').trim();
                          if (!key) continue;
                          if (metaIndex.has(key)) return metaIndex.get(key);
                        }
                        return '';
                      };
                      const budgetPerPieceRaw = pickMeta('budgetPerPiece', 'budget_per_piece');
                      const budgetPerPiece = Number(String(budgetPerPieceRaw || '').trim() || 0);
                      const quantityRequired = String(pickMeta('quantityRequired', 'quantity_required') || '').trim();
                      const preferredDeliveryTimeline = String(pickMeta('preferredDeliveryTimeline', 'preferred_delivery_timeline') || '').trim();
                      const completedLike = isProjectCompletedLike(p);
                      const existingReview = vendorReviewOf(p);
                      const hasVendorReview = Boolean(p?.hasVendorReview) || Boolean(existingReview);
                      const primaryAssignment = primaryAssignmentOf(p);
                      const assignmentStatusKey = String(primaryAssignment?.status ?? '').trim().toLowerCase();
                      const canTrack = assignmentStatusKey === 'accepted' && Boolean(id);
                      const reviewVendorId =
                        assignmentVendorIdOf(primaryAssignment) ??
                        existingReview?.vendorId ??
                        existingReview?.vendor_id ??
                        null;
                      return (
                        <div
                          key={String(id ?? Math.random())}
                          className="rounded-2xl border border-pale bg-white overflow-hidden"
                        >
                          <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-[220px] h-[180px] md:h-[180px] bg-white border-b md:border-b-0 md:border-r border-pale overflow-hidden shrink-0 flex items-center justify-center">
                              {preview && isImageUrl(preview) ? (
                                <SafeImage
                                  src={preview}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-contain p-2"
                                />
                              ) : preview && isPdfUrl(preview) ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-red-400">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="26"
                                    height="26"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <path d="M14 2v6h6" />
                                    <path d="M8 13h8" />
                                    <path d="M8 17h8" />
                                  </svg>
                                  <div className="mt-2 text-[11px] font-bold">PDF</div>
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <path d="M21 15l-5-5L5 21" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 p-4 md:p-5">
                              <p className="text-[18px] md:text-[22px] font-bold text-ink truncate">
                                {p?.title || 'Project'}
                              </p>

                              {runningStarted && (biddingRunning || allWindowsFinished) ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {biddingRunning ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-100 text-amber-700">
                                      {biddingEndsAt
                                        ? `Bidding ends: ${formatDateTime(biddingEndsAt)}`
                                        : 'Bidding running'}
                                    </span>
                                  ) : allWindowsFinished ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-cream border-pale text-mid">
                                      {latestFinishedAt
                                        ? `Last bidding ended: ${formatDateTime(latestFinishedAt)}`
                                        : 'Bidding ended'}
                                    </span>
                                  ) : null}
                                  {hasBidHistory ? (
                                    <span className="text-[11px] text-muted">
                                      Winner auto-assign happens when auction ends.
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                <InfoBox
                                  label="Budget"
                                  value={
                                    budgetPerPieceRaw && Number.isFinite(budgetPerPiece) && budgetPerPiece > 0
                                      ? `₹ ${formatMoney(budgetPerPiece)}`
                                      : '—'
                                  }
                                />
                                <InfoBox label="Quantity" value={quantityRequired || '—'} />
                                <InfoBox
                                  label="Expected delivery"
                                  value={preferredDeliveryTimeline ? formatDateOnlyFromInput(preferredDeliveryTimeline) : '—'}
                                />
                                <InfoBox label="Status" value={statusCardValue} />
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 md:justify-end">
                                {completedLike && reviewVendorId != null ? (
                                  <button
                                    type="button"
                                    onClick={() => openVendorReview(p)}
                                    className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer"
                                  >
                                    {hasVendorReview ? 'Update review' : 'Review Jeweller'}
                                  </button>
                                ) : null}

                                {canTrack ? (
                                  <button
                                    type="button"
                                    onClick={() => goToTrack(id)}
                                    className="px-4 py-2 rounded-xl bg-white border border-pale text-[12px] font-semibold text-ink hover:bg-cream"
                                  >
                                    Track
                                  </button>
                                ) : null}

                                {canCancelProject(p) ? (
                                  <button
                                    type="button"
                                    onClick={() => openCancel(p)}
                                    disabled={isActionLoading(id, 'cancel')}
                                    className="px-4 py-2 rounded-xl border border-amber-200 text-[12px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isActionLoading(id, 'cancel') ? 'Cancelling…' : 'Cancel Project'}
                                  </button>
                                ) : null}
                                {biddingRunning ? (
                                  <button
                                    type="button"
                                    onClick={() => openForceStop(p)}
                                    disabled={isActionLoading(id, 'forceStop')}
                                    className="px-4 py-2 rounded-xl border border-red-100 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isActionLoading(id, 'forceStop') ? 'Ending…' : 'Force End'}
                                  </button>
                                ) : null}

                                {hasBidHistory ? (
                                  <button
                                    type="button"
                                    onClick={() => goToBids(p)}
                                    className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    View Bids
                                  </button>
                                ) : null}

                                {canEditProject(p) ? (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(p)}
                                    className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                {canDeleteProject(p) ? (
                                  <button
                                    type="button"
                                    onClick={() => openDelete(p)}
                                    disabled={isActionLoading(id, 'delete')}
                                    className="px-4 py-2 rounded-xl border border-red-100 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isActionLoading(id, 'delete') ? 'Deleting…' : 'Delete'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {canLoadMore ? (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => loadProjects({ nextPage: listPage + 1, append: true })}
                          disabled={listMoreLoading}
                          className="px-10 py-3 rounded-2xl border border-pale bg-white text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
                        >
                          {listMoreLoading ? 'Loading…' : 'Load more'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
                </div>
              </>
            ) : mainTab === 'assignments' ? (
              <div className="flex flex-1 flex-col min-h-0">
                {listLoading ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
                    <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : assignmentRows.length === 0 ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center px-4">
                    <div className="text-center">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                          <path d="M8 10h8" />
                          <path d="M8 14h5" />
                        </svg>
                      </div>
                      <p className="mt-3 text-[14px] font-bold text-ink">No assignment requests yet</p>
                      <p className="mt-1 text-[12px] text-muted">When you receive assignments, they’ll appear here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-0 overflow-y-auto space-y-3 pr-1">
                    <div className="sticky top-0 z-10 bg-white pb-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="relative w-full sm:w-auto">
                          <input
                            value={assignmentsSearch}
                            onChange={(e) => setAssignmentsSearch(e.target.value)}
                            placeholder='Search by Project Title or Jeweller Name'
                            className="w-full sm:w-[320px] max-w-full px-4 py-2.5 rounded-xl border border-pale text-[13px] font-semibold text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                          />
                        </div>
                        <div className="text-[12px] font-semibold text-muted">
                          {filteredAssignmentRows.length} {filteredAssignmentRows.length === 1 ? 'record' : 'records'}
                        </div>
                      </div>
                    </div>

                    {filteredAssignmentRows.length === 0 ? (
                      <div className="rounded-xl border border-pale bg-cream p-4 text-[13px] text-mid">
                        No matching assignments.
                      </div>
                    ) : null}

                    {filteredAssignmentRows.map((row, idx) => {
                    const p = row?.project || {};
                    const a = row?.assignment || {};
                    const pid = row?.projectId ?? localProjectIdOf(p);
                    const status = String(a?.status ?? '').trim().toLowerCase() || 'pending';
                    const statusText = status === 'reassigned' ? 'Overridden' : toTitleCase(status);
                    const when =
                      a?.createdAt ??
                      a?.created_at ??
                      a?.assignedAt ??
                      a?.assigned_at ??
                      a?.updatedAt ??
                      a?.updated_at ??
                      null;
                    const vendorJoined = `${a?.vendor?.firstName ?? ''} ${a?.vendor?.lastName ?? ''}`.trim();
                    const vendorName =
                      a?.vendorName ??
                      a?.vendor_name ??
                      a?.vendor?.fullName ??
                      (vendorJoined || null);
                    const vendorLabel = vendorName || 'Jeweller';
                    const statusClass =
                      status === 'accepted'
                        ? 'bg-green-50 border-green-100 text-green-700'
                        : status === 'rejected'
                          ? 'bg-red-50 border-red-100 text-red-700'
                          : status === 'reassigned'
                            ? 'bg-cream border-pale text-mid'
                            : 'bg-amber-50 border-amber-100 text-amber-700';
                    return (
                      <div key={String(a?.id ?? a?._id ?? `${pid}-${idx}`)} className="rounded-2xl border border-pale p-4 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13px] font-bold text-ink truncate max-w-[90vw] sm:max-w-none">
                                {p?.title || 'Project'}
                              </p>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusClass}`}>
                                {statusText}
                              </span>
                            </div>
                            <p className="mt-1 text-[12px] text-muted">
                              {status === 'pending' ? 'Pending with' : status === 'accepted' ? 'Accepted by' : 'Rejected by'}{' '}
                              <span className="font-semibold text-mid">{vendorLabel}</span>
                            </p>
                            {/* Mobile timestamp */}
                            {when ? <p className="mt-1 text-[12px] text-muted sm:hidden">{formatDateTime(when)}</p> : null}
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-2">
                            {/* Desktop timestamp */}
                            {when ? (
                              <p className="hidden sm:block text-[12px] text-muted text-right">
                                {formatDateTime(when)}
                              </p>
                            ) : null}
                            {status === 'accepted' && pid ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/customer/projects/${pid}`)}
                                className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-bold text-ink hover:bg-cream"
                              >
                                Track
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            ) : null}

            {createModalOpen ? (
              <div
                className="fixed inset-0 z-[120] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
                onMouseDown={closeCreateModal}
              >
                <div
                  className="w-full max-w-3xl md:w-[calc(100vw-64px)] md:max-w-6xl lg:max-w-7xl bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden h-[calc(100dvh-24px)] md:h-[calc(100dvh-64px)] flex flex-col"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="relative px-5 pt-4 border-b border-pale flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold text-ink">{editingId ? 'Edit Project' : 'Create Project'}</p>
                      <p className="mt-1 text-[12px] text-muted">
                        {editingId ? 'Editing an existing project (saved as draft).' : 'Creates a draft project.'}
                      </p>
                    </div>

                    {/* Desktop: consultation prompt centered in header row */}
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-4 flex-col items-center text-center gap-2 max-w-[52%]">
                      <p className="text-[14px] font-extrabold text-ink">
                        Need help bringing your idea together?
                      </p>
                      <a
                        href="mailto:sales@mirah.com?subject=Book%20a%20Consultation"
                        className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity"
                      >
                        Book a Consultation
                      </a>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {editingId ? (
                        <button
                          type="button"
                          onClick={startCreateNew}
                          disabled={createLoading || attachmentUploading || referenceUploading}
                          className="hidden sm:inline-flex px-3 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          New project
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={closeCreateModal}
                        disabled={createLoading || attachmentUploading || referenceUploading}
                        className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-b border-pale bg-white">
                    {/* Mobile: compact consultation prompt above stepper */}
                    <div className="md:hidden mb-2 rounded-xl border border-pale bg-white px-3 py-2.5 flex flex-col items-center justify-center text-center gap-1.5">
                      <p className="text-[12px] font-bold text-ink leading-snug">
                        Need help bringing your idea together?
                      </p>
                      <a
                        href="mailto:sales@mirah.com?subject=Book%20a%20Consultation"
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-walnut text-blush text-[11px] font-bold hover:opacity-90 transition-opacity"
                      >
                        Book a Consultation
                      </a>
                    </div>
                    <div className="sm:hidden mb-2 text-[13px] font-extrabold text-ink">
                      {stepLabels.find((x) => x.id === createStep)?.label || 'Project'}
                    </div>
                    <div className="flex items-center gap-2 w-full md:mt-4">
                      {stepLabels.map((s, idx) => {
                        const active = createStep === s.id;
                        const done = createStep > s.id;
                        return (
                          <React.Fragment key={String(s.id)}>
                            <div className="flex items-center gap-2 min-w-0 shrink-0">
                              <div
                                className={`w-7 h-7 rounded-xl flex items-center justify-center text-[12px] font-extrabold border ${
                                  active || done ? 'bg-walnut text-blush border-walnut' : 'bg-white text-muted border-pale'
                                }`}
                              >
                                {s.id}
                              </div>
                              <div className={`hidden sm:block text-[12px] font-bold whitespace-nowrap ${active || done ? 'text-ink' : 'text-muted'}`}>
                                {s.label}
                              </div>
                            </div>
                            {idx < stepLabels.length - 1 ? (
                              <div className={`flex-1 h-[2px] rounded-full ${done ? 'bg-walnut' : 'bg-blush'}`} />
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div className={`h-full grid grid-cols-1 ${createStep === 4 ? 'md:grid-cols-1' : 'md:grid-cols-[420px_1fr]'}`}>
                      {/* Left: reference image (desktop, hidden on Review step) */}
                      {createStep !== 4 ? (
                      <div className="hidden md:block h-full overflow-y-auto border-r border-pale bg-white px-5 py-5">
                        <div className="p-4">
                          <div>
                            <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Reference Image *</p>
                            <p className="text-[12px] text-muted">Upload one image as the project reference.</p>
                          </div>

                          <div className="mt-4">
                            {String(createForm.referenceImage || '').trim() ? (
                              <div className="relative rounded-2xl border border-pale bg-cream overflow-hidden group">
                                <SafeImage
                                  src={String(createForm.referenceImage || '').trim()}
                                  alt="Reference"
                                  className="w-full h-48 md:h-[360px] object-contain bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCreateForm((p) => ({ ...p, referenceImage: '' }));
                                    if (referenceImageInputRef.current) referenceImageInputRef.current.value = '';
                                  }}
                                  disabled={referenceUploading}
                                  className="absolute top-3 right-3 z-10 w-9 h-9 rounded-xl bg-walnut/75 text-white flex items-center justify-center hover:bg-walnut/85 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                                  aria-label="Remove reference image"
                                  title="Remove image"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={openReferenceFilePicker}
                                onDragOver={onReferenceDropZoneDragOver}
                                onDragEnter={onReferenceDropZoneDragOver}
                                onDragLeave={onReferenceDropZoneDragLeave}
                                onDrop={onReferenceDropZoneDrop}
                                disabled={referenceUploading}
                                aria-busy={referenceUploading}
                                aria-label="Upload reference image. You can also drag and drop a file here."
                                className={`relative w-full rounded-2xl border-2 border-dashed p-6 text-center min-h-[320px] flex flex-col items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                                  referenceDropActive
                                    ? 'border-walnut bg-walnut/[0.06] ring-2 ring-walnut/20'
                                    : 'border-pale bg-cream hover:border-walnut/45 hover:bg-cream/90'
                                }`}
                              >
                                <span className="pointer-events-none flex flex-col items-center gap-2 max-w-[280px]">
                                  {referenceUploading ? (
                                    <svg
                                      className="animate-spin text-ink"
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="32"
                                      height="32"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                    >
                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                  ) : (
                                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-pale text-ink shadow-sm">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                      </svg>
                                    </span>
                                  )}
                                  <span className="mt-1 text-[13px] font-bold text-ink">
                                    {referenceUploading ? 'Uploading…' : 'Add reference image'}
                                  </span>
                                  <span className="text-[12px] text-muted leading-snug">
                                    {referenceUploading ? 'Please wait' : 'Click to browse, or drag and drop an image here'}
                                  </span>
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      ) : null}

                      {/* Right: step content (scrollable) */}
                      <div className="h-full overflow-y-auto px-5 py-5">
                        <input
                          ref={referenceImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = (e.target.files || [])[0] || null;
                            if (f) handleUploadReferenceImage(f);
                          }}
                        />

                        {/* Mobile: reference image block at top (always visible) */}
                        <div className="md:hidden mb-6">
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Reference Image *</p>
                                <p className="text-[12px] text-muted">
                                  {String(createForm.referenceImage || '').trim()
                                    ? 'Reference image added. Tap × on the preview to remove, then add a new one.'
                                    : 'Tap the area below to choose an image.'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setMobileRefCollapsed((v) => !v)}
                                className="w-10 h-10 shrink-0 rounded-xl border border-pale text-mid hover:bg-cream flex items-center justify-center"
                                aria-label={mobileRefCollapsed ? 'Expand reference image' : 'Collapse reference image'}
                                title={mobileRefCollapsed ? 'Expand' : 'Collapse'}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className={`transition-transform ${mobileRefCollapsed ? '' : 'rotate-180'}`}
                                >
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </button>
                            </div>

                            {!mobileRefCollapsed ? (
                              <div className="mt-4">
                                {String(createForm.referenceImage || '').trim() ? (
                                  <div className="relative rounded-2xl border border-pale bg-cream overflow-hidden">
                                    <SafeImage
                                      src={String(createForm.referenceImage || '').trim()}
                                      alt="Reference"
                                      className="w-full h-48 object-contain bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCreateForm((p) => ({ ...p, referenceImage: '' }));
                                        if (referenceImageInputRef.current) referenceImageInputRef.current.value = '';
                                      }}
                                      disabled={referenceUploading}
                                      className="absolute top-3 right-3 z-10 w-9 h-9 rounded-xl bg-walnut/75 text-white flex items-center justify-center hover:bg-walnut/85 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                                      aria-label="Remove reference image"
                                      title="Remove image"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={openReferenceFilePicker}
                                    onDragOver={onReferenceDropZoneDragOver}
                                    onDragEnter={onReferenceDropZoneDragOver}
                                    onDragLeave={onReferenceDropZoneDragLeave}
                                    onDrop={onReferenceDropZoneDrop}
                                    disabled={referenceUploading}
                                    aria-busy={referenceUploading}
                                    aria-label="Upload reference image"
                                    className={`relative w-full rounded-2xl border-2 border-dashed p-6 text-center min-h-[220px] flex flex-col items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                                      referenceDropActive
                                        ? 'border-walnut bg-walnut/[0.06] ring-2 ring-walnut/20'
                                        : 'border-pale bg-cream hover:border-walnut/45 hover:bg-cream/90'
                                    }`}
                                  >
                                    <span className="pointer-events-none flex flex-col items-center gap-2 max-w-[260px]">
                                      {referenceUploading ? (
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
                                      ) : (
                                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-pale text-ink shadow-sm">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                          </svg>
                                        </span>
                                      )}
                                      <span className="mt-1 text-[13px] font-bold text-ink">
                                        {referenceUploading ? 'Uploading…' : 'Add reference image'}
                                      </span>
                                      <span className="text-[12px] text-muted leading-snug">
                                        {referenceUploading ? 'Please wait' : 'Tap to browse. On desktop you can drag a file here.'}
                                      </span>
                                    </span>
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {createStep === 1 ? (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Design title *</label>
                                <input
                                  value={createForm.title}
                                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                                  placeholder="Enter design title"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Jewellery type *</label>
                                <select
                                  value={createForm?.specs?.jewelleryType || ''}
                                  onChange={(e) => {
                                    const nextType = String(e.target.value || '');
                                    setCreateForm((p) => ({
                                      ...p,
                                      specs: {
                                        ...(p.specs || {}),
                                        jewelleryType: nextType,
                                        // Reset size selection when type changes.
                                        sizeMode: 'standard',
                                        sizeStandard: '',
                                        sizeCustomValue: '',
                                        sizeCustomUnit: defaultSizeCustomUnitForJewelleryType(nextType),
                                      },
                                    }));
                                  }}
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                                >
                                  <option value="">Select</option>
                                  {['Ring', 'Necklace', 'Bracelet', 'Flexi Bangle', 'Earrings', 'Pendant'].map((x) => (
                                    <option key={x} value={x}>
                                      {x}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {String(createForm?.specs?.jewelleryType || '').trim() ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Size *</label>
                                  <button
                                    type="button"
                                    onClick={() => setHowToMeasureOpen(true)}
                                    className="shrink-0 text-[12px] font-semibold text-ink hover:underline cursor-pointer"
                                  >
                                    How to Measure
                                  </button>
                                </div>
                                <select
                                  value={createForm?.specs?.sizeMode === 'custom' ? 'custom' : (createForm?.specs?.sizeStandard || '')}
                                  onChange={(e) => {
                                    const v = String(e.target.value || '');
                                    if (v === 'custom') {
                                      setCreateForm((p) => ({
                                        ...p,
                                        specs: { ...(p.specs || {}), sizeMode: 'custom', sizeStandard: '' },
                                      }));
                                    } else {
                                      setCreateForm((p) => ({
                                        ...p,
                                        specs: { ...(p.specs || {}), sizeMode: 'standard', sizeStandard: v },
                                      }));
                                    }
                                  }}
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                                >
                                  <option value="">Select</option>
                                  {sizeStandardOptionsForJewelleryType(createForm?.specs?.jewelleryType).map((label) => (
                                    <option key={label} value={label}>
                                      {label}
                                    </option>
                                  ))}
                                  <option value="custom">Enter custom measurement</option>
                                </select>
                                {createForm?.specs?.sizeMode === 'custom' ? (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      value={createForm?.specs?.sizeCustomValue || ''}
                                      onChange={(e) =>
                                        setCreateForm((p) => ({
                                          ...p,
                                          specs: { ...(p.specs || {}), sizeCustomValue: e.target.value },
                                        }))
                                      }
                                      className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                                      placeholder="Measurement"
                                    />
                                    <select
                                      value={createForm?.specs?.sizeCustomUnit || defaultSizeCustomUnitForJewelleryType(createForm?.specs?.jewelleryType)}
                                      onChange={(e) =>
                                        setCreateForm((p) => ({
                                          ...p,
                                          specs: { ...(p.specs || {}), sizeCustomUnit: e.target.value },
                                        }))
                                      }
                                      className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                                    >
                                      <option value="mm">mm</option>
                                      <option value="cm">cm</option>
                                      <option value="in">inches</option>
                                    </select>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {createStep === 2 ? (
                      <div className="rounded-2xl border border-pale p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Jewellery specifications</p>
                            <p className="text-[12px] text-muted">These details will be shared with the jeweller to prepare your order.</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Metal type *</label>
                            <select
                              value={createForm?.specs?.metalType || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), metalType: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                            >
                              <option value="">Select</option>
                              {['Gold', 'Platinum', 'Silver', 'Other'].map((x) => (
                                <option key={x} value={x}>
                                  {x}
                                </option>
                              ))}
                            </select>
                          </div>

                          {String(createForm?.specs?.metalType || '').trim().toLowerCase() === 'gold' ? (
                            <>
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Metal purity *</label>
                                <select
                                  value={createForm?.specs?.metalPurity || ''}
                                  onChange={(e) =>
                                    setCreateForm((p) => ({
                                      ...p,
                                      specs: { ...(p.specs || {}), metalPurity: e.target.value },
                                    }))
                                  }
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                                >
                                  <option value="">Select</option>
                                  {['9KT', '14KT', '18KT', '22KT'].map((x) => (
                                    <option key={x} value={x}>
                                      {x}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Metal colour *</label>
                                <select
                                  value={createForm?.specs?.metalColour || ''}
                                  onChange={(e) =>
                                    setCreateForm((p) => ({
                                      ...p,
                                      specs: { ...(p.specs || {}), metalColour: e.target.value },
                                    }))
                                  }
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                                >
                                  <option value="">Select</option>
                                  {['Yellow', 'White', 'Rose', 'Two-tone'].map((x) => (
                                    <option key={x} value={x}>
                                      {x}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : null}

                          {String(createForm?.specs?.metalColour || '').trim().toLowerCase() === 'two-tone' ? (
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[11px] font-medium text-ink uppercase tracking-wide">
                                Two-tone specification and additional metal details *
                              </label>
                              <input
                                value={createForm?.specs?.twoToneDetails || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), twoToneDetails: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                                placeholder="Describe the exact combination and placement of colours"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Metal finish *</label>
                            <select
                              value={createForm?.specs?.metalFinish || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), metalFinish: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                            >
                              <option value="">Select</option>
                              {['Matte', 'Polished'].map((x) => (
                                <option key={x} value={x}>
                                  {x}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Does your design include stones? *</label>
                            <select
                              value={createForm?.specs?.stonesIncluded || 'no'}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), stonesIncluded: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </div>

                          {String(createForm?.specs?.stonesIncluded || '').toLowerCase() === 'yes' ? (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Stone type *</label>
                              <select
                                value={createForm?.specs?.stoneType || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), stoneType: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                              >
                                <option value="">Select</option>
                                <option value="Natural Diamonds">Natural Diamonds</option>
                                <option value="Lab-Grown Diamonds">Lab-Grown Diamonds</option>
                              </select>
                            </div>
                          ) : null}

                          {String(createForm?.specs?.stonesIncluded || '').toLowerCase() === 'yes' &&
                          String(createForm?.specs?.stoneType || '').toLowerCase().includes('natural') ? (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Preferred stone quality bracket *</label>
                              <select
                                value={createForm?.specs?.stoneQualityBracket || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), stoneQualityBracket: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                              >
                                <option value="">Select</option>
                                {['Standard', 'Premium', 'Luxury'].map((x) => (
                                  <option key={x} value={x}>
                                    {x}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[12px] text-muted">
                                Based on your selected quality bracket and budget, we will determine the appropriate stone colour, clarity, and size.
                              </p>
                            </div>
                          ) : null}

                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Stamping or engraving details</label>
                            <textarea
                              rows={3}
                              value={createForm?.specs?.engravingDetails || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), engravingDetails: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                              placeholder="Specify any initials, names, dates, or markings required"
                            />
                          </div>

                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Changes compared to reference image</label>
                            <textarea
                              rows={3}
                              value={createForm?.specs?.changesComparedToReference || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), changesComparedToReference: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                              placeholder="Specify any changes beyond the selections above"
                            />
                          </div>
                        </div>
                      </div>
                        ) : null}

                    {createStep === 3 ? (
                      <div className="space-y-6">
                        <div className="rounded-2xl border border-pale p-4">
                          <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Order details</p>
                          <p className="mt-1 text-[12px] text-muted">Provide quantities, budget, and delivery timeline.</p>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Budget per piece *</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.]?[0-9]*"
                                value={createForm?.specs?.budgetPerPiece || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), budgetPerPiece: sanitizeDecimalInput(e.target.value, { maxLen: 16 }) },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                                placeholder="e.g. 25000"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Quantity required *</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={createForm?.specs?.quantityRequired || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), quantityRequired: sanitizeDigitsInput(e.target.value, { maxLen: 6 }) },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                                placeholder="e.g. 1"
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Preferred delivery timeline *</label>
                              {(() => {
                                const minDays = 20;
                                const maxDays = 90;
                                const days = clampNumber(createForm?.specs?.preferredDeliveryDays ?? 20, minDays, maxDays);
                                const pct = ((days - minDays) / (maxDays - minDays)) * 100;
                                const expectedDate = addDays(startOfLocalDay(new Date()) || new Date(), days);
                                return (
                                  <div className="mt-2">
                                    <div className="relative">
                                      <div
                                        className="absolute -top-8 text-[12px] font-bold text-ink bg-white border border-pale rounded-lg px-2 py-0.5 shadow-sm"
                                        style={{ left: `calc(${pct}% - 14px)` }}
                                      >
                                        {days}
                                      </div>
                                      <input
                                        type="range"
                                        min={minDays}
                                        max={maxDays}
                                        step={1}
                                        value={days}
                                        onChange={(e) => {
                                          const nextDays = clampNumber(e.target.value, minDays, maxDays);
                                          setCreateForm((p) => ({
                                            ...p,
                                            specs: {
                                              ...(p.specs || {}),
                                              preferredDeliveryDays: nextDays,
                                              preferredDeliveryTimeline: preferredDeliveryTimelineFromDays(nextDays),
                                            },
                                          }));
                                        }}
                                        className="w-full accent-walnut"
                                      />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
                                      <span>20 Days</span>
                                      <span>90 Days</span>
                                    </div>
                                    <p className="mt-3 text-[12px] text-muted">
                                      Your Expected delivery date is{' '}
                                      <span className="font-semibold text-ink">{formatDateWithOrdinal(expectedDate)}</span>
                                    </p>
                                    {days < 30 ? (
                                      <p className="mt-2 text-[12px] text-amber-700">
                                        Selecting a shorter delivery timeline may have a minor impact on pricing due to priority handling
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-pale p-4">
                          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Additional notes for the manufacturer</label>
                          <textarea
                            rows={3}
                            value={createForm?.specs?.additionalNotes || ''}
                            onChange={(e) =>
                              setCreateForm((p) => ({
                                ...p,
                                specs: { ...(p.specs || {}), additionalNotes: e.target.value },
                              }))
                            }
                            className="mt-2 w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut"
                            placeholder="Any additional details you want to share"
                          />
                        </div>

                        <div className="rounded-2xl border border-pale p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Attachments</p>
                              <p className="text-[12px] text-muted">Upload project attachments (images/PDF).</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => attachmentInputRef.current?.click()}
                              disabled={attachmentUploading}
                              className="px-4 py-2 rounded-xl bg-walnut text-blush text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {attachmentUploading ? 'Uploading…' : 'Upload files'}
                            </button>
                            <input
                              ref={attachmentInputRef}
                              type="file"
                              accept="image/*,application/pdf"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) handleUploadAttachments(files);
                              }}
                            />
                          </div>

                          {coerceUrlArray(createForm.attachments).length ? (
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {coerceUrlArray(createForm.attachments).map((url, idx) => (
                                <div
                                  key={`${url}-${idx}`}
                                  role={isPdfUrl(url) ? 'button' : undefined}
                                  tabIndex={isPdfUrl(url) ? 0 : undefined}
                                  onClick={() => {
                                    if (!isPdfUrl(url)) return;
                                    try {
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (!isPdfUrl(url)) return;
                                    if (e.key !== 'Enter') return;
                                    try {
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  className={`relative rounded-xl overflow-hidden border border-pale bg-cream ${isPdfUrl(url) ? 'cursor-pointer' : ''}`}
                                  aria-label={isPdfUrl(url) ? 'Open PDF attachment' : undefined}
                                >
                                  {isPdfUrl(url) ? (
                                    <div className="w-full h-24 bg-white flex items-center justify-center text-red-400">
                                      <div className="text-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                          <path d="M14 2v6h6" />
                                        </svg>
                                        <div className="mt-1 text-[10px] font-bold">PDF</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <SafeImage src={url} alt="" className="w-full h-24 object-contain bg-white p-2" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCreateForm((p) => ({ ...p, attachments: coerceUrlArray(p.attachments).filter((_, i) => i !== idx) }));
                                    }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-walnut/70 text-white flex items-center justify-center hover:bg-walnut/80 cursor-pointer"
                                    aria-label="Remove"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M18 6 6 18" />
                                      <path d="m6 6 12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 text-[12px] text-muted">No attachments uploaded.</div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {createStep === 4 ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-pale p-4">
                          <p className="text-[13px] font-extrabold text-ink">Review</p>
                          <p className="mt-1 text-[12px] text-muted">Confirm all details before submitting.</p>
                        </div>

                        {feasibilityReview ? (
                          <div className="rounded-2xl border border-pale p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Feasibility</p>
                                <p className="mt-1 text-[12px] text-muted">
                                  {feasibilityReview?.goodToGo === true
                                    ? 'Good to go based on the feasibility check.'
                                    : 'Feasibility check suggests adjustments may be needed.'}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                  feasibilityReview?.goodToGo === true
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                    : 'bg-amber-50 border-amber-100 text-amber-700'
                                }`}
                              >
                                {feasibilityReview?.goodToGo === true ? 'Good to go' : 'Needs review'}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                              <InfoBox
                                label="Timeline feasible"
                                value={
                                  typeof feasibilityReview?.timelineFeasible === 'boolean'
                                    ? feasibilityReview.timelineFeasible
                                      ? 'Yes'
                                      : 'No'
                                    : '—'
                                }
                              />
                              <InfoBox
                                label="Minimum production"
                                value={
                                  Number.isFinite(Number(feasibilityReview?.minimumProductionDays))
                                    ? `${Number(feasibilityReview.minimumProductionDays)} days`
                                    : '—'
                                }
                              />
                              <InfoBox
                                label="Est. cost / piece"
                                value={
                                  Number.isFinite(Number(feasibilityReview?.breakdown?.estimatedCostPerPiece))
                                    ? `₹ ${formatMoney(Number(feasibilityReview.breakdown.estimatedCostPerPiece))}`
                                    : '—'
                                }
                              />
                              <InfoBox
                                label="Total order cost"
                                value={
                                  Number.isFinite(Number(feasibilityReview?.breakdown?.totalOrderCost))
                                    ? `₹ ${formatMoney(Number(feasibilityReview.breakdown.totalOrderCost))}`
                                    : '—'
                                }
                              />
                            </div>

                            {Array.isArray(feasibilityReview?.tiersApplied) && feasibilityReview.tiersApplied.length ? (
                              <div className="mt-3">
                                <p className="text-[11px] font-medium text-mid uppercase tracking-wide">Tiers applied</p>
                                <ul className="mt-2 space-y-1 text-[12px] text-mid">
                                  {feasibilityReview.tiersApplied.map((t, idx) => (
                                    <li key={`tier-${idx}`} className="flex items-start gap-2">
                                      <span className="mt-[4px] w-1.5 h-1.5 rounded-full bg-soft" />
                                      <span>{String(t)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {Array.isArray(feasibilitySuggestions) && feasibilitySuggestions.length ? (
                          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-amber-900 uppercase tracking-wide">Suggestions</p>
                                <p className="mt-1 text-[12px] text-amber-800/80">
                                  Based on your budget and timeline, here are some suggestions.
                                </p>
                              </div>
                              {feasibilityLoading ? (
                                <svg className="shrink-0 animate-spin text-amber-700" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                              ) : null}
                            </div>
                            <ul className="mt-3 space-y-2">
                              {feasibilitySuggestions.map((sug, idx) => (
                                <li key={`sug-${idx}`} className="flex items-start gap-2 text-[13px] text-amber-900">
                                  <span className="mt-[2px] w-5 h-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-[11px] font-extrabold text-amber-800">
                                    {idx + 1}
                                  </span>
                                  <span className="text-amber-900">{String(sug)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-pale p-4">
                          <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Design title</p>
                          <div className="mt-2 text-[13px] font-semibold text-ink">{createForm.title || '—'}</div>
                        </div>

                        <div className="rounded-2xl border border-pale p-4">
                          <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Jewellery specifications</p>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                            <div><span className="text-muted">Jewellery type:</span> <span className="font-semibold text-ink">{createForm?.specs?.jewelleryType || '—'}</span></div>
                            <div><span className="text-muted">Size:</span> <span className="font-semibold text-ink">{createForm?.specs?.sizeMode === 'custom' ? `${createForm?.specs?.sizeCustomValue || '—'} ${createForm?.specs?.sizeCustomUnit || ''}`.trim() : (createForm?.specs?.sizeStandard || '—')}</span></div>
                            <div><span className="text-muted">Metal type:</span> <span className="font-semibold text-ink">{createForm?.specs?.metalType || '—'}</span></div>
                            {String(createForm?.specs?.metalPurity || '').trim() ? (
                              <div><span className="text-muted">Metal purity:</span> <span className="font-semibold text-ink">{createForm?.specs?.metalPurity}</span></div>
                            ) : null}
                            {String(createForm?.specs?.metalColour || '').trim() ? (
                              <div><span className="text-muted">Metal colour:</span> <span className="font-semibold text-ink">{createForm?.specs?.metalColour}</span></div>
                            ) : null}
                            {String(createForm?.specs?.twoToneDetails || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-muted">Two-tone details:</span> <span className="font-semibold text-ink">{createForm?.specs?.twoToneDetails}</span></div>
                            ) : null}
                            <div><span className="text-muted">Metal finish:</span> <span className="font-semibold text-ink">{createForm?.specs?.metalFinish || '—'}</span></div>
                            <div><span className="text-muted">Stones included:</span> <span className="font-semibold text-ink">{String(createForm?.specs?.stonesIncluded || 'no').toLowerCase() === 'yes' ? 'Yes' : 'No'}</span></div>
                            {String(createForm?.specs?.stoneType || '').trim() ? (
                              <div><span className="text-muted">Stone type:</span> <span className="font-semibold text-ink">{createForm?.specs?.stoneType}</span></div>
                            ) : null}
                            {String(createForm?.specs?.stoneQualityBracket || '').trim() ? (
                              <div><span className="text-muted">Preferred stone quality bracket:</span> <span className="font-semibold text-ink">{createForm?.specs?.stoneQualityBracket}</span></div>
                            ) : null}
                            {String(createForm?.specs?.engravingDetails || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-muted">Stamping / engraving:</span> <span className="font-semibold text-ink">{createForm?.specs?.engravingDetails}</span></div>
                            ) : null}
                            {String(createForm?.specs?.changesComparedToReference || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-muted">Changes vs reference:</span> <span className="font-semibold text-ink">{createForm?.specs?.changesComparedToReference}</span></div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-pale p-4">
                          <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Order details</p>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                            <div><span className="text-muted">Budget per piece:</span> <span className="font-semibold text-ink">{String(createForm?.specs?.budgetPerPiece || '').trim() || '—'}</span></div>
                            <div><span className="text-muted">Quantity required:</span> <span className="font-semibold text-ink">{createForm?.specs?.quantityRequired || '—'}</span></div>
                            <div className="md:col-span-2"><span className="text-muted">Preferred delivery timeline:</span> <span className="font-semibold text-ink">{formatDateWithOrdinalFromInput(createForm?.specs?.preferredDeliveryTimeline) || '—'}</span></div>
                            {String(createForm?.specs?.additionalNotes || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-muted">Additional notes for the manufacturer:</span> <span className="font-semibold text-ink">{createForm?.specs?.additionalNotes}</span></div>
                            ) : null}
                            <div className="md:col-span-2">
                              <span className="text-muted">Confirmation:</span>{' '}
                              <span className="font-semibold text-ink">{createForm?.specs?.confirmSpecs ? 'Confirmed' : 'Not confirmed'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-pale p-4">
                          <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Attachments</p>
                          {coerceUrlArray(createForm?.attachments).length ? (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {coerceUrlArray(createForm.attachments).map((url, idx) => (
                                <div
                                  key={`review-att-${url}-${idx}`}
                                  role={isPdfUrl(url) ? 'button' : undefined}
                                  tabIndex={isPdfUrl(url) ? 0 : undefined}
                                  onClick={() => {
                                    if (!isPdfUrl(url)) return;
                                    try {
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (!isPdfUrl(url)) return;
                                    if (e.key !== 'Enter') return;
                                    try {
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  className={`rounded-xl overflow-hidden border border-pale bg-cream ${isPdfUrl(url) ? 'cursor-pointer' : ''}`}
                                >
                                  {isPdfUrl(url) ? (
                                    <div className="w-full h-24 bg-white flex items-center justify-center text-red-400">
                                      <div className="text-center">
                                        <div className="text-[10px] font-extrabold">PDF</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <SafeImage src={url} alt="" className="w-full h-24 object-contain bg-white p-2" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[12px] text-muted">No attachments uploaded.</div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-pale p-4">
                          <label className="flex items-start gap-2 text-[12px] text-ink cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(createForm?.specs?.confirmSpecs)}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), confirmSpecs: e.target.checked },
                                }))
                              }
                              className="mt-0.5 w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                            />
                            <span className="font-medium text-mid">
                              I confirm that all specifications provided are accurate and final. I understand that any changes after this stage may impact pricing and delivery timelines. I agree to the platform’s terms and conditions.
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

                  <div className="shrink-0 px-5 py-4 border-t border-pale bg-white flex items-center justify-between gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                    <button
                      type="button"
                      onClick={() => setCreateStep((s) => Math.max(1, Number(s || 1) - 1))}
                      disabled={createLoading || attachmentUploading || referenceUploading || createStep === 1}
                      className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Back
                    </button>

                    {createStep < 4 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (createStep === 3) {
                            prepareReviewStep();
                            return;
                          }
                          persistAndAdvance(createStep);
                        }}
                        disabled={createLoading || attachmentUploading || referenceUploading || feasibilityLoading}
                        className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createStep === 3 ? (feasibilityLoading || createLoading ? 'Reviewing…' : 'Review') : createLoading ? 'Saving…' : 'Next'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={listMyProject}
                        disabled={
                          createLoading ||
                          listMyProjectLoading ||
                          attachmentUploading ||
                          referenceUploading ||
                          !createForm?.specs?.confirmSpecs
                        }
                        className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {listMyProjectLoading || createLoading ? 'Listing…' : 'List my project'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

      {/* How to measure modal */}
      {howToMeasureOpen ? (
        <div
          className="fixed inset-0 z-[130] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setHowToMeasureOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-ink">How to Measure</p>
                {createForm?.specs?.jewelleryType ? (
                  <p className="mt-1 text-[12px] text-muted truncate">{String(createForm.specs.jewelleryType)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setHowToMeasureOpen(false)}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-[13px] text-mid leading-relaxed whitespace-pre-line">{howToMeasureText}</p>
            </div>
            <div className="px-5 py-4 border-t border-pale bg-white flex justify-end pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => setHowToMeasureOpen(false)}
                className="px-4 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Project listed modal */}
      {projectLiveOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            setProjectLiveOpen(false);
            setProjectLiveDays(null);
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">Congratulations! Your project is now live.</p>
              <p className="mt-2 text-[12px] text-mid">
                {`Over the next ${Math.max(1, Number(projectLiveDays) || 3)} ${Math.max(1, Number(projectLiveDays) || 3) === 1 ? 'day' : 'days'}, manufacturers will bid on your design. You’re free to review and choose a bid at any time, or wait until all bids are in.`}
              </p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setProjectLiveOpen(false);
                  setProjectLiveDays(null);
                }}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Force stop auction modal */}
      {forceStopOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4"
          onMouseDown={() => setForceStopOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">Force End</p>
              <p className="mt-1 text-[12px] text-muted">This will force-end the current bid window now (does not cancel the project).</p>
            </div>

            <div className="px-5 py-4">
              <label className="flex items-start gap-3 select-none cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-pale text-ink focus:ring-walnut"
                  checked={forceStopEndWithAutoWinner}
                  onChange={(e) => setForceStopEndWithAutoWinner(Boolean(e.target.checked))}
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-ink">Auto-pick a winner</p>
                  <p className="mt-0.5 text-[11px] text-muted">If unchecked, we’ll only end bidding and you can choose the winner later.</p>
                </div>
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setForceStopOpen(false)}
                  className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream"
                >
                  Keep running
                </button>
                <button
                  type="button"
                  onClick={confirmForceStop}
                  disabled={Boolean(forceStopFor?.id) && isActionLoading(forceStopFor.id, 'forceStop')}
                  className="px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {Boolean(forceStopFor?.id) && isActionLoading(forceStopFor.id, 'forceStop') ? 'Ending…' : 'Force End'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete project modal */}
      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            setDeleteOpen(false);
            setDeleteFor(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">Delete project</p>
              <p className="mt-1 text-[12px] text-muted">
                Delete <span className="font-semibold text-ink">{deleteFor?.title || 'this project'}</span>? This cannot be undone.
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteFor(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={!deleteFor?.id || isActionLoading(deleteFor?.id, 'delete')}
                  className="px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteFor?.id && isActionLoading(deleteFor.id, 'delete') ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Jeweller review modal */}
      {vendorReviewOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeVendorReview}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-ink">Review Jeweller</p>
                <p className="mt-1 text-[12px] text-muted truncate">
                  {vendorReviewFor?.vendorName ? (
                    <>
                      For <span className="font-semibold text-ink">{vendorReviewFor.vendorName}</span>
                    </>
                  ) : (
                    'For Jeweller'
                  )}
                </p>
                {vendorReviewFor?.projectTitle ? (
                  <p className="mt-1 text-[11px] text-muted truncate">{vendorReviewFor.projectTitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeVendorReview}
                disabled={Boolean(vendorReviewDraft?.submitting)}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-[11px] font-extrabold text-mid">Your rating</p>
              {vendorReviewFor?.hasReview ? (
                <p className="mt-1 text-[11px] text-muted">Already reviewed • Update anytime</p>
              ) : (
                <p className="mt-1 text-[11px] text-muted">Not reviewed yet</p>
              )}
              <div className="mt-2 inline-flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const val = i + 1;
                  const filled = val <= Number(vendorReviewDraft?.rating || 0);
                  return (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setVendorReviewDraft((d) => ({ ...(d || {}), rating: val }))}
                      disabled={Boolean(vendorReviewDraft?.submitting)}
                      className={`p-1 rounded-md ${filled ? 'text-amber-400' : 'text-soft'} disabled:opacity-50`}
                      aria-label={`Rate ${val} star${val === 1 ? '' : 's'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2Z" />
                      </svg>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <textarea
                  value={vendorReviewDraft?.comment ?? ''}
                  onChange={(e) => setVendorReviewDraft((d) => ({ ...(d || {}), comment: e.target.value }))}
                  disabled={Boolean(vendorReviewDraft?.submitting)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border border-pale bg-white text-[12px] font-medium text-mid focus:outline-none focus:border-walnut disabled:opacity-60"
                  placeholder="Comment (optional)"
                />
              </div>

              <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-ink select-none">
                <input
                  type="checkbox"
                  checked={Boolean(vendorReviewDraft?.isAnonymous)}
                  onChange={(e) => setVendorReviewDraft((d) => ({ ...(d || {}), isAnonymous: e.target.checked }))}
                  disabled={Boolean(vendorReviewDraft?.submitting)}
                  className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                />
                Post as anonymous
              </label>
            </div>

            <div className="px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={closeVendorReview}
                disabled={Boolean(vendorReviewDraft?.submitting)}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitVendorReview}
                disabled={Boolean(vendorReviewDraft?.submitting)}
                className="px-4 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
              >
                {vendorReviewDraft?.submitting ? 'Submitting…' : vendorReviewFor?.hasReview ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancel project modal */}
      {cancelOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            setCancelOpen(false);
            setCancelFor(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">Cancel Project</p>
              <p className="mt-1 text-[12px] text-muted">
                Cancel <span className="font-semibold text-ink">{cancelFor?.title || 'this project'}</span>? This will end the project and close any active bidding.
                This action cannot be undone.
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelFor(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream"
                >
                  Keep project
                </button>
                <button
                  type="button"
                  onClick={confirmCancel}
                  disabled={!cancelFor?.id || isActionLoading(cancelFor?.id, 'cancel')}
                  className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-[12px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelFor?.id && isActionLoading(cancelFor.id, 'cancel') ? 'Cancelling…' : 'Cancel Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
