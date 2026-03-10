import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const GuestGuard = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    const isVendor = user.userType === 'vendor' || user.userType === 'jeweller';
    const kycStatus = String(user?.kyc?.status || '').toLowerCase();
    const vendorLanding = kycStatus === 'accepted' ? '/vendor/shop' : '/vendor/kyc';
    return <Navigate to={isVendor ? vendorLanding : "/dashboard/profile"} replace />;
  }

  return children;
};

export default GuestGuard;