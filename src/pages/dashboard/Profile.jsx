import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const InputField = ({ label, value, onChange, name, readOnly, placeholder, type = "text" }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{label}</label>
    <input
      type={type}
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

const MobileNumberField = ({ countryCode, phone }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Mobile Number</label>
    <div className="flex gap-3">
      <input
        type="text"
        value={countryCode || ''}
        readOnly
        className="w-[110px] px-4 py-3 rounded-xl border text-sm font-semibold focus:outline-none transition-all bg-[#F8F9FA] border-gray-100 text-gray-500"
      />
      <input
        type="text"
        value={phone || ''}
        readOnly
        className="flex-1 px-4 py-3 rounded-xl border text-sm font-semibold focus:outline-none transition-all bg-[#F8F9FA] border-gray-100 text-gray-500"
      />
    </div>
  </div>
);

export default function Profile() {
  const { addToast, setCurrentUser } = useOutletContext();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pictureUploading, setPictureUploading] = useState(false);
  
  // Data State for Editing
  const [editForm, setEditForm] = useState({});

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

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
        email: data.email || '', // Readonly mostly
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
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

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPictureUploading(true);
    try {
      const savedUser = await authService.uploadProfilePicture(file);
      setCurrentUser(savedUser);
      setProfile((prev) => ({ ...(prev || {}), profileImageUrl: savedUser?.profileImageUrl }));
      addToast("Profile picture updated!", "success");
    } catch (err) {
      addToast(err.message || "Failed to upload profile picture", "error");
    } finally {
      setPictureUploading(false);
      // reset input so selecting same file works
      e.target.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        await authService.deleteProfile();
        addToast("Account deleted.", "success");
        navigate('/login');
      } catch (err) {
        addToast(err.message || "Delete failed", "error");
      }
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      addToast("Please enter your current password.", "error");
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      addToast("New password must be at least 8 characters.", "error");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      addToast("New password and confirmation do not match.", "error");
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      addToast("Password changed successfully.", "success");
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      addToast(err.message || "Failed to change password.", "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading Profile...</div>;
  if (!profile) return null;

  const isJeweller = profile.userType === 'vendor' || profile.userType === 'jeweller';

  return (
    <div className="w-full pb-10 animate-fade-in">
      
      {/* 1. BASIC INFO CARD */}
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
          {/* Avatar Section */}
          <div className="w-full lg:w-auto flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full p-1 border border-gray-100 relative group">
              <img 
                src={
                  profile?.profileImageUrl ||
                  `https://ui-avatars.com/api/?name=${profile.firstName}+${profile.lastName}&background=0D8ABC&color=fff&size=128`
                } 
                className="w-full h-full rounded-full object-cover" 
                alt="Profile" 
              />
            </div>
            <input
              type="file"
              accept="image/*"
              id="profile_picture_input"
              className="hidden"
              onChange={handleProfilePictureChange}
            />
            <button
              type="button"
              onClick={() => document.getElementById('profile_picture_input')?.click()}
              disabled={pictureUploading}
              className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pictureUploading ? 'Uploading…' : 'Change Photo'}
            </button>
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
            <MobileNumberField countryCode={editForm.countryCode} phone={editForm.phone} />

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

      {/* 2. CHANGE PASSWORD */}
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-sans text-lg font-bold text-gray-800">Change Password</h3>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left gutter (align with Basic Info avatar column on desktop) */}
          <div className="hidden lg:block w-[168px]" />

          <div className="flex-1 w-full grid grid-cols-1 gap-5">
            <InputField
              label="Current Password"
              name="currentPassword"
              type="password"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              placeholder="Enter current password"
              readOnly={false}
            />

            <InputField
              label="New Password"
              name="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              placeholder="Min 8 characters"
              readOnly={false}
            />
            <InputField
              label="Confirm New Password"
              name="confirmNewPassword"
              type="password"
              value={passwordForm.confirmNewPassword}
              onChange={handlePasswordChange}
              placeholder="Re-enter new password"
              readOnly={false}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={passwordLoading}
            className="px-5 py-2.5 rounded-xl bg-primary-dark text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {passwordLoading ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* 3. DANGER ZONE */}
      <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
            <h4 className="text-sm font-bold text-red-800">Danger Zone</h4>
            <p className="text-[12px] text-red-600/80">Delete account or Logout securely</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={handleLogout}
                className="px-5 py-2.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-xl shadow-sm hover:bg-red-50 transition-colors cursor-pointer"
            >
                Log Out
            </button>
            <button 
                onClick={handleDeleteAccount}
                className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-red-700 transition-colors cursor-pointer"
            >
                Delete Account
            </button>
        </div>
      </div>

    </div>
  );
}