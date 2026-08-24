import React, { useEffect, useState } from 'react';
import SafeImage from '../SafeImage';
import { getVendorDisplayName, sourceBadgeText } from '../../utils/productSource';
import { formatMoney } from '../../utils/formatMoney';

const COLLECTION_ACCENTS = ['text-walnut', 'text-[#8B7355]', 'text-[#6B7B8C]', 'text-[#9A7B4F]', 'text-[#7A6B5D]'];
const LISTING_IMAGE_BG_CLASS = 'bg-[#ffffff]';

function compareAtOf(p) {
  const c = Number(p?.compareAtPrice ?? p?.compare_at_price);
  if (!Number.isFinite(c) || c <= 0) return null;
  return c;
}

function productImageUrls(p) {
  const images = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? null;
  if (Array.isArray(images)) {
    return images.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (typeof images === 'string') {
    const url = images.trim();
    return url ? [url] : [];
  }
  return [];
}

function firstImageUrl(p) {
  return productImageUrls(p)[0] ?? null;
}

function brandSubtitle(p) {
  const b = String(p?.brand ?? '').trim();
  if (b) return b;
  const v = getVendorDisplayName(p);
  return v || '';
}

function collectionNameOf(p) {
  const nested = p?.collection;
  if (nested && typeof nested === 'object') {
    const name = String(nested?.name ?? '').trim();
    if (name) return name;
  }
  return String(p?.collectionName ?? p?.collection_name ?? '').trim() || null;
}

function capitalizeWord(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return `${s.charAt(0).toUpperCase()}${s.slice(1).toLowerCase()}`;
}

function materialSpecLine(p) {
  const metalType = String(p?.metalType ?? p?.metal_type ?? '').trim();
  const metalColour = String(
    p?.metalColour ?? p?.metal_colour ?? p?.metalColor ?? p?.metal_color ?? ''
  ).trim();
  const diamondRaw = String(p?.diamondType ?? p?.diamond_type ?? '').trim();
  const types = Array.isArray(p?.diamondTypes ?? p?.diamond_types)
    ? (p?.diamondTypes ?? p?.diamond_types)
        .map((x) => String(x || '').trim().toLowerCase())
        .filter((x) => x === 'natural' || x === 'lab')
    : [];

  let metalPart = '';
  if (metalColour && metalType) {
    metalPart = `${metalColour} ${capitalizeWord(metalType)}`.trim();
  } else if (metalColour) {
    metalPart = metalColour;
  } else if (metalType) {
    metalPart = capitalizeWord(metalType);
  }

  const diamondPart =
    types.length > 0
      ? types.map((t) => capitalizeWord(t === 'lab' ? 'lab grown' : t)).join(' / ')
      : diamondRaw
        ? capitalizeWord(diamondRaw)
        : '';
  const parts = [metalPart, diamondPart].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function collectionAccentClass(name) {
  const key = String(name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i)) % COLLECTION_ACCENTS.length;
  }
  return COLLECTION_ACCENTS[hash] || COLLECTION_ACCENTS[0];
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

function listingBadgeLabel(p, { isFeatured, showNew }) {
  if (showNew) return 'NEW';
  if (isFeatured) return 'FEATURED';
  const category = String(p?.category ?? '').trim().toLowerCase();
  if (category.includes('bridal')) return 'BRIDAL';
  return null;
}

/**
 * Luxury editorial product card — Shop, Similar products, Product detail “others”.
 */
export default function ProductGridCard({
  product: p,
  onNavigate,
  onAddToCart,
  variant = 'default',
}) {
  const isListing = variant === 'listing';
  const listingImageClass =
    `max-h-full max-w-full object-contain object-center ${LISTING_IMAGE_BG_CLASS}`;
  const imageUrls = productImageUrls(p);
  const primaryImg = imageUrls[0] ?? null;
  const hoverImg =
    imageUrls.length >= 2 && imageUrls[1] && imageUrls[1] !== imageUrls[0] ? imageUrls[1] : null;
  const img = primaryImg;
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
  const collectionName = collectionNameOf(p);
  const materialSpec = materialSpecLine(p);
  const listingBadge = isListing ? listingBadgeLabel(p, { isFeatured, showNew }) : null;
  const [touchPreview, setTouchPreview] = useState(false);

  useEffect(() => {
    setTouchPreview(false);
  }, [primaryImg, hoverImg]);

  if (isListing) {
    return (
      <article className={`flex h-full min-h-0 flex-col ${LISTING_IMAGE_BG_CLASS}`}>
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
          onTouchStart={() => {
            if (hoverImg) setTouchPreview(true);
          }}
          onTouchEnd={() => setTouchPreview(false)}
          onTouchCancel={() => setTouchPreview(false)}
          className={`group relative aspect-[3/4] w-full cursor-pointer overflow-hidden border-b border-pale/70 ${LISTING_IMAGE_BG_CLASS}`}
        >
          {primaryImg ? (
            <>
              <div
                className={`absolute inset-0 flex items-center justify-center ${LISTING_IMAGE_BG_CLASS} p-4 md:p-5 ${
                  hoverImg
                    ? `transition-opacity duration-700 ease-in-out md:group-hover:opacity-0 max-md:group-active:opacity-0${
                        touchPreview ? ' max-md:opacity-0' : ''
                      }`
                    : ''
                }`}
              >
                <SafeImage
                  src={primaryImg}
                  alt=""
                  className={listingImageClass}
                  loading="lazy"
                />
              </div>
              {hoverImg ? (
                <div
                  className={`absolute inset-0 flex items-center justify-center ${LISTING_IMAGE_BG_CLASS} p-4 md:p-5 opacity-0 transition-opacity duration-700 ease-in-out md:group-hover:opacity-100 max-md:group-active:opacity-100${
                    touchPreview ? ' max-md:opacity-100' : ''
                  }`}
                >
                  <SafeImage
                    src={hoverImg}
                    alt=""
                    className={listingImageClass}
                    loading="lazy"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className={`flex h-full w-full flex-col items-center justify-center ${LISTING_IMAGE_BG_CLASS} text-muted/70`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
          )}

          {listingBadge ? (
            <div className="pointer-events-none absolute left-3 top-3 z-10 md:left-4 md:top-4">
              <span className="rounded-md bg-white px-2.5 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-ink shadow-sm">
                {listingBadge}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col bg-[#FAF7F2] px-3 pb-3 pt-3 md:px-4 md:pb-3 md:pt-3">
          <div className="min-h-[14px] shrink-0">
            {collectionName ? (
              <p
                className={`font-sans text-[10px] font-bold uppercase tracking-[0.14em] ${collectionAccentClass(collectionName)}`}
              >
                {collectionName}
              </p>
            ) : null}
          </div>

          <button type="button" onClick={onNavigate} className="mt-1 shrink-0 cursor-pointer text-left">
            <p className="min-h-[2.5rem] font-sans text-[15px] font-bold leading-snug text-ink line-clamp-2 underline-offset-2 transition-[text-decoration] hover:underline md:min-h-[2.75rem] md:text-[16px]">
              {p?.name || 'Product'}
            </p>
          </button>

          <div className="mt-auto flex min-h-[2.25rem] items-end justify-between gap-3 pt-1">
            <div className="min-w-0 font-sans">
              {showStrikethroughCompare ? (
                <span className="mr-2 text-[11px] tabular-nums text-muted line-through">
                  ₹{formatMoney(compareAt)}
                </span>
              ) : null}
              <span className="text-[13px] tabular-nums text-ink md:text-[14px]">
                ₹{formatMoney(p?.price)}
              </span>
            </div>
            {materialSpec ? (
              <p className="max-w-[48%] shrink-0 text-right font-sans text-[10px] leading-snug text-mid line-clamp-2 md:text-[11px]">
                {materialSpec}
              </p>
            ) : (
              <span className="max-w-[48%] shrink-0" aria-hidden />
            )}
          </div>
        </div>
      </article>
    );
  }

  const shellClass =
    'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-pale/90 bg-white';
  const imageShellClass =
    'relative aspect-square w-full cursor-pointer overflow-hidden rounded-t-2xl bg-white';

  return (
    <div className="group flex h-full flex-col">
      <div className={shellClass}>
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
          className={imageShellClass}
        >
          {img ? (
            <SafeImage
              src={img}
              alt=""
              className="h-full w-full object-contain bg-white p-3"
              loading="lazy"
            />
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

        <div className="flex flex-1 flex-col px-4 pb-5 pt-4">
          <button type="button" onClick={onNavigate} className="text-left">
            <p className="font-serif text-[17px] font-bold leading-snug text-ink line-clamp-2 md:text-[19px]">
              {p?.name || 'Product'}
            </p>
          </button>
          {brand ? <p className="mt-1 font-sans text-[12px] text-muted">{brand}</p> : null}

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 font-sans">
              {showStrikethroughCompare ? (
                <span className="text-[12px] font-normal tabular-nums text-muted line-through md:text-[13px]">
                  ₹{formatMoney(compareAt)}
                </span>
              ) : null}
              <span className="text-[14px] font-normal tabular-nums text-mid md:text-[15px]">
                ₹{formatMoney(p?.price)}
              </span>
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
