import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';

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
  const data = raw?.data ?? raw?.order ?? raw ?? {};
  const orderId = data?.orderId ?? data?.razorpayOrderId ?? data?.razorpay_order_id ?? data?.id ?? null;
  const amount = data?.amount ?? data?.amountInPaise ?? data?.amount_in_paise ?? data?.amountInRupees ?? null;
  const currency = data?.currency ?? 'INR';
  const keyId = data?.keyId ?? data?.key ?? envKeyId ?? null;
  return { orderId, amount, currency, keyId, raw: data };
}

export default function ProjectDetails() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const abortRef = useRef(null);

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
  const budgetText =
    amountRange?.min != null || amountRange?.max != null
      ? `₹ ${formatMoney(amountRange?.min ?? 0)} - ₹ ${formatMoney(amountRange?.max ?? 0)}`
      : '—';

  return (
    <div className="w-full pb-10 animate-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[16px] md:text-[18px] font-extrabold text-gray-900 truncate">
              {project?.title || 'Project'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/projects')}
            className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
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
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Budget</p>
                  <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{budgetText}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Status</p>
                  <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{toTitleCase(project?.status || '—')}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Project status</p>
                  <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{toTitleCase(project?.projectStatus || project?.project_status || '—')}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 text-gray-700">Last updated</p>
                  <p className="text-[12px] font-semibold mt-0.5 truncate text-gray-800">{formatDateTime(project?.updatedAt ?? project?.updated_at)}</p>
                </div>
              </div>
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
                Note: Advance requires accepted assignment. Final requires advance already paid (per PRD).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

