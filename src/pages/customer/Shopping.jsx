import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import ProductGridCard from '../../components/customer/ProductGridCard';
import ListPaginationBar from '../../components/customer/ListPaginationBar';
import { formatMoney } from '../../utils/formatMoney';

const SortOptions = [
  { id: 'newest', label: 'Newest', sortBy: 'createdAt', sortOrder: 'desc' },
  { id: 'price_asc', label: 'Price: Low to High', sortBy: 'price', sortOrder: 'asc' },
  { id: 'price_desc', label: 'Price: High to Low', sortBy: 'price', sortOrder: 'desc' },
];

export default function Shopping() {
  const { addToast } = useOutletContext();
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

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortId, setSortId] = useState('newest');

  // Applied filters (used for API requests)
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [featured, setFeatured] = useState(false);

  // Draft filters (only applied on "Apply")
  const [draftCategory, setDraftCategory] = useState('');
  const [draftBrand, setDraftBrand] = useState('');
  const [draftFeatured, setDraftFeatured] = useState(false);

  const [openFilters, setOpenFilters] = useState(false);
  const [openSort, setOpenSort] = useState(false);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });

  const [filterMetaLoading, setFilterMetaLoading] = useState(false);
  const [brandOptions, setBrandOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartProduct, setCartProduct] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [cartAdding, setCartAdding] = useState(false);
  const [cartVariantIdx, setCartVariantIdx] = useState(null);

  const cartVariants = useMemo(() => {
    return Array.isArray(cartProduct?.variants) ? cartProduct.variants.filter(Boolean) : [];
  }, [cartProduct]);

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
  const debounceRef = useRef(null);
  const filterMetaAbortRef = useRef(null);

  const sort = useMemo(() => SortOptions.find((x) => x.id === sortId) || SortOptions[0], [sortId]);

  const canPrev = Number(meta?.page || 1) > 1;
  const canNext = Number(meta?.page || 1) < Number(meta?.totalPages || 1);
  const currentPage = Number(meta?.page || page) || 1;
  const totalPages = Number(meta?.totalPages || 1) || 1;

  const fetchList = async ({ nextPage, query }) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const search = String(query ?? '').trim();
      const res = await productService.listCustomerProducts({
        page: nextPage,
        limit,
        category: category || undefined,
        brand: brand || undefined,
        featured: featured ? true : undefined,
        search: search || undefined,
        sortBy: sort?.sortBy,
        sortOrder: sort?.sortOrder,
        signal: ctrl.signal,
      });
      setItems(res.items || []);
      setMeta(res.meta || { page: nextPage, totalPages: 1, total: null });
      setPage(Number(res?.meta?.page || nextPage) || nextPage);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openFilterModal = () => {
    // sync draft from applied
    setDraftCategory(category);
    setDraftBrand(brand);
    setDraftFeatured(featured);
    setOpenFilters(true);
  };

  // Debounced search + filter/sort refresh
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = q;
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchList({ nextPage: 1, query });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, brand, featured, sortId]);

  // Load filter metadata (brands/categories) once
  useEffect(() => {
    if (filterMetaAbortRef.current) filterMetaAbortRef.current.abort();
    const ctrl = new AbortController();
    filterMetaAbortRef.current = ctrl;
    setFilterMetaLoading(true);
    Promise.all([
      productService.listCustomerBrands({ signal: ctrl.signal }),
      productService.listCustomerCategories({ signal: ctrl.signal }),
    ])
      .then(([brands, categories]) => {
        setBrandOptions(Array.isArray(brands) ? brands : []);
        setCategoryOptions(Array.isArray(categories) ? categories : []);
      })
      .catch((e) => {
        if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
        // keep UI usable even if meta fails
      })
      .finally(() => setFilterMetaLoading(false));

    return () => {
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    // initial load
    fetchList({ nextPage: 1, query: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddToCart = (p) => {
    setCartProduct(p || null);
    setCartQty(1);
    const variants = Array.isArray(p?.variants) ? p.variants : [];
    setCartVariantIdx(variants.length === 1 ? 0 : null);
    setCartOpen(true);
  };

  const closeAddToCart = () => {
    if (cartAdding) return;
    setCartOpen(false);
    setCartProduct(null);
  };

  const confirmAddToCart = async () => {
    const pid = cartProduct?.id ?? cartProduct?._id ?? cartProduct?.productId ?? null;
    const qty = Math.max(1, Math.floor(Number(cartQty) || 1));
    if (!pid) {
      addToast('Invalid product', 'error');
      return;
    }
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
      setCartProduct(null);
    } catch (e) {
      addToast(e?.message || 'Failed to add to cart', 'error');
    } finally {
      setCartAdding(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col pb-0 animate-fade-in lg:min-h-[calc(100dvh-6rem)]">
      {/* Sticky toolbar: phone = 60% search / 20% Filters / 20% Sort; md+ = flex row + grid toggles */}
      <div className="sticky top-0 z-30 isolate bg-cream -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 border-b border-pale/60">
        <div className="grid grid-cols-10 gap-2 md:flex md:w-full md:flex-nowrap md:items-center md:justify-between md:gap-3">
          <div className="relative col-span-6 min-w-0 md:w-[420px] md:max-w-[55vw] md:shrink-0">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Jewellery"
              className="input-search-quiet-focus w-full rounded-2xl border border-pale bg-white py-2.5 pl-9 pr-2 text-[12px] font-medium text-ink placeholder:text-muted focus:outline-none md:py-3 md:pl-11 md:pr-4 md:text-[13px] md:focus:border-walnut"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted md:left-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="md:h-[18px] md:w-[18px]">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          <div className="col-span-4 flex min-w-0 items-center gap-2 md:min-w-0 md:shrink-0 md:justify-end">
            <button
              type="button"
              onClick={() => {
                if (openFilters) setOpenFilters(false);
                else openFilterModal();
              }}
              className="min-w-0 flex-1 truncate rounded-full border border-pale bg-white px-2 py-2.5 text-center text-[11px] font-semibold text-mid hover:bg-cream md:flex-initial md:shrink-0 md:px-5 md:py-3 md:text-[12px]"
            >
              Filters
            </button>

            <div className="relative min-w-0 flex-1 md:shrink-0">
              <button
                type="button"
                onClick={() => setOpenSort((v) => !v)}
                className="w-full truncate rounded-full border border-pale bg-white px-2 py-2.5 text-[11px] font-semibold text-mid hover:bg-cream md:px-5 md:py-3 md:text-[12px]"
              >
                Sort
              </button>
              {openSort ? (
                <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-pale bg-white shadow-sm">
                  {SortOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortId(opt.id);
                        setOpenSort(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-[12px] font-semibold hover:bg-cream ${
                        sortId === opt.id ? 'text-ink' : 'text-mid'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="hidden shrink-0 items-center gap-2 md:flex">
              {[2, 4, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDesktopGridCols(n)}
                  className={`min-h-[2.25rem] min-w-[2.25rem] rounded-lg px-2 text-[12px] font-bold transition-colors sm:min-w-[2.5rem] ${
                    desktopGridCols === n
                      ? 'bg-walnut text-blush shadow-sm'
                      : 'border border-pale bg-white text-mid hover:bg-cream'
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
      </div>

      {/* Filters panel (mobile drawer) */}
      {openFilters ? (
        <div
          className="fixed inset-0 z-[80] bg-ink/25 flex items-end md:items-stretch md:justify-end justify-center px-3 md:px-0 pt-[calc(env(safe-area-inset-top)+12px)] md:pt-0 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-0"
          onMouseDown={() => setOpenFilters(false)}
        >
          <div
            className="w-full max-w-xl md:w-[420px] md:max-w-[420px] bg-white rounded-t-2xl md:rounded-none shadow-sm border border-pale overflow-hidden max-h-[calc(100dvh-24px)] md:max-h-none md:h-full flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-ink">Filters</p>
                <p className="text-[12px] text-muted mt-1">Refine results</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenFilters(false)}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">Category</label>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                  >
                    <option value="">All</option>
                    {filterMetaLoading ? (
                      <option value="" disabled>
                        Loading…
                      </option>
                    ) : null}
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">Collection</label>
                  <select
                    value={draftBrand}
                    onChange={(e) => setDraftBrand(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-mid bg-white border-pale focus:outline-none focus:ring-1 focus:ring-walnut/20 focus:border-walnut"
                  >
                    <option value="">All</option>
                    {filterMetaLoading ? (
                      <option value="" disabled>
                        Loading…
                      </option>
                    ) : null}
                    {brandOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12px] text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draftFeatured}
                  onChange={(e) => setDraftFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                />
                <span className="font-medium">Featured</span>
              </label>
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => {
                  setDraftCategory('');
                  setDraftBrand('');
                  setDraftFeatured(false);
                }}
                className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory(draftCategory);
                  setBrand(draftBrand);
                  setFeatured(Boolean(draftFeatured));
                  setOpenFilters(false);
                }}
                className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`mt-4 flex min-h-0 flex-1 flex-col ${
          !loading && items.length > 0 ? 'justify-between gap-4' : ''
        }`}
      >
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
              <p className="mt-4 text-[14px] font-bold text-ink">No products found</p>
              <p className="mt-1 text-[12px] text-muted">Try changing filters or search.</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-1 ${desktopGridColsClass} gap-4`}>
              {featuredFirstItems.map((p) => (
                <ProductGridCard
                  key={String(p?.id ?? p?._id ?? p?.productId ?? Math.random())}
                  product={p}
                  onNavigate={() => navigate(`/customer/shopping/${p?.id ?? p?._id ?? p?.productId ?? ''}`)}
                  onAddToCart={() => openAddToCart(p)}
                />
              ))}
            </div>
            <ListPaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={meta?.total}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => fetchList({ nextPage: Math.max(1, currentPage - 1), query: q })}
              onNext={() => fetchList({ nextPage: currentPage + 1, query: q })}
            />
          </>
        )}
      </div>

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
                <p className="text-[13px] md:text-[14px] text-muted mt-1 truncate">{cartProduct?.name || 'Product'}</p>
              </div>
              <button
                type="button"
                onClick={closeAddToCart}
                className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-50"
                aria-label="Close"
                disabled={cartAdding}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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

