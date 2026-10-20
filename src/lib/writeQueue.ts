// Durable store for writes that failed because the client was offline, so
// they survive a page reload/app close and can be replayed once connectivity
// returns (see dataManager.ts's performWrite/flushWriteQueue). IndexedDB
// rather than localStorage since entries need structured values (arrays of
// SetEntry, etc.), not just strings.
const DB_NAME = 'onyx-write-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending';

export interface QueuedWrite {
  id: number;
  type: string;
  args: unknown[];
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
};

export const enqueueWrite = async (type: string, args: unknown[]): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ type, args, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Resolves in insertion order (ascending auto-incremented id), so callers
// can replay writes in the order they were originally made.
export const getQueuedWrites = async (): Promise<QueuedWrite[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedWrite[]);
    request.onerror = () => reject(request.error);
  });
};

export const removeQueuedWrite = async (id: number): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getQueuedWriteCount = async (): Promise<number> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
