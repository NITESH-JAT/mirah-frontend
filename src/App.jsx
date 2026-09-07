import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthProvider';
import { RegionProvider } from './context/RegionProvider';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RegionProvider>
          <AppRouter />
        </RegionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;