import React, { useEffect, useState } from 'react';
import CountrySelect from '../CountrySelect';
import { normalizeCountryLookupRows } from '../../utils/stateRegionLabel';
import { authService } from '../../services/authService';

export const emptyProjectDeliveryAddress = () => ({
  name: '',
  countryCode: '',
  phone: '',
  address: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  pinCode: '',
});

export function normalizeDeliveryFromProject(project) {
  const snap = project?.deliveryAddressSnapshot || project?.delivery_address_snapshot;
  if (!snap || typeof snap !== 'object') return emptyProjectDeliveryAddress();
  return {
    name: String(snap.fullName || snap.name || '').trim(),
    countryCode: String(snap.phoneCountryCode || '').trim(),
    phone: String(snap.phone || '').trim(),
    address: String(snap.addressLine1 || snap.address || '').trim(),
    addressLine2: String(snap.addressLine2 || '').trim(),
    city: String(snap.city || '').trim(),
    state: String(snap.state || '').trim(),
    country: String(snap.country || '').trim(),
    pinCode: String(snap.postalCode || snap.pinCode || snap.pincode || '').trim(),
  };
}

export function validateProjectDeliveryAddress(a) {
  const v = (x) => Boolean(String(x || '').trim());
  const phoneOk = String(a?.phone || '').replace(/\D/g, '').length >= 6;
  return (
    v(a?.name) &&
    phoneOk &&
    v(a?.address) &&
    v(a?.city) &&
    v(a?.state) &&
    v(a?.country) &&
    v(a?.pinCode)
  );
}

export function deliveryAddressApiPayload(form) {
  if (!form || typeof form !== 'object') return null;
  return {
    name: String(form.name || '').trim(),
    countryCode: String(form.countryCode || '').trim() || undefined,
    phone: String(form.phone || '').trim(),
    address: String(form.address || '').trim(),
    addressLine2: String(form.addressLine2 || '').trim() || undefined,
    city: String(form.city || '').trim(),
    state: String(form.state || '').trim(),
    country: String(form.country || '').trim(),
    pinCode: String(form.pinCode || '').trim(),
  };
}

/**
 * Checkout-style delivery fields for project Details (step 4).
 */
export default function ProjectDeliveryAddressFields({
  form,
  setForm,
  disabled = false,
  locked = false,
}) {
  const [countryLookup, setCountryLookup] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authService.getCountryCodes();
        if (!cancelled) setCountryLookup(normalizeCountryLookupRows(data));
      } catch {
        if (!cancelled) setCountryLookup([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (patch) => setForm((prev) => ({ ...(prev || emptyProjectDeliveryAddress()), ...patch }));

  const fieldClass =
    'w-full px-4 py-3 rounded-xl border text-[13px] font-medium text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 border-pale focus:border-walnut disabled:opacity-60';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Delivery details *</p>
        <p className="mt-1 text-[12px] text-muted">
          {locked
            ? 'Delivery address is locked for this project.'
            : 'Where should we deliver this piece? This is locked to the project and used for duty / shipping estimates.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Full name *</label>
          <input
            type="text"
            value={form?.name || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ name: e.target.value })}
            className={fieldClass}
            placeholder="Name"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">
            Phone * <span className="font-normal normal-case text-muted">(include country code)</span>
          </label>
          <input
            type="tel"
            value={form?.phone || ''}
            disabled={disabled || locked}
            onChange={(e) => {
              const raw = e.target.value || '';
              const cleaned = raw.replace(/[^\d+\s]/g, '').replace(/(?!^)\+/g, '');
              set({ phone: cleaned });
            }}
            className={fieldClass}
            placeholder="+9191234XXX"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Address *</label>
          <input
            type="text"
            value={form?.address || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ address: e.target.value })}
            className={fieldClass}
            placeholder="House no, street, area"
            autoComplete="address-line1"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Address line 2</label>
          <input
            type="text"
            value={form?.addressLine2 || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ addressLine2: e.target.value })}
            className={fieldClass}
            placeholder="Landmark, apartment, etc."
            autoComplete="address-line2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">City *</label>
          <input
            type="text"
            value={form?.city || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ city: e.target.value })}
            className={fieldClass}
            placeholder="City"
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">State *</label>
          <input
            type="text"
            value={form?.state || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ state: e.target.value })}
            className={fieldClass}
            placeholder="State"
            autoComplete="address-level1"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Pin code *</label>
          <input
            type="text"
            value={form?.pinCode || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ pinCode: e.target.value })}
            className={fieldClass}
            placeholder="Pin code"
            autoComplete="postal-code"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Country *</label>
          <CountrySelect
            value={form?.country || ''}
            disabled={disabled || locked}
            onChange={(e) => set({ country: e?.target?.value || '' })}
            countries={countryLookup}
            variant="checkout"
          />
        </div>
      </div>
    </div>
  );
}
