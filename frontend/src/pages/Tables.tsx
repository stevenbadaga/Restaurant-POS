import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Edit3, Grid3x3, Plus, RefreshCw, Trash2, X, Move, Users, Map, User } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface DiningArea {
  id: string;
  name: string;
}

interface WaiterBrief {
  id: string;
  firstName: string;
  lastName: string;
}

interface RestaurantTable {
  id: string;
  name: string;
  code: string;
  capacity: number;
  shape: 'SQUARE' | 'RECTANGLE' | 'ROUND' | 'OVAL';
  status: string;
  isActive: boolean;
  positionX?: number | null;
  positionY?: number | null;
  diningArea?: DiningArea | null;
  assignedWaiter?: WaiterBrief | null;
}

interface TableForm {
  name: string;
  code: string;
  capacity: string;
  diningAreaId: string;
  shape: 'SQUARE' | 'RECTANGLE' | 'ROUND' | 'OVAL';
  notes: string;
}

interface CalendarEvent {
  id: string;
  startAt: string;
  expectedEndAt?: string | null;
  customerName: string;
  partySize: number;
  status: string;
  tableId?: string;
}

const initialForm: TableForm = {
  name: '', code: '', capacity: '4', diningAreaId: '', shape: 'SQUARE', notes: '',
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'border-green-400 bg-green-50 dark:bg-green-950/20 dark:border-green-700',
  OCCUPIED: 'border-red-400 bg-red-50 dark:bg-red-950/20 dark:border-red-700',
  RESERVED: 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700',
  CLEANING: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700',
  OUT_OF_SERVICE: 'border-gray-300 bg-gray-100 dark:bg-gray-900/30 dark:border-gray-600',
};

const STATUS_DOTS: Record<string, string> = {
  AVAILABLE: 'bg-green-500',
  OCCUPIED: 'bg-red-500',
  RESERVED: 'bg-amber-500',
  CLEANING: 'bg-blue-500',
  OUT_OF_SERVICE: 'bg-gray-400',
};

// ==========================================
// COMPONENT
// ==========================================

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
  const [viewMode, setViewMode] = useState<'list' | 'floor'>('list');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [tableBookings, setTableBookings] = useState<CalendarEvent[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Waiter assignment state
  const [showWaiterDropdown, setShowWaiterDropdown] = useState(false);
  const [availableWaiters, setAvailableWaiters] = useState<Array<{
    id: string; firstName: string; lastName: string;
    employeeCode: string | null; activeOrderCount: number; isClockedIn: boolean;
  }>>([]);
  const [assigningTableWaiter, setAssigningTableWaiter] = useState(false);
  const waiterDropdownRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const floorRef = useRef<HTMLDivElement>(null);

  const nextCode = useMemo(() => {
    const nextNumber = tables.length + 1;
    return `T${String(nextNumber).padStart(2, '0')}`;
  }, [tables.length]);

  useEffect(() => { void loadData(); }, []);

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

  const loadTableBookings = async (tableId: string) => {
    setLoadingBookings(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/reservations/calendar?date=${today}`);
      const all = (res.data.data ?? []) as CalendarEvent[];
      setTableBookings(all.filter((r) => r.tableId === tableId && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(r.status)));
    } catch {
      setTableBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  const openForm = () => {
    setEditingTable(null);
    setForm({ ...initialForm, code: nextCode, diningAreaId: areas[0]?.id ?? '' });
    setError(null); setSuccess(null); setShowForm(true);
  };

  const openEditForm = (table: RestaurantTable) => {
    setEditingTable(table);
    setForm({
      name: table.name, code: table.code, capacity: String(table.capacity),
      diningAreaId: table.diningArea?.id ?? '', shape: table.shape, notes: '',
    });
    setError(null); setSuccess(null); setShowForm(true);
  };

  const submitTable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload = {
        name: form.name.trim(), code: form.code.trim().toUpperCase(),
        capacity: Number(form.capacity), diningAreaId: form.diningAreaId || null,
        shape: form.shape, notes: form.notes.trim(),
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
      setShowForm(false); setEditingTable(null); setForm(initialForm);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add table'));
    } finally { setSaving(false); }
  };

  const changeActiveStatus = async (table: RestaurantTable) => {
    setError(null); setSuccess(null);
    try {
      const result = await api.patch(`/tables/${table.id}/status`, { isActive: !table.isActive });
      setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...result.data.data } : item));
      setSuccess(`Table ${table.code} ${table.isActive ? 'deactivated' : 'activated'}.`);
    } catch (err) { setError(getErrorMessage(err, 'Could not update table status')); }
  };

  const changeAvailability = async (table: RestaurantTable, status: string) => {
    setError(null); setSuccess(null);
    try {
      const result = await api.patch(`/tables/${table.id}/availability`, { status });
      setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...result.data.data } : item));
      if (selectedTable?.id === table.id) setSelectedTable({ ...selectedTable, status: status as RestaurantTable['status'] });
      setSuccess(`Table ${table.code} marked ${status}.`);
    } catch (err) { setError(getErrorMessage(err, 'Could not update availability')); }
  };

  const deleteTable = async (table: RestaurantTable) => {
    if (!window.confirm(`Delete ${table.code} - ${table.name}? Tables with history cannot be deleted.`)) return;
    setError(null); setSuccess(null);
    try {
      await api.delete(`/tables/${table.id}`);
      setTables((current) => current.filter((item) => item.id !== table.id));
      setSuccess(`Table ${table.code} deleted.`);
    } catch (err) { setError(getErrorMessage(err, 'Could not delete table')); }
  };

  const savePosition = async (table: RestaurantTable, x: number, y: number) => {
    try {
      await api.patch(`/tables/${table.id}`, { positionX: Math.round(x), positionY: Math.round(y) });
    } catch { /* non-critical */ }
  };

  // Close waiter dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (waiterDropdownRef.current && !waiterDropdownRef.current.contains(e.target as Node)) {
        setShowWaiterDropdown(false);
      }
    };
    if (showWaiterDropdown) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showWaiterDropdown]);

  // ==========================================
  // WAITER ASSIGNMENT
  // ==========================================

  const loadAvailableWaiters = async () => {
    try {
      const res = await api.get('/tables/assignments/workload');
      setAvailableWaiters(res.data.data ?? []);
    } catch { /* silent */ }
  };

  const handleAssignTableWaiter = async (tableId: string, waiterId: string | null) => {
    setAssigningTableWaiter(true);
    try {
      const res = await api.patch(`/tables/${tableId}/assign-waiter`, { waiterId });
      // Update tables and selectedTable state
      const updatedTable = res.data.data;
      setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, assignedWaiter: updatedTable.assignedWaiter } : t));
      if (selectedTable?.id === tableId) {
        setSelectedTable((prev) => prev ? { ...prev, assignedWaiter: updatedTable.assignedWaiter } : null);
      }
      setShowWaiterDropdown(false);
      setSuccess(waiterId ? 'Waiter assigned to table' : 'Waiter unassigned from table');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not assign waiter'));
    } finally {
      setAssigningTableWaiter(false);
    }
  };

  // ==========================================
  // DRAG HANDLERS
  // ==========================================

  const handleMouseDown = (e: React.MouseEvent, table: RestaurantTable) => {
    if (table.positionX == null || table.positionY == null) return; // Only drag tables that have been positioned
    e.preventDefault();
    setDragging(table.id);
    setDragOffset({
      x: e.clientX - (table.positionX || 0),
      y: e.clientY - (table.positionY || 0),
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const floor = floorRef.current;
    if (!floor) return;
    const rect = floor.getBoundingClientRect();
    const x = Math.max(10, Math.min(e.clientX - dragOffset.x - rect.left, rect.width - 110));
    const y = Math.max(10, Math.min(e.clientY - dragOffset.y - rect.top, rect.height - 70));
    setTables((prev) => prev.map((t) => t.id === dragging ? { ...t, positionX: x, positionY: y } : t));
  };

  const handleMouseUp = () => {
    if (dragging) {
      const table = tables.find((t) => t.id === dragging);
      if (table && table.positionX !== undefined && table.positionY !== undefined) {
        savePosition(table, table.positionX!, table.positionY!);
      }
      setDragging(null);
    }
  };

  // ==========================================
  // FLOOR PLAN AUTO-LAYOUT
  // ==========================================

  const floorTables = useMemo(() => {
    const hasPosition = tables.filter((t) => t.positionX != null && t.positionY != null);
    const noPosition = tables.filter((t) => t.positionX == null || t.positionY == null);
    if (noPosition.length === 0) return tables;

    // Assign auto-layout positions for tables without them
    const cols = Math.ceil(Math.sqrt(noPosition.length + hasPosition.length)) || 3;
    const maxCol = Math.max(cols, 4);
    const startX = 20; const startY = 20;
    const gapX = 140; const gapY = 120;
    let idx = 0;
    noPosition.forEach((t) => {
      const col = idx % maxCol;
      const row = Math.floor(idx / maxCol);
      t.positionX = startX + col * gapX;
      t.positionY = startY + row * gapY;
      idx++;
    });
    return tables;
  }, [tables]);

  const filteredFloorTables = useMemo(() => {
    if (!selectedArea) return floorTables;
    return floorTables.filter((t) => t.diningArea?.id === selectedArea || (!t.diningArea && selectedArea === 'unassigned'));
  }, [floorTables, selectedArea]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tables"
        description={viewMode === 'list' ? 'Manage restaurant tables and seating' : 'Floor plan view'}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--color-bg-secondary)] rounded-lg p-0.5 border border-[var(--color-border)] mr-2">
              <button onClick={() => { setViewMode('list'); setSelectedTable(null); }}
                className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', viewMode === 'list' ? 'bg-[var(--color-card-bg)] shadow-sm' : 'text-[var(--color-text-muted)]')}>
                <Grid3x3 className="h-3.5 w-3.5 inline mr-1" />List
              </button>
              <button onClick={() => setViewMode('floor')}
                className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', viewMode === 'floor' ? 'bg-[var(--color-card-bg)] shadow-sm' : 'text-[var(--color-text-muted)]')}>
                <Map className="h-3.5 w-3.5 inline mr-1" />Floor Plan
              </button>
            </div>
            <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadData}>Refresh</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openForm}>Add Table</Button>
          </div>
        }
      />

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={submitTable} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editingTable ? 'Edit table' : 'Add table'}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">{editingTable ? 'Update table details.' : 'Create a table for dine-in ordering.'}</p>
                </div>
                <button type="button" onClick={() => { setShowForm(false); setEditingTable(null); }}
                  className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Table name"><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Table 7" /></Field>
                <Field label="Code"><input className="input-field uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="T07" /></Field>
                <Field label="Capacity"><input className="input-field" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
                <Field label="Dining area">
                  <select className="input-field" value={form.diningAreaId} onChange={(e) => setForm({ ...form, diningAreaId: e.target.value })}>
                    <option value="">No area</option>
                    {areas.map((area) => (<option key={area.id} value={area.id}>{area.name}</option>))}
                  </select>
                </Field>
                <Field label="Shape">
                  <select className="input-field" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value as TableForm['shape'] })}>
                    <option value="SQUARE">Square</option><option value="RECTANGLE">Rectangle</option>
                    <option value="ROUND">Round</option><option value="OVAL">Oval</option>
                  </select>
                </Field>
                <Field label="Notes"><input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingTable(null); }}>Cancel</Button>
                <Button type="submit" isLoading={saving}>{editingTable ? 'Update Table' : 'Save Table'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {viewMode === 'floor' ? renderFloorPlan() : renderListView()}
    </div>
  );

  // ==========================================
  // LIST VIEW
  // ==========================================

  function renderListView() {
    return (
      <Card>
        <CardContent>
          {loading ? (<Loading message="Loading tables..." />) : tables.length === 0 ? (
            <EmptyState icon={<Grid3x3 className="h-12 w-12" />} title="No tables configured"
              description="Add tables to start managing your restaurant floor plan."
              action={<Button variant="secondary" onClick={openForm}>Configure Tables</Button>} />
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
                        <select value={table.status} onChange={(event) => changeAvailability(table, event.target.value)}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs">
                          <option value="AVAILABLE">Available</option>
                          <option value="RESERVED">Reserved</option>
                          <option value="OCCUPIED">Occupied</option>
                          <option value="CLEANING">Cleaning</option>
                          <option value="OUT_OF_SERVICE">Out of service</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <span className={table.isActive
                          ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300'
                          : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }>{table.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEditForm(table)}
                            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Edit">
                            <Edit3 className="h-4 w-4" /></button>
                          <button onClick={() => changeActiveStatus(table)}
                            className="rounded-lg px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                            {table.isActive ? 'Disable' : 'Enable'}</button>
                          <button onClick={() => deleteTable(table)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">
                            <Trash2 className="h-4 w-4" /></button>
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
    );
  }

  // ==========================================
  // FLOOR PLAN VIEW
  // ==========================================

  function renderFloorPlan() {
    return (
      <div className="space-y-4">
        {/* Area Filter + Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={selectedArea} onChange={(e) => { setSelectedArea(e.target.value); setSelectedTable(null); }}
            className="px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm">
            <option value="">All areas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="unassigned">Unassigned</option>
          </select>
          <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Available</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Occupied</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Cleaning</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Out of service</span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)] ml-auto">{filteredFloorTables.length} tables shown</span>
        </div>

        {/* Floor Canvas */}
        <div
          ref={floorRef}
          className="relative w-full min-h-[500px] rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ backgroundImage: 'radial-gradient(circle, var(--color-border) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center"><Loading message="Loading floor plan..." /></div>
          ) : filteredFloorTables.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-[var(--color-text-muted)]">No tables to display</p>
            </div>
          ) : (
            filteredFloorTables.map((table) => (
              <div
                key={table.id}
                className={cn(
                  'absolute flex flex-col items-center justify-center cursor-pointer select-none',
                  'w-24 h-20 rounded-xl border-2 transition-shadow',
                  'hover:shadow-lg hover:z-10',
                  !table.isActive && 'opacity-50',
                  table.id === selectedTable?.id && 'ring-2 ring-[var(--color-accent)] z-10',
                  STATUS_COLORS[table.status] || STATUS_COLORS.AVAILABLE,
                  dragging === table.id && 'shadow-xl scale-105 z-20 opacity-80',
                )}
                style={{ left: table.positionX || 20, top: table.positionY || 20 }}
                onClick={() => {
                  setSelectedTable(table);
                  loadTableBookings(table.id);
                }}
              >
                {/* Drag handle */}
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-[var(--color-border)] shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-[var(--color-bg-secondary)]"
                  onMouseDown={(e) => handleMouseDown(e, table)}
                >
                  <Move className="h-3 w-3 text-[var(--color-text-muted)]" />
                </div>

                {/* Status dot */}
                <span className={cn('absolute top-1 left-1 w-2 h-2 rounded-full', STATUS_DOTS[table.status] || 'bg-gray-400')} />

                {/* Table info */}
                <span className="text-xs font-bold text-[var(--color-text-primary)]">{table.name}</span>
                <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                  <Users className="h-2.5 w-2.5" />
                  {table.capacity}
                  <span className="capitalize ml-1">{table.shape.toLowerCase().slice(0, 4)}</span>
                </div>
                {table.diningArea && (
                  <span className="text-[9px] text-[var(--color-text-muted)] truncate max-w-full px-1">{table.diningArea.name}</span>
                )}
              </div>
            ))
          )}

          {/* Dragging hint */}
          {!dragging && filteredFloorTables.length > 0 && (
            <div className="absolute bottom-3 left-3 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-card-bg)] px-2 py-1 rounded border border-[var(--color-border)]">
              Drag the ⋮ icon to reposition tables
            </div>
          )}
        </div>

        {/* Selected table details */}
        {selectedTable && (
          <Card>
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn('w-3 h-3 rounded-full', STATUS_DOTS[selectedTable.status] || 'bg-gray-400')} />
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">{selectedTable.name} ({selectedTable.code})</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {selectedTable.diningArea?.name || 'No area'} · Cap. {selectedTable.capacity} · {selectedTable.shape.toLowerCase()}
                      {!selectedTable.isActive && ' · Inactive'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <select value={selectedTable.status} onChange={(e) => changeAvailability(selectedTable, e.target.value)}
                    className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                    <option value="AVAILABLE">Available</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="CLEANING">Cleaning</option>
                    <option value="OUT_OF_SERVICE">Out of service</option>
                  </select>
                  <button onClick={() => openEditForm(selectedTable)}
                    className="px-3 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                    <Edit3 className="h-3 w-3 inline mr-1" />Edit
                  </button>
                </div>
              </div>

              {/* Assigned Waiter */}
              <div className="mt-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Waiter:</span>
                <div className="relative" ref={waiterDropdownRef}>
                  <button
                    onClick={() => {
                      loadAvailableWaiters();
                      setShowWaiterDropdown(!showWaiterDropdown);
                    }}
                    className="text-xs font-medium text-[var(--color-accent)] hover:underline underline-offset-2 decoration-dotted"
                  >
                    {selectedTable.assignedWaiter
                      ? `${selectedTable.assignedWaiter.firstName} ${selectedTable.assignedWaiter.lastName}`
                      : 'Unassigned'
                    }
                  </button>
                  {showWaiterDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl shadow-xl p-2 min-w-[220px]">
                      <p className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] px-2 py-1">Assign Waiter</p>
                      <button
                        onClick={() => handleAssignTableWaiter(selectedTable.id, null)}
                        disabled={assigningTableWaiter}
                        className={cn(
                          'w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors',
                          !selectedTable.assignedWaiter
                            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                            : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                        )}
                      >
                        <span>— Unassigned</span>
                      </button>
                      {availableWaiters.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)] px-2 py-2">No waiters available</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {availableWaiters.map((w) => (
                            <button
                              key={w.id}
                              onClick={() => handleAssignTableWaiter(selectedTable.id, w.id)}
                              disabled={assigningTableWaiter}
                              className={cn(
                                'w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between',
                                selectedTable.assignedWaiter?.id === w.id
                                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                  : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span>{w.firstName} {w.lastName}</span>
                                {w.isClockedIn && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Clocked in" />
                                )}
                              </div>
                              <span className="text-[10px] text-[var(--color-text-muted)]">{w.activeOrderCount} orders</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming bookings */}
              {loadingBookings ? (
                <p className="text-xs text-[var(--color-text-muted)] mt-3">Loading bookings...</p>
              ) : tableBookings.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Today's bookings:</p>
                  <div className="space-y-1">
                    {tableBookings.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-[var(--color-bg-secondary)]">
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          b.status === 'CONFIRMED' ? 'bg-blue-500' : b.status === 'CHECKED_IN' ? 'bg-indigo-500' : 'bg-amber-500'
                        )} />
                        <span className="font-medium">{new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{b.customerName} ({b.partySize})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)] mt-3 italic">No bookings today</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (<label className="space-y-2"><span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>{children}</label>);
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
