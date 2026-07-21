/**
 * Retry utility with exponential backoff and jitter.
 * Wraps async functions and retries on failure with configurable options.
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: any) => boolean;
}

const defaultOptions: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Determine if an error should trigger a retry.
 * Retries on network errors, 5xx server errors, and 429 rate limits.
 * Does NOT retry on 4xx client errors (except 429).
 */
function defaultShouldRetry(error: any): boolean {
  // No response (network error) - retry
  if (!error?.response) return true;

  const status = error.response?.status;

  // Rate limited - retry
  if (status === 429) return true;

  // Server errors - retry
  if (status >= 500 && status < 600) return true;

  // Don't retry client errors (4xx except 429)
  return false;
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function getDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  // Add jitter: random 0-25% of the delay
  const jitter = capped * 0.25 * Math.random();
  return Math.round(capped + jitter);
}

/**
 * Execute an async function with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? defaultOptions.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? defaultOptions.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? defaultOptions.maxDelayMs;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const onRetry = options.onRetry;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = getDelayMs(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(error, attempt + 1);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Higher-order function that wraps an API call function with retry logic.
 */
export function withRetryWrapper<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withRetry(() => fn(...args), options);
  };
}
