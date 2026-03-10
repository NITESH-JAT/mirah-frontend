import React, { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Placeholder from '../components/Placeholder';

// Layouts
import AuthLayout from '../components/Auth/AuthLayout';
import DashboardLayout from '../components/layout/DashboardLayout';

// Guards
import AuthGuard from '../components/guards/AuthGuard';
import GuestGuard from '../components/guards/GuestGuard';

// Lazy Pages
const LoginForm = lazy(() => import('../components/Auth/LoginForm').then(m => ({ default: m.LoginForm })));
const RegisterForm = lazy(() => import('../components/Auth/RegisterForm').then(m => ({ default: m.RegisterForm })));
const TermsPage = lazy(() => import('../components/Auth/TermsPage').then(m => ({ default: m.TermsPage })));
const VerificationForm = lazy(() => import('../components/Auth/VerificationForm').then(m => ({ default: m.VerificationForm })));
const Profile = lazy(() => import('../pages/dashboard/Profile'));
const VendorKyc = lazy(() => import('../pages/vendor/Kyc'));
const VendorShop = lazy(() => import('../pages/vendor/Shop'));
const Messages = lazy(() => import('../pages/chat/Messages'));

export const routes = [
  // --- AUTH ROUTES ---
  {
    path: '/',
    element: (
      <GuestGuard>
        <AuthLayout />
      </GuestGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <LoginForm /> },
      { path: 'register', element: <RegisterForm /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'verification', element: <VerificationForm /> }
    ]
  },
  
  // --- DASHBOARD ROUTES---
  {
    path: '/dashboard',
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard/shopping" replace /> },
    
      { path: 'shopping', element: <Placeholder title="Shopping" /> },

      { 
        path: 'profile', 
        element: <Profile />
      },
      { 
        path: 'projects', 
        element: <Placeholder title="My Projects" />
      },
      { 
        path: 'messages', 
        element: <Messages />
      }
    ]
  },

  // --- VENDOR ROUTES ---
  {
    path: '/vendor',
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/vendor/shop" replace /> },
      { path: 'shop', element: <VendorShop /> },
      { path: 'kyc', element: <VendorKyc /> },
      { path: 'profile', element: <Profile /> },
      { path: 'messages', element: <Messages /> }
    ]
  },
  
  // --- FALLBACK ---
  { path: '*', element: <Navigate to="/login" replace /> }
];