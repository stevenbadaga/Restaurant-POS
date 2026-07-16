import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
  render?: (value: any, row: any) => React.ReactNode;
  hideOnMobile?: boolean;
}

interface ReportDataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  rowClick?: (row: any) => void;
  pagination?: boolean;
  pageSize?: number;
}

export function ReportDataTable({
  columns, data, loading, page = 1, totalPages, total,
  onPageChange, onSort, sortKey, sortOrder = 'desc',
  emptyMessage = 'No data available', emptyIcon, rowClick,
  pagination = true, pageSize = 25,
}: ReportDataTableProps) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'desc');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <Loading size="sm" message="Loading data..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent>
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            {emptyIcon}
            <p className="text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider',
                      col.sortable && 'cursor-pointer hover:text-[var(--color-text-primary)] select-none',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="inline-flex flex-col">
                          {sortKey === col.key ? (
                            sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-[var(--color-text-muted)]" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.map((row, i) => (
                <tr
                  key={row.id || i}
                  className={cn(
                    'transition-colors duration-150',
                    rowClick ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)]' : 'hover:bg-[var(--color-bg-secondary)]'
                  )}
                  onClick={() => rowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-sm text-[var(--color-text-primary)]',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : col.format
                          ? col.format(row[col.key])
                          : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {data.map((row, i) => (
            <div
              key={row.id || i}
              className={cn(
                'p-4 space-y-2',
                rowClick && 'cursor-pointer hover:bg-[var(--color-bg-secondary)]'
              )}
              onClick={() => rowClick?.(row)}
            >
              {columns
                .filter((col) => !col.hideOnMobile)
                .slice(0, 5)
                .map((col) => (
                  <div key={col.key} className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">{col.label}</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {col.render
                        ? col.render(row[col.key], row)
                        : col.format
                          ? col.format(row[col.key])
                          : row[col.key] ?? '-'}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination && totalPages && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              {total ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
