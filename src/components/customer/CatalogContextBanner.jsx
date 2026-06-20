import React from 'react';
import SafeImage from '../SafeImage';

/**
 * Flush category/collection strip for the product listing (edge-to-edge, scrolls with grid).
 */
export default function CatalogContextBanner({ kind, title, description, image, className = '' }) {
  const label = kind === 'collection' ? 'Collection' : 'Category';
  const imageSrc = String(image || '').trim() || null;

  return (
    <section
      className={`w-full border-b border-pale/60 bg-white ${className}`.trim()}
      aria-label={`${label}: ${title}`}
    >
      <div className="flex w-full min-h-[3.25rem] items-stretch md:min-h-14">
        {imageSrc ? (
          <div className="relative w-12 shrink-0 md:w-14">
            <SafeImage
              src={imageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
        <div
          className={`flex min-w-0 flex-1 flex-col justify-center py-2 ${
            imageSrc ? 'pl-3 pr-4 lg:pr-8' : 'px-4 lg:px-8'
          }`}
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
            <span className="shrink-0 text-[12px] font-normal text-pale" aria-hidden="true">
              /
            </span>
            <span className="min-w-0 font-serif text-[15px] font-bold leading-tight text-ink md:text-[16px]">
              {title}
            </span>
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-mid md:text-[12px]">{description}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
