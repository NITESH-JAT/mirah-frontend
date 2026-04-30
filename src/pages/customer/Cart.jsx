import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { cartService } from '../../services/cartService';
import { vendorSourceText } from '../../utils/productSource';
import SafeImage from '../../components/SafeImage';
import { priceForCartLine } from '../../utils/cartVariant';
import { formatMoney } from '../../utils/formatMoney';

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

function normalizeVariants(variants) {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return undefined;
  const out = {
    type: variants?.type ?? undefined,
    size: variants?.size ?? undefined,
    sizeDimensions: variants?.sizeDimensions ?? variants?.size_dimensions ?? undefined,
    sizeDimensionsUnit: variants?.sizeDimensionsUnit ?? variants?.size_dimensions_unit ?? undefined,
  };
  for (const k of Object.keys(out)) {
    if (out[k] == null || out[k] === '') delete out[k];
  }
  return Object.keys(out).length ? out : undefined;
}

function stableVariantsKey(variants) {
  const v = normalizeVariants(variants);
  if (!v) return '';
  const order = ['type', 'size', 'sizeDimensions', 'sizeDimensionsUnit'];
  return order.map((k) => `${k}=${String(v?.[k] ?? '')}`).join('&');
}

function variantTextOf(variants) {
  const v = normalizeVariants(variants);
  if (!v) return '';

  const parts = [];
  const type = String(v?.type ?? '').trim();
  const size = String(v?.size ?? '').trim();
  const dimRaw = v?.sizeDimensions ?? null;
  const dim = dimRaw == null || dimRaw === '' ? '' : String(dimRaw).trim();
  const unit = String(v?.sizeDimensionsUnit ?? '').trim();

  const dimPart =
    dim && unit
      ? unit === '"' || unit === "'" || unit === '”' || unit === '’'
        ? `${dim}${unit}`
        : `${dim} ${unit}`
      : dim || '';

  if (type) parts.push(type);
  if (size) parts.push(size);
  if (dimPart) parts.push(dimPart);

  return parts.join(' · ');
}

function pickCartItemId(item) {
  return item?.cartItemId ?? item?.cart_item_id ?? item?.id ?? item?._id ?? null;
}

function pickProductId(item, product) {
  return (
    item?.productId ??
    item?.product_id ??
    product?.id ??
    product?._id ??
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
        const cartItemId = pickCartItemId(it);
        const productId = pickProductId(it, product);
        const quantity = pickQty(it);
        const variants = normalizeVariants(it?.variants);
        const rowKey = cartItemId != null ? `ci:${String(cartItemId)}` : `p:${String(productId)}|v:${stableVariantsKey(variants)}`;
        return { raw: it, product, cartItemId, productId, variants, quantity, rowKey };
      });
      setItems(list.filter((x) => x.productId != null));

      // Keep selection for items that still exist
      setSelected((prev) => {
        const next = new Set();
        const allowed = new Set(list.map((x) => String(x.rowKey)));
        for (const key of prev) {
          if (allowed.has(String(key))) next.add(String(key));
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
    return items.every((x) => selected.has(String(x.rowKey)));
  }, [items, selected]);

  const selectedKeys = useMemo(() => {
    return items
      .map((x) => String(x.rowKey))
      .filter((k) => selected.has(k));
  }, [items, selected]);

  const selectedProviderOk = useMemo(() => {
    if (selectedKeys.length <= 1) return true;
    const keys = new Set();
    for (const it of items) {
      const key = String(it.rowKey);
      if (!selected.has(key)) continue;
      keys.add(providerKeyFor(it.raw, it.product));
    }
    return keys.size <= 1;
  }, [items, selected, selectedKeys.length]);

  const toggleSelectAll = () => {
    setSelected(() => {
      if (allSelected) return new Set();
      return new Set(items.map((x) => String(x.rowKey)));
    });
  };

  const toggleOne = (rowKey) => {
    const key = String(rowKey);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateQty = async ({ rowKey, productId, variants, nextQty }) => {
    const pid = String(productId);
    const key = String(rowKey);
    const qty = Math.max(1, Number(nextQty) || 1);
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    try {
      await cartService.updateQuantity({ productId: pid, quantity: qty, variants });
      setItems((prev) => prev.map((x) => (String(x.rowKey) === key ? { ...x, quantity: qty } : x)));
    } catch (e) {
      addToast(e?.message || 'Failed to update quantity', 'error');
    } finally {
      mutatingRef.current = false;
    }
  };

  const removeItem = async ({ rowKey, productId, variants }) => {
    const pid = String(productId);
    const key = String(rowKey);
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    try {
      await cartService.removeItem({ productId: pid, variants });
      setItems((prev) => prev.filter((x) => String(x.rowKey) !== key));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(key);
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
    if (!selectedKeys.length) {
      addToast('Select at least one item', 'error');
      return;
    }
    if (!selectedProviderOk) {
      addToast('Selected items must be from a same seller (all Arviah products OR same jeweller)', 'error');
      return;
    }
    const selectedItems = items.filter((x) => selected.has(String(x.rowKey)));
    const cartItemIds = selectedItems
      .map((x) => x.cartItemId)
      .filter((x) => x != null)
      .map((x) => Number(x) || x);

    if (cartItemIds.length === selectedItems.length) {
      navigate('/customer/checkout', { state: { cartItemIds } });
      return;
    }

    // Fallback (legacy): only safe when there is at most one cart row per productId.
    const productIds = selectedItems.map((x) => x.productId).filter((x) => x != null).map((x) => Number(x) || x);
    const unique = new Set(productIds.map((x) => String(x)));
    if (unique.size !== productIds.length) {
      addToast('Please refresh cart and try again (unable to uniquely identify selected items).', 'error');
      return;
    }
    navigate('/customer/checkout', { state: { productIds } });
  };

  const openProduct = (productId) => {
    if (!productId) return;
    navigate(`/customer/shopping/${productId}`);
  };

  return (
    <div className="w-full h-[calc(100dvh-96px)] lg:h-[calc(100dvh-128px)] flex flex-col">
      {/* Top header card (title + select all) */}
      <div className="bg-white rounded-2xl border border-pale p-4 md:p-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="md:hidden p-2 rounded-xl bg-white border border-pale text-mid hover:bg-cream"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-[16px] md:text-[18px] font-bold text-ink">Cart</p>
          </div>
        </div>

        {!loading && items.length > 0 ? (
          <div className="flex items-center justify-between gap-3 mt-4">
              <label className="flex items-center gap-2 text-[12px] text-ink select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                />
                <span className="font-medium">Select all</span>
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
        <div className="mt-4 bg-white rounded-2xl border border-pale overflow-hidden flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="p-10 md:p-14 bg-cream flex-1 flex items-center justify-center">
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
            <div className="p-10 md:p-14 bg-cream flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-pale flex items-center justify-center text-muted">
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
                <p className="mt-4 text-[14px] font-bold text-ink">Empty cart</p>
                <p className="mt-1 text-[12px] text-muted">Add items from Shop to place an order.</p>
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
                const pricing = priceForCartLine({ cartItem: it, product: p });
                const unitPrice = pricing.unitPrice;
                const unitCompare = pricing.compareAt;
                const linePrice = unitPrice * Number(it.quantity || 1);
                const lineCompare = unitCompare * Number(it.quantity || 1);
                const hasCompare = unitCompare > unitPrice && unitPrice > 0;
                const key = String(it.rowKey);
                const checked = selected.has(key);
                const variantText = variantTextOf(it?.variants);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 md:gap-4 px-4 py-6 border-b border-pale last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(key)}
                      className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                      aria-label="Select item"
                    />

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openProduct(it.productId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openProduct(it.productId);
                      }}
                      className="w-16 h-16 rounded-2xl overflow-hidden bg-white border border-pale shrink-0 cursor-pointer"
                      aria-label="Open product"
                    >
                      <SafeImage src={img} alt="" className="w-full h-full object-contain p-2 bg-white" loading="lazy" />
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openProduct(it.productId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openProduct(it.productId);
                      }}
                      className="flex-1 min-w-0 cursor-pointer"
                      aria-label="Open product"
                    >
                      <p className="text-[15px] md:text-[16px] font-bold text-ink truncate">
                        {p?.name || 'Product'}
                      </p>
                      {vendorText ? (
                        <p className="mt-0.5 text-[11px] text-muted font-medium line-clamp-1">{vendorText}</p>
                      ) : null}
                      {variantText ? (
                        <p className="mt-0.5 text-[11px] text-muted font-semibold line-clamp-1">{variantText}</p>
                      ) : null}
                      <p className="text-[12px] text-muted mt-0.5">
                        {it.quantity} {unitLabel(unit)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeItem({ rowKey: key, productId: it.productId, variants: it.variants });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="hidden md:inline-flex mt-2 text-[12px] font-semibold text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-xl bg-walnut text-blush">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateQty({ rowKey: key, productId: it.productId, variants: it.variants, nextQty: it.quantity - 1 });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateQty({ rowKey: key, productId: it.productId, variants: it.variants, nextQty: it.quantity + 1 });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-9 h-9 flex items-center justify-center hover:opacity-90"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        {hasCompare ? (
                          <div className="text-[12px] text-muted line-through">₹{formatMoney(lineCompare)}</div>
                        ) : null}
                        <div className="text-[14px] font-bold text-ink">₹{formatMoney(linePrice)}</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeItem({ rowKey: key, productId: it.productId, variants: it.variants });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
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
          <div className="hidden md:block mt-4 bg-white rounded-2xl border border-pale p-4 md:p-6">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={proceedCheckout}
                disabled={!selectedKeys.length}
                className="px-6 py-3 rounded-full bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={!selectedKeys.length}
            className="w-full py-4 rounded-full bg-walnut text-blush text-[13px] font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Place Order
          </button>
        </div>
      ) : null}
    </div>
  );
}

