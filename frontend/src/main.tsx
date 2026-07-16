import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, ThemeProvider } from '@/contexts';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
