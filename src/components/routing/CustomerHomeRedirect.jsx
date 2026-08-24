import React from 'react';
import { Navigate } from 'react-router-dom';
import { customerDefaultLandingPath, useCustomerStorefront } from '../../context/CustomerStorefrontContext';

export default function CustomerHomeRedirect() {
  const storefront = useCustomerStorefront();

  if (storefront.loading) return null;

  return <Navigate to={customerDefaultLandingPath(storefront)} replace />;
}
