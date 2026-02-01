import React, { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import DashboardLayout from '../components/layout/DashboardLayout';

import AuthGuard from '../components/guards/AuthGuard';
import GuestGuard from '../components/guards/GuestGuard';

const LoginForm = lazy(() => import('../components/AuthForms').then(m => ({ default: m.LoginForm })));
const OTPForm = lazy(() => import('../components/AuthForms').then(m => ({ default: m.OTPForm })));
const RegisterForm = lazy(() => import('../components/AuthForms').then(m => ({ default: m.RegisterForm })));
const Profile = lazy(() => import('../pages/dashboard/Profile'));

const Placeholder = ({ title }) => (
  <div className="text-center mt-20 text-gray-400 font-sans">{title} Coming Soon</div>
);

export const routes = [
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
      { path: 'otp', element: <OTPForm /> },
      { path: 'register', element: <RegisterForm /> }
    ]
  },


  {
    path: '/dashboard',
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      { path: 'profile', element: <Profile /> },
      { path: 'shopping', element: <Placeholder title="Shopping" /> },
      { path: 'projects', element: <Placeholder title="My Projects" /> },
      { path: 'messages', element: <Placeholder title="Messages" /> }
    ]
  },

  
  { path: '*', element: <Navigate to="/login" replace /> }
];