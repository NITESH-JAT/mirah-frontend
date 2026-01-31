import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function DashboardLayout({ children, title }) {
  const location = useLocation();
  const isProfilePage = location.pathname.includes('profile');

  return (
    <div className="h-screen w-full bg-[#F8F9FA] flex overflow-hidden font-sans">
      
      {/* 1. Desktop Sidebar */}
      <Sidebar />

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full w-full lg:ml-[240px] relative">
        
        {/* === MOBILE HEADER (Single Gradient Solution) === */}
        <div className="lg:hidden fixed top-0 left-0 w-full z-50 pointer-events-none">
           
           {/* THE BACKDROP: One single element handling both solid & fade */}
           <div 
             className="w-full absolute top-0 left-0"
             style={{
               // Height adapts: Taller for Search, Shorter for Profile
               height: isProfilePage ? '85px' : '130px', 
               // The Magic Gradient:
               // 1. #0D2E4E (Solid Navy)
               // 2. Starts fading ONLY after the safe zone (60% or 45%)
               // 3. Ends at rgba(13,46,78, 0) -> Fades to transparent NAVY (not white/gray) prevents muddy edges
               background: isProfilePage 
                 ? 'linear-gradient(180deg, #0D2E4E 50%, rgba(13, 46, 78, 0) 100%)' 
                 : 'linear-gradient(180deg, #0D2E4E 45%, rgba(13, 46, 78, 0) 100%)'
             }}
           />

           {/* CONTENT LAYER (Pointer events re-enabled for interactivity) */}
           <div className="relative w-full pointer-events-auto">
              
              {/* Row 1: Logo & Menu (Always in the solid part) */}
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10 shadow-sm">
                      <div className="w-3.5 h-3.5 border-2 border-white rotate-45"></div>
                    </div>
                    <span className="font-serif text-[20px] text-white font-bold italic tracking-wide">Mirah</span>
                  </div>
                  
                  <button className="text-white opacity-90 hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="13" y1="18" x2="21" y2="18"></line>
                    </svg>
                  </button>
              </div>

              {/* Row 2: Search Bar (Floating in the blend zone) */}
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

        {/* === DESKTOP HEADER === */}
        <div className="hidden lg:flex h-16 bg-white border-b border-gray-100 px-8 items-center justify-between shrink-0 sticky top-0 z-40">
          <h1 className="font-serif text-xl font-bold text-gray-800">{title}</h1>
          <div className="flex items-center gap-4">
             <div className="text-right leading-tight">
                <p className="text-[13px] font-bold text-gray-800">Amanda Haydenson</p>
                <p className="text-[11px] text-gray-400">Jeweller ID: #4829</p>
             </div>
             <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden border border-gray-100 shadow-sm">
                <img src="https://ui-avatars.com/api/?name=Amanda+H&background=0D8ABC&color=fff" alt="User" />
             </div>
          </div>
        </div>

        {/* === SCROLLABLE CONTENT === */}
        {/* Adjusted padding top to ensure content starts visibly under the transparent part of the header */}
        <div className={`flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 scroll-smooth 
            ${!isProfilePage ? 'pt-32' : 'pt-20'} lg:pt-8`}
        >
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>

      </div>

      {/* 3. Mobile Bottom Nav */}
      <BottomNav />
      
    </div>
  );
}