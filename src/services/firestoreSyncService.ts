import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  increment,
  query,
  where,
  orderBy,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../config/firebaseConfig';
import { getLocalDateStr } from '../utils/exportUtils';
import {
  Product,
  Sale,
  Expense,
  FiadoRecord,
  Client,
  CuentaPorPagar,
  GastoOperativo,
  CashShift,
  BusinessInfo,
  CreditNote,
  InventoryDischarge,
  BaseCurrency,
  ProductBatch,
  KardexEntry,
  Supplier
} from '../types';

export type TransactionsDatePreset =
  | 'current_month'
  | 'today'
  | 'last_30_days'
  | 'previous_month'
  | 'custom'
  | 'all_history';

export interface TransactionsDateRange {
  startDate: string; // Local YYYY-MM-DD
  endDate: string;   // Local YYYY-MM-DD
}

export interface UserBusinessProfileDoc {
  updatedAt: string;
  businessInfo?: BusinessInfo;
  bcvRate?: number;
  bcvEuroRate?: number;
  bcvLastUpdatedDate?: string;
  bcvLastUpdatedAt?: string;
  baseCurrency?: BaseCurrency;
  rateHistory?: { date: string; rate: number }[];
  customCategories?: string[];
  managerPin?: string;
  lastUpdatedBy?: string;
}

export interface CashRegisterStatusDoc {
  isOpen: boolean;
  activeShift: CashShift | null;
  updatedAt: string;
  updatedBy: string;
  terminalId?: string;
  openedAt?: string;
}

export interface FirestoreStoreListeners {
  onProducts: (products: Product[]) => void;
  onFiados: (fiados: FiadoRecord[]) => void;
  onClients: (clients: Client[]) => void;
  onCuentasPorPagar: (cuentas: CuentaPorPagar[]) => void;
  onGastosOperativos: (gastos: GastoOperativo[]) => void;
  onCashShiftHistory: (history: CashShift[]) => void;
  onBusinessProfile: (profile: UserBusinessProfileDoc) => void;
  onCashRegisterStatus?: (status: CashRegisterStatusDoc) => void;
  onCreditNotes?: (creditNotes: CreditNote[]) => void;
  onInventoryDischarges?: (discharges: InventoryDischarge[]) => void;
  onKardex?: (entries: KardexEntry[]) => void;
  onSuppliers?: (suppliers: Supplier[]) => void;
  onError?: (error: Error) => void;
}

export interface FirestoreTransactionsListeners {
  onSales: (sales: Sale[]) => void;
  onExpenses: (expenses: Expense[]) => void;
  onError?: (error: Error) => void;
}

// Track active in-flight Firestore write operations for graceful logout flush
const activeFirestoreWrites = new Set<Promise<any>>();

export const trackFirestoreWrite = <T>(promise: Promise<T>): Promise<T> => {
  activeFirestoreWrites.add(promise);
  promise.finally(() => {
    activeFirestoreWrites.delete(promise);
  });
  return promise;
};

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
};

export const waitForAllPendingWrites = async (): Promise<void> => {
  if (activeFirestoreWrites.size > 0) {
    devLog(`[PosVenecia] Esperando confirmación de ${activeFirestoreWrites.size} operaciones en Firestore...`);
    await Promise.allSettled(Array.from(activeFirestoreWrites));
  }
};

/**
 * Strips all `undefined` fields recursively from any object or array.
 * CRITICAL: Cloud Firestore strictly rejects any document property set to `undefined`.
 */
export const cleanForFirestore = <T>(data: T): T => {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
};

/**
 * Derives the canonical unique UID directly from the authenticated Firebase/Google user.
 * Guarantees strict isolation under `users/{uid}/...` across all devices logged into the same account.
 */
export const getCanonicalUserId = (uid?: string | null): string => {
  const candidate = auth.currentUser?.uid || uid?.trim();
  if (!candidate) {
    throw new Error('No hay sesión de usuario autenticada para interactuar con Cloud Firestore.');
  }
  return candidate;
};

/**
 * Subscribe to all user-scoped collections in real-time via onSnapshot for instant multi-device sync.
 * All paths strictly live under `users/{uid}/...`.
 */
export const subscribeToStoreRealtime = (
  uid: string,
  callbacks: FirestoreStoreListeners
): (() => void) => {
  const userId = getCanonicalUserId(uid);
  const unsubscribers: Unsubscribe[] = [];

  const handleErr = (opType: OperationType, path: string, err: unknown) => {
    try {
      handleFirestoreError(err, opType, path);
    } catch (e: any) {
      if (callbacks.onError) callbacks.onError(e);
    }
  };

  devLog(`[PosVenecia Firestore] Iniciando suscripción en vivo (users/${userId}/...)`);

  // 1. Products
  const productsPath = `users/${userId}/products`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'products'),
      (snapshot) => {
        const products: Product[] = [];
        snapshot.forEach((d) => {
          products.push(d.data() as Product);
        });
        devLog(`[PosVenecia Firestore] onSnapshot products: ${products.length}`);
        callbacks.onProducts(products);
      },
      (err) => handleErr(OperationType.GET, productsPath, err)
    )
  );

  // 4. Fiados
  const fiadosPath = `users/${userId}/fiados`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'fiados'),
      (snapshot) => {
        const fiados: FiadoRecord[] = [];
        snapshot.forEach((d) => {
          fiados.push(d.data() as FiadoRecord);
        });
        callbacks.onFiados(fiados);
      },
      (err) => handleErr(OperationType.GET, fiadosPath, err)
    )
  );

  // 5. Clients
  const clientsPath = `users/${userId}/clients`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'clients'),
      (snapshot) => {
        const clients: Client[] = [];
        snapshot.forEach((d) => {
          clients.push(d.data() as Client);
        });
        callbacks.onClients(clients);
      },
      (err) => handleErr(OperationType.GET, clientsPath, err)
    )
  );

  // 6. Cuentas Por Pagar
  const cppPath = `users/${userId}/cuentasPorPagar`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'cuentasPorPagar'),
      (snapshot) => {
        const cuentas: CuentaPorPagar[] = [];
        snapshot.forEach((d) => {
          cuentas.push(d.data() as CuentaPorPagar);
        });
        callbacks.onCuentasPorPagar(cuentas);
      },
      (err) => handleErr(OperationType.GET, cppPath, err)
    )
  );

  // 7. Gastos Operativos
  const gastosPath = `users/${userId}/gastosOperativos`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'gastosOperativos'),
      (snapshot) => {
        const gastos: GastoOperativo[] = [];
        snapshot.forEach((d) => {
          gastos.push(d.data() as GastoOperativo);
        });
        callbacks.onGastosOperativos(gastos);
      },
      (err) => handleErr(OperationType.GET, gastosPath, err)
    )
  );

  // 8. Cash Shift History (Cierres de Caja)
  const historyPath = `users/${userId}/cashShiftHistory`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'cashShiftHistory'),
      (snapshot) => {
        const history: CashShift[] = [];
        snapshot.forEach((d) => {
          history.push(d.data() as CashShift);
        });
        history.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
        callbacks.onCashShiftHistory(history);
      },
      (err) => handleErr(OperationType.GET, historyPath, err)
    )
  );

  // 9. Business Profile, Logo, BCV Rates, Base Currency & Custom Categories
  const profilePath = `users/${userId}/businessProfile/profile`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'users', userId, 'businessProfile', 'profile'),
      (docSnap) => {
        if (docSnap.exists()) {
          callbacks.onBusinessProfile(docSnap.data() as UserBusinessProfileDoc);
        }
      },
      (err) => handleErr(OperationType.GET, profilePath, err)
    )
  );

  // 10. Dedicated Live Cash Register Status Document (Apertura y Cierre en Tiempo Real Multi-dispositivo)
  const regStatusPath = `users/${userId}/cashRegister/status`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'users', userId, 'cashRegister', 'status'),
      (docSnap) => {
        if (callbacks.onCashRegisterStatus) {
          if (docSnap.exists()) {
            const status = docSnap.data() as CashRegisterStatusDoc;
            devLog(`[PosVenecia Firestore] onSnapshot cashRegister/status: ${status.isOpen ? 'ABIERTA' : 'CERRADA'}`);
            callbacks.onCashRegisterStatus(status);
          } else {
            callbacks.onCashRegisterStatus({
              isOpen: false,
              activeShift: null,
              updatedAt: '',
              updatedBy: ''
            });
          }
        }
      },
      (err) => handleErr(OperationType.GET, regStatusPath, err)
    )
  );

  // 11. Credit Notes (Notas de Crédito y Devoluciones)
  const creditNotesPath = `users/${userId}/creditNotes`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'creditNotes'),
      (snapshot) => {
        const notes: CreditNote[] = [];
        snapshot.forEach((d) => {
          notes.push(d.data() as CreditNote);
        });
        notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (callbacks.onCreditNotes) {
          callbacks.onCreditNotes(notes);
        }
      },
      (err) => handleErr(OperationType.GET, creditNotesPath, err)
    )
  );

  // 12. Inventory Discharges (Salidas por Daño, Vencimiento, Merma, Uso Interno)
  const dischargesPath = `users/${userId}/inventoryDischarges`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'inventoryDischarges'),
      (snapshot) => {
        const discharges: InventoryDischarge[] = [];
        snapshot.forEach((d) => {
          discharges.push(d.data() as InventoryDischarge);
        });
        discharges.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (callbacks.onInventoryDischarges) {
          callbacks.onInventoryDischarges(discharges);
        }
      },
      (err) => handleErr(OperationType.GET, dischargesPath, err)
    )
  );

  // 13. Kardex (Historial inmutable de movimientos de inventario)
  const kardexPath = `users/${userId}/kardex`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'kardex'),
      (snapshot) => {
        const entries: KardexEntry[] = [];
        snapshot.forEach((d) => {
          entries.push(d.data() as KardexEntry);
        });
        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (callbacks.onKardex) {
          callbacks.onKardex(entries);
        }
      },
      (err) => handleErr(OperationType.GET, kardexPath, err)
    )
  );

  // 14. Maestro de Proveedores
  const suppliersPath = `users/${userId}/suppliers`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'suppliers'),
      (snapshot) => {
        const suppliers: Supplier[] = [];
        snapshot.forEach((d) => {
          suppliers.push(d.data() as Supplier);
        });
        suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (callbacks.onSuppliers) {
          callbacks.onSuppliers(suppliers);
        }
      },
      (err) => handleErr(OperationType.GET, suppliersPath, err)
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
};

/**
 * Computes YYYY-MM-DD local bounds for date-filter presets.
 */
export const computeTransactionsDateRange = (
  preset: TransactionsDatePreset,
  customStart?: string,
  customEnd?: string
): TransactionsDateRange | null => {
  if (preset === 'all_history') return null;

  const now = new Date();
  const todayStr = getLocalDateStr(now);

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === 'last_30_days') {
    const startObj = new Date(now);
    startObj.setDate(startObj.getDate() - 29);
    return { startDate: getLocalDateStr(startObj), endDate: todayStr };
  }

  if (preset === 'previous_month') {
    const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: getLocalDateStr(firstPrev), endDate: getLocalDateStr(lastPrev) };
  }

  if (preset === 'custom' && customStart && customEnd) {
    const [startDate, endDate] = customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    return { startDate, endDate };
  }

  // Default: current_month (from 1st of current month through last day of current month)
  const firstCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastCurrent = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: getLocalDateStr(firstCurrent), endDate: getLocalDateStr(lastCurrent) };
};

const buildFirestoreDateBounds = (range: TransactionsDateRange): { startBound: string; endBound: string } => {
  const [sy, sm, sd] = range.startDate.split('-').map(Number);
  const [ey, em, ed] = range.endDate.split('-').map(Number);
  const localStartIso = new Date(sy, (sm || 1) - 1, sd || 1, 0, 0, 0, 0).toISOString();
  const localEndIso = new Date(ey, (em || 1) - 1, ed || 1, 23, 59, 59, 999).toISOString();
  const plainEnd = `${range.endDate}\uf8ff`;
  const startBound = range.startDate < localStartIso ? range.startDate : localStartIso;
  const endBound = plainEnd > localEndIso ? plainEnd : localEndIso;
  return { startBound, endBound };
};

const isWithinLocalDateRange = (dateStr: string | undefined, range: TransactionsDateRange): boolean => {
  if (!dateStr) return false;
  const localYmd = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getLocalDateStr(dateStr);
  return localYmd >= range.startDate && localYmd <= range.endDate;
};

/**
 * Subscribe to high-volume transaction collections (`sales` and `expenses`) scoped to a date range
 * so mobile clients don't stream unbounded months on boot. Passes `range = null` only when the
 * user explicitly requests full historical loading on demand.
 */
export const subscribeToTransactionsRealtime = (
  uid: string,
  range: TransactionsDateRange | null,
  callbacks: FirestoreTransactionsListeners
): (() => void) => {
  const userId = getCanonicalUserId(uid);
  const unsubscribers: Unsubscribe[] = [];

  const handleErr = (opType: OperationType, path: string, err: unknown) => {
    try {
      handleFirestoreError(err, opType, path);
    } catch (e: any) {
      if (callbacks.onError) callbacks.onError(e);
    }
  };

  const bounds = range ? buildFirestoreDateBounds(range) : null;

  const salesCol = collection(db, 'users', userId, 'sales');
  const salesQuery = bounds
    ? query(
        salesCol,
        where('date', '>=', bounds.startBound),
        where('date', '<=', bounds.endBound),
        orderBy('date', 'desc')
      )
    : salesCol;

  unsubscribers.push(
    onSnapshot(
      salesQuery,
      (snapshot) => {
        const sales: Sale[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Sale;
          if (!range || isWithinLocalDateRange(item.date, range)) {
            sales.push(item);
          }
        });
        sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        devLog(
          `[PosVenecia Firestore] onSnapshot sales (${range ? `${range.startDate}..${range.endDate}` : 'HISTÓRICO'}): ${sales.length}`
        );
        callbacks.onSales(sales);
      },
      (err) => handleErr(OperationType.GET, `users/${userId}/sales`, err)
    )
  );

  const expensesCol = collection(db, 'users', userId, 'expenses');
  const expensesQuery = bounds
    ? query(
        expensesCol,
        where('date', '>=', bounds.startBound),
        where('date', '<=', bounds.endBound),
        orderBy('date', 'desc')
      )
    : expensesCol;

  unsubscribers.push(
    onSnapshot(
      expensesQuery,
      (snapshot) => {
        const expenses: Expense[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Expense;
          if (!range || isWithinLocalDateRange(item.date, range)) {
            expenses.push(item);
          }
        });
        expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        devLog(
          `[PosVenecia Firestore] onSnapshot expenses (${range ? `${range.startDate}..${range.endDate}` : 'HISTÓRICO'}): ${expenses.length}`
        );
        callbacks.onExpenses(expenses);
      },
      (err) => handleErr(OperationType.GET, `users/${userId}/expenses`, err)
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
};

/**
 * Save cash register status (open/close) in Cloud Firestore for instant multi-device reflection
 */
export const saveCashRegisterStatusToFirestore = async (
  uid: string,
  status: CashRegisterStatusDoc
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cashRegister/status`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore({
        ...status,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', userId, 'cashRegister', 'status'), cleaned, { merge: true });
      devLog(`[PosVenecia Firestore] Estado de caja ${status.isOpen ? 'ABIERTA' : 'CERRADA'} guardado en users/${userId}/cashRegister/status.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save business profile, logo, BCV rates, base currency, custom categories, and PIN to Firestore
 */
export const saveBusinessProfileToFirestore = async (
  uid: string,
  profilePatch: Partial<UserBusinessProfileDoc>
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/businessProfile/profile`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore({
        ...profilePatch,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', userId, 'businessProfile', 'profile'), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic write for completeSale:
 * Saves sale document and reduces product inventory in a single atomic batch
 */
export const saveSaleAtomic = async (
  uid: string,
  sale: Sale,
  stockDeductions: Array<{ productId: string; quantity: number }>,
  newFiado?: FiadoRecord,
  productBatchUpdates?: Array<{ productId: string; batches?: ProductBatch[]; priceUSD?: number; costUSD?: number; priceBsFixed?: number }>,
  kardexEntries?: KardexEntry[]
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/sales/${sale.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      const cleanedSale = cleanForFirestore({ ...sale, syncStatus: 'synced' });
      const saleRef = doc(db, 'users', userId, 'sales', sale.id);
      batch.set(saleRef, cleanedSale);

      const consolidatedDeductions = new Map<string, number>();
      for (const item of stockDeductions) {
        if (item.productId && item.quantity > 0) {
          const current = consolidatedDeductions.get(item.productId) || 0;
          consolidatedDeductions.set(item.productId, current + item.quantity);
        }
      }

      const batchUpdateMap = new Map(
        (productBatchUpdates || []).map(u => [u.productId, u])
      );

      for (const [productId, quantity] of consolidatedDeductions.entries()) {
        const prodRef = doc(db, 'users', userId, 'products', productId);
        const batchPatch = batchUpdateMap.get(productId);
        const updatePayload: Record<string, unknown> = {
          stock: increment(-quantity)
        };
        if (batchPatch) {
          if (batchPatch.batches !== undefined) {
            updatePayload.batches = cleanForFirestore(batchPatch.batches);
          }
          if (batchPatch.priceUSD !== undefined) {
            updatePayload.priceUSD = batchPatch.priceUSD;
          }
          if (batchPatch.costUSD !== undefined) {
            updatePayload.costUSD = batchPatch.costUSD;
          }
          if (batchPatch.priceBsFixed !== undefined) {
            updatePayload.priceBsFixed = batchPatch.priceBsFixed;
          }
        }
        batch.update(prodRef, updatePayload);
      }

      if (newFiado) {
        const cleanedFiado = cleanForFirestore(newFiado);
        const fiadoRef = doc(db, 'users', userId, 'fiados', newFiado.id);
        batch.set(fiadoRef, cleanedFiado);
      }

      if (kardexEntries && kardexEntries.length > 0) {
        for (const entry of kardexEntries) {
          const kRef = doc(db, 'users', userId, 'kardex', entry.id);
          batch.set(kRef, cleanForFirestore(entry));
        }
      }

      await batch.commit();
      devLog(`[PosVenecia Firestore] Venta ${sale.invoiceNumber} confirmada en users/${userId}/sales.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic write for cancelSale:
 * Marks sale as 'anulada' and restores stock + FIFO batches for physical products
 */
export const cancelSaleAtomic = async (
  uid: string,
  sale: Sale,
  stockRestorations: Array<{ productId: string; quantity: number }>,
  associatedFiadoId?: string,
  productBatchUpdates?: Array<{ productId: string; batches?: ProductBatch[] }>,
  kardexEntries?: KardexEntry[]
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/sales/${sale.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      const saleRef = doc(db, 'users', userId, 'sales', sale.id);
      batch.update(saleRef, { status: 'anulada' });

      const consolidatedRestorations = new Map<string, number>();
      for (const item of stockRestorations) {
        if (item.productId && item.quantity > 0) {
          const current = consolidatedRestorations.get(item.productId) || 0;
          consolidatedRestorations.set(item.productId, current + item.quantity);
        }
      }

      const batchUpdateMap = new Map(
        (productBatchUpdates || []).map(u => [u.productId, u])
      );

      for (const [productId, quantity] of consolidatedRestorations.entries()) {
        const prodRef = doc(db, 'users', userId, 'products', productId);
        const batchPatch = batchUpdateMap.get(productId);
        const updatePayload: Record<string, unknown> = {
          stock: increment(quantity)
        };
        if (batchPatch?.batches !== undefined) {
          updatePayload.batches = cleanForFirestore(batchPatch.batches);
        }
        batch.update(prodRef, updatePayload);
      }

      if (associatedFiadoId) {
        const fiadoRef = doc(db, 'users', userId, 'fiados', associatedFiadoId);
        batch.update(fiadoRef, {
          status: 'saldado',
          remainingDebtUSD: 0,
          notes: '[VENTA ANULADA EN POS] Fiado cancelado automáticamente por anulación de factura.'
        });
      }

      if (kardexEntries && kardexEntries.length > 0) {
        for (const entry of kardexEntries) {
          const kRef = doc(db, 'users', userId, 'kardex', entry.id);
          batch.set(kRef, cleanForFirestore(entry));
        }
      }

      await batch.commit();
      devLog(`[PosVenecia Firestore] Venta ${sale.invoiceNumber} anulada en Firestore.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic write for saveCreditNoteAtomic:
 * 1. Saves Credit Note doc
 * 2. Reincorporates returned products into stock (increment) + FIFO batches
 * 3. Updates original sale status to 'devuelta'
 * 4. Updates linked FiadoRecord if applicable
 */
export const saveCreditNoteAtomic = async (
  uid: string,
  creditNote: CreditNote,
  stockRestorations: Array<{ productId: string; quantity: number }>,
  updatedSale?: Sale,
  updatedFiado?: FiadoRecord,
  productBatchUpdates?: Array<{ productId: string; batches?: ProductBatch[] }>,
  kardexEntries?: KardexEntry[]
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/creditNotes/${creditNote.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      const cleanedNC = cleanForFirestore(creditNote);
      const ncRef = doc(db, 'users', userId, 'creditNotes', creditNote.id);
      batch.set(ncRef, cleanedNC);

      const consolidatedRestorations = new Map<string, number>();
      for (const item of stockRestorations) {
        if (item.productId && item.quantity > 0) {
          const current = consolidatedRestorations.get(item.productId) || 0;
          consolidatedRestorations.set(item.productId, current + item.quantity);
        }
      }

      const batchUpdateMap = new Map(
        (productBatchUpdates || []).map(u => [u.productId, u])
      );

      for (const [productId, quantity] of consolidatedRestorations.entries()) {
        const prodRef = doc(db, 'users', userId, 'products', productId);
        const batchPatch = batchUpdateMap.get(productId);
        const updatePayload: Record<string, unknown> = {
          stock: increment(quantity)
        };
        if (batchPatch?.batches !== undefined) {
          updatePayload.batches = cleanForFirestore(batchPatch.batches);
        }
        batch.update(prodRef, updatePayload);
      }

      if (updatedSale) {
        const cleanedSale = cleanForFirestore(updatedSale);
        const saleRef = doc(db, 'users', userId, 'sales', updatedSale.id);
        batch.set(saleRef, cleanedSale, { merge: true });
      }

      if (updatedFiado) {
        const cleanedFiado = cleanForFirestore(updatedFiado);
        const fiadoRef = doc(db, 'users', userId, 'fiados', updatedFiado.id);
        batch.set(fiadoRef, cleanedFiado, { merge: true });
      }

      if (kardexEntries && kardexEntries.length > 0) {
        for (const entry of kardexEntries) {
          const kRef = doc(db, 'users', userId, 'kardex', entry.id);
          batch.set(kRef, cleanForFirestore(entry));
        }
      }

      await batch.commit();
      devLog(`[PosVenecia Firestore] Nota de Crédito ${creditNote.creditNoteNumber} guardada y stock reincorporado.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic write for saveInventoryDischargeAtomic:
 * 1. Saves Inventory Discharge record
 * 2. Deducts product stock in Firestore (increment(-quantity)) + updates FIFO batches
 * 3. Registers GastoOperativo (pérdida contable)
 */
export const saveInventoryDischargeAtomic = async (
  uid: string,
  discharge: InventoryDischarge,
  associatedGastoOperativo: GastoOperativo,
  associatedExpense?: Expense,
  updatedProductBatches?: ProductBatch[],
  kardexEntry?: KardexEntry
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/inventoryDischarges/${discharge.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      const cleanedDischarge = cleanForFirestore(discharge);
      const discRef = doc(db, 'users', userId, 'inventoryDischarges', discharge.id);
      batch.set(discRef, cleanedDischarge);

      if (discharge.productId && discharge.quantity > 0) {
        const prodRef = doc(db, 'users', userId, 'products', discharge.productId);
        const updatePayload: Record<string, unknown> = {
          stock: increment(-discharge.quantity)
        };
        if (updatedProductBatches !== undefined) {
          updatePayload.batches = cleanForFirestore(updatedProductBatches);
        }
        batch.update(prodRef, updatePayload);
      }

      const cleanedGasto = cleanForFirestore(associatedGastoOperativo);
      const gastoRef = doc(db, 'users', userId, 'gastosOperativos', associatedGastoOperativo.id);
      batch.set(gastoRef, cleanedGasto);

      if (associatedExpense) {
        const cleanedExpense = cleanForFirestore(associatedExpense);
        const expRef = doc(db, 'users', userId, 'expenses', associatedExpense.id);
        batch.set(expRef, cleanedExpense);
      }

      if (kardexEntry) {
        const kRef = doc(db, 'users', userId, 'kardex', kardexEntry.id);
        batch.set(kRef, cleanForFirestore(kardexEntry));
      }

      await batch.commit();
      devLog(`[PosVenecia Firestore] Desincorporación ${discharge.dischargeNumber} (${discharge.reason}) guardada atómicamente.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteCreditNoteFromFirestore = async (uid: string, id: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/creditNotes/${id}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'creditNotes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteInventoryDischargeFromFirestore = async (uid: string, id: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/inventoryDischarges/${id}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'inventoryDischarges', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveProductToFirestore = async (uid: string, product: Product): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/products/${product.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(product);
      await setDoc(doc(db, 'users', userId, 'products', product.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveProductWithKardexAtomic = async (
  uid: string,
  product: Product,
  kardexEntry?: KardexEntry
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/products/${product.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);
      const cleaned = cleanForFirestore(product);
      batch.set(doc(db, 'users', userId, 'products', product.id), cleaned, { merge: true });
      if (kardexEntry) {
        batch.set(doc(db, 'users', userId, 'kardex', kardexEntry.id), cleanForFirestore(kardexEntry));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteProductFromFirestore = async (uid: string, productId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/products/${productId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'products', productId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const adjustProductStockInFirestore = async (
  uid: string,
  productId: string,
  newStock: number,
  kardexEntry?: KardexEntry
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/products/${productId}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, 'users', userId, 'products', productId);
      batch.set(prodRef, { stock: newStock }, { merge: true });
      if (kardexEntry) {
        batch.set(doc(db, 'users', userId, 'kardex', kardexEntry.id), cleanForFirestore(kardexEntry));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveExpenseToFirestore = async (uid: string, expense: Expense): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(expense);
      await setDoc(doc(db, 'users', userId, 'expenses', expense.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveExpenseWithInventoryAtomic = async (
  uid: string,
  expense: Expense,
  updatedProducts: Product[],
  linkedCuenta?: CuentaPorPagar,
  kardexEntries?: KardexEntry[],
  updatedSupplier?: Supplier
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      const cleanedExpense = cleanForFirestore(expense);
      const expRef = doc(db, 'users', userId, 'expenses', expense.id);
      batch.set(expRef, cleanedExpense, { merge: true });

      for (const prod of updatedProducts) {
        const prodRef = doc(db, 'users', userId, 'products', prod.id);
        const cleanedProduct = cleanForFirestore(prod);
        batch.set(prodRef, cleanedProduct, { merge: true });
      }

      if (linkedCuenta) {
        const cleanedCuenta = cleanForFirestore(linkedCuenta);
        const cuentaRef = doc(db, 'users', userId, 'cuentasPorPagar', linkedCuenta.id);
        batch.set(cuentaRef, cleanedCuenta, { merge: true });
      }

      if (kardexEntries && kardexEntries.length > 0) {
        for (const entry of kardexEntries) {
          const kRef = doc(db, 'users', userId, 'kardex', entry.id);
          batch.set(kRef, cleanForFirestore(entry));
        }
      }

      if (updatedSupplier) {
        const supRef = doc(db, 'users', userId, 'suppliers', updatedSupplier.id);
        batch.set(supRef, cleanForFirestore(updatedSupplier), { merge: true });
      }

      await batch.commit();
      devLog(`[PosVenecia Firestore] Factura ${expense.invoiceNumber} y ${updatedProducts.length} productos actualizados atómicamente.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteExpenseFromFirestore = async (uid: string, expenseId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expenseId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'expenses', expenseId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveFiadoToFirestore = async (uid: string, fiado: FiadoRecord): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/fiados/${fiado.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(fiado);
      await setDoc(doc(db, 'users', userId, 'fiados', fiado.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveClientToFirestore = async (uid: string, client: Client): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/clients/${client.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(client);
      await setDoc(doc(db, 'users', userId, 'clients', client.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteClientFromFirestore = async (uid: string, clientId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/clients/${clientId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'clients', clientId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveSupplierToFirestore = async (uid: string, supplier: Supplier): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/suppliers/${supplier.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(supplier);
      await setDoc(doc(db, 'users', userId, 'suppliers', supplier.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteSupplierFromFirestore = async (uid: string, supplierId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/suppliers/${supplierId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'suppliers', supplierId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveCuentaPorPagarToFirestore = async (
  uid: string,
  cuenta: CuentaPorPagar,
  updatedSupplier?: Supplier
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cuentasPorPagar/${cuenta.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);
      const cleaned = cleanForFirestore(cuenta);
      batch.set(doc(db, 'users', userId, 'cuentasPorPagar', cuenta.id), cleaned, { merge: true });
      if (updatedSupplier) {
        batch.set(doc(db, 'users', userId, 'suppliers', updatedSupplier.id), cleanForFirestore(updatedSupplier), { merge: true });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveCuentaWithCashOutflowAtomic = async (
  uid: string,
  cuenta: CuentaPorPagar,
  cashExpense: Expense,
  updatedSupplier?: Supplier
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cuentasPorPagar/${cuenta.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);
      const cleanedCuenta = cleanForFirestore(cuenta);
      const cuentaRef = doc(db, 'users', userId, 'cuentasPorPagar', cuenta.id);
      batch.set(cuentaRef, cleanedCuenta, { merge: true });

      const cleanedExp = cleanForFirestore(cashExpense);
      const expRef = doc(db, 'users', userId, 'expenses', cashExpense.id);
      batch.set(expRef, cleanedExp, { merge: true });

      if (updatedSupplier) {
        batch.set(doc(db, 'users', userId, 'suppliers', updatedSupplier.id), cleanForFirestore(updatedSupplier), { merge: true });
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteCuentaPorPagarFromFirestore = async (
  uid: string,
  cuentaId: string,
  updatedSupplier?: Supplier
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cuentasPorPagar/${cuentaId}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', userId, 'cuentasPorPagar', cuentaId));
      if (updatedSupplier) {
        batch.set(doc(db, 'users', userId, 'suppliers', updatedSupplier.id), cleanForFirestore(updatedSupplier), { merge: true });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveGastoOperativoToFirestore = async (uid: string, gasto: GastoOperativo): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/gastosOperativos/${gasto.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(gasto);
      await setDoc(doc(db, 'users', userId, 'gastosOperativos', gasto.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveGastoWithCashOutflowAtomic = async (
  uid: string,
  gasto: GastoOperativo,
  cashExpense?: Expense
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/gastosOperativos/${gasto.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);
      const cleanedGasto = cleanForFirestore(gasto);
      const gastoRef = doc(db, 'users', userId, 'gastosOperativos', gasto.id);
      batch.set(gastoRef, cleanedGasto, { merge: true });

      if (cashExpense) {
        const cleanedExp = cleanForFirestore(cashExpense);
        const expRef = doc(db, 'users', userId, 'expenses', cashExpense.id);
        batch.set(expRef, cleanedExp, { merge: true });
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteGastoOperativoFromFirestore = async (uid: string, gastoId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/gastosOperativos/${gastoId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'gastosOperativos', gastoId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteSaleFromFirestore = async (uid: string, saleId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/sales/${saleId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'sales', saleId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveCashShiftToFirestore = async (uid: string, shift: CashShift): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cashShiftHistory/${shift.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(shift);
      await setDoc(doc(db, 'users', userId, 'cashShiftHistory', shift.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Uploads an entire JSON backup/restore payload atomically (chunked batches) directly to Cloud Firestore under users/{uid}/...
 */
export const restoreStoreDataToFirestore = async (
  uid: string,
  data: {
    products: Product[];
    sales: Sale[];
    expenses: Expense[];
    fiados: FiadoRecord[];
    clients: Client[];
    cuentasPorPagar: CuentaPorPagar[];
    gastosOperativos: GastoOperativo[];
    suppliers?: Supplier[];
    cashShiftHistory: CashShift[];
    businessInfo: BusinessInfo;
    bcvRate: number;
    bcvEuroRate: number;
    customCategories?: string[];
    cashShift?: CashShift | null;
  }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const writeCollection = async (colName: string, docs: Array<{ id: string }>) => {
    const chunkSize = 400;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (!item?.id) continue;
        batch.set(doc(db, 'users', userId, colName, item.id), cleanForFirestore(item));
      }
      await batch.commit();
    }
  };

  await writeCollection('products', data.products || []);
  await writeCollection('sales', data.sales || []);
  await writeCollection('expenses', data.expenses || []);
  await writeCollection('fiados', data.fiados || []);
  await writeCollection('clients', data.clients || []);
  await writeCollection('cuentasPorPagar', data.cuentasPorPagar || []);
  await writeCollection('gastosOperativos', data.gastosOperativos || []);
  await writeCollection('suppliers', data.suppliers || []);
  await writeCollection('cashShiftHistory', data.cashShiftHistory || []);

  await saveBusinessProfileToFirestore(userId, {
    businessInfo: data.businessInfo,
    bcvRate: data.bcvRate,
    bcvEuroRate: data.bcvEuroRate,
    customCategories: data.customCategories || []
  });

  await saveCashRegisterStatusToFirestore(userId, {
    isOpen: Boolean(data.cashShift?.isOpen),
    activeShift: data.cashShift || null,
    updatedAt: new Date().toISOString(),
    updatedBy: data.cashShift?.openedBy || 'Restauración'
  });
};

/**
 * Deletes all mutable transactional collections under users/{uid}/... for Factory Reset (Arrancar de 0).
 * Preserves businessProfile (nombre, RIF, logo) unless overwritten.
 * Note: 'kardex' is immutable by Firestore security rules (allow update, delete: if false).
 */
export const clearUserFirestoreCollections = async (uid: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const collectionsToClear = [
    'products',
    'sales',
    'expenses',
    'fiados',
    'clients',
    'cuentasPorPagar',
    'gastosOperativos',
    'suppliers',
    'cashShiftHistory',
    'creditNotes',
    'inventoryDischarges'
  ];

  const op = (async () => {
    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, 'users', userId, colName));
      if (snap.empty) continue;
      const docs = snap.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + chunkSize).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await saveCashRegisterStatusToFirestore(userId, {
      isOpen: false,
      activeShift: null,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Reinicio de Fábrica'
    });
  })();

  return trackFirestoreWrite(op);
};
