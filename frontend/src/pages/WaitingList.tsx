import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, CheckCircle2, Clock, Plus, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import { PageHeader, Card, CardContent, CardHeader, Button, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { connectSocket } from '@/services/socket';
import api from '@/services/api';
import {
  cancelWaitingListEntry,
  createWaitingListEntry,
  getWaitingList,
  notifyWaitingListEntry,
  seatWaitingListEntry,
  updateWaitingListEntry,
  type WaitingListEntry,
} from '@/services/waiting-list';

interface DiningArea { id: string; name: string }
interface TableOption { id: string; name: string; code: string; capacity: number; status: string; diningArea?: { name: string } | null }

const emptyForm = {
  customerName: '',
  phone: '',
  partySize: '2',
  estimatedWaitMinutes: '20',
  priority: '0',
  preferredDiningAreaId: '',
  notes: '',
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function WaitingList() {
  const { user, restaurant } = useAuth();
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WaitingListEntry | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [seatTarget, setSeatTarget] = useState<WaitingListEntry | null>(null);
  const [selectedTableId, setSelectedTableId] = useState('');

  const activeEntries = useMemo(() => entries.filter((entry) => ['WAITING', 'NOTIFIED'].includes(entry.status)), [entries]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (search) params.search = search;
      const [waitingRes, areaRes, tableRes] = await Promise.all([
        getWaitingList(params),
        api.get('/dining-areas?isActive=true'),
        api.get('/tables?limit=100&isActive=true'),
      ]);
      setEntries(waitingRes.entries ?? []);
      setWaitingCount(waitingRes.waitingCount ?? 0);
      setAreas(areaRes.data.data ?? []);
      setTables(tableRes.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load waiting list'));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = connectSocket(restaurant?.id || '', user?.id);
    const refresh = () => void loadData();
    socket.on('waiting-list:created', refresh);
    socket.on('waiting-list:updated', refresh);
    socket.on('waiting-list:notified', refresh);
    socket.on('waiting-list:seated', refresh);
    return () => {
      socket.off('waiting-list:created', refresh);
      socket.off('waiting-list:updated', refresh);
      socket.off('waiting-list:notified', refresh);
      socket.off('waiting-list:seated', refresh);
    };
  }, [loadData, restaurant?.id, user?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (entry: WaitingListEntry) => {
    setEditing(entry);
    setForm({
      customerName: entry.customerName,
      phone: entry.phone || '',
      partySize: String(entry.partySize),
      estimatedWaitMinutes: String(entry.estimatedWaitMinutes ?? 20),
      priority: String(entry.priority ?? 0),
      preferredDiningAreaId: entry.preferredDiningAreaId || '',
      notes: entry.notes || '',
    });
    setShowForm(true);
  };

  const saveEntry = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        customerName: form.customerName.trim(),
        phone: form.phone.trim() || undefined,
        partySize: Number(form.partySize),
        estimatedWaitMinutes: Number(form.estimatedWaitMinutes),
        priority: Number(form.priority),
        preferredDiningAreaId: form.preferredDiningAreaId || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) await updateWaitingListEntry(editing.id, payload);
      else await createWaitingListEntry(payload);
      setSuccess(editing ? 'Guest updated.' : 'Guest added to waiting list.');
      setShowForm(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save waiting-list entry'));
    } finally {
      setSaving(false);
    }
  };

  const notifyEntry = async (entry: WaitingListEntry) => {
    try {
      await notifyWaitingListEntry(entry.id);
      setSuccess(`${entry.customerName} marked as notified.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not notify guest'));
    }
  };

  const cancelEntry = async (entry: WaitingListEntry) => {
    try {
      await cancelWaitingListEntry(entry.id);
      setSuccess(`${entry.customerName} cancelled.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not cancel entry'));
    }
  };

  const seatEntry = async () => {
    if (!seatTarget || !selectedTableId) return;
    setSaving(true);
    try {
      await seatWaitingListEntry(seatTarget.id, {
        tableId: selectedTableId,
        createOrder: true,
        guestCount: seatTarget.partySize,
      });
      setSuccess(`${seatTarget.customerName} seated.`);
      setSeatTarget(null);
      setSelectedTableId('');
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not seat guest'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading waiting list..." />;
  if (error && entries.length === 0) return <ErrorState title="Waiting List Error" message={error} action={<Button onClick={loadData}>Retry</Button>} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Waiting List"
        description={`${waitingCount} guest${waitingCount === 1 ? '' : 's'} currently waiting`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadData} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add Guest</Button>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active" value={activeEntries.length} icon={<Users className="h-5 w-5" />} />
        <SummaryCard label="Notified" value={entries.filter((entry) => entry.status === 'NOTIFIED').length} icon={<Bell className="h-5 w-5" />} />
        <SummaryCard label="High Priority" value={entries.filter((entry) => (entry.priority ?? 0) >= 3 && ['WAITING', 'NOTIFIED'].includes(entry.status)).length} icon={<Clock className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
              <input className="input-field pl-9" placeholder="Search guest or queue number" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select className="input-field md:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Active</option>
              <option value="WAITING">Waiting</option>
              <option value="NOTIFIED">Notified</option>
              <option value="SEATED">Seated</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="LEFT">Left</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">{editing ? 'Edit Guest' : 'Add Guest'}</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Guest name"><input className="input-field" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Field>
              <Field label="Contact"><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Party size"><input className="input-field" type="number" min="1" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} /></Field>
              <Field label="Estimated wait"><input className="input-field" type="number" min="1" value={form.estimatedWaitMinutes} onChange={(e) => setForm({ ...form, estimatedWaitMinutes: e.target.value })} /></Field>
              <Field label="Priority">
                <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="0">Normal</option>
                  <option value="1">Low</option>
                  <option value="3">High</option>
                  <option value="5">Urgent</option>
                </select>
              </Field>
              <Field label="Preferred area">
                <select className="input-field" value={form.preferredDiningAreaId} onChange={(e) => setForm({ ...form, preferredDiningAreaId: e.target.value })}>
                  <option value="">Any area</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Notes"><textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={saveEntry} isLoading={saving} disabled={!form.customerName || !form.partySize}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={<Users className="h-12 w-12" />} title="No waiting guests" description="Add a guest when tables are full." action={<Button onClick={openCreate}>Add Guest</Button>} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Party</th>
                    <th className="px-4 py-3">Wait</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-4 py-3">
                        <button className="text-left font-medium text-[var(--color-text-primary)]" onClick={() => openEdit(entry)}>{entry.queueNumber} · {entry.customerName}</button>
                        <div className="text-xs text-[var(--color-text-muted)]">{entry.phone || 'No contact'} · {entry.diningArea?.name || 'Any area'}</div>
                      </td>
                      <td className="px-4 py-3">{entry.partySize}</td>
                      <td className="px-4 py-3">
                        <div>{entry.estimatedWaitMinutes ?? 0} min estimate</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{entry.waitingDurationMinutes ?? 0} min elapsed</div>
                      </td>
                      <td className="px-4 py-3"><Badge variant={entry.priority >= 3 ? 'warning' : 'neutral'}>{priorityLabel(entry.priority)}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(entry.status)}>{entry.status}</Badge></td>
                      <td className="max-w-xs px-4 py-3 text-[var(--color-text-muted)]">{entry.notes || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {entry.status === 'WAITING' && <IconButton title="Notify" onClick={() => notifyEntry(entry)} icon={<Bell className="h-4 w-4" />} />}
                          {['WAITING', 'NOTIFIED'].includes(entry.status) && <IconButton title="Assign table and seat" onClick={() => { setSeatTarget(entry); setSelectedTableId(''); }} icon={<CheckCircle2 className="h-4 w-4" />} />}
                          {['WAITING', 'NOTIFIED'].includes(entry.status) && <IconButton title="Cancel" onClick={() => cancelEntry(entry)} icon={<XCircle className="h-4 w-4" />} />}
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

      {seatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-[var(--color-bg-primary)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Assign Table</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{seatTarget.customerName}, party of {seatTarget.partySize}</p>
            <select className="input-field mt-4" value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}>
              <option value="">Choose table</option>
              {tables.filter((table) => table.status !== 'OUT_OF_SERVICE' && table.capacity >= seatTarget.partySize).map((table) => (
                <option key={table.id} value={table.id}>{table.name} ({table.code}) · {table.capacity} seats · {table.status}</option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSeatTarget(null)}>Cancel</Button>
              <Button onClick={seatEntry} isLoading={saving} disabled={!selectedTableId}>Seat Guest</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-[var(--color-accent)]/10 p-2 text-[var(--color-accent)]">{icon}</div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-[var(--color-text-primary)]">{label}<div className="mt-1">{children}</div></label>;
}

function IconButton({ title, icon, onClick }: { title: string; icon: ReactNode; onClick: () => void }) {
  return <button title={title} onClick={onClick} className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]">{icon}</button>;
}

function priorityLabel(priority = 0) {
  if (priority >= 5) return 'Urgent';
  if (priority >= 3) return 'High';
  if (priority >= 1) return 'Low';
  return 'Normal';
}

function statusVariant(status: string) {
  if (status === 'SEATED') return 'success';
  if (status === 'NOTIFIED') return 'warning';
  if (status === 'CANCELLED' || status === 'LEFT') return 'error';
  return 'neutral';
}
