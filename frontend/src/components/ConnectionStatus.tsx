import { useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getQueuedCount, clearCompletedActions } from '@/services/offlineQueue';
import { syncEngine, triggerSync, type SyncEvent } from '@/services/sync';
import { RefreshCw, Wifi, WifiOff, Cloud, CloudOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ConnectionStatus() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [visible, setVisible] = useState(false);

  // Track pending queue count
  const refreshCount = useCallback(async () => {
    const count = await getQueuedCount();
    setPendingCount(count);
  }, []);

  // Poll queue count every 5 seconds
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Subscribe to sync events
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'sync-started':
          setIsSyncing(true);
          setSyncResult({ type: 'success', message: `Syncing ${event.total} pending ${event.total === 1 ? 'action' : 'actions'}...` });
          setVisible(true);
          break;
        case 'sync-progress':
          if (event.total) {
            const done = (event.completed || 0) + (event.failed || 0);
            setSyncResult({ type: 'success', message: `Syncing... ${done}/${event.total}` });
          }
          break;
        case 'sync-completed':
          setIsSyncing(false);
          if (event.failed && event.failed > 0) {
            setSyncResult({ type: 'error', message: `Sync completed with ${event.failed} failure${event.failed > 1 ? 's' : ''}` });
          } else {
            setSyncResult({ type: 'success', message: `All ${event.completed} action${event.completed !== 1 ? 's' : ''} synced successfully` });
          }
          setVisible(true);
          refreshCount();
          setTimeout(() => setVisible(false), 5000);
          break;
        case 'sync-error':
          setIsSyncing(false);
          setSyncResult({ type: 'error', message: event.error || 'Sync failed' });
          break;
        case 'sync-empty':
          setIsSyncing(false);
          setVisible(false);
          break;
      }
    });

    return unsubscribe;
  }, [refreshCount]);

  // When coming back online, auto-trigger sync
  useEffect(() => {
    if (wasOffline && isOnline) {
      setVisible(true);
      setSyncResult({ type: 'success', message: 'Connection restored' });
      setTimeout(() => setVisible(false), 3000);
      // Start syncing
      triggerSync();
    }
  }, [wasOffline, isOnline]);

  // Handle manual sync
  const handleSync = async () => {
    setIsSyncing(true);
    await triggerSync();
  };

  const handleDismiss = () => {
    setVisible(false);
    setSyncResult(null);
  };

  if (!visible && isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${
        visible || !isOnline || pendingCount > 0 ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {!isOnline && (
        <div className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="font-medium truncate">You are offline</span>
            <span className="text-red-200 hidden sm:inline">
              {pendingCount > 0
                ? `· ${pendingCount} pending action${pendingCount !== 1 ? 's' : ''}`
                : '· Changes will sync when connection returns'}
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-[10px] font-bold">
                {pendingCount}
              </span>
            </span>
          )}
        </div>
      )}

      {isOnline && pendingCount > 0 && !syncResult && (
        <div className="bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Cloud className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="font-medium truncate">{pendingCount} pending action{pendingCount !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {syncResult && isOnline && (
        <div
          className={`px-4 py-2 flex items-center justify-between gap-3 text-sm ${
            syncResult.type === 'success'
              ? 'bg-green-600 dark:bg-green-700 text-white'
              : 'bg-red-600 dark:bg-red-700 text-white'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {syncResult.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{syncResult.message}</span>
            {isSyncing && <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />}
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white text-xs font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {isOnline && !pendingCount && !syncResult && wasOffline && (
        <div className="bg-green-600 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-xs">
          <Wifi className="h-3.5 w-3.5" />
          <span>Connection restored</span>
        </div>
      )}
    </div>
  );
}
