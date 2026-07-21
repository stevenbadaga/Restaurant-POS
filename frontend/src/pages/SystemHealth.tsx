import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { PageHeader, Card, CardContent, Badge, Loading, ErrorState } from '@/components/ui';
import { cn, formatDate } from '@/lib';
import {
  Heart, Database, Wifi, Cpu, HardDrive, Activity,
  CheckCircle, XCircle, AlertTriangle, Clock, Users,
  RefreshCw, Server, BarChart3, Zap, ChevronRight,
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected' | 'slow';
  socketio: 'running' | 'not_running';
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  cpu: { loadAvg: number[]; cores: number };
  version: string;
  environment: string;
}

interface DatabaseStats {
  totalTables: number;
  databaseSize: string;
  activeConnections: number;
  migrationCount: number;
  slowQueries: number;
}

interface SocketIOStatus {
  connected: boolean;
  connectionCount: number;
  rooms: string[];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function SystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketIOStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, dbRes, socketRes] = await Promise.all([
        api.get('/monitoring/health').catch(() => ({ data: { data: null } })),
        api.get('/monitoring/database').catch(() => ({ data: { data: null } })),
        api.get('/monitoring/socketio').catch(() => ({ data: { data: null } })),
      ]);
      setHealth(healthRes.data?.data);
      setDbStats(dbRes.data?.data);
      setSocketStatus(socketRes.data?.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading && !health) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="System Health" description="Real-time system monitoring and diagnostics" />
        <Loading size="lg" message="Loading system metrics..." />
      </div>
    );
  }

  if (error && !health) {
    return <ErrorState title="Monitoring Error" message={error} action={<button onClick={fetchAll}>Retry</button>} />;
  }

  const statusColor = health?.status === 'healthy' ? 'text-green-500' : health?.status === 'degraded' ? 'text-amber-500' : 'text-red-500';
  const statusBg = health?.status === 'healthy' ? 'bg-green-50 dark:bg-green-950/10 border-green-200' : health?.status === 'degraded' ? 'bg-amber-50 dark:bg-amber-950/10 border-amber-200' : 'bg-red-50 dark:bg-red-950/10 border-red-200';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="System Health"
        description="Real-time system monitoring and diagnostics"
        actions={
          <button onClick={fetchAll} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Overall Status Banner */}
      {health && (
        <div className={cn('p-4 rounded-xl border', statusBg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-full', health.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/20' : health.status === 'degraded' ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-red-100 dark:bg-red-900/20')}>
                {health.status === 'healthy' ? <CheckCircle className={cn('h-6 w-6', statusColor)} /> : health.status === 'degraded' ? <AlertTriangle className={cn('h-6 w-6', statusColor)} /> : <XCircle className={cn('h-6 w-6', statusColor)} />}
              </div>
              <div>
                <h2 className="text-lg font-bold capitalize">{health.status}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">All systems {health.status === 'healthy' ? 'operational' : health.status === 'degraded' ? 'experiencing some issues' : 'experiencing outages'}</p>
              </div>
            </div>
            <div className="text-right text-xs text-[var(--color-text-muted)]">
              <p>Uptime: {formatUptime(health.uptime)}</p>
              <p>v{health.version} · {health.environment}</p>
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database */}
        <Card>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Database</p>
                <div className="flex items-center gap-2 mt-1">
                  <Database className={cn('h-4 w-4', health?.database === 'connected' ? 'text-green-500' : 'text-red-500')} />
                  <span className="text-lg font-bold capitalize">{health?.database || 'unknown'}</span>
                </div>
              </div>
              {health?.database === 'connected' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
            </div>
            {dbStats && (
              <div className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                <div className="flex justify-between"><span>Size</span><span>{dbStats.databaseSize}</span></div>
                <div className="flex justify-between"><span>Tables</span><span>{dbStats.totalTables}</span></div>
                <div className="flex justify-between"><span>Connections</span><span>{dbStats.activeConnections}</span></div>
                <div className="flex justify-between"><span>Migrations</span><span>{dbStats.migrationCount}</span></div>
                <div className="flex justify-between"><span>Recent Slow Queries</span><span className={dbStats.slowQueries > 0 ? 'text-amber-500 font-medium' : ''}>{dbStats.slowQueries}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Socket.IO */}
        <Card>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">WebSocket</p>
                <div className="flex items-center gap-2 mt-1">
                  <Wifi className={cn('h-4 w-4', socketStatus?.connected ? 'text-green-500' : 'text-red-500')} />
                  <span className="text-lg font-bold">{socketStatus?.connected ? 'Running' : 'Offline'}</span>
                </div>
              </div>
              {socketStatus?.connected ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
            </div>
            {socketStatus && (
              <div className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                <div className="flex justify-between"><span>Connections</span><span className="font-medium">{socketStatus.connectionCount}</span></div>
                <div className="flex justify-between"><span>Active Rooms</span><span>{socketStatus.rooms.length}</span></div>
                {socketStatus.rooms.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] font-medium mb-0.5">Top Rooms:</p>
                    {socketStatus.rooms.slice(0, 5).map(room => (
                      <p key={room} className="text-[10px] font-mono truncate">{room}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Memory */}
        {health && (
          <Card>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">Memory</p>
                  <div className="flex items-center gap-2 mt-1">
                    <HardDrive className="h-4 w-4 text-blue-500" />
                    <span className="text-lg font-bold">{health.memory.percentage}%</span>
                  </div>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{health.memory.used}MB / {health.memory.total}MB</span>
              </div>
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full transition-all duration-500', health.memory.percentage > 80 ? 'bg-red-500' : health.memory.percentage > 60 ? 'bg-amber-500' : 'bg-green-500')}
                  style={{ width: `${Math.min(health.memory.percentage, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* CPU */}
        {health && (
          <Card>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">CPU</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Cpu className="h-4 w-4 text-purple-500" />
                    <span className="text-lg font-bold">{health.cpu.cores} cores</span>
                  </div>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">Load: {health.cpu.loadAvg.map(v => v.toFixed(1)).join(', ')}</span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                <div className="flex justify-between"><span>1 min</span><span>{(health.cpu.loadAvg[0] / health.cpu.cores * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>5 min</span><span>{(health.cpu.loadAvg[1] / health.cpu.cores * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>15 min</span><span>{(health.cpu.loadAvg[2] / health.cpu.cores * 100).toFixed(0)}%</span></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Version & Environment Info */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">System Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div><span className="text-[var(--color-text-muted)]">Version:</span> <span className="font-medium">{health?.version || 'N/A'}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Environment:</span> <Badge variant={health?.environment === 'production' ? 'success' : 'info'}>{health?.environment || 'development'}</Badge></div>
            <div><span className="text-[var(--color-text-muted)]">Uptime:</span> <span className="font-medium">{health ? formatUptime(health.uptime) : 'N/A'}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Database:</span> <span className={cn('font-medium', health?.database === 'connected' ? 'text-green-600' : 'text-red-600')}>{health?.database || 'unknown'}</span></div>
            <div><span className="text-[var(--color-text-muted)]">WebSocket:</span> <span className={cn('font-medium', socketStatus?.connected ? 'text-green-600' : 'text-red-600')}>{socketStatus?.connected ? 'Connected' : 'Disconnected'}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Active Connections:</span> <span className="font-medium">{socketStatus?.connectionCount || 0}</span></div>
          </div>
          {health?.uptime && (
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              Last refreshed: {new Date().toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
