import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { vendorService } from '../../services/vendorService';
import SafeImage from '../../components/SafeImage';

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

function toDateTimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
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

function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function pickPreviewUrl(attachments) {
  const list = coerceUrlArray(attachments);
  const img = list.find((u) => isImageUrl(u));
  // Listing cards should show image preview only. If there's no image, show placeholder icon.
  return img || null;
}

function projectStatusCardLabel(p) {
  const status = String(p?.status ?? '').trim().toLowerCase();
  const projectStatus = String(p?.projectStatus ?? p?.project_status ?? '').trim().toLowerCase();
  const latestBidWindowId = p?.latestBidWindowId ?? p?.latest_bid_window_id ?? null;

  // Rules requested:
  // - status=draft + projectStatus=started => Not Started
  // - status=running + projectStatus=started + latestBidWindowId=null => Not in Project Bid
  // - status=running + projectStatus=started + latestBidWindowId!=null => In Project Bid
  if (status === 'draft' && projectStatus === 'started') return 'Not Started';
  if (status === 'running' && projectStatus === 'started') {
    return latestBidWindowId == null ? 'Not in Project Bid' : 'In Project Bid';
  }

  if (projectStatus === 'invoice') {
    const finalPayment = p?.finalPayment ?? p?.final_payment ?? p?.payments?.final ?? null;
    const fin = paymentStatusKey(finalPayment);
    // List payload may not include payment blocks; default to Advance invoice.
    if (fin === 'due') return 'Invoice (Final)';
    return 'Invoice (Advance)';
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

function paymentStatusKey(block) {
  return String(block?.status ?? '').trim().toLowerCase();
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

  const advancePayment = p?.advancePayment ?? p?.advance_payment ?? null;
  const finalPayment = p?.finalPayment ?? p?.final_payment ?? null;
  if (isPaymentPaid(advancePayment) || isPaymentPaid(finalPayment)) return false;

  return true;
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
      preferredDeliveryTimeline: '',
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
      { id: 1, label: 'Project' },
      { id: 2, label: 'Specs' },
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
        const description = String(createForm?.description || '').trim();
        const minAmount = Number(createForm?.minAmount || 0);
        const maxAmount = Number(createForm?.maxAmount || 0);
        const timelineExpected = Number(createForm?.timelineExpected || 0);
        const referenceImage = String(createForm?.referenceImage || '').trim();

        if (!title) return 'Project title is required';
        if (!description) return 'Project description is required';
        if (!Number.isFinite(minAmount) || minAmount <= 0) return 'Min amount is required';
        if (!Number.isFinite(maxAmount) || maxAmount <= 0) return 'Max amount is required';
        if (maxAmount < minAmount) return 'Max amount must be greater than Min amount';
        if (!Number.isFinite(timelineExpected) || timelineExpected <= 0) return 'Timeline (days) is required';
        if (!referenceImage) return 'Reference image is required';
        if (!isHttpUrl(referenceImage)) return 'Reference image must be a valid http/https URL';
        return null;
      }

      if (step === 2) {
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
        const preferredDelivery = String(s?.preferredDeliveryTimeline || '').trim();

        // Budget per piece is optional; validate only if provided.
        if (budgetRaw !== '' && (!Number.isFinite(budget) || budget <= 0)) return 'Budget per piece must be greater than 0';
        if (!Number.isFinite(qty) || qty <= 0) return 'Quantity required is required';
        if (!preferredDelivery) return 'Preferred delivery timeline is required';

        const min = addDays(new Date(), 20);
        const selected = new Date(preferredDelivery);
        if (min && (!selected || Number.isNaN(selected.getTime()) || selected.getTime() < min.getTime())) {
          return 'Preferred delivery timeline must be at least 20 days from today';
        }

        if (!s?.confirmSpecs) return 'Please confirm specifications and terms';
        return null;
      }

      return null;
    },
    [createForm],
  );

  const [feasibilityLoading, setFeasibilityLoading] = useState(false);
  const [feasibilitySuggestions, setFeasibilitySuggestions] = useState([]);
  const feasibilityAbortRef = useRef(null);

  const feasibilityPayload = useMemo(() => {
    const title = String(createForm?.title || '').trim();
    const description = String(createForm?.description || '').trim();
    const minAmount = Number(createForm?.minAmount || 0);
    const maxAmount = Number(createForm?.maxAmount || 0);
    const timelineExpected = Number(createForm?.timelineExpected || 0);
    const referenceImage = String(createForm?.referenceImage || '').trim();
    const attachments = coerceUrlArray(createForm?.attachments);
    const baseMeta = buildExtraFieldsPayload(createForm?.metaFields);
    const specsMeta = buildStructuredSpecsPayload(createForm?.specs);
    const meta = buildExtraFieldsPayload([
      ...(extraFieldsToArray(baseMeta) || []),
      ...(extraFieldsToArray(specsMeta) || []),
    ]);
    return {
      title,
      description,
      attachments,
      referenceImage,
      meta,
      minAmount,
      maxAmount,
      timelineExpected,
    };
  }, [createForm]);

  const feasibilityPayloadKey = useMemo(() => {
    try {
      return JSON.stringify(feasibilityPayload);
    } catch {
      return String(Date.now());
    }
  }, [feasibilityPayload]);

  useEffect(() => {
    if (!createModalOpen) return;
    if (createStep !== 4) return;

    // Only call once the form is valid (stepper enforces this before reaching Review).
    const err1 = validateStep(1);
    const err2 = err1 ? null : validateStep(2);
    const err3 = err1 || err2 ? null : validateStep(3);
    if (err1 || err2 || err3) return;

    const timer = window.setTimeout(async () => {
      try {
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
        const data = await projectService.reviewFeasibility(feasibilityPayload, { signal: controller.signal });
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setFeasibilitySuggestions(suggestions.filter((x) => String(x || '').trim()));
      } catch {
        // If review fails, don't block submit; just hide suggestions.
        setFeasibilitySuggestions([]);
      } finally {
        setFeasibilityLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [createModalOpen, createStep, feasibilityPayloadKey, validateStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bidding / assignment UI
  const [startBidOpen, setStartBidOpen] = useState(false);
  const [startBidFor, setStartBidFor] = useState({ id: null, title: '' });
  const [startBidEndsAt, setStartBidEndsAt] = useState('');
  const [startBidMin, setStartBidMin] = useState('');

  const [forceStopOpen, setForceStopOpen] = useState(false);
  const [forceStopFor, setForceStopFor] = useState({ id: null, title: '' });

  const [referenceUploading, setReferenceUploading] = useState(false);
  const attachmentInputRef = useRef(null);
  const referenceImageInputRef = useRef(null);
  const listAbortRef = useRef(null);

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

  const loadProjects = useCallback(async ({ nextPage = 1, append = false, search = listSearch } = {}) => {
    if (listAbortRef.current) listAbortRef.current.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    if (append) setListMoreLoading(true);
    else setListLoading(true);

    try {
      const res = await projectService.list({
        page: nextPage,
        limit: 10,
        search: String(search || '').trim() || undefined,
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
  }, [addToast, listSearch]);

  useEffect(() => {
    loadProjects({ nextPage: 1, append: false });
    return () => {
      if (listAbortRef.current) listAbortRef.current.abort();
    };
  }, [loadProjects]);

  const InfoBox = ({ label, value, tone = 'default' }) => {
    const toneClass =
      tone === 'danger'
        ? 'bg-red-50 border-red-100 text-red-700'
        : tone === 'warn'
          ? 'bg-yellow-50 border-yellow-100 text-yellow-700'
          : 'bg-gray-50 border-gray-100 text-gray-700';
    return (
      <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-[12px] font-semibold mt-0.5 truncate">{value}</p>
      </div>
    );
  };

  const startCreateNew = () => {
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
    setActiveTab('create');
    navigate('/customer/projects?tab=create');
  };

  const startEdit = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    setEditingId(id);
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
        sizeCustomValue: pickMeta('sizeCustomValue', 'size_custom_value'),
        sizeCustomUnit: pickMeta('sizeCustomUnit', 'size_custom_unit') || 'cm',
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
        budgetPerPiece: pickMeta('budgetPerPiece', 'budget_per_piece'),
        quantityRequired: pickMeta('quantityRequired', 'quantity_required'),
        preferredDeliveryTimeline: pickMeta('preferredDeliveryTimeline', 'preferred_delivery_timeline'),
        additionalNotes: pickMeta('additionalNotes', 'additional_notes'),
        confirmSpecs:
          String(pickMeta('confirmSpecs', 'confirm_specs') || '')
            .trim()
            .toLowerCase() === 'true',
      },
      metaFields: metaRowsAll.filter((r) => !RESERVED_META_KEYS.has(String(r?.key || '').trim())),
    });
    setActiveTab('create');
    navigate('/customer/projects?tab=create');
  };

  const closeCreateModal = () => {
    if (createLoading || attachmentUploading || referenceUploading) return;
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

  const saveProject = async () => {
    const title = String(createForm?.title || '').trim();
    const description = String(createForm?.description || '').trim();
    const minAmount = Number(createForm?.minAmount || 0);
    const maxAmount = Number(createForm?.maxAmount || 0);
    const timelineExpected = Number(createForm?.timelineExpected || 0);
    const referenceImage = String(createForm?.referenceImage || '').trim();
    const attachments = coerceUrlArray(createForm?.attachments);
    const baseMeta = buildExtraFieldsPayload(createForm?.metaFields);
    const specsMeta = buildStructuredSpecsPayload(createForm?.specs);
    const meta = buildExtraFieldsPayload([
      ...(extraFieldsToArray(baseMeta) || []),
      ...(extraFieldsToArray(specsMeta) || []),
    ]);

    const err1 = validateStep(1);
    const err2 = err1 ? null : validateStep(2);
    const err3 = err1 || err2 ? null : validateStep(3);
    const err = err1 || err2 || err3;
    if (err) return addToast(err, 'error');

    if (createLoading) return;
    setCreateLoading(true);
    try {
      const payload = {
        title,
        description,
        attachments,
        referenceImage,
        meta,
        minAmount,
        maxAmount,
        timelineExpected,
      };
      if (editingId) {
        await projectService.update(editingId, payload);
        addToast('Project updated.', 'success');
      } else {
        await projectService.create(payload);
        addToast('Project created.', 'success');
      }
      setEditingId(null);
      setActiveTab('list');
      navigate('/customer/projects?tab=list');
      await loadProjects({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Failed to save project', 'error');
    } finally {
      setCreateLoading(false);
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

  const openStartBid = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    const windows = bidWindowsOf(p);
    const guess = windows?.[0]?.noOfDays ?? windows?.[0]?.no_of_days ?? 3;
    setStartBidFor({ id, title: String(p?.title ?? '') });
    const minLocal = toDateTimeLocalValue(new Date());
    setStartBidMin(minLocal);

    const days = Math.max(1, Number(guess) || 3);
    const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const endLocal = toDateTimeLocalValue(end);
    setStartBidEndsAt(endLocal && minLocal && endLocal < minLocal ? minLocal : endLocal);
    setStartBidOpen(true);
  };

  const confirmStartBid = async () => {
    const id = startBidFor?.id;
    if (!id) return;
    const raw = String(startBidEndsAt || '').trim();
    const end = raw ? new Date(raw) : null; // datetime-local parses as local time
    if (!end || Number.isNaN(end.getTime())) {
      addToast('Please select a valid finishing date/time.', 'error');
      return;
    }
    if (end.getTime() <= Date.now() + 30_000) {
      addToast('Finishing time must be in the future.', 'error');
      return;
    }
    setActionLoading(id, 'startBid', true);
    try {
      const finishingTimestamp = end.toISOString();
      await projectService.startBid(id, { finishingTimestamp });
      addToast('Auction started.', 'success');
      setStartBidOpen(false);
      await refreshList();
    } catch (e) {
      addToast(e?.message || 'Failed to start auction', 'error');
    } finally {
      setActionLoading(id, 'startBid', false);
    }
  };

  const openForceStop = (p) => {
    const id = localProjectIdOf(p);
    if (!id) return;
    setForceStopFor({ id, title: String(p?.title ?? '') });
    setForceStopOpen(true);
  };

  const confirmForceStop = async () => {
    const id = forceStopFor?.id;
    if (!id) return;
    setActionLoading(id, 'forceStop', true);
    try {
      await projectService.manualEndBid(id);
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
    navigate(`/customer/projects/${id}/bids`, { state: { projectTitle: p?.title ?? '' } });
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
    <div className="w-full pb-10 animate-fade-in">
      <div className="w-full h-[calc(100dvh-140px)] lg:h-[calc(100vh-150px)] flex gap-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">

        {/* Main */}
        <div className="flex-1 flex flex-col">
          

          <div className="flex-1 min-h-0 overflow-hidden p-5 bg-white">
            {mainTab === 'list' ? (
              <div className="h-full min-h-0 overflow-y-auto pr-1">
                <div className="shrink-0 sticky top-0 z-10 bg-white pb-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] md:text-[15px] font-extrabold text-gray-900">My projects</p>
                      <p className="mt-0.5 text-[12px] text-gray-400">Create and manage your projects.</p>
                    </div>
                    <button
                      type="button"
                      onClick={startCreateNew}
                      className="shrink-0 px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Create Project
                    </button>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={listSearchDraft}
                          onChange={(e) => setListSearchDraft(e.target.value)}
                          placeholder="Search by title…"
                          className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary-dark"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = '';
                            setListSearchDraft(next);
                            setListSearch(next);
                            await loadProjects({ nextPage: 1, append: false, search: next });
                          }}
                          disabled={listLoading || !String(listSearch || '').trim()}
                          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Clear search"
                          title="Clear search"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = String(listSearchDraft || '').trim();
                            setListSearch(next);
                            await loadProjects({ nextPage: 1, append: false, search: next });
                          }}
                          disabled={listLoading}
                          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
                          aria-label="Apply search"
                          title="Apply search"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M5 12.5 9 17l10-10" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {listLoading ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
                    <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : empty ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center px-4">
                    <div className="text-center">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <path d="M14 2v6h6" />
                          <path d="M8 13h8" />
                          <path d="M8 17h8" />
                        </svg>
                      </div>
                      <p className="mt-3 text-[14px] font-bold text-gray-900">No projects yet</p>
                      <p className="mt-1 text-[12px] text-gray-500">Create your first project to start bidding.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    {projects.map((p) => {
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
                      const notStarted = statusKey === 'draft' && projectStatusKey === 'started';
                      const runningStarted = statusKey === 'running' && projectStatusKey === 'started';
                      const statusLabel = projectStatusCardLabel(p);
                      const statusCardValue =
                        runningStarted && hasBidHistory && allWindowsFinished ? 'Bid Ended' : statusLabel;
                      const minAmount =
                        Number(p?.amountRange?.min ?? p?.amount_range?.min ?? p?.minAmount ?? p?.min_amount ?? 0) || 0;
                      const maxAmount =
                        Number(p?.amountRange?.max ?? p?.amount_range?.max ?? p?.maxAmount ?? p?.max_amount ?? 0) || 0;
                      const timeline = p?.timelineExpected ?? p?.timeline_expected ?? '—';
                      const updatedAt = p?.updatedAt ?? p?.updated_at ?? null;
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
                          className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
                        >
                          <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-[220px] h-[180px] md:h-[180px] bg-white border-b md:border-b-0 md:border-r border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
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
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
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
                              <p className="text-[18px] md:text-[22px] font-bold text-gray-800 truncate">
                                {p?.title || 'Project'}
                              </p>
                              <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{p?.description || '—'}</p>

                              {runningStarted && (biddingRunning || allWindowsFinished) ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {biddingRunning ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 border-amber-100 text-amber-700">
                                      {biddingEndsAt
                                        ? `Bidding ends: ${formatDateTime(biddingEndsAt)}`
                                        : 'Bidding running'}
                                    </span>
                                  ) : allWindowsFinished ? (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-gray-50 border-gray-100 text-gray-600">
                                      {latestFinishedAt
                                        ? `Last bidding ended: ${formatDateTime(latestFinishedAt)}`
                                        : 'Bidding ended'}
                                    </span>
                                  ) : null}
                                  {hasBidHistory ? (
                                    <span className="text-[11px] text-gray-400">
                                      Winner auto-assign happens when auction ends.
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                <InfoBox
                                  label="Budget"
                                  value={
                                    minAmount || maxAmount
                                      ? `₹ ${formatMoney(minAmount)} - ₹ ${formatMoney(maxAmount)}`
                                      : '—'
                                  }
                                />
                                <InfoBox label="Timeline" value={timeline ? `${timeline} days` : '—'} />
                                <InfoBox label="Status" value={statusCardValue} />
                                <InfoBox label="Last updated" value={formatDateTime(updatedAt)} />
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 md:justify-end">
                                {completedLike && reviewVendorId != null ? (
                                  <button
                                    type="button"
                                    onClick={() => openVendorReview(p)}
                                    className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                                  >
                                    {hasVendorReview ? 'Update review' : 'Review Jeweller'}
                                  </button>
                                ) : null}

                                {canTrack ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/customer/projects/${id}`)}
                                    className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-semibold text-primary-dark hover:bg-gray-50"
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
                                {/* Only a single bid window per project. Once a bid window exists, do not show Start Auction again. */}
                                {notStarted || (runningStarted && !hasBidHistory) ? (
                                  <button
                                    type="button"
                                    onClick={() => openStartBid(p)}
                                    disabled={
                                      isActionLoading(id, 'startBid') ||
                                      biddingRunning ||
                                      (runningStarted && !hasBidHistory)
                                    }
                                    title={
                                      biddingRunning
                                        ? 'Auction already running'
                                        : runningStarted && !hasBidHistory
                                          ? 'No bidding history found'
                                          : undefined
                                    }
                                    className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isActionLoading(id, 'startBid') ? 'Starting…' : 'Start Auction'}
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
                                    className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    View Bids
                                  </button>
                                ) : null}

                                {!completedLike ? (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(p)}
                                    className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
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
                      <button
                        type="button"
                        onClick={() => loadProjects({ nextPage: listPage + 1, append: true })}
                        disabled={listMoreLoading}
                        className="w-full py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {listMoreLoading ? 'Loading…' : 'Load more'}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : mainTab === 'assignments' ? (
              <div className="h-full min-h-0">
                {listLoading ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
                    <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : assignmentRows.length === 0 ? (
                  <div className="min-h-[calc(100vh-260px)] flex items-center justify-center px-4">
                    <div className="text-center">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                          <path d="M8 10h8" />
                          <path d="M8 14h5" />
                        </svg>
                      </div>
                      <p className="mt-3 text-[14px] font-bold text-gray-900">No assignment requests yet</p>
                      <p className="mt-1 text-[12px] text-gray-500">When you receive assignments, they’ll appear here.</p>
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
                            className="w-full sm:w-[320px] max-w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                          />
                        </div>
                        <div className="text-[12px] font-semibold text-gray-500">
                          {filteredAssignmentRows.length} {filteredAssignmentRows.length === 1 ? 'record' : 'records'}
                        </div>
                      </div>
                    </div>

                    {filteredAssignmentRows.length === 0 ? (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
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
                            ? 'bg-gray-50 border-gray-100 text-gray-700'
                            : 'bg-amber-50 border-amber-100 text-amber-700';
                    return (
                      <div key={String(a?.id ?? a?._id ?? `${pid}-${idx}`)} className="rounded-2xl border border-gray-100 p-4 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13px] font-bold text-gray-900 truncate max-w-[90vw] sm:max-w-none">
                                {p?.title || 'Project'}
                              </p>
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusClass}`}>
                                {statusText}
                              </span>
                            </div>
                            <p className="mt-1 text-[12px] text-gray-400">
                              {status === 'pending' ? 'Pending with' : status === 'accepted' ? 'Accepted by' : 'Rejected by'}{' '}
                              <span className="font-semibold text-gray-600">{vendorLabel}</span>
                            </p>
                            {/* Mobile timestamp */}
                            {when ? <p className="mt-1 text-[12px] text-gray-400 sm:hidden">{formatDateTime(when)}</p> : null}
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-2">
                            {/* Desktop timestamp */}
                            {when ? (
                              <p className="hidden sm:block text-[12px] text-gray-400 text-right">
                                {formatDateTime(when)}
                              </p>
                            ) : null}
                            {status === 'accepted' && pid ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/customer/projects/${pid}`)}
                                className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-primary-dark hover:bg-gray-50"
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
                className="fixed inset-0 z-[120] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
                onMouseDown={closeCreateModal}
              >
                <div
                  className="w-full max-w-3xl md:w-[calc(100vw-64px)] md:max-w-6xl lg:max-w-7xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden h-[calc(100dvh-24px)] md:h-[calc(100dvh-64px)] flex flex-col"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="relative px-5 pt-4 border-b border-gray-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold text-gray-900">{editingId ? 'Edit Project' : 'Create Project'}</p>
                      <p className="mt-1 text-[12px] text-gray-400">
                        {editingId ? 'Editing an existing project (saved as draft).' : 'Creates a draft project.'}
                      </p>
                    </div>

                    {/* Desktop: consultation prompt centered in header row */}
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-4 flex-col items-center text-center gap-2 max-w-[52%]">
                      <p className="text-[14px] font-extrabold text-gray-800">
                        Need help bringing your idea together?
                      </p>
                      <a
                        href="mailto:sales@mirah.com?subject=Book%20a%20Consultation"
                        className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 transition-opacity"
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
                          className="hidden sm:inline-flex px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          New project
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={closeCreateModal}
                        disabled={createLoading || attachmentUploading || referenceUploading}
                        className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-b border-gray-50 bg-white">
                    {/* Mobile: compact consultation prompt above stepper */}
                    <div className="md:hidden mb-2 rounded-2xl border border-gray-100 bg-white px-4 pt-4 pb-3 flex flex-col items-center justify-center text-center gap-2">
                      <p className="text-[14px] font-extrabold text-gray-800 mt-1">
                        Need help bringing your idea together?
                      </p>
                      <a
                        href="mailto:sales@mirah.com?subject=Book%20a%20Consultation"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 transition-opacity"
                      >
                        Book a Consultation
                      </a>
                    </div>
                    <div className="sm:hidden mb-2 text-[13px] font-extrabold text-gray-900">
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
                                  active || done ? 'bg-primary-dark text-white border-primary-dark' : 'bg-white text-gray-400 border-gray-200'
                                }`}
                              >
                                {s.id}
                              </div>
                              <div className={`hidden sm:block text-[12px] font-bold whitespace-nowrap ${active || done ? 'text-gray-900' : 'text-gray-400'}`}>
                                {s.label}
                              </div>
                            </div>
                            {idx < stepLabels.length - 1 ? (
                              <div className={`flex-1 h-[2px] rounded-full ${done ? 'bg-primary-dark' : 'bg-gray-100'}`} />
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="h-full grid grid-cols-1 md:grid-cols-[420px_1fr]">
                      {/* Left: reference image (desktop, always visible) */}
                      <div className="hidden md:block h-full overflow-y-auto border-r border-gray-100 bg-white px-5 py-5">
                        <div className="rounded-2xl border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Reference Image *</p>
                              <p className="text-[12px] text-gray-400">Upload one image as the project reference.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => referenceImageInputRef.current?.click()}
                              disabled={referenceUploading}
                              className="px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {referenceUploading ? 'Uploading…' : createForm.referenceImage ? 'Change image' : 'Upload image'}
                            </button>
                          </div>

                          <div className="mt-4">
                            {String(createForm.referenceImage || '').trim() ? (
                              <div className="relative rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                                <SafeImage
                                  src={String(createForm.referenceImage || '').trim()}
                                  alt="Reference"
                                  className="w-full h-48 md:h-[360px] object-contain bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCreateForm((p) => ({ ...p, referenceImage: '' }))}
                                  disabled={referenceUploading}
                                  className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-black/55 text-white flex items-center justify-center hover:bg-black/65 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  aria-label="Remove reference image"
                                  title="Remove"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center min-h-[320px] flex flex-col items-center justify-center">
                                <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <path d="M21 15l-5-5L5 21" />
                                  </svg>
                                </div>
                                <p className="mt-3 text-[12px] text-gray-500">No reference image uploaded.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

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
                          <div className="rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Reference Image *</p>
                                <p className="text-[12px] text-gray-400">
                                  {String(createForm.referenceImage || '').trim() ? 'Reference image uploaded.' : 'No reference image uploaded.'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => referenceImageInputRef.current?.click()}
                                  disabled={referenceUploading}
                                  className="px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  {referenceUploading ? 'Uploading…' : createForm.referenceImage ? 'Change' : 'Upload'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMobileRefCollapsed((v) => !v)}
                                  className="w-10 h-10 rounded-xl border border-gray-100 text-gray-700 hover:bg-gray-50 flex items-center justify-center"
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
                            </div>

                            {!mobileRefCollapsed ? (
                              <div className="mt-4">
                                {String(createForm.referenceImage || '').trim() ? (
                                  <div className="relative rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                                    <SafeImage
                                      src={String(createForm.referenceImage || '').trim()}
                                      alt="Reference"
                                      className="w-full h-48 object-contain bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setCreateForm((p) => ({ ...p, referenceImage: '' }))}
                                      disabled={referenceUploading}
                                      className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-black/55 text-white flex items-center justify-center hover:bg-black/65 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                      aria-label="Remove reference image"
                                      title="Remove"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center min-h-[220px] flex flex-col items-center justify-center">
                                    <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <path d="M21 15l-5-5L5 21" />
                                      </svg>
                                    </div>
                                    <p className="mt-3 text-[12px] text-gray-500">No reference image uploaded.</p>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {createStep === 1 ? (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Title *</label>
                                <input
                                  value={createForm.title}
                                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                  placeholder="Enter project title"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Min amount (₹) *</label>
                                  <input
                                    type="number"
                                    value={createForm.minAmount}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, minAmount: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                    placeholder="10000"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Max amount (₹) *</label>
                                  <input
                                    type="number"
                                    value={createForm.maxAmount}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, maxAmount: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                    placeholder="20000"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Timeline (days) *</label>
                                <input
                                  type="number"
                                  value={createForm.timelineExpected}
                                  onChange={(e) => setCreateForm((p) => ({ ...p, timelineExpected: e.target.value }))}
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                  placeholder="7"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Description *</label>
                              <textarea
                                rows={3}
                                value={createForm.description}
                                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                placeholder="Enter project description"
                              />
                            </div>
                          </div>
                        ) : null}

                        {createStep === 2 ? (
                      <div className="rounded-2xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Jewellery specifications</p>
                            <p className="text-[12px] text-gray-400">These details will be shared with the jeweller to prepare your order.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHowToMeasureOpen(true)}
                            className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                          >
                            How to Measure
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Jewellery type *</label>
                            <select
                              value={createForm?.specs?.jewelleryType || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), jewelleryType: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                            >
                              <option value="">Select</option>
                              {['Ring', 'Necklace', 'Bracelet', 'Flexi Bangle', 'Earrings', 'Pendant'].map((x) => (
                                <option key={x} value={x}>
                                  {x}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Size *</label>
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
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                            >
                              <option value="">Select</option>
                              {['XS', 'S', 'M', 'L', 'XL'].map((x) => (
                                <option key={x} value={x}>
                                  {x}
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
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                                  placeholder="Measurement"
                                />
                                <select
                                  value={createForm?.specs?.sizeCustomUnit || 'cm'}
                                  onChange={(e) =>
                                    setCreateForm((p) => ({
                                      ...p,
                                      specs: { ...(p.specs || {}), sizeCustomUnit: e.target.value },
                                    }))
                                  }
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                                >
                                  <option value="cm">cm</option>
                                  <option value="in">inches</option>
                                </select>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Metal type *</label>
                            <select
                              value={createForm?.specs?.metalType || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), metalType: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
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
                                <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Metal purity *</label>
                                <select
                                  value={createForm?.specs?.metalPurity || ''}
                                  onChange={(e) =>
                                    setCreateForm((p) => ({
                                      ...p,
                                      specs: { ...(p.specs || {}), metalPurity: e.target.value },
                                    }))
                                  }
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
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
                                <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Metal colour *</label>
                                <select
                                  value={createForm?.specs?.metalColour || ''}
                                  onChange={(e) =>
                                    setCreateForm((p) => ({
                                      ...p,
                                      specs: { ...(p.specs || {}), metalColour: e.target.value },
                                    }))
                                  }
                                  className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
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
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">
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
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                placeholder="Describe the exact combination and placement of colours"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Metal finish *</label>
                            <select
                              value={createForm?.specs?.metalFinish || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), metalFinish: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
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
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Does your design include stones? *</label>
                            <select
                              value={createForm?.specs?.stonesIncluded || 'no'}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), stonesIncluded: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </div>

                          {String(createForm?.specs?.stonesIncluded || '').toLowerCase() === 'yes' ? (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Stone type *</label>
                              <select
                                value={createForm?.specs?.stoneType || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), stoneType: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
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
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Preferred stone quality bracket *</label>
                              <select
                                value={createForm?.specs?.stoneQualityBracket || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), stoneQualityBracket: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                              >
                                <option value="">Select</option>
                                {['Standard', 'Premium', 'Luxury'].map((x) => (
                                  <option key={x} value={x}>
                                    {x}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[12px] text-gray-400">
                                Based on your selected quality bracket and budget, we will determine the appropriate stone colour, clarity, and size.
                              </p>
                            </div>
                          ) : null}

                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Stamping or engraving details</label>
                            <textarea
                              rows={3}
                              value={createForm?.specs?.engravingDetails || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), engravingDetails: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                              placeholder="Specify any initials, names, dates, or markings required"
                            />
                          </div>

                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Changes compared to reference image</label>
                            <textarea
                              rows={3}
                              value={createForm?.specs?.changesComparedToReference || ''}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), changesComparedToReference: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                              placeholder="Specify any changes beyond the selections above"
                            />
                          </div>
                        </div>
                      </div>
                        ) : null}

                    {createStep === 3 ? (
                      <div className="space-y-6">
                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Order details</p>
                          <p className="mt-1 text-[12px] text-gray-400">Provide quantities, budget, and delivery timeline.</p>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Budget per piece</label>
                              <input
                                type="number"
                                value={createForm?.specs?.budgetPerPiece || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), budgetPerPiece: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                placeholder="e.g. 25000"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Quantity required *</label>
                              <input
                                type="number"
                                value={createForm?.specs?.quantityRequired || ''}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), quantityRequired: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                placeholder="e.g. 1"
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Preferred delivery timeline *</label>
                              <input
                                type="date"
                                value={createForm?.specs?.preferredDeliveryTimeline || ''}
                                min={toDateInputValue(addDays(new Date(), 20) || new Date())}
                                onChange={(e) =>
                                  setCreateForm((p) => ({
                                    ...p,
                                    specs: { ...(p.specs || {}), preferredDeliveryTimeline: e.target.value },
                                  }))
                                }
                                className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                              />
                              <p className="text-[12px] text-gray-400">Minimum selectable date is 20 days from today.</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Extra Fields</p>
                              <p className="text-[12px] text-gray-400">Add custom label/value pairs for this project.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCreateForm((p) => ({
                                  ...p,
                                  metaFields: [...(p.metaFields || []), { key: '', label: '', value: '' }],
                                }))
                              }
                              className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              Add field
                            </button>
                          </div>

                          {(createForm.metaFields || []).length ? (
                            <div className="mt-4 space-y-3">
                              {(createForm.metaFields || []).map((ef, idx) => (
                                <div key={`mf-${idx}`} className="rounded-xl border border-gray-100 p-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Label</label>
                                      <input
                                        value={ef?.label ?? ''}
                                        onChange={(e) => {
                                          const label = e.target.value;
                                          const key = normalizeExtraFieldKey(label);
                                          setCreateForm((p) => ({
                                            ...p,
                                            metaFields: (p.metaFields || []).map((x, i) =>
                                              i === idx ? { ...(x || {}), label, key } : x,
                                            ),
                                          }));
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                        placeholder="e.g. Material"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Value</label>
                                      <input
                                        value={ef?.value ?? ''}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setCreateForm((p) => ({
                                            ...p,
                                            metaFields: (p.metaFields || []).map((x, i) => (i === idx ? { ...(x || {}), value } : x)),
                                          }));
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                        placeholder="e.g. Gold"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCreateForm((p) => ({
                                          ...p,
                                          metaFields: (p.metaFields || []).filter((_, i) => i !== idx),
                                        }))
                                      }
                                      className="text-[12px] font-semibold text-red-600 hover:underline cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 text-[12px] text-gray-400">No extra fields added.</div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Attachments</p>
                              <p className="text-[12px] text-gray-400">Upload project attachments (images/PDF).</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => attachmentInputRef.current?.click()}
                              disabled={attachmentUploading}
                              className="px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                                  className={`relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50 ${isPdfUrl(url) ? 'cursor-pointer' : ''}`}
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
                                      setCreateForm((p) => ({ ...p, attachments: coerceUrlArray(p.attachments).filter((_, i) => i !== idx) }))
                                    }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
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
                            <div className="mt-4 text-[12px] text-gray-400">No attachments uploaded.</div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Additional notes for the manufacturer</label>
                          <textarea
                            rows={3}
                            value={createForm?.specs?.additionalNotes || ''}
                            onChange={(e) =>
                              setCreateForm((p) => ({
                                ...p,
                                specs: { ...(p.specs || {}), additionalNotes: e.target.value },
                              }))
                            }
                            className="mt-2 w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                            placeholder="Any additional details you want to share"
                          />
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <label className="flex items-start gap-2 text-[12px] text-primary-dark cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(createForm?.specs?.confirmSpecs)}
                              onChange={(e) =>
                                setCreateForm((p) => ({
                                  ...p,
                                  specs: { ...(p.specs || {}), confirmSpecs: e.target.checked },
                                }))
                              }
                              className="mt-0.5 w-4 h-4 rounded border-gray-200 text-primary-dark focus:ring-primary-dark/30"
                            />
                            <span className="font-medium text-gray-700">
                              I confirm that all specifications provided are accurate and final. I understand that any changes after this stage may impact pricing and delivery timelines. I agree to the platform’s terms and conditions.
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {createStep === 4 ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[13px] font-extrabold text-gray-900">Review</p>
                          <p className="mt-1 text-[12px] text-gray-400">Confirm all details before submitting.</p>
                        </div>

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
                              {feasibilitySuggestions.map((s, idx) => (
                                <li key={`sug-${idx}`} className="flex items-start gap-2 text-[13px] text-amber-900">
                                  <span className="mt-[2px] w-5 h-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-[11px] font-extrabold text-amber-800">
                                    {idx + 1}
                                  </span>
                                  <span className="text-amber-900">{String(s)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Project</p>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                            <div><span className="text-gray-400">Title:</span> <span className="font-semibold text-gray-800">{createForm.title || '—'}</span></div>
                            <div><span className="text-gray-400">Budget:</span> <span className="font-semibold text-gray-800">{createForm.minAmount && createForm.maxAmount ? `₹ ${formatMoney(Number(createForm.minAmount) || 0)} - ₹ ${formatMoney(Number(createForm.maxAmount) || 0)}` : '—'}</span></div>
                            <div><span className="text-gray-400">Timeline:</span> <span className="font-semibold text-gray-800">{createForm.timelineExpected ? `${createForm.timelineExpected} days` : '—'}</span></div>
                            <div className="md:col-span-2"><span className="text-gray-400">Description:</span> <span className="font-semibold text-gray-800">{createForm.description || '—'}</span></div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Jewellery specifications</p>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                            <div><span className="text-gray-400">Jewellery type:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.jewelleryType || '—'}</span></div>
                            <div><span className="text-gray-400">Size:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.sizeMode === 'custom' ? `${createForm?.specs?.sizeCustomValue || '—'} ${createForm?.specs?.sizeCustomUnit || ''}`.trim() : (createForm?.specs?.sizeStandard || '—')}</span></div>
                            <div><span className="text-gray-400">Metal:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.metalType || '—'}</span></div>
                            <div><span className="text-gray-400">Finish:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.metalFinish || '—'}</span></div>
                            {String(createForm?.specs?.metalPurity || '').trim() ? (
                              <div><span className="text-gray-400">Metal purity:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.metalPurity}</span></div>
                            ) : null}
                            {String(createForm?.specs?.metalColour || '').trim() ? (
                              <div><span className="text-gray-400">Metal colour:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.metalColour}</span></div>
                            ) : null}
                            {String(createForm?.specs?.twoToneDetails || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-gray-400">Two-tone details:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.twoToneDetails}</span></div>
                            ) : null}
                            <div><span className="text-gray-400">Stones included:</span> <span className="font-semibold text-gray-800">{String(createForm?.specs?.stonesIncluded || 'no').toLowerCase() === 'yes' ? 'Yes' : 'No'}</span></div>
                            {String(createForm?.specs?.stoneType || '').trim() ? (
                              <div><span className="text-gray-400">Stone type:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.stoneType}</span></div>
                            ) : null}
                            {String(createForm?.specs?.stoneQualityBracket || '').trim() ? (
                              <div><span className="text-gray-400">Stone quality bracket:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.stoneQualityBracket}</span></div>
                            ) : null}
                            {String(createForm?.specs?.engravingDetails || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-gray-400">Stamping / engraving:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.engravingDetails}</span></div>
                            ) : null}
                            {String(createForm?.specs?.changesComparedToReference || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-gray-400">Changes vs reference:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.changesComparedToReference}</span></div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Order details</p>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                            <div><span className="text-gray-400">Budget per piece:</span> <span className="font-semibold text-gray-800">{String(createForm?.specs?.budgetPerPiece || '').trim() || '—'}</span></div>
                            <div><span className="text-gray-400">Quantity:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.quantityRequired || '—'}</span></div>
                            <div className="md:col-span-2"><span className="text-gray-400">Preferred delivery:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.preferredDeliveryTimeline || '—'}</span></div>
                            {String(createForm?.specs?.additionalNotes || '').trim() ? (
                              <div className="md:col-span-2"><span className="text-gray-400">Additional notes:</span> <span className="font-semibold text-gray-800">{createForm?.specs?.additionalNotes}</span></div>
                            ) : null}
                            <div className="md:col-span-2">
                              <span className="text-gray-400">Confirmation:</span>{' '}
                              <span className="font-semibold text-gray-800">{createForm?.specs?.confirmSpecs ? 'Confirmed' : 'Not confirmed'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Extra fields</p>
                          {Array.isArray(createForm?.metaFields) && createForm.metaFields.some((x) => String(x?.label || '').trim() || String(x?.value || '').trim()) ? (
                            <div className="mt-3 space-y-2">
                              {createForm.metaFields
                                .filter((x) => String(x?.label || '').trim() || String(x?.value || '').trim())
                                .map((x, idx) => (
                                  <div key={`review-mf-${idx}`} className="flex items-start justify-between gap-3 text-[13px]">
                                    <div className="text-gray-700 font-semibold">{String(x?.label || '').trim() || 'Label'}</div>
                                    <div className="text-gray-600 text-right">{String(x?.value || '').trim() || '—'}</div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[12px] text-gray-400">No extra fields added.</div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4">
                          <p className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Attachments</p>
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
                                  className={`rounded-xl overflow-hidden border border-gray-100 bg-gray-50 ${isPdfUrl(url) ? 'cursor-pointer' : ''}`}
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
                            <div className="mt-2 text-[12px] text-gray-400">No attachments uploaded.</div>
                          )}
                        </div>

                        
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

                  <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white flex items-center justify-between gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                    <button
                      type="button"
                      onClick={() => setCreateStep((s) => Math.max(1, Number(s || 1) - 1))}
                      disabled={createLoading || attachmentUploading || referenceUploading || createStep === 1}
                      className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Back
                    </button>

                    {createStep < 4 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const err = validateStep(createStep);
                          if (err) {
                            addToast(err, 'error');
                            return;
                          }
                          setCreateStep((s) => Math.min(4, Number(s || 1) + 1));
                        }}
                        disabled={createLoading || attachmentUploading || referenceUploading}
                        className="px-5 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createStep === 3 ? 'Review' : 'Next'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const err1 = validateStep(1);
                          const err2 = err1 ? null : validateStep(2);
                          const err3 = err1 || err2 ? null : validateStep(3);
                          const err = err1 || err2 || err3;
                          if (err) {
                            addToast(err, 'error');
                            setCreateStep(err1 ? 1 : err2 ? 2 : 3);
                            return;
                          }
                          saveProject();
                        }}
                        disabled={createLoading || attachmentUploading || referenceUploading}
                        className="px-5 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createLoading ? 'Saving…' : editingId ? 'Update Project' : 'Create Project'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* How to measure modal */}
      {howToMeasureOpen ? (
        <div
          className="fixed inset-0 z-[130] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setHowToMeasureOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">How to Measure</p>
                {createForm?.specs?.jewelleryType ? (
                  <p className="mt-1 text-[12px] text-gray-400 truncate">{String(createForm.specs.jewelleryType)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setHowToMeasureOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">{howToMeasureText}</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => setHowToMeasureOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Start auction modal */}
      {startBidOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setStartBidOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Start Auction</p>
                {startBidFor?.title ? (
                  <p className="mt-1 text-[12px] text-gray-400 truncate">{startBidFor.title}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setStartBidOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              <label className="text-[11px] font-medium text-primary-dark uppercase tracking-wide">Finishing date & time *</label>
              <input
                type="datetime-local"
                value={startBidEndsAt}
                onChange={(e) => setStartBidEndsAt(e.target.value)}
                min={startBidMin || undefined}
                className="mt-2 w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
              />
              <p className="mt-2 text-[12px] text-gray-400">
                Choose when bidding should end (must be a future time).
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => setStartBidOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStartBid}
                disabled={Boolean(startBidFor?.id) && isActionLoading(startBidFor.id, 'startBid')}
                className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Boolean(startBidFor?.id) && isActionLoading(startBidFor.id, 'startBid') ? 'Starting…' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Force stop auction modal */}
      {forceStopOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4"
          onMouseDown={() => setForceStopOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">Force End</p>
              <p className="mt-1 text-[12px] text-gray-500">This will force-end the current bid window now (does not cancel the project).</p>
            </div>

            <div className="px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForceStopOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
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
      ) : null}

      {/* Delete project modal */}
      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            setDeleteOpen(false);
            setDeleteFor(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">Delete project</p>
              <p className="mt-1 text-[12px] text-gray-500">
                Delete <span className="font-semibold text-gray-800">{deleteFor?.title || 'this project'}</span>? This cannot be undone.
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
                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
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
          className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeVendorReview}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Review Jeweller</p>
                <p className="mt-1 text-[12px] text-gray-500 truncate">
                  {vendorReviewFor?.vendorName ? (
                    <>
                      For <span className="font-semibold text-gray-800">{vendorReviewFor.vendorName}</span>
                    </>
                  ) : (
                    'For Jeweller'
                  )}
                </p>
                {vendorReviewFor?.projectTitle ? (
                  <p className="mt-1 text-[11px] text-gray-400 truncate">{vendorReviewFor.projectTitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeVendorReview}
                disabled={Boolean(vendorReviewDraft?.submitting)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-[11px] font-extrabold text-gray-700">Your rating</p>
              {vendorReviewFor?.hasReview ? (
                <p className="mt-1 text-[11px] text-gray-400">Already reviewed • Update anytime</p>
              ) : (
                <p className="mt-1 text-[11px] text-gray-400">Not reviewed yet</p>
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
                      className={`p-1 rounded-md ${filled ? 'text-amber-400' : 'text-gray-200'} disabled:opacity-50`}
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
                  className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-medium text-gray-700 focus:outline-none focus:border-primary-dark disabled:opacity-60"
                  placeholder="Comment (optional)"
                />
              </div>

              <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-primary-dark select-none">
                <input
                  type="checkbox"
                  checked={Boolean(vendorReviewDraft?.isAnonymous)}
                  onChange={(e) => setVendorReviewDraft((d) => ({ ...(d || {}), isAnonymous: e.target.checked }))}
                  disabled={Boolean(vendorReviewDraft?.submitting)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-dark focus:ring-primary-dark/30"
                />
                Post as anonymous
              </label>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={closeVendorReview}
                disabled={Boolean(vendorReviewDraft?.submitting)}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitVendorReview}
                disabled={Boolean(vendorReviewDraft?.submitting)}
                className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
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
          className="fixed inset-0 z-[95] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => {
            setCancelOpen(false);
            setCancelFor(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">Cancel Project</p>
              <p className="mt-1 text-[12px] text-gray-500">
                Cancel <span className="font-semibold text-gray-800">{cancelFor?.title || 'this project'}</span>? This will end the project and close any active bidding.
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
                  className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
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
