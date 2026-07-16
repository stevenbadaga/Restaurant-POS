import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, Clock, Plus, Eye,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Badge, Loading, EmptyState, ErrorState, Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkShifts, getShiftTemplates, createShiftTemplate, setTemplateStatus } from '@/services/shifts';
import { cn } from '@/lib/utils';

export default function Shifts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'shifts' | 'templates'>('shifts');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const roles = user?.roles || [];
  const isManager = roles.includes('ADMIN') || roles.includes('MANAGER');

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const result = await getWorkShifts(params);
      setShifts(result.shifts || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getShiftTemplates();
      setTemplates(result.data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'shifts') fetchShifts();
    else fetchTemplates();
  }, [tab, fetchShifts, fetchTemplates]);

  const statusColors: Record<string, string> = {
    DRAFT: 'neutral', SCHEDULED: 'info', OPEN: 'success',
    CLOSING: 'warning', CLOSED: 'neutral', CANCELLED: 'error',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={tab === 'shifts' ? 'Shifts' : 'Shift Templates'}
        description={tab === 'shifts' ? 'Manage work shifts and schedules' : 'Create and manage shift templates'}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setTab('shifts')}
              className={cn('px-4 py-2 text-sm rounded-lg transition-colors', tab === 'shifts' ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]')}
            >
              <CalendarDays className="h-4 w-4 inline mr-1" /> Shifts
            </button>
            <button
              onClick={() => setTab('templates')}
              className={cn('px-4 py-2 text-sm rounded-lg transition-colors', tab === 'templates' ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]')}
            >
              <Clock className="h-4 w-4 inline mr-1" /> Templates
            </button>
          </div>
        }
      />

      {error && <ErrorState title="Error" message={error} onRetry={tab === 'shifts' ? fetchShifts : fetchTemplates} />}

      {tab === 'shifts' ? (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {['', 'DRAFT', 'SCHEDULED', 'OPEN', 'CLOSING', 'CLOSED', 'CANCELLED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors', statusFilter === s ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]')}
              >
                {s || 'All'}
              </button>
            ))}
            {isManager && (
              <button onClick={() => navigate('/shifts/new')} className="ml-auto px-4 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
                <Plus className="h-3 w-3 inline mr-1" /> New Shift
              </button>
            )}
          </div>

          {/* Shift list */}
          {loading ? <Loading message="Loading shifts..." /> : (
            shifts.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No shifts found" description="Create a new shift to get started." />
            ) : (
              <div className="space-y-3">
                {shifts.map((shift: any) => (
                  <Card key={shift.id} hover>
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[var(--color-text-primary)]">{shift.name}</h3>
                            <Badge variant={(statusColors[shift.status] || 'neutral') as any}>{shift.status}</Badge>
                          </div>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {shift.businessDate} · {new Date(shift.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(shift.scheduledEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <p className="font-medium">{shift.assignmentCount} assigned</p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {shift.clockedIn} in · {shift.clockedOut} out · {shift.absent} absent
                            </p>
                          </div>
                          <button onClick={() => navigate(`/shifts/${shift.id}`)} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </>
      ) : (
        /* Templates tab */
        <>
          {isManager && (
            <CreateTemplateForm onCreated={fetchTemplates} />
          )}
          {loading ? <Loading message="Loading templates..." /> : (
            templates.length === 0 ? (
              <EmptyState icon={<Clock className="h-8 w-8" />} title="No templates" description="Create a shift template to quickly schedule shifts." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t: any) => (
                  <Card key={t.id}>
                    <CardContent>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-[var(--color-text-primary)]">{t.name}</h3>
                          <p className="text-xs text-[var(--color-text-muted)]">{t.code}</p>
                        </div>
                        <Badge variant={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="text-[var(--color-text-muted)]">Time:</span> {t.startTime} — {t.endTime}{t.crossesMidnight ? ' (next day)' : ''}</p>
                        {t.defaultBreakMinutes ? <p><span className="text-[var(--color-text-muted)]">Break:</span> {t.defaultBreakMinutes} min</p> : null}
                        {t.description && <p className="text-xs text-[var(--color-text-muted)]">{t.description}</p>}
                      </div>
                      {isManager && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex gap-2">
                          <button onClick={() => setTemplateStatus(t.id, !t.isActive)} className="text-xs text-[var(--color-accent)] hover:underline">
                            {t.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', startTime: '', endTime: '', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createShiftTemplate({
        ...form,
        code: form.code.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      });
      setForm({ name: '', code: '', startTime: '', endTime: '', description: '' });
      setOpen(false);
      onCreated();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
          <Plus className="h-4 w-4" /> {open ? 'Cancel' : 'Create Template'}
        </button>
        {open && (
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]" />
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Code (e.g. MORNING)" required className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]" />
            <input value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} type="time" required className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]" />
            <input value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} type="time" required className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]" />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] col-span-full" />
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
