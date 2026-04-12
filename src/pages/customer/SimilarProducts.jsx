import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import ProductGridCard from '../../components/customer/ProductGridCard';

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function pickId(p) {
  return p?.id ?? p?._id ?? p?.productId ?? null;
}

export default function SimilarProducts() {
  const { addToast } = useOutletContext();
  const { id } = useParams(); // main product id
  const location = useLocation();
  const navigate = useNavigate();

  const DESKTOP_GRID_KEY = 'mirah_shop_desktop_grid_cols';
  const [desktopGridCols, setDesktopGridCols] = useState(() => {
    try {
      const raw = localStorage.getItem(DESKTOP_GRID_KEY);
      const n = Number(raw);
      return n === 2 || n === 4 || n === 6 ? n : 4;
    } catch {
      return 4;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_GRID_KEY, String(desktopGridCols));
    } catch {
      // ignore
    }
  }, [desktopGridCols]);
  const desktopGridColsClass =
    desktopGridCols === 2 ? 'md:grid-cols-2' : desktopGridCols === 6 ? 'md:grid-cols-6' : 'md:grid-cols-4';

  const [category, setCategory] = useState(() => location?.state?.category || '');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });

  const [cartOpen, setCartOpen] = useState(false);
  const [cartTarget, setCartTarget] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [cartAdding, setCartAdding] = useState(false);
  const [cartVariantIdx, setCartVariantIdx] = useState(null);

  const cartVariants = useMemo(() => {
    return Array.isArray(cartTarget?.variants) ? cartTarget.variants.filter(Boolean) : [];
  }, [cartTarget]);

  const selectedCartVariant = useMemo(() => {
    if (!cartVariants.length) return null;
    const idx = Number(cartVariantIdx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= cartVariants.length) return null;
    return cartVariants[idx] || null;
  }, [cartVariantIdx, cartVariants]);

  const variantLabel = (v) => {
    const parts = [];
    const type = String(v?.type ?? '').trim();
    const size = String(v?.size ?? '').trim();
    const dimRaw = v?.sizeDimensions ?? v?.size_dimensions ?? null;
    const dim = dimRaw == null || dimRaw === '' ? null : String(dimRaw).trim();
    const unit = String(v?.sizeDimensionsUnit ?? v?.size_dimensions_unit ?? '').trim();
    if (type) parts.push(type);
    if (size) parts.push(size);
    if (dim) parts.push(`${dim}${unit ? ` ${unit}` : ''}`.trim());
    return parts.join(' · ') || 'Variant';
  };

  const featuredFirstItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        const af = a?.p?.isFeatured === true || a?.p?.isFeatured === 1 || String(a?.p?.isFeatured).toLowerCase() === 'true';
        const bf = b?.p?.isFeatured === true || b?.p?.isFeatured === 1 || String(b?.p?.isFeatured).toLowerCase() === 'true';
        if (af === bf) return a.idx - b.idx;
        return af ? -1 : 1;
      })
      .map((x) => x.p);
  }, [items]);

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
    const variants = Array.isArray(p?.variants) ? p.variants : [];
    setCartVariantIdx(variants.length === 1 ? 0 : null);
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
    if (cartVariants.length && !selectedCartVariant) {
      addToast('Please select a variant before adding to cart', 'error');
      return;
    }
    setCartAdding(true);
    try {
      const variantsPayload = selectedCartVariant
        ? {
            type: selectedCartVariant?.type ?? undefined,
            size: selectedCartVariant?.size ?? undefined,
            sizeDimensions: selectedCartVariant?.sizeDimensions ?? selectedCartVariant?.size_dimensions ?? undefined,
            sizeDimensionsUnit:
              selectedCartVariant?.sizeDimensionsUnit ?? selectedCartVariant?.size_dimensions_unit ?? undefined,
          }
        : undefined;
      await cartService.addItem({ productId: pid, quantity: qty, variants: variantsPayload });
      addToast(`${qty} ${qty === 1 ? 'item' : 'items'} added to cart`, 'success');
      setCartOpen(false);
      setCartTarget(null);
    } catch (e) {
      addToast(e?.message || 'Failed to add to cart', 'error');
    } finally {
      setCartAdding(false);
    }
  };

  return (
    <div className="w-full pb-[160px] lg:pb-[96px] animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/customer/shopping/${id}`)}
            className="p-2 rounded-xl bg-white border border-pale text-mid hover:bg-cream"
            aria-label="Back to product"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ink">Similar products</p>
            {category ? (
              <p className="text-[12px] text-muted mt-0.5 truncate">Category: {category}</p>
            ) : null}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <p className="text-[12px] font-semibold text-muted">Grids</p>
          <div className="inline-flex items-center bg-white border border-pale rounded-xl p-1">
            {[2, 4, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDesktopGridCols(n)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                  desktopGridCols === n ? 'bg-walnut text-blush' : 'text-mid hover:bg-cream'
                }`}
                aria-label={`${n} products per row`}
                title={`${n} per row`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-[calc(100vh-260px)] flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg
              className="animate-spin text-ink"
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
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <p className="mt-4 text-[14px] font-bold text-ink">No similar products found</p>
              <p className="mt-1 text-[12px] text-muted">Try another product category.</p>
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-3 ${desktopGridColsClass} gap-4`}>
            {featuredFirstItems.map((p) => (
              <ProductGridCard
                key={String(pickId(p) ?? Math.random())}
                product={p}
                onNavigate={() => navigate(`/customer/shopping/${pickId(p)}`)}
                onAddToCart={() => openAddToCart(p)}
              />
            ))}
          </div>
        )}
      </div>

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
                  className="px-4 py-2 rounded-xl bg-white border border-pale text-[12px] font-semibold text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Prev
                </button>
                <div className="px-4 py-2 rounded-xl bg-white border border-pale text-[12px] text-muted shadow-sm whitespace-nowrap">
                  Page <span className="font-semibold text-ink">{currentPage}</span> of{' '}
                  <span className="font-semibold text-ink">{totalPages}</span>
                </div>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => fetchList(currentPage + 1)}
                  className="px-4 py-2 rounded-xl bg-white border border-pale text-[12px] font-semibold text-mid hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
          className="fixed inset-0 z-[90] bg-ink/25 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeAddToCart}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">Add to cart</p>
                <p className="text-[13px] md:text-[14px] text-muted mt-1 truncate">{cartTarget?.name || 'Product'}</p>
              </div>
              <button
                type="button"
                onClick={closeAddToCart}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-50"
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
              {cartVariants.length ? (
                <div className="mb-5">
                  <p className="text-[13px] font-semibold text-mid">Size Options</p>
                  <div className="mt-3 space-y-2">
                    {cartVariants.map((v, idx) => {
                      const checked = Number(cartVariantIdx) === idx;
                      const price = Number(v?.price);
                      const showPrice = Number.isFinite(price) && price > 0;
                      return (
                        <label
                          key={String(idx)}
                          className="flex items-start gap-3 p-3 rounded-2xl border border-pale bg-cream/60 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="cart_variant"
                            checked={checked}
                            onChange={() => setCartVariantIdx(idx)}
                            className="mt-1 w-4 h-4 text-ink focus:ring-walnut/30"
                            disabled={cartAdding}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[12px] font-bold text-ink truncate">{variantLabel(v)}</p>
                              {showPrice ? (
                                <p className="text-[12px] font-extrabold text-ink">₹{formatMoney(price)}</p>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted">Select this option to add this variant.</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-mid">Quantity</p>
                <div className="inline-flex items-center overflow-hidden rounded-xl bg-walnut text-blush">
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

            <div className="px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={closeAddToCart}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer disabled:opacity-50"
                disabled={cartAdding}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAddToCart}
                className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                disabled={cartAdding || (cartVariants.length > 0 && !selectedCartVariant)}
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

