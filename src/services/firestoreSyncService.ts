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
  limit,
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
  Supplier,
  Loan,
  LoanAbono,
  TreasuryAccount,
  TreasuryCurrency,
  TreasuryMovement,
  TreasuryMovementType
} from '../types';
import { BackupDataPayload } from '../utils/cloudBackupUtils';
import {
  getExpenseAccountingType,
  isBankPaymentMethod,
  isExpenseOwnerSalary,
  isExpenseOwnerWithdrawal,
  isNonFiscalPersonalOrSalaryCategory,
  mapGastoCategoryToExpenseCategory
} from '../utils/accountingUtils';

export const CASH_USD_ACCOUNT_ID = 'cash_usd';
export const CASH_BS_ACCOUNT_ID = 'cash_bs';

export interface TreasuryPostingInput {
  accountId: string;
  fallbackAccountName?: string;
  fallbackCurrency?: TreasuryCurrency;
  direction: 'in' | 'out';
  amountUSD?: number;
  amountBs?: number;
  exactNativeAmount?: number;
  type: TreasuryMovementType;
  concept: string;
  reference?: string;
  paymentMethod?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  transferPairId?: string;
  counterpartyAccountId?: string;
  counterpartyAccountName?: string;
  exchangeRateUsed?: number;
  notes?: string;
  date?: string;
  createdBy?: string;
}

export interface SaleTreasuryOptions {
  defaultBsBankAccountId?: string;
  defaultBsBankAccountName?: string;
}

export interface TreasuryPaymentOptions {
  bankAccountId?: string;
  bankAccountLabel?: string;
  enteredCurrency?: 'USD' | 'Bs';
  exactAmountBs?: number;
  bankFeeAmount?: number;
  createdBy?: string;
}

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
  lastRatePromptDate?: string;
  lastPromptedBcvRate?: number;
  lastPromptedBcvEuroRate?: number;
  commercialRoundingStep?: number;
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
  onLoans?: (loans: Loan[]) => void;
  onTreasuryAccounts?: (accounts: TreasuryAccount[]) => void;
  onTreasuryMovements?: (movements: TreasuryMovement[]) => void;
  onMissingCollectionPermissions?: (collectionName: string) => void;
  onCollectionPermissionOk?: (collectionName: string) => void;
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

const deniedOptionalCollections = new Set<string>();

export const isPermissionDeniedError = (err: unknown): boolean => {
  const code = (err as any)?.code;
  const msg = err instanceof Error ? err.message : String(err || '');
  return code === 'permission-denied' || /missing or insufficient permissions|permission-denied/i.test(msg);
};

const isOptionalCollectionDenied = (userId: string, colName: string): boolean => {
  return deniedOptionalCollections.has(`${userId}:${colName}`);
};

const markOptionalCollectionDenied = (userId: string, colName: string): void => {
  deniedOptionalCollections.add(`${userId}:${colName}`);
};

const clearOptionalCollectionDenied = (userId: string, colName: string): void => {
  deniedOptionalCollections.delete(`${userId}:${colName}`);
};

export const resetDeniedOptionalCollections = (uid: string): void => {
  const userId = getCanonicalUserId(uid);
  const prefix = `${userId}:`;
  for (const key of Array.from(deniedOptionalCollections)) {
    if (key.startsWith(prefix)) {
      deniedOptionalCollections.delete(key);
    }
  }
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

  // 8. Cash Shift History (Cierres de Caja — bounded to latest 200 shifts; full backup queries collection directly)
  const historyPath = `users/${userId}/cashShiftHistory`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', userId, 'cashShiftHistory'), orderBy('openedAt', 'desc'), limit(200)),
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

  // 11. Credit Notes (Notas de Crédito y Devoluciones — bounded to latest 300)
  const creditNotesPath = `users/${userId}/creditNotes`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', userId, 'creditNotes'), orderBy('date', 'desc'), limit(300)),
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

  // 12. Inventory Discharges (Salidas por Daño, Vencimiento, Merma, Uso Interno — bounded to latest 300)
  const dischargesPath = `users/${userId}/inventoryDischarges`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', userId, 'inventoryDischarges'), orderBy('date', 'desc'), limit(300)),
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

  // 13. Kardex (Historial inmutable de movimientos de inventario — bounded to latest 500 for fast startup/reads)
  const kardexPath = `users/${userId}/kardex`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', userId, 'kardex'), orderBy('date', 'desc'), limit(500)),
      (snapshot) => {
        clearOptionalCollectionDenied(userId, 'kardex');
        callbacks.onCollectionPermissionOk?.('kardex');
        const entries: KardexEntry[] = [];
        snapshot.forEach((d) => {
          entries.push(d.data() as KardexEntry);
        });
        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (callbacks.onKardex) {
          callbacks.onKardex(entries);
        }
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          markOptionalCollectionDenied(userId, 'kardex');
          callbacks.onKardex?.([]);
          callbacks.onMissingCollectionPermissions?.('kardex');
          return;
        }
        handleErr(OperationType.LIST, kardexPath, err);
      }
    )
  );

  // 14. Maestro de Proveedores
  const suppliersPath = `users/${userId}/suppliers`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'suppliers'),
      (snapshot) => {
        clearOptionalCollectionDenied(userId, 'suppliers');
        callbacks.onCollectionPermissionOk?.('suppliers');
        const suppliers: Supplier[] = [];
        snapshot.forEach((d) => {
          suppliers.push(d.data() as Supplier);
        });
        suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (callbacks.onSuppliers) {
          callbacks.onSuppliers(suppliers);
        }
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          markOptionalCollectionDenied(userId, 'suppliers');
          callbacks.onSuppliers?.([]);
          callbacks.onMissingCollectionPermissions?.('suppliers');
          return;
        }
        handleErr(OperationType.LIST, suppliersPath, err);
      }
    )
  );

  // 15. Créditos y Préstamos por Pagar
  const loansPath = `users/${userId}/loans`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'loans'),
      (snapshot) => {
        clearOptionalCollectionDenied(userId, 'loans');
        callbacks.onCollectionPermissionOk?.('loans');
        const loans: Loan[] = [];
        snapshot.forEach((d) => {
          loans.push(d.data() as Loan);
        });
        loans.sort((a, b) => new Date(b.grantDate || b.createdAt).getTime() - new Date(a.grantDate || a.createdAt).getTime());
        if (callbacks.onLoans) {
          callbacks.onLoans(loans);
        }
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          markOptionalCollectionDenied(userId, 'loans');
          callbacks.onLoans?.([]);
          callbacks.onMissingCollectionPermissions?.('loans');
          return;
        }
        handleErr(OperationType.LIST, loansPath, err);
      }
    )
  );

  // 16. Cuentas de Tesorería (Efectivo USD, Efectivo Bs y Cuentas Bancarias)
  const bankAccountsPath = `users/${userId}/bankAccounts`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', userId, 'bankAccounts'),
      (snapshot) => {
        clearOptionalCollectionDenied(userId, 'bankAccounts');
        callbacks.onCollectionPermissionOk?.('bankAccounts');
        const accounts: TreasuryAccount[] = [];
        snapshot.forEach((d) => {
          accounts.push(d.data() as TreasuryAccount);
        });
        accounts.sort((a, b) => {
          const orderOf = (acc: TreasuryAccount) =>
            acc.id === CASH_USD_ACCOUNT_ID ? 0 : acc.id === CASH_BS_ACCOUNT_ID ? 1 : acc.isDefault ? 2 : 3;
          const diff = orderOf(a) - orderOf(b);
          return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
        });
        callbacks.onTreasuryAccounts?.(accounts);
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          markOptionalCollectionDenied(userId, 'bankAccounts');
          callbacks.onTreasuryAccounts?.([]);
          callbacks.onMissingCollectionPermissions?.('bankAccounts');
          return;
        }
        handleErr(OperationType.LIST, bankAccountsPath, err);
      }
    )
  );

  // 17. Extracto de Movimientos de Tesorería (Ledger inmutable — bounded to latest 500; live balances live in bankAccounts)
  const treasuryMovementsPath = `users/${userId}/treasuryMovements`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', userId, 'treasuryMovements'), orderBy('date', 'desc'), limit(500)),
      (snapshot) => {
        clearOptionalCollectionDenied(userId, 'treasuryMovements');
        callbacks.onCollectionPermissionOk?.('treasuryMovements');
        const movements: TreasuryMovement[] = [];
        snapshot.forEach((d) => {
          movements.push(d.data() as TreasuryMovement);
        });
        movements.sort((a, b) => {
          const tDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          return tDiff !== 0 ? tDiff : (b.id || '').localeCompare(a.id || '');
        });
        callbacks.onTreasuryMovements?.(movements);
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          markOptionalCollectionDenied(userId, 'treasuryMovements');
          callbacks.onTreasuryMovements?.([]);
          callbacks.onMissingCollectionPermissions?.('treasuryMovements');
          return;
        }
        handleErr(OperationType.LIST, treasuryMovementsPath, err);
      }
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
};

// ============================================================================
// MOTOR TRANSACCIONAL DE TESORERÍA (bankAccounts + treasuryMovements)
// ============================================================================

const isTreasuryEnabled = (userId: string): boolean =>
  !isOptionalCollectionDenied(userId, 'bankAccounts') &&
  !isOptionalCollectionDenied(userId, 'treasuryMovements');

const buildFallbackTreasuryAccount = (
  accountId: string,
  nowIso: string,
  fallbackName?: string,
  fallbackCurrency?: TreasuryCurrency
): TreasuryAccount => {
  if (accountId === CASH_USD_ACCOUNT_ID) {
    return {
      id: CASH_USD_ACCOUNT_ID,
      name: 'Efectivo en Caja ($ USD)',
      accountType: 'cash_usd',
      currency: 'USD',
      balance: 0,
      initialBalance: 0,
      isSystemCash: true,
      isDefault: true,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }
  if (accountId === CASH_BS_ACCOUNT_ID) {
    return {
      id: CASH_BS_ACCOUNT_ID,
      name: 'Efectivo en Caja (Bs)',
      accountType: 'cash_bs',
      currency: 'Bs',
      balance: 0,
      initialBalance: 0,
      isSystemCash: true,
      isDefault: true,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }
  return {
    id: accountId,
    name: fallbackName || 'Cuenta Bancaria',
    bankName: fallbackName || 'Cuenta Bancaria',
    accountType: 'bank',
    currency: fallbackCurrency || 'Bs',
    balance: 0,
    initialBalance: 0,
    isSystemCash: false,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso
  };
};

const resolveTreasuryAccountIdForMethod = (
  method?: string,
  bankAccountId?: string,
  defaultBsBankAccountId?: string
): string | null => {
  if (method === 'efectivo_usd') return CASH_USD_ACCOUNT_ID;
  if (method === 'efectivo_bs') return CASH_BS_ACCOUNT_ID;
  if (isBankPaymentMethod(method) || method === 'banco_pago_movil') {
    const cleanId = bankAccountId?.trim() || defaultBsBankAccountId?.trim();
    return cleanId || null;
  }
  return null;
};

const buildBankCommissionExpenseDoc = (params: {
  feeAmount: number;
  feeCurrency: TreasuryCurrency;
  bcvRate: number;
  paymentMethod: Expense['paymentMethod'];
  bankAccountId: string;
  bankAccountLabel: string;
  concept: string;
  reference?: string;
  dateIso: string;
  linkedGastoId?: string;
  linkedCuentaId?: string;
  linkedLoanId?: string;
}): Expense => {
  const safeRate = params.bcvRate > 0 ? params.bcvRate : 1;
  const amountBs = params.feeCurrency === 'Bs' ? round2(params.feeAmount) : round2(params.feeAmount * safeRate);
  const amountUSD = params.feeCurrency === 'USD' ? round2(params.feeAmount) : round2(params.feeAmount / safeRate);
  return {
    id: 'exp-com-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    date: params.dateIso,
    invoiceNumber: params.reference || 'COM-BANCARIA',
    controlNumber: '00-00000',
    supplierName: params.bankAccountLabel || 'Banco',
    supplierRIF: 'N/A',
    description: `Comisión Bancaria: ${params.concept}`,
    category: 'Comisión Bancaria',
    amountUSD,
    amountBs,
    baseImponibleBs: 0,
    ivaBs: 0,
    retencionIVABs: 0,
    retencionISLRBs: 0,
    bcvRate: safeRate,
    enteredCurrency: params.feeCurrency,
    paymentMethod: params.paymentMethod,
    bankAccountId: params.bankAccountId,
    bankAccountLabel: params.bankAccountLabel,
    treasuryAccountId: params.bankAccountId,
    bankFeeAmount: round2(params.feeAmount),
    bankFeeCurrency: params.feeCurrency,
    excludeFromLibroCompras: true,
    accountingType: 'operating_expense',
    reference: params.reference,
    linkedGastoId: params.linkedGastoId,
    linkedCuentaId: params.linkedCuentaId,
    linkedLoanId: params.linkedLoanId,
    syncStatus: 'synced'
  };
};

/**
 * Helper STRICTLY honoring Firestore's read-before-write rule inside runTransaction.
 * Call `prepareTreasuryPostingsInTx` during the READ phase, then call the returned `commitWrites()`
 * during the WRITE phase. Supports multiple postings to the same account in sequence with exact running balances.
 */
const prepareTreasuryPostingsInTx = async (
  tx: Parameters<Parameters<typeof runTransaction>[1]>[0],
  userId: string,
  postings: TreasuryPostingInput[],
  bcvRate: number
): Promise<{
  getAccountCurrency: (accountId: string, fallback?: TreasuryCurrency) => TreasuryCurrency;
  getAccountName: (accountId: string, fallback?: string) => string;
  commitWrites: () => TreasuryMovement[];
}> => {
  const validPostings = postings.filter((p) => Boolean(p.accountId && p.accountId.trim()));
  if (!isTreasuryEnabled(userId) || validPostings.length === 0) {
    return {
      getAccountCurrency: (_id, fallback) => fallback || 'Bs',
      getAccountName: (_id, fallback) => fallback || 'Cuenta',
      commitWrites: () => []
    };
  }

  const nowIso = new Date().toISOString();
  const uniqueIds = Array.from(new Set(validPostings.map((p) => p.accountId.trim())));
  const refs = uniqueIds.map((id) => doc(db, 'users', userId, 'bankAccounts', id));
  const snaps = await Promise.all(refs.map((r) => tx.get(r)));

  const stateMap = new Map<
    string,
    {
      ref: ReturnType<typeof doc>;
      account: TreasuryAccount;
      currentBalance: number;
      touched: boolean;
    }
  >();

  uniqueIds.forEach((id, idx) => {
    const snap = snaps[idx];
    const samplePosting = validPostings.find((p) => p.accountId.trim() === id);
    const liveAccount: TreasuryAccount = snap.exists()
      ? (snap.data() as TreasuryAccount)
      : buildFallbackTreasuryAccount(id, nowIso, samplePosting?.fallbackAccountName, samplePosting?.fallbackCurrency);
    stateMap.set(id, {
      ref: refs[idx],
      account: liveAccount,
      currentBalance: round2(Number(liveAccount.balance) || 0),
      touched: false
    });
  });

  const safeRate = bcvRate > 0 ? bcvRate : 1;

  return {
    getAccountCurrency: (accountId: string, fallback?: TreasuryCurrency) =>
      stateMap.get(accountId.trim())?.account.currency || fallback || 'Bs',
    getAccountName: (accountId: string, fallback?: string) =>
      stateMap.get(accountId.trim())?.account.name || fallback || 'Cuenta',
    commitWrites: () => {
      const createdMovements: TreasuryMovement[] = [];
      const baseTs = Date.now();

      validPostings.forEach((p, seq) => {
        const state = stateMap.get(p.accountId.trim());
        if (!state) return;

        let nativeAmount = 0;
        if (typeof p.exactNativeAmount === 'number' && p.exactNativeAmount > 0) {
          nativeAmount = round2(p.exactNativeAmount);
        } else if (state.account.currency === 'USD') {
          if (typeof p.amountUSD === 'number' && p.amountUSD > 0) {
            nativeAmount = round2(p.amountUSD);
          } else if (typeof p.amountBs === 'number' && p.amountBs > 0) {
            nativeAmount = round2(p.amountBs / safeRate);
          }
        } else {
          if (typeof p.amountBs === 'number' && p.amountBs > 0) {
            nativeAmount = round2(p.amountBs);
          } else if (typeof p.amountUSD === 'number' && p.amountUSD > 0) {
            nativeAmount = round2(p.amountUSD * safeRate);
          }
        }

        if (nativeAmount <= 0) return;

        const balanceBefore = round2(state.currentBalance);
        const balanceAfter = round2(
          p.direction === 'in' ? balanceBefore + nativeAmount : balanceBefore - nativeAmount
        );
        state.currentBalance = balanceAfter;
        state.touched = true;

        const mov: TreasuryMovement = {
          id: `tmov-${baseTs}-${seq}-${Math.random().toString(36).substring(2, 6)}`,
          date: p.date || nowIso,
          accountId: state.account.id,
          accountName: state.account.name,
          accountCurrency: state.account.currency,
          direction: p.direction,
          amount: nativeAmount,
          balanceBefore,
          balanceAfter,
          bcvRate: safeRate,
          type: p.type,
          concept: p.concept.slice(0, 295),
          reference: p.reference ? p.reference.slice(0, 145) : undefined,
          paymentMethod: p.paymentMethod,
          linkedEntityType: p.linkedEntityType,
          linkedEntityId: p.linkedEntityId,
          transferPairId: p.transferPairId,
          counterpartyAccountId: p.counterpartyAccountId,
          counterpartyAccountName: p.counterpartyAccountName,
          exchangeRateUsed: p.exchangeRateUsed,
          notes: p.notes ? p.notes.slice(0, 990) : undefined,
          createdBy: p.createdBy
        };

        tx.set(doc(db, 'users', userId, 'treasuryMovements', mov.id), cleanForFirestore(mov));
        createdMovements.push(mov);
      });

      stateMap.forEach((state) => {
        if (!state.touched) return;
        const nextAcc: TreasuryAccount = {
          ...state.account,
          balance: round2(state.currentBalance),
          updatedAt: nowIso
        };
        tx.set(state.ref, cleanForFirestore(nextAcc), { merge: true });
      });

      return createdMovements;
    }
  };
};

const buildSaleTreasuryPostings = (
  sale: Sale,
  direction: 'in' | 'out',
  type: TreasuryMovementType,
  treasuryOptions?: SaleTreasuryOptions,
  conceptPrefix?: string
): TreasuryPostingInput[] => {
  const postings: TreasuryPostingInput[] = [];
  const label = conceptPrefix || (direction === 'in' ? `Venta POS ${sale.invoiceNumber}` : `Anulación ${sale.invoiceNumber}`);
  const pd = sale.paymentDetails || ({} as Sale['paymentDetails']);
  const defaultBankId = treasuryOptions?.defaultBsBankAccountId;
  const defaultBankName = treasuryOptions?.defaultBsBankAccountName;

  if (sale.paymentMethod === 'efectivo_usd') {
    postings.push({
      accountId: CASH_USD_ACCOUNT_ID,
      direction,
      exactNativeAmount: round2(sale.totalUSD),
      amountUSD: sale.totalUSD,
      amountBs: sale.totalBs,
      type,
      concept: `${label} (${sale.clientName})`,
      reference: sale.invoiceNumber,
      paymentMethod: sale.paymentMethod,
      linkedEntityType: 'sale',
      linkedEntityId: sale.id,
      date: direction === 'in' ? sale.date : new Date().toISOString(),
      createdBy: sale.cashierName
    });
  } else if (sale.paymentMethod === 'efectivo_bs') {
    postings.push({
      accountId: CASH_BS_ACCOUNT_ID,
      direction,
      exactNativeAmount: round2(sale.totalBs),
      amountUSD: sale.totalUSD,
      amountBs: sale.totalBs,
      type,
      concept: `${label} (${sale.clientName})`,
      reference: sale.invoiceNumber,
      paymentMethod: sale.paymentMethod,
      linkedEntityType: 'sale',
      linkedEntityId: sale.id,
      date: direction === 'in' ? sale.date : new Date().toISOString(),
      createdBy: sale.cashierName
    });
  } else if (isBankPaymentMethod(sale.paymentMethod)) {
    const bankId = pd.treasuryBankAccountId || defaultBankId;
    if (bankId) {
      const bankLabel =
        pd.pagoMovilBank || pd.debitoBank || pd.transferenciaBank || defaultBankName || 'Cuenta Bancaria';
      const ref = pd.pagoMovilRef || pd.debitoRef || pd.transferenciaRef || sale.invoiceNumber;
      postings.push({
        accountId: bankId,
        fallbackAccountName: bankLabel,
        fallbackCurrency: 'Bs',
        direction,
        amountUSD: sale.totalUSD,
        amountBs: sale.totalBs,
        type,
        concept: `${label} (${sale.clientName})`,
        reference: ref,
        paymentMethod: sale.paymentMethod,
        linkedEntityType: 'sale',
        linkedEntityId: sale.id,
        date: direction === 'in' ? sale.date : new Date().toISOString(),
        createdBy: sale.cashierName
      });
    }
  } else if (sale.paymentMethod === 'fiao') {
    const initUsd = round2(Number(pd.fiaoInitialAbonoUSD) || 0);
    const initBs = round2(Number(pd.fiaoInitialAbonoBs) || 0);
    if (initUsd > 0 || initBs > 0) {
      const isBs = pd.fiaoInitialAbonoCurrency === 'Bs';
      postings.push({
        accountId: isBs ? CASH_BS_ACCOUNT_ID : CASH_USD_ACCOUNT_ID,
        direction,
        exactNativeAmount: isBs ? (initBs > 0 ? initBs : round2(initUsd * (sale.bcvRate || 1))) : initUsd,
        amountUSD: initUsd,
        amountBs: initBs > 0 ? initBs : round2(initUsd * (sale.bcvRate || 1)),
        type,
        concept: `${label} - Abono inicial crédito (${sale.clientName})`,
        reference: sale.invoiceNumber,
        paymentMethod: isBs ? 'efectivo_bs' : 'efectivo_usd',
        linkedEntityType: 'sale',
        linkedEntityId: sale.id,
        date: direction === 'in' ? sale.date : new Date().toISOString(),
        createdBy: sale.cashierName
      });
    }
  } else if (sale.paymentMethod === 'pago_combinado' && pd.combinedBreakdown) {
    const cb = pd.combinedBreakdown;
    if ((cb.usdCash || 0) > 0) {
      postings.push({
        accountId: CASH_USD_ACCOUNT_ID,
        direction,
        exactNativeAmount: round2(cb.usdCash || 0),
        amountUSD: round2(cb.usdCash || 0),
        type,
        concept: `${label} - Combinado Efectivo $ (${sale.clientName})`,
        reference: sale.invoiceNumber,
        paymentMethod: 'efectivo_usd',
        linkedEntityType: 'sale',
        linkedEntityId: sale.id,
        date: direction === 'in' ? sale.date : new Date().toISOString(),
        createdBy: sale.cashierName
      });
    }
    if ((cb.bsCash || 0) > 0) {
      postings.push({
        accountId: CASH_BS_ACCOUNT_ID,
        direction,
        exactNativeAmount: round2(cb.bsCash || 0),
        amountBs: round2(cb.bsCash || 0),
        type,
        concept: `${label} - Combinado Efectivo Bs (${sale.clientName})`,
        reference: sale.invoiceNumber,
        paymentMethod: 'efectivo_bs',
        linkedEntityType: 'sale',
        linkedEntityId: sale.id,
        date: direction === 'in' ? sale.date : new Date().toISOString(),
        createdBy: sale.cashierName
      });
    }
    if ((cb.pagoMovil || 0) > 0) {
      const bankId = cb.pagoMovilBankAccountId || pd.treasuryBankAccountId || defaultBankId;
      if (bankId) {
        postings.push({
          accountId: bankId,
          fallbackAccountName: cb.pagoMovilBank || defaultBankName,
          fallbackCurrency: 'Bs',
          direction,
          amountBs: round2(cb.pagoMovil || 0),
          type,
          concept: `${label} - Combinado Pago Móvil (${sale.clientName})`,
          reference: cb.pagoMovilRef || sale.invoiceNumber,
          paymentMethod: 'pago_movil',
          linkedEntityType: 'sale',
          linkedEntityId: sale.id,
          date: direction === 'in' ? sale.date : new Date().toISOString(),
          createdBy: sale.cashierName
        });
      }
    }
    if ((cb.debito || 0) > 0) {
      const bankId = cb.debitoBankAccountId || pd.treasuryBankAccountId || defaultBankId;
      if (bankId) {
        postings.push({
          accountId: bankId,
          fallbackAccountName: cb.debitoBank || defaultBankName,
          fallbackCurrency: 'Bs',
          direction,
          amountBs: round2(cb.debito || 0),
          type,
          concept: `${label} - Combinado Punto Débito (${sale.clientName})`,
          reference: cb.debitoRef || sale.invoiceNumber,
          paymentMethod: 'debito',
          linkedEntityType: 'sale',
          linkedEntityId: sale.id,
          date: direction === 'in' ? sale.date : new Date().toISOString(),
          createdBy: sale.cashierName
        });
      }
    }
    if ((cb.transferencia || 0) > 0) {
      const bankId = cb.transferenciaBankAccountId || pd.treasuryBankAccountId || defaultBankId;
      if (bankId) {
        postings.push({
          accountId: bankId,
          fallbackAccountName: cb.transferenciaBank || defaultBankName,
          fallbackCurrency: 'Bs',
          direction,
          amountBs: round2(cb.transferencia || 0),
          type,
          concept: `${label} - Combinado Transferencia (${sale.clientName})`,
          reference: cb.transferenciaRef || sale.invoiceNumber,
          paymentMethod: 'transferencia',
          linkedEntityType: 'sale',
          linkedEntityId: sale.id,
          date: direction === 'in' ? sale.date : new Date().toISOString(),
          createdBy: sale.cashierName
        });
      }
    }
  }

  return postings;
};

/**
 * Ensures canonical cash accounts (cash_usd, cash_bs) and migrates any configured bank accounts
 * from BusinessInfo into users/{uid}/bankAccounts idempotently.
 */
export const ensureDefaultTreasuryAccountsInFirestore = async (
  uid: string,
  existingAccounts: TreasuryAccount[],
  businessInfo?: BusinessInfo
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  if (isOptionalCollectionDenied(userId, 'bankAccounts')) return;

  const existingIds = new Set(existingAccounts.map((a) => a.id));
  const nowIso = new Date().toISOString();
  const toCreate: TreasuryAccount[] = [];

  if (!existingIds.has(CASH_USD_ACCOUNT_ID)) {
    toCreate.push(buildFallbackTreasuryAccount(CASH_USD_ACCOUNT_ID, nowIso));
  }
  if (!existingIds.has(CASH_BS_ACCOUNT_ID)) {
    toCreate.push(buildFallbackTreasuryAccount(CASH_BS_ACCOUNT_ID, nowIso));
  }

  const hasAnyBank = existingAccounts.some((a) => a.accountType === 'bank');
  if (!hasAnyBank && businessInfo) {
    const profileBanks = businessInfo.bankAccounts || [];
    if (profileBanks.length > 0) {
      profileBanks.forEach((b, idx) => {
        const safeId = sanitizeFirestoreDocId(b.id, 'bank', idx);
        if (!existingIds.has(safeId)) {
          toCreate.push({
            id: safeId,
            name: b.bank || `Banco ${idx + 1}`,
            bankName: b.bank || `Banco ${idx + 1}`,
            accountNumber: b.accountNumber || '',
            alias: b.holderName || '',
            accountType: 'bank',
            currency: 'Bs',
            balance: 0,
            initialBalance: 0,
            isSystemCash: false,
            isDefault: Boolean(b.isDefault) || idx === 0,
            isActive: true,
            createdAt: nowIso,
            updatedAt: nowIso
          });
        }
      });
    } else if (businessInfo.pagoMovilBank) {
      const defaultBankId = 'bank_principal_bs';
      if (!existingIds.has(defaultBankId)) {
        toCreate.push({
          id: defaultBankId,
          name: businessInfo.pagoMovilBank,
          bankName: businessInfo.pagoMovilBank,
          accountNumber: businessInfo.pagoMovilPhone || '',
          alias: 'Cuenta Principal Pago Móvil',
          accountType: 'bank',
          currency: 'Bs',
          balance: 0,
          initialBalance: 0,
          isSystemCash: false,
          isDefault: true,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    }
  }

  if (toCreate.length === 0) return;

  const op = (async () => {
    try {
      const batch = writeBatch(db);
      toCreate.forEach((acc) => {
        batch.set(doc(db, 'users', userId, 'bankAccounts', acc.id), cleanForFirestore(acc), { merge: true });
      });
      await batch.commit();
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        markOptionalCollectionDenied(userId, 'bankAccounts');
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/bankAccounts`);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveTreasuryAccountToFirestore = async (
  uid: string,
  account: TreasuryAccount,
  options?: { recordInitialMovement?: boolean; bcvRate?: number; createdBy?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const safeId = sanitizeFirestoreDocId(account.id, 'bank', 0);
  const path = `users/${userId}/bankAccounts/${safeId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const accRef = doc(db, 'users', userId, 'bankAccounts', safeId);
        const existingSnap = await tx.get(accRef);
        const nowIso = new Date().toISOString();

        const normalized: TreasuryAccount = {
          ...account,
          id: safeId,
          balance: existingSnap.exists()
            ? round2(Number((existingSnap.data() as TreasuryAccount).balance) || 0)
            : round2(Number(account.balance) || 0),
          initialBalance: existingSnap.exists()
            ? round2(Number((existingSnap.data() as TreasuryAccount).initialBalance) || 0)
            : round2(Number(account.initialBalance ?? account.balance) || 0),
          createdAt: existingSnap.exists()
            ? (existingSnap.data() as TreasuryAccount).createdAt || nowIso
            : account.createdAt || nowIso,
          updatedAt: nowIso
        };

        tx.set(accRef, cleanForFirestore(normalized), { merge: true });

        if (!existingSnap.exists() && options?.recordInitialMovement && normalized.balance > 0 && isTreasuryEnabled(userId)) {
          const mov: TreasuryMovement = {
            id: `tmov-init-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: nowIso,
            accountId: normalized.id,
            accountName: normalized.name,
            accountCurrency: normalized.currency,
            direction: 'in',
            amount: round2(normalized.balance),
            balanceBefore: 0,
            balanceAfter: round2(normalized.balance),
            bcvRate: options.bcvRate && options.bcvRate > 0 ? options.bcvRate : 1,
            type: 'ajuste_inicial',
            concept: `Saldo inicial de apertura (${normalized.name})`,
            notes: normalized.notes || 'Creación de cuenta con saldo inicial',
            createdBy: options.createdBy
          };
          tx.set(doc(db, 'users', userId, 'treasuryMovements', mov.id), cleanForFirestore(mov));
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteTreasuryAccountFromFirestore = async (
  uid: string,
  accountId: string
): Promise<void> => {
  if (accountId === CASH_USD_ACCOUNT_ID || accountId === CASH_BS_ACCOUNT_ID) {
    throw new Error('Las cuentas de Efectivo en Caja del sistema no pueden eliminarse.');
  }
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/bankAccounts/${accountId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'bankAccounts', accountId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic Transfer / Currency Exchange between any two Treasury accounts,
 * with optional Comisión Bancaria debited from the source bank account & logged as non-fiscal financial expense.
 */
export const transferBetweenTreasuryAccountsTransaction = async (
  uid: string,
  params: {
    sourceAccountId: string;
    destinationAccountId: string;
    sourceAmount: number;
    exchangeRate?: number;
    bcvRate: number;
    bankFeeAmount?: number;
    reference?: string;
    notes?: string;
    createdBy?: string;
  }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  if (params.sourceAccountId === params.destinationAccountId) {
    throw new Error('La cuenta de origen y destino deben ser diferentes.');
  }
  if (!(params.sourceAmount > 0)) {
    throw new Error('El monto a transferir debe ser mayor a cero.');
  }
  const path = `users/${userId}/treasuryMovements`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const srcRef = doc(db, 'users', userId, 'bankAccounts', params.sourceAccountId);
        const dstRef = doc(db, 'users', userId, 'bankAccounts', params.destinationAccountId);
        const [srcSnap, dstSnap] = await Promise.all([tx.get(srcRef), tx.get(dstRef)]);
        if (!srcSnap.exists()) throw new Error('Cuenta de origen no encontrada en Tesorería.');
        if (!dstSnap.exists()) throw new Error('Cuenta de destino no encontrada en Tesorería.');

        const srcAcc = srcSnap.data() as TreasuryAccount;
        const dstAcc = dstSnap.data() as TreasuryAccount;
        const nowIso = new Date().toISOString();
        const safeBcv = Number.isFinite(params.bcvRate) && params.bcvRate > 0 ? params.bcvRate : 1;
        const rateUsed =
          typeof params.exchangeRate === 'number' && Number.isFinite(params.exchangeRate) && params.exchangeRate > 0
            ? params.exchangeRate
            : safeBcv;

        const outAmount = round2(params.sourceAmount);
        let inAmount = outAmount;
        if (srcAcc.currency !== dstAcc.currency) {
          if (!(rateUsed > 0)) {
            throw new Error('La tasa de cambio debe ser mayor a cero para convertir divisas.');
          }
          inAmount =
            srcAcc.currency === 'USD' && dstAcc.currency === 'Bs'
              ? round2(outAmount * rateUsed)
              : round2(outAmount / rateUsed);
        }

        const feeAmount =
          srcAcc.accountType === 'bank' && params.bankFeeAmount && params.bankFeeAmount > 0
            ? round2(params.bankFeeAmount)
            : 0;

        const transferPairId = `trf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const isFx = srcAcc.currency !== dstAcc.currency;
        const conceptOut = isFx
          ? `Cambio de Divisa (${srcAcc.currency} → ${dstAcc.currency}) hacia ${dstAcc.name}`
          : `Transferencia interna hacia ${dstAcc.name}`;
        const conceptIn = isFx
          ? `Cambio de Divisa (${srcAcc.currency} → ${dstAcc.currency}) desde ${srcAcc.name}`
          : `Transferencia interna desde ${srcAcc.name}`;

        const srcBefore = round2(Number(srcAcc.balance) || 0);
        const srcAfterTransfer = round2(srcBefore - outAmount);
        const srcFinal = feeAmount > 0 ? round2(srcAfterTransfer - feeAmount) : srcAfterTransfer;

        const dstBefore = round2(Number(dstAcc.balance) || 0);
        const dstFinal = round2(dstBefore + inAmount);

        const baseTs = Date.now();
        const outMov: TreasuryMovement = {
          id: `tmov-${baseTs}-0-${Math.random().toString(36).substring(2, 6)}`,
          date: nowIso,
          accountId: srcAcc.id,
          accountName: srcAcc.name,
          accountCurrency: srcAcc.currency,
          direction: 'out',
          amount: outAmount,
          balanceBefore: srcBefore,
          balanceAfter: srcAfterTransfer,
          bcvRate: safeBcv,
          type: 'transferencia',
          concept: conceptOut,
          reference: params.reference,
          linkedEntityType: 'transfer',
          linkedEntityId: transferPairId,
          transferPairId,
          counterpartyAccountId: dstAcc.id,
          counterpartyAccountName: dstAcc.name,
          exchangeRateUsed: isFx ? rateUsed : undefined,
          notes: params.notes,
          createdBy: params.createdBy
        };

        const inMov: TreasuryMovement = {
          id: `tmov-${baseTs}-1-${Math.random().toString(36).substring(2, 6)}`,
          date: nowIso,
          accountId: dstAcc.id,
          accountName: dstAcc.name,
          accountCurrency: dstAcc.currency,
          direction: 'in',
          amount: inAmount,
          balanceBefore: dstBefore,
          balanceAfter: dstFinal,
          bcvRate: safeBcv,
          type: 'transferencia',
          concept: conceptIn,
          reference: params.reference,
          linkedEntityType: 'transfer',
          linkedEntityId: transferPairId,
          transferPairId,
          counterpartyAccountId: srcAcc.id,
          counterpartyAccountName: srcAcc.name,
          exchangeRateUsed: isFx ? rateUsed : undefined,
          notes: params.notes,
          createdBy: params.createdBy
        };

        tx.set(srcRef, cleanForFirestore({ ...srcAcc, balance: srcFinal, updatedAt: nowIso }), { merge: true });
        tx.set(dstRef, cleanForFirestore({ ...dstAcc, balance: dstFinal, updatedAt: nowIso }), { merge: true });
        tx.set(doc(db, 'users', userId, 'treasuryMovements', outMov.id), cleanForFirestore(outMov));
        tx.set(doc(db, 'users', userId, 'treasuryMovements', inMov.id), cleanForFirestore(inMov));

        if (feeAmount > 0) {
          const feeMov: TreasuryMovement = {
            id: `tmov-${baseTs}-2-${Math.random().toString(36).substring(2, 6)}`,
            date: nowIso,
            accountId: srcAcc.id,
            accountName: srcAcc.name,
            accountCurrency: srcAcc.currency,
            direction: 'out',
            amount: feeAmount,
            balanceBefore: srcAfterTransfer,
            balanceAfter: srcFinal,
            bcvRate: safeBcv,
            type: 'comision_bancaria',
            concept: `Comisión Bancaria por transferencia hacia ${dstAcc.name}`,
            reference: params.reference,
            linkedEntityType: 'transfer',
            linkedEntityId: transferPairId,
            transferPairId,
            notes: params.notes,
            createdBy: params.createdBy
          };
          tx.set(doc(db, 'users', userId, 'treasuryMovements', feeMov.id), cleanForFirestore(feeMov));

          const feeExpense = buildBankCommissionExpenseDoc({
            feeAmount,
            feeCurrency: srcAcc.currency,
            bcvRate: safeBcv,
            paymentMethod: 'transferencia',
            bankAccountId: srcAcc.id,
            bankAccountLabel: srcAcc.name,
            concept: `Transferencia interna hacia ${dstAcc.name}`,
            reference: params.reference,
            dateIso: nowIso
          });
          tx.set(doc(db, 'users', userId, 'expenses', feeExpense.id), cleanForFirestore(feeExpense));
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic Initial Balance / Audited Balance Adjustment (Manager PIN verified in UI).
 */
export const adjustTreasuryAccountBalanceTransaction = async (
  uid: string,
  params: {
    accountId: string;
    newBalance: number;
    bcvRate: number;
    reason?: string;
    setAsInitialBalance?: boolean;
    createdBy?: string;
  }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/bankAccounts/${params.accountId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const accRef = doc(db, 'users', userId, 'bankAccounts', params.accountId);
        const snap = await tx.get(accRef);
        const nowIso = new Date().toISOString();
        const acc: TreasuryAccount = snap.exists()
          ? (snap.data() as TreasuryAccount)
          : buildFallbackTreasuryAccount(params.accountId, nowIso);

        const prevBal = round2(Number(acc.balance) || 0);
        const targetBal = round2(Number(params.newBalance) || 0);
        const diff = round2(targetBal - prevBal);

        const updatedAcc: TreasuryAccount = {
          ...acc,
          balance: targetBal,
          initialBalance: params.setAsInitialBalance ? targetBal : round2(Number(acc.initialBalance) || 0),
          updatedAt: nowIso
        };

        tx.set(accRef, cleanForFirestore(updatedAcc), { merge: true });

        if (isTreasuryEnabled(userId)) {
          const mov: TreasuryMovement = {
            id: `tmov-adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: nowIso,
            accountId: acc.id,
            accountName: acc.name,
            accountCurrency: acc.currency,
            direction: diff >= 0 ? 'in' : 'out',
            amount: Math.abs(diff),
            balanceBefore: prevBal,
            balanceAfter: targetBal,
            bcvRate: params.bcvRate > 0 ? params.bcvRate : 1,
            type: 'ajuste_inicial',
            concept: params.reason?.trim() || 'Ajuste de Saldo Inicial / Conciliación de Gerencia',
            notes: `Autorizado con Clave de Gerente. Saldo anterior: ${prevBal.toFixed(2)} ${acc.currency} → Nuevo saldo: ${targetBal.toFixed(2)} ${acc.currency}`,
            createdBy: params.createdBy
          };
          tx.set(doc(db, 'users', userId, 'treasuryMovements', mov.id), cleanForFirestore(mov));
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
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
  newFiado?: FiadoRecord,
  treasuryOptions?: SaleTreasuryOptions
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
      const saleTreasuryPostings = buildSaleTreasuryPostings(syncedSale, 'in', 'venta', treasuryOptions);

      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, 'users', userId, 'sales', syncedSale.id);
        const productIds = Array.from(consolidatedDeductions.keys());
        const prodRefs = productIds.map((pid) => doc(db, 'users', userId, 'products', pid));

        // ALL READS BEFORE ANY WRITES (including idempotency check on saleRef)
        const [existingSaleSnap, prodSnaps, treasuryPlan] = await Promise.all([
          tx.get(saleRef),
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          prepareTreasuryPostingsInTx(tx, userId, saleTreasuryPostings, syncedSale.bcvRate || bcvRate)
        ]);

        if (existingSaleSnap.exists()) {
          return;
        }

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
        tx.set(saleRef, cleanForFirestore(syncedSale));

        for (const item of preparedUpdates) {
          tx.update(item.ref, item.patch);
          if (!isOptionalCollectionDenied(userId, 'kardex')) {
            const kRef = doc(db, 'users', userId, 'kardex', item.kardex.id);
            tx.set(kRef, cleanForFirestore(item.kardex));
          }
        }

        if (newFiado) {
          const fiadoRef = doc(db, 'users', userId, 'fiados', newFiado.id);
          tx.set(fiadoRef, cleanForFirestore(newFiado));
        }

        treasuryPlan.commitWrites();
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
  userName?: string,
  treasuryOptions?: SaleTreasuryOptions
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

        const reversalPostings = buildSaleTreasuryPostings(liveSale, 'out', 'anulacion', treasuryOptions);

        // Read all products, linked fiados & treasury accounts BEFORE any writes
        const [prodSnaps, fiadoSnaps, treasuryPlan] = await Promise.all([
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          Promise.all(fiadoRefs.map((ref) => tx.get(ref))),
          prepareTreasuryPostingsInTx(tx, userId, reversalPostings, liveSale.bcvRate || 1)
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
          if (!isOptionalCollectionDenied(userId, 'kardex')) {
            tx.set(doc(db, 'users', userId, 'kardex', u.kardex.id), cleanForFirestore(u.kardex));
          }
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

        treasuryPlan.commitWrites();
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
    treasuryBankAccountId?: string;
    treasuryBankAccountName?: string;
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

        let refundedExemptUSD = 0;
        let refundedInclusiveGrossUSD = 0;
        let refundedExclusiveTaxableUSD = 0;
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

          const itemExempt = typeof originalItem.isExemptFromIVA === 'boolean'
            ? originalItem.isExemptFromIVA
            : Boolean(originalItem.product.isExemptFromIVA);

          if (itemExempt) {
            refundedExemptUSD = round2(refundedExemptUSD + totalItemUSD);
          } else if (Boolean(originalItem.product.priceIncludesIVA)) {
            refundedInclusiveGrossUSD = round2(refundedInclusiveGrossUSD + totalItemUSD);
          } else {
            refundedExclusiveTaxableUSD = round2(refundedExclusiveTaxableUSD + totalItemUSD);
          }

          ncItems.push({
            productId: originalItem.product.id,
            productName: originalItem.product.name,
            quantity: requestedQty,
            unitPriceUSD,
            totalUSD: totalItemUSD,
            isExemptFromIVA: itemExempt
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

        const ncTreasuryAccountId = resolveTreasuryAccountIdForMethod(
          params.refundMethod,
          params.treasuryBankAccountId || liveSale.paymentDetails?.treasuryBankAccountId
        );

        // Read all remaining docs BEFORE any writes
        const [prodSnaps, fiadoSnaps, ncTreasuryAccSnap] = await Promise.all([
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          Promise.all(fiadoRefs.map((ref) => tx.get(ref))),
          ncTreasuryAccountId && isTreasuryEnabled(userId)
            ? tx.get(doc(db, 'users', userId, 'bankAccounts', ncTreasuryAccountId))
            : Promise.resolve(null)
        ]);

        const incBaseUSD = refundedInclusiveGrossUSD > 0 ? round2(refundedInclusiveGrossUSD / 1.16) : 0;
        const incIvaUSD = refundedInclusiveGrossUSD > 0 ? round2(refundedInclusiveGrossUSD - incBaseUSD) : 0;
        const excIvaUSD = refundedExclusiveTaxableUSD > 0 ? round2(refundedExclusiveTaxableUSD * 0.16) : 0;
        const refundedTaxableUSD = round2(incBaseUSD + refundedExclusiveTaxableUSD);
        const refundedSubtotalUSD = round2(refundedExemptUSD + refundedTaxableUSD);
        const rawRefundedIvaUSD = round2(incIvaUSD + excIvaUSD);

        const remainingIvaBudget = round2(
          Math.max(
            0,
            liveSale.ivaUSD - priorCreditNotesForSale.reduce((sum, nc) => sum + (nc.ivaUSD || 0), 0)
          )
        );
        const refundedIvaUSD = liveSale.ivaUSD > 0 ? Math.min(remainingIvaBudget, rawRefundedIvaUSD) : 0;

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
        const bcv =
          Number.isFinite(liveSale.bcvRate) && liveSale.bcvRate > 0
            ? liveSale.bcvRate
            : Number.isFinite(params.fallbackBcvRate) && params.fallbackBcvRate > 0
            ? params.fallbackBcvRate
            : 1;
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
          bankAccountId: isBankPaymentMethod(params.refundMethod) ? (ncTreasuryAccountId || undefined) : undefined,
          bankAccountLabel: isBankPaymentMethod(params.refundMethod)
            ? (ncTreasuryAccSnap && ncTreasuryAccSnap.exists()
                ? (ncTreasuryAccSnap.data() as TreasuryAccount).name
                : params.treasuryBankAccountName)
            : undefined,
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
          if (!isOptionalCollectionDenied(userId, 'kardex')) {
            tx.set(doc(db, 'users', userId, 'kardex', u.kardex.id), cleanForFirestore(u.kardex));
          }
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

        if (ncTreasuryAccountId && isTreasuryEnabled(userId)) {
          const accRef = doc(db, 'users', userId, 'bankAccounts', ncTreasuryAccountId);
          const acc: TreasuryAccount =
            ncTreasuryAccSnap && ncTreasuryAccSnap.exists()
              ? (ncTreasuryAccSnap.data() as TreasuryAccount)
              : buildFallbackTreasuryAccount(ncTreasuryAccountId, nowIso, params.treasuryBankAccountName, 'Bs');
          const debitAmt = acc.currency === 'USD' ? refundedTotalUSD : newCreditNote.totalBs;
          if (debitAmt > 0) {
            const balBefore = round2(Number(acc.balance) || 0);
            const balAfter = round2(balBefore - debitAmt);
            tx.set(accRef, cleanForFirestore({ ...acc, balance: balAfter, updatedAt: nowIso }), { merge: true });
            const mov: TreasuryMovement = {
              id: `tmov-nc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              date: nowIso,
              accountId: acc.id,
              accountName: acc.name,
              accountCurrency: acc.currency,
              direction: 'out',
              amount: debitAmt,
              balanceBefore: balBefore,
              balanceAfter: balAfter,
              bcvRate: bcv,
              type: 'nota_credito',
              concept: `Reembolso Nota de Crédito ${params.creditNoteNumber} (${liveSale.clientName})`,
              reference: params.creditNoteNumber,
              paymentMethod: params.refundMethod,
              linkedEntityType: 'creditNote',
              linkedEntityId: newCreditNote.id,
              notes: params.reason,
              createdBy: params.cashierName
            };
            tx.set(doc(db, 'users', userId, 'treasuryMovements', mov.id), cleanForFirestore(mov));
          }
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
        if (!isOptionalCollectionDenied(userId, 'kardex')) {
          tx.set(doc(db, 'users', userId, 'kardex', kardexEntry.id), cleanForFirestore(kardexEntry));
        }
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
      if (kardexEntry && !isOptionalCollectionDenied(userId, 'kardex')) {
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
          if (!isOptionalCollectionDenied(userId, 'kardex')) {
            tx.set(doc(db, 'users', userId, 'kardex', kardex.id), cleanForFirestore(kardex));
          }
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

export const saveExpenseToFirestore = async (
  uid: string,
  expense: Expense,
  options?: { defaultBsBankAccountId?: string; createdBy?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      const treasuryAccId =
        expense.paymentMethod === 'credito'
          ? null
          : resolveTreasuryAccountIdForMethod(
              expense.paymentMethod,
              expense.treasuryAccountId || expense.bankAccountId,
              options?.defaultBsBankAccountId
            );

      const feeAmount =
        expense.paymentMethod !== 'credito' &&
        isBankPaymentMethod(expense.paymentMethod) &&
        typeof expense.bankFeeAmount === 'number' &&
        expense.bankFeeAmount > 0 &&
        treasuryAccId
          ? round2(expense.bankFeeAmount)
          : 0;

      if (!treasuryAccId || !isTreasuryEnabled(userId)) {
        const cleaned = cleanForFirestore(expense);
        await setDoc(doc(db, 'users', userId, 'expenses', expense.id), cleaned, { merge: true });
        return;
      }

      const movType: TreasuryMovementType = isExpenseOwnerWithdrawal(expense)
        ? 'retiro_personal'
        : isExpenseOwnerSalary(expense)
        ? 'sueldo'
        : expense.category === 'Mercancía'
        ? 'compra'
        : 'gasto_operativo';

      await runTransaction(db, async (tx) => {
        const expRef = doc(db, 'users', userId, 'expenses', expense.id);
        const existingExpSnap = await tx.get(expRef);

        // Idempotency guard: if this expense already exists, update metadata ONLY without re-debiting Treasury or duplicating bank fees
        if (existingExpSnap.exists()) {
          tx.set(expRef, cleanForFirestore(expense), { merge: true });
          return;
        }

        const postings: TreasuryPostingInput[] = [
          {
            accountId: treasuryAccId,
            fallbackAccountName: expense.bankAccountLabel,
            fallbackCurrency: expense.enteredCurrency || (expense.paymentMethod === 'efectivo_usd' ? 'USD' : 'Bs'),
            direction: 'out',
            amountUSD: expense.amountUSD,
            amountBs: expense.amountBs,
            type: movType,
            concept: `${expense.category}: ${expense.description || expense.supplierName}`,
            reference: expense.reference || expense.invoiceNumber,
            paymentMethod: expense.paymentMethod,
            linkedEntityType: 'expense',
            linkedEntityId: expense.id,
            date: expense.date,
            createdBy: options?.createdBy
          }
        ];

        if (feeAmount > 0) {
          postings.push({
            accountId: treasuryAccId,
            fallbackAccountName: expense.bankAccountLabel,
            fallbackCurrency: expense.bankFeeCurrency || 'Bs',
            direction: 'out',
            exactNativeAmount: feeAmount,
            type: 'comision_bancaria',
            concept: `Comisión Bancaria (${expense.invoiceNumber || expense.supplierName})`,
            reference: expense.reference || expense.invoiceNumber,
            paymentMethod: expense.paymentMethod,
            linkedEntityType: 'expense',
            linkedEntityId: expense.id,
            date: expense.date,
            createdBy: options?.createdBy
          });
        }

        const treasuryPlan = await prepareTreasuryPostingsInTx(tx, userId, postings, expense.bcvRate || 1);

        tx.set(expRef, cleanForFirestore(expense), { merge: true });
        treasuryPlan.commitWrites();

        if (feeAmount > 0) {
          const feeCurrency = treasuryPlan.getAccountCurrency(treasuryAccId, expense.bankFeeCurrency || 'Bs');
          const feeAccountName = treasuryPlan.getAccountName(treasuryAccId, expense.bankAccountLabel || 'Banco');
          const feeExp = buildBankCommissionExpenseDoc({
            feeAmount,
            feeCurrency,
            bcvRate: expense.bcvRate || 1,
            paymentMethod: expense.paymentMethod === 'credito' ? 'transferencia' : expense.paymentMethod,
            bankAccountId: treasuryAccId,
            bankAccountLabel: feeAccountName,
            concept: `${expense.supplierName} (${expense.invoiceNumber || expense.description})`,
            reference: expense.reference || expense.invoiceNumber,
            dateIso: expense.date
          });
          tx.set(doc(db, 'users', userId, 'expenses', feeExp.id), cleanForFirestore(feeExp));
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Updates an existing expense document without re-debiting Treasury or creating duplicate bank fee entries.
 */
export const updateExpenseInFirestore = async (uid: string, expense: Expense): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(expense);
      await setDoc(doc(db, 'users', userId, 'expenses', expense.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic write for purchase invoice + inventory entry + supplier balance + Kardex + Treasury (`runTransaction`):
 * Always adds purchased stock on top of LIVE server stock so concurrent POS sales on another device are never lost.
 * If paymentMethod === 'credito', NO treasury account is debited (tracked in Cuentas por Pagar until paid).
 */
export const saveExpenseWithInventoryAtomic = async (
  uid: string,
  expense: Expense,
  bcvRate: number,
  baseCurrency: BaseCurrency,
  linkedCuenta?: CuentaPorPagar,
  userName?: string,
  defaultBsBankAccountId?: string
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      const treasuryAccId =
        expense.paymentMethod === 'credito'
          ? null
          : resolveTreasuryAccountIdForMethod(
              expense.paymentMethod,
              expense.treasuryAccountId || expense.bankAccountId,
              defaultBsBankAccountId
            );

      const feeAmount =
        expense.paymentMethod !== 'credito' &&
        isBankPaymentMethod(expense.paymentMethod) &&
        typeof expense.bankFeeAmount === 'number' &&
        expense.bankFeeAmount > 0 &&
        treasuryAccId
          ? round2(expense.bankFeeAmount)
          : 0;

      const movType: TreasuryMovementType = isExpenseOwnerWithdrawal(expense)
        ? 'retiro_personal'
        : isExpenseOwnerSalary(expense)
        ? 'sueldo'
        : (expense.items && expense.items.length > 0) || expense.category === 'Mercancía'
        ? 'compra'
        : 'gasto_operativo';

      const treasuryPostings: TreasuryPostingInput[] = [];
      if (treasuryAccId) {
        treasuryPostings.push({
          accountId: treasuryAccId,
          fallbackAccountName: expense.bankAccountLabel,
          fallbackCurrency: expense.enteredCurrency || (expense.paymentMethod === 'efectivo_usd' ? 'USD' : 'Bs'),
          direction: 'out',
          amountUSD: expense.amountUSD,
          amountBs: expense.amountBs,
          type: movType,
          concept: `Compra ${expense.invoiceNumber} - ${expense.supplierName}`,
          reference: expense.reference || expense.invoiceNumber,
          paymentMethod: expense.paymentMethod,
          linkedEntityType: 'expense',
          linkedEntityId: expense.id,
          date: expense.date,
          createdBy: userName
        });
        if (feeAmount > 0) {
          treasuryPostings.push({
            accountId: treasuryAccId,
            fallbackAccountName: expense.bankAccountLabel,
            fallbackCurrency: expense.bankFeeCurrency || 'Bs',
            direction: 'out',
            exactNativeAmount: feeAmount,
            type: 'comision_bancaria',
            concept: `Comisión Bancaria por compra ${expense.invoiceNumber} (${expense.supplierName})`,
            reference: expense.reference || expense.invoiceNumber,
            paymentMethod: expense.paymentMethod,
            linkedEntityType: 'expense',
            linkedEntityId: expense.id,
            date: expense.date,
            createdBy: userName
          });
        }
      }

      await runTransaction(db, async (tx) => {
        const expRef = doc(db, 'users', userId, 'expenses', expense.id);
        const items = expense.items || [];
        const uniqueProdIds = Array.from(new Set(items.map((it) => it.productId).filter(Boolean)));
        const prodRefs = uniqueProdIds.map((pid) => doc(db, 'users', userId, 'products', pid));
        const supplierRef =
          linkedCuenta && expense.supplierId
            ? doc(db, 'users', userId, 'suppliers', expense.supplierId)
            : null;

        // ALL READS FIRST (including idempotency check on expRef)
        const [existingExpSnap, prodSnaps, supSnap, treasuryPlan] = await Promise.all([
          tx.get(expRef),
          Promise.all(prodRefs.map((ref) => tx.get(ref))),
          supplierRef ? tx.get(supplierRef) : Promise.resolve(null),
          prepareTreasuryPostingsInTx(tx, userId, treasuryPostings, expense.bcvRate || bcvRate)
        ]);

        if (existingExpSnap.exists()) {
          tx.set(expRef, cleanForFirestore(expense), { merge: true });
          return;
        }

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

            const effectiveRate = expense.bcvRate > 0 ? expense.bcvRate : bcvRate;
            nextProd.costUSD = weightedAvgCost > 0 ? weightedAvgCost : incomingCostUSD;

            if (item.newPriceCurrency === 'Bs' && typeof item.newPriceBs === 'number' && item.newPriceBs > 0) {
              const exactNewPriceBs = round2(item.newPriceBs);
              nextProd.priceBsFixed = exactNewPriceBs;
              nextProd.priceCurrency = 'Bs';
              nextProd.priceUSD = effectiveRate > 0
                ? round6(exactNewPriceBs / effectiveRate)
                : round6(item.newPriceUSD || nextProd.priceUSD);
            } else if (item.newPriceCurrency === 'USD' && typeof item.newPriceUSD === 'number' && item.newPriceUSD > 0) {
              nextProd.priceUSD = round6(item.newPriceUSD);
              nextProd.priceCurrency = 'USD';
              nextProd.priceBsFixed = undefined;
            } else if (item.newPriceUSD && item.newPriceUSD > 0) {
              nextProd.priceUSD = round2(item.newPriceUSD);
              if (baseCurrency === 'VED') {
                nextProd.priceBsFixed = round2(nextProd.priceUSD * effectiveRate);
                nextProd.priceCurrency = 'Bs';
              }
            } else {
              const margin = previousCost > 0 ? (previousPrice - previousCost) / previousCost : 0.30;
              nextProd.priceUSD = round2(incomingCostUSD * (1 + Math.max(0, margin)));
              if (baseCurrency === 'VED') {
                nextProd.priceBsFixed = round2(nextProd.priceUSD * effectiveRate);
                nextProd.priceCurrency = 'Bs';
              }
            }

            const salePriceLabel = nextProd.priceCurrency === 'Bs' && typeof nextProd.priceBsFixed === 'number' && nextProd.priceBsFixed > 0
              ? `Bs. ${nextProd.priceBsFixed.toFixed(2)}`
              : `$${nextProd.priceUSD.toFixed(2)}`;
            nextProd.purchaseNote = `Actualizado Factura ${expense.invoiceNumber} - Costo Prom. $${nextProd.costUSD.toFixed(2)} / Venta ${salePriceLabel}`;
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

        if (!isOptionalCollectionDenied(userId, 'kardex')) {
          for (const kEntry of kardexEntries) {
            tx.set(doc(db, 'users', userId, 'kardex', kEntry.id), cleanForFirestore(kEntry));
          }
        }

        treasuryPlan.commitWrites();

        if (feeAmount > 0 && treasuryAccId) {
          const feeCurrency = treasuryPlan.getAccountCurrency(treasuryAccId, expense.bankFeeCurrency || 'Bs');
          const feeAccountName = treasuryPlan.getAccountName(treasuryAccId, expense.bankAccountLabel || 'Banco');
          const feeExp = buildBankCommissionExpenseDoc({
            feeAmount,
            feeCurrency,
            bcvRate: expense.bcvRate || bcvRate,
            paymentMethod: expense.paymentMethod === 'credito' ? 'transferencia' : expense.paymentMethod,
            bankAccountId: treasuryAccId,
            bankAccountLabel: feeAccountName,
            concept: `Factura de compra ${expense.invoiceNumber} (${expense.supplierName})`,
            reference: expense.reference || expense.invoiceNumber,
            dateIso: expense.date
          });
          tx.set(doc(db, 'users', userId, 'expenses', feeExp.id), cleanForFirestore(feeExp));
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
  notes?: string,
  options?: {
    bankAccountId?: string;
    bankAccountLabel?: string;
    defaultBsBankAccountId?: string;
    createdBy?: string;
  }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/fiados/${fiadoId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const fiadoRef = doc(db, 'users', userId, 'fiados', fiadoId);
        const treasuryAccId = resolveTreasuryAccountIdForMethod(
          method,
          options?.bankAccountId,
          options?.defaultBsBankAccountId
        );

        // ALL READS FIRST
        const [snap, treasuryAccSnap] = await Promise.all([
          tx.get(fiadoRef),
          treasuryAccId && isTreasuryEnabled(userId)
            ? tx.get(doc(db, 'users', userId, 'bankAccounts', treasuryAccId))
            : Promise.resolve(null)
        ]);

        if (!snap.exists()) {
          throw new Error('Registro de deuda (fiado) no encontrado.');
        }
        const live = snap.data() as FiadoRecord;
        const liveRemaining = round2(Number(live.remainingDebtUSD) || 0);
        if (liveRemaining <= 0.009) {
          throw new Error('Esta cuenta por cobrar ya fue saldada completamente.');
        }

        const payUSD = Math.min(liveRemaining, Math.max(0.01, round2(amountUSD)));
        const payBs = round2(payUSD * bcvRate);
        const newRemaining = round2(Math.max(0, liveRemaining - payUSD));
        const nowIso = new Date().toISOString();
        const newAbono: Abono = {
          id: 'abono-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          amountUSD: payUSD,
          amountBs: payBs,
          bcvRate,
          paymentMethod: method,
          bankAccountId: treasuryAccId && isBankPaymentMethod(method) ? treasuryAccId : undefined,
          bankAccountLabel: options?.bankAccountLabel,
          treasuryAccountId: treasuryAccId || undefined,
          reference,
          notes
        };

        tx.update(fiadoRef, {
          remainingDebtUSD: newRemaining,
          status: newRemaining <= 0.009 ? 'saldado' : 'parcial',
          abonos: cleanForFirestore([newAbono, ...(live.abonos || [])])
        });

        if (treasuryAccId && isTreasuryEnabled(userId)) {
          const accRef = doc(db, 'users', userId, 'bankAccounts', treasuryAccId);
          const acc: TreasuryAccount =
            treasuryAccSnap && treasuryAccSnap.exists()
              ? (treasuryAccSnap.data() as TreasuryAccount)
              : buildFallbackTreasuryAccount(
                  treasuryAccId,
                  nowIso,
                  options?.bankAccountLabel,
                  method === 'efectivo_usd' ? 'USD' : 'Bs'
                );
          const creditAmt = acc.currency === 'USD' ? payUSD : payBs;
          const balBefore = round2(Number(acc.balance) || 0);
          const balAfter = round2(balBefore + creditAmt);
          tx.set(accRef, cleanForFirestore({ ...acc, balance: balAfter, updatedAt: nowIso }), { merge: true });

          const mov: TreasuryMovement = {
            id: `tmov-fiado-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: nowIso,
            accountId: acc.id,
            accountName: acc.name,
            accountCurrency: acc.currency,
            direction: 'in',
            amount: creditAmt,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            bcvRate: bcvRate > 0 ? bcvRate : 1,
            type: 'abono_fiado',
            concept: `Abono Fiado ${live.invoiceNumber} (${live.clientName})`,
            reference: reference || live.invoiceNumber,
            paymentMethod: method,
            linkedEntityType: 'fiado',
            linkedEntityId: live.id,
            notes,
            createdBy: options?.createdBy
          };
          tx.set(doc(db, 'users', userId, 'treasuryMovements', mov.id), cleanForFirestore(mov));
        }
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

export const saveLoanToFirestore = async (
  uid: string,
  loan: Loan,
  options?: { defaultBsBankAccountId?: string; createdBy?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/loans/${loan.id}`;
  const op = (async () => {
    try {
      const treasuryAccId =
        loan.cashDestination === 'externo_dueno'
          ? null
          : resolveTreasuryAccountIdForMethod(
              loan.cashDestination,
              loan.bankAccountId,
              options?.defaultBsBankAccountId
            );

      if (!treasuryAccId || !isTreasuryEnabled(userId)) {
        const cleaned = cleanForFirestore(loan);
        await setDoc(doc(db, 'users', userId, 'loans', loan.id), cleaned, { merge: true });
        return;
      }

      await runTransaction(db, async (tx) => {
        const loanRef = doc(db, 'users', userId, 'loans', loan.id);
        const existingLoanSnap = await tx.get(loanRef);

        // Idempotency guard: if loan already exists, update metadata only without re-crediting Treasury
        if (existingLoanSnap.exists()) {
          tx.set(loanRef, cleanForFirestore(loan), { merge: true });
          return;
        }

        const postings: TreasuryPostingInput[] = [
          {
            accountId: treasuryAccId,
            fallbackAccountName: loan.bankAccountLabel,
            fallbackCurrency: loan.enteredCurrency || (loan.cashDestination === 'efectivo_usd' ? 'USD' : 'Bs'),
            direction: 'in',
            amountUSD: loan.originalAmountUSD,
            amountBs: loan.originalAmountBs,
            type: 'prestamo',
            concept: `Ingreso Préstamo / Crédito (${loan.lenderName})`,
            reference: loan.reference,
            paymentMethod: loan.cashDestination,
            linkedEntityType: 'loan',
            linkedEntityId: loan.id,
            date: loan.grantDate || loan.createdAt,
            notes: loan.description || loan.notes,
            createdBy: options?.createdBy
          }
        ];

        const treasuryPlan = await prepareTreasuryPostingsInTx(tx, userId, postings, loan.bcvRate || 1);
        tx.set(loanRef, cleanForFirestore(loan), { merge: true });
        treasuryPlan.commitWrites();
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

export const updateLoanInFirestore = async (uid: string, loan: Loan): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/loans/${loan.id}`;
  const op = (async () => {
    try {
      const loanRef = doc(db, 'users', userId, 'loans', loan.id);
      const cleaned = cleanForFirestore(loan) as unknown as Record<string, any>;
      if (!loan.lenderRIF) cleaned.lenderRIF = deleteField();
      if (!loan.lenderPhone) cleaned.lenderPhone = deleteField();
      if (!loan.reference) cleaned.reference = deleteField();
      if (!loan.description) cleaned.description = deleteField();
      if (!loan.bankAccountId) cleaned.bankAccountId = deleteField();
      if (!loan.bankAccountLabel) cleaned.bankAccountLabel = deleteField();
      if (!loan.notes) cleaned.notes = deleteField();
      try {
        await updateDoc(loanRef, cleaned);
      } catch (err: any) {
        if (err?.code === 'not-found') {
          await setDoc(loanRef, cleanForFirestore(loan), { merge: true });
        } else {
          throw err;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

export const deleteLoanFromFirestore = async (uid: string, loanId: string): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/loans/${loanId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'users', userId, 'loans', loanId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic abono for Loan (`runTransaction`):
 * Reads live Loan, applies exact bimonetary abono without rounding drift,
 * and writes cash outflow Expense when paid from operational cash/bank.
 */
export const addAbonoToLoanTransaction = async (
  uid: string,
  loanId: string,
  params: {
    amount: number;
    enteredCurrency: 'USD' | 'Bs';
    method: PaymentMethod | 'externo_dueno';
    bcvRate: number;
    reference?: string;
    notes?: string;
    bankAccountId?: string;
    bankAccountLabel?: string;
    defaultBsBankAccountId?: string;
    bankFeeAmount?: number;
    createdBy?: string;
  }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/loans/${loanId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const loanRef = doc(db, 'users', userId, 'loans', loanId);
        const treasuryAccId =
          params.method === 'externo_dueno'
            ? null
            : resolveTreasuryAccountIdForMethod(
                params.method,
                params.bankAccountId,
                params.defaultBsBankAccountId
              );

        // ALL READS FIRST
        const [loanSnap, treasuryAccSnap] = await Promise.all([
          tx.get(loanRef),
          treasuryAccId && isTreasuryEnabled(userId)
            ? tx.get(doc(db, 'users', userId, 'bankAccounts', treasuryAccId))
            : Promise.resolve(null)
        ]);

        if (!loanSnap.exists()) {
          throw new Error('Préstamo o crédito no encontrado en Cloud Firestore.');
        }

        const liveLoan = loanSnap.data() as Loan;
        const liveRemainingUSD = round2(Number(liveLoan.remainingUSD) || 0);
        const liveRemainingBs = round2(Number(liveLoan.remainingBs) || 0);
        if (liveRemainingUSD <= 0.009 && liveRemainingBs <= 0.01) {
          throw new Error('Este préstamo ya fue pagado completamente.');
        }

        const safeRate = params.bcvRate > 0 ? params.bcvRate : (liveLoan.bcvRate > 0 ? liveLoan.bcvRate : 1);
        let payUSD = 0;
        let payBs = 0;
        let isSettled = false;

        if (params.enteredCurrency === 'Bs') {
          const rawPayBs = round2(Math.max(0.01, params.amount));
          if (liveLoan.enteredCurrency === 'Bs') {
            payBs = Math.min(liveRemainingBs, rawPayBs);
            isSettled = (liveRemainingBs - payBs) <= 0.01;
            payUSD = isSettled ? liveRemainingUSD : round6(payBs / safeRate);
          } else {
            const equivUSD = round6(rawPayBs / safeRate);
            isSettled = equivUSD >= liveRemainingUSD - 0.009;
            payUSD = isSettled ? liveRemainingUSD : Math.min(liveRemainingUSD, round2(equivUSD));
            payBs = rawPayBs;
          }
        } else {
          const rawPayUSD = round2(Math.max(0.01, params.amount));
          payUSD = Math.min(liveRemainingUSD, rawPayUSD);
          isSettled = (liveRemainingUSD - payUSD) <= 0.009;
          payBs = isSettled && liveLoan.enteredCurrency === 'Bs'
            ? liveRemainingBs
            : round2(payUSD * safeRate);
        }

        const newPaidUSD = round2((Number(liveLoan.paidAmountUSD) || 0) + payUSD);
        const newPaidBs = round2((Number(liveLoan.paidAmountBs) || 0) + payBs);
        const newRemainingUSD = isSettled ? 0 : round2(Math.max(0, liveLoan.originalAmountUSD - newPaidUSD));
        const newRemainingBs = isSettled
          ? 0
          : liveLoan.enteredCurrency === 'Bs'
            ? round2(Math.max(0, liveLoan.originalAmountBs - newPaidBs))
            : round2(newRemainingUSD * safeRate);

        const finalizedSettled = isSettled || (newRemainingUSD <= 0.009 && newRemainingBs <= 0.01);
        const nowIso = new Date().toISOString();

        const acc: TreasuryAccount | null =
          treasuryAccId && isTreasuryEnabled(userId)
            ? treasuryAccSnap && treasuryAccSnap.exists()
              ? (treasuryAccSnap.data() as TreasuryAccount)
              : buildFallbackTreasuryAccount(
                  treasuryAccId,
                  nowIso,
                  params.bankAccountLabel,
                  params.method === 'efectivo_usd' ? 'USD' : 'Bs'
                )
            : null;

        const feeAmount =
          params.method !== 'externo_dueno' &&
          isBankPaymentMethod(params.method) &&
          typeof params.bankFeeAmount === 'number' &&
          params.bankFeeAmount > 0 &&
          treasuryAccId
            ? round2(params.bankFeeAmount)
            : 0;
        const feeCurrency: TreasuryCurrency = acc?.currency || 'Bs';

        const newAbono: LoanAbono = {
          id: 'abono-loan-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          amountUSD: round2(payUSD),
          amountBs: round2(payBs),
          bcvRate: safeRate,
          enteredCurrency: params.enteredCurrency,
          paymentMethod: params.method,
          bankAccountId: treasuryAccId && isBankPaymentMethod(params.method) ? treasuryAccId : undefined,
          bankAccountLabel: params.bankAccountLabel || acc?.name,
          bankFeeAmount: feeAmount > 0 ? feeAmount : undefined,
          bankFeeCurrency: feeAmount > 0 ? feeCurrency : undefined,
          reference: params.reference,
          notes: params.notes || 'Abono a préstamo / crédito'
        };

        tx.update(loanRef, {
          paidAmountUSD: newPaidUSD,
          paidAmountBs: newPaidBs,
          remainingUSD: finalizedSettled ? 0 : newRemainingUSD,
          remainingBs: finalizedSettled ? 0 : newRemainingBs,
          status: finalizedSettled ? 'pagado' : 'parcial',
          abonos: cleanForFirestore([newAbono, ...(liveLoan.abonos || [])])
        });

        if (params.method !== 'externo_dueno') {
          const cashOutflowExpense: Expense = {
            id: 'exp-loan-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
            date: nowIso,
            invoiceNumber: liveLoan.reference || 'PRESTAMO-ABONO',
            controlNumber: '00-00000',
            supplierName: liveLoan.lenderName,
            supplierRIF: liveLoan.lenderRIF || 'N/A',
            supplierPhone: liveLoan.lenderPhone,
            description: `Abono Préstamo/Crédito (${liveLoan.lenderName})${params.notes ? ` - ${params.notes}` : ''}`,
            category: 'Otros',
            amountUSD: round2(payUSD),
            amountBs: round2(payBs),
            baseImponibleBs: 0,
            ivaBs: 0,
            retencionIVABs: 0,
            retencionISLRBs: 0,
            bcvRate: safeRate,
            enteredCurrency: params.enteredCurrency,
            paymentMethod: mapMethodToExpenseMethod(params.method),
            bankAccountId: treasuryAccId && isBankPaymentMethod(params.method) ? treasuryAccId : undefined,
            bankAccountLabel: params.bankAccountLabel || acc?.name,
            treasuryAccountId: treasuryAccId || undefined,
            bankFeeAmount: feeAmount > 0 ? feeAmount : undefined,
            bankFeeCurrency: feeAmount > 0 ? feeCurrency : undefined,
            excludeFromLibroCompras: true,
            reference: params.reference,
            linkedLoanId: liveLoan.id
          };
          tx.set(doc(db, 'users', userId, 'expenses', cashOutflowExpense.id), cleanForFirestore(cashOutflowExpense));

          if (acc && treasuryAccId) {
            const accRef = doc(db, 'users', userId, 'bankAccounts', treasuryAccId);
            const debitAmt = acc.currency === 'USD' ? round2(payUSD) : round2(payBs);
            const balBefore = round2(Number(acc.balance) || 0);
            const balAfterPay = round2(balBefore - debitAmt);
            const balFinal = feeAmount > 0 ? round2(balAfterPay - feeAmount) : balAfterPay;
            const baseTs = Date.now();

            tx.set(accRef, cleanForFirestore({ ...acc, balance: balFinal, updatedAt: nowIso }), { merge: true });
            const payMov: TreasuryMovement = {
              id: `tmov-loan-${baseTs}-0-${Math.random().toString(36).substring(2, 6)}`,
              date: nowIso,
              accountId: acc.id,
              accountName: acc.name,
              accountCurrency: acc.currency,
              direction: 'out',
              amount: debitAmt,
              balanceBefore: balBefore,
              balanceAfter: balAfterPay,
              bcvRate: safeRate,
              type: 'prestamo',
              concept: `Abono Préstamo (${liveLoan.lenderName})`,
              reference: params.reference || liveLoan.reference,
              paymentMethod: params.method,
              linkedEntityType: 'loan',
              linkedEntityId: liveLoan.id,
              notes: params.notes,
              createdBy: params.createdBy
            };
            tx.set(doc(db, 'users', userId, 'treasuryMovements', payMov.id), cleanForFirestore(payMov));

            if (feeAmount > 0) {
              const feeMov: TreasuryMovement = {
                id: `tmov-loan-${baseTs}-1-${Math.random().toString(36).substring(2, 6)}`,
                date: nowIso,
                accountId: acc.id,
                accountName: acc.name,
                accountCurrency: acc.currency,
                direction: 'out',
                amount: feeAmount,
                balanceBefore: balAfterPay,
                balanceAfter: balFinal,
                bcvRate: safeRate,
                type: 'comision_bancaria',
                concept: `Comisión Bancaria por abono préstamo (${liveLoan.lenderName})`,
                reference: params.reference || liveLoan.reference,
                paymentMethod: params.method,
                linkedEntityType: 'loan',
                linkedEntityId: liveLoan.id,
                createdBy: params.createdBy
              };
              tx.set(doc(db, 'users', userId, 'treasuryMovements', feeMov.id), cleanForFirestore(feeMov));
            }
          }

          if (feeAmount > 0 && treasuryAccId) {
            const feeExp = buildBankCommissionExpenseDoc({
              feeAmount,
              feeCurrency,
              bcvRate: safeRate,
              paymentMethod: mapMethodToExpenseMethod(params.method),
              bankAccountId: treasuryAccId,
              bankAccountLabel: params.bankAccountLabel || acc?.name || 'Banco',
              concept: `Abono Préstamo (${liveLoan.lenderName})`,
              reference: params.reference || liveLoan.reference,
              dateIso: nowIso,
              linkedLoanId: liveLoan.id
            });
            tx.set(doc(db, 'users', userId, 'expenses', feeExp.id), cleanForFirestore(feeExp));
          }
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
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
  notes?: string,
  options?: TreasuryPaymentOptions & { defaultBsBankAccountId?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/cuentasPorPagar/${cuentaId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const cuentaRef = doc(db, 'users', userId, 'cuentasPorPagar', cuentaId);
        const treasuryAccId = resolveTreasuryAccountIdForMethod(
          method,
          options?.bankAccountId,
          options?.defaultBsBankAccountId
        );

        const [cuentaSnap, treasuryAccSnap] = await Promise.all([
          tx.get(cuentaRef),
          treasuryAccId && isTreasuryEnabled(userId)
            ? tx.get(doc(db, 'users', userId, 'bankAccounts', treasuryAccId))
            : Promise.resolve(null)
        ]);
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

        const safeRate = bcvRate > 0 ? bcvRate : 1;
        let payAmount: number;
        let payBs: number;
        if (options?.enteredCurrency === 'Bs' && typeof options.exactAmountBs === 'number' && options.exactAmountBs > 0) {
          payBs = round2(options.exactAmountBs);
          payAmount = Math.min(liveRemaining, Math.max(0.01, round2(payBs / safeRate)));
        } else {
          payAmount = Math.min(liveRemaining, Math.max(0.01, round2(amountUSD)));
          payBs = round2(payAmount * safeRate);
        }

        const newPaid = round2((Number(liveCuenta.paidAmountUSD) || 0) + payAmount);
        const newRemaining = round2(Math.max(0, liveCuenta.totalAmountUSD - newPaid));
        const nowIso = new Date().toISOString();

        const acc: TreasuryAccount | null =
          treasuryAccId && isTreasuryEnabled(userId)
            ? treasuryAccSnap && treasuryAccSnap.exists()
              ? (treasuryAccSnap.data() as TreasuryAccount)
              : buildFallbackTreasuryAccount(
                  treasuryAccId,
                  nowIso,
                  options?.bankAccountLabel,
                  method === 'efectivo_usd' ? 'USD' : 'Bs'
                )
            : null;

        const feeAmount =
          isBankPaymentMethod(method) &&
          typeof options?.bankFeeAmount === 'number' &&
          options.bankFeeAmount > 0 &&
          treasuryAccId
            ? round2(options.bankFeeAmount)
            : 0;
        const feeCurrency: TreasuryCurrency = acc?.currency || 'Bs';

        const newAbono: Abono = {
          id: 'abono-cpp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          amountUSD: payAmount,
          amountBs: payBs,
          bcvRate: safeRate,
          enteredCurrency: options?.enteredCurrency,
          paymentMethod: method,
          bankAccountId: treasuryAccId && isBankPaymentMethod(method) ? treasuryAccId : undefined,
          bankAccountLabel: options?.bankAccountLabel || acc?.name,
          treasuryAccountId: treasuryAccId || undefined,
          bankFeeAmount: feeAmount > 0 ? feeAmount : undefined,
          bankFeeCurrency: feeAmount > 0 ? feeCurrency : undefined,
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
          baseImponibleBs: 0,
          ivaBs: 0,
          retencionIVABs: 0,
          retencionISLRBs: 0,
          bcvRate: safeRate,
          enteredCurrency: options?.enteredCurrency,
          paymentMethod: mapMethodToExpenseMethod(method),
          bankAccountId: treasuryAccId && isBankPaymentMethod(method) ? treasuryAccId : undefined,
          bankAccountLabel: options?.bankAccountLabel || acc?.name,
          treasuryAccountId: treasuryAccId || undefined,
          bankFeeAmount: feeAmount > 0 ? feeAmount : undefined,
          bankFeeCurrency: feeAmount > 0 ? feeCurrency : undefined,
          excludeFromLibroCompras: true,
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

        if (acc && treasuryAccId) {
          const accRef = doc(db, 'users', userId, 'bankAccounts', treasuryAccId);
          const debitAmt = acc.currency === 'USD' ? payAmount : payBs;
          const balBefore = round2(Number(acc.balance) || 0);
          const balAfterPay = round2(balBefore - debitAmt);
          const balFinal = feeAmount > 0 ? round2(balAfterPay - feeAmount) : balAfterPay;
          const baseTs = Date.now();

          tx.set(accRef, cleanForFirestore({ ...acc, balance: balFinal, updatedAt: nowIso }), { merge: true });
          const payMov: TreasuryMovement = {
            id: `tmov-cpp-${baseTs}-0-${Math.random().toString(36).substring(2, 6)}`,
            date: nowIso,
            accountId: acc.id,
            accountName: acc.name,
            accountCurrency: acc.currency,
            direction: 'out',
            amount: debitAmt,
            balanceBefore: balBefore,
            balanceAfter: balAfterPay,
            bcvRate: safeRate,
            type: 'pago_proveedor',
            concept: `Pago a Proveedor ${liveCuenta.supplierName} (${liveCuenta.invoiceNumber})`,
            reference: reference || liveCuenta.invoiceNumber,
            paymentMethod: method,
            linkedEntityType: 'cuentaPorPagar',
            linkedEntityId: liveCuenta.id,
            notes,
            createdBy: options?.createdBy
          };
          tx.set(doc(db, 'users', userId, 'treasuryMovements', payMov.id), cleanForFirestore(payMov));

          if (feeAmount > 0) {
            const feeMov: TreasuryMovement = {
              id: `tmov-cpp-${baseTs}-1-${Math.random().toString(36).substring(2, 6)}`,
              date: nowIso,
              accountId: acc.id,
              accountName: acc.name,
              accountCurrency: acc.currency,
              direction: 'out',
              amount: feeAmount,
              balanceBefore: balAfterPay,
              balanceAfter: balFinal,
              bcvRate: safeRate,
              type: 'comision_bancaria',
              concept: `Comisión Bancaria por pago a ${liveCuenta.supplierName} (${liveCuenta.invoiceNumber})`,
              reference: reference || liveCuenta.invoiceNumber,
              paymentMethod: method,
              linkedEntityType: 'cuentaPorPagar',
              linkedEntityId: liveCuenta.id,
              createdBy: options?.createdBy
            };
            tx.set(doc(db, 'users', userId, 'treasuryMovements', feeMov.id), cleanForFirestore(feeMov));
          }
        }

        if (feeAmount > 0 && treasuryAccId) {
          const feeExp = buildBankCommissionExpenseDoc({
            feeAmount,
            feeCurrency,
            bcvRate: safeRate,
            paymentMethod: mapMethodToExpenseMethod(method),
            bankAccountId: treasuryAccId,
            bankAccountLabel: options?.bankAccountLabel || acc?.name || 'Banco',
            concept: `Pago proveedor ${liveCuenta.supplierName} (${liveCuenta.invoiceNumber})`,
            reference: reference || liveCuenta.invoiceNumber,
            dateIso: nowIso,
            linkedCuentaId: liveCuenta.id
          });
          tx.set(doc(db, 'users', userId, 'expenses', feeExp.id), cleanForFirestore(feeExp));
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
  cashExpense?: Expense,
  options?: { defaultBsBankAccountId?: string; createdBy?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/gastosOperativos/${gasto.id}`;
  const op = (async () => {
    try {
      const treasuryAccId = cashExpense
        ? resolveTreasuryAccountIdForMethod(
            cashExpense.paymentMethod,
            cashExpense.treasuryAccountId || cashExpense.bankAccountId || gasto.treasuryAccountId || gasto.bankAccountId,
            options?.defaultBsBankAccountId
          )
        : null;

      const feeAmount =
        cashExpense &&
        isBankPaymentMethod(cashExpense.paymentMethod) &&
        typeof (cashExpense.bankFeeAmount ?? gasto.bankFeeAmount) === 'number' &&
        (cashExpense.bankFeeAmount ?? gasto.bankFeeAmount ?? 0) > 0 &&
        treasuryAccId
          ? round2(cashExpense.bankFeeAmount ?? gasto.bankFeeAmount ?? 0)
          : 0;

      if (!cashExpense || !treasuryAccId || !isTreasuryEnabled(userId)) {
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', userId, 'gastosOperativos', gasto.id), cleanForFirestore(gasto), { merge: true });
        if (cashExpense) {
          batch.set(doc(db, 'users', userId, 'expenses', cashExpense.id), cleanForFirestore(cashExpense), { merge: true });
        }
        await batch.commit();
        return;
      }

      const movType: TreasuryMovementType = isExpenseOwnerWithdrawal(cashExpense)
        ? 'retiro_personal'
        : isExpenseOwnerSalary(cashExpense)
        ? 'sueldo'
        : 'gasto_operativo';

      await runTransaction(db, async (tx) => {
        const gastoRef = doc(db, 'users', userId, 'gastosOperativos', gasto.id);
        const existingGastoSnap = await tx.get(gastoRef);

        // Idempotency guard: if gasto already exists, update metadata only without re-debiting Treasury
        if (existingGastoSnap.exists()) {
          tx.set(gastoRef, cleanForFirestore(gasto), { merge: true });
          return;
        }

        const postings: TreasuryPostingInput[] = [
          {
            accountId: treasuryAccId,
            fallbackAccountName: cashExpense.bankAccountLabel || gasto.bankAccountLabel,
            fallbackCurrency: cashExpense.enteredCurrency || (cashExpense.paymentMethod === 'efectivo_usd' ? 'USD' : 'Bs'),
            direction: 'out',
            amountUSD: cashExpense.amountUSD,
            amountBs: cashExpense.amountBs,
            type: movType,
            concept: `${gasto.category}: ${gasto.concept}`,
            reference: cashExpense.reference || gasto.reference,
            paymentMethod: cashExpense.paymentMethod,
            linkedEntityType: 'gastoOperativo',
            linkedEntityId: gasto.id,
            date: cashExpense.date,
            notes: gasto.notes,
            createdBy: options?.createdBy
          }
        ];

        if (feeAmount > 0) {
          postings.push({
            accountId: treasuryAccId,
            fallbackAccountName: cashExpense.bankAccountLabel || gasto.bankAccountLabel,
            fallbackCurrency: cashExpense.bankFeeCurrency || gasto.bankFeeCurrency || 'Bs',
            direction: 'out',
            exactNativeAmount: feeAmount,
            type: 'comision_bancaria',
            concept: `Comisión Bancaria (${gasto.category}: ${gasto.concept})`,
            reference: cashExpense.reference || gasto.reference,
            paymentMethod: cashExpense.paymentMethod,
            linkedEntityType: 'gastoOperativo',
            linkedEntityId: gasto.id,
            date: cashExpense.date,
            createdBy: options?.createdBy
          });
        }

        const treasuryPlan = await prepareTreasuryPostingsInTx(tx, userId, postings, cashExpense.bcvRate || 1);

        tx.set(gastoRef, cleanForFirestore(gasto), { merge: true });
        tx.set(doc(db, 'users', userId, 'expenses', cashExpense.id), cleanForFirestore(cashExpense), { merge: true });
        treasuryPlan.commitWrites();

        if (feeAmount > 0) {
          const feeCurrency = treasuryPlan.getAccountCurrency(treasuryAccId, cashExpense.bankFeeCurrency || 'Bs');
          const feeAccountName = treasuryPlan.getAccountName(treasuryAccId, cashExpense.bankAccountLabel || 'Banco');
          const feeExp = buildBankCommissionExpenseDoc({
            feeAmount,
            feeCurrency,
            bcvRate: cashExpense.bcvRate || 1,
            paymentMethod: cashExpense.paymentMethod === 'credito' ? 'transferencia' : cashExpense.paymentMethod,
            bankAccountId: treasuryAccId,
            bankAccountLabel: feeAccountName,
            concept: `${gasto.category} (${gasto.concept})`,
            reference: cashExpense.reference || gasto.reference,
            dateIso: cashExpense.date,
            linkedGastoId: gasto.id
          });
          tx.set(doc(db, 'users', userId, 'expenses', feeExp.id), cleanForFirestore(feeExp));
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Transactional atomic payment for GastoOperativo (`runTransaction`) with Treasury debit & optional Comisión Bancaria
 */
export const markGastoOperativoPagadoTransaction = async (
  uid: string,
  gastoId: string,
  paymentMethod: PaymentMethod,
  bcvRate: number,
  reference?: string,
  amountUSD?: number,
  notes?: string,
  options?: TreasuryPaymentOptions & { defaultBsBankAccountId?: string }
): Promise<void> => {
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/gastosOperativos/${gastoId}`;
  const op = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const gastoRef = doc(db, 'users', userId, 'gastosOperativos', gastoId);
        const preTreasuryAccId = resolveTreasuryAccountIdForMethod(
          paymentMethod,
          options?.bankAccountId,
          options?.defaultBsBankAccountId
        );

        // ALL READS FIRST
        const [snap, preAccSnap] = await Promise.all([
          tx.get(gastoRef),
          preTreasuryAccId && isTreasuryEnabled(userId)
            ? tx.get(doc(db, 'users', userId, 'bankAccounts', preTreasuryAccId))
            : Promise.resolve(null)
        ]);
        if (!snap.exists()) {
          throw new Error('Gasto operativo no encontrado en Firestore.');
        }
        const liveTarget = snap.data() as GastoOperativo;
        const currentPaid = round2(liveTarget.paidAmountUSD ?? (liveTarget.status === 'pagado' ? liveTarget.amountUSD : 0));
        const currentRemaining = round2(liveTarget.remainingUSD ?? Math.max(0, liveTarget.amountUSD - currentPaid));
        if (currentRemaining <= 0.009) {
          throw new Error('Este gasto operativo ya se encuentra pagado en su totalidad.');
        }

        const resolvedTreasuryAccId =
          preTreasuryAccId ||
          resolveTreasuryAccountIdForMethod(paymentMethod, liveTarget.bankAccountId, options?.defaultBsBankAccountId);

        const treasuryAccSnap =
          resolvedTreasuryAccId && resolvedTreasuryAccId === preTreasuryAccId
            ? preAccSnap
            : resolvedTreasuryAccId && isTreasuryEnabled(userId)
            ? await tx.get(doc(db, 'users', userId, 'bankAccounts', resolvedTreasuryAccId))
            : null;

        const enteredCurrency: 'USD' | 'Bs' =
          options?.enteredCurrency ||
          (paymentMethod === 'efectivo_usd' ? 'USD' : liveTarget.enteredCurrency || 'USD');

        let payAmount: number;
        let payAmountBs: number;

        if (enteredCurrency === 'Bs' && typeof options?.exactAmountBs === 'number' && options.exactAmountBs > 0) {
          payAmountBs = round2(options.exactAmountBs);
          const equivUsd = bcvRate > 0 ? round2(payAmountBs / bcvRate) : round2(amountUSD || currentRemaining);
          payAmount = Math.min(currentRemaining, Math.max(0.01, equivUsd));
        } else {
          const requestedAmount =
            amountUSD !== undefined && !isNaN(amountUSD) && amountUSD > 0
              ? round2(amountUSD)
              : currentRemaining;
          payAmount = Math.min(currentRemaining, Math.max(0.01, requestedAmount));
          // Preserve exact original Bs if settling a Bs-entered full expense
          if (
            liveTarget.enteredCurrency === 'Bs' &&
            currentPaid === 0 &&
            Math.abs(payAmount - liveTarget.amountUSD) < 0.01 &&
            liveTarget.amountBs > 0
          ) {
            payAmountBs = round2(liveTarget.amountBs);
          } else {
            payAmountBs = round2(payAmount * bcvRate);
          }
        }

        const newPaid = round2(currentPaid + payAmount);
        const newRemaining = round2(Math.max(0, liveTarget.amountUSD - newPaid));
        const newStatus: GastoOperativo['status'] = newRemaining <= 0.009 ? 'pagado' : 'parcial';
        const nowIso = new Date().toISOString();
        const bankAccountId = options?.bankAccountId || liveTarget.bankAccountId || (isBankPaymentMethod(paymentMethod) ? resolvedTreasuryAccId || undefined : undefined);

        const acc: TreasuryAccount | null =
          resolvedTreasuryAccId && isTreasuryEnabled(userId)
            ? treasuryAccSnap && treasuryAccSnap.exists()
              ? (treasuryAccSnap.data() as TreasuryAccount)
              : buildFallbackTreasuryAccount(
                  resolvedTreasuryAccId,
                  nowIso,
                  options?.bankAccountLabel || liveTarget.bankAccountLabel,
                  paymentMethod === 'efectivo_usd' ? 'USD' : 'Bs'
                )
            : null;

        const bankAccountLabel = options?.bankAccountLabel || liveTarget.bankAccountLabel || acc?.name || undefined;
        const isNonFiscal = isNonFiscalPersonalOrSalaryCategory(liveTarget.category);
        const accountingType = getExpenseAccountingType(liveTarget.category);
        const feeAmount =
          isBankPaymentMethod(paymentMethod) &&
          typeof options?.bankFeeAmount === 'number' &&
          options.bankFeeAmount > 0 &&
          resolvedTreasuryAccId
            ? round2(options.bankFeeAmount)
            : 0;
        const feeCurrency: TreasuryCurrency = acc?.currency || 'Bs';

        const newAbono: Abono = {
          id: 'abono-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          amountUSD: payAmount,
          amountBs: payAmountBs,
          bcvRate,
          enteredCurrency,
          paymentMethod,
          bankAccountId,
          bankAccountLabel,
          treasuryAccountId: resolvedTreasuryAccId || undefined,
          bankFeeAmount: feeAmount > 0 ? feeAmount : undefined,
          bankFeeCurrency: feeAmount > 0 ? feeCurrency : undefined,
          reference,
          notes:
            notes ||
            (newStatus === 'pagado' && currentPaid === 0
              ? 'Pago completo de gasto'
              : newStatus === 'pagado'
              ? 'Liquidación final de saldo pendiente'
              : 'Abono parcial a gasto pendiente')
        };

        const hasFiscalInvoice = Boolean(
          liveTarget.invoiceNumber &&
          liveTarget.invoiceNumber.trim() !== '' &&
          liveTarget.invoiceNumber.trim().toUpperCase() !== 'REC-GASTO' &&
          liveTarget.invoiceNumber.trim().toUpperCase() !== 'INT-CAJA' &&
          liveTarget.supplierRIF &&
          liveTarget.supplierRIF.trim() !== '' &&
          liveTarget.supplierRIF.trim().toUpperCase() !== 'N/A'
        );
        const excludeFromFiscalBook = isNonFiscal || !hasFiscalInvoice;

        const cashOutflowExpense: Expense = {
          id: 'exp-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          date: nowIso,
          invoiceNumber: liveTarget.invoiceNumber || (isNonFiscal ? 'INT-CAJA' : 'REC-GASTO'),
          controlNumber: '00-00000',
          supplierName: liveTarget.supplierName || liveTarget.concept,
          supplierRIF: liveTarget.supplierRIF || 'N/A',
          supplierPhone: liveTarget.supplierPhone,
          description: `${newStatus === 'pagado' && currentPaid === 0 ? 'Pago' : 'Abono'} ${liveTarget.category} (${liveTarget.concept})${notes ? ` - ${notes}` : ''}`,
          category: mapGastoCategoryToExpenseCategory(liveTarget.category),
          amountUSD: payAmount,
          amountBs: payAmountBs,
          baseImponibleBs: excludeFromFiscalBook ? 0 : payAmountBs,
          ivaBs: 0,
          retencionIVABs: 0,
          retencionISLRBs: 0,
          bcvRate,
          enteredCurrency,
          paymentMethod: mapMethodToExpenseMethod(paymentMethod),
          bankAccountId,
          bankAccountLabel,
          treasuryAccountId: resolvedTreasuryAccId || undefined,
          bankFeeAmount: feeAmount > 0 ? feeAmount : undefined,
          bankFeeCurrency: feeAmount > 0 ? feeCurrency : undefined,
          excludeFromLibroCompras: excludeFromFiscalBook,
          accountingType,
          reference,
          linkedGastoId: liveTarget.id
        };

        tx.update(gastoRef, {
          paidAmountUSD: newPaid,
          remainingUSD: newRemaining,
          status: newStatus,
          paymentDate: nowIso,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          bankAccountLabel: bankAccountLabel || null,
          treasuryAccountId: resolvedTreasuryAccId || null,
          bankFeeAmount: feeAmount > 0 ? feeAmount : (liveTarget.bankFeeAmount ?? null),
          bankFeeCurrency: feeAmount > 0 ? feeCurrency : (liveTarget.bankFeeCurrency ?? null),
          reference: reference || liveTarget.reference || null,
          abonos: cleanForFirestore([newAbono, ...(liveTarget.abonos || [])])
        });
        tx.set(doc(db, 'users', userId, 'expenses', cashOutflowExpense.id), cleanForFirestore(cashOutflowExpense));

        if (acc && resolvedTreasuryAccId) {
          const accRef = doc(db, 'users', userId, 'bankAccounts', resolvedTreasuryAccId);
          const debitAmt = acc.currency === 'USD' ? payAmount : payAmountBs;
          const balBefore = round2(Number(acc.balance) || 0);
          const balAfterPay = round2(balBefore - debitAmt);
          const balFinal = feeAmount > 0 ? round2(balAfterPay - feeAmount) : balAfterPay;
          const baseTs = Date.now();

          const movType: TreasuryMovementType =
            accountingType === 'owner_withdrawal'
              ? 'retiro_personal'
              : accountingType === 'owner_salary'
              ? 'sueldo'
              : 'gasto_operativo';

          tx.set(accRef, cleanForFirestore({ ...acc, balance: balFinal, updatedAt: nowIso }), { merge: true });
          const payMov: TreasuryMovement = {
            id: `tmov-gasto-${baseTs}-0-${Math.random().toString(36).substring(2, 6)}`,
            date: nowIso,
            accountId: acc.id,
            accountName: acc.name,
            accountCurrency: acc.currency,
            direction: 'out',
            amount: debitAmt,
            balanceBefore: balBefore,
            balanceAfter: balAfterPay,
            bcvRate: bcvRate > 0 ? bcvRate : 1,
            type: movType,
            concept: `${liveTarget.category}: ${liveTarget.concept}`,
            reference: reference || liveTarget.invoiceNumber,
            paymentMethod,
            linkedEntityType: 'gastoOperativo',
            linkedEntityId: liveTarget.id,
            notes,
            createdBy: options?.createdBy
          };
          tx.set(doc(db, 'users', userId, 'treasuryMovements', payMov.id), cleanForFirestore(payMov));

          if (feeAmount > 0) {
            const feeMov: TreasuryMovement = {
              id: `tmov-gasto-${baseTs}-1-${Math.random().toString(36).substring(2, 6)}`,
              date: nowIso,
              accountId: acc.id,
              accountName: acc.name,
              accountCurrency: acc.currency,
              direction: 'out',
              amount: feeAmount,
              balanceBefore: balAfterPay,
              balanceAfter: balFinal,
              bcvRate: bcvRate > 0 ? bcvRate : 1,
              type: 'comision_bancaria',
              concept: `Comisión Bancaria (${liveTarget.category}: ${liveTarget.concept})`,
              reference: reference || liveTarget.invoiceNumber,
              paymentMethod,
              linkedEntityType: 'gastoOperativo',
              linkedEntityId: liveTarget.id,
              createdBy: options?.createdBy
            };
            tx.set(doc(db, 'users', userId, 'treasuryMovements', feeMov.id), cleanForFirestore(feeMov));
          }
        }

        if (feeAmount > 0 && resolvedTreasuryAccId) {
          const feeExp = buildBankCommissionExpenseDoc({
            feeAmount,
            feeCurrency,
            bcvRate: bcvRate > 0 ? bcvRate : 1,
            paymentMethod: mapMethodToExpenseMethod(paymentMethod),
            bankAccountId: resolvedTreasuryAccId,
            bankAccountLabel: bankAccountLabel || acc?.name || 'Banco',
            concept: `${liveTarget.category} (${liveTarget.concept})`,
            reference: reference || liveTarget.invoiceNumber,
            dateIso: nowIso,
            linkedGastoId: liveTarget.id
          });
          tx.set(doc(db, 'users', userId, 'expenses', feeExp.id), cleanForFirestore(feeExp));
        }
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
  const safeGetOptionalDocs = async (colName: string) => {
    try {
      return await getDocs(collection(db, 'users', userId, colName));
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        markOptionalCollectionDenied(userId, colName);
        return { docs: [] as Array<{ data: () => unknown }> };
      }
      throw err;
    }
  };

  const [
    productsSnap,
    salesSnap,
    expensesSnap,
    fiadosSnap,
    clientsSnap,
    cppSnap,
    gastosSnap,
    suppliersSnap,
    loansSnap,
    bankAccountsSnap,
    treasuryMovementsSnap,
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
    safeGetOptionalDocs('suppliers'),
    safeGetOptionalDocs('loans'),
    safeGetOptionalDocs('bankAccounts'),
    safeGetOptionalDocs('treasuryMovements'),
    getDocs(collection(db, 'users', userId, 'cashShiftHistory')),
    getDocs(collection(db, 'users', userId, 'creditNotes')),
    getDocs(collection(db, 'users', userId, 'inventoryDischarges')),
    safeGetOptionalDocs('kardex'),
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
  const loans = loansSnap.docs.map((d) => d.data() as Loan).sort((a, b) => new Date(b.grantDate || b.createdAt).getTime() - new Date(a.grantDate || a.createdAt).getTime());
  const bankAccounts = bankAccountsSnap.docs.map((d) => d.data() as TreasuryAccount);
  const treasuryMovements = treasuryMovementsSnap.docs
    .map((d) => d.data() as TreasuryMovement)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    version: '2.3',
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
    loans,
    bankAccounts,
    treasuryMovements,
    creditNotes,
    inventoryDischarges,
    kardex,
    cashShift: cashRegData?.isOpen ? (cashRegData.activeShift || null) : null,
    cashShiftHistory
  };
};

/**
 * Uploads an entire JSON/Drive backup/restore payload atomically (chunked batches) directly to Cloud Firestore under users/{uid}/...
 * Respects firestore.rules immutability on `kardex` and `treasuryMovements` (only inserts missing doc IDs).
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
    loans?: Loan[];
    bankAccounts?: TreasuryAccount[];
    treasuryMovements?: TreasuryMovement[];
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
  await writeCollection('loans', 'loan', data.loans || []);
  if (Array.isArray(data.bankAccounts) && data.bankAccounts.length > 0 && !isOptionalCollectionDenied(userId, 'bankAccounts')) {
    await writeCollection('bankAccounts', 'bank', data.bankAccounts);
  }
  await writeCollection('creditNotes', 'nc', data.creditNotes || []);
  await writeCollection('inventoryDischarges', 'disc', data.inventoryDischarges || []);
  await writeCollection('cashShiftHistory', 'shift', data.cashShiftHistory || []);

  // Kardex is create-only in firestore.rules (allow update, delete: if false).
  if (Array.isArray(data.kardex) && data.kardex.length > 0 && !isOptionalCollectionDenied(userId, 'kardex')) {
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

  // Treasury movements are create-only in firestore.rules
  if (
    Array.isArray(data.treasuryMovements) &&
    data.treasuryMovements.length > 0 &&
    !isOptionalCollectionDenied(userId, 'treasuryMovements')
  ) {
    const existingMovSnap = await getDocs(collection(db, 'users', userId, 'treasuryMovements'));
    const existingIds = new Set(existingMovSnap.docs.map((d) => d.id));
    const missingMovs: Array<TreasuryMovement & { id: string }> = [];
    data.treasuryMovements.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const safeId = sanitizeFirestoreDocId(entry.id, 'tmov', idx);
      if (!existingIds.has(safeId)) {
        existingIds.add(safeId);
        missingMovs.push({ ...entry, id: safeId });
      }
    });
    if (missingMovs.length > 0) {
      await writeCollection('treasuryMovements', 'tmov', missingMovs);
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
 * Preserves businessProfile unless overwritten. Note: 'kardex' & 'treasuryMovements' are immutable by Firestore security rules.
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
    'loans',
    'bankAccounts',
    'cashShiftHistory',
    'creditNotes',
    'inventoryDischarges'
  ];

  const op = (async () => {
    for (const colName of collectionsToClear) {
      let snap;
      try {
        snap = await getDocs(collection(db, 'users', userId, colName));
      } catch (err) {
        if (
          isPermissionDeniedError(err) &&
          (colName === 'suppliers' || colName === 'loans' || colName === 'bankAccounts')
        ) {
          continue;
        }
        throw err;
      }
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

/**
 * Atomic chunked batch update for catalog product prices (used by Daily BCV Rate Change alert & manual recalculation).
 * Updates priceBsFixed, priceUSD, priceEUR, priceCurrency, and priceAnchorCurrency cleanly in Cloud Firestore.
 */
export const batchUpdateProductPricesInFirestore = async (
  uid: string,
  updatedProducts: Product[]
): Promise<void> => {
  if (!updatedProducts || updatedProducts.length === 0) return;
  const userId = getCanonicalUserId(uid);
  const path = `users/${userId}/products`;

  const op = (async () => {
    try {
      const chunkSize = 400;
      for (let i = 0; i < updatedProducts.length; i += chunkSize) {
        const chunk = updatedProducts.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((prod, idx) => {
          const safeId = sanitizeFirestoreDocId(prod.id, 'prod', i + idx);
          const prodRef = doc(db, 'users', userId, 'products', safeId);
          const payload = cleanForFirestore({
            id: safeId,
            priceUSD: prod.priceUSD,
            priceEUR: prod.priceEUR,
            priceBsFixed: prod.priceBsFixed,
            priceCurrency: prod.priceCurrency,
            priceAnchorCurrency: prod.priceAnchorCurrency
          });
          batch.set(prodRef, payload, { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();

  return trackFirestoreWrite(op);
};
