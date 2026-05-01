import React from 'react';
import { createPortal } from 'react-dom';
import { formatMoney } from '../../utils/formatMoney';

function pickNum(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (let i = 0; i < keys.length; i += 1) {
    const v = obj[keys[i]];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function ModalRow({ label, value, muted }) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 ${muted ? 'text-muted' : ''}`}>
      <span className="text-[12px] font-semibold text-mid pr-2">{label}</span>
      <span className={`text-[12px] font-extrabold text-right tabular-nums shrink-0 ${muted ? '' : 'text-ink'}`}>
        ₹ {formatMoney(Number(value))}
      </span>
    </div>
  );
}

/**
 * Explains payable amount build-up from agreed quote → platform services → GST → delivery.
 * Intentionally does not mirror vendor-facing settlement lines (nett to vendor/admin).
 */
export function CustomerPriceBreakdownModal({ open, onClose, tariff, listingBudgetLabel, agreedQuoteAmount }) {
  if (!open || typeof document === 'undefined') return null;

  const J = pickNum(tariff, ['jewellerBidJ', 'jeweller_bid_j']);
  const P = pickNum(tariff, ['platformAdjustedPriceP', 'platform_adjusted_price_p']);
  const C = pickNum(tariff, ['commissionC', 'commission_c']);
  const Gj = pickNum(tariff, ['jewelleryGstGj', 'jewellery_gst_gj']);
  const Gc = pickNum(tariff, ['commissionGstGc', 'commission_gst_gc']);
  const D = pickNum(tariff, ['deliveryFeeD', 'delivery_fee_d']);
  const deliveryGst = pickNum(tariff, ['logisticsGstOnDelivery', 'logistics_gst_on_delivery']);
  const bundled = pickNum(tariff, ['bundledCustomerDue', 'bundled_customer_due']);
  const adv = pickNum(tariff, ['advanceCustomerDue', 'advance_customer_due']);
  const fin = pickNum(tariff, ['finalCustomerDue', 'final_customer_due']);

  const hasAny =
    [
      J,
      P,
      C,
      Gj,
      Gc,
      D,
      deliveryGst,
      bundled,
      adv,
      fin,
      agreedQuoteAmount != null && Number.isFinite(Number(agreedQuoteAmount)),
    ].some(Boolean);

  return createPortal(
    <div
      className="fixed inset-0 z-[220] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-price-breakdown-title"
      >
        <div className="px-5 py-4 border-b border-pale flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p id="customer-price-breakdown-title" className="text-[14px] font-extrabold text-ink">
              How your price is calculated
            </p>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              This is what you are asked to pay on Arviah: agreed quote, Arviah services, taxes, and delivery. It does not show
              partner settlement details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-cream text-muted shrink-0"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1 min-h-0">
          {!hasAny ? (
            <p className="text-[12px] text-muted py-6 text-center">Price breakdown isn’t available for this stage yet.</p>
          ) : (
            <>
              {listingBudgetLabel ? (
                <div className="mb-4 rounded-xl border border-pale bg-cream/40 px-3 py-2">
                  <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide">When you listed</p>
                  <p className="mt-1 text-[12px] text-mid">
                    Listed budget:&nbsp;<span className="font-extrabold text-ink">{listingBudgetLabel}</span>
                  </p>
                  {(agreedQuoteAmount != null && Number.isFinite(Number(agreedQuoteAmount))) || J != null ? (
                    <p className="mt-2 text-[12px] text-mid leading-relaxed">
                      After bids close, Arviah settles on an <strong className="text-ink">accepted quote</strong> for the scope of
                      work. Totals below use that quote and Arviah&apos;s tariff.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide mb-1">What goes into what you pay</p>
              <div className="rounded-xl border border-pale divide-y divide-pale px-3">
                {(agreedQuoteAmount != null && Number.isFinite(Number(agreedQuoteAmount))) ? (
                  <ModalRow label="Accepted quote for this project (pre-tax)" value={Number(agreedQuoteAmount)} />
                ) : (
                  <ModalRow label="Accepted quote — jewellery portion (pre-tax)" value={J} />
                )}
                <ModalRow label="Arviah platform, marketplace & QC services" value={C} />
                <ModalRow label="Pre-tax order value (jewellery + Arviah services)" value={P} />
                <ModalRow label="GST on jewellery" value={Gj} muted />
                <ModalRow label="GST on Arviah services" value={Gc} muted />
                <ModalRow label="Delivery" value={D} />
                <ModalRow label="GST on delivery" value={deliveryGst} muted />
              </div>

              <div className="mt-4 rounded-xl border border-walnut/20 bg-blush/30 px-3 py-1">
                <ModalRow label="Estimated total payable (including delivery & taxes)" value={bundled} />
              </div>

              {(adv != null || fin != null) ? (
                <div className="mt-4">
                  <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide mb-1">How you may pay</p>
                  <p className="text-[11px] text-muted mb-2 leading-relaxed">
                    Your payments are usually split across milestones approved at checkout — amounts are rounded per instalment rules.
                  </p>
                  <div className="rounded-xl border border-pale divide-y divide-pale px-3">
                    <ModalRow label="Suggested advance instalment" value={adv} />
                    <ModalRow label="Suggested final instalment (incl. delivery & delivery tax when applicable)" value={fin} />
                  </div>
                </div>
              ) : null}

              <p className="mt-4 text-[11px] text-muted leading-relaxed">
                Final amounts charged follow the payment step at checkout Payment Gateway. Small rounding differences of a few paise can
                occur; if something looks off, contact support.
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-pale shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-2xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Icon + text control that opens the price breakdown modal. */
export function CustomerPriceInfoButton({ onClick, disabled, label = 'How your price is calculated' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="group inline-flex items-center gap-1.5 shrink-0 max-w-[min(100%,18rem)] text-left sm:max-w-none sm:whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-walnut/35 bg-cream/90 text-[10px] font-extrabold leading-none text-walnut transition-colors group-hover:border-walnut/55 group-hover:bg-blush/50 group-hover:text-ink"
        aria-hidden
      >
        i
      </span>
      <span className="text-[11px] font-semibold leading-snug text-walnut underline decoration-walnut/35 underline-offset-2 group-hover:text-ink group-hover:decoration-ink/30">
        {label}
      </span>
    </button>
  );
}
