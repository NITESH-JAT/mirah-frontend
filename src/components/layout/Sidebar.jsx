import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

const NavItem = ({ icon, label, path, active }) => {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => navigate(path)}

      className={`flex items-center gap-3 px-4 py-3 mx-4 mb-1 cursor-pointer transition-all duration-200 font-sans text-[14px] font-medium rounded-lg
        ${active 
          ? 'bg-primary-dark text-white shadow-md' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
        }
      `}
    >
      <div className={`${active ? 'text-white' : 'text-gray-400 group-hover:text-primary-dark'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </div>
  );
};

export default function Sidebar({ isOpen = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVendor = user?.userType === 'vendor' || user?.userType === 'jeweller';
  const canSell = Boolean(user?.canSellProducts);
  const vendorKycStatus = String(
    user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? ''
  ).toLowerCase();
  const isVendorKycAccepted = vendorKycStatus === 'accepted';

  const [projectsOpen, setProjectsOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [vendorProjectsOpen, setVendorProjectsOpen] = useState(false);

  const PROJECTS_TAB_KEY = 'mirah_projects_last_tab';
  const STORE_TAB_KEY = 'mirah_vendor_store_last_tab';
  const VENDOR_PROJECTS_TAB_KEY = 'mirah_vendor_projects_last_tab';

  useEffect(() => {
    if (isVendor) return;
    if (location.pathname.startsWith('/customer/projects')) {
      // async to avoid "setState synchronously within effect" lint
      setTimeout(() => setProjectsOpen(true), 0);
    }
  }, [isVendor, location.pathname]);

  useEffect(() => {
    if (!isVendor) return;
    if (location.pathname.startsWith('/vendor/shop')) {
      // async to avoid "setState synchronously within effect" lint
      setTimeout(() => setStoreOpen(true), 0);
    }
  }, [isVendor, location.pathname]);

  useEffect(() => {
    if (!isVendor) return;
    if (location.pathname.startsWith('/vendor/projects')) {
      // async to avoid "setState synchronously within effect" lint
      setTimeout(() => setVendorProjectsOpen(true), 0);
    }
  }, [isVendor, location.pathname]);

  const projectsTab = (() => {
    const normalize = (t) => {
      const v = String(t || '').trim().toLowerCase();
      return v === 'list' || v === 'create' || v === 'assignments' ? v : null;
    };
    try {
      const fromUrl = normalize(new URLSearchParams(location.search || '').get('tab'));
      if (fromUrl) {
        try {
          sessionStorage.setItem(PROJECTS_TAB_KEY, fromUrl);
        } catch {
          // ignore
        }
        return fromUrl;
      }
    } catch {
      // ignore
    }
    try {
      const stored = normalize(sessionStorage.getItem(PROJECTS_TAB_KEY));
      return stored || 'list';
    } catch {
      return 'list';
    }
  })();

  const isProjectsRoute = !isVendor && location.pathname.startsWith('/customer/projects');
  const isStoreRoute = isVendor && location.pathname.startsWith('/vendor/shop');
  const isVendorProjectsRoute = isVendor && location.pathname.startsWith('/vendor/projects');

  const baseTitle = (() => {
    const p = location.pathname || '';
    if (p.includes('profile')) return 'My Profile';
    if (p.includes('faq')) return 'FAQ';
    if (p.includes('messages')) return 'Messages';
    if (p.includes('/vendor/kyc')) return 'KYC';
    if (p.includes('/vendor/shop')) return 'Store';
    if (p.startsWith('/vendor/bids')) return p.startsWith('/vendor/bids/') ? 'Biddings' : 'Bids';
    if (p.startsWith('/vendor/explore')) return p.startsWith('/vendor/explore/') ? 'Project' : 'Explore Projects';
    if (p.startsWith('/vendor/projects')) return p.includes('/vendor/projects/assigned') ? 'Assigned Projects' : 'Assignment Requests';
    if (p.includes('/customer/cart')) return 'Cart';
    if (p.includes('/customer/checkout')) return 'Checkout';
    if (p.includes('/customer/orders')) return 'My Orders';
    if (p.includes('/customer/shopping')) return 'Shop';
    if (p.startsWith('/customer/projects')) return 'My Projects';
    return '';
  })();

  const goProjectsTab = (tab) => {
    const t = String(tab || '').trim().toLowerCase();
    try {
      sessionStorage.setItem(PROJECTS_TAB_KEY, t);
    } catch {
      // ignore
    }
    navigate(`/customer/projects?tab=${encodeURIComponent(t)}`);
    onClose?.();
  };

  const storeTab = (() => {
    const normalize = (t) => {
      const v = String(t || '').trim().toLowerCase();
      return v === 'list' || v === 'create' || v === 'orders' || v === 'reviews' ? v : null;
    };
    try {
      const fromUrl = normalize(new URLSearchParams(location.search || '').get('tab'));
      if (fromUrl) {
        try {
          sessionStorage.setItem(STORE_TAB_KEY, fromUrl);
        } catch {
          // ignore
        }
        return fromUrl;
      }
    } catch {
      // ignore
    }
    try {
      const stored = normalize(sessionStorage.getItem(STORE_TAB_KEY));
      return stored || 'list';
    } catch {
      return 'list';
    }
  })();

  const goStoreTab = (tab) => {
    const t = String(tab || '').trim().toLowerCase();
    try {
      sessionStorage.setItem(STORE_TAB_KEY, t);
    } catch {
      // ignore
    }
    navigate(`/vendor/shop?tab=${encodeURIComponent(t)}`);
    onClose?.();
  };

  const vendorProjectsTab = (() => {
    const normalize = (t) => {
      const v = String(t || '').trim().toLowerCase();
      return v === 'assignment-requests' || v === 'assigned' ? v : null;
    };
    try {
      const fromUrl = normalize(new URLSearchParams(location.search || '').get('tab'));
      if (fromUrl) {
        try {
          sessionStorage.setItem(VENDOR_PROJECTS_TAB_KEY, fromUrl);
        } catch {
          // ignore
        }
        return fromUrl;
      }
    } catch {
      // ignore
    }
    try {
      const stored = normalize(sessionStorage.getItem(VENDOR_PROJECTS_TAB_KEY));
      return stored || 'assignment-requests';
    } catch {
      return 'assignment-requests';
    }
  })();

  const goVendorProjectsTab = (tab) => {
    const t = String(tab || '').trim().toLowerCase();
    const next = t === 'assigned' ? 'assigned' : 'assignment-requests';
    try {
      sessionStorage.setItem(VENDOR_PROJECTS_TAB_KEY, next);
    } catch {
      // ignore
    }
    navigate(`/vendor/projects/${encodeURIComponent(next)}`);
    onClose?.();
  };

  return (
    <div
      className={`flex w-[240px] h-screen bg-white flex-col border-r border-gray-100 fixed left-0 top-0 z-50 transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
    >
      
      {/* Logo Area */}
      <div className="p-6 flex items-center gap-3 mb-2 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 shadow-lg shadow-blue-900/10 lg:hidden">
            <img src={logo} alt="Mirah" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif text-3xl text-primary-dark font-extrabold italic tracking-tight lg:hidden">Mirah</span>

          <span className="hidden lg:block text-2xl text-primary-dark tracking-tight whitespace-nowrap">
            <span className="font-serif font-extrabold italic">Mirah</span>
            <span className="font-sans  not-italic mx-2">|</span>
            <span className="font-serif font-extrabold italic">{baseTitle || ''}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-2">
        {isVendor ? (
          <>
            {!isVendorKycAccepted && (
              <NavItem
                active={location.pathname.startsWith('/vendor/kyc')}
                path="/vendor/kyc"
                label="KYC"
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>}
              />
            )}
            {isVendorKycAccepted ? (
              <NavItem
                active={location.pathname.startsWith('/vendor/explore')}
                path="/vendor/explore"
                label="Explore"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon
                      points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="currentColor" />
                  </svg>
                }
              />
            ) : null}
            {isVendorKycAccepted ? (
              <NavItem
                active={location.pathname.startsWith('/vendor/bids')}
                path="/vendor/bids"
                label="Bids"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="18" height="18">
                    <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
                    <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
                    <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
                    <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
                    <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
                    <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
                    <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
                  </svg>
                }
              />
            ) : null}

            {isVendorKycAccepted && canSell ? (
              <div className="mx-4 mb-1">
                <button
                  type="button"
                  onClick={() => setVendorProjectsOpen((v) => !v)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-all duration-200 font-sans text-[14px] font-medium rounded-lg
                    ${isVendorProjectsRoute ? 'bg-primary-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`${isVendorProjectsRoute ? 'text-white' : 'text-gray-400'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <path d="M8 13h8"/>
                        <path d="M8 17h8"/>
                      </svg>
                    </div>
                    <span className="truncate">My Projects</span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`shrink-0 transition-transform ${vendorProjectsOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {vendorProjectsOpen ? (
                  <div className="mt-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => goVendorProjectsTab('assignment-requests')}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                        ${
                          isVendorProjectsRoute && vendorProjectsTab === 'assignment-requests'
                            ? 'bg-primary-dark/10 text-primary-dark'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                        <path d="M8 10h8" />
                        <path d="M8 14h5" />
                      </svg>
                      <span>Assignment Requests</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => goVendorProjectsTab('assigned')}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                        ${
                          isVendorProjectsRoute && vendorProjectsTab === 'assigned'
                            ? 'bg-primary-dark/10 text-primary-dark'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                        <path d="M9 5a3 3 0 0 0 6 0" />
                        <path d="M9 5h6" />
                        <path d="M9 12h6" />
                        <path d="M9 16h6" />
                      </svg>
                      <span>Assigned Projects</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isVendorKycAccepted && (canSell ? (
              <div className="mx-4 mb-1">
                <button
                  type="button"
                  onClick={() => setStoreOpen((v) => !v)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-all duration-200 font-sans text-[14px] font-medium rounded-lg
                    ${isStoreRoute ? 'bg-primary-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`${isStoreRoute ? 'text-white' : 'text-gray-400'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7l1.2-4h15.6L21 7" />
                        <path d="M2 7h20" />
                        <path d="M4 7v14h16V7" />
                        <path d="M6 7v4" />
                        <path d="M10 7v4" />
                        <path d="M14 7v4" />
                        <path d="M18 7v4" />
                        <path d="M9 21v-7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7" />
                      </svg>
                    </div>
                    <span className="truncate">Store</span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`shrink-0 transition-transform ${storeOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {storeOpen ? (
                  <div className="mt-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => goStoreTab('list')}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                        ${
                          isStoreRoute && storeTab === 'list'
                            ? 'bg-primary-dark/10 text-primary-dark'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
                        <path d="M3.3 7 12 12l8.7-5" />
                        <path d="M12 22V12" />
                      </svg>
                      <span>List Products</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => goStoreTab('create')}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                        ${
                          isStoreRoute && storeTab === 'create'
                            ? 'bg-primary-dark/10 text-primary-dark'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                      <span>Create Product</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => goStoreTab('orders')}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                        ${
                          isStoreRoute && storeTab === 'orders'
                            ? 'bg-primary-dark/10 text-primary-dark'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                        <path d="M9 5a3 3 0 0 0 6 0" />
                        <path d="M9 5h6" />
                        <path d="M9 12h6" />
                        <path d="M9 16h6" />
                      </svg>
                      <span>Manage Orders</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => goStoreTab('reviews')}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                        ${
                          isStoreRoute && storeTab === 'reviews'
                            ? 'bg-primary-dark/10 text-primary-dark'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                        <path d="M12 7.5l.9 1.82 2.01.29-1.45 1.41.34 2-1.8-.95-1.8.95.34-2-1.45-1.41 2.01-.29.9-1.82z" />
                      </svg>
                      <span>Product Reviews</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mx-4 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/vendor/shop');
                    onClose?.();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 font-sans text-[14px] font-medium rounded-lg
                    ${isStoreRoute ? 'bg-primary-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'}
                  `}
                >
                  <div className={`${isStoreRoute ? 'text-white' : 'text-gray-400 group-hover:text-primary-dark'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7l1.2-4h15.6L21 7" />
                      <path d="M2 7h20" />
                      <path d="M4 7v14h16V7" />
                      <path d="M6 7v4" />
                      <path d="M10 7v4" />
                      <path d="M14 7v4" />
                      <path d="M18 7v4" />
                      <path d="M9 21v-7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7" />
                    </svg>
                  </div>
                  <span className="truncate">Store</span>
                </button>
              </div>
            ))}
            <NavItem
              active={location.pathname.startsWith('/vendor/messages')}
              path="/vendor/messages"
              label="Messages"
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            />
            <NavItem
              active={location.pathname.startsWith('/vendor/profile')}
              path="/vendor/profile"
              label="Profile"
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
          </>
        ) : (
          <>
            <NavItem 
              active={location.pathname === '/customer/shopping'}
              path="/customer/shopping"
              label="Shop" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l1.2-4h15.6L21 7"/><path d="M2 7h20"/><path d="M4 7v14h16V7"/><path d="M6 7v4"/><path d="M10 7v4"/><path d="M14 7v4"/><path d="M18 7v4"/><path d="M9 21v-7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7"/></svg>}
            />
            <NavItem 
              active={location.pathname === '/customer/orders'}
              path="/customer/orders"
              label="My Orders" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>}
            />
            <div className="mx-4 mb-1">
              <button
                type="button"
                onClick={() => setProjectsOpen((v) => !v)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-all duration-200 font-sans text-[14px] font-medium rounded-lg
                  ${isProjectsRoute ? 'bg-primary-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`${isProjectsRoute ? 'text-white' : 'text-gray-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <path d="M8 13h2"/>
                      <path d="M8 17h2"/>
                      <path d="M14 13h2"/>
                      <path d="M14 17h2"/>
                    </svg>
                  </div>
                  <span className="truncate">My Projects</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`shrink-0 transition-transform ${projectsOpen ? 'rotate-180' : ''}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {projectsOpen ? (
                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => goProjectsTab('list')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                      ${
                        isProjectsRoute && projectsTab === 'list'
                          ? 'bg-primary-dark/10 text-primary-dark'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                      }
                    `}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 6h11" />
                      <path d="M9 12h11" />
                      <path d="M9 18h11" />
                      <path d="M4 6h.01" />
                      <path d="M4 12h.01" />
                      <path d="M4 18h.01" />
                    </svg>
                    <span>List Projects</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goProjectsTab('create')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                      ${
                        isProjectsRoute && projectsTab === 'create'
                          ? 'bg-primary-dark/10 text-primary-dark'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                      }
                    `}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                    <span>Create Projects</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goProjectsTab('assignments')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors font-sans text-[13px] font-medium
                      ${
                        isProjectsRoute && projectsTab === 'assignments'
                          ? 'bg-primary-dark/10 text-primary-dark'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-primary-dark'
                      }
                    `}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>Assignments</span>
                  </button>
                </div>
              ) : null}
            </div>
            <NavItem 
              active={location.pathname === '/customer/messages'}
              path="/customer/messages"
              label="Messages" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            />
            <NavItem 
              active={location.pathname === '/customer/profile'}
              path="/customer/profile"
              label="Profile" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
          </>
        )}
      </div>
    </div>
  );
}