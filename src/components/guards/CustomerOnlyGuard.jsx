import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const isVendorUser = (u) => {
  const t = String(u?.userType || '').toLowerCase();
  return t === 'vendor' || t === 'jeweller';
};

const CustomerOnlyGuard = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // If user exists but is vendor/jeweller, block access to customer-only routes.
  if (user && isVendorUser(user)) {
    return <Navigate to="/vendor/explore" state={{ from: location }} replace />;
  }

  return children;
};

export default CustomerOnlyGuard;

