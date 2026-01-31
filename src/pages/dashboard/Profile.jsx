import React, { useState } from 'react';

export default function Profile() {
  const [userData, setUserData] = useState({
    fullName: "Amanda Haydenson",
    phone: "+91 62029 48676",
    city: "Mumbai, India",
    password: "••••••"
  });

  return (
    <div className="w-full">
      
      {/* 1. Basic Info Section */}
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <h2 className="font-sans text-lg font-bold text-gray-800">Basic Information</h2>
          <button className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Save Changes
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="w-full lg:w-auto flex flex-col items-center gap-3">
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full p-1 border border-gray-100 relative group cursor-pointer">
              <img 
                src="https://ui-avatars.com/api/?name=Amanda+H&background=random" 
                className="w-full h-full rounded-full object-cover" 
                alt="Profile" 
              />
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-white text-xs font-medium">Edit</span>
              </div>
            </div>
            {/* Mobile Name Display */}
            <div className="lg:hidden text-center">
              <h3 className="font-bold text-gray-800 text-lg">{userData.fullName}</h3>
              <p className="text-xs text-gray-400">Jeweller Account</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Full Name</label>
              <div className="w-full px-4 py-3 bg-[#F8F9FA] rounded-xl border border-gray-100 text-sm font-semibold text-gray-700">
                {userData.fullName}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Phone Number</label>
              <div className="w-full px-4 py-3 bg-[#F8F9FA] rounded-xl border border-gray-100 text-sm font-semibold text-gray-700">
                {userData.phone}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">City</label>
              <div className="w-full px-4 py-3 bg-[#F8F9FA] rounded-xl border border-gray-100 text-sm font-semibold text-gray-700">
                {userData.city}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Password</label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 bg-[#F8F9FA] rounded-xl border border-gray-100 text-sm font-semibold text-gray-700 flex items-center">
                  <span className="tracking-widest mt-1">{userData.password}</span>
                </div>
                <button className="px-4 rounded-xl bg-white border border-gray-200 text-xs font-bold text-primary-dark hover:bg-gray-50">
                  Change
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* History Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-5 pb-4 border-b border-gray-50">My Bidding History</h3>
          <div className="space-y-4">
             <div className="flex items-center gap-3">
               <span className="w-8 h-8 flex items-center justify-center bg-green-50 rounded-full text-green-600">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
               </span>
               <span className="text-[13px] text-gray-500">Total Projects Completed: <b className="text-gray-900 ml-1">162</b></span>
             </div>
             <div className="flex items-center gap-3">
               <span className="w-8 h-8 flex items-center justify-center bg-orange-50 rounded-full text-orange-600">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
               </span>
               <span className="text-[13px] text-gray-500">Active Bids: <b className="text-gray-900 ml-1">3</b></span>
             </div>
             <div className="flex items-center gap-3">
               <span className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-full text-blue-600">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
               </span>
               <span className="text-[13px] text-gray-500">On Going Project: <b className="text-gray-900 ml-1">1</b></span>
             </div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-5 pb-4 border-b border-gray-50">Revenue Statistics</h3>
          <div className="flex items-center justify-center h-32 text-gray-300 text-xs font-medium border-2 border-dashed border-gray-100 rounded-xl">
             Chart Placeholder
          </div>
        </div>
      </div>
    </div>
  );
}