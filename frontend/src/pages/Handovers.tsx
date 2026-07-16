import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MessageSquare, Plus, Eye, CheckCircle2, Send,
  ClipboardList, Package, DollarSign,
  ArrowLeft,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Badge, Loading, EmptyState, ErrorState, Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getHandovers, getHandover, getHandoverSuggestions, createHandover, submitHandover, acknowledgeHandover } from '@/services/handovers';
import { getWorkShifts } from '@/services/shifts';


export default function Handovers() {
  const navigate = useNavigate();
  const { id } = useParams();

  // If we have an ID param, show detail
  if (id) return <HandoverDetailPage id={id} />;

  return <HandoverListPage navigate={navigate} />;
}

function HandoverListPage({ navigate }: { navigate: any }) {


  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getHandovers({ limit: 50 });
      setHandovers(result.handovers || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusColors: Record<string, string> = {
    DRAFT: 'neutral', SUBMITTED: 'info', ACKNOWLEDGED: 'success',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Handovers"
        description="Shift handover notes and acknowledgements"
        actions={
          <button onClick={() => navigate('/handovers/new')} className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Handover
          </button>
        }
      />

      {error && <ErrorState title="Error" message={error} onRetry={fetchData} />}

      {loading ? <Loading message="Loading handovers..." /> : (
        handovers.length === 0 ? (
          <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="No handovers" description="Create a handover to communicate shift information." />
        ) : (
          <div className="space-y-3">
            {handovers.map((h: any) => (
              <Card key={h.id} hover>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[var(--color-text-primary)]">{h.title}</h3>
                        <Badge variant={(statusColors[h.status] || 'neutral') as any}>{h.status}</Badge>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        From: {h.fromUser?.firstName} {h.fromUser?.lastName}
                        {h.toUser ? ` → To: ${h.toUser.firstName} ${h.toUser.lastName}` : ''}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {h.workShift?.nameSnapshot} — {h.workShift?.businessDate}
                        {h.submittedAt && ` · Submitted ${new Date(h.submittedAt).toLocaleString()}`}
                      </p>
                      <p className="text-sm mt-2 text-[var(--color-text-secondary)] line-clamp-2">{h.notes}</p>
                    </div>
                    <button onClick={() => navigate(`/handovers/${h.id}`)} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function HandoverDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const [handover, setHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getHandover(id);
      setHandover(result.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load handover');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleSubmit = async () => {
    try {
      await submitHandover(id);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed');
    }
  };

  const handleAcknowledge = async () => {
    try {
      await acknowledgeHandover(id);
      await fetchDetail();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Loading message="Loading handover..." />;
  if (error) return <ErrorState title="Error" message={error} />;
  if (!handover) return <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="Handover not found" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate('/handovers')} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to Handovers
      </button>

      <PageHeader
        title={handover.title}
        description={`${handover.workShift?.nameSnapshot} — ${handover.workShift?.businessDate}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm whitespace-pre-wrap">{handover.notes}</p>
            </CardContent>
          </Card>

          {handover.unresolvedOrders && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Unresolved Orders</h3>
                <pre className="text-sm text-[var(--color-text-secondary)]">{JSON.stringify(handover.unresolvedOrders, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          {handover.stockConcerns && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Stock Concerns</h3>
                <pre className="text-sm text-[var(--color-text-secondary)]">{JSON.stringify(handover.stockConcerns, null, 2)}</pre>
              </CardContent>
            </Card>
          )}

          {handover.cashConcerns && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Cash Concerns</h3>
                <pre className="text-sm text-[var(--color-text-secondary)]">{JSON.stringify(handover.cashConcerns, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Status</p>
                <Badge>{handover.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">From</p>
                <p className="font-medium">{handover.fromUser?.firstName} {handover.fromUser?.lastName}</p>
              </div>
              {handover.toUser && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">To</p>
                  <p className="font-medium">{handover.toUser?.firstName} {handover.toUser?.lastName}</p>
                </div>
              )}
              {handover.submittedAt && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Submitted</p>
                  <p className="font-medium">{new Date(handover.submittedAt).toLocaleString()}</p>
                </div>
              )}
              {handover.acknowledgedAt && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Acknowledged</p>
                  <p className="font-medium">{new Date(handover.acknowledgedAt).toLocaleString()} by {handover.acknowledgedBy?.firstName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {handover.status === 'DRAFT' && (
              <button onClick={handleSubmit} className="w-full px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2">
                <Send className="h-4 w-4" /> Submit Handover
              </button>
            )}
            {handover.status === 'SUBMITTED' && (
              <button onClick={handleAcknowledge} className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// New Handover Page
export function NewHandover() {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<any[]>([]);
  const [form, setForm] = useState({
    workShiftId: '', title: '', notes: '',
    toUserId: '', assignedRoleName: '',
  });
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);

  useEffect(() => {
    getWorkShifts({ status: 'OPEN' }).then((r) => setShifts(r.shifts || [])).catch(() => {});
  }, []);

  const loadSuggestions = async (shiftId: string) => {
    if (!shiftId) return;
    try {
      const r = await getHandoverSuggestions(shiftId);
      setSuggestions(r.data);
    } catch { setSuggestions(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createHandover(form as any);
      navigate('/handovers');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader title="New Handover" description="Create shift handover notes" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Shift *</label>
          <select value={form.workShiftId} onChange={(e) => { setForm({ ...form, workShiftId: e.target.value }); loadSuggestions(e.target.value); }} required className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-sm">
            <option value="">Select shift...</option>
            {shifts.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} ({s.businessDate})</option>
            ))}
          </select>
        </div>

        {suggestions && (
          <Card>
            <CardContent>
              <h4 className="text-sm font-semibold mb-2">Suggested Items</h4>
              {suggestions.unresolvedOrders?.length > 0 && (
                <p className="text-xs text-amber-600">{suggestions.unresolvedOrders.length} unpaid orders</p>
              )}
              {suggestions.stockConcerns?.length > 0 && (
                <p className="text-xs text-red-600">{suggestions.stockConcerns.length} low-stock items</p>
              )}
              {suggestions.cashConcerns?.length > 0 && (
                <p className="text-xs text-blue-600">{suggestions.cashConcerns.length} open cash sessions</p>
              )}
            </CardContent>
          </Card>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-sm" placeholder="e.g. End of shift summary" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes *</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} required rows={4} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-sm" placeholder="Describe any important information for the next shift..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Recipient (optional)</label>
            <input value={form.toUserId} onChange={(e) => setForm({ ...form, toUserId: e.target.value })} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-sm" placeholder="User ID" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <input value={form.assignedRoleName} onChange={(e) => setForm({ ...form, assignedRoleName: e.target.value })} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-sm" placeholder="e.g. WAITER" />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving} className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 text-sm">{saving ? 'Creating...' : 'Create Handover'}</button>
          <button type="button" onClick={() => navigate('/handovers')} className="px-6 py-2 border border-[var(--color-border)] rounded-lg text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
