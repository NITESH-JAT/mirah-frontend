import React from 'react';
import SafeImage from '../SafeImage';
import { buildFinishCaption, resolveFinishImageSrc } from '../../utils/projectFinishPreview';

/** Selectable card used on Metal / Diamonds steps (New UI cream + walnut). */
export function SpecChoiceCard({
  selected,
  onClick,
  label,
  swatchColor,
  iconSrc,
  iconNode,
  disabled = false,
  className = '',
  layout = 'column',
}) {
  const isRow = layout === 'row';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex rounded-2xl border px-3 py-3.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[88px] ${
        isRow
          ? 'flex-row items-center justify-start gap-3 text-left'
          : 'flex-col items-center justify-center gap-2 text-center'
      } ${
        selected
          ? 'border-walnut ring-1 ring-walnut/25 bg-[#FAF5EE]'
          : 'border-pale bg-white hover:border-walnut/40 hover:bg-cream/60'
      } ${className}`}
    >
      {selected ? (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-walnut text-blush">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      ) : null}
      {swatchColor ? (
        <span className="h-9 w-9 shrink-0 rounded-full border border-pale/80 shadow-sm" style={{ backgroundColor: swatchColor }} aria-hidden />
      ) : null}
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="h-20 w-20 shrink-0 object-contain bg-transparent mix-blend-multiply"
        />
      ) : null}
      {iconNode || null}
      <span className={`text-[12px] font-bold leading-tight ${isRow ? 'pr-6' : ''} ${selected ? 'text-ink' : 'text-mid'}`}>{label}</span>
    </button>
  );
}

export function SparkleTier({ count = 1 }) {
  return (
    <span className="flex items-center justify-center gap-1" aria-hidden>
      {[1, 2, 3].map((i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={i <= count ? '#E4B84A' : 'none'}
          stroke={i <= count ? '#D4A017' : '#E4B84A'}
          strokeWidth="1.75"
        >
          <path d="M12 2l1.8 5.5L19 9.2l-4.5 3.3L15.6 18 12 14.8 8.4 18l1.1-5.5L5 9.2l5.2-1.7L12 2z" />
        </svg>
      ))}
    </span>
  );
}

/** Left-column finish plaque + caption (Metal / Diamonds steps). Hidden until a metal is chosen. */
export function FinishPreviewPanel({ specs, includeDiamonds = false }) {
  const hasMetal = Boolean(String(specs?.metalType || '').trim());
  if (!hasMetal) return null;

  const src = resolveFinishImageSrc(specs, { includeDiamonds });
  const caption = buildFinishCaption(specs, { includeDiamonds });
  return (
    <div className="mb-4">
      <p className="text-[11px] font-medium text-ink uppercase tracking-wide">Selected Finish Preview</p>
      <p className="text-[11px] text-muted">A preview of your current metal selection.</p>
      <div className="mt-2 flex flex-col items-center">
        <div className="flex h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-xl">
          <SafeImage
            src={src}
            alt={caption || 'Metal finish preview'}
            className="max-h-full max-w-full object-contain object-center"
          />
        </div>
        {caption ? (
          <p className="mt-1.5 w-[200px] text-center text-[11px] font-semibold text-mid capitalize">{caption}</p>
        ) : null}
      </div>
    </div>
  );
}
