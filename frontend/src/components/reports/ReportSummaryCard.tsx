import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';

interface ReportSummaryCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'teal';
  comparison?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    previous?: number;
    percentageChange?: number | null;
  };
  loading?: boolean;
  tooltip?: string;
  onClick?: () => void;
}

const colorStyles = {
  green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
  blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
  purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20',
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20',
  red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
  teal: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/20',
};

export function ReportSummaryCard({
  label, value, subtitle, icon, color = 'blue',
  comparison, loading, tooltip, onClick,
}: ReportSummaryCardProps) {
  if (loading) {
    return (
      <Card className="p-5" onClick={onClick}>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-[var(--color-bg-secondary)] rounded w-24" />
            <div className="h-8 bg-[var(--color-bg-secondary)] rounded w-32" />
            <div className="h-3 bg-[var(--color-bg-secondary)] rounded w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn('p-5 transition-all duration-200', onClick && 'cursor-pointer hover:shadow-md hover:border-[var(--color-accent)]')}
      onClick={onClick}
    >
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-sm text-[var(--color-text-muted)] truncate" title={tooltip}>
              {label}
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] truncate">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
            )}
            {comparison && (
              <div className="flex items-center gap-1 mt-1">
                {comparison.direction === 'up' ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : comparison.direction === 'down' ? (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                ) : (
                  <Minus className="h-3 w-3 text-[var(--color-text-muted)]" />
                )}
                <span className={cn(
                  'text-xs font-medium',
                  comparison.direction === 'up' && 'text-green-500',
                  comparison.direction === 'down' && 'text-red-500',
                  comparison.direction === 'neutral' && 'text-[var(--color-text-muted)]'
                )}>
                  {comparison.percentageChange != null
                    ? `${Math.abs(comparison.percentageChange)}%`
                    : 'New'}
                  {comparison.value !== 0 && (
                    <span className="ml-1 text-[var(--color-text-muted)] font-normal">
                      vs previous period
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('p-3 rounded-lg shrink-0', colorStyles[color])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
