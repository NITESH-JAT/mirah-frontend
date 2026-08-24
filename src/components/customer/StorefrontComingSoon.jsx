import React from 'react';
import logo from '../../assets/logo.png';

export default function StorefrontComingSoon({ message }) {
  const text =
    String(message || '').trim() ||
    'Our online store is coming soon. Browse bespoke projects on My Artisan in the meantime.';

  return (
    <div className="mx-auto flex min-h-[min(70vh,640px)] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-pale bg-white shadow-sm">
        <img src={logo} alt="" className="h-10 w-10 object-contain" aria-hidden />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Arviah Store</p>
      <h1 className="mt-3 font-serif text-3xl font-extrabold italic text-ink">Coming soon</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-mid">{text}</p>
    </div>
  );
}
