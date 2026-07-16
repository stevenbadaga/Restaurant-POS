import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading } from '@/components/ui';
import { useAuth } from '@/contexts';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const setupSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  restaurantEmail: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  restaurantPhone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Use at least one uppercase letter')
    .regex(/[a-z]/, 'Use at least one lowercase letter')
    .regex(/[0-9]/, 'Use at least one number')
    .regex(/[^A-Za-z0-9]/, 'Use at least one special character'),
  passwordConfirmation: z.string(),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
});

type LoginForm = z.infer<typeof loginSchema>;
type SetupForm = z.infer<typeof setupSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login, initializeSetup, checkSetupStatus, error } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const setupForm = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      currency: 'RWF',
      timezone: 'Africa/Kigali',
      restaurantName: 'Restaurant POS',
    },
  });

  useEffect(() => {
    let mounted = true;
    checkSetupStatus()
      .then((required) => {
        if (mounted) setSetupRequired(required);
      })
      .catch(() => {
        if (mounted) setFormError('Could not reach the backend setup service.');
      })
      .finally(() => {
        if (mounted) setCheckingSetup(false);
      });

    return () => {
      mounted = false;
    };
  }, [checkSetupStatus]);

  const onLogin = async (data: LoginForm) => {
    setIsLoading(true);
    setFormError(null);
    try {
      await login(data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const onSetup = async (data: SetupForm) => {
    setIsLoading(true);
    setFormError(null);
    try {
      await initializeSetup(data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSetup) {
    return <Loading message="Checking setup status..." />;
  }

  if (setupRequired) {
    const errors = setupForm.formState.errors;

    return (
      <form onSubmit={setupForm.handleSubmit(onSetup)} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Create first administrator
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            This database has no restaurant administrator yet.
          </p>
        </div>

        <FormMessage message={formError || error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurant name" error={errors.restaurantName?.message}>
            <input className="input-field" {...setupForm.register('restaurantName')} />
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            <input className="input-field" {...setupForm.register('currency')} />
          </Field>
          <Field label="Timezone" error={errors.timezone?.message}>
            <input className="input-field" {...setupForm.register('timezone')} />
          </Field>
          <Field label="Restaurant email" error={errors.restaurantEmail?.message}>
            <input type="email" className="input-field" {...setupForm.register('restaurantEmail')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            <input className="input-field" autoComplete="given-name" {...setupForm.register('firstName')} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <input className="input-field" autoComplete="family-name" {...setupForm.register('lastName')} />
          </Field>
          <Field label="Admin email" error={errors.email?.message}>
            <input type="email" className="input-field" autoComplete="email" {...setupForm.register('email')} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <input className="input-field" autoComplete="tel" {...setupForm.register('phone')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input type="password" className="input-field" autoComplete="new-password" {...setupForm.register('password')} />
          </Field>
          <Field label="Confirm password" error={errors.passwordConfirmation?.message}>
            <input type="password" className="input-field" autoComplete="new-password" {...setupForm.register('passwordConfirmation')} />
          </Field>
        </div>

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          leftIcon={<Building2 className="h-4 w-4" />}
        >
          Create restaurant and sign in
        </Button>
      </form>
    );
  }

  const errors = loginForm.formState.errors;

  return (
    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
      <FormMessage message={formError || error} />

      <Field label="Email address" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          {...loginForm.register('email')}
          className="input-field"
          placeholder="you@restaurant.com"
          autoComplete="email"
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          id="password"
          type="password"
          {...loginForm.register('password')}
          className="input-field"
          placeholder="Enter your password"
          autoComplete="current-password"
        />
      </Field>

      <div className="flex items-center justify-between">
        <label htmlFor="remember" className="flex items-center gap-2 cursor-pointer">
          <input
            id="remember"
            type="checkbox"
            className="rounded border-[var(--color-input-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm text-[var(--color-text-secondary)]">Remember me</span>
        </label>
        <button
          type="button"
          className="text-sm text-[var(--color-accent)] hover:underline font-medium"
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading}
        leftIcon={<LogIn className="h-4 w-4" />}
      >
        Sign in
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--color-text-primary)]">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FormMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
      {message}
    </div>
  );
}
