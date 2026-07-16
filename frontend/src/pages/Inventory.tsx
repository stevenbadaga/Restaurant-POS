import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Boxes, Edit3, PackagePlus, Plus, RefreshCw, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import api from '@/services/api';

type Mode = 'items' | 'categories' | 'locations' | 'suppliers';

interface InventoryCategory { id: string; name: string; isActive?: boolean }
interface StockLocation { id: string; name: string; code: string; isDefault: boolean; isActive: boolean }
interface Supplier { id: string; name: string; supplierCode: string; phone?: string; isActive: boolean }
interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  reorderLevel: string | number;
  isActive: boolean;
  category?: InventoryCategory | null;
}

const units = ['PIECE', 'PORTION', 'BOTTLE', 'CAN', 'PACK', 'BOX', 'GRAM', 'KILOGRAM', 'MILLILITRE', 'LITRE', 'OTHER'];

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useMemo<Mode>(() => {
    if (location.pathname.includes('/categories')) return 'categories';
    if (location.pathname.includes('/locations')) return 'locations';
    if (location.pathname.includes('/suppliers')) return 'suppliers';
    return 'items';
  }, [location.pathname]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => { void loadData(); }, [mode]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryRes, locationRes, supplierRes, itemRes] = await Promise.all([
        api.get('/inventory/categories'),
        api.get('/inventory/locations'),
        api.get('/suppliers?pageSize=100'),
        api.get('/inventory/items?pageSize=100'),
      ]);
      setCategories(categoryRes.data.data ?? []);
      setLocations(locationRes.data.data ?? []);
      setSuppliers(supplierRes.data.suppliers ?? []);
      setItems(itemRes.data.items ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load inventory'));
    } finally {
      setLoading(false);
    }
  };

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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await saveRecord(mode, form, editing?.id);
      applySaved(mode, response.data.data, Boolean(editing));
      setSuccess(`${titleFor(mode)} ${editing ? 'updated' : 'created'}.`);
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(getErrorMessage(err, `Could not save ${titleFor(mode).toLowerCase()}`));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (record: any) => {
    setError(null);
    setSuccess(null);
    try {
      const endpoint = endpointFor(mode);
      const key = mode === 'items' ? 'isActive' : 'isActive';
      await api.patch(`${endpoint}/${record.id}/status`, { [key]: !record.isActive });
      await loadData();
      setSuccess(`${titleFor(mode)} status updated.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update status'));
    }
  };

  const records = mode === 'items' ? items : mode === 'categories' ? categories : mode === 'locations' ? locations : suppliers;

  const applySaved = (savedMode: Mode, record: any, isEdit: boolean) => {
    const apply = <T extends { id: string }>(current: T[]) => isEdit
      ? current.map((item) => item.id === record.id ? record : item)
      : [...current, record];

    if (savedMode === 'items') setItems((current) => apply(current));
    if (savedMode === 'categories') setCategories((current) => apply(current));
    if (savedMode === 'locations') setLocations((current) => apply(current));
    if (savedMode === 'suppliers') setSuppliers((current) => apply(current));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Inventory"
        description="Manage stock items, categories, locations, and suppliers"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadData} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add {titleFor(mode)}</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['items', 'categories', 'locations', 'suppliers'] as Mode[]).map((tab) => (
          <button
            key={tab}
            onClick={() => navigate(tab === 'items' ? '/inventory/items' : `/inventory/${tab}`)}
            className={mode === tab
              ? 'rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white'
              : 'rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
            }
          >
            {titleFor(tab)}s
          </button>
        ))}
      </div>

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editing ? 'Edit' : 'Add'} {titleFor(mode)}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Changes are saved through the authenticated backend API.</p>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FormFields mode={mode} form={form} setForm={setForm} categories={categories} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" isLoading={saving}>Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {loading ? <Loading message="Loading inventory..." /> : records.length === 0 ? (
            <EmptyState icon={<Boxes className="h-12 w-12" />} title={`No ${titleFor(mode).toLowerCase()}s`} description={`Add ${titleFor(mode).toLowerCase()}s to start managing inventory.`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                    {headersFor(mode).map((header) => <th key={header} className="px-3 py-3">{header}</th>)}
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {records.map((record: any) => (
                    <tr key={record.id} className="hover:bg-[var(--color-bg-secondary)]">
                      {cellsFor(mode, record).map((cell, index) => <td key={index} className="px-3 py-3">{cell}</td>)}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(record)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {'isActive' in record && (
                            <button onClick={() => toggleStatus(record)} className="rounded-lg px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                              {record.isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </div>
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
}

function FormFields({ mode, form, setForm, categories }: { mode: Mode; form: Record<string, string | boolean>; setForm: (value: Record<string, string | boolean>) => void; categories: InventoryCategory[] }) {
  if (mode === 'items') {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name"><input className="input-field" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="SKU"><input className="input-field uppercase" value={String(form.sku ?? '')} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} /></Field>
        <Field label="Base unit"><select className="input-field" value={String(form.baseUnit ?? 'PIECE')} onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></Field>
        <Field label="Category"><select className="input-field" value={String(form.categoryId ?? '')} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">None</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field label="Reorder level"><input className="input-field" type="number" min="0" value={String(form.reorderLevel ?? '0')} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
        <Field label="Target stock"><input className="input-field" type="number" min="0" value={String(form.targetStockLevel ?? '')} onChange={(e) => setForm({ ...form, targetStockLevel: e.target.value })} /></Field>
      </div>
    );
  }

  if (mode === 'locations') {
    return <div className="grid gap-4 md:grid-cols-3"><Field label="Name"><input className="input-field" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Code"><input className="input-field uppercase" value={String(form.code ?? '')} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field><Field label="Type"><input className="input-field" value={String(form.locationType ?? '')} onChange={(e) => setForm({ ...form, locationType: e.target.value })} /></Field></div>;
  }

  if (mode === 'suppliers') {
    return <div className="grid gap-4 md:grid-cols-3"><Field label="Name"><input className="input-field" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Supplier code"><input className="input-field uppercase" value={String(form.supplierCode ?? '')} onChange={(e) => setForm({ ...form, supplierCode: e.target.value.toUpperCase() })} /></Field><Field label="Phone"><input className="input-field" value={String(form.phone ?? '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Email"><input className="input-field" type="email" value={String(form.email ?? '')} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field></div>;
  }

  return <div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input className="input-field" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Display order"><input className="input-field" type="number" value={String(form.displayOrder ?? '0')} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /></Field></div>;
}

function defaultForm(mode: Mode): Record<string, string | boolean> {
  if (mode === 'items') return { name: '', sku: '', baseUnit: 'PIECE', categoryId: '', reorderLevel: '0', targetStockLevel: '', trackExpiry: false };
  if (mode === 'locations') return { name: '', code: '', locationType: 'STORE', isDefault: false };
  if (mode === 'suppliers') return { name: '', supplierCode: '', phone: '', email: '', isActive: true };
  return { name: '', displayOrder: '0' };
}

function formFromRecord(mode: Mode, record: any): Record<string, string | boolean> {
  if (mode === 'items') return { name: record.name, sku: record.sku, baseUnit: record.baseUnit, categoryId: record.category?.id ?? '', reorderLevel: String(record.reorderLevel ?? 0), targetStockLevel: String(record.targetStockLevel ?? ''), trackExpiry: Boolean(record.trackExpiry) };
  if (mode === 'locations') return { name: record.name, code: record.code, locationType: record.locationType ?? '', isDefault: Boolean(record.isDefault) };
  if (mode === 'suppliers') return { name: record.name, supplierCode: record.supplierCode, phone: record.phone ?? '', email: record.email ?? '', isActive: Boolean(record.isActive) };
  return { name: record.name, displayOrder: String(record.displayOrder ?? 0) };
}

async function saveRecord(mode: Mode, form: Record<string, string | boolean>, id?: string) {
  const endpoint = endpointFor(mode);
  const payload = payloadFor(mode, form);
  return id ? api.patch(`${endpoint}/${id}`, payload) : api.post(endpoint, payload);
}

function payloadFor(mode: Mode, form: Record<string, string | boolean>) {
  if (mode === 'items') return { ...form, categoryId: form.categoryId || undefined, reorderLevel: Number(form.reorderLevel ?? 0), targetStockLevel: form.targetStockLevel ? Number(form.targetStockLevel) : undefined };
  if (mode === 'categories') return { ...form, displayOrder: Number(form.displayOrder ?? 0) };
  return form;
}

function endpointFor(mode: Mode) {
  if (mode === 'items') return '/inventory/items';
  if (mode === 'categories') return '/inventory/categories';
  if (mode === 'locations') return '/inventory/locations';
  return '/suppliers';
}

function titleFor(mode: Mode) {
  return mode === 'items' ? 'Item' : mode === 'categories' ? 'Category' : mode === 'locations' ? 'Location' : 'Supplier';
}

function headersFor(mode: Mode) {
  if (mode === 'items') return ['SKU', 'Name', 'Category', 'Unit', 'Reorder', 'Status'];
  if (mode === 'locations') return ['Code', 'Name', 'Type', 'Default', 'Status'];
  if (mode === 'suppliers') return ['Code', 'Name', 'Phone', 'Status'];
  return ['Name', 'Status'];
}

function cellsFor(mode: Mode, record: any): ReactNode[] {
  if (mode === 'items') return [record.sku, record.name, record.category?.name ?? 'Unassigned', record.baseUnit, String(record.reorderLevel ?? 0), record.isActive ? 'Active' : 'Inactive'];
  if (mode === 'locations') return [record.code, record.name, record.locationType ?? 'STORE', record.isDefault ? 'Default' : '-', record.isActive ? 'Active' : 'Inactive'];
  if (mode === 'suppliers') return [record.supplierCode, record.name, record.phone ?? '-', record.isActive ? 'Active' : 'Inactive'];
  return [record.name, record.isActive ? 'Active' : 'Inactive'];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>{children}</label>;
}

function Message({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const styles = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
