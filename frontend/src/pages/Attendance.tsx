import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarDays,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getAttendanceList, getMyAttendance } from '@/services/attendance';
import { cn } from '@/lib/utils';

export default function Attendance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'my' | 'all'>('all');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);

  const roles = user?.roles || [];
  const isManager = roles.includes('ADMIN') || roles.includes('MANAGER');
  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (view === 'my') {
        const result = await getMyAttendance({ dateFrom, dateTo: today });
        setRecords(result.data || []);
      } else if (isManager) {
        const result = await getAttendanceList({ dateFrom, dateTo: today });
        setRecords(result.records || []);
        setSummary(result.summary);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [view, dateFrom, today, isManager]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusColors: Record<string, string> = {
    SCHEDULED: 'info', CLOCKED_IN: 'success', ON_BREAK: 'warning',
    CLOCKED_OUT: 'neutral', ABSENT: 'error', EXCUSED: 'neutral', CANCELLED: 'neutral',
  };

  const formatDuration = (m?: number) => {
    if (!m) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h ${min}m`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Attendance"
        description={view === 'my' ? 'My attendance records' : 'All attendance records'}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setView('all')} className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors', view === 'all' ? 'bg-[var(--color-accent)] text-white' : 'border-[var(--color-border)]')}>All</button>
            <button onClick={() => setView('my')} className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors', view === 'my' ? 'bg-[var(--color-accent)] text-white' : 'border-[var(--color-border)]')}>My Records</button>
          </div>
        }
      />

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]" max={today} />
        <button onClick={fetchData} className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90">Apply</button>
      </div>

      {error && <ErrorState title="Error" message={error} onRetry={fetchData} />}

      {loading ? <Loading message="Loading attendance..." /> : (
        <>
          {/* Summary cards for manager view */}
          {isManager && view === 'all' && summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <SummaryCard label="Total" value={summary.total} color="blue" />
              <SummaryCard label="Clocked In" value={summary.clockedIn} color="green" />
              <SummaryCard label="Clocked Out" value={summary.clockedOut} color="neutral" />
              <SummaryCard label="Absent" value={summary.absent} color="red" />
              <SummaryCard label="Late" value={summary.late} color="amber" />
              <SummaryCard label="Missing Out" value={summary.missingClockOut} color="purple" />
            </div>
          )}

          {records.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} title="No records found" description="No attendance records for the selected date." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Shift</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Scheduled</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Clock In</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Clock Out</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Worked</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: any) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
                      onClick={() => isManager && navigate(`/attendance/${r.id}`)}>
                      <td className="py-3 px-4">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {r.user?.firstName} {r.user?.lastName}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">{r.user?.employeeCode}</span>
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">{r.assignedRoleName}</td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">{r.workShift?.nameSnapshot}</td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {new Date(r.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        {r.clockedInAt ? new Date(r.clockedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        {r.lateMinutes ? <span className="text-red-500 text-xs ml-1">(+{r.lateMinutes})</span> : null}
                      </td>
                      <td className="py-3 px-4">
                        {r.clockedOutAt ? new Date(r.clockedOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3 px-4 font-medium">{formatDuration(r.workedMinutes)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={(statusColors[r.status] || 'neutral') as any}>{r.status?.replace(/_/g, ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-card-border)] text-center">
      <p className={cn('text-2xl font-bold', color === 'blue' && 'text-blue-500', color === 'green' && 'text-green-500', color === 'red' && 'text-red-500', color === 'amber' && 'text-amber-500', color === 'purple' && 'text-purple-500', color === 'neutral' && 'text-[var(--color-text-primary)]')}>{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}
