import React, { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Placeholder from '../components/Placeholder';

// Layouts
import AuthLayout from '../components/Auth/AuthLayout';
import DashboardLayout from '../components/layout/DashboardLayout';

// Guards
import AuthGuard from '../components/guards/AuthGuard';
import GuestGuard from '../components/guards/GuestGuard';
import CustomerOnlyGuard from '../components/guards/CustomerOnlyGuard';
import VendorOnlyGuard from '../components/guards/VendorOnlyGuard';

// Lazy Pages
const LoginForm = lazy(() => import('../components/Auth/LoginForm').then(m => ({ default: m.LoginForm })));
const RegisterForm = lazy(() => import('../components/Auth/RegisterForm').then(m => ({ default: m.RegisterForm })));
const TermsPage = lazy(() => import('../components/Auth/TermsPage').then(m => ({ default: m.TermsPage })));
const VerificationForm = lazy(() => import('../components/Auth/VerificationForm').then(m => ({ default: m.VerificationForm })));
const Profile = lazy(() => import('../pages/dashboard/Profile'));
const Shopping = lazy(() => import('../pages/dashboard/Shopping'));
const Cart = lazy(() => import('../pages/dashboard/Cart'));
const Checkout = lazy(() => import('../pages/dashboard/Checkout'));
const Orders = lazy(() => import('../pages/dashboard/Orders'));
const OrderSuccess = lazy(() => import('../pages/dashboard/OrderSuccess'));
const Projects = lazy(() => import('../pages/dashboard/Projects'));
const ProjectDetails = lazy(() => import('../pages/dashboard/ProjectDetails'));
const ProjectBids = lazy(() => import('../pages/dashboard/ProjectBids'));
const VendorProfile = lazy(() => import('../pages/dashboard/VendorProfile'));
const ProductDetails = lazy(() => import('../pages/dashboard/ProductDetails'));
const SimilarProducts = lazy(() => import('../pages/dashboard/SimilarProducts'));
const VendorKyc = lazy(() => import('../pages/vendor/Kyc'));
const VendorShop = lazy(() => import('../pages/vendor/Shop'));
const VendorExplore = lazy(() => import('../pages/vendor/Explore'));
const VendorExploreProject = lazy(() => import('../pages/vendor/ExploreProject'));
const VendorBids = lazy(() => import('../pages/vendor/Bids'));
const VendorBidsView = lazy(() => import('../pages/vendor/BidsView'));
const VendorAssignmentRequests = lazy(() => import('../pages/vendor/AssignmentRequests'));
const VendorAssignedProjects = lazy(() => import('../pages/vendor/AssignedProjects'));
const VendorManageProject = lazy(() => import('../pages/vendor/ManageProject'));
const Messages = lazy(() => import('../pages/chat/Messages'));
const Faq = lazy(() => import('../pages/dashboard/Faq'));

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
        <CustomerOnlyGuard>
          <DashboardLayout />
        </CustomerOnlyGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard/shopping" replace /> },
    
      { path: 'shopping', element: <Shopping /> },
      { path: 'shopping/:id', element: <ProductDetails /> },
      { path: 'shopping/:id/similar', element: <SimilarProducts /> },
      { path: 'cart', element: <Cart /> },
      { path: 'checkout', element: <Checkout /> },
      { path: 'orders', element: <Orders /> },
      { path: 'orders/success', element: <OrderSuccess /> },

      { 
        path: 'profile', 
        element: <Profile />
      },
      {
        path: 'faq',
        element: <Faq />,
      },
      { 
        path: 'projects', 
        element: <Projects />
      },
      {
        path: 'projects/:id',
        element: <ProjectDetails />,
      },
      {
        path: 'projects/:id/bids',
        element: <ProjectBids />,
      },
      {
        path: 'vendors/:vendorId',
        element: <VendorProfile />,
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
        <VendorOnlyGuard>
          <DashboardLayout />
        </VendorOnlyGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/vendor/shop" replace /> },
      { path: 'explore', element: <VendorExplore /> },
      { path: 'explore/:id', element: <VendorExploreProject /> },
      { path: 'bids', element: <VendorBids /> },
      { path: 'bids/:id', element: <VendorBidsView /> },
      { path: 'projects/assignment-requests', element: <VendorAssignmentRequests /> },
      { path: 'projects/assigned', element: <VendorAssignedProjects /> },
      { path: 'projects/:id', element: <VendorManageProject /> },
      { path: 'shop', element: <VendorShop /> },
      { path: 'kyc', element: <VendorKyc /> },
      { path: 'profile', element: <Profile /> },
      { path: 'faq', element: <Faq /> },
      { path: 'messages', element: <Messages /> }
    ]
  },
  
  // --- FALLBACK ---
  { path: '*', element: <Navigate to="/login" replace /> }
];