import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomerStorefront } from '../../context/CustomerStorefrontContext';

export default function CustomerStoreRouteGuard({
  children,
  requirePurchasing = false,
  requireCatalog = false,
}) {
  const { loading, navVisible, catalogEnabled, purchasingEnabled } = useCustomerStorefront();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <svg className="animate-spin text-ink" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (requirePurchasing && !purchasingEnabled) {
    return <Navigate to={navVisible ? '/customer/shopping' : '/customer/projects?tab=list'} replace />;
  }

  if (requireCatalog && !catalogEnabled) {
    return <Navigate to={navVisible ? '/customer/shopping' : '/customer/projects?tab=list'} replace />;
  }

  return children;
}
