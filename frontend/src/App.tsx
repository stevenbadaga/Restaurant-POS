import { RouterProvider } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { router } from '@/routes';

const ConnectionStatus = lazy(() => import('@/components/ConnectionStatus'));

export default function App() {
  useEffect(() => {
    // Enable auto-sync engine
    import('@/services/sync').then(({ syncEngine }) => {
      syncEngine.enableAutoSync();
    }).catch(() => {});
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <ConnectionStatus />
      </Suspense>
      <RouterProvider router={router} />
    </>
  );
}
