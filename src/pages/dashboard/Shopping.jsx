import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';

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

const SortOptions = [
  { id: 'newest', label: 'Newest', sortBy: 'createdAt', sortOrder: 'desc' },
  { id: 'price_asc', label: 'Price: Low to High', sortBy: 'price', sortOrder: 'asc' },
  { id: 'price_desc', label: 'Price: High to Low', sortBy: 'price', sortOrder: 'desc' },
];

export default function Shopping() {
  const { addToast } = useOutletContext();

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sortId, setSortId] = useState('newest');

  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [featured, setFeatured] = useState(false);

  const [openFilters, setOpenFilters] = useState(false);
  const [openSort, setOpenSort] = useState(false);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });

  const [cartOpen, setCartOpen] = useState(false);
  const [cartProduct, setCartProduct] = useState(null);
  const [cartQty, setCartQty] = useState(1);
  const [cartAdding, setCartAdding] = useState(false);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const sort = useMemo(() => SortOptions.find((x) => x.id === sortId) || SortOptions[0], [sortId]);

  const derived = useMemo(() => {
    const cats = new Set();
    const brands = new Set();
    for (const p of items || []) {
      if (p?.category) cats.add(String(p.category));
      if (p?.brand) brands.add(String(p.brand));
    }
    return {
      categories: Array.from(cats).sort((a, b) => a.localeCompare(b)),
      brands: Array.from(brands).sort((a, b) => a.localeCompare(b)),
    };
  }, [items]);

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
      const res = await productService.listCustomerProducts({
        page: nextPage,
        limit,
        category: category || undefined,
        brand: brand || undefined,
        minPrice: minPrice === '' ? undefined : Number(minPrice),
        maxPrice: maxPrice === '' ? undefined : Number(maxPrice),
        featured: featured ? true : undefined,
        search: query || undefined,
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
  }, [q, category, brand, minPrice, maxPrice, featured, sortId]);

  useEffect(() => {
    // initial load
    fetchList({ nextPage: 1, query: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddToCart = (p) => {
    setCartProduct(p || null);
    setCartQty(1);
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
    setCartAdding(true);
    try {
      await cartService.addItem({ productId: pid, quantity: qty });
      addToast(`${qty} ${qty === 1 ? 'item' : 'items'} added to cart`, 'success');
      setCartOpen(false);
      setCartProduct(null);
    } catch (e) {
      addToast(e?.message || 'Failed to add to cart', 'error');
    } finally {
      setCartAdding(false);
    }
  };

  const ProductCard = ({ p }) => {
    const img = firstImageUrl(p);
    const off = discountPercent({ price: p?.price, compareAtPrice: p?.compareAtPrice });
    return (
      <div className="group">
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100">
          {img ? (
            <img src={img} alt="" className="w-full h-full object-contain p-2 bg-white" loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <div className="mt-2 text-[11px] font-bold text-gray-300">No image</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => openAddToCart(p)}
            className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-white/95 shadow-sm border border-gray-100 flex items-center justify-center text-primary-dark hover:opacity-90 transition-opacity"
            aria-label="Add to cart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
        </div>
        <div className="mt-2 flex items-start justify-between gap-2">
          <p className="text-[12px] md:text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2">
            {p?.name || 'Product'}
          </p>
          {off != null ? (
            <span className="shrink-0 px-2 py-1 rounded-lg bg-green-50 border border-green-100 text-[10px] font-bold text-green-700">
              {off}% off
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-[13px] md:text-[14px] font-bold text-gray-900">₹{formatMoney(p?.price)}</div>
      </div>
    );
  };

  return (
    <div className="w-full pb-[160px] lg:pb-[96px] animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        {/* Desktop search (replaces title) */}
        <div className="relative hidden md:block w-[420px] max-w-[55vw]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search “Jewellers”'
            className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium focus:outline-none focus:border-primary-dark"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full justify-end md:w-auto">
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setOpenFilters((v) => !v)}
              className="px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h18"/><path d="M7 12h10"/><path d="M10 20h4"/></svg>
              Filters
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenSort((v) => !v)}
              className="px-3 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h13"/><path d="M3 12h9"/><path d="M3 18h5"/><path d="m19 8 2 2-2 2"/><path d="M21 10h-5"/></svg>
              Sort
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {openSort ? (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-30">
                {SortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortId(opt.id);
                      setOpenSort(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-[12px] font-semibold hover:bg-gray-50 ${
                      sortId === opt.id ? 'text-primary-dark' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setOpenFilters(true)}
            className="md:hidden w-10 h-10 rounded-xl border border-gray-100 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            aria-label="Filters"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h18"/><path d="M7 12h10"/><path d="M10 20h4"/></svg>
          </button>
        </div>
      </div>

      {/* Mobile search (already correct for phone) */}
      <div className="relative mb-4 md:hidden">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search “Jewellers”'
          className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium focus:outline-none focus:border-primary-dark"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
      </div>

      {/* Filters panel (mobile drawer) */}
      {openFilters ? (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => setOpenFilters(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-gray-800">Filters</p>
                <p className="text-[12px] text-gray-400 mt-1">Refine results</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenFilters(false)}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                  >
                    <option value="">All</option>
                    {derived.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide">Brand</label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                  >
                    <option value="">All</option>
                    {derived.brands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide">Min price</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide">Max price</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-[13px] font-semibold text-gray-700 bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 focus:border-primary-dark"
                    placeholder="100000"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-200 text-primary-dark focus:ring-primary-dark/30"
                />
                <span className="font-medium">Featured</span>
              </label>
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={() => {
                  setCategory('');
                  setBrand('');
                  setMinPrice('');
                  setMaxPrice('');
                  setFeatured(false);
                }}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpenFilters(false)}
                className="px-5 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="text-[13px] text-gray-400">Loading products…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
          No products found.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {items.map((p) => (
              <ProductCard key={String(p?.id ?? p?._id ?? p?.productId ?? Math.random())} p={p} />
            ))}
          </div>
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
                <p className="text-[12px] text-gray-400 mt-1 truncate">{cartProduct?.name || 'Product'}</p>
              </div>
              <button
                type="button"
                onClick={closeAddToCart}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-50"
                aria-label="Close"
                disabled={cartAdding}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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

      {/* Fixed pagination bar (always visible) */}
      {!loading && items.length > 0 ? (
        <div
          className="fixed left-0 right-0 z-40
                     bottom-0
                     lg:left-[240px]"
        >
          <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="max-w-5xl lg:max-w-none mx-auto">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => {
                    const next = Math.max(1, currentPage - 1);
                    fetchList({ nextPage: next, query: q });
                  }}
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
                  onClick={() => {
                    const next = currentPage + 1;
                    fetchList({ nextPage: next, query: q });
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

