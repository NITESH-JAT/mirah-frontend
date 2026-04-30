import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { authService } from '../../services/authService';
import logo from '../../assets/logo.png';
import { cartService } from '../../services/cartService';
import SafeImage from '../SafeImage';
import { priceForCartLine } from '../../utils/cartVariant';
import { formatMoney } from '../../utils/formatMoney';

// --- TOAST NOTIFICATION COMPONENT ---
const ToastNotification = ({ id, message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 400); 
  };

  useEffect(() => {
    let closeTimer = null;
    const timer = setTimeout(() => {
      setIsExiting(true);
      closeTimer = setTimeout(() => onClose(id), 400);
    }, 10000);
    return () => {
      clearTimeout(timer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [id, onClose]);

  const isError = type === 'error';

  return (
    <div className={`
      relative w-[320px] bg-white rounded-xl border border-pale p-4 mb-3 flex gap-3 items-start transition-all pointer-events-auto
      ${isError ? 'border-l-4 border-l-red-300' : 'border-l-4 border-l-emerald-400'}
      ${isExiting ? 'animate-fade-out' : 'animate-slide-in'}
    `}>
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${isError ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
        {isError ? (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" /></svg>
        ) : (
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
        )}
      </div>
      <div className="flex-1 pt-0.5">
        <h4 className={`font-serif text-[15px] font-bold leading-none mb-1 ${isError ? 'text-red-700' : 'text-ink'}`}>
          {isError ? 'Error' : 'Success'}
        </h4>
        <p className="text-muted font-sans text-[13px] leading-snug">{message}</p>
      </div>
      <button onClick={handleClose} className="shrink-0 text-muted hover:text-muted transition-colors cursor-pointer p-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
      </button>
    </div>
  );
};

function formatNoticeDateTime(n) {
  const raw =
    n?.createdAt ??
    n?.created_at ??
    n?.timestamp ??
    n?.time ??
    n?.date ??
    n?.updatedAt ??
    n?.updated_at ??
    null;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}





function initialsForUser(u) {
  const first = String(u?.firstName ?? '').trim();
  const last = String(u?.lastName ?? '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first) return first.slice(0, 1).toUpperCase();
  const email = String(u?.email ?? '').trim();
  if (email.length >= 2) return email.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 1).toUpperCase();
  return 'U';
}

function roleLabelForUser(u) {
  const t = String(u?.userType ?? '').trim().toLowerCase();
  if (t === 'vendor' || t === 'jeweller') return 'Jeweller';
  if (t === 'customer') return 'Customer';
  if (t) return t.charAt(0).toUpperCase() + t.slice(1);
  return 'Guest';
}

function normalizeYouTubeForIframe(url) {
  try {
    const u = new URL(url);
    const host = String(u.hostname || '').toLowerCase();

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
    }

    // youtube.com/watch?v=<id>
    if (host.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
      }
      // youtube.com/shorts/<id>
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/').filter(Boolean)[0] === 'shorts' ? u.pathname.split('/').filter(Boolean)[1] : null;
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : url;
      }
      // already embed
      if (u.pathname.startsWith('/embed/')) return url;
    }

    return url;
  } catch {
    return url;
  }
}

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser, setUser: setCurrentUser, logout } = useAuth();
  const path = location.pathname;
  const isProfilePage = path.includes('profile');
  const isFaqPage = path.includes('faq');
  const isMessagesPage = path.includes('messages');
  const isKycPage = path.includes('/vendor/kyc');
  const isShopPage = path.includes('/vendor/shop');
  const isVendorGuidelinesPage =
    path.startsWith('/vendor/diamond-guidelines') || path === '/vendor/guidelines';
  const isVendorExplorePage = path.includes('/vendor/explore');
  const isVendorBidsPage = path.includes('/vendor/bids');
  const isVendorProjectsPage = path.includes('/vendor/projects');
  const isVendorReviewsPage = path.includes('/vendor/reviews');
  const isShoppingPage = path.includes('/customer/shopping');
  const isShoppingListPage = path === '/customer/shopping';
  const isCartPage = path.includes('/customer/cart');
  const isCheckoutPage = path.includes('/customer/checkout');
  const isOrdersPage = path.includes('/customer/orders');
  const isCustomerOrdersListPage = path === '/customer/orders';
  const isProjectsPage = path.includes('/customer/projects');
  const isCustomerProjectsListPage = path === '/customer/projects';
  /** Nested routes (detail, bids, etc.) — match vendor Explore: no top padding on scroll area; page sets pt. */
  const isCustomerProjectDetailPage = path.startsWith('/customer/projects/');
  const isVendorProfileViewPage = path.startsWith('/customer/vendors/');
  const isVendor = currentUser?.userType === 'vendor' || currentUser?.userType === 'jeweller';
  const kycStatus = String(currentUser?.kyc?.status || '').toLowerCase();
  const kycAccepted = kycStatus === 'accepted';

  const headerTitle = useMemo(() => {
    if (isProfilePage) return 'My Profile';
    if (isFaqPage) return 'FAQ';
    if (isMessagesPage) return 'Messages';
    if (isKycPage) return 'KYC';
    if (isVendorGuidelinesPage) return 'Diamond Guide';
    if (isShopPage) return 'Store';
    if (isVendorBidsPage) return path.startsWith('/vendor/bids/') ? 'Biddings' : 'Bids';
    if (isVendorExplorePage) return path.startsWith('/vendor/explore/') ? 'Project' : 'Explore Projects';
    if (isVendorReviewsPage) return 'Reviews';
    if (isVendorProjectsPage) return 'My Projects';
    if (isCartPage) return 'Cart';
    if (isCheckoutPage) return 'Checkout';
    if (isOrdersPage) return 'My Orders';
    if (isShoppingPage) return 'Shop';
    if (isProjectsPage) return 'My Projects';
    return '';
  }, [
    isCartPage,
    isCheckoutPage,
    isKycPage,
    isMessagesPage,
    isOrdersPage,
    isProfilePage,
    isProjectsPage,
    isShopPage,
    isVendorGuidelinesPage,
    isShoppingPage,
    isVendorBidsPage,
    isVendorExplorePage,
    isVendorProjectsPage,
    isVendorReviewsPage,
    isFaqPage,
    path,
  ]);
  
  const [toasts, setToasts] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [projectTutorialOpen, setProjectTutorialOpen] = useState(false);
  const [projectTutorialVideoUrl, setProjectTutorialVideoUrl] = useState(null);
  const [projectTutorialLoading, setProjectTutorialLoading] = useState(false);
  const projectTutorialCheckKeyRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [cartDrawerLoading, setCartDrawerLoading] = useState(false);
  const [cartDrawerItems, setCartDrawerItems] = useState([]);
  const [cartSelected, setCartSelected] = useState(() => new Set());
  const cartDrawerAbortRef = useRef(null);
  const cartMutatingRef = useRef(false);
  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);

  // --- NOTIFICATION HANDLER ---
  const addToast = useCallback((message, type = 'success') => {
    const raw = typeof message === 'string' ? message : (message?.message || String(message || ''));
    const cleaned = raw.replace(/\s+/g, ' ').trim();

    // Avoid leaking raw axios errors like: "Request failed with status code 403"
    const isAxiosStatusLine = /^Request failed with status code \d+$/i.test(cleaned);
    const isServerErrorText =
      /internal server error/i.test(cleaned) ||
      /^request failed with status code 5\d\d$/i.test(cleaned) ||
      /\b5\d\d\b/.test(cleaned) && /status code/i.test(cleaned);
    const finalMessage =
      isServerErrorText
        ? 'Something went wrong on our side. Please try again.'
        : isAxiosStatusLine
          ? 'Request failed, try again later'
          : cleaned;

    const id = Date.now();
    setToasts(prev => [...prev, { id, message: finalMessage, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const outletContext = useMemo(
    () => ({ addToast, currentUser, setCurrentUser }),
    [addToast, currentUser, setCurrentUser]
  );

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(Number(count) || 0);
    } catch {
      // ignore badge failures
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const items = await notificationService.list({ page: 1, limit: 10, unreadOnly: false });
      setNotifications(items);
    } catch (e) {
      addToast(e?.message || 'Failed to load notifications', 'error');
    } finally {
      setNotifLoading(false);
    }
  }, [addToast]);

  // --- CLICK OUTSIDE ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [location.pathname]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname, location.search]);

  // When mobile sidenav is opened, close dropdowns and prevent them from staying open.
  useEffect(() => {
    if (!isSidebarOpen) return;
    setShowUserMenu(false);
    setShowNotifications(false);
  }, [isSidebarOpen]);

  useEffect(() => {
    // On app start and periodically (PRD)
    refreshUnreadCount();
    const t = setInterval(refreshUnreadCount, 60000);
    return () => clearInterval(t);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!showNotifications) return;
    loadNotifications().then(refreshUnreadCount);
  }, [showNotifications, loadNotifications, refreshUnreadCount]);

  // --- PROJECT TUTORIAL VIDEO MODAL (customer + vendor) ---
  useEffect(() => {
    const userId = currentUser?.id ?? currentUser?._id ?? null;
    if (!userId) return;

    const canShow = !isVendor || kycAccepted;
    if (!canShow) return;

    const targetKey = isVendor ? 'vendor' : 'customer';
    const checkKey = `${userId}:${targetKey}`;
    if (projectTutorialCheckKeyRef.current === checkKey) return;
    projectTutorialCheckKeyRef.current = checkKey;

    let cancelled = false;
    setProjectTutorialLoading(true);

    authService
      .getProjectTutorialSeen()
      .then((res) => {
        if (cancelled) return;
        if (!res?.hasSeen && res?.videoUrl) {
          setProjectTutorialVideoUrl(res.videoUrl);
          setProjectTutorialOpen(true);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        addToast(e?.message || 'Failed to load project tutorial', 'error');
      })
      .finally(() => {
        if (cancelled) return;
        setProjectTutorialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast, currentUser?.id, currentUser?._id, isVendor, kycAccepted]);

  const cartItemCountOf = useCallback((rawItems) => {
    const arr = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    return arr.reduce((sum, it) => {
      const q = Number(it?.quantity ?? it?.qty ?? it?.count ?? 1);
      const n = Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
      return sum + n;
    }, 0);
  }, []);

  const normalizeCartItems = useCallback((rawItems) => {
    const arr = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    return arr
      .map((it) => {
        const product = it?.product ?? it?.productDetails ?? it?.productData ?? it?.item ?? it ?? {};
        const cartItemId = it?.cartItemId ?? it?.cart_item_id ?? it?.id ?? it?._id ?? null;
        const productId =
          it?.productId ??
          it?.product_id ??
          product?.id ??
          product?._id ??
          null;
        const variantsRaw = it?.variants;
        const variants =
          variantsRaw && typeof variantsRaw === 'object' && !Array.isArray(variantsRaw)
            ? {
                type: variantsRaw?.type ?? undefined,
                size: variantsRaw?.size ?? undefined,
                sizeDimensions: variantsRaw?.sizeDimensions ?? variantsRaw?.size_dimensions ?? undefined,
                sizeDimensionsUnit: variantsRaw?.sizeDimensionsUnit ?? variantsRaw?.size_dimensions_unit ?? undefined,
              }
            : undefined;
        const stableVariantsKey = variants
          ? ['type', 'size', 'sizeDimensions', 'sizeDimensionsUnit']
              .map((k) => `${k}=${String(variants?.[k] ?? '')}`)
              .join('&')
          : '';
        const rowKey =
          cartItemId != null ? `ci:${String(cartItemId)}` : `p:${String(productId)}|v:${stableVariantsKey}`;
        const quantityRaw = Number(it?.quantity ?? it?.qty ?? it?.count ?? 1);
        const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
        return { raw: it, product, cartItemId, productId, variants, quantity, rowKey };
      })
      .filter((x) => x.productId != null);
  }, []);

  const variantTextOf = useCallback((variants) => {
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
  }, []);

  const providerKeyForCartItem = useCallback((item, product) => {
    const vendorId =
      product?.vendorId ??
      product?.vendor_id ??
      product?.vendor?.id ??
      product?.vendor?._id ??
      item?.vendorId ??
      item?.vendor_id ??
      null;
    return vendorId ? `vendor:${vendorId}` : 'admin';
  }, []);

  const cartAllSelected = useMemo(() => {
    if (!cartDrawerItems.length) return false;
    return cartDrawerItems.every((x) => cartSelected.has(String(x.rowKey)));
  }, [cartDrawerItems, cartSelected]);

  const cartSelectedIds = useMemo(() => {
    return cartDrawerItems
      .map((x) => String(x.rowKey))
      .filter((id) => cartSelected.has(id));
  }, [cartDrawerItems, cartSelected]);

  const cartSelectedProviderOk = useMemo(() => {
    if (cartSelectedIds.length <= 1) return true;
    const keys = new Set();
    for (const it of cartDrawerItems) {
      const id = String(it.rowKey);
      if (!cartSelected.has(id)) continue;
      keys.add(providerKeyForCartItem(it.raw, it.product));
    }
    return keys.size <= 1;
  }, [cartDrawerItems, cartSelected, cartSelectedIds.length, providerKeyForCartItem]);

  const toggleCartSelectAll = useCallback(() => {
    setCartSelected(() => {
      if (cartAllSelected) return new Set();
      return new Set(cartDrawerItems.map((x) => String(x.rowKey)));
    });
  }, [cartAllSelected, cartDrawerItems]);

  const toggleCartSelectOne = useCallback((rowKey) => {
    const id = String(rowKey);
    setCartSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const refreshCartCount = useCallback(async () => {
    if (isVendor) return;
    try {
      const res = await cartService.getCart();
      setCartCount(cartItemCountOf(res?.items || []));
    } catch {
      // ignore badge failures
    }
  }, [cartItemCountOf, isVendor]);

  const loadCartDrawer = useCallback(async () => {
    if (isVendor) return;
    if (cartDrawerAbortRef.current) cartDrawerAbortRef.current.abort();
    const ctrl = new AbortController();
    cartDrawerAbortRef.current = ctrl;
    setCartDrawerLoading(true);
    try {
      const res = await cartService.getCart({ signal: ctrl.signal });
      const list = normalizeCartItems(res?.items || []);
      setCartDrawerItems(list);
      // default: select all when drawer loads (and keep selection for existing items)
      setCartSelected((prev) => {
        const allowed = new Set(list.map((x) => String(x.rowKey)));
        const kept = new Set();
        for (const id of prev) {
          if (allowed.has(String(id))) kept.add(String(id));
        }
        if (kept.size) return kept;
        return new Set(list.map((x) => String(x.rowKey)));
      });
      setCartCount(cartItemCountOf(res?.items || []));
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      addToast(e?.message || 'Failed to load cart', 'error');
    } finally {
      setCartDrawerLoading(false);
    }
  }, [addToast, cartItemCountOf, isVendor, normalizeCartItems]);

  const closeCartDrawer = useCallback(() => {
    if (cartDrawerAbortRef.current) cartDrawerAbortRef.current.abort();
    setCartDrawerOpen(false);
  }, []);

  useEffect(() => {
    refreshCartCount();
    const onUpdated = () => {
      refreshCartCount();
      if (cartDrawerOpen) loadCartDrawer();
    };
    window.addEventListener('mirah_cart_updated', onUpdated);
    window.addEventListener('storage', onUpdated);
    return () => {
      window.removeEventListener('mirah_cart_updated', onUpdated);
      window.removeEventListener('storage', onUpdated);
    };
  }, [cartDrawerOpen, loadCartDrawer, refreshCartCount]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleProjectTutorialGotIt = async () => {
    try {
      setProjectTutorialLoading(true);
      await authService.markProjectTutorialSeen();
      setProjectTutorialOpen(false);
      setProjectTutorialVideoUrl(null);
      addToast('Tutorial seen.', 'success');
    } catch (e) {
      addToast(e?.message || 'Failed to mark tutorial as seen', 'error');
    } finally {
      setProjectTutorialLoading(false);
    }
  };

  // --- STYLES ---
  const globalStyles = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    .animate-slide-in { animation: slideIn 0.4s ease-out forwards; }
    .animate-fade-out { animation: fadeOut 0.4s ease-out forwards; }
  `;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-row overflow-hidden bg-cream font-sans relative">
      <style>{globalStyles}</style>

      {/* TOAST CONTAINER */}
      <div className="fixed top-6 right-6 z-[260] flex flex-col items-end pointer-events-none">
         {toasts.map(toast => (
            <ToastNotification 
                key={toast.id} 
                id={toast.id} 
                message={toast.message} 
                type={toast.type} 
                onClose={removeToast} 
            />
         ))}
      </div>
      
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/25 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Desktop-only centered logo across sidebar + main header width */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 top-0 h-16 items-center pointer-events-none z-[45]">
        <img src={logo} alt="Arviah" className="w-18 h-18 object-contain" />
      </div>

      {/* Main Content Wrapper */}
      <div className="relative ml-0 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col lg:ml-[240px]">

        {/* HEADER */}
      <div className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-pale bg-white px-4 sm:px-8 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                setShowNotifications(false);
                setIsSidebarOpen(true);
              }}
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-cream text-mid transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>
            {headerTitle ? (
              <h1 className="hidden sm:block lg:hidden font-serif text-xl font-bold text-ink truncate max-w-[60vw]">
                {headerTitle}
              </h1>
            ) : null}
          </div>

          {/* Desktop-only center branding moved to outer layout */}
          
          <div className="flex items-center gap-2 sm:gap-3 relative">
            {/* Cart icon (customer) — circular, subtle border */}
            {!isVendor ? (
              <button
                type="button"
                onClick={() => {
                  if (isSidebarOpen) return;
                  setShowUserMenu(false);
                  setShowNotifications(false);
                  setCartDrawerOpen(true);
                  loadCartDrawer();
                }}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-pale bg-white text-ink transition-colors hover:bg-blush/60 cursor-pointer"
                aria-label="Cart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-walnut text-[10px] font-bold leading-[18px] text-center text-white">
                  {Number(cartCount) || 0}
                </span>
              </button>
            ) : null}

            {/* NOTIFICATIONS — circular, matches cart */}
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (isSidebarOpen) return; // sidenav open: disable top nav dropdowns
                  setShowNotifications((v) => !v);
                }}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-pale bg-white text-ink transition-colors hover:bg-blush/60 cursor-pointer"
                aria-label="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-walnut" title="Unread" />
                )}
              </button>

              {showNotifications && (
                <div
                  className="fixed left-4 right-4 top-[72px] w-auto bg-white rounded-2xl shadow-sm border border-pale overflow-hidden z-[60]
                             sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px] sm:max-w-[90vw]"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-pale flex items-center justify-between">
                    <p className="text-[13px] font-bold text-ink">Notifications</p>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-muted">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
                    </div>
                  </div>

                  <div className="max-h-[min(420px,calc(100vh-120px))] overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-4 text-[13px] text-muted">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-[13px] text-muted">No notifications</div>
                    ) : (
                      notifications.map((n) => {
                        const id = n.id ?? n._id;
                        const title = n.title ?? n.subject ?? n.type ?? 'Notification';
                        const message = n.message ?? n.body ?? n.text ?? '';
                        const isRead = Boolean(n.isRead ?? n.read ?? n.readAt);
                        const when = formatNoticeDateTime(n);
                        return (
                          <div
                            key={String(id)}
                            className="w-full text-left px-4 py-3 border-b border-pale hover:bg-cream transition-colors"
                            role="button"
                            tabIndex={0}
                            onClick={async () => {
                              if (notifLoading) return;
                              if (isRead || !id) return;
                              try {
                                await notificationService.markRead(id);
                                await refreshUnreadCount();
                                await loadNotifications();
                              } catch (err) {
                                addToast(err?.message || 'Failed to mark notification as read', 'error');
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.currentTarget.click();
                              }
                            }}
                          >
                            <div className="flex gap-3 items-start">
                              <div className={`mt-1 w-2 h-2 rounded-full ${isRead ? 'bg-transparent' : 'bg-red-500'}`} />
                              <div className="flex-1">
                                <p className="text-[13px] font-bold text-ink">{title}</p>
                                {message && (
                                  <p className="text-[12px] text-muted mt-0.5 ">{message}</p>
                                )}
                                {when ? (
                                  <p className="text-[11px] text-muted mt-1">{when}</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* USER MENU — pill: initials + role label */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                className="flex max-w-[200px] items-center gap-2.5 rounded-full border border-pale bg-white py-1 pl-1 pr-3 sm:pr-4 text-left transition-colors hover:bg-blush/50 cursor-pointer"
                onClick={() => {
                  if (isSidebarOpen) return; // sidenav open: disable top nav dropdowns
                  setShowUserMenu(!showUserMenu);
                }}
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
                aria-label="Account menu"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush font-sans text-[12px] font-bold tracking-tight text-ink">
                  {initialsForUser(currentUser)}
                </span>
                <span className="min-w-0 truncate font-sans text-[13px] font-medium text-ink">
                  {roleLabelForUser(currentUser)}
                </span>
              </button>

             {/* PROFILE DROPDOWN */}
             {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 min-w-[11rem] w-44 bg-white rounded-xl shadow-sm border border-pale py-2 overflow-hidden animate-slide-in">
                    <button 
                        onClick={() => {
                          const profilePath = isVendor ? '/vendor/profile' : '/customer/profile';
                          navigate(profilePath);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-mid hover:bg-cream font-medium flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profile
                    </button>
                    {isVendor ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/vendor/reviews');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-mid hover:bg-cream font-medium flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        View Reviews
                      </button>
                    ) : null}
                    {!isVendor ? (
                      <button
                        onClick={() => {
                          navigate('/customer/orders');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-mid hover:bg-cream font-medium flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M8 13h8" />
                          <path d="M8 17h8" />
                        </svg>
                        My Orders
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        const faqPath = isVendor ? '/vendor/faq' : '/customer/faq';
                        navigate(faqPath);
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-[13px] text-mid hover:bg-cream font-medium flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                        <path d="M9 9h.01" />
                        <path d="M13 9h.01" />
                        <path d="M17 9h.01" />
                      </svg>
                      FAQ
                    </button>
                    <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 font-medium flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Logout
                    </button>
                </div>
             )}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div
          className={`flex-1 scroll-smooth custom-scrollbar ${
            isMessagesPage
              ? 'flex min-h-0 flex-col overflow-hidden p-0'
              : 'overflow-y-auto ' +
                (                isShoppingListPage ||
                isCustomerProjectsListPage ||
                isCustomerProjectDetailPage ||
                isCustomerOrdersListPage ||
                isVendorProjectsPage ||
                isVendorReviewsPage ||
                isVendorExplorePage ||
                isVendorBidsPage ||
                isVendorGuidelinesPage ||
                isFaqPage
                  ? 'px-4 pb-4 pt-0 lg:px-8 lg:pb-8 lg:pt-0'
                  : 'p-4 lg:p-8')
          }`}
        >
          <div
            className={`${
              isMessagesPage ||
              isShopPage ||
              isVendorExplorePage ||
              isVendorBidsPage ||
              isVendorProjectsPage ||
              isVendorReviewsPage ||
              isShoppingPage ||
              isProjectsPage ||
              isOrdersPage ||
              isCheckoutPage ||
              isProfilePage ||
              isFaqPage ||
              isVendorGuidelinesPage ||
              isVendorProfileViewPage
                ? 'max-w-none'
                : 'max-w-5xl'
            } ${isMessagesPage ? 'flex w-full min-h-0 flex-1 flex-col' : 'mx-auto'}`}
          >
            {/* PASS CONTEXT TO CHILDREN */}
            <Outlet context={outletContext} /> 
          </div>
        </div>

        {/* CART DRAWER (customer) */}
        {cartDrawerOpen && !isVendor ? (
          <div
            className="fixed inset-0 z-[160] bg-ink/25 flex items-end md:items-stretch md:justify-end justify-center px-3 md:px-0 pt-[calc(env(safe-area-inset-top)+12px)] md:pt-0 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-0"
            onMouseDown={closeCartDrawer}
          >
            <div
              className="w-full max-w-xl md:w-[520px] md:max-w-[520px] bg-white rounded-t-2xl md:rounded-none shadow-sm border border-pale overflow-hidden max-h-[calc(100dvh-24px)] md:max-h-none md:h-full flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-ink">Cart</p>
                  <p className="text-[12px] text-muted mt-1">
                    Items: <span className="text-mid font-semibold">{Number(cartCount) || 0}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCartDrawer}
                  className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                {cartDrawerLoading ? (
                  <div className="min-h-[240px] flex items-center justify-center">
                    <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : cartDrawerItems.length === 0 ? (
                  <div className="min-h-[240px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                        </svg>
                      </div>
                      <p className="mt-4 text-[14px] font-bold text-ink">Your cart is empty</p>
                      <p className="mt-1 text-[12px] text-muted">Add products from shop to see them here.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="mb-3 inline-flex items-center gap-2 text-[12px] font-medium text-ink select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cartAllSelected}
                        onChange={toggleCartSelectAll}
                        className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                      />
                      Select all
                    </label>
                    <div className="rounded-2xl border border-pale overflow-hidden">
                      {cartDrawerItems.map((x) => {
                        const p = x.product || {};
                        const images = p?.images ?? p?.imageUrls ?? p?.imageURLS ?? p?.imageUrl ?? null;
                        const img = Array.isArray(images) ? images[0] : typeof images === 'string' ? images : null;
                        const name = p?.name ?? p?.title ?? 'Product';
                        const unitRaw = String(p?.unit ?? p?.unitType ?? 'pcs').trim().toLowerCase();
                        const piecesLabel = unitRaw === 'pcs' || unitRaw === 'pc' ? 'pieces' : unitRaw || 'pcs';
                        const pricing = priceForCartLine({ cartItem: x, product: p });
                        const price = pricing.unitPrice;
                        const compareAt = pricing.compareAt;
                        const variantText = variantTextOf(x?.variants);
                        return (
                          <div key={String(x.rowKey)} className="p-4 bg-white border-b border-pale last:border-0">
                          <div className="flex items-start gap-3">
                            <div className="pt-1">
                              <input
                                type="checkbox"
                                checked={cartSelected.has(String(x.rowKey))}
                                onChange={() => toggleCartSelectOne(x.rowKey)}
                                className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
                                aria-label="Select item"
                              />
                            </div>
                            <div className="w-14 h-14 rounded-xl bg-cream border border-pale overflow-hidden shrink-0">
                              {img ? (
                                <SafeImage src={img} alt="" className="w-full h-full object-contain bg-white p-1" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 15l-5-5L5 21"/></svg>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[15px] font-bold text-ink truncate">{name}</p>
                                  <p className="mt-0.5 text-[12px] text-muted">
                                    {x.quantity} {piecesLabel}
                                  </p>
                                  {variantText ? (
                                    <p className="mt-0.5 text-[11px] text-muted font-semibold line-clamp-1">
                                      {variantText}
                                    </p>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const pid = String(x.productId);
                                      if (cartMutatingRef.current) return;
                                      cartMutatingRef.current = true;
                                      try {
                                        await cartService.removeItem({ productId: pid, variants: x.variants });
                                        setCartDrawerItems((prev) => prev.filter((it) => String(it.rowKey) !== String(x.rowKey)));
                                        addToast('Removed from cart', 'success');
                                      } catch (e) {
                                        addToast(e?.message || 'Failed to remove item', 'error');
                                      } finally {
                                        cartMutatingRef.current = false;
                                      }
                                    }}
                                    className="mt-1 text-[12px] text-red-500 hover:underline cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-2">
                                  <div className="inline-flex items-center overflow-hidden rounded-xl bg-walnut text-blush">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const pid = String(x.productId);
                                        const nextQty = Math.max(1, Number(x.quantity || 1) - 1);
                                        if (cartMutatingRef.current) return;
                                        cartMutatingRef.current = true;
                                        try {
                                          await cartService.updateQuantity({ productId: pid, quantity: nextQty, variants: x.variants });
                                          setCartDrawerItems((prev) =>
                                            prev.map((it) => (String(it.rowKey) === String(x.rowKey) ? { ...it, quantity: nextQty } : it))
                                          );
                                        } catch (e) {
                                          addToast(e?.message || 'Failed to update quantity', 'error');
                                        } finally {
                                          cartMutatingRef.current = false;
                                        }
                                      }}
                                      className="w-9 h-9 flex items-center justify-center hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                      disabled={Number(x.quantity) <= 1}
                                      aria-label="Decrease"
                                    >
                                      –
                                    </button>
                                    <div className="w-10 h-9 flex items-center justify-center text-[13px] font-bold">
                                      {x.quantity}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const pid = String(x.productId);
                                        const nextQty = Math.max(1, Number(x.quantity || 1) + 1);
                                        if (cartMutatingRef.current) return;
                                        cartMutatingRef.current = true;
                                        try {
                                          await cartService.updateQuantity({ productId: pid, quantity: nextQty, variants: x.variants });
                                          setCartDrawerItems((prev) =>
                                            prev.map((it) => (String(it.rowKey) === String(x.rowKey) ? { ...it, quantity: nextQty } : it))
                                          );
                                        } catch (e) {
                                          addToast(e?.message || 'Failed to update quantity', 'error');
                                        } finally {
                                          cartMutatingRef.current = false;
                                        }
                                      }}
                                      className="w-9 h-9 flex items-center justify-center hover:opacity-90 cursor-pointer"
                                      aria-label="Increase"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <div className="text-right">
                                    {compareAt > price && price > 0 ? (
                                      <p className="text-[12px] text-muted line-through">₹{formatMoney(compareAt)}</p>
                                    ) : null}
                                    <p className="text-[14px] font-bold text-ink">₹{formatMoney(price)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="shrink-0 px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                <button
                  type="button"
                  onClick={async () => {
                    if (!cartDrawerItems.length) return;
                    if (cartMutatingRef.current) return;
                    cartMutatingRef.current = true;
                    try {
                      await cartService.clear();
                      setCartDrawerItems([]);
                      addToast('Cart cleared', 'success');
                    } catch (e) {
                      addToast(e?.message || 'Failed to clear cart', 'error');
                    } finally {
                      cartMutatingRef.current = false;
                    }
                  }}
                  disabled={cartDrawerLoading || cartDrawerItems.length === 0}
                  className="px-4 py-2 rounded-xl border border-red-200 text-[12px] font-semibold text-red-600 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!cartSelectedIds.length) {
                      addToast('Select at least one item', 'error');
                      return;
                    }
                    if (!cartSelectedProviderOk) {
                      addToast('Selected items must be from a same seller (all Arviah products OR same jeweller)', 'error');
                      return;
                    }
                    const selectedItems = cartDrawerItems.filter((x) => cartSelected.has(String(x.rowKey)));
                    const cartItemIds = selectedItems
                      .map((x) => x.cartItemId)
                      .filter((x) => x != null)
                      .map((x) => Number(x) || x);

                    if (cartItemIds.length !== selectedItems.length) {
                      addToast('Please refresh cart and try again (unable to uniquely identify selected items).', 'error');
                      return;
                    }
                    closeCartDrawer();
                    navigate('/customer/checkout', { state: { cartItemIds } });
                  }}
                  disabled={cartDrawerLoading || cartDrawerItems.length === 0}
                  className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Place Order
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* PROJECT TUTORIAL MODAL */}
        {projectTutorialOpen && projectTutorialVideoUrl ? (
          <div className="fixed inset-0 z-[200] bg-ink/25 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl border border-pale overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-pale flex items-center justify-between gap-3">
                <p className="text-[13px] font-extrabold text-ink">Tutorial</p>
                {projectTutorialLoading ? (
                  <p className="text-[12px] text-muted">Loading…</p>
                ) : (
                  <span className="text-[12px] text-muted">Watch the tutorial to get started</span>
                )}
              </div>

              <div className="p-4 bg-cream">
                {/youtube\.com|youtu\.be/i.test(projectTutorialVideoUrl) ? (
                  <iframe
                    title="Project tutorial video"
                    src={
                      (() => {
                        const base = normalizeYouTubeForIframe(projectTutorialVideoUrl);
                        return base.includes('?')
                          ? `${base}&controls=1&modestbranding=1&rel=0`
                          : `${base}?controls=1&modestbranding=1&rel=0`;
                      })()
                    }
                    className="w-full aspect-video rounded-xl bg-ink"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={projectTutorialVideoUrl}
                    className="w-full max-h-[60vh] rounded-xl bg-ink"
                    autoPlay
                    muted
                    preload="metadata"
                    controls
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    playsInline
                  />
                )}
              </div>

              <div className="px-4 py-4 border-t border-pale flex justify-end">
                <button
                  type="button"
                  onClick={handleProjectTutorialGotIt}
                  disabled={projectTutorialLoading}
                  className="px-6 py-3 rounded-xl bg-walnut text-blush text-[13px] font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
      
    </div>
  );
}
