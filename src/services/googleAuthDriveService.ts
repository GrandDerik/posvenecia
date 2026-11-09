import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebaseConfig';
import { 
  Product, 
  Sale, 
  Expense, 
  FiadoRecord, 
  CuentaPorPagar, 
  GastoOperativo, 
  Client, 
  BusinessInfo,
  CashShift
} from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Provider with Drive scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.setCustomParameters({
  prompt: 'select_account'
});

// In-memory token cache (Do NOT store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let tokenAcquiredTimestamp: number = 0;
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes (Google tokens expire at 60 mins)
let isSigningIn = false;

export class GoogleDriveAuthError extends Error {
  isExpired: boolean;
  constructor(message: string, isExpired: boolean = true) {
    super(message);
    this.name = 'GoogleDriveAuthError';
    this.isExpired = isExpired;
  }
}

export class PreconditionFailedError extends Error {
  constructor(message = 'Conflicto multi-dispositivo detectado (412 Precondition Failed). Se ejecutará un merge inteligente.') {
    super(message);
    this.name = 'PreconditionFailedError';
  }
}

export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    let release: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previousPromise = this.queue;
    this.queue = this.queue.then(() => waitPromise);

    await previousPromise;
    try {
      return await task();
    } finally {
      release!();
    }
  }
}

export const driveSyncMutex = new AsyncMutex();

export const isGoogleTokenExpired = (): boolean => {
  if (!cachedAccessToken) return true;
  return Date.now() - tokenAcquiredTimestamp >= TOKEN_TTL_MS;
};

export interface DatabaseTombstones {
  deletedProductIds?: string[];
  deletedClientIds?: string[];
  canceledSaleIds?: string[];
  deletedExpenseIds?: string[];
  deletedCuentaIds?: string[];
  deletedGastoIds?: string[];
}

export interface AppDatabasePayload {
  version: string;
  updatedAt: string;
  userEmail: string;
  userUid: string;
  businessInfo: BusinessInfo;
  bcvRate: number;
  bcvEuroRate: number;
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  fiados: FiadoRecord[];
  cuentasPorPagar: CuentaPorPagar[];
  gastosOperativos: GastoOperativo[];
  clients: Client[];
  cashShift?: CashShift | null;
  cashShiftHistory?: CashShift[];
  tombstones?: DatabaseTombstones;
}

export interface ReadDatabaseResult {
  data: AppDatabasePayload;
  etag: string | null;
}

/**
 * Initialize Auth listener
 */
export const initAuth = (
  onUserChanged: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onUserChanged(user, cachedAccessToken);
    } else if (!user) {
      cachedAccessToken = null;
      tokenAcquiredTimestamp = 0;
      onUserChanged(null, null);
    } else {
      // User is logged in via Firebase session but token needs refresh or prompt
      onUserChanged(user, cachedAccessToken);
    }
  });
};

/**
 * Trigger official Google Sign-In with popup
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('No se pudo obtener el token de acceso de Google');
    }

    cachedAccessToken = token;
    tokenAcquiredTimestamp = Date.now();
    return { user: result.user, accessToken: token };
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Renews the Google OAuth access token
 */
export const renewGoogleToken = async (): Promise<string> => {
  const { accessToken } = await signInWithGoogle();
  return accessToken;
};

/**
 * Get current in-memory access token
 */
export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Set or refresh in-memory access token
 */
export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  tokenAcquiredTimestamp = token ? Date.now() : 0;
};

/**
 * Log out from Firebase and clear tokens
 */
export const logOutGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  tokenAcquiredTimestamp = 0;
};

// Database filename in user's Google Drive
const DB_FILE_NAME = 'posvenecia_database.json';

/**
 * Search for posvenecia_database.json in user's Drive (appDataFolder or standard drive space)
 */
export const findDriveDatabaseFile = async (accessToken: string): Promise<string | null> => {
  // First search in appDataFolder (private per-user application storage)
  const appDataQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
  const appDataUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${appDataQuery}&fields=files(id,name,modifiedTime)`;

  try {
    const res = await fetch(appDataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (e) {
    console.warn('Error searching appDataFolder:', e);
  }

  // Fallback search in user files created by this app
  try {
    const driveQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${driveQuery}&fields=files(id,name,modifiedTime)`;
    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (e) {
    console.warn('Error searching drive files:', e);
  }

  return null;
};

/**
 * Get remote database metadata (fileId, modifiedTime, and etag) for multi-device sync
 */
export const getRemoteDatabaseMetadata = async (
  accessToken: string
): Promise<{ fileId: string; modifiedTime?: string; etag?: string } | null> => {
  const appDataQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
  const appDataUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${appDataQuery}&fields=files(id,name,modifiedTime,etag)`;

  try {
    const res = await fetch(appDataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return { 
          fileId: data.files[0].id, 
          modifiedTime: data.files[0].modifiedTime,
          etag: data.files[0].etag
        };
      }
    }
  } catch (e) {
    console.warn('Error fetching appDataFolder metadata:', e);
  }

  try {
    const driveQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${driveQuery}&fields=files(id,name,modifiedTime,etag)`;
    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return { 
          fileId: data.files[0].id, 
          modifiedTime: data.files[0].modifiedTime,
          etag: data.files[0].etag
        };
      }
    }
  } catch (e) {
    console.warn('Error fetching drive metadata:', e);
  }

  return null;
};

/**
 * Read posvenecia_database.json from user's Google Drive with ETag
 */
export const readDatabaseFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<ReadDatabaseResult | null> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.status === 401) {
    throw new GoogleDriveAuthError('Token de Google Drive expirado o no autorizado (401)', true);
  }
  if (!res.ok) {
    throw new Error(`Error al leer archivo de Google Drive (${res.status})`);
  }

  const etag = res.headers.get('ETag') || null;
  const json = await res.json();
  return {
    data: json as AppDatabasePayload,
    etag
  };
};

/**
 * Save / Upload posvenecia_database.json to user's Google Drive (create or update with optimistic concurrency ETag)
 */
export const saveDatabaseToDrive = async (
  accessToken: string,
  payload: AppDatabasePayload,
  existingFileId?: string | null,
  expectedEtag?: string | null
): Promise<{ fileId: string; modifiedTime: string; etag: string | null }> => {
  const fileContent = JSON.stringify(payload, null, 2);
  let fileId = existingFileId || await findDriveDatabaseFile(accessToken);

  if (fileId) {
    // Update existing file (PATCH) with If-Match concurrency guard
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    if (expectedEtag) {
      headers['If-Match'] = expectedEtag;
    }

    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers,
      body: fileContent
    });

    if (res.status === 401) {
      throw new GoogleDriveAuthError('Token de Google Drive expirado o no autorizado (401)', true);
    }
    if (res.status === 412 || res.status === 409) {
      throw new PreconditionFailedError();
    }
    if (!res.ok) {
      throw new Error(`Error al actualizar base de datos en Google Drive (${res.status})`);
    }

    const result = await res.json().catch(() => ({}));
    const newEtag = res.headers.get('ETag') || result.etag || null;

    return {
      fileId,
      modifiedTime: result.modifiedTime || new Date().toISOString(),
      etag: newEtag
    };
  } else {
    // Create new file in appDataFolder (POST multipart)
    const metadata = {
      name: DB_FILE_NAME,
      mimeType: 'application/json',
      parents: ['appDataFolder'],
      description: 'Base de datos privada y sincronizada del sistema PosVenecia'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelim;

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,etag';
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (res.status === 401) {
      throw new GoogleDriveAuthError('Token de Google Drive expirado o no autorizado (401)', true);
    }
    if (!res.ok) {
      // If appDataFolder parent fails, fallback to root drive file creation
      const fallbackMeta = {
        name: DB_FILE_NAME,
        mimeType: 'application/json',
        description: 'Base de datos privada y sincronizada del sistema PosVenecia'
      };
      const fallbackBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fallbackMeta) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelim;

      const fallbackRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: fallbackBody
      });

      if (fallbackRes.status === 401) {
        throw new GoogleDriveAuthError('Token de Google Drive expirado o no autorizado (401)', true);
      }
      if (!fallbackRes.ok) {
        throw new Error(`Error al crear archivo en Google Drive (${fallbackRes.status})`);
      }

      const fbResult = await fallbackRes.json();
      return {
        fileId: fbResult.id,
        modifiedTime: fbResult.modifiedTime || new Date().toISOString(),
        etag: fallbackRes.headers.get('ETag') || fbResult.etag || null
      };
    }

    const result = await res.json();
    return {
      fileId: result.id,
      modifiedTime: result.modifiedTime || new Date().toISOString(),
      etag: res.headers.get('ETag') || result.etag || null
    };
  }
};

/**
 * Intelligent 3-way merge by ID with tombstones for multi-device concurrency.
 * Ensures sales from both registers are preserved, canceled sales stay canceled,
 * and stock/products do not get wiped out.
 */
export const mergeDatabasePayloads = (
  local: AppDatabasePayload,
  remote: AppDatabasePayload
): AppDatabasePayload => {
  // 1. Tombstone consolidation
  const deletedProductIds = new Set([
    ...(local.tombstones?.deletedProductIds || []),
    ...(remote.tombstones?.deletedProductIds || [])
  ]);
  const canceledSaleIds = new Set([
    ...(local.tombstones?.canceledSaleIds || []),
    ...(remote.tombstones?.canceledSaleIds || [])
  ]);
  const deletedExpenseIds = new Set([
    ...(local.tombstones?.deletedExpenseIds || []),
    ...(remote.tombstones?.deletedExpenseIds || [])
  ]);
  const deletedClientIds = new Set([
    ...(local.tombstones?.deletedClientIds || []),
    ...(remote.tombstones?.deletedClientIds || [])
  ]);
  const deletedCuentaIds = new Set([
    ...(local.tombstones?.deletedCuentaIds || []),
    ...(remote.tombstones?.deletedCuentaIds || [])
  ]);
  const deletedGastoIds = new Set([
    ...(local.tombstones?.deletedGastoIds || []),
    ...(remote.tombstones?.deletedGastoIds || [])
  ]);

  // 2. Merge Products
  const productsMap = new Map<string, Product>();
  (remote.products || []).forEach(p => {
    if (!deletedProductIds.has(p.id)) {
      productsMap.set(p.id, p);
    }
  });
  (local.products || []).forEach(p => {
    if (!deletedProductIds.has(p.id)) {
      // If exists in both, keep local modifications
      productsMap.set(p.id, p);
    }
  });
  const mergedProducts = Array.from(productsMap.values());

  // 3. Merge Sales (Never lose sales from Register 1 or Register 2)
  const salesMap = new Map<string, Sale>();
  (remote.sales || []).forEach(s => {
    salesMap.set(s.id, {
      ...s,
      status: canceledSaleIds.has(s.id) ? 'anulada' : s.status
    });
  });
  (local.sales || []).forEach(s => {
    const existing = salesMap.get(s.id);
    const isCanceled = canceledSaleIds.has(s.id) || s.status === 'anulada' || existing?.status === 'anulada';
    salesMap.set(s.id, {
      ...(existing || s),
      ...s,
      status: isCanceled ? 'anulada' : (s.status || 'completada')
    });
  });
  const mergedSales = Array.from(salesMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 4. Merge Expenses
  const expensesMap = new Map<string, Expense>();
  (remote.expenses || []).forEach(e => {
    if (!deletedExpenseIds.has(e.id)) {
      expensesMap.set(e.id, e);
    }
  });
  (local.expenses || []).forEach(e => {
    if (!deletedExpenseIds.has(e.id)) {
      expensesMap.set(e.id, e);
    }
  });
  const mergedExpenses = Array.from(expensesMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 5. Merge Fiados
  const fiadosMap = new Map<string, FiadoRecord>();
  (remote.fiados || []).forEach(f => fiadosMap.set(f.id, f));
  (local.fiados || []).forEach(f => {
    const remoteFiado = fiadosMap.get(f.id);
    if (!remoteFiado) {
      fiadosMap.set(f.id, f);
    } else {
      // Pick the fiado with lowest remaining debt (most paid) or newer abonos
      const localAbonosCount = f.abonos?.length || 0;
      const remoteAbonosCount = remoteFiado.abonos?.length || 0;
      fiadosMap.set(f.id, localAbonosCount >= remoteAbonosCount ? f : remoteFiado);
    }
  });
  const mergedFiados = Array.from(fiadosMap.values());

  // 6. Merge Clients
  const clientsMap = new Map<string, Client>();
  (remote.clients || []).forEach(c => {
    if (!deletedClientIds.has(c.id)) clientsMap.set(c.id, c);
  });
  (local.clients || []).forEach(c => {
    if (!deletedClientIds.has(c.id)) clientsMap.set(c.id, c);
  });
  const mergedClients = Array.from(clientsMap.values());

  // 7. Merge Cuentas Por Pagar
  const cppMap = new Map<string, CuentaPorPagar>();
  (remote.cuentasPorPagar || []).forEach(cpp => {
    if (!deletedCuentaIds.has(cpp.id)) cppMap.set(cpp.id, cpp);
  });
  (local.cuentasPorPagar || []).forEach(cpp => {
    if (!deletedCuentaIds.has(cpp.id)) {
      const existing = cppMap.get(cpp.id);
      if (!existing || (cpp.abonos?.length || 0) >= (existing.abonos?.length || 0)) {
        cppMap.set(cpp.id, cpp);
      }
    }
  });
  const mergedCPP = Array.from(cppMap.values());

  // 8. Merge Gastos Operativos
  const gastosMap = new Map<string, GastoOperativo>();
  (remote.gastosOperativos || []).forEach(g => {
    if (!deletedGastoIds.has(g.id)) gastosMap.set(g.id, g);
  });
  (local.gastosOperativos || []).forEach(g => {
    if (!deletedGastoIds.has(g.id)) gastosMap.set(g.id, g);
  });
  const mergedGastos = Array.from(gastosMap.values());

  // 9. Merge CashShift & CashShiftHistory
  const historyMap = new Map<string, CashShift>();
  (remote.cashShiftHistory || []).forEach(h => historyMap.set(h.id, h));
  (local.cashShiftHistory || []).forEach(h => {
    const existing = historyMap.get(h.id);
    if (!existing || (!existing.isOpen && !h.isOpen)) {
      historyMap.set(h.id, h);
    }
  });
  const mergedShiftHistory = Array.from(historyMap.values()).sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
  );

  // Active Cash Shift: keep local active shift if open, or remote if local is closed and remote is open
  let activeShift: CashShift | null = null;
  if (local.cashShift && local.cashShift.isOpen) {
    activeShift = local.cashShift;
  } else if (remote.cashShift && remote.cashShift.isOpen) {
    activeShift = remote.cashShift;
  } else {
    activeShift = local.cashShift || remote.cashShift || null;
  }

  // 10. Final payload with combined tombstones
  return {
    version: '2.1',
    updatedAt: new Date().toISOString(),
    userEmail: local.userEmail || remote.userEmail,
    userUid: local.userUid || remote.userUid,
    businessInfo: local.businessInfo || remote.businessInfo,
    bcvRate: local.bcvRate || remote.bcvRate,
    bcvEuroRate: local.bcvEuroRate || remote.bcvEuroRate,
    products: mergedProducts,
    sales: mergedSales,
    expenses: mergedExpenses,
    fiados: mergedFiados,
    clients: mergedClients,
    cuentasPorPagar: mergedCPP,
    gastosOperativos: mergedGastos,
    cashShift: activeShift,
    cashShiftHistory: mergedShiftHistory,
    tombstones: {
      deletedProductIds: Array.from(deletedProductIds),
      canceledSaleIds: Array.from(canceledSaleIds),
      deletedExpenseIds: Array.from(deletedExpenseIds),
      deletedClientIds: Array.from(deletedClientIds),
      deletedCuentaIds: Array.from(deletedCuentaIds),
      deletedGastoIds: Array.from(deletedGastoIds)
    }
  };
};
