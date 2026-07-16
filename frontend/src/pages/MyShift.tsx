import { useEffect, useState, useCallback } from 'react';
import {
  Clock, LogIn, LogOut, Coffee, AlertCircle, CheckCircle2,
  User, CalendarDays,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getMyCurrentStatus, clockIn, startBreak, endBreak, clockOut } from '@/services/attendance';
import { cn } from '@/lib/utils';

export default function MyShift() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getMyCurrentStatus();
      setStatus(result.data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const handleAction = async (action: string, actionFn: () => Promise<any>) => {
    setActionLoading(action);
    try {
      await actionFn();
      await fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !status) {
    return <div className="h-96 flex items-center justify-center"><Loading size="lg" message="Loading your shift..." /></div>;
  }

  const roles = user?.roles || [];

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="My Shift"
        description={`${user?.firstName} ${user?.lastName} — ${roles.join(', ')}`}
      />

      {/* Current time & date */}
      <div className="text-center p-6 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-card-border)]">
        <p className="text-4xl font-bold text-[var(--color-text-primary)] font-mono">
          {formatTime(currentTime)}
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={fetchStatus} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Status card */}
      <Card className="overflow-hidden">
        <div className={cn(
          'p-6 text-center',
          !status?.clockedIn && 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20',
          status?.clockedIn && !status?.onBreak && 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20',
          status?.onBreak && 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20',
        )}>
          <div className={cn(
            'inline-flex p-4 rounded-full mb-3',
            !status?.clockedIn ? 'bg-blue-200 dark:bg-blue-800/40' :
            status?.onBreak ? 'bg-amber-200 dark:bg-amber-800/40' :
            'bg-green-200 dark:bg-green-800/40',
          )}>
            {!status?.clockedIn ? (
              <LogIn className="h-8 w-8 text-blue-700 dark:text-blue-300" />
            ) : status?.onBreak ? (
              <Coffee className="h-8 w-8 text-amber-700 dark:text-amber-300" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-green-700 dark:text-green-300" />
            )}
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            {!status?.clockedIn ? 'Not Clocked In' :
             status?.onBreak ? 'On Break' : 'Clocked In'}
          </h2>
          {status?.assignment && (
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {status.assignment.assignedRoleName} — {status.workShift?.nameSnapshot || 'Unscheduled'}
            </p>
          )}
          {status?.assignment?.clockedInAt && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Since {new Date(status.assignment.clockedInAt).toLocaleTimeString()}
            </p>
          )}
          {status?.assignment?.workedMinutes !== undefined && status?.clockedIn && !status?.onBreak && (
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2 font-mono">
              {formatDuration(status.assignment.workedMinutes)}
            </p>
          )}
          {status?.assignment?.lateMinutes ? (
            <Badge variant="warning" className="mt-2">
              {status.assignment.lateMinutes} min late
            </Badge>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={() => handleAction('clock-in', clockIn)}
            disabled={status?.clockedIn || actionLoading === 'clock-in'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200',
              status?.clockedIn
                ? 'border-[var(--color-border)] opacity-40 cursor-not-allowed'
                : 'border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-400',
              actionLoading === 'clock-in' && 'animate-pulse'
            )}
          >
            <LogIn className="h-6 w-6 text-green-600" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Clock In</span>
          </button>

          <button
            onClick={() => handleAction('break-start', () => startBreak())}
            disabled={!status?.clockedIn || status?.onBreak || actionLoading === 'break-start'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200',
              !status?.clockedIn || status?.onBreak
                ? 'border-[var(--color-border)] opacity-40 cursor-not-allowed'
                : 'border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-400',
              actionLoading === 'break-start' && 'animate-pulse'
            )}
          >
            <Coffee className="h-6 w-6 text-amber-600" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Break</span>
          </button>

          <button
            onClick={() => handleAction('break-end', endBreak)}
            disabled={!status?.onBreak || actionLoading === 'break-end'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200',
              !status?.onBreak
                ? 'border-[var(--color-border)] opacity-40 cursor-not-allowed'
                : 'border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-400',
              actionLoading === 'break-end' && 'animate-pulse'
            )}
          >
            <Coffee className="h-6 w-6 text-amber-600" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">End Break</span>
          </button>

          <button
            onClick={() => handleAction('clock-out', clockOut)}
            disabled={!status?.clockedIn || status?.onBreak || actionLoading === 'clock-out'}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200 col-span-3',
              !status?.clockedIn || status?.onBreak
                ? 'border-[var(--color-border)] opacity-40 cursor-not-allowed'
                : 'border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-400',
              actionLoading === 'clock-out' && 'animate-pulse'
            )}
          >
            <LogOut className="h-6 w-6 text-red-600" />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Clock Out</span>
          </button>
        </div>
      </Card>

      {/* Shift info */}
      {status?.hasActiveShift && status?.workShift ? (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Current Shift
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-text-muted)] text-xs">Shift</p>
                <p className="font-medium">{status.workShift.nameSnapshot}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] text-xs">Status</p>
                <Badge>{status.workShift.status}</Badge>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] text-xs">Scheduled Start</p>
                <p className="font-medium">
                  {new Date(status.assignment.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] text-xs">Scheduled End</p>
                <p className="font-medium">
                  {new Date(status.assignment.scheduledEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Clock className="h-8 w-8" />}
              title="No active shift"
              description="You don't have a scheduled shift for today."
            />
          </CardContent>
        </Card>
      )}

      {/* Quick info */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <User className="h-4 w-4" />
            <span>{user?.firstName} {user?.lastName}</span>
            <span className="text-[var(--color-border)]">|</span>
            <Badge variant="info">{roles[0]}</Badge>
            {user?.employeeCode && (
              <>
                <span className="text-[var(--color-border)]">|</span>
                <span>ID: {user.employeeCode}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
