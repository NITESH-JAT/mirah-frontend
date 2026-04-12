import React from 'react';
import SafeImage from '../SafeImage';
import { getVendorDisplayName, sourceBadgeText } from '../../utils/productSource';

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function compareAtOf(p) {
  const c = Number(p?.compareAtPrice ?? p?.compare_at_price);
  if (!Number.isFinite(c) || c <= 0) return null;
  return c;
}

function firstImageUrl(p) {
  const images = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? null;
  if (Array.isArray(images) && images[0]) return images[0];
  if (typeof images === 'string') return images;
  return null;
}

function brandSubtitle(p) {
  const b = String(p?.brand ?? '').trim();
  if (b) return b;
  const v = getVendorDisplayName(p);
  return v || '';
}

function averageRatingOf(p) {
  const r =
    p?.averageRating ??
    p?.average_rating ??
    p?.rating ??
    p?.reviewsSummary?.averageRating ??
    p?.reviews_summary?.average_rating ??
    null;
  const n = Number(r);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function isProductNew(p) {
  if (p?.isNew === true || p?.is_new === true) return true;
  const created = p?.createdAt ?? p?.created_at;
  if (!created) return false;
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return false;
  const days = (Date.now() - d.getTime()) / 86400000;
  return days <= 21;
}

/**
 * Luxury editorial product card — Shop, Similar products, Product detail “others”.
 */
export default function ProductGridCard({ product: p, onNavigate, onAddToCart }) {
  const img = firstImageUrl(p);
  const priceNum = Number(p?.price);
  const compareAt = compareAtOf(p);
  const showStrikethroughCompare =
    compareAt != null && Number.isFinite(priceNum) && priceNum > 0 && compareAt > priceNum;
  const sourceText = sourceBadgeText(p);
  const isFeatured =
    p?.isFeatured === true || p?.isFeatured === 1 || String(p?.isFeatured).toLowerCase() === 'true';
  const showNew = isProductNew(p);
  const rating = averageRatingOf(p);
  const brand = brandSubtitle(p);

  return (
    <div className="group flex h-full flex-col">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-pale/90 bg-white">
        {/* Image area — white panel, top-rounded only */}
        <div
          role="button"
          tabIndex={0}
          onClick={onNavigate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate();
            }
          }}
          className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-t-2xl bg-white"
        >
          {img ? (
            <SafeImage src={img} alt="" className="h-full w-full bg-white object-contain p-3" loading="lazy" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <div className="mt-2 text-[11px] font-semibold text-muted">No image</div>
            </div>
          )}

          {sourceText ? (
            <div className="absolute right-2 top-2 z-10 max-w-[78%]">
              <span className="line-clamp-1 block rounded-lg border border-pale/80 bg-white/95 px-2 py-1 text-[10px] font-semibold text-mid backdrop-blur-sm">
                {sourceText}
              </span>
            </div>
          ) : null}

          {showNew ? (
            <div className="pointer-events-none absolute left-2 top-2 z-20">
              <span className="rounded-full bg-ink px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-wide text-white">
                New
              </span>
            </div>
          ) : isFeatured ? (
            <div className="pointer-events-none absolute left-2 top-2 z-20">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-pale bg-white text-amber-600 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(e);
            }}
            className="absolute bottom-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white shadow-none transition-opacity hover:opacity-90 cursor-pointer"
            aria-label="Add to cart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col px-4 pb-5 pt-4">
          <button type="button" onClick={onNavigate} className="text-left">
            <p className="font-serif text-[17px] font-semibold leading-snug text-ink line-clamp-2 md:text-[19px]">
              {p?.name || 'Product'}
            </p>
          </button>
          {brand ? <p className="mt-1 font-sans text-[12px] text-muted">{brand}</p> : null}

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-2 font-sans">
              {showStrikethroughCompare ? (
                <>
                  <span className="text-[12px] font-medium text-muted line-through md:text-[13px]">
                    ₹{formatMoney(compareAt)}
                  </span>
                  <span className="text-[14px] font-bold text-ink md:text-[15px]">₹{formatMoney(p?.price)}</span>
                </>
              ) : (
                <span className="text-[14px] font-bold text-ink md:text-[15px]">₹{formatMoney(p?.price)}</span>
              )}
            </div>
            {rating != null ? (
              <span className="flex shrink-0 items-center gap-0.5 font-sans text-[12px] font-medium text-muted">
                <span className="text-amber-500" aria-hidden>
                  ★
                </span>
                {rating.toFixed(1)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
