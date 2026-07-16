import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes, Edit3, PackagePlus, Plus, RefreshCw, X, AlertTriangle,
  Package, Warehouse, Truck, Receipt, ArrowUpDown, Activity,
  CheckCircle2, XCircle, Clock, Search, Move,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import api from '@/services/api';
import { formatCurrency, formatDate, cn } from '@/lib';

// Types
type Mode = 'items' | 'categories' | 'locations' | 'suppliers' | 'receipts' | 'adjustments' | 'movements' | 'alerts';

interface InventoryCategory { id: string; name: string; isActive?: boolean; displayOrder?: number; _count?: { inventoryItems: number } }
interface StockLocation { id: string; name: string; code: string; locationType?: string; isDefault: boolean; isActive: boolean }
interface Supplier { id: string; name: string; supplierCode: string; contactPerson?: string; phone?: string; email?: string; isActive: boolean }
interface InventoryItem {
  id: string; name: string; sku: string; baseUnit: string; reorderLevel: number; targetStockLevel?: number;
  isActive: boolean; category?: InventoryCategory | null; averageCost?: number;
  inventoryBalances?: Array<{ onHandQuantity: number; reservedQuantity: number; stockLocation: { id: string; name: string; isDefault: boolean } }>;
}

interface StockReceipt {
  id: string; receiptNumber: string; status: string; supplierReference?: string;
  createdAt: string; postedAt?: string; cancelledAt?: string;
  supplier?: { id: string; name: string } | null;
  stockLocation?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  lines?: Array<{ id: string; inventoryItem: { name: string; sku: string }; quantity: number; unitCost: number; totalCost: number }>;
  _count?: { lines: number };
}

interface StockMovement {
  id: string; movementType: string; quantity: number; quantityBefore: number; quantityAfter: number;
  reason?: string; referenceNumber?: string; createdAt: string;
  inventoryItem: { id: string; name: string; sku: string; baseUnit: string };
  stockLocation: { id: string; name: string };
  actor: { id: string; firstName: string; lastName: string };
}

interface Alert {
  itemId: string; itemName: string; sku: string; location: string;
  alertType: string; message: string; onHand: number; reorderLevel: number;
}

const units = ['PIECE', 'PORTION', 'BOTTLE', 'CAN', 'PACK', 'BOX', 'GRAM', 'KILOGRAM', 'MILLILITRE', 'LITRE', 'OTHER'];

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useMemo<Mode>(() => {
    const p = location.pathname;
    if (p.includes('/categories')) return 'categories';
    if (p.includes('/locations')) return 'locations';
    if (p.includes('/suppliers')) return 'suppliers';
    if (p.includes('/receipts')) return 'receipts';
    if (p.includes('/adjustments')) return 'adjustments';
    if (p.includes('/movements')) return 'movements';
    if (p.includes('/alerts')) return 'alerts';
    return 'items';
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Data states
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemDetail, setItemDetail] = useState<any>(null);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [receiptDetail, setReceiptDetail] = useState<StockReceipt | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  // Receipt creation
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptForm, setReceiptForm] = useState<Record<string, any>>({ supplierId: '', stockLocationId: '', notes: '', receiptDate: new Date().toISOString().split('T')[0] });
  const [receiptLines, setReceiptLines] = useState<Array<{ inventoryItemId: string; quantity: string; unitCost: string }>>([]);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);

  // Adjustment form
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjForm, setAdjForm] = useState<Record<string, any>>({ inventoryItemId: '', stockLocationId: '', quantity: '', movementType: 'MANUAL_ADJUSTMENT_IN', reason: '' });

  // Transfer form
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferForm, setTransferForm] = useState<Record<string, any>>({ inventoryItemId: '', fromLocationId: '', toLocationId: '', quantity: '', reason: '' });

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (mode) {
        case 'items': {
          const [itemRes, catRes] = await Promise.all([
            api.get('/inventory/items', { params: { pageSize: 100, search: searchQuery || undefined } }),
            api.get('/inventory/categories'),
          ]);
          setItems(itemRes.data.items ?? []);
          setPagination({ total: itemRes.data.total, page: itemRes.data.page, totalPages: itemRes.data.totalPages });
          setCategories(catRes.data.data ?? []);
          break;
        }
        case 'categories': {
          const res = await api.get('/inventory/categories', { params: { isActive: undefined } });
          setCategories(res.data.data ?? []);
          break;
        }
        case 'locations': {
          const res = await api.get('/inventory/locations');
          setLocations(res.data.data ?? []);
          break;
        }
        case 'suppliers': {
          const res = await api.get('/suppliers', { params: { pageSize: 100, search: searchQuery || undefined } });
          setSuppliers(res.data.suppliers ?? []);
          setPagination({ total: res.data.total, page: res.data.page, totalPages: res.data.totalPages });
          break;
        }
        case 'receipts': {
          const [recRes, locRes, itemRes2, supRes] = await Promise.all([
            api.get('/inventory/receipts', { params: { pageSize: 50 } }),
            api.get('/inventory/locations'),
            api.get('/inventory/items', { params: { pageSize: 200 } }),
            api.get('/suppliers', { params: { pageSize: 100 } }),
          ]);
          setReceipts(recRes.data.receipts ?? []);
          setPagination({ total: recRes.data.total, page: recRes.data.page, totalPages: recRes.data.totalPages });
          setLocations(locRes.data.data ?? []);
          setAvailableItems(itemRes2.data.items ?? []);
          setSuppliers(supRes.data.suppliers ?? []);
          break;
        }
        case 'adjustments': {
          const [locRes, itemRes3, movRes] = await Promise.all([
            api.get('/inventory/locations'),
            api.get('/inventory/items', { params: { pageSize: 200 } }),
            api.get('/inventory/movements', { params: { pageSize: 100 } }),
          ]);
          setLocations(locRes.data.data ?? []);
          setAvailableItems(itemRes3.data.items ?? []);
          setMovements(movRes.data.movements ?? []);
          break;
        }
        case 'movements': {
          const res = await api.get('/inventory/movements', { params: { pageSize: 50, page } });
          setMovements(res.data.movements ?? []);
          setPagination({ total: res.data.total, page: res.data.page, totalPages: res.data.totalPages });
          break;
        }
        case 'alerts': {
          const [alertsRes, summaryRes] = await Promise.all([
            api.get('/inventory/movements/alerts'),
            api.get('/inventory/movements/summary'),
          ]);
          setAlerts(alertsRes.data.data ?? []);
          setSummary(summaryRes.data ?? null);
          break;
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, `Failed to load ${mode}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); loadData(); }, [mode, searchQuery]);
  useEffect(() => { if (page > 1) loadData(); }, [page]);

  // CRUD operations
  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm(mode));
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };
  const openEdit = (record: any) => {
    setEditing(record);
    setForm(formFromRecord(mode, record));
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const submitRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(null); setSuccess(null);
    try {
      const endpoint = endpointFor(mode);
      const payload = payloadFor(mode, form);
      const response = editing ? await api.patch(`${endpoint}/${editing.id}`, payload) : await api.post(endpoint, payload);
      setSuccess(`${titleFor(mode)} ${editing ? 'updated' : 'created'}.`);
      setShowForm(false); setEditing(null);
      loadData();
    } catch (err) { setError(getErrorMessage(err, `Could not save ${titleFor(mode).toLowerCase()}`)); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (record: any) => {
    try {
      const endpoint = endpointFor(mode);
      const res = await api.patch(`${endpoint}/${record.id}/status`, { isActive: !record.isActive });
      setSuccess(`${titleFor(mode)} status updated.`);
      loadData();
    } catch (err) { setError(getErrorMessage(err, 'Could not update status')); }
  };

  // Receipt operations
  const createReceipt = async () => {
    setSaving(true); setError(null);
    try {
      const res = await api.post('/inventory/receipts', {
        supplierId: receiptForm.supplierId || null,
        stockLocationId: receiptForm.stockLocationId,
        receiptDate: receiptForm.receiptDate || new Date().toISOString().split('T')[0],
        notes: receiptForm.notes || null,
      });
      const receiptId = res.data.data.id;
      // Add lines
      for (const line of receiptLines) {
        if (line.inventoryItemId && line.quantity) {
          await api.post(`/inventory/receipts/${receiptId}/lines`, {
            inventoryItemId: line.inventoryItemId,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost || 0),
          });
        }
      }
      // Post receipt
      await api.post(`/inventory/receipts/${receiptId}/post`);
      setSuccess('Receipt created and posted successfully.');
      setShowReceiptForm(false);
      setReceiptLines([]);
      if (mode === 'receipts') loadData();
    } catch (err) { setError(getErrorMessage(err, 'Failed to create receipt')); }
    finally { setSaving(false); }
  };

  const postReceipt = async (id: string) => {
    try { await api.post(`/inventory/receipts/${id}/post`); setSuccess('Receipt posted.'); loadData(); }
    catch (err) { setError(getErrorMessage(err, 'Failed to post receipt')); }
  };

  const cancelReceipt = async (id: string) => {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    try { await api.post(`/inventory/receipts/${id}/cancel`, { reason }); setSuccess('Receipt cancelled.'); loadData(); }
    catch (err) { setError(getErrorMessage(err, 'Failed to cancel receipt')); }
  };

  // Transfer
  const createTransfer = async () => {
    setSaving(true); setError(null);
    try {
      await api.post('/inventory/movements/transfer', {
        inventoryItemId: transferForm.inventoryItemId,
        fromLocationId: transferForm.fromLocationId,
        toLocationId: transferForm.toLocationId,
        quantity: Number(transferForm.quantity),
        reason: transferForm.reason,
      });
      setSuccess('Stock transferred successfully.');
      setShowTransferForm(false);
      setTransferForm({ inventoryItemId: '', fromLocationId: '', toLocationId: '', quantity: '', reason: '' });
      if (mode === 'adjustments') loadData();
    } catch (err) { setError(getErrorMessage(err, 'Failed to transfer stock')); }
    finally { setSaving(false); }
  };

  // Adjustment
  const createAdjustment = async () => {
    setSaving(true); setError(null);
    try {
      await api.post('/inventory/movements/adjustments', {
        inventoryItemId: adjForm.inventoryItemId,
        stockLocationId: adjForm.stockLocationId || undefined,
        quantity: Number(adjForm.quantity),
        movementType: adjForm.movementType,
        reason: adjForm.reason,
      });
      setSuccess('Adjustment recorded.');
      setShowAdjForm(false);
      setAdjForm({ inventoryItemId: '', stockLocationId: '', quantity: '', movementType: 'MANUAL_ADJUSTMENT_IN', reason: '' });
    } catch (err) { setError(getErrorMessage(err, 'Failed to create adjustment')); }
    finally { setSaving(false); }
  };

  // Message auto-dismiss
  useEffect(() => { if (error || success) { const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000); return () => clearTimeout(t); } }, [error, success]);

  const tabs: { key: Mode; label: string; icon: typeof Boxes }[] = [
    { key: 'items', label: 'Items', icon: Package },
    { key: 'categories', label: 'Categories', icon: Boxes },
    { key: 'locations', label: 'Locations', icon: Warehouse },
    { key: 'suppliers', label: 'Suppliers', icon: Truck },
    { key: 'receipts', label: 'Receipts', icon: Receipt },
    { key: 'adjustments', label: 'Adjustments', icon: Activity },
    { key: 'movements', label: 'Movements', icon: ArrowUpDown },
    { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Inventory"
        description="Manage stock items, receipts, movements, and suppliers"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            {mode !== 'movements' && mode !== 'alerts' && (
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                {mode === 'receipts' ? 'New Receipt' : `Add ${titleFor(mode)}`}
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
              onClick={() => navigate(tab.key === 'items' ? '/inventory/items' : `/inventory/${tab.key}`)}
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

      {/* Messages */}
      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex justify-between items-center"><span className="text-sm text-red-700 dark:text-red-300">{error}</span><button onClick={() => setError(null)} className="text-sm text-red-500 hover:underline">Dismiss</button></div>}
      {success && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 flex justify-between items-center"><span className="text-sm text-green-700 dark:text-green-300">{success}</span><button onClick={() => setSuccess(null)} className="text-sm text-green-500 hover:underline">Dismiss</button></div>}

      {/* Search (items & suppliers) */}
      {(mode === 'items' || mode === 'suppliers') && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input type="text" placeholder={`Search ${mode}...`} value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
        </div>
      )}

      {/* Form Modal */}
      {showForm && mode !== 'receipts' && mode !== 'adjustments' && mode !== 'movements' && mode !== 'alerts' && (
        <Card><CardContent>
          <form onSubmit={submitRecord} className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-base font-semibold">{editing ? 'Edit' : 'Add'} {titleFor(mode)}</h2></div>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
            </div>
            <FormFields mode={mode} form={form} setForm={setForm} categories={categories} locations={locations} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" isLoading={saving}>Save</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {/* Receipt Form */}
      {showReceiptForm && (
        <Card><CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">New Stock Receipt</h2>
            <button onClick={() => setShowReceiptForm(false)} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1"><span className="text-xs font-medium">Location *</span>
              <select value={receiptForm.stockLocationId} onChange={e => setReceiptForm({ ...receiptForm, stockLocationId: e.target.value })} className="input-field">
                <option value="">Select...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">Supplier</span>
              <select value={receiptForm.supplierId} onChange={e => setReceiptForm({ ...receiptForm, supplierId: e.target.value })} className="input-field">
                <option value="">None</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">Notes</span>
              <input value={receiptForm.notes} onChange={e => setReceiptForm({ ...receiptForm, notes: e.target.value })} className="input-field" />
            </label>
          </div>

          {/* Receipt Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Items ({receiptLines.length})</h3>
              <Button size="sm" variant="secondary" onClick={() => setReceiptLines([...receiptLines, { inventoryItemId: '', quantity: '1', unitCost: '0' }])}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
            {receiptLines.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] py-4">Add items to the receipt.</p>
            ) : (
              <div className="space-y-2">
                {receiptLines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <div className="flex-1">
                      <select value={line.inventoryItemId} onChange={e => { const u = [...receiptLines]; u[i].inventoryItemId = e.target.value; setReceiptLines(u); }} className="input-field text-xs">
                        <option value="">Select item...</option>
                        {availableItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                      </select>
                    </div>
                    <input type="number" min="1" value={line.quantity} onChange={e => { const u = [...receiptLines]; u[i].quantity = e.target.value; setReceiptLines(u); }} placeholder="Qty" className="w-20 input-field text-xs" />
                    <input type="number" min="0" step="0.01" value={line.unitCost} onChange={e => { const u = [...receiptLines]; u[i].unitCost = e.target.value; setReceiptLines(u); }} placeholder="Cost" className="w-24 input-field text-xs" />
                    <button onClick={() => setReceiptLines(receiptLines.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <p className="text-xs text-[var(--color-text-muted)]">
                  Total: {formatCurrency(receiptLines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0))}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowReceiptForm(false)}>Cancel</Button>
            <Button onClick={createReceipt} isLoading={saving} disabled={!receiptForm.stockLocationId || receiptLines.length === 0}>
              Create & Post Receipt
            </Button>
          </div>
        </CardContent></Card>
      )}

      {/* Adjustment Form */}
      {/* Transfer Form */}
      {showTransferForm && (
        <Card><CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Transfer Stock Between Locations</h2>
            <button onClick={() => setShowTransferForm(false)} className="p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1"><span className="text-xs font-medium">Item *</span>
              <select value={transferForm.inventoryItemId} onChange={e => setTransferForm({ ...transferForm, inventoryItemId: e.target.value })} className="input-field">
                <option value="">Select...</option>
                {availableItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">From Location *</span>
              <select value={transferForm.fromLocationId} onChange={e => setTransferForm({ ...transferForm, fromLocationId: e.target.value })} className="input-field">
                <option value="">Select...</option>
                {locations.map(l => <option key={l.id} value={l.id} disabled={l.id === transferForm.toLocationId}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">To Location *</span>
              <select value={transferForm.toLocationId} onChange={e => setTransferForm({ ...transferForm, toLocationId: e.target.value })} className="input-field">
                <option value="">Select...</option>
                {locations.map(l => <option key={l.id} value={l.id} disabled={l.id === transferForm.fromLocationId}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">Quantity *</span>
              <input type="number" min="0.01" step="any" value={transferForm.quantity} onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })} className="input-field" placeholder="e.g. 10" />
            </label>
            <label className="space-y-1 col-span-full"><span className="text-xs font-medium">Reason *</span>
              <textarea value={transferForm.reason} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} rows={2} className="input-field" placeholder="Why is this transfer needed?" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowTransferForm(false)}>Cancel</Button>
            <Button onClick={createTransfer} isLoading={saving} disabled={!transferForm.inventoryItemId || !transferForm.fromLocationId || !transferForm.toLocationId || !transferForm.quantity || !transferForm.reason}>
              <Move className="h-4 w-4" /> Complete Transfer
            </Button>
          </div>
        </CardContent></Card>
      )}

      {showAdjForm && (
        <Card><CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Stock Adjustment</h2>
            <button onClick={() => setShowAdjForm(false)} className="p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1"><span className="text-xs font-medium">Item *</span>
              <select value={adjForm.inventoryItemId} onChange={e => setAdjForm({ ...adjForm, inventoryItemId: e.target.value })} className="input-field">
                <option value="">Select...</option>
                {availableItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">Location</span>
              <select value={adjForm.stockLocationId} onChange={e => setAdjForm({ ...adjForm, stockLocationId: e.target.value })} className="input-field">
                <option value="">Default</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">Type *</span>
              <select value={adjForm.movementType} onChange={e => setAdjForm({ ...adjForm, movementType: e.target.value })} className="input-field">
                <option value="MANUAL_ADJUSTMENT_IN">Stock In (Increase)</option>
                <option value="MANUAL_ADJUSTMENT_OUT">Stock Out (Decrease)</option>
                <option value="WASTAGE">Wastage</option>
                <option value="RETURN_TO_STOCK">Return to Stock</option>
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-medium">Quantity *</span>
              <input type="number" min="0.01" step="any" value={adjForm.quantity} onChange={e => setAdjForm({ ...adjForm, quantity: e.target.value })} className="input-field" />
            </label>
            <label className="space-y-1 col-span-full"><span className="text-xs font-medium">Reason *</span>
              <textarea value={adjForm.reason} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })} rows={2} className="input-field" placeholder="Explain why this adjustment is needed..." />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAdjForm(false)}>Cancel</Button>
            <Button onClick={createAdjustment} isLoading={saving} disabled={!adjForm.inventoryItemId || !adjForm.quantity || !adjForm.reason}>Record Adjustment</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Main content */}
      <Card><CardContent>
        {loading ? <Loading message={`Loading ${mode}...`} /> : renderContent()}
      </CardContent></Card>
    </div>
  );

  function renderContent() {
    switch (mode) {
      case 'items': return renderItems();
      case 'categories': return renderTable(categories, headersFor('categories'), cellsFor('categories'), 'categories');
      case 'locations': return renderTable(locations, headersFor('locations'), cellsFor('locations'), 'locations');
      case 'suppliers': return renderTable(suppliers, headersFor('suppliers'), cellsFor('suppliers'), 'suppliers');
      case 'receipts': return renderReceipts();
      case 'adjustments': return renderAdjustments();
      case 'movements': return renderMovements();
      case 'alerts': return renderAlerts();
      default: return <EmptyState icon={<Boxes className="h-12 w-12" />} title="Select a tab" description="Choose an inventory section to manage." />;
    }
  }

  // === ITEMS ===
  function renderItems() {
    if (items.length === 0) {
      return <EmptyState icon={<Package className="h-16 w-16" />} title="No inventory items" description="Add items to start tracking stock." action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Item</Button>} />;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
              <th className="px-3 py-3 font-semibold">SKU</th>
              <th className="px-3 py-3 font-semibold">Name</th>
              <th className="px-3 py-3 font-semibold">Category</th>
              <th className="px-3 py-3 font-semibold">Unit</th>
              <th className="px-3 py-3 font-semibold text-right">On Hand</th>
              <th className="px-3 py-3 font-semibold text-right">Reserved</th>
              <th className="px-3 py-3 font-semibold text-right">Available</th>
              <th className="px-3 py-3 font-semibold text-right">Reorder</th>
              <th className="px-3 py-3 font-semibold text-center">Status</th>
              <th className="px-3 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {items.map(item => {
              const totalOnHand = item.inventoryBalances?.reduce((s, b) => s + Number(b.onHandQuantity), 0) || 0;
              const totalReserved = item.inventoryBalances?.reduce((s, b) => s + Number(b.reservedQuantity), 0) || 0;
              const available = totalOnHand - totalReserved;
              const isLowStock = item.reorderLevel > 0 && available <= item.reorderLevel;
              const isOutOfStock = available <= 0;

              return (
                <tr key={item.id} className="hover:bg-[var(--color-bg-secondary)]">
                  <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-3 font-medium">{item.name}</td>
                  <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.category?.name ?? '-'}</td>
                  <td className="px-3 py-3 text-xs">{item.baseUnit}</td>
                  <td className="px-3 py-3 text-right font-mono">{totalOnHand}</td>
                  <td className="px-3 py-3 text-right font-mono">{totalReserved}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    <span className={cn(isOutOfStock ? 'text-red-500 font-bold' : isLowStock ? 'text-amber-500 font-bold' : 'text-green-600')}>
                      {available}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">{item.reorderLevel || '-'}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                      item.isActive ? (isOutOfStock ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : isLowStock ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400') : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                    )}>
                      {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => toggleStatus(item)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">{item.isActive ? 'Disable' : 'Enable'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination && <PaginationControls />}
      </div>
    );
  }

  // === RECEIPTS ===
  function renderReceipts() {
    if (receipts.length === 0 && !showReceiptForm) {
      return <EmptyState icon={<Receipt className="h-16 w-16" />} title="No stock receipts" description="Record incoming stock from suppliers." action={<Button onClick={() => setShowReceiptForm(true)}><PackagePlus className="h-4 w-4" /> New Receipt</Button>} />;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
              <th className="px-3 py-3">Receipt #</th>
              <th className="px-3 py-3">Supplier</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3 text-right">Items</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {receipts.map(rec => (
              <tr key={rec.id} className="hover:bg-[var(--color-bg-secondary)]">
                <td className="px-3 py-3 font-mono text-xs font-medium">{rec.receiptNumber}</td>
                <td className="px-3 py-3">{rec.supplier?.name ?? '-'}</td>
                <td className="px-3 py-3 text-[var(--color-text-secondary)]">{rec.stockLocation?.name ?? '-'}</td>
                <td className="px-3 py-3 text-right">{rec._count?.lines ?? '-'}</td>
                <td className="px-3 py-3">
                  <Badge variant={rec.status === 'POSTED' ? 'success' : rec.status === 'DRAFT' ? 'warning' : 'error'} className="text-[10px]">
                    {rec.status}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-xs">{formatDate(rec.createdAt)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {rec.status === 'DRAFT' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => postReceipt(rec.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelReceipt(rec.id)} className="text-red-500"><XCircle className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // === ADJUSTMENTS ===
  function renderAdjustments() {
    if (movements.length === 0 && !showAdjForm) {
      return (
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)] mb-4">Record manual stock adjustments for inventory corrections, wastage, or returns.</p>
          <Button onClick={() => setShowAdjForm(true)}><Plus className="h-4 w-4" /> New Adjustment</Button>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3">Reason</th>
              <th className="px-3 py-3">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {movements.filter(m => ['MANUAL_ADJUSTMENT_IN','MANUAL_ADJUSTMENT_OUT','WASTAGE','RETURN_TO_STOCK'].includes(m.movementType)).map(m => {
              const isIncrease = ['MANUAL_ADJUSTMENT_IN', 'RETURN_TO_STOCK'].includes(m.movementType);
              return (
                <tr key={m.id} className="hover:bg-[var(--color-bg-secondary)]">
                  <td className="px-3 py-3 text-xs">{formatDate(m.createdAt)}</td>
                  <td className="px-3 py-3 font-medium">
                    {m.inventoryItem.name}<br /><span className="text-[10px] text-[var(--color-text-muted)]">{m.inventoryItem.sku}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={isIncrease ? 'success' : 'error'} className="text-[10px]">
                      {m.movementType.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs">{m.stockLocation.name}</td>
                  <td className={cn('px-3 py-3 text-right font-mono font-medium', isIncrease ? 'text-green-600' : 'text-red-500')}>
                    {isIncrease ? '+' : '-'}{m.quantity}
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">{m.reason || '-'}</td>
                  <td className="px-3 py-3 text-xs">{m.actor.firstName} {m.actor.lastName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <Button onClick={() => setShowTransferForm(true)} variant="secondary" leftIcon={<Move className="h-4 w-4" />}>Transfer Stock</Button>
          <Button onClick={() => setShowAdjForm(true)} leftIcon={<Plus className="h-4 w-4" />}>New Adjustment</Button>
        </div>
      </div>
    );
  }

  // === MOVEMENTS ===
  function renderMovements() {
    if (movements.length === 0) {
      return <EmptyState icon={<ArrowUpDown className="h-16 w-16" />} title="No stock movements" description="Stock movements will appear as items are received, consumed, or adjusted." />;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3 text-right">Before</th>
              <th className="px-3 py-3 text-right">After</th>
              <th className="px-3 py-3">By</th>
              <th className="px-3 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {movements.map(m => {
              const isIncrease = ['OPENING_BALANCE', 'MANUAL_ADJUSTMENT_IN', 'RETURN_TO_STOCK'].includes(m.movementType);
              return (
                <tr key={m.id} className="hover:bg-[var(--color-bg-secondary)]">
                  <td className="px-3 py-3 text-xs">{formatDate(m.createdAt)}</td>
                  <td className="px-3 py-3 font-medium">{m.inventoryItem.name}<br /><span className="text-[10px] text-[var(--color-text-muted)]">{m.inventoryItem.sku}</span></td>
                  <td className="px-3 py-3">
                    <Badge variant={isIncrease ? 'success' : 'error'} className="text-[10px]">
                      {m.movementType.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs">{m.stockLocation.name}</td>
                  <td className={cn('px-3 py-3 text-right font-mono font-medium', isIncrease ? 'text-green-600' : 'text-red-500')}>
                    {isIncrease ? '+' : '-'}{m.quantity}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{m.quantityBefore}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{m.quantityAfter}</td>
                  <td className="px-3 py-3 text-xs">{m.actor.firstName} {m.actor.lastName}</td>
                  <td className="px-3 py-3 text-xs text-[var(--color-text-muted)] truncate max-w-[150px]">{m.reason || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination && <PaginationControls />}
      </div>
    );
  }

  // === ALERTS ===
  function renderAlerts() {
    if (alerts.length === 0) {
      return <EmptyState icon={<CheckCircle2 className="h-16 w-16 text-green-500" />} title="Inventory looks healthy" description="No low-stock, out-of-stock, or negative stock alerts." />;
    }

    const negative = alerts.filter(a => a.alertType === 'NEGATIVE_STOCK');
    const outOfStock = alerts.filter(a => a.alertType === 'OUT_OF_STOCK');
    const lowStock = alerts.filter(a => a.alertType === 'LOW_STOCK');

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1"><XCircle className="h-3 w-3" /> Negative</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{negative.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Out of Stock</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{outOfStock.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Low Stock</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{lowStock.length}</p>
          </div>
        </div>

        {/* Alerts list */}
        <div className="space-y-1.5">
          {alerts.map(alert => (
            <div key={`${alert.itemId}-${alert.location}`} className={cn(
              'flex items-center justify-between p-3 rounded-lg border text-sm',
              alert.alertType === 'NEGATIVE_STOCK' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30' :
                alert.alertType === 'OUT_OF_STOCK' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30' :
                  'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
            )}>
              <div className="flex items-center gap-3 min-w-0">
                {alert.alertType === 'NEGATIVE_STOCK' ? <XCircle className="h-4 w-4 text-red-500 shrink-0" /> :
                  alert.alertType === 'OUT_OF_STOCK' ? <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /> :
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium truncate">{alert.itemName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{alert.sku} · {alert.location}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="font-mono font-bold">{alert.onHand} on hand</p>
                <p className="text-xs text-[var(--color-text-muted)]">Reorder at {alert.reorderLevel}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === GENERIC TABLE ===
  function renderTable(records: any[], headers: string[], cellRenderers: ((r: any) => ReactNode)[], modeType: string) {
    if (records.length === 0) {
      return <EmptyState icon={<Boxes className="h-12 w-12" />} title={`No ${titleFor(modeType).toLowerCase()}s`} description={`Add ${titleFor(modeType).toLowerCase()}s to get started.`} action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add {titleFor(modeType)}</Button>} />;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
              {headers.map(h => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {records.map(record => (
              <tr key={record.id} className="hover:bg-[var(--color-bg-secondary)]">
                {cellRenderers.map((render, i) => <td key={i} className="px-3 py-3">{render(record)}</td>)}
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    {modeType !== 'categories' && (
                      <button onClick={() => openEdit(record)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><Edit3 className="h-4 w-4" /></button>
                    )}
                    {'isActive' in record && (
                      <button onClick={() => toggleStatus(record)} className="px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">{record.isActive ? 'Disable' : 'Enable'}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function PaginationControls() {
    if (!pagination || pagination.totalPages <= 1) return null;
    return (
      <div className="px-3 py-3 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border text-xs disabled:opacity-50">Previous</button>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= (pagination.totalPages || 1)} className="px-3 py-1 rounded border text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    );
  }
}

// === FORM HELPERS ===
function FormFields({ mode, form, setForm, categories, locations }: { mode: string; form: Record<string, any>; setForm: (v: Record<string, any>) => void; categories: any[]; locations: any[] }) {
  const update = (key: string, value: any) => setForm({ ...form, [key]: value });

  if (mode === 'items') {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name"><input className="input-field" value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></Field>
        <Field label="SKU"><input className="input-field uppercase" value={form.sku ?? ''} onChange={e => update('sku', e.target.value.toUpperCase())} /></Field>
        <Field label="Base unit"><select className="input-field" value={form.baseUnit ?? 'PIECE'} onChange={e => update('baseUnit', e.target.value)}>{units.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
        <Field label="Category"><select className="input-field" value={form.categoryId ?? ''} onChange={e => update('categoryId', e.target.value)}><option value="">None</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Reorder level"><input className="input-field" type="number" min="0" value={form.reorderLevel ?? '0'} onChange={e => update('reorderLevel', e.target.value)} /></Field>
        <Field label="Target stock"><input className="input-field" type="number" min="0" value={form.targetStockLevel ?? ''} onChange={e => update('targetStockLevel', e.target.value)} /></Field>
      </div>
    );
  }

  if (mode === 'locations') {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name"><input className="input-field" value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></Field>
        <Field label="Code"><input className="input-field uppercase" value={form.code ?? ''} onChange={e => update('code', e.target.value.toUpperCase())} /></Field>
        <Field label="Type"><input className="input-field" value={form.locationType ?? ''} onChange={e => update('locationType', e.target.value)} /></Field>
      </div>
    );
  }

  if (mode === 'suppliers') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input className="input-field" value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></Field>
        <Field label="Supplier code"><input className="input-field uppercase" value={form.supplierCode ?? ''} onChange={e => update('supplierCode', e.target.value.toUpperCase())} /></Field>
        <Field label="Phone"><input className="input-field" value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} /></Field>
        <Field label="Email"><input className="input-field" type="email" value={form.email ?? ''} onChange={e => update('email', e.target.value)} /></Field>
      </div>
    );
  }

  // Categories
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name"><input className="input-field" value={form.name ?? ''} onChange={e => update('name', e.target.value)} /></Field>
      <Field label="Display order"><input className="input-field" type="number" value={form.displayOrder ?? '0'} onChange={e => update('displayOrder', e.target.value)} /></Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5"><span className="block text-xs font-medium text-[var(--color-text-primary)]">{label}</span>{children}</label>;
}

function titleFor(mode: string) {
  return mode === 'items' ? 'Item' : mode === 'categories' ? 'Category' : mode === 'locations' ? 'Location' : mode === 'suppliers' ? 'Supplier' : mode === 'receipts' ? 'Receipt' : mode === 'adjustments' ? 'Adjustment' : 'Movement';
}

function headersFor(mode: string) {
  if (mode === 'categories') return ['Name', 'Items', 'Display Order', 'Status'];
  if (mode === 'locations') return ['Code', 'Name', 'Type', 'Default', 'Status'];
  if (mode === 'suppliers') return ['Code', 'Name', 'Phone', 'Email', 'Status'];
  return [];
}

function cellsFor(mode: string): ((r: any) => ReactNode)[] {
  if (mode === 'categories') return [
    (r: any) => <span className="font-medium">{r.name}</span>,
    (r: any) => <span className="text-xs">{r._count?.inventoryItems ?? 0}</span>,
    (r: any) => <span className="text-xs">{r.displayOrder ?? 0}</span>,
    (r: any) => <Badge variant={r.isActive !== false ? 'success' : 'error'} className="text-[10px]">{r.isActive !== false ? 'Active' : 'Inactive'}</Badge>,
  ];
  if (mode === 'locations') return [
    (r: any) => <span className="font-mono text-xs font-medium">{r.code}</span>,
    (r: any) => <span>{r.name}</span>,
    (r: any) => <span className="text-xs">{r.locationType ?? 'STORE'}</span>,
    (r: any) => r.isDefault ? <Badge variant="info" className="text-[10px]">Default</Badge> : <span className="text-xs text-[var(--color-text-muted)]">-</span>,
    (r: any) => <Badge variant={r.isActive ? 'success' : 'error'} className="text-[10px]">{r.isActive ? 'Active' : 'Inactive'}</Badge>,
  ];
  if (mode === 'suppliers') return [
    (r: any) => <span className="font-mono text-xs font-medium">{r.supplierCode}</span>,
    (r: any) => <span className="font-medium">{r.name}</span>,
    (r: any) => <span className="text-xs">{r.phone ?? '-'}</span>,
    (r: any) => <span className="text-xs">{r.email ?? '-'}</span>,
    (r: any) => <Badge variant={r.isActive ? 'success' : 'error'} className="text-[10px]">{r.isActive ? 'Active' : 'Inactive'}</Badge>,
  ];
  return [];
}

function defaultForm(mode: string): Record<string, any> {
  if (mode === 'items') return { name: '', sku: '', baseUnit: 'PIECE', categoryId: '', reorderLevel: 0, targetStockLevel: '', trackExpiry: false };
  if (mode === 'locations') return { name: '', code: '', locationType: 'STORE', isDefault: false };
  if (mode === 'suppliers') return { name: '', supplierCode: '', phone: '', email: '', isActive: true };
  return { name: '', displayOrder: 0 };
}

function formFromRecord(mode: string, record: any): Record<string, any> {
  if (mode === 'items') return { name: record.name, sku: record.sku, baseUnit: record.baseUnit, categoryId: record.category?.id ?? '', reorderLevel: record.reorderLevel ?? 0, targetStockLevel: record.targetStockLevel ?? '', trackExpiry: !!record.trackExpiry };
  if (mode === 'locations') return { name: record.name, code: record.code, locationType: record.locationType ?? 'STORE', isDefault: !!record.isDefault };
  if (mode === 'suppliers') return { name: record.name, supplierCode: record.supplierCode, phone: record.phone ?? '', email: record.email ?? '', isActive: record.isActive !== false };
  return { name: record.name, displayOrder: record.displayOrder ?? 0 };
}

function payloadFor(mode: string, form: Record<string, any>): Record<string, any> {
  if (mode === 'items') return { ...form, categoryId: form.categoryId || undefined, reorderLevel: Number(form.reorderLevel ?? 0), targetStockLevel: form.targetStockLevel ? Number(form.targetStockLevel) : undefined };
  return form;
}

function endpointFor(mode: string) {
  if (mode === 'items') return '/inventory/items';
  if (mode === 'categories') return '/inventory/categories';
  if (mode === 'locations') return '/inventory/locations';
  if (mode === 'suppliers') return '/suppliers';
  return '/inventory/items';
}
