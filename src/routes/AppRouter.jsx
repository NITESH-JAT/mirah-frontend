import React, { Suspense } from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import { routes } from './config';


const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-white">
    <div className="w-8 h-8 border-2 border-primary-dark border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function AppRouter() {

  const element = useRoutes(routes);

  return (
    <Suspense fallback={<LoadingScreen />}>
      {element}
    </Suspense>
  );
}