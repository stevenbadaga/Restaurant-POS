// Offline Action Queue
// Stores failed API mutations for later sync when connection is restored

export interface QueuedAction {
  id: string;
  idempotencyKey: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  method: string;
  body: any;
  headers: Record<string, string>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

const DB_NAME = 'restaurant-pos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'actionQueue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<string> {
  const db = await openDB();
  const id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Check for duplicate idempotency key
    const index = store.index('idempotencyKey');
    const keyCheck = index.getKey(action.idempotencyKey);

    keyCheck.onsuccess = () => {
      if (keyCheck.result) {
        // Already queued with this key - return existing
        resolve(keyCheck.result as string);
        return;
      }

      const record: QueuedAction = {
        ...action,
        id,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      const request = store.add(record);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    };

    transaction.oncomplete = () => db.close();
  });
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onsuccess = () => {
      const results = request.result || [];
      // Sort by createdAt ascending (oldest first)
      results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function updateActionStatus(
  id: string,
  status: QueuedAction['status'],
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (!action) {
        resolve();
        return;
      }
      action.status = status;
      if (error) action.error = error;
      if (status === 'syncing') action.retryCount += 1;
      store.put(action);
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function removeAction(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function getQueuedCount(): Promise<number> {
  try {
    const actions = await getPendingActions();
    return actions.length;
  } catch {
    return 0;
  }
}

export async function clearCompletedActions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.openCursor('completed');

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
