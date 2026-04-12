import React, { Suspense } from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import { routes } from './config';


const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-cream">
    <div className="w-8 h-8 border-2 border-walnut border-t-transparent rounded-full animate-spin"></div>
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