import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import { getVendorId, sourceBadgeText, vendorSourceText } from '../../utils/productSource';
import SafeImage from '../../components/SafeImage';

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function discountPercent({ price, compareAtPrice }) {
  const p = Number(price);
  const c = Number(compareAtPrice);
  if (Number.isNaN(p) || Number.isNaN(c) || c <= 0 || p <= 0) return null;
  if (c <= p) return null;
  return Math.round(((c - p) / c) * 100);
}

function coerceUrlArray(maybe) {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe.filter(Boolean);
  if (typeof maybe === 'string') return [maybe].filter(Boolean);
  return [];
}

function firstImageUrl(p) {
  const images = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? null;
  const list = coerceUrlArray(images);
  return list[0] ?? null;
}

function extractMedia(p) {
  const imagesRaw = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? [];
  const videosRaw = p?.videos ?? p?.videoUrls ?? p?.videoURLS ?? p?.videoUrl ?? [];
  return {
    images: coerceUrlArray(imagesRaw),
    videos: coerceUrlArray(videosRaw),
  };
}

function extraFieldsToPairs(extraFields) {
  if (!extraFields) return [];

  // PRD format: { schema: { key: { type, label } }, values: { key: value } }
  const schema = extraFields?.schema;
  const values = extraFields?.values;
  if (schema && values && typeof schema === 'object' && typeof values === 'object') {
    const out = [];
    for (const [key, def] of Object.entries(schema)) {
      const label = def?.label ?? key;
      const value = values?.[key];
      if (value == null || value === '') continue;
      out.push({ key, label: String(label), value: String(value) });
    }
    return out;
  }

  // fallback: object map
  if (typeof extraFields === 'object' && !Array.isArray(extraFields)) {
    return Object.entries(extraFields)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => ({ key: k, label: k, value: String(v) }));
  }

  // fallback: array of {label,value}
  if (Array.isArray(extraFields)) {
    return extraFields
      .map((x, idx) => ({
        key: String(x?.key ?? idx),
        label: String(x?.label ?? x?.key ?? `Field ${idx + 1}`),
        value: String(x?.value ?? ''),
      }))
      .filter((x) => x.value);
  }

  return [];
}

function pickId(p) {
  return p?.id ?? p?._id ?? p?.productId ?? null;
}

export default function ProductDetails() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);

  const [openDetails, setOpenDetails] = useState(true);

  const [mode, setMode] = useState('images'); // images | videos
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartTarget, setCartTarget] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [cartAdding, setCartAdding] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewsMoreLoading, setReviewsMoreLoading] = useState(false);
  const [reviewsMeta, setReviewsMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reviewsSummary, setReviewsSummary] = useState(null);

  const [otherItems, setOtherItems] = useState([]);
  const [otherHasMore, setOtherHasMore] = useState(false);

  const featuredFirstOtherItems = useMemo(() => {
    const arr = Array.isArray(otherItems) ? otherItems : [];
    return arr
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        const af = a?.p?.isFeatured === true || a?.p?.isFeatured === 1 || String(a?.p?.isFeatured).toLowerCase() === 'true';
        const bf = b?.p?.isFeatured === true || b?.p?.isFeatured === 1 || String(b?.p?.isFeatured).toLowerCase() === 'true';
        if (af === bf) return a.idx - b.idx;
        return af ? -1 : 1;
      })
      .map((x) => x.p);
  }, [otherItems]);

  const abortProductRef = useRef(null);
  const abortReviewsRef = useRef(null);
  const abortOtherRef = useRef(null);

  const media = useMemo(() => extractMedia(product), [product]);
  const vendorText = useMemo(() => vendorSourceText(product), [product]);
  const vendorId = useMemo(() => getVendorId(product), [product]);
  const isFeatured = useMemo(
    () => product?.isFeatured === true || product?.isFeatured === 1 || String(product?.isFeatured).toLowerCase() === 'true',
    [product]
  );
  const off = useMemo(
    () => discountPercent({ price: product?.price, compareAtPrice: product?.compareAtPrice }),
    [product]
  );

  const detailsPairs = useMemo(() => {
    const pairs = [];
    const add = (label, value) => {
      if (value == null || value === '') return;
      pairs.push({ label, value: String(value) });
    };
    add('Brand', product?.brand);
    add('Category', product?.category);
    add('SKU', product?.sku);
    add('Unit', product?.unit);
    add('Weight', product?.weight ? `${product.weight} ${product?.weightUnit || ''}`.trim() : null);
    add('Stock', product?.stock);
    return pairs;
  }, [product]);

  const extraPairs = useMemo(() => extraFieldsToPairs(product?.extraFields), [product]);

  const loadProduct = async () => {
    if (!id) return;
    if (abortProductRef.current) abortProductRef.current.abort();
    const ctrl = new AbortController();
    abortProductRef.current = ctrl;
    setLoading(true);
    try {
      const p = await productService.getCustomerProduct(id, { signal: ctrl.signal });
      setProduct(p || null);
      const m = extractMedia(p || {});
      setMode(m.images.length ? 'images' : m.videos.length ? 'videos' : 'images');
      setActiveIndex(0);
      setActiveVideoIndex(0);
      setOpenDetails(true);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load product', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async ({ page = 1, append = false } = {}) => {
    if (!id) return;
    if (abortReviewsRef.current) abortReviewsRef.current.abort();
    const ctrl = new AbortController();
    abortReviewsRef.current = ctrl;
    if (append) setReviewsMoreLoading(true);
    try {
      const res = await productService.listProductReviews({
        productId: id,
        page,
        limit: 3,
        signal: ctrl.signal,
      });
      const incoming = Array.isArray(res?.items) ? res.items : [];
      if (!append) setReviewsSummary(res?.summary ?? null);
      setReviews((prev) => {
        if (!append) return incoming;
        const seen = new Set((Array.isArray(prev) ? prev : []).map((x) => String(x?.id ?? x?._id ?? '')));
        const merged = [...(Array.isArray(prev) ? prev : [])];
        for (const it of incoming) {
          const key = String(it?.id ?? it?._id ?? '');
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
        return merged;
      });
      setReviewsMeta(res?.meta ?? { page, totalPages: 1, total: null });
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      if (!append) setReviews([]);
      addToast(e?.message || 'Failed to load reviews', 'error');
    } finally {
      if (append) setReviewsMoreLoading(false);
    }
  };

  const loadOther = async ({ nextPage, append }) => {
    const category = product?.category || undefined;
    if (!category) {
      setOtherItems([]);
      setOtherHasMore(false);
      return;
    }
    if (abortOtherRef.current) abortOtherRef.current.abort();
    const ctrl = new AbortController();
    abortOtherRef.current = ctrl;
    try {
      const res = await productService.listCustomerProducts({
        page: nextPage,
        limit: 6,
        category,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        signal: ctrl.signal,
      });

      const currentId = String(pickId(product) ?? id ?? '');
      const incomingAll = (res?.items || []).filter((x) => String(pickId(x) ?? '') !== currentId);
      const incoming = incomingAll.slice(0, 4);

      setOtherItems((prev) => {
        if (!append) return incoming;
        const seen = new Set(prev.map((x) => String(pickId(x) ?? '')));
        const merged = [...prev];
        for (const it of incoming) {
          const pid = String(pickId(it) ?? '');
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          merged.push(it);
        }
        return merged;
      });
      setOtherHasMore(incomingAll.length > 4 || Number(res?.meta?.totalPages || 1) > 1);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load other products', 'error');
    }
  };

  useEffect(() => {
    loadProduct();
    setReviews([]);
    setReviewsMeta({ page: 1, totalPages: 1, total: 0 });
    setReviewsSummary(null);
    loadReviews({ page: 1, append: false });
    return () => {
      if (abortProductRef.current) abortProductRef.current.abort();
      if (abortReviewsRef.current) abortReviewsRef.current.abort();
      if (abortOtherRef.current) abortOtherRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!product) return;
    if (!product?.category) {
      setOtherItems([]);
      setOtherHasMore(false);
      return;
    }
    loadOther({ nextPage: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?._id]);

  const openAddToCart = () => {
    setCartTarget(product);
    setCartQty(1);
    setCartOpen(true);
  };

  const closeAddToCart = () => {
    if (cartAdding) return;
    setCartOpen(false);
  };

  const confirmAddToCart = async () => {
    const pid = pickId(cartTarget || product);
    const qty = Math.max(1, Math.floor(Number(cartQty) || 1));
    if (!pid) return;
    setCartAdding(true);
    try {
      await cartService.addItem({ productId: pid, quantity: qty });
      addToast(`${qty} ${qty === 1 ? 'item' : 'items'} added to cart`, 'success');
      setCartOpen(false);
    } catch (e) {
      addToast(e?.message || 'Failed to add to cart', 'error');
    } finally {
      setCartAdding(false);
    }
  };

  const activeImage = media.images[activeIndex] ?? media.images[0] ?? null;
  const hasVideos = media.videos.length > 0;
  const activeVideo = media.videos[activeVideoIndex] ?? media.videos[0] ?? null;

  const canViewAll = Boolean(otherHasMore);

  const ReviewsCard = () => {
    const list = Array.isArray(reviews) ? reviews : [];
    if (!list.length) return null;
    const canLoadMore = Number(reviewsMeta?.page || 1) < Number(reviewsMeta?.totalPages || 1);

    const Star = ({ filled }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className={filled ? 'text-amber-400' : 'text-gray-200'}
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2Z" />
      </svg>
    );

    const Stars = ({ rating }) => {
      const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
      return (
        <div className="inline-flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={String(i)} filled={i < r} />
          ))}
        </div>
      );
    };

    const reviewerName = (rev) => {
      const c = rev?.customer ?? rev?.user ?? rev?.customerDetails ?? null;
      const direct = rev?.customerName ?? c?.name ?? c?.fullName ?? null;
      const fromParts = [c?.firstName ?? c?.first_name ?? null, c?.lastName ?? c?.last_name ?? null]
        .filter(Boolean)
        .join(' ')
        .trim();
      const name = String(direct || fromParts || 'Customer').trim();
      return name || 'Customer';
    };

    const initialsFor = (name) => {
      const s = String(name || '').trim();
      if (!s) return 'C';
      const parts = s.split(/\s+/g).filter(Boolean);
      const a = parts[0]?.[0] || '';
      const b = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]) || '';
      const out = `${a}${b}`.toUpperCase();
      return out || 'C';
    };

    const fmtDate = (d) => {
      const dt = d ? new Date(d) : null;
      if (!dt || Number.isNaN(dt.getTime())) return null;
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-gray-900">Reviews</p>
            <p className="text-[12px] text-gray-400 mt-1">What customers are saying</p>
          </div>
          <div className="text-[12px] font-semibold text-gray-500">
            {reviewsMeta?.total ? `${list.length} / ${reviewsMeta.total}` : list.length}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {list.map((rev) => {
            const comment = String(rev?.comment ?? '').trim();
            const when = fmtDate(rev?.createdAt ?? rev?.updatedAt ?? null);
            const name = reviewerName(rev);
            const initials = initialsFor(name);
            return (
              <div
                key={String(rev?.id ?? rev?._id ?? `${rev?.customerId ?? 'c'}-${rev?.createdAt ?? Math.random()}`)}
                className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary-dark text-white flex items-center justify-center text-[11px] font-extrabold overflow-hidden border border-white shadow-sm">
                      <span>{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-gray-800 truncate">{name}</p>
                      {when ? <p className="text-[11px] text-gray-400 mt-0.5">{when}</p> : null}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Stars rating={rev?.rating} />
                  </div>
                </div>
                {comment ? (
                  <p className="mt-3 text-[12px] text-gray-700 leading-relaxed whitespace-pre-line">{comment}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {canLoadMore ? (
          <button
            type="button"
            onClick={() => loadReviews({ page: Number(reviewsMeta?.page || 1) + 1, append: true })}
            disabled={reviewsMoreLoading}
            className="mt-4 w-full py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {reviewsMoreLoading ? 'Loading…' : 'Load more reviews'}
          </button>
        ) : null}
      </div>
    );
  };

  const OtherProductCard = ({ p }) => {
    const img = firstImageUrl(p);
    const pid = pickId(p);
    const sourceText = sourceBadgeText(p);
    const otherOff = discountPercent({ price: p?.price, compareAtPrice: p?.compareAtPrice });
    const isFeatured =
      p?.isFeatured === true || p?.isFeatured === 1 || String(p?.isFeatured).toLowerCase() === 'true';
    return (
      <div className="group">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/customer/shopping/${pid}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(`/customer/shopping/${pid}`);
          }}
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100 cursor-pointer"
        >
          {img ? (
            <SafeImage src={img} alt="" className="w-full h-full object-contain p-2 bg-white" loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <div className="mt-2 text-[11px] font-bold text-gray-300">No image</div>
            </div>
          )}
          {sourceText ? (
            <div className="absolute top-2 right-2 max-w-[78%]">
              <span className="block px-2 py-1 rounded-lg bg-white/95 backdrop-blur border border-gray-100 text-[10px] font-bold text-gray-600 shadow-sm line-clamp-1">
                {sourceText}
              </span>
            </div>
          ) : null}
          {isFeatured ? (
            <div className="absolute top-2 left-2 z-20 pointer-events-none">
              <span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 shadow-sm flex items-center justify-center text-amber-500">
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
              setCartTarget(p);
              setCartQty(1);
              setCartOpen(true);
            }}
            className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-white/95 shadow-sm border border-gray-100 flex items-center justify-center text-primary-dark transition-colors hover:bg-primary-dark hover:text-white cursor-pointer"
            aria-label="Add to cart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="mt-2">
          <p className="text-[12px] md:text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2">
            {p?.name || 'Product'}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-[13px] md:text-[14px] font-bold text-gray-900">₹{formatMoney(p?.price)}</div>
          {otherOff != null ? (
            <span className="shrink-0 px-2 py-1 rounded-lg bg-green-50 border border-green-100 text-[10px] font-bold text-green-700">
              {otherOff}% off
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full pb-[140px] md:pb-10 animate-fade-in">
      {loading ? (
        <div className="text-[13px] text-gray-400">Loading…</div>
      ) : !product ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">Product not found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-4 md:gap-6">
            {/* Media */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 md:hidden">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="p-2 rounded-xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
                  aria-label="Back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              </div>

              <div className="relative w-full max-w-[380px] md:max-w-[420px] mx-auto aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
                {mode === 'videos' && hasVideos ? (
                  <video
                    key={activeVideo || 'video'}
                    src={activeVideo || undefined}
                    controls
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    poster={activeImage || undefined}
                  />
                ) : activeImage ? (
                  <SafeImage src={activeImage} alt="" className="w-full h-full object-contain p-3 bg-white" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <div className="mt-2 text-[12px] font-bold text-gray-300">No image</div>
                  </div>
                )}

                {/* Featured badge overlay */}
                {isFeatured ? (
                  <div className="absolute top-3 left-3 z-30 pointer-events-none">
                    <span className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 shadow-sm flex items-center justify-center text-amber-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </span>
                  </div>
                ) : null}

                {/* Media nav (arrows) */}
                {mode === 'images' && media.images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveIndex((i) => (i - 1 + media.images.length) % media.images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white"
                      aria-label="Previous"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIndex((i) => (i + 1) % media.images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white"
                      aria-label="Next"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </>
                ) : mode === 'videos' && hasVideos && media.videos.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveVideoIndex((i) => (i - 1 + media.videos.length) % media.videos.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white"
                      aria-label="Previous video"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVideoIndex((i) => (i + 1) % media.videos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white"
                      aria-label="Next video"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </>
                ) : null}
              </div>

              {/* Dots */}
              {mode === 'images' && media.images.length > 1 ? (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {media.images.map((_, idx) => (
                    <button
                      key={String(idx)}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={`w-2 h-2 rounded-full ${idx === activeIndex ? 'bg-primary-dark' : 'bg-gray-200'}`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              ) : null}

              {/* Mode toggle (only if videos exist) */}
              {hasVideos ? (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('images')}
                    className={`w-11 h-11 rounded-xl border inline-flex items-center justify-center ${
                      mode === 'images'
                        ? 'border-primary-dark text-primary-dark bg-primary-dark/5'
                        : 'border-gray-100 text-gray-600 bg-white hover:bg-gray-50'
                    }`}
                    aria-label="View images"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('videos')}
                    className={`w-11 h-11 rounded-xl border inline-flex items-center justify-center ${
                      mode === 'videos'
                        ? 'border-primary-dark text-primary-dark bg-primary-dark/5'
                        : 'border-gray-100 text-gray-600 bg-white hover:bg-gray-50'
                    }`}
                    aria-label="View videos"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m22 8-6 4 6 4V8Z" />
                      <rect x="2" y="6" width="14" height="12" rx="2" />
                    </svg>
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={openAddToCart}
                className="mt-5 w-full py-3 rounded-full bg-primary-dark text-white text-[12px] font-bold hover:opacity-90"
              >
                Add to cart
              </button>
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
              {(() => {
                const total = Number(reviewsSummary?.totalReviews);
                const avg = Number(reviewsSummary?.averageRating);
                const hasReviews = Number.isFinite(total) ? total > 0 : avg > 0;
                const hasAvg = Number.isFinite(avg) && avg > 0;
                return hasReviews && hasAvg;
              })() ? (
                <div className="mb-2 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const r = Math.max(0, Math.min(5, Math.round(Number(reviewsSummary?.averageRating) || 0)));
                      const filled = i < r;
                      return (
                        <svg
                          key={String(i)}
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill={filled ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          className={filled ? 'text-amber-400' : 'text-gray-200'}
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2Z" />
                        </svg>
                      );
                    })}
                  </div>
                  <div className="text-[12px] font-semibold text-gray-600">
                    {Number(reviewsSummary?.averageRating).toFixed(1)}
                  </div>
                </div>
              ) : null}
              <p className="text-[16px] md:text-[18px] font-bold text-gray-900">{product?.name || 'Product'}</p>
              {vendorText ? (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] md:text-[13px] text-gray-500 font-medium">{vendorText}</p>
                  {vendorId != null ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/customer/vendors/${vendorId}`)}
                      className="text-[12px] md:text-[13px] font-extrabold text-primary-dark hover:underline"
                    >
                      View Jeweller profile →
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-2 flex items-center flex-wrap gap-2">
                <div className="text-[20px] md:text-[22px] font-extrabold text-gray-900">₹{formatMoney(product?.price)}</div>
                {Number(product?.compareAtPrice || 0) > Number(product?.price || 0) ? (
                  <div className="text-[13px] text-gray-400 line-through">M.R.P. ₹{formatMoney(product?.compareAtPrice)}</div>
                ) : null}
                {off != null ? (
                  <span className="px-2 py-1 rounded-lg bg-green-50 border border-green-100 text-[10px] font-bold text-green-700">
                    {off}% off
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[13px] text-gray-400">(Incl. of all taxes)</div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setOpenDetails((v) => !v)}
                  className="w-full flex items-center justify-between text-[13px] font-bold text-primary-dark"
                >
                  <span>View product details</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={openDetails ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
                  </svg>
                </button>

                {openDetails ? (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {/* Basic fields */}
                    {detailsPairs.map((x) => (
                      <div key={x.label} className="grid grid-cols-[130px_1fr] md:grid-cols-[170px_1fr] gap-3 text-[13px] md:text-[14px]">
                        <div className="text-gray-400">{x.label}</div>
                        <div className="text-gray-800 font-medium">{x.value}</div>
                      </div>
                    ))}

                    {/* Description */}
                    {product?.description ? (
                      <div className="grid grid-cols-[130px_1fr] md:grid-cols-[170px_1fr] gap-3 text-[13px] md:text-[14px]">
                        <div className="text-gray-400">Description</div>
                        <div className="text-gray-800 font-medium whitespace-pre-line">{product.description}</div>
                      </div>
                    ) : null}

                    {/* Extra fields */}
                    {extraPairs.length ? (
                      <>
                        {extraPairs.map((x) => (
                          <div key={x.key} className="grid grid-cols-[130px_1fr] md:grid-cols-[170px_1fr] gap-3 text-[13px] md:text-[14px]">
                            <div className="text-gray-400">{x.label}</div>
                            <div className="text-gray-800 font-medium whitespace-pre-line">{x.value}</div>
                          </div>
                        ))}
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setOpenDetails(false)}
                      className="text-[13px] font-bold text-primary-dark mt-2 inline-flex items-center gap-2"
                    >
                      View less
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Reviews (only when present) */}
          <ReviewsCard />

          {/* Other products (category only). Hide section if none. */}
          {otherItems.length > 0 ? (
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-gray-900">Other products</p>
                {canViewAll ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/customer/shopping/${id}/similar`, {
                        state: { category: product?.category ?? null },
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
                  >
                    View All
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {featuredFirstOtherItems.map((p) => (
                  <OtherProductCard key={String(pickId(p) ?? Math.random())} p={p} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Add-to-cart quantity picker */}
      {cartOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeAddToCart}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-gray-800">Add to cart</p>
                <p className="text-[12px] text-gray-400 mt-1 truncate">{cartTarget?.name || product?.name || 'Product'}</p>
              </div>
              <button
                type="button"
                onClick={closeAddToCart}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-50"
                aria-label="Close"
                disabled={cartAdding}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-gray-700">Quantity</p>
                <div className="inline-flex items-center overflow-hidden rounded-xl bg-primary-dark text-white">
                  <button
                    type="button"
                    onClick={() => setCartQty((v) => Math.max(1, (Number(v) || 1) - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    disabled={cartAdding || Number(cartQty) <= 1}
                    aria-label="Decrease quantity"
                  >
                    –
                  </button>
                  <input
                    value={cartQty}
                    onChange={(e) => setCartQty(e.target.value)}
                    inputMode="numeric"
                    className="w-12 h-10 bg-transparent text-center text-[13px] font-bold outline-none"
                    aria-label="Quantity"
                    disabled={cartAdding}
                  />
                  <button
                    type="button"
                    onClick={() => setCartQty((v) => (Number(v) || 1) + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    disabled={cartAdding}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={closeAddToCart}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                disabled={cartAdding}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAddToCart}
                className="px-5 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                disabled={cartAdding}
              >
                {cartAdding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

