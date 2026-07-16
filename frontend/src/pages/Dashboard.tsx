import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, ShoppingCart, TrendingUp, Users, CreditCard,
  ArrowUp, ArrowDown, ChefHat, Package, Clock, AlertTriangle,
  Receipt, BarChart3, LayoutDashboard, UserCheck, Coffee,
  LogIn, CalendarDays, MessageSquare, ClipboardList,
} from 'lucide-react';
import { PageHeader, Card, CardContent } from '@/components/ui';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardData } from '@/services/reports';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ADMIN');
  const isManager = userRoles.includes('MANAGER');
  const isCashier = userRoles.includes('CASHIER');
  const isWaiter = userRoles.includes('WAITER');
  const isChef = userRoles.includes('CHEF');
  const isStockKeeper = userRoles.includes('STOCK_KEEPER');
  const isFullAccess = isAdmin || isManager;

  const fetchData = () => {
    setLoading(true);
    setError(null);
    getDashboardData()
      .then((result) => {
        setData(result.data);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading && !data) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loading size="lg" message="Loading dashboard..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Dashboard" description="Restaurant overview and key metrics" />
        <ErrorState title="Failed to load dashboard" message={error} onRetry={fetchData} />
      </div>
    );
  }

  // Role-specific dashboards
  if (data?.roleSpecific) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader
          title="Dashboard"
          description={`${data.role} overview`}
        />
        <div className="text-xs text-[var(--color-text-muted)]">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
        <RoleSpecificDashboard data={data} role={data.role} navigate={navigate} />
        {/* Shift/Attendance status for all roles */}
        {data.myShiftStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <ShiftWidget
              clockedIn={data.myShiftStatus.clockedIn}
              onBreak={data.myShiftStatus.onBreak}
              workedMinutes={data.myShiftStatus.workedMinutes}
              lateMinutes={data.myShiftStatus.lateMinutes}
            />
          </div>
        )}
      </div>
    );
  }

  // Full ADMIN/MANAGER dashboard
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Dashboard"
          description="Restaurant overview and key metrics"
        />
        <button
          onClick={fetchData}
          className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="text-xs text-[var(--color-text-muted)]">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>

      {/* Primary metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          label="Net Collected Today"
          value={data?.netCollectedToday || '$0.00'}
          subtitle="Gross payments minus refunds"
          icon={<DollarSign className="h-5 w-5" />}
          color="green"
          comparison={data?.comparison}
        />
        <MetricCard
          label="Gross Payments"
          value={data?.grossPaymentsToday || '$0.00'}
          icon={<CreditCard className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          label="Closed Orders"
          value={String(data?.closedOrdersToday || 0)}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="purple"
          comparison={data?.closedOrdersComparison}
        />
        <MetricCard
          label="Outstanding Balance"
          value={data?.outstandingBalance || '$0.00'}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          label="Refunds Today"
          value={data?.refundsToday || '$0.00'}
          icon={<TrendingDown className="h-5 w-5" />}
          color="red"
        />
        <MetricCard
          label="Avg Order Value"
          value={data?.averageOrderValue || '$0.00'}
          icon={<TrendingUp className="h-5 w-5" />}
          color="teal"
        />
        <MetricCard
          label="Occupied Tables"
          value={`${data?.occupiedTables || 0} / ${data?.totalTables || 0}`}
          subtitle="Tables currently occupied"
          icon={<LayoutDashboard className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          label="Payment Queue"
          value={String(data?.paymentQueue || 0)}
          subtitle="Orders awaiting payment"
          icon={<Receipt className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment methods */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Payment Methods Today
            </h3>
            {data?.paymentMethods?.length > 0 ? (
              <div className="space-y-4">
                {data.paymentMethods.map((pm: any) => (
                  <div key={pm.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        pm.method === 'CASH' ? 'bg-green-100 dark:bg-green-900/20' :
                        pm.method === 'MOBILE_MONEY' ? 'bg-blue-100 dark:bg-blue-900/20' :
                        pm.method === 'CARD' ? 'bg-purple-100 dark:bg-purple-900/20' :
                        'bg-gray-100 dark:bg-gray-900/20'
                      )}>
                        <DollarSign className={cn(
                          'h-4 w-4',
                          pm.method === 'CASH' ? 'text-green-600' :
                          pm.method === 'MOBILE_MONEY' ? 'text-blue-600' :
                          pm.method === 'CARD' ? 'text-purple-600' :
                          'text-gray-600'
                        )} />
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {pm.method.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {pm.amount}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {pm.count} txns · {pm.share}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                No payments recorded today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Kitchen & operational overview */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Operational Overview
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <OperationalStat
                label="New Tickets"
                value={String(data?.kitchenOverview?.newTickets || 0)}
                icon={<ChefHat className="h-4 w-4" />}
                color="blue"
              />
              <OperationalStat
                label="Preparing"
                value={String(data?.kitchenOverview?.preparingTickets || 0)}
                icon={<Clock className="h-4 w-4" />}
                color="amber"
              />
              <OperationalStat
                label="Ready"
                value={String(data?.kitchenOverview?.readyTickets || 0)}
                icon={<ShoppingCart className="h-4 w-4" />}
                color="green"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Low Stock Items</p>
                <p className="text-lg font-bold text-amber-500">{data?.inventoryAlerts?.lowStock || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Out of Stock</p>
                <p className="text-lg font-bold text-red-500">{data?.inventoryAlerts?.outOfStock || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top items and staff overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Top Selling Items
            </h3>
            {data?.topItems?.length > 0 ? (
              <div className="space-y-3">
                {data.topItems.slice(0, 8).map((item: any, i: number) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--color-text-muted)] w-5">
                        {i + 1}.
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)] truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.qty}x
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                No sales data available
              </p>
            )}
            <button
              onClick={() => navigate('/reports/sales-by-item')}
              className="mt-4 text-xs text-[var(--color-accent)] hover:underline"
            >
              View full report →
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Waiter Sales Today
            </h3>
            {data?.waiterSales?.length > 0 ? (
              <div className="space-y-3">
                {data.waiterSales.map((ws: any) => (
                  <div key={ws.waiterId} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {ws.waiterName}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {ws.orderCount} orders
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">
                        {ws.totalValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                No waiter sales today
              </p>
            )}
            <button
              onClick={() => navigate('/reports/sales-by-waiter')}
              className="mt-4 text-xs text-[var(--color-accent)] hover:underline"
            >
              View full report →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Shift / Workforce Widget */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Workforce Overview
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickActionButton
              label="My Shift"
              icon={<Clock className="h-5 w-5" />}
              onClick={() => navigate('/my-shift')}
            />
            <QuickActionButton
              label="Shifts"
              icon={<CalendarDays className="h-5 w-5" />}
              onClick={() => navigate('/shifts')}
            />
            <QuickActionButton
              label="Attendance"
              icon={<UserCheck className="h-5 w-5" />}
              onClick={() => navigate('/attendance')}
            />
            <QuickActionButton
              label="Handovers"
              icon={<MessageSquare className="h-5 w-5" />}
              onClick={() => navigate('/handovers')}
            />
          </div>
          {data?.employeesScheduledToday !== undefined && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Scheduled Today</p>
                <p className="text-lg font-bold">{data.employeesScheduledToday}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Clocked In</p>
                <p className="text-lg font-bold text-green-500">{data.employeesClockedIn || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Open Sessions</p>
                <p className="text-lg font-bold text-amber-500">{data.openCashierSessions || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                <p className="text-xs text-[var(--color-text-muted)]">Pending Approvals</p>
                <p className="text-lg font-bold text-red-500">{data.pendingApprovals || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickActionButton
              label="New Order"
              icon={<ShoppingCart className="h-5 w-5" />}
              onClick={() => navigate('/orders/new')}
            />
            <QuickActionButton
              label="Payment Queue"
              icon={<CreditCard className="h-5 w-5" />}
              onClick={() => navigate('/payments/queue')}
            />
            <QuickActionButton
              label="Reports"
              icon={<BarChart3 className="h-5 w-5" />}
              onClick={() => navigate('/reports')}
            />
            <QuickActionButton
              label="Tables"
              icon={<LayoutDashboard className="h-5 w-5" />}
              onClick={() => navigate('/tables')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label, value, subtitle, icon, color, comparison,
}: {
  label: string; value: string; subtitle?: string;
  icon: React.ReactNode; color: string;
  comparison?: { direction: string; percentageChange: number | null };
}) {
  return (
    <Card className="p-5">
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            {subtitle && (
              <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
            )}
            {comparison && comparison.percentageChange !== null && (
              <div className="flex items-center gap-1 mt-1">
                {comparison.direction === 'up' ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : comparison.direction === 'down' ? (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                ) : null}
                <span className={cn(
                  'text-xs font-medium',
                  comparison.direction === 'up' && 'text-green-500',
                  comparison.direction === 'down' && 'text-red-500',
                  comparison.direction === 'neutral' && 'text-[var(--color-text-muted)]'
                )}>
                  {Math.abs(comparison.percentageChange)}% vs yesterday
                </span>
              </div>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-lg',
            color === 'green' && 'bg-green-100 dark:bg-green-900/20 text-green-600',
            color === 'blue' && 'bg-blue-100 dark:bg-blue-900/20 text-blue-600',
            color === 'purple' && 'bg-purple-100 dark:bg-purple-900/20 text-purple-600',
            color === 'amber' && 'bg-amber-100 dark:bg-amber-900/20 text-amber-600',
            color === 'red' && 'bg-red-100 dark:bg-red-900/20 text-red-600',
            color === 'teal' && 'bg-teal-100 dark:bg-teal-900/20 text-teal-600',
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OperationalStat({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-[var(--color-bg-secondary)]">
      <div className={cn(
        'inline-flex p-2 rounded-lg mb-2',
        color === 'blue' && 'bg-blue-100 dark:bg-blue-900/20 text-blue-600',
        color === 'amber' && 'bg-amber-100 dark:bg-amber-900/20 text-amber-600',
        color === 'green' && 'bg-green-100 dark:bg-green-900/20 text-green-600',
      )}>
        {icon}
      </div>
      <p className="text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function QuickActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] transition-all duration-200 text-left"
    >
      <div className="text-[var(--color-accent)] mb-2">{icon}</div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
    </button>
  );
}

function RoleSpecificDashboard({ data, role, navigate }: { data: any; role: string; navigate: any }) {
  if (role === 'WAITER') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="My Closed Orders" value={String(data.myClosedOrders || 0)} icon={<ShoppingCart className="h-5 w-5" />} color="blue" />
        <MetricCard label="My Order Value" value={data.myOrderValue || '$0.00'} icon={<DollarSign className="h-5 w-5" />} color="green" />
        <MetricCard label="My Paid Value" value={data.myPaidValue || '$0.00'} icon={<TrendingUp className="h-5 w-5" />} color="teal" />
        <MetricCard label="My Tips" value={data.myTipTotal || '$0.00'} subtitle={data.myTipCount ? `${data.myTipCount} tips` : undefined} icon={<DollarSign className="h-5 w-5" />} color="purple" />
        <MetricCard label="Outstanding Balance" value={data.myOutstandingBalance || '$0.00'} icon={<AlertTriangle className="h-5 w-5" />} color="amber" />
      </div>
    );
  }

  if (role === 'CASHIER') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="My Payments" value={String(data.myCompletedPayments || 0)} icon={<CreditCard className="h-5 w-5" />} color="blue" />
        <MetricCard label="Net Collected" value={data.myNetCollected || '$0.00'} icon={<DollarSign className="h-5 w-5" />} color="green" />
        <MetricCard label="Cash Collected" value={data.cashCollected || '$0.00'} icon={<DollarSign className="h-5 w-5" />} color="teal" />
        <MetricCard label="Orders Awaiting" value={String(data.ordersAwaitingPayment || 0)} icon={<Receipt className="h-5 w-5" />} color="amber" />
      </div>
    );
  }

  if (role === 'CHEF') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="New Tickets" value={String(data.newTickets || 0)} icon={<ChefHat className="h-5 w-5" />} color="blue" />
        <MetricCard label="Preparing" value={String(data.preparingTickets || 0)} icon={<Clock className="h-5 w-5" />} color="amber" />
        <MetricCard label="Ready" value={String(data.readyTickets || 0)} icon={<ShoppingCart className="h-5 w-5" />} color="green" />
        <MetricCard label="Items Today" value={String(data.itemsPrepared || 0)} icon={<Package className="h-5 w-5" />} color="purple" />
      </div>
    );
  }

  if (role === 'STOCK_KEEPER') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard label="Low Stock" value={String(data.lowStockItems || 0)} icon={<AlertTriangle className="h-5 w-5" />} color="amber" />
        <MetricCard label="Out of Stock" value={String(data.outOfStockItems || 0)} icon={<AlertTriangle className="h-5 w-5" />} color="red" />
        <MetricCard label="Received Today" value={data.stockReceivedToday || '0'} icon={<Package className="h-5 w-5" />} color="green" />
        <MetricCard label="Consumed Today" value={data.stockConsumedToday || '0'} icon={<TrendingUp className="h-5 w-5" />} color="purple" />
      </div>
    );
  }

  return (
    <p className="text-[var(--color-text-muted)]">No dashboard data available</p>
  );
}

function ShiftWidget({
  clockedIn, onBreak, workedMinutes, lateMinutes,
}: {
  clockedIn: boolean; onBreak: boolean; workedMinutes?: number; lateMinutes?: number;
}) {
  const navigate = useNavigate();
  return (
    <div className="col-span-full flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)]">
      <div className="flex items-center gap-3">
        <div className={clockedIn ? (onBreak ? 'bg-amber-100 dark:bg-amber-900/20 p-2 rounded-lg' : 'bg-green-100 dark:bg-green-900/20 p-2 rounded-lg') : 'bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg'}>
          {!clockedIn ? <LogIn className="h-5 w-5 text-blue-600" /> : onBreak ? <Coffee className="h-5 w-5 text-amber-600" /> : <UserCheck className="h-5 w-5 text-green-600" />}
        </div>
        <div>
          <p className="text-sm font-medium">
            {!clockedIn ? 'Not clocked in' : onBreak ? 'On break' : `Clocked in${workedMinutes ? ` · ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m` : ''}`}
          </p>
          {lateMinutes ? <p className="text-xs text-red-500">{lateMinutes} min late</p> : null}
        </div>
      </div>
      <button onClick={() => navigate('/my-shift')} className="text-xs text-[var(--color-accent)] hover:underline">View →</button>
    </div>
  );
}

function TrendingDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
  );
}
