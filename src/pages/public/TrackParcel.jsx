import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient as api } from '../../services/apiClient';

const STEPS = [
  ['pickup_scheduled', 'Booked'],
  ['picked_up', 'Picked up'],
  ['in_transit', 'In transit'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
];

const formatWhen = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T') + (String(v).length <= 19 ? '+05:30' : ''));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Public parcel tracking for an Arviah delivery (Sequel 247 docket), linked from the invoice email. */
export default function TrackParcel() {
  const { docket = '' } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, message: '' });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/public/tracking/${encodeURIComponent(docket)}`)
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', data: res?.data?.data ?? null, message: '' });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: 'error',
          data: null,
          message: e?.response?.data?.message || e?.message || 'Tracking is not available right now.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [docket]);

  const data = state.data;
  const reached = data ? Math.max(0, STEPS.findIndex(([key]) => key === data.status)) : -1;

  return (
    <div className="min-h-screen w-full bg-cream px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-8 text-center font-sans text-[13px] font-bold uppercase tracking-[0.32em] text-ink">Arviah</p>
        <h1 className="font-serif text-[26px] font-bold text-ink">Track your delivery</h1>
        <p className="mt-1 font-sans text-[13px] text-muted">Docket {docket} · Sequel 247 secure delivery</p>

        {state.status === 'loading' ? (
          <p className="mt-8 font-sans text-[15px] text-muted">Looking up your parcel…</p>
        ) : state.status === 'error' || !data ? (
          <p className="mt-8 font-sans text-[15px] leading-relaxed text-mid">
            {state.message || 'We could not find this delivery.'} If you need help, email{' '}
            <a className="underline" href="mailto:support@arviahstudio.com">
              support@arviahstudio.com
            </a>
            .
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-pale bg-white p-5">
              <p className="font-sans text-[12px] font-bold uppercase tracking-wide text-muted">Status</p>
              <p className="mt-1 font-sans text-[18px] font-extrabold text-ink">{data.statusLabel || STEPS[reached]?.[1] || 'Booked'}</p>
              {data.estimatedDelivery && data.status !== 'delivered' ? (
                <p className="mt-1 font-sans text-[13px] text-mid">Expected by {String(data.estimatedDelivery).split(' ')[0]}</p>
              ) : null}
              <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Delivery progress">
                {STEPS.map(([key, label], i) => (
                  <li key={key} className="text-center">
                    <span className={`mx-auto block h-1.5 rounded-full ${i <= reached ? 'bg-walnut' : 'bg-pale'}`} />
                    <span className={`mt-1.5 block font-sans text-[10px] ${i <= reached ? 'font-bold text-ink' : 'text-muted'}`}>{label}</span>
                  </li>
                ))}
              </ol>
            </div>

            {data.events?.length ? (
              <div className="rounded-2xl border border-pale bg-white p-5">
                <p className="font-sans text-[12px] font-bold uppercase tracking-wide text-muted">Updates</p>
                <ul className="mt-3 space-y-3">
                  {data.events.map((e, i) => (
                    <li key={i} className="border-l-2 border-pale pl-3">
                      <p className="font-sans text-[13px] font-semibold text-ink">{e.description}</p>
                      <p className="font-sans text-[12px] text-muted">
                        {[e.location, formatWhen(e.at)].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.lastCheckedAt ? (
              <p className="font-sans text-[11px] text-muted">Last checked {formatWhen(data.lastCheckedAt)}. Updates every 30 minutes.</p>
            ) : null}
          </div>
        )}

        <Link to="/login" className="mt-8 inline-block font-sans text-[14px] font-semibold text-ink underline">
          Go to Arviah
        </Link>
      </div>
    </div>
  );
}
