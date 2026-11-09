import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from '../config/firebaseConfig';
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

// Initialize Firebase App gracefully (with fallback config so app never crashes if env is empty)
const safeConfig = isFirebaseConfigured ? firebaseConfig : {
  apiKey: 'AIzaSyPlaceholderKeyForLocalModeOnly123456',
  authDomain: 'posvenecia-local.firebaseapp.com',
  projectId: 'posvenecia-local',
  storageBucket: 'posvenecia-local.firebasestorage.app',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:placeholder'
};
const app = getApps().length === 0 ? initializeApp(safeConfig) : getApp();
export const auth = getAuth(app);

// Provider with Drive scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.setCustomParameters({
  prompt: 'select_account'
});

// Persistent token cache helpers
const TOKEN_KEY_PREFIX = 'posvenecia_oauth_token_';
const TOKEN_TIME_PREFIX = 'posvenecia_oauth_timestamp_';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes (Google tokens expire at 60 mins)

let cachedAccessToken: string | null = null;
let tokenAcquiredTimestamp: number = 0;
let isSigningIn = false;

export const persistAccessTokenForUser = (uid: string, token: string | null) => {
  cachedAccessToken = token;
  tokenAcquiredTimestamp = token ? Date.now() : 0;
  try {
    if (token) {
      localStorage.setItem(`${TOKEN_KEY_PREFIX}${uid}`, token);
      localStorage.setItem(`${TOKEN_TIME_PREFIX}${uid}`, tokenAcquiredTimestamp.toString());
      localStorage.setItem('posvenecia_active_google_token', token);
      localStorage.setItem('posvenecia_active_google_token_time', tokenAcquiredTimestamp.toString());
    } else {
      localStorage.removeItem(`${TOKEN_KEY_PREFIX}${uid}`);
      localStorage.removeItem(`${TOKEN_TIME_PREFIX}${uid}`);
      localStorage.removeItem('posvenecia_active_google_token');
      localStorage.removeItem('posvenecia_active_google_token_time');
    }
  } catch (e) {
    console.warn('Could not persist OAuth token to localStorage:', e);
  }
};

export const getPersistedAccessTokenForUser = (uid: string): { token: string | null; isExpired: boolean } => {
  try {
    const token = localStorage.getItem(`${TOKEN_KEY_PREFIX}${uid}`) || localStorage.getItem('posvenecia_active_google_token');
    const timeStr = localStorage.getItem(`${TOKEN_TIME_PREFIX}${uid}`) || localStorage.getItem('posvenecia_active_google_token_time');
    const time = Number(timeStr || 0);

    if (!token || !time) {
      return { token: null, isExpired: true };
    }

    const isExpired = Date.now() - time >= TOKEN_TTL_MS;
    return { token: isExpired ? null : token, isExpired };
  } catch (e) {
    return { token: null, isExpired: true };
  }
};

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
    if (user) {
      // Check if we have an in-memory token or still-valid token in localStorage
      if (cachedAccessToken && !isGoogleTokenExpired()) {
        onUserChanged(user, cachedAccessToken);
        return;
      }

      const { token, isExpired } = getPersistedAccessTokenForUser(user.uid);
      if (token && !isExpired) {
        cachedAccessToken = token;
        const timeStr = localStorage.getItem(`${TOKEN_TIME_PREFIX}${user.uid}`) || localStorage.getItem('posvenecia_active_google_token_time');
        tokenAcquiredTimestamp = Number(timeStr || Date.now());
        onUserChanged(user, token);
      } else {
        // Token has genuinely expired or is not on this device yet
        cachedAccessToken = null;
        tokenAcquiredTimestamp = 0;
        onUserChanged(user, null);
      }
    } else {
      cachedAccessToken = null;
      tokenAcquiredTimestamp = 0;
      onUserChanged(null, null);
    }
  });
};

/**
 * Trigger official Google Sign-In with popup
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Para sincronizar con Google Drive, configura las variables VITE_FIREBASE_* en tu panel de Vercel o archivo .env. Mientras tanto, tu punto de venta funciona al 100% de forma local con IndexedDB y puedes exportar copias en JSON y Excel.'
    );
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('No se pudo obtener el token de acceso de Google');
    }

    persistAccessTokenForUser(result.user.uid, token);
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
export const setGoogleAccessToken = (token: string | null, uid?: string) => {
  cachedAccessToken = token;
  tokenAcquiredTimestamp = token ? Date.now() : 0;
  if (uid) {
    persistAccessTokenForUser(uid, token);
  }
};

/**
 * Log out from Firebase and clear tokens
 */
export const logOutGoogle = async (): Promise<void> => {
  const curUser = auth.currentUser;
  if (curUser) {
    persistAccessTokenForUser(curUser.uid, null);
  }
  await signOut(auth);
  cachedAccessToken = null;
  tokenAcquiredTimestamp = 0;
};

// Database filename in user's Google Drive
const DB_FILE_NAME = 'posvenecia_database.json';

/**
 * Search for posvenecia_database.json in user's Drive (appDataFolder or standard drive space)
 * Sorts by modifiedTime desc to always select the latest file version across devices.
 */
export const findDriveDatabaseFile = async (accessToken: string): Promise<string | null> => {
  const candidates: Array<{ id: string; modifiedTime: string }> = [];

  // 1. Search in appDataFolder (private per-user application storage)
  try {
    const appDataQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
    const appDataUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${appDataQuery}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`;
    const res = await fetch(appDataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        data.files.forEach((f: any) => candidates.push({ id: f.id, modifiedTime: f.modifiedTime || '' }));
      }
    }
  } catch (e) {
    console.warn('Error searching appDataFolder:', e);
  }

  // 2. Search in user files created by this app
  try {
    const driveQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${driveQuery}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`;
    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        data.files.forEach((f: any) => candidates.push({ id: f.id, modifiedTime: f.modifiedTime || '' }));
      }
    }
  } catch (e) {
    console.warn('Error searching drive files:', e);
  }

  if (candidates.length === 0) return null;

  // Pick the newest file
  candidates.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
  return candidates[0].id;
};

/**
 * Get remote database metadata (fileId, modifiedTime, and etag) for multi-device sync
 * Checks both appDataFolder and drive space, picking the newest file version.
 */
export const getRemoteDatabaseMetadata = async (
  accessToken: string
): Promise<{ fileId: string; modifiedTime?: string; etag?: string } | null> => {
  const candidates: Array<{ fileId: string; modifiedTime?: string; etag?: string }> = [];

  // Check appDataFolder
  try {
    const appDataQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
    const appDataUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${appDataQuery}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,etag)`;
    const res = await fetch(appDataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        candidates.push({ 
          fileId: data.files[0].id, 
          modifiedTime: data.files[0].modifiedTime,
          etag: data.files[0].etag
        });
      }
    }
  } catch (e) {
    console.warn('Error fetching appDataFolder metadata:', e);
  }

  // Check general drive files
  try {
    const driveQuery = encodeURIComponent(`name = '${DB_FILE_NAME}' and trashed = false`);
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${driveQuery}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,etag)`;
    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        candidates.push({ 
          fileId: data.files[0].id, 
          modifiedTime: data.files[0].modifiedTime,
          etag: data.files[0].etag
        });
      }
    }
  } catch (e) {
    console.warn('Error fetching drive metadata:', e);
  }

  if (candidates.length === 0) return null;

  // Sort candidates by modifiedTime desc
  candidates.sort((a, b) => {
    const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
    const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
    return timeB - timeA;
  });

  return candidates[0];
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
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,etag`;
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
    // Create new file in user's Google Drive (POST multipart)
    const metadata = {
      name: DB_FILE_NAME,
      mimeType: 'application/json',
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
