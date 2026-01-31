import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { LoginForm, OTPForm, RegisterForm } from './components/AuthForms';
import Welcome from './pages/Welcome';
import DashboardLayout from './components/layout/DashboardLayout'; // Import new layout
import Profile from './pages/dashboard/Profile'; // Import new page

function App() {

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        <Route path="/login" element={
          <AuthLayout><LoginForm /></AuthLayout>
        } />
        
        <Route path="/otp" element={
          <AuthLayout><OTPForm /></AuthLayout>
        } />
        
        <Route path="/register" element={
          <AuthLayout><RegisterForm /></AuthLayout>
        } />


        {/* Dashboard Routes (Protected in real app) */}
        <Route path="/dashboard/profile" element={
           <DashboardLayout title="Profile">
             <Profile />
           </DashboardLayout>
        } />
        
        {/* Placeholder Routes for other nav items */}
        <Route path="/dashboard/shopping" element={
           <DashboardLayout title="Shopping">
             <div className="text-center mt-20 text-gray-400">Shopping Page Coming Soon</div>
           </DashboardLayout>
        } />
        
        <Route path="/dashboard/projects" element={
           <DashboardLayout title="My Projects">
             <div className="text-center mt-20 text-gray-400">Projects Page Coming Soon</div>
           </DashboardLayout>
        } />
        
        <Route path="/dashboard/messages" element={
           <DashboardLayout title="Messages">
             <div className="text-center mt-20 text-gray-400">Messages Page Coming Soon</div>
           </DashboardLayout>
        } />

      </Routes>
    </BrowserRouter>
  );
}

export default App;