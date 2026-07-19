import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  Mail,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button, Loading } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getExportUrl } from '@/services/reports';

type ReportStatus = 'READY' | 'NEEDS_REVIEW' | 'FAIL' | 'IN_PROGRESS';

interface ReportDefinition {
  id: string;
  title: string;
  project: string;
  parentUpi: string;
  type: string;
  generatedBy: string;
  score: number | null;
  recommendation: ReportStatus;
  generatedAt: string;
  path: string;
  exportType: string;
  permission: string[];
}

const REPORTS: ReportDefinition[] = [
  { id: 'sales-overview', title: 'Sales Overview', project: 'Restaurant Operations', parentUpi: 'N/A', type: 'Sales', generatedBy: 'System', score: 96, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/sales', exportType: 'sales_overview', permission: ['ADMIN', 'MANAGER'] },
  { id: 'sales-by-waiter', title: 'Sales by Waiter', project: 'Restaurant Operations', parentUpi: 'N/A', type: 'Sales', generatedBy: 'System', score: 92, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/sales-by-waiter', exportType: 'sales_waiters', permission: ['ADMIN', 'MANAGER'] },
  { id: 'waiter-assignments', title: 'Waiter Assignment Report', project: 'Dining Room', parentUpi: 'N/A', type: 'Operations', generatedBy: 'System', score: 90, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/waiter-assignments', exportType: 'waiter_assignments', permission: ['ADMIN', 'MANAGER'] },
  { id: 'sales-by-item', title: 'Sales by Item', project: 'Menu Analytics', parentUpi: 'N/A', type: 'Sales', generatedBy: 'System', score: 90, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/sales-by-item', exportType: 'sales_items', permission: ['ADMIN', 'MANAGER'] },
  { id: 'sales-by-category', title: 'Sales by Category', project: 'Menu Analytics', parentUpi: 'N/A', type: 'Sales', generatedBy: 'System', score: 88, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/sales-by-category', exportType: 'sales_items', permission: ['ADMIN', 'MANAGER'] },
  { id: 'payment-summary', title: 'Payment Summary', project: 'Payments', parentUpi: 'N/A', type: 'Payments', generatedBy: 'System', score: 94, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/payments', exportType: 'payment_methods', permission: ['ADMIN', 'MANAGER'] },
  { id: 'payment-methods', title: 'Payment Methods', project: 'Payments', parentUpi: 'N/A', type: 'Payments', generatedBy: 'System', score: 94, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/payment-methods', exportType: 'payment_methods', permission: ['ADMIN', 'MANAGER'] },
  { id: 'outstanding', title: 'Outstanding Balances', project: 'Payments', parentUpi: 'N/A', type: 'Payments', generatedBy: 'System', score: 78, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/outstanding', exportType: 'outstanding', permission: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { id: 'cashiers', title: 'Cashier Activity', project: 'Cash Control', parentUpi: 'N/A', type: 'Payments', generatedBy: 'System', score: 86, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/cashiers', exportType: 'cashiers', permission: ['ADMIN', 'MANAGER'] },
  { id: 'refunds', title: 'Refunds & Voids', project: 'Cash Control', parentUpi: 'N/A', type: 'Payments', generatedBy: 'System', score: 82, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/refunds', exportType: 'refunds', permission: ['ADMIN', 'MANAGER'] },
  { id: 'receipts', title: 'Receipt Report', project: 'Receipts', parentUpi: 'N/A', type: 'Payments', generatedBy: 'System', score: 88, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/receipts', exportType: 'receipts', permission: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { id: 'kitchen', title: 'Kitchen Performance', project: 'Kitchen', parentUpi: 'N/A', type: 'Kitchen', generatedBy: 'System', score: 80, recommendation: 'IN_PROGRESS', generatedAt: 'On demand', path: '/reports/kitchen', exportType: 'kitchen_performance', permission: ['ADMIN', 'MANAGER', 'CHEF'] },
  { id: 'kitchen-stations', title: 'Kitchen Stations', project: 'Kitchen', parentUpi: 'N/A', type: 'Kitchen', generatedBy: 'System', score: 80, recommendation: 'IN_PROGRESS', generatedAt: 'On demand', path: '/reports/kitchen-stations', exportType: 'kitchen_performance', permission: ['ADMIN', 'MANAGER', 'CHEF'] },
  { id: 'preparation-items', title: 'Item Preparation', project: 'Kitchen', parentUpi: 'N/A', type: 'Kitchen', generatedBy: 'System', score: 80, recommendation: 'IN_PROGRESS', generatedAt: 'On demand', path: '/reports/preparation-items', exportType: 'kitchen_performance', permission: ['ADMIN', 'MANAGER', 'CHEF'] },
  { id: 'tables', title: 'Table Performance', project: 'Dining Room', parentUpi: 'N/A', type: 'Operations', generatedBy: 'System', score: 84, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/tables', exportType: 'tables', permission: ['ADMIN', 'MANAGER'] },
  { id: 'dining-areas', title: 'Dining Areas', project: 'Dining Room', parentUpi: 'N/A', type: 'Operations', generatedBy: 'System', score: 84, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/dining-areas', exportType: 'tables', permission: ['ADMIN', 'MANAGER'] },
  { id: 'order-types', title: 'Dine-In vs Takeaway', project: 'Orders', parentUpi: 'N/A', type: 'Operations', generatedBy: 'System', score: 88, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/order-types', exportType: 'sales_overview', permission: ['ADMIN', 'MANAGER'] },
  { id: 'order-statuses', title: 'Order Statuses', project: 'Orders', parentUpi: 'N/A', type: 'Operations', generatedBy: 'System', score: 74, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/order-statuses', exportType: 'sales_overview', permission: ['ADMIN', 'MANAGER'] },
  { id: 'cancellations', title: 'Cancellations', project: 'Orders', parentUpi: 'N/A', type: 'Operations', generatedBy: 'System', score: 76, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/cancellations', exportType: 'cancellations', permission: ['ADMIN', 'MANAGER'] },
  { id: 'inventory-usage', title: 'Inventory Usage', project: 'Inventory', parentUpi: 'N/A', type: 'Inventory', generatedBy: 'System', score: 82, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/inventory-usage', exportType: 'inventory_usage', permission: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'] },
  { id: 'inventory-cost', title: 'Inventory Cost', project: 'Inventory', parentUpi: 'N/A', type: 'Inventory', generatedBy: 'System', score: 78, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/inventory-cost', exportType: 'inventory_cost', permission: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'] },
  { id: 'wastage', title: 'Wastage', project: 'Inventory', parentUpi: 'N/A', type: 'Inventory', generatedBy: 'System', score: 72, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/wastage', exportType: 'wastage', permission: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'] },
  { id: 'low-stock', title: 'Low Stock', project: 'Inventory', parentUpi: 'N/A', type: 'Inventory', generatedBy: 'System', score: 70, recommendation: 'NEEDS_REVIEW', generatedAt: 'On demand', path: '/reports/low-stock', exportType: 'low_stock', permission: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'] },
  { id: 'tax-service-charge', title: 'Tax & Service Charge', project: 'Finance', parentUpi: 'N/A', type: 'Financial', generatedBy: 'System', score: 92, recommendation: 'READY', generatedAt: 'On demand', path: '/reports/tax-service-charge', exportType: 'tax_service_charge', permission: ['ADMIN', 'MANAGER'] },
];

const typeFilters = ['All', 'Sales', 'Payments', 'Kitchen', 'Operations', 'Inventory', 'Financial'];

function statusMeta(status: ReportStatus) {
  switch (status) {
    case 'READY':
      return { label: 'Ready', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800' };
    case 'NEEDS_REVIEW':
      return { label: 'Needs Review', icon: AlertTriangle, className: 'bg-yellow-50 text-yellow-800 ring-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-200 dark:ring-yellow-700' };
    case 'FAIL':
      return { label: 'Fail', icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', icon: BarChart3, className: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800' };
  }
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1', meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading] = useState(false);
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const userRoles = user?.roles || [];
  const visibleReports = useMemo(() => {
    return REPORTS.filter((report) => report.permission.some((role) => userRoles.includes(role)))
      .filter((report) => activeType === 'All' || report.type === activeType)
      .filter((report) => {
        const haystack = `${report.title} ${report.project} ${report.parentUpi} ${report.type}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      });
  }, [activeType, query, userRoles]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const handleDownload = (report: ReportDefinition) => {
    window.open(getExportUrl(report.exportType, 'pdf', { preset: 'today' }), '_blank', 'noopener,noreferrer');
  };

  const handleEmail = async (report: ReportDefinition) => {
    setBusyAction(`email:${report.id}`);
    try {
      const downloadPath = getExportUrl(report.exportType, 'pdf', { preset: 'today' });
      const subject = encodeURIComponent(`${report.title} report`);
      const body = encodeURIComponent(`Please review the ${report.title} report.\n\nDownload: ${window.location.origin}${downloadPath}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      showNotice('success', 'Email draft opened. Send it from your email client.');
    } catch {
      showNotice('error', 'Could not open an email draft for this report.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (report: ReportDefinition) => {
    const confirmed = window.confirm(`Delete "${report.title}"? This project has no backend endpoint for deleting report definitions.`);
    if (!confirmed) return;
    setBusyAction(`delete:${report.id}`);
    window.setTimeout(() => {
      setBusyAction(null);
      showNotice('error', 'Delete was not performed because no report delete API exists in this repository.');
    }, 250);
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loading size="lg" message="Loading reports..." />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 animate-fade-in overflow-x-hidden">
      <header className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 h-1 w-16 rounded-full bg-yellow-500" />
            <h1 className="text-2xl font-bold tracking-normal text-emerald-950 dark:text-emerald-100">
              Reports Center
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Generate, review, download, email, and manage GeoSmart planning reports.
            </p>
          </div>
          <div className="w-full max-w-md lg:w-80">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reports"
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
              />
            </label>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Report Generator</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Choose a report row, then view or download it.</p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-emerald-950 px-3 py-1 text-xs font-semibold text-white dark:bg-emerald-700 flex-shrink-0">
              {visibleReports.length} available
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {typeFilters.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs font-semibold transition flex-shrink-0',
                  activeType === type
                    ? 'border-yellow-500 bg-yellow-100 text-emerald-950 dark:bg-yellow-500/20 dark:text-yellow-100'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-yellow-500 hover:text-emerald-800 dark:hover:text-yellow-100'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div className={cn(
            'mx-4 mt-4 rounded-lg border px-3 py-2 text-sm',
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          )}>
            {notice.message}
          </div>
        )}

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-emerald-950 text-xs uppercase tracking-wide text-white">
                <th className="w-[210px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Report Name</th>
                <th className="w-[170px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Project</th>
                <th className="w-[130px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Parent UPI</th>
                <th className="w-[120px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Type</th>
                <th className="w-[130px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Generated By</th>
                <th className="w-[80px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Score</th>
                <th className="w-[150px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Recommendation</th>
                <th className="w-[140px] border-b-2 border-yellow-500 px-4 py-3 font-semibold">Date Generated</th>
                <th className="sticky right-0 z-10 w-[230px] border-b-2 border-yellow-500 bg-emerald-950 px-4 py-3 font-semibold shadow-[-10px_0_16px_rgba(0,0,0,0.18)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visibleReports.map((report) => (
                <tr key={report.id} className="group text-sm transition hover:bg-yellow-50/60 dark:hover:bg-yellow-950/10">
                  <td className="px-4 py-3">
                    <div className="truncate font-semibold text-[var(--color-text-primary)]" title={report.title}>
                      {report.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate text-[var(--color-text-secondary)]" title={report.project}>{report.project}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]">{report.parentUpi}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800">
                      {report.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap text-[var(--color-text-secondary)]">{report.generatedBy}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap font-semibold text-[var(--color-text-primary)]">
                      {report.score == null ? '-' : `${report.score}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={report.recommendation} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap text-[var(--color-text-secondary)]">{report.generatedAt}</span>
                  </td>
                  <td className="sticky right-0 z-[1] bg-[var(--color-bg-primary)] px-4 py-2 shadow-[-10px_0_16px_rgba(0,0,0,0.08)] group-hover:bg-yellow-50 dark:group-hover:bg-[#1c1a10]">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => navigate(report.path)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => handleDownload(report)}>
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Mail className="h-3.5 w-3.5" />}
                        isLoading={busyAction === `email:${report.id}`}
                        onClick={() => handleEmail(report)}
                      >
                        Email
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDelete(report)}
                        disabled={busyAction === `delete:${report.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                        aria-label={`Delete ${report.title}`}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleReports.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">
            No reports match the current filters.
          </div>
        )}
      </section>
    </div>
  );
}
