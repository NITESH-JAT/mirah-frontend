import React from 'react';
import { Outlet } from 'react-router-dom';
import CarouselPanel from './CarouselPanel';
import logo from '../../assets/logo.png';

export default function AuthLayout() {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans">
      
      {/* Left Panel - Form Side */}
      <div className="w-full lg:w-1/2 h-full flex flex-col relative bg-white overflow-y-auto lg:overflow-hidden">
        
        {/* Logo */}
        <div className="w-full p-6 pb-0 lg:absolute lg:top-6 lg:left-8 lg:p-0 z-10 flex items-center gap-2 shrink-0">
          <div className="w-10 h-10  rounded-lg flex items-center justify-center shadow-sm shadow-blue-900/20 overflow-hidden">
            <img 
              src={logo} 
              alt="Mirah Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <span className="font-serif text-2xl text-primary-dark font-bold italic tracking-tight">Mirah</span>
        </div>

        <div className="flex-1 w-full lg:h-full flex flex-col justify-start lg:justify-center items-center px-5 sm:px-8 pt-8 pb-8 lg:pt-16 lg:pb-4">
          <div className="w-full max-w-[420px] lg:max-w-[440px]"> 
            <Outlet />
          </div>
        </div>
      </div>

      {/* Right Panel - Carousel */}
      <div className="hidden lg:block w-1/2 h-full p-4 pl-0">
         <div className="h-full w-full">
            <CarouselPanel />
         </div>
      </div>
    </div>
  );
}