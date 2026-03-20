import React, { lazy } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
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
const Profile = lazy(() => import('../pages/customer/Profile'));
const Shopping = lazy(() => import('../pages/customer/Shopping'));
const Cart = lazy(() => import('../pages/customer/Cart'));
const Checkout = lazy(() => import('../pages/customer/Checkout'));
const Orders = lazy(() => import('../pages/customer/Orders'));
const OrderSuccess = lazy(() => import('../pages/customer/OrderSuccess'));
const Projects = lazy(() => import('../pages/customer/Projects'));
const ProjectDetails = lazy(() => import('../pages/customer/ProjectDetails'));
const ProjectBids = lazy(() => import('../pages/customer/ProjectBids'));
const VendorProfile = lazy(() => import('../pages/customer/VendorProfile'));
const ProductDetails = lazy(() => import('../pages/customer/ProductDetails'));
const SimilarProducts = lazy(() => import('../pages/customer/SimilarProducts'));
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
const Faq = lazy(() => import('../pages/customer/Faq'));

function DashboardToCustomerRedirect() {
  const location = useLocation();
  const nextPath = String(location?.pathname || '/dashboard').replace(/^\/dashboard(?=\/|$)/, '/customer');
  const next = `${nextPath}${location?.search || ''}${location?.hash || ''}`;
  return <Navigate to={next} replace />;
}

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
  
  // --- CUSTOMER ROUTES---
  {
    path: '/customer',
    element: (
      <AuthGuard>
        <CustomerOnlyGuard>
          <DashboardLayout />
        </CustomerOnlyGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/customer/shopping" replace /> },
    
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

  // --- BACKWARD COMPAT: /dashboard/* -> /customer/* ---
  {
    path: '/dashboard/*',
    element: <DashboardToCustomerRedirect />,
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