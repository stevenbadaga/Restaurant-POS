import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib';
import api from '@/services/api';
import {
  DollarSign, RefreshCw, Plus, Search, Users, PieChart,
  CheckCircle2, AlertCircle, XCircle, Clock, TrendingUp,
  User, Wallet, CreditCard, Landmark, Smartphone, Banknote, Ticket,
  HandCoins, Scale, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';

// ==========================================
// TYPES
// ==========================================

interface Tip {
  id: string;
  tipNumber: string;
  orderNumber: string;
  paymentMethod: string;
  amount: string;
  status: string;
  directRecipient?: { id: string; firstName: string; lastName: string } | null;
  recorderdBy?: { id: string; firstName: string; lastName: string } | null;
  tipPool?: { id: string; name: string; status: string } | null;
  recordedAt: string;
  reversedAt?: string | null;
  reversalReason?: string | null;
}

interface TipPool {
  id: string;
  tipPoolNumber: string;
  name: string;
  startDate: string;
  endDate: string;
  allocationMethod: string;
  status: string;
  totalTipAmount: string;
  distributableAmount: string;
  undistributedAmount: string;
  allocationCount?: number;
  createdBy?: { firstName: string; lastName: string };
  calculatedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  notes?: string | null;
  allocations?: TipAllocation[];
}

interface TipAllocation {
  id: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; employeeCode?: string | null };
  allocationBasis: string;
  basisValue?: string | null;
  allocationPercentage?: string | null;
  allocatedAmount: string;
  status: string;
}

interface WaiterTipReport {
  waiters: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    directTipCount: number;
    directTipTotal: string;
    poolTipCount: number;
    poolTipTotal: string;
    totalTips: string;
  }>;
  totals: {
    totalTips: string;
    totalDirect: string;
    totalPool: string;
    waiterCount: number;
  };
}

// ==========================================
// COMPONENT
// ==========================================

export default function Tips() {
  const [activeTab, setActiveTab] = useState<'overview' | 'pools' | 'report'>('overview');
  const [tips, setTips] = useState<Tip[]>([]);
  const [pools, setPools] = useState<TipPool[]>([]);
  const [report, setReport] = useState<WaiterTipReport | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Record tip dialog
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordForm, setRecordForm] = useState({
    orderId: '', amount: '', paymentMethod: 'CASH',
    directRecipientUserId: '', tipPoolId: '',
  });
  const [recordingTip, setRecordingTip] = useState(false);

  // Create pool dialog
  const [showPoolDialog, setShowPoolDialog] = useState(false);
  const [poolForm, setPoolForm] = useState({
    name: '', startDate: dateFrom, endDate: dateTo,
    allocationMethod: 'EQUAL_SHARE', notes: '',
  });
  const [creatingPool, setCreatingPool] = useState(false);

  // Expanded pool
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  const [poolDetail, setPoolDetail] = useState<TipPool | null>(null);
  const [poolDetailLoading, setPoolDetailLoading] = useState(false);

  const fetchTips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tipsRes, summaryRes] = await Promise.all([
        api.get(`/tips?limit=50&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        api.get(`/tips/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ]);
      setTips(tipsRes.data.tips || []);
      setSummary(summaryRes.data.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load tips');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchPools = useCallback(async () => {
    try {
      const res = await api.get('/tips/pools?limit=50');
      setPools(res.data.pools || []);
    } catch { /* silent */ }
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      const res = await api.get(`/tips/reports/waiter?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setReport(res.data.data || null);
    } catch { /* silent */ }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'overview') fetchTips();
    if (activeTab === 'pools') fetchPools();
    if (activeTab === 'report') fetchReport();
  }, [activeTab, fetchTips, fetchPools, fetchReport]);

  // ==========================================
  // ACTIONS
  // ==========================================

  const handleRecordTip = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordingTip(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/tips', {
        ...recordForm,
        directRecipientUserId: recordForm.directRecipientUserId || null,
        tipPoolId: recordForm.tipPoolId || null,
      });
      setSuccess('Tip recorded successfully');
      setShowRecordDialog(false);
      setRecordForm({ orderId: '', amount: '', paymentMethod: 'CASH', directRecipientUserId: '', tipPoolId: '' });
      fetchTips();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to record tip');
    } finally {
      setRecordingTip(false);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPool(true);
    setError(null);
    try {
      await api.post('/tips/pools', poolForm);
      setSuccess('Tip pool created');
      setShowPoolDialog(false);
      setPoolForm({ name: '', startDate: dateFrom, endDate: dateTo, allocationMethod: 'EQUAL_SHARE', notes: '' });
      fetchPools();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create pool');
    } finally {
      setCreatingPool(false);
    }
  };

  const handleReverseTip = async (tipId: string) => {
    const reason = prompt('Reason for reversal:');
    if (!reason) return;
    setActionLoading(tipId);
    try {
      await api.post(`/tips/${tipId}/reverse`, { reason });
      setSuccess('Tip reversed');
      fetchTips();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reverse tip');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCalculatePool = async (poolId: string) => {
    setActionLoading(poolId);
    try {
      await api.post(`/tips/pools/${poolId}/calculate`);
      setSuccess('Pool calculated');
      fetchPools();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to calculate pool');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprovePool = async (poolId: string) => {
    if (!window.confirm('Approve this tip pool? This will finalize all allocations.')) return;
    setActionLoading(poolId);
    try {
      await api.post(`/tips/pools/${poolId}/approve`);
      setSuccess('Pool approved');
      fetchPools();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to approve pool');
    } finally {
      setActionLoading(null);
    }
  };

  const loadPoolDetail = async (poolId: string) => {
    if (expandedPool === poolId) {
      setExpandedPool(null);
      setPoolDetail(null);
      return;
    }
    setExpandedPool(poolId);
    setPoolDetailLoading(true);
    try {
      const res = await api.get(`/tips/pools/${poolId}`);
      setPoolDetail(res.data.data);
    } catch { /* silent */ }
    finally { setPoolDetailLoading(false); }
  };

  const renderTipMethodIcon = (method: string) => {
    const icons: Record<string, any> = {
      CASH: Banknote, CARD: CreditCard, MOBILE_MONEY: Smartphone,
      BANK_TRANSFER: Landmark, VOUCHER: Ticket, OTHER: Wallet,
    };
    const Icon = icons[method] || DollarSign;
    return <Icon className="h-3.5 w-3.5" />;
  };

  // ==========================================
  // RENDER
  // ==========================================

  const renderOverview = () => {
    if (loading) return <Loading message="Loading tips..." />;

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent>
              <p className="text-xs text-[var(--color-text-muted)]">Total Tips</p>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">{formatCurrency(parseFloat(summary.totalAmount || '0'))}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{summary.tipCount} tips</p>
            </CardContent></Card>
            <Card><CardContent>
              <p className="text-xs text-[var(--color-text-muted)]">Average Tip</p>
              <p className="text-xl font-bold text-[var(--color-accent)]">{formatCurrency(parseFloat(summary.averageTip || '0'))}</p>
            </CardContent></Card>
            <Card><CardContent>
              <p className="text-xs text-[var(--color-text-muted)]">Direct Tips</p>
              <p className="text-xl font-bold text-green-600">{summary.directTips || 0}</p>
            </CardContent></Card>
            <Card><CardContent>
              <p className="text-xs text-[var(--color-text-muted)]">Pool Tips</p>
              <p className="text-xl font-bold text-blue-600">{summary.poolTips || 0}</p>
            </CardContent></Card>
          </div>
        )}

        {/* Tips List */}
        <Card>
          <CardContent>
            {tips.length === 0 ? (
              <EmptyState icon={<HandCoins className="h-12 w-12" />} title="No tips recorded"
                description="Record tips on orders to see them here."
                action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowRecordDialog(true)}>Record Tip</Button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                      <th className="px-3 py-3 text-left font-semibold">Tip #</th>
                      <th className="px-3 py-3 text-left font-semibold">Order</th>
                      <th className="px-3 py-3 text-left font-semibold">Method</th>
                      <th className="px-3 py-3 text-right font-semibold">Amount</th>
                      <th className="px-3 py-3 text-left font-semibold">Recipient</th>
                      <th className="px-3 py-3 text-left font-semibold">Status</th>
                      <th className="px-3 py-3 text-left font-semibold">Date</th>
                      <th className="px-3 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {tips.map((tip) => (
                      <tr key={tip.id} className="hover:bg-[var(--color-bg-secondary)]">
                        <td className="px-3 py-3 font-mono text-xs font-medium">{tip.tipNumber}</td>
                        <td className="px-3 py-3">#{tip.orderNumber}</td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1">
                            {renderTipMethodIcon(tip.paymentMethod)}
                            <span>{tip.paymentMethod}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-medium">{formatCurrency(parseFloat(tip.amount))}</td>
                        <td className="px-3 py-3">
                          {tip.directRecipient
                            ? `${tip.directRecipient.firstName} ${tip.directRecipient.lastName}`
                            : tip.tipPool ? <Badge variant="info">Pool: {tip.tipPool.name}</Badge> : '-'}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={tip.status === 'REVERSED' ? 'error' : tip.status === 'ALLOCATED' ? 'success' : 'info'}>
                            {tip.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--color-text-muted)]">{formatDate(tip.recordedAt)}</td>
                        <td className="px-3 py-3 text-right">
                          {tip.status !== 'REVERSED' && tip.status !== 'ALLOCATED' && (
                            <button onClick={() => handleReverseTip(tip.id)}
                              disabled={actionLoading === tip.id}
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20">
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPools = () => {
    if (loading) return <Loading message="Loading tip pools..." />;

    return (
      <div className="space-y-4">
        {/* Pool Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Total Pools</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{pools.length}</p>
          </CardContent></Card>
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Active (Draft/Calculated)</p>
            <p className="text-xl font-bold text-blue-600">{pools.filter(p => p.status === 'DRAFT' || p.status === 'CALCULATED').length}</p>
          </CardContent></Card>
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Approved</p>
            <p className="text-xl font-bold text-green-600">{pools.filter(p => p.status === 'APPROVED').length}</p>
          </CardContent></Card>
        </div>

        {pools.length === 0 ? (
          <EmptyState icon={<Scale className="h-12 w-12" />} title="No tip pools"
            description="Create a tip pool to distribute tips among staff."
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowPoolDialog(true)}>Create Pool</Button>} />
        ) : (
          <div className="space-y-3">
            {pools.map((pool) => (
              <Card key={pool.id} hover={false}>
                <div className="p-4">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => loadPoolDetail(pool.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--color-text-primary)]">{pool.name}</span>
                        <Badge variant={pool.status === 'APPROVED' ? 'success' : pool.status === 'CALCULATED' ? 'info' : 'neutral'}>
                          {pool.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {pool.tipPoolNumber} · {new Date(pool.startDate).toLocaleDateString()} - {new Date(pool.endDate).toLocaleDateString()}
                        {' · '}{pool.allocationMethod.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--color-text-primary)]">{formatCurrency(parseFloat(pool.distributableAmount))}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{pool.allocationCount || 0} allocations</p>
                    </div>
                  </div>

                  {/* Pool Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                    {pool.status === 'DRAFT' && (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); handleCalculatePool(pool.id); }}
                        isLoading={actionLoading === pool.id} leftIcon={<PieChart className="h-3 w-3" />}>
                        Calculate
                      </Button>
                    )}
                    {pool.status === 'CALCULATED' && (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); handleApprovePool(pool.id); }}
                        isLoading={actionLoading === pool.id} leftIcon={<CheckCircle2 className="h-3 w-3" />}>
                        Approve
                      </Button>
                    )}
                    <span className="text-xs text-[var(--color-text-muted)] self-center ml-auto">
                      {pool.createdBy ? `By ${pool.createdBy.firstName} ${pool.createdBy.lastName}` : ''}
                    </span>
                  </div>

                  {/* Expanded Pool Detail */}
                  {expandedPool === pool.id && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                      {poolDetailLoading ? (
                        <Loading message="Loading allocations..." />
                      ) : poolDetail?.allocations ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Allocations</p>
                          {poolDetail.allocations.map((alloc: TipAllocation) => (
                            <div key={alloc.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-[var(--color-bg-secondary)]">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-[var(--color-text-muted)]" />
                                <span className="font-medium">{alloc.user.firstName} {alloc.user.lastName}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{alloc.allocationBasis.replace(/_/g, ' ')}</span>
                                {alloc.allocationPercentage && (
                                  <span className="text-xs text-[var(--color-text-muted)]">({parseFloat(alloc.allocationPercentage).toFixed(1)}%)</span>
                                )}
                              </div>
                              <span className="font-medium">{formatCurrency(parseFloat(alloc.allocatedAmount))}</span>
                            </div>
                          ))}
                          {poolDetail.undistributedAmount && parseFloat(poolDetail.undistributedAmount) > 0 && (
                            <div className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-amber-50 dark:bg-amber-950/20">
                              <span className="text-amber-700 dark:text-amber-300">Undistributed</span>
                              <span className="font-medium text-amber-700 dark:text-amber-300">
                                {formatCurrency(parseFloat(poolDetail.undistributedAmount))}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--color-text-muted)]">No allocations yet. Calculate the pool to generate distributions.</p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderReport = () => {
    if (!report) return <Loading message="Loading tip report..." />;

    return (
      <div className="space-y-4">
        {/* Report Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Total Tips</p>
            <p className="text-xl font-bold">{formatCurrency(parseFloat(report.totals.totalTips))}</p>
          </CardContent></Card>
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Direct Tips</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(parseFloat(report.totals.totalDirect))}</p>
          </CardContent></Card>
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Pool Tips</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(parseFloat(report.totals.totalPool))}</p>
          </CardContent></Card>
          <Card><CardContent>
            <p className="text-xs text-[var(--color-text-muted)]">Staff with tips</p>
            <p className="text-xl font-bold">{report.totals.waiterCount}</p>
          </CardContent></Card>
        </div>

        {/* Waiter Breakdown */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">Staff Tip Breakdown</h3>
            {report.waiters.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No tip data for the selected period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                      <th className="px-3 py-3 text-left font-semibold">Staff</th>
                      <th className="px-3 py-3 text-right font-semibold">Direct Tips</th>
                      <th className="px-3 py-3 text-right font-semibold">Pool Tips</th>
                      <th className="px-3 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {report.waiters.map((w, i) => (
                      <tr key={w.id} className={cn('hover:bg-[var(--color-bg-secondary)]', i === 0 && 'bg-amber-50 dark:bg-amber-950/10')}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && <TrendingUp className="h-3 w-3 text-amber-500" />}
                            <span className="font-medium">{w.firstName} {w.lastName}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{w.employeeCode}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">{formatCurrency(parseFloat(w.directTipTotal))}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(parseFloat(w.poolTipTotal))}</td>
                        <td className="px-3 py-3 text-right font-bold">{formatCurrency(parseFloat(w.totalTips))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ==========================================
  // DIALOGS
  // ==========================================

  const renderRecordDialog = () => {
    if (!showRecordDialog) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !recordingTip && setShowRecordDialog(false)}>
        <div className="bg-[var(--color-card-bg)] rounded-xl border shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Record Tip</h2>
          </div>
          <form onSubmit={handleRecordTip} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Order ID *</label>
              <input type="text" value={recordForm.orderId} onChange={(e) => setRecordForm({ ...recordForm, orderId: e.target.value })}
                placeholder="Order UUID" required className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <input type="number" step="0.01" min="0.01" value={recordForm.amount}
                onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                required className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method *</label>
              <select value={recordForm.paymentMethod}
                onChange={(e) => setRecordForm({ ...recordForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowRecordDialog(false)} disabled={recordingTip}>Cancel</Button>
              <Button type="submit" isLoading={recordingTip} leftIcon={<HandCoins className="h-4 w-4" />}>Record Tip</Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderPoolDialog = () => {
    if (!showPoolDialog) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !creatingPool && setShowPoolDialog(false)}>
        <div className="bg-[var(--color-card-bg)] rounded-xl border shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Create Tip Pool</h2>
          </div>
          <form onSubmit={handleCreatePool} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pool Name *</label>
              <input type="text" value={poolForm.name}
                onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                placeholder="e.g. Weekend Shift" required
                className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date *</label>
                <input type="date" value={poolForm.startDate}
                  onChange={(e) => setPoolForm({ ...poolForm, startDate: e.target.value })}
                  required className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date *</label>
                <input type="date" value={poolForm.endDate}
                  onChange={(e) => setPoolForm({ ...poolForm, endDate: e.target.value })}
                  required className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Allocation Method *</label>
              <select value={poolForm.allocationMethod}
                onChange={(e) => setPoolForm({ ...poolForm, allocationMethod: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm">
                <option value="EQUAL_SHARE">Equal Share</option>
                <option value="HOURS_WORKED">Hours Worked</option>
                <option value="ROLE_WEIGHTED">Role Weighted</option>
                <option value="DIRECT_EMPLOYEE">Direct Employee</option>
                <option value="CUSTOM_PERCENTAGE">Custom Percentage</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea value={poolForm.notes}
                onChange={(e) => setPoolForm({ ...poolForm, notes: e.target.value })}
                rows={2} className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowPoolDialog(false)} disabled={creatingPool}>Cancel</Button>
              <Button type="submit" isLoading={creatingPool} leftIcon={<Scale className="h-4 w-4" />}>Create Pool</Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tips & Pooling"
        description="Record tips, manage tip pools, and view staff tip reports"
        actions={
          <div className="flex items-center gap-2">
            {/* Date filter */}
            <div className="flex items-center gap-1 text-xs">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-xs w-32" />
              <span className="text-[var(--color-text-muted)]">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 rounded border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-xs w-32" />
            </div>
            <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => {
              if (activeTab === 'overview') fetchTips();
              if (activeTab === 'pools') fetchPools();
              if (activeTab === 'report') fetchReport();
            }}>Refresh</Button>
            {activeTab === 'overview' && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowRecordDialog(true)}>Record Tip</Button>
            )}
            {activeTab === 'pools' && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowPoolDialog(true)}>Create Pool</Button>
            )}
          </div>
        }
      />

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm text-red-500 hover:underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-sm text-green-500 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)] pb-px">
        {(['overview', 'pools', 'report'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px',
              activeTab === tab ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}>
            {tab === 'overview' ? 'Tips' : tab === 'pools' ? 'Tip Pools' : 'Staff Report'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'pools' && renderPools()}
      {activeTab === 'report' && renderReport()}

      {renderRecordDialog()}
      {renderPoolDialog()}
    </div>
  );
}
