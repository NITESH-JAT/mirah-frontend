import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function Welcome() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#F6F7F9]">
      <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-md w-full">
        <h1 className="auth-heading text-4xl mb-2">Welcome, {user.fullName}!</h1>
        <p className="text-gray-500 mb-8 capitalize">Role: {user.role === 'user' ? 'Client' : 'Supplier'}</p>
        <div className="w-full h-[1px] bg-gray-100 mb-8" />
        <button 
          onClick={handleLogout}
          className="text-red-500 font-semibold hover:underline"
        >
          Logout from Session
        </button>
      </div>
    </div>
  );
}