import React, { useEffect, useState } from 'react';
import { projectService } from '../../services/projectService';

const EMPTY_ADDRESS = { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' };

const toForm = (details) => ({
  businessName: details?.businessName || '',
  taxId: details?.taxId || '',
  separateBilling: Boolean(details?.billingAddress),
  billingAddress: { ...EMPTY_ADDRESS, ...(details?.billingAddress || {}) },
});

const inputClass =
  'w-full rounded-xl border border-pale bg-white px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-walnut';

/**
 * Optional "invoice details" for a project's proforma, receipts and invoice: business name, tax ID
 * (GSTIN for India, EORI / VAT elsewhere) and a billing address when it differs from the delivery address.
 */
export default function BuyerDetailsForm({ projectId, details, domestic, onSaved, addToast }) {
  const hasDetails = Boolean(details?.businessName || details?.taxId || details?.billingAddress);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(details));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) setForm(toForm(details));
  }, [details, open]);

  const setAddress = (key, value) =>
    setForm((f) => ({ ...f, billingAddress: { ...f.billingAddress, [key]: value } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await projectService.saveBuyerDetails(projectId, {
        businessName: form.businessName,
        taxId: form.taxId,
        billingAddress: form.separateBilling ? form.billingAddress : null,
      });
      addToast?.('Invoice details saved', 'success');
      setOpen(false);
      await onSaved?.();
    } catch (err) {
      setError(err?.message || 'Could not save the invoice details');
    } finally {
      setSaving(false);
    }
  };

  const taxLabel = domestic ? 'GSTIN' : 'Tax ID (EORI / VAT)';

  if (!open) {
    return (
      <div className="border-t border-pale pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Invoice details</p>
            {hasDetails ? (
              <div className="mt-1 text-[12px] text-ink space-y-0.5">
                {details.businessName ? <p className="font-semibold">{details.businessName}</p> : null}
                {details.taxId ? (
                  <p className="text-muted">
                    {taxLabel}: {details.taxId}
                  </p>
                ) : null}
                {details.billingAddress ? (
                  <p className="text-muted">
                    Billing: {[details.billingAddress.line1, details.billingAddress.city, details.billingAddress.country]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-muted">
                Optional. Add a business name, {domestic ? 'GSTIN' : 'tax ID'} or billing address for your documents.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 text-[11px] font-bold text-mid underline underline-offset-2 hover:text-ink"
          >
            {hasDetails ? 'Edit' : 'Add'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="border-t border-pale pt-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Invoice details</p>
      <input
        value={form.businessName}
        onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
        placeholder="Business name (optional)"
        maxLength={150}
        className={inputClass}
      />
      <input
        value={form.taxId}
        onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value.toUpperCase() }))}
        placeholder={domestic ? 'GSTIN (optional)' : 'EORI / VAT number (optional)'}
        maxLength={40}
        className={`${inputClass} uppercase placeholder:normal-case`}
      />
      <label className="flex items-center gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          checked={form.separateBilling}
          onChange={(e) => setForm((f) => ({ ...f, separateBilling: e.target.checked }))}
        />
        Billing address differs from delivery address
      </label>
      {form.separateBilling ? (
        <div className="space-y-2">
          <input value={form.billingAddress.line1} onChange={(e) => setAddress('line1', e.target.value)} placeholder="Address line 1" maxLength={200} className={inputClass} />
          <input value={form.billingAddress.line2} onChange={(e) => setAddress('line2', e.target.value)} placeholder="Address line 2 (optional)" maxLength={200} className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.billingAddress.city} onChange={(e) => setAddress('city', e.target.value)} placeholder="City" maxLength={100} className={inputClass} />
            <input value={form.billingAddress.state} onChange={(e) => setAddress('state', e.target.value)} placeholder="State / region" maxLength={100} className={inputClass} />
            <input value={form.billingAddress.postalCode} onChange={(e) => setAddress('postalCode', e.target.value)} placeholder="Postal code" maxLength={20} className={inputClass} />
            <input value={form.billingAddress.country} onChange={(e) => setAddress('country', e.target.value)} placeholder="Country" maxLength={100} className={inputClass} />
          </div>
        </div>
      ) : null}
      {error ? <p className="text-[11px] font-semibold text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-walnut px-3 py-2 text-[12px] font-bold text-blush disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          className="rounded-xl border border-pale px-3 py-2 text-[12px] font-bold text-mid hover:bg-cream"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-muted leading-relaxed">Saving updates your proforma. Details lock once your final invoice is issued.</p>
    </form>
  );
}
