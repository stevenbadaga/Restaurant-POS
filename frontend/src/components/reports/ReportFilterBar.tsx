import { useState, useCallback } from 'react';
import { Calendar, X, Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ReportFilters {
  preset?: string;
  dateFrom?: string;
  dateTo?: string;
  waiterId?: string;
  cashierId?: string;
  chefId?: string;
  stationId?: string;
  menuItemId?: string;
  menuCategoryId?: string;
  diningAreaId?: string;
  tableId?: string;
  orderType?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  inventoryItemId?: string;
  stockLocationId?: string;
  movementType?: string;
  grouping?: string;
  search?: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface FilterField {
  key: keyof ReportFilters;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: FilterOption[];
}

interface ReportFilterBarProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  showExport?: boolean;
  extraFields?: FilterField[];
  loading?: boolean;
}

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export function ReportFilterBar({
  filters,
  onChange,
  onExport,
  showExport = true,
  extraFields = [],
  loading = false,
}: ReportFilterBarProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const setPreset = useCallback((preset: string) => {
    onChange({ ...filters, preset, dateFrom: undefined, dateTo: undefined });
  }, [filters, onChange]);

  const setDate = useCallback((field: 'dateFrom' | 'dateTo', value: string) => {
    onChange({ ...filters, preset: 'custom', [field]: value });
  }, [filters, onChange]);

  const setField = useCallback((key: keyof ReportFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  }, [filters, onChange]);

  const resetFilters = useCallback(() => {
    onChange({ preset: 'today' });
  }, [onChange]);

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v !== undefined && v !== '' && k !== 'grouping'
  ).length;

  return (
    <div className="space-y-3">
      {/* Date presets */}
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setPreset(preset.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200',
              filters.preset === preset.value
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {filters.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setDate('dateFrom', e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <span className="text-[var(--color-text-muted)]">to</span>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setDate('dateTo', e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
      )}

      {/* Extra filters and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Extra filter fields */}
          {extraFields.map((field) => (
            <div key={field.key}>
              {field.type === 'select' && (
                <select
                  value={filters[field.key] || ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  <option value="">{field.label}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)]"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--color-accent)] text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Export actions */}
        {showExport && onExport && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('csv')}
              disabled={loading}
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('xlsx')}
              disabled={loading}
            >
              XLSX
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onExport('pdf')}
              disabled={loading}
            >
              PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
