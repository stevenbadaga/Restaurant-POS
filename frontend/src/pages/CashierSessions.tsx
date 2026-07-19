import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, CreditCard, Eye,
  ClipboardList,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Badge, Loading, EmptyState, ErrorState, Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getCashierSessions, getCurrentSession, openSession } from '@/services/cashier-sessions';
import { getCashRegisters } from '@/services/cash-registers';
import { cn } from '@/lib/utils';

export default function CashierSessions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [showOpenForm, setShowOpenForm] = useState(false);

  const roles = user?.roles || [];
  const isCashier = roles.includes('CASHIER') || roles.includes('ADMIN') || roles.includes('MANAGER');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [currentResult, sessionsResult] = await Promise.all([
        getCurrentSession().catch(() => ({ data: null })),
        getCashierSessions({ limit: 20 }),
      ]);
      setCurrent(currentResult.data);
      setSessions(sessionsResult.sessions || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusColors: Record<string, string> = {
    OPEN: 'success', CLOSING: 'warning', PENDING_APPROVAL: 'warning',
    CLOSED: 'neutral', SUSPENDED: 'error',
  };



  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cashier Sessions"
        description="Manage cash register sessions and reconciliation"
        actions={
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setTab('current')}
              className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap', tab === 'current' ? 'bg-[var(--color-accent)] text-white' : 'border-[var(--color-border)]')}
            >Current</button>
            <button
              onClick={() => setTab('history')}
              className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap', tab === 'history' ? 'bg-[var(--color-accent)] text-white' : 'border-[var(--color-border)]')}
            >History</button>
          </div>
        }
      />

      {error && <ErrorState title="Error" message={error} onRetry={fetchData} />}

      {/* Current Session Card */}
      {tab === 'current' && (
        <>
          {current ? (
            <Card>
              <CardContent>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{current.cashRegister?.name} — {current.sessionNumber}</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">Opened {new Date(current.openedAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={(statusColors[current.status] || 'neutral') as any}>{current.status?.replace(/_/g, ' ')}</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <p className="text-xs text-[var(--color-text-muted)]">Opening Float</p>
                    <p className="text-lg font-bold">{current.openingFloat}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <p className="text-xs text-[var(--color-text-muted)]">Expected Cash</p>
                    <p className="text-lg font-bold">{current.expectedCash}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <p className="text-xs text-[var(--color-text-muted)]">Movements</p>
                    <p className="text-lg font-bold">{current.movementCount || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <p className="text-xs text-[var(--color-text-muted)]">Status</p>
                    <Badge variant={(statusColors[current.status] || 'neutral') as any}>{current.status}</Badge>
                  </div>
                </div>

                {current.varianceAmount && (
                  <div className={cn('p-3 rounded-lg mb-4', parseFloat(current.varianceAmount) >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20')}>
                    <p className="text-sm font-medium">Variance: {current.varianceAmount} ({current.varianceStatus})</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => navigate(`/cashier-sessions/${current.id}`)} className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90">View Details</button>
                  {current.status === 'OPEN' && (
                    <button onClick={() => navigate(`/cashier-sessions/${current.id}?action=close`)} className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)]">Begin Closing</button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <EmptyState icon={<CreditCard className="h-8 w-8" />} title="No active session" description="Open a cashier session to start recording payments." />
                {isCashier && (
                  <OpenSessionForm onSuccess={fetchData} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick open form */}
          {showOpenForm && <OpenSessionForm onSuccess={fetchData} onClose={() => setShowOpenForm(false)} />}
        </>
      )}

      {/* Session History */}
      {tab === 'history' && (
        loading ? <Loading message="Loading sessions..." /> : (
          sessions.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No sessions" description="No cashier sessions recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Session</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Register</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Cashier</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Float</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Expected</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Variance</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-muted)]"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any) => {
                    const v = parseFloat(s.varianceAmount || '0');
                    return (
                      <tr key={s.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
                        <td className="py-3 px-4 font-medium">{s.sessionNumber}</td>
                        <td className="py-3 px-4">{s.cashRegister?.name}</td>
                        <td className="py-3 px-4">{s.cashier?.firstName} {s.cashier?.lastName}</td>
                        <td className="py-3 px-4">{s.businessDate}</td>
                        <td className="py-3 px-4">{s.openingFloat}</td>
                        <td className="py-3 px-4">{s.expectedCash}</td>
                        <td className={cn('py-3 px-4 font-medium', v < 0 && 'text-red-500', v > 0 && 'text-amber-500')}>
                          {s.varianceAmount || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={(statusColors[s.status] || 'neutral') as any}>{s.status?.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => navigate(`/cashier-sessions/${s.id}`)} className="p-1 hover:text-[var(--color-accent)]"><Eye className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )
      )}
    </div>
  );
}

function OpenSessionForm({ onSuccess, onClose }: { onSuccess: () => void; onClose?: () => void }) {
  const [registers, setRegisters] = useState<any[]>([]);
  const [registerId, setRegisterId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCashRegisters().then((r) => {
      const data = r.data || [];
      setRegisters(data);
      if (data.length > 0) setRegisterId(data[0].id);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await openSession({ cashRegisterId: registerId, openingFloat });
      onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-lg border border-[var(--color-border)] space-y-3">
      <h4 className="font-medium text-sm">Open New Session</h4>
      <select value={registerId} onChange={(e) => setRegisterId(e.target.value)} required className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]">
        <option value="">Select register</option>
        {registers.map((r: any) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
      </select>
      <input value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} type="number" step="0.01" min="0" placeholder="Opening float" required className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]" />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90">{saving ? 'Opening...' : 'Open Session'}</button>
        {onClose && <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg">Cancel</button>}
      </div>
    </form>
  );
}
