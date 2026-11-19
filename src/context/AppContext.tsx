import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Product,
  Sale,
  Expense,
  FiadoRecord,
  PaymentMethod,
  CartItem,
  CartDiscount,
  PaymentDetails,
  BusinessInfo,
  Client,
  BaseCurrency,
  CuentaPorPagar,
  GastoOperativo,
  GastoOperativoCategory,
  GoogleAccount,
  CashShift,
  AppTheme,
  BankInitialBalance,
  CashOpeningAuditMeta,
  CreditNote,
  InventoryDischarge,
  InventoryDischargeReason,
  ProductBatch,
  Abono,
  KardexEntry,
  KardexMovementType,
  PurchaseCostStrategy,
  Supplier,
  Loan,
  RateChangeModalState,
  RatePriceRecalcMode,
  RatePriceCurrencyScope,
  TreasuryAccount,
  TreasuryMovement
} from '../types';
import { fetchLiveBCVRate, fetchLiveBCVEuroRate } from '../utils/bcvFetcher';
import {
  computeShiftBankSummaries,
  getExpenseAccountingType,
  isExpenseOwnerSalary,
  isExpenseOwnerWithdrawal,
  isNonFiscalPersonalOrSalaryCategory,
  mapGastoCategoryToExpenseCategory
} from '../utils/accountingUtils';
import {
  initAuth,
  signInWithGoogle,
  logOutGoogle,
  getRemoteDatabaseMetadata,
  readDatabaseFromDrive,
  saveDatabaseToDrive,
  getGoogleAccessToken,
  renewGoogleToken,
  isGoogleTokenExpired,
  GoogleDriveAuthError,
  PreconditionFailedError,
  driveSyncMutex,
  mergeDatabasePayloads,
  DatabaseTombstones,
  AppDatabasePayload
} from '../services/googleAuthDriveService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { auth } from '../config/firebaseConfig';
import {
  subscribeToStoreRealtime,
  subscribeToTransactionsRealtime,
  computeTransactionsDateRange,
  TransactionsDatePreset,
  TransactionsDateRange,
  saveSaleAtomic,
  updateSaleInFirestore,
  cancelSaleAtomic,
  saveProductToFirestore,
  saveProductWithKardexAtomic,
  deleteProductFromFirestore,
  adjustProductStockInFirestore,
  saveExpenseToFirestore,
  deleteExpenseFromFirestore,
  saveFiadoToFirestore,
  saveClientToFirestore,
  updateClientInFirestore,
  deleteClientFromFirestore,
  saveSupplierToFirestore,
  updateSupplierInFirestore,
  deleteSupplierFromFirestore,
  saveCuentaPorPagarToFirestore,
  deleteCuentaPorPagarFromFirestore,
  saveGastoOperativoToFirestore,
  deleteGastoOperativoFromFirestore,
  saveCashShiftToFirestore,
  saveBusinessProfileToFirestore,
  getCanonicalUserId,
  saveCashRegisterStatusToFirestore,
  waitForAllPendingWrites,
  CashRegisterStatusDoc,
  saveCreditNoteAtomic,
  deleteCreditNoteFromFirestore,
  saveInventoryDischargeAtomic,
  deleteInventoryDischargeFromFirestore,
  saveExpenseWithInventoryAtomic,
  saveGastoWithCashOutflowAtomic,
  addAbonoToFiadoTransaction,
  addAbonoToCuentaPorPagarTransaction,
  markGastoOperativoPagadoTransaction,
  saveLoanToFirestore,
  updateLoanInFirestore,
  deleteLoanFromFirestore,
  addAbonoToLoanTransaction,
  deleteSaleFromFirestore,
  fetchFullStoreSnapshotForBackup,
  restoreStoreDataToFirestore,
  clearUserFirestoreCollections,
  batchUpdateProductPricesInFirestore,
  resetDeniedOptionalCollections,
  ensureDefaultTreasuryAccountsInFirestore,
  saveTreasuryAccountToFirestore,
  deleteTreasuryAccountFromFirestore,
  transferBetweenTreasuryAccountsTransaction,
  adjustTreasuryAccountBalanceTransaction
} from '../services/firestoreSyncService';
import { BackupDataPayload } from '../utils/cloudBackupUtils';
import {
  round2,
  getLocalDateStr,
  getProductPriceUSD,
  isProductExempt,
  isCartItemExempt,
  calculateCartFiscalTotals,
  computeCatalogPriceRecalculation
} from '../utils/exportUtils';

export type DriveSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated' | 'token_expired';
export type FirestoreSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated';

export interface AppNotification {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
}

export const translateFirebaseError = (err: unknown): string => {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  let innerMsg = rawMsg;

  if (rawMsg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed && typeof parsed.error === 'string') {
        innerMsg = parsed.error;
      }
    } catch {
      // Keep rawMsg
    }
  }

  const lower = innerMsg.toLowerCase();
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return 'No tienes permisos suficientes en Cloud Firestore para esta operación. Verifica que tu sesión de Google esté activa y pertenezca a esta cuenta.';
  }
  if (lower.includes('unauthenticated') || lower.includes('no hay sesión')) {
    return 'Tu sesión expiró o no has iniciado sesión con Google. Inicia sesión nuevamente.';
  }
  if (lower.includes('aborted') || lower.includes('failed-precondition') || lower.includes('concurrent')) {
    return 'Conflicto de concurrencia con otro dispositivo. Intenta guardar nuevamente en un instante.';
  }
  if (lower.includes('unavailable') || lower.includes('network') || lower.includes('offline') || lower.includes('failed to fetch')) {
    return 'Sin conexión estable con Cloud Firestore. Verifica tu internet antes de continuar.';
  }
  if (lower.includes('resource-exhausted') || lower.includes('quota')) {
    return 'Límite temporal de almacenamiento o tamaño de documento excedido en Firestore.';
  }
  if (lower.includes('exceeds the maximum allowed size') || lower.includes('too large')) {
    return 'El documento (por ejemplo, una imagen muy pesada) supera el tamaño máximo permitido.';
  }
  return innerMsg || 'Ocurrió un error inesperado al sincronizar con Cloud Firestore.';
};

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
};

const getNextSequenceNumber = (existingValues: (string | undefined)[], prefix: string): number => {
  let maxSeq = 0;
  for (const val of existingValues) {
    if (!val || !val.startsWith(prefix)) continue;
    const suffix = val.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }
  return maxSeq + 1;
};



const restoreFifoBatches = (
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

const computeFifoValuationUSD = (prod: Product, stockOverride?: number): number => {
  const targetStock = stockOverride !== undefined ? stockOverride : (prod.stock || 0);
  if (prod.batches && prod.batches.length > 0) {
    return round2(
      prod.batches.reduce((sum, b) => sum + (Math.max(0, b.quantity || 0) * Math.max(0, b.costUSD || 0)), 0)
    );
  }
  return round2(Math.max(0, targetStock) * Math.max(0, prod.costUSD || 0));
};

const buildKardexEntry = (params: {
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
    fifoBalanceUSD: computeFifoValuationUSD(params.product, safeNewStock),
    avgCostUSD: safeAvgCost,
    avgBalanceUSD: round2(safeNewStock * safeAvgCost),
    reference: params.reference,
    notes: params.notes,
    userName: params.userName
  };
};

const normalizeRifKey = (rif?: string): string =>
  (rif || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const matchSupplierRecord = (
  suppliersList: Supplier[],
  supplierId?: string,
  supplierRIF?: string,
  supplierName?: string
): Supplier | undefined => {
  if (supplierId) {
    const byId = suppliersList.find(s => s.id === supplierId);
    if (byId) return byId;
  }
  const cleanRif = normalizeRifKey(supplierRIF);
  if (cleanRif && cleanRif.length > 2 && cleanRif !== 'NA') {
    const byRif = suppliersList.find(s => normalizeRifKey(s.rif) === cleanRif);
    if (byRif) return byRif;
  }
  const cleanName = (supplierName || '').trim().toLowerCase();
  if (cleanName) {
    return suppliersList.find(s => (s.name || '').trim().toLowerCase() === cleanName);
  }
  return undefined;
};

const computeSupplierAccumulatedBalance = (
  supplier: Supplier,
  cuentasList: CuentaPorPagar[]
): number => {
  const supRif = normalizeRifKey(supplier.rif);
  const supName = (supplier.name || '').trim().toLowerCase();
  return round2(
    cuentasList
      .filter(c => {
        if (c.status === 'pagada' || (c.remainingUSD || 0) <= 0.009) return false;
        if (c.supplierId) return c.supplierId === supplier.id;
        const cRif = normalizeRifKey(c.supplierRIF);
        if (supRif && supRif.length > 2 && cRif && cRif === supRif) return true;
        return supName.length > 0 && (c.supplierName || '').trim().toLowerCase() === supName;
      })
      .reduce((sum, c) => sum + (c.remainingUSD || 0), 0)
  );
};

/**
 * Purges any legacy localStorage or IndexedDB business data caches from prior versions.
 * Ensures zero business/accounting persistence in browser storage.
 */
const purgeLegacyBrowserBusinessCaches = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('posvenecia_') || key.startsWith('tupunto_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
    if (typeof window !== 'undefined' && window.indexedDB && typeof window.indexedDB.deleteDatabase === 'function') {
      window.indexedDB.deleteDatabase('PosVenecia_OfflineDB');
    }
  } catch {
    // Ignore storage cleanup errors in restricted environments
  }
};

interface AppContextType {
  // Realtime Cloud Database (Firebase Firestore) & Global Notifications
  firestoreSyncStatus: FirestoreSyncStatus;
  notification: AppNotification | null;
  dismissNotification: () => void;
  notifyUser: (type: AppNotification['type'], title: string, message: string) => void;
  backupClosingToDrive: () => Promise<boolean>;
  getFullDatabasePayload: () => Promise<BackupDataPayload>;

  // BCV Rate (USD)
  bcvRate: number;
  updateBcvRate: (newRate: number) => void;
  rateHistory: { date: string; rate: number }[];
  fetchLiveRate: () => Promise<number>;
  isFetchingLiveRate: boolean;
  bcvLastUpdatedDate: string | null;
  bcvLastUpdatedAt: string | null;
  isBcvRateUpdatedToday: boolean;

  // BCV Rate (Euro)
  bcvEuroRate: number;
  updateBcvEuroRate: (newRate: number) => void;
  fetchLiveEuroRate: () => Promise<number>;
  isFetchingLiveEuroRate: boolean;

  // Mixed Pricing & Daily BCV Rate Change Recalculation
  commercialRoundingStep: number;
  rateChangeModalState: RateChangeModalState;
  openRateRecalcModal: (options?: {
    previousUsdRate?: number;
    previousEurRate?: number;
    newUsdRate?: number;
    newEurRate?: number;
    source?: 'daily_auto' | 'manual';
  }) => void;
  closeRateRecalcModal: () => void;
  applyCatalogPriceRecalculation: (options: {
    mode: RatePriceRecalcMode;
    currencyScope: RatePriceCurrencyScope;
    roundingStep: number;
  }) => Promise<{ updatedCount: number }>;

  // Base Currency (USD vs VED / Bolívares)
  baseCurrency: BaseCurrency;
  setBaseCurrency: (currency: BaseCurrency) => void;

  // Clientes Habituales
  clients: Client[];
  addClient: (clientData: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (updated: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  selectedClientForPOS: Client | null;
  setSelectedClientForPOS: (client: Client | null) => void;

  // Products & Services
  products: Product[];
  categories: string[];
  addCategory: (newCategory: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, newStock: number) => Promise<boolean>;
  addQuickService: (serviceData: {
    name: string;
    category?: string;
    priceUSD: number;
    priceBsFixed?: number;
    priceCurrency?: 'USD' | 'Bs';
    quantity: number;
    isExemptFromIVA: boolean;
    notes?: string;
    saveToCatalog?: boolean;
  }) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, options?: { isExemptFromIVA?: boolean }) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  setCartItemExempt: (productId: string, isExemptFromIVA: boolean) => void;
  cartDiscount: CartDiscount | null;
  setCartDiscount: (discount: CartDiscount | null) => void;
  clearCart: () => void;
  applyIVA: boolean;
  setApplyIVA: (apply: boolean) => void;
  applyIGTF: boolean;
  setApplyIGTF: (apply: boolean) => void;

  // Sales
  sales: Sale[];
  completeSale: (
    clientData: { name: string; rif: string; phone?: string; address?: string },
    paymentDetails: PaymentDetails,
    fiscalCorrelatives: { invoiceNumber: string; controlNumber: string }
  ) => Promise<Sale>;
  cancelSale: (saleId: string) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  deleteSale: (saleId: string, restoreStock?: boolean) => void;
  lastCompletedSale: Sale | null;
  setLastCompletedSale: (sale: Sale | null) => void;

  // Notas de Crédito & Devoluciones
  creditNotes: CreditNote[];
  createCreditNote: (data: {
    saleId: string;
    reason: string;
    refundMethod: PaymentMethod;
    items: { productId: string; quantity: number }[];
    creditNoteNumber: string;
    controlNumber: string;
    originalInvoiceNumber?: string;
    originalControlNumber?: string;
  }) => Promise<CreditNote>;
  deleteCreditNote: (id: string) => void;
  isCreditNoteModalOpen: boolean;
  setIsCreditNoteModalOpen: (open: boolean) => void;
  selectedSaleForCreditNote: Sale | null;
  setSelectedSaleForCreditNote: (sale: Sale | null) => void;
  lastCompletedCreditNote: CreditNote | null;
  setLastCompletedCreditNote: (nc: CreditNote | null) => void;

  // Desincorporación de Inventario (Salidas por Daño / Vencimiento / Merma / Uso Interno)
  inventoryDischarges: InventoryDischarge[];
  createInventoryDischarge: (data: {
    productId: string;
    quantity: number;
    reason: InventoryDischargeReason;
    notes?: string;
    responsibleName?: string;
  }) => Promise<InventoryDischarge>;
  deleteInventoryDischarge: (id: string) => void;
  isDischargeModalOpen: boolean;
  setIsDischargeModalOpen: (open: boolean) => void;
  selectedProductForDischarge: Product | null;
  setSelectedProductForDischarge: (product: Product | null) => void;
  lastCompletedDischarge: InventoryDischarge | null;
  setLastCompletedDischarge: (disc: InventoryDischarge | null) => void;

  // Expenses / Purchases (Libro de Compras)
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (updated: Expense) => Promise<void>;
  deleteExpense: (id: string) => void;

  // Date-Range Query Optimization & On-Demand Historical Loading (Sales & Expenses)
  transactionsPreset: TransactionsDatePreset;
  transactionsDateRange: TransactionsDateRange | null;
  isLoadingHistory: boolean;
  setTransactionsDateFilter: (preset: TransactionsDatePreset, customStart?: string, customEnd?: string) => void;

  // Kardex de Inventario
  kardex: KardexEntry[];

  // Maestro de Proveedores
  suppliers: Supplier[];
  addSupplier: (data: Omit<Supplier, 'id' | 'createdAt' | 'accumulatedBalanceUSD'> & { accumulatedBalanceUSD?: number }) => Promise<Supplier>;
  updateSupplier: (updated: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Fiados
  fiados: FiadoRecord[];
  addAbonoToFiado: (
    fiadoId: string,
    amountUSD: number,
    method: PaymentMethod,
    reference?: string,
    notes?: string,
    options?: { bankAccountId?: string; bankAccountLabel?: string }
  ) => Promise<void>;
  createManualFiado: (data: { clientName: string; clientCI: string; clientPhone: string; debtUSD: number; notes?: string }) => void;

  // Cuentas por Pagar (Deudas a Proveedores)
  cuentasPorPagar: CuentaPorPagar[];
  addCuentaPorPagar: (data: Omit<CuentaPorPagar, 'id' | 'paidAmountUSD' | 'remainingUSD' | 'status' | 'abonos'>) => void;
  updateCuentaPorPagar: (updated: CuentaPorPagar) => void;
  deleteCuentaPorPagar: (id: string) => void;
  addAbonoToCuentaPorPagar: (
    cuentaId: string,
    amountUSD: number,
    method: PaymentMethod,
    reference?: string,
    notes?: string,
    options?: {
      bankAccountId?: string;
      bankAccountLabel?: string;
      enteredCurrency?: 'USD' | 'Bs';
      exactAmountBs?: number;
      bankFeeAmount?: number;
    }
  ) => Promise<void>;

  // Gastos Operativos del Mes (Alquiler, Servicios, Eventuales)
  gastosOperativos: GastoOperativo[];
  addGastoOperativo: (gasto: Omit<GastoOperativo, 'id'>) => void;
  updateGastoOperativo: (updated: GastoOperativo) => void;
  deleteGastoOperativo: (id: string) => void;
  markGastoOperativoPagado: (
    id: string,
    paymentMethod: PaymentMethod,
    reference?: string,
    amountUSD?: number,
    notes?: string,
    options?: {
      bankAccountId?: string;
      bankAccountLabel?: string;
      enteredCurrency?: 'USD' | 'Bs';
      exactAmountBs?: number;
      bankFeeAmount?: number;
    }
  ) => Promise<void>;

  // Créditos y Préstamos por Pagar
  loans: Loan[];
  addLoan: (data: Omit<Loan, 'id' | 'paidAmountUSD' | 'paidAmountBs' | 'remainingUSD' | 'remainingBs' | 'status' | 'abonos' | 'createdAt'>) => Promise<Loan>;
  updateLoan: (updated: Loan) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  addAbonoToLoan: (params: {
    loanId: string;
    amount: number;
    enteredCurrency: 'USD' | 'Bs';
    method: PaymentMethod | 'externo_dueno';
    reference?: string;
    notes?: string;
    bankAccountId?: string;
    bankAccountLabel?: string;
    bankFeeAmount?: number;
  }) => Promise<void>;

  // Tesorería / Estado de Cuenta en Vivo
  treasuryAccounts: TreasuryAccount[];
  treasuryMovements: TreasuryMovement[];
  saveTreasuryAccount: (
    account: Omit<TreasuryAccount, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
    options?: { recordInitialMovement?: boolean }
  ) => Promise<void>;
  deleteTreasuryAccount: (accountId: string) => Promise<void>;
  transferBetweenTreasuryAccounts: (params: {
    sourceAccountId: string;
    destinationAccountId: string;
    sourceAmount: number;
    exchangeRate?: number;
    bankFeeAmount?: number;
    reference?: string;
    notes?: string;
  }) => Promise<void>;
  adjustTreasuryAccountBalance: (params: {
    accountId: string;
    newBalance: number;
    reason?: string;
    setAsInitialBalance?: boolean;
  }) => Promise<void>;

  // Google Account, OAuth & Google Drive Export
  googleUser: GoogleAccount | null;
  isAuthLoading: boolean;
  isDriveSyncing: boolean;
  driveSyncStatus: DriveSyncStatus;
  lastDriveSyncTime: string | null;
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  renewGoogleSession: () => Promise<boolean>;
  syncToGoogleDrive: () => Promise<boolean>;
  reloadFromGoogleDrive: () => Promise<boolean>;
  checkRemoteChangesForMultiDevice: () => Promise<void>;
  restoreDatabase: (payload: any) => Promise<boolean>;
  isGoogleModalOpen: boolean;
  setIsGoogleModalOpen: (open: boolean) => void;
  terminalId: string;
  setTerminalId: (id: string) => void;

  // Cuadre de Caja & Apertura / Cierre de Caja Diaria
  cashShift: CashShift | null;
  isCashRegisterOpen: boolean;
  cashShiftHistory: CashShift[];
  openCashShift: (
    initialCashUSD: number,
    initialCashBs: number,
    notes?: string,
    initialBanks?: BankInitialBalance[],
    openingAudit?: CashOpeningAuditMeta
  ) => Promise<void>;
  closeCashShift: (countedUSD: number, countedBs: number, notes?: string, countedBanks?: BankInitialBalance[]) => Promise<CashShift>;
  isAperturaModalOpen: boolean;
  setIsAperturaModalOpen: (open: boolean) => void;
  isCierreModalOpen: boolean;
  setIsCierreModalOpen: (open: boolean) => void;
  isCuadreModalOpen: boolean;
  setIsCuadreModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  activeTab: 'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'tesoreria' | 'contabilidad';
  setActiveTab: (tab: 'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'tesoreria' | 'contabilidad') => void;

  // Theme Management
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;

  // Business Info
  businessInfo: BusinessInfo;
  updateBusinessInfo: (info: Partial<BusinessInfo>) => Promise<void>;

  // Manager PIN
  managerPin: string;
  updateManagerPin: (newPin: string) => void;

  // Network Connectivity
  isOnline: boolean;

  // Collections awaiting updated firestore.rules deployment in external Firebase Console
  missingRuleCollections: string[];
  retryFirestoreSubscriptions: () => void;

  // Factory Reset / Arrancar de 0
  factoryReset: (mode?: 'clean_zero' | 'restore_demo') => Promise<void>;
}

const INITIAL_BCV_RATE = 889.26;
const INITIAL_BCV_EURO_RATE = 997.92;

const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: 'PosVenecia',
  rif: '',
  phone: '',
  address: '',
  email: '',
  instagram: '',
  logoUrl: '',
  footerMessage: '¡Gracias por su compra! Vuelva pronto.',
  pagoMovilPhone: '',
  pagoMovilCI: '',
  pagoMovilBank: '0102 - Banco de Venezuela',
  pagoMovilAccounts: [],
  posTerminals: [],
  bankAccounts: []
};

const DEFAULT_CATEGORIES = [
  'Víveres',
  'Charcutería',
  'Bebidas',
  'Limpieza',
  'Snacks',
  'Papelería',
  'Quincallería',
  'Heladería',
  'Servicios',
  'Redacciones',
  'Otros'
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Google Auth State
  const [googleUser, setGoogleUser] = useState<GoogleAccount | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<DriveSyncStatus>('unauthenticated');
  const [lastDriveSyncTime, setLastDriveSyncTime] = useState<string | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // Terminal / Caja ID (ephemeral per-session device identifier)
  const [terminalId, setTerminalIdState] = useState<string>('C1');

  const setTerminalId = useCallback((id: string) => {
    const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'C1';
    setTerminalIdState(cleanId);
  }, []);

  // Multi-device Drive backup merge tracking refs
  const lastDriveFileIdRef = useRef<string | null>(null);
  const lastRemoteEtagRef = useRef<string | null>(null);
  const lastRemoteModifiedTimeRef = useRef<string | null>(null);
  const isCheckingRemoteRef = useRef<boolean>(false);
  const tombstonesRef = useRef<DatabaseTombstones>({
    deletedProductIds: [],
    canceledSaleIds: [],
    deletedClientIds: [],
    deletedExpenseIds: [],
    deletedCuentaIds: [],
    deletedGastoIds: []
  });

  // BCV Rate states (synced via Cloud Firestore businessProfile)
  const [bcvRate, setBcvRateState] = useState<number>(INITIAL_BCV_RATE);
  const [rateHistory, setRateHistory] = useState<{ date: string; rate: number }[]>([]);
  const [bcvLastUpdatedDate, setBcvLastUpdatedDate] = useState<string | null>(null);
  const [bcvLastUpdatedAt, setBcvLastUpdatedAt] = useState<string | null>(null);
  const [isFetchingLiveRate, setIsFetchingLiveRate] = useState(false);

  // BCV Euro Rate
  const [bcvEuroRate, setBcvEuroRateState] = useState<number>(INITIAL_BCV_EURO_RATE);
  const [isFetchingLiveEuroRate, setIsFetchingLiveEuroRate] = useState(false);

  // Mixed Pricing & Daily BCV Rate Change Recalculation State
  const [commercialRoundingStep, setCommercialRoundingStep] = useState<number>(1);
  const [lastRatePromptDate, setLastRatePromptDate] = useState<string | null>(null);
  const [lastPromptedBcvRate, setLastPromptedBcvRate] = useState<number | null>(null);
  const [lastPromptedBcvEuroRate, setLastPromptedBcvEuroRate] = useState<number | null>(null);
  const [profileLoadedSeq, setProfileLoadedSeq] = useState<number>(0);
  const [productsLoaded, setProductsLoaded] = useState<boolean>(false);
  const dailyRateCheckRanKeyRef = useRef<string | null>(null);
  const [rateChangeModalState, setRateChangeModalState] = useState<RateChangeModalState>({
    isOpen: false,
    source: 'manual',
    previousUsdRate: INITIAL_BCV_RATE,
    newUsdRate: INITIAL_BCV_RATE,
    previousEurRate: INITIAL_BCV_EURO_RATE,
    newEurRate: INITIAL_BCV_EURO_RATE
  });

  // Base Currency (USD vs VED)
  const [baseCurrency, setBaseCurrencyState] = useState<BaseCurrency>('USD');

  const todayLocalYMD = getLocalDateStr();
  const isBcvRateUpdatedToday =
    bcvLastUpdatedDate === todayLocalYMD ||
    rateHistory.some(h => h.date === todayLocalYMD);

  // Business collections (exclusively populated via live Firestore onSnapshot)
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fiados, setFiados] = useState<FiadoRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cuentasPorPagar, setCuentasPorPagar] = useState<CuentaPorPagar[]>([]);
  const [gastosOperativos, setGastosOperativos] = useState<GastoOperativo[]>([]);
  const [kardex, setKardex] = useState<KardexEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [treasuryMovements, setTreasuryMovements] = useState<TreasuryMovement[]>([]);
  const [treasuryAccountsLoaded, setTreasuryAccountsLoaded] = useState(false);
  const treasurySeededUidRef = useRef<string | null>(null);
  const [missingRuleCollections, setMissingRuleCollections] = useState<string[]>([]);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Cart & UI state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState<CartDiscount | null>(null);
  const [applyIVA, setApplyIVA] = useState(true);
  const [applyIGTF, setApplyIGTF] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [selectedClientForPOS, setSelectedClientForPOS] = useState<Client | null>(null);

  // Notas de Crédito & Devoluciones
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [selectedSaleForCreditNote, setSelectedSaleForCreditNote] = useState<Sale | null>(null);
  const [lastCompletedCreditNote, setLastCompletedCreditNote] = useState<CreditNote | null>(null);

  // Desincorporación de Inventario
  const [inventoryDischarges, setInventoryDischarges] = useState<InventoryDischarge[]>([]);
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [selectedProductForDischarge, setSelectedProductForDischarge] = useState<Product | null>(null);
  const [lastCompletedDischarge, setLastCompletedDischarge] = useState<InventoryDischarge | null>(null);

  // Modals & Navigation (Mutually exclusive cash drawer modals)
  const [isCuadreModalOpen, setIsCuadreModalOpenState] = useState(false);
  const [isAperturaModalOpen, setIsAperturaModalOpenState] = useState(false);
  const [isCierreModalOpen, setIsCierreModalOpenState] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'tesoreria' | 'contabilidad'>('inicio');

  const setIsCuadreModalOpen = useCallback((open: boolean) => {
    setIsCuadreModalOpenState(open);
    if (open) {
      setIsAperturaModalOpenState(false);
      setIsCierreModalOpenState(false);
    }
  }, []);

  const setIsAperturaModalOpen = useCallback((open: boolean) => {
    setIsAperturaModalOpenState(open);
    if (open) {
      setIsCuadreModalOpenState(false);
      setIsCierreModalOpenState(false);
    }
  }, []);

  const setIsCierreModalOpen = useCallback((open: boolean) => {
    setIsCierreModalOpenState(open);
    if (open) {
      setIsCuadreModalOpenState(false);
      setIsAperturaModalOpenState(false);
    }
  }, []);

  // Cash Register Shift State (Apertura y Cierre de Caja Diaria - Live Firestore)
  const [cashShift, setCashShift] = useState<CashShift | null>(null);
  const [cashShiftHistory, setCashShiftHistory] = useState<CashShift[]>([]);
  const isCashRegisterOpen = Boolean(cashShift?.isOpen);

  // Manager PIN
  const [managerPin, setManagerPin] = useState<string>('1234');

  // App Theme: light exclusive
  const [appTheme] = useState<AppTheme>('light');

  const setAppTheme = useCallback((_theme: AppTheme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('theme-dark', 'dark', 'theme-liquid-glass');
      root.classList.add('theme-light');
    }
  }, []);

  useEffect(() => {
    setAppTheme('light');
    purgeLegacyBrowserBusinessCaches();
  }, [setAppTheme]);

  // Network Status
  const { isOnline } = useNetworkStatus();

  // Global Notification Toast State
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const notificationTimerRef = useRef<number | null>(null);

  const dismissNotification = useCallback(() => {
    if (notificationTimerRef.current !== null) {
      window.clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification(null);
  }, []);

  const notifyUser = useCallback(
    (type: AppNotification['type'], title: string, message: string) => {
      if (notificationTimerRef.current !== null) {
        window.clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }
      const id = 'notif-' + Date.now();
      setNotification({ id, type, title, message });
      notificationTimerRef.current = window.setTimeout(() => {
        setNotification(prev => (prev?.id === id ? null : prev));
        notificationTimerRef.current = null;
      }, type === 'error' ? 7500 : 4500);
    },
    []
  );

  const notifyError = useCallback(
    (err: unknown, fallbackTitle: string): string => {
      const msg = translateFirebaseError(err);
      notifyUser('error', fallbackTitle, msg);
      return msg;
    },
    [notifyUser]
  );

  // Realtime Cloud Database (Firestore) status and unsubscribe refs
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<FirestoreSyncStatus>('unauthenticated');
  const firestoreUnsubRef = useRef<(() => void) | null>(null);
  const transactionsUnsubRef = useRef<(() => void) | null>(null);
  const activeFirestoreUidRef = useRef<string | null>(null);
  const syncToGoogleDriveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  // Transactions Date-Range Optimization State (Default: Mes Actual)
  const [transactionsPreset, setTransactionsPreset] = useState<TransactionsDatePreset>('current_month');
  const [transactionsDateRange, setTransactionsDateRange] = useState<TransactionsDateRange | null>(() =>
    computeTransactionsDateRange('current_month')
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Ref with latest state values
  const latestDataRef = useRef({
    products,
    sales,
    expenses,
    fiados,
    clients,
    cuentasPorPagar,
    gastosOperativos,
    businessInfo,
    customCategories,
    bcvRate,
    bcvEuroRate,
    rateHistory,
    googleUser,
    cashShift,
    cashShiftHistory
  });

  useEffect(() => {
    latestDataRef.current = {
      products,
      sales,
      expenses,
      fiados,
      clients,
      cuentasPorPagar,
      gastosOperativos,
      businessInfo,
      customCategories,
      bcvRate,
      bcvEuroRate,
      rateHistory,
      googleUser,
      cashShift,
      cashShiftHistory
    };
  });

  const getActiveUid = useCallback((): string | null => {
    return auth.currentUser?.uid || latestDataRef.current.googleUser?.uid || null;
  }, []);

  /**
   * Completely clears all React in-memory business, accounting, cart and session state.
   * Invoked strictly on logout or auth sign-out.
   */
  const clearAllInMemoryState = useCallback(() => {
    if (notificationTimerRef.current !== null) {
      window.clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification(null);
    setProducts([]);
    setSales([]);
    setExpenses([]);
    setFiados([]);
    setClients([]);
    setCuentasPorPagar([]);
    setGastosOperativos([]);
    setCreditNotes([]);
    setInventoryDischarges([]);
    setKardex([]);
    setSuppliers([]);
    setLoans([]);
    setCashShift(null);
    setCashShiftHistory([]);
    setBusinessInfo(DEFAULT_BUSINESS_INFO);
    setCustomCategories([]);
    setBcvRateState(INITIAL_BCV_RATE);
    setBcvEuroRateState(INITIAL_BCV_EURO_RATE);
    setRateHistory([]);
    setBcvLastUpdatedDate(null);
    setBcvLastUpdatedAt(null);
    setCommercialRoundingStep(1);
    setLastRatePromptDate(null);
    setLastPromptedBcvRate(null);
    setLastPromptedBcvEuroRate(null);
    setProfileLoadedSeq(0);
    setProductsLoaded(false);
    dailyRateCheckRanKeyRef.current = null;
    setRateChangeModalState({
      isOpen: false,
      source: 'manual',
      previousUsdRate: INITIAL_BCV_RATE,
      newUsdRate: INITIAL_BCV_RATE,
      previousEurRate: INITIAL_BCV_EURO_RATE,
      newEurRate: INITIAL_BCV_EURO_RATE
    });
    setTransactionsPreset('current_month');
    setTransactionsDateRange(computeTransactionsDateRange('current_month'));
    setIsLoadingHistory(false);
    setBaseCurrencyState('USD');
    setManagerPin('1234');
    setTerminalIdState('C1');
    setApplyIVA(true);
    setApplyIGTF(false);
    setLastDriveSyncTime(null);
    setSelectedClientForPOS(null);
    setCart([]);
    setLastCompletedSale(null);
    setLastCompletedCreditNote(null);
    setLastCompletedDischarge(null);
    setSelectedSaleForCreditNote(null);
    setSelectedProductForDischarge(null);
    setActiveTab('inicio');
    setIsGoogleModalOpen(false);
    setIsProfileModalOpen(false);
    setIsAperturaModalOpenState(false);
    setIsCierreModalOpenState(false);
    setIsCuadreModalOpenState(false);
    setIsCreditNoteModalOpen(false);
    setIsDischargeModalOpen(false);
    isCompletingSaleRef.current = false;
    isCreatingCreditNoteRef.current = false;
    isCreatingDischargeRef.current = false;
    isCheckingRemoteRef.current = false;
    lastDriveFileIdRef.current = null;
    lastRemoteEtagRef.current = null;
    lastRemoteModifiedTimeRef.current = null;
    tombstonesRef.current = {
      deletedProductIds: [],
      canceledSaleIds: [],
      deletedClientIds: [],
      deletedExpenseIds: [],
      deletedCuentaIds: [],
      deletedGastoIds: []
    };
    purgeLegacyBrowserBusinessCaches();
  }, []);

  // Exchange Rate & Profile Settings (Live Firestore Sync)
  const updateBcvRate = useCallback((newRate: number) => {
    setBcvRateState(newRate);
    const todayStr = getLocalDateStr();
    const nowIso = new Date().toISOString();
    const prevHistory = latestDataRef.current.rateHistory || [];
    const updatedHistory = [...prevHistory.filter(h => h.date !== todayStr), { date: todayStr, rate: newRate }];
    setRateHistory(updatedHistory);
    setBcvLastUpdatedDate(todayStr);
    setBcvLastUpdatedAt(nowIso);

    const uid = getActiveUid();
    if (uid) {
      saveBusinessProfileToFirestore(uid, {
        bcvRate: newRate,
        rateHistory: updatedHistory,
        bcvLastUpdatedDate: todayStr,
        bcvLastUpdatedAt: nowIso
      }).catch(e => console.error('Firestore updateBcvRate error:', e));
    }
  }, [getActiveUid]);

  const fetchLiveRate = async (): Promise<number> => {
    setIsFetchingLiveRate(true);
    try {
      const res = await fetchLiveBCVRate();
      updateBcvRate(res.rate);
      return res.rate;
    } finally {
      setIsFetchingLiveRate(false);
    }
  };

  const updateBcvEuroRate = useCallback((newRate: number) => {
    setBcvEuroRateState(newRate);
    const uid = getActiveUid();
    if (uid) {
      saveBusinessProfileToFirestore(uid, { bcvEuroRate: newRate }).catch(e =>
        console.error('Firestore updateBcvEuroRate error:', e)
      );
    }
  }, [getActiveUid]);

  const fetchLiveEuroRate = async (): Promise<number> => {
    setIsFetchingLiveEuroRate(true);
    try {
      const res = await fetchLiveBCVEuroRate();
      updateBcvEuroRate(res.rate);
      return res.rate;
    } finally {
      setIsFetchingLiveEuroRate(false);
    }
  };

  const openRateRecalcModal = useCallback((options?: {
    previousUsdRate?: number;
    previousEurRate?: number;
    newUsdRate?: number;
    newEurRate?: number;
    source?: 'daily_auto' | 'manual';
  }) => {
    const currentUsd = options?.newUsdRate && options.newUsdRate > 0 ? options.newUsdRate : bcvRate;
    const currentEur = options?.newEurRate && options.newEurRate > 0 ? options.newEurRate : bcvEuroRate;
    setRateChangeModalState({
      isOpen: true,
      source: options?.source || 'manual',
      previousUsdRate: options?.previousUsdRate && options.previousUsdRate > 0 ? options.previousUsdRate : currentUsd,
      newUsdRate: currentUsd,
      previousEurRate: options?.previousEurRate && options.previousEurRate > 0 ? options.previousEurRate : currentEur,
      newEurRate: currentEur
    });
  }, [bcvRate, bcvEuroRate]);

  const closeRateRecalcModal = useCallback(() => {
    setRateChangeModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const applyCatalogPriceRecalculation = useCallback(async (options: {
    mode: RatePriceRecalcMode;
    currencyScope: RatePriceCurrencyScope;
    roundingStep: number;
  }): Promise<{ updatedCount: number }> => {
    const uid = getActiveUid();
    if (!uid) {
      throw new Error('Debes iniciar sesión con Google para actualizar precios en Cloud Firestore.');
    }

    const effectiveNewUsd = rateChangeModalState.newUsdRate > 0 ? rateChangeModalState.newUsdRate : bcvRate;
    const effectivePrevUsd = rateChangeModalState.previousUsdRate > 0 ? rateChangeModalState.previousUsdRate : effectiveNewUsd;
    const effectiveNewEur = rateChangeModalState.newEurRate > 0 ? rateChangeModalState.newEurRate : bcvEuroRate;
    const effectivePrevEur = rateChangeModalState.previousEurRate > 0 ? rateChangeModalState.previousEurRate : effectiveNewEur;

    const previewItems = computeCatalogPriceRecalculation({
      products: latestDataRef.current.products || products,
      mode: options.mode,
      currencyScope: options.currencyScope,
      roundingStep: options.roundingStep,
      previousUsdRate: effectivePrevUsd,
      newUsdRate: effectiveNewUsd,
      previousEurRate: effectivePrevEur,
      newEurRate: effectiveNewEur
    });

    const updatedProductsList = previewItems.map((item) => item.updatedProduct);
    const updatedMap = new Map<string, Product>(updatedProductsList.map((p) => [p.id, p]));

    if (updatedProductsList.length > 0) {
      await batchUpdateProductPricesInFirestore(uid, updatedProductsList);
      setProducts((prev) => prev.map((p) => updatedMap.get(p.id) || p));
      setCart((prevCart) =>
        prevCart.map((ci) => {
          const updatedProd = updatedMap.get(ci.product.id);
          if (!updatedProd) return ci;
          const nextUnitUSD = getProductPriceUSD(updatedProd, effectiveNewUsd, effectiveNewEur);
          return {
            ...ci,
            product: updatedProd,
            unitPriceUSD: nextUnitUSD,
            totalUSD: round2(ci.quantity * nextUnitUSD)
          };
        })
      );
    }

    const todayStr = getLocalDateStr();
    setCommercialRoundingStep(options.roundingStep);
    setLastRatePromptDate(todayStr);
    setLastPromptedBcvRate(effectiveNewUsd);
    setLastPromptedBcvEuroRate(effectiveNewEur);

    await saveBusinessProfileToFirestore(uid, {
      lastRatePromptDate: todayStr,
      lastPromptedBcvRate: effectiveNewUsd,
      lastPromptedBcvEuroRate: effectiveNewEur,
      commercialRoundingStep: options.roundingStep
    });

    if (options.mode === 'update_bs_upward') {
      notifyUser(
        'success',
        'Precios del catálogo actualizados',
        `Se recalcularon ${updatedProductsList.length} productos con redondeo comercial hacia arriba (múltiplo de ${options.roundingStep} Bs, sin decimales).`
      );
    } else {
      notifyUser(
        'info',
        'Precios estáticos en Bs conservados',
        `Se mantuvieron intactos los precios en Bolívares de ${updatedProductsList.length} productos y se ajustaron sus equivalentes en USD / EUR a la tasa vigente.`
      );
    }

    return { updatedCount: updatedProductsList.length };
  }, [getActiveUid, rateChangeModalState, bcvRate, bcvEuroRate, products, notifyUser]);

  const setBaseCurrency = useCallback((curr: BaseCurrency) => {
    setBaseCurrencyState(curr);
    const uid = getActiveUid();
    if (uid) {
      saveBusinessProfileToFirestore(uid, { baseCurrency: curr }).catch(e =>
        console.error('Firestore setBaseCurrency error:', e)
      );
    }
  }, [getActiveUid]);

  const updateManagerPin = useCallback((newPin: string) => {
    setManagerPin(newPin);
    const uid = getActiveUid();
    if (uid) {
      saveBusinessProfileToFirestore(uid, { managerPin: newPin }).catch(e =>
        console.error('Firestore updateManagerPin error:', e)
      );
    }
  }, [getActiveUid]);

  /**
   * Apertura de Caja para iniciar la jornada diaria
   */
  const openCashShift = useCallback(async (
    initialCashUSD: number,
    initialCashBs: number,
    notes?: string,
    initialBanks?: BankInitialBalance[],
    openingAudit?: CashOpeningAuditMeta
  ): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para abrir la caja.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }

    const now = new Date();
    const timeStr = now.toLocaleDateString('es-VE') + ' ' + now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const exactInitialUSD = round2(Math.max(0, Number(initialCashUSD) || 0));
    const exactInitialBs = round2(Math.max(0, Number(initialCashBs) || 0));

    const newShift: CashShift = {
      id: 'shift-' + Date.now(),
      isOpen: true,
      openedAt: now.toISOString(),
      openedDateFormatted: timeStr,
      initialCashUSD: exactInitialUSD,
      initialCashBs: exactInitialBs,
      initialBanks: initialBanks && initialBanks.length > 0 ? initialBanks : undefined,
      notes: notes || undefined,
      openedBy: googleUser?.name || 'Administrador',
      ...(openingAudit && {
        previousShiftId: openingAudit.previousShiftId,
        previousCloseDateFormatted: openingAudit.previousCloseDateFormatted,
        previousCloseCashUSD: typeof openingAudit.previousCloseCashUSD === 'number' ? round2(openingAudit.previousCloseCashUSD) : undefined,
        previousCloseCashBs: typeof openingAudit.previousCloseCashBs === 'number' ? round2(openingAudit.previousCloseCashBs) : undefined,
        openingDifferenceUSD: typeof openingAudit.openingDifferenceUSD === 'number' ? round2(openingAudit.openingDifferenceUSD) : undefined,
        openingDifferenceBs: typeof openingAudit.openingDifferenceBs === 'number' ? round2(openingAudit.openingDifferenceBs) : undefined,
        openingMatchedOutflowsUSD: typeof openingAudit.openingMatchedOutflowsUSD === 'number' ? round2(openingAudit.openingMatchedOutflowsUSD) : undefined,
        openingMatchedOutflowsBs: typeof openingAudit.openingMatchedOutflowsBs === 'number' ? round2(openingAudit.openingMatchedOutflowsBs) : undefined,
        openingMatchedMovementsCount: typeof openingAudit.openingMatchedMovementsCount === 'number' ? openingAudit.openingMatchedMovementsCount : undefined,
        openingDifferenceReason: openingAudit.openingDifferenceReason || undefined,
        openingDifferenceNotes: openingAudit.openingDifferenceNotes || undefined
      })
    };

    try {
      await saveCashRegisterStatusToFirestore(uid, {
        isOpen: true,
        activeShift: newShift,
        updatedAt: now.toISOString(),
        updatedBy: googleUser?.name || 'Administrador',
        openedAt: now.toISOString()
      });
      setCashShift(newShift);
      setIsAperturaModalOpen(false);
      notifyUser('success', 'Caja abierta', 'La jornada comercial quedó sincronizada en Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo abrir la caja');
      throw e;
    }
  }, [getActiveUid, googleUser?.name, setIsAperturaModalOpen, notifyError, notifyUser]);

  /**
   * Cierre de Caja al final de la jornada diaria
   */
  const closeCashShift = useCallback(async (countedUSD: number, countedBs: number, closedNotes?: string, countedBanks?: BankInitialBalance[]): Promise<CashShift> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para cerrar la caja.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }

    const now = new Date();
    const timeStr = now.toLocaleDateString('es-VE') + ' ' + now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const openedAtIso = cashShift?.openedAt || startOfToday.toISOString();

    const shiftSales = sales.filter(s => s.status !== 'anulada' && s.date >= openedAtIso);
    const shiftExpenses = expenses.filter(e => e.date >= openedAtIso && e.paymentMethod !== 'credito');
    const shiftCreditNotes = creditNotes.filter(cn => cn.date >= openedAtIso);
    const shiftFiadoAbonos = fiados.flatMap(f => f.abonos || []).filter(a => a.date >= openedAtIso);
    const shiftLoans = loans.filter(l => (l.grantDate || l.createdAt) >= openedAtIso);

    let cashUsdInflow = 0;
    let cashBsInflow = 0;
    shiftSales.forEach(s => {
      if (s.paymentMethod === 'efectivo_usd') {
        cashUsdInflow += s.totalUSD;
      } else if (s.paymentMethod === 'efectivo_bs') {
        cashBsInflow += s.totalBs;
      } else if (s.paymentMethod === 'pago_combinado' && s.paymentDetails?.combinedBreakdown) {
        cashUsdInflow += (s.paymentDetails.combinedBreakdown.usdCash || 0);
        cashBsInflow += (s.paymentDetails.combinedBreakdown.bsCash || 0);
      }
    });

    let loansCashUsdInflow = 0;
    let loansCashBsInflow = 0;
    shiftLoans.forEach(l => {
      if (l.cashDestination === 'efectivo_usd') {
        loansCashUsdInflow += l.originalAmountUSD;
        cashUsdInflow += l.originalAmountUSD;
      } else if (l.cashDestination === 'efectivo_bs') {
        loansCashBsInflow += l.originalAmountBs;
        cashBsInflow += l.originalAmountBs;
      }
    });

    let fiadoAbonosCashUSD = 0;
    let fiadoAbonosCashBs = 0;
    let totalFiadoAbonosUSD = 0;
    let totalFiadoAbonosBs = 0;
    shiftFiadoAbonos.forEach(a => {
      totalFiadoAbonosUSD += a.amountUSD;
      totalFiadoAbonosBs += a.amountBs;
      if (a.paymentMethod === 'efectivo_usd') {
        fiadoAbonosCashUSD += a.amountUSD;
      } else if (a.paymentMethod === 'efectivo_bs') {
        fiadoAbonosCashBs += a.amountBs;
      }
    });

    const cashUsdExpOutflow = shiftExpenses
      .filter(e => e.paymentMethod === 'efectivo_usd')
      .reduce((acc, e) => acc + e.amountUSD, 0);
    const cashBsExpOutflow = shiftExpenses
      .filter(e => e.paymentMethod === 'efectivo_bs')
      .reduce((acc, e) => acc + e.amountBs, 0);

    const cashUsdRefundOutflow = shiftCreditNotes
      .filter(cn => cn.refundMethod === 'efectivo_usd')
      .reduce((acc, cn) => acc + cn.totalUSD, 0);
    const cashBsRefundOutflow = shiftCreditNotes
      .filter(cn => cn.refundMethod === 'efectivo_bs')
      .reduce((acc, cn) => acc + cn.totalBs, 0);

    const initialUSD = cashShift?.initialCashUSD || 0;
    const initialBs = cashShift?.initialCashBs || 0;

    const expectedCashUSD = round2(initialUSD + cashUsdInflow + fiadoAbonosCashUSD - cashUsdExpOutflow - cashUsdRefundOutflow);
    const expectedCashBs = round2(initialBs + cashBsInflow + fiadoAbonosCashBs - cashBsExpOutflow - cashBsRefundOutflow);

    const safeCountedUSD = round2(Number(countedUSD) || 0);
    const safeCountedBs = round2(Number(countedBs) || 0);

    const diffUSD = round2(safeCountedUSD - expectedCashUSD);
    const diffBs = round2(safeCountedBs - expectedCashBs);

    const totalCreditNotesUSD = round2(shiftCreditNotes.reduce((acc, cn) => acc + cn.totalUSD, 0));
    const totalCreditNotesBs = round2(shiftCreditNotes.reduce((acc, cn) => acc + cn.totalBs, 0));

    const totalSalesUSD = round2(shiftSales.reduce((acc, s) => acc + s.totalUSD, 0) - totalCreditNotesUSD);
    const totalSalesBs = round2(shiftSales.reduce((acc, s) => acc + s.totalBs, 0) - totalCreditNotesBs);
    const transactionsCount = shiftSales.length;
    const totalExpensesUSD = round2(shiftExpenses.reduce((acc, e) => acc + e.amountUSD, 0));
    const totalExpensesBs = round2(shiftExpenses.reduce((acc, e) => acc + e.amountBs, 0));

    const totalOwnerSalaryUSD = round2(
      shiftExpenses.filter(e => isExpenseOwnerSalary(e)).reduce((acc, e) => acc + e.amountUSD, 0)
    );
    const totalOwnerSalaryBs = round2(
      shiftExpenses.filter(e => isExpenseOwnerSalary(e)).reduce((acc, e) => acc + e.amountBs, 0)
    );
    const totalOwnerWithdrawalsUSD = round2(
      shiftExpenses.filter(e => isExpenseOwnerWithdrawal(e)).reduce((acc, e) => acc + e.amountUSD, 0)
    );
    const totalOwnerWithdrawalsBs = round2(
      shiftExpenses.filter(e => isExpenseOwnerWithdrawal(e)).reduce((acc, e) => acc + e.amountBs, 0)
    );

    const bankTraceSummaries = computeShiftBankSummaries(
      countedBanks || cashShift?.initialBanks,
      shiftSales,
      shiftExpenses,
      shiftCreditNotes,
      shiftFiadoAbonos,
      shiftLoans
    );
    const enrichedBanks: BankInitialBalance[] | undefined = (countedBanks || cashShift?.initialBanks)?.map((b) => {
      const trace = bankTraceSummaries.find((s) => s.bankId === b.bankId);
      return trace
        ? {
            ...b,
            outflowsBs: trace.outflowsBs,
            outflowsUSD: trace.outflowsUSD,
            expectedBalanceBs: trace.expectedBalanceBs,
            expectedBalanceUSD: trace.expectedBalanceUSD
          }
        : b;
    });

    const salesBreakdown: Record<string, { usd: number; bs: number }> = {};
    shiftSales.forEach(s => {
      const m = s.paymentMethod;
      if (!salesBreakdown[m]) salesBreakdown[m] = { usd: 0, bs: 0 };
      salesBreakdown[m].usd = round2(salesBreakdown[m].usd + s.totalUSD);
      salesBreakdown[m].bs = round2(salesBreakdown[m].bs + s.totalBs);
    });

    const closedShift: CashShift = {
      ...(cashShift || {
        id: 'shift-' + Date.now(),
        isOpen: false,
        openedAt: openedAtIso,
        openedDateFormatted: timeStr,
        initialCashUSD: 0,
        initialCashBs: 0
      }),
      isOpen: false,
      closedAt: now.toISOString(),
      closedDateFormatted: timeStr,
      closedBy: googleUser?.name || 'Administrador',
      expectedCashUSD,
      expectedCashBs,
      countedCashUSD: safeCountedUSD,
      countedCashBs: safeCountedBs,
      differenceUSD: diffUSD,
      differenceBs: diffBs,
      closedNotes,
      initialBanks: enrichedBanks,
      totalSalesUSD,
      totalSalesBs,
      salesBreakdown,
      transactionsCount,
      totalExpensesUSD,
      totalExpensesBs,
      totalOwnerSalaryUSD,
      totalOwnerSalaryBs,
      totalOwnerWithdrawalsUSD,
      totalOwnerWithdrawalsBs,
      totalCreditNotesUSD,
      totalCreditNotesBs,
      totalFiadoAbonosUSD: round2(totalFiadoAbonosUSD),
      totalFiadoAbonosBs: round2(totalFiadoAbonosBs),
      totalLoansInflowUSD: round2(loansCashUsdInflow),
      totalLoansInflowBs: round2(loansCashBsInflow)
    };

    try {
      await Promise.all([
        saveCashShiftToFirestore(uid, closedShift),
        saveCashRegisterStatusToFirestore(uid, {
          isOpen: false,
          activeShift: null,
          updatedAt: now.toISOString(),
          updatedBy: googleUser?.name || 'Administrador'
        })
      ]);
      setCashShift(closedShift);
      setCashShiftHistory(prev => [closedShift, ...prev.filter(h => h.id !== closedShift.id)]);
      notifyUser('success', 'Cierre de caja confirmado', 'El arqueo y cierre de jornada quedaron guardados en la nube.');
      syncToGoogleDriveRef.current().then(() => {
        devLog('[PosVenecia] Respaldo opcional de cierre guardado en Google Drive.');
      }).catch(() => {});
      return closedShift;
    } catch (e) {
      notifyError(e, 'No se pudo completar el cierre de caja');
      throw e;
    }
  }, [cashShift, sales, expenses, creditNotes, fiados, loans, getActiveUid, googleUser?.name, notifyError, notifyUser]);

  /**
   * Fetches a complete 14-collection snapshot directly from Cloud Firestore for lossless backups (JSON / Excel / Drive)
   */
  const getFullDatabasePayload = useCallback(async (): Promise<BackupDataPayload> => {
    const uid = getActiveUid();
    if (!uid) {
      throw new Error('Debes iniciar sesión con Google para generar un respaldo completo desde Cloud Firestore.');
    }
    return fetchFullStoreSnapshotForBackup(uid, latestDataRef.current.googleUser?.email || '');
  }, [getActiveUid]);

  const toDrivePayload = (snap: BackupDataPayload): AppDatabasePayload => ({
    version: snap.version,
    updatedAt: snap.timestamp,
    userEmail: snap.userEmail || '',
    userUid: snap.userUid || '',
    businessInfo: snap.businessInfo,
    bcvRate: snap.bcvRate,
    bcvEuroRate: snap.bcvEuroRate ?? latestDataRef.current.bcvEuroRate,
    baseCurrency: snap.baseCurrency,
    rateHistory: snap.rateHistory,
    bcvLastUpdatedDate: snap.bcvLastUpdatedDate,
    bcvLastUpdatedAt: snap.bcvLastUpdatedAt,
    customCategories: snap.customCategories,
    managerPin: snap.managerPin,
    products: snap.products,
    sales: snap.sales,
    expenses: snap.expenses,
    fiados: snap.fiados,
    cuentasPorPagar: snap.cuentasPorPagar,
    gastosOperativos: snap.gastosOperativos || [],
    clients: snap.clients,
    suppliers: snap.suppliers || [],
    loans: snap.loans || [],
    creditNotes: snap.creditNotes || [],
    inventoryDischarges: snap.inventoryDischarges || [],
    kardex: snap.kardex || [],
    cashShift: snap.cashShift,
    cashShiftHistory: snap.cashShiftHistory || [],
    tombstones: { ...tombstonesRef.current }
  });

  /**
   * Optional manual export to Google Drive (reads complete Cloud Firestore snapshot unconditionally)
   */
  const syncToGoogleDrive = useCallback(async (): Promise<boolean> => {
    return driveSyncMutex.runExclusive(async () => {
      const token = getGoogleAccessToken();
      const curUser = latestDataRef.current.googleUser;
      if (!token || !curUser) {
        setDriveSyncStatus('unauthenticated');
        return false;
      }

      if (isGoogleTokenExpired()) {
        setDriveSyncStatus('token_expired');
        return false;
      }

      setIsDriveSyncing(true);
      setDriveSyncStatus('syncing');

      try {
        const fullSnapshot = await fetchFullStoreSnapshotForBackup(curUser.uid, curUser.email || '');
        let payload = toDrivePayload(fullSnapshot);
        let saveRes: { fileId: string; modifiedTime: string; etag: string | null } | null = null;

        try {
          saveRes = await saveDatabaseToDrive(
            token,
            payload,
            lastDriveFileIdRef.current,
            lastRemoteEtagRef.current
          );
        } catch (err: any) {
          if (err instanceof PreconditionFailedError) {
            const meta = await getRemoteDatabaseMetadata(token);
            if (meta?.fileId) {
              const remoteRes = await readDatabaseFromDrive(token, meta.fileId);
              if (remoteRes?.data) {
                const mergedPayload = mergeDatabasePayloads(payload, remoteRes.data);
                payload = mergedPayload;
                saveRes = await saveDatabaseToDrive(
                  token,
                  mergedPayload,
                  meta.fileId,
                  remoteRes.etag
                );
              }
            }
          } else {
            throw err;
          }
        }

        if (saveRes?.fileId) lastDriveFileIdRef.current = saveRes.fileId;
        if (saveRes?.modifiedTime) lastRemoteModifiedTimeRef.current = saveRes.modifiedTime;
        if (saveRes?.etag) lastRemoteEtagRef.current = saveRes.etag;

        const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        setLastDriveSyncTime(timeStr);
        setDriveSyncStatus('synced');
        return true;
      } catch (err: any) {
        console.error('Error syncing to Google Drive:', err);
        if (err instanceof GoogleDriveAuthError || err?.isExpired || isGoogleTokenExpired()) {
          setDriveSyncStatus('token_expired');
        } else {
          setDriveSyncStatus('error');
        }
        return false;
      } finally {
        setIsDriveSyncing(false);
      }
    });
  }, []);

  useEffect(() => {
    syncToGoogleDriveRef.current = syncToGoogleDrive;
  }, [syncToGoogleDrive]);

  /**
   * Restore from Google Drive backup into Cloud Firestore
   */
  const reloadFromGoogleDrive = useCallback(async (): Promise<boolean> => {
    return driveSyncMutex.runExclusive(async () => {
      const token = getGoogleAccessToken();
      const curUser = latestDataRef.current.googleUser;
      if (!token || !curUser) return false;

      if (isGoogleTokenExpired()) {
        setDriveSyncStatus('token_expired');
        return false;
      }

      setIsDriveSyncing(true);
      setDriveSyncStatus('syncing');

      try {
        const meta = await getRemoteDatabaseMetadata(token);
        if (meta && meta.fileId) {
          lastDriveFileIdRef.current = meta.fileId;
          const remoteResult = await readDatabaseFromDrive(token, meta.fileId);
          if (remoteResult && remoteResult.data) {
            const fullSnapshot = await fetchFullStoreSnapshotForBackup(curUser.uid, curUser.email || '');
            const localPayload = toDrivePayload(fullSnapshot);
            const merged = mergeDatabasePayloads(localPayload, remoteResult.data);

            await restoreStoreDataToFirestore(curUser.uid, {
              products: merged.products,
              sales: merged.sales,
              expenses: merged.expenses,
              fiados: merged.fiados,
              clients: merged.clients,
              cuentasPorPagar: merged.cuentasPorPagar,
              gastosOperativos: merged.gastosOperativos || [],
              suppliers: merged.suppliers || [],
              loans: merged.loans || [],
              creditNotes: merged.creditNotes || [],
              inventoryDischarges: merged.inventoryDischarges || [],
              kardex: merged.kardex || [],
              cashShiftHistory: merged.cashShiftHistory || [],
              businessInfo: merged.businessInfo || DEFAULT_BUSINESS_INFO,
              bcvRate: merged.bcvRate || bcvRate,
              bcvEuroRate: merged.bcvEuroRate || bcvEuroRate,
              baseCurrency: merged.baseCurrency || 'USD',
              rateHistory: merged.rateHistory || [],
              bcvLastUpdatedDate: merged.bcvLastUpdatedDate,
              bcvLastUpdatedAt: merged.bcvLastUpdatedAt,
              customCategories: merged.customCategories || [],
              managerPin: merged.managerPin || '1234',
              cashShift: merged.cashShift
            });

            if (meta.modifiedTime) lastRemoteModifiedTimeRef.current = meta.modifiedTime;
            if (remoteResult.etag || meta.etag) lastRemoteEtagRef.current = remoteResult.etag || meta.etag || null;

            const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
            setLastDriveSyncTime(timeStr);
            setDriveSyncStatus('synced');
            notifyUser('success', 'Respaldo sincronizado', 'Datos restaurados desde Google Drive en Cloud Firestore.');
            return true;
          }
        }
        setDriveSyncStatus('synced');
        return false;
      } catch (err: any) {
        console.error('Error reloading from Drive:', err);
        if (err instanceof GoogleDriveAuthError || err?.isExpired || isGoogleTokenExpired()) {
          setDriveSyncStatus('token_expired');
        } else {
          setDriveSyncStatus('error');
        }
        notifyError(err, 'Error al restaurar desde Google Drive');
        return false;
      } finally {
        setIsDriveSyncing(false);
      }
    });
  }, [bcvEuroRate, bcvRate, notifyError, notifyUser]);

  const renewGoogleSession = useCallback(async (): Promise<boolean> => {
    try {
      setIsDriveSyncing(true);
      setDriveSyncStatus('syncing');
      const token = await renewGoogleToken();
      if (token) {
        setDriveSyncStatus('synced');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error renewing Google Drive session:', err);
      setDriveSyncStatus('token_expired');
      return false;
    } finally {
      setIsDriveSyncing(false);
    }
  }, []);

  const checkRemoteChangesForMultiDevice = useCallback(async () => {
    if (isCheckingRemoteRef.current) return;
    isCheckingRemoteRef.current = false;
  }, []);

  /**
   * Restores a JSON backup directly into Cloud Firestore under users/{uid}/...
   */
  const restoreDatabase = useCallback(async (payload: any): Promise<boolean> => {
    if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.sales)) {
      throw new Error('El archivo no tiene el formato de copia de seguridad válido de PosVenecia.');
    }

    const uid = getActiveUid();
    if (!uid) {
      throw new Error('Debes iniciar sesión con Google para restaurar datos en Cloud Firestore.');
    }

    try {
      await restoreStoreDataToFirestore(uid, {
        products: payload.products || [],
        sales: payload.sales || [],
        expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
        fiados: Array.isArray(payload.fiados) ? payload.fiados : [],
        clients: Array.isArray(payload.clients) ? payload.clients : [],
        cuentasPorPagar: Array.isArray(payload.cuentasPorPagar) ? payload.cuentasPorPagar : [],
        gastosOperativos: Array.isArray(payload.gastosOperativos) ? payload.gastosOperativos : [],
        suppliers: Array.isArray(payload.suppliers) ? payload.suppliers : [],
        loans: Array.isArray(payload.loans) ? payload.loans : [],
        creditNotes: Array.isArray(payload.creditNotes) ? payload.creditNotes : [],
        inventoryDischarges: Array.isArray(payload.inventoryDischarges) ? payload.inventoryDischarges : [],
        kardex: Array.isArray(payload.kardex) ? payload.kardex : [],
        cashShiftHistory: Array.isArray(payload.cashShiftHistory) ? payload.cashShiftHistory : [],
        businessInfo: payload.businessInfo || DEFAULT_BUSINESS_INFO,
        bcvRate: payload.bcvRate || bcvRate,
        bcvEuroRate: payload.bcvEuroRate || bcvEuroRate,
        baseCurrency: payload.baseCurrency || 'USD',
        rateHistory: Array.isArray(payload.rateHistory) ? payload.rateHistory : [],
        bcvLastUpdatedDate: payload.bcvLastUpdatedDate,
        bcvLastUpdatedAt: payload.bcvLastUpdatedAt,
        customCategories: Array.isArray(payload.customCategories) ? payload.customCategories : [],
        managerPin: payload.managerPin || '1234',
        cashShift: payload.cashShift !== undefined ? payload.cashShift : null
      });
      notifyUser('success', 'Restauración completada', 'Toda la copia de seguridad fue importada a Cloud Firestore.');
      return true;
    } catch (err) {
      notifyError(err, 'No se pudo restaurar la copia de seguridad');
      throw err;
    }
  }, [bcvEuroRate, bcvRate, getActiveUid, notifyError, notifyUser]);

  const setTransactionsDateFilter = useCallback(
    (preset: TransactionsDatePreset, customStart?: string, customEnd?: string) => {
      const nextRange = computeTransactionsDateRange(preset, customStart, customEnd);
      setTransactionsPreset(preset);
      setTransactionsDateRange(nextRange);
    },
    []
  );

  /**
   * Attaches live onSnapshot subscriptions strictly scoped to users/{uid}/...
   */
  const attachRealtimeSync = useCallback((uid: string) => {
    const userId = getCanonicalUserId(uid);
    if (activeFirestoreUidRef.current === userId && firestoreUnsubRef.current) {
      return;
    }

    if (firestoreUnsubRef.current) {
      firestoreUnsubRef.current();
      firestoreUnsubRef.current = null;
    }

    activeFirestoreUidRef.current = userId;
    setFirestoreSyncStatus('syncing');

    firestoreUnsubRef.current = subscribeToStoreRealtime(userId, {
      onProducts: (newProds) => {
        setProducts(newProds);
        setProductsLoaded(true);
        setFirestoreSyncStatus('synced');
      },
      onFiados: (newFiados) => setFiados(newFiados),
      onClients: (newClients) => setClients(newClients),
      onCuentasPorPagar: (newCPP) => setCuentasPorPagar(newCPP),
      onGastosOperativos: (newGastos) => setGastosOperativos(newGastos),
      onCreditNotes: (newNotes) => setCreditNotes(newNotes),
      onInventoryDischarges: (newDischarges) => setInventoryDischarges(newDischarges),
      onKardex: (entries) => setKardex(entries),
      onSuppliers: (list) => setSuppliers(list),
      onLoans: (list) => setLoans(list),
      onTreasuryAccounts: (list) => {
        setTreasuryAccounts(list);
        setTreasuryAccountsLoaded(true);
      },
      onTreasuryMovements: (list) => setTreasuryMovements(list),
      onMissingCollectionPermissions: (colName) => {
        setMissingRuleCollections((prev) => (prev.includes(colName) ? prev : [...prev, colName]));
      },
      onCollectionPermissionOk: (colName) => {
        setMissingRuleCollections((prev) => prev.filter((c) => c !== colName));
      },
      onCashShiftHistory: (newHistory) => setCashShiftHistory(newHistory),
      onCashRegisterStatus: (status: CashRegisterStatusDoc) => {
        devLog(`[PosVenecia Realtime] Caja sincronizada en vivo: ${status.isOpen ? 'ABIERTA' : 'CERRADA'}`);
        setCashShift(status.isOpen ? (status.activeShift || null) : null);
      },
      onBusinessProfile: (profile) => {
        if (profile.businessInfo) setBusinessInfo(profile.businessInfo);
        if (typeof profile.bcvRate === 'number') setBcvRateState(profile.bcvRate);
        if (typeof profile.bcvEuroRate === 'number') setBcvEuroRateState(profile.bcvEuroRate);
        if (profile.baseCurrency) setBaseCurrencyState(profile.baseCurrency);
        if (profile.rateHistory) setRateHistory(profile.rateHistory);
        if (profile.bcvLastUpdatedDate) {
          setBcvLastUpdatedDate(profile.bcvLastUpdatedDate);
        } else if (profile.rateHistory?.some(h => h.date === getLocalDateStr())) {
          setBcvLastUpdatedDate(getLocalDateStr());
        } else {
          setBcvLastUpdatedDate(null);
        }
        setBcvLastUpdatedAt(profile.bcvLastUpdatedAt || null);
        if (typeof profile.commercialRoundingStep === 'number' && profile.commercialRoundingStep >= 1) {
          setCommercialRoundingStep(Math.floor(profile.commercialRoundingStep));
        }
        setLastRatePromptDate(profile.lastRatePromptDate || null);
        setLastPromptedBcvRate(typeof profile.lastPromptedBcvRate === 'number' ? profile.lastPromptedBcvRate : null);
        setLastPromptedBcvEuroRate(typeof profile.lastPromptedBcvEuroRate === 'number' ? profile.lastPromptedBcvEuroRate : null);
        if (profile.customCategories) setCustomCategories(profile.customCategories);
        if (profile.managerPin) setManagerPin(profile.managerPin);
        setProfileLoadedSeq((seq) => seq + 1);
      },
      onError: (err) => {
        if (import.meta.env.DEV) console.warn('[PosVenecia Firestore Realtime] Error:', err);
        setFirestoreSyncStatus('error');
        notifyError(err, 'Error de sincronización en tiempo real');
      }
    });
    setFirestoreSyncStatus('synced');
  }, [notifyError]);

  const retryFirestoreSubscriptions = useCallback(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    resetDeniedOptionalCollections(uid);
    treasurySeededUidRef.current = null;
    setMissingRuleCollections([]);
    activeFirestoreUidRef.current = null;
    attachRealtimeSync(uid);
  }, [googleUser?.uid, attachRealtimeSync]);

  // Idempotently ensure canonical cash accounts (cash_usd, cash_bs) and migrate configured banks into Tesorería
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid || !treasuryAccountsLoaded || profileLoadedSeq === 0) return;
    if (missingRuleCollections.includes('bankAccounts')) return;
    const hasCashUsd = treasuryAccounts.some((a) => a.id === 'cash_usd');
    const hasCashBs = treasuryAccounts.some((a) => a.id === 'cash_bs');
    if (hasCashUsd && hasCashBs && treasurySeededUidRef.current === uid) return;
    treasurySeededUidRef.current = uid;
    ensureDefaultTreasuryAccountsInFirestore(uid, treasuryAccounts, businessInfo).catch((e) => {
      if (import.meta.env.DEV) console.warn('Treasury seed warning:', e);
    });
  }, [googleUser?.uid, treasuryAccountsLoaded, profileLoadedSeq, treasuryAccounts, businessInfo, missingRuleCollections]);

  const getDefaultTreasuryBank = useCallback(() => {
    const banks = treasuryAccounts.filter((a) => a.accountType === 'bank' && a.isActive !== false);
    const preferredBs =
      banks.find((a) => a.currency === 'Bs' && a.isDefault) ||
      banks.find((a) => a.currency === 'Bs') ||
      banks[0];
    return preferredBs
      ? { id: preferredBs.id, name: preferredBs.name }
      : { id: undefined, name: undefined };
  }, [treasuryAccounts]);

  // Re-subscribes ONLY `sales` and `expenses` when user switches date filter or logs in,
  // ensuring active cash shift boundaries are always covered without streaming unbounded months.
  const activeShiftOpenedYMD = cashShift?.isOpen && cashShift.openedAt
    ? getLocalDateStr(cashShift.openedAt)
    : null;

  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) {
      if (transactionsUnsubRef.current) {
        transactionsUnsubRef.current();
        transactionsUnsubRef.current = null;
      }
      setIsLoadingHistory(false);
      return;
    }

    if (transactionsUnsubRef.current) {
      transactionsUnsubRef.current();
      transactionsUnsubRef.current = null;
    }

    let effectiveRange = transactionsDateRange;
    if (
      effectiveRange &&
      activeShiftOpenedYMD &&
      (transactionsPreset === 'current_month' || transactionsPreset === 'today') &&
      activeShiftOpenedYMD < effectiveRange.startDate
    ) {
      effectiveRange = { ...effectiveRange, startDate: activeShiftOpenedYMD };
    }

    setIsLoadingHistory(true);
    let salesReady = false;
    let expensesReady = false;
    const markReady = () => {
      if (salesReady && expensesReady) {
        setIsLoadingHistory(false);
      }
    };

    transactionsUnsubRef.current = subscribeToTransactionsRealtime(uid, effectiveRange, {
      onSales: (newSales) => {
        setSales(newSales);
        salesReady = true;
        markReady();
      },
      onExpenses: (newExpenses) => {
        setExpenses(newExpenses);
        expensesReady = true;
        markReady();
      },
      onError: (err) => {
        if (import.meta.env.DEV) console.warn('[PosVenecia Firestore Transactions] Error:', err);
        setIsLoadingHistory(false);
        notifyError(err, 'Error al cargar historial de movimientos');
      }
    });

    return () => {
      if (transactionsUnsubRef.current) {
        transactionsUnsubRef.current();
        transactionsUnsubRef.current = null;
      }
    };
  }, [googleUser?.uid, transactionsDateRange, transactionsPreset, activeShiftOpenedYMD, notifyError]);

  /**
   * Detección diaria automática de cambio de tasa BCV al iniciar sesión:
   * - Espera a que carguen tanto el perfil como el catálogo desde Cloud Firestore (evita race conditions).
   * - Si aún no se ha actualizado la tasa oficial hoy, consulta el BCV ($ y €) en segundo plano.
   * - Si la tasa cambió respecto al día anterior y existen productos en el catálogo,
   *   guarda la tasa nueva y abre el Modal de Alerta Informativa.
   */
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid || !isOnline || profileLoadedSeq === 0 || !productsLoaded) return;

    const todayStr = getLocalDateStr();
    const checkKey = `${uid}_${todayStr}`;
    if (dailyRateCheckRanKeyRef.current === checkKey) return;
    dailyRateCheckRanKeyRef.current = checkKey;

    let cancelled = false;

    const runDailyRateCheck = async () => {
      const savedUsd = bcvRate;
      const savedEur = bcvEuroRate;
      const savedLastDate = bcvLastUpdatedDate;
      const savedPromptDate = lastRatePromptDate;
      const savedPromptUsd = lastPromptedBcvRate;
      const savedPromptEur = lastPromptedBcvEuroRate;
      const savedHistory = rateHistory || [];

      if (savedLastDate !== todayStr) {
        const [usdResult, eurResult] = await Promise.allSettled([
          fetchLiveBCVRate(),
          fetchLiveBCVEuroRate()
        ]);
        if (cancelled) return;

        const fetchedUsd =
          usdResult.status === 'fulfilled' && Number.isFinite(usdResult.value.rate) && usdResult.value.rate > 0
            ? round2(usdResult.value.rate)
            : savedUsd;
        const fetchedEur =
          eurResult.status === 'fulfilled' && Number.isFinite(eurResult.value.rate) && eurResult.value.rate > 0
            ? round2(eurResult.value.rate)
            : savedEur;

        const usdGotFresh = usdResult.status === 'fulfilled' && fetchedUsd > 0;
        const eurGotFresh = eurResult.status === 'fulfilled' && fetchedEur > 0;

        if (usdGotFresh || eurGotFresh) {
          const nowIso = new Date().toISOString();
          const updatedHistory = [
            ...savedHistory.filter((h) => h.date !== todayStr),
            { date: todayStr, rate: fetchedUsd }
          ];
          setBcvRateState(fetchedUsd);
          setBcvEuroRateState(fetchedEur);
          setRateHistory(updatedHistory);
          setBcvLastUpdatedDate(todayStr);
          setBcvLastUpdatedAt(nowIso);

          saveBusinessProfileToFirestore(uid, {
            bcvRate: fetchedUsd,
            bcvEuroRate: fetchedEur,
            rateHistory: updatedHistory,
            bcvLastUpdatedDate: todayStr,
            bcvLastUpdatedAt: nowIso
          }).catch((e) => console.error('Firestore daily BCV auto-update error:', e));

          const usdChanged = Math.abs(fetchedUsd - savedUsd) >= 0.01;
          const eurChanged = Math.abs(fetchedEur - savedEur) >= 0.01;
          const alreadyAnsweredForThisRate =
            savedPromptDate === todayStr &&
            typeof savedPromptUsd === 'number' &&
            Math.abs(savedPromptUsd - fetchedUsd) < 0.01 &&
            (typeof savedPromptEur !== 'number' || Math.abs(savedPromptEur - fetchedEur) < 0.01);

          const hasCatalogProducts = (latestDataRef.current.products || []).length > 0;
          if ((usdChanged || eurChanged) && !alreadyAnsweredForThisRate && hasCatalogProducts) {
            setRateChangeModalState({
              isOpen: true,
              source: 'daily_auto',
              previousUsdRate: savedUsd,
              newUsdRate: fetchedUsd,
              previousEurRate: savedEur,
              newEurRate: fetchedEur
            });
          }
        }
      } else if (savedPromptDate !== todayStr) {
        // La tasa ya se actualizó hoy (por ejemplo en otro dispositivo), pero aún no se responde la alerta del día
        const prevDayEntry = [...savedHistory]
          .filter((h) => h.date < todayStr)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const prevUsd =
          typeof savedPromptUsd === 'number' && savedPromptUsd > 0
            ? savedPromptUsd
            : (prevDayEntry?.rate || savedUsd);
        const prevEur =
          typeof savedPromptEur === 'number' && savedPromptEur > 0
            ? savedPromptEur
            : savedEur;

        const usdChanged = Math.abs(savedUsd - prevUsd) >= 0.01;
        const eurChanged = Math.abs(savedEur - prevEur) >= 0.01;
        const hasCatalogProducts = (latestDataRef.current.products || []).length > 0;

        if ((usdChanged || eurChanged) && hasCatalogProducts) {
          setRateChangeModalState({
            isOpen: true,
            source: 'daily_auto',
            previousUsdRate: prevUsd,
            newUsdRate: savedUsd,
            previousEurRate: prevEur,
            newEurRate: savedEur
          });
        }
      }
    };

    runDailyRateCheck().catch((e) => {
      if (import.meta.env.DEV) console.warn('Daily BCV check skipped:', e);
    });

    return () => {
      cancelled = true;
    };
  }, [
    googleUser?.uid,
    isOnline,
    profileLoadedSeq,
    productsLoaded,
    bcvRate,
    bcvEuroRate,
    bcvLastUpdatedDate,
    lastRatePromptDate,
    lastPromptedBcvRate,
    lastPromptedBcvEuroRate,
    rateHistory
  ]);

  /**
   * Firebase Auth initialization & real-time Firestore subscription (Strictly single-mount)
   */
  useEffect(() => {
    const unsubscribe = initAuth(async (firebaseUser, token) => {
      setIsAuthLoading(false);

      if (firebaseUser) {
        // Clear previous user's state if switching accounts
        if (activeFirestoreUidRef.current && activeFirestoreUidRef.current !== firebaseUser.uid) {
          clearAllInMemoryState();
        }

        const gUser: GoogleAccount = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
          picture: firebaseUser.photoURL || undefined,
          photoUrl: firebaseUser.photoURL || undefined,
          isConnected: true,
          autoSyncEnabled: true
        };
        setGoogleUser(gUser);
        attachRealtimeSync(firebaseUser.uid);
        setDriveSyncStatus(token ? 'synced' : 'token_expired');
      } else {
        if (firestoreUnsubRef.current) {
          firestoreUnsubRef.current();
          firestoreUnsubRef.current = null;
        }
        if (transactionsUnsubRef.current) {
          transactionsUnsubRef.current();
          transactionsUnsubRef.current = null;
        }
        activeFirestoreUidRef.current = null;
        setGoogleUser(null);
        setMissingRuleCollections([]);
        setFirestoreSyncStatus('unauthenticated');
        setDriveSyncStatus('unauthenticated');
        clearAllInMemoryState();
      }
    });

    return () => {
      unsubscribe();
      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
        firestoreUnsubRef.current = null;
      }
      if (transactionsUnsubRef.current) {
        transactionsUnsubRef.current();
        transactionsUnsubRef.current = null;
      }
      activeFirestoreUidRef.current = null;
    };
  }, [attachRealtimeSync, clearAllInMemoryState]);

  /**
   * Google Sign-in flow handler
   */
  const loginWithGoogle = async () => {
    try {
      setIsDriveSyncing(true);
      setFirestoreSyncStatus('syncing');
      const { user } = await signInWithGoogle();

      const gUser: GoogleAccount = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || user.email?.split('@')[0] || 'Usuario',
        picture: user.photoURL || undefined,
        photoUrl: user.photoURL || undefined,
        isConnected: true,
        autoSyncEnabled: true
      };
      setGoogleUser(gUser);
      attachRealtimeSync(user.uid);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Login error:', err);
      setFirestoreSyncStatus('error');
      throw err;
    } finally {
      setIsDriveSyncing(false);
    }
  };

  /**
   * Google Log-out flow handler:
   * 1. Waits for all in-flight Cloud Firestore writes to settle.
   * 2. Detaches real-time onSnapshot listeners.
   * 3. Signs out Firebase Auth & clears session tokens.
   * 4. Completely wipes React in-memory state and any legacy browser cache.
   */
  const logoutGoogle = async () => {
    try {
      setFirestoreSyncStatus('syncing');
      await waitForAllPendingWrites();

      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
        firestoreUnsubRef.current = null;
      }
      if (transactionsUnsubRef.current) {
        transactionsUnsubRef.current();
        transactionsUnsubRef.current = null;
      }
      activeFirestoreUidRef.current = null;
      await logOutGoogle();
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Logout error from Firebase auth:', err);
    } finally {
      activeFirestoreUidRef.current = null;
      setGoogleUser(null);
      setFirestoreSyncStatus('unauthenticated');
      setDriveSyncStatus('unauthenticated');
      clearAllInMemoryState();
    }
  };

  // Business Info updates (Saved directly in Cloud Firestore users/{uid}/businessProfile/profile)
  const updateBusinessInfo = useCallback(async (info: Partial<BusinessInfo>): Promise<void> => {
    const uid = getActiveUid();
    const next = { ...latestDataRef.current.businessInfo, ...info };
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para guardar el perfil del negocio.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await saveBusinessProfileToFirestore(uid, { businessInfo: next });
      latestDataRef.current = { ...latestDataRef.current, businessInfo: next };
      setBusinessInfo(next);
      notifyUser('success', 'Perfil actualizado', 'Datos del comercio guardados en Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo guardar el perfil del negocio');
      throw e;
    }
  }, [getActiveUid, notifyError, notifyUser]);

  // Categories helper (Saved directly in Cloud Firestore)
  const addCategory = useCallback((newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setCustomCategories(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      const uid = getActiveUid();
      if (uid) {
        saveBusinessProfileToFirestore(uid, { customCategories: next }).catch(e => {
          console.error('[PosVenecia Firestore] Error guardando categoría:', e);
          notifyError(e, 'No se pudo guardar la categoría');
        });
      }
      return next;
    });
  }, [getActiveUid, notifyError]);

  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...customCategories,
    ...products.map(p => p.category)
  ])).filter(Boolean);

  // Product CRUD with real-time Firestore sync + immutable Kardex trace
  const addProduct = async (prodData: Omit<Product, 'id'>): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para agregar productos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    const newProd: Product = {
      ...prodData,
      id: 'prod-' + Date.now()
    };

    const isPhysical = !newProd.isService && newProd.itemType !== 'servicio';
    let kEntry: KardexEntry | undefined = undefined;
    if (isPhysical && newProd.stock > 0) {
      kEntry = buildKardexEntry({
        product: newProd,
        type: 'ajuste_manual',
        quantityChange: newProd.stock,
        previousStock: 0,
        newStock: newProd.stock,
        unitCostUSD: newProd.costUSD || 0,
        valuationMethod: (newProd.batches && newProd.batches.length > 0) ? 'fifo' : 'average_cost',
        reference: 'ALTA-PRODUCTO',
        notes: 'Stock inicial al registrar producto en catálogo',
        userName: googleUser?.name
      });
    }

    try {
      await saveProductWithKardexAtomic(uid, newProd, kEntry);
      setProducts(prev => [newProd, ...prev.filter(p => p.id !== newProd.id)]);
      if (kEntry) setKardex(prev => [kEntry!, ...prev]);
      notifyUser('success', 'Producto guardado', `"${newProd.name}" sincronizado en inventario.`);
    } catch (e) {
      notifyError(e, 'No se pudo guardar el producto');
      throw e;
    }
  };

  const updateProduct = async (updated: Product): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para actualizar productos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    const prevProd = products.find(p => p.id === updated.id);

    const isPhysical = !updated.isService && updated.itemType !== 'servicio';
    let kEntry: KardexEntry | undefined = undefined;
    if (isPhysical && prevProd && round2(prevProd.stock) !== round2(updated.stock)) {
      const diff = round2(updated.stock - prevProd.stock);
      kEntry = buildKardexEntry({
        product: updated,
        type: 'ajuste_manual',
        quantityChange: diff,
        previousStock: prevProd.stock,
        newStock: updated.stock,
        unitCostUSD: updated.costUSD || prevProd.costUSD || 0,
        valuationMethod: (updated.batches && updated.batches.length > 0) ? 'fifo' : 'average_cost',
        reference: 'EDICION-PRODUCTO',
        notes: 'Ajuste de existencia desde ficha de producto',
        userName: googleUser?.name
      });
    }

    try {
      await saveProductWithKardexAtomic(uid, updated, kEntry);
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (kEntry) setKardex(prev => [kEntry!, ...prev]);
      notifyUser('success', 'Producto actualizado', `"${updated.name}" actualizado en la nube.`);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar el producto');
      throw e;
    }
  };

  const deleteProduct = async (id: string): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para eliminar productos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await deleteProductFromFirestore(uid, id);
      tombstonesRef.current.deletedProductIds = [
        ...(tombstonesRef.current.deletedProductIds || []),
        id
      ];
      setProducts(prev => prev.filter(p => p.id !== id));
      notifyUser('success', 'Producto eliminado', 'El producto fue eliminado de Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'Error al eliminar producto');
      throw e;
    }
  };

  const adjustStock = async (id: string, newStock: number): Promise<boolean> => {
    const uid = getActiveUid();
    if (!uid) {
      notifyError(new Error('Debes iniciar sesión con Google para ajustar el stock.'), 'Sesión requerida');
      return false;
    }
    const safeStock = Math.max(0, round2(newStock));
    try {
      await adjustProductStockInFirestore(uid, id, safeStock, {
        reference: 'AJUSTE-RAPIDO',
        notes: 'Ajuste manual (+/-) directo desde catálogo',
        userName: googleUser?.name
      });
      return true;
    } catch (e) {
      notifyError(e, 'No se pudo ajustar el stock');
      return false;
    }
  };

  const addQuickService = (serviceData: {
    name: string;
    category?: string;
    priceUSD: number;
    priceBsFixed?: number;
    priceCurrency?: 'USD' | 'Bs';
    quantity: number;
    isExemptFromIVA: boolean;
    notes?: string;
    saveToCatalog?: boolean;
  }) => {
    const uidSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 5);
    const hasFixedBs = typeof serviceData.priceBsFixed === 'number' && serviceData.priceBsFixed > 0;
    const serviceProduct: Product = {
      id: 'srv-' + uidSuffix,
      code: 'SRV-' + Date.now().toString().slice(-4),
      name: serviceData.name,
      category: serviceData.category || 'Servicios',
      costUSD: 0,
      priceUSD: serviceData.priceUSD,
      ...(serviceData.priceCurrency ? { priceCurrency: serviceData.priceCurrency } : {}),
      ...(hasFixedBs ? { priceBsFixed: round2(serviceData.priceBsFixed!) } : {}),
      stock: 999999,
      minStock: 0,
      isExemptFromIVA: serviceData.isExemptFromIVA,
      unit: 'servicio',
      itemType: 'servicio',
      isService: true,
      purchaseNote: serviceData.notes
    };
    if (serviceData.saveToCatalog) {
      setProducts(prev => [serviceProduct, ...prev]);
      const uid = getActiveUid();
      if (uid) {
        saveProductToFirestore(uid, serviceProduct).catch(e =>
          console.error('[PosVenecia Firestore] Error en addQuickService:', e)
        );
      }
    }
    addToCart(serviceProduct, serviceData.quantity);
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1, options?: { isExemptFromIVA?: boolean }) => {
    const effectiveUnitUSD = getProductPriceUSD(product, bcvRate, bcvEuroRate);
    const defaultExempt = typeof options?.isExemptFromIVA === 'boolean'
      ? options.isExemptFromIVA
      : isProductExempt(product);

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const nextQty = existing.quantity + quantity;
        const nextExempt = typeof options?.isExemptFromIVA === 'boolean'
          ? options.isExemptFromIVA
          : (typeof existing.isExemptFromIVA === 'boolean' ? existing.isExemptFromIVA : defaultExempt);
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                product,
                quantity: nextQty,
                unitPriceUSD: effectiveUnitUSD,
                totalUSD: round2(nextQty * effectiveUnitUSD),
                isExemptFromIVA: nextExempt
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity,
          unitPriceUSD: effectiveUnitUSD,
          totalUSD: round2(quantity * effectiveUnitUSD),
          isExemptFromIVA: defaultExempt
        }
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const next = prev.filter(item => item.product.id !== productId);
      if (next.length === 0) {
        setCartDiscount(null);
      }
      return next;
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
              totalUSD: round2(quantity * item.unitPriceUSD)
            }
          : item
      )
    );
  };

  const setCartItemExempt = (productId: string, isExemptFromIVA: boolean) => {
    if (!isExemptFromIVA && !applyIVA) {
      // If global IVA was disabled, enabling IVA on a specific item reactivates IVA
      // while keeping all other cart items exempt so no unintended tax is added.
      setApplyIVA(true);
      setCart(prev =>
        prev.map(item => ({
          ...item,
          isExemptFromIVA: item.product.id === productId ? false : true
        }))
      );
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, isExemptFromIVA }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscount(null);
  };

  // Ref for double-submit protection in POS checkout
  const isCompletingSaleRef = useRef(false);

  // Sales operations (Strict Firestore transactions BEFORE clearing cart or UI state)
  const completeSale = async (
    clientData: { name: string; rif: string; phone?: string; address?: string },
    paymentDetails: PaymentDetails,
    fiscalCorrelatives: { invoiceNumber: string; controlNumber: string }
  ): Promise<Sale> => {
    const uid = getActiveUid();
    if (!uid) {
      throw new Error('Debes tener una sesión de Google activa para registrar ventas en la nube.');
    }

    if (cart.length === 0) {
      throw new Error('El carrito de compras está vacío.');
    }

    if (!cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para iniciar la jornada y procesar ventas.');
    }

    const cleanInvoice = (fiscalCorrelatives?.invoiceNumber || '').trim().toUpperCase();
    const cleanControl = (fiscalCorrelatives?.controlNumber || '').trim().toUpperCase();

    if (!cleanInvoice) {
      throw new Error('Debe ingresar manualmente el Número de Factura físico antes de cobrar.');
    }
    if (!cleanControl) {
      throw new Error('Debe ingresar manualmente el Número de Control SENIAT físico antes de cobrar.');
    }

    const duplicateInvoice = sales.some(
      s => (s.invoiceNumber || '').trim().toUpperCase() === cleanInvoice
    );
    if (duplicateInvoice) {
      throw new Error(`El Número de Factura "${cleanInvoice}" ya fue registrado anteriormente. Verifique su talonario.`);
    }

    const duplicateControl = sales.some(
      s => (s.controlNumber || '').trim().toUpperCase() === cleanControl
    );
    if (duplicateControl) {
      throw new Error(`El Número de Control SENIAT "${cleanControl}" ya fue registrado anteriormente. Verifique su talonario.`);
    }

    if (isCompletingSaleRef.current) {
      if (import.meta.env.DEV) console.warn('[PosVenecia] Intento de venta concurrente bloqueado (double-submit protection).');
      throw new Error('Ya se está procesando una venta. Espere un momento.');
    }
    isCompletingSaleRef.current = true;

    try {
      const fiscalTotals = calculateCartFiscalTotals({
        cart,
        bcvRate,
        applyIVA,
        applyIGTF,
        paymentMethod: paymentDetails.method,
        combinedUsdCash: paymentDetails.combinedBreakdown?.usdCash || 0,
        discount: cartDiscount
      });

      const {
        grossSubtotalUSD,
        discountUSD,
        subtotalUSD,
        exemptUSD,
        taxableUSD,
        ivaUSD,
        igtfUSD,
        totalUSD,
        grossSubtotalBs,
        discountBs,
        discountCurrency,
        subtotalBs,
        exemptBs,
        taxableBs,
        ivaBs,
        igtfBs,
        totalBs
      } = fiscalTotals;

      const hasGlobalDiscount = discountUSD > 0 || discountBs > 0;

      const snapshotItems: CartItem[] = cart.map(item => {
        const effectiveExempt = isCartItemExempt(item, applyIVA);
        return {
          ...item,
          isExemptFromIVA: effectiveExempt,
          product: {
            ...item.product,
            isExemptFromIVA: effectiveExempt
          }
        };
      });

      const newSale: Sale = {
        id: 'sale-' + Date.now(),
        date: new Date().toISOString(),
        invoiceNumber: cleanInvoice,
        controlNumber: cleanControl,
        clientName: clientData.name || 'Consumidor Final',
        clientRIF: clientData.rif || 'V-00000000',
        clientPhone: clientData.phone,
        clientAddress: clientData.address,
        items: snapshotItems,
        subtotalUSD,
        ...(hasGlobalDiscount
          ? {
              grossSubtotalUSD,
              discountUSD,
              grossSubtotalBs,
              discountBs,
              discountCurrency,
              ...(cartDiscount?.reason ? { discountReason: cartDiscount.reason } : {})
            }
          : {}),
        exemptUSD,
        taxableUSD,
        ivaUSD,
        igtfUSD,
        totalUSD,
        bcvRate,
        subtotalBs,
        exemptBs,
        taxableBs,
        ivaBs,
        igtfBs,
        totalBs,
        paymentMethod: paymentDetails.method,
        paymentDetails,
        status: 'completada',
        returnedQuantities: {},
        cashierName: googleUser?.name || `Caja ${terminalId}`,
        syncStatus: 'pending_sync'
      };

      const deductionMap = new Map<string, number>();
      snapshotItems.forEach(item => {
        if (!item.product.isService && item.product.itemType !== 'servicio' && item.product.id) {
          const cur = deductionMap.get(item.product.id) || 0;
          deductionMap.set(item.product.id, cur + item.quantity);
        }
      });

      const stockDeductions = Array.from(deductionMap.entries()).map(([productId, quantity]) => ({
        productId,
        quantity
      }));

      let createdFiado: FiadoRecord | undefined = undefined;
      if (paymentDetails.method === 'fiao' || (paymentDetails.method === 'pago_combinado' && (paymentDetails.combinedBreakdown?.fiaoRemaining || 0) > 0)) {
        const remainingDebt = round2(
          paymentDetails.method === 'fiao'
            ? (paymentDetails.fiaoRemainingUSD ?? totalUSD)
            : (paymentDetails.combinedBreakdown?.fiaoRemaining || 0)
        );
        const initialAbonoUSD = paymentDetails.method === 'fiao' ? round2(paymentDetails.fiaoInitialAbonoUSD || 0) : 0;
        const initialAbonoBs = paymentDetails.method === 'fiao'
          ? round2(paymentDetails.fiaoInitialAbonoBs || initialAbonoUSD * bcvRate)
          : 0;

        const initialAbonos: Abono[] = initialAbonoUSD > 0
          ? [{
              id: 'abono-ini-' + Date.now(),
              date: newSale.date,
              amountUSD: initialAbonoUSD,
              amountBs: initialAbonoBs,
              bcvRate,
              paymentMethod: paymentDetails.fiaoInitialAbonoCurrency === 'Bs' ? 'efectivo_bs' : 'efectivo_usd',
              notes: 'Abono inicial al momento de la venta'
            }]
          : [];

        createdFiado = {
          id: 'fiado-' + Date.now(),
          saleId: newSale.id,
          invoiceNumber: newSale.invoiceNumber,
          clientName: clientData.name,
          clientCI: clientData.rif.replace(/\D/g, '') || clientData.rif,
          clientPhone: clientData.phone || '0414-0000000',
          clientAddress: clientData.address,
          date: newSale.date,
          originalDebtUSD: paymentDetails.method === 'fiao' ? totalUSD : remainingDebt,
          remainingDebtUSD: remainingDebt,
          status: remainingDebt <= 0.009 ? 'saldado' : (initialAbonoUSD > 0 ? 'parcial' : 'pendiente'),
          abonos: initialAbonos
        };
      }

      // Atomic Cloud Firestore transaction under users/{uid}/... BEFORE clearing cart
      const defaultBank = getDefaultTreasuryBank();
      const confirmedSale = await saveSaleAtomic(
        uid,
        newSale,
        stockDeductions,
        bcvRate,
        baseCurrency,
        createdFiado,
        {
          defaultBsBankAccountId: defaultBank.id,
          defaultBsBankAccountName: defaultBank.name
        }
      );

      setSales(prev => [confirmedSale, ...prev.filter(s => s.id !== confirmedSale.id)]);
      if (createdFiado) {
        setFiados(prev => [createdFiado!, ...prev.filter(f => f.id !== createdFiado!.id)]);
      }
      setLastCompletedSale(confirmedSale);
      clearCart();
      return confirmedSale;
    } catch (e) {
      const msg = notifyError(e, 'No se pudo procesar la venta');
      throw new Error(msg);
    } finally {
      isCompletingSaleRef.current = false;
    }
  };

  const cancelSale = async (saleId: string): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para anular facturas.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }

    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale || targetSale.status === 'anulada') return;

    const associatedFiado = fiados.find(f => f.saleId === saleId);
    const defaultBank = getDefaultTreasuryBank();

    try {
      await cancelSaleAtomic(uid, saleId, associatedFiado?.id, googleUser?.name, {
        defaultBsBankAccountId: defaultBank.id,
        defaultBsBankAccountName: defaultBank.name
      });
      tombstonesRef.current.canceledSaleIds = [
        ...(tombstonesRef.current.canceledSaleIds || []),
        saleId
      ];
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'anulada' } : s));
      notifyUser('success', 'Factura anulada', `La factura ${targetSale.invoiceNumber} fue anulada y el inventario reintegrado.`);
    } catch (e) {
      notifyError(e, 'No se pudo anular la factura');
      throw e;
    }
  };

  const updateSale = async (updatedSale: Sale): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para actualizar ventas.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await updateSaleInFirestore(uid, updatedSale);
      setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
      setLastCompletedSale(prev => prev?.id === updatedSale.id ? updatedSale : prev);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar la venta');
      throw e;
    }
  };

  const deleteSale = (saleId: string, restoreStock: boolean = false) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return;

    const uid = getActiveUid();

    if (restoreStock && targetSale.status === 'completada') {
      const restorationMap = new Map<string, number>();
      targetSale.items.forEach(item => {
        if (!item.product.isService && item.product.itemType !== 'servicio' && item.product.id) {
          restorationMap.set(item.product.id, (restorationMap.get(item.product.id) || 0) + item.quantity);
        }
      });

      if (restorationMap.size > 0) {
        const updatedProducts = products.map(p => {
          const qty = restorationMap.get(p.id);
          if (!qty) return p;
          const restoredBatches = restoreFifoBatches(p.batches, qty, p, `DEL-${targetSale.invoiceNumber}`);
          return {
            ...p,
            stock: round2(p.stock + qty),
            ...(restoredBatches !== undefined ? { batches: restoredBatches } : {})
          };
        });
        setProducts(updatedProducts);
        if (uid) {
          updatedProducts.forEach(p => {
            if (restorationMap.has(p.id)) {
              saveProductToFirestore(uid, p).catch(() => {});
            }
          });
        }
      }
    }

    tombstonesRef.current.canceledSaleIds = [
      ...(tombstonesRef.current.canceledSaleIds || []),
      saleId
    ];
    setSales(prev => prev.filter(s => s.id !== saleId));
    setLastCompletedSale(prev => prev?.id === saleId ? null : prev);

    if (uid) {
      deleteSaleFromFirestore(uid, saleId).catch(e => console.error('Firestore deleteSale error:', e));
    }
  };

  const deleteCreditNote = (id: string) => {
    setCreditNotes(prev => prev.filter(nc => nc.id !== id));
    const uid = getActiveUid();
    if (uid) {
      deleteCreditNoteFromFirestore(uid, id).catch(e => console.error('Firestore deleteCreditNote error:', e));
    }
  };

  const deleteInventoryDischarge = (id: string) => {
    setInventoryDischarges(prev => prev.filter(d => d.id !== id));
    const uid = getActiveUid();
    if (uid) {
      deleteInventoryDischargeFromFirestore(uid, id).catch(e => console.error('Firestore deleteInventoryDischarge error:', e));
    }
  };

  const isCreatingCreditNoteRef = useRef(false);

  const createCreditNote = async (data: {
    saleId: string;
    reason: string;
    refundMethod: PaymentMethod;
    items: { productId: string; quantity: number }[];
    creditNoteNumber: string;
    controlNumber: string;
    originalInvoiceNumber?: string;
    originalControlNumber?: string;
  }): Promise<CreditNote> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para emitir notas de crédito.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }

    if (isCreatingCreditNoteRef.current) {
      throw new Error('Ya se está procesando una nota de crédito. Espere un momento.');
    }
    isCreatingCreditNoteRef.current = true;

    try {
      const originalSale = sales.find(s => s.id === data.saleId);
      if (!originalSale) {
        throw new Error('Venta no encontrada.');
      }

      if (originalSale.status === 'anulada') {
        throw new Error('No se puede emitir una nota de crédito sobre una factura anulada.');
      }

      if (data.items.length === 0) {
        throw new Error('Debe seleccionar al menos un producto para la devolución.');
      }

      const cleanNCNumber = (data.creditNoteNumber || '').trim().toUpperCase();
      const cleanNCControl = (data.controlNumber || '').trim().toUpperCase();
      const cleanAffectedInvoice = (data.originalInvoiceNumber ?? originalSale.invoiceNumber ?? '').trim().toUpperCase();
      const cleanAffectedControl = (data.originalControlNumber ?? originalSale.controlNumber ?? '').trim().toUpperCase();

      if (!cleanNCNumber) {
        throw new Error('Debe ingresar manualmente el Número de Nota de Crédito físico.');
      }
      if (!cleanNCControl) {
        throw new Error('Debe ingresar manualmente el Número de Control SENIAT de la Nota de Crédito.');
      }
      if (!cleanAffectedInvoice) {
        throw new Error('Debe ingresar el Número de Factura afectada.');
      }
      if (!cleanAffectedControl) {
        throw new Error('Debe ingresar el Número de Control fiscal de la factura afectada.');
      }

      const defaultBank = getDefaultTreasuryBank();
      const createdNC = await saveCreditNoteAtomic(uid, {
        creditNoteId: 'nc-' + Date.now(),
        saleId: originalSale.id,
        reason: data.reason,
        refundMethod: data.refundMethod,
        items: data.items,
        creditNoteNumber: cleanNCNumber,
        controlNumber: cleanNCControl,
        originalInvoiceNumber: cleanAffectedInvoice,
        originalControlNumber: cleanAffectedControl,
        fallbackBcvRate: bcvRate,
        cashierName: googleUser?.name || 'Cajero',
        treasuryBankAccountId: originalSale.paymentDetails?.treasuryBankAccountId || defaultBank.id,
        treasuryBankAccountName: defaultBank.name
      });

      setCreditNotes(prev => [createdNC, ...prev.filter(n => n.id !== createdNC.id)]);
      setLastCompletedCreditNote(createdNC);
      notifyUser('success', 'Nota de crédito emitida', `Comprobante ${createdNC.creditNoteNumber} registrado e inventario actualizado.`);
      return createdNC;
    } catch (e) {
      const msg = notifyError(e, 'No se pudo emitir la Nota de Crédito');
      throw new Error(msg);
    } finally {
      isCreatingCreditNoteRef.current = false;
    }
  };

  const isCreatingDischargeRef = useRef(false);

  const createInventoryDischarge = async (data: {
    productId: string;
    quantity: number;
    reason: InventoryDischargeReason;
    notes?: string;
    responsibleName?: string;
  }): Promise<InventoryDischarge> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para desincorporar inventario.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }

    if (isCreatingDischargeRef.current) {
      throw new Error('Ya se está procesando una salida de inventario. Espere un momento.');
    }
    isCreatingDischargeRef.current = true;

    try {
      const product = products.find(p => p.id === data.productId);
      if (!product) {
        throw new Error('Producto no encontrado en inventario.');
      }

      const qty = Math.max(1, Math.floor(data.quantity));
      if (product.stock < qty) {
        throw new Error(`Stock insuficiente. Solo quedan ${product.stock} unidades de ${product.name}.`);
      }

      const unitCostUSD = (product.costUSD && product.costUSD > 0) ? product.costUSD : product.priceUSD;
      const totalCostUSD = round2(unitCostUSD * qty);
      const totalCostBs = round2(totalCostUSD * bcvRate);

      const discPrefix = `SAL-${terminalId}-`;
      const seq = getNextSequenceNumber(inventoryDischarges.map(d => d.dischargeNumber), discPrefix);
      const dischargeNumber = `SAL-${terminalId}-${String(seq).padStart(5, '0')}`;

      const discharge: InventoryDischarge = {
        id: 'disc-' + Date.now(),
        dischargeNumber,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        category: product.category,
        quantity: qty,
        unitCostUSD,
        totalLossUSD: totalCostUSD,
        totalLossBs: totalCostBs,
        bcvRate,
        reason: data.reason,
        notes: data.notes,
        responsibleName: data.responsibleName || googleUser?.name || 'Encargado',
        date: new Date().toISOString()
      };

      const category: GastoOperativoCategory = data.reason === 'Uso Interno'
        ? 'Uso Interno'
        : 'Pérdida por Merma / Vencimiento';

      const lossExpense: GastoOperativo = {
        id: 'gasto-merma-' + Date.now(),
        concept: `[Salida ${discharge.dischargeNumber}] ${data.reason}: ${qty}x ${product.name} ${data.notes ? `(${data.notes})` : ''}`.trim(),
        category,
        type: 'eventual',
        month: new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }),
        date: new Date().toISOString(),
        dueDate: getLocalDateStr(),
        amountUSD: totalCostUSD,
        bcvRate,
        amountBs: totalCostBs,
        status: 'pagado',
        paymentDate: new Date().toISOString(),
        paymentMethod: 'efectivo_usd',
        reference: discharge.dischargeNumber,
        notes: `Generado automáticamente por desincorporación de stock (${data.reason})`
      };

      await saveInventoryDischargeAtomic(uid, discharge, lossExpense, bcvRate, baseCurrency);

      setInventoryDischarges(prev => [discharge, ...prev.filter(d => d.id !== discharge.id)]);
      setGastosOperativos(prev => [lossExpense, ...prev.filter(g => g.id !== lossExpense.id)]);
      setLastCompletedDischarge(discharge);
      notifyUser('success', 'Salida registrada', `Comprobante ${discharge.dischargeNumber} sincronizado en inventario.`);
      return discharge;
    } catch (e) {
      const msg = notifyError(e, 'No se pudo desincorporar el inventario');
      throw new Error(msg);
    } finally {
      isCreatingDischargeRef.current = false;
    }
  };

  // Expenses & Purchases operations (Transactional & zero-loss)
  const addExpense = async (expData: Omit<Expense, 'id'>): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar compras o facturas.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }

    const isCreditPurchase = expData.paymentMethod === 'credito';
    if (!isCreditPurchase && !cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para registrar compras o egresos en efectivo.');
    }

    const matchedSup = matchSupplierRecord(suppliers, expData.supplierId, expData.supplierRIF, expData.supplierName);
    const nowMs = Date.now();
    const newExp: Expense = {
      ...expData,
      id: 'exp-' + nowMs,
      supplierId: expData.supplierId || matchedSup?.id,
      amountUSD: round2(expData.amountUSD),
      amountBs: round2(expData.amountBs),
      baseImponibleBs: round2(expData.baseImponibleBs),
      ivaBs: round2(expData.ivaBs),
      retencionIVABs: round2(expData.retencionIVABs),
      retencionISLRBs: round2(expData.retencionISLRBs)
    };

    let linkedCuenta: CuentaPorPagar | undefined = undefined;
    if (isCreditPurchase) {
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + (matchedSup?.creditDays || 15));
      const cuentaCategory: CuentaPorPagar['category'] =
        newExp.category === 'Servicios' || newExp.category === 'Alquiler' || newExp.category === 'Mantenimiento'
          ? newExp.category
          : (newExp.category === 'Mercancía' ? 'Mercancía' : 'Otros');

      linkedCuenta = {
        id: 'cpp-' + nowMs,
        supplierId: newExp.supplierId,
        supplierName: newExp.supplierName,
        supplierRIF: newExp.supplierRIF,
        supplierPhone: newExp.supplierPhone,
        invoiceNumber: newExp.invoiceNumber,
        controlNumber: newExp.controlNumber,
        date: newExp.date,
        dueDate: newExp.dueDate || defaultDue.toISOString(),
        category: cuentaCategory,
        description: newExp.description || `Factura a Crédito ${newExp.invoiceNumber}`,
        totalAmountUSD: round2(newExp.amountUSD),
        paidAmountUSD: 0,
        remainingUSD: round2(newExp.amountUSD),
        status: 'pendiente',
        notes: 'Generado automáticamente desde Libro de Compras (Factura a Crédito)',
        abonos: []
      };
      newExp.linkedCuentaId = linkedCuenta.id;
    }

    try {
      const defaultBank = getDefaultTreasuryBank();
      if ((newExp.items && newExp.items.length > 0) || linkedCuenta) {
        await saveExpenseWithInventoryAtomic(
          uid,
          newExp,
          newExp.bcvRate || bcvRate,
          baseCurrency,
          linkedCuenta,
          googleUser?.name,
          defaultBank.id
        );
      } else {
        await saveExpenseToFirestore(uid, newExp, {
          defaultBsBankAccountId: defaultBank.id,
          createdBy: googleUser?.name
        });
      }
      setExpenses(prev => [newExp, ...prev.filter(e => e.id !== newExp.id)]);
      if (linkedCuenta) {
        setCuentasPorPagar(prev => [linkedCuenta!, ...prev.filter(c => c.id !== linkedCuenta!.id)]);
      }
      notifyUser('success', 'Factura registrada', `Comprobante ${newExp.invoiceNumber} sincronizado en Cloud Firestore.`);
    } catch (e) {
      notifyError(e, 'No se pudo guardar la factura');
      throw e;
    }
  };

  const updateExpense = async (updated: Expense): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para editar facturas.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await saveExpenseToFirestore(uid, updated);
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
      notifyUser('success', 'Factura actualizada', `Comprobante ${updated.invoiceNumber} actualizado en la nube.`);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar la factura');
      throw e;
    }
  };

  const deleteExpense = (id: string) => {
    tombstonesRef.current.deletedExpenseIds = [
      ...(tombstonesRef.current.deletedExpenseIds || []),
      id
    ];
    setExpenses(prev => prev.filter(e => e.id !== id));
    const uid = getActiveUid();
    if (uid) {
      deleteExpenseFromFirestore(uid, id).catch(e => {
        console.error('Firestore deleteExpense error:', e);
        notifyError(e, 'Error al eliminar factura');
      });
    }
  };

  // Fiados operations (Transactional)
  const addAbonoToFiado = async (
    fiadoId: string,
    amountUSD: number,
    method: PaymentMethod,
    reference?: string,
    notes?: string,
    options?: { bankAccountId?: string; bankAccountLabel?: string }
  ): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar abonos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      const defaultBank = getDefaultTreasuryBank();
      await addAbonoToFiadoTransaction(uid, fiadoId, amountUSD, method, bcvRate, reference, notes, {
        bankAccountId: options?.bankAccountId,
        bankAccountLabel: options?.bankAccountLabel,
        defaultBsBankAccountId: defaultBank.id,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Abono registrado', 'Pago aplicado a la cuenta por cobrar y acreditado en Tesorería.');
    } catch (e) {
      notifyError(e, 'No se pudo registrar el abono');
      throw e;
    }
  };

  const createManualFiado = (data: {
    clientName: string;
    clientCI: string;
    clientPhone: string;
    debtUSD: number;
    notes?: string
  }) => {
    const newFiado: FiadoRecord = {
      id: 'fiado-' + Date.now(),
      saleId: 'manual-' + Date.now(),
      invoiceNumber: `FIA-${Date.now().toString().slice(-4)}`,
      clientName: data.clientName,
      clientCI: data.clientCI,
      clientPhone: data.clientPhone,
      date: new Date().toISOString(),
      originalDebtUSD: data.debtUSD,
      remainingDebtUSD: data.debtUSD,
      notes: data.notes,
      status: 'pendiente',
      abonos: []
    };
    setFiados(prev => [newFiado, ...prev]);
    const uid = getActiveUid();
    if (uid) {
      saveFiadoToFirestore(uid, newFiado).catch(e => console.error('Firestore createManualFiado error:', e));
    }
  };

  // Maestro de Proveedores CRUD
  const addSupplier = async (
    data: Omit<Supplier, 'id' | 'createdAt' | 'accumulatedBalanceUSD'> & { accumulatedBalanceUSD?: number }
  ): Promise<Supplier> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar proveedores.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    const newSup: Supplier = {
      ...data,
      id: 'sup-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      creditDays: Math.max(0, Math.floor(Number(data.creditDays) || 0)),
      accumulatedBalanceUSD: round2(Number(data.accumulatedBalanceUSD) || 0),
      createdAt: new Date().toISOString()
    };
    const syncedBalance = computeSupplierAccumulatedBalance(newSup, cuentasPorPagar);
    if (syncedBalance > 0 && newSup.accumulatedBalanceUSD === 0) {
      newSup.accumulatedBalanceUSD = syncedBalance;
    }
    try {
      await saveSupplierToFirestore(uid, newSup);
      setSuppliers(prev => [newSup, ...prev.filter(s => s.id !== newSup.id)].sort((a, b) => a.name.localeCompare(b.name)));
      notifyUser('success', 'Proveedor registrado', `"${newSup.name}" guardado en Cloud Firestore.`);
      return newSup;
    } catch (e) {
      notifyError(e, 'No se pudo guardar el proveedor');
      throw e;
    }
  };

  const updateSupplier = async (updated: Supplier): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para actualizar proveedores.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await updateSupplierInFirestore(uid, updated);
      setSuppliers(prev =>
        prev.map(s => (s.id === updated.id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name))
      );
      notifyUser('success', 'Proveedor actualizado', `"${updated.name}" actualizado en Cloud Firestore.`);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar el proveedor');
      throw e;
    }
  };

  const deleteSupplier = async (id: string): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para eliminar proveedores.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await deleteSupplierFromFirestore(uid, id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      notifyUser('success', 'Proveedor eliminado', 'El proveedor fue eliminado de Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el proveedor');
      throw e;
    }
  };

  // Cuentas por Pagar (Proveedores)
  const addCuentaPorPagar = (data: Omit<CuentaPorPagar, 'id' | 'paidAmountUSD' | 'remainingUSD' | 'status' | 'abonos'>) => {
    const matchedSup = matchSupplierRecord(suppliers, data.supplierId, data.supplierRIF, data.supplierName);
    const newCuenta: CuentaPorPagar = {
      ...data,
      supplierId: data.supplierId || matchedSup?.id,
      id: 'cpp-' + Date.now(),
      paidAmountUSD: 0,
      remainingUSD: data.totalAmountUSD,
      status: 'pendiente',
      abonos: []
    };
    const nextCuentas = [newCuenta, ...cuentasPorPagar];
    setCuentasPorPagar(nextCuentas);

    let updatedSupplier: Supplier | undefined = undefined;
    if (matchedSup) {
      updatedSupplier = {
        ...matchedSup,
        accumulatedBalanceUSD: computeSupplierAccumulatedBalance(matchedSup, nextCuentas)
      };
      setSuppliers(prev => prev.map(s => s.id === updatedSupplier!.id ? updatedSupplier! : s));
    }

    const uid = getActiveUid();
    if (uid) {
      saveCuentaPorPagarToFirestore(uid, newCuenta, updatedSupplier).catch(e => console.error('Firestore addCuentaPorPagar error:', e));
    }
  };

  const updateCuentaPorPagar = (updated: CuentaPorPagar) => {
    const matchedSup = matchSupplierRecord(suppliers, updated.supplierId, updated.supplierRIF, updated.supplierName);
    const nextCuenta = matchedSup && !updated.supplierId ? { ...updated, supplierId: matchedSup.id } : updated;
    const nextCuentas = cuentasPorPagar.map(c => c.id === nextCuenta.id ? nextCuenta : c);
    setCuentasPorPagar(nextCuentas);

    let updatedSupplier: Supplier | undefined = undefined;
    if (matchedSup) {
      updatedSupplier = {
        ...matchedSup,
        accumulatedBalanceUSD: computeSupplierAccumulatedBalance(matchedSup, nextCuentas)
      };
      setSuppliers(prev => prev.map(s => s.id === updatedSupplier!.id ? updatedSupplier! : s));
    }

    const uid = getActiveUid();
    if (uid) {
      saveCuentaPorPagarToFirestore(uid, nextCuenta, updatedSupplier).catch(e => console.error('Firestore updateCuentaPorPagar error:', e));
    }
  };

  const deleteCuentaPorPagar = (id: string) => {
    const target = cuentasPorPagar.find(c => c.id === id);
    tombstonesRef.current.deletedCuentaIds = [
      ...(tombstonesRef.current.deletedCuentaIds || []),
      id
    ];
    const nextCuentas = cuentasPorPagar.filter(c => c.id !== id);
    setCuentasPorPagar(nextCuentas);

    let updatedSupplier: Supplier | undefined = undefined;
    if (target) {
      const matchedSup = matchSupplierRecord(suppliers, target.supplierId, target.supplierRIF, target.supplierName);
      if (matchedSup) {
        updatedSupplier = {
          ...matchedSup,
          accumulatedBalanceUSD: computeSupplierAccumulatedBalance(matchedSup, nextCuentas)
        };
        setSuppliers(prev => prev.map(s => s.id === updatedSupplier!.id ? updatedSupplier! : s));
      }
    }

    const uid = getActiveUid();
    if (uid) {
      deleteCuentaPorPagarFromFirestore(uid, id, updatedSupplier).catch(e => console.error('Firestore deleteCuentaPorPagar error:', e));
    }
  };

  const mapMethodToExpenseMethod = (m?: PaymentMethod): Expense['paymentMethod'] => {
    if (m === 'efectivo_usd' || m === 'efectivo_bs' || m === 'pago_movil' || m === 'debito' || m === 'transferencia') {
      return m;
    }
    return 'transferencia';
  };

  const addAbonoToCuentaPorPagar = async (
    cuentaId: string,
    amountUSD: number,
    method: PaymentMethod,
    reference?: string,
    notes?: string,
    options?: {
      bankAccountId?: string;
      bankAccountLabel?: string;
      enteredCurrency?: 'USD' | 'Bs';
      exactAmountBs?: number;
      bankFeeAmount?: number;
    }
  ): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar abonos a proveedores.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      const defaultBank = getDefaultTreasuryBank();
      await addAbonoToCuentaPorPagarTransaction(uid, cuentaId, amountUSD, method, bcvRate, reference, notes, {
        ...options,
        defaultBsBankAccountId: defaultBank.id,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Abono registrado', 'Pago a proveedor y débito en Tesorería guardados en Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo registrar el abono al proveedor');
      throw e;
    }
  };

  // Gastos Operativos del Mes (Alquiler, Servicios, Insumos, Sueldo Propietario, Retiros Personales)
  const addGastoOperativo = (data: Omit<GastoOperativo, 'id'>) => {
    const nowIso = new Date().toISOString();
    const isPaidNow = data.status === 'pagado';
    const rate = data.bcvRate || bcvRate;
    const paidUSD = isPaidNow ? round2(data.amountUSD) : round2(data.paidAmountUSD || 0);
    const exactPaidBs = isPaidNow
      ? (data.enteredCurrency === 'Bs' && data.amountBs > 0 ? round2(data.amountBs) : round2(paidUSD * rate))
      : 0;
    const remainingUSD = isPaidNow ? 0 : round2(Math.max(0, data.amountUSD - paidUSD));
    const isNonFiscal = isNonFiscalPersonalOrSalaryCategory(data.category);
    const accountingType = getExpenseAccountingType(data.category);
    const bankFeeAmount = typeof data.bankFeeAmount === 'number' && data.bankFeeAmount > 0 ? round2(data.bankFeeAmount) : undefined;
    const bankFeeCurrency = bankFeeAmount ? (data.bankFeeCurrency || 'Bs') : undefined;

    const initialAbonos: Abono[] = isPaidNow
      ? [
          {
            id: 'abono-gasto-' + Date.now(),
            date: data.paymentDate || nowIso,
            amountUSD: paidUSD,
            amountBs: exactPaidBs,
            bcvRate: rate,
            enteredCurrency: data.enteredCurrency || (data.paymentMethod === 'efectivo_bs' ? 'Bs' : 'USD'),
            paymentMethod: data.paymentMethod || 'pago_movil',
            bankAccountId: data.bankAccountId,
            bankAccountLabel: data.bankAccountLabel,
            treasuryAccountId: data.treasuryAccountId || data.bankAccountId,
            bankFeeAmount,
            bankFeeCurrency,
            reference: data.reference,
            notes: 'Pago completo al registrar el movimiento'
          }
        ]
      : (data.abonos || []);

    const newGasto: GastoOperativo = {
      ...data,
      id: 'gasto-' + Date.now(),
      amountUSD: round2(data.amountUSD),
      amountBs: data.enteredCurrency === 'Bs' && data.amountBs > 0 ? round2(data.amountBs) : round2(data.amountUSD * rate),
      paidAmountUSD: paidUSD,
      remainingUSD,
      bankFeeAmount,
      bankFeeCurrency,
      status: remainingUSD <= 0.009 ? 'pagado' : (paidUSD > 0 ? 'parcial' : 'pendiente'),
      abonos: initialAbonos
    };

    setGastosOperativos(prev => [newGasto, ...prev]);

    let cashOutflowExpense: Expense | undefined = undefined;
    if (isPaidNow && (paidUSD > 0 || exactPaidBs > 0)) {
      cashOutflowExpense = {
        id: 'exp-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        date: data.paymentDate || nowIso,
        invoiceNumber: data.invoiceNumber || (isNonFiscal ? 'INT-CAJA' : 'REC-GASTO'),
        controlNumber: '00-00000',
        supplierName: data.supplierName || data.concept,
        supplierRIF: data.supplierRIF || 'N/A',
        supplierPhone: data.supplierPhone,
        description: `${data.category}: ${data.concept}${data.notes ? ` (${data.notes})` : ''}`,
        category: mapGastoCategoryToExpenseCategory(data.category),
        amountUSD: paidUSD,
        amountBs: exactPaidBs,
        baseImponibleBs: isNonFiscal ? 0 : exactPaidBs,
        ivaBs: 0,
        retencionIVABs: 0,
        retencionISLRBs: 0,
        bcvRate: rate,
        enteredCurrency: data.enteredCurrency || (data.paymentMethod === 'efectivo_bs' ? 'Bs' : 'USD'),
        paymentMethod: mapMethodToExpenseMethod(data.paymentMethod),
        bankAccountId: data.bankAccountId,
        bankAccountLabel: data.bankAccountLabel,
        treasuryAccountId: data.treasuryAccountId || data.bankAccountId,
        bankFeeAmount,
        bankFeeCurrency,
        excludeFromLibroCompras: isNonFiscal,
        accountingType,
        reference: data.reference,
        linkedGastoId: newGasto.id
      };
      setExpenses(prev => [cashOutflowExpense!, ...prev]);
    }

    const uid = getActiveUid();
    if (uid) {
      const defaultBank = getDefaultTreasuryBank();
      if (cashOutflowExpense) {
        saveGastoWithCashOutflowAtomic(uid, newGasto, cashOutflowExpense, {
          defaultBsBankAccountId: defaultBank.id,
          createdBy: googleUser?.name
        }).catch(e =>
          console.error('Firestore addGastoOperativo atomic error:', e)
        );
      } else {
        saveGastoOperativoToFirestore(uid, newGasto).catch(e =>
          console.error('Firestore addGastoOperativo error:', e)
        );
      }
    }
  };

  const updateGastoOperativo = (updated: GastoOperativo) => {
    const paidUSD = Number((updated.paidAmountUSD ?? (updated.status === 'pagado' ? updated.amountUSD : 0)).toFixed(2));
    const remainingUSD = Number(Math.max(0, updated.amountUSD - paidUSD).toFixed(2));
    const normalizedStatus: GastoOperativo['status'] =
      remainingUSD <= 0.009 ? 'pagado' : (paidUSD > 0 ? 'parcial' : 'pendiente');

    const normalizedGasto: GastoOperativo = {
      ...updated,
      paidAmountUSD: paidUSD,
      remainingUSD,
      status: normalizedStatus
    };

    setGastosOperativos(prev => prev.map(g => g.id === normalizedGasto.id ? normalizedGasto : g));
    const uid = getActiveUid();
    if (uid) {
      saveGastoOperativoToFirestore(uid, normalizedGasto).catch(e => console.error('Firestore updateGastoOperativo error:', e));
    }
  };

  const deleteGastoOperativo = (id: string) => {
    tombstonesRef.current.deletedGastoIds = [
      ...(tombstonesRef.current.deletedGastoIds || []),
      id
    ];
    setGastosOperativos(prev => prev.filter(g => g.id !== id));
    const uid = getActiveUid();
    if (uid) {
      deleteGastoOperativoFromFirestore(uid, id).catch(e => console.error('Firestore deleteGastoOperativo error:', e));
    }
  };

  const markGastoOperativoPagado = async (
    id: string,
    paymentMethod: PaymentMethod,
    reference?: string,
    amountUSD?: number,
    notes?: string,
    options?: {
      bankAccountId?: string;
      bankAccountLabel?: string;
      enteredCurrency?: 'USD' | 'Bs';
      exactAmountBs?: number;
      bankFeeAmount?: number;
    }
  ): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar pagos de gastos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      const defaultBank = getDefaultTreasuryBank();
      await markGastoOperativoPagadoTransaction(uid, id, paymentMethod, bcvRate, reference, amountUSD, notes, {
        ...options,
        defaultBsBankAccountId: defaultBank.id,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Pago registrado', 'El pago y débito en Tesorería se sincronizaron en Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo registrar el pago del gasto');
      throw e;
    }
  };

  // Créditos y Préstamos por Pagar
  const addLoan = async (
    data: Omit<Loan, 'id' | 'paidAmountUSD' | 'paidAmountBs' | 'remainingUSD' | 'remainingBs' | 'status' | 'abonos' | 'createdAt'>
  ): Promise<Loan> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar créditos o préstamos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    if ((data.cashDestination === 'efectivo_usd' || data.cashDestination === 'efectivo_bs') && !cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para ingresar fondos de préstamo en efectivo a la gaveta.');
    }

    const nowIso = new Date().toISOString();
    const origUSD = round2(Math.max(0, Number(data.originalAmountUSD) || 0));
    const origBs = round2(Math.max(0, Number(data.originalAmountBs) || 0));

    const newLoan: Loan = {
      ...data,
      id: 'loan-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      originalAmountUSD: origUSD,
      originalAmountBs: origBs,
      paidAmountUSD: 0,
      paidAmountBs: 0,
      remainingUSD: origUSD,
      remainingBs: origBs,
      status: 'pendiente',
      abonos: [],
      createdAt: nowIso
    };

    try {
      const defaultBank = getDefaultTreasuryBank();
      await saveLoanToFirestore(uid, newLoan, {
        defaultBsBankAccountId: defaultBank.id,
        createdBy: googleUser?.name
      });
      setLoans(prev => [newLoan, ...prev.filter(l => l.id !== newLoan.id)]);
      notifyUser('success', 'Préstamo registrado', `"${newLoan.lenderName}" guardado y acreditado en Tesorería.`);
      return newLoan;
    } catch (e) {
      notifyError(e, 'No se pudo registrar el préstamo');
      throw e;
    }
  };

  const updateLoan = async (updated: Loan): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para actualizar préstamos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    if ((updated.cashDestination === 'efectivo_usd' || updated.cashDestination === 'efectivo_bs') && !cashShift?.isOpen) {
      // Allow editing metadata/dates safely even if cash closed; only recalculate balances cleanly
    }

    const origUSD = round2(Math.max(0, Number(updated.originalAmountUSD) || 0));
    const origBs = round2(Math.max(0, Number(updated.originalAmountBs) || 0));
    const paidUSD = round2(Math.max(0, Number(updated.paidAmountUSD) || 0));
    const paidBs = round2(Math.max(0, Number(updated.paidAmountBs) || 0));
    const remUSD = round2(Math.max(0, origUSD - paidUSD));
    const remBs = updated.enteredCurrency === 'Bs'
      ? round2(Math.max(0, origBs - paidBs))
      : round2(remUSD * (updated.bcvRate || bcvRate));
    const isSettled = updated.enteredCurrency === 'Bs' ? remBs <= 0.01 : remUSD <= 0.009;

    const normalized: Loan = {
      ...updated,
      originalAmountUSD: origUSD,
      originalAmountBs: origBs,
      paidAmountUSD: paidUSD,
      paidAmountBs: paidBs,
      remainingUSD: isSettled ? 0 : remUSD,
      remainingBs: isSettled ? 0 : remBs,
      status: isSettled ? 'pagado' : (paidUSD > 0 || paidBs > 0 ? 'parcial' : 'pendiente')
    };

    try {
      await updateLoanInFirestore(uid, normalized);
      setLoans(prev => prev.map(l => (l.id === normalized.id ? normalized : l)));
      notifyUser('success', 'Préstamo actualizado', `"${normalized.lenderName}" actualizado en Cloud Firestore.`);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar el préstamo');
      throw e;
    }
  };

  const deleteLoan = async (id: string): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para eliminar préstamos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await deleteLoanFromFirestore(uid, id);
      setLoans(prev => prev.filter(l => l.id !== id));
      notifyUser('success', 'Préstamo eliminado', 'El registro fue eliminado de Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el préstamo');
      throw e;
    }
  };

  const addAbonoToLoan = async (params: {
    loanId: string;
    amount: number;
    enteredCurrency: 'USD' | 'Bs';
    method: PaymentMethod | 'externo_dueno';
    reference?: string;
    notes?: string;
    bankAccountId?: string;
    bankAccountLabel?: string;
    bankFeeAmount?: number;
  }): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar abonos de préstamos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    if ((params.method === 'efectivo_usd' || params.method === 'efectivo_bs') && !cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para realizar abonos en efectivo.');
    }

    try {
      const defaultBank = getDefaultTreasuryBank();
      await addAbonoToLoanTransaction(uid, params.loanId, {
        amount: params.amount,
        enteredCurrency: params.enteredCurrency,
        method: params.method,
        bcvRate,
        reference: params.reference,
        notes: params.notes,
        bankAccountId: params.bankAccountId,
        bankAccountLabel: params.bankAccountLabel,
        defaultBsBankAccountId: defaultBank.id,
        bankFeeAmount: params.bankFeeAmount,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Abono registrado', 'Pago aplicado al préstamo y debitado de Tesorería.');
    } catch (e) {
      notifyError(e, 'No se pudo registrar el abono al préstamo');
      throw e;
    }
  };

  // Tesorería / Estado de Cuenta en Vivo
  const saveTreasuryAccount = async (
    account: Omit<TreasuryAccount, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
    options?: { recordInitialMovement?: boolean }
  ): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para gestionar cuentas de Tesorería.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    const nowIso = new Date().toISOString();
    const payload: TreasuryAccount = {
      ...account,
      createdAt: account.createdAt || nowIso,
      updatedAt: nowIso
    };
    try {
      await saveTreasuryAccountToFirestore(uid, payload, {
        recordInitialMovement: options?.recordInitialMovement,
        bcvRate,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Cuenta guardada', `"${payload.name}" sincronizada en Tesorería.`);
    } catch (e) {
      notifyError(e, 'No se pudo guardar la cuenta bancaria');
      throw e;
    }
  };

  const deleteTreasuryAccount = async (accountId: string): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para eliminar cuentas bancarias.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await deleteTreasuryAccountFromFirestore(uid, accountId);
      notifyUser('success', 'Cuenta eliminada', 'La cuenta bancaria fue eliminada de Tesorería.');
    } catch (e) {
      notifyError(e, 'No se pudo eliminar la cuenta');
      throw e;
    }
  };

  const transferBetweenTreasuryAccounts = async (params: {
    sourceAccountId: string;
    destinationAccountId: string;
    sourceAmount: number;
    exchangeRate?: number;
    bankFeeAmount?: number;
    reference?: string;
    notes?: string;
  }): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para transferir fondos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await transferBetweenTreasuryAccountsTransaction(uid, {
        ...params,
        bcvRate,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Transferencia registrada', 'Movimiento interno entre cuentas aplicado atómicamente.');
    } catch (e) {
      notifyError(e, 'No se pudo completar la transferencia');
      throw e;
    }
  };

  const adjustTreasuryAccountBalance = async (params: {
    accountId: string;
    newBalance: number;
    reason?: string;
    setAsInitialBalance?: boolean;
  }): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para ajustar saldos.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await adjustTreasuryAccountBalanceTransaction(uid, {
        ...params,
        bcvRate,
        createdBy: googleUser?.name
      });
      notifyUser('success', 'Saldo actualizado', 'Ajuste de saldo registrado en el extracto de Tesorería.');
    } catch (e) {
      notifyError(e, 'No se pudo ajustar el saldo');
      throw e;
    }
  };

  // Clientes Habituales
  const addClient = async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para registrar clientes.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    const newClient: Client = {
      ...clientData,
      id: 'cli-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    try {
      await saveClientToFirestore(uid, newClient);
      setClients(prev => [newClient, ...prev.filter(c => c.id !== newClient.id)]);
      notifyUser('success', 'Cliente guardado', `"${newClient.name}" sincronizado en Cloud Firestore.`);
      return newClient;
    } catch (e) {
      notifyError(e, 'No se pudo guardar el cliente');
      throw e;
    }
  };

  const updateClient = async (updated: Client): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para actualizar clientes.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await updateClientInFirestore(uid, updated);
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
      if (selectedClientForPOS?.id === updated.id) {
        setSelectedClientForPOS(updated);
      }
      notifyUser('success', 'Cliente actualizado', `"${updated.name}" actualizado en Cloud Firestore.`);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar el cliente');
      throw e;
    }
  };

  const deleteClient = async (id: string): Promise<void> => {
    const uid = getActiveUid();
    if (!uid) {
      const err = new Error('Debes iniciar sesión con Google para eliminar clientes.');
      notifyError(err, 'Sesión requerida');
      throw err;
    }
    try {
      await deleteClientFromFirestore(uid, id);
      tombstonesRef.current.deletedClientIds = [
        ...(tombstonesRef.current.deletedClientIds || []),
        id
      ];
      setClients(prev => prev.filter(c => c.id !== id));
      if (selectedClientForPOS?.id === id) {
        setSelectedClientForPOS(null);
      }
      notifyUser('success', 'Cliente eliminado', 'El cliente fue eliminado de Cloud Firestore.');
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el cliente');
      throw e;
    }
  };

  /**
   * Factory Reset: Arrancar de 0 limpiando todas las colecciones en Cloud Firestore del usuario actual
   */
  const factoryReset = async (_mode: 'clean_zero' | 'restore_demo' = 'clean_zero'): Promise<void> => {
    const uid = getActiveUid();
    if (uid) {
      try {
        await clearUserFirestoreCollections(uid);
      } catch (e) {
        notifyError(e, 'No se pudo completar el reinicio en Firestore');
        throw e;
      }
    }

    setProducts([]);
    setSales([]);
    setExpenses([]);
    setFiados([]);
    setClients([]);
    setCuentasPorPagar([]);
    setGastosOperativos([]);
    setSuppliers([]);
    setCreditNotes([]);
    setInventoryDischarges([]);
    setKardex([]);
    setLoans([]);
    setCashShift(null);
    setCashShiftHistory([]);
    setSelectedClientForPOS(null);
    setCart([]);
    setLastCompletedSale(null);
    setLastCompletedCreditNote(null);
    setLastCompletedDischarge(null);
    tombstonesRef.current = {
      deletedProductIds: [],
      canceledSaleIds: [],
      deletedClientIds: [],
      deletedExpenseIds: [],
      deletedCuentaIds: [],
      deletedGastoIds: []
    };
    notifyUser('info', 'Reinicio completado', 'Todas las colecciones operativas han sido reiniciadas en Cloud Firestore.');
  };

  return (
    <AppContext.Provider
      value={{
        bcvRate,
        updateBcvRate,
        rateHistory,
        fetchLiveRate,
        isFetchingLiveRate,
        bcvLastUpdatedDate,
        bcvLastUpdatedAt,
        isBcvRateUpdatedToday,
        bcvEuroRate,
        updateBcvEuroRate,
        fetchLiveEuroRate,
        isFetchingLiveEuroRate,
        commercialRoundingStep,
        rateChangeModalState,
        openRateRecalcModal,
        closeRateRecalcModal,
        applyCatalogPriceRecalculation,
        baseCurrency,
        setBaseCurrency,
        clients,
        addClient,
        updateClient,
        deleteClient,
        selectedClientForPOS,
        setSelectedClientForPOS,
        products,
        categories,
        addCategory,
        addProduct,
        addQuickService,
        updateProduct,
        deleteProduct,
        adjustStock,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        setCartItemExempt,
        cartDiscount,
        setCartDiscount,
        clearCart,
        applyIVA,
        setApplyIVA,
        applyIGTF,
        setApplyIGTF,
        sales,
        completeSale,
        cancelSale,
        updateSale,
        deleteSale,
        lastCompletedSale,
        setLastCompletedSale,
        creditNotes,
        createCreditNote,
        deleteCreditNote,
        isCreditNoteModalOpen,
        setIsCreditNoteModalOpen,
        selectedSaleForCreditNote,
        setSelectedSaleForCreditNote,
        lastCompletedCreditNote,
        setLastCompletedCreditNote,
        inventoryDischarges,
        createInventoryDischarge,
        deleteInventoryDischarge,
        isDischargeModalOpen,
        setIsDischargeModalOpen,
        selectedProductForDischarge,
        setSelectedProductForDischarge,
        lastCompletedDischarge,
        setLastCompletedDischarge,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        transactionsPreset,
        transactionsDateRange,
        isLoadingHistory,
        setTransactionsDateFilter,
        kardex,
        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        fiados,
        addAbonoToFiado,
        createManualFiado,
        cuentasPorPagar,
        addCuentaPorPagar,
        updateCuentaPorPagar,
        deleteCuentaPorPagar,
        addAbonoToCuentaPorPagar,
        gastosOperativos,
        addGastoOperativo,
        updateGastoOperativo,
        deleteGastoOperativo,
        markGastoOperativoPagado,
        loans,
        addLoan,
        updateLoan,
        deleteLoan,
        addAbonoToLoan,
        treasuryAccounts,
        treasuryMovements,
        saveTreasuryAccount,
        deleteTreasuryAccount,
        transferBetweenTreasuryAccounts,
        adjustTreasuryAccountBalance,
        firestoreSyncStatus,
        notification,
        dismissNotification,
        notifyUser,
        backupClosingToDrive: syncToGoogleDrive,
        getFullDatabasePayload,
        googleUser,
        isAuthLoading,
        isDriveSyncing,
        driveSyncStatus,
        lastDriveSyncTime,
        loginWithGoogle,
        logoutGoogle,
        renewGoogleSession,
        syncToGoogleDrive,
        reloadFromGoogleDrive,
        checkRemoteChangesForMultiDevice,
        restoreDatabase,
        isGoogleModalOpen,
        setIsGoogleModalOpen,
        terminalId,
        setTerminalId,
        cashShift,
        isCashRegisterOpen,
        cashShiftHistory,
        openCashShift,
        closeCashShift,
        isAperturaModalOpen,
        setIsAperturaModalOpen,
        isCierreModalOpen,
        setIsCierreModalOpen,
        isCuadreModalOpen,
        setIsCuadreModalOpen,
        isProfileModalOpen,
        setIsProfileModalOpen,
        activeTab,
        setActiveTab,
        appTheme,
        setAppTheme,
        businessInfo,
        updateBusinessInfo,
        managerPin,
        updateManagerPin,
        isOnline,
        missingRuleCollections,
        retryFirestoreSubscriptions,
        factoryReset
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
