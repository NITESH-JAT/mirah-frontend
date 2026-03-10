import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';

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
        <h4 className={`font-serif text-[15px] font-bold leading-none mb-1 ${isError ? 'text-red-600' : 'text-primary-dark'}`}>
          {isError ? 'Action Failed' : 'Success'}
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

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser, setUser: setCurrentUser, logout } = useAuth();
  const path = location.pathname;
  const isProfilePage = path.includes('profile');
  const isMessagesPage = path.includes('messages');
  const isKycPage = path.includes('/vendor/kyc');
  const isShopPage = path.includes('/vendor/shop');
  
  const [toasts, setToasts] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);

  // --- NOTIFICATION HANDLER ---
  const addToast = useCallback((message, type = 'success') => {
    const raw = typeof message === 'string' ? message : (message?.message || String(message || ''));
    const cleaned = raw.replace(/\s+/g, ' ').trim();

    // Avoid leaking raw axios errors like: "Request failed with status code 403"
    const isAxiosStatusLine = /^Request failed with status code \d+$/i.test(cleaned);
    const finalMessage = isAxiosStatusLine ? 'Request failed, try again later' : cleaned;

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

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifLoading(true);
      await notificationService.markAllRead();
      await refreshUnreadCount();
      await loadNotifications();
    } catch (e) {
      addToast(e?.message || 'Failed to mark all as read', 'error');
    } finally {
      setNotifLoading(false);
    }
  }, [addToast, loadNotifications, refreshUnreadCount]);

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
  }, [location.pathname]);

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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // --- STYLES ---
  const globalStyles = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    .animate-slide-in { animation: slideIn 0.4s ease-out forwards; }
    .animate-fade-out { animation: fadeOut 0.4s ease-out forwards; }
  `;

  return (
    <div className="h-screen w-full bg-[#F8F9FA] flex overflow-hidden font-sans">
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

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full w-full lg:ml-[240px] ml-0 relative">

        {/* HEADER */}
        <div className="flex h-16 bg-white border-b border-gray-100 px-4 sm:px-8 items-center justify-between shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
            </button>
            <h1 className="font-serif text-xl font-bold text-gray-800">
              {isProfilePage ? 'My Profile' : isMessagesPage ? 'Messages' : isKycPage ? 'KYC' : isShopPage ? 'Shop' : ''}
            </h1>
          </div>
          
          <div className="flex items-center gap-3 relative">
            {/* NOTIFICATIONS */}
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => setShowNotifications((v) => !v)}
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
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={notifLoading || unreadCount === 0}
                        className="text-[11px] font-bold text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Mark all as read
                      </button>
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
                          >
                            <div className="flex gap-3 items-start">
                              <div className={`mt-1 w-2 h-2 rounded-full ${isRead ? 'bg-transparent' : 'bg-red-500'}`} />
                              <div className="flex-1">
                                <p className="text-[13px] font-bold text-gray-800">{title}</p>
                                {message && (
                                  <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{message}</p>
                                )}
                                {when ? (
                                  <p className="text-[11px] text-gray-400 mt-1">{when}</p>
                                ) : null}
                              </div>
                              {!isRead && id && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await notificationService.markRead(id);
                                      await refreshUnreadCount();
                                      await loadNotifications();
                                    } catch (err) {
                                      addToast(err?.message || 'Failed to mark as read', 'error');
                                    }
                                  }}
                                  className="shrink-0 text-[11px] font-bold text-primary-dark hover:underline cursor-pointer"
                                >
                                  Mark as read
                                </button>
                              )}
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
                onClick={() => setShowUserMenu(!showUserMenu)}
             >
                 <div className="text-right leading-tight">
                    <p className="text-[13px] font-bold text-gray-800">{currentUser?.firstName || 'User'}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{currentUser?.userType || 'Guest'}</p>
                 </div>
                 <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden border border-gray-100 shadow-sm">
                    <img 
                        src={
                          currentUser?.profileImageUrl ||
                          `https://ui-avatars.com/api/?name=${currentUser?.firstName || 'U'}&background=0D8ABC&color=fff`
                        } 
                        alt="User" 
                    />
                 </div>
             </div>

             {/* LOGOUT DROPDOWN */}
             {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-2 overflow-hidden animate-slide-in">
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
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth custom-scrollbar">
          <div className={`${isMessagesPage || isShopPage ? 'max-w-none' : 'max-w-5xl'} mx-auto`}>
            {/* PASS CONTEXT TO CHILDREN */}
            <Outlet context={outletContext} /> 
          </div>
        </div>

      </div>
      
    </div>
  );
}