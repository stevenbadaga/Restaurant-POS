import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Edit3, Plus, RefreshCw, X } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import api from '@/services/api';

interface MenuCategory { id: string; name: string }
interface KitchenStation { id: string; name: string }
interface MenuItem {
  id: string;
  name: string;
  code: string;
  itemType: 'FOOD' | 'DRINK' | 'DESSERT' | 'OTHER';
  price: string | number;
  isAvailable: boolean;
  isActive: boolean;
  category?: MenuCategory | null;
  kitchenStation?: KitchenStation | null;
}

type MenuItemType = MenuItem['itemType'];

interface MenuForm {
  name: string;
  code: string;
  itemType: MenuItemType;
  price: string;
  categoryId: string;
  kitchenStationId: string;
  preparationTimeMinutes: string;
  requiresPreparation: boolean;
  trackInventory: boolean;
}

const blankItem: MenuForm = {
  name: '',
  code: '',
  itemType: 'FOOD' as const,
  price: '0',
  categoryId: '',
  kitchenStationId: '',
  preparationTimeMinutes: '0',
  requiresPreparation: true,
  trackInventory: false,
};

export default function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(blankItem);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { void loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemRes, categoryRes, stationRes] = await Promise.all([
        api.get('/menu/items'),
        api.get('/menu/categories?isActive=true'),
        api.get('/menu/kitchen-stations?isActive=true'),
      ]);
      setItems(itemRes.data.data ?? []);
      setCategories(categoryRes.data.data ?? []);
      setStations(stationRes.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load menu'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...blankItem,
      code: `MI-${String(items.length + 1).padStart(3, '0')}`,
      categoryId: categories[0]?.id ?? '',
      kitchenStationId: stations[0]?.id ?? '',
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code,
      itemType: item.itemType,
      price: String(item.price),
      categoryId: item.category?.id ?? '',
      kitchenStationId: item.kitchenStation?.id ?? '',
      preparationTimeMinutes: '0',
      requiresPreparation: item.itemType !== 'DRINK',
      trackInventory: false,
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const submitItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        itemType: form.itemType,
        price: Number(form.price),
        categoryId: form.categoryId || null,
        kitchenStationId: form.kitchenStationId || null,
        preparationTimeMinutes: Number(form.preparationTimeMinutes || 0),
        requiresPreparation: form.requiresPreparation,
        trackInventory: form.trackInventory,
      };
      if (!payload.name || !payload.code || Number.isNaN(payload.price)) {
        throw new Error('Enter a name, code, and valid price.');
      }
      const response = editing
        ? await api.patch(`/menu/items/${editing.id}`, payload)
        : await api.post('/menu/items', payload);
      setItems((current) => editing
        ? current.map((item) => item.id === editing.id ? response.data.data : item)
        : [...current, response.data.data]);
      setSuccess(`${payload.name} ${editing ? 'updated' : 'created'}.`);
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save menu item'));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const response = await api.patch(`/menu/items/${item.id}/status`, { isAvailable: !item.isAvailable });
      setItems((current) => current.map((row) => row.id === item.id ? response.data.data : row));
      setSuccess(`${item.name} availability updated.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update item'));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Menu"
        description="Manage menu categories, stations, pricing, and availability"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadData} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add Item</Button>
          </div>
        }
      />

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={submitItem} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editing ? 'Edit menu item' : 'Add menu item'}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Items created here are available to orders and public menu rules.</p>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Name"><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Code"><input className="input-field uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                <Field label="Price"><input className="input-field" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
                <Field label="Type">
                  <select className="input-field" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value as typeof form.itemType })}>
                    <option value="FOOD">Food</option>
                    <option value="DRINK">Drink</option>
                    <option value="DESSERT">Dessert</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Category">
                  <select className="input-field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">None</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </Field>
                <Field label="Kitchen station">
                  <select className="input-field" value={form.kitchenStationId} onChange={(e) => setForm({ ...form, kitchenStationId: e.target.value })}>
                    <option value="">None</option>
                    {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" isLoading={saving}>{editing ? 'Update Item' : 'Save Item'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {loading ? <Loading message="Loading menu..." /> : items.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-12 w-12" />} title="Menu is empty" description="Add menu items, categorize them, and set pricing for your restaurant." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Station</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Availability</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-3 py-3 font-medium">{item.code}</td>
                      <td className="px-3 py-3">{item.name}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.category?.name ?? 'Unassigned'}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)]">{item.kitchenStation?.name ?? 'None'}</td>
                      <td className="px-3 py-3">{item.itemType}</td>
                      <td className="px-3 py-3">{Number(item.price).toLocaleString()} RWF</td>
                      <td className="px-3 py-3">
                        <button onClick={() => toggleAvailability(item)} className={item.isAvailable ? badgeGreen : badgeRed}>
                          {item.isAvailable ? 'Available' : 'Unavailable'}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                            <Edit3 className="h-4 w-4" />
                          </button>
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

const badgeGreen = 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300';
const badgeRed = 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300';

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
