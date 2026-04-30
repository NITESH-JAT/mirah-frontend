import React from 'react';

function BadgeLuxury({ children = 'Luxury' }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 md:text-[11px]">
      {children}
    </span>
  );
}

function BadgePremium({ children = 'Premium' }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 md:text-[11px]">
      {children}
    </span>
  );
}

function BadgeStandard() {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-800 md:text-[11px]">
      Standard*
    </span>
  );
}

function PlainUpper({ children }) {
  return <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink md:text-[11px]">{children}</span>;
}

const CLARITY_COLS = ['VS1–VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'];

/** Rows match the minimum acceptable tier grid (color × clarity). */
const TABLE_ROWS = [
  {
    color: 'G',
    cells: [
      <BadgeLuxury key="g1" />,
      <BadgeLuxury key="g2" />,
      <PlainUpper key="g3">Premium</PlainUpper>,
      <BadgePremium key="g4" />,
      <PlainUpper key="g5">Standard</PlainUpper>,
      <BadgeStandard key="g6" />,
    ],
  },
  {
    color: 'H',
    cells: [
      <BadgeLuxury key="h1" />,
      <BadgeLuxury key="h2" />,
      <BadgePremium key="h3" />,
      <BadgePremium key="h4" />,
      <BadgeStandard key="h5" />,
      <BadgeStandard key="h6" />,
    ],
  },
  {
    color: 'I',
    cells: [
      <PlainUpper key="i1">Luxury</PlainUpper>,
      <BadgePremium key="i2" />,
      <BadgePremium key="i3" />,
      <BadgeStandard key="i4" />,
      <BadgeStandard key="i5" />,
      <BadgeStandard key="i6" />,
    ],
  },
];

export default function VendorGuidelines() {
  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col pb-8 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 border-b border-pale/60">
        <div className="min-w-0">
          <p className="text-[14px] md:text-[15px] font-extrabold text-ink">Diamond Quality Guidelines</p>
          <p className="mt-0.5 text-[12px] text-muted">Minimum acceptable grades when supplying stones for Arviah projects.</p>
        </div>
      </div>

      <div className="mt-6 w-full max-w-none space-y-6">
        <div className="rounded-2xl border border-pale bg-white p-4 shadow-sm md:p-6">
          <h2 className="font-sans text-[16px] font-extrabold text-ink md:text-[17px]">Diamond Classification</h2>

          <div className="mt-4 overflow-x-auto rounded-xl border border-pale/80 bg-neutral-50/80">
            <table className="w-full min-w-[520px] border-collapse text-center text-ink">
              <thead>
                <tr className="border-b border-pale bg-neutral-200/90">
                  <th className="px-2 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-ink md:px-3 md:text-[12px]">
                    Color \ Clarity
                  </th>
                  {CLARITY_COLS.map((c) => (
                    <th
                      key={c}
                      className="px-1.5 py-3 text-[10px] font-extrabold uppercase tracking-wide text-ink md:px-2 md:text-[11px]"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row.color} className="border-b border-pale/80 last:border-0">
                    <th className="bg-cream/90 px-2 py-3 text-left text-[12px] font-extrabold text-ink md:px-3 md:text-[13px]">
                      {row.color}
                    </th>
                    {row.cells.map((cell, idx) => (
                      <td key={idx} className="px-1.5 py-3 align-middle md:px-2">
                        <div className="flex min-h-[1.75rem] items-center justify-center">{cell}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-pale bg-white p-4 shadow-sm md:p-6">
          <div className="space-y-4 font-sans text-[13px] leading-relaxed text-ink md:text-[14px]">
            <p className="text-mid">
              Use the table as the <span className="font-bold text-ink">minimum acceptable quality</span> for the selected tier.
              You may always supply better stones, but not below the table.
            </p>

            <div>
              <p className="font-bold text-ink">Black inclusion rule (strict)</p>
              <p className="mt-1 text-mid">
                Any visible black inclusion (eye-visible) downgrades the stone by one level: Luxury → Premium → Standard.
              </p>
            </div>

            <div>
              <p className="font-bold text-ink">Luxury requirement</p>
              <p className="mt-1 text-mid">
                Must be eye-clean. No visible black inclusions. Any visible black automatically downgrades to Premium.
              </p>
            </div>

            <div>
              <p className="font-bold text-ink">Premium requirement</p>
              <p className="mt-1 text-mid">
                No visible black inclusions. Any visible black automatically downgrades to Standard.
              </p>
            </div>

            <div>
              <p className="font-bold text-ink">Standard requirement</p>
              <p className="mt-1 text-mid">
                Standard stones must have no visible black inclusions. If a stone falls into Standard and shows black, the piece
                will be rejected outright.
              </p>
            </div>

            <p className="rounded-xl border border-pale/80 bg-cream/60 px-3 py-2.5 text-[12px] font-semibold text-ink md:text-[13px]">
              Final check: ensure the stone complies with the table and passes the black inclusion rule after any downgrade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
