import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NavItem = ({ icon, label, path, active }) => {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => navigate(path)}
      // Changed to 'rounded-lg' and added 'mx-4' to make it a contained button like the image
      // Removed border-l logic, replaced with full background fill
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

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="hidden lg:flex w-[240px] h-screen bg-white flex-col border-r border-gray-100 fixed left-0 top-0 z-50">
      
      {/* Logo Area */}
      <div className="p-6 flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-primary-dark rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
          <div className="w-3.5 h-3.5 border-2 border-white rotate-45"></div>
        </div>
        <span className="font-serif text-2xl text-primary-dark font-bold italic tracking-tight">Mirah</span>
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-2">
        <NavItem 
          active={location.pathname === '/dashboard/shopping'}
          path="/dashboard/shopping"
          label="Shopping" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>}
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
      </div>
    </div>
  );
}