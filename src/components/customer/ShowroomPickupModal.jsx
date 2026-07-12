import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CountrySelect from '../CountrySelect';
import { showroomService } from '../../services/showroomService';
import { formatMoney } from '../../utils/formatMoney';

const NO_SHOWROOM_MESSAGE =
  "We\u2019re so sorry! It looks like we don\u2019t have an available showroom nearby at the moment. Please try another location, or reach out to us and we\u2019ll do our best to help you find a suitable option.";

const COPY = {
  partial: {
    title: 'Reserve Online, Pay the Rest at a Showroom',
    intro: [
      'You\u2019re choosing a flexible way to buy your jewellery.',
      'With Partial Payment, you can pay part of the order online now, choose a showroom near you, and complete the remaining payment in person after you\u2019ve seen the piece.',
      'This gives you the ease of online shopping, plus the confidence of viewing your jewellery at a showroom before completing the final payment.',
    ],
    steps: [
      ['Enter your location', 'Add your country and postcode so we can show you nearby showrooms where this service is available.'],
      ['Choose your preferred showroom', 'Select the showroom that is most convenient for you. This may be one of our stores or one of our trusted partner showroom locations.'],
      ['Pay the required amount online', 'To process your order and arrange the jewellery for viewing, you\u2019ll need to pay the required online amount now. This amount will be clearly shown before you confirm.'],
      ['We move the piece to your selected showroom', 'Once your online payment is completed and your order is confirmed, we\u2019ll arrange for the jewellery to be made available at your chosen showroom.'],
      ['Visit, view, and feel the piece', 'Come to the showroom, see the jewellery in person, try it, feel the craftsmanship, and make sure everything looks right.'],
      ['Pay the remaining amount at the showroom', 'After viewing the piece, you can complete the balance payment at the showroom using UPI, card, bank transfer, or cash, subject to applicable legal limits.'],
    ],
    notes: [
      'Cash payments can only be accepted within the limits allowed by law. For high-value purchases or cash payments, we may ask for PAN, ID, or other details as required by law and our company policy.',
      'Your invoice will be generated based on your payment structure. Since part of your order is paid online, the invoice may be created at the time of online payment and updated or settled according to the final payment terms.',
      'Once your order is confirmed, the piece is reserved and arranged specially for you at your selected showroom. Because of this, confirmed orders cannot be cancelled. However, exchanges or modifications may be available as per our Returns, Refunds & Exchanges Policy.',
    ],
    confirmLabel: 'Confirm & Pay Online',
  },
  offline: {
    title: 'Buy Now, Pay at a Showroom',
    intro: [
      'You\u2019re choosing to reserve your jewellery online and complete the full payment in person at a showroom near you.',
      'This gives you the ease of online shopping, plus the confidence of viewing and paying for your jewellery at a showroom before you take it home.',
    ],
    steps: [
      ['Enter your location', 'Add your country and postcode so we can show you nearby showrooms where this service is available.'],
      ['Choose your preferred showroom', 'Select the showroom that is most convenient for you. This may be one of our stores or one of our trusted partner showroom locations.'],
      ['We move the piece to your selected showroom', 'Once your order is confirmed, we\u2019ll arrange for the jewellery to be made available at your chosen showroom.'],
      ['Visit, view, and feel the piece', 'Come to the showroom, see the jewellery in person, try it, feel the craftsmanship, and make sure everything looks right.'],
      ['Pay at the showroom', 'Complete the payment at the showroom using UPI, card, bank transfer, or cash, subject to applicable legal limits.'],
    ],
    notes: [
      'Cash payments can only be accepted within the limits allowed by law. For high-value purchases or cash payments, we may ask for PAN, ID, or other details as required by law and our company policy.',
      'Your invoice will be generated based on your payment. Since this order is paid in person, the invoice may be created or settled at the time of payment at the showroom.',
      'Once your order is confirmed, the piece is reserved and arranged specially for you at your selected showroom. Because of this, confirmed orders cannot be cancelled. However, exchanges or modifications may be available as per our Returns, Refunds & Exchanges Policy.',
    ],
    confirmLabel: 'Confirm Order',
  },
};

const showroomLocationLine = (s) =>
  [s?.city, s?.country, s?.postcode].filter((x) => x && String(x).trim()).join(', ');

export default function ShowroomPickupModal({
  open,
  mode = 'offline',
  onClose,
  onConfirm,
  countries = [],
  defaultCountry = '',
  submitting = false,
  partialInfo = null,
  addToast,
}) {
  const copy = COPY[mode] || COPY.offline;

  const [country, setCountry] = useState('');
  const [postcode, setPostcode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Reset state each time the modal is opened.
  useEffect(() => {
    if (!open) return;
    setCountry(defaultCountry || '');
    setPostcode('');
    setSearching(false);
    setSearched(false);
    setResults([]);
    setSelectedId(null);
  }, [open, defaultCountry]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  const canSearch = Boolean(country && String(country).trim());
  const selectedShowroom = useMemo(
    () => results.find((s) => String(s.id) === String(selectedId)) || null,
    [results, selectedId],
  );

  const onSearch = async () => {
    if (!canSearch) {
      addToast?.('Please select your country first.', 'error');
      return;
    }
    setSearching(true);
    setSearched(false);
    setSelectedId(null);
    try {
      const rows = await showroomService.listNearby({ country, postcode });
      setResults(Array.isArray(rows) ? rows : []);
      setSearched(true);
    } catch (e) {
      addToast?.(e?.message || 'Failed to load showrooms', 'error');
      setResults([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const onConfirmClick = () => {
    if (!selectedShowroom) {
      addToast?.('Please select a showroom to continue.', 'error');
      return;
    }
    onConfirm?.({
      showroomId: selectedShowroom.id,
      showroom: selectedShowroom,
      country: String(country).trim(),
      postcode: String(postcode).trim(),
    });
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
      onMouseDown={() => !submitting && onClose?.()}
      role="presentation"
    >
      <div
        className="w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
          <p className="text-[15px] font-extrabold text-ink">{copy.title}</p>
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            disabled={submitting}
            className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          {/* Explainer */}
          <div className="space-y-2">
            {copy.intro.map((p, i) => (
              <p key={i} className="text-[12px] leading-relaxed text-mid">
                {p}
              </p>
            ))}
          </div>

          <div>
            <p className="text-[12px] font-extrabold text-ink">How it works</p>
            <ol className="mt-2 space-y-2">
              {copy.steps.map(([heading, detail], i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-walnut/10 text-walnut text-[11px] font-extrabold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[12px] leading-relaxed text-mid">
                    <span className="font-bold text-ink">{heading}. </span>
                    {detail}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-pale bg-cream/50 p-4">
            <p className="text-[12px] font-extrabold text-ink">A few helpful things to know</p>
            <ul className="mt-2 space-y-2 list-disc pl-4">
              {copy.notes.map((n, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-muted">
                  {n}
                </li>
              ))}
            </ul>
          </div>

          {/* Partial amount summary */}
          {mode === 'partial' ? (
            <div className="rounded-2xl border border-pale p-4">
              {partialInfo?.loading ? (
                <p className="text-[12px] text-muted">Calculating amounts…</p>
              ) : partialInfo && partialInfo.total != null ? (
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between text-mid">
                    <span>Order total</span>
                    <span className="font-extrabold text-ink">₹{formatMoney(partialInfo.total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-mid">
                    <span>Pay online now</span>
                    <span className="font-extrabold text-ink">₹{formatMoney(partialInfo.onlineAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-mid">
                    <span>Pay at showroom</span>
                    <span className="font-extrabold text-ink">₹{formatMoney(partialInfo.offlineAmount)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-muted">Amount to pay online will be shown before you confirm.</p>
              )}
            </div>
          ) : null}

          {/* Location + showroom picker */}
          <div className="rounded-2xl border border-pale p-4 space-y-4">
            <div>
              <p className="text-[12px] font-extrabold text-ink">Ready to reserve your piece and choose a showroom?</p>
              <p className="mt-1 text-[11px] text-muted">Enter your country and postcode below to see available locations.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CountrySelect
                label="Country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setSearched(false);
                  setResults([]);
                  setSelectedId(null);
                }}
                countries={countries}
                variant="checkout"
                placeholder="Select country"
                disabled={submitting}
              />
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-ink uppercase tracking-wide block">Postcode</label>
                <input
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value);
                    setSearched(false);
                    setResults([]);
                    setSelectedId(null);
                  }}
                  placeholder="e.g. 400050"
                  disabled={submitting}
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-pale bg-white text-[12px] font-semibold text-ink placeholder:text-muted focus:outline-none focus:border-walnut disabled:bg-cream disabled:text-muted"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onSearch}
              disabled={!canSearch || searching || submitting}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-walnut/40 text-[12px] font-bold text-walnut hover:bg-cream disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Show Nearby Showrooms'}
            </button>

            {/* Results */}
            {searched ? (
              results.length === 0 ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[12px] leading-relaxed text-amber-800">
                  {NO_SHOWROOM_MESSAGE}
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((s) => {
                    const active = String(s.id) === String(selectedId);
                    return (
                      <button
                        key={String(s.id)}
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        disabled={submitting}
                        className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                          active ? 'border-walnut bg-walnut/5' : 'border-pale bg-white hover:bg-cream'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${
                              active ? 'border-walnut' : 'border-pale'
                            }`}
                          >
                            {active ? <span className="w-2 h-2 rounded-full bg-walnut" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="block text-[13px] font-bold text-ink">{s.name}</span>
                              {s.distanceKm != null ? (
                                <span className="shrink-0 rounded-full bg-walnut/10 px-2 py-0.5 text-[10px] font-bold text-walnut">
                                  ~{s.distanceKm} km away
                                </span>
                              ) : null}
                            </span>
                            {s.address ? (
                              <span className="block mt-0.5 text-[11px] text-muted">{s.address}</span>
                            ) : null}
                            {showroomLocationLine(s) ? (
                              <span className="block mt-0.5 text-[11px] text-muted">{showroomLocationLine(s)}</span>
                            ) : null}
                            {s.phone ? <span className="block mt-0.5 text-[11px] text-muted">{s.phone}</span> : null}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-pale bg-white flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-2xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmClick}
            disabled={submitting || !selectedShowroom}
            className="flex-1 px-4 py-3 rounded-2xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Processing…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
