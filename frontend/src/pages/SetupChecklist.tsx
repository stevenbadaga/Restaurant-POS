import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ListChecks,
} from 'lucide-react';
import api from '@/services/api';
import { PageHeader, Card, CardContent, CardHeader, Loading, EmptyState, ErrorState } from '@/components/ui';
import { cn } from '@/lib';

interface ReadinessCheck {
  key: string;
  label: string;
  status: 'COMPLETE' | 'INCOMPLETE' | 'WARNING' | 'NOT_APPLICABLE';
  severity: 'CRITICAL' | 'WARNING' | 'INFORMATION';
  description: string;
  resolutionRoute?: string;
  count?: number;
}

interface ReadinessGroup {
  group: string;
  label: string;
  checks: ReadinessCheck[];
}

interface ReadinessResult {
  ready: boolean;
  completionPercentage: number;
  criticalIssues: number;
  warnings: number;
  groups: ReadinessGroup[];
}

function StatusIcon({ status, severity }: { status: string; severity: string }) {
  if (status === 'COMPLETE') {
    return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
  }
  if (status === 'INCOMPLETE' || (status === 'WARNING' && severity === 'CRITICAL')) {
    return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  }
  if (status === 'WARNING') {
    return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
  }
  if (status === 'NOT_APPLICABLE') {
    return <AlertCircle className="h-5 w-5 text-[var(--color-text-muted)] shrink-0" />;
  }
  return <AlertCircle className="h-5 w-5 text-[var(--color-text-muted)] shrink-0" />;
}

function getStatusBadgeClass(status: string, severity: string) {
  if (status === 'COMPLETE') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (status === 'INCOMPLETE') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (status === 'WARNING' && severity === 'CRITICAL') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (status === 'WARNING') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
}

function getStatusLabel(status: string, severity?: string): string {
  if (status === 'COMPLETE') return 'Complete';
  if (status === 'INCOMPLETE') return 'Incomplete';
  if (status === 'WARNING' && severity === 'CRITICAL') return 'Critical';
  if (status === 'WARNING') return 'Warning';
  if (status === 'NOT_APPLICABLE') return 'N/A';
  return status;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    INFORMATION: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full',
      colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    )}>
      {severity}
    </span>
  );
}

function CheckItem({ check }: { check: ReadinessCheck }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-lg hover:bg-[var(--color-bg-secondary)]/50 transition-colors group">
      <StatusIcon status={check.status} severity={check.severity} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {check.label}
          </span>
          <SeverityBadge severity={check.severity} />
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full',
            getStatusBadgeClass(check.status, check.severity)
          )}>
            {getStatusLabel(check.status, check.severity)}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          {check.description}
          {check.count !== undefined && check.count > 0 && (
            <span className="ml-1 font-medium">({check.count})</span>
          )}
        </p>
        {check.resolutionRoute && check.status !== 'COMPLETE' && (
          <button
            onClick={() => navigate(check.resolutionRoute!)}
            className="inline-flex items-center gap-1 mt-1.5 text-xs text-[var(--color-accent)] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="h-3 w-3" />
            Fix this
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressCircle({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const color = percentage === 100
    ? '#22c55e'
    : percentage >= 75
    ? '#22c55e'
    : percentage >= 50
    ? '#eab308'
    : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}

export default function SetupChecklist() {
  const [data, setData] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/setup/readiness');
      const result = res.data.data;
      setData(result);

      // Auto-expand groups with issues
      const expand: Record<string, boolean> = {};
      result.groups.forEach((g: ReadinessGroup) => {
        const hasIssues = g.checks.some(
          (c) => c.status !== 'COMPLETE' && c.status !== 'NOT_APPLICABLE'
        );
        expand[g.group] = hasIssues;
      });
      setExpandedGroups(expand);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load setup readiness');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  if (loading && !data) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Setup Checklist" description="Verify system configuration before going live" />
        <Loading size="lg" className="py-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Setup Checklist" description="Verify system configuration before going live" />
        <ErrorState message={error} onRetry={fetchReadiness} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Setup Checklist" description="Verify system configuration before going live" />
        <EmptyState
          icon={<ListChecks className="h-12 w-12" />}
          title="No data available"
          description="Could not load setup readiness data."
          action={
            <button
              onClick={fetchReadiness}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const allChecks = data.groups.flatMap((g) => g.checks);
  const total = allChecks.filter((c) => c.status !== 'NOT_APPLICABLE').length;
  const complete = allChecks.filter((c) => c.status === 'COMPLETE').length;
  const incomplete = allChecks.filter((c) => c.status === 'INCOMPLETE').length;
  const warnings = allChecks.filter((c) => c.status === 'WARNING').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Setup Checklist"
        description="Verify system configuration before going live"
        actions={
          <button
            onClick={fetchReadiness}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                  Overall
                </p>
                <p className={cn(
                  'text-2xl font-bold mt-1',
                  data.ready ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {data.ready ? 'Ready' : 'Not Ready'}
                </p>
              </div>
              <ProgressCircle percentage={data.completionPercentage} size={80} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                  Complete
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {complete}/{total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                  Incomplete
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{incomplete}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                  Warnings
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{warnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical issues banner */}
      {data.criticalIssues > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {data.criticalIssues} critical issue{data.criticalIssues !== 1 ? 's' : ''} must be resolved
            </p>
            <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">
              The system is not ready for launch until all critical issues are fixed.
            </p>
          </div>
        </div>
      )}

      {/* Checklist groups */}
      <div className="space-y-4">
        {data.groups.map((group) => {
          const groupAllChecks = group.checks.length;
          const groupComplete = group.checks.filter(
            (c) => c.status === 'COMPLETE' || c.status === 'NOT_APPLICABLE'
          ).length;
          const isExpanded = expandedGroups[group.group] ?? true;

          return (
            <Card key={group.group}>
              <button
                onClick={() => toggleGroup(group.group)}
                className="w-full text-left"
              >
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-[var(--color-text-muted)]" />
                    )}
                    <div>
                      <h3 className="text-base font-display font-semibold text-[var(--color-text-primary)]">
                        {group.label}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {groupComplete}/{groupAllChecks} items complete
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.checks.some((c) => c.status === 'INCOMPLETE') && (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        {group.checks.filter((c) => c.status === 'INCOMPLETE').length} incomplete
                      </span>
                    )}
                    {group.checks.some((c) => c.status === 'WARNING') && (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {group.checks.filter((c) => c.status === 'WARNING').length} warnings
                      </span>
                    )}
                  </div>
                </CardHeader>
              </button>
              {isExpanded && (
                <CardContent className="px-0 pb-2">
                  <div className="divide-y divide-[var(--color-border)]">
                    {group.checks.map((check) => (
                      <CheckItem key={check.key} check={check} />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
