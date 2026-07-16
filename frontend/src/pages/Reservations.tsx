import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';import { CalendarDays, Plus, RefreshCw, X,
  AlertCircle, CheckCircle2, LogIn,
  Phone, Mail, Users, Ban, ChevronLeft, ChevronRight,
  List, Calendar, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface DiningArea { id: string; name: string; }
interface RestaurantTable { id: string; name: string; code: string; capacity: number; diningAreaId?: string; }

interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  reservationDate: string;
  startAt: string;
  expectedEndAt?: string | null;
  partySize: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  specialRequests?: string | null;
  dietaryNotes?: string | null;
  occasion?: string | null;
  internalNotes?: string | null;
  reservationSource: string;
  diningArea?: DiningArea | null;
  table?: RestaurantTable | null;
  createdAt: string;
  customer?: { id: string; firstName: string; lastName?: string | null; phone?: string | null } | null;
}

interface ReservationForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string;
  reservationDate: string;
  startAt: string;
  partySize: string;
  diningAreaId: string;
  tableId: string;
  specialRequests: string;
  dietaryNotes: string;
  occasion: string;
  internalNotes: string;
  reservationSource: string;
}

interface CalendarReservation {
  id: string;
  customerName: string;
  partySize: number;
  status: string;
  startAt: string;
  expectedEndAt?: string | null;
  table?: { id: string; name: string; code: string } | null;
  diningArea?: { name: string } | null;
}

const blankReservation: ReservationForm = {
  customerName: '', customerPhone: '', customerEmail: '', customerId: '',
  reservationDate: new Date().toISOString().split('T')[0],
  startAt: '19:00', partySize: '2',
  diningAreaId: '', tableId: '',
  specialRequests: '', dietaryNotes: '', occasion: '',
  internalNotes: '', reservationSource: 'PHONE',
};

const STATUS_ACTIONS: Record<string, { label: string; nextStatus: string; icon: ReactNode; color: string }[]> = {
  PENDING: [
    { label: 'Confirm', nextStatus: 'CONFIRMED', icon: <CheckCircle2 className="h-3 w-3" />, color: 'green' },
    { label: 'Cancel', nextStatus: 'CANCELLED', icon: <X className="h-3 w-3" />, color: 'red' },
  ],
  CONFIRMED: [
    { label: 'Check In', nextStatus: 'CHECKED_IN', icon: <LogIn className="h-3 w-3" />, color: 'blue' },
    { label: 'No Show', nextStatus: 'NO_SHOW', icon: <Ban className="h-3 w-3" />, color: 'red' },
    { label: 'Cancel', nextStatus: 'CANCELLED', icon: <X className="h-3 w-3" />, color: 'red' },
  ],
  CHECKED_IN: [
    { label: 'Complete', nextStatus: 'COMPLETED', icon: <CheckCircle2 className="h-3 w-3" />, color: 'green' },
    { label: 'No Show', nextStatus: 'NO_SHOW', icon: <Ban className="h-3 w-3" />, color: 'red' },
  ],
  SEATED: [
    { label: 'Complete', nextStatus: 'COMPLETED', icon: <CheckCircle2 className="h-3 w-3" />, color: 'green' },
  ],
};

const CALENDAR_STATUS_BG: Record<string, string> = {
  PENDING: 'bg-amber-200 border-amber-400 text-amber-900 dark:bg-amber-800/40 dark:border-amber-600 dark:text-amber-200',
  CONFIRMED: 'bg-blue-200 border-blue-400 text-blue-900 dark:bg-blue-800/40 dark:border-blue-600 dark:text-blue-200',
  CHECKED_IN: 'bg-indigo-200 border-indigo-400 text-indigo-900 dark:bg-indigo-800/40 dark:border-indigo-600 dark:text-indigo-200',
  SEATED: 'bg-green-200 border-green-400 text-green-900 dark:bg-green-800/40 dark:border-green-600 dark:text-green-200',
  COMPLETED: 'bg-gray-200 border-gray-300 text-gray-600 dark:bg-gray-800/30 dark:border-gray-600 dark:text-gray-400',
  CANCELLED: 'bg-red-200 border-red-400 text-red-900 dark:bg-red-800/40 dark:border-red-600 dark:text-red-200',
  NO_SHOW: 'bg-purple-200 border-purple-400 text-purple-900 dark:bg-purple-800/40 dark:border-purple-600 dark:text-purple-200',
};

// ==========================================
// COMPONENT
// ==========================================

export default function Reservations() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const canEdit = userRoles.some((r) => ['ADMIN', 'MANAGER'].includes(r));

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // List filters
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarReservations, setCalendarReservations] = useState<CalendarReservation[]>([]);
  const [calendarTables, setCalendarTables] = useState<RestaurantTable[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<CalendarReservation | null>(null);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [calendarAreaFilter, setCalendarAreaFilter] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [form, setForm] = useState<ReservationForm>(blankReservation);
  const [customers, setCustomers] = useState<any[]>([]);

  const limit = 25;

  // ==========================================
  // DATA LOADING
  // ==========================================

  useEffect(() => {
    if (viewMode === 'list') void loadReservations();
    else void loadCalendar();
  }, [viewMode, date, statusFilter, page, calendarDate, calendarAreaFilter]);

  const loadReservations = async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = { date, page: String(page), limit: String(limit) };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/reservations', { params });
      setReservations(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) { setError(getErrorMessage(err, 'Could not load reservations')); }
    finally { setLoading(false); }
  };

  const loadCalendar = async () => {
    setLoading(true); setError(null);
    try {
      const [calRes, tableRes, areaRes] = await Promise.all([
        api.get(`/reservations/calendar?date=${calendarDate}`),
        api.get('/tables?limit=100'),
        api.get('/dining-areas?isActive=true'),
      ]);
      setCalendarReservations(calRes.data.data ?? []);
      setAreas(areaRes.data.data ?? []);
      setCalendarTables((tableRes.data.data ?? []).filter((t: any) => t.isActive));
    } catch (err) { setError(getErrorMessage(err, 'Could not load calendar')); }
    finally { setLoading(false); }
  };

  const loadReferenceData = async () => {
    try {
      const [areaRes, tableRes, customerRes] = await Promise.all([
        api.get('/dining-areas?isActive=true'),
        api.get('/tables?limit=100&isActive=true'),
        api.get('/customers?limit=200'),
      ]);
      setAreas(areaRes.data.data ?? []);
      setCalendarTables(tableRes.data.data ?? []);
      setCustomers(customerRes.data.data ?? []);
    } catch { /* non-critical */ }
  };

  // ==========================================
  // CRUD
  // ==========================================

  const openCreate = async (prefillTime?: string) => {
    setEditingReservation(null);
    setForm({
      ...blankReservation,
      reservationDate: viewMode === 'calendar' ? calendarDate : date,
      startAt: prefillTime || blankReservation.startAt,
    });
    setShowForm(true); setError(null); setSuccess(null);
    await loadReferenceData();
  };

  const openEdit = async (reservation: Reservation) => {
    setEditingReservation(reservation);
    setForm({
      customerName: reservation.customerName, customerPhone: reservation.customerPhone ?? '',
      customerEmail: reservation.customerEmail ?? '', customerId: reservation.customerId ?? '',
      reservationDate: reservation.reservationDate?.split('T')[0] || date,
      startAt: reservation.startAt?.includes('T') ? reservation.startAt.split('T')[1]?.slice(0, 5) : reservation.startAt || '19:00',
      partySize: String(reservation.partySize), diningAreaId: reservation.diningArea?.id ?? '',
      tableId: reservation.table?.id ?? '', specialRequests: reservation.specialRequests ?? '',
      dietaryNotes: reservation.dietaryNotes ?? '', occasion: reservation.occasion ?? '',
      internalNotes: reservation.internalNotes ?? '', reservationSource: reservation.reservationSource || 'PHONE',
    });
    setShowForm(true); setError(null); setSuccess(null);
    await loadReferenceData();
  };

  const submitReservation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) { setError('Permission denied.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload: Record<string, any> = {
        customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim() || undefined,
        customerEmail: form.customerEmail.trim() || undefined, customerId: form.customerId || undefined,
        reservationSource: form.reservationSource, reservationDate: form.reservationDate,
        startAt: `${form.reservationDate}T${form.startAt}`, partySize: Number(form.partySize),
        diningAreaId: form.diningAreaId || undefined, tableId: form.tableId || undefined,
        specialRequests: form.specialRequests.trim() || undefined, dietaryNotes: form.dietaryNotes.trim() || undefined,
        occasion: form.occasion.trim() || undefined, internalNotes: form.internalNotes.trim() || undefined,
      };
      if (!payload.customerName || !payload.partySize) throw new Error('Name and party size required.');
      if (editingReservation) {
        const res = await api.patch(`/reservations/${editingReservation.id}`, payload);
        setReservations((prev) => prev.map((r) => r.id === editingReservation.id ? { ...r, ...res.data.data } : r));
        setSuccess('Reservation updated.');
      } else {
        const res = await api.post('/reservations', payload);
        setReservations((prev) => [res.data.data, ...prev]);
        setCalendarReservations((prev) => [{ ...res.data.data }, ...prev]);
        setSuccess('Reservation created.');
      }
      setShowForm(false); setEditingReservation(null);
    } catch (err) { setError(getErrorMessage(err, 'Could not save reservation')); }
    finally { setSaving(false); }
  };

  const performAction = async (reservation: Reservation | CalendarReservation, action: string) => {
    if (!canEdit) { setError('Permission denied.'); return; }
    setError(null); setSuccess(null);
    if (action === 'CANCELLED') {
      const reason = prompt('Reason for cancellation:'); if (!reason) return;
      try {
        const res = await api.post(`/reservations/${reservation.id}/cancel`, { reason });
        updateInList(res.data.data); setSuccess('Reservation cancelled.');
      } catch (err) { setError(getErrorMessage(err, 'Could not cancel')); }
      return;
    }
    try {
      let res;
      switch (action) {
        case 'CONFIRMED': res = await api.post(`/reservations/${reservation.id}/confirm`); break;
        case 'CHECKED_IN': res = await api.post(`/reservations/${reservation.id}/check-in`); break;
        case 'COMPLETED': res = await api.post(`/reservations/${reservation.id}/complete`); break;
        case 'NO_SHOW': res = await api.post(`/reservations/${reservation.id}/no-show`); break;
        default: return;
      }
      updateInList(res.data.data);
      setSuccess(`Reservation ${action.replace(/_/g, ' ').toLowerCase()}.`);
    } catch (err) { setError(getErrorMessage(err, `Could not perform ${action}`)); }
  };

  const updateInList = (updated: Reservation) => {
    setReservations((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
    setCalendarReservations((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
    setSelectedReservation((prev) => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  };

  const totalPages = Math.ceil(total / limit);

  // ==========================================
  // CALENDAR COMPUTED
  // ==========================================

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 10; h <= 22; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const calendarAreaTables = useMemo(() => {
    if (!calendarAreaFilter) return calendarTables;
    return calendarTables.filter((t) => t.diningAreaId === calendarAreaFilter);
  }, [calendarTables, calendarAreaFilter]);

  const reservationsByTable: Record<string, CalendarReservation[]> = useMemo(() => {
    const map: Record<string, CalendarReservation[]> = {};
    calendarReservations
      .filter((r) => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(r.status))
      .forEach((r) => {
        const tableId = r.table?.id || '__unassigned__';
        if (!map[tableId]) map[tableId] = [];
        map[tableId].push(r);
      });
    return map;
  }, [calendarReservations]);

  const getReservationStyle = (res: CalendarReservation): React.CSSProperties => {
    const startStr = res.startAt?.includes('T') ? res.startAt : `${calendarDate}T${res.startAt}`;
    const start = new Date(startStr);
    const endStr = res.expectedEndAt?.includes('T') ? res.expectedEndAt : `${calendarDate}T${res.expectedEndAt || res.startAt}`;
    const end = new Date(endStr);
    // Default duration 90 min if no end time or end is before start
    const duration = (end > start) ? (end.getTime() - start.getTime()) / (60 * 1000) : 90;

    const dayStart = new Date(`${calendarDate}T10:00`);
    const totalMinutes = 12 * 60; // 10:00 to 22:00 = 720 min
    const minutesFromStart = (start.getTime() - dayStart.getTime()) / (60 * 1000);

    const top = Math.max(0, (minutesFromStart / totalMinutes) * 100);
    const height = Math.max(2, (duration / totalMinutes) * 100);

    return {
      top: `${top}%`,
      height: `${Math.min(height, 100 - top)}%`,
    };
  };

  const calendarNavDate = (direction: -1 | 1) => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() + direction);
    setCalendarDate(d.toISOString().split('T')[0]);
    setSelectedReservation(null);
  };

  // ==========================================
  // RENDER
  // ==========================================

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700', CONFIRMED: 'bg-blue-100 text-blue-700',
    CHECKED_IN: 'bg-indigo-100 text-indigo-700', SEATED: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-gray-100 text-gray-600', CANCELLED: 'bg-red-100 text-red-700',
    NO_SHOW: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reservations"
        description="Manage table reservations, check-ins, and guest seating"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--color-bg-secondary)] rounded-lg p-0.5 border border-[var(--color-border)] mr-2">
              <button onClick={() => setViewMode('list')}
                className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', viewMode === 'list' ? 'bg-[var(--color-card-bg)] shadow-sm' : 'text-[var(--color-text-muted)]')}>
                <List className="h-3.5 w-3.5 inline mr-1" />List
              </button>
              <button onClick={() => setViewMode('calendar')}
                className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', viewMode === 'calendar' ? 'bg-[var(--color-card-bg)] shadow-sm' : 'text-[var(--color-text-muted)]')}>
                <Calendar className="h-3.5 w-3.5 inline mr-1" />Calendar
              </button>
            </div>
            <Button variant="secondary" onClick={viewMode === 'list' ? loadReservations : loadCalendar} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            {canEdit && <Button onClick={() => openCreate()} leftIcon={<Plus className="h-4 w-4" />}>New Reservation</Button>}
          </div>
        }
      />

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {/* Form Modal */}
      {showForm && renderForm()}

      {viewMode === 'calendar' ? renderCalendar() : renderListView()}
    </div>
  );

  // ==========================================
  // FORM
  // ==========================================

  function renderForm() {
    return (
      <Card>
        <CardContent>
          <form onSubmit={submitReservation} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editingReservation ? 'Edit reservation' : 'New reservation'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Customer name *">
                <input className="input-field" value={form.customerName} list="customer-suggestions" onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
                <datalist id="customer-suggestions">{customers.map((c) => (<option key={c.id} value={c.firstName + (c.lastName ? ` ${c.lastName}` : '')} />))}</datalist>
              </Field>
              <Field label="Phone"><input className="input-field" type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></Field>
              <Field label="Email"><input className="input-field" type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></Field>
              <Field label="Source">
                <select className="input-field" value={form.reservationSource} onChange={(e) => setForm({ ...form, reservationSource: e.target.value })}>
                  <option value="PHONE">Phone</option><option value="WALK_IN">Walk-in</option>
                  <option value="IN_PERSON">In Person</option><option value="STAFF_ENTRY">Staff Entry</option>
                  <option value="WEBSITE">Website</option><option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Date *"><input className="input-field" type="date" value={form.reservationDate} onChange={(e) => setForm({ ...form, reservationDate: e.target.value })} required /></Field>
              <Field label="Time *"><input className="input-field" type="time" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required /></Field>
              <Field label="Party size *"><input className="input-field" type="number" min="1" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} required /></Field>
              <Field label="Occasion">
                <select className="input-field" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })}>
                  <option value="">None</option><option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option><option value="business">Business</option>
                  <option value="date">Date</option><option value="other">Other</option>
                </select>
              </Field>
              <Field label="Dining area">
                <select className="input-field" value={form.diningAreaId} onChange={(e) => setForm({ ...form, diningAreaId: e.target.value })}>
                  <option value="">Any area</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Specific table">
                <select className="input-field" value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })}>
                  <option value="">Auto-assign</option>
                  {calendarTables.filter((t) => !form.diningAreaId || t.diningAreaId === form.diningAreaId).map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code}) - Cap. {t.capacity}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Special requests"><textarea className="input-field min-h-[60px]" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} /></Field>
              <Field label="Dietary notes"><textarea className="input-field min-h-[60px]" value={form.dietaryNotes} onChange={(e) => setForm({ ...form, dietaryNotes: e.target.value })} /></Field>
            </div>
            <Field label="Internal notes"><textarea className="input-field min-h-[60px]" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" isLoading={saving}>{editingReservation ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // ==========================================
  // LIST VIEW
  // ==========================================

  function renderListView() {
    return (
      <>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
                  statusFilter === s ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                )}>{s || 'All'}</button>
            ))}
          </div>
        </div>

        {loading ? <Loading message="Loading reservations..." /> : reservations.length === 0 ? (
          <Card><CardContent>
            <EmptyState icon={<CalendarDays className="h-12 w-12" />} title="No reservations"
              description={statusFilter ? 'No reservations match the selected status.' : 'No reservations for this date.'}
              action={canEdit ? <Button onClick={() => openCreate()}>New Reservation</Button> : undefined} />
          </CardContent></Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                        <th className="px-4 py-3">Time</th><th className="px-4 py-3">Guest</th>
                        <th className="px-4 py-3">Party</th><th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Area / Table</th><th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Source</th><th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {reservations.map((r) => (
                        <tr key={r.id} className="hover:bg-[var(--color-bg-secondary)] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-medium">
                            {r.startAt?.includes('T') ? new Date(r.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.startAt}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--color-text-primary)]">{r.customerName}</div>
                            {r.occasion && <p className="text-[10px] text-[var(--color-text-muted)] capitalize">{r.occasion}</p>}
                          </td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1"><Users className="h-3 w-3 text-[var(--color-text-muted)]" /><span>{r.partySize}</span></div></td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                            {r.customerPhone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customerPhone}</p>}
                            {r.customerEmail && <p className="flex items-center gap-1 truncate max-w-[150px]"><Mail className="h-3 w-3" />{r.customerEmail}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                            {r.diningArea?.name && <p>{r.diningArea.name}</p>}
                            {r.table?.name && <p className="text-[var(--color-text-muted)]">{r.table.name}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColors[r.status] || '')}>{r.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{r.reservationSource?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {canEdit && (
                                <button onClick={() => openEdit(r)} className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Edit">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                  </svg>
                                </button>
                              )}
                              {(STATUS_ACTIONS[r.status] || []).map((action) => (
                                <button key={action.nextStatus} onClick={() => performAction(r, action.nextStatus)}
                                  className={cn('p-1.5 rounded text-xs', action.color === 'green' && 'text-green-600 hover:bg-green-50',
                                    action.color === 'red' && 'text-red-500 hover:bg-red-50', action.color === 'blue' && 'text-blue-600 hover:bg-blue-50')}
                                  title={action.label}>{action.icon}</button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
                <span>{total} reservations</span>
                <div className="flex gap-1 items-center">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-bg-secondary)]"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="px-3">{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-bg-secondary)]"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  // ==========================================
  // CALENDAR VIEW
  // ==========================================

  function renderCalendar() {
    return (
      <>
        {/* Calendar Navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => calendarNavDate(-1)} className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
            <input type="date" value={calendarDate} onChange={(e) => { setCalendarDate(e.target.value); setSelectedReservation(null); }}
              className="px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm font-medium" />
          </div>
          <button onClick={() => calendarNavDate(1)} className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
            <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => { setCalendarDate(new Date().toISOString().split('T')[0]); setSelectedReservation(null); }}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">Today</button>

          {/* Area filter */}
          <select value={calendarAreaFilter} onChange={(e) => setCalendarAreaFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm ml-auto">
            <option value="">All areas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <span className="text-xs text-[var(--color-text-muted)]">
            {calendarReservations.filter((r) => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(r.status)).length} active
          </span>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300" /> Pending</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-300" /> Confirmed</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-300" /> Checked In</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-300" /> Seated</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-300" /> Cancelled</span>
        </div>

        {loading ? <Loading message="Loading calendar..." /> : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            {calendarAreaTables.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">No active tables for this dining area.</div>
            ) : (
              <div className="min-w-[800px] relative">
                {/* Header row - table names */}
                <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-card-bg)]">
                  <div className="w-16 shrink-0 p-2 text-[10px] font-medium text-[var(--color-text-muted)] uppercase text-center border-r border-[var(--color-border)]">Time</div>
                  {calendarAreaTables.map((t) => (
                    <div key={t.id} className="flex-1 min-w-[100px] p-2 text-center border-r border-[var(--color-border)] last:border-r-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Cap. {t.capacity}</p>
                    </div>
                  ))}
                </div>

                {/* Time rows */}
                <div className="relative" style={{ height: `${timeSlots.length * 32}px` }}>
                  {/* Time slot grid lines */}
                  {timeSlots.map((slot, idx) => (
                    <div key={slot}
                      className="absolute left-0 right-0 flex border-b border-[var(--color-border)]"
                      style={{ top: `${idx * 32}px`, height: '32px' }}>
                      <div className="w-16 shrink-0 p-1 text-[10px] text-[var(--color-text-muted)] text-right pr-2 border-r border-[var(--color-border)]">
                        {slot.endsWith(':00') ? slot : ''}
                      </div>
                      {calendarAreaTables.map((t) => (
                        <div key={t.id} className="flex-1 min-w-[100px] border-r border-[var(--color-border)] last:border-r-0 relative">
                          {/* Clickable slot for creating reservation */}
                          <button
                            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity z-10"
                            onClick={() => canEdit ? openCreate(slot) : undefined}
                            title={canEdit ? `Create reservation at ${slot}` : ''}
                          >
                            <div className="h-full flex items-center justify-center bg-[var(--color-accent)]/5 rounded">
                              <Plus className="h-3 w-3 text-[var(--color-accent)]" />
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Reservation blocks */}
                  {calendarAreaTables.map((table, tableIdx) => {
                    const tableReservations = reservationsByTable[table.id] || [];
                    return tableReservations.map((res) => {
                      const style = getReservationStyle(res);
                      return (
                        <div
                          key={res.id}
                          className={cn(
                            'absolute left-0 right-0 mx-0.5 rounded border px-1.5 py-0.5 cursor-pointer overflow-hidden transition-all hover:z-20 hover:shadow-md',
                            CALENDAR_STATUS_BG[res.status] || CALENDAR_STATUS_BG.PENDING,
                            selectedReservation?.id === res.id && 'ring-2 ring-[var(--color-accent)] z-20',
                          )}
                          style={{
                            ...style,
                            left: `calc(${(tableIdx / calendarAreaTables.length) * 100}% + 4px)`,
                            width: `calc(${100 / calendarAreaTables.length}% - 8px)`,
                          }}
                          onClick={() => setSelectedReservation(selectedReservation?.id === res.id ? null : res)}
                        >
                          <p className="text-[10px] font-semibold leading-tight truncate">
                            {new Date(res.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] leading-tight truncate">{res.customerName}</p>
                          <p className="text-[9px] leading-tight opacity-70">{res.partySize} guests</p>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected reservation details */}
        {selectedReservation && (
          <Card>
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn('w-3 h-3 rounded-full', selectedReservation.status === 'PENDING' ? 'bg-amber-400' :
                    selectedReservation.status === 'CONFIRMED' ? 'bg-blue-500' :
                    selectedReservation.status === 'CHECKED_IN' ? 'bg-indigo-500' :
                    selectedReservation.status === 'SEATED' ? 'bg-green-500' : 'bg-gray-400')} />
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">{selectedReservation.customerName}</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(selectedReservation.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {selectedReservation.expectedEndAt && ` — ${new Date(selectedReservation.expectedEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      {' · '}{selectedReservation.partySize} guests
                      {selectedReservation.table && ` · ${selectedReservation.table.name}`}
                    </p>
                    <span className={cn('inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium', statusColors[selectedReservation.status] || '')}>
                      {selectedReservation.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button onClick={() => openEdit(selectedReservation as any)} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">Edit</button>
                  )}
                  <button onClick={() => setSelectedReservation(null)} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">Close</button>
                </div>
              </div>
              {canEdit && (
                <div className="mt-3 flex gap-1.5">
                  {(STATUS_ACTIONS[selectedReservation.status] || []).map((action) => (
                    <button key={action.nextStatus} onClick={() => performAction(selectedReservation as any, action.nextStatus)}
                      className={cn('px-3 py-1.5 text-xs rounded-lg font-medium transition-colors', action.color === 'green' && 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300',
                        action.color === 'red' && 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300',
                        action.color === 'blue' && 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
                      )}>
                      {action.icon}{' '}{action.label}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </>
    );
  }
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (<label className="space-y-1.5"><span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>{children}</label>);
}

function Message({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const styles = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';
  return (<div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${styles}`}>
    {tone === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{children}</div>);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
