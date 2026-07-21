import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { PageHeader, Card, CardContent, Badge, Loading, EmptyState, ErrorState } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { formatDate, cn } from '@/lib';
import {
  Search, Filter, Shield, User, Globe, Monitor, Hash,
  ChevronDown, ChevronUp, AlertTriangle, Info, AlertCircle,
  ShieldAlert, Clock, RefreshCw, Eye,
} from 'lucide-react';

type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

const SEVERITY_STYLES: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CRITICAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  INFO: <Info className="h-3.5 w-3.5" />,
  WARNING: <AlertTriangle className="h-3.5 w-3.5" />,
  ERROR: <AlertCircle className="h-3.5 w-3.5" />,
  CRITICAL: <ShieldAlert className="h-3.5 w-3.5" />,
};

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  severity: string;
  previousValue: any;
  newValue: any;
  hash: string | null;
  previousHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  correlationId: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface AuditLogsData {
  logs: AuditEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function AuditLog() {
  const [data, setData] = useState<AuditLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    severity: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (page > 1) params.page = String(page);
      if (search) params.search = search;
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.severity) params.severity = filters.severity;
      if (filters.userId) params.userId = filters.userId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await api.get('/audit', { params });
      setData(response.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [actionsRes, typesRes] = await Promise.all([
        api.get('/audit/actions').catch(() => ({ data: { data: [] } })),
        api.get('/audit/entity-types').catch(() => ({ data: { data: [] } })),
      ]);
      setActions(actionsRes.data?.data || []);
      setEntityTypes(typesRes.data?.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: '', entityType: '', severity: '', userId: '', dateFrom: '', dateTo: '' });
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    const color = action.includes('Deleted') || action.includes('Voided') || action.includes('Cancelled')
      ? 'error'
      : action.includes('Created') || action.includes('Issued') || action.includes('Completed')
        ? 'success'
        : action.includes('Updated') || action.includes('Modified') || action.includes('Changed')
          ? 'warning'
          : action.includes('Login') || action.includes('logout') || action.includes('Login')
            ? 'info'
            : 'neutral';
    return color;
  };

  if (loading && !data) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Audit Trail" description="System activity and change tracking" />
        <Loading size="lg" message="Loading audit logs..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Audit Trail"
        description="Monitor all system activity, changes, and security events"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={fetchLogs} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* Search and filters */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search actions, entities, descriptions..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleSearch} leftIcon={<Search className="h-4 w-4" />}>
              Search
            </Button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-2 rounded-lg border transition-colors',
                showFilters ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
              )}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-[var(--color-border)]">
              <div>
                <label className="block text-xs font-medium mb-1">Action</label>
                <select value={filters.action} onChange={(e) => handleFilterChange('action', e.target.value)} className="w-full px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  <option value="">All actions</option>
                  {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Entity Type</label>
                <select value={filters.entityType} onChange={(e) => handleFilterChange('entityType', e.target.value)} className="w-full px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  <option value="">All types</option>
                  {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Severity</label>
                <select value={filters.severity} onChange={(e) => handleFilterChange('severity', e.target.value)} className="w-full px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  <option value="">All severities</option>
                  <option value="INFO">Info</option>
                  <option value="WARNING">Warning</option>
                  <option value="ERROR">Error</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">From</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} className="w-full px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">To</label>
                <div className="flex gap-1">
                  <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} className="flex-1 px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
                  {(filters.action || filters.severity || filters.dateFrom) && (
                    <button onClick={clearFilters} className="px-2 py-1 text-xs text-red-500 hover:text-red-600">Clear</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {error && <ErrorState title="Error" message={error} action={<Button variant="secondary" onClick={fetchLogs}>Retry</Button>} />}

      {!error && data && data.logs.length === 0 && (
        <Card><CardContent>
          <EmptyState icon={<Shield className="h-16 w-16" />} title="No audit logs found" description="Try adjusting your search filters or date range." />
        </CardContent></Card>
      )}

      {!error && data && data.logs.length > 0 && (
        <>
          <div className="text-xs text-[var(--color-text-muted)] mb-1">
            Showing {data.logs.length} of {data.pagination.total} results
            {data.pagination.totalPages > 1 && ` (Page ${data.pagination.page} of ${data.pagination.totalPages})`}
          </div>

          <div className="space-y-2">
            {data.logs.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', SEVERITY_STYLES[entry.severity] || SEVERITY_STYLES.INFO)}>
                            {SEVERITY_ICONS[entry.severity]}
                            {entry.severity}
                          </span>
                          <Badge variant={getActionBadge(entry.action) as any}>{entry.action}</Badge>
                          <span className="text-xs font-mono text-[var(--color-text-muted)] truncate">{entry.entityType}{entry.entityId ? ` #${entry.entityId.substring(0, 8)}` : ''}</span>
                        </div>
                        {entry.description && (
                          <p className="text-sm text-[var(--color-text-primary)] mt-1">{entry.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--color-text-muted)]">{formatDate(entry.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <button
                          onClick={() => setExpandedLog(expandedLog === entry.id ? null : entry.id)}
                          className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                        >
                          {expandedLog === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* User & IP row */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                      {entry.user ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.user.firstName} {entry.user.lastName}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                          <User className="h-3 w-3" /> System
                        </span>
                      )}
                      {entry.ipAddress && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {entry.ipAddress}
                        </span>
                      )}
                      {entry.userAgent && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <Monitor className="h-3 w-3" />
                          {parseUserAgent(entry.userAgent)}
                        </span>
                      )}
                      {entry.requestMethod && (
                        <span className="font-mono text-[10px]">{entry.requestMethod} {entry.requestPath}</span>
                      )}
                      {entry.correlationId && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {entry.correlationId.substring(0, 8)}...
                        </span>
                      )}
                    </div>

                    {/* Expanded details */}
                    {expandedLog === entry.id && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
                        {entry.previousValue && (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Previous Value</p>
                            <pre className="p-2 bg-red-50 dark:bg-red-950/10 rounded text-xs overflow-auto max-h-32">{JSON.stringify(entry.previousValue, null, 2)}</pre>
                          </div>
                        )}
                        {entry.newValue && (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">New Value</p>
                            <pre className="p-2 bg-green-50 dark:bg-green-950/10 rounded text-xs overflow-auto max-h-32">{JSON.stringify(entry.newValue, null, 2)}</pre>
                          </div>
                        )}
                        {entry.hash && (
                          <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-muted)] font-mono">
                            <span title="Audit hash (SHA-256)">Hash: {entry.hash.substring(0, 16)}...</span>
                            {entry.previousHash && <span title="Previous hash in chain">Prev: {entry.previousHash.substring(0, 16)}...</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function parseUserAgent(ua: string): string {
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('Edge/')) return 'Edge';
  if (ua.includes('Postman')) return 'Postman';
  return ua.substring(0, 30);
}
