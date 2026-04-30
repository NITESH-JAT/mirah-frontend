import React from 'react';
import { Outlet } from 'react-router-dom';
import CarouselPanel from './CarouselPanel';
import logo from '../../assets/logo.png';

export default function AuthLayout() {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans">
      
      {/* Left Panel */}
      <div className="w-full lg:w-1/2 h-full flex flex-col relative bg-white">
        
        {/* FIXED NAVBAR */}
        <div className="w-full px-6 py-5 lg:px-8 lg:py-2 flex items-center gap-2 shrink-0 z-20 bg-white border-b border-transparent">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm shadow-walnut/10 overflow-hidden">
            <img 
              src={logo} 
              alt="Arviah Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <span className="font-serif text-2xl text-ink font-bold italic tracking-tight">Arviah</span>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 w-full lg:w-[calc(100%-16px)] lg:mx-auto overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center">
          <div className="w-full max-w-[420px] lg:max-w-[440px] px-5 sm:px-8 py-2 lg:py-2 my-auto"> 
            <Outlet />
          </div>
        </div>
      </div>

      {/* Right Panel - Carousel (Hidden on Mobile) */}
      <div className="hidden lg:block w-1/2 h-full p-4 pl-0">
         <div className="h-full w-full">
            <CarouselPanel />
         </div>
      </div>
    </div>
  );
}