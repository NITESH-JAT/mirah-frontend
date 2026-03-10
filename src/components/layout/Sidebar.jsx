import React from 'react';
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
  const { user } = useAuth();
  const isVendor = user?.userType === 'vendor' || user?.userType === 'jeweller';
  const vendorKycStatus = String(
    user?.kyc?.status ?? user?.kycStatus ?? user?.kyc_status ?? ''
  ).toLowerCase();
  const isVendorKycAccepted = vendorKycStatus === 'accepted';

  return (
    <div
      className={`flex w-[240px] h-screen bg-white flex-col border-r border-gray-100 fixed left-0 top-0 z-50 transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
    >
      
      {/* Logo Area */}
      <div className="p-6 flex items-center gap-3 mb-2 justify-between">
        <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100 shadow-lg shadow-blue-900/10">
          <img src={logo} alt="Mirah" className="w-full h-full object-cover" />
        </div>
        <span className="font-serif text-2xl text-primary-dark font-bold italic tracking-tight">Mirah</span>
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
            {isVendorKycAccepted && (
              <NavItem
                active={location.pathname.startsWith('/vendor/shop')}
                path="/vendor/shop"
                label="Store"
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l1.2-4h15.6L21 7"/><path d="M2 7h20"/><path d="M4 7v14h16V7"/><path d="M6 7v4"/><path d="M10 7v4"/><path d="M14 7v4"/><path d="M18 7v4"/><path d="M9 21v-7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7"/></svg>}
              />
            )}
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
              active={location.pathname === '/dashboard/shopping'}
              path="/dashboard/shopping"
              label="Shop" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l1.2-4h15.6L21 7"/><path d="M2 7h20"/><path d="M4 7v14h16V7"/><path d="M6 7v4"/><path d="M10 7v4"/><path d="M14 7v4"/><path d="M18 7v4"/><path d="M9 21v-7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7"/></svg>}
            />
            <NavItem 
              active={location.pathname === '/dashboard/cart'}
              path="/dashboard/cart"
              label="Cart" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>}
            />
            <NavItem 
              active={location.pathname === '/dashboard/projects'}
              path="/dashboard/projects"
              label="My Projects" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>}
            />
            <NavItem 
              active={location.pathname === '/dashboard/messages'}
              path="/dashboard/messages"
              label="Messages" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            />
            <NavItem 
              active={location.pathname === '/dashboard/profile'}
              path="/dashboard/profile"
              label="Profile" 
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
          </>
        )}
      </div>
    </div>
  );
}