import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  DollarSign, CreditCard, ArrowUpCircle, ArrowDownCircle,
  Shield, AlertTriangle, CheckCircle, XCircle, ClipboardList,
  Printer, Download, History, User, Calendar, Clock, FileText,
  BarChart3, Eye, EyeOff,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Badge, Loading, ErrorState } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSessionDetail, getSessionMovements, beginClosingSession,
  recordClosingCount, approveSession, rejectSession,
  closeSession, addCashIn, addCashOut, addSafeDrop, addAdjustment,
} from '@/services/cashier-sessions';
import { cn } from '@/lib/utils';

export default function CashierSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<any>(null);
  const [movements, setMovements] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Closing workflow states
  const [showClosingDialog, setShowClosingDialog] = useState(searchParams.get('action') === 'close');
  const [showCountForm, setShowCountForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState<'cash-in' | 'cash-out' | 'safe-drop' | 'adjustment' | null>(null);
  const [showDenominationForm, setShowDenominationForm] = useState(false);
  const [showXReport, setShowXReport] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);

  // Count form state
  const [countedCash, setCountedCash] = useState('');
  const [denominations, setDenominations] = useState<{ denomination: string; quantity: number }[]>([]);
  const [closingResult, setClosingResult] = useState<any>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Movement form state
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementType, setMovementType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');

  const roles = user?.roles || [];
  const isAdmin = roles.includes('ADMIN');
  const isManager = roles.includes('MANAGER');
  const isCashier = roles.includes('CASHIER');
  const canManage = isAdmin || isManager;
  const isOwnSession = session?.cashier?.id === user?.id;

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [sessionResult, movementsResult] = await Promise.all([
        getSessionDetail(id),
        getSessionMovements(id),
      ]);
      setSession(sessionResult.data);
      setMovements(movementsResult.data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchData(); }, [id, fetchData]);

  const handleBeginClosing = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const result = await beginClosingSession(id);
      setSession((prev: any) => ({ ...prev, status: 'CLOSING', expectedCash: result.expected?.expectedCash }));
      setShowCountForm(true);
      setShowClosingDialog(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to begin closing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordCount = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const data: any = {};
      if (countedCash) {
        data.countedCash = countedCash;
      } else if (denominations.length > 0) {
        data.denominations = denominations.filter((d) => d.quantity > 0);
      }
      const result = await recordClosingCount(id, data);
      setClosingResult(result);
      setSession((prev: any) => ({
        ...prev,
        ...result.session,
        countedCash: result.countedCash,
        varianceAmount: result.variance,
        varianceStatus: result.varianceStatus,
        status: result.session?.status || 'CLOSING',
      }));
      setShowCountForm(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to record count');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const result = await approveSession(id, approvalNote);
      await fetchData();
      setApprovalNote('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectSession(id, rejectionReason);
      await fetchData();
      setRejectionReason('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await closeSession(id);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to close');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMovement = async () => {
    if (!id || !showMovementForm) return;
    setActionLoading(true);
    try {
      const data = { amount: movementAmount, reason: movementReason };
      if (showMovementForm === 'cash-in') await addCashIn(id, data);
      else if (showMovementForm === 'cash-out') await addCashOut(id, data);
      else if (showMovementForm === 'safe-drop') await addSafeDrop(id, data);
      else if (showMovementForm === 'adjustment') await addAdjustment(id, { ...data, movementType });
      await fetchData();
      setShowMovementForm(null);
      setMovementAmount('');
      setMovementReason('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to record movement');
    } finally {
      setActionLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    OPEN: 'success', CLOSING: 'warning', PENDING_APPROVAL: 'warning',
    CLOSED: 'neutral', SUSPENDED: 'error',
  };

  const denominationOptions = [
    { label: 'RWF 10,000', value: '10000' },
    { label: 'RWF 5,000', value: '5000' },
    { label: 'RWF 2,000', value: '2000' },
    { label: 'RWF 1,000', value: '1000' },
    { label: 'RWF 500', value: '500' },
    { label: 'RWF 200', value: '200' },
    { label: 'RWF 100', value: '100' },
    { label: 'RWF 50', value: '50' },
    { label: 'Coins', value: '0' },
  ];

  if (loading && !session) {
    return <div className="h-96 flex items-center justify-center"><Loading size="lg" message="Loading session..." /></div>;
  }

  if (error && !session) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Session Detail" description="Cashier session details" />
        <ErrorState title="Failed to load" message={error} onRetry={fetchData} />
      </div>
    );
  }

  if (!session) return null;

  const variance = parseFloat(session.varianceAmount || '0');
  const isClosing = session.status === 'CLOSING';
  const isPendingApproval = session.status === 'PENDING_APPROVAL';
  const isClosed = session.status === 'CLOSED';
  const isOpen = session.status === 'OPEN';
  const needsApproval = isPendingApproval || (closingResult?.requiresApproval);

  // Calculate denomination total
  const denomTotal = denominations.reduce((sum, d) => sum + parseFloat(d.denomination || '0') * d.quantity, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Session ${session.sessionNumber || ''}`}
        description={`${session.cashRegister?.name || 'Register'} · ${session.cashier?.firstName || ''} ${session.cashier?.lastName || ''}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/cashier-sessions')}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)]"
            >
              Back to Sessions
            </button>
          </div>
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* Session Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Session Overview</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {session.cashRegister?.name} ({session.cashRegister?.code})
                </p>
              </div>
              <Badge variant={(statusColors[session.status] || 'neutral') as any}>
                {session.status?.replace(/_/g, ' ')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Business Date</p>
                <p className="text-sm font-semibold">{session.businessDate || '—'}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Opened At</p>
                <p className="text-sm font-semibold">{session.openedAt ? new Date(session.openedAt).toLocaleString() : '—'}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Cashier</p>
                <p className="text-sm font-semibold">{session.cashier?.firstName} {session.cashier?.lastName}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Opened By</p>
                <p className="text-sm font-semibold">{session.openedBy?.firstName} {session.openedBy?.lastName}</p>
              </div>
            </div>

            {session.closedAt && (
              <div className="mt-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Closed by {session.closedBy?.firstName} {session.closedBy?.lastName} at {new Date(session.closedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cash Summary */}
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Cash Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Opening Float</span>
                <span className="font-medium">{session.openingFloat || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Expected Cash</span>
                <span className="font-medium">{session.expectedCash || '0.00'}</span>
              </div>
              {session.countedCash !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Counted Cash</span>
                  <span className="font-medium">{session.countedCash}</span>
                </div>
              )}
              {session.varianceAmount !== null && (
                <div className={cn(
                  'flex justify-between text-sm font-semibold pt-2 border-t border-[var(--color-border)]',
                  variance < 0 ? 'text-red-500' : variance > 0 ? 'text-amber-500' : 'text-green-500'
                )}>
                  <span>Variance</span>
                  <span>{session.varianceAmount} ({session.varianceStatus?.replace(/_/g, ' ')})</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      {isOpen && (canManage || isOwnSession) && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowClosingDialog(true)}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            Begin Closing
          </button>
          <button
            onClick={() => setShowMovementForm('cash-in')}
            className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Cash In
          </button>
          <button
            onClick={() => setShowMovementForm('cash-out')}
            className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Cash Out
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setShowMovementForm('safe-drop')}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Safe Drop
              </button>
              <button
                onClick={() => {
                  setShowMovementForm('adjustment');
                  setMovementType('ADJUSTMENT_IN');
                }}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Adjustment
              </button>
            </>
          )}
          <button
            onClick={() => setShowXReport(true)}
            className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <BarChart3 className="h-4 w-4 inline mr-1" />
            X-Report
          </button>
        </div>
      )}

      {/* Closing Workflow */}
      {isClosing && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent>
            <h3 className="font-semibold text-amber-600 mb-4">Closing in Progress</h3>
            <div className="flex flex-wrap gap-3">
              {!showCountForm && !closingResult && (
                <button
                  onClick={() => setShowCountForm(true)}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  Record Cash Count
                </button>
              )}
              {showCountForm && (
                <button
                  onClick={() => {
                    setShowDenominationForm(true);
                    setShowCountForm(false);
                  }}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  Count by Denomination
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Approval */}
      {isPendingApproval && canManage && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent>
            <h3 className="font-semibold text-amber-600 mb-4">Manager Approval Required</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              This session has a cash variance of <strong>{session.varianceAmount}</strong> ({session.varianceStatus})
              that requires manager approval before closing.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="Approval notes (optional)"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                />
              </div>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4 inline mr-1" />
                {actionLoading ? '...' : 'Approve'}
              </button>
              <div className="flex-1 min-w-[200px]">
                <input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Rejection reason"
                  className="w-full px-3 py-2 text-sm border border-red-300 dark:border-red-700 rounded-lg bg-[var(--color-bg-primary)]"
                />
              </div>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 inline mr-1" />
                {actionLoading ? '...' : 'Reject'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close button */}
      {(isClosing || isPendingApproval) && canManage && (
        <div>
          <button
            onClick={handleClose}
            disabled={actionLoading}
            className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {actionLoading ? 'Closing...' : 'Close Session'}
          </button>
        </div>
      )}

      {/* Expected Cash Breakdown */}
      {session.expectedCashDetails && (
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Expected Cash Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Opening Float</p>
                <p className="font-semibold">{session.expectedCashDetails.openingFloat}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="text-xs text-green-600">Cash Payments</p>
                <p className="font-semibold text-green-700 dark:text-green-400">{session.expectedCashDetails.cashPayments}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-xs text-red-600">Cash Refunds</p>
                <p className="font-semibold text-red-700 dark:text-red-400">{session.expectedCashDetails.cashRefunds}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <p className="text-xs text-blue-600">Cash In</p>
                <p className="font-semibold text-blue-700 dark:text-blue-400">{session.expectedCashDetails.cashIn}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <p className="text-xs text-orange-600">Cash Out</p>
                <p className="font-semibold text-orange-700 dark:text-orange-400">{session.expectedCashDetails.cashOut}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <p className="text-xs text-purple-600">Safe Drops</p>
                <p className="font-semibold text-purple-700 dark:text-purple-400">{session.expectedCashDetails.safeDrops}</p>
              </div>
              <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20">
                <p className="text-xs text-teal-600">Adjustments In</p>
                <p className="font-semibold text-teal-700 dark:text-teal-400">{session.expectedCashDetails.adjustmentsIn}</p>
              </div>
              <div className="p-3 rounded-lg bg-pink-50 dark:bg-pink-950/20">
                <p className="text-xs text-pink-600">Adjustments Out</p>
                <p className="font-semibold text-pink-700 dark:text-pink-400">{session.expectedCashDetails.adjustmentsOut}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] col-span-2">
                <p className="text-xs text-[var(--color-text-muted)]">Expected Cash Total</p>
                <p className="font-semibold text-lg">{session.expectedCashDetails.expectedCash}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Drawer Movements */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Cash Drawer Movements</h3>
            <span className="text-xs text-[var(--color-text-muted)]">
              {movements?.movements?.length || 0} movements · Balance: {movements?.finalBalance || '0.00'}
            </span>
          </div>

          {(!movements?.movements || movements.movements.length === 0) ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No movements recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">Type</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--color-text-muted)]">Amount</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">Reason</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--color-text-muted)]">Actor</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--color-text-muted)]">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.movements.map((m: any) => {
                    const isInflow = ['OPENING_FLOAT', 'CASH_PAYMENT', 'CASH_IN', 'ADJUSTMENT_IN'].includes(m.movementType);
                    const isOutflow = ['CASH_REFUND', 'CASH_OUT', 'SAFE_DROP', 'ADJUSTMENT_OUT'].includes(m.movementType);
                    return (
                      <tr key={m.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
                        <td className="py-2 px-3 text-xs">{m.occurredAt ? new Date(m.occurredAt).toLocaleTimeString() : '—'}</td>
                        <td className="py-2 px-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            isInflow && 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
                            isOutflow && 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
                            m.movementType === 'OPENING_FLOAT' && 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
                            m.movementType === 'CLOSING_COUNT' && 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
                          )}>
                            {m.movementType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={cn('py-2 px-3 text-right font-medium', isInflow ? 'text-green-600' : isOutflow ? 'text-red-600' : '')}>
                          {isInflow ? '+' : isOutflow ? '-' : ''}{m.amount}
                        </td>
                        <td className="py-2 px-3 text-xs text-[var(--color-text-muted)] max-w-[200px] truncate">{m.reason || '—'}</td>
                        <td className="py-2 px-3 text-xs">{m.actor ? `${m.actor.firstName} ${m.actor.lastName}` : '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{m.runningBalance || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Count Form */}
      {showCountForm && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent>
            <h3 className="font-semibold mb-4">Record Cash Count</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Counted Cash Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="Enter total cash counted"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                />
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Expected: <strong>{session.expectedCash}</strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRecordCount}
                  disabled={actionLoading || !countedCash}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Record Count'}
                </button>
                <button
                  onClick={() => setShowCountForm(false)}
                  className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Denomination Count Form */}
      {showDenominationForm && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent>
            <h3 className="font-semibold mb-4">Count by Denomination</h3>
            <div className="space-y-3">
              {denominationOptions.map((opt) => (
                <div key={opt.value} className="flex items-center gap-3">
                  <label className="w-28 text-sm">{opt.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={denominations.find((d) => d.denomination === opt.value)?.quantity || 0}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 0;
                      setDenominations((prev) => {
                        const existing = prev.findIndex((d) => d.denomination === opt.value);
                        if (existing >= 0) {
                          const updated = [...prev];
                          updated[existing] = { ...updated[existing], quantity: qty };
                          return updated;
                        }
                        return [...prev, { denomination: opt.value, quantity: qty }];
                      });
                    }}
                    className="w-20 px-2 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  />
                  <span className="text-sm text-[var(--color-text-muted)]">
                    = {((denominations.find((d) => d.denomination === opt.value)?.quantity || 0) * parseFloat(opt.value)).toLocaleString()} RWF
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-sm">
                  Total Counted: <strong>{denomTotal.toLocaleString()} RWF</strong>
                </p>
                <p className="text-sm">
                  Expected: <strong>{session.expectedCash}</strong>
                </p>
                <p className={cn(
                  'text-sm font-semibold',
                  denomTotal - parseFloat(session.expectedCash || '0') !== 0 ? 'text-amber-500' : 'text-green-500'
                )}>
                  Variance: {(denomTotal - parseFloat(session.expectedCash || '0')).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!id) return;
                    setActionLoading(true);
                    try {
                      // Create counted cash from denominations
                      const data = { countedCash: denomTotal.toFixed(2) };
                      const result = await recordClosingCount(id, data);
                      setClosingResult(result);
                      setSession((prev: any) => ({
                        ...prev, ...result.session,
                        countedCash: result.countedCash,
                        varianceAmount: result.variance,
                        varianceStatus: result.varianceStatus,
                        status: result.session?.status || 'CLOSING',
                      }));
                      setShowDenominationForm(false);
                    } catch (err: any) {
                      setError(err?.response?.data?.message || 'Failed to record');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading || denomTotal <= 0}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Submit Denomination Count'}
                </button>
                <button
                  onClick={() => setShowDenominationForm(false)}
                  className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Closing Result / Confirmation */}
      {closingResult && (
        <Card className={cn(
          parseFloat(closingResult.variance) === 0 ? 'border-green-200 dark:border-green-800' :
          'border-amber-200 dark:border-amber-800'
        )}>
          <CardContent>
            <h3 className={cn(
              'font-semibold mb-4',
              parseFloat(closingResult.variance) === 0 ? 'text-green-600' : 'text-amber-600'
            )}>
              {parseFloat(closingResult.variance) === 0 ? 'Balanced ✓' : 'Variance Detected'}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Expected</p>
                <p className="font-semibold">{closingResult.expectedCash}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Counted</p>
                <p className="font-semibold">{closingResult.countedCash}</p>
              </div>
              <div className={cn(
                'p-3 rounded-lg',
                parseFloat(closingResult.variance) === 0 ? 'bg-green-50 dark:bg-green-950/20' :
                parseFloat(closingResult.variance) > 0 ? 'bg-amber-50 dark:bg-amber-950/20' :
                'bg-red-50 dark:bg-red-950/20'
              )}>
                <p className="text-xs text-[var(--color-text-muted)]">Variance</p>
                <p className="font-semibold">{closingResult.variance}</p>
              </div>
            </div>
            {closingResult.requiresApproval && (
              <p className="mt-3 text-sm text-amber-600">This variance requires manager approval before closing.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movement Form Modal */}
      {showMovementForm && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent>
            <h3 className="font-semibold mb-4 capitalize">{showMovementForm.replace('-', ' ')}</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                />
              </div>
              {showMovementForm === 'adjustment' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Adjustment Type</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  >
                    <option value="ADJUSTMENT_IN">Increase (Cash In)</option>
                    <option value="ADJUSTMENT_OUT">Decrease (Cash Out)</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleMovement}
                  disabled={actionLoading || !movementAmount || !movementReason}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Record'}
                </button>
                <button
                  onClick={() => setShowMovementForm(null)}
                  className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* X-Report */}
      {showXReport && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">X-Report (Interim)</h3>
              <button
                onClick={() => {
                  setShowXReport(false);
                  setShowReconciliation(true);
                }}
                className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
              >
                <Printer className="h-3 w-3 inline mr-1" />
                View Reconciliation
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-muted)]">Session</span>
                <span className="font-medium">{session.sessionNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-muted)]">Register</span>
                <span className="font-medium">{session.cashRegister?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-muted)]">Cashier</span>
                <span className="font-medium">{session.cashier?.firstName} {session.cashier?.lastName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-muted)]">Business Date</span>
                <span className="font-medium">{session.businessDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-muted)]">Opened At</span>
                <span className="font-medium">{session.openedAt ? new Date(session.openedAt).toLocaleString() : '—'}</span>
              </div>
              {session.expectedCashDetails && (
                <>
                  <div className="pt-2">
                    <p className="font-semibold text-[var(--color-text-muted)] mb-2">Cash Movements</p>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Opening Float</span>
                    <span>{session.expectedCashDetails.openingFloat}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Cash Payments</span>
                    <span className="text-green-600">+{session.expectedCashDetails.cashPayments}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Cash Refunds</span>
                    <span className="text-red-600">-{session.expectedCashDetails.cashRefunds}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Cash In (Manual)</span>
                    <span className="text-green-600">+{session.expectedCashDetails.cashIn}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Cash Out (Manual)</span>
                    <span className="text-red-600">-{session.expectedCashDetails.cashOut}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Safe Drops</span>
                    <span className="text-red-600">-{session.expectedCashDetails.safeDrops}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Adjustments In</span>
                    <span className="text-green-600">+{session.expectedCashDetails.adjustmentsIn}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Adjustments Out</span>
                    <span className="text-red-600">-{session.expectedCashDetails.adjustmentsOut}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t-2 border-[var(--color-border)] font-bold">
                    <span>Expected Cash</span>
                    <span>{session.expectedCashDetails.expectedCash}</span>
                  </div>
                  {session.countedCash !== null && (
                    <div className="flex justify-between py-1">
                      <span>Counted Cash</span>
                      <span>{session.countedCash}</span>
                    </div>
                  )}
                  {session.varianceAmount !== null && (
                    <div className={cn(
                      'flex justify-between py-2 border-t border-[var(--color-border)] font-bold',
                      variance < 0 ? 'text-red-500' : variance > 0 ? 'text-amber-500' : 'text-green-500'
                    )}>
                      <span>Variance</span>
                      <span>{session.varianceAmount}</span>
                    </div>
                  )}
                </>
              )}
              <div className="pt-2">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Status: {session.status?.replace(/_/g, ' ')} · Generated {new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Denomination Counts */}
      {session.denominationCounts && session.denominationCounts.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Denomination Counts</h3>
            <div className="space-y-2">
              {session.denominationCounts.map((dc: any) => (
                <div key={dc.id} className="flex justify-between text-sm py-1 border-b border-[var(--color-border)]">
                  <span>{dc.denomination} × {dc.quantity}</span>
                  <span className="font-medium">{dc.lineTotal}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
