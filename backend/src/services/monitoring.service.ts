import { prisma } from '../database';
import os from 'os';
import { getSocketIO } from '../sockets/emitter';

// ==========================================
// SYSTEM HEALTH
// ==========================================

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected' | 'slow';
  socketio: 'running' | 'not_running';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    loadAvg: number[];
    cores: number;
  };
  version: string;
  environment: string;
  timestamp: string;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  let database: SystemHealth['database'] = 'connected';
  let dbDuration = 0;

  // Check database with timing
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbDuration = Date.now() - start;

    if (dbDuration > 1000) {
      database = 'slow';
    }
  } catch {
    database = 'disconnected';
  }

  // Check Socket.IO status
  let socketio: SystemHealth['socketio'] = 'not_running';
  try {
    const io = getSocketIO();
    if (io) {
      socketio = 'running';
    }
  } catch {
    socketio = 'not_running';
  }

  const memUsed = process.memoryUsage().heapUsed;
  const memTotal = os.totalmem();

  const status: SystemHealth['status'] =
    database === 'disconnected' ? 'unhealthy' :
    database === 'slow' ? 'degraded' : 'healthy';

  return {
    status,
    database,
    socketio,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(memUsed / 1024 / 1024),
      total: Math.round(memTotal / 1024 / 1024),
      percentage: Math.round((memUsed / memTotal) * 100),
    },
    cpu: {
      loadAvg: os.loadavg(),
      cores: os.cpus().length,
    },
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };
}

// ==========================================
// DATABASE STATS
// ==========================================

export interface DatabaseStats {
  totalTables: number;
  totalRows: number;
  databaseSize: string;
  activeConnections: number;
  migrationCount: number;
  slowQueries: number;
  queryPerformance: {
    avgQueryTime: number;
    maxQueryTime: number;
  };
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    const [tableCount, dbSize, activeConns, migrationCount] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'`,
      prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL AND "applied_steps_count" > 0`,
    ]);

    const tables = (tableCount as any[])[0]?.count || 0;
    const size = (dbSize as any[])[0]?.size || 'unknown';
    const connections = (activeConns as any[])[0]?.count || 0;
    const migrations = (migrationCount as any[])[0]?.count || 0;

    // Count recent slow queries
    const recentSlow = await prisma.slowQueryLog.count({
      where: { recordedAt: { gte: new Date(Date.now() - 3600000) } },
    });

    // Estimate total rows across all tables (approximate)
    let totalRows = 0;
    try {
      const rowCounts = await prisma.$queryRaw`SELECT SUM(n_live_tup)::bigint as count FROM pg_stat_user_tables`;
      totalRows = Number((rowCounts as any[])[0]?.count || 0);
    } catch { /* estimated only */ }

    return {
      totalTables: tables,
      totalRows,
      databaseSize: size,
      activeConnections: connections,
      migrationCount: migrations,
      slowQueries: recentSlow,
      queryPerformance: {
        avgQueryTime: 0,
        maxQueryTime: 0,
      },
    };
  } catch (error) {
    return {
      totalTables: 0,
      totalRows: 0,
      databaseSize: 'unknown',
      activeConnections: 0,
      migrationCount: 0,
      slowQueries: 0,
      queryPerformance: { avgQueryTime: 0, maxQueryTime: 0 },
    };
  }
}

// ==========================================
// SOCKET.IO MONITORING
// ==========================================

export interface SocketIOStatus {
  connected: boolean;
  connectionCount: number;
  rooms: string[];
  events: {
    totalEvents: number;
    eventsByType: Record<string, number>;
  };
}

export function getSocketIOStatus(): SocketIOStatus {
  try {
    const io = getSocketIO();
    if (!io) {
      return { connected: false, connectionCount: 0, rooms: [], events: { totalEvents: 0, eventsByType: {} } };
    }

    const connectionCount = io.engine?.clientsCount || 0;

    // Get room names (excluding socket IDs)
    const rooms = [...io.sockets.adapter.rooms.keys()]
      .filter(r => !io.sockets.adapter.sids.has(r))
      .slice(0, 20);

    return {
      connected: true,
      connectionCount,
      rooms,
      events: { totalEvents: 0, eventsByType: {} },
    };
  } catch {
    return { connected: false, connectionCount: 0, rooms: [], events: { totalEvents: 0, eventsByType: {} } };
  }
}

// ==========================================
// SYSTEM METRICS RECORDING
// ==========================================

export async function recordMetric(params: {
  restaurantId?: string;
  metricType: string;
  metricName: string;
  metricValue: number;
  unit?: string;
  tags?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.systemMetric.create({
      data: {
        restaurantId: params.restaurantId || null,
        metricType: params.metricType,
        metricName: params.metricName,
        metricValue: params.metricValue,
        unit: params.unit || 'ms',
        tags: (params.tags || {}) as any,
        recordedAt: new Date(),
      },
    });
  } catch {
    // Metrics recording should never break the main operation
  }
}

export async function recordSlowQuery(params: {
  restaurantId?: string;
  query: string;
  durationMs: number;
  source?: string;
  correlationId?: string;
  params?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.slowQueryLog.create({
      data: {
        restaurantId: params.restaurantId || null,
        query: params.query.substring(0, 2000),
        durationMs: params.durationMs,
        source: params.source,
        correlationId: params.correlationId,
        params: (params.params || {}) as any,
        recordedAt: new Date(),
      },
    });
  } catch {
    // Silent
  }
}

// ==========================================
// METRICS QUERIES
// ==========================================

export async function getMetricsOverview(restaurantId?: string, hours: number = 24) {
  const since = new Date(Date.now() - hours * 3600000);
  const where: any = { recordedAt: { gte: since } };
  if (restaurantId) where.restaurantId = restaurantId;

  // Get latest system metrics grouped by type
  const recentMetrics = await prisma.systemMetric.groupBy({
    by: ['metricType', 'metricName'],
    where,
    _avg: { metricValue: true },
    _max: { metricValue: true },
    _count: { metricName: true },
    orderBy: { metricType: 'asc' },
  });

  // Count slow queries in period
  const slowQueryCount = await prisma.slowQueryLog.count({
    where: { recordedAt: { gte: since } },
  });

  // Get recent slow queries
  const recentSlowQueries = await prisma.slowQueryLog.findMany({
    where: { recordedAt: { gte: since } },
    orderBy: { durationMs: 'desc' },
    take: 20,
  });

  // Get recent audit events count by severity
  const auditCounts = await prisma.auditLog.groupBy({
    by: ['severity'],
    where: {
      ...where,
      createdAt: { gte: since },
    },
    _count: { severity: true },
  });

  return {
    period: `${hours}h`,
    metrics: recentMetrics.map(m => ({
      type: m.metricType,
      name: m.metricName,
      avg: Math.round((m._avg.metricValue || 0) * 100) / 100,
      max: Math.round((m._max.metricValue || 0) * 100) / 100,
      count: m._count.metricName,
    })),
    slowQueries: {
      total: slowQueryCount,
      recent: recentSlowQueries,
    },
    auditEvents: auditCounts.map(a => ({
      severity: a.severity,
      count: a._count.severity,
    })),
  };
}
