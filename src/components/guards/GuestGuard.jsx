import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const GuestGuard = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    const isVendor = user.userType === 'vendor' || user.userType === 'jeweller';
    return <Navigate to={isVendor ? "/vendor/kyc" : "/dashboard/profile"} replace />;
  }

  return children;
};

export default GuestGuard;