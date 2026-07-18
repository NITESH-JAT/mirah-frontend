import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

const BottomNavButton = ({ label, active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`relative flex h-full flex-1 items-center justify-center transition-colors cursor-pointer
      ${active ? 'text-ink' : 'text-muted hover:text-ink'}
    `}
  >
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors
        ${active ? 'bg-[#F2E6D4]' : 'bg-transparent'}
      `}
    >
      {children}
    </span>
  </button>
);

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userType = String(user?.userType ?? '').trim().toLowerCase();
  const isVendor = userType === 'vendor' || userType === 'jeweller';
  const vendorKycStatus = String(
    user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? user?.vendorKycStatus ?? user?.vendor_kyc_status ?? ''
  ).toLowerCase();
  const isVendorKycAccepted = ['accepted', 'approved', 'verified', 'success', 'completed'].includes(vendorKycStatus);

  const path = location.pathname || '';
  const isProjectsRoute = !isVendor && path.startsWith('/customer/projects');
  const isVendorProjectsRoute = isVendor && path.startsWith('/vendor/projects');
  const profilePath = isVendor ? '/vendor/profile' : '/customer/profile';

  const items = [];

  if (isVendor) {
    if (!isVendorKycAccepted) {
      items.push({
        key: 'kyc',
        label: 'Verification',
        path: '/vendor/kyc',
        active: path.startsWith('/vendor/kyc'),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
        ),
      });
    }
    if (isVendorKycAccepted) {
      items.push({
        key: 'explore',
        label: 'Explore',
        path: '/vendor/explore',
        active: path.startsWith('/vendor/explore'),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="currentColor" />
          </svg>
        ),
      });
      items.push({
        key: 'bids',
        label: 'Bids',
        path: '/vendor/bids',
        active: path.startsWith('/vendor/bids'),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="20" height="20">
            <rect x="22" y="120" width="110" height="22" rx="11" transform="rotate(-45 22 120)" fill="currentColor" />
            <rect x="52" y="28" width="70" height="24" rx="12" transform="rotate(-45 52 28)" fill="currentColor" />
            <rect x="108" y="74" width="70" height="24" rx="12" transform="rotate(-45 108 74)" fill="currentColor" />
            <rect x="85" y="48" width="42" height="42" transform="rotate(-45 85 48)" fill="currentColor" />
            <rect x="70" y="130" width="70" height="26" rx="8" fill="currentColor" />
            <rect x="60" y="140" width="90" height="22" rx="10" fill="currentColor" />
            <rect x="50" y="168" width="110" height="8" rx="4" fill="currentColor" />
          </svg>
        ),
      });
      items.push({
        key: 'vendor-projects',
        label: 'My Studio',
        path: '/vendor/projects',
        active: isVendorProjectsRoute,
        icon: (
          <img
            src={logo}
            alt=""
            aria-hidden
            className={`h-6 w-6 object-contain brightness-0 ${isVendorProjectsRoute ? 'opacity-100' : 'opacity-70'}`}
          />
        ),
      });
    }
    items.push({
      key: 'vendor-messages',
      label: 'Chat',
      path: '/vendor/messages',
      active: path.startsWith('/vendor/messages'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ),
    });
  } else {
    items.push({
      key: 'projects',
      label: 'My Artisan',
      path: '/customer/projects?tab=list',
      active: isProjectsRoute,
      icon: (
        <img
          src={logo}
          alt=""
          aria-hidden
            className={`h-6 w-6 object-contain brightness-0 ${isProjectsRoute ? 'opacity-100' : 'opacity-70'}`}
        />
      ),
    });
    items.push({
      key: 'shop',
      label: 'Shop',
      path: '/customer/shopping',
      active: path === '/customer/shopping' || path.startsWith('/customer/shopping/'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l1.2-4h15.6L21 7"/><path d="M2 7h20"/><path d="M4 7v14h16V7"/><path d="M6 7v4"/><path d="M10 7v4"/><path d="M14 7v4"/><path d="M18 7v4"/><path d="M9 21v-7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7"/></svg>
      ),
    });
    items.push({
      key: 'messages',
      label: 'Chat',
      path: '/customer/messages',
      active: path === '/customer/messages' || path.startsWith('/customer/messages'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ),
    });
  }

  items.push({
    key: 'profile',
    label: 'Profile',
    path: profilePath,
    active: path.includes('/profile'),
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-stretch border-t border-pale bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => (
        <BottomNavButton
          key={item.key}
          label={item.label}
          active={item.active}
          onClick={() => navigate(item.path)}
        >
          {item.icon}
        </BottomNavButton>
      ))}
    </nav>
  );
}
