import React from 'react';
import CarouselPanel from './CarouselPanel';

export default function AuthLayout({ children }) {
  return (
    <div className="flex h-screen w-full bg-[#F6F7F9] overflow-hidden">
      {/* Left Content Area */}
      <div className="w-full lg:w-1/2 h-full flex flex-col px-6 py-8 lg:px-12 lg:py-10">
        
        {/* Brand Header */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-primary-dark rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <span className="font-serif text-2xl text-primary-dark font-bold italic tracking-tight">Mirah</span>
        </div>

        {/* Form Center Container */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-h-full overflow-y-auto no-scrollbar">
            {children}
          </div>
        </div>

        {/* Bottom Spacer/Footer for consistency */}
        <div className="h-8 shrink-0 lg:hidden" />
      </div>

      {/* Right Carousel Area */}
      <CarouselPanel />
    </div>
  );
}