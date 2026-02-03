import React, { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// Layouts
import AuthLayout from '../components/Auth/AuthLayout';
import DashboardLayout from '../components/layout/DashboardLayout';

// Guards
import AuthGuard from '../components/guards/AuthGuard';
import GuestGuard from '../components/guards/GuestGuard';

// Lazy Pages
const LoginForm = lazy(() => import('../components/Auth/AuthForms').then(m => ({ default: m.LoginForm })));
const RegisterForm = lazy(() => import('../components/Auth/AuthForms').then(m => ({ default: m.RegisterForm })));
const VerificationForm = lazy(() => import('../components/Auth/AuthForms').then(m => ({ default: m.VerificationForm })));
const Profile = lazy(() => import('../pages/dashboard/Profile'));

const Placeholder = ({ title }) => (
  <div className="text-center mt-20 text-gray-400 font-sans">{title} Coming Soon</div>
);

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
      { path: 'verification', element: <VerificationForm /> } // New Route
    ]
  },
  
  // --- DASHBOARD ROUTES (Mixed Public/Protected) ---
  {
    path: '/dashboard',
    element: <DashboardLayout />, // Layout is always visible
    children: [
      { index: true, element: <Navigate to="/dashboard/shopping" replace /> },
      
      // PUBLIC PAGE: Shopping is now accessible without login
      { path: 'shopping', element: <Placeholder title="Shopping" /> },

      // PROTECTED PAGES: Wrapped in AuthGuard individually
      { 
        path: 'profile', 
        element: (
          <AuthGuard>
            <Profile />
          </AuthGuard>
        ) 
      },
      { 
        path: 'projects', 
        element: (
          <AuthGuard>
            <Placeholder title="My Projects" />
          </AuthGuard>
        ) 
      },
      { 
        path: 'messages', 
        element: (
          <AuthGuard>
            <Placeholder title="Messages" />
          </AuthGuard>
        ) 
      }
    ]
  },
  
  // --- FALLBACK ---
  { path: '*', element: <Navigate to="/login" replace /> }
];