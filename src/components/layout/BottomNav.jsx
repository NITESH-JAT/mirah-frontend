import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MobileNavItem = ({ icon, label, path, active }) => {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => navigate(path)}
      className="flex flex-col items-center justify-center gap-1 flex-1 py-3 cursor-pointer active:scale-95 transition-transform"
    >
      <div className={`${active ? 'text-primary-dark' : 'text-gray-400'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-medium ${active ? 'text-primary-dark' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
};

export default function BottomNav() {
  const location = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 flex items-center justify-between px-2 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      <MobileNavItem 
        active={location.pathname.includes('shopping')}
        path="/dashboard/shopping"
        label="Shop"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>}
      />
      <MobileNavItem 
        active={location.pathname.includes('projects')}
        path="/dashboard/projects"
        label="Projects"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>}
      />
      <MobileNavItem 
        active={location.pathname.includes('messages')}
        path="/dashboard/messages"
        label="Chat"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
      />
      <MobileNavItem 
        active={location.pathname.includes('profile')}
        path="/dashboard/profile"
        label="Profile"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
      />
    </div>
  );
}