import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, ThemeProvider } from '@/contexts';
import App from './App';
import './styles/globals.css';

// Enable auto-sync when online
async function initializeSync() {
  try {
    const { syncEngine } = await import('@/services/sync');
    syncEngine.enableAutoSync();
  } catch {
    // Sync not critical for app startup
  }
}

initializeSync();

// Register service worker with fallback to inline registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[PWA] Service Worker registered:', reg.scope);

      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[PWA] New version available — refresh to update');
              } else {
                console.log('[PWA] Content cached for offline use');
              }
            }
          };
        }
      };
    }).catch((err) => {
      console.warn('[PWA] Service Worker registration skipped:', err.message);
    });

    // Listen for background sync trigger from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_TRIGGERED' && navigator.onLine) {
        import('@/services/sync').then((m) => m.triggerSync()).catch(() => {});
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
