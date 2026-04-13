import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { cartService } from '../../services/cartService';
import { addressService } from '../../services/addressService';
import { getVendorId, getVendorDisplayName } from '../../utils/productSource';
import SafeImage from '../../components/SafeImage';
import { priceForCartLine } from '../../utils/cartVariant';
import { formatMoney } from '../../utils/formatMoney';

export default function Checkout() {
  const { addToast, currentUser } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemIds = useMemo(() => location?.state?.cartItemIds ?? [], [location?.state?.cartItemIds]);
  const productIds = useMemo(() => location?.state?.productIds ?? [], [location?.state?.productIds]); // legacy fallback
  const OFFLINE_PAYMENT_LIMIT = 200000;

  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // razorpay | offline | partial
  const [mobilePayInfoOpen, setMobilePayInfoOpen] = useState(null); // 'offline' | 'partial' | null

  const [selectedItems, setSelectedItems] = useState([]);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false);
  const [partialCalcOpen, setPartialCalcOpen] = useState(false);
  const [partialCalcLoading, setPartialCalcLoading] = useState(false);
  const [partialCalc, setPartialCalc] = useState(null);
  const [billingForm, setBillingForm] = useState({
    id: null,
    type: 'billing',
    name: '',
    countryCode: '',
    phone: '',
    address: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    pinCode: '',
  });
  const [shippingForm, setShippingForm] = useState({
    id: null,
    type: 'shipping',
    name: '',
    countryCode: '',
    phone: '',
    address: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    pinCode: '',
  });

  const abortRef = useRef(null);

  const pickProductId = (it) => it?.productId ?? it?.product?._id ?? it?.product?.id ?? it?.product?.productId ?? null;
  const pickCartItemId = (it) => it?.cartItemId ?? it?.cart_item_id ?? it?.id ?? it?._id ?? null;

  function variantTextOf(variants) {
    if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return '';
    const parts = [];
    const type = String(variants?.type ?? '').trim();
    const size = String(variants?.size ?? '').trim();
    const dimRaw = variants?.sizeDimensions ?? variants?.size_dimensions ?? null;
    const dim = dimRaw == null || dimRaw === '' ? '' : String(dimRaw).trim();
    const unit = String(variants?.sizeDimensionsUnit ?? variants?.size_dimensions_unit ?? '').trim();
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

  const normalizeAddress = (a, fallbackType) => {
    const id = a?.id ?? a?._id ?? a?.addressId ?? null;
    const type = String(a?.type ?? a?.addressType ?? fallbackType ?? '').toLowerCase();
    const isDefault = Boolean(a?.isDefault ?? a?.default ?? a?.is_default);
    return {
      id,
      type,
      name: a?.name ?? a?.fullName ?? a?.contactName ?? '',
      countryCode: a?.countryCode ?? '',
      phone: a?.phone ?? '',
      address: a?.address ?? a?.addressLine1 ?? a?.line1 ?? '',
      addressLine2: a?.addressLine2 ?? a?.line2 ?? '',
      city: a?.city ?? '',
      state: a?.state ?? '',
      country: a?.country ?? '',
      pinCode: a?.pinCode ?? a?.pincode ?? a?.postalCode ?? '',
      isDefault,
    };
  };

  const blankAddress = (type) => ({
    id: null,
    type,
    name: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
    countryCode: currentUser?.countryCode || '',
    phone: currentUser?.phone || currentUser?.mobile || '',
    address: '',
    addressLine2: '',
    city: currentUser?.city || '',
    state: currentUser?.state || '',
    country: currentUser?.country || '',
    pinCode: currentUser?.pinCode || '',
  });

  const lineItems = useMemo(() => {
    return (selectedItems || []).map((it, idx) => {
      const p = it?.product || {};
      const qty = Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1));
      const pricing = priceForCartLine({ cartItem: it, product: p });
      const unitPrice = Number(pricing?.unitPrice ?? 0) || 0;
      const lineTotal = unitPrice * qty;
      const variantText = variantTextOf(it?.variants);
      const key =
        String(pickCartItemId(it) ?? '') ||
        `${String(pickProductId(it) ?? '')}-${String(variantText || '')}-${String(idx)}`;
      const name = String(p?.name ?? p?.title ?? 'Product');
      return { key, it, product: p, name, variantText, qty, unitPrice, lineTotal };
    });
  }, [selectedItems]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((acc, x) => acc + (Number(x?.lineTotal) || 0), 0);
    const delivery = 0;
    const handling = 0;
    const total = subtotal + delivery + handling;
    return { subtotal, delivery, handling, total };
  }, [lineItems]);

  const offlineAllowed = useMemo(() => {
    const total = Number(totals?.total || 0) || 0;
    return total <= OFFLINE_PAYMENT_LIMIT;
  }, [totals?.total]);

  const providerCheck = useMemo(() => {
    const providers = new Set();
    let vendorName = null;
    for (const it of selectedItems || []) {
      const p = it?.product ?? it;
      const vId = getVendorId(p);
      providers.add(vId == null ? 'admin' : String(vId));
      if (vendorName == null) vendorName = getVendorDisplayName(p);
    }
    const list = Array.from(providers);
    const ok = list.length <= 1;
    const providerLabel = list[0] === 'admin' ? null : vendorName ? `Jeweller: ${vendorName}` : 'Jeweller items';
    return { ok, providerLabel, providers: list };
  }, [selectedItems]);

  const validateAddress = (a) => {
    const v = (x) => String(x ?? '').trim();
    const phoneOk = v(a?.phone).length >= 6;
    return {
      ok:
        Boolean(v(a?.name)) &&
        phoneOk &&
        Boolean(v(a?.address)) &&
        Boolean(v(a?.city)) &&
        Boolean(v(a?.state)) &&
        Boolean(v(a?.country)) &&
        Boolean(v(a?.pinCode)),
      missing: {
        name: !v(a?.name),
        phone: !phoneOk,
        address: !v(a?.address),
        city: !v(a?.city),
        state: !v(a?.state),
        country: !v(a?.country),
        pinCode: !v(a?.pinCode),
      },
    };
  };

  const billingValid = useMemo(() => validateAddress(billingForm), [billingForm]);
  const shippingValid = useMemo(() => validateAddress(shippingSameAsBilling ? billingForm : shippingForm), [shippingSameAsBilling, billingForm, shippingForm]);
  const addressReady = billingValid.ok && shippingValid.ok;

  const [billingOrig, setBillingOrig] = useState(null);
  const [shippingOrig, setShippingOrig] = useState(null);

  const addressComparable = (a, { forceDefault = true } = {}) => ({
    name: String(a?.name ?? '').trim(),
    countryCode: String(a?.countryCode ?? '').trim(),
    phone: String(a?.phone ?? '').trim(),
    address: String(a?.address ?? '').trim(),
    addressLine2: String(a?.addressLine2 ?? '').trim(),
    city: String(a?.city ?? '').trim(),
    state: String(a?.state ?? '').trim(),
    country: String(a?.country ?? '').trim(),
    pinCode: String(a?.pinCode ?? '').trim(),
    isDefault: forceDefault ? true : Boolean(a?.isDefault),
  });

  const addressesEqual = (a, b) => {
    const ax = addressComparable(a);
    const bx = addressComparable(b);
    return JSON.stringify(ax) === JSON.stringify(bx);
  };

  const load = async () => {
    setLoading(true);
    const hasCartItemIds = Array.isArray(cartItemIds) && cartItemIds.length > 0;
    const hasProductIds = Array.isArray(productIds) && productIds.length > 0;
    if (!hasCartItemIds && !hasProductIds) {
      setSelectedItems([]);
      setLoadedOnce(true);
      setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const [cart, billing, shipping] = await Promise.all([
        cartService.getCart({ signal: ctrl.signal }),
        addressService.list({ type: 'billing' }),
        addressService.list({ type: 'shipping' }),
      ]);

      const itemsAll = cart?.items || [];
      const wantedCart = new Set((cartItemIds || []).map((x) => String(x)));
      const wantedProd = new Set((productIds || []).map((x) => String(x)));
      const items = hasCartItemIds
        ? itemsAll.filter((it) => wantedCart.has(String(pickCartItemId(it) ?? '')))
        : itemsAll.filter((it) => wantedProd.has(String(pickProductId(it) ?? '')));
      setSelectedItems(items);

      const isDefault = (a) => Boolean(a?.isDefault ?? a?.default ?? a?.is_default);
      const billingDefRaw = (billing || []).find(isDefault) || (billing || [])[0] || null;
      const shippingDefRaw = (shipping || []).find(isDefault) || (shipping || [])[0] || null;
      const bNorm = billingDefRaw ? normalizeAddress(billingDefRaw, 'billing') : blankAddress('billing');
      const sNorm = shippingDefRaw ? normalizeAddress(shippingDefRaw, 'shipping') : blankAddress('shipping');
      setBillingForm(bNorm);
      setShippingForm(sNorm);
      setBillingOrig(billingDefRaw ? bNorm : null);
      setShippingOrig(shippingDefRaw ? sNorm : null);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load checkout details', 'error');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If checkout is opened without items, redirect to shop.
  useEffect(() => {
    if (!loadedOnce) return;
    if (loading) return;
    const hasIds =
      (Array.isArray(cartItemIds) && cartItemIds.length > 0) || (Array.isArray(productIds) && productIds.length > 0);
    const hasItems = Array.isArray(selectedItems) && selectedItems.length > 0;
    if (!hasIds || !hasItems) {
      navigate('/customer/shopping', { replace: true });
    }
  }, [cartItemIds, loadedOnce, loading, navigate, productIds, selectedItems]);

  useEffect(() => {
    if (!shippingSameAsBilling) return;
    setShippingForm((prev) => ({
      ...prev,
      name: billingForm.name,
      countryCode: billingForm.countryCode,
      phone: billingForm.phone,
      address: billingForm.address,
      addressLine2: billingForm.addressLine2,
      city: billingForm.city,
      state: billingForm.state,
      country: billingForm.country,
      pinCode: billingForm.pinCode,
    }));
  }, [shippingSameAsBilling, billingForm]);

  const hasSelection =
    ((Array.isArray(cartItemIds) && cartItemIds.length > 0) || (Array.isArray(productIds) && productIds.length > 0)) &&
    selectedItems.length > 0;
  const canPressContinue = hasSelection && providerCheck.ok && !submitting && !loading;

  const offlineAutoToastRef = useRef(false);
  useEffect(() => {
    if (offlineAllowed) {
      offlineAutoToastRef.current = false;
      return;
    }
    if (paymentMethod !== 'offline') return;
    setPaymentMethod('razorpay');
    if (!offlineAutoToastRef.current) {
      offlineAutoToastRef.current = true;
      addToast('Offline payment is not available for orders above ₹2,00,000.', 'error');
    }
  }, [addToast, offlineAllowed, paymentMethod]);

  const saveAddressIfChanged = async (form, orig) => {
    const payload = {
      type: form.type,
      name: String(form.name || '').trim() || undefined,
      countryCode: String(form.countryCode || '').trim() || undefined,
      phone: String(form.phone || '').trim() || undefined,
      address: String(form.address || '').trim(),
      addressLine2: String(form.addressLine2 || '').trim() || undefined,
      city: String(form.city || '').trim() || undefined,
      state: String(form.state || '').trim() || undefined,
      country: String(form.country || '').trim() || undefined,
      pinCode: String(form.pinCode || '').trim() || undefined,
      isDefault: true,
    };
    if (!payload.address) throw new Error('Address is required');
    const changed = !orig || !addressesEqual({ ...orig, isDefault: true }, { ...form, isDefault: true });
    // If we loaded a non-default address, enforce default on checkout.
    const needsDefault = orig && orig?.isDefault === false;
    if (!changed && !needsDefault) return orig;
    if (form.id) {
      const res = await addressService.update({ id: form.id, payload });
      const updated = res?.address ?? res?.item ?? res?.data ?? res;
      return normalizeAddress(updated || { ...payload, id: form.id }, form.type);
    }
    const res = await addressService.create(payload);
    const created = res?.address ?? res?.item ?? res?.data ?? res;
    return normalizeAddress(created || payload, form.type);
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const parseCheckout = (raw) => {
    // cartService.checkout() returns `unwrap(res)` which is often `res.data.data` or `res.data`.
    // So the Razorpay order details may come either at `raw.data.order` OR directly at `raw.order`.
    const data = raw?.data ?? raw?.payload ?? raw ?? null;
    const dataOrder =
      data?.order ??
      data?.razorpayOrder ??
      data?.razorpay_order ??
      data?.razorpay ??
      null;
    const rawOrderId = data?.orderId ?? raw?.orderId ?? null;
    const rawOrderIdLooksRazorpay = typeof rawOrderId === 'string' && rawOrderId.startsWith('order_');
    const rawOrderIdLooksNumeric = typeof rawOrderId === 'number' || (typeof rawOrderId === 'string' && /^\d+$/.test(rawOrderId));

    // Local order id:
    // - offline flow: `data.orderId` is numeric local id
    // - razorpay/partial: `data.localOrderId` is numeric local id and `data.orderId` is Razorpay order id
    const localOrderId =
      raw?.localOrderId ??
      data?.localOrderId ??
      (rawOrderIdLooksNumeric && !rawOrderIdLooksRazorpay ? Number(rawOrderId) : null) ??
      // Some APIs may nest local order id under `order.id` (not Razorpay).
      (typeof raw?.order?.id === 'number' ? raw?.order?.id : null) ??
      (typeof raw?.order?._id === 'number' ? raw?.order?._id : null) ??
      null;
    const status = raw?.status ?? raw?.order?.status ?? raw?.data?.status ?? null;
    const rzOrderId =
      raw?.razorpayOrderId ??
      raw?.razorpay?.orderId ??
      raw?.razorpayOrder?.id ??
      raw?.razorpay_order_id ??
      data?.razorpayOrderId ??
      data?.razorpay_order_id ??
      // Common backend shape (per PRD): `orderId` is Razorpay order id (string like "order_...")
      (rawOrderIdLooksRazorpay ? String(rawOrderId) : null) ??
      data?.order?.id ??
      dataOrder?.id ??
      null;
    const amountInMinor =
      raw?.amountInMinor ??
      raw?.razorpayAmountInMinor ??
      raw?.razorpay?.amountInMinor ??
      data?.amountInMinor ??
      data?.razorpayAmountInMinor ??
      dataOrder?.amount ??
      null;
    const amount =
      raw?.amount ??
      raw?.razorpayAmount ??
      raw?.razorpay?.amount ??
      data?.amount ??
      data?.razorpayAmount ??
      data?.order?.amount ??
      null;
    const currency = raw?.currency ?? raw?.razorpay?.currency ?? raw?.order?.currency ?? dataOrder?.currency ?? 'INR';
    const orderCode =
      data?.orderCode ??
      data?.order_code ??
      raw?.orderCode ??
      raw?.order_code ??
      data?.code ??
      raw?.code ??
      null;
    const keyId =
      raw?.razorpayKeyId ??
      raw?.keyId ??
      raw?.razorpay?.keyId ??
      raw?.razorpay_key_id ??
      data?.keyId ??
      data?.razorpayKeyId ??
      data?.razorpay_key_id ??
      import.meta.env?.VITE_RAZORPAY_KEY_ID ??
      import.meta.env?.VITE_RAZORPAY_KEY ??
      null;
    return { localOrderId, orderCode, status, rzOrderId, amountInMinor, amount, currency, keyId };
  };

  const parseVerify = (raw) => {
    const data = raw?.data ?? raw ?? null;
    const localOrderId =
      data?.localOrderId ?? data?.local_order_id ?? raw?.localOrderId ?? raw?.local_order_id ?? null;
    const orderCode = data?.orderCode ?? data?.order_code ?? raw?.orderCode ?? raw?.order_code ?? null;
    const status = data?.status ?? raw?.status ?? null;
    return { localOrderId, orderCode, status };
  };

  const parsePartialCalc = (raw) => {
    const data = raw?.data ?? raw ?? null;
    const total = data?.total ?? data?.totalAmount ?? data?.amount ?? null;
    const onlineAmount = data?.onlineAmount ?? data?.online_amount ?? null;
    const offlineAmount = data?.offlineAmount ?? data?.offline_amount ?? null;
    const currency = data?.currency ?? 'INR';
    const rules = data?.rules ?? null;
    return { total, onlineAmount, offlineAmount, currency, rules };
  };

  const loadPartialCalc = async () => {
    setPartialCalcLoading(true);
    setPartialCalc(null);
    try {
      const res = await cartService.calculatePartialPayment({
        currency: 'INR',
        cartItemIds: Array.isArray(cartItemIds) && cartItemIds.length ? cartItemIds : undefined,
        productIds: Array.isArray(productIds) && productIds.length ? productIds : undefined,
      });
      setPartialCalc(parsePartialCalc(res || {}));
    } catch (e) {
      addToast(e?.message || 'Failed to calculate partial payment', 'error');
      setPartialCalc(null);
    } finally {
      setPartialCalcLoading(false);
    }
  };

  const proceedCheckout = async () => {
    if (!hasSelection) return;
    if (!providerCheck.ok) return;
    if (paymentMethod === 'offline' && !offlineAllowed) {
      addToast('Offline payment is not available for orders above ₹2,00,000.', 'error');
      setPaymentMethod('razorpay');
      return;
    }
    if (!billingValid.ok || !shippingValid.ok) {
      addToast('Please fill billing and shipping details to continue.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // Save/update addresses as default before checkout (PRD requirement)
      // IMPORTANT: When "Same as billing" is enabled, DO NOT copy billing `id` into shipping.
      // Billing and shipping are separate address records (different `type`), so we keep shipping id
      // and only mirror the address fields.
      const { id: _billingId, type: _billingType, isDefault: _billingDefault, ...billingFields } = billingForm || {};
      const shippingEffective = shippingSameAsBilling
        ? { ...shippingForm, ...billingFields, id: shippingForm?.id ?? null, type: 'shipping' }
        : shippingForm;

      const [savedBilling, savedShipping] = await Promise.all([
        saveAddressIfChanged({ ...billingForm, type: 'billing' }, billingOrig),
        saveAddressIfChanged({ ...shippingEffective, type: 'shipping' }, shippingOrig),
      ]);
      setBillingForm(savedBilling);
      setShippingForm(savedShipping);
      setBillingOrig(savedBilling);
      setShippingOrig(savedShipping);

      const checkoutRes = await cartService.checkout({
        paymentMethod,
        currency: 'INR',
        cartItemIds: Array.isArray(cartItemIds) && cartItemIds.length ? cartItemIds : undefined,
        productIds: Array.isArray(productIds) && productIds.length ? productIds : undefined,
      });
      const parsed = parseCheckout(checkoutRes || {});
      const localOrderId = parsed.localOrderId;
      if (!localOrderId) throw new Error('Checkout failed: missing order id');

      if (paymentMethod === 'offline') {
        navigate('/customer/orders/success', {
          state: { localOrderId, orderCode: parsed.orderCode ?? null, paymentMethod },
        });
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Razorpay failed to load');

      if (!parsed.keyId || !parsed.rzOrderId || !parsed.amountInMinor) {
        const missing = [
          !parsed.keyId ? 'keyId' : null,
          !parsed.rzOrderId ? 'orderId' : null,
          !parsed.amountInMinor ? 'amountInMinor' : null,
        ]
          .filter(Boolean)
          .join(', ');
        const hint = !parsed.keyId ? ' (set VITE_RAZORPAY_KEY_ID or return keyId from checkout API)' : '';
        throw new Error(`Payment init failed (missing Razorpay ${missing})${hint}`);
      }

      const options = {
        key: parsed.keyId,
        amount: String(parsed.amountInMinor),
        currency: parsed.currency ?? 'INR',
        name: 'Mirah',
        description: paymentMethod === 'partial' ? 'Partial payment' : 'Order payment',
        order_id: parsed.rzOrderId,
        prefill: {
          name: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim() || undefined,
          email: currentUser?.email ?? undefined,
          contact: currentUser?.phone ?? currentUser?.mobile ?? undefined,
        },
        handler: async (resp) => {
          try {
            setVerifyingPayment(true);
            const verifyRes = await cartService.verifyPayment({
              localOrderId,
              razorpayPaymentId: resp?.razorpay_payment_id,
              razorpayOrderId: resp?.razorpay_order_id,
              razorpaySignature: resp?.razorpay_signature,
            });
            const verified = parseVerify(verifyRes || {});
            navigate('/customer/orders/success', {
              state: {
                localOrderId: verified.localOrderId ?? localOrderId,
                orderCode: verified.orderCode ?? parsed.orderCode ?? null,
                paymentMethod,
              },
            });
          } catch (e) {
            addToast(e?.message || 'Payment verification failed', 'error');
          } finally {
            setVerifyingPayment(false);
          }
        },
        modal: {
          ondismiss: () => addToast('Payment cancelled', 'error'),
        },
        theme: { color: '#6B5545' },
      };

      const rz = new window.Razorpay(options);
      rz.on?.('payment.failed', (resp) => {
        const msg =
          resp?.error?.description ||
          resp?.error?.reason ||
          resp?.error?.code ||
          'Payment failed';
        addToast(String(msg), 'error');
      });
      rz.open();
    } catch (e) {
      addToast(e?.message || 'Checkout failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onContinue = async () => {
    if (!hasSelection) return;
    if (!providerCheck.ok) return;
    if (paymentMethod === 'offline' && !offlineAllowed) {
      addToast('Offline payment is not available for orders above ₹2,00,000.', 'error');
      setPaymentMethod('razorpay');
      return;
    }
    if (!billingValid.ok || !shippingValid.ok) {
      addToast('Please fill billing and shipping details to continue.', 'error');
      return;
    }

    if (paymentMethod === 'partial') {
      setPartialCalcOpen(true);
      await loadPartialCalc();
      return;
    }

    await proceedCheckout();
  };

  return (
    <div className="w-full pb-[220px] md:pb-10 animate-fade-in">
      {verifyingPayment ? (
        <div className="fixed inset-0 z-[200] bg-ink/25 backdrop-blur-[1px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-pale bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-walnut/10 border border-walnut/15 flex items-center justify-center text-ink shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-extrabold text-ink">Verifying payment…</p>
                  <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="mt-1 text-[12px] text-muted">Please wait, do not close the app.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-pale text-mid hover:bg-cream"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-[16px] font-bold text-ink">Checkout</p>
          <p className="text-[12px] text-muted mt-1">
            Selected items: {Array.isArray(selectedItems) ? selectedItems.length : 0}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-pale bg-cream p-10 md:p-14 flex items-center justify-center">
          <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : !((Array.isArray(cartItemIds) && cartItemIds.length > 0) || (Array.isArray(productIds) && productIds.length > 0)) ? (
        <div className="rounded-2xl border border-pale bg-white p-6 text-[13px] text-mid">
          No items selected for checkout.
          <button
            type="button"
            onClick={() => navigate('/customer/cart')}
            className="mt-4 inline-flex px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream"
          >
            Back to cart
          </button>
        </div>
      ) : (
        <>
          {/* Partial payment calculation modal */}
          {partialCalcOpen ? (
            <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPartialCalcOpen(false)}
                className="absolute inset-0 bg-ink/25"
              />
              <div className="relative w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl border border-pale shadow-sm p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-extrabold text-ink">Pay part now</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPartialCalcOpen(false)}
                    className="p-2 rounded-xl hover:bg-cream text-muted"
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>

                {partialCalcLoading ? (
                  <div className="mt-5 rounded-2xl border border-pale bg-cream p-10 flex items-center justify-center">
                    <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : partialCalc ? (
                  <div className="mt-5 rounded-2xl border border-pale p-4">
                    <div className="space-y-3 text-[12px]">
                      <div className="flex items-center justify-between text-mid">
                        <span>Total</span>
                        <span className="font-extrabold text-ink">₹{formatMoney(partialCalc.total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-mid">
                        <span>Pay online now</span>
                        <span className="font-extrabold text-ink">₹{formatMoney(partialCalc.onlineAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-mid">
                        <span>Pay offline later</span>
                        <span className="font-extrabold text-ink">₹{formatMoney(partialCalc.offlineAmount)}</span>
                      </div>
                    </div>

                    {partialCalc?.rules ? (
                      <div className="mt-4 rounded-2xl border border-pale bg-cream p-3 text-[11px] text-muted">
                        {partialCalc.rules?.offlineCap != null ? (
                          <div className="mt-1">Offline cap: <span className="font-semibold text-mid">₹{formatMoney(partialCalc.rules.offlineCap)}</span></div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-pale bg-cream p-6 text-[12px] text-mid">
                    Unable to calculate partial payment. Please try again or choose another payment method.
                    <button
                      type="button"
                      onClick={loadPartialCalc}
                      className="mt-4 inline-flex px-4 py-2 rounded-xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPartialCalcOpen(false)}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 rounded-2xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-60"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={proceedCheckout}
                    disabled={submitting || partialCalcLoading || !partialCalc}
                    className="flex-1 px-4 py-3 rounded-2xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? 'Processing…' : 'Continue'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!providerCheck.ok ? (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-[12px] text-red-700 font-semibold">
              Selected items must be from a same seller (all Mirah products OR same jeweller). Please adjust your selection in cart.
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4 md:gap-6">
            {/* Left: items + payment method */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-pale p-4 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-extrabold text-ink">Selected items</p>
                    {providerCheck.providerLabel ? (
                      <p className="mt-1 text-[12px] text-muted">{providerCheck.providerLabel}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/cart')}
                    className="px-3 py-2 rounded-xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream"
                  >
                    Edit
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {lineItems.slice(0, 3).map((x) => {
                    const p = x.product || {};
                    const img = p?.images?.[0] ?? p?.imageUrls?.[0] ?? p?.imageUrl ?? null;
                    return (
                      <div key={x.key} className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-cream border border-pale overflow-hidden shrink-0">
                          <SafeImage src={img} alt="" className="w-full h-full object-contain p-1 bg-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold text-ink truncate">{x.name}</p>
                          {x.variantText ? (
                            <p className="text-[11px] text-muted mt-0.5 font-semibold truncate">{x.variantText}</p>
                          ) : null}
                          <p className="text-[11px] text-muted mt-0.5">
                            Qty: {x.qty} • ₹{formatMoney(x.unitPrice)} <span className="text-muted">/</span> piece
                          </p>
                        </div>
                        <div className="text-[12px] font-extrabold text-ink">₹{formatMoney(x.unitPrice)}</div>
                      </div>
                    );
                  })}
                  {lineItems.length > 3 ? (
                    <div className="text-[12px] text-muted font-semibold">
                      +{lineItems.length - 3} more item{lineItems.length - 3 === 1 ? '' : 's'}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Addresses */}
              <div className="bg-white rounded-2xl border border-pale p-4 md:p-6">
                <p className="text-[14px] font-extrabold text-ink">Delivery details</p>
                <p className="mt-1 text-[12px] text-muted">Billing & shipping are required.</p>

                <div className="mt-4 space-y-4">
                  {[
                    {
                      title: 'Billing address',
                      form: billingForm,
                      setForm: setBillingForm,
                      valid: billingValid,
                      type: 'billing',
                    },
                    {
                      title: 'Shipping address',
                      form: shippingForm,
                      setForm: setShippingForm,
                      valid: shippingValid,
                      type: 'shipping',
                    },
                  ].map((x) => (
                    <div key={x.type} className="rounded-2xl border border-pale bg-cream/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-extrabold text-ink">{x.title}</p>
                          {!x.valid.ok ? (
                            <p className="mt-1 text-[11px] text-amber-700 font-semibold">Please complete required fields.</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-muted">Saved as default on checkout.</p>
                          )}
                        </div>
                        {x.type === 'shipping' ? (
                          <label className="inline-flex items-center gap-2 text-[12px] font-medium text-ink select-none">
                            <input
                              type="checkbox"
                              checked={shippingSameAsBilling}
                              onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                              className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                            />
                            Same as billing address
                          </label>
                        ) : null}
                      </div>

                      {x.type === 'shipping' && shippingSameAsBilling ? (
                        <div className="mt-3 rounded-2xl border border-pale bg-white p-4 text-[12px] text-mid">
                          Shipping address will be saved as the same as billing.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                            Full name *
                          </label>
                          <input
                            value={x.form.name}
                            onChange={(e) => x.setForm((p) => ({ ...p, name: e.target.value }))}
                            className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                              x.valid.missing.name ? 'border-amber-300' : 'border-pale'
                            }`}
                            placeholder="Name"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                              Phone *
                            </label>
                            <input
                            type="tel"
                              value={x.form.phone}
                            onChange={(e) =>
                              x.setForm((p) => {
                                const raw = e.target.value || '';
                                const digits = raw.replace(/\D/g, '');
                                return { ...p, phone: digits };
                              })
                            }
                            inputMode="numeric"
                              className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                                x.valid.missing.phone ? 'border-amber-300' : 'border-pale'
                              }`}
                              placeholder="Phone"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                              Pin code *
                            </label>
                            <input
                              value={x.form.pinCode}
                              onChange={(e) => x.setForm((p) => ({ ...p, pinCode: e.target.value }))}
                              inputMode="numeric"
                              className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                                x.valid.missing.pinCode ? 'border-amber-300' : 'border-pale'
                              }`}
                              placeholder="Pin code"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                            Address *
                          </label>
                          <input
                            value={x.form.address}
                            onChange={(e) => x.setForm((p) => ({ ...p, address: e.target.value }))}
                            className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                              x.valid.missing.address ? 'border-amber-300' : 'border-pale'
                            }`}
                            placeholder="House no, street, area"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                            Address line 2
                          </label>
                          <input
                            value={x.form.addressLine2}
                            onChange={(e) => x.setForm((p) => ({ ...p, addressLine2: e.target.value }))}
                            className="mt-1 w-full px-4 py-3 rounded-xl border border-pale bg-white text-[12px] font-semibold focus:outline-none"
                            placeholder="Landmark, apartment, etc."
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                              City *
                            </label>
                            <input
                              value={x.form.city}
                              onChange={(e) => x.setForm((p) => ({ ...p, city: e.target.value }))}
                              className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                                x.valid.missing.city ? 'border-amber-300' : 'border-pale'
                              }`}
                              placeholder="City"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                              State *
                            </label>
                            <input
                              value={x.form.state}
                              onChange={(e) => x.setForm((p) => ({ ...p, state: e.target.value }))}
                              className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                                x.valid.missing.state ? 'border-amber-300' : 'border-pale'
                              }`}
                              placeholder="State"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">
                            Country *
                          </label>
                          <input
                            value={x.form.country}
                            onChange={(e) => x.setForm((p) => ({ ...p, country: e.target.value }))}
                            className={`mt-1 w-full px-4 py-3 rounded-xl border bg-white text-[12px] font-semibold focus:outline-none ${
                              x.valid.missing.country ? 'border-amber-300' : 'border-pale'
                            }`}
                            placeholder="Country"
                          />
                        </div>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop payment method + continue lives on right column */}
            </div>

            {/* Right: payment details */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-pale p-4 md:p-6 h-fit">
                <div className="flex items-center gap-2 text-ink">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p className="text-[13px] font-extrabold">Payment Details</p>
                </div>
                <div className="mt-4 text-[12px]">
                  <div className="space-y-2">
                    {lineItems.map((x) => (
                      <div key={x.key} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] text-mid font-semibold truncate">
                            {x.name} <span className="text-muted font-bold">×{x.qty}</span>
                          </p>
                          {x.variantText ? (
                            <p className="text-[11px] text-muted font-semibold truncate">{x.variantText}</p>
                          ) : null}
                          <p className="text-[11px] text-muted">
                            ₹{formatMoney(x.unitPrice)} / piece
                          </p>
                        </div>
                        <div className="shrink-0 font-bold text-ink">₹{formatMoney(x.lineTotal)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-pale pt-3 space-y-2">
                    <div className="flex items-center justify-between text-mid hidden">
                      <span>Item total</span>
                      <span className="font-bold text-ink">₹{formatMoney(totals.subtotal)}</span>
                    </div>
                    {Number(totals.delivery || 0) !== 0 ? (
                      <div className="flex items-center justify-between text-mid">
                        <span>Delivery</span>
                        <span className="font-bold text-ink">₹{formatMoney(totals.delivery)}</span>
                      </div>
                    ) : null}
                    {Number(totals.handling || 0) !== 0 ? (
                      <div className="flex items-center justify-between text-mid">
                        <span>Handling</span>
                        <span className="font-bold text-ink">₹{formatMoney(totals.handling)}</span>
                      </div>
                    ) : null}
                    <div className="border-t border-pale pt-3 flex items-center justify-between">
                      <span className="font-extrabold text-ink">Grand Total</span>
                      <span className="font-extrabold text-ink">₹{formatMoney(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:block bg-white rounded-2xl border border-pale p-4 md:p-6">
                <p className="text-[13px] font-extrabold text-ink">Payment method</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'razorpay', label: 'Online', hint: 'Pay with Razorpay' },
                    {
                      id: 'offline',
                      label: 'Offline',
                      hint: offlineAllowed ? 'Pay offline' : 'Not available above ₹2,00,000',
                      info: 'Pay in person at our office during order pickup.',
                    },
                    {
                      id: 'partial',
                      label: 'Pay part now',
                      hint: 'Rest offline',
                      info: 'Pay part now, balance payable in person at pickup',
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (m.id === 'offline' && !offlineAllowed) {
                          addToast('Offline payment is not available for orders above ₹2,00,000.', 'error');
                          return;
                        }
                        setPaymentMethod(m.id);
                      }}
                      disabled={m.id === 'offline' && !offlineAllowed}
                      className={`relative text-left px-4 py-3 rounded-2xl border ${
                        paymentMethod === m.id
                          ? 'border-walnut bg-walnut/5 text-ink'
                          : 'border-pale bg-white text-mid hover:bg-cream'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {m.info ? (
                        <div
                          className="absolute top-2 right-2"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="relative group">
                            <div className="w-5 h-5 rounded-full border border-pale bg-white text-muted flex items-center justify-center text-[11px] font-extrabold">
                              i
                            </div>
                            <div className="pointer-events-none absolute right-0 top-full mt-2 w-64 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="rounded-xl border border-pale bg-white shadow-sm px-3 py-2 text-[11px] font-semibold text-mid">
                                {m.info}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="text-[12px] font-extrabold">{m.label}</div>
                      <div className="text-[11px] text-muted mt-1">{m.hint}</div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onContinue}
                  disabled={!canPressContinue}
                  className="mt-5 w-full items-center justify-center py-3 rounded-full bg-walnut text-blush text-[12px] font-bold hover:opacity-90 disabled:opacity-50 inline-flex"
                >
                  {submitting ? 'Processing…' : 'Continue'}
                </button>

                {!addressReady ? (
                  <p className="mt-3 text-[11px] text-amber-700 font-semibold">
                    Please complete billing and shipping details to continue.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Mobile fixed: payment method + continue */}
          <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 bg-cream">
            <div className="rounded-2xl border border-pale bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-extrabold text-ink">Payment method</p>
                <p className="text-[11px] text-muted">Select one</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { id: 'razorpay', label: 'Online', info: null },
                  { id: 'offline', label: 'Offline', info: 'Pay in person at our office during order pickup.' },
                  { id: 'partial', label: 'Pay part now', info: 'Pay part now, balance payable in person at pickup' },
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (m.id === 'offline' && !offlineAllowed) {
                        addToast('Offline payment is not available for orders above ₹2,00,000.', 'error');
                        return;
                      }
                      setPaymentMethod(m.id);
                      // Close any open info tooltip after selecting a method.
                      setMobilePayInfoOpen(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      if (m.id === 'offline' && !offlineAllowed) {
                        addToast('Offline payment is not available for orders above ₹2,00,000.', 'error');
                        return;
                      }
                      setPaymentMethod(m.id);
                      setMobilePayInfoOpen(null);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-disabled={m.id === 'offline' && !offlineAllowed}
                    className={`relative w-full px-2 py-2 rounded-xl border text-[11px] font-extrabold select-none text-center ${
                      paymentMethod === m.id
                        ? 'border-walnut bg-walnut/5 text-ink'
                        : 'border-pale bg-white text-mid'
                    } ${m.id === 'offline' && !offlineAllowed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {m.info ? (
                      <button
                        type="button"
                        aria-label="More info"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobilePayInfoOpen((prev) => (prev === m.id ? null : m.id));
                        }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full border border-pale bg-white text-muted inline-flex items-center justify-center text-[10px] font-extrabold"
                      >
                        i
                      </button>
                    ) : null}
                    <span className="block truncate">{m.label}</span>
                  </div>
                ))}
              </div>
              {mobilePayInfoOpen ? (
                <div className="mt-3 rounded-2xl border border-pale bg-cream px-3 py-2 text-[11px] font-semibold text-mid">
                  {mobilePayInfoOpen === 'offline'
                    ? 'Pay in person at our office during order pickup.'
                    : 'Pay part now, balance payable in person at pickup'}
                </div>
              ) : null}
              {!offlineAllowed ? (
                <p className="mt-2 text-center text-[11px] font-semibold text-amber-700">
                  Offline payment is not available above ₹2,00,000.
                </p>
              ) : null}
              <button
                type="button"
                onClick={onContinue}
                disabled={!canPressContinue}
                className="mt-3 w-full py-3 rounded-full bg-walnut text-blush text-[13px] font-extrabold disabled:opacity-50"
              >
                {submitting ? 'Processing…' : 'Continue'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

