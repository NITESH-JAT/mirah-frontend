import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const InputField = ({ label, value, onChange, name, readOnly, placeholder }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{label}</label>
    <input
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-dark/20 transition-all
        ${readOnly ? 'bg-[#F8F9FA] border-gray-100 text-gray-500' : 'bg-white border-gray-200 focus:border-primary-dark'}
      `}
    />
  </div>
);

const ActionCard = ({ icon, title, desc, onClick, colorClass = "bg-gray-50 text-gray-600" }) => (
  <div onClick={onClick} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="text-[14px] font-bold text-gray-800">{title}</h4>
      <p className="text-[11px] text-gray-400">{desc}</p>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="m9 18 6-6-6-6"/></svg>
  </div>
);

export default function Profile() {
  const { addToast, setCurrentUser } = useOutletContext();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Custom Confirmation State for Deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Data State for Editing
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await authService.getProfile();
      setProfile(data);
      // Initialize edit form with data
      setEditForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        countryCode: data.countryCode || '',
        email: data.email || '', 
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        pinCode: data.pinCode || ''
      });
      setLoading(false);
    } catch (err) {
      addToast(err.message || "Failed to load profile", "error");
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async () => {
    try {
      const updated = await authService.updateProfile(editForm);
      setProfile(updated);
      setIsEditing(false);
      setCurrentUser(updated); // Update global user context for header
      addToast("Profile updated successfully!", "success");
    } catch (err) {
      addToast(err.message || "Update failed", "error");
    }
  };

  const confirmDeleteAccount = async () => {
    try {
      await authService.deleteProfile();
      addToast("Account deleted successfully.", "success");
      navigate('/login');
    } catch (err) {
      addToast(err.message || "Delete failed", "error");
      setShowDeleteConfirm(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading Profile...</div>;
  if (!profile) return null;

  const isJeweller = profile.userType === 'vendor' || profile.userType === 'jeweller';

  return (
    <div className="w-full pb-10 animate-fade-in">
      
      {/* 1. VENDOR KYC BANNER (Shown only to jewellers without APPROVED status) */}
      {isJeweller && profile.kycStatus !== 'APPROVED' && (
        <div className={`mb-6 rounded-2xl p-5 md:p-6 border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm transition-all
          ${profile.kycStatus === 'IN_REVIEW' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}
        `}>
          <div className="flex items-center gap-4">
            <div className={`p-3 shrink-0 rounded-full ${profile.kycStatus === 'IN_REVIEW' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
              {profile.kycStatus === 'IN_REVIEW' ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              )}
            </div>
            <div>
              <h3 className={`font-bold text-[15px] ${profile.kycStatus === 'IN_REVIEW' ? 'text-yellow-800' : 'text-red-800'}`}>
                {profile.kycStatus === 'IN_REVIEW' ? 'KYC Under Review' : 'KYC Pending'}
              </h3>
              <p className={`text-[13px] mt-0.5 leading-snug ${profile.kycStatus === 'IN_REVIEW' ? 'text-yellow-700' : 'text-red-600/90'}`}>
                {profile.kycStatus === 'IN_REVIEW' 
                  ? 'Your documents are being verified by our team. We will notify you once approved.' 
                  : 'You must complete your KYC verification to start accepting orders and listing products.'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/kyc')}
            className={`w-full md:w-auto px-6 py-2.5 rounded-full text-[13px] font-bold shadow-sm transition-all whitespace-nowrap cursor-pointer
              ${profile.kycStatus === 'IN_REVIEW' ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-red-600 text-white hover:bg-red-700'}
            `}
          >
            {profile.kycStatus === 'IN_REVIEW' ? 'View Status' : 'Complete KYC'}
          </button>
        </div>
      )}

      {/* 2. BASIC INFO CARD */}
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <h2 className="font-sans text-lg font-bold text-gray-800">Basic Information</h2>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-full border border-red-100 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                Cancel
                </button>
                <button onClick={handleUpdate} className="px-4 py-1.5 rounded-full bg-primary-dark text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer">
                Save Changes
                </button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-auto flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-blue-50 border-2 border-primary-dark/10 flex items-center justify-center text-primary-dark shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-gray-800 text-lg">{profile.firstName} {profile.lastName}</h3>
              <p className="text-xs text-gray-400 capitalize">{isJeweller ? 'Jeweller' : 'Customer'}</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-5">
            <InputField label="First Name" name="firstName" value={editForm.firstName} onChange={handleInputChange} readOnly={!isEditing} />
            <InputField label="Last Name" name="lastName" value={editForm.lastName} onChange={handleInputChange} readOnly={!isEditing} />
            
            <InputField label="Email Address" name="email" value={editForm.email} readOnly={true} />
            <InputField label="Phone Number" name="phone" value={`${editForm.countryCode || ''} ${editForm.phone}`} readOnly={true} />

            <div className="md:col-span-2">
                <InputField label="Address" name="address" value={editForm.address} onChange={handleInputChange} readOnly={!isEditing} placeholder="Enter your full address" />
            </div>

            <InputField label="City" name="city" value={editForm.city} onChange={handleInputChange} readOnly={!isEditing} />
            <InputField label="State" name="state" value={editForm.state} onChange={handleInputChange} readOnly={!isEditing} />
            <InputField label="Country" name="country" value={editForm.country} onChange={handleInputChange} readOnly={!isEditing} />
            <InputField label="Pin Code" name="pinCode" value={editForm.pinCode} onChange={handleInputChange} readOnly={!isEditing} />
          </div>
        </div>
      </div>

      {/* 3. ACTIONS GRID */}
      <h3 className="text-sm font-bold text-gray-800 mb-4 px-1">Account Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        
        {/* Conditional: Customer vs Jeweller */}
        {!isJeweller ? (
            <>
                <ActionCard 
                    title="My Orders" desc="Track, return, or buy things again" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
                    colorClass="bg-blue-50 text-blue-600"
                    onClick={() => addToast("Orders page coming soon!", "success")}
                />
                <ActionCard 
                    title="Wishlist" desc="Your saved items" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>}
                    colorClass="bg-red-50 text-red-500"
                    onClick={() => addToast("Wishlist coming soon!", "success")}
                />
                <ActionCard 
                    title="Coupons" desc="Your available discounts" 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.6 3.6c-.4.4-.6.9-.6 1.4v14c0 .5.2 1 .6 1.4.4.4.9.6 1.4.6h14c.5 0 1-.2 1.4-.6.4-.4.6-.9.6-1.4V5c0-.5-.2-1-.6-1.4-.4-.4-.9-.6-1.4-.6H5c-.5 0-1 .2-1.4.6z"/><path d="M6 12h12"/></svg>}
                    colorClass="bg-green-50 text-green-600"
                    onClick={() => addToast("No coupons available yet.", "error")}
                />
            </>
        ) : (
            <ActionCard 
                title="Manage Orders" desc="View orders received from customers" 
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 7v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>}
                colorClass="bg-indigo-50 text-indigo-600"
                onClick={() => addToast("Opening Order Manager...", "success")}
            />
        )}

        <ActionCard 
            title="Help Center" desc="Need help? Contact us" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>}
            onClick={() => addToast("Support is currently offline.", "error")}
        />
        
        <ActionCard 
            title="Change Password" desc="Update your security credentials" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
            onClick={() => {
                const newPass = prompt("Enter new password (min 8 chars):");
                if(newPass && newPass.length >= 8) {
                    authService.changePassword({ newPassword: newPass })
                        .then(() => addToast("Password changed successfully", "success"))
                        .catch(e => addToast(e.message, "error"));
                } else if (newPass) {
                    addToast("Password too short", "error");
                }
            }}
        />
      </div>

      {/* 4. DANGER ZONE */}
      <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
            <h4 className="text-sm font-bold text-red-800">Danger Zone</h4>
            <p className="text-[12px] text-red-600/80">Delete account or Logout securely</p>
        </div>
        
        {showDeleteConfirm ? (
            <div className="flex items-center gap-3 bg-red-100/50 p-1.5 rounded-xl border border-red-200">
                <span className="text-[12px] text-red-800 font-bold px-2">Are you sure?</span>
                <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-white text-gray-600 text-xs font-bold rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                <button 
                    onClick={confirmDeleteAccount}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 transition-colors cursor-pointer"
                >
                    Yes, Delete
                </button>
            </div>
        ) : (
            <div className="flex gap-3">
                <button 
                    onClick={handleLogout}
                    className="px-5 py-2.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-xl shadow-sm hover:bg-red-50 transition-colors cursor-pointer"
                >
                    Log Out
                </button>
                <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-red-700 transition-colors cursor-pointer"
                >
                    Delete Account
                </button>
            </div>
        )}
      </div>

    </div>
  );
}