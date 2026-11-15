import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  runTransaction,
  query,
  where,
  orderBy,
  deleteField,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../config/firebaseConfig';
import { getLocalDateStr, round2, round6 } from '../utils/exportUtils';
import {
  Product,
  Sale,
  Expense,
  FiadoRecord,
  Client,
  CuentaPorPagar,
  GastoOperativo,
  GastoOperativoCategory,
  CashShift,
  BusinessInfo,
  CreditNote,
  CreditNoteItem,
  InventoryDischarge,
  BaseCurrency,
  ProductBatch,
  KardexEntry,
  KardexMovementType,
  PurchaseCostStrategy,
  PaymentMethod,
  Abono,
  Supplier
} from '../types';
import { BackupDataPayload } from '../utils/cloudBackupUtils';

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
const activeFirestoreWrites = new Set<Promise<unknown>>();

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
    const cleaned: Record<string, unknown> = {};
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
 * Sanitizes document IDs so they strictly satisfy firestore.rules: ^[a-zA-Z0-9_-]{1,128}$
 */
const sanitizeFirestoreDocId = (rawId: unknown, prefix: string, index: number): string => {
  const str = typeof rawId === 'string' ? rawId.trim() : '';
  const cleaned = str.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 128);
  if (cleaned.length > 0 && /^[a-zA-Z0-9_-]{1,128}$/.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}-${Date.now()}-${index}`;
};

/**
 * Derives and enforces the canonical unique UID directly from the authenticated Firebase/Google user.
 * Guarantees strict isolation under `users/{uid}/...` and blocks cross-account mismatch.
 */
export const getCanonicalUserId = (uid?: string | null): string => {
  const authUid = auth.currentUser?.uid?.trim();
  const requestedUid = uid?.trim();
  if (authUid && requestedUid && authUid !== requestedUid) {
    throw new Error('Conflicto de identidad de usuario: la sesión autenticada no coincide con la cuenta solicitada.');
  }
  const candidate = authUid || requestedUid;
  if (!candidate) {
    throw new Error('No hay sesión de usuario autenticada para interactuar con Cloud Firestore.');
  }
  return candidate;
};

// Shared pure helpers for transactional FIFO & Kardex computations against live server docs
export const deductFifoBatchesTx = (
  batches: ProductBatch[] | undefined,
  qtyToDeduct: number,
  currentProduct: Product,
  bcvRate: number,
  baseCurrency: BaseCurrency
): {
  batches: ProductBatch[] | undefined;
  priceUSD?: number;
  costUSD?: number;
  priceBsFixed?: number;
} => {
  if (!batches || batches.length === 0 || qtyToDeduct <= 0) {
    return { batches };
  }
  const previousFirstId = batches[0]?.id;
  let remaining = qtyToDeduct;
  const nextBatches: ProductBatch[] = [];
  for (const b of batches) {
    if (remaining <= 0) {
      nextBatches.push(b);
    } else if (b.quantity > remaining) {
      const nextQty = round2(b.quantity - remaining);
      if (nextQty > 0) {
        nextBatches.push({ ...b, quantity: nextQty });
      }
      remaining = 0;
    } else {
      remaining = round2(remaining - b.quantity);
    }
  }

  let nextPriceUSD: number | undefined;
  let nextCostUSD: number | undefined;
  let nextPriceBsFixed: number | undefined;

  if (nextBatches.length > 0 && nextBatches[0].id !== previousFirstId) {
    const activeBatch = nextBatches[0];
    if (activeBatch.targetPriceUSD && activeBatch.targetPriceUSD > 0 && activeBatch.targetPriceUSD !== currentProduct.priceUSD) {
      nextPriceUSD = round2(activeBatch.targetPriceUSD);
      if (baseCurrency === 'VED' && bcvRate > 0) {
        nextPriceBsFixed = round2(nextPriceUSD * bcvRate);
      }
    }
    if (activeBatch.costUSD > 0 && activeBatch.costUSD !== currentProduct.costUSD) {
      nextCostUSD = round2(activeBatch.costUSD);
    }
  }

  return {
    batches: nextBatches,
    priceUSD: nextPriceUSD,
    costUSD: nextCostUSD,
    priceBsFixed: nextPriceBsFixed
  };
};

export const restoreFifoBatchesTx = (
  batches: ProductBatch[] | undefined,
  qtyToRestore: number,
  fallbackProduct: Product,
  referenceLabel: string
): ProductBatch[] | undefined => {
  if (qtyToRestore <= 0) return batches;
  if (batches === undefined) return undefined;
  if (batches.length > 0) {
    const updated = [...batches];
    updated[0] = {
      ...updated[0],
      quantity: round2(updated[0].quantity + qtyToRestore)
    };
    return updated;
  }
  return [
    {
      id: 'batch-ret-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      invoiceNumber: referenceLabel,
      date: new Date().toISOString(),
      quantity: round2(qtyToRestore),
      initialQuantity: round2(qtyToRestore),
      costUSD: round2(fallbackProduct.costUSD || 0),
      targetPriceUSD: round2(fallbackProduct.priceUSD || 0)
    }
  ];
};

export const computeFifoValuationUSDTx = (prod: Product, stockOverride?: number): number => {
  const targetStock = stockOverride !== undefined ? stockOverride : (prod.stock || 0);
  if (prod.batches && prod.batches.length > 0) {
    return round2(
      prod.batches.reduce((sum, b) => sum + (Math.max(0, b.quantity || 0) * Math.max(0, b.costUSD || 0)), 0)
    );
  }
  return round2(Math.max(0, targetStock) * Math.max(0, prod.costUSD || 0));
};

export const buildKardexEntryTx = (params: {
  product: Product;
  type: KardexMovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  unitCostUSD: number;
  valuationMethod: PurchaseCostStrategy;
  reference?: string;
  notes?: string;
  userName?: string;
  date?: string;
}): KardexEntry => {
  const safeUnitCost = round2(Math.max(0, params.unitCostUSD));
  const safeAvgCost = round2(Math.max(0, params.product.costUSD || safeUnitCost));
  const safeNewStock = Math.max(0, round2(params.newStock));
  return {
    id: `kdx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: params.date || new Date().toISOString(),
    productId: params.product.id,
    productCode: params.product.code || '',
    productName: params.product.name || 'Producto',
    category: params.product.category || 'General',
    type: params.type,
    quantityChange: round2(params.quantityChange),
    previousStock: round2(params.previousStock),
    newStock: safeNewStock,
    unitCostUSD: safeUnitCost,
    totalCostUSD: round2(Math.abs(params.quantityChange) * safeUnitCost),
    valuationMethod: params.valuationMethod,
    fifoBalanceUSD: computeFifoValuationUSDTx(params.product, safeNewStock),
    avgCostUSD: safeAvgCost,
    avgBalanceUSD: round2(safeNewStock * safeAvgCost),
    reference: params.reference,
    notes: params.notes,
    userName: params.userName
  };
};

const mapMethodToExpenseMethod = (m?: PaymentMethod): Expense['paymentMethod'] => {
  if (m === 'efectivo_usd' || m === 'efectivo_bs' || m === 'pago_movil' || m === 'debito' || m === 'transferencia') {
    return m;
  }
  return 'transferencia';
};

const mapGastoCategoryToExpenseCategory = (cat: GastoOperativoCategory): Expense['category'] => {
  if (cat === 'Alquiler' || cat === 'Servicios' || cat === 'Nómina' || cat === 'Mantenimiento') {
    return cat;
  }
  if (cat === 'Insumos / Papelería' || cat === 'Papelería') {
    return 'Mercancía';
  }
  return 'Otros';
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
 * Subscribe to high-volume transaction collections (`sales` and `expenses`) scoped to a date range.
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
      const profileRef = doc(db, 'users', userId, 'businessProfile', 'profile');
      const cleaned = cleanForFirestore({
        ...profilePatch,
        updatedAt: new Date().toISOString()
      });
      try {
        await updateDoc(profileRef, cleaned as Record<string, any>);
      } catch (err: any) {
        if (err?.code === 'not-found') {
          await setDoc(profileRef, cleaned, { merge: true });
        } else {
          throw err;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic write for completeSale (`runTransaction`):
 * 1. Validates across the FULL `sales` collection (even archived months) that invoiceNumber & controlNumber are not duplicated.
 * 2. Reads live server Product documents inside `runTransaction` and verifies sufficient live stock on each physical item.
 * 3. Deducts stock & FIFO batches from live server data, records the sale, optional Fiado, and immutable Kardex entries atomically.
 */
export const saveSaleAtomic = async (
  uid: string,
  sale: Sale,
  stockDeductions: Array<{ productId: string; quantity: number }>,
  bcvRate: number,
  baseCurrency: BaseCurrency,
  newFiado?: FiadoRecord
): Promise<Sale> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/sales/${sale.id}`;
  const op = (async (): Promise<Sale> => {
    try {
      // Pre-transaction uniqueness validation across entire historical sales collection
      const salesCol = collection(db, 'users', userId, 'sales');
      const [dupInvSnap, dupCtrlSnap] = await Promise.all([
        getDocs(query(salesCol, where('invoiceNumber', '==', sale.invoiceNumber))),
        getDocs(query(salesCol, where('controlNumber', '==', sale.controlNumber)))
      ]);

      if (dupInvSnap.docs.some((d) => d.id !== sale.id)) {
        throw new Error(`El Número de Factura "${sale.invoiceNumber}" ya fue registrado en el histórico de ventas.`);
      }
      if (dupCtrlSnap.docs.some((d) => d.id !== sale.id)) {
        throw new Error(`El Número de Control SENIAT "${sale.controlNumber}" ya fue registrado en el histórico de ventas.`);
      }

      const consolidatedDeductions = new Map<string, number>();
      for (const item of stockDeductions) {
        if (item.productId && item.quantity > 0) {
          consolidatedDeductions.set(
            item.productId,
            round2((consolidatedDeductions.get(item.productId) || 0) + item.quantity)
          );
        }
      }

      const syncedSale: Sale = { ...sale, syncStatus: 'synced' };

      await runTransaction(db, async (tx) => {
        const productIds = Array.from(consolidatedDeductions.keys());
        const prodRefs = productIds.map((pid) => doc(db, 'users', userId, 'products', pid));

        // ALL READS BEFORE ANY WRITES
        const prodSnaps = await Promise.all(prodRefs.map((ref) => tx.get(ref)));

        const preparedUpdates: Array<{
          ref: ReturnType<typeof doc>;
          patch: Record<string, unknown>;
          kardex: KardexEntry;
        }> = [];

        for (let i = 0; i < productIds.length; i++) {
          const pid = productIds[i];
          const snap = prodSnaps[i];
          const qtyToDeduct = consolidatedDeductions.get(pid) || 0;
          if (!snap.exists()) {
            throw new Error(`Uno de los productos del carrito ya no existe en el catálogo (${pid}).`);
          }
          const liveProd = snap.data() as Product;
          const liveStock = round2(Number(liveProd.stock) || 0);

          if (liveStock + 0.0001 < qtyToDeduct) {
            throw new Error(
              `Stock insuficiente para "${liveProd.name}": disponible ${liveStock} ${liveProd.unit || 'und'}, solicitado ${qtyToDeduct}.`
            );
          }

          const prevFifoVal = computeFifoValuationUSDTx(liveProd, liveStock);
          const fifoRes = deductFifoBatchesTx(liveProd.batches, qtyToDeduct, liveProd, bcvRate, baseCurrency);
          const nextStock = Math.max(0, round2(liveStock - qtyToDeduct));

          const patch: Record<string, unknown> = { stock: nextStock };
          if (liveProd.batches && liveProd.batches.length > 0 && fifoRes.batches !== undefined) {
            patch.batches = cleanForFirestore(fifoRes.batches);
          }
          if (fifoRes.priceUSD !== undefined) patch.priceUSD = fifoRes.priceUSD;
          if (fifoRes.costUSD !== undefined) patch.costUSD = fifoRes.costUSD;
          if (fifoRes.priceBsFixed !== undefined) patch.priceBsFixed = fifoRes.priceBsFixed;

          const updatedProd: Product = {
            ...liveProd,
            stock: nextStock,
            batches: fifoRes.batches,
            ...(fifoRes.priceUSD !== undefined ? { priceUSD: fifoRes.priceUSD } : {}),
            ...(fifoRes.costUSD !== undefined ? { costUSD: fifoRes.costUSD } : {}),
            ...(fifoRes.priceBsFixed !== undefined ? { priceBsFixed: fifoRes.priceBsFixed } : {})
          };

          const hasFifoBatches = Boolean(liveProd.batches && liveProd.batches.length > 0);
          const nextFifoVal = computeFifoValuationUSDTx(updatedProd, nextStock);
          const unitCostForKardex =
            hasFifoBatches && qtyToDeduct > 0 && prevFifoVal > nextFifoVal
              ? round2((prevFifoVal - nextFifoVal) / qtyToDeduct)
              : (liveProd.costUSD || 0);

          const kardex = buildKardexEntryTx({
            product: updatedProd,
            type: 'venta',
            quantityChange: -qtyToDeduct,
            previousStock: liveStock,
            newStock: nextStock,
            unitCostUSD: unitCostForKardex,
            valuationMethod: hasFifoBatches ? 'fifo' : 'average_cost',
            reference: syncedSale.invoiceNumber,
            notes: `Venta POS a ${syncedSale.clientName}`,
            userName: syncedSale.cashierName,
            date: syncedSale.date
          });

          preparedUpdates.push({ ref: prodRefs[i], patch, kardex });
        }

        // ALL WRITES
        const saleRef = doc(db, 'users', userId, 'sales', syncedSale.id);
        tx.set(saleRef, cleanForFirestore(syncedSale));

        for (const item of preparedUpdates) {
          tx.update(item.ref, item.patch);
          const kRef = doc(db, 'users', userId, 'kardex', item.kardex.id);
          tx.set(kRef, cleanForFirestore(item.kardex));
        }

        if (newFiado) {
          const fiadoRef = doc(db, 'users', userId, 'fiados', newFiado.id);
          tx.set(fiadoRef, cleanForFirestore(newFiado));
        }
      });

      devLog(`[PosVenecia Firestore] Venta ${syncedSale.invoiceNumber} confirmada transaccionalmente.`);
      return syncedSale;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

export const updateSaleInFirestore = async (uid: string, sale: Sale): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/sales/${sale.id}`;
  const op = (async () => {
    try {
      await setDoc(doc(db, 'users', userId, 'sales', sale.id), cleanForFirestore(sale), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic write for cancelSale (`runTransaction`):
 * Prevents double-restoration across devices by verifying live sale status !== 'anulada'
 * and restoring only unreturned quantities (qty - returnedQuantities).
 */
export const cancelSaleAtomic = async (
  uid: string,
  saleId: string,
  associatedFiadoId?: string,
  userName?: string
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/sales/${saleId}`;
  const op = (async () => {
    try {
      // Find any fiados linked to this saleId outside transaction to cover multi-device cases
      const fiadoQuerySnap = await getDocs(
        query(collection(db, 'users', userId, 'fiados'), where('saleId', '==', saleId))
      );
      const fiadoIds = new Set<string>(fiadoQuerySnap.docs.map((d) => d.id));
      if (associatedFiadoId) fiadoIds.add(associatedFiadoId);

      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, 'users', userId, 'sales', saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) {
          throw new Error('La venta no fue encontrada en Cloud Firestore.');
        }

        const liveSale = saleSnap.data() as Sale;
        if (liveSale.status === 'anulada') {
          throw new Error('Esta venta ya fue anulada previamente.');
        }

        const restorationMap = new Map<string, number>();
        for (const item of liveSale.items || []) {
          if (!item.product.isService && item.product.itemType !== 'servicio' && item.product.id) {
            const pid = item.product.id;
            const prevReturned = liveSale.returnedQuantities?.[pid] || 0;
            const restorableQty = Math.max(0, round2(item.quantity - prevReturned));
            if (restorableQty > 0) {
              restorationMap.set(pid, round2((restorationMap.get(pid) || 0) + restorableQty));
            }
          }
        }

        const prodIds = Array.from(restorationMap.keys());
        const prodRefs = prodIds.map((pid) => doc(db, 'users', userId, 'products', pid));
        const fiadoRefs = Array.from(fiadoIds).map((fid) => doc(db, 'users', userId, 'fiados', fid));

        // Read all products & linked fiados BEFORE any writes
        const [prodSnaps, fiadoSnaps] = await Promise.all([
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          Promise.all(fiadoRefs.map((ref) => tx.get(ref)))
        ]);

        const prodUpdates: Array<{
          ref: ReturnType<typeof doc>;
          patch: Record<string, unknown>;
          kardex: KardexEntry;
        }> = [];

        for (let i = 0; i < prodIds.length; i++) {
          const snap = prodSnaps[i];
          if (!snap.exists()) continue;
          const liveProd = snap.data() as Product;
          const qty = restorationMap.get(prodIds[i]) || 0;
          if (qty <= 0) continue;

          const prevStock = round2(Number(liveProd.stock) || 0);
          const nextStock = round2(prevStock + qty);
          const restoredBatches = restoreFifoBatchesTx(
            liveProd.batches,
            qty,
            liveProd,
            `ANUL-${liveSale.invoiceNumber}`
          );

          const patch: Record<string, unknown> = { stock: nextStock };
          if (restoredBatches !== undefined) {
            patch.batches = cleanForFirestore(restoredBatches);
          }

          const updatedProd: Product = {
            ...liveProd,
            stock: nextStock,
            ...(restoredBatches !== undefined ? { batches: restoredBatches } : {})
          };

          const kardex = buildKardexEntryTx({
            product: updatedProd,
            type: 'ajuste_manual',
            quantityChange: qty,
            previousStock: prevStock,
            newStock: nextStock,
            unitCostUSD: liveProd.costUSD || 0,
            valuationMethod: updatedProd.batches && updatedProd.batches.length > 0 ? 'fifo' : 'average_cost',
            reference: `ANUL-${liveSale.invoiceNumber}`,
            notes: `Reintegro por anulación de factura ${liveSale.invoiceNumber}`,
            userName
          });

          prodUpdates.push({ ref: prodRefs[i], patch, kardex });
        }

        // ALL WRITES
        tx.update(saleRef, { status: 'anulada' });

        for (const u of prodUpdates) {
          tx.update(u.ref, u.patch);
          tx.set(doc(db, 'users', userId, 'kardex', u.kardex.id), cleanForFirestore(u.kardex));
        }

        for (let i = 0; i < fiadoRefs.length; i++) {
          if (fiadoSnaps[i].exists()) {
            tx.update(fiadoRefs[i], {
              status: 'saldado',
              remainingDebtUSD: 0,
              notes: '[VENTA ANULADA EN POS] Fiado cancelado automáticamente por anulación de factura.'
            });
          }
        }
      });

      devLog(`[PosVenecia Firestore] Venta ${saleId} anulada transaccionalmente.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic write for saveCreditNoteAtomic (`runTransaction`):
 * Validates live returnedQuantities on the server Sale doc to avoid race conditions
 * on partial returns from multiple devices, restores live stock + FIFO, creates NC, updates Fiado & Kardex.
 */
export const saveCreditNoteAtomic = async (
  uid: string,
  params: {
    creditNoteId: string;
    saleId: string;
    reason: string;
    refundMethod: PaymentMethod;
    items: Array<{ productId: string; quantity: number }>;
    creditNoteNumber: string;
    controlNumber: string;
    originalInvoiceNumber: string;
    originalControlNumber: string;
    fallbackBcvRate: number;
    cashierName: string;
  }
): Promise<CreditNote> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/creditNotes/${params.creditNoteId}`;
  const op = (async (): Promise<CreditNote> => {
    try {
      const ncCol = collection(db, 'users', userId, 'creditNotes');
      const [dupNcNumSnap, dupNcCtrlSnap, priorNcSnap, linkedFiadoSnap] = await Promise.all([
        getDocs(query(ncCol, where('creditNoteNumber', '==', params.creditNoteNumber))),
        getDocs(query(ncCol, where('controlNumber', '==', params.controlNumber))),
        getDocs(query(ncCol, where('saleId', '==', params.saleId))),
        getDocs(query(collection(db, 'users', userId, 'fiados'), where('saleId', '==', params.saleId)))
      ]);

      if (!dupNcNumSnap.empty) {
        throw new Error(`El Número de Nota de Crédito "${params.creditNoteNumber}" ya fue registrado anteriormente.`);
      }
      if (!dupNcCtrlSnap.empty) {
        throw new Error(`El Número de Control SENIAT "${params.controlNumber}" ya fue utilizado en otra nota de crédito.`);
      }

      const priorCreditNotesForSale = priorNcSnap.docs.map((d) => d.data() as CreditNote);
      const fiadoIds = linkedFiadoSnap.docs.map((d) => d.id);

      let createdNC: CreditNote | null = null;

      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, 'users', userId, 'sales', params.saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) {
          throw new Error('Venta no encontrada en Firestore.');
        }

        const liveSale = saleSnap.data() as Sale;
        if (liveSale.status === 'anulada') {
          throw new Error('No se puede emitir una nota de crédito sobre una factura anulada.');
        }

        // Compute live already-returned quantities
        const priorReturnedMap: Record<string, number> = {};
        if (liveSale.returnedQuantities) {
          Object.entries(liveSale.returnedQuantities).forEach(([pid, q]) => {
            priorReturnedMap[pid] = Math.max(0, Number(q) || 0);
          });
        } else {
          priorCreditNotesForSale.forEach((nc) => {
            nc.items.forEach((ncItem) => {
              priorReturnedMap[ncItem.productId] = (priorReturnedMap[ncItem.productId] || 0) + ncItem.quantity;
            });
          });
        }

        let refundedSubtotalUSD = 0;
        let refundedTaxableUSD = 0;
        let refundedExemptUSD = 0;
        const ncItems: CreditNoteItem[] = [];
        const stockRestorationMap = new Map<string, number>();
        const nextReturnedQuantities: Record<string, number> = { ...priorReturnedMap };

        for (const itemReq of params.items) {
          const originalItem = liveSale.items.find((i) => i.product.id === itemReq.productId);
          if (!originalItem) continue;

          const alreadyReturned = priorReturnedMap[originalItem.product.id] || 0;
          const maxReturnable = Math.max(0, round2(originalItem.quantity - alreadyReturned));
          if (maxReturnable <= 0) {
            throw new Error(`El producto "${originalItem.product.name}" ya fue devuelto en su totalidad (${originalItem.quantity} und).`);
          }

          const requestedQty = Number(itemReq.quantity) || 0;
          if (requestedQty <= 0) continue;

          if (requestedQty > maxReturnable) {
            throw new Error(
              `La cantidad a devolver de "${originalItem.product.name}" (${requestedQty}) supera el saldo disponible (${maxReturnable} de ${originalItem.quantity} vendidas).`
            );
          }

          nextReturnedQuantities[originalItem.product.id] = round2(alreadyReturned + requestedQty);
          const unitPriceUSD = originalItem.unitPriceUSD;
          const totalItemUSD = round2(requestedQty * unitPriceUSD);
          refundedSubtotalUSD = round2(refundedSubtotalUSD + totalItemUSD);

          if (originalItem.product.isExemptFromIVA) {
            refundedExemptUSD = round2(refundedExemptUSD + totalItemUSD);
          } else {
            refundedTaxableUSD = round2(refundedTaxableUSD + totalItemUSD);
          }

          ncItems.push({
            productId: originalItem.product.id,
            productName: originalItem.product.name,
            quantity: requestedQty,
            unitPriceUSD,
            totalUSD: totalItemUSD,
            isExemptFromIVA: Boolean(originalItem.product.isExemptFromIVA)
          });

          if (!originalItem.product.isService && originalItem.product.itemType !== 'servicio') {
            stockRestorationMap.set(
              originalItem.product.id,
              round2((stockRestorationMap.get(originalItem.product.id) || 0) + requestedQty)
            );
          }
        }

        if (ncItems.length === 0) {
          throw new Error('No se seleccionaron productos válidos para devolución.');
        }

        const prodIds = Array.from(stockRestorationMap.keys());
        const prodRefs = prodIds.map((pid) => doc(db, 'users', userId, 'products', pid));
        const fiadoRefs = fiadoIds.map((fid) => doc(db, 'users', userId, 'fiados', fid));

        // Read all remaining docs BEFORE any writes
        const [prodSnaps, fiadoSnaps] = await Promise.all([
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          Promise.all(fiadoRefs.map((ref) => tx.get(ref)))
        ]);

        const remainingIvaBudget = round2(
          Math.max(
            0,
            liveSale.ivaUSD - priorCreditNotesForSale.reduce((sum, nc) => sum + (nc.ivaUSD || 0), 0)
          )
        );
        const refundedIvaUSD = liveSale.ivaUSD > 0 ? Math.min(remainingIvaBudget, round2(refundedTaxableUSD * 0.16)) : 0;

        const remainingIgtfBudget = round2(
          Math.max(
            0,
            liveSale.igtfUSD - priorCreditNotesForSale.reduce((sum, nc) => sum + (nc.igtfUSD || 0), 0)
          )
        );
        const refundedIgtfUSD =
          liveSale.igtfUSD > 0 && params.refundMethod === 'efectivo_usd'
            ? Math.min(remainingIgtfBudget, round2((refundedSubtotalUSD + refundedIvaUSD) * 0.03))
            : 0;

        const refundedTotalUSD = round2(refundedSubtotalUSD + refundedIvaUSD + refundedIgtfUSD);
        const bcv = liveSale.bcvRate || params.fallbackBcvRate;
        const nowIso = new Date().toISOString();

        const newCreditNote: CreditNote = {
          id: params.creditNoteId,
          creditNoteNumber: params.creditNoteNumber,
          controlNumber: params.controlNumber,
          saleId: liveSale.id,
          originalInvoiceNumber: params.originalInvoiceNumber,
          originalControlNumber: params.originalControlNumber,
          date: nowIso,
          clientName: liveSale.clientName || 'Consumidor Final',
          clientRIF: liveSale.clientRIF || 'V-00000000',
          clientPhone: liveSale.clientPhone,
          clientAddress: liveSale.clientAddress,
          items: ncItems,
          subtotalUSD: round2(refundedSubtotalUSD),
          exemptUSD: round2(refundedExemptUSD),
          taxableUSD: round2(refundedTaxableUSD),
          ivaUSD: refundedIvaUSD,
          igtfUSD: refundedIgtfUSD,
          totalUSD: refundedTotalUSD,
          subtotalBs: round2(refundedSubtotalUSD * bcv),
          exemptBs: round2(refundedExemptUSD * bcv),
          taxableBs: round2(refundedTaxableUSD * bcv),
          ivaBs: round2(refundedIvaUSD * bcv),
          igtfBs: round2(refundedIgtfUSD * bcv),
          totalBs: round2(refundedTotalUSD * bcv),
          bcvRate: bcv,
          refundMethod: params.refundMethod,
          reason: params.reason,
          cashierName: params.cashierName,
          syncStatus: 'synced'
        };
        createdNC = newCreditNote;

        const prodUpdates: Array<{
          ref: ReturnType<typeof doc>;
          patch: Record<string, unknown>;
          kardex: KardexEntry;
        }> = [];

        for (let i = 0; i < prodIds.length; i++) {
          const snap = prodSnaps[i];
          if (!snap.exists()) continue;
          const liveProd = snap.data() as Product;
          const addQty = stockRestorationMap.get(prodIds[i]) || 0;
          if (addQty <= 0) continue;

          const prevStock = round2(Number(liveProd.stock) || 0);
          const nextStock = round2(prevStock + addQty);
          const restoredBatches = restoreFifoBatchesTx(liveProd.batches, addQty, liveProd, params.creditNoteNumber);

          const patch: Record<string, unknown> = { stock: nextStock };
          if (restoredBatches !== undefined) {
            patch.batches = cleanForFirestore(restoredBatches);
          }

          const updatedProd: Product = {
            ...liveProd,
            stock: nextStock,
            ...(restoredBatches !== undefined ? { batches: restoredBatches } : {})
          };

          const kardex = buildKardexEntryTx({
            product: updatedProd,
            type: 'nota_credito',
            quantityChange: addQty,
            previousStock: prevStock,
            newStock: nextStock,
            unitCostUSD: liveProd.costUSD || 0,
            valuationMethod: updatedProd.batches && updatedProd.batches.length > 0 ? 'fifo' : 'average_cost',
            reference: params.creditNoteNumber,
            notes: `Devolución s/factura ${params.originalInvoiceNumber} (${params.reason})`,
            userName: params.cashierName,
            date: nowIso
          });

          prodUpdates.push({ ref: prodRefs[i], patch, kardex });
        }

        const isFullyReturned = liveSale.items.every(
          (item) => (nextReturnedQuantities[item.product.id] || 0) >= item.quantity
        );

        // ALL WRITES
        tx.set(doc(db, 'users', userId, 'creditNotes', newCreditNote.id), cleanForFirestore(newCreditNote));
        tx.update(saleRef, {
          status: isFullyReturned ? 'devuelta' : liveSale.status,
          returnedQuantities: nextReturnedQuantities,
          creditNoteId: newCreditNote.id,
          refundedUSD: round2((liveSale.refundedUSD || 0) + refundedTotalUSD)
        });

        for (const u of prodUpdates) {
          tx.update(u.ref, u.patch);
          tx.set(doc(db, 'users', userId, 'kardex', u.kardex.id), cleanForFirestore(u.kardex));
        }

        for (let i = 0; i < fiadoRefs.length; i++) {
          const fSnap = fiadoSnaps[i];
          if (!fSnap.exists()) continue;
          const liveFiado = fSnap.data() as FiadoRecord;
          if (liveFiado.status === 'saldado') continue;
          const nextRemaining = round2(Math.max(0, liveFiado.remainingDebtUSD - refundedTotalUSD));
          tx.update(fiadoRefs[i], {
            remainingDebtUSD: nextRemaining,
            status: nextRemaining <= 0.009 ? 'saldado' : liveFiado.status,
            notes: `${liveFiado.notes ? `${liveFiado.notes} | ` : ''}[NC ${params.creditNoteNumber}] Devolución -$${refundedTotalUSD.toFixed(2)}`
          });
        }
      });

      if (!createdNC) {
        throw new Error('No se pudo emitir la Nota de Crédito.');
      }
      devLog(`[PosVenecia Firestore] Nota de Crédito ${params.creditNoteNumber} confirmada transaccionalmente.`);
      return createdNC;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic write for saveInventoryDischargeAtomic (`runTransaction`):
 * Validates live stock >= discharge.quantity inside transaction, deducts stock + FIFO batches, writes Kardex & Gasto.
 */
export const saveInventoryDischargeAtomic = async (
  uid: string,
  discharge: InventoryDischarge,
  associatedGastoOperativo: GastoOperativo,
  bcvRate: number,
  baseCurrency: BaseCurrency,
  associatedExpense?: Expense
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/inventoryDischarges/${discharge.id}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'users', userId, 'products', discharge.productId);
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists()) {
          throw new Error(`El producto "${discharge.productName}" ya no existe en inventario.`);
        }
        const liveProd = prodSnap.data() as Product;
        const liveStock = round2(Number(liveProd.stock) || 0);
        if (liveStock + 0.0001 < discharge.quantity) {
          throw new Error(
            `Stock insuficiente para desincorporar "${liveProd.name}": disponible ${liveStock}, solicitado ${discharge.quantity}.`
          );
        }

        const fifoRes = deductFifoBatchesTx(liveProd.batches, discharge.quantity, liveProd, bcvRate, baseCurrency);
        const updatedBatches = liveProd.batches && liveProd.batches.length > 0 ? fifoRes.batches : undefined;
        const nextStock = Math.max(0, round2(liveStock - discharge.quantity));

        const updatedProd: Product = {
          ...liveProd,
          stock: nextStock,
          ...(updatedBatches !== undefined ? { batches: updatedBatches } : {})
        };

        const kardexEntry = buildKardexEntryTx({
          product: updatedProd,
          type: 'merma',
          quantityChange: -discharge.quantity,
          previousStock: liveStock,
          newStock: nextStock,
          unitCostUSD: discharge.unitCostUSD,
          valuationMethod: updatedBatches && updatedBatches.length > 0 ? 'fifo' : 'average_cost',
          reference: discharge.dischargeNumber,
          notes: `${discharge.reason}${discharge.notes ? `: ${discharge.notes}` : ''}`,
          userName: discharge.responsibleName,
          date: discharge.date
        });

        const prodPatch: Record<string, unknown> = { stock: nextStock };
        if (updatedBatches !== undefined) {
          prodPatch.batches = cleanForFirestore(updatedBatches);
        }

        // ALL WRITES
        tx.set(doc(db, 'users', userId, 'inventoryDischarges', discharge.id), cleanForFirestore(discharge));
        tx.update(prodRef, prodPatch);
        tx.set(doc(db, 'users', userId, 'gastosOperativos', associatedGastoOperativo.id), cleanForFirestore(associatedGastoOperativo));
        if (associatedExpense) {
          tx.set(doc(db, 'users', userId, 'expenses', associatedExpense.id), cleanForFirestore(associatedExpense));
        }
        tx.set(doc(db, 'users', userId, 'kardex', kardexEntry.id), cleanForFirestore(kardexEntry));
      });
      devLog(`[PosVenecia Firestore] Desincorporación ${discharge.dischargeNumber} guardada transaccionalmente.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
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
      const cleaned = cleanForFirestore(product) as unknown as Record<string, unknown>;
      if (product.priceBsFixed === undefined) cleaned.priceBsFixed = deleteField();
      if (product.costBsFixed === undefined) cleaned.costBsFixed = deleteField();
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
      const cleaned = cleanForFirestore(product) as unknown as Record<string, unknown>;
      if (product.priceBsFixed === undefined) cleaned.priceBsFixed = deleteField();
      if (product.costBsFixed === undefined) cleaned.costBsFixed = deleteField();
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

/**
 * Transactional stock adjustment (`runTransaction`): reads live stock on server so
 * Kardex previousStock/newStock accurately reflect concurrent POS activity.
 */
export const adjustProductStockInFirestore = async (
  uid: string,
  productId: string,
  newStock: number,
  kardexMeta?: { reference: string; notes: string; userName?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/products/${productId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'users', userId, 'products', productId);
        const snap = await tx.get(prodRef);
        if (!snap.exists()) {
          throw new Error('Producto no encontrado en Firestore.');
        }
        const liveProd = snap.data() as Product;
        const prevStock = round2(Number(liveProd.stock) || 0);
        const safeStock = Math.max(0, round2(newStock));
        const isPhysical = !liveProd.isService && liveProd.itemType !== 'servicio';

        tx.update(prodRef, { stock: safeStock });

        if (isPhysical && prevStock !== safeStock) {
          const updatedProd: Product = { ...liveProd, stock: safeStock };
          const kardex = buildKardexEntryTx({
            product: updatedProd,
            type: 'ajuste_manual',
            quantityChange: round2(safeStock - prevStock),
            previousStock: prevStock,
            newStock: safeStock,
            unitCostUSD: liveProd.costUSD || 0,
            valuationMethod: liveProd.batches && liveProd.batches.length > 0 ? 'fifo' : 'average_cost',
            reference: kardexMeta?.reference || 'AJUSTE-RAPIDO',
            notes: kardexMeta?.notes || 'Ajuste manual directo desde catálogo',
            userName: kardexMeta?.userName
          });
          tx.set(doc(db, 'users', userId, 'kardex', kardex.id), cleanForFirestore(kardex));
        }
      });
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

/**
 * Transactional atomic write for purchase invoice + inventory entry + supplier balance + Kardex (`runTransaction`):
 * Always adds purchased stock on top of LIVE server stock so concurrent POS sales on another device are never lost.
 */
export const saveExpenseWithInventoryAtomic = async (
  uid: string,
  expense: Expense,
  bcvRate: number,
  baseCurrency: BaseCurrency,
  linkedCuenta?: CuentaPorPagar,
  userName?: string
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const items = expense.items || [];
        const uniqueProdIds = Array.from(new Set(items.map((it) => it.productId).filter(Boolean)));
        const prodRefs = uniqueProdIds.map((pid) => doc(db, 'users', userId, 'products', pid));
        const supplierRef =
          linkedCuenta && expense.supplierId
            ? doc(db, 'users', userId, 'suppliers', expense.supplierId)
            : null;

        // ALL READS FIRST
        const [prodSnaps, supSnap] = await Promise.all([
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          supplierRef ? tx.get(supplierRef) : Promise.resolve(null)
        ]);

        const liveProdMap = new Map<string, Product>();
        prodSnaps.forEach((snap, idx) => {
          if (snap.exists()) {
            liveProdMap.set(uniqueProdIds[idx], snap.data() as Product);
          }
        });

        const updatedProdIds = new Set<string>();
        const kardexEntries: KardexEntry[] = [];

        for (const item of items) {
          const prod = liveProdMap.get(item.productId);
          if (!prod) continue;

          const incomingQty = Math.max(0, item.quantity);
          const incomingCostUSD = round6(Math.max(0, item.unitCostUSD));
          const previousStock = round2(Number(prod.stock) || 0);
          const nextStock = round2(previousStock + incomingQty);

          const nextProd: Product = { ...prod, stock: nextStock };
          if (item.costCurrency === 'Bs' && typeof item.unitCostBs === 'number' && item.unitCostBs >= 0) {
            nextProd.costBsFixed = round2(item.unitCostBs);
            nextProd.costCurrency = 'Bs';
          } else {
            nextProd.costCurrency = 'USD';
            nextProd.costBsFixed = undefined;
          }

          if (item.strategy === 'fifo') {
            if (!nextProd.costUSD || nextProd.costUSD <= 0) {
              nextProd.costUSD = incomingCostUSD;
            }
            const newBatch: ProductBatch = {
              id: 'batch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              invoiceNumber: expense.invoiceNumber,
              supplierName: expense.supplierName,
              date: expense.date,
              quantity: incomingQty,
              initialQuantity: incomingQty,
              costUSD: incomingCostUSD,
              targetPriceUSD: item.newPriceUSD && item.newPriceUSD > 0 ? round2(item.newPriceUSD) : nextProd.priceUSD
            };
            nextProd.batches = [...(nextProd.batches || []), newBatch];
            nextProd.purchaseNote = `Lote Factura ${expense.invoiceNumber} (${incomingQty} unids a $${incomingCostUSD.toFixed(2)})`;
          } else {
            const previousCost =
              item.previousCostUSD !== undefined && item.previousCostUSD > 0
                ? item.previousCostUSD
                : (nextProd.costUSD > 0 ? nextProd.costUSD : incomingCostUSD);
            const previousPrice =
              item.previousPriceUSD !== undefined && item.previousPriceUSD > 0
                ? item.previousPriceUSD
                : nextProd.priceUSD;

            const weightedAvgCost =
              previousStock + incomingQty > 0
                ? round6(((previousStock * previousCost) + (incomingQty * incomingCostUSD)) / (previousStock + incomingQty))
                : incomingCostUSD;

            nextProd.costUSD = weightedAvgCost > 0 ? weightedAvgCost : incomingCostUSD;
            if (item.newPriceUSD && item.newPriceUSD > 0) {
              nextProd.priceUSD = round2(item.newPriceUSD);
            } else {
              const margin = previousCost > 0 ? (previousPrice - previousCost) / previousCost : 0.30;
              nextProd.priceUSD = round2(incomingCostUSD * (1 + Math.max(0, margin)));
            }

            if (baseCurrency === 'VED') {
              nextProd.priceBsFixed = round2(nextProd.priceUSD * bcvRate);
              nextProd.priceCurrency = 'Bs';
            }

            nextProd.purchaseNote = `Actualizado Factura ${expense.invoiceNumber} - Costo Prom. $${nextProd.costUSD.toFixed(2)} / Venta $${nextProd.priceUSD.toFixed(2)}`;
          }

          liveProdMap.set(nextProd.id, nextProd);
          updatedProdIds.add(nextProd.id);

          if (!nextProd.isService && nextProd.itemType !== 'servicio' && incomingQty > 0) {
            kardexEntries.push(
              buildKardexEntryTx({
                product: nextProd,
                type: 'entrada_compra',
                quantityChange: incomingQty,
                previousStock,
                newStock: nextProd.stock,
                unitCostUSD: incomingCostUSD,
                valuationMethod: item.strategy,
                reference: expense.invoiceNumber,
                notes: `Compra a ${expense.supplierName} (${item.strategy === 'fifo' ? 'Lote FIFO' : 'Costo Promedio'})`,
                userName,
                date: expense.date
              })
            );
          }
        }

        // ALL WRITES
        tx.set(doc(db, 'users', userId, 'expenses', expense.id), cleanForFirestore(expense), { merge: true });

        for (const pid of updatedProdIds) {
          const prodToWrite = liveProdMap.get(pid);
          if (!prodToWrite) continue;
          const cleanedProd = cleanForFirestore(prodToWrite) as unknown as Record<string, unknown>;
          if (prodToWrite.costBsFixed === undefined) cleanedProd.costBsFixed = deleteField();
          if (prodToWrite.priceBsFixed === undefined) cleanedProd.priceBsFixed = deleteField();
          tx.set(doc(db, 'users', userId, 'products', pid), cleanedProd, { merge: true });
        }

        if (linkedCuenta) {
          tx.set(
            doc(db, 'users', userId, 'cuentasPorPagar', linkedCuenta.id),
            cleanForFirestore(linkedCuenta),
            { merge: true }
          );
          if (supplierRef && supSnap && supSnap.exists()) {
            const liveSup = supSnap.data() as Supplier;
            const nextBal = round2((Number(liveSup.accumulatedBalanceUSD) || 0) + (linkedCuenta.remainingUSD || 0));
            tx.update(supplierRef, { accumulatedBalanceUSD: nextBal });
          }
        }

        for (const kEntry of kardexEntries) {
          tx.set(doc(db, 'users', userId, 'kardex', kEntry.id), cleanForFirestore(kEntry));
        }
      });

      devLog(`[PosVenecia Firestore] Factura ${expense.invoiceNumber} guardada transaccionalmente.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
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

/**
 * Transactional atomic abono for FiadoRecord (`runTransaction`):
 * Prevents overwriting concurrent abonos or over-paying across devices.
 */
export const addAbonoToFiadoTransaction = async (
  uid: string,
  fiadoId: string,
  amountUSD: number,
  method: PaymentMethod,
  bcvRate: number,
  reference?: string,
  notes?: string
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/fiados/${fiadoId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const fiadoRef = doc(db, 'users', userId, 'fiados', fiadoId);
        const snap = await tx.get(fiadoRef);
        if (!snap.exists()) {
          throw new Error('Registro de deuda (fiado) no encontrado.');
        }
        const live = snap.data() as FiadoRecord;
        const liveRemaining = round2(Number(live.remainingDebtUSD) || 0);
        if (liveRemaining <= 0.009) {
          throw new Error('Esta cuenta por cobrar ya fue saldada completamente.');
        }

        const payUSD = Math.min(liveRemaining, Math.max(0.01, round2(amountUSD)));
        const newRemaining = round2(Math.max(0, liveRemaining - payUSD));
        const newAbono: Abono = {
          id: 'abono-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: new Date().toISOString(),
          amountUSD: payUSD,
          amountBs: round2(payUSD * bcvRate),
          bcvRate,
          paymentMethod: method,
          reference,
          notes
        };

        tx.update(fiadoRef, {
          remainingDebtUSD: newRemaining,
          status: newRemaining <= 0.009 ? 'saldado' : 'parcial',
          abonos: cleanForFirestore([newAbono, ...(live.abonos || [])])
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
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

export const updateClientInFirestore = async (uid: string, client: Client): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/clients/${client.id}`;
  const op = (async () => {
    try {
      const clientRef = doc(db, 'users', userId, 'clients', client.id);
      const cleaned = cleanForFirestore(client) as unknown as Record<string, any>;
      if (!client.address) cleaned.address = deleteField();
      if (!client.email) cleaned.email = deleteField();
      if (!client.notes) cleaned.notes = deleteField();
      try {
        await updateDoc(clientRef, cleaned);
      } catch (err: any) {
        if (err?.code === 'not-found') {
          await setDoc(clientRef, cleanForFirestore(client), { merge: true });
        } else {
          throw err;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
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

export const updateSupplierInFirestore = async (uid: string, supplier: Supplier): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/suppliers/${supplier.id}`;
  const op = (async () => {
    try {
      const supplierRef = doc(db, 'users', userId, 'suppliers', supplier.id);
      const cleaned = cleanForFirestore(supplier) as unknown as Record<string, any>;
      if (!supplier.address) cleaned.address = deleteField();
      if (!supplier.email) cleaned.email = deleteField();
      if (!supplier.notes) cleaned.notes = deleteField();
      try {
        await updateDoc(supplierRef, cleaned);
      } catch (err: any) {
        if (err?.code === 'not-found') {
          await setDoc(supplierRef, cleanForFirestore(supplier), { merge: true });
        } else {
          throw err;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
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

/**
 * Transactional atomic abono for CuentaPorPagar (`runTransaction`):
 * Reads live CuentaPorPagar & Supplier, applies payment, decrements supplier balance, and writes cash outflow Expense.
 */
export const addAbonoToCuentaPorPagarTransaction = async (
  uid: string,
  cuentaId: string,
  amountUSD: number,
  method: PaymentMethod,
  bcvRate: number,
  reference?: string,
  notes?: string
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cuentasPorPagar/${cuentaId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const cuentaRef = doc(db, 'users', userId, 'cuentasPorPagar', cuentaId);
        const cuentaSnap = await tx.get(cuentaRef);
        if (!cuentaSnap.exists()) {
          throw new Error('Cuenta por pagar no encontrada en Firestore.');
        }

        const liveCuenta = cuentaSnap.data() as CuentaPorPagar;
        const liveRemaining = round2(Number(liveCuenta.remainingUSD) || 0);
        if (liveRemaining <= 0.009) {
          throw new Error('Esta factura de proveedor ya fue pagada completamente.');
        }

        const supRef = liveCuenta.supplierId
          ? doc(db, 'users', userId, 'suppliers', liveCuenta.supplierId)
          : null;
        const supSnap = supRef ? await tx.get(supRef) : null;

        const payAmount = Math.min(liveRemaining, Math.max(0.01, round2(amountUSD)));
        const newPaid = round2((Number(liveCuenta.paidAmountUSD) || 0) + payAmount);
        const newRemaining = round2(Math.max(0, liveCuenta.totalAmountUSD - newPaid));
        const nowIso = new Date().toISOString();
        const payBs = round2(payAmount * bcvRate);

        const newAbono: Abono = {
          id: 'abono-cpp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          amountUSD: payAmount,
          amountBs: payBs,
          bcvRate,
          paymentMethod: method,
          reference,
          notes: notes || 'Abono realizado a proveedor'
        };

        const cashOutflowExpense: Expense = {
          id: 'exp-cpp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          invoiceNumber: liveCuenta.invoiceNumber || 'CPP-ABONO',
          controlNumber: liveCuenta.controlNumber || '00-00000',
          supplierId: liveCuenta.supplierId,
          supplierName: liveCuenta.supplierName,
          supplierRIF: liveCuenta.supplierRIF || 'N/A',
          supplierPhone: liveCuenta.supplierPhone,
          description: `Abono Cta. por Pagar (${liveCuenta.invoiceNumber}): ${liveCuenta.description}${notes ? ` - ${notes}` : ''}`,
          category:
            liveCuenta.category === 'Alquiler' || liveCuenta.category === 'Servicios' || liveCuenta.category === 'Mantenimiento'
              ? liveCuenta.category
              : liveCuenta.category === 'Mercancía' || liveCuenta.category === 'Materia Prima'
              ? 'Mercancía'
              : 'Otros',
          amountUSD: payAmount,
          amountBs: payBs,
          baseImponibleBs: payBs,
          ivaBs: 0,
          retencionIVABs: 0,
          retencionISLRBs: 0,
          bcvRate,
          paymentMethod: mapMethodToExpenseMethod(method),
          reference,
          linkedCuentaId: liveCuenta.id
        };

        // ALL WRITES
        tx.update(cuentaRef, {
          paidAmountUSD: newPaid,
          remainingUSD: newRemaining,
          status: newRemaining <= 0.009 ? 'pagada' : 'parcial',
          abonos: cleanForFirestore([newAbono, ...(liveCuenta.abonos || [])])
        });
        tx.set(doc(db, 'users', userId, 'expenses', cashOutflowExpense.id), cleanForFirestore(cashOutflowExpense));

        if (supRef && supSnap && supSnap.exists()) {
          const liveSup = supSnap.data() as Supplier;
          const nextBal = Math.max(0, round2((Number(liveSup.accumulatedBalanceUSD) || 0) - payAmount));
          tx.update(supRef, { accumulatedBalanceUSD: nextBal });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
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

/**
 * Transactional atomic payment for GastoOperativo (`runTransaction`)
 */
export const markGastoOperativoPagadoTransaction = async (
  uid: string,
  gastoId: string,
  paymentMethod: PaymentMethod,
  bcvRate: number,
  reference?: string,
  amountUSD?: number,
  notes?: string
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/gastosOperativos/${gastoId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const gastoRef = doc(db, 'users', userId, 'gastosOperativos', gastoId);
        const snap = await tx.get(gastoRef);
        if (!snap.exists()) {
          throw new Error('Gasto operativo no encontrado en Firestore.');
        }
        const liveTarget = snap.data() as GastoOperativo;
        const currentPaid = round2(liveTarget.paidAmountUSD ?? (liveTarget.status === 'pagado' ? liveTarget.amountUSD : 0));
        const currentRemaining = round2(liveTarget.remainingUSD ?? Math.max(0, liveTarget.amountUSD - currentPaid));
        if (currentRemaining <= 0.009) {
          throw new Error('Este gasto operativo ya se encuentra pagado en su totalidad.');
        }

        const requestedAmount =
          amountUSD !== undefined && !isNaN(amountUSD) && amountUSD > 0
            ? round2(amountUSD)
            : currentRemaining;
        const payAmount = Math.min(currentRemaining, Math.max(0.01, requestedAmount));
        const payAmountBs = round2(payAmount * bcvRate);
        const newPaid = round2(currentPaid + payAmount);
        const newRemaining = round2(Math.max(0, liveTarget.amountUSD - newPaid));
        const newStatus: GastoOperativo['status'] = newRemaining <= 0.009 ? 'pagado' : 'parcial';
        const nowIso = new Date().toISOString();

        const newAbono: Abono = {
          id: 'abono-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          amountUSD: payAmount,
          amountBs: payAmountBs,
          bcvRate,
          paymentMethod,
          reference,
          notes:
            notes ||
            (newStatus === 'pagado' && currentPaid === 0
              ? 'Pago completo de gasto'
              : newStatus === 'pagado'
              ? 'Liquidación final de saldo pendiente'
              : 'Abono parcial a gasto pendiente')
        };

        const cashOutflowExpense: Expense = {
          id: 'exp-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          invoiceNumber: liveTarget.invoiceNumber || 'REC-GASTO',
          controlNumber: '00-00000',
          supplierName: liveTarget.supplierName || liveTarget.concept,
          supplierRIF: liveTarget.supplierRIF || 'N/A',
          supplierPhone: liveTarget.supplierPhone,
          description: `${newStatus === 'pagado' && currentPaid === 0 ? 'Pago' : 'Abono'} Gasto (${liveTarget.concept})${notes ? ` - ${notes}` : ''}`,
          category: mapGastoCategoryToExpenseCategory(liveTarget.category),
          amountUSD: payAmount,
          amountBs: payAmountBs,
          baseImponibleBs: payAmountBs,
          ivaBs: 0,
          retencionIVABs: 0,
          retencionISLRBs: 0,
          bcvRate,
          paymentMethod: mapMethodToExpenseMethod(paymentMethod),
          reference,
          linkedGastoId: liveTarget.id
        };

        tx.update(gastoRef, {
          paidAmountUSD: newPaid,
          remainingUSD: newRemaining,
          status: newStatus,
          paymentDate: nowIso,
          paymentMethod,
          reference: reference || liveTarget.reference || null,
          abonos: cleanForFirestore([newAbono, ...(liveTarget.abonos || [])])
        });
        tx.set(doc(db, 'users', userId, 'expenses', cashOutflowExpense.id), cleanForFirestore(cashOutflowExpense));
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
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

export const saveSaleAtomicLegacyDeleteHelper = async (uid: string, saleId: string): Promise<void> => {
  return deleteSaleFromFirestore(uid, saleId);
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
 * Fetches an unconditional COMPLETE snapshot of ALL 14 user collections directly from Cloud Firestore.
 * Bypasses active UI date-range filters (`current_month` / `today`) so backups (JSON, Excel, Drive) are 100% lossless.
 */
export const fetchFullStoreSnapshotForBackup = async (
  uid: string,
  userEmail: string = ''
): Promise<BackupDataPayload> => {
  const userId = getCanonicalUserId(uid);
  const [
    productsSnap,
    salesSnap,
    expensesSnap,
    fiadosSnap,
    clientsSnap,
    cppSnap,
    gastosSnap,
    suppliersSnap,
    shiftHistSnap,
    creditNotesSnap,
    dischargesSnap,
    kardexSnap,
    profileSnap,
    cashRegSnap
  ] = await Promise.all([
    getDocs(collection(db, 'users', userId, 'products')),
    getDocs(collection(db, 'users', userId, 'sales')),
    getDocs(collection(db, 'users', userId, 'expenses')),
    getDocs(collection(db, 'users', userId, 'fiados')),
    getDocs(collection(db, 'users', userId, 'clients')),
    getDocs(collection(db, 'users', userId, 'cuentasPorPagar')),
    getDocs(collection(db, 'users', userId, 'gastosOperativos')),
    getDocs(collection(db, 'users', userId, 'suppliers')),
    getDocs(collection(db, 'users', userId, 'cashShiftHistory')),
    getDocs(collection(db, 'users', userId, 'creditNotes')),
    getDocs(collection(db, 'users', userId, 'inventoryDischarges')),
    getDocs(collection(db, 'users', userId, 'kardex')),
    getDoc(doc(db, 'users', userId, 'businessProfile', 'profile')),
    getDoc(doc(db, 'users', userId, 'cashRegister', 'status'))
  ]);

  const profileData: Partial<UserBusinessProfileDoc> = profileSnap.exists()
    ? (profileSnap.data() as UserBusinessProfileDoc)
    : {};
  const cashRegData = cashRegSnap.exists() ? (cashRegSnap.data() as CashRegisterStatusDoc) : null;

  const sales = salesSnap.docs.map((d) => d.data() as Sale).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const expenses = expensesSnap.docs.map((d) => d.data() as Expense).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const cashShiftHistory = shiftHistSnap.docs.map((d) => d.data() as CashShift).sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  const creditNotes = creditNotesSnap.docs.map((d) => d.data() as CreditNote).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const inventoryDischarges = dischargesSnap.docs.map((d) => d.data() as InventoryDischarge).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const kardex = kardexSnap.docs.map((d) => d.data() as KardexEntry).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    version: '2.2',
    timestamp: new Date().toISOString(),
    userUid: userId,
    userEmail,
    businessInfo: profileData.businessInfo || {
      name: 'PosVenecia',
      rif: '',
      phone: '',
      address: '',
      pagoMovilPhone: '',
      pagoMovilCI: '',
      pagoMovilBank: '0102 - Banco de Venezuela'
    },
    bcvRate: profileData.bcvRate || 889.26,
    bcvEuroRate: profileData.bcvEuroRate || 997.92,
    baseCurrency: profileData.baseCurrency || 'USD',
    rateHistory: profileData.rateHistory || [],
    bcvLastUpdatedDate: profileData.bcvLastUpdatedDate || null,
    bcvLastUpdatedAt: profileData.bcvLastUpdatedAt || null,
    customCategories: profileData.customCategories || [],
    managerPin: profileData.managerPin || '1234',
    products: productsSnap.docs.map((d) => d.data() as Product),
    sales,
    expenses,
    fiados: fiadosSnap.docs.map((d) => d.data() as FiadoRecord),
    cuentasPorPagar: cppSnap.docs.map((d) => d.data() as CuentaPorPagar),
    gastosOperativos: gastosSnap.docs.map((d) => d.data() as GastoOperativo),
    clients: clientsSnap.docs.map((d) => d.data() as Client),
    suppliers: suppliersSnap.docs.map((d) => d.data() as Supplier).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    creditNotes,
    inventoryDischarges,
    kardex,
    cashShift: cashRegData?.isOpen ? (cashRegData.activeShift || null) : null,
    cashShiftHistory
  };
};

/**
 * Uploads an entire JSON/Drive backup/restore payload atomically (chunked batches) directly to Cloud Firestore under users/{uid}/...
 * Respects firestore.rules immutability on `kardex` (only inserts missing kardex doc IDs).
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
    creditNotes?: CreditNote[];
    inventoryDischarges?: InventoryDischarge[];
    kardex?: KardexEntry[];
    cashShiftHistory: CashShift[];
    businessInfo: BusinessInfo;
    bcvRate: number;
    bcvEuroRate: number;
    baseCurrency?: BaseCurrency;
    rateHistory?: { date: string; rate: number }[];
    bcvLastUpdatedDate?: string | null;
    bcvLastUpdatedAt?: string | null;
    customCategories?: string[];
    managerPin?: string;
    cashShift?: CashShift | null;
  }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);

  const writeCollection = async <T extends { id?: string }>(colName: string, prefix: string, docsList: T[]) => {
    const chunkSize = 400;
    for (let i = 0; i < docsList.length; i += chunkSize) {
      const chunk = docsList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((item, offset) => {
        if (!item || typeof item !== 'object') return;
        const safeId = sanitizeFirestoreDocId(item.id, prefix, i + offset);
        const payload = cleanForFirestore({ ...item, id: safeId });
        batch.set(doc(db, 'users', userId, colName, safeId), payload);
      });
      await batch.commit();
    }
  };

  await writeCollection('products', 'prod', data.products || []);
  await writeCollection('sales', 'sale', data.sales || []);
  await writeCollection('expenses', 'exp', data.expenses || []);
  await writeCollection('fiados', 'fiado', data.fiados || []);
  await writeCollection('clients', 'cli', data.clients || []);
  await writeCollection('cuentasPorPagar', 'cpp', data.cuentasPorPagar || []);
  await writeCollection('gastosOperativos', 'gasto', data.gastosOperativos || []);
  await writeCollection('suppliers', 'sup', data.suppliers || []);
  await writeCollection('creditNotes', 'nc', data.creditNotes || []);
  await writeCollection('inventoryDischarges', 'disc', data.inventoryDischarges || []);
  await writeCollection('cashShiftHistory', 'shift', data.cashShiftHistory || []);

  // Kardex is create-only in firestore.rules (allow update, delete: if false).
  // Query existing IDs and insert ONLY non-existent Kardex entries.
  if (Array.isArray(data.kardex) && data.kardex.length > 0) {
    const existingKardexSnap = await getDocs(collection(db, 'users', userId, 'kardex'));
    const existingIds = new Set(existingKardexSnap.docs.map((d) => d.id));
    const missingKardex: Array<KardexEntry & { id: string }> = [];
    data.kardex.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const safeId = sanitizeFirestoreDocId(entry.id, 'kdx', idx);
      if (!existingIds.has(safeId)) {
        existingIds.add(safeId);
        missingKardex.push({ ...entry, id: safeId });
      }
    });
    if (missingKardex.length > 0) {
      await writeCollection('kardex', 'kdx', missingKardex);
    }
  }

  await saveBusinessProfileToFirestore(userId, {
    businessInfo: data.businessInfo,
    bcvRate: data.bcvRate,
    bcvEuroRate: data.bcvEuroRate,
    baseCurrency: data.baseCurrency || 'USD',
    rateHistory: data.rateHistory || [],
    bcvLastUpdatedDate: data.bcvLastUpdatedDate || undefined,
    bcvLastUpdatedAt: data.bcvLastUpdatedAt || undefined,
    customCategories: data.customCategories || [],
    managerPin: data.managerPin || '1234'
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
 * Preserves businessProfile unless overwritten. Note: 'kardex' is immutable by Firestore security rules.
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
