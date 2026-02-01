import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const GuestGuard = ({ children }) => {
  const user = authService.getCurrentUser();

  if (user) {
    return <Navigate to="/dashboard/profile" replace />;
  }

  return children;
};

export default GuestGuard;