import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { vendorService } from '../../services/vendorService';

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${datePart}, ${timePart}`;
}

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isFinishedLike(project) {
  const status = String(project?.status ?? '').trim().toLowerCase();
  const projectStatus = String(project?.projectStatus ?? project?.project_status ?? '').trim().toLowerCase();
  return Boolean(project?.isFinished) || status === 'finished' || projectStatus === 'completed';
}

function normalizePaymentStatus(status, { finishedLike } = {}) {
  const s = String(status ?? '').trim().toLowerCase();
  if (finishedLike && (!s || s === 'not_applicable')) return 'paid';
  return s || '—';
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

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorDetails, setVendorDetails] = useState(null);
  const abortRef = useRef(null);
  const vendorAbortRef = useRef(null);

  const project = details?.project ?? details?.data?.project ?? details?.projectDetails ?? details?.item ?? details?.data ?? details ?? null;
  const activeBidWindow = details?.activeBidWindow ?? details?.active_bid_window ?? null;
  const advancePayment = details?.advancePayment ?? details?.advance_payment ?? null;
  const finalPayment = details?.finalPayment ?? details?.final_payment ?? null;

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
      addToast(e?.message || 'Failed to load project', 'error');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, projectId]);

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

      const options = {
        key: parsed.keyId,
        order_id: parsed.orderId,
        currency: parsed.currency || 'INR',
        name: 'Mirah',
        description: type === 'advance' ? 'Advance payment' : 'Final payment',
        handler: async (response) => {
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
        theme: { color: '#0F2A4F' },
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

  const statusPillText = useMemo(() => {
    const ps = String(projectStatusLabel ?? '').trim();
    if (ps && ps !== '—') return ps;
    return toTitleCase(project?.status || '—');
  }, [project, projectStatusLabel]);

  return (
    <div className="w-full pb-10 animate-fade-in">
      {verifyingPayment ? (
        <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[1px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary-dark/10 border border-primary-dark/15 flex items-center justify-center text-primary-dark shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-extrabold text-gray-900">Verifying payment…</p>
                  <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="mt-1 text-[12px] text-gray-400">Please wait, do not close the app.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
        <div className="relative flex flex-col gap-3">
          {/* Mobile actions */}
          <div className="shrink-0 flex items-center gap-2 w-full justify-between md:hidden">
            <button
              type="button"
              onClick={() => navigate('/dashboard/projects')}
              className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              Back
            </button>
            <span className="px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-[12px] font-extrabold whitespace-nowrap">
              {statusPillText}
            </span>
          </div>

          {/* Desktop actions */}
          <button
            type="button"
            onClick={() => navigate('/dashboard/projects')}
            className="hidden md:inline-flex md:absolute md:left-6 md:top-6 px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            Back
          </button>
          <span className="hidden md:inline-flex md:absolute md:right-6 md:top-6 px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-[12px] font-extrabold whitespace-nowrap">
            {statusPillText}
          </span>

          <div className="min-w-0 flex flex-col items-center text-center md:px-32">
            <p className="text-[13px] text-gray-500 font-semibold break-words line-clamp-2 max-w-[860px]">
              {project?.title || 'Project'}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-extrabold text-gray-700">
                Bid amount:{' '}
                <span className="font-bold">
                  {assignedAmount != null && Number.isFinite(Number(assignedAmount)) ? `₹ ${formatMoney(assignedAmount)}` : '—'}
                </span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-extrabold text-gray-700">
                Duration:{' '}
                <span className="font-bold">
                  {assignedDays != null && Number.isFinite(Number(assignedDays)) ? `${Number(assignedDays)} days` : '—'}
                </span>
              </span>
            </div>
            {vendorFullName ? (
              <p className="mt-2 text-[12px] font-semibold text-gray-500">
                Vendor:{' '}
                <span className="font-extrabold text-gray-800">
                  {vendorLoading ? 'Loading…' : vendorFullName}
                </span>
              </p>
            ) : vendorId ? (
              <p className="mt-2 text-[12px] font-semibold text-gray-500">
                Vendor:{' '}
                <span className="font-extrabold text-gray-800">
                  {vendorLoading ? 'Loading…' : `#${vendorId}`}
                </span>
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
              <p className="text-[20px] md:text-[22px] font-extrabold text-gray-900">Tracking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 md:p-14 bg-gray-50 flex items-center justify-center">
            <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : !project ? (
          <div className="p-8 text-[13px] text-gray-600">Unable to load project.</div>
        ) : (
          <div className="p-4 md:p-6 space-y-4">
            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-[12px] font-extrabold text-gray-900">Overview</p>
              <p className="mt-2 text-[13px] text-gray-700 whitespace-pre-line">{project?.description || '—'}</p>
              {activeBidWindow ? (
                <div className="mt-3 text-[12px] text-gray-500">
                  Active auction ends at:{' '}
                  <span className="font-semibold text-gray-700">
                    {formatDateTime(activeBidWindow?.finishingTimestamp ?? activeBidWindow?.finishingAt ?? activeBidWindow?.finishing_at)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-extrabold text-gray-900">Payments</p>
                <button
                  type="button"
                  onClick={downloadInvoice}
                  disabled={invoiceLoading || !projectId}
                  className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {invoiceLoading ? 'Downloading…' : 'Download invoice'}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="text-[12px] font-bold text-gray-800">Advance</p>
                  <p className="mt-1 text-[12px] text-gray-500">
                    Status:{' '}
                    <span className="font-semibold text-gray-700">{toTitleCase(advanceStatus)}</span>
                  </p>
                  {advancePayment?.suggestedAmount != null ? (
                    <p className="mt-1 text-[12px] text-gray-500">
                      Suggested: <span className="font-semibold text-gray-700">₹ {formatMoney(advancePayment.suggestedAmount)}</span>
                    </p>
                  ) : null}
                  {advanceStatus === 'due' ? (
                    <button
                      type="button"
                      onClick={() => pay('advance')}
                      disabled={payLoading}
                      className="mt-3 w-full px-4 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {payLoading ? 'Processing…' : 'Pay Advance'}
                    </button>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="text-[12px] font-bold text-gray-800">Final</p>
                  <p className="mt-1 text-[12px] text-gray-500">
                    Status:{' '}
                    <span className="font-semibold text-gray-700">{toTitleCase(finalStatus)}</span>
                  </p>
                  {finalPayment?.suggestedAmount != null ? (
                    <p className="mt-1 text-[12px] text-gray-500">
                      Suggested: <span className="font-semibold text-gray-700">₹ {formatMoney(finalPayment.suggestedAmount)}</span>
                    </p>
                  ) : null}
                  {finalStatus === 'due' ? (
                    <button
                      type="button"
                      onClick={() => pay('final')}
                      disabled={payLoading}
                      className="mt-3 w-full px-4 py-2.5 rounded-xl bg-primary-dark text-white text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {payLoading ? 'Processing…' : 'Pay Final'}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                Note: Advance payment is required to start the project. Final payment can be paid after project completion.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

