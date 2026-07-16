import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { Loading } from '@/components/ui';
import { Moon, Sun } from 'lucide-react';

export function AuthLayout() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        <Loading message="Checking your session..." />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-[var(--color-accent)] mb-4">
              <span className="text-white font-display font-bold text-2xl">P</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-[var(--color-text-primary)]">
              Restaurant POS
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Sign in to your account
            </p>
          </div>

          {/* Auth form area */}
          <div className="card p-6 sm:p-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
