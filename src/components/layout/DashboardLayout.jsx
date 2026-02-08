import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { authService } from '../../services/authService';

// --- TOAST NOTIFICATION COMPONENT ---
const ToastNotification = ({ id, message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => handleClose(), 10000); 
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 400); 
  };

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

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isProfilePage = location.pathname.includes('profile');
  
  const [toasts, setToasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // --- NOTIFICATION HANDLER ---
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- LOAD USER & CLICK OUTSIDE ---
  useEffect(() => {
    const user = authService.getCurrentUser();
    if(user) setCurrentUser(user);
    
    const handleClickOutside = (event) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
            setShowUserMenu(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [location.pathname]);

  const handleLogout = async () => {
    await authService.logout();
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
      
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full w-full lg:ml-[240px] relative">
        
        {/* MOBILE HEADER */}
        <div className="lg:hidden fixed top-0 left-0 w-full z-50 pointer-events-none">
           <div 
             className="w-full absolute top-0 left-0"
             style={{
               height: isProfilePage ? '85px' : '130px', 
               background: isProfilePage 
                 ? 'linear-gradient(180deg, #0D2E4E 50%, rgba(13, 46, 78, 0) 100%)' 
                 : 'linear-gradient(180deg, #0D2E4E 45%, rgba(13, 46, 78, 0) 100%)'
             }}
           />
           <div className="relative w-full pointer-events-auto">
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10 shadow-sm">
                      <div className="w-3.5 h-3.5 border-2 border-white rotate-45"></div>
                    </div>
                    <span className="font-serif text-[20px] text-white font-bold italic tracking-wide">Mirah</span>
                  </div>
                  
                  {/* Mobile Logout Button */}
                  <button onClick={handleLogout} className="text-white/80 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </button>
              </div>

              {!isProfilePage && (
                <div className="px-5 pt-3 pb-2 w-full">
                   <div className="bg-white rounded-xl flex items-center px-4 py-2.5 shadow-[0_4px_15px_rgba(0,0,0,0.1)]">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D2E4E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                     <span className="ml-3 text-gray-400 text-[13px] font-medium">Search "Jewellers"</span>
                   </div>
                </div>
              )}
           </div>
        </div>

        {/* DESKTOP HEADER */}
        <div className="hidden lg:flex h-16 bg-white border-b border-gray-100 px-8 items-center justify-between shrink-0 sticky top-0 z-40">
          <h1 className="font-serif text-xl font-bold text-gray-800">
            {isProfilePage ? 'My Profile' : 'Overview'}
          </h1>
          
          <div className="flex items-center gap-4 relative" ref={userMenuRef}>
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
                        src={`https://ui-avatars.com/api/?name=${currentUser?.firstName || 'U'}&background=0D8ABC&color=fff`} 
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

        {/* CONTENT */}
        <div className={`flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 scroll-smooth custom-scrollbar 
            ${isProfilePage ? 'pt-[100px]' : 'pt-[145px]'} lg:pt-8`}
        >
          <div className="max-w-5xl mx-auto">
            {/* PASS CONTEXT TO CHILDREN */}
            <Outlet context={{ addToast, currentUser, setCurrentUser }} /> 
          </div>
        </div>

      </div>

      <BottomNav />
      
    </div>
  );
}