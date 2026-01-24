import React from 'react';
import CarouselPanel from './CarouselPanel';

export default function AuthLayout({ children }) {
  return (
    // h-[100dvh] ensures it fits mobile screens perfectly including URL bars
    <div className="flex h-[100dvh] w-full bg-[#F6F7F9] overflow-hidden font-sans">
      
      {/* Left Content Area - Scrollable on mobile to prevent cropping */}
      <div className="w-full lg:w-1/2 h-full flex flex-col relative bg-[#F6F7F9] overflow-y-auto overflow-x-hidden">
        
        {/* Brand Header - Sticky or fixed visual placement */}
        <div className="absolute top-6 left-6 lg:left-8 z-10 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-dark rounded-md flex items-center justify-center shadow-lg shadow-blue-900/20">
            <div className="w-3.5 h-3.5 border-2 border-white rotate-45"></div>
          </div>
          <span className="font-serif text-2xl text-primary-dark font-bold italic tracking-tight">Mirah</span>
        </div>

        {/* Form Center Container */}
        {/* Mobile: Standard padding and flex-start to allow scrolling. Desktop: Centered. */}
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[600px] lg:min-h-0 pt-16 pb-10 px-6 lg:px-6 lg:pt-14 lg:pb-0">
          {/* Mobile: Width 100% max-sm. Desktop: Compact 320px. */}
          <div className="w-full max-w-[380px] lg:max-w-[320px] animate-fade-in mx-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Right Carousel Area - Hidden on Mobile */}
      <div className="hidden lg:block w-1/2 h-full p-5 pl-0">
         <CarouselPanel />
      </div>
    </div>
  );
}