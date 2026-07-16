import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Edit3, Grid3x3, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import api from '@/services/api';

interface DiningArea {
  id: string;
  name: string;
}

interface RestaurantTable {
  id: string;
  name: string;
  code: string;
  capacity: number;
  shape: 'SQUARE' | 'RECTANGLE' | 'ROUND' | 'OVAL';
  status: string;
  isActive: boolean;
  diningArea?: DiningArea | null;
}

interface TableForm {
  name: string;
  code: string;
  capacity: string;
  diningAreaId: string;
  shape: 'SQUARE' | 'RECTANGLE' | 'ROUND' | 'OVAL';
  notes: string;
}

const initialForm: TableForm = {
  name: '',
  code: '',
  capacity: '4',
  diningAreaId: '',
  shape: 'SQUARE',
  notes: '',
};

export default function Tables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<TableForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nextCode = useMemo(() => {
    const nextNumber = tables.length + 1;
    return `T${String(nextNumber).padStart(2, '0')}`;
  }, [tables.length]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tableResult, areaResult] = await Promise.all([
        api.get('/tables?limit=100'),
        api.get('/dining-areas?isActive=true'),
      ]);
      setTables(tableResult.data.data ?? []);
      setAreas(areaResult.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load tables'));
    } finally {
      setLoading(false);
    }
  };

  const openForm = () => {
    setEditingTable(null);
    setForm({ ...initialForm, code: nextCode, diningAreaId: areas[0]?.id ?? '' });
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const openEditForm = (table: RestaurantTable) => {
    setEditingTable(table);
    setForm({
      name: table.name,
      code: table.code,
      capacity: String(table.capacity),
      diningAreaId: table.diningArea?.id ?? '',
      shape: table.shape,
      notes: '',
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const submitTable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        capacity: Number(form.capacity),
        diningAreaId: form.diningAreaId || null,
        shape: form.shape,
        notes: form.notes.trim(),
      };

      if (!payload.name || !payload.code || !payload.capacity || payload.capacity < 1) {
        throw new Error('Enter a name, code, and valid capacity.');
      }

      const result = editingTable
        ? await api.patch(`/tables/${editingTable.id}`, payload)
        : await api.post('/tables', payload);
      setTables((current) => editingTable
        ? current.map((table) => table.id === editingTable.id ? result.data.data : table)
        : [...current, result.data.data]);
      setSuccess(`Table ${payload.code} ${editingTable ? 'updated' : 'added'}.`);
      setShowForm(false);
      setEditingTable(null);
      setForm(initialForm);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add table'));
    } finally {
      setSaving(false);
    }
  };

  const changeActiveStatus = async (table: RestaurantTable) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await api.patch(`/tables/${table.id}/status`, { isActive: !table.isActive });
      setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...result.data.data } : item));
      setSuccess(`Table ${table.code} ${table.isActive ? 'deactivated' : 'activated'}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update table status'));
    }
  };

  const changeAvailability = async (table: RestaurantTable, status: string) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await api.patch(`/tables/${table.id}/availability`, { status });
      setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...result.data.data } : item));
      setSuccess(`Table ${table.code} marked ${status}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update availability'));
    }
  };

  const deleteTable = async (table: RestaurantTable) => {
    if (!window.confirm(`Delete ${table.code} - ${table.name}? Tables with history cannot be deleted.`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/tables/${table.id}`);
      setTables((current) => current.filter((item) => item.id !== table.id));
      setSuccess(`Table ${table.code} deleted.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete table'));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tables"
        description="Manage restaurant tables and seating"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadData}>
              Refresh
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openForm}>
              Add Table
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
          {success}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={submitTable} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {editingTable ? 'Edit table' : 'Add table'}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {editingTable ? 'Update table details and seating.' : 'Create a table for dine-in ordering.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingTable(null); }}
                  className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Table name">
                  <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Table 7" />
                </Field>
                <Field label="Code">
                  <input className="input-field uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="T07" />
                </Field>
                <Field label="Capacity">
                  <input className="input-field" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </Field>
                <Field label="Dining area">
                  <select className="input-field" value={form.diningAreaId} onChange={(e) => setForm({ ...form, diningAreaId: e.target.value })}>
                    <option value="">No area</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Shape">
                  <select className="input-field" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value as TableForm['shape'] })}>
                    <option value="SQUARE">Square</option>
                    <option value="RECTANGLE">Rectangle</option>
                    <option value="ROUND">Round</option>
                    <option value="OVAL">Oval</option>
                  </select>
                </Field>
                <Field label="Notes">
                  <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
                </Field>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingTable(null); }}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving}>
                  {editingTable ? 'Update Table' : 'Save Table'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <Loading message="Loading tables..." />
          ) : tables.length === 0 ? (
            <EmptyState
              icon={<Grid3x3 className="h-12 w-12" />}
              title="No tables configured"
              description="Add tables to start managing your restaurant floor plan and seating arrangements."
              action={<Button variant="secondary" onClick={openForm}>Configure Tables</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                    <th className="px-3 py-3 font-semibold">Code</th>
                    <th className="px-3 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Area</th>
                    <th className="px-3 py-3 font-semibold">Capacity</th>
                    <th className="px-3 py-3 font-semibold">Shape</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Active</th>
                    <th className="px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {tables.map((table) => (
                    <tr key={table.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-3 py-3 font-medium text-[var(--color-text-primary)]">{table.code}</td>
                      <td className="px-3 py-3 text-[var(--color-text-primary)]">{table.name}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)]">{table.diningArea?.name ?? 'Unassigned'}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)]">{table.capacity}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)] capitalize">{table.shape.toLowerCase()}</td>
                      <td className="px-3 py-3">
                        <select
                          value={table.status}
                          onChange={(event) => changeAvailability(table, event.target.value)}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                        >
                          <option value="AVAILABLE">Available</option>
                          <option value="RESERVED">Reserved</option>
                          <option value="CLEANING">Cleaning</option>
                          <option value="OUT_OF_SERVICE">Out of service</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <span className={table.isActive
                          ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300'
                          : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }>
                          {table.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(table)}
                            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                            title="Edit table"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => changeActiveStatus(table)}
                            className="rounded-lg px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                          >
                            {table.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTable(table)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete table"
                          >
                            <Trash2 className="h-4 w-4" />
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      {children}
    </label>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
