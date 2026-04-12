import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { addressService } from '../../services/addressService';

const InputField = ({ label, value, onChange, name, readOnly, placeholder, type = "text", inputMode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-ink uppercase tracking-wide">{label}</label>
    <input
      type={type}
      name={name}
      value={value || ''}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold text-mid focus:outline-none focus:ring-1 focus:ring-walnut/20 transition-all
        ${readOnly ? 'bg-cream border-pale text-muted' : 'bg-white border-pale focus:border-walnut'}
      `}
    />
  </div>
);

const CheckboxField = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-[12px] text-ink cursor-pointer select-none">
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-pale text-ink focus:ring-walnut/30"
    />
    <span className="font-medium">{label}</span>
  </label>
);

const MobileNumberField = ({ countryCode, phone }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-ink uppercase tracking-wide">Mobile Number</label>
    <div className="flex gap-3">
      <input
        type="text"
        value={countryCode || ''}
        readOnly
        className="w-[110px] px-4 py-3 rounded-xl border text-sm font-semibold focus:outline-none transition-all bg-cream border-pale text-muted"
      />
      <input
        type="text"
        value={phone || ''}
        readOnly
        className="flex-1 px-4 py-3 rounded-xl border text-sm font-semibold focus:outline-none transition-all bg-cream border-pale text-muted"
      />
    </div>
  </div>
);

function normalizeAddress(a) {
  const id = a?.id ?? a?._id ?? a?.addressId ?? null;
  const type = String(a?.type ?? a?.addressType ?? '').toLowerCase();
  const isDefault = Boolean(a?.isDefault ?? a?.default ?? a?.is_default);
  return {
    raw: a,
    id,
    type,
    isDefault,
    name: a?.name ?? a?.fullName ?? a?.contactName ?? '',
    countryCode: a?.countryCode ?? '',
    phone: a?.phone ?? '',
    address: a?.address ?? a?.addressLine1 ?? a?.line1 ?? '',
    addressLine2: a?.addressLine2 ?? a?.line2 ?? '',
    city: a?.city ?? '',
    state: a?.state ?? '',
    country: a?.country ?? '',
    pinCode: a?.pinCode ?? a?.pincode ?? a?.postalCode ?? '',
  };
}

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

  // Delete account modal
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  // --- Addresses (customers only) ---
  const [addressTab, setAddressTab] = useState('billing'); // 'billing' | 'shipping'
  const [addressesByType, setAddressesByType] = useState({ billing: [], shipping: [] });
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressEditingId, setAddressEditingId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    type: 'billing',
    name: '',
    countryCode: '',
    phone: '',
    address: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    pinCode: '',
    isDefault: false,
  });

  const loadAddresses = async (forceType) => {
    const t = forceType || addressTab;
    setAddressesLoading(true);
    try {
      const [billingRaw, shippingRaw] = await Promise.all([
        addressService.list({ type: 'billing' }),
        addressService.list({ type: 'shipping' }),
      ]);
      setAddressesByType({
        billing: (billingRaw || []).map(normalizeAddress).filter((x) => x.id),
        shipping: (shippingRaw || []).map(normalizeAddress).filter((x) => x.id),
      });
      // keep tab stable
      if (t !== 'billing' && t !== 'shipping') setAddressTab('billing');
    } catch (err) {
      addToast(err?.message || 'Failed to load addresses', 'error');
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await authService.getProfile();
        const merged = data;
        if (cancelled) return;
        setProfile(merged);
        // Initialize edit form with data
        setEditForm({
          firstName: merged?.firstName || '',
          lastName: merged?.lastName || '',
          phone: merged?.phone || '',
          countryCode: merged?.countryCode || '',
          email: merged?.email || '', // Readonly mostly
          address: merged?.address || '',
          city: merged?.city || '',
          state: merged?.state || '',
          country: merged?.country || '',
          pinCode: merged?.pinCode || '',
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        addToast(err.message || 'Failed to load profile', 'error');
        setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  useEffect(() => {
    if (!profile) return;
    const isCustomer = !['vendor', 'jeweller'].includes(String(profile.userType || '').toLowerCase());
    if (!isCustomer) return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.userType]);

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
    setDeleteAccountLoading(true);
    try {
      await authService.deleteProfile();
      addToast("Account deleted.", "success");
      setDeleteAccountModalOpen(false);
      navigate('/login');
    } catch (err) {
      addToast(err.message || "Delete failed", "error");
    } finally {
      setDeleteAccountLoading(false);
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

  if (loading)
    return (
      <div className="w-full pb-10 animate-fade-in">
        <div className="min-h-[calc(100vh-260px)] flex items-center justify-center">
          <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  if (!profile) return null;

  const isJeweller = profile.userType === 'vendor' || profile.userType === 'jeweller';
  const isCustomer = !isJeweller;

  const openCreateAddress = (type) => {
    const t = type || addressTab;
    setAddressEditingId(null);
    setAddressForm({
      type: t,
      name: '',
      countryCode: '',
      phone: '',
      address: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      pinCode: '',
      isDefault: false,
    });
    setAddressModalOpen(true);
  };

  const openEditAddress = (addr) => {
    setAddressEditingId(addr?.id || null);
    setAddressForm({
      type: addr?.type || addressTab,
      name: addr?.name || '',
      countryCode: addr?.countryCode || '',
      phone: addr?.phone || '',
      address: addr?.address || '',
      addressLine2: addr?.addressLine2 || '',
      city: addr?.city || '',
      state: addr?.state || '',
      country: addr?.country || '',
      pinCode: addr?.pinCode || '',
      isDefault: Boolean(addr?.isDefault),
    });
    setAddressModalOpen(true);
  };

  const saveAddress = async () => {
    if (addressSaving) return;
    const payload = {
      addressType: addressForm.type,
      name: String(addressForm.name || '').trim() || undefined,
      countryCode: String(addressForm.countryCode || '').trim() || undefined,
      phone: String(addressForm.phone || '').trim() || undefined,
      address: String(addressForm.address || '').trim(),
      addressLine2: String(addressForm.addressLine2 || '').trim() || undefined,
      city: String(addressForm.city || '').trim() || undefined,
      state: String(addressForm.state || '').trim() || undefined,
      country: String(addressForm.country || '').trim() || undefined,
      pinCode: String(addressForm.pinCode || '').trim() || undefined,
      isDefault: Boolean(addressForm.isDefault),
    };
    if (!payload.addressType) {
      addToast('Address type is required.', 'error');
      return;
    }
    if (!payload.address) {
      addToast('Address is required.', 'error');
      return;
    }
    setAddressSaving(true);
    try {
      if (addressEditingId) {
        await addressService.update({ id: addressEditingId, payload });
        addToast('Address updated.', 'success');
      } else {
        await addressService.create(payload);
        addToast('Address added.', 'success');
      }
      setAddressModalOpen(false);
      setAddressEditingId(null);
      await loadAddresses(addressForm.type);
    } catch (err) {
      addToast(err?.message || 'Failed to save address', 'error');
    } finally {
      setAddressSaving(false);
    }
  };

  const deleteAddress = async (addr) => {
    const id = addr?.id;
    if (!id) return;
    const ok = window.confirm('Delete this address?');
    if (!ok) return;
    try {
      await addressService.remove(id);
      addToast('Address deleted.', 'success');
      await loadAddresses(addr?.type);
    } catch (err) {
      addToast(err?.message || 'Failed to delete address', 'error');
    }
  };

  const setDefaultAddress = async (addr) => {
    const id = addr?.id;
    if (!id) return;
    try {
      await addressService.update({ id, payload: { isDefault: true } });
      addToast('Default address updated.', 'success');
      await loadAddresses(addr?.type);
    } catch (err) {
      addToast(err?.message || 'Failed to set default', 'error');
    }
  };

  return (
    <div className="w-full pb-10 animate-fade-in">
      
      {/* 1. BASIC INFO CARD */}
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-pale mb-6">
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <h2 className="font-sans text-lg font-bold text-ink">Basic Information</h2>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 rounded-full border border-pale text-xs font-semibold text-mid hover:bg-cream transition-colors cursor-pointer">
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-full border border-red-100 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                Cancel
                </button>
                <button onClick={handleUpdate} className="px-4 py-1.5 rounded-full bg-walnut text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer">
                Save Changes
                </button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Avatar Section */}
          <div className="w-full lg:w-auto flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full p-1 border border-pale relative group">
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
              className="px-4 py-1.5 rounded-full border border-pale text-xs font-semibold text-mid hover:bg-cream transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pictureUploading ? 'Uploading…' : 'Change Photo'}
            </button>
            <div className="text-center">
              <h3 className="font-bold text-ink text-lg">{profile.firstName} {profile.lastName}</h3>
              <p className="text-xs text-muted capitalize">{isJeweller ? 'Jeweller' : 'Customer'}</p>
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
      <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-pale mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-sans text-lg font-bold text-ink">Change Password</h3>
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
            className="px-5 py-2.5 rounded-xl bg-walnut text-blush text-xs font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {passwordLoading ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* 3. ADDRESSES (CUSTOMER ONLY) */}
      {isCustomer ? (
        <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-pale mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-sans text-lg font-bold text-ink">Addresses</h3>
            <button
              type="button"
              onClick={() => openCreateAddress(addressTab)}
              className="px-4 py-1.5 rounded-full border border-pale text-xs font-semibold text-mid hover:bg-cream transition-colors cursor-pointer"
            >
              Add Address
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="hidden lg:block w-[168px]" />

            <div className="flex-1 w-full">
              <div className="inline-flex rounded-2xl border border-pale bg-cream p-1">
                <button
                  type="button"
                  onClick={() => setAddressTab('billing')}
                  className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                    addressTab === 'billing' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-mid'
                  }`}
                >
                  Billing
                </button>
                <button
                  type="button"
                  onClick={() => setAddressTab('shipping')}
                  className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                    addressTab === 'shipping' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-mid'
                  }`}
                >
                  Shipping
                </button>
              </div>

              <div className="mt-5">
                {addressesLoading ? (
                  <div className="text-[13px] text-muted">Loading addresses…</div>
                ) : (addressesByType?.[addressTab] || []).length === 0 ? (
                  <div className="rounded-xl border border-pale bg-cream p-4 text-[13px] text-mid">
                    No {addressTab} addresses yet. Add one to continue.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(addressesByType?.[addressTab] || []).map((a) => (
                      <div key={String(a.id)} className="rounded-2xl border border-pale p-4 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-bold text-ink truncate">{a.name || 'Address'}</p>
                              {a.isDefault ? (
                                <span className="px-2 py-0.5 rounded-full bg-green-50 border border-green-100 text-[11px] font-bold text-green-700">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[12px] text-muted mt-1">
                              {[
                                a.address,
                                a.addressLine2,
                                a.city,
                                a.state,
                                a.country,
                                a.pinCode,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                            {(a.countryCode || a.phone) ? (
                              <p className="text-[12px] text-muted mt-1">
                                {`${a.countryCode || ''} ${a.phone || ''}`.trim()}
                              </p>
                            ) : null}
                          </div>

                          <div className="shrink-0 flex flex-wrap gap-2 justify-end">
                            {!a.isDefault ? (
                              <button
                                type="button"
                                onClick={() => setDefaultAddress(a)}
                                className="px-3 py-1.5 rounded-lg border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer"
                              >
                                Set default
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => openEditAddress(a)}
                              className="px-3 py-1.5 rounded-lg border border-pale text-[12px] font-semibold text-mid hover:bg-cream cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAddress(a)}
                              className="px-3 py-1.5 rounded-lg border border-red-100 text-[12px] font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {addressModalOpen ? (
            <div
              className="fixed inset-0 z-[80] bg-ink/25 flex items-end sm:items-center justify-center px-3 sm:px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
              onMouseDown={() => {
                if (!addressSaving) setAddressModalOpen(false);
              }}
            >
              <div
                className="w-full max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-sm border border-pale overflow-hidden max-h-[calc(100dvh-24px)] flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-4 border-b border-pale flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-ink">
                      {addressEditingId ? 'Edit address' : 'Add address'}
                    </p>
                    <p className="text-[12px] text-muted mt-1">
                      {addressForm.type === 'billing' ? 'Billing address' : 'Shipping address'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(false)}
                    disabled={addressSaving}
                    className="p-2 rounded-xl hover:bg-cream text-muted cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-[11px] font-medium text-ink uppercase tracking-wide">Type</label>

                    <div className="mt-2 inline-flex rounded-2xl border border-pale bg-cream p-1">
                      <button
                        type="button"
                        onClick={() => setAddressForm((p) => ({ ...p, type: 'billing' }))}
                        className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                          addressForm.type === 'billing' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-mid'
                        }`}
                      >
                        Billing
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddressForm((p) => ({ ...p, type: 'shipping' }))}
                        className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-colors cursor-pointer ${
                          addressForm.type === 'shipping' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-mid'
                        }`}
                      >
                        Shipping
                      </button>
                    </div>
                  </div>

                  <InputField
                    label="Full Name"
                    name="name"
                    value={addressForm.name}
                    onChange={(e) => setAddressForm((p) => ({ ...p, name: e.target.value }))}
                    readOnly={false}
                    placeholder="Name"
                  />
                  <InputField
                    label="Phone"
                    name="phone"
                    value={addressForm.phone}
                    onChange={(e) =>
                      setAddressForm((p) => {
                        const raw = e.target.value || '';
                        const digits = raw.replace(/\D/g, '');
                        return { ...p, phone: digits };
                      })
                    }
                    readOnly={false}
                    placeholder="Phone"
                    type="tel"
                    inputMode="numeric"
                  />
                  <div className="md:col-span-2">
                    <InputField
                      label="Address *"
                      name="address"
                      value={addressForm.address}
                      onChange={(e) => setAddressForm((p) => ({ ...p, address: e.target.value }))}
                      readOnly={false}
                      placeholder="House no, street, area"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <InputField
                      label="Address line 2"
                      name="addressLine2"
                      value={addressForm.addressLine2}
                      onChange={(e) => setAddressForm((p) => ({ ...p, addressLine2: e.target.value }))}
                      readOnly={false}
                      placeholder="Landmark, apartment, etc."
                    />
                  </div>

                  <InputField
                    label="City"
                    name="city"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))}
                    readOnly={false}
                    placeholder="City"
                  />
                  <InputField
                    label="State"
                    name="state"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value }))}
                    readOnly={false}
                    placeholder="State"
                  />
                  <InputField
                    label="Country"
                    name="country"
                    value={addressForm.country}
                    onChange={(e) => setAddressForm((p) => ({ ...p, country: e.target.value }))}
                    readOnly={false}
                    placeholder="Country"
                  />
                  <InputField
                    label="Pin Code"
                    name="pinCode"
                    value={addressForm.pinCode}
                    onChange={(e) => setAddressForm((p) => ({ ...p, pinCode: e.target.value }))}
                    readOnly={false}
                    placeholder="Pin code"
                  />

                  <div className="md:col-span-2">
                    <CheckboxField
                      checked={addressForm.isDefault}
                      onChange={(v) => setAddressForm((p) => ({ ...p, isDefault: v }))}
                      label="Set as default for this type"
                    />
                  </div>
                </div>
                </div>

                <div className="shrink-0 px-5 py-4 border-t border-pale bg-white flex justify-end gap-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(false)}
                    disabled={addressSaving}
                    className="px-4 py-2 rounded-xl border border-pale text-[12px] font-semibold text-mid hover:bg-cream disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveAddress}
                    disabled={addressSaving}
                    className="px-5 py-2 rounded-xl bg-walnut text-blush text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {addressSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
                onClick={() => setDeleteAccountModalOpen(true)}
                className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-red-700 transition-colors cursor-pointer"
            >
                Delete Account
            </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteAccountModalOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-ink/25 flex items-center justify-center px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)]"
          onMouseDown={() => !deleteAccountLoading && setDeleteAccountModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-pale overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-pale">
              <p className="text-[14px] font-extrabold text-ink">Delete Account</p>
              <p className="mt-1 text-[12px] text-muted">This action cannot be undone</p>
            </div>

            <div className="px-5 py-4">
              <p className="text-[13px] text-mid">
                Are you sure you want to delete your account? This will permanently remove all your data, addresses, and orders.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-pale flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteAccountModalOpen(false)}
                disabled={deleteAccountLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-white border border-pale text-[12px] font-bold text-mid hover:bg-cream disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {deleteAccountLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}