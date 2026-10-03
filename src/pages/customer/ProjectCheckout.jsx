import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import { formatCurrency } from '../../utils/formatMoney';

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
  const root = raw ?? {};
  const data = root?.data ?? root?.result ?? root ?? {};
  const orderLike =
    data?.order ??
    data?.razorpayOrder ??
    data?.razorpay_order ??
    (data?.entity === 'order' ? data : null) ??
    null;
  const orderId =
    orderLike?.id ?? orderLike?.orderId ?? orderLike?.razorpayOrderId ?? orderLike?.razorpay_order_id ?? null;
  const currency = orderLike?.currency ?? data?.currency ?? 'INR';
  const keyId = data?.keyId ?? data?.key_id ?? data?.key ?? envKeyId ?? null;
  return { orderId, currency, keyId };
}

async function copyText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function FieldRow({ label, value, onCopy }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-pale last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-[13px] font-semibold text-ink break-all">{value || '—'}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-pale bg-white text-[11px] font-bold text-mid hover:bg-cream"
      >
        Copy
      </button>
    </div>
  );
}

export default function ProjectCheckout() {
  const { id } = useParams();
  const projectId = Number(id);
  const [searchParams] = useSearchParams();
  const typeParam = String(searchParams.get('type') || '').trim().toLowerCase();
  const type = typeParam === 'final' ? 'final' : typeParam === 'advance' ? 'advance' : null;

  const navigate = useNavigate();
  const { addToast } = useOutletContext();

  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(null);
  const [method, setMethod] = useState(null); // 'online' | 'bank'
  const [transferKind, setTransferKind] = useState('domestic');
  const [paymentReference, setPaymentReference] = useState(null);
  const [ledgerId, setLedgerId] = useState(null);
  const [reportedAt, setReportedAt] = useState(null);
  const [note, setNote] = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || !type) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await projectService.getCheckout(projectId, { type });
      setCheckout(data);
      const open = data?.bankTransfer?.openLedger;
      if (open?.paymentReference) {
        setPaymentReference(open.paymentReference);
        setLedgerId(open.id);
        setReportedAt(open.transferReportedAt || null);
        if (open.transferKind === 'international' || open.transferKind === 'domestic') {
          setTransferKind(open.transferKind);
        }
        setMethod('bank');
      }
    } catch (e) {
      addToast(e?.message || 'Failed to load checkout', 'error');
      setCheckout(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, projectId, type]);

  useEffect(() => {
    load();
  }, [load]);

  const amountLabel = useMemo(() => {
    if (!checkout) return '—';
    const cur = checkout.presentmentCurrency || 'INR';
    const amt = checkout.presentmentAmount ?? checkout.amountInr;
    return formatCurrency(amt, cur);
  }, [checkout]);

  const activeFields = useMemo(() => {
    const tab = transferKind === 'international' ? checkout?.bankTransfer?.international : checkout?.bankTransfer?.domestic;
    return Array.isArray(tab?.fields) ? tab.fields : [];
  }, [checkout, transferKind]);

  const activeBankMeta = useMemo(() => {
    return transferKind === 'international' ? checkout?.bankTransfer?.international : checkout?.bankTransfer?.domestic;
  }, [checkout, transferKind]);

  const ensureInitiated = async () => {
    if (paymentReference && ledgerId) return { paymentReference, ledgerId };
    setInitLoading(true);
    try {
      const data = await projectService.initiateBankTransfer(projectId, { type, transferKind });
      setPaymentReference(data?.paymentReference || null);
      setLedgerId(data?.ledgerId || null);
      return data;
    } finally {
      setInitLoading(false);
    }
  };

  const selectBank = async () => {
    setMethod('bank');
    try {
      await ensureInitiated();
    } catch (e) {
      addToast(e?.message || 'Could not start bank transfer', 'error');
    }
  };

  const onTransferKindChange = async (next) => {
    setTransferKind(next);
    if (method !== 'bank') return;
    // Keep existing open ledger; only update local tab. Reference stays.
  };

  const handleCopy = async (value, label) => {
    const ok = await copyText(value);
    addToast(ok ? `${label} copied` : 'Copy failed', ok ? 'success' : 'error');
  };

  const handleReport = async () => {
    if (reportLoading) return;
    setReportLoading(true);
    try {
      const init = await ensureInitiated();
      const data = await projectService.reportBankTransfer(projectId, {
        type,
        ledgerId: init?.ledgerId || ledgerId,
        transferKind,
        note: note.trim() || undefined,
      });
      setReportedAt(data?.transferReportedAt || new Date().toISOString());
      addToast('Transfer reported — awaiting payment verification', 'success');
      await load();
    } catch (e) {
      addToast(e?.message || 'Failed to report transfer', 'error');
    } finally {
      setReportLoading(false);
    }
  };

  const handleOnlinePay = async () => {
    if (payLoading || !type) return;
    setPayLoading(true);
    setMethod('online');
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Razorpay failed to load');

      const raw = await projectService.createPaymentOrder(projectId, { type });
      const envKeyId =
        import.meta.env?.VITE_RAZORPAY_KEY_ID ?? import.meta.env?.VITE_RAZORPAY_KEY ?? null;
      const parsed = parseProjectPaymentOrder(raw, envKeyId);
      if (!parsed.orderId) throw new Error('Payment init failed (missing Razorpay orderId)');
      if (!parsed.keyId) throw new Error('Payment init failed (missing Razorpay keyId)');

      let handlerInvoked = false;
      const options = {
        key: parsed.keyId,
        order_id: parsed.orderId,
        currency: parsed.currency || 'INR',
        name: 'Arviah',
        description: type === 'advance' ? 'Payment' : 'Final payment',
        modal: {
          ondismiss: () => {
            if (handlerInvoked) return;
            addToast('Payment not completed.', 'error');
          },
        },
        handler: async (response) => {
          handlerInvoked = true;
          try {
            await projectService.verifyPayment(projectId, {
              type,
              razorpay_order_id: response?.razorpay_order_id,
              razorpay_payment_id: response?.razorpay_payment_id,
              razorpay_signature: response?.razorpay_signature,
            });
            addToast('Payment successful', 'success');
            navigate(`/customer/projects/${projectId}`, { replace: true });
          } catch (e) {
            addToast(e?.message || 'Payment verification failed', 'error');
          }
        },
        theme: { color: '#6B5545' },
      };
      new window.Razorpay(options).open();
    } catch (e) {
      addToast(e?.message || 'Payment failed', 'error');
    } finally {
      setPayLoading(false);
    }
  };

  const handleInvoice = async () => {
    if (invoiceLoading) return;
    setInvoiceLoading(true);
    try {
      await projectService.downloadInvoice(projectId, { title: checkout?.project?.title });
    } catch (e) {
      addToast(e?.message || 'Failed to download invoice', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  };

  if (!type) {
    return (
      <div className="w-full pt-4 sm:pt-5 pb-10">
        <div className="rounded-2xl border border-pale bg-white p-6 text-[13px] text-mid">
          Missing payment type. Go back and choose Pay Advance or Pay Final.
          <button
            type="button"
            className="mt-4 block px-4 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold"
            onClick={() => navigate(`/customer/projects/${projectId || ''}`)}
          >
            Back to project
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full pt-4 sm:pt-5 pb-10 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-pale" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="h-80 rounded-2xl border border-pale bg-white" />
          <div className="h-64 rounded-2xl border border-pale bg-white" />
        </div>
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="w-full pt-4 sm:pt-5 pb-10">
        <div className="rounded-2xl border border-pale bg-white p-6 text-[13px] text-mid">
          Checkout is unavailable for this project payment.
          <button
            type="button"
            className="mt-4 block px-4 py-2 rounded-xl border border-pale text-[12px] font-bold"
            onClick={() => navigate(`/customer/projects/${projectId}`)}
          >
            Back to project
          </button>
        </div>
      </div>
    );
  }

  const awaiting = Boolean(reportedAt || checkout?.bankTransfer?.openLedger?.awaitingVerification);
  const makerName = checkout?.maker?.name || 'Assigned jeweller';
  const typeLabel = checkout.fullUpfront ? 'Payment' : type === 'advance' ? 'Advance' : 'Final';

  return (
    <div className="w-full pt-4 sm:pt-5 pb-10 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            type="button"
            onClick={() => navigate(`/customer/projects/${projectId}`)}
            className="text-[12px] font-bold text-muted hover:text-ink"
          >
            ← Back to project
          </button>
          <h1 className="mt-2 text-[22px] font-extrabold text-ink tracking-tight">Checkout</h1>
          <p className="mt-1 text-[13px] text-muted">
            {typeLabel} for <span className="font-semibold text-ink">{checkout.project?.title || 'project'}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-pale bg-white px-4 py-3 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Amount due</p>
          <p className="mt-0.5 text-[18px] font-extrabold text-ink">{amountLabel}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="space-y-4 order-2 lg:order-1">
          {!method ? (
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={handleOnlinePay}
                disabled={payLoading || awaiting}
                className="text-left rounded-2xl border border-pale bg-white p-5 hover:border-walnut/40 transition disabled:opacity-60"
              >
                <p className="text-[14px] font-extrabold text-ink">Pay online</p>
                <p className="mt-2 text-[12px] text-muted leading-relaxed">
                  Card / UPI via Payment Gateway. Payment gateway fees may apply.
                </p>
                <span className="mt-4 inline-flex px-4 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold">
                  {payLoading ? 'Opening…' : 'Continue Online'}
                </span>
              </button>
              <button
                type="button"
                onClick={selectBank}
                disabled={initLoading}
                className="text-left rounded-2xl border border-pale bg-white p-5 hover:border-walnut/40 transition disabled:opacity-60"
              >
                <p className="text-[14px] font-extrabold text-ink">Pay by bank transfer</p>
                <p className="mt-2 text-[12px] text-muted leading-relaxed">No PG handling fees. Manual verification after you send.</p>
                <span className="mt-4 inline-flex px-4 py-2 rounded-xl border border-walnut text-walnut text-[12px] font-bold">
                  {initLoading ? 'Preparing…' : 'Use Bank Transfer'}
                </span>
              </button>
            </div>
          ) : null}

          {method === 'online' ? (
            <div className="rounded-2xl border border-pale bg-white p-5">
              <p className="text-[14px] font-extrabold text-ink">Pay online</p>
              <p className="mt-2 text-[12px] text-muted">
                Complete the Payment Gateway window to finish payment. Gateway fees may apply.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleOnlinePay}
                  disabled={payLoading}
                  className="px-5 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-bold disabled:opacity-50"
                >
                  {payLoading ? 'Opening…' : 'Open payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setMethod(null)}
                  className="px-5 py-2.5 rounded-xl border border-pale text-[12px] font-bold text-mid"
                >
                  Choose another method
                </button>
              </div>
            </div>
          ) : null}

          {method === 'bank' ? (
            <div className="rounded-2xl border border-pale bg-white p-5 md:p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[14px] font-extrabold text-ink">Bank transfer</p>
                  <p className="mt-1 text-[12px] text-muted">No PG handling fees</p>
                </div>
                {awaiting ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-extrabold">
                    Awaiting payment
                  </span>
                ) : null}
              </div>

              <ol className="mt-4 space-y-2 text-[12px] text-mid list-decimal list-inside">
                <li>Copy the bank details for your transfer type.</li>
                <li>Include the payment reference in your transfer description / remittance.</li>
                <li>Return here and tap “I’ve sent the bank transfer” after sending.</li>
              </ol>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onTransferKindChange('domestic')}
                  className={`text-left rounded-2xl border bg-white px-4 py-3 transition ${
                    transferKind === 'domestic'
                      ? 'border-walnut text-ink ring-1 ring-walnut'
                      : 'border-pale text-ink hover:border-walnut/40'
                  }`}
                >
                  <p className="text-[13px] font-extrabold">Domestic</p>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">Local bank transfer details</p>
                </button>
                <button
                  type="button"
                  onClick={() => onTransferKindChange('international')}
                  className={`text-left rounded-2xl border bg-white px-4 py-3 transition ${
                    transferKind === 'international'
                      ? 'border-walnut text-ink ring-1 ring-walnut'
                      : 'border-pale text-ink hover:border-walnut/40'
                  }`}
                >
                  <p className="text-[13px] font-extrabold">International</p>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">Cross-border / SWIFT details</p>
                </button>
              </div>
              {activeBankMeta?.countryName ? (
                <p className="mt-2 text-[11px] text-muted">
                  Showing {activeBankMeta.countryName}
                  {activeBankMeta.usedDefault ? ' (system default fallback)' : ''} details
                </p>
              ) : null}

              <div className="mt-4 rounded-2xl border border-pale bg-cream/40 px-4">
                {activeFields.length ? (
                  activeFields.map((f, idx) => (
                    <FieldRow
                      key={`${f.label}-${idx}`}
                      label={f.label}
                      value={f.value}
                      onCopy={() => handleCopy(f.value, f.label || 'Field')}
                    />
                  ))
                ) : (
                  <p className="py-4 text-[12px] text-muted">No bank fields configured for this tab.</p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-walnut/30 bg-walnut/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-walnut">Payment reference</p>
                    <p className="mt-1 text-[15px] font-extrabold text-ink tracking-wide break-all">
                      {paymentReference || checkout?.bankTransfer?.openLedger?.paymentReference || '—'}
                    </p>
                    <p className="mt-2 text-[11px] text-muted leading-relaxed">
                      Put this exact reference on your transfer so we can match it. Your bank or intermediary may apply FX charges.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        paymentReference || checkout?.bankTransfer?.openLedger?.paymentReference,
                        'Payment reference',
                      )
                    }
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-walnut text-blush text-[11px] font-bold"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {!awaiting ? (
                <div className="mt-4">
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wide">
                    Optional note / UTR
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-pale bg-white px-3 py-2 text-[13px] text-ink"
                    placeholder="e.g. UTR or sender name"
                  />
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={reportLoading || awaiting || initLoading}
                  className="px-5 py-2.5 rounded-xl bg-walnut text-blush text-[12px] font-bold disabled:opacity-50"
                >
                  {awaiting
                    ? 'Awaiting payment'
                    : reportLoading
                      ? 'Reporting…'
                      : 'I’ve sent the bank transfer'}
                </button>
                <button
                  type="button"
                  onClick={() => setMethod(null)}
                  className="px-5 py-2.5 rounded-xl border border-pale text-[12px] font-bold text-mid"
                >
                  Choose another method
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-pale bg-white p-5 space-y-4 order-1 lg:order-2 lg:sticky lg:top-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Order</p>
            <p className="mt-1 text-[14px] font-extrabold text-ink">{checkout.project?.title || '—'}</p>
            <p className="mt-1 text-[12px] text-muted">Maker: {makerName}</p>
          </div>
          <div className="border-t border-pale pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Amount due</p>
            <p className="mt-1 text-[16px] font-extrabold text-ink">{amountLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleInvoice}
            disabled={invoiceLoading}
            className="w-full px-4 py-2.5 rounded-xl border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
          >
            {invoiceLoading ? 'Preparing…' : 'Download Invoice'}
          </button>
          <div className="rounded-xl bg-cream border border-pale p-3 text-[11px] text-muted leading-relaxed">
            <p className="font-bold text-ink text-[12px]">What happens next</p>
            <p className="mt-1.5">
              Online payments confirm immediately. Bank transfers stay <span className="font-semibold text-ink">Awaiting payment</span> until Arviah verifies the credit.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
