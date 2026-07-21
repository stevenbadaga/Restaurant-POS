import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console and available logging services
    console.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, i) => key !== prevProps.resetKeys?.[i]
      );
      if (hasChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="mb-4 p-4 rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-2">
            An unexpected error occurred in this section.
          </p>
          {this.state.error && (
            <details className="mb-6 max-w-lg text-left">
              <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-xs text-red-700 dark:text-red-300 overflow-auto max-h-32">
                {this.state.error.message}
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={this.handleReload} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Reload Page
            </Button>
            <Button variant="secondary" onClick={this.handleGoHome} leftIcon={<Home className="h-4 w-4" />}>
              Go Home
            </Button>
            <Button variant="ghost" onClick={this.reset} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==========================================
// Global error handlers
// ==========================================

/**
 * Initialize global error handlers for uncaught errors and promise rejections.
 * Call once at the app entry point.
 */
export function initGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Log uncaught errors
  window.addEventListener('error', (event) => {
    console.error('[Global] Uncaught error:', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
      timestamp: new Date().toISOString(),
    });
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    console.error('[Global] Unhandled promise rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[Global] Error handlers initialized');
}
