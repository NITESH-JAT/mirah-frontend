import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import { sourceBadgeText } from '../../utils/productSource';

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

function firstImageUrl(p) {
  const images = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? null;
  if (Array.isArray(images) && images[0]) return images[0];
  if (typeof images === 'string') return images;
  return null;
}

function pickId(p) {
  return p?.id ?? p?._id ?? p?.productId ?? null;
}

export default function SimilarProducts() {
  const { addToast } = useOutletContext();
  const { id } = useParams(); // main product id
  const location = useLocation();
  const navigate = useNavigate();

  const [category, setCategory] = useState(() => location?.state?.category || '');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });

  const [cartOpen, setCartOpen] = useState(false);
  const [cartTarget, setCartTarget] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [cartAdding, setCartAdding] = useState(false);

  const abortRef = useRef(null);
  const metaAbortRef = useRef(null);

  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const currentPage = Number(meta?.page || 1) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;

  // If page was loaded directly, hydrate category from product details.
  useEffect(() => {
    if (category) return;
    if (!id) return;
    if (metaAbortRef.current) metaAbortRef.current.abort();
    const ctrl = new AbortController();
    metaAbortRef.current = ctrl;
    productService
      .getCustomerProduct(id, { signal: ctrl.signal })
      .then((p) => {
        const c = String(p?.category || '').trim();
        if (c) setCategory(c);
      })
      .catch(() => {})
      .finally(() => {});
    return () => ctrl.abort();
  }, [category, id]);

  const fetchList = async (nextPage) => {
    if (!category) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await productService.listCustomerProducts({
        page: nextPage,
        limit: 20,
        category,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        signal: ctrl.signal,
      });
      const currentId = String(id || '');
      const list = (res?.items || []).filter((p) => String(pickId(p) ?? '') !== currentId);
      setItems(list);
      setMeta({ page: Number(res?.meta?.page || nextPage) || nextPage, totalPages: Number(res?.meta?.totalPages || 1) || 1 });
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setItems([]);
    setMeta({ page: 1, totalPages: 1 });
    if (!category) return;
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const openAddToCart = (p) => {
    setCartTarget(p || null);
    setCartQty(1);
    setCartOpen(true);
  };

  const closeAddToCart = () => {
    if (cartAdding) return;
    setCartOpen(false);
    setCartTarget(null);
  };

  const confirmAddToCart = async () => {
    const pid = pickId(cartTarget);
    const qty = Math.max(1, Math.floor(Number(cartQty) || 1));
    if (!pid) return;
    setCartAdding(true);
    try {
      await cartService.addItem({ productId: pid, quantity: qty });
      addToast(`${qty} ${qty === 1 ? 'item' : 'items'} added to cart`, 'success');
      setCartOpen(false);
      setCartTarget(null);
    } catch (e) {
      addToast(e?.message || 'Failed to add to cart', 'error');
    } finally {
      setCartAdding(false);
    }
  };

  const ProductCard = ({ p }) => {
    const img = firstImageUrl(p);
    const sourceText = sourceBadgeText(p);
    const pid = pickId(p);
    const desc = String(p?.description ?? p?.shortDescription ?? p?.desc ?? '').trim();
    const off = discountPercent({ price: p?.price, compareAtPrice: p?.compareAtPrice });
    return (
      <div className="group">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/dashboard/shopping/${pid}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(`/dashboard/shopping/${pid}`);
          }}
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100 cursor-pointer"
        >
          {img ? (
            <img src={img} alt="" className="w-full h-full object-contain p-2 bg-white" loading="lazy" />
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openAddToCart(p);
            }}
            className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-white/95 shadow-sm border border-gray-100 flex items-center justify-center text-primary-dark hover:opacity-90 transition-opacity"
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
          <p className="mt-1 text-[11px] text-gray-500 line-clamp-1 min-h-[16px]">
            {desc || '\u00A0'}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-[13px] md:text-[14px] font-bold text-gray-900">₹{formatMoney(p?.price)}</div>
          {off != null ? (
            <span className="shrink-0 px-2 py-1 rounded-lg bg-green-50 border border-green-100 text-[10px] font-bold text-green-700">
              {off}% off
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full pb-[160px] lg:pb-[96px] animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(`/dashboard/shopping/${id}`)}
          className="p-2 rounded-xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
          aria-label="Back to product"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-gray-900">Similar products</p>
          {category ? (
            <p className="text-[12px] text-gray-400 mt-0.5 truncate">Category: {category}</p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 md:p-14 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <svg
              className="animate-spin text-primary-dark"
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path
                d="M22 12a10 10 0 0 0-10-10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 md:p-14 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <p className="mt-4 text-[14px] font-bold text-gray-900">No similar products found</p>
            <p className="mt-1 text-[12px] text-gray-500">Try another product category.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {items.map((p) => (
            <ProductCard key={String(pickId(p) ?? Math.random())} p={p} />
          ))}
        </div>
      )}

      {/* Fixed pagination bar */}
      {!loading && items.length > 0 ? (
        <div className="fixed left-0 right-0 z-40 bottom-0 lg:left-[240px]">
          <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="max-w-5xl lg:max-w-none mx-auto">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => fetchList(Math.max(1, currentPage - 1))}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Prev
                </button>
                <div className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] text-gray-500 shadow-sm whitespace-nowrap">
                  Page <span className="font-semibold text-gray-800">{currentPage}</span> of{' '}
                  <span className="font-semibold text-gray-800">{totalPages}</span>
                </div>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => fetchList(currentPage + 1)}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                <p className="text-[12px] text-gray-400 mt-1 truncate">{cartTarget?.name || 'Product'}</p>
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
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50"
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
                    className="w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50"
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

