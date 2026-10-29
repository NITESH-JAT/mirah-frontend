import React from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatMoney';

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

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function countryCodeFromPlace(place) {
  if (!place || typeof place !== 'object') return null;
  const raw = String(place.countryCode || place.country_code || place.country || '').trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const lower = raw.toLowerCase();
  if (lower === 'india') return 'IN';
  return null;
}

function ModalRow({ label, value, muted, currency = 'INR' }) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null;
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 ${muted ? 'text-muted' : ''}`}>
      <span className="text-[12px] font-semibold text-mid pr-2">{label}</span>
      <span className={`text-[12px] font-extrabold text-right tabular-nums shrink-0 ${muted ? '' : 'text-ink'}`}>
        {formatCurrency(Number(value), currency)}
      </span>
    </div>
  );
}

/**
 * Consumer price DNA:
 * - Jeweller quote portion (J − C) + Marketplace & QC (C)
 * - Single GST line = 3% of (quote + markup) for India; ₹0 international
 * - No GST on commission
 * - Domestic delivery lines for India; import/intl for international
 */
export function CustomerPriceBreakdownModal({
  open,
  onClose,
  tariff,
  listingBudgetLabel,
  listingOrderBudgetLabel = null,
  agreedQuoteAmount,
  currency = 'INR',
  title = 'How your price is calculated',
  subtitle = 'Full project pricing — what you pay on Arviah for the entire order: agreed quote, taxes, and delivery.',
  locations = null,
  vendorName = null,
}) {
  if (!open || typeof document === 'undefined') return null;

  const J = pickNum(tariff, ['jewellerBidJ', 'jeweller_bid_j']);
  const C = pickNum(tariff, ['commissionC', 'commission_c']);
  const Gj = pickNum(tariff, ['jewelleryGstGj', 'jewellery_gst_gj']);
  const D = pickNum(tariff, ['deliveryFeeD', 'delivery_fee_d']);
  const deliveryGst = pickNum(tariff, ['logisticsGstOnDelivery', 'logistics_gst_on_delivery']);
  const importDuty = pickNum(tariff, ['importDutyInr', 'import_duty_inr']);
  const intlShipping = pickNum(tariff, ['intlShippingInr', 'intl_shipping_inr']);
  const estimatedLocalDuty = pickNum(tariff, ['estimatedLocalDutyInr', 'estimated_local_duty_inr']);
  const localTaxRate = pickNum(tariff, ['localTaxRate', 'local_tax_rate']);
  const bundled = pickNum(tariff, ['bundledCustomerDue', 'bundled_customer_due']);
  const promoDiscount = pickNum(tariff, ['promoDiscountInr']);
  const promoCode = String(tariff?.promoCode || '').trim();
  const adv = pickNum(tariff, ['advanceCustomerDue', 'advance_customer_due']);
  const fin = pickNum(tariff, ['finalCustomerDue', 'final_customer_due']);
  const jewelleryTaxKind =
    tariff?.jewelleryTaxKind ||
    tariff?.jewellery_tax_kind ||
    (tariff?.jewelleryGstWaived === true || tariff?.jewellery_gst_waived === true ? 'waived_seepz' : null);
  const jewelleryGstWaived =
    jewelleryTaxKind === 'waived_seepz' ||
    tariff?.jewelleryGstWaived === true ||
    tariff?.jewellery_gst_waived === true;

  const quoteBasis =
    agreedQuoteAmount != null && Number.isFinite(Number(agreedQuoteAmount)) ? Number(agreedQuoteAmount) : J;
  const commission = C != null && Number.isFinite(Number(C)) ? Number(C) : null;
  const jewellerPortion =
    quoteBasis != null && commission != null
      ? roundMoney(Math.max(0, Number(quoteBasis) - commission))
      : quoteBasis;

  const fullUpfront =
    bundled != null && adv != null && (fin == null || fin <= 0) && Math.abs(Number(adv) - Number(bundled)) < 1.05;
  const advanceIsPreTaxHalf =
    quoteBasis != null &&
    bundled != null &&
    adv != null &&
    quoteBasis > 0 &&
    bundled > 0 &&
    Math.abs(adv - quoteBasis / 2) < 1 &&
    Math.abs(adv - bundled / 2) >= 1;

  const loc = locations && typeof locations === 'object' ? locations : null;
  const deliveryLoc = loc?.customerDelivery || loc?.customer_delivery || null;
  const jewellerLoc = loc?.jeweller || null;
  const dutyLoc = loc?.dutyCountry || loc?.duty_country || null;

  const formatPlace = (place) => {
    if (!place || typeof place !== 'object') return null;
    const parts = [place.city, place.state, place.country || place.countryCode || place.country_code]
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  };

  const deliveryCountry =
    countryCodeFromPlace(deliveryLoc) ||
    countryCodeFromPlace(dutyLoc) ||
    String(tariff?.deliveryCountryCode || tariff?.delivery_country_code || '').trim().toUpperCase() ||
    null;
  const hasCrossBorderCharges =
    (importDuty != null && importDuty > 0) || (intlShipping != null && intlShipping > 0);
  const isInternationalCustomer =
    (deliveryCountry && deliveryCountry !== 'IN') || (!deliveryCountry && hasCrossBorderCharges);

  const hasAny = [
    jewellerPortion,
    commission,
    Gj,
    D,
    deliveryGst,
    importDuty,
    intlShipping,
    bundled,
    adv,
    fin,
    formatPlace(deliveryLoc),
    formatPlace(jewellerLoc),
    formatPlace(dutyLoc),
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
              {title}
            </p>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">{subtitle}</p>
            {vendorName ? (
              <p className="mt-2 text-[12px] text-mid">
                Manufacturer:&nbsp;<span className="font-extrabold text-ink">{vendorName}</span>
              </p>
            ) : null}
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
              {listingBudgetLabel || listingOrderBudgetLabel ? (
                <div className="mb-4 rounded-xl border border-pale bg-cream/40 px-3 py-2">
                  <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide">When you listed</p>
                  {listingBudgetLabel ? (
                    <p className="mt-1 text-[12px] text-mid">
                      Budget per piece:&nbsp;<span className="font-extrabold text-ink">{listingBudgetLabel}</span>
                    </p>
                  ) : null}
                  {listingOrderBudgetLabel ? (
                    <p className="mt-1 text-[12px] text-mid">
                      Order budget:&nbsp;<span className="font-extrabold text-ink">{listingOrderBudgetLabel}</span>
                    </p>
                  ) : null}
                  {jewellerPortion != null ? (
                    <p className="mt-2 text-[12px] text-mid leading-relaxed">
                      Totals below are for the full project (entire order) using this manufacturer&apos;s quote and Arviah&apos;s
                      tariff for your delivery country.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(formatPlace(deliveryLoc) || formatPlace(jewellerLoc) || formatPlace(dutyLoc)) ? (
                <div className="mb-4">
                  <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide mb-1">Locations used for this quote</p>
                  <div className="rounded-xl border border-pale divide-y divide-pale px-3 py-1">
                    {formatPlace(deliveryLoc) ? (
                      <div className="flex items-start justify-between gap-3 py-2.5">
                        <span className="text-[12px] font-semibold text-mid pr-2">Your delivery address</span>
                        <span className="text-[12px] font-extrabold text-ink text-right">{formatPlace(deliveryLoc)}</span>
                      </div>
                    ) : null}
                    {formatPlace(jewellerLoc) ? (
                      <div className="flex items-start justify-between gap-3 py-2.5">
                        <span className="text-[12px] font-semibold text-mid pr-2">
                          Manufacturer location{jewellerLoc?.isSeepz ? ' (SEEPZ)' : ''}
                        </span>
                        <span className="text-[12px] font-extrabold text-ink text-right">{formatPlace(jewellerLoc)}</span>
                      </div>
                    ) : null}
                    {formatPlace(dutyLoc) ? (
                      <div className="flex items-start justify-between gap-3 py-2.5">
                        <span className="text-[12px] font-semibold text-mid pr-2">Duty / landed-cost country</span>
                        <span className="text-[12px] font-extrabold text-ink text-right">{formatPlace(dutyLoc)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide mb-1">Complete price DNA</p>
              <div className="rounded-xl border border-pale divide-y divide-pale px-3">
                <ModalRow label="Manufacturer quote for this project" value={jewellerPortion} currency={currency} />
                <ModalRow label="Arviah Marketplace & QC Services" value={commission} currency={currency} />
                {promoDiscount != null && promoDiscount > 0 ? (
                  <div className="flex items-start justify-between gap-3 py-2.5 text-green-700">
                    <span className="text-[12px] font-semibold pr-2">
                      Promo discount{promoCode ? ` (${promoCode})` : ''}
                    </span>
                    <span className="text-[12px] font-extrabold text-right tabular-nums shrink-0">
                      −{formatCurrency(promoDiscount, currency)}
                    </span>
                  </div>
                ) : null}
                {Gj != null && Gj > 0 ? (
                  <ModalRow label="GST (3% of quote + markup)" value={Gj} muted currency={currency} />
                ) : isInternationalCustomer || jewelleryGstWaived ? (
                  <p className="px-0 py-2 text-[11px] text-muted leading-relaxed">
                    No GST is charged on international orders. Applicable taxes to the manufacturer are handled by Arviah.
                  </p>
                ) : null}

                {!isInternationalCustomer ? (
                  <>
                    <ModalRow label="Domestic delivery" value={D} currency={currency} />
                    <ModalRow label="GST on delivery" value={deliveryGst} muted currency={currency} />
                  </>
                ) : (
                  <>
                    {importDuty != null && importDuty > 0 ? (
                      <ModalRow label="Import duty" value={importDuty} currency={currency} />
                    ) : null}
                    {intlShipping != null && intlShipping > 0 ? (
                      <ModalRow label="International shipping" value={intlShipping} currency={currency} />
                    ) : null}
                    {(importDuty == null || importDuty <= 0) && (intlShipping == null || intlShipping <= 0) ? (
                      <p className="px-0 py-2 text-[11px] text-muted leading-relaxed">
                        No cross-border import duty or international shipping is applied for this manufacturer + delivery country pair.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-walnut/20 bg-blush/30 px-3 py-1">
                <ModalRow label="Estimated total you pay for the full project (incl. delivery & taxes)" value={bundled} currency={currency} />
              </div>

              {estimatedLocalDuty != null && estimatedLocalDuty > 0 ? (
                <p className="mt-2 text-[11px] text-muted leading-relaxed">
                  Not included above: customs/local VAT of about{' '}
                  <span className="font-extrabold text-ink tabular-nums">
                    {formatCurrency(estimatedLocalDuty, currency)}
                  </span>
                  {localTaxRate != null && localTaxRate > 0
                    ? ` (${(localTaxRate * 100).toFixed(1)}%)`
                    : ''}{' '}
                  may be charged when you collect your order.
                </p>
              ) : null}

              {(adv != null || fin != null) ? (
                <div className="mt-4">
                  <p className="text-[11px] font-extrabold text-muted uppercase tracking-wide mb-1">How you may pay</p>
                  {fullUpfront ? (
                    <>
                      <p className="text-[11px] text-muted mb-2 leading-relaxed">
                        Payment is due when you select your manufacturer to start production.
                      </p>
                      <div className="rounded-xl border border-pale divide-y divide-pale px-3">
                        <ModalRow label="Payment due" value={adv ?? bundled} currency={currency} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted mb-2 leading-relaxed">
                        {advanceIsPreTaxHalf
                          ? 'Advance is 50% of the agreed quote before tax. Remaining taxes and delivery are collected with the final payment.'
                          : 'Your payments are usually split across milestones approved at checkout — amounts are rounded per instalment rules.'}
                      </p>
                      <div className="rounded-xl border border-pale divide-y divide-pale px-3">
                        <ModalRow
                          label={
                            advanceIsPreTaxHalf
                              ? 'Suggested advance (50% of agreed quote, before tax)'
                              : 'Suggested advance instalment'
                          }
                          value={adv}
                          currency={currency}
                        />
                        <ModalRow
                          label={
                            advanceIsPreTaxHalf
                              ? 'Suggested final (remaining quote + taxes + delivery)'
                              : 'Suggested final instalment (incl. delivery & delivery tax when applicable)'
                          }
                          value={fin}
                          currency={currency}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
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
