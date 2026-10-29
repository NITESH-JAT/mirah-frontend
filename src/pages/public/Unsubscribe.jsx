import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { systemService } from '../../services/systemService';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This unsubscribe link is invalid.');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    systemService
      .unsubscribeFromMarketingEmails(token)
      .then(() => {
        if (!cancelled) setStatus('done');
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(e?.message || 'Something went wrong. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-sans text-[13px] font-bold tracking-[0.32em] uppercase text-ink mb-8">Arviah</p>
        {status === 'loading' ? (
          <p className="font-sans text-[15px] text-muted">Updating your email preferences…</p>
        ) : status === 'done' ? (
          <>
            <h1 className="font-serif text-[28px] font-bold text-ink mb-3">You're unsubscribed</h1>
            <p className="font-sans text-[15px] text-mid leading-relaxed">
              We won't send you any more reminder or marketing emails. You'll still get emails about your
              account, orders and messages.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-[28px] font-bold text-ink mb-3">Couldn't unsubscribe</h1>
            <p className="font-sans text-[15px] text-mid leading-relaxed">
              {message} You can also email{' '}
              <a className="underline" href="mailto:krish@arviahstudio.com">krish@arviahstudio.com</a> and we'll take
              care of it.
            </p>
          </>
        )}
        <Link to="/login" className="inline-block mt-8 font-sans text-[14px] font-semibold text-ink underline">
          Go to Arviah
        </Link>
      </div>
    </div>
  );
}
