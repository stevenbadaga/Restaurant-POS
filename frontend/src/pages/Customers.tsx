import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Plus, RefreshCw, X, Search, Phone, Mail,
  CalendarDays, Award, FileText, AlertCircle, CheckCircle2,
  Edit3, UserCheck, UserX, MessageSquare, Clock,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface Customer {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  totalOrders: number;
  totalSpent: string;
  lastVisitAt: string | null;
  createdAt: string;
  dietaryPreferences?: string | null;
  allergyNotes?: string | null;
  generalNotes?: string | null;
  preferredDiningArea?: { id: string; name: string } | null;
  loyaltyAccount?: {
    points: number;
    lifetimePoints: number;
    tier: string;
  } | null;
}

interface CustomerNote {
  id: string;
  note: string;
  noteType: string;
  isImportant: boolean;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string } | null;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
}

interface CustomerReservation {
  id: string;
  reservationDate: string;
  startAt: string;
  partySize: number;
  status: string;
}

interface CustomerForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dietaryPreferences: string;
  allergyNotes: string;
  generalNotes: string;
}

const blankCustomer: CustomerForm = {
  firstName: '', lastName: '', phone: '', email: '',
  dietaryPreferences: '', allergyNotes: '', generalNotes: '',
};

// ==========================================
// COMPONENT
// ==========================================

export default function Customers() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const canEdit = userRoles.some((r) => ['ADMIN', 'MANAGER'].includes(r));

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(blankCustomer);

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [customerReservations, setCustomerReservations] = useState<CustomerReservation[]>([]);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [customerLoyalty, setCustomerLoyalty] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const limit = 25;

  useEffect(() => { void loadCustomers(); }, [page, statusFilter]);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load customers'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(blankCustomer);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      dietaryPreferences: customer.dietaryPreferences ?? '',
      allergyNotes: customer.allergyNotes ?? '',
      generalNotes: customer.generalNotes ?? '',
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const submitCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) { setError('Permission denied.'); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, any> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        dietaryPreferences: form.dietaryPreferences.trim() || undefined,
        allergyNotes: form.allergyNotes.trim() || undefined,
        generalNotes: form.generalNotes.trim() || undefined,
      };
      if (!payload.firstName) throw new Error('First name is required.');

      if (editingCustomer) {
        const res = await api.patch(`/customers/${editingCustomer.id}`, payload);
        setCustomers((prev) => prev.map((c) => c.id === editingCustomer.id ? { ...c, ...res.data.data } : c));
        setSuccess('Customer updated.');
      } else {
        const res = await api.post('/customers', payload);
        setCustomers((prev) => [res.data.data, ...prev]);
        setSuccess('Customer created.');
      }
      setShowForm(false);
      setEditingCustomer(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save customer'));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (customer: Customer, status: string) => {
    if (!canEdit) return;
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/customers/${customer.id}/status`, { status });
      setCustomers((prev) => prev.map((c) => c.id === customer.id ? { ...c, status: status as Customer['status'] } : c));
      if (selectedCustomer?.id === customer.id) setSelectedCustomer({ ...selectedCustomer, status: status as Customer['status'] });
      setSuccess(`Customer ${status.toLowerCase()}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update status'));
    }
  };

  const viewDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetail(true);
    setError(null);
    try {
      const [ordersRes, reservationsRes, notesRes, loyaltyRes] = await Promise.all([
        api.get(`/customers/${customer.id}/orders?limit=5`).catch(() => ({ data: { data: [] } })),
        api.get(`/customers/${customer.id}/reservations?limit=5`).catch(() => ({ data: { data: [] } })),
        api.get(`/customers/${customer.id}/notes`).catch(() => ({ data: { data: [] } })),
        api.get(`/customers/${customer.id}/loyalty`).catch(() => ({ data: { data: null } })),
      ]);
      setCustomerOrders(ordersRes.data.data ?? []);
      setCustomerReservations(reservationsRes.data.data ?? []);
      setCustomerNotes(notesRes.data.data ?? []);
      setCustomerLoyalty(loyaltyRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load customer details'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const addNote = async () => {
    if (!selectedCustomer || !canEdit) return;
    const text = prompt('Enter note:');
    if (!text) return;
    try {
      await api.post(`/customers/${selectedCustomer.id}/notes`, { note: text });
      const notesRes = await api.get(`/customers/${selectedCustomer.id}/notes`);
      setCustomerNotes(notesRes.data.data ?? []);
      setSuccess('Note added.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add note'));
    }
  };

  const handleSearch = () => { setPage(1); };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Customers"
        description="Manage customer profiles, preferences, and visit history"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadCustomers} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            {canEdit && (
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add Customer</Button>
            )}
          </div>
        }
      />

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {/* Form Modal */}
      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={submitCustomer} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {editingCustomer ? 'Edit customer' : 'Add customer'}
                </h2>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="First name *"><input className="input-field" value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></Field>
                <Field label="Last name"><input className="input-field" value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                <Field label="Phone"><input className="input-field" type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Email"><input className="input-field" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Dietary preferences">
                  <input className="input-field" value={form.dietaryPreferences}
                    onChange={(e) => setForm({ ...form, dietaryPreferences: e.target.value })} />
                </Field>
                <Field label="Allergy notes">
                  <input className="input-field" value={form.allergyNotes}
                    onChange={(e) => setForm({ ...form, allergyNotes: e.target.value })} />
                </Field>
              </div>
              <Field label="General notes">
                <textarea className="input-field min-h-[60px]" value={form.generalNotes}
                  onChange={(e) => setForm({ ...form, generalNotes: e.target.value })} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" isLoading={saving}>{editingCustomer ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer List */}
        <div className={cn(selectedCustomer ? 'lg:col-span-2' : 'lg:col-span-3')}>
          {/* Search & Filter */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, phone, or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
            </div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm">
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
            <Button variant="secondary" onClick={handleSearch} leftIcon={<Search className="h-4 w-4" />}>Search</Button>
          </div>

          {loading ? <Loading message="Loading customers..." /> : customers.length === 0 ? (
            <Card><CardContent>
              <EmptyState icon={<Users className="h-12 w-12" />} title="No customers found"
                description={search ? 'Try a different search.' : 'Add your first customer to get started.'}
                action={canEdit && !search ? <Button onClick={openCreate}>Add Customer</Button> : undefined} />
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Orders</th>
                          <th className="px-4 py-3">Spent</th>
                          <th className="px-4 py-3">Last Visit</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {customers.map((c) => (
                          <tr key={c.id} className={cn(
                            'hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer',
                            selectedCustomer?.id === c.id && 'bg-[var(--color-accent)]/5'
                          )} onClick={() => viewDetail(c)}>
                            <td className="px-4 py-3">
                              <span className="font-medium text-[var(--color-text-primary)]">
                                {c.firstName} {c.lastName}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                {c.phone && <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
                                  <Phone className="h-3 w-3" />{c.phone}</p>}
                                {c.email && <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 truncate max-w-[180px]">
                                  <Mail className="h-3 w-3" />{c.email}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.totalOrders}</td>
                            <td className="px-4 py-3 text-[var(--color-text-secondary)]">{Number(c.totalSpent).toLocaleString()} RWF</td>
                            <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                              {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                c.status === 'ACTIVE' && 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
                                c.status === 'INACTIVE' && 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400',
                                c.status === 'BLOCKED' && 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
                              )}>{c.status}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
                  <span>{total} customers total</span>
                  <div className="flex gap-1">
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                      className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-bg-secondary)]">Prev</button>
                    <span className="px-3 py-1">{page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                      className="px-3 py-1 rounded border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-bg-secondary)]">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Customer Detail */}
        {selectedCustomer && (
          <div className="space-y-4">
            <Card>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Customer since {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)}
                    className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  {selectedCustomer.phone && <p className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Phone className="h-3.5 w-3.5" />{selectedCustomer.phone}</p>}
                  {selectedCustomer.email && <p className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Mail className="h-3.5 w-3.5" />{selectedCustomer.email}</p>}
                </div>

                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    {selectedCustomer.status !== 'ACTIVE' && (
                      <button onClick={() => changeStatus(selectedCustomer, 'ACTIVE')}
                        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300">
                        <UserCheck className="h-3 w-3 inline mr-1" />Activate
                      </button>
                    )}
                    {selectedCustomer.status === 'ACTIVE' && (
                      <>
                        <button onClick={() => changeStatus(selectedCustomer, 'INACTIVE')}
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900/30 dark:text-gray-300">
                          <UserX className="h-3 w-3 inline mr-1" />Deactivate
                        </button>
                        <button onClick={() => changeStatus(selectedCustomer, 'BLOCKED')}
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
                          <AlertCircle className="h-3 w-3 inline mr-1" />Block
                        </button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Loyalty */}
            {customerLoyalty && (
              <Card>
                <CardContent>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-amber-500" />Loyalty
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">{customerLoyalty.points ?? 0}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Points</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">{customerLoyalty.lifetimePoints ?? 0}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Lifetime</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[var(--color-text-primary)] capitalize">{customerLoyalty.tier ?? '—'}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Tier</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />Notes ({customerNotes.length})
                  </h4>
                  {canEdit && (
                    <button onClick={addNote} className="text-xs text-[var(--color-accent)] hover:underline">+ Add</button>
                  )}
                </div>
                {loadingDetail ? (
                  <Loading message="Loading notes..." />
                ) : customerNotes.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] italic">No notes</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customerNotes.map((note) => (
                      <div key={note.id} className="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-sm">
                        <div className="flex items-start gap-2">
                          <span className={cn(
                            'text-[10px] px-1 py-0.5 rounded shrink-0 mt-0.5',
                            note.noteType === 'WARNING' && 'bg-red-100 text-red-700',
                            note.noteType === 'DIETARY' && 'bg-green-100 text-green-700',
                            note.noteType === 'ALLERGY' && 'bg-amber-100 text-amber-700',
                            !['WARNING', 'DIETARY', 'ALLERGY'].includes(note.noteType) && 'bg-blue-100 text-blue-700',
                          )}>{note.noteType}</span>
                          <p className="text-xs flex-1">{note.note}</p>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                          {new Date(note.createdAt).toLocaleDateString()}
                          {note.createdBy && ` by ${note.createdBy.firstName}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardContent>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />Recent Orders
                </h4>
                {loadingDetail ? <Loading message="..." /> : customerOrders.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] italic">No orders</p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between text-xs py-1">
                        <span className="font-medium">{o.orderNumber}</span>
                        <span>{Number(o.totalAmount).toLocaleString()} RWF</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Reservations */}
            <Card>
              <CardContent>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4" />Reservations
                </h4>
                {loadingDetail ? <Loading message="..." /> : customerReservations.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] italic">No reservations</p>
                ) : (
                  <div className="space-y-2">
                    {customerReservations.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs py-1">
                        <span>{new Date(r.startAt).toLocaleDateString()} · {r.partySize} guests</span>
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-[10px]',
                          r.status === 'CONFIRMED' && 'bg-green-100 text-green-700',
                          r.status === 'PENDING' && 'bg-amber-100 text-amber-700',
                          r.status === 'COMPLETED' && 'bg-blue-100 text-blue-700',
                          r.status === 'CANCELLED' && 'bg-red-100 text-red-700',
                        )}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      {children}
    </label>
  );
}

function Message({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const styles = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${styles}`}>
      {tone === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {children}
    </div>
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
