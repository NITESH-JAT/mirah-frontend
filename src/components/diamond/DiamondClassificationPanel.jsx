import React from 'react';

function BadgeTier1({ children = 'Tier 1' }) {
  return (
    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 md:text-[11px]">
      {children}
    </span>
  );
}

function BadgeTier2({ children = 'Tier 2' }) {
  return (
    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 md:text-[11px]">
      {children}
    </span>
  );
}

function BadgeTier3() {
  return (
    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-800 md:text-[11px]">
      Tier 3*
    </span>
  );
}

const CLARITY_COLS = ['VVS', 'VS1', 'VS2', 'SI1', 'SI2', 'SI3-I1'];

/** Minimum acceptable tier grid (color x clarity). */
const TABLE_ROWS = [
  {
    color: 'G',
    cells: [
      <BadgeTier1 key="g1" />,
      <BadgeTier1 key="g2" />,
      <BadgeTier2 key="g3" />,
      <BadgeTier2 key="g4" />,
      <BadgeTier3 key="g5" />,
      <BadgeTier3 key="g6" />,
    ],
  },
  {
    color: 'H',
    cells: [
      <BadgeTier1 key="h1" />,
      <BadgeTier1 key="h2" />,
      <BadgeTier2 key="h3" />,
      <BadgeTier2 key="h4" />,
      <BadgeTier3 key="h5" />,
      <BadgeTier3 key="h6" />,
    ],
  },
  {
    color: 'I',
    cells: [
      <BadgeTier1 key="i1" />,
      <BadgeTier2 key="i2" />,
      <BadgeTier2 key="i3" />,
      <BadgeTier3 key="i4" />,
      <BadgeTier3 key="i5" />,
      <BadgeTier3 key="i6" />,
    ],
  },
];

export default function DiamondClassificationPanel({ className = '', showTitle = true }) {
  return (
    <div className={`rounded-2xl border border-pale bg-white p-4 shadow-sm md:p-6 ${className}`}>
      {showTitle ? (
        <h2 className="font-sans text-[16px] font-extrabold text-ink md:text-[17px]">Diamond Classification</h2>
      ) : null}

      <div className={`overflow-x-auto rounded-xl border border-pale/80 bg-neutral-50/80 ${showTitle ? 'mt-4' : ''}`}>
        <table className="w-full min-w-[760px] border-collapse text-center text-ink">
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

      <div className="mt-4 space-y-2 font-sans text-[12px] leading-relaxed text-mid md:text-[13px]">
        <p>
          <span className="font-bold text-ink">* Inclusion Rule:</span> Visible black inclusions downgrade quality by one level.
        </p>
        <p>
          <span className="font-bold text-ink">Tier 3 constraint:</span> Stones in the Tier 3 category must not have visible black inclusions.
        </p>
        <p>
          <span className="font-bold text-ink">Rejection:</span> If downgraded below Tier 3, do not use the stone.
        </p>
      </div>
    </div>
  );
}
