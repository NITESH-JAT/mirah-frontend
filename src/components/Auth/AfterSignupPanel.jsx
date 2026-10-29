import React from 'react';

const STEPS = ['Share a photo, sketch or requirement', 'Compare manufacturer quotes', 'Choose who makes your jewellery'];

const RingIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-14 w-14 lg:h-12 lg:w-12" aria-hidden>
    <path d="M19 8h10l3.5 4.5L24 20l-8.5-7.5L19 8z" />
    <path d="M15.5 12.5h17M21 8l-1.5 4.5L24 20M27 8l1.5 4.5L24 20" />
    <ellipse cx="24" cy="31" rx="12" ry="11" />
    <ellipse cx="24" cy="31" rx="9" ry="8" />
  </svg>
);

const WorkshopIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 lg:h-8 lg:w-8" aria-hidden>
    <path d="M5 34V20l7-4v5l7-4v5l7-4v16" />
    <path d="M26 34V8h5v26" />
    <path d="M3 34h34" />
    <path d="M10 28h3M16 28h3M10 24h3M16 24h3" />
  </svg>
);

function ManufacturerCard({ name }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-pale bg-white px-3.5 py-3 lg:gap-2.5 lg:rounded-[11px]">
      <span className="text-walnut">
        <WorkshopIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-jakarta text-[13px] font-bold tracking-[-0.01em] text-ink lg:text-[12px]">{name}</p>
        <span className="mt-2 block h-1.5 w-full rounded-full bg-pale" />
        <span className="mt-1.5 block h-1.5 w-2/3 rounded-full bg-pale/70 lg:mt-1" />
      </div>
    </div>
  );
}

/** Desktop-only panel beside the auth forms: what happens after signing up. */
export default function AfterSignupPanel() {
  return (
    <section
      aria-label="After you sign up"
      className="flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-pale bg-[#F5EDE3] px-10 py-10 lg:rounded-[20px] lg:px-8 lg:py-8"
    >
      {/* my-auto centres the story in tall panels; the footer stays pinned to the bottom. */}
      <div className="my-auto">
      <p className="font-jakarta text-[11px] font-bold uppercase tracking-[0.16em] text-walnut">After you sign up</p>
      <h2 className="mt-3 max-w-[440px] font-jakarta text-[32px] font-bold leading-[1.12] tracking-[-0.04em] text-ink text-balance lg:mt-2.5 lg:text-[27px]">
        One brief. More manufacturing options.
      </h2>

      <ol className="mt-7 space-y-3.5 lg:mt-5 lg:space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3.5 lg:gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EBD3BC] font-jakarta text-[13px] font-bold text-walnut lg:h-6 lg:w-6 lg:text-[12px]">
              {i + 1}
            </span>
            <span className="font-jakarta text-[15px] text-ink/85 lg:text-[13px]">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 font-jakarta text-[14px] text-muted lg:mt-4 lg:text-[12.5px]">Compare price, craftsmanship and timelines.</p>

      <div className="mt-8 rounded-[20px] border border-pale bg-white/55 p-5 lg:mt-6 lg:rounded-[16px] lg:p-4" aria-hidden>
        <div className="grid grid-cols-[minmax(0,0.85fr)_40px_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,0.85fr)_32px_minmax(0,1.15fr)] items-center">
          <div className="flex flex-col items-center rounded-[14px] border border-pale bg-white px-3 py-5 text-center lg:rounded-[11px]">
            <span className="text-walnut">
              <RingIcon />
            </span>
            <p className="mt-3 font-jakarta text-[13px] font-bold tracking-[-0.01em] text-ink lg:mt-2.5 lg:text-[12px]">Your requirement</p>
            <p className="mt-0.5 font-jakarta text-[11.5px] text-muted lg:text-[10.5px]">Photo, sketch or details</p>
          </div>

          {/* Dashed connector: one brief branching to two manufacturers. */}
          <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="h-[150px] w-10 lg:h-[120px] text-soft lg:w-8" fill="none">
            <path
              d="M0 50 H20 M20 25 V75 M20 25 H40 M20 75 H40"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="space-y-3 lg:space-y-2.5">
            <ManufacturerCard name="Manufacturer A" />
            <ManufacturerCard name="Manufacturer B" />
          </div>
        </div>
      </div>
      </div>

      <p className="shrink-0 pt-8 font-jakarta text-[13px] text-muted lg:pt-6 lg:text-[12px]">Account registration is free.</p>
    </section>
  );
}
