import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orderService } from '../../services/orderService';
import { productService } from '../../services/productService';
import SafeImage from '../../components/SafeImage';

function formatMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function normalizeOrder(o) {
  return o || {};
}

function localOrderIdOf(o) {
  return (
    o?.localOrderId ??
    o?.local_order_id ??
    o?.id ??
    o?._id ??
    o?.order_id ??
    null
  );
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
  // Avoid showing Razorpay gateway order ids (order_...)
  if (typeof code === 'string' && code.startsWith('order_')) return null;
  return code;
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

  // If an online payment is pending for too long, treat it as failed in UI.
  if (n > 0 && statusRaw === 'pending_payment' && method !== 'offline' && !hasOnlinePayment) {
    const whenRaw = o?.createdAt ?? o?.created_at ?? o?.date ?? null;
    const when = whenRaw ? new Date(whenRaw) : null;
    const ageMs = when && !Number.isNaN(when.getTime()) ? Date.now() - when.getTime() : 0;
    if (ageMs > 24 * 60 * 60 * 1000) return 'Failed';
  }

  // Online order created but payment not completed yet.
  if (n > 0 && statusRaw === 'pending_payment' && method !== 'offline' && !hasOnlinePayment) {
    return 'Pending';
  }

  // Offline payable orders: show a clearer label than generic Unpaid.
  if (method === 'offline' && n > 0) {
    return 'Will Pay Offline';
  }

  // If payment method is partial and some amount is still due, show "Partial Paid"
  // once the online portion has been completed (commonly status becomes offline_due / partial_due).
  if (method === 'partial' && n > 0 && (hasOnlinePayment || statusRaw === 'offline_due' || statusRaw === 'partial_due')) {
    return 'Partial Paid';
  }

  return n <= 0 ? 'Paid' : 'Unpaid';
}

function statusText(o) {
  const s = String(o?.status ?? o?.orderStatus ?? o?.order_status ?? '').trim();
  if (!s) return '—';
  const cleaned = s.replace(/[_-]+/g, ' ').trim();
  // Title-case for UI
  return cleaned
    .split(/\s+/g)
    .map((w) => (w ? `${w[0].toUpperCase()}${w.slice(1).toLowerCase()}` : w))
    .join(' ');
}

export default function Orders() {
  const { addToast } = useOutletContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: null });
  const [page, setPage] = useState(1);
  const [actingId, setActingId] = useState(null);

  // Filters
  const [filterDraft, setFilterDraft] = useState({ status: '', from: '', to: '', productName: '' });
  const [filters, setFilters] = useState({ status: '', from: '', to: '', productName: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const [detailsFor, setDetailsFor] = useState({ internalId: null, displayId: null });
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [orderReviewItems, setOrderReviewItems] = useState([]);
  const [orderReviewLoading, setOrderReviewLoading] = useState(false);

  const abortRef = useRef(null);
  const abortDetailsRef = useRef(null);

  const load = async ({ nextPage = 1, append = false, filterParams = filters } = {}) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (append) setMoreLoading(true);
    else setLoading(true);
    try {
      const statusKey = String(filterParams?.status || '').trim().toLowerCase();
      const apiStatus =
        statusKey === 'pending' || statusKey === 'failed'
          ? 'pending_payment'
          : statusKey === 'will_pay_offline'
            ? 'offline_due'
            : statusKey || undefined;
      const res = await orderService.list({
        page: nextPage,
        limit: 10,
        status: apiStatus,
        from: filterParams?.from || undefined,
        to: filterParams?.to || undefined,
        productName: filterParams?.productName || undefined,
        signal: ctrl.signal,
      });
      const incomingRaw = (res?.items || []).map(normalizeOrder);
      const incoming = (() => {
        if (!statusKey) return incomingRaw;
        if (statusKey === 'failed') return incomingRaw.filter((o) => paidLabel(o) === 'Failed');
        if (statusKey === 'pending') return incomingRaw.filter((o) => paidLabel(o) === 'Pending');
        if (statusKey === 'will_pay_offline') return incomingRaw.filter((o) => paidLabel(o) === 'Will Pay Offline');
        return incomingRaw;
      })();
      setItems((prev) => {
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
      setMeta(res?.meta || { page: nextPage, totalPages: 1, total: null });
      setPage(nextPage);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load orders', 'error');
    } finally {
      if (append) setMoreLoading(false);
      else setLoading(false);
    }
  };

  const closeDetails = () => {
    if (detailsLoading) return;
    setDetailsOpen(false);
  };

  const extractOrderItems = (order) => {
    const raw =
      order?.items ??
      order?.orderItems ??
      order?.order_items ??
      order?.products ??
      order?.lines ??
      order?.data ??
      [];
    return Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
  };

  const itemName = (it) => {
    const p = it?.product ?? it?.productDetails ?? it?.productSnapshot ?? it?.item ?? null;
    return (
      p?.name ??
      it?.productName ??
      it?.name ??
      it?.title ??
      'Product'
    );
  };

  const itemQty = (it) => {
    const q = it?.quantity ?? it?.qty ?? it?.count ?? 1;
    const n = Number(q);
    if (Number.isNaN(n) || n <= 0) return 1;
    return Math.floor(n);
  };

  const itemUnitPrice = (it) => {
    const p = it?.product ?? it?.productDetails ?? it?.productSnapshot ?? it?.item ?? null;
    const v = it?.price ?? it?.unitPrice ?? it?.unit_price ?? p?.price ?? 0;
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return n;
  };

  const setDraft = (productId, patch) => {
    const key = String(productId);
    setReviewDrafts((prev) => ({
      ...(prev || {}),
      [key]: {
        ...(prev?.[key] || { rating: 0, comment: '', isAnonymous: false, submitting: false, hasReview: false, reviewId: null }),
        ...(patch || {}),
      },
    }));
  };

  const normalizeOrderReviewItems = (raw) => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr
      .map((x) => ({
        product: x?.product ?? x?.item ?? x?.data?.product ?? null,
        review: x?.review ?? x?.data?.review ?? null,
      }))
      .filter((x) => x.product);
  };

  const loadOrderReviews = async ({ orderId, signal } = {}) => {
    if (!orderId) return [];
    const res = await productService.getOrderReviews(orderId, { signal });
    return normalizeOrderReviewItems(res);
  };

  const submitReview = async (productId) => {
    const key = String(productId);
    const d = reviewDrafts?.[key];
    const rating = Number(d?.rating || 0);
    const comment = String(d?.comment ?? '').trim() || undefined;
    const isAnonymous = Boolean(d?.isAnonymous);
    if (!productId) return;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      addToast('Please select a rating (1–5).', 'error');
      return;
    }
    if (d?.submitting) return;
    setDraft(productId, { submitting: true });
    try {
      await productService.submitProductReview({ productId, rating, comment, isAnonymous });
      addToast(d?.hasReview ? 'Review updated' : 'Review submitted', 'success');
      // Refresh order reviews so UI shows Submit/Update correctly.
      if (detailsFor?.internalId) {
        const items = await loadOrderReviews({ orderId: detailsFor.internalId });
        setOrderReviewItems(items);
        const nextDrafts = {};
        for (const it of items) {
          const pid = it?.product?.id ?? it?.product?._id ?? it?.product?.productId ?? null;
          if (!pid) continue;
          nextDrafts[String(pid)] = {
            rating: Number(it?.review?.rating || 0) || 0,
            comment: String(it?.review?.comment ?? ''),
            isAnonymous: Boolean(it?.review?.isAnonymous),
            submitting: false,
            hasReview: Boolean(it?.review),
            reviewId: it?.review?.id ?? it?.review?._id ?? null,
          };
        }
        setReviewDrafts(nextDrafts);
      } else {
        setDraft(productId, { submitting: false, hasReview: true });
      }
    } catch (e) {
      addToast(e?.message || 'Failed to submit review', 'error');
      setDraft(productId, { submitting: false });
    }
  };

  const openDetails = async ({ internalId, displayId }) => {
    if (!internalId) {
      addToast('Order details not available for this order.', 'error');
      return;
    }
    if (abortDetailsRef.current) abortDetailsRef.current.abort();
    const ctrl = new AbortController();
    abortDetailsRef.current = ctrl;
    setDetailsFor({ internalId, displayId });
    setDetailsOrder(null);
    setReviewDrafts({});
    setOrderReviewItems([]);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setOrderReviewLoading(false);
    try {
      const orderRes = await orderService.getById(internalId, { signal: ctrl.signal });
      setDetailsOrder(orderRes || null);

      const statusRaw = String(orderRes?.status ?? orderRes?.orderStatus ?? orderRes?.order_status ?? '')
        .trim()
        .toLowerCase();
      const isDelivered = statusRaw === 'delivered';
      if (isDelivered) {
        setOrderReviewLoading(true);
        const reviewItems = await loadOrderReviews({ orderId: internalId, signal: ctrl.signal });
        setOrderReviewItems(reviewItems);

        const nextDrafts = {};
        for (const it of reviewItems) {
          const pid = it?.product?.id ?? it?.product?._id ?? it?.product?.productId ?? null;
          if (!pid) continue;
          nextDrafts[String(pid)] = {
            rating: Number(it?.review?.rating || 0) || 0,
            comment: String(it?.review?.comment ?? ''),
            isAnonymous: Boolean(it?.review?.isAnonymous),
            submitting: false,
            hasReview: Boolean(it?.review),
            reviewId: it?.review?.id ?? it?.review?._id ?? null,
          };
        }
        setReviewDrafts(nextDrafts);
      }
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load order details', 'error');
      setDetailsOrder(null);
    } finally {
      setDetailsLoading(false);
      setOrderReviewLoading(false);
    }
  };

  useEffect(() => {
    load({ nextPage: 1, append: false });
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (abortDetailsRef.current) abortDetailsRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    const next = {
      status: String(filterDraft?.status || '').trim(),
      from: String(filterDraft?.from || '').trim(),
      to: String(filterDraft?.to || '').trim(),
      productName: String(filterDraft?.productName || '').trim(),
    };
    setFilters(next);
    await load({ nextPage: 1, append: false, filterParams: next });
  };

  const clearFilters = async () => {
    const empty = { status: '', from: '', to: '', productName: '' };
    setFilterDraft(empty);
    setFilters(empty);
    await load({ nextPage: 1, append: false, filterParams: empty });
  };

  const totalPages = Number(meta?.totalPages || 1) || 1;
  const canLoadMore = page < totalPages;

  const empty = !loading && (items || []).length === 0;

  const cancelAllowed = (o) => {
    const s = String(o?.status ?? '').toLowerCase();
    if (['cancelled', 'delivered', 'completed'].includes(s)) return false;
    const pay = paidLabel(o);
    if (pay === 'Failed') return false;
    return true;
  };

  const onCancel = async (o) => {
    const id = localOrderIdOf(o);
    if (!id) return;
    setActingId(String(id));
    try {
      await orderService.cancel(id);
      addToast('Order cancelled', 'success');
      await load({ nextPage: 1, append: false });
    } catch (e) {
      addToast(e?.message || 'Failed to cancel order', 'error');
    } finally {
      setActingId(null);
    }
  };

  const onInvoice = async (o) => {
    const id = localOrderIdOf(o);
    if (!id) return;
    setActingId(String(id));
    try {
      await orderService.downloadInvoice(id);
      addToast('Invoice downloaded', 'success');
    } catch (e) {
      addToast(e?.message || 'Failed to download invoice', 'error');
    } finally {
      setActingId(null);
    }
  };

  const headerRight = useMemo(() => {
    const t = meta?.total;
    if (t == null) return null;
    return (
      <div className="text-[12px] font-semibold text-gray-400">
        Total: <span className="text-gray-700">{t}</span>
      </div>
    );
  }, [meta?.total]);

  return (
    <div className="w-full h-[calc(100dvh-60px)] lg:h-[calc(100dvh-128px)] flex flex-col">
      {/* Top header card (title + count) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[16px] md:text-[18px] font-bold text-gray-900">My Orders</p>
            <p className="text-[12px] text-gray-400 mt-1">Track status, cancel, and download invoices.</p>
          </div>
          {headerRight}
        </div>
      </div>

      {/* Orders container */}
      <div className="flex-1 min-h-0 flex flex-col pb-[60px] md:pb-0">
        <div className="mt-3 bg-white rounded-2xl border border-gray-100 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 sticky top-0 z-10 bg-white border-b border-gray-100 p-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-left text-[13px] font-bold text-gray-800 flex items-center justify-between gap-3"
              >
                <span className="truncate">Filters</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>

            <div className={`${filtersOpen ? 'block' : 'hidden'} md:block mt-3 md:mt-0`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <p className="text-[11px] font-bold text-gray-600 mb-1">Status</p>
                  <select
                    value={filterDraft.status}
                    onChange={(e) =>
                      setFilterDraft((p) => ({ ...(p || {}), status: e.target.value }))
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
                    value={filterDraft.from}
                    onChange={(e) =>
                      setFilterDraft((p) => ({ ...(p || {}), from: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 focus:outline-none focus:border-primary-dark"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold text-gray-600 mb-1">To</p>
                  <input
                    type="date"
                    value={filterDraft.to}
                    onChange={(e) =>
                      setFilterDraft((p) => ({ ...(p || {}), to: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 focus:outline-none focus:border-primary-dark"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold text-gray-600 mb-1">Product name</p>
                  <input
                    value={filterDraft.productName}
                    onChange={(e) =>
                      setFilterDraft((p) => ({ ...(p || {}), productName: e.target.value }))
                    }
                    placeholder="Type product name…"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[13px] font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary-dark"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={loading || moreLoading}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={loading || moreLoading}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-primary-dark text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 md:p-14 flex items-center justify-center">
            <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : empty ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 md:p-14 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                </svg>
              </div>
              <p className="mt-4 text-[14px] font-bold text-gray-900">No orders yet</p>
              <p className="mt-1 text-[12px] text-gray-500">
                {filters?.status || filters?.from || filters?.to || filters?.productName
                  ? 'No orders match your filters.'
                  : 'Shop products and place an order to see it here.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/shopping')}
                className="mt-4 inline-flex px-4 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Go to shop
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((o) => {
              const internalId = localOrderIdOf(o);
              const displayId = orderCodeOf(o);
              const idForActions = internalId ?? displayId ?? '';
              const idLabel = displayId ?? internalId ?? '';
              const total = o?.totalAmount ?? o?.total ?? o?.amount ?? o?.grandTotal ?? null;
              const whenRaw = o?.createdAt ?? o?.created_at ?? o?.date ?? null;
              const when = whenRaw ? new Date(whenRaw) : null;
              const whenText = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : '';
              const pay = paidLabel(o);
              const st = statusText(o);
              const statusRaw = String(o?.status ?? o?.orderStatus ?? o?.order_status ?? '').trim().toLowerCase();
              const canDispute = statusRaw === 'delivered';
              const showStatusChip = (() => {
                if (!st || st === '—') return false;
                const stLower = String(st).trim().toLowerCase();
                // Hide internal payment pipeline statuses; Paid/Unpaid chip already covers these.
                if (['pending payment', 'offline due', 'partial due', 'paid'].includes(stLower)) return false;
                if (!pay) return true;
                return stLower !== String(pay).trim().toLowerCase();
              })();
              const statusChipClass =
                statusRaw === 'cancelled'
                  ? 'bg-red-50 border-red-100 text-red-600'
                  : 'bg-gray-50 border-gray-100 text-gray-600';
              const busy = actingId != null && String(actingId) === String(idForActions);
              return (
                <div key={String(idForActions || Math.random())} className="rounded-2xl border border-gray-100 p-4">
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
                        onClick={() => openDetails({ internalId, displayId: idLabel })}
                        disabled={busy}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => onInvoice({ ...o, id: idForActions })}
                        disabled={busy}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Invoice
                      </button>
                      {canDispute ? (
                        <button
                          type="button"
                          onClick={() => {
                            const msg = `Hi Support, I want to raise a dispute for Order ${String(idLabel)}. Please help.`;
                            navigate('/dashboard/messages', { state: { openSupport: true, supportPrefill: msg } });
                          }}
                          disabled={busy}
                          className="px-3 py-2 rounded-xl bg-white border border-gray-100 text-[12px] font-bold text-primary-dark hover:bg-gray-50 disabled:opacity-50"
                        >
                          Raise dispute
                        </button>
                      ) : null}
                      {cancelAllowed(o) ? (
                        <button
                          type="button"
                          onClick={() => onCancel({ ...o, id: idForActions })}
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

            {canLoadMore ? (
              <button
                type="button"
                onClick={() => load({ nextPage: page + 1, append: true })}
                disabled={moreLoading}
                className="mt-2 w-full py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {moreLoading ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        )}
        </div>
      </div>
      </div>

      {/* Order details modal */}
      {detailsOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end md:items-center justify-center px-3 md:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={closeDetails}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-gray-900">Order details</p>
                <p className="text-[12px] text-gray-400 mt-1 truncate">
                  Order #{String(detailsFor?.displayId ?? detailsFor?.internalId ?? '')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                disabled={detailsLoading}
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
              {detailsLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                  <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : !detailsOrder ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[13px] text-gray-600">
                  Unable to load order details.
                </div>
              ) : (
                <>
                  {String(detailsOrder?.status ?? detailsOrder?.orderStatus ?? detailsOrder?.order_status ?? '')
                    .trim()
                    .toLowerCase() === 'delivered' ? (
                    <div className="mb-4 rounded-2xl border border-green-100 bg-green-50 p-4 text-[12px] text-green-800 font-semibold">
                      Your order is delivered. You can rate and review each product below.
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-gray-100 p-4">
                    <p className="text-[12px] font-extrabold text-gray-900">Products</p>
                    <div className="mt-3 space-y-3">
                      {extractOrderItems(detailsOrder).map((it, idx) => {
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

                  {String(detailsOrder?.status ?? detailsOrder?.orderStatus ?? detailsOrder?.order_status ?? '')
                    .trim()
                    .toLowerCase() === 'delivered' ? (
                    <div className="mt-4 rounded-2xl border border-gray-100 p-4">
                      <p className="text-[12px] font-extrabold text-gray-900">Reviews</p>
                      <p className="mt-1 text-[11px] text-gray-400">Rate products from this order. You can update anytime.</p>

                      {orderReviewLoading ? (
                        <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-10 flex items-center justify-center">
                          <svg className="animate-spin text-primary-dark" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                        </div>
                      ) : orderReviewItems.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-[12px] text-gray-600">
                          No reviewable products found for this order.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {orderReviewItems.map((x, idx) => {
                          const p = x?.product || {};
                          const pid = p?.id ?? p?._id ?? p?.productId ?? null;
                          const key = pid != null ? String(pid) : null;
                          const draft = key ? reviewDrafts?.[key] : null;
                          const img = Array.isArray(p?.images) && p.images[0] ? p.images[0] : null;
                          return (
                            <div key={String(pid ?? idx)} className="rounded-2xl border border-gray-100 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                                    <SafeImage src={img} alt="" className="w-full h-full object-contain p-1 bg-white" loading="lazy" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-bold text-gray-900 truncate">{p?.name || 'Product'}</p>
                                    {draft?.hasReview ? (
                                      <p className="mt-1 text-[11px] text-gray-400">Already reviewed • Update anytime</p>
                                    ) : (
                                      <p className="mt-1 text-[11px] text-gray-400">Not reviewed yet</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 border-t border-gray-100 pt-4">
                                <p className="text-[11px] font-extrabold text-gray-700">Your rating</p>
                                <div className="mt-2 inline-flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => {
                                    const val = i + 1;
                                    const filled = val <= Number(draft?.rating || 0);
                                    return (
                                      <button
                                        key={String(val)}
                                        type="button"
                                        onClick={() => pid && setDraft(pid, { rating: val })}
                                        disabled={Boolean(draft?.submitting)}
                                        className={`p-1 rounded-md ${filled ? 'text-amber-400' : 'text-gray-200'} disabled:opacity-50`}
                                        aria-label={`Rate ${val} star${val === 1 ? '' : 's'}`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2Z" />
                                        </svg>
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="mt-3">
                                  <textarea
                                    value={draft?.comment ?? ''}
                                    onChange={(e) => pid && setDraft(pid, { comment: e.target.value })}
                                    disabled={Boolean(draft?.submitting)}
                                    rows={3}
                                    className="mt-1 w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-[12px] font-medium text-gray-700 focus:outline-none focus:border-primary-dark disabled:opacity-60"
                                    placeholder="Review (optional)"
                                  />
                                </div>

                                <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-semibold text-gray-700 select-none">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(draft?.isAnonymous)}
                                    onChange={(e) => pid && setDraft(pid, { isAnonymous: e.target.checked })}
                                    disabled={Boolean(draft?.submitting)}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-dark focus:ring-primary-dark/30"
                                  />
                                  Post as anonymous
                                </label>

                                <div className="mt-3 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => pid && submitReview(pid)}
                                    disabled={Boolean(draft?.submitting)}
                                    className="px-4 py-2 rounded-xl bg-primary-dark text-white text-[12px] font-extrabold hover:opacity-90 disabled:opacity-50"
                                  >
                                    {draft?.submitting ? 'Saving…' : draft?.hasReview ? 'Update' : 'Submit'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-gray-100 p-4">
                    <p className="text-[12px] font-extrabold text-gray-900">Amount</p>
                    <div className="mt-3 space-y-2 text-[12px]">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Total</span>
                        <span className="font-extrabold text-gray-900">
                          ₹{formatMoney(detailsOrder?.totalAmount ?? detailsOrder?.total ?? detailsOrder?.amount ?? detailsOrder?.grandTotal ?? 0)}
                        </span>
                      </div>
                      {detailsOrder?.amountDue != null || detailsOrder?.amount_due != null ? (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Amount due</span>
                          <span className="font-extrabold text-gray-900">
                            ₹{formatMoney(detailsOrder?.amountDue ?? detailsOrder?.amount_due ?? 0)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="button"
                onClick={closeDetails}
                disabled={detailsLoading}
                className="px-4 py-2 rounded-xl border border-gray-100 text-[12px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

