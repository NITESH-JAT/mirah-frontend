import React, { useState } from 'react';
import { projectService } from '../../services/projectService';
import { formatCurrency } from '../../utils/formatMoney';

const KIND = {
  proforma: 'Proforma invoice',
  receipt_voucher: 'Receipt voucher',
  export_invoice: 'Export invoice',
  tax_invoice: 'Tax invoice',
  refund_voucher: 'Refund voucher',
  credit_note: 'Credit note',
};

const STATUS = {
  issued: { label: 'Issued', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  paid: { label: 'Paid', cls: 'bg-green-50 text-green-800 border-green-200' },
  superseded: { label: 'Replaced', cls: 'bg-cream text-muted border-pale' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const instalmentLabel = (doc) => (doc.instalment === 'final' ? 'Final payment' : doc.instalment === 'advance' ? 'Advance' : null);

/** The customer's proforma, receipt vouchers and invoice for a project, each downloadable as PDF. */
export default function ProjectDocumentsList({ projectId, documents, addToast }) {
  const [busyId, setBusyId] = useState(null);
  if (!documents?.length) return null;

  const download = async (doc) => {
    if (busyId) return;
    setBusyId(doc.id);
    try {
      await projectService.downloadDocument(projectId, doc);
    } catch (e) {
      addToast?.(e?.message || 'Could not download the document', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-4 border-t border-pale pt-4" data-testid="project-documents">
      <p className="text-[12px] font-extrabold text-ink">Documents</p>
      <ul className="mt-2 divide-y divide-pale rounded-2xl border border-pale">
        {documents.map((doc) => {
          const status =
            doc.status === 'issued' && doc.type === 'receipt_voucher'
              ? { label: 'Received', cls: STATUS.paid.cls }
              : doc.status === 'issued' && (doc.type === 'export_invoice' || doc.type === 'tax_invoice')
                ? { label: doc.dispatch?.awb ? 'Shipped' : 'Issued', cls: STATUS.paid.cls }
                : doc.status === 'issued' && (doc.type === 'refund_voucher' || doc.type === 'credit_note')
                  ? { label: doc.type === 'refund_voucher' ? 'Refunded' : 'Credited', cls: STATUS.superseded.cls }
                  : STATUS[doc.status] || STATUS.issued;
          const sub = [
            instalmentLabel(doc),
            formatDate(doc.issuedAt),
            doc.type === 'proforma' && doc.status === 'issued' && doc.validUntil ? `valid until ${formatDate(doc.validUntil)}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-bold text-ink">{KIND[doc.type] || 'Document'}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted truncate">
                  {doc.number}
                  {doc.totalAmount ? ` · ${formatCurrency(doc.totalAmount, doc.currency)}` : ''}
                  {sub ? ` · ${sub}` : ''}
                </p>
                {doc.dispatch?.awb ? (
                  <p className="mt-0.5 text-[11px] text-ink">
                    Shipped{doc.dispatch.courier ? ` with ${doc.dispatch.courier}` : ''} · AWB {doc.dispatch.awb}
                    {doc.dispatch.trackingUrl ? (
                      <>
                        {' · '}
                        <a
                          href={doc.dispatch.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-walnut underline underline-offset-2"
                        >
                          Track parcel
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => download(doc)}
                disabled={busyId === doc.id}
                className="shrink-0 rounded-xl border border-pale px-3 py-1.5 text-[11px] font-bold text-mid hover:bg-cream disabled:opacity-50"
              >
                {busyId === doc.id ? 'Preparing…' : 'Download'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
