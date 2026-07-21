import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import {
  getOrders, getActiveOrders, getOrder, submitOrder, cancelOrder,
  updateItemStatus, generateReceipt, closeOrder as closeOrderService,
  assignWaiterToOrder, getAvailableWaiters,
  type Order,
} from '@/services/orders';
import {
  getOrderPaymentSummary, recordPayment,
} from '@/services/payments';
import { getReceiptByOrder } from '@/services/receipts';
import { connectSocket, disconnectSocket } from '@/services/socket';
import api from '@/services/api';
import { formatDate, formatCurrency, cn } from '@/lib';
import {
  ClipboardList, Plus, Search, RefreshCw, AlertCircle,
  CheckCircle2, Clock, ChefHat, Eye, Send,
  CreditCard, Receipt, UtensilsCrossed, User, Hash,
  ArrowRight, ShoppingCart, Banknote, Smartphone, Wallet,
  Landmark, Ticket, DollarSign,
} from 'lucide-react';

const STATUS_ORDER = ['DRAFT', 'SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'];
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', IN_PREPARATION: 'Preparing',
  PARTIALLY_READY: 'Partial', READY: 'Ready', SERVED: 'Served',
  CLOSED: 'Closed', CANCELLED: 'Cancelled',
};
const STATUS_VARIANTS: Record<string, string> = {
  DRAFT: 'neutral', SUBMITTED: 'info', IN_PREPARATION: 'warning',
  PARTIALLY_READY: 'warning', READY: 'info', SERVED: 'success',
  CLOSED: 'neutral', CANCELLED: 'error',
};
const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: 'Unpaid', PARTIALLY_PAID: 'Partial', PAID: 'Paid',
  REFUNDED: 'Refunded', PARTIALLY_REFUNDED: 'Partially Refunded',
};

export default function Orders() {
  const navigate = useNavigate();
  const { user, restaurant } = useAuth();
  const userRoles = user?.roles || [];
  const userId = user?.id;
  const isManager = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');
  const isChef = userRoles.includes('CHEF');

  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'mine'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const socketConnected = useRef(false);

  // Waiter assignment state
  const [waiterDropdownOrderId, setWaiterDropdownOrderId] = useState<string | null>(null);
  const [availableWaiters, setAvailableWaiters] = useState<Array<{
    id: string; firstName: string; lastName: string;
    employeeCode: string | null; activeOrderCount: number;
  }>>([]);
  const [assigningWaiter, setAssigningWaiter] = useState<string | null>(null);
  const waiterDropdownRef = useRef<HTMLDivElement>(null);

  // Close waiter dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (waiterDropdownRef.current && !waiterDropdownRef.current.contains(e.target as Node)) {
        setWaiterDropdownOrderId(null);
      }
    };
    if (waiterDropdownOrderId) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [waiterDropdownOrderId]);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      let data: any;

      switch (activeTab) {
        case 'active':
          data = await getActiveOrders();
          setOrders(data.data || []);
          break;
        case 'mine':
          data = await getOrders({ page, limit: 50 });
          {
            let mineFiltered = (data.data || []).filter((o: Order) => o.waiterId === userId);
            // Also include orders from this waiter's assigned tables
            try {
              const tablesRes = await api.get('/tables/assignments/workload');
              const myTables = (tablesRes.data.data || []).find((w: any) => w.id === userId)?.assignedTables || [];
              const myTableIds = myTables.map((t: any) => t.id);
              if (myTableIds.length > 0) {
                const allOrders = (data.data || []);
                const tableOrders = allOrders.filter((o: Order) => o.tableId && myTableIds.includes(o.tableId) && o.waiterId !== userId);
                mineFiltered = [...mineFiltered, ...tableOrders];
                // Deduplicate
                const seen = new Set<string>();
                mineFiltered = mineFiltered.filter((o: Order) => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
              }
            } catch { /* non-critical - fall back to just waiterId filter */ }
            setOrders(mineFiltered);
            setTotalPages(data.pagination?.totalPages || 1);
            break;
          }
        case 'history':
          await Promise.all([
            getOrders({ status: 'CLOSED', page, limit: 50 }),
            getOrders({ status: 'CANCELLED', page, limit: 50 }),
          ]).then(([closed, cancelled]) => {
            setOrders([...(closed.data || []), ...(cancelled.data || [])]);
            setTotalPages(Math.max(closed.pagination?.totalPages || 1, cancelled.pagination?.totalPages || 1));
          });
          break;
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, userId]);

  useEffect(() => { setPage(1); fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (page > 1) fetchOrders(); }, [page]);

  // Socket.IO real-time
  useEffect(() => {
    if (!user?.id) return;
    const socket = connectSocket(restaurant?.id || '');

    socket.on('connect', () => { socketConnected.current = true; });
    socket.on('disconnect', () => { socketConnected.current = false; });
    socket.on('order:submitted-to-kitchen', fetchOrders);
    socket.on('order:payment-status-updated', fetchOrders);
    socket.on('order:closed', fetchOrders);
    socket.on('order:discount-updated', fetchOrders);
    socket.on('order:waiter-assigned', fetchOrders);
    socket.on('order:new', fetchOrders);

    return () => {
      socket.off('connect'); socket.off('disconnect');
      socket.off('order:submitted-to-kitchen'); socket.off('order:payment-status-updated');
      socket.off('order:closed'); socket.off('order:discount-updated');
      socket.off('order:waiter-assigned'); socket.off('order:new');
    };
  }, [user?.id, fetchOrders]);

  // Polling fallback
  useEffect(() => {
    const interval = setInterval(() => { if (!socketConnected.current) fetchOrders(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Actions
  const handleSubmit = async (orderId: string) => {
    setActionLoading(orderId);
    try { await submitOrder(orderId); setSuccessMsg('Order submitted to kitchen'); fetchOrders(); }
    catch (err: any) { setError(err?.response?.data?.message || 'Failed to submit'); }
    finally { setActionLoading(null); }
  };

  const handleServe = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const detail = await getOrder(orderId);
      const readyItems = detail.data.items.filter(i => i.status === 'READY');
      for (const item of readyItems) {
        await updateItemStatus(orderId, item.id, 'SERVED');
      }
      setSuccessMsg('Items marked as served');
      fetchOrders();
    } catch (err: any) { setError(err?.response?.data?.message || 'Failed to serve'); }
    finally { setActionLoading(null); }
  };

  const handleCancel = async (orderId: string) => {
    const reason = prompt('Reason for cancellation:');
    if (!reason) return;
    setActionLoading(orderId);
    try { await cancelOrder(orderId, reason); setSuccessMsg('Order cancelled'); fetchOrders(); }
    catch (err: any) { setError(err?.response?.data?.message || 'Failed to cancel'); }
    finally { setActionLoading(null); }
  };

  // Waiter assignment
  const openWaiterDropdown = async (orderId: string) => {
    setWaiterDropdownOrderId(waiterDropdownOrderId === orderId ? null : orderId);
    try {
      const waiters = await getAvailableWaiters();
      setAvailableWaiters(waiters);
    } catch { /* silent */ }
  };

  const handleAssignWaiter = async (orderId: string, waiterId: string) => {
    setAssigningWaiter(orderId);
    try {
      await assignWaiterToOrder(orderId, waiterId);
      setSuccessMsg('Waiter assigned successfully');
      setWaiterDropdownOrderId(null);
      fetchOrders();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to assign waiter');
    } finally {
      setAssigningWaiter(null);
    }
  };

  // Inline payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash', icon: Banknote },
    { value: 'CARD', label: 'Card', icon: CreditCard },
    { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark },
    { value: 'VOUCHER', label: 'Voucher', icon: Ticket },
    { value: 'OTHER', label: 'Other', icon: Wallet },
  ];

  const openPaymentDialog = async (order: Order) => {
    setPaymentOrderId(order.id);
    setPaymentError(null);
    setPaymentSuccess(null);
    setPaymentMethod('CASH');
    setCashTendered('');
    setPaymentReference('');
    setPaymentNotes('');
    try {
      const response = await getOrderPaymentSummary(order.id);
      setPaymentSummary(response.data);
      setPaymentAmount(response.data.paymentSummary.amountDue);
      setShowPaymentDialog(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load order payment info');
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentOrderId || !paymentSummary) return;
    setSubmittingPayment(true);
    setPaymentError(null);
    try {
      if (paymentMethod === 'CASH' && cashTendered && parseFloat(cashTendered) < parseFloat(paymentAmount)) {
        setPaymentError('Amount tendered must be at least the payment amount');
        setSubmittingPayment(false);
        return;
      }
      await recordPayment(paymentOrderId, {
        method: paymentMethod,
        amount: paymentAmount,
        amountTendered: paymentMethod === 'CASH' ? cashTendered : undefined,
        referenceNumber: paymentReference || undefined,
        notes: paymentNotes || undefined,
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      setPaymentSuccess('Payment recorded successfully');
      // Refresh order data and close dialog
      setTimeout(async () => {
        setShowPaymentDialog(false);
        fetchOrders();
        // Auto-navigate to receipt if available
        try {
          const receipt = await getReceiptByOrder(paymentOrderId);
          navigate(`/receipts?id=${receipt.data.id}`);
        } catch { /* no receipt yet */ }
      }, 1500);
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const paymentChange = () => {
    if (paymentMethod !== 'CASH' || !cashTendered || !paymentAmount) return 0;
    return Math.max(0, parseFloat(cashTendered) - parseFloat(paymentAmount));
  };

  const paymentQuickAmounts = (amountDue: number): number[] => {
    const amounts = [amountDue];
    for (const d of [5, 10, 20, 50, 100]) {
      if (d > amountDue && d < amountDue * 3) {
        amounts.push(Math.ceil(amountDue / d) * d);
        break;
      }
    }
    return [...new Set(amounts)].sort((a, b) => a - b);
  };

  const handleReceipt = async (order: Order) => {
    setActionLoading(order.id);
    try {
      const receipt = await getReceiptByOrder(order.id);
      navigate(`/receipts/${receipt.data.id}`);
    } catch {
      // Generate then navigate
      try {
        const result = await generateReceipt(order.id);
        navigate(`/receipts/${result.data.id}`);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to generate receipt');
      }
    } finally { setActionLoading(null); }
  };

  const handleClose = async (orderId: string) => {
    setActionLoading(orderId);
    try { await closeOrderService(orderId); setSuccessMsg('Order closed'); fetchOrders(); }
    catch (err: any) { setError(err?.response?.data?.message || 'Failed to close'); }
    finally { setActionLoading(null); }
  };

  const handleViewDetail = async (orderId: string) => {
    setOrderDetailLoading(true);
    setSelectedOrder(orders.find(o => o.id === orderId) || null);
    try {
      const detail = await getOrder(orderId);
      setOrderDetail(detail.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load order detail');
    } finally { setOrderDetailLoading(false); }
  };

  // Clear messages after a delay
  useEffect(() => {
    if (successMsg || error) {
      const t = setTimeout(() => { setSuccessMsg(null); setError(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg, error]);

  // Render
  if (loading && orders.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Orders" description="View and manage all orders" />
        <Loading size="lg" message="Loading orders..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Orders"
        description="View and manage all orders"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={fetchOrders} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/orders/new')}>
              New Order
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-red-700 dark:text-red-300">{error}</span></div>
          <button onClick={() => setError(null)} className="text-sm text-red-500 hover:underline">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm text-green-700 dark:text-green-300">{successMsg}</span></div>
          <button onClick={() => setSuccessMsg(null)} className="text-sm text-green-500 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)] pb-px">
        {(['active', 'mine', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px',
              activeTab === tab
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {tab === 'active' ? 'Active' : tab === 'mine' ? 'My Orders' : 'History'}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<ClipboardList className="h-16 w-16" />}
            title={activeTab === 'active' ? 'No active orders' : activeTab === 'mine' ? 'No orders placed yet' : 'No order history'}
            description={activeTab === 'active' ? 'Orders submitted to the kitchen will appear here.' : 'Create your first order to get started.'}
            action={activeTab !== 'active' ? <Button onClick={() => navigate('/orders/new')}><Plus className="h-4 w-4" /> New Order</Button> : undefined}
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              isManager={isManager}
              isChef={isChef}
              actionLoading={actionLoading === order.id}
              onViewDetail={() => handleViewDetail(order.id)}
              onSubmit={() => handleSubmit(order.id)}
              onServe={() => handleServe(order.id)}
              onCancel={() => handleCancel(order.id)}
              onPayment={() => openPaymentDialog(order)}
              onReceipt={() => handleReceipt(order)}
              onClose={() => handleClose(order.id)}
              waiterDropdownOrderId={waiterDropdownOrderId}
              availableWaiters={availableWaiters}
              assigningWaiter={assigningWaiter}
              onOpenWaiterDropdown={openWaiterDropdown}
              onAssignWaiter={handleAssignWaiter}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium transition-all',
                p === page ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={orderDetail || selectedOrder}
          loading={orderDetailLoading}
          onClose={() => { setSelectedOrder(null); setOrderDetail(null); }}
          onRefresh={() => handleViewDetail(selectedOrder.id)}
        />
      )}

      {/* Inline Payment Dialog */}
      {showPaymentDialog && paymentSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !submittingPayment && setShowPaymentDialog(false)}>
          <div className="bg-[var(--color-card-bg)] rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Payment — #{paymentSummary.order?.orderNumber || ''}
              </h2>
              <button onClick={() => setShowPaymentDialog(false)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Order totals */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(parseFloat(paymentSummary.paymentSummary?.orderTotal || '0'))}</p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Paid</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(parseFloat(paymentSummary.paymentSummary?.completedPayments || '0'))}</p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">Due</p>
                  <p className="text-lg font-bold text-[var(--color-accent)]">{formatCurrency(parseFloat(paymentSummary.paymentSummary?.amountDue || '0'))}</p>
                </div>
              </div>

              {/* Previous payments */}
              {paymentSummary.payments?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Previous Payments</p>
                  {paymentSummary.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-xs p-2 rounded bg-[var(--color-bg-secondary)] mb-0.5">
                      <span className="text-[var(--color-text-muted)]">{p.method}</span>
                      <span className="font-medium">{formatCurrency(parseFloat(p.amount))}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error/Success */}
              {paymentError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
                </div>
              )}
              {paymentSuccess && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">{paymentSuccess}</p>
                </div>
              )}

              {!paymentSuccess && (
                <>
                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase">Method</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PAYMENT_METHODS.map(m => {
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.value}
                            onClick={() => setPaymentMethod(m.value)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs transition-all ${
                              paymentMethod === m.value
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
                            }`}
                          >
                            <Icon className="h-4 w-4 mb-1" />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 uppercase">Amount</label>
                    <input type="number" step="0.01" value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      max={parseFloat(paymentSummary.paymentSummary?.amountDue || '0')}
                      className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
                  </div>

                  {/* Cash fields */}
                  {paymentMethod === 'CASH' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 uppercase">Tendered</label>
                        <input type="number" step="0.01" value={cashTendered}
                          onChange={e => setCashTendered(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {paymentQuickAmounts(parseFloat(paymentSummary.paymentSummary?.amountDue || '0')).map(amt => (
                            <button key={amt} onClick={() => setCashTendered(String(amt))}
                              className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                                cashTendered === String(amt)
                                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                  : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                              }`}>
                              {formatCurrency(amt)}
                            </button>
                          ))}
                        </div>
                      </div>
                      {cashTendered && parseFloat(cashTendered) >= parseFloat(paymentAmount) && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            Change: {formatCurrency(paymentChange())}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Reference for non-cash */}
                  {paymentMethod !== 'CASH' && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 uppercase">Reference</label>
                      <input type="text" value={paymentReference}
                        onChange={e => setPaymentReference(e.target.value)}
                        placeholder="Transaction ID"
                        className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setShowPaymentDialog(false)} disabled={submittingPayment}>
                      Cancel
                    </Button>
                    <Button onClick={handleRecordPayment} isLoading={submittingPayment}>
                      <CreditCard className="h-4 w-4" />
                      Confirm Payment
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order, isManager, isChef, actionLoading,
  onViewDetail, onSubmit, onServe, onCancel, onPayment, onReceipt, onClose,
  waiterDropdownOrderId, availableWaiters, assigningWaiter,
  onOpenWaiterDropdown, onAssignWaiter,
}: {
  order: Order; isManager: boolean; isChef: boolean; actionLoading: boolean;
  onViewDetail: () => void; onSubmit: () => void; onServe: () => void;
  onCancel: () => void; onPayment: () => void; onReceipt: () => void; onClose: () => void;
  waiterDropdownOrderId: string | null;
  availableWaiters: Array<{ id: string; firstName: string; lastName: string; employeeCode: string | null; activeOrderCount: number }>;
  assigningWaiter: string | null;
  onOpenWaiterDropdown: (orderId: string) => void;
  onAssignWaiter: (orderId: string, waiterId: string) => void;
}) {
  const isActive = ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED'].includes(order.status);
  const isDraft = order.status === 'DRAFT';
  const isServed = order.status === 'SERVED';
  const isClosed = order.status === 'CLOSED';
  const isCancelled = order.status === 'CANCELLED';
  const isPaid = order.paymentStatus === 'PAID';
  const itemCount = order._count?.items ?? order.items?.length ?? 0;

  return (
    <Card hover={false} className={cn(
      'transition-all duration-200 border-l-4',
      isDraft ? 'border-l-gray-400' :
        order.status === 'SUBMITTED' ? 'border-l-blue-500' :
          ['IN_PREPARATION', 'PARTIALLY_READY'].includes(order.status) ? 'border-l-amber-500' :
            order.status === 'READY' ? 'border-l-blue-400' :
              order.status === 'SERVED' ? 'border-l-green-500' :
                order.status === 'CLOSED' ? 'border-l-green-700' :
                  'border-l-red-500'
    )}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Order info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm text-[var(--color-text-primary)]">
                #{order.orderNumber}
              </span>
              <Badge variant={(STATUS_VARIANTS[order.status] || 'neutral') as any}>
                {STATUS_LABELS[order.status] || order.status}
              </Badge>
              <Badge variant={
                order.paymentStatus === 'PAID' ? 'success' :
                  order.paymentStatus === 'PARTIALLY_PAID' ? 'warning' :
                    'neutral' as any
              } className="text-[10px] px-1.5 py-0">
                {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] flex-wrap">
              {order.table && (
                <span className="flex items-center gap-1">
                  <UtensilsCrossed className="h-3 w-3" />
                  {order.table.name} ({order.table.code})
                </span>
              )}
              {order.waiter && (
                <span className="flex items-center gap-1 relative">
                  <User className="h-3 w-3" />
                  <button
                    onClick={() => isManager ? onOpenWaiterDropdown(order.id) : undefined}
                    className={cn(
                      'hover:text-[var(--color-accent)] transition-colors',
                      isManager && 'cursor-pointer underline decoration-dotted underline-offset-2'
                    )}
                    title={isManager ? 'Click to reassign waiter' : undefined}
                  >
                    {order.waiter.firstName} {order.waiter.lastName}
                  </button>
                  {waiterDropdownOrderId === order.id && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl shadow-xl p-2 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] px-2 py-1">Reassign Waiter</p>
                      {availableWaiters.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)] px-2 py-2">No waiters available</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {availableWaiters.map((w) => (
                            <button
                              key={w.id}
                              onClick={() => onAssignWaiter(order.id, w.id)}
                              disabled={assigningWaiter === order.id}
                              className={cn(
                                'w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between',
                                w.id === order.waiterId
                                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                  : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                              )}
                            >
                              <span>{w.firstName} {w.lastName}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">{w.activeOrderCount} active</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(order.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Badge variant="neutral" className="text-[10px]">{order.orderType?.replace(/_/g, ' ')}</Badge>
              {order.customerName && <span>{order.customerName}</span>}
              {order.notes && <span className="truncate max-w-[200px]">Note: {order.notes}</span>}
            </div>
          </div>

          {/* Right: Total + Actions */}
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <div className="text-right">
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(order.totalAmount))}
              </p>
              {isActive && !isPaid && (
                <p className="text-xs text-red-500">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(order.amountDue))} due
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onViewDetail} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="View details">
                <Eye className="h-4 w-4" />
              </button>

              {/* Draft: Submit */}
              {isDraft && (
                <Button size="sm" variant="primary" onClick={onSubmit} isLoading={actionLoading} title="Submit to kitchen">
                  <Send className="h-3.5 w-3.5" /> Submit
                </Button>
              )}

              {/* Served: Payment */}
              {isServed && (isManager) && (
                <Button size="sm" variant="primary" onClick={onPayment} isLoading={actionLoading}>
                  <CreditCard className="h-3.5 w-3.5" /> Pay
                </Button>
              )}

              {/* Served + PAID: Close */}
              {isServed && isPaid && (isManager) && (
                <Button size="sm" variant="primary" onClick={onClose} isLoading={actionLoading} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Close
                </Button>
              )}

              {/* Closed: Receipt */}
              {isClosed && (
                <Button size="sm" variant="ghost" onClick={onReceipt} isLoading={actionLoading}>
                  <Receipt className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Serve button for ready orders */}
              {order.status === 'READY' && (
                <Button size="sm" variant="primary" onClick={onServe} isLoading={actionLoading} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Serve
                </Button>
              )}

              {/* Cancel (for non-closed/cancelled) */}
              {!isClosed && !isCancelled && (
                <button onClick={onCancel} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" title="Cancel order">
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function OrderDetailModal({ order, loading, onClose, onRefresh }: {
  order: Order; loading: boolean; onClose: () => void; onRefresh: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-card-bg)] rounded-xl border shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Order #{order.orderNumber}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10"><Loading message="Loading order details..." /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailItem label="Status" value={STATUS_LABELS[order.status] || order.status} />
              <DetailItem label="Type" value={order.orderType?.replace(/_/g, ' ') || '-'} />
              <DetailItem label="Payment" value={PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus} />
              <DetailItem label="Table" value={order.table ? `${order.table.name} (${order.table.code})` : 'Takeaway'} />
              <DetailItem label="Waiter" value={order.waiter ? `${order.waiter.firstName} ${order.waiter.lastName}` : '-'} />
              <DetailItem label="Customer" value={order.customerName || '-'} />
              <DetailItem label="Total" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(order.totalAmount))} />
              <DetailItem label="Paid" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(order.amountPaid))} />
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-300">
                📝 {order.notes}
              </div>
            )}

            {/* Items */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Items</h3>
              <div className="space-y-1.5">
                {(order.items || []).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-bg-secondary)] text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-[var(--color-text-muted)] w-6 shrink-0">{item.quantity}x</span>
                      <span className="font-medium truncate">{item.menuItemNameSnapshot}</span>
                      <StatusDot status={item.status} />
                    </div>
                    <span className="text-[var(--color-text-primary)] font-medium shrink-0 ml-2">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(item.lineTotal))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Special instructions */}
            {(order.items || []).filter(i => i.specialInstructions).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Special Instructions</h3>
                {order.items.filter(i => i.specialInstructions).map(item => (
                  <p key={item.id} className="text-sm text-amber-600 dark:text-amber-400 py-0.5">
                    <strong>{item.menuItemNameSnapshot}:</strong> {item.specialInstructions}
                  </p>
                ))}
              </div>
            )}

            {/* Payments */}
            {order.payments && order.payments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Payments</h3>
                {order.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded bg-[var(--color-bg-secondary)] mb-1">
                    <span className="text-[var(--color-text-muted)]">{p.method} {p.paymentNumber}</span>
                    <span className={p.transactionType === 'REFUND' ? 'text-red-500' : 'text-green-600'}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(p.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Kitchen Tickets */}
            {order.kitchenTickets && order.kitchenTickets.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Kitchen Tickets</h3>
                {order.kitchenTickets.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm p-2 rounded bg-[var(--color-bg-secondary)] mb-1">
                    <ChefHat className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="font-medium">{t.ticketNumber}</span>
                    <Badge variant={(STATUS_VARIANTS[t.status] || 'neutral') as any} className="text-[10px]">
                      {STATUS_LABELS[t.status] || t.status}
                    </Badge>
                    <span className="text-[var(--color-text-muted)]">at {t.kitchenStation?.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--color-bg-secondary)]">
      <p className="text-[10px] uppercase text-[var(--color-text-muted)] font-semibold">{label}</p>
      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-400', SENT: 'bg-blue-500', ACCEPTED: 'bg-purple-500',
    PREPARING: 'bg-amber-500', READY: 'bg-green-500', SERVED: 'bg-green-700',
    CANCELLED: 'bg-red-500',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || 'bg-gray-400'}`} title={status} />;
}

// Re-close icon
function XCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
