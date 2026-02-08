import React, { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

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
      { path: 'terms', element: <TermsPage /> },
      { path: 'verification', element: <VerificationForm /> }
    ]
  },
  
  // --- DASHBOARD ROUTES---
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard/shopping" replace /> },
    
      { path: 'shopping', element: <Placeholder title="Shopping" /> },


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