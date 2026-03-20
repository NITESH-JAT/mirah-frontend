import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import { authService } from '../../services/authService';
import logo from '../../assets/logo.png';

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
      relative w-[320px] bg-white rounded-[12px] shadow-xl border-l-4 p-4 mb-3 flex gap-3 items-start transition-all pointer-events-auto
      ${isError ? 'border-red-500' : 'border-green-500'}
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
        <h4 className={`font-sans text-[15px] font-bold leading-none mb-1 ${isError ? 'text-red-600' : 'text-primary-dark'}`}>
          {isError ? 'Error' : 'Success'}
        </h4>
        <p className="text-gray-500 font-sans text-[13px] leading-snug">{message}</p>
      </div>
      <button onClick={handleClose} className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer p-1">
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

function truncateName(name, max = 10) {
  const s = String(name ?? '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return `${s.slice(0, max - 1)}…`;
}

function avatarNameForUser(u) {
  const first = String(u?.firstName ?? '').trim();
  const last = String(u?.lastName ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || String(u?.email ?? '').trim() || 'User';
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
  const isVendorExplorePage = path.includes('/vendor/explore');
  const isVendorBidsPage = path.includes('/vendor/bids');
  const isVendorProjectsPage = path.includes('/vendor/projects');
  const isShoppingPage = path.includes('/dashboard/shopping');
  const isShoppingListPage = path === '/dashboard/shopping';
  const isCartPage = path.includes('/dashboard/cart');
  const isCheckoutPage = path.includes('/dashboard/checkout');
  const isOrdersPage = path.includes('/dashboard/orders');
  const isProjectsPage = path.includes('/dashboard/projects');
  const isVendorProfileViewPage = path.startsWith('/dashboard/vendors/');
  const isVendor = currentUser?.userType === 'vendor' || currentUser?.userType === 'jeweller';
  const kycStatus = String(currentUser?.kyc?.status || '').toLowerCase();
  const kycAccepted = kycStatus === 'accepted';

  const headerTitle = useMemo(() => {
    if (isProfilePage) return 'My Profile';
    if (isFaqPage) return 'FAQ';
    if (isMessagesPage) return 'Messages';
    if (isKycPage) return 'KYC';
    if (isShopPage) return 'Store';
    if (isVendorBidsPage) return path.startsWith('/vendor/bids/') ? 'Biddings' : 'Bids';
    if (isVendorExplorePage) return path.startsWith('/vendor/explore/') ? 'Project' : 'Explore Projects';
    if (isVendorProjectsPage) return path.includes('/vendor/projects/assigned') ? 'Assigned Projects' : 'Assignment Requests';
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
    isShoppingPage,
    isVendorBidsPage,
    isVendorExplorePage,
    isVendorProjectsPage,
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
  const [cartHasNew, setCartHasNew] = useState(false);
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

  // Cart red-dot indicator (set when items added; cleared when cart page opened)
  useEffect(() => {
    try {
      setCartHasNew(localStorage.getItem('mirah_cart_has_new') === '1');
    } catch {
      setCartHasNew(false);
    }
  }, []);

  useEffect(() => {
    const onUpdated = () => {
      try {
        setCartHasNew(localStorage.getItem('mirah_cart_has_new') === '1');
      } catch {
        setCartHasNew(false);
      }
    };
    window.addEventListener('mirah_cart_updated', onUpdated);
    window.addEventListener('storage', onUpdated);
    return () => {
      window.removeEventListener('mirah_cart_updated', onUpdated);
      window.removeEventListener('storage', onUpdated);
    };
  }, []);

  useEffect(() => {
    if (!isCartPage) return;
    try {
      localStorage.removeItem('mirah_cart_has_new');
      window.dispatchEvent(new Event('mirah_cart_updated'));
    } catch {
      // ignore
    }
    setCartHasNew(false);
  }, [isCartPage]);

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
    <div className="h-screen w-full bg-[#F8F9FA] flex overflow-hidden font-sans relative">
      <style>{globalStyles}</style>

      {/* TOAST CONTAINER */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
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
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Desktop-only centered logo across sidebar + main header width */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 top-0 h-16 items-center pointer-events-none z-[45]">
        <img src={logo} alt="Mirah" className="w-18 h-18 object-contain" />
      </div>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full w-full lg:ml-[240px] ml-0 relative">

        {/* HEADER */}
      <div className="relative flex h-16 bg-white border-b border-gray-100 px-4 sm:px-8 items-center justify-between shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                setShowNotifications(false);
                setIsSidebarOpen(true);
              }}
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>
            {headerTitle ? (
              <h1 className="hidden sm:block lg:hidden font-serif text-xl font-bold text-gray-800 truncate max-w-[60vw]">
                {headerTitle}
              </h1>
            ) : null}
          </div>

          {/* Desktop-only center branding moved to outer layout */}
          
          <div className="flex items-center gap-3 relative">
            {/* Mobile cart icon */}
            {!isVendor ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard/cart')}
                className="sm:hidden relative p-2 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                aria-label="Cart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                {cartHasNew ? (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                ) : null}
              </button>
            ) : null}

            {/* NOTIFICATIONS */}
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (isSidebarOpen) return; // sidenav open: disable top nav dropdowns
                  setShowNotifications((v) => !v);
                }}
                className="relative p-2 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>

              {showNotifications && (
                <div
                  className="fixed left-4 right-4 top-[72px] w-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60]
                             sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px] sm:max-w-[90vw]"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <p className="text-[13px] font-bold text-gray-800">Notifications</p>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-gray-400">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
                    </div>
                  </div>

                  <div className="max-h-[min(420px,calc(100vh-120px))] overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-4 text-[13px] text-gray-400">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-[13px] text-gray-400">No notifications</div>
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
                            className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
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
                                <p className="text-[13px] font-bold text-gray-800">{title}</p>
                                {message && (
                                  <p className="text-[12px] text-gray-500 mt-0.5 ">{message}</p>
                                )}
                                {when ? (
                                  <p className="text-[11px] text-gray-400 mt-1">{when}</p>
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

            {/* USER MENU */}
            <div className="relative" ref={userMenuRef}>
             <div 
                className="flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => {
                  if (isSidebarOpen) return; // sidenav open: disable top nav dropdowns
                  setShowUserMenu(!showUserMenu);
                }}
             >
                 <div className="text-right leading-tight">
                    <p className="text-[13px] font-bold text-gray-800">
                      {truncateName(currentUser?.firstName || 'User', 10)}
                    </p>
                    <p className="text-[11px] text-gray-400 capitalize">{currentUser?.userType || 'Guest'}</p>
                 </div>
                 <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden border border-gray-100 shadow-sm">
                    <img 
                        src={
                          currentUser?.profileImageUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarNameForUser(currentUser))}&background=0D8ABC&color=fff`
                        } 
                        alt="User" 
                    />
                 </div>
             </div>

             {/* PROFILE DROPDOWN */}
             {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-2 overflow-hidden animate-slide-in">
                    <button 
                        onClick={() => {
                          const profilePath = isVendor ? '/vendor/profile' : '/dashboard/profile';
                          navigate(profilePath);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profile
                    </button>
                    <button
                      onClick={() => {
                        const faqPath = isVendor ? '/vendor/faq' : '/dashboard/faq';
                        navigate(faqPath);
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
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
          className={`flex-1 overflow-y-auto scroll-smooth custom-scrollbar ${
            isShoppingListPage ? 'px-4 pb-4 pt-0 lg:px-8 lg:pb-8 lg:pt-0' : 'p-4 lg:p-8'
          }`}
        >
          <div
            className={`${
              isMessagesPage ||
              isShopPage ||
              isVendorExplorePage ||
              isVendorBidsPage ||
              isVendorProjectsPage ||
              isShoppingPage ||
              isProjectsPage ||
              isOrdersPage ||
              isProfilePage ||
              isFaqPage ||
              isVendorProfileViewPage
                ? 'max-w-none'
                : 'max-w-5xl'
            } mx-auto`}
          >
            {/* PASS CONTEXT TO CHILDREN */}
            <Outlet context={outletContext} /> 
          </div>
        </div>

        {/* PROJECT TUTORIAL MODAL */}
        {projectTutorialOpen && projectTutorialVideoUrl ? (
          <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
                <p className="text-[13px] font-extrabold text-gray-900">Tutorial</p>
                {projectTutorialLoading ? (
                  <p className="text-[12px] text-gray-400">Loading…</p>
                ) : (
                  <span className="text-[12px] text-gray-400">Watch the tutorial to get started</span>
                )}
              </div>

              <div className="p-4 bg-gray-50">
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
                    className="w-full aspect-video rounded-xl bg-black"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={projectTutorialVideoUrl}
                    className="w-full max-h-[60vh] rounded-xl bg-black"
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

              <div className="px-4 py-4 border-t border-gray-50 flex justify-end">
                <button
                  type="button"
                  onClick={handleProjectTutorialGotIt}
                  disabled={projectTutorialLoading}
                  className="px-6 py-3 rounded-xl bg-primary-dark text-white text-[13px] font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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