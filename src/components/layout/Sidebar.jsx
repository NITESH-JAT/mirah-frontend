import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

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

const NavItem = ({ icon, label, path, active }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(path)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(path);
        }
      }}
      className={`flex w-full items-center gap-3 py-3 mb-1 cursor-pointer transition-all duration-200 font-sans text-[14px] border-l-4 pr-4
        ${active
          ? 'border-l-walnut bg-blush pl-3 text-ink font-medium'
          : 'border-l-transparent pl-3 text-muted hover:bg-blush hover:text-ink'
        }
      `}
    >
      <div className={`${active ? 'text-ink' : 'text-muted group-hover:text-ink'}`}>
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
  const userType = String(user?.userType ?? '').trim().toLowerCase();
  const isVendor = userType === 'vendor' || userType === 'jeweller';
  const vendorKycStatus = String(
    user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? user?.vendorKycStatus ?? user?.vendor_kyc_status ?? ''
  ).toLowerCase();
  const isVendorKycAccepted = ['accepted', 'approved', 'verified', 'success', 'completed'].includes(vendorKycStatus);

  const isProjectsRoute = !isVendor && location.pathname.startsWith('/customer/projects');
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
    if (p.startsWith('/vendor/projects')) return 'My Projects';
    if (p.includes('/customer/cart')) return 'Cart';
    if (p.includes('/customer/checkout')) return 'Checkout';
    if (p.includes('/customer/orders')) return 'My Orders';
    if (p.includes('/customer/shopping')) return 'Shop';
    if (p.startsWith('/customer/projects')) return 'My Projects';
    return '';
  })();

  const profilePath = isVendor ? '/vendor/profile' : '/customer/profile';

  return (
    <div
      className={`flex h-[100dvh] max-h-[100dvh] w-[240px] flex-col border-r border-pale bg-white fixed left-0 top-0 z-50 transform transition-transform duration-300 rounded-bl-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
    >
      
      {/* Logo Area — lg: h-16 matches main header; no gap below border on desktop */}
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-pale px-6 py-4 lg:mb-0 lg:h-16 lg:py-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-pale shadow-sm shadow-walnut/10 lg:hidden">
            <img src={logo} alt="Mirah" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif text-3xl text-ink font-extrabold italic tracking-tight lg:hidden">Mirah</span>

          <span className="hidden lg:block text-2xl text-ink tracking-tight whitespace-nowrap">
            <span className="font-serif font-extrabold italic">Mirah</span>
            <span className="font-sans  not-italic mx-2">|</span>
            <span className="font-serif font-extrabold italic">{baseTitle || ''}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-2 rounded-lg hover:bg-cream text-muted hover:text-mid transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      {/* Nav Items — pt-0 so first item sits flush under header rule (no white strip) */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2 pt-0">
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

            {isVendorKycAccepted ? (
              <NavItem
                active={isVendorProjectsRoute}
                path="/vendor/projects"
                label="My Projects"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h8" />
                  </svg>
                }
              />
            ) : null}
            <NavItem
              active={location.pathname.startsWith('/vendor/messages')}
              path="/vendor/messages"
              label="Messages"
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
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
              active={isProjectsRoute}
              path="/customer/projects?tab=list"
              label="My Projects"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <path d="M8 13h8"/>
                  <path d="M8 17h8"/>
                </svg>
              }
            />
            <NavItem 
              active={location.pathname === '/customer/messages'}
              path="/customer/messages"
              label="Messages" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            />
          </>
        )}
      </div>

      {/* Profile — bottom: cream strip, avatar + single bold line (no “Member”) */}
      <div className="shrink-0 rounded-bl-2xl border-t border-pale bg-cream px-4 py-4">
        <button
          type="button"
          onClick={() => {
            navigate(profilePath);
            onClose?.();
          }}
          className="flex w-full cursor-pointer items-center gap-3 py-2 text-left"
          aria-label="Open profile"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush font-sans text-[13px] font-bold tracking-tight text-ink">
            {initialsForUser(user)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-[15px] font-bold leading-tight text-ink">{roleLabelForUser(user)}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
