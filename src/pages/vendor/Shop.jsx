import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';

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

  const gateTitle = useMemo(() => {
    if (!kycAccepted) return 'Complete KYC to access Shop';
    if (canSell) return 'Shop';
    return 'Selling disabled';
  }, [kycAccepted, canSell]);

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
    if (activeTab !== 'list') return;
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, kycAccepted, canSell]);

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
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="font-sans text-lg font-bold text-gray-800">{gateTitle}</h2>
            {kycAccepted ? (
              <p className="text-[12px] text-gray-400">
                Status:{' '}
                <span className="font-semibold text-gray-600">
                  {canSell ? 'Enabled' : 'Disabled'}
                </span>
              </p>
            ) : (
              <p className="text-[12px] text-gray-400">
                Your KYC must be accepted before you can sell products.
              </p>
            )}
          </div>
        </div>

        {!kycAccepted ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
            <div className="font-semibold text-gray-800 mb-1">KYC not accepted yet</div>
            <div className="text-gray-600">
              Please complete your KYC. Once it’s accepted, you’ll be able to access the Shop module.
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
          <div className="w-full h-[calc(100dvh-240px)] lg:h-[calc(100vh-250px)] flex gap-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Menu */}
            <div className={`w-full md:w-[320px] shrink-0 border-r border-gray-100 ${mobileView === 'content' ? 'hidden md:flex' : 'flex'} flex-col`}>
              <div className="px-5 pt-5 pb-3">
                <h3 className="font-serif text-[18px] font-bold text-gray-800">Shop</h3>
                <p className="text-[12px] text-gray-400 mt-1">Manage your products and orders.</p>
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
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>}
                />
                <MenuItem
                  id="orders"
                  label="Manage Orders"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8H7"/><path d="M21 12H7"/><path d="M21 16H7"/><path d="M3 8h.01"/><path d="M3 12h.01"/><path d="M3 16h.01"/></svg>}
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
                  <p className="text-[13px] font-bold text-gray-800">{activeTab === 'create' ? 'Create Product' : activeTab === 'list' ? 'Products' : 'Orders'}</p>
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
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-white">
                {activeTab === 'orders' ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-[13px] text-gray-600">
                    Manage orders UI will be added next.
                  </div>
                ) : activeTab === 'list' ? (
                  productsLoading ? (
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
                                <img
                                  src={p.images[0]}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-contain p-2"
                                />
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

                              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
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
                  )
                ) : (
                  <div className="w-full">
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
                              <img src={url} alt="" className="w-full h-24 object-contain bg-white p-2" />
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

                    <div className="mt-6 flex gap-3">
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
                    <p className="mt-3 text-[11px] text-gray-400">
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
    </div>
  );
}

