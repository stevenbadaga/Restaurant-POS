import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift, Plus, RefreshCw, Search, Edit3, Eye, X, Calendar, Clock, Tag,
  Percent, DollarSign, ShoppingBag, CheckCircle2, XCircle, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Button, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import api from '@/services/api';
import { formatDate, cn } from '@/lib';

interface Promotion {
  id: string;
  name: string;
  code?: string;
  description?: string;
  promotionType: string;
  promotionScope: string;
  status: string;
  percentageValue?: number;
  fixedAmountValue?: number;
  fixedItemPrice?: number;
  buyQuantity?: number;
  getQuantity?: number;
  minimumOrderSubtotal?: number;
  maximumDiscountAmount?: number;
  startAt: string;
  endAt: string;
  usageLimitTotal?: number;
  currentUsageCount: number;
  customerRequired: boolean;
  loyaltyMembersOnly: boolean;
  automaticallyApply: boolean;
  allowStacking: boolean;
  priority: number;
  isActive: boolean;
  schedules?: Array<{ dayOfWeek: string; startTime?: string; endTime?: string }>;
  menuItems?: Array<{ menuItem: { id: string; name: string } }>;
  _count?: { usages: number };
}

const dayOptions = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const typeOptions = ['PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'FIXED_ITEM_PRICE', 'FREE_ITEM', 'BUY_X_GET_Y'];
const scopeOptions = ['ORDER', 'MENU_ITEM', 'MENU_CATEGORY'];

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function defaultForm() {
  return {
    name: '', code: '', description: '', promotionType: 'PERCENTAGE_DISCOUNT', promotionScope: 'ORDER',
    percentageValue: 10, fixedAmountValue: '', fixedItemPrice: '', buyQuantity: 2, getQuantity: 1,
    minimumOrderSubtotal: '', maximumDiscountAmount: '', startAt: new Date().toISOString().split('T')[0],
    endAt: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    usageLimitTotal: '', customerRequired: false, loyaltyMembersOnly: false,
    automaticallyApply: false, allowStacking: false, priority: 0,
    schedules: [] as Array<{ dayOfWeek: string; startTime: string; endTime: string }>,
    menuItemIds: [] as string[],
    menuCategoryIds: [] as string[],
  };
}

export default function PromotionsManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [pagination, setPagination] = useState<any>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [menuCategories, setMenuCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Detail
  const [detail, setDetail] = useState<Promotion | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState('');

  const loadPromotions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { pageSize: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/promotions', { params });
      setPromotions(res.data.promotions ?? []);
      setPagination(res.data.pagination ?? null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load promotions'));
    } finally {
      setLoading(false);
    }
  };

  const loadMenuData = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu/items', { params: { pageSize: 200 } }),
        api.get('/menu/categories'),
      ]);
      setMenuItems(itemsRes.data.items ?? itemsRes.data.data ?? []);
      setMenuCategories(catsRes.data.data ?? []);
    } catch { /* silent */ }
  };

  useEffect(() => { loadPromotions(); }, [statusFilter]);

  useEffect(() => { if (error || success) { const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000); return () => clearTimeout(t); } }, [error, success]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setShowForm(true);
    loadMenuData();
  };

  const openEdit = (promo: Promotion) => {
    setEditing(promo);
    setForm({
      name: promo.name,
      code: promo.code || '',
      description: promo.description || '',
      promotionType: promo.promotionType,
      promotionScope: promo.promotionScope,
      percentageValue: promo.percentageValue || 10,
      fixedAmountValue: promo.fixedAmountValue?.toString() || '',
      fixedItemPrice: promo.fixedItemPrice?.toString() || '',
      buyQuantity: promo.buyQuantity || 2,
      getQuantity: promo.getQuantity || 1,
      minimumOrderSubtotal: promo.minimumOrderSubtotal?.toString() || '',
      maximumDiscountAmount: promo.maximumDiscountAmount?.toString() || '',
      startAt: promo.startAt?.split('T')[0] || '',
      endAt: promo.endAt?.split('T')[0] || '',
      usageLimitTotal: promo.usageLimitTotal?.toString() || '',
      customerRequired: promo.customerRequired,
      loyaltyMembersOnly: promo.loyaltyMembersOnly,
      automaticallyApply: promo.automaticallyApply,
      allowStacking: promo.allowStacking,
      priority: promo.priority || 0,
      schedules: promo.schedules?.map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime || '', endTime: s.endTime || '' })) || [],
      menuItemIds: promo.menuItems?.map(mi => mi.menuItem.id) || [],
      menuCategoryIds: [],
    });
    setShowForm(true);
    loadMenuData();
  };

  const submitPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        percentageValue: form.promotionType === 'PERCENTAGE_DISCOUNT' ? Number(form.percentageValue) : undefined,
        fixedAmountValue: form.promotionType === 'FIXED_AMOUNT_DISCOUNT' ? Number(form.fixedAmountValue) : undefined,
        fixedItemPrice: form.promotionType === 'FIXED_ITEM_PRICE' ? Number(form.fixedItemPrice) : undefined,
        buyQuantity: form.promotionType === 'BUY_X_GET_Y' ? Number(form.buyQuantity) : undefined,
        getQuantity: form.promotionType === 'BUY_X_GET_Y' || form.promotionType === 'FREE_ITEM' ? Number(form.getQuantity) : undefined,
        minimumOrderSubtotal: form.minimumOrderSubtotal ? Number(form.minimumOrderSubtotal) : undefined,
        maximumDiscountAmount: form.maximumDiscountAmount ? Number(form.maximumDiscountAmount) : undefined,
        usageLimitTotal: form.usageLimitTotal ? Number(form.usageLimitTotal) : undefined,
        menuItemIds: form.menuItemIds.length > 0 ? form.menuItemIds : undefined,
        menuCategoryIds: form.menuCategoryIds.length > 0 ? form.menuCategoryIds : undefined,
        schedules: form.schedules.length > 0 ? form.schedules : undefined,
      };

      if (editing) {
        await api.patch(`/promotions/${editing.id}`, payload);
        setSuccess('Promotion updated successfully.');
      } else {
        await api.post('/promotions', payload);
        setSuccess('Promotion created successfully.');
      }
      setShowForm(false);
      loadPromotions();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save promotion'));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/promotions/${id}/status`, { status });
      setSuccess(`Promotion ${status.toLowerCase()}.`);
      loadPromotions();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const viewDetail = (promo: Promotion) => {
    setDetail(promo);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'PERCENTAGE_DISCOUNT': return <Percent className="h-4 w-4" />;
      case 'FIXED_AMOUNT_DISCOUNT': return <DollarSign className="h-4 w-4" />;
      case 'FIXED_ITEM_PRICE': return <Tag className="h-4 w-4" />;
      case 'FREE_ITEM': return <Gift className="h-4 w-4" />;
      case 'BUY_X_GET_Y': return <ShoppingBag className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
      ACTIVE: 'success', SCHEDULED: 'info', DRAFT: 'neutral', PAUSED: 'warning', EXPIRED: 'error', CANCELLED: 'error',
    };
    return <Badge variant={variants[status] || 'neutral'} className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Promotions"
        description="Manage promotional offers, discount codes, and loyalty rewards"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={loadPromotions} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>New Promotion</Button>
          </div>
        }
      />

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['', 'ACTIVE', 'SCHEDULED', 'DRAFT', 'PAUSED', 'EXPIRED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              statusFilter === s ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 text-sm text-green-700 dark:text-green-300">{success}</div>}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'New'} Promotion</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={submitPromotion} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Code (optional)</label>
                  <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field uppercase" placeholder="e.g. SUMMER20" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={2} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Type *</label>
                  <select value={form.promotionType} onChange={e => setForm({ ...form, promotionType: e.target.value })} className="input-field">
                    {typeOptions.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Scope *</label>
                  <select value={form.promotionScope} onChange={e => setForm({ ...form, promotionScope: e.target.value })} className="input-field">
                    {scopeOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                {form.promotionType === 'PERCENTAGE_DISCOUNT' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Percentage (%)</label>
                    <input type="number" min="1" max="100" value={form.percentageValue} onChange={e => setForm({ ...form, percentageValue: Number(e.target.value) })} className="input-field" />
                  </div>
                )}
                {form.promotionType === 'FIXED_AMOUNT_DISCOUNT' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Fixed Amount</label>
                    <input type="number" min="0" step="0.01" value={form.fixedAmountValue} onChange={e => setForm({ ...form, fixedAmountValue: e.target.value })} className="input-field" />
                  </div>
                )}
                {form.promotionType === 'FIXED_ITEM_PRICE' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Fixed Item Price</label>
                    <input type="number" min="0" step="0.01" value={form.fixedItemPrice} onChange={e => setForm({ ...form, fixedItemPrice: e.target.value })} className="input-field" />
                  </div>
                )}
                {['BUY_X_GET_Y', 'FREE_ITEM'].includes(form.promotionType) && (
                  <>
                    {form.promotionType === 'BUY_X_GET_Y' && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Buy Quantity</label>
                        <input type="number" min="1" value={form.buyQuantity} onChange={e => setForm({ ...form, buyQuantity: Number(e.target.value) })} className="input-field" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Get/Free Quantity</label>
                      <input type="number" min="1" value={form.getQuantity} onChange={e => setForm({ ...form, getQuantity: Number(e.target.value) })} className="input-field" />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium">Start Date *</label>
                  <input type="date" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} className="input-field" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">End Date *</label>
                  <input type="date" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })} className="input-field" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Min. Order Subtotal</label>
                  <input type="number" min="0" step="0.01" value={form.minimumOrderSubtotal} onChange={e => setForm({ ...form, minimumOrderSubtotal: e.target.value })} className="input-field" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Max Discount Amount</label>
                  <input type="number" min="0" step="0.01" value={form.maximumDiscountAmount} onChange={e => setForm({ ...form, maximumDiscountAmount: e.target.value })} className="input-field" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Usage Limit (total)</label>
                  <input type="number" min="0" value={form.usageLimitTotal} onChange={e => setForm({ ...form, usageLimitTotal: e.target.value })} className="input-field" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Priority</label>
                  <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="input-field" />
                </div>
              </div>

              {/* Schedules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Schedules (optional)</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setForm({ ...form, schedules: [...form.schedules, { dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '22:00' }] })}>
                    <Plus className="h-3.5 w-3.5" /> Add Schedule
                  </Button>
                </div>
                {form.schedules.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <select value={s.dayOfWeek} onChange={e => { const u = [...form.schedules]; u[i].dayOfWeek = e.target.value; setForm({ ...form, schedules: u }); }} className="input-field text-xs">
                      {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="time" value={s.startTime} onChange={e => { const u = [...form.schedules]; u[i].startTime = e.target.value; setForm({ ...form, schedules: u }); }} className="input-field text-xs w-28" />
                    <span className="text-xs text-[var(--color-text-muted)]">to</span>
                    <input type="time" value={s.endTime} onChange={e => { const u = [...form.schedules]; u[i].endTime = e.target.value; setForm({ ...form, schedules: u }); }} className="input-field text-xs w-28" />
                    <button onClick={() => setForm({ ...form, schedules: form.schedules.filter((_, j) => j !== i) })} className="p-1 text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              {/* Menu Items (for MENU_ITEM scope) */}
              {form.promotionScope === 'MENU_ITEM' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Eligible Menu Items</label>
                  <select
                    multiple
                    value={form.menuItemIds}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions, o => o.value);
                      setForm({ ...form, menuItemIds: selected });
                    }}
                    className="input-field w-full h-24"
                  >
                    {menuItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'customerRequired', label: 'Customer Required' },
                  { key: 'loyaltyMembersOnly', label: 'Loyalty Members Only' },
                  { key: 'automaticallyApply', label: 'Auto-Apply' },
                  { key: 'allowStacking', label: 'Allow Stacking' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
                    <span className="text-xs">{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" isLoading={saving}>{editing ? 'Update' : 'Create'} Promotion</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{detail.name}</h2>
              <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[var(--color-text-muted)]">Type:</span> <span className="font-medium">{detail.promotionType.replace(/_/g, ' ')}</span></div>
                <div><span className="text-[var(--color-text-muted)]">Scope:</span> <span className="font-medium">{detail.promotionScope.replace(/_/g, ' ')}</span></div>
                <div><span className="text-[var(--color-text-muted)]">Status:</span> {statusBadge(detail.status)}</div>
                <div><span className="text-[var(--color-text-muted)]">Code:</span> <span className="font-mono">{detail.code || '-'}</span></div>
                <div><span className="text-[var(--color-text-muted)]">From:</span> {formatDate(detail.startAt)}</div>
                <div><span className="text-[var(--color-text-muted)]">To:</span> {formatDate(detail.endAt)}</div>
                <div><span className="text-[var(--color-text-muted)]">Usage:</span> {detail.currentUsageCount}/{detail.usageLimitTotal || '∞'}</div>
                <div><span className="text-[var(--color-text-muted)]">Auto-apply:</span> {detail.automaticallyApply ? 'Yes' : 'No'}</div>
              </div>
              {detail.description && <p className="text-[var(--color-text-muted)]">{detail.description}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <Card><CardContent>
        {loading ? <Loading message="Loading promotions..." /> : (
          promotions.length === 0 ? (
            <EmptyState icon={<Gift className="h-16 w-16" />} title="No promotions" description="Create your first promotion to offer discounts and deals." action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Promotion</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotions.map(promo => (
                <div key={promo.id} className="border border-[var(--color-border)] rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {typeIcon(promo.promotionType)}
                      <div>
                        <h3 className="font-semibold text-sm">{promo.name}</h3>
                        {promo.code && <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{promo.code}</span>}
                      </div>
                    </div>
                    {statusBadge(promo.status)}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2 line-clamp-1">{promo.description || promo.promotionType.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] mb-3">
                    <Calendar className="h-3 w-3" /> {formatDate(promo.startAt)} - {formatDate(promo.endAt)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--color-text-muted)]">{promo._count?.usages || 0} uses</span>
                    <div className="flex gap-1">
                      <button onClick={() => viewDetail(promo)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openEdit(promo)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><Edit3 className="h-3.5 w-3.5" /></button>
                      {promo.status === 'ACTIVE' ? (
                        <button onClick={() => updateStatus(promo.id, 'PAUSED')} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50"><ToggleLeft className="h-3.5 w-3.5" /></button>
                      ) : promo.status === 'PAUSED' || promo.status === 'DRAFT' ? (
                        <button onClick={() => updateStatus(promo.id, 'ACTIVE')} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50"><ToggleRight className="h-3.5 w-3.5" /></button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </CardContent></Card>
    </div>
  );
}
