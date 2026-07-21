import api from './api';
import {
  getPendingActions,
  updateActionStatus,
  removeAction,
  type QueuedAction,
} from './offlineQueue';

export type SyncEventType = 'sync-started' | 'sync-progress' | 'sync-completed' | 'sync-error' | 'sync-empty';

export interface SyncEvent {
  type: SyncEventType;
  total?: number;
  completed?: number;
  failed?: number;
  action?: QueuedAction;
  error?: string;
}

type SyncListener = (event: SyncEvent) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private autoSyncEnabled = true;

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: SyncEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Silent
      }
    });
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  enableAutoSync(): void {
    if (this.syncInterval) return;
    this.autoSyncEnabled = true;
    // Check every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync().catch(() => {});
      }
    }, 30000);
  }

  disableAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.autoSyncEnabled = false;
  }

  async sync(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      this.notify({ type: 'sync-error', error: 'No internet connection' });
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;

    try {
      const actions = await getPendingActions();

      if (actions.length === 0) {
        this.notify({ type: 'sync-empty' });
        return { synced: 0, failed: 0 };
      }

      this.notify({ type: 'sync-started', total: actions.length });

      for (const action of actions) {
        await updateActionStatus(action.id, 'syncing');
        this.notify({ type: 'sync-progress', total: actions.length, completed: synced, failed, action });

        try {
          // Replay the API request
          await api({
            method: action.method as any,
            url: action.endpoint,
            data: action.body,
            headers: {
              ...action.headers,
              'X-Idempotency-Key': action.idempotencyKey,
            },
          });

          await removeAction(action.id);
          synced++;
          this.notify({ type: 'sync-progress', total: actions.length, completed: synced, failed, action });
        } catch (err: any) {
          failed++;

          // Check if it's a duplicate (409 Conflict) - treat as success
          if (err?.response?.status === 409) {
            await removeAction(action.id);
            synced++;
            continue;
          }

          // Check if it's a terminal error (don't retry 4xx except 429)
          const status = err?.response?.status;
          if (status && status >= 400 && status < 500 && status !== 429) {
            await updateActionStatus(action.id, 'failed', err?.response?.data?.message || err?.message);
          } else if (action.retryCount >= action.maxRetries) {
            await updateActionStatus(action.id, 'failed', 'Max retries exceeded');
          } else {
            // Will retry on next sync cycle
            await updateActionStatus(action.id, 'pending', err?.message);
          }

          this.notify({ type: 'sync-progress', total: actions.length, completed: synced, failed, action });
        }
      }

      this.notify({
        type: 'sync-completed',
        total: actions.length,
        completed: synced,
        failed,
      });
    } catch (err: any) {
      this.notify({ type: 'sync-error', error: err?.message || 'Sync failed' });
    } finally {
      this.isSyncing = false;
    }

    return { synced, failed };
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();

export function triggerSync(): Promise<{ synced: number; failed: number }> {
  return syncEngine.sync();
}
