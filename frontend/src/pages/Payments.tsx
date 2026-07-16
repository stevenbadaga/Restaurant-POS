import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
  RotateCcw,
  XCircle,
  Wallet,
  Landmark,
  Smartphone,
  Banknote,
  Ticket,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Minus,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Button,
  Badge,
  Loading,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import {
  getPaymentQueue,
  getPayments,
  getPaymentSummary,
  recordPayment,
  recordSplitPayment,
  requestPayment,
  cancelPaymentRequest,
  voidPayment,
  issueRefund,
  closeOrder,
  getOrderPaymentSummary,
} from '@/services/payments';
import { getReceiptByOrder, getReceiptPdfUrl, reprintReceipt } from '@/services/receipts';
import { formatCurrency, formatDate } from '@/lib';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark },
  { value: 'VOUCHER', label: 'Voucher', icon: Ticket },
  { value: 'OTHER', label: 'Other', icon: Wallet },
];

export default function Payments() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'queue';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueData, setQueueData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Payment dialog state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [providerName, setProviderName] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [orderSummaryLoading, setOrderSummaryLoading] = useState(false);

  // Split payment state
  const [isSplit, setIsSplit] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: string; amountTendered?: string; referenceNumber?: string; providerName?: string; notes?: string }>>([]);

  // Refund dialog state
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundPayment, setRefundPayment] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Void dialog state
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.requested) params.requested = filters.requested;
      if (filters.waiterId) params.waiterId = filters.waiterId;
      if (filters.diningAreaId) params.diningAreaId = filters.diningAreaId;
      if (filters.orderType) params.orderType = filters.orderType;
      if (page > 1) params.page = String(page);

      if (tab === 'queue') {
        const [queue, sum] = await Promise.all([
          getPaymentQueue(params),
          getPaymentSummary({}),
        ]);
        setQueueData(queue);
        setSummary(sum.data);
      } else {
        const payments = await getPayments(params);
        setPaymentsData(payments);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, [tab, searchQuery, filters, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenPayment = async (orderId: string) => {
    setOrderSummaryLoading(true);
    setPaymentError(null);
    setPaymentSuccess(null);
    setPaymentMethod('CASH');
    setPaymentAmount('');
    setCashTendered('');
    setReferenceNumber('');
    setProviderName('');
    setPaymentNotes('');
    setIsSplit(false);
    setSplitPayments([]);
    try {
      const response = await getOrderPaymentSummary(orderId);
      setOrderSummary(response.data);
      setSelectedOrder(response.data.order);
      setPaymentAmount(response.data.paymentSummary.amountDue);
      setShowPaymentDialog(true);
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to load order details');
    } finally {
      setOrderSummaryLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!orderSummary) return;
    setSubmitting(true);
    setPaymentError(null);
    setPaymentSuccess(null);
    try {
      const amountDue = orderSummary.paymentSummary.amountDue;

      if (isSplit && splitPayments.length >= 2) {
        const result = await recordSplitPayment(orderSummary.order.id, splitPayments);
        setPaymentSuccess('Split payment completed successfully');
      } else {
        if (paymentMethod === 'CASH' && cashTendered && parseFloat(cashTendered) < parseFloat(paymentAmount)) {
          setPaymentError('Amount tendered must be at least the payment amount');
          setSubmitting(false);
          return;
        }

        const result = await recordPayment(orderSummary.order.id, {
          method: paymentMethod,
          amount: paymentAmount,
          amountTendered: paymentMethod === 'CASH' ? cashTendered : undefined,
          referenceNumber: referenceNumber || undefined,
          providerName: providerName || undefined,
          notes: paymentNotes || undefined,
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        setPaymentSuccess('Payment recorded successfully');
      }

      // Check receipt
      try {
        const receipt = await getReceiptByOrder(orderSummary.order.id);
        setPaymentSuccess((prev) => `${prev || 'Payment recorded successfully'}. Receipt: ${receipt.data.receiptNumber}`);
      } catch {
        // No receipt yet
      }

      // Refresh
      const response = await getOrderPaymentSummary(orderSummary.order.id);
      setOrderSummary(response.data);

      setTimeout(() => {
        setShowPaymentDialog(false);
        fetchData();
      }, 2000);
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!refundPayment) return;
    setRefunding(true);
    try {
      await issueRefund(refundPayment.id, {
        amount: refundAmount,
        method: refundMethod,
        reason: refundReason,
        referenceNumber: refundReference || undefined,
        idempotencyKey: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      setShowRefundDialog(false);
      fetchData();
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to issue refund');
    } finally {
      setRefunding(false);
    }
  };

  const handleVoid = async () => {
    if (!voidPaymentId) return;
    setVoiding(true);
    try {
      await voidPayment(voidPaymentId, voidReason);
      setShowVoidDialog(false);
      fetchData();
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to void payment');
    } finally {
      setVoiding(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      UNPAID: 'warning',
      PARTIALLY_PAID: 'info',
      PAID: 'success',
      PARTIALLY_REFUNDED: 'warning',
      REFUNDED: 'error',
    };
    return (
      <Badge variant={(variants[status] || 'neutral') as any}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getOrderStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      DRAFT: 'neutral',
      SUBMITTED: 'info',
      IN_PREPARATION: 'warning',
      PARTIALLY_READY: 'warning',
      READY: 'info',
      SERVED: 'success',
      CANCELLED: 'error',
      CLOSED: 'neutral',
    };
    return (
      <Badge variant={(variants[status] || 'neutral') as any}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const calculateChange = () => {
    if (paymentMethod !== 'CASH' || !cashTendered || !paymentAmount) return '0.00';
    const change = parseFloat(cashTendered) - parseFloat(paymentAmount);
    return change > 0 ? change.toFixed(2) : '0.00';
  };

  const addSplitPaymentRow = () => {
    const remaining = orderSummary ? parseFloat(orderSummary.paymentSummary.amountDue) - splitPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) : 0;
    setSplitPayments([...splitPayments, { method: 'CASH', amount: remaining > 0 ? remaining.toFixed(2) : '0', referenceNumber: '', providerName: '' }]);
  };

  const updateSplitPayment = (index: number, field: string, value: string) => {
    const updated = [...splitPayments];
    (updated[index] as any)[field] = value;
    setSplitPayments(updated);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const splitRemaining = () => {
    if (!orderSummary) return 0;
    const totalDue = parseFloat(orderSummary.paymentSummary.amountDue);
    const allocated = splitPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    return totalDue - allocated;
  };

  const quickAmounts = (amountDue: number): number[] => {
    const amounts = [amountDue];
    const denominations = [1000, 2000, 5000, 10000, 20000, 50000];
    for (const d of denominations) {
      if (d > amountDue && d < amountDue * 3) {
        amounts.push(Math.ceil(amountDue / d) * d);
        break;
      }
    }
    return [...new Set(amounts)].sort((a, b) => a - b);
  };

  // Payment Dialog
  const renderPaymentDialog = () => {
    if (!showPaymentDialog) return null;
    const amountDue = orderSummary ? parseFloat(orderSummary.paymentSummary.amountDue) : 0;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowPaymentDialog(false)}>
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-[var(--color-text-primary)]">Process Payment</h2>
              <button onClick={() => setShowPaymentDialog(false)} className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>

          {orderSummaryLoading ? (
            <div className="p-12"><Loading message="Loading order details..." /></div>
          ) : orderSummary ? (
            <div className="p-6 space-y-6">
              {/* Order Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <p className="text-xs text-[var(--color-text-muted)]">Order</p>
                  <p className="font-medium text-[var(--color-text-primary)]">#{orderSummary.order.orderNumber}</p>
                </div>
                <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <p className="text-xs text-[var(--color-text-muted)]">Total</p>
                  <p className="font-medium text-[var(--color-text-primary)]">{formatCurrency(parseFloat(orderSummary.paymentSummary.orderTotal))}</p>
                </div>
                <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <p className="text-xs text-[var(--color-text-muted)]">Paid</p>
                  <p className="font-medium text-green-600">{formatCurrency(parseFloat(orderSummary.paymentSummary.completedPayments))}</p>
                </div>
                <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                  <p className="text-xs text-[var(--color-text-muted)]">Due</p>
                  <p className="font-semibold text-[var(--color-accent)]">{formatCurrency(parseFloat(orderSummary.paymentSummary.amountDue))}</p>
                </div>
              </div>

              {orderSummary.payments && orderSummary.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Previous Payments</h3>
                  <div className="space-y-1">
                    {orderSummary.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-[var(--color-bg-secondary)] rounded">
                        <span className="text-[var(--color-text-muted)]">{p.method} {p.paymentNumber}</span>
                        <span className={p.transactionType === 'REFUND' || p.transactionType === 'REVERSAL' ? 'text-red-500' : 'text-green-600'}>
                          {formatCurrency(parseFloat(p.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
                </div>
              )}

              {paymentSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">{paymentSuccess}</p>
                </div>
              )}

              {!paymentSuccess && (
                <>
                  {/* Split toggle */}
                  {!isSplit ? (
                    <div className="space-y-4">
                      {/* Payment Method Selection */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Payment Method</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {PAYMENT_METHODS.map((method) => {
                            const Icon = method.icon;
                            return (
                              <button
                                key={method.value}
                                onClick={() => setPaymentMethod(method.value)}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm transition-all ${
                                  paymentMethod === method.value
                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                                }`}
                              >
                                <Icon className="h-5 w-5 mb-1" />
                                <span className="text-xs">{method.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Amount to Apply</label>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          max={amountDue}
                          className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Due: {formatCurrency(amountDue)}</p>
                      </div>

                      {/* Cash specific */}
                      {paymentMethod === 'CASH' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Amount Tendered</label>
                            <input
                              type="number"
                              step="0.01"
                              value={cashTendered}
                              onChange={(e) => setCashTendered(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                            />
                          </div>
                          {/* Quick amount buttons */}
                          <div className="flex flex-wrap gap-2">
                            {quickAmounts(amountDue).map((amt) => (
                              <button
                                key={amt}
                                onClick={() => setCashTendered(String(amt))}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                  cashTendered === String(amt)
                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
                                }`}
                              >
                                {formatCurrency(amt)}
                              </button>
                            ))}
                          </div>
                          {/* Change */}
                          {cashTendered && parseFloat(cashTendered) >= parseFloat(paymentAmount) && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                Change: {formatCurrency(parseFloat(calculateChange()))}
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Reference */}
                      {paymentMethod !== 'CASH' && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            Reference Number {paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MOBILE_MONEY' ? '*' : ''}
                          </label>
                          <input
                            type="text"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="e.g. Transaction ID"
                            className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          />
                        </div>
                      )}

                      {/* Provider name */}
                      {paymentMethod === 'MOBILE_MONEY' && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Provider</label>
                          <select
                            value={providerName}
                            onChange={(e) => setProviderName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          >
                            <option value="">Select Provider</option>
                            <option value="MTN MoMo">MTN MoMo</option>
                            <option value="Airtel Money">Airtel Money</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes (optional)</label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Split Payment UI */
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Split Payment Methods</h3>
                      {splitPayments.map((sp, index) => (
                        <div key={index} className="p-3 border border-[var(--color-border)] rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <select
                              value={sp.method}
                              onChange={(e) => updateSplitPayment(index, 'method', e.target.value)}
                              className="px-3 py-1.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
                            >
                              {PAYMENT_METHODS.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                            <button onClick={() => removeSplitPayment(index)} className="text-red-500 hover:text-red-700">
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                value={sp.amount}
                                onChange={(e) => updateSplitPayment(index, 'amount', e.target.value)}
                                placeholder="Amount"
                                className="w-full px-3 py-1.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
                              />
                            </div>
                            {sp.method === 'CASH' && (
                              <div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={sp.amountTendered || ''}
                                  onChange={(e) => updateSplitPayment(index, 'amountTendered', e.target.value)}
                                  placeholder="Tendered"
                                  className="w-full px-3 py-1.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
                                />
                              </div>
                            )}
                            {sp.method !== 'CASH' && (
                              <div>
                                <input
                                  type="text"
                                  value={sp.referenceNumber || ''}
                                  onChange={(e) => updateSplitPayment(index, 'referenceNumber', e.target.value)}
                                  placeholder="Reference"
                                  className="w-full px-3 py-1.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <p className="text-sm text-[var(--color-text-muted)]">Remaining: {formatCurrency(splitRemaining())}</p>
                      <Button variant="secondary" onClick={addSplitPaymentRow} leftIcon={<Plus className="h-4 w-4" />}>
                        Add Method
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-4 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => setIsSplit(!isSplit)}
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      {isSplit ? 'Single Payment' : 'Split Payment'}
                    </button>
                    <div className="flex gap-3">
                      <Button variant="secondary" onClick={() => setShowPaymentDialog(false)} disabled={submitting}>
                        Cancel
                      </Button>
                      <Button onClick={handleRecordPayment} isLoading={submitting}>
                        {isSplit ? 'Complete Split Payment' : 'Confirm Payment'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // Refund Dialog
  const renderRefundDialog = () => {
    if (!showRefundDialog || !refundPayment) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !refunding && setShowRefundDialog(false)}>
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-display font-bold text-[var(--color-text-primary)]">Issue Refund</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <p className="text-sm text-[var(--color-text-muted)]">Payment: {refundPayment.paymentNumber}</p>
              <p className="font-medium text-[var(--color-text-primary)]">{formatCurrency(parseFloat(refundPayment.amount))}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Refund Amount</label>
              <input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                max={refundPayment.amount}
                className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Refund Method</label>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason *</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reference (optional)</label>
              <input
                type="text"
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]"
              />
            </div>
          </div>
          <div className="p-6 border-t border-[var(--color-border)] flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRefundDialog(false)} disabled={refunding}>Cancel</Button>
            <Button variant="danger" onClick={handleRefund} isLoading={refunding}>Issue Refund</Button>
          </div>
        </div>
      </div>
    );
  };

  // Void Dialog
  const renderVoidDialog = () => {
    if (!showVoidDialog) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !voiding && setShowVoidDialog(false)}>
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-display font-bold text-[var(--color-text-primary)]">Void Payment</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">This action cannot be undone. The payment will be marked as voided and a reversal record created.</p>
            <div>
              <label className="block text-sm font-medium mb-1">Reason *</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]"
              />
            </div>
          </div>
          <div className="p-6 border-t border-[var(--color-border)] flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowVoidDialog(false)} disabled={voiding}>Cancel</Button>
            <Button variant="danger" onClick={handleVoid} isLoading={voiding}>Void Payment</Button>
          </div>
        </div>
      </div>
    );
  };

  // Queue tab
  const renderQueue = () => {
    if (loading) return <Loading message="Loading payment queue..." />;
    if (error) return <ErrorState title="Error" message={error} action={<Button onClick={fetchData}>Retry</Button>} />;

    const orders = queueData?.orders || [];

    if (orders.length === 0) {
      return (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No orders awaiting payment"
          description="When orders are placed and ready, they will appear here for payment processing."
        />
      );
    }

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent>
                <p className="text-xs text-[var(--color-text-muted)]">Today's Collections</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{formatCurrency(parseFloat(summary.netCollected || '0'))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-[var(--color-text-muted)]">Cash</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(parseFloat(summary.byMethod?.CASH || '0'))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-[var(--color-text-muted)]">Mobile Money</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(parseFloat(summary.byMethod?.MOBILE_MONEY || '0'))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-[var(--color-text-muted)]">Refunds</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(parseFloat(summary.refunds || '0'))}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Payment Queue</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Order</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Table</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Waiter</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Total</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Due</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Payment Request</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => (
                    <tr key={order.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-[var(--color-text-primary)]">#{order.orderNumber}</span>
                        <p className="text-xs text-[var(--color-text-muted)]">{order.orderType}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">{order.table?.name || order.table?.code || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">{order.waiter ? `${order.waiter.firstName} ${order.waiter.lastName}` : '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {getOrderStatusBadge(order.status)}
                          {getPaymentStatusBadge(order.paymentStatus)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(parseFloat(order.totalAmount))}</td>
                      <td className="px-6 py-4 text-right font-semibold text-[var(--color-accent)]">{formatCurrency(parseFloat(order.amountDue))}</td>
                      <td className="px-6 py-4 text-center">
                        {order.paymentRequest ? (
                          <div className="flex items-center justify-center gap-1 text-xs text-yellow-600">
                            <Clock className="h-3 w-3" />
                            Requested
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" onClick={() => handleOpenPayment(order.id)} leftIcon={<CreditCard className="h-3 w-3" />}>
                            Pay
                          </Button>
                          <button
                            onClick={() => navigate(`/receipts?orderId=${order.id}`)}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {queueData?.pagination && (
              <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Page {queueData.pagination.page} of {queueData.pagination.totalPages} ({queueData.pagination.total} orders)
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page >= (queueData.pagination.totalPages || 1)} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // History tab
  const renderHistory = () => {
    if (loading) return <Loading message="Loading payment history..." />;
    if (error) return <ErrorState title="Error" message={error} action={<Button onClick={fetchData}>Retry</Button>} />;

    const payments = paymentsData?.payments || [];

    if (payments.length === 0) {
      return (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No payments recorded"
          description="Completed payments will appear here."
        />
      );
    }

    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Payment #</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Order</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Method</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Cashier</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Date</th>
                  <th className="text-right px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: any) => (
                  <tr key={payment.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                    <td className="px-6 py-4 text-sm font-medium">{payment.paymentNumber}</td>
                    <td className="px-6 py-4 text-sm">#{payment.orderNumber}</td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">{payment.method}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={
                        payment.status === 'COMPLETED' ? 'success' :
                        payment.status === 'FAILED' ? 'error' :
                        payment.status === 'VOIDED' ? 'error' : 'warning'
                      }>
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {payment.transactionType === 'REFUND' || payment.transactionType === 'REVERSAL' ? (
                        <span className="text-red-500">-{formatCurrency(parseFloat(payment.amount))}</span>
                      ) : (
                        <span className="text-green-600">{formatCurrency(parseFloat(payment.amount))}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{payment.receivedBy?.firstName} {payment.receivedBy?.lastName}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(payment.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payment.transactionType === 'PAYMENT' && payment.status === 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setRefundPayment(payment);
                              setRefundAmount(payment.amount);
                              setRefundMethod('CASH');
                              setRefundReason('');
                              setRefundReference('');
                              setShowRefundDialog(true);
                            }}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
                            title="Refund"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {payment.status === 'COMPLETED' && payment.transactionType === 'PAYMENT' && (
                          <button
                            onClick={() => {
                              setVoidPaymentId(payment.id);
                              setVoidReason('');
                              setShowVoidDialog(true);
                            }}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Void"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paymentsData?.pagination && (
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                Page {paymentsData.pagination.page} of {paymentsData.pagination.totalPages} ({paymentsData.pagination.total} payments)
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={page >= (paymentsData.pagination.totalPages || 1)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Payments"
        description="Process payments and manage transactions"
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === 'queue' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setSearchParams({ tab: 'queue' }); setPage(1); }}
            >
              Queue
            </Button>
            <Button
              variant={tab === 'history' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setSearchParams({ tab: 'history' }); setPage(1); }}
            >
              History
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} leftIcon={<Filter className="h-4 w-4" />}>
              Filters
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
          />
        </div>
      </div>

      {tab === 'queue' ? renderQueue() : renderHistory()}

      {renderPaymentDialog()}
      {renderRefundDialog()}
      {renderVoidDialog()}
    </div>
  );
}
