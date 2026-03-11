import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { cartService } from '../../services/cartService';
import { vendorSourceText } from '../../utils/productSource';
import SafeImage from '../../components/SafeImage';

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function firstImageUrl(p) {
  const images = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? null;
  if (Array.isArray(images) && images[0]) return images[0];
  if (typeof images === 'string') return images;
  return null;
}

function normalizeUnit(u) {
  const raw = String(u ?? '').trim().toLowerCase();
  if (!raw) return 'pcs';
  if (raw === 'pc' || raw === 'pcs') return 'pcs';
  return raw;
}

function unitLabel(unit) {
  const u = normalizeUnit(unit);
  if (u === 'pcs') return 'pieces';
  return u;
}

function pickProductFromItem(item) {
  return item?.product ?? item?.productDetails ?? item?.productData ?? item?.item ?? item ?? {};
}

function pickProductId(item, product) {
  return (
    item?.productId ??
    item?.product_id ??
    product?.id ??
    product?._id ??
    item?.id ??
    item?._id ??
    null
  );
}

function pickQty(item) {
  const q = Number(item?.quantity ?? item?.qty ?? item?.count ?? 1);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return Math.floor(q);
}

function providerKeyFor(item, product) {
  const vendorId =
    product?.vendorId ??
    product?.vendor_id ??
    product?.vendor?.id ??
    product?.vendor?._id ??
    item?.vendorId ??
    item?.vendor_id ??
    null;
  return vendorId ? `vendor:${vendorId}` : 'admin';
}

export default function Cart() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  const loadAbortRef = useRef(null);
  const mutatingRef = useRef(false);

  const loadCart = useCallback(async () => {
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const ctrl = new AbortController();
    loadAbortRef.current = ctrl;

    setLoading(true);
    try {
      const res = await cartService.getCart({ signal: ctrl.signal });
      const list = (res?.items || []).map((it) => {
        const product = pickProductFromItem(it);
        const productId = pickProductId(it, product);
        const quantity = pickQty(it);
        return { raw: it, product, productId, quantity };
      });
      setItems(list.filter((x) => x.productId != null));

      // Keep selection for items that still exist
      setSelected((prev) => {
        const next = new Set();
        const allowed = new Set(list.map((x) => String(x.productId)));
        for (const id of prev) {
          if (allowed.has(String(id))) next.add(String(id));
        }
        return next;
      });
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load cart', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadCart();
    return () => {
      if (loadAbortRef.current) loadAbortRef.current.abort();
    };
  }, [loadCart]);

  const allSelected = useMemo(() => {
    if (!items.length) return false;
    return items.every((x) => selected.has(String(x.productId)));
  }, [items, selected]);

  const selectedIds = useMemo(() => {
    return items
      .map((x) => String(x.productId))
      .filter((id) => selected.has(id));
  }, [items, selected]);

  const selectedProviderOk = useMemo(() => {
    if (selectedIds.length <= 1) return true;
    const keys = new Set();
    for (const it of items) {
      const id = String(it.productId);
      if (!selected.has(id)) continue;
      keys.add(providerKeyFor(it.raw, it.product));
    }
    return keys.size <= 1;
  }, [items, selected, selectedIds.length]);

  const toggleSelectAll = () => {
    setSelected(() => {
      if (allSelected) return new Set();
      return new Set(items.map((x) => String(x.productId)));
    });
  };

  const toggleOne = (productId) => {
    const id = String(productId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateQty = async ({ productId, nextQty }) => {
    const pid = String(productId);
    const qty = Math.max(1, Number(nextQty) || 1);
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    try {
      await cartService.updateQuantity({ productId: pid, quantity: qty });
      setItems((prev) => prev.map((x) => (String(x.productId) === pid ? { ...x, quantity: qty } : x)));
    } catch (e) {
      addToast(e?.message || 'Failed to update quantity', 'error');
    } finally {
      mutatingRef.current = false;
    }
  };

  const removeItem = async (productId) => {
    const pid = String(productId);
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    try {
      await cartService.removeItem(pid);
      setItems((prev) => prev.filter((x) => String(x.productId) !== pid));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
      addToast('Removed from cart', 'success');
    } catch (e) {
      addToast(e?.message || 'Failed to remove item', 'error');
    } finally {
      mutatingRef.current = false;
    }
  };

  const clearAll = async () => {
    if (!items.length) return;
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    try {
      await cartService.clear();
      setItems([]);
      setSelected(new Set());
      addToast('Cart cleared', 'success');
    } catch (e) {
      addToast(e?.message || 'Failed to clear cart', 'error');
    } finally {
      mutatingRef.current = false;
    }
  };

  const proceedCheckout = async () => {
    if (!selectedIds.length) {
      addToast('Select at least one item', 'error');
      return;
    }
    if (!selectedProviderOk) {
      addToast('Selected items must be from a same seller (all Mirah products OR same vendor)', 'error');
      return;
    }
    // Checkout UI will be implemented next; for now route placeholder with selected IDs.
    navigate('/dashboard/checkout', { state: { productIds: selectedIds.map((x) => Number(x) || x) } });
  };

  const openProduct = (productId) => {
    if (!productId) return;
    navigate(`/dashboard/shopping/${productId}`);
  };

  return (
    <div className="w-full h-[calc(100dvh-96px)] lg:h-[calc(100dvh-128px)] flex flex-col">
      {/* Top header card (title + select all) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="md:hidden p-2 rounded-xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-[16px] md:text-[18px] font-bold text-gray-900">Cart</p>
          </div>
        </div>

        {!loading && items.length > 0 ? (
          <div className="flex items-center justify-between gap-3 mt-4">
              <label className="flex items-center gap-2 text-[12px] text-gray-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-200 text-primary-dark focus:ring-primary-dark/30"
                />
                <span className="font-semibold">Select all</span>
              </label>

            <button
              type="button"
              onClick={clearAll}
              className="px-4 py-2 rounded-xl border border-red-200 text-[12px] font-bold text-red-600 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!items.length}
            >
              Clear cart
            </button>
          </div>
        ) : null}
      </div>

      {/* Cart items card */}
      <div className="flex-1 min-h-0 flex flex-col pb-[96px] md:pb-0">
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="p-10 md:p-14 bg-gray-50 flex-1 flex items-center justify-center">
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
          ) : items.length === 0 ? (
            <div className="p-10 md:p-14 bg-gray-50 flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                  </svg>
                </div>
                <p className="mt-4 text-[14px] font-bold text-gray-900">Empty cart</p>
                <p className="mt-1 text-[12px] text-gray-500">Add items from Shop to place an order.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {items.map((it) => {
                const p = it.product || {};
                const vendorText = vendorSourceText({
                  ...p,
                  vendorId: p?.vendorId ?? it?.raw?.vendorId ?? it?.raw?.vendor_id ?? null,
                  vendor: p?.vendor ?? it?.raw?.vendor ?? it?.raw?.vendorDetails ?? null,
                  vendorName: p?.vendorName ?? it?.raw?.vendorName ?? it?.raw?.vendor_name ?? null,
                });
                const img = firstImageUrl(p);
                const unit = p?.unit ?? p?.stockUnit ?? 'pcs';
                const linePrice = Number(p?.price || 0) * Number(it.quantity || 1);
                const lineCompare = Number(p?.compareAtPrice || 0) * Number(it.quantity || 1);
                const hasCompare = Number(p?.compareAtPrice || 0) > Number(p?.price || 0);
                const id = String(it.productId);
                const checked = selected.has(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 md:gap-4 px-4 py-6 border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(id)}
                      className="w-4 h-4 rounded border-gray-200 text-primary-dark focus:ring-primary-dark/30"
                      aria-label="Select item"
                    />

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openProduct(id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openProduct(id);
                      }}
                      className="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-gray-100 shrink-0 cursor-pointer"
                      aria-label="Open product"
                    >
                      <SafeImage src={img} alt="" className="w-full h-full object-contain p-2 bg-white" loading="lazy" />
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openProduct(id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openProduct(id);
                      }}
                      className="flex-1 min-w-0 cursor-pointer"
                      aria-label="Open product"
                    >
                      <p className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate">
                        {p?.name || 'Product'}
                      </p>
                      {vendorText ? (
                        <p className="mt-0.5 text-[11px] text-gray-400 font-medium line-clamp-1">{vendorText}</p>
                      ) : null}
                      <p className="text-[12px] text-gray-500 mt-0.5">
                        {it.quantity} {unitLabel(unit)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeItem(id)}
                        className="hidden md:inline-flex mt-2 text-[12px] font-semibold text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-xl bg-primary-dark text-white">
                        <button
                          type="button"
                          onClick={() => updateQty({ productId: id, nextQty: it.quantity - 1 })}
                          className="w-9 h-9 flex items-center justify-center hover:opacity-90 disabled:opacity-50"
                          disabled={it.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          –
                        </button>
                        <div className="w-9 h-9 flex items-center justify-center text-[12px] font-bold">
                          {it.quantity}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQty({ productId: id, nextQty: it.quantity + 1 })}
                          className="w-9 h-9 flex items-center justify-center hover:opacity-90"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        {hasCompare ? (
                          <div className="text-[12px] text-gray-400 line-through">₹{formatMoney(lineCompare)}</div>
                        ) : null}
                        <div className="text-[14px] font-bold text-gray-900">₹{formatMoney(linePrice)}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(id)}
                        className="md:hidden text-[11px] font-semibold text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop: action card below products (not fixed) */}
        {!loading && items.length > 0 ? (
          <div className="hidden md:block mt-4 bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={proceedCheckout}
                disabled={!selectedIds.length}
                className="px-6 py-3 rounded-full bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Place Order
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile: fixed bottom Place Order (full width) */}
      {!loading && items.length > 0 ? (
        <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 bg-transparent">
          <button
            type="button"
            onClick={proceedCheckout}
            disabled={!selectedIds.length}
            className="w-full py-4 rounded-full bg-primary-dark text-white text-[13px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Place Order
          </button>
        </div>
      ) : null}
    </div>
  );
}

