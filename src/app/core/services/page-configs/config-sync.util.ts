import { signal } from '@angular/core';

/**
 * Cross-frame and Database customizer sync for Loxxking.
 *
 * 1. Pushes changes between the dashboard and preview <iframe> via postMessage & StorageEvent.
 * 2. Persists every configuration change directly into SQL Server via /api/page-configurations.
 * 3. On application startup, loads the latest configurations from the database as source of truth.
 */

/** Identifies this window's service instances so they ignore their own broadcasts. */
export const CONFIG_SYNC_INSTANCE_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);

interface SyncMessage {
  type: 'STORAGE_SYNC';
  key: string;
  newValue: string;
  __sourceInstanceId: string;
}

/**
 * Headers for authenticated page-configuration writes.
 * These raw fetch() calls bypass Angular's HttpClient, so the auth-token
 * interceptor never runs — attach the admin JWT here. The write endpoints
 * require Admin/StoreManager; a viewer without a token is (correctly) rejected.
 */
function pageConfigWriteHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('lk-auth-token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // localStorage may be unavailable (SSR / privacy mode); send without auth.
  }
  return headers;
}

/** Observable signal of the database save status for UI display */
export type DbSyncStatus = 'idle' | 'saving' | 'saved' | 'error';
export const dbSyncStatus = signal<DbSyncStatus>('idle');

/** Registered in-memory listeners per storage key */
const registeredListeners = new Map<string, Set<(json: string) => void>>();

/** Timers for debounced network persistence */
const debounceTimers = new Map<string, any>();

/** Tracks if initial database sync has completed */
let isDatabaseSynced = false;

/** Persists a config to localStorage, broadcasts across iframes, and saves to Database */
export function broadcastConfig(key: string, json: string): void {
  if (typeof window === 'undefined') return;

  // 1. Instant local persistence
  try {
    localStorage.setItem(key, json);
  } catch (_) {}

  // 2. Broadcast to iframe preview and parent frame
  const message: SyncMessage = {
    type: 'STORAGE_SYNC',
    key,
    newValue: json,
    __sourceInstanceId: CONFIG_SYNC_INSTANCE_ID
  };

  try {
    const event = new StorageEvent('storage', { key, newValue: json, storageArea: localStorage });
    (event as any).__sourceInstanceId = CONFIG_SYNC_INSTANCE_ID;
    window.dispatchEvent(event);

    // Down into every preview iframe (dashboard -> storefront preview).
    document.querySelectorAll('iframe').forEach(frame => {
      try {
        frame.contentWindow?.dispatchEvent(event);
        frame.contentWindow?.postMessage(message, '*');
      } catch (_) {}
    });

    // Up to the host page (storefront preview -> dashboard).
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(message, '*');
      } catch (_) {}
    }
  } catch (_) {}

  // 3. Debounced save to Database (SQL Server via /api/page-configurations)
  queueDatabaseSave(key, json);
}

/** Subscribes to config changes for `key` */
export function listenForConfig(key: string, apply: (json: string) => void): () => void {
  if (!registeredListeners.has(key)) {
    registeredListeners.set(key, new Set());
  }
  registeredListeners.get(key)!.add(apply);

  if (typeof window === 'undefined') return () => {};

  const handle = (eventKey: string | null, value: string | null, sourceId?: string) => {
    if (sourceId === CONFIG_SYNC_INSTANCE_ID) return;
    if (eventKey !== key || !value) return;
    apply(value);
  };

  const storageHandler = (e: StorageEvent) => {
    handle(e.key, e.newValue, (e as any).__sourceInstanceId);
  };

  const messageHandler = (e: MessageEvent) => {
    const data = e.data as SyncMessage | undefined;
    if (data?.type !== 'STORAGE_SYNC') return;
    handle(data.key, data.newValue, data.__sourceInstanceId);
  };

  window.addEventListener('storage', storageHandler);
  window.addEventListener('message', messageHandler);

  return () => {
    registeredListeners.get(key)?.delete(apply);
    window.removeEventListener('storage', storageHandler);
    window.removeEventListener('message', messageHandler);
  };
}

/** Debounces network saves per key (400ms) to ensure smooth typing while guaranteeing DB persistence */
function queueDatabaseSave(key: string, json: string): void {
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }

  dbSyncStatus.set('saving');

  const timer = setTimeout(async () => {
    debounceTimers.delete(key);
    try {
      const response = await fetch(`/api/page-configurations/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: pageConfigWriteHeaders(),
        body: JSON.stringify({ configJson: json })
      });

      if (response.ok) {
        dbSyncStatus.set('saved');
        setTimeout(() => {
          if (dbSyncStatus() === 'saved') {
            dbSyncStatus.set('idle');
          }
        }, 2000);
      } else {
        console.warn(`[PageConfig] Failed to save '${key}' to database (Status ${response.status}).`);
        dbSyncStatus.set('error');
      }
    } catch (err) {
      console.warn(`[PageConfig] Network error saving '${key}' to database:`, err);
      dbSyncStatus.set('error');
    }
  }, 400);

  debounceTimers.set(key, timer);
}

/**
 * Loads all configurations from the database on startup.
 * If local configs exist that aren't yet in DB, migrates them to DB automatically.
 */
export async function syncConfigsWithDatabase(): Promise<void> {
  if (typeof window === 'undefined' || isDatabaseSynced) return;

  try {
    const res = await fetch('/api/page-configurations');
    if (!res.ok) return;

    const body = await res.json();
    const dbConfigs: Record<string, string> = body?.data || {};

    const dbKeys = Object.keys(dbConfigs);

    // Apply DB values to localStorage and active subscribers
    for (const key of dbKeys) {
      const dbJson = dbConfigs[key];
      if (!dbJson) continue;

      try {
        localStorage.setItem(key, dbJson);
      } catch (_) {}

      // Notify any registered listeners
      const listeners = registeredListeners.get(key);
      if (listeners && listeners.size > 0) {
        listeners.forEach(apply => {
          try {
            apply(dbJson);
          } catch (_) {}
        });
      }
    }

    // Check if there are local configs in browser that should be seeded to the database
    const localConfigsToUpload: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('loxxking-') && !dbConfigs[k]) {
        const val = localStorage.getItem(k);
        if (val && val.startsWith('{') && val.length > 5) {
          localConfigsToUpload[k] = val;
        }
      }
    }

    if (Object.keys(localConfigsToUpload).length > 0) {
      fetch('/api/page-configurations/batch', {
        method: 'POST',
        headers: pageConfigWriteHeaders(),
        body: JSON.stringify({ configs: localConfigsToUpload })
      }).catch(() => {});
    }

    isDatabaseSynced = true;
    dbSyncStatus.set('idle');
  } catch (err) {
    console.warn('[PageConfig] Initial database config fetch failed, using local cache:', err);
  }
}

/** Forces an immediate synchronous flush of all local configs to the database */
export async function forceSaveAllConfigsToDatabase(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  dbSyncStatus.set('saving');
  const allConfigs: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('loxxking-')) {
      const val = localStorage.getItem(k);
      if (val && val.startsWith('{')) {
        allConfigs[k] = val;
      }
    }
  }

  try {
    const res = await fetch('/api/page-configurations/batch', {
      method: 'POST',
      headers: pageConfigWriteHeaders(),
      body: JSON.stringify({ configs: allConfigs })
    });

    if (res.ok) {
      dbSyncStatus.set('saved');
      setTimeout(() => {
        if (dbSyncStatus() === 'saved') dbSyncStatus.set('idle');
      }, 2500);
      return true;
    } else {
      dbSyncStatus.set('error');
      return false;
    }
  } catch (err) {
    dbSyncStatus.set('error');
    return false;
  }
}
