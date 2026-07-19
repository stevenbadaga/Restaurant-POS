import { useEffect, useState, useCallback } from 'react';
import {
  Store, Clock, DollarSign, Percent, Receipt, CreditCard,
  ShoppingCart, LayoutDashboard, Package, UserCheck, Save,
  Image, Phone, Mail, MapPin, Globe, Sun,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Loading, ErrorState } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllSettings,
  updateSettings,
  updateRestaurantProfile,
  updateBusinessHours,
} from '@/services/settings';
import { cn } from '@/lib/utils';

type TabId = 'profile' | 'hours' | 'tax' | 'receipt' | 'payment' | 'order' | 'table' | 'inventory' | 'shift';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <Store className="h-4 w-4" /> },
  { id: 'hours', label: 'Hours', icon: <Clock className="h-4 w-4" /> },
  { id: 'tax', label: 'Tax & Charges', icon: <Percent className="h-4 w-4" /> },
  { id: 'receipt', label: 'Receipt', icon: <Receipt className="h-4 w-4" /> },
  { id: 'payment', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'order', label: 'Orders', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'table', label: 'Tables', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'inventory', label: 'Inventory', icon: <Package className="h-4 w-4" /> },
  { id: 'shift', label: 'Staff & Shifts', icon: <UserCheck className="h-4 w-4" /> },
];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
};

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isAdmin = user?.roles?.includes('ADMIN') || user?.roles?.includes('MANAGER');

  // Profile form
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', address: '',
    currency: 'RWF', timezone: 'Africa/Kigali', logoUrl: '',
  });

  // Business hours — stored in nested backend format { dayOfWeek, isClosed, periods: [{ openTime, closeTime }] }
  const [businessHours, setBusinessHours] = useState<Array<{
    dayOfWeek: string; isClosed: boolean; periods: { openTime: string; closeTime: string }[];
  }>>([]);

  // Operations settings
  const [ops, setOps] = useState<Record<string, any>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAllSettings();
      const d = result.data;
      setData(d);

      setProfile({
        name: d.restaurant?.name || '',
        email: d.restaurant?.email || '',
        phone: d.restaurant?.phone || '',
        address: d.restaurant?.address || '',
        currency: d.restaurant?.currency || 'RWF',
        timezone: d.restaurant?.timezone || 'Africa/Kigali',
        logoUrl: d.restaurant?.logoUrl || '',
      });

      setOps({ ...d.settings });

      if (d.businessHours && d.businessHours.length > 0) {
        setBusinessHours(d.businessHours.map((bh: any) => ({
          dayOfWeek: bh.dayOfWeek,
          isClosed: bh.isClosed,
          periods: bh.periods?.length > 0
            ? bh.periods.map((p: any) => ({ openTime: p.openTime, closeTime: p.closeTime }))
            : [{ openTime: '08:00', closeTime: '22:00' }],
        })));
      } else {
        setBusinessHours(DAYS.map((day) => ({
          dayOfWeek: day,
          isClosed: day === 'SUNDAY',
          periods: day === 'SUNDAY' ? [] : [{ openTime: '08:00', closeTime: '22:00' }],
        })));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveOperations = async (updates: Record<string, any>) => {
    if (!isAdmin) return;
    setSaving(true);
    setSuccess(null);
    try {
      const result = await updateSettings(updates);
      setOps((prev: any) => ({ ...prev, ...result.data }));
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setSuccess(null);
    try {
      await updateRestaurantProfile(profile);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveBusinessHours = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setSuccess(null);
    try {
      await updateBusinessHours(businessHours);
      setSuccess('Business hours updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateHour = (index: number, field: string, value: any) => {
    const updated = [...businessHours];
    const item = { ...updated[index] };
    if (field === 'isClosed') {
      item.isClosed = value;
      if (value) item.periods = [];
      else if (item.periods.length === 0) item.periods = [{ openTime: '08:00', closeTime: '22:00' }];
    } else if (field === 'openTime' || field === 'closeTime') {
      if (item.periods.length === 0) {
        item.periods = [{ openTime: '08:00', closeTime: '22:00' }];
      }
      item.periods[0] = { ...item.periods[0], [field]: value };
    }
    updated[index] = item;
    setBusinessHours(updated);
  };

  if (loading) {
    return <div className="h-96 flex items-center justify-center"><Loading size="lg" message="Loading settings..." /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Restaurant Settings"
        description="Configure your restaurant profile, operations, and preferences"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-600 text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* RESTAURANT PROFILE */}
      {activeTab === 'profile' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Restaurant Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Restaurant Name</label>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Currency</label>
                <select
                  value={profile.currency}
                  onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                >
                  <option value="RWF">RWF - Rwandan Franc</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="UGX">UGX - Ugandan Shilling</option>
                  <option value="TZS">TZS - Tanzanian Shilling</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Timezone</label>
                <select
                  value={profile.timezone}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                >
                  <option value="Africa/Kigali">Africa/Kigali (CAT)</option>
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                  <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Logo URL</label>
                <input
                  value={profile.logoUrl}
                  onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
                {profile.logoUrl && (
                  <img src={profile.logoUrl} alt="Logo preview" className="mt-2 h-16 w-16 object-contain rounded-lg border border-[var(--color-border)]" />
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="mt-6">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BUSINESS HOURS */}
      {activeTab === 'hours' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Business Hours</h3>
            <div className="space-y-3">
              {businessHours.map((hour, i) => (
                <div key={hour.dayOfWeek} className="flex items-center gap-4 p-3 rounded-lg border border-[var(--color-border)]">
                  <div className="w-28 text-sm font-medium">{DAY_LABELS[hour.dayOfWeek]}</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hour.isClosed}
                      onChange={(e) => updateHour(i, 'isClosed', e.target.checked)}
                      disabled={!isAdmin}
                      className="rounded"
                    />
                    Closed
                  </label>
                  {!hour.isClosed && hour.periods.map((period, pi) => (
                    <span key={pi} className="flex items-center gap-2">
                      {pi > 0 && <span className="text-[var(--color-text-muted)]">|</span>}
                      <input
                        type="time"
                        value={period.openTime}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[i] = { ...updated[i] };
                          updated[i].periods = [...updated[i].periods];
                          updated[i].periods[pi] = { ...updated[i].periods[pi], openTime: e.target.value };
                          setBusinessHours(updated);
                        }}
                        disabled={!isAdmin}
                        className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] w-24"
                      />
                      <span className="text-[var(--color-text-muted)]">to</span>
                      <input
                        type="time"
                        value={period.closeTime}
                        onChange={(e) => {
                          const updated = [...businessHours];
                          updated[i] = { ...updated[i] };
                          updated[i].periods = [...updated[i].periods];
                          updated[i].periods[pi] = { ...updated[i].periods[pi], closeTime: e.target.value };
                          setBusinessHours(updated);
                        }}
                        disabled={!isAdmin}
                        className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] w-24"
                      />
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="mt-6">
                <button
                  onClick={saveBusinessHours}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Hours'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAX & CHARGES */}
      {activeTab === 'tax' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Tax & Service Charges</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Default Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={ops.defaultTaxRate ?? 0}
                  onChange={(e) => setOps({ ...ops, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                  onBlur={() => saveOperations({ defaultTaxRate: ops.defaultTaxRate ?? 0 })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Service Charge Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={ops.serviceChargeRate ?? 0}
                  onChange={(e) => setOps({ ...ops, serviceChargeRate: parseFloat(e.target.value) || 0 })}
                  onBlur={() => saveOperations({ serviceChargeRate: ops.serviceChargeRate ?? 0 })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.pricesIncludeTax ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, pricesIncludeTax: e.target.checked });
                      saveOperations({ pricesIncludeTax: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Prices include tax
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowNegativeStock ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, allowNegativeStock: e.target.checked });
                      saveOperations({ allowNegativeStock: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow negative stock
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RECEIPT SETTINGS */}
      {activeTab === 'receipt' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Receipt Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Receipt Paper Size</label>
                <select
                  value={ops.receiptPaperSize || 'THERMAL_80MM'}
                  onChange={(e) => {
                    setOps({ ...ops, receiptPaperSize: e.target.value });
                    saveOperations({ receiptPaperSize: e.target.value });
                  }}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                >
                  <option value="THERMAL_58MM">Thermal 58mm</option>
                  <option value="THERMAL_80MM">Thermal 80mm</option>
                  <option value="A4">A4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Order Number Prefix</label>
                <input
                  value={ops.orderNumberPrefix || 'ORD'}
                  onChange={(e) => setOps({ ...ops, orderNumberPrefix: e.target.value.toUpperCase() })}
                  onBlur={() => saveOperations({ orderNumberPrefix: ops.orderNumberPrefix || 'ORD' })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  maxLength={10}
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Receipt Number Prefix</label>
                <input
                  value={ops.receiptNumberPrefix || 'REC'}
                  onChange={(e) => setOps({ ...ops, receiptNumberPrefix: e.target.value.toUpperCase() })}
                  onBlur={() => saveOperations({ receiptNumberPrefix: ops.receiptNumberPrefix || 'REC' })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  maxLength={10}
                  disabled={!isAdmin}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Receipt Footer</label>
                <textarea
                  value={ops.receiptFooter || ''}
                  onChange={(e) => setOps({ ...ops, receiptFooter: e.target.value })}
                  onBlur={() => saveOperations({ receiptFooter: ops.receiptFooter || null })}
                  rows={3}
                  placeholder="Thank you for dining with us!"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.receiptShowWaiter ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, receiptShowWaiter: e.target.checked });
                      saveOperations({ receiptShowWaiter: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Show waiter name
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.receiptShowCustomerPhone ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, receiptShowCustomerPhone: e.target.checked });
                      saveOperations({ receiptShowCustomerPhone: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Show customer phone
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.receiptShowTaxBreakdown ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, receiptShowTaxBreakdown: e.target.checked });
                      saveOperations({ receiptShowTaxBreakdown: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Show tax breakdown
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.printReceiptAutomatically ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, printReceiptAutomatically: e.target.checked });
                      saveOperations({ printReceiptAutomatically: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Auto-print receipt on payment
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PAYMENT SETTINGS */}
      {activeTab === 'payment' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Payment Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowPartialPayments ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, allowPartialPayments: e.target.checked });
                      saveOperations({ allowPartialPayments: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow partial payments
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowSplitPayments ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, allowSplitPayments: e.target.checked });
                      saveOperations({ allowSplitPayments: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow split payments
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowPaymentBeforeServing ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, allowPaymentBeforeServing: e.target.checked });
                      saveOperations({ allowPaymentBeforeServing: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow payment before serving
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireOpenCashierSessionForCashPayments ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, requireOpenCashierSessionForCashPayments: e.target.checked });
                      saveOperations({ requireOpenCashierSessionForCashPayments: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require open cashier session for cash
                </label>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireReferenceForCard ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, requireReferenceForCard: e.target.checked });
                      saveOperations({ requireReferenceForCard: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require reference for card payments
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireReferenceForMobileMoney ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, requireReferenceForMobileMoney: e.target.checked });
                      saveOperations({ requireReferenceForMobileMoney: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require reference for mobile money
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireReferenceForBankTransfer ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, requireReferenceForBankTransfer: e.target.checked });
                      saveOperations({ requireReferenceForBankTransfer: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require reference for bank transfer
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ORDER SETTINGS */}
      {activeTab === 'order' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Order Rules</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Business Day Start Time</label>
                  <input
                    type="time"
                    value={ops.businessDayStartTime || '00:00'}
                    onChange={(e) => setOps({ ...ops, businessDayStartTime: e.target.value })}
                    onBlur={() => saveOperations({ businessDayStartTime: ops.businessDayStartTime || '00:00' })}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                    disabled={!isAdmin}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Reservation Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={ops.defaultReservationDurationMinutes ?? 120}
                    onChange={(e) => setOps({ ...ops, defaultReservationDurationMinutes: parseInt(e.target.value) || 120 })}
                    onBlur={() => saveOperations({ defaultReservationDurationMinutes: ops.defaultReservationDurationMinutes ?? 120 })}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.reservationsEnabled ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, reservationsEnabled: e.target.checked });
                      saveOperations({ reservationsEnabled: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Enable reservations
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.waitingListEnabled ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, waitingListEnabled: e.target.checked });
                      saveOperations({ waitingListEnabled: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Enable waiting list
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TABLE SETTINGS */}
      {activeTab === 'table' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Table Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Table Status After Order Closure</label>
                <select
                  value={ops.tableStatusAfterOrderClosure || 'CLEANING'}
                  onChange={(e) => {
                    setOps({ ...ops, tableStatusAfterOrderClosure: e.target.value });
                    saveOperations({ tableStatusAfterOrderClosure: e.target.value });
                  }}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                >
                  <option value="CLEANING">Cleaning</option>
                  <option value="AVAILABLE">Available</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ops.tableRequiredForDineIn ?? true}
                  onChange={(e) => {
                    setOps({ ...ops, tableRequiredForDineIn: e.target.checked });
                    saveOperations({ tableRequiredForDineIn: e.target.checked });
                  }}
                  disabled={!isAdmin}
                  className="rounded"
                />
                Require table for dine-in orders
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* INVENTORY THRESHOLDS */}
      {activeTab === 'inventory' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Inventory & Low Stock Thresholds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={ops.lowStockAlertThreshold ?? 10}
                  onChange={(e) => setOps({ ...ops, lowStockAlertThreshold: parseInt(e.target.value) || 0 })}
                  onBlur={() => saveOperations({ lowStockAlertThreshold: ops.lowStockAlertThreshold ?? 10 })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Items below this quantity are flagged as low stock</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Out of Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={ops.outOfStockAlertThreshold ?? 0}
                  onChange={(e) => setOps({ ...ops, outOfStockAlertThreshold: parseInt(e.target.value) || 0 })}
                  onBlur={() => saveOperations({ outOfStockAlertThreshold: ops.outOfStockAlertThreshold ?? 0 })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Items at or below this quantity are flagged as out of stock</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={ops.defaultReorderLevel ?? 20}
                  onChange={(e) => setOps({ ...ops, defaultReorderLevel: parseInt(e.target.value) || 0 })}
                  onBlur={() => saveOperations({ defaultReorderLevel: ops.defaultReorderLevel ?? 20 })}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                  disabled={!isAdmin}
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.enableLowStockAlerts ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, enableLowStockAlerts: e.target.checked });
                      saveOperations({ enableLowStockAlerts: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Enable low stock alerts
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STAFF & SHIFT SETTINGS */}
      {activeTab === 'shift' && (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-6">Staff & Shift Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowUnscheduledClockIn ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, allowUnscheduledClockIn: e.target.checked });
                      saveOperations({ allowUnscheduledClockIn: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow unscheduled clock-in
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowEmployeeSelfClockIn ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, allowEmployeeSelfClockIn: e.target.checked });
                      saveOperations({ allowEmployeeSelfClockIn: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow self clock-in
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.allowEmployeeSelfClockOut ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, allowEmployeeSelfClockOut: e.target.checked });
                      saveOperations({ allowEmployeeSelfClockOut: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Allow self clock-out
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireClockInForOperationalActions ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, requireClockInForOperationalActions: e.target.checked });
                      saveOperations({ requireClockInForOperationalActions: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require clock-in for actions
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.autoCloseOpenBreakOnClockOut ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, autoCloseOpenBreakOnClockOut: e.target.checked });
                      saveOperations({ autoCloseOpenBreakOnClockOut: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Auto-close break on clock-out
                </label>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireHandoverBeforeShiftClose ?? false}
                    onChange={(e) => {
                      setOps({ ...ops, requireHandoverBeforeShiftClose: e.target.checked });
                      saveOperations({ requireHandoverBeforeShiftClose: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require handover before shift close
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1">Shift Closing Grace (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={ops.shiftClosingGraceMinutes ?? 30}
                    onChange={(e) => setOps({ ...ops, shiftClosingGraceMinutes: parseInt(e.target.value) || 30 })}
                    onBlur={() => saveOperations({ shiftClosingGraceMinutes: ops.shiftClosingGraceMinutes ?? 30 })}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                    disabled={!isAdmin}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cash Variance Approval Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ops.cashVarianceApprovalThreshold ?? 0}
                    onChange={(e) => setOps({ ...ops, cashVarianceApprovalThreshold: parseFloat(e.target.value) || 0 })}
                    onBlur={() => saveOperations({ cashVarianceApprovalThreshold: ops.cashVarianceApprovalThreshold ?? 0 })}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Variances above this require manager approval</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cash Variance Warning Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ops.cashVarianceWarningThreshold ?? 0}
                    onChange={(e) => setOps({ ...ops, cashVarianceWarningThreshold: parseFloat(e.target.value) || 0 })}
                    onBlur={() => saveOperations({ cashVarianceWarningThreshold: ops.cashVarianceWarningThreshold ?? 0 })}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)]"
                    disabled={!isAdmin}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ops.requireManagerApprovalForCashOut ?? true}
                    onChange={(e) => {
                      setOps({ ...ops, requireManagerApprovalForCashOut: e.target.checked });
                      saveOperations({ requireManagerApprovalForCashOut: e.target.checked });
                    }}
                    disabled={!isAdmin}
                    className="rounded"
                  />
                  Require manager approval for cash-out
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not editable indicator */}
      {!isAdmin && (
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Only administrators and managers can modify settings.
        </p>
      )}
    </div>
  );
}
