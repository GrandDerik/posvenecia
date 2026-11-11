/**
 * Servicio IndexedDB para Arquitectura Offline-First
 * Permite que el sistema POS funcione al 100% sin internet,
 * almacenando ventas, productos, gastos y una cola de sincronización.
 */

import { Sale, Product, Expense, OfflineSyncItem } from '../types';

const DB_NAME = 'PosVenecia_OfflineDB';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está soportado en este navegador'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('synced', 'synced', { unique: false });
      }
      if (!db.objectStoreNames.contains('app_state')) {
        db.createObjectStore('app_state', { keyPath: 'scope' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error al inicializar IndexedDB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Generic store transaction helper
const getStore = async (storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> => {
  const db = await initIndexedDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
};

// Sales methods
export const saveOfflineSale = async (sale: Sale): Promise<void> => {
  try {
    const store = await getStore('sales', 'readwrite');
    store.put(sale);
    // Also record in sync queue if not explicitly confirmed as synced
    if (sale.syncStatus !== 'synced') {
      await enqueueSyncItem({
        action: 'create_sale',
        payload: sale,
      });
    }
  } catch (err) {
    console.error('Error guardando venta offline:', err);
  }
};

export const getAllOfflineSales = async (): Promise<Sale[]> => {
  try {
    const store = await getStore('sales', 'readonly');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

// Products methods
export const saveOfflineProducts = async (products: Product[]): Promise<void> => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    for (const prod of products) {
      store.put(prod);
    }
  } catch (err) {
    console.error('Error guardando productos en IndexedDB:', err);
  }
};

export const getAllOfflineProducts = async (): Promise<Product[]> => {
  try {
    const store = await getStore('products', 'readonly');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

// Expenses methods
export const saveOfflineExpense = async (expense: Expense): Promise<void> => {
  try {
    const store = await getStore('expenses', 'readwrite');
    store.put(expense);
    if (expense.syncStatus === 'pending_sync') {
      await enqueueSyncItem({
        action: 'create_expense',
        payload: expense,
      });
    }
  } catch (err) {
    console.error('Error guardando gasto offline:', err);
  }
};

// Sync Queue methods
export const enqueueSyncItem = async (
  item: { action: OfflineSyncItem['action']; payload: any }
): Promise<OfflineSyncItem> => {
  const syncItem: OfflineSyncItem = {
    id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: item.action,
    payload: item.payload,
    timestamp: new Date().toISOString(),
    synced: false,
  };

  try {
    const store = await getStore('sync_queue', 'readwrite');
    store.put(syncItem);
  } catch (err) {
    console.error('Error encolando acción offline:', err);
  }

  return syncItem;
};

export const getPendingSyncQueue = async (): Promise<OfflineSyncItem[]> => {
  try {
    const store = await getStore('sync_queue', 'readonly');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const all: OfflineSyncItem[] = request.result || [];
        resolve(all.filter((i) => !i.synced));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

export const markSyncItemDone = async (id: string): Promise<void> => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        const updated = { ...getReq.result, synced: true };
        store.put(updated);
      }
    };
  } catch (err) {
    console.error('Error marcando elemento sincronizado:', err);
  }
};

export const clearSyncedQueue = async (): Promise<void> => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const getReq = store.getAll();
    getReq.onsuccess = () => {
      const items: OfflineSyncItem[] = getReq.result || [];
      for (const item of items) {
        if (item.synced) {
          store.delete(item.id);
        }
      }
    };
  } catch (err) {
    console.error('Error limpiando cola:', err);
  }
};

/**
 * Primary Robust Local Storage (IndexedDB):
 * Capable of holding hundreds of MBs without QuotaExceededError
 */
export const saveAppStateToIndexedDB = async (scope: string, data: any): Promise<void> => {
  try {
    const store = await getStore('app_state', 'readwrite');
    store.put({ scope, data, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Error guardando estado en IndexedDB:', err);
  }
};

export const loadAppStateFromIndexedDB = async (scope: string): Promise<any | null> => {
  try {
    const store = await getStore('app_state', 'readonly');
    return new Promise((resolve) => {
      const request = store.get(scope);
      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

/**
 * Elimina en un único lote atómico los elementos sincronizados de la cola
 */
export const batchClearSyncQueue = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  try {
    const db = await initIndexedDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    for (const id of ids) {
      store.delete(id);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error en batch delete de cola offline:', err);
  }
};

/**
 * Elimina un elemento de la cola de sincronización buscando por el ID de la venta
 */
export const removeSyncItemBySaleId = async (saleId: string): Promise<void> => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const req = store.getAll();
    req.onsuccess = () => {
      const items: OfflineSyncItem[] = req.result || [];
      for (const item of items) {
        if (item.action === 'create_sale' && item.payload?.id === saleId) {
          store.delete(item.id);
        }
      }
    };
  } catch (err) {
    console.error('Error removing sync item by saleId:', err);
  }
};

/**
 * Función que sincroniza los elementos pendientes generados sin conexión:
 * Recibe un ejecutor real de sincronización con Google Drive (onExecuteSync).
 * Procesa la sincronización en un único lote (batch) en vez de N llamadas independientes.
 */
export const syncPendingOfflineData = async (
  onExecuteSync?: () => Promise<boolean>
): Promise<{ count: number; success: boolean }> => {
  const pending = await getPendingSyncQueue();
  if (pending.length === 0) return { count: 0, success: true };

  // Ejecución en lote único hacia Google Drive
  if (onExecuteSync) {
    const cloudSyncSuccess = await onExecuteSync();
    if (!cloudSyncSuccess) {
      console.warn('Sincronización con Google Drive falló o está pendiente; conservando cola offline.');
      return { count: pending.length, success: false };
    }
  }

  // Limpieza en un único lote de IndexedDB
  await batchClearSyncQueue(pending.map(i => i.id));
  return { count: pending.length, success: true };
};
