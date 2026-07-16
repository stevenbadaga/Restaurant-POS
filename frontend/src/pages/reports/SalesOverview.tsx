import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, TrendingUp, ShoppingCart, ArrowUp, ArrowDown } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { ReportFilterBar, type ReportFilters } from '@/components/reports/ReportFilterBar';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { ReportChartCard } from '@/components/reports/ReportChartCard';
import { ReportDataTable } from '@/components/reports/ReportDataTable';
import { useAuth } from '@/contexts/AuthContext';

export default function SalesOverview() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({ preset: 'today' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.preset) params.set('preset', filters.preset);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await fetch(`/api/reports/sales/overview?${params}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Failed to load sales overview:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async (format: string) => {
    const params = new URLSearchParams();
    params.set('reportType', 'sales_overview');
    params.set('format', format);
    if (filters.preset) params.set('preset', filters.preset);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    window.open(`/api/reports/export?${params}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sales Overview"
        description="Revenue, collections, and order metrics"
      />

      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        onExport={handleExport}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Net Collected"
          value={data?.netCollected || '$0.00'}
          loading={loading}
          color="green"
          icon={<DollarSign className="h-5 w-5" />}
          comparison={data?.comparison ? {
            value: data.comparison.current,
            direction: data.comparison.direction,
            percentageChange: data.comparison.percentageChange,
          } : undefined}
        />
        <ReportSummaryCard
          label="Gross Payments"
          value={data?.grossCompletedPayments || '$0.00'}
          loading={loading}
          color="blue"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <ReportSummaryCard
          label="Closed Orders"
          value={String(data?.closedOrderCount || 0)}
          loading={loading}
          color="purple"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <ReportSummaryCard
          label="Avg Order Value"
          value={data?.averageOrderValue || '$0.00'}
          loading={loading}
          color="teal"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Refunds"
          value={data?.refunds || '$0.00'}
          loading={loading}
          color="red"
          icon={<ArrowDown className="h-5 w-5" />}
        />
        <ReportSummaryCard
          label="Outstanding Balance"
          value={data?.outstandingBalance || '$0.00'}
          loading={loading}
          color="amber"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <ReportSummaryCard
          label="Tax Collected"
          value={data?.taxCollected || '$0.00'}
          loading={loading}
          color="blue"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <ReportSummaryCard
          label="Service Charge"
          value={data?.serviceChargeCollected || '$0.00'}
          loading={loading}
          color="purple"
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportSummaryCard
          label="Dine-In Value"
          value={data?.dineInValue || '$0.00'}
          color="blue"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <ReportSummaryCard
          label="Takeaway Value"
          value={data?.takeawayValue || '$0.00'}
          color="teal"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}
