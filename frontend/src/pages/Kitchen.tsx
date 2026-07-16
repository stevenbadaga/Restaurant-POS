import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Card, CardContent, Loading, EmptyState, ErrorState, Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { getActiveTickets, getTicketsByStation, getKitchenStations, acceptTicket, startPreparing, markItemsReady, type KitchenTicket, type KitchenStation } from '@/services/kitchen';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { cn } from '@/lib/utils';
import {
  ChefHat, Clock, Timer, AlertCircle, CheckCircle2,
  UtensilsCrossed, Hash, User, MessageSquare, Bell,
  ChefHatIcon, PlayCircle, CheckCheck,
  RefreshCw,
} from 'lucide-react';

const STATUS_ORDER = ['NEW', 'ACCEPTED', 'PREPARING', 'PARTIALLY_READY'];
const STATUS_LABELS: Record<string, string> = {
  NEW: 'New', ACCEPTED: 'Accepted', PREPARING: 'Preparing',
  PARTIALLY_READY: 'Partial', READY: 'Ready', CANCELLED: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ACCEPTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  PREPARING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  PARTIALLY_READY: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  READY: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// Sound notification using Web Audio API (no file needed)
function playNewOrderSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.6);
  } catch { /* Sound not available */ }
}

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }
  return `${mins}m ${secs}s`;
}

function groupByStation(tickets: KitchenTicket[]): Map<string, KitchenTicket[]> {
  const grouped = new Map<string, KitchenTicket[]>();
  const uncategorized: KitchenTicket[] = [];
  for (const t of tickets) {
    const stationName = t.kitchenStation?.name || 'Unassigned';
    if (stationName === 'Unassigned') {
      uncategorized.push(t);
    } else {
      const existing = grouped.get(stationName) || [];
      existing.push(t);
      grouped.set(stationName, existing);
    }
  }
  // Sort tickets by status priority then creation time
  for (const [key, value] of grouped) {
    value.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  if (uncategorized.length > 0) {
    grouped.set('Unassigned', uncategorized);
  }
  return grouped;
}

export default function Kitchen() {
  const { user, restaurant } = useAuth();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [activeStation, setActiveStation] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const previousTicketCount = useRef(0);
  const socketConnected = useRef(false);
  const userRoles = user?.roles || [];
  const isChef = userRoles.includes('CHEF') || userRoles.includes('ADMIN') || userRoles.includes('MANAGER');

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      setError(null);
      const data = activeStation === 'all'
        ? await getActiveTickets()
        : await getTicketsByStation(activeStation);
      setTickets(data);
      // Sound notification for new tickets
      if (previousTicketCount.current > 0 && data.length > previousTicketCount.current) {
        playNewOrderSound();
      }
      previousTicketCount.current = data.length;
    } catch (err: any) {
      setError(err?.message || 'Failed to load kitchen tickets');
    } finally {
      setLoading(false);
    }
  }, [activeStation]);

  // Initial fetch
  useEffect(() => {
    fetchTickets();
    getKitchenStations().then(setStations).catch(() => {});
  }, [fetchTickets]);

  // Polling fallback every 10 seconds (only when socket is not connected)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!socketConnected.current) {
        fetchTickets();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  // Elapsed time timer (updates every second)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Socket.IO real-time connection
  useEffect(() => {
    if (!restaurant?.id) return;
    const socket = connectSocket(restaurant.id);

    const handleKitchenEvent = () => {
      playNewOrderSound();
      fetchTickets();
    };

    socket.on('connect', () => { socketConnected.current = true; });
    socket.on('disconnect', () => { socketConnected.current = false; });
    socket.on('order:submitted-to-kitchen', handleKitchenEvent);
    socket.on('order:new', handleKitchenEvent);
    socket.on('kitchen:ticket-created', handleKitchenEvent);
    socket.on('kitchen:ticket-accepted', fetchTickets);
    socket.on('kitchen:ticket-preparing', fetchTickets);
    socket.on('kitchen:ticket-ready', fetchTickets);
    socket.on('order:waiter-assigned', fetchTickets);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('order:submitted-to-kitchen');
      socket.off('order:new');
      socket.off('kitchen:ticket-created');
      socket.off('kitchen:ticket-accepted');
      socket.off('kitchen:ticket-preparing');
      socket.off('kitchen:ticket-ready');
      socket.off('order:waiter-assigned');
      disconnectSocket();
    };
  }, [restaurant?.id, fetchTickets]);

  // Actions
  const handleAccept = async (ticketId: string) => {
    try {
      await acceptTicket(ticketId);
      fetchTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to accept ticket');
    }
  };

  const handlePrepare = async (ticketId: string) => {
    try {
      await startPreparing(ticketId);
      fetchTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to start preparing');
    }
  };

  const handleReady = async (ticket: KitchenTicket) => {
    try {
      const itemIds = ticket.items.map(item => item.orderItem.id);
      await markItemsReady(ticket.id, itemIds);
      fetchTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to mark items ready');
    }
  };

  // Group by station
  const grouped = groupByStation(tickets);
  const stationNames = Array.from(grouped.keys());

  // Total counts per status
  const newCount = tickets.filter(t => t.status === 'NEW').length;
  const preparingCount = tickets.filter(t => t.status === 'PREPARING' || t.status === 'ACCEPTED').length;
  const readyCount = tickets.filter(t => t.status === 'READY' || t.status === 'PARTIALLY_READY').length;

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Kitchen Display" description="Real-time kitchen order management" />
        <Loading size="lg" message="Connecting to kitchen..." />
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Kitchen Display" description="Real-time kitchen order management" />
        <ErrorState
          title="Failed to load kitchen"
          message={error}
          onRetry={fetchTickets}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Kitchen Display"
        description="Real-time kitchen order management"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={fetchTickets}
              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* Status summary bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">New</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{newCount}</p>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Preparing</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{preparingCount}</p>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">Ready</span>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{readyCount}</p>
        </div>
      </div>

      {/* Station tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveStation('all')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
            activeStation === 'all'
              ? 'bg-[var(--color-accent)] text-white shadow-md'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
          )}
        >
          All Stations ({tickets.length})
        </button>
        {stations.map((station) => {
          const count = tickets.filter(t => t.kitchenStation?.id === station.id).length;
          if (count === 0) return null;
          return (
            <button
              key={station.id}
              onClick={() => setActiveStation(station.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
                activeStation === station.id
                  ? 'bg-[var(--color-accent)] text-white shadow-md'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              )}
            >
              {station.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Error snackbar */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-sm text-red-500 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tickets by station */}
      {tickets.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<ChefHat className="h-16 w-16" />}
              title="Kitchen is clear"
              description="All orders have been prepared. New orders will appear here in real-time as waiters submit them."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {stationNames.map(stationName => {
            const stationTickets = grouped.get(stationName) || [];
            return (
              <section key={stationName}>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                  <ChefHatIcon className="h-5 w-5 text-[var(--color-accent)]" />
                  {stationName}
                  <span className="text-sm font-normal text-[var(--color-text-muted)]">
                    ({stationTickets.length} ticket{stationTickets.length !== 1 ? 's' : ''})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {stationTickets.map(ticket => (
                    <KitchenTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      now={now}
                      isChef={isChef}
                      onAccept={handleAccept}
                      onPrepare={handlePrepare}
                      onReady={handleReady}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KitchenTicketCard({
  ticket,
  now,
  isChef,
  onAccept,
  onPrepare,
  onReady,
}: {
  ticket: KitchenTicket;
  now: number;
  isChef: boolean;
  onAccept: (id: string) => void;
  onPrepare: (id: string) => void;
  onReady: (ticket: KitchenTicket) => void;
}) {
  const newTicket = ticket.status === 'NEW';
  const canAccept = newTicket;
  const canPrepare = ticket.status === 'ACCEPTED';
  const canMarkReady = ['ACCEPTED', 'PREPARING'].includes(ticket.status);

  // Elapsed time since submission
  const submittedAt = ticket.order.submittedAt || ticket.createdAt;
  const elapsed = formatElapsed(submittedAt);
  const elapsedMinutes = Math.floor((now - new Date(submittedAt).getTime()) / 60000);
  const isUrgent = elapsedMinutes >= 15;

  // Check if all items are ready
  const allItemsReady = ticket.items.every(item =>
    ['READY', 'SERVED'].includes(item.orderItem.status)
  );

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm transition-all duration-200 overflow-hidden',
        newTicket ? 'border-blue-300 dark:border-blue-700 shadow-lg ring-1 ring-blue-200 dark:ring-blue-800' :
          ticket.status === 'PREPARING' ? 'border-amber-300 dark:border-amber-700' :
            ticket.status === 'READY' || ticket.status === 'PARTIALLY_READY' ? 'border-green-200 dark:border-green-800' :
              'border-[var(--color-card-border)]',
        'bg-[var(--color-card-bg)] hover:shadow-md'
      )}
    >
      {/* Card header */}
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between gap-2',
        newTicket ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' :
          ticket.status === 'READY' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
            'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
            <span className="font-mono font-bold text-sm text-[var(--color-text-primary)] truncate">
              {ticket.ticketNumber}
            </span>
          </div>
          <Badge className={STATUS_COLORS[ticket.status] || ''}>
            {STATUS_LABELS[ticket.status] || ticket.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Timer className={cn(
            'h-4 w-4',
            isUrgent ? 'text-red-500 animate-pulse' : 'text-[var(--color-text-muted)]'
          )} />
          <span className={cn(
            'text-sm font-mono font-medium',
            isUrgent ? 'text-red-500' : 'text-[var(--color-text-secondary)]'
          )}>
            {elapsed}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Order info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span className="font-medium text-[var(--color-text-primary)]">
              {ticket.order.table ? `${ticket.order.table.name} (${ticket.order.table.code})` : 'Takeaway'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-primary)]">
              {ticket.order.waiter.firstName} {ticket.order.waiter.lastName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-primary)]">
              Order #{ticket.order.orderNumber}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={ticket.order.orderType === 'DINE_IN' ? 'info' : 'neutral'} className="text-[10px] px-1.5 py-0">
              {ticket.order.orderType?.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>

        {/* Order notes */}
        {ticket.order.notes && (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
            <MessageSquare className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-300">{ticket.order.notes}</span>
          </div>
        )}

        {/* Items list */}
        <div className="space-y-1.5">
          {ticket.items.map((item, i) => (
            <div
              key={item.orderItem.id}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg text-sm',
                item.orderItem.status === 'READY' || item.orderItem.status === 'SERVED'
                  ? 'bg-green-50 dark:bg-green-900/10'
                  : item.orderItem.status === 'PREPARING'
                    ? 'bg-amber-50 dark:bg-amber-900/10'
                    : 'bg-[var(--color-bg-secondary)]'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-[var(--color-text-muted)] w-5 shrink-0 text-right">
                  {item.orderItem.quantity}x
                </span>
                <span className="font-medium text-[var(--color-text-primary)] truncate">
                  {item.orderItem.menuItemNameSnapshot}
                </span>
                {item.orderItem.status === 'READY' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  item.orderItem.status === 'READY' || item.orderItem.status === 'SERVED'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : item.orderItem.status === 'PREPARING'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                )}>
                  {STATUS_LABELS[item.orderItem.status] || item.orderItem.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Special instructions */}
        {ticket.items.some(i => i.orderItem.specialInstructions) && (
          <div className="space-y-1">
            {ticket.items.filter(i => i.orderItem.specialInstructions).map(item => (
              <div key={`note-${item.orderItem.id}`} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                <span><strong>{item.orderItem.menuItemNameSnapshot}:</strong> {item.orderItem.specialInstructions}</span>
              </div>
            ))}
          </div>
        )}

        {/* Assigned chef */}
        {ticket.assignedChef && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)]">
            <ChefHatIcon className="h-3 w-3" />
            <span>Chef: {ticket.assignedChef.firstName} {ticket.assignedChef.lastName}</span>
          </div>
        )}

        {/* Action buttons (chef only) */}
        {isChef && (
          <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
            {canAccept && (
              <Button
                size="sm"
                variant="primary"
                className="flex-1"
                onClick={() => onAccept(ticket.id)}
              >
                <CheckCheck className="h-4 w-4" />
                Accept
              </Button>
            )}
            {canPrepare && (
              <Button
                size="sm"
                variant="primary"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={() => onPrepare(ticket.id)}
              >
                <PlayCircle className="h-4 w-4" />
                Preparing
              </Button>
            )}
            {canMarkReady && !allItemsReady && (
              <Button
                size="sm"
                variant="primary"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => onReady(ticket)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark All Ready
              </Button>
            )}
            {allItemsReady && ticket.status !== 'READY' && ticket.status !== 'PARTIALLY_READY' && (
              <Button
                size="sm"
                variant="primary"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => onReady(ticket)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Ready
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
