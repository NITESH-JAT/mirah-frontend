import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';
import { orderService } from '../../services/orderService';
import SafeImage from '../../components/SafeImage';

function toTitleCase(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function normalizeExtraFieldKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extraFieldsToArray(extraFields) {
  if (!extraFields || typeof extraFields !== 'object') return [];

  // PRD format:
  // {
  //   schema: { material: { type: "text", label: "Material" } },
  //   values: { material: "Leather" }
  // }
  const schema = extraFields?.schema;
  const values = extraFields?.values;
  if (!schema || typeof schema !== 'object' || !values || typeof values !== 'object') return [];

  const keys = new Set([...Object.keys(schema || {}), ...Object.keys(values || {})]);
  return Array.from(keys)
    .map((k) => ({
      key: String(k || '').trim(),
      label: String(schema?.[k]?.label || '').trim(),
      value: String(values?.[k] ?? '').trim(),
    }))
    .filter((x) => x.key && (x.label || x.value));
}

function coerceUrlArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return coerceUrlArray(parsed);
    } catch {
      return [s];
    }
  }
  return [];
}

function buildExtraFieldsPayload(extraFieldRows) {
  const rows = Array.isArray(extraFieldRows) ? extraFieldRows : [];
  const normalized = rows
    .map((x) => {
      const label = String(x?.label || '').trim();
      const value = String(x?.value || '').trim();
      const key = String(x?.key || normalizeExtraFieldKey(label) || '').trim();
      return { key, label, value };
    })
    .filter((x) => x.label && x.value);

  if (!normalized.length) return undefined;

  const schema = {};
  const values = {};
  for (const item of normalized) {
    schema[item.key] = { type: 'text', label: item.label };
    values[item.key] = item.value;
  }
  return { schema, values };
}

function localOrderIdOf(o) {
  return o?.localOrderId ?? o?.local_order_id ?? o?.id ?? o?._id ?? o?.order_id ?? null;
}

function orderCodeOf(o) {
  const code =
    o?.orderCode ??
    o?.order_code ??
    o?.code ??
    o?.orderNumber ??
    o?.order_number ??
    o?.orderNo ??
    o?.order_no ??
    null;
  if (!code) return null;
  if (typeof code === 'string' && code.startsWith('order_')) return null;
  return code;
}

function statusText(o) {
  const s = String(o?.status ?? o?.orderStatus ?? o?.order_status ?? '').trim();
  if (!s) return '—';
  const cleaned = s.replace(/[_-]+/g, ' ').trim();
  return cleaned
    .split(/\s+/g)
    .map((w) => (w ? `${w[0].toUpperCase()}${w.slice(1).toLowerCase()}` : w))
    .join(' ');
}

function paidLabel(o) {
  const due = o?.amountDue ?? o?.amount_due ?? o?.dueAmount ?? o?.due_amount ?? null;
  if (due == null) return null;
  const n = Number(due);
  if (Number.isNaN(n)) return null;
  const method = String(o?.paymentMethod ?? o?.payment_method ?? '').trim().toLowerCase();
  const statusRaw = String(o?.status ?? o?.orderStatus ?? o?.order_status ?? '').trim().toLowerCase();
  const hasOnlinePayment = Boolean(
    o?.razorpayPaymentId ??
      o?.razorpay_payment_id ??
      o?.razorpayPayment?.id ??
      o?.razorpay?.paymentId ??
      o?.paymentId ??
      o?.payment_id ??
      null
  );

  if (n > 0 && statusRaw === 'pending_payment' && method !== 'offline' && !hasOnlinePayment) {
    const whenRaw = o?.createdAt ?? o?.created_at ?? o?.date ?? null;
    const when = whenRaw ? new Date(whenRaw) : null;
    const ageMs = when && !Number.isNaN(when.getTime()) ? Date.now() - when.getTime() : 0;
    if (ageMs > 24 * 60 * 60 * 1000) return 'Failed';
  }
  if (n > 0 && statusRaw === 'pending_payment' && method !== 'offline' && !hasOnlinePayment) return 'Pending';
  if (method === 'offline' && n > 0) return 'Will Pay Offline';
  if (method === 'partial' && n > 0 && (hasOnlinePayment || statusRaw === 'offline_due' || statusRaw === 'partial_due')) {
    return 'Partial Paid';
  }
  return n <= 0 ? 'Paid' : 'Unpaid';
}

function adminCommissionOf(o) {
  const v =
    o?.adminCommissionAmount ??
    o?.admin_commission_amount ??
    o?.commissionAmount ??
    o?.commission_amount ??
    null;
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function payableToVendorOf(o) {
  const v =
    o?.totalPayableToVendorAfterDeduction ??
    o?.total_payable_to_vendor_after_deduction ??
    o?.vendorPayable ??
    o?.vendor_payable ??
    null;
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function extractOrderItems(order) {
  const raw =
    order?.items ??
    order?.orderItems ??
    order?.order_items ??
    order?.products ??
    order?.lines ??
    order?.data ??
    [];
  return Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
}

function itemName(it) {
  const p = it?.product ?? it?.productDetails ?? it?.productSnapshot ?? it?.item ?? null;
  return p?.name ?? it?.productName ?? it?.name ?? it?.title ?? 'Product';
}

function itemQty(it) {
  const q = it?.quantity ?? it?.qty ?? it?.count ?? 1;
  const n = Number(q);
  return Number.isNaN(n) ? 1 : n || 1;
}

function itemUnitPrice(it) {
  const p = it?.unitPrice ?? it?.price ?? it?.product?.price ?? it?.productSnapshot?.price ?? 0;
  const n = Number(p);
  return Number.isNaN(n) ? 0 : n || 0;
}

export default function VendorShop() {
  const navigate = useNavigate();
  const { addToast } = useOutletContext();
  const { user, refresh } = useAuth();

  const [mobileView, setMobileView] = useState('menu'); // 'menu' | 'content'
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'orders'

  const [submitting, setSubmitting] = useState(false);

  const kycStatus = String(user?.kyc?.status || '').toLowerCase();
  const kycAccepted = kycStatus === 'accepted';
  const canSell = Boolean(user?.canSellProducts);

  const sellingRequest = user?.sellingRequest || null;
  const requestStatus = String(sellingRequest?.status || '').toLowerCase();
  const canRaise = Boolean(user?.canRaiseSellingRequest);
  const isPending = requestStatus === 'pending';
  const cooldown = useMemo(() => {
    if (requestStatus !== 'rejected' || canRaise) return null;
    const baseRaw = sellingRequest?.createdAt || sellingRequest?.reviewedAt;
    if (!baseRaw) return { message: 'You can re-submit after 24 hours from your last request.' };
    const base = new Date(baseRaw);
    if (Number.isNaN(base.getTime())) return { message: 'You can re-submit after 24 hours from your last request.' };
    const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    const left = next.getTime() - Date.now();
    if (left <= 0) return { message: 'You can re-submit now.' };
    return {
      message: `You can re-submit after ${next.toLocaleString()} (in ${formatDuration(left)}).`,
    };
  }, [requestStatus, canRaise, sellingRequest?.createdAt, sellingRequest?.reviewedAt]);

  const handleRaise = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await authService.createSellingRequest();
      await refresh();
      addToast('Request submitted to admin.', 'success');
    } catch (e) {
      addToast(e?.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Vendor products -----
  const [productsLoading, setProductsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actionLoadingById, setActionLoadingById] = useState({});

  // ----- Vendor product reviews -----
  const [reviewProductOpen, setReviewProductOpen] = useState(false);
  const [reviewProductQuery, setReviewProductQuery] = useState('');
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsMoreLoading, setReviewsMoreLoading] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewMeta, setReviewMeta] = useState({ page: 1, totalPages: 1, total: null });
  const reviewAbortRef = useRef(null);

  // ----- Vendor orders -----
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMoreLoading, setOrdersMoreLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersMeta, setOrdersMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersActingId, setOrdersActingId] = useState(null);
  const ordersAbortRef = useRef(null);
  const [ordersFiltersOpen, setOrdersFiltersOpen] = useState(false);

  const [orderFilterDraft, setOrderFilterDraft] = useState({
    status: '',
    from: '',
    to: '',
    productName: '',
  });
  const [orderFilters, setOrderFilters] = useState({
    status: '',
    from: '',
    to: '',
    productName: '',
  });

  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [orderDetailsFor, setOrderDetailsFor] = useState({ internalId: null, displayId: null });
  const orderDetailsAbortRef = useRef(null);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    price: '',
    compareAtPrice: '',
    description: '',
    sku: '',
    stock: '',
    category: '',
    brand: '',
    unit: 'pcs',
    weight: '',
    weightUnit: 'gm',
    metaTitle: '',
    metaDescription: '',
    images: [],
    videos: [],
    extraFields: [],
  });

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const items = await productService.listVendorProducts({ page: 1, limit: 50 });
      setProducts(items);
    } catch (e) {
      addToast(e?.message || 'Failed to load products', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const setActionLoading = (id, key, value) => {
    const k = `${id}:${key}`;
    setActionLoadingById((prev) => ({ ...(prev || {}), [k]: value }));
  };

  const isActionLoading = (id, key) => Boolean(actionLoadingById?.[`${id}:${key}`]);

  const handleDeleteProduct = async (p) => {
    const id = p?.id ?? p?._id;
    if (!id) return;
    const ok = window.confirm('Delete this product? This cannot be undone.');
    if (!ok) return;
    setActionLoading(id, 'delete', true);
    try {
      await productService.deleteVendorProduct(id);
      addToast('Product deleted.', 'success');
      await loadProducts();
    } catch (e) {
      addToast(e?.message || 'Failed to delete product', 'error');
    } finally {
      setActionLoading(id, 'delete', false);
    }
  };

  const handleSubmitForApproval = async (p) => {
    const id = p?.id ?? p?._id;
    if (!id) return;
    setActionLoading(id, 'submit', true);
    try {
      await productService.submitVendorProductForApproval(id);
      addToast('Submitted for approval.', 'success');
      await loadProducts();
    } catch (e) {
      addToast(e?.message || 'Failed to Submit For Approval', 'error');
    } finally {
      setActionLoading(id, 'submit', false);
    }
  };

  useEffect(() => {
    if (!kycAccepted || !canSell) return;
    if (activeTab !== 'list' && activeTab !== 'reviews') return;
    // Ensure vendor products are loaded for product reviews dropdown as well.
    if (products.length > 0) return;
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, kycAccepted, canSell]);

  const filteredReviewProducts = useMemo(() => {
    const q = String(reviewProductQuery || '').trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    if (!q) return list;
    return list.filter((p) => {
      const name = String(p?.name ?? '').toLowerCase();
      return name.includes(q);
    });
  }, [products, reviewProductQuery]);

  const fetchVendorReviews = async ({ nextPage = 1, append = false } = {}) => {
    const pid = reviewProduct?.id ?? reviewProduct?._id ?? null;
    if (!pid) return;
    if (reviewAbortRef.current) reviewAbortRef.current.abort();
    const ctrl = new AbortController();
    reviewAbortRef.current = ctrl;
    if (append) setReviewsMoreLoading(true);
    else setReviewsLoading(true);
    try {
      const res = await productService.listVendorProductReviews({
        page: nextPage,
        limit: 10,
        productId: pid,
        signal: ctrl.signal,
      });
      const incoming = Array.isArray(res?.items) ? res.items : [];
      setReviewItems((prev) => {
        if (!append) return incoming;
        const base = Array.isArray(prev) ? prev : [];
        const seen = new Set(base.map((x) => String(x?.id ?? x?._id ?? '')));
        const merged = [...base];
        for (const it of incoming) {
          const key = String(it?.id ?? it?._id ?? '');
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
        return merged;
      });
      setReviewMeta(res?.meta ?? { page: nextPage, totalPages: 1, total: null });
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load product reviews', 'error');
      if (!append) setReviewItems([]);
    } finally {
      if (append) setReviewsMoreLoading(false);
      else setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'reviews') return;
    // Reset list when switching product or tab.
    setReviewItems([]);
    setReviewMeta({ page: 1, totalPages: 1, total: null });
    if (!reviewProduct) return;
    fetchVendorReviews({ nextPage: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reviewProduct?.id, reviewProduct?._id]);

  const loadVendorOrders = async ({ nextPage = 1, append = false, filters = orderFilters } = {}) => {
    if (ordersAbortRef.current) ordersAbortRef.current.abort();
    const ctrl = new AbortController();
    ordersAbortRef.current = ctrl;
    if (append) setOrdersMoreLoading(true);
    else setOrdersLoading(true);
    try {
      const statusKey = String(filters?.status || '').trim().toLowerCase();
      const apiStatus =
        statusKey === 'pending' || statusKey === 'failed'
          ? 'pending_payment'
          : statusKey === 'will_pay_offline'
            ? 'offline_due'
            : statusKey || undefined;
      const res = await orderService.listVendor({
        page: nextPage,
        limit: 10,
        status: apiStatus,
        from: filters?.from || undefined,
        to: filters?.to || undefined,
        productName: filters?.productName || undefined,
        signal: ctrl.signal,
      });
      const incomingRaw = Array.isArray(res?.items) ? res.items : [];
      const incoming = (() => {
        if (!statusKey) return incomingRaw;
        if (statusKey === 'failed') return incomingRaw.filter((o) => paidLabel(o) === 'Failed');
        if (statusKey === 'pending') return incomingRaw.filter((o) => paidLabel(o) === 'Pending');
        if (statusKey === 'will_pay_offline') return incomingRaw.filter((o) => paidLabel(o) === 'Will Pay Offline');
        return incomingRaw;
      })();
      setOrders((prev) => {
        if (!append) return incoming;
        const base = Array.isArray(prev) ? prev : [];
        const seen = new Set(base.map((x) => String(localOrderIdOf(x) ?? orderCodeOf(x) ?? '')));
        const merged = [...base];
        for (const it of incoming) {
          const key = String(localOrderIdOf(it) ?? orderCodeOf(it) ?? '');
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(it);
        }
        return merged;
      });
      setOrdersMeta(res?.meta ?? { page: nextPage, totalPages: 1, total: null });
      setOrdersPage(nextPage);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load orders', 'error');
      if (!append) setOrders([]);
    } finally {
      if (append) setOrdersMoreLoading(false);
      else setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!kycAccepted || !canSell) return;
    if (activeTab !== 'orders') return;
    loadVendorOrders({ nextPage: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, kycAccepted, canSell]);

  const applyOrderFilters = async () => {
    const next = {
      status: String(orderFilterDraft?.status || '').trim(),
      from: String(orderFilterDraft?.from || '').trim(),
      to: String(orderFilterDraft?.to || '').trim(),
      productName: String(orderFilterDraft?.productName || '').trim(),
    };
    setOrderFilters(next);
    await loadVendorOrders({ nextPage: 1, append: false, filters: next });
  };

  const clearOrderFilters = async () => {
    const empty = { status: '', from: '', to: '', productName: '' };
    setOrderFilterDraft(empty);
    setOrderFilters(empty);
    await loadVendorOrders({ nextPage: 1, append: false, filters: empty });
  };

  const vendorCancelAllowed = (o) => {
    const s = String(o?.status ?? '').toLowerCase();
    if (['cancelled', 'delivered', 'completed'].includes(s)) return false;
    const pay = paidLabel(o);
    if (pay === 'Failed') return false;
    return true;
  };

  const onVendorCancel = async (o) => {
    const id = localOrderIdOf(o);
    if (!id) return;
    setOrdersActingId(String(id));
    try {
      await orderService.vendorCancel(id);
      addToast('Order cancelled', 'success');
      await loadVendorOrders({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Failed to cancel order', 'error');
    } finally {
      setOrdersActingId(null);
    }
  };

  const openVendorOrderDetails = async ({ internalId, displayId, fallbackOrder }) => {
    if (!internalId) {
      addToast('Order details not available for this order.', 'error');
      return;
    }
    if (orderDetailsAbortRef.current) orderDetailsAbortRef.current.abort();
    const ctrl = new AbortController();
    orderDetailsAbortRef.current = ctrl;
    setOrderDetailsFor({ internalId, displayId });
    setOrderDetails(fallbackOrder || null);
    setOrderDetailsOpen(true);
    setOrderDetailsLoading(true);
    try {
      const res = await orderService.getById(internalId, { signal: ctrl.signal });
      if (res) setOrderDetails(res);
    } catch {
      // keep fallback if any
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  const closeVendorOrderDetails = () => {
    if (orderDetailsLoading) return;
    setOrderDetailsOpen(false);
  };

  const handleUploadImages = async (files) => {
    const list = Array.isArray(files) ? files : [];
    if (!list.length) return;
    setImageUploading(true);
    try {
      for (const file of list) {
        const { url } = await productService.uploadVendorImage(file);
        if (!url) {
          addToast('Upload succeeded but no URL returned.', 'error');
          continue;
        }
        setCreateForm((prev) => ({ ...prev, images: [...(prev.images || []), url] }));
      }
      addToast(list.length > 1 ? 'Images uploaded' : 'Image uploaded', 'success');
    } catch (e) {
      addToast(e?.message || 'Image upload failed', 'error');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleUploadVideos = async (files) => {
    const list = Array.isArray(files) ? files : [];
    if (!list.length) return;
    setImageUploading(true);
    try {
      for (const file of list) {
        const { url } = await productService.uploadVendorVideo(file);
        if (!url) {
          addToast('Upload succeeded but no URL returned.', 'error');
          continue;
        }
        setCreateForm((prev) => ({ ...prev, videos: [...(prev.videos || []), url] }));
      }
      addToast(list.length > 1 ? 'Videos uploaded' : 'Video uploaded', 'success');
    } catch (e) {
      addToast(e?.message || 'Video upload failed', 'error');
    } finally {
      setImageUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    const name = String(createForm.name || '').trim();
    const priceNum = Number(createForm.price);
    if (!name) {
      addToast('Product name is required.', 'error');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      addToast('Valid price is required.', 'error');
      return;
    }

    setCreateLoading(true);
    try {
      const rawExtra = Array.isArray(createForm.extraFields) ? createForm.extraFields : [];
      const normalizedExtra = rawExtra
        .map((x) => {
          const label = String(x?.label || '').trim();
          const value = String(x?.value || '').trim();
          const key = String(x?.key || normalizeExtraFieldKey(label) || '').trim();
          return { key, label, value };
        })
        .filter((x) => x.label && x.value);
      const keySet = new Set();
      for (const ef of normalizedExtra) {
        if (!ef.key) {
          addToast('Extra field label is required.', 'error');
          setCreateLoading(false);
          return;
        }
        if (keySet.has(ef.key)) {
          addToast('Extra field labels must be unique.', 'error');
          setCreateLoading(false);
          return;
        }
        keySet.add(ef.key);
      }

      const payload = {
        name,
        price: priceNum,
        compareAtPrice: createForm.compareAtPrice === '' ? undefined : Number(createForm.compareAtPrice),
        description: createForm.description || undefined,
        sku: createForm.sku || undefined,
        stock: createForm.stock === '' ? undefined : Number(createForm.stock),
        category: createForm.category || undefined,
        brand: createForm.brand || undefined,
        unit: createForm.unit || 'pcs',
        weight: createForm.weight === '' ? undefined : Number(createForm.weight),
        weightUnit: createForm.weightUnit || 'gm',
        metaTitle: createForm.metaTitle || undefined,
        metaDescription: createForm.metaDescription || undefined,
        images: Array.isArray(createForm.images) ? createForm.images : [],
        videos: Array.isArray(createForm.videos) ? createForm.videos : [],
        extraFields: buildExtraFieldsPayload(normalizedExtra),
        status: 'draft',
      };

      await productService.createVendorProduct(payload);
      addToast('Product created (draft).', 'success');
      setCreateForm({
        name: '',
        price: '',
        compareAtPrice: '',
        description: '',
        sku: '',
        stock: '',
        category: '',
        brand: '',
        unit: 'pcs',
        weight: '',
        weightUnit: 'gm',
        metaTitle: '',
        metaDescription: '',
        images: [],
        videos: [],
        extraFields: [],
      });
      setActiveTab('list');
      if (window.innerWidth < 768) setMobileView('content');
      await loadProducts();
    } catch (e) {
      addToast(e?.message || 'Failed to create product', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const startCreateNew = () => {
    setEditingId(null);
    setCreateForm({
      name: '',
      price: '',
      compareAtPrice: '',
      description: '',
      sku: '',
      stock: '',
      category: '',
      brand: '',
      unit: 'pcs',
      weight: '',
      weightUnit: 'gm',
      metaTitle: '',
      metaDescription: '',
      images: [],
      videos: [],
      extraFields: [],
    });
    setActiveTab('create');
    if (window.innerWidth < 768) setMobileView('content');
  };

  const startEdit = async (product) => {
    const id = product?.id ?? product?._id;
    if (!id) return;
    setEditingId(id);
    setActiveTab('create');
    if (window.innerWidth < 768) setMobileView('content');
    setCreateLoading(true);
    try {
      const res = await productService.getVendorProduct(id);
      const p = res?.data ?? res?.product ?? res ?? {};
      const images = coerceUrlArray(
        p?.images ?? p?.imageUrls ?? p?.imageURLs ?? p?.imageUrl ?? p?.imageURL ?? p?.image
      );
      const videos = coerceUrlArray(
        p?.videos ?? p?.videoUrls ?? p?.videoURLs ?? p?.videoUrl ?? p?.videoURL ?? p?.video
      );
      setCreateForm({
        name: p?.name ?? '',
        price: p?.price ?? '',
        compareAtPrice: p?.compareAtPrice ?? '',
        description: p?.description ?? '',
        sku: p?.sku ?? '',
        stock: p?.stock ?? '',
        category: p?.category ?? '',
        brand: p?.brand ?? '',
        unit: p?.unit ?? 'pcs',
        weight: p?.weight ?? '',
        weightUnit: p?.weightUnit ?? 'gm',
        metaTitle: p?.metaTitle ?? '',
        metaDescription: p?.metaDescription ?? '',
        images,
        videos,
        extraFields: extraFieldsToArray(p?.extraFields),
      });
    } catch (e) {
      addToast(e?.message || 'Failed to load product', 'error');
      setEditingId(null);
      setActiveTab('list');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingId) {
      await handleCreate();
      return;
    }

    const name = String(createForm.name || '').trim();
    const priceNum = Number(createForm.price);
    if (!name) {
      addToast('Product name is required.', 'error');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      addToast('Valid price is required.', 'error');
      return;
    }

    setCreateLoading(true);
    try {
      const rawExtra = Array.isArray(createForm.extraFields) ? createForm.extraFields : [];
      const normalizedExtra = rawExtra
        .map((x) => {
          const label = String(x?.label || '').trim();
          const value = String(x?.value || '').trim();
          const key = String(x?.key || normalizeExtraFieldKey(label) || '').trim();
          return { key, label, value };
        })
        .filter((x) => x.label && x.value);
      const keySet = new Set();
      for (const ef of normalizedExtra) {
        if (!ef.key) {
          addToast('Extra field label is required.', 'error');
          setCreateLoading(false);
          return;
        }
        if (keySet.has(ef.key)) {
          addToast('Extra field labels must be unique.', 'error');
          setCreateLoading(false);
          return;
        }
        keySet.add(ef.key);
      }

      const payload = {
        name,
        price: priceNum,
        compareAtPrice: createForm.compareAtPrice === '' ? undefined : Number(createForm.compareAtPrice),
        description: createForm.description || undefined,
        sku: createForm.sku || undefined,
        stock: createForm.stock === '' ? undefined : Number(createForm.stock),
        category: createForm.category || undefined,
        brand: createForm.brand || undefined,
        unit: createForm.unit || 'pcs',
        weight: createForm.weight === '' ? undefined : Number(createForm.weight),
        weightUnit: createForm.weightUnit || 'gm',
        metaTitle: createForm.metaTitle || undefined,
        metaDescription: createForm.metaDescription || undefined,
        images: Array.isArray(createForm.images) ? createForm.images : [],
        videos: Array.isArray(createForm.videos) ? createForm.videos : [],
        extraFields: buildExtraFieldsPayload(normalizedExtra),
        status: 'draft',
      };
      await productService.updateVendorProduct({ id: editingId, payload });
      addToast('Product updated.', 'success');
      setEditingId(null);
      setActiveTab('list');
      await loadProducts();
    } catch (e) {
      addToast(e?.message || 'Failed to update product', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const MenuItem = ({ id, label, icon }) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => {
          setActiveTab(id);
          if (window.innerWidth < 768) setMobileView('content');
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left border transition-colors cursor-pointer
          ${isActive ? 'bg-primary-dark text-white border-primary-dark' : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50'}
        `}
      >
        <span className={`${isActive ? 'text-white' : 'text-gray-400'}`}>{icon}</span>
        <span className="text-[13px] font-semibold">{label}</span>
      </button>
    );
  };

  const InfoBox = ({ label, value, tone = 'default' }) => {
    const toneClass =
      tone === 'danger'
        ? 'bg-red-50 border-red-100 text-red-700'
        : tone === 'warn'
          ? 'bg-yellow-50 border-yellow-100 text-yellow-700'
          : 'bg-gray-50 border-gray-100 text-gray-700';
    return (
      <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-[12px] font-semibold mt-0.5 truncate">{value}</p>
      </div>
    );
  };

  return (
    <div className="w-full pb-10 animate-fade-in">
      {/* Vendor order details modal */}
      {orderDetailsOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeVendorOrderDetails}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[min(86vh,720px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-gray-900">Order details</p>
                {orderDetailsFor?.displayId ? (
                  <p className="mt-1 text-[12px] text-gray-400 truncate">Order #{String(orderDetailsFor.displayId)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeVendorOrderDetails}
                disabled={orderDetailsLoading}
                className="p-2 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {orderDetailsLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                  <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : !orderDetails ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
                  Unable to load order details.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-100 p-4">
                    <p className="text-[12px] font-extrabold text-gray-900">Items</p>
                    <div className="mt-3 space-y-3">
                      {extractOrderItems(orderDetails).map((it, idx) => {
                        const qty = itemQty(it);
                        const price = itemUnitPrice(it);
                        const lineTotal = qty * price;
                        return (
                          <div key={String(it?.id ?? it?._id ?? idx)} className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold text-gray-900 truncate">{itemName(it)}</p>
                                <p className="mt-1 text-[11px] text-gray-400">
                                  Qty: <span className="font-semibold text-gray-600">{qty}</span> • Unit: ₹{formatMoney(price)}
                                </p>
                              </div>
                              <div className="shrink-0 text-[12px] font-extrabold text-gray-900">₹{formatMoney(lineTotal)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-100 p-4">
                    <p className="text-[12px] font-extrabold text-gray-900">Totals</p>
                    <div className="mt-3 space-y-2 text-[12px]">
                      {payableToVendorOf(orderDetails) != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Payable to you (after commission)</span>
                          <span className="font-extrabold text-gray-900">₹{formatMoney(payableToVendorOf(orderDetails))}</span>
                        </div>
                      ) : null}
                      {adminCommissionOf(orderDetails) != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Platform commission</span>
                          <span className="font-bold text-gray-900">₹{formatMoney(adminCommissionOf(orderDetails))}</span>
                        </div>
                      ) : null}
                      {orderDetails?.totalAmount != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Total</span>
                          <span className="font-bold text-gray-900">₹{formatMoney(orderDetails.totalAmount)}</span>
                        </div>
                      ) : null}
                      {orderDetails?.onlineAmount != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Online amount</span>
                          <span className="font-bold text-gray-900">₹{formatMoney(orderDetails.onlineAmount)}</span>
                        </div>
                      ) : null}
                      {orderDetails?.offlineAmount != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Offline amount</span>
                          <span className="font-bold text-gray-900">₹{formatMoney(orderDetails.offlineAmount)}</span>
                        </div>
                      ) : null}
                      {orderDetails?.amountPaid != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Amount paid</span>
                          <span className="font-bold text-gray-900">₹{formatMoney(orderDetails.amountPaid)}</span>
                        </div>
                      ) : null}
                      {orderDetails?.amountDue != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Amount due</span>
                          <span className="font-bold text-gray-900">₹{formatMoney(orderDetails.amountDue)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!kycAccepted ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
            <div className="font-semibold text-gray-800 mb-1">KYC not accepted yet</div>
            <div className="text-gray-600">
              Please complete your KYC. Once it’s accepted, you’ll be able to access the Store module.
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/vendor/kyc')}
                className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                Go to KYC
              </button>
            </div>
          </div>
        ) : canSell ? (
          <div className="w-full h-[calc(100dvh-140px)] lg:h-[calc(100vh-150px)] flex gap-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Menu */}
            <div className={`w-full md:w-[320px] shrink-0 border-r border-gray-100 ${mobileView === 'content' ? 'hidden md:flex' : 'flex'} flex-col`}>
              <div className="px-5 pt-5 pb-3">
                <p className="text-[16px] font-extrabold text-gray-900">Store</p>
                <p className="mt-1 text-[12px] text-gray-400">Manage your products and orders.</p>
              </div>
              <div className="px-5 pb-5 space-y-2">
                <MenuItem
                  id="create"
                  label="Create Product"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>}
                />
                <MenuItem
                  id="list"
                  label="List Products"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
                      <path d="M3.3 7 12 12l8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  }
                />
                <MenuItem
                  id="orders"
                  label="Manage Orders"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                      <path d="M9 5a3 3 0 0 0 6 0" />
                      <path d="M9 5h6" />
                      <path d="M9 12h6" />
                      <path d="M9 16h6" />
                    </svg>
                  }
                />
                <MenuItem
                  id="reviews"
                  label="Product Reviews"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                      <path d="M12 7.5l.9 1.82 2.01.29-1.45 1.41.34 2-1.8-.95-1.8.95.34-2-1.45-1.41 2.01-.29.9-1.82z" />
                    </svg>
                  }
                />
              </div>
            </div>

            {/* Main */}
            <div className={`flex-1 ${mobileView === 'menu' ? 'hidden md:flex' : 'flex'} flex-col`}>
              <div className="h-14 border-b border-gray-100 px-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileView('menu')}
                    className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                    aria-label="Back"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <p className="text-[13px] font-bold text-gray-800">
                    {activeTab === 'create'
                      ? 'Create Product'
                      : activeTab === 'list'
                        ? 'Products'
                        : activeTab === 'reviews'
                          ? 'Product Reviews'
                          : 'Manage Orders'}
                  </p>
                </div>
                {activeTab === 'list' ? (
                  <button
                    type="button"
                    onClick={loadProducts}
                    disabled={productsLoading}
                    className="px-3 py-1.5 rounded-lg border border-gray-100 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {productsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                ) : activeTab === 'reviews' ? (
                  null
                ) : null}
              </div>

            <div className="flex-1 min-h-0 overflow-hidden p-5 bg-white">
                {activeTab === 'orders' ? (
                  <div className="h-full min-h-0 flex flex-col">
                    <div className="shrink-0 sticky top-0 z-10 bg-white pb-4">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <div className="md:hidden">
                          <button
                            type="button"
                            onClick={() => setOrdersFiltersOpen((v) => !v)}
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-left text-[13px] font-bold text-gray-800 flex items-center justify-between gap-3"
                          >
                            <span className="truncate">Filters</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </div>

                        <div className={`${ordersFiltersOpen ? 'block' : 'hidden'} md:block mt-3 md:mt-0`}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <p className="text-[11px] font-bold text-gray-600 mb-1">Status</p>
                              <select
                                value={orderFilterDraft.status}
                                onChange={(e) =>
                                  setOrderFilterDraft((p) => ({ ...(p || {}), status: e.target.value }))
                                }
                                className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 focus:outline-none focus:border-primary-dark"
                              >
                                <option value="">All</option>
                                <option value="paid">Paid</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="pending">Pending</option>
                                <option value="failed">Failed</option>
                                <option value="will_pay_offline">Will pay offline</option>
                              </select>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-gray-600 mb-1">From</p>
                              <input
                                type="date"
                                value={orderFilterDraft.from}
                                onChange={(e) =>
                                  setOrderFilterDraft((p) => ({ ...(p || {}), from: e.target.value }))
                                }
                                className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 focus:outline-none focus:border-primary-dark"
                              />
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-gray-600 mb-1">To</p>
                              <input
                                type="date"
                                value={orderFilterDraft.to}
                                onChange={(e) =>
                                  setOrderFilterDraft((p) => ({ ...(p || {}), to: e.target.value }))
                                }
                                className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 focus:outline-none focus:border-primary-dark"
                              />
                            </div>

                            <div>
                              <p className="text-[11px] font-bold text-gray-600 mb-1">Product name</p>
                              <input
                                value={orderFilterDraft.productName}
                                onChange={(e) =>
                                  setOrderFilterDraft((p) => ({ ...(p || {}), productName: e.target.value }))
                                }
                                placeholder="Type product name…"
                                className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary-dark"
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                            <button
                              type="button"
                              onClick={clearOrderFilters}
                              disabled={ordersLoading || ordersMoreLoading}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={applyOrderFilters}
                              disabled={ordersLoading || ordersMoreLoading}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                      {ordersLoading ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 md:p-14 flex items-center justify-center">
                        <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 md:p-14 flex items-center justify-center">
                        <div className="text-center">
                          <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                            </svg>
                          </div>
                          <p className="mt-4 text-[14px] font-bold text-gray-900">No orders yet</p>
                          <p className="mt-1 text-[12px] text-gray-500">
                            {orderFilters?.status || orderFilters?.from || orderFilters?.to || orderFilters?.productName
                              ? 'No orders match your filters.'
                              : 'Customer orders for your products will appear here.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {orders.map((o) => {
                          const internalId = localOrderIdOf(o);
                          const displayId = orderCodeOf(o);
                          const idLabel = displayId ?? internalId ?? '';
                          const total = o?.totalAmount ?? o?.total ?? o?.amount ?? o?.grandTotal ?? null;
                          const whenRaw = o?.createdAt ?? o?.created_at ?? o?.date ?? null;
                          const when = whenRaw ? new Date(whenRaw) : null;
                          const whenText = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : '';
                          const pay = paidLabel(o);
                          const st = statusText(o);
                          const statusRaw = String(o?.status ?? o?.orderStatus ?? o?.order_status ?? '').trim().toLowerCase();
                          const showStatusChip = (() => {
                            if (!st || st === '—') return false;
                            const stLower = String(st).trim().toLowerCase();
                            if (['pending payment', 'offline due', 'partial due', 'paid'].includes(stLower)) return false;
                            if (!pay) return true;
                            return stLower !== String(pay).trim().toLowerCase();
                          })();
                          const statusChipClass =
                            statusRaw === 'cancelled'
                              ? 'bg-red-50 border-red-100 text-red-600'
                              : 'bg-gray-50 border-gray-100 text-gray-600';
                          const busy = ordersActingId != null && String(ordersActingId) === String(internalId);
                          return (
                            <div key={String(internalId ?? idLabel ?? Math.random())} className="rounded-2xl border border-gray-100 p-4">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[13px] font-bold text-gray-900 truncate max-w-[90vw] sm:max-w-none">
                                      Order #{String(idLabel)}
                                    </p>
                                    {pay ? (
                                      <span
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                          pay === 'Paid'
                                            ? 'bg-green-50 border-green-100 text-green-700'
                                            : pay === 'Failed'
                                              ? 'bg-red-50 border-red-100 text-red-700'
                                              : pay === 'Pending'
                                                ? 'bg-amber-50 border-amber-100 text-amber-700'
                                                : 'bg-amber-50 border-amber-100 text-amber-700'
                                        }`}
                                      >
                                        {pay}
                                      </span>
                                    ) : null}
                                    {showStatusChip ? (
                                      <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${statusChipClass}`}>
                                        {st}
                                      </span>
                                    ) : null}
                                  </div>
                                  {whenText ? <p className="mt-1 text-[12px] text-gray-400">{whenText}</p> : null}
                                  {total != null ? (
                                    <p className="mt-2 text-[14px] font-extrabold text-gray-900">₹{formatMoney(total)}</p>
                                  ) : null}
                                </div>
                                <div className="w-full sm:w-auto shrink-0 flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openVendorOrderDetails({
                                        internalId,
                                        displayId: idLabel,
                                        fallbackOrder: o,
                                      })
                                    }
                                    disabled={busy}
                                    className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    View details
                                  </button>
                                  {vendorCancelAllowed(o) ? (
                                    <button
                                      type="button"
                                      onClick={() => onVendorCancel(o)}
                                      disabled={busy}
                                      className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {Number(ordersMeta?.page || 1) < Number(ordersMeta?.totalPages || 1) ? (
                          <button
                            type="button"
                            onClick={() => loadVendorOrders({ nextPage: ordersPage + 1, append: true })}
                            disabled={ordersMoreLoading}
                            className="mt-2 w-full py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {ordersMoreLoading ? 'Loading…' : 'Load more'}
                          </button>
                        ) : null}
                      </>
                    )}
                    </div>
                  </div>
                ) : activeTab === 'reviews' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-100 bg-white p-4">
                      <p className="text-[13px] font-bold text-gray-900">Product reviews</p>
                      <p className="mt-1 text-[12px] text-gray-400">Select a product to view its customer reviews.</p>

                      <div className="mt-4 relative">
                        <button
                          type="button"
                          onClick={() => setReviewProductOpen((v) => !v)}
                          className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-left text-[13px] font-semibold text-gray-800 flex items-center justify-between gap-3 hover:bg-gray-50"
                        >
                          <span className="truncate">
                            {reviewProduct?.name ? reviewProduct.name : productsLoading ? 'Loading products…' : 'Select product'}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>

                        {reviewProductOpen ? (
                          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
                            <div className="p-3 border-b border-gray-50">
                              <input
                                value={reviewProductQuery}
                                onChange={(e) => setReviewProductQuery(e.target.value)}
                                placeholder="Type product name…"
                                className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-[13px] font-semibold text-gray-800 focus:outline-none focus:border-primary-dark"
                              />
                            </div>
                            <div className="max-h-[280px] overflow-y-auto">
                              {productsLoading ? (
                                <div className="p-4 text-[12px] text-gray-400">Loading products…</div>
                              ) : filteredReviewProducts.length === 0 ? (
                                <div className="p-6 text-center">
                                  <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="11" cy="11" r="8" />
                                      <path d="m21 21-4.3-4.3" />
                                    </svg>
                                  </div>
                                  <p className="mt-3 text-[13px] font-bold text-gray-900">No products found</p>
                                  <p className="mt-1 text-[12px] text-gray-500">Try a different name.</p>
                                </div>
                              ) : (
                                filteredReviewProducts.map((p) => {
                                  const pid = p?.id ?? p?._id ?? null;
                                  return (
                                    <button
                                      key={String(pid)}
                                      type="button"
                                      onClick={() => {
                                        setReviewProduct(p);
                                        setReviewProductOpen(false);
                                        setReviewProductQuery('');
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                                    >
                                      <p className="text-[13px] font-semibold text-gray-900 truncate">{p?.name || 'Product'}</p>
                                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p?.category || '\u00A0'}</p>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {!reviewProduct ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                        <div className="text-center">
                          <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                            </svg>
                          </div>
                          <p className="mt-4 text-[14px] font-bold text-gray-900">Select a product</p>
                          <p className="mt-1 text-[12px] text-gray-500">Choose a product to view its reviews.</p>
                        </div>
                      </div>
                    ) : reviewsLoading ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                        <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </div>
                    ) : reviewItems.length === 0 ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                        <div className="text-center">
                          <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                          </div>
                          <p className="mt-4 text-[14px] font-bold text-gray-900">No reviews yet</p>
                          <p className="mt-1 text-[12px] text-gray-500">This product has no customer reviews.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reviewItems.map((r, idx) => {
                          const id = r?.id ?? r?._id ?? idx;
                          const rating = Number(r?.rating ?? r?.review?.rating ?? 0) || 0;
                          const comment = String(r?.comment ?? r?.review?.comment ?? '').trim();
                          const customer = r?.customer ?? r?.user ?? r?.reviewer ?? null;
                          let name = r?.customerName ?? r?.name ?? null;
                          if (!name && customer) {
                            name = `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim();
                          }
                          if (!name) name = 'Customer';
                          const whenRaw = r?.createdAt ?? r?.created_at ?? r?.review?.createdAt ?? null;
                          const when = whenRaw ? new Date(whenRaw) : null;
                          const whenText = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : '';
                          return (
                            <div key={String(id)} className="rounded-2xl border border-gray-100 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-extrabold text-gray-900 truncate">{name}</p>
                                  {whenText ? <p className="mt-1 text-[11px] text-gray-400">{whenText}</p> : null}
                                </div>
                                <div className="shrink-0 inline-flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => {
                                    const filled = i + 1 <= rating;
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
                                        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                      </svg>
                                    );
                                  })}
                                </div>
                              </div>
                              {comment ? (
                                <p className="mt-3 text-[12px] text-gray-700 leading-relaxed whitespace-pre-line">{comment}</p>
                              ) : (
                                <p className="mt-3 text-[12px] text-gray-400">No comment.</p>
                              )}
                            </div>
                          );
                        })}

                        {Number(reviewMeta?.page || 1) < Number(reviewMeta?.totalPages || 1) ? (
                          <button
                            type="button"
                            onClick={() =>
                              fetchVendorReviews({ nextPage: Number(reviewMeta?.page || 1) + 1, append: true })
                            }
                            disabled={reviewsMoreLoading}
                            className="w-full py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {reviewsMoreLoading ? 'Loading…' : 'Load more'}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : activeTab === 'list' ? (
                  <div className="h-full min-h-0 overflow-y-auto pr-1">
                    {productsLoading ? (
                      <div className="text-[13px] text-gray-400">Loading products…</div>
                    ) : products.length === 0 ? (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
                        No products yet. Create your first product.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {products.map((p) => (
                          <div
                            key={String(p.id ?? p._id)}
                            className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
                          >
                            <div className="flex flex-col md:flex-row">
                              <div className="w-full md:w-[220px] h-[180px] md:h-[180px] bg-white border-b md:border-b-0 md:border-r border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {Array.isArray(p.images) && p.images[0] ? (
                                  <SafeImage src={p.images[0]} alt="" loading="lazy" className="w-full h-full object-contain p-2" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 p-4 md:p-5">
                                <p className="text-[18px] md:text-[22px] font-bold text-gray-800 truncate">{p.name}</p>
                                <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">
                                  {p.description || p.category || '—'}
                                </p>

                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                  <InfoBox label="Category" value={String(p.category ?? p.productCategory ?? '—') || '—'} />
                                  <InfoBox label="Price" value={`₹ ${formatMoney(p.price)}`} />
                                  <InfoBox label="Stock" value={String(p.stock ?? '—')} />
                                  <InfoBox label="Status" value={toTitleCase(p.status || 'draft')} />
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2 md:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(p)}
                                    className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitForApproval(p)}
                                    disabled={
                                      isActionLoading(p?.id ?? p?._id, 'submit') ||
                                      String(p?.approvalStatus || '').toLowerCase() === 'pending' ||
                                      String(p?.approvalStatus || '').toLowerCase() === 'approved'
                                    }
                                    className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isActionLoading(p?.id ?? p?._id, 'submit')
                                      ? 'Submitting…'
                                      : String(p?.approvalStatus || '').toLowerCase() === 'pending'
                                        ? 'Approval Awaiting'
                                      : String(p?.approvalStatus || '').toLowerCase() === 'approved'
                                        ? 'Approved'
                                        : 'Submit For Approval'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(p)}
                                    disabled={isActionLoading(p?.id ?? p?._id, 'delete')}
                                    className="px-4 py-2 rounded-xl border border-red-100 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isActionLoading(p?.id ?? p?._id, 'delete') ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full min-h-0 overflow-y-auto pr-1">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-bold text-gray-800">
                          {editingId ? 'Update product' : 'Create product'}
                        </p>
                        <p className="text-[12px] text-gray-400">
                          {editingId ? 'Editing an existing product (saved as draft).' : 'Creates a draft product.'}
                        </p>
                      </div>
                      {editingId ? (
                        <button
                          type="button"
                          onClick={startCreateNew}
                          className="px-3 py-1.5 rounded-lg border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          New product
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Name *</label>
                        <input
                          value={createForm.name}
                          onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="Product name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Price *</label>
                            <input
                              type="number"
                              value={createForm.price}
                              onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                              placeholder="e.g. 1999.99"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Compare at price</label>
                            <input
                              type="number"
                              value={createForm.compareAtPrice}
                              onChange={(e) => setCreateForm((p) => ({ ...p, compareAtPrice: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                              placeholder="e.g. 2499.99"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Description</label>
                        <textarea
                          rows={3}
                          value={createForm.description}
                          onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="Describe the product"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">SKU</label>
                        <input
                          value={createForm.sku}
                          onChange={(e) => setCreateForm((p) => ({ ...p, sku: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="SKU"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Stock</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            value={createForm.stock}
                            onChange={(e) => setCreateForm((p) => ({ ...p, stock: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                            placeholder="10"
                          />
                          <input
                            value={createForm.unit}
                            onChange={(e) => setCreateForm((p) => ({ ...p, unit: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                            placeholder="pcs"
                            aria-label="Stock unit"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Category</label>
                        <input
                          value={createForm.category}
                          onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="Tiles"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Brand</label>
                        <input
                          value={createForm.brand}
                          onChange={(e) => setCreateForm((p) => ({ ...p, brand: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="Mirah"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Weight</label>
                        <input
                          type="number"
                          value={createForm.weight}
                          onChange={(e) => setCreateForm((p) => ({ ...p, weight: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Weight unit</label>
                        <input
                          value={createForm.weightUnit}
                          onChange={(e) => setCreateForm((p) => ({ ...p, weightUnit: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                          placeholder="gm"
                        />
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-bold text-gray-800">Extra fields</p>
                          <p className="text-[12px] text-gray-400">Add custom label/value pairs for this product.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCreateForm((p) => ({
                              ...p,
                              extraFields: [...(p.extraFields || []), { key: '', label: '', value: '' }],
                            }))
                          }
                          className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          Add field
                        </button>
                      </div>

                      {(createForm.extraFields || []).length ? (
                        <div className="mt-4 space-y-3">
                          {(createForm.extraFields || []).map((ef, idx) => (
                            <div key={`ef-${idx}`} className="rounded-xl border border-gray-100 p-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Label</label>
                                  <input
                                    value={ef?.label ?? ''}
                                    onChange={(e) => {
                                      const label = e.target.value;
                                      const key = normalizeExtraFieldKey(label);
                                      setCreateForm((p) => ({
                                        ...p,
                                        extraFields: (p.extraFields || []).map((x, i) =>
                                          i === idx ? { ...(x || {}), label, key } : x
                                        ),
                                      }));
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                    placeholder="e.g. Finish"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Value</label>
                                  <input
                                    value={ef?.value ?? ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setCreateForm((p) => ({
                                        ...p,
                                        extraFields: (p.extraFields || []).map((x, i) =>
                                          i === idx ? { ...(x || {}), value } : x
                                        ),
                                      }));
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 border-gray-200 focus:border-primary-dark"
                                    placeholder="e.g. polished"
                                  />
                                </div>
                              </div>

                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCreateForm((p) => ({
                                      ...p,
                                      extraFields: (p.extraFields || []).filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="text-[12px] font-bold text-red-600 hover:underline cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-[12px] text-gray-400">No extra fields added.</div>
                      )}
                    </div>

                    <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-bold text-gray-800">Images</p>
                          <p className="text-[12px] text-gray-400">Upload product images (optional).</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={imageUploading}
                          className="px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {imageUploading ? 'Uploading…' : 'Upload Image'}
                        </button>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) handleUploadImages(files);
                          }}
                        />
                      </div>

                      {createForm.images?.length ? (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {createForm.images.map((url, idx) => (
                            <div key={`${url}-${idx}`} className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                              <SafeImage src={url} alt="" className="w-full h-24 object-contain bg-white p-2" />
                              <button
                                type="button"
                                onClick={() =>
                                  setCreateForm((p) => ({ ...p, images: (p.images || []).filter((_, i) => i !== idx) }))
                                }
                                className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
                                aria-label="Remove"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-[12px] text-gray-400">No images uploaded.</div>
                      )}
                    </div>

                    <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-bold text-gray-800">Videos</p>
                          <p className="text-[12px] text-gray-400">Upload product videos (optional).</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => videoInputRef.current?.click()}
                          disabled={imageUploading}
                          className="px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {imageUploading ? 'Uploading…' : 'Upload Video'}
                        </button>
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) handleUploadVideos(files);
                          }}
                        />
                      </div>

                      {createForm.videos?.length ? (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {createForm.videos.map((url, idx) => (
                            <div key={`${url}-${idx}`} className="relative rounded-xl overflow-hidden border border-gray-100 bg-black">
                              <video src={url} className="w-full h-44 object-contain" controls />
                              <button
                                type="button"
                                onClick={() =>
                                  setCreateForm((p) => ({ ...p, videos: (p.videos || []).filter((_, i) => i !== idx) }))
                                }
                                className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
                                aria-label="Remove"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 text-[12px] text-gray-400">No videos uploaded.</div>
                      )}
                    </div>

                    <div className="mt-6 flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={createLoading || imageUploading}
                        className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {createLoading ? (editingId ? 'Saving…' : 'Creating…') : (editingId ? 'Save Changes' : 'Create Product')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setCreateForm({
                            name: '',
                            price: '',
                            compareAtPrice: '',
                            description: '',
                            sku: '',
                            stock: '',
                            category: '',
                            brand: '',
                            unit: 'pcs',
                            weight: '',
                            weightUnit: 'gm',
                            metaTitle: '',
                            metaDescription: '',
                            images: [],
                            videos: [],
                            extraFields: [],
                          });
                        }}
                        disabled={createLoading || imageUploading}
                        className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] text-gray-400 text-center md:text-right">
                      Note: Products are created as <span className="font-semibold">draft</span>. Submit when ready for admin approval.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-[13px] text-red-700">
            <div className="font-semibold text-red-800 mb-1">Selling is disabled for your account</div>
            <div className="text-red-700">
              For safety, selling is enabled only after admin approval. You can submit a request to enable selling.
            </div>

            <div className="mt-4 rounded-xl border border-red-100 bg-white/60 p-4 text-[13px] text-gray-700">
              <div className="font-semibold text-gray-800">Request selling enablement</div>

              {sellingRequest?.id ? (
                <div className="mt-2">
                  <div className="text-[12px] text-gray-500">
                    Request status:{' '}
                    <span className="font-semibold text-gray-700">{toTitleCase(requestStatus || 'pending')}</span>
                  </div>
                  {sellingRequest?.createdAt ? (
                    <div className="mt-1 text-[12px] text-gray-500">
                      Requested on: <span className="font-medium text-gray-700">{formatDate(sellingRequest.createdAt)}</span>
                    </div>
                  ) : null}
                  {sellingRequest?.reviewedAt ? (
                    <div className="mt-1 text-[12px] text-gray-500">
                      Reviewed on: <span className="font-medium text-gray-700">{formatDate(sellingRequest.reviewedAt)}</span>
                    </div>
                  ) : null}
                  <div className="mt-3 text-[12px] text-gray-500">
                    {requestStatus === 'pending'
                      ? 'Your request has been submitted and is pending admin review.'
                      : requestStatus === 'rejected'
                        ? 'Your request was rejected by admin. Selling remains disabled.'
                        : requestStatus === 'accepted'
                          ? 'Your request was accepted. Please refresh if selling is not enabled yet.'
                          : 'Your request has been submitted.'}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-gray-500">
                  Submit your request to the admin panel for review.
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleRaise}
                  disabled={submitting || !canRaise}
                  className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting
                    ? 'Submitting…'
                    : isPending
                      ? 'Submitted'
                      : requestStatus === 'rejected'
                        ? 'Re-submit Request'
                        : 'Submit Request'}
                </button>
                {!canRaise ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    {isPending
                      ? 'Your request is pending admin review.'
                      : cooldown?.message || 'You can’t raise a new request right now.'}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

