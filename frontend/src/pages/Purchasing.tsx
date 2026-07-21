import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, FileText, Receipt, Undo2, ClipboardCheck, AlertTriangle, Plus, RefreshCw,
  Search, CheckCircle2, XCircle, Eye, X, ArrowUpDown, DollarSign, Truck, Edit3,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import api from '@/services/api';
import { formatCurrency, formatDate, cn } from '@/lib';

type Mode = 'requisitions' | 'purchase-orders' | 'invoices' | 'returns' | 'stock-counts' | 'reorder';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function Purchasing() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useMemo<Mode>(() => {
    const p = location.pathname;
    if (p.includes('/purchase-orders')) return 'purchase-orders';
    if (p.includes('/invoices')) return 'invoices';
    if (p.includes('/returns')) return 'returns';
    if (p.includes('/stock-counts')) return 'stock-counts';
    if (p.includes('/reorder')) return 'reorder';
    return 'requisitions';
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pagination, setPagination] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderSuggestions, setReorderSuggestions] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'reorder') {
        const res = await api.get('/procurement/reorder-suggestions');
        setReorderSuggestions(res.data.data ?? []);
      } else {
        const res = await api.get(`/procurement/${mode}`, { params: { pageSize: 50 } });
        setData(res.data.data ?? []);
        setPagination(res.data.pagination ?? null);
      }
    } catch (err) {
      setError(getErrorMessage(err, `Failed to load ${mode}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [mode]);

  // Auto-dismiss messages
  useEffect(() => { if (error || success) { const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000); return () => clearTimeout(t); } }, [error, success]);

  const viewDetail = async (id: string) => {
    try {
      const res = await api.get(`/procurement/${mode}/${id}`);
      setDetail(res.data.data);
      setShowDetail(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load details'));
    }
  };

  const tabs: { key: Mode; label: string; icon: typeof ShoppingCart }[] = [
    { key: 'requisitions', label: 'Requisitions', icon: FileText },
    { key: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
    { key: 'returns', label: 'Returns', icon: Undo2 },
    { key: 'stock-counts', label: 'Stock Counts', icon: ClipboardCheck },
    { key: 'reorder', label: 'Reorder', icon: AlertTriangle },
  ];

  const statusBadge = (status: string, variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {}) => {
    const v = variants[status] || 'neutral';
    return <Badge variant={v} className="text-[10px]">{status?.replace(/_/g, ' ')}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Purchasing"
        description="Manage purchase requisitions, orders, invoices, returns, and stock counts"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            {mode !== 'reorder' && (
              <Button onClick={() => setShowForm(true)} leftIcon={<Plus className="h-4 w-4" />}>
                {mode === 'requisitions' ? 'New Requisition' : mode === 'purchase-orders' ? 'New PO' : mode === 'invoices' ? 'New Invoice' : mode === 'returns' ? 'New Return' : 'New Count'}
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(`/purchasing/${tab.key === 'requisitions' ? '' : tab.key}`)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                mode === tab.key
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 text-sm text-green-700 dark:text-green-300">{success}</div>}

      <Card><CardContent>
        {loading ? <Loading message={`Loading ${mode}...`} /> : renderContent()}
      </CardContent></Card>

      {/* Detail Modal */}
      {showDetail && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{detail.requisitionNumber || detail.orderNumber || detail.invoiceNumber || detail.returnNumber || detail.countNumber}</h2>
              <button onClick={() => setShowDetail(false)} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-[var(--color-bg-secondary)] p-4 rounded-lg max-h-[60vh] overflow-auto">{JSON.stringify(detail, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );

  function renderContent() {
    if (mode === 'reorder') return renderReorderSuggestions();

    if (data.length === 0) {
      return <EmptyState icon={<FileText className="h-16 w-16" />} title={`No ${mode.replace('-', ' ')}`} description={`Create your first ${mode.slice(0, -1)} to get started.`} action={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Create</Button>} />;
    }

    const statusVariants: Record<string, Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'>> = {
      requisitions: { DRAFT: 'neutral', SUBMITTED: 'info', APPROVED: 'success', PARTIALLY_APPROVED: 'warning', REJECTED: 'error', CONVERTED: 'success', CANCELLED: 'error' },
      'purchase-orders': { DRAFT: 'neutral', PENDING_APPROVAL: 'warning', APPROVED: 'success', SENT: 'info', PARTIALLY_RECEIVED: 'warning', FULLY_RECEIVED: 'success', CLOSED: 'neutral', CANCELLED: 'error' },
      invoices: { DRAFT: 'neutral', VERIFIED: 'info', PARTIALLY_MATCHED: 'warning', MATCHED: 'success', DISPUTED: 'error', CANCELLED: 'error' },
      returns: { DRAFT: 'neutral', APPROVED: 'success', POSTED: 'info', CANCELLED: 'error' },
      'stock-counts': { DRAFT: 'neutral', IN_PROGRESS: 'warning', SUBMITTED: 'info', PENDING_APPROVAL: 'warning', APPROVED: 'success', POSTED: 'success', REJECTED: 'error', CANCELLED: 'error' },
    };

    const variant = statusVariants[mode] || {};

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
              <th className="px-3 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Supplier</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold text-right">Amount</th>
              <th className="px-3 py-3 font-semibold">Created</th>
              <th className="px-3 py-3 font-semibold">By</th>
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.map((item: any) => (
              <tr key={item.id} className="hover:bg-[var(--color-bg-secondary)]">
                <td className="px-3 py-3 font-mono text-xs font-medium">
                  {item.requisitionNumber || item.orderNumber || item.invoiceNumber || item.returnNumber || item.countNumber}
                </td>
                <td className="px-3 py-3">{item.supplier?.name ?? '-'}</td>
                <td className="px-3 py-3">{statusBadge(item.status, variant)}</td>
                <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(item.totalAmount || item.subtotal)}</td>
                <td className="px-3 py-3 text-xs">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-3 text-xs">{item.createdBy?.firstName} {item.createdBy?.lastName}</td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => viewDetail(item.id)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderReorderSuggestions() {
    if (reorderSuggestions.length === 0) {
      return <EmptyState icon={<CheckCircle2 className="h-16 w-16 text-green-500" />} title="Stock levels look good" description="No items are below their reorder level." />;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{reorderSuggestions.length} items need reordering</span>
          <span className="text-[var(--color-text-muted)]">| Est. cost: {formatCurrency(reorderSuggestions.reduce((s: number, r: any) => s + (r.estimatedCost || 0), 0))}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                <th className="px-3 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 font-semibold">Location</th>
                <th className="px-3 py-3 text-right font-semibold">On Hand</th>
                <th className="px-3 py-3 text-right font-semibold">Available</th>
                <th className="px-3 py-3 text-right font-semibold">Reorder At</th>
                <th className="px-3 py-3 text-right font-semibold">Suggested Qty</th>
                <th className="px-3 py-3 text-right font-semibold">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {reorderSuggestions.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-[var(--color-bg-secondary)]">
                  <td className="px-3 py-3">
                    <span className="font-medium">{r.itemName}</span>
                    <br /><span className="text-[10px] text-[var(--color-text-muted)]">{r.sku} · {r.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-xs">{r.location}</td>
                  <td className="px-3 py-3 text-right font-mono">{r.onHand}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-red-500">{r.available}</td>
                  <td className="px-3 py-3 text-right font-mono">{r.reorderLevel}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-amber-600">{r.suggestedOrderQty}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(r.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
