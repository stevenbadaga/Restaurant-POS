import { RouterProvider } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { router } from '@/routes';
import ErrorBoundary, { initGlobalErrorHandlers } from '@/components/ErrorBoundary';

const ConnectionStatus = lazy(() => import('@/components/ConnectionStatus'));

// Initialize global error handlers on app load
initGlobalErrorHandlers();

export default function App() {
  useEffect(() => {
    // Enable auto-sync engine
    import('@/services/sync').then(({ syncEngine }) => {
      syncEngine.enableAutoSync();
    }).catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <ConnectionStatus />
      </Suspense>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
