import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg-primary)]">
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-[var(--color-bg-secondary)] mb-6">
          <span className="text-4xl font-display font-bold text-[var(--color-accent)]">404</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)] mb-3">
          Page not found
        </h1>
        <p className="text-[var(--color-text-muted)] mb-8 max-w-md mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button onClick={() => navigate('/dashboard')} leftIcon={<Home className="h-4 w-4" />}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
