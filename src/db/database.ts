import { openDB, type IDBPDatabase } from 'idb';

/**
 * Storage abstraction over IndexedDB.
 *
 * Every collection is its own object store keyed by `id`, so writes stay
 * surgical (updating one note never rewrites the whole database).
 *
 * If IndexedDB is unavailable — private browsing modes, hardened browser
 * settings, storage quotas — the layer transparently falls back to an
 * in-memory map. The app keeps working for the session and the UI surfaces a
 * persistence warning instead of crashing.
 */

export const DB_NAME = 'devops-learning-os';
export const DB_VERSION = 1;

export const COLLECTIONS = [
  'courses',
  'topics',
  'tasks',
  'projects',
  'notes',
  'sessions',
  'revisions',
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export interface StoredRecord {
  id: string;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

interface DatabaseState {
  db: IDBPDatabase | null;
  available: boolean;
  memory: Map<CollectionName, Map<string, StoredRecord>>;
  openError: string | null;
}

const state: DatabaseState = {
  db: null,
  available: typeof indexedDB !== 'undefined',
  memory: new Map(),
  openError: null,
};

let openPromise: Promise<IDBPDatabase | null> | null = null;

function memoryStore(collection: CollectionName): Map<string, StoredRecord> {
  let store = state.memory.get(collection);
  if (!store) {
    store = new Map();
    state.memory.set(collection, store);
  }
  return store;
}

async function openDatabase(): Promise<IDBPDatabase | null> {
  if (!state.available) return null;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
          for (const collection of COLLECTIONS) {
            if (!database.objectStoreNames.contains(collection)) {
              database.createObjectStore(collection, { keyPath: 'id' });
            }
          }
        },
        blocked() {
          state.openError = 'Another tab is holding an older version of the database open.';
        },
        blocking() {
          state.openError = 'A newer version of the app is open in another tab.';
        },
        terminated() {
          state.db = null;
          openPromise = null;
          state.openError = 'The browser terminated the database connection unexpectedly.';
        },
      });
      state.db = db;
      return db;
    } catch (error) {
      state.available = false;
      state.openError = error instanceof Error ? error.message : 'IndexedDB is unavailable';
      console.warn('[devops-os] IndexedDB unavailable, using in-memory storage.', error);
      return null;
    }
  })();

  return openPromise;
}

/** True when writes are landing in IndexedDB rather than the memory fallback. */
export function isPersistent(): boolean {
  return state.available && state.db !== null;
}

export function getStorageWarning(): string | null {
  if (!state.available) {
    return 'This browser blocked IndexedDB, so changes are only kept for this session. Export a backup to keep your progress.';
  }
  return state.openError;
}

export const storage = {
  async init(): Promise<void> {
    await openDatabase();
  },

  async getAll<T extends StoredRecord>(collection: CollectionName): Promise<T[]> {
    const db = await openDatabase();
    if (!db) return Array.from(memoryStore(collection).values()) as T[];
    try {
      return (await db.getAll(collection)) as T[];
    } catch (error) {
      throw new StorageError(`Failed to read ${collection}`, { cause: error });
    }
  },

  async put<T extends StoredRecord>(collection: CollectionName, value: T): Promise<void> {
    const db = await openDatabase();
    if (!db) {
      memoryStore(collection).set(value.id, value);
      return;
    }
    try {
      await db.put(collection, value);
    } catch (error) {
      throw new StorageError(`Failed to save to ${collection}`, { cause: error });
    }
  },

  async putMany<T extends StoredRecord>(collection: CollectionName, values: T[]): Promise<void> {
    if (!values.length) return;
    const db = await openDatabase();
    if (!db) {
      for (const value of values) memoryStore(collection).set(value.id, value);
      return;
    }
    try {
      const transaction = db.transaction(collection, 'readwrite');
      await Promise.all([...values.map((value) => transaction.store.put(value)), transaction.done]);
    } catch (error) {
      throw new StorageError(`Failed to save ${values.length} records to ${collection}`, { cause: error });
    }
  },

  async remove(collection: CollectionName, id: string): Promise<void> {
    const db = await openDatabase();
    if (!db) {
      memoryStore(collection).delete(id);
      return;
    }
    try {
      await db.delete(collection, id);
    } catch (error) {
      throw new StorageError(`Failed to delete from ${collection}`, { cause: error });
    }
  },

  async clear(collection: CollectionName): Promise<void> {
    const db = await openDatabase();
    if (!db) {
      memoryStore(collection).clear();
      return;
    }
    try {
      await db.clear(collection);
    } catch (error) {
      throw new StorageError(`Failed to clear ${collection}`, { cause: error });
    }
  },

  async clearAll(): Promise<void> {
    for (const collection of COLLECTIONS) {
      await this.clear(collection);
    }
  },

  async replaceAll(data: Partial<Record<CollectionName, StoredRecord[]>>): Promise<void> {
    for (const collection of COLLECTIONS) {
      await this.clear(collection);
      const records = data[collection];
      if (records?.length) await this.putMany(collection, records);
    }
  },

  async readAll(): Promise<Record<CollectionName, StoredRecord[]>> {
    const entries = await Promise.all(
      COLLECTIONS.map(async (collection) => [collection, await this.getAll(collection)] as const),
    );
    return Object.fromEntries(entries) as Record<CollectionName, StoredRecord[]>;
  },

  /** Best-effort storage estimate; returns `null` when the API is missing. */
  async estimate(): Promise<{ usage: number; quota: number } | null> {
    try {
      if (!navigator.storage?.estimate) return null;
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    } catch {
      return null;
    }
  },

  /** Wipes the whole IndexedDB database (used by "Reset application"). */
  async destroy(): Promise<void> {
    state.db?.close();
    state.db = null;
    openPromise = null;
    state.memory.clear();
    if (typeof indexedDB === 'undefined') return;
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  },
};
