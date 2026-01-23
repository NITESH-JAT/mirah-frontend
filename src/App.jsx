import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { LoginForm, OTPForm, RegisterForm } from './components/AuthForms';
import Welcome from './pages/Welcome';
import { initDB } from './services/authService';

function App() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
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

        <Route path="/welcome" element={<Welcome />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;