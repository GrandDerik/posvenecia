import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Product,
  Sale,
  Expense,
  FiadoRecord,
  PaymentMethod,
  CartItem,
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
  CreditNote,
  CreditNoteItem,
  InventoryDischarge,
  InventoryDischargeReason,
  ProductBatch,
  Abono
} from '../types';
import { fetchLiveBCVRate, fetchLiveBCVEuroRate } from '../utils/bcvFetcher';
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
  saveSaleAtomic,
  cancelSaleAtomic,
  saveProductToFirestore,
  deleteProductFromFirestore,
  adjustProductStockInFirestore,
  saveExpenseToFirestore,
  deleteExpenseFromFirestore,
  saveFiadoToFirestore,
  saveClientToFirestore,
  deleteClientFromFirestore,
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
  saveCuentaWithCashOutflowAtomic,
  deleteSaleFromFirestore,
  restoreStoreDataToFirestore,
  clearUserFirestoreCollections
} from '../services/firestoreSyncService';

export type DriveSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated' | 'token_expired';
export type FirestoreSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
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
  // Realtime Cloud Database (Firebase Firestore)
  firestoreSyncStatus: FirestoreSyncStatus;
  backupClosingToDrive: () => Promise<boolean>;

  // BCV Rate (USD)
  bcvRate: number;
  updateBcvRate: (newRate: number) => void;
  rateHistory: { date: string; rate: number }[];
  fetchLiveRate: () => Promise<number>;
  isFetchingLiveRate: boolean;

  // BCV Rate (Euro)
  bcvEuroRate: number;
  updateBcvEuroRate: (newRate: number) => void;
  fetchLiveEuroRate: () => Promise<number>;
  isFetchingLiveEuroRate: boolean;

  // Base Currency (USD vs VED / Bolívares)
  baseCurrency: BaseCurrency;
  setBaseCurrency: (currency: BaseCurrency) => void;

  // Clientes Habituales
  clients: Client[];
  addClient: (clientData: Omit<Client, 'id' | 'createdAt'>) => Client;
  updateClient: (updated: Client) => void;
  deleteClient: (id: string) => void;
  selectedClientForPOS: Client | null;
  setSelectedClientForPOS: (client: Client | null) => void;

  // Products & Services
  products: Product[];
  categories: string[];
  addCategory: (newCategory: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, newStock: number) => boolean;
  addQuickService: (serviceData: {
    name: string;
    category?: string;
    priceUSD: number;
    quantity: number;
    isExemptFromIVA: boolean;
    notes?: string;
    saveToCatalog?: boolean;
  }) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyIVA: boolean;
  setApplyIVA: (apply: boolean) => void;
  applyIGTF: boolean;
  setApplyIGTF: (apply: boolean) => void;

  // Sales
  sales: Sale[];
  completeSale: (clientData: { name: string; rif: string; phone?: string; address?: string }, paymentDetails: PaymentDetails) => Sale;
  cancelSale: (saleId: string) => void;
  updateSale: (sale: Sale) => void;
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
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  updateExpense: (updated: Expense) => void;
  deleteExpense: (id: string) => void;

  // Fiados
  fiados: FiadoRecord[];
  addAbonoToFiado: (fiadoId: string, amountUSD: number, method: PaymentMethod, reference?: string, notes?: string) => void;
  createManualFiado: (data: { clientName: string; clientCI: string; clientPhone: string; debtUSD: number; notes?: string }) => void;

  // Cuentas por Pagar (Deudas a Proveedores)
  cuentasPorPagar: CuentaPorPagar[];
  addCuentaPorPagar: (data: Omit<CuentaPorPagar, 'id' | 'paidAmountUSD' | 'remainingUSD' | 'status' | 'abonos'>) => void;
  updateCuentaPorPagar: (updated: CuentaPorPagar) => void;
  deleteCuentaPorPagar: (id: string) => void;
  addAbonoToCuentaPorPagar: (cuentaId: string, amountUSD: number, method: PaymentMethod, reference?: string, notes?: string) => void;

  // Gastos Operativos del Mes (Alquiler, Servicios, Eventuales)
  gastosOperativos: GastoOperativo[];
  addGastoOperativo: (gasto: Omit<GastoOperativo, 'id'>) => void;
  updateGastoOperativo: (updated: GastoOperativo) => void;
  deleteGastoOperativo: (id: string) => void;
  markGastoOperativoPagado: (id: string, paymentMethod: PaymentMethod, reference?: string, amountUSD?: number, notes?: string) => void;

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
  openCashShift: (initialCashUSD: number, initialCashBs: number, notes?: string, initialBanks?: BankInitialBalance[]) => void;
  closeCashShift: (countedUSD: number, countedBs: number, notes?: string, countedBanks?: BankInitialBalance[]) => CashShift;
  isAperturaModalOpen: boolean;
  setIsAperturaModalOpen: (open: boolean) => void;
  isCierreModalOpen: boolean;
  setIsCierreModalOpen: (open: boolean) => void;
  isCuadreModalOpen: boolean;
  setIsCuadreModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  activeTab: 'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'contabilidad';
  setActiveTab: (tab: 'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'contabilidad') => void;

  // Theme Management
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;

  // Business Info
  businessInfo: BusinessInfo;
  updateBusinessInfo: (info: Partial<BusinessInfo>) => void;

  // Manager PIN
  managerPin: string;
  updateManagerPin: (newPin: string) => void;

  // Network Connectivity
  isOnline: boolean;

  // Factory Reset / Arrancar de 0
  factoryReset: (mode?: 'clean_zero' | 'restore_demo') => void;
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
  const [rateHistory, setRateHistory] = useState<{ date: string; rate: number }[]>(() => [
    { date: new Date().toISOString().split('T')[0], rate: INITIAL_BCV_RATE }
  ]);
  const [isFetchingLiveRate, setIsFetchingLiveRate] = useState(false);

  // BCV Euro Rate
  const [bcvEuroRate, setBcvEuroRateState] = useState<number>(INITIAL_BCV_EURO_RATE);
  const [isFetchingLiveEuroRate, setIsFetchingLiveEuroRate] = useState(false);

  // Base Currency (USD vs VED)
  const [baseCurrency, setBaseCurrencyState] = useState<BaseCurrency>('USD');

  // Business collections (exclusively populated via live Firestore onSnapshot)
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fiados, setFiados] = useState<FiadoRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cuentasPorPagar, setCuentasPorPagar] = useState<CuentaPorPagar[]>([]);
  const [gastosOperativos, setGastosOperativos] = useState<GastoOperativo[]>([]);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Cart & UI state
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const [activeTab, setActiveTab] = useState<'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'contabilidad'>('inicio');

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

  // Realtime Cloud Database (Firestore) status and unsubscribe ref
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<FirestoreSyncStatus>('unauthenticated');
  const firestoreUnsubRef = useRef<(() => void) | null>(null);
  const activeFirestoreUidRef = useRef<string | null>(null);
  const syncToGoogleDriveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

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
    setProducts([]);
    setSales([]);
    setExpenses([]);
    setFiados([]);
    setClients([]);
    setCuentasPorPagar([]);
    setGastosOperativos([]);
    setCreditNotes([]);
    setInventoryDischarges([]);
    setCashShift(null);
    setCashShiftHistory([]);
    setBusinessInfo(DEFAULT_BUSINESS_INFO);
    setCustomCategories([]);
    setBcvRateState(INITIAL_BCV_RATE);
    setBcvEuroRateState(INITIAL_BCV_EURO_RATE);
    setRateHistory([{ date: new Date().toISOString().split('T')[0], rate: INITIAL_BCV_RATE }]);
    setBaseCurrencyState('USD');
    setManagerPin('1234');
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
    const todayStr = new Date().toISOString().split('T')[0];
    setRateHistory(prev => {
      const updatedHistory = [...prev.filter(h => h.date !== todayStr), { date: todayStr, rate: newRate }];
      const uid = getActiveUid();
      if (uid) {
        saveBusinessProfileToFirestore(uid, {
          bcvRate: newRate,
          rateHistory: updatedHistory
        }).catch(e => console.error('Firestore updateBcvRate error:', e));
      }
      return updatedHistory;
    });
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
  const openCashShift = useCallback((initialCashUSD: number, initialCashBs: number, notes?: string, initialBanks?: BankInitialBalance[]) => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('es-VE') + ' ' + now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const newShift: CashShift = {
      id: 'shift-' + Date.now(),
      isOpen: true,
      openedAt: now.toISOString(),
      openedDateFormatted: timeStr,
      initialCashUSD: Math.max(0, Number(initialCashUSD) || 0),
      initialCashBs: Math.max(0, Number(initialCashBs) || 0),
      initialBanks: initialBanks && initialBanks.length > 0 ? initialBanks : undefined,
      notes: notes || undefined,
      openedBy: googleUser?.name || 'Administrador'
    };
    setCashShift(newShift);
    setIsAperturaModalOpen(false);
    const uid = getActiveUid();
    if (uid) {
      saveCashRegisterStatusToFirestore(uid, {
        isOpen: true,
        activeShift: newShift,
        updatedAt: now.toISOString(),
        updatedBy: googleUser?.name || 'Administrador',
        openedAt: now.toISOString()
      }).catch(e => console.error('Sync open shift error:', e));
    }
  }, [getActiveUid, googleUser?.name, setIsAperturaModalOpen]);

  /**
   * Cierre de Caja al final de la jornada diaria
   */
  const closeCashShift = useCallback((countedUSD: number, countedBs: number, closedNotes?: string, countedBanks?: BankInitialBalance[]): CashShift => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('es-VE') + ' ' + now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    const openedAtIso = cashShift?.openedAt || new Date().toISOString().split('T')[0];
    const shiftSales = sales.filter(s => s.status === 'completada' && s.date >= openedAtIso);
    const shiftExpenses = expenses.filter(e => e.date >= openedAtIso);

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

    const cashUsdOutflow = shiftExpenses
      .filter(e => e.paymentMethod === 'efectivo_usd')
      .reduce((acc, e) => acc + e.amountUSD, 0);
    const cashBsOutflow = shiftExpenses
      .filter(e => e.paymentMethod === 'efectivo_bs')
      .reduce((acc, e) => acc + e.amountBs, 0);

    const initialUSD = cashShift?.initialCashUSD || 0;
    const initialBs = cashShift?.initialCashBs || 0;

    const expectedCashUSD = Number((initialUSD + cashUsdInflow - cashUsdOutflow).toFixed(2));
    const expectedCashBs = Number((initialBs + cashBsInflow - cashBsOutflow).toFixed(2));

    const safeCountedUSD = Number(countedUSD) || 0;
    const safeCountedBs = Number(countedBs) || 0;

    const diffUSD = Number((safeCountedUSD - expectedCashUSD).toFixed(2));
    const diffBs = Number((safeCountedBs - expectedCashBs).toFixed(2));

    const totalSalesUSD = Number(shiftSales.reduce((acc, s) => acc + s.totalUSD, 0).toFixed(2));
    const totalSalesBs = Number(shiftSales.reduce((acc, s) => acc + s.totalBs, 0).toFixed(2));
    const transactionsCount = shiftSales.length;
    const totalExpensesUSD = Number(shiftExpenses.reduce((acc, e) => acc + e.amountUSD, 0).toFixed(2));
    const totalExpensesBs = Number(shiftExpenses.reduce((acc, e) => acc + e.amountBs, 0).toFixed(2));

    const salesBreakdown: Record<string, { usd: number; bs: number }> = {};
    shiftSales.forEach(s => {
      const m = s.paymentMethod;
      if (!salesBreakdown[m]) salesBreakdown[m] = { usd: 0, bs: 0 };
      salesBreakdown[m].usd = Number((salesBreakdown[m].usd + s.totalUSD).toFixed(2));
      salesBreakdown[m].bs = Number((salesBreakdown[m].bs + s.totalBs).toFixed(2));
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
      initialBanks: countedBanks || cashShift?.initialBanks,
      totalSalesUSD,
      totalSalesBs,
      salesBreakdown,
      transactionsCount,
      totalExpensesUSD,
      totalExpensesBs
    };

    setCashShift(closedShift);
    setCashShiftHistory(prev => [closedShift, ...prev]);
    setIsCierreModalOpen(false);

    const uid = getActiveUid();
    if (uid) {
      saveCashShiftToFirestore(uid, closedShift).catch(e => console.error('Sync close shift error:', e));
      saveCashRegisterStatusToFirestore(uid, {
        isOpen: false,
        activeShift: null,
        updatedAt: now.toISOString(),
        updatedBy: googleUser?.name || 'Administrador'
      }).catch(e => console.error('Sync close shift status error:', e));
      syncToGoogleDriveRef.current().then(() => {
        devLog('[PosVenecia] Respaldo opcional de cierre guardado en Google Drive.');
      }).catch(() => {});
    }

    return closedShift;
  }, [cashShift, sales, expenses, getActiveUid, googleUser?.name, setIsCierreModalOpen]);

  /**
   * Build current database payload for optional Google Drive / JSON export
   */
  const buildCurrentPayload = useCallback((): AppDatabasePayload => {
    const cur = latestDataRef.current;
    return {
      version: '2.1',
      updatedAt: new Date().toISOString(),
      userEmail: cur.googleUser?.email || '',
      userUid: cur.googleUser?.uid || '',
      businessInfo: cur.businessInfo,
      bcvRate: cur.bcvRate,
      bcvEuroRate: cur.bcvEuroRate,
      products: cur.products,
      sales: cur.sales,
      expenses: cur.expenses,
      fiados: cur.fiados,
      cuentasPorPagar: cur.cuentasPorPagar,
      gastosOperativos: cur.gastosOperativos,
      clients: cur.clients,
      cashShift: cur.cashShift,
      cashShiftHistory: cur.cashShiftHistory,
      tombstones: { ...tombstonesRef.current }
    };
  }, []);

  /**
   * Optional manual export to Google Drive (no longer used as local cache)
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
        let payload = buildCurrentPayload();
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
  }, [buildCurrentPayload]);

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
            const localPayload = buildCurrentPayload();
            const merged = mergeDatabasePayloads(localPayload, remoteResult.data);

            await restoreStoreDataToFirestore(curUser.uid, {
              products: merged.products,
              sales: merged.sales,
              expenses: merged.expenses,
              fiados: merged.fiados,
              clients: merged.clients,
              cuentasPorPagar: merged.cuentasPorPagar,
              gastosOperativos: merged.gastosOperativos,
              cashShiftHistory: merged.cashShiftHistory || [],
              businessInfo: merged.businessInfo || DEFAULT_BUSINESS_INFO,
              bcvRate: merged.bcvRate || bcvRate,
              bcvEuroRate: merged.bcvEuroRate || bcvEuroRate,
              cashShift: merged.cashShift
            });

            if (meta.modifiedTime) lastRemoteModifiedTimeRef.current = meta.modifiedTime;
            if (remoteResult.etag || meta.etag) lastRemoteEtagRef.current = remoteResult.etag || meta.etag || null;

            const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
            setLastDriveSyncTime(timeStr);
            setDriveSyncStatus('synced');
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
        return false;
      } finally {
        setIsDriveSyncing(false);
      }
    });
  }, [bcvEuroRate, bcvRate, buildCurrentPayload]);

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
    if (!payload || !payload.products || !payload.sales) {
      throw new Error('El archivo no tiene el formato de copia de seguridad válido de PosVenecia.');
    }

    const uid = getActiveUid();
    if (!uid) {
      throw new Error('Debes iniciar sesión con Google para restaurar datos en Cloud Firestore.');
    }

    await restoreStoreDataToFirestore(uid, {
      products: payload.products || [],
      sales: payload.sales || [],
      expenses: payload.expenses || [],
      fiados: payload.fiados || [],
      clients: payload.clients || [],
      cuentasPorPagar: payload.cuentasPorPagar || [],
      gastosOperativos: payload.gastosOperativos || [],
      cashShiftHistory: payload.cashShiftHistory || [],
      businessInfo: payload.businessInfo || DEFAULT_BUSINESS_INFO,
      bcvRate: payload.bcvRate || bcvRate,
      bcvEuroRate: payload.bcvEuroRate || bcvEuroRate,
      customCategories: payload.customCategories || [],
      cashShift: payload.cashShift !== undefined ? payload.cashShift : null
    });

    return true;
  }, [bcvEuroRate, bcvRate, getActiveUid]);

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
        setFirestoreSyncStatus('synced');
      },
      onSales: (newSales) => setSales(newSales),
      onExpenses: (newExpenses) => setExpenses(newExpenses),
      onFiados: (newFiados) => setFiados(newFiados),
      onClients: (newClients) => setClients(newClients),
      onCuentasPorPagar: (newCPP) => setCuentasPorPagar(newCPP),
      onGastosOperativos: (newGastos) => setGastosOperativos(newGastos),
      onCreditNotes: (newNotes) => setCreditNotes(newNotes),
      onInventoryDischarges: (newDischarges) => setInventoryDischarges(newDischarges),
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
        if (profile.customCategories) setCustomCategories(profile.customCategories);
        if (profile.managerPin) setManagerPin(profile.managerPin);
      },
      onError: (err) => {
        console.warn('[PosVenecia Firestore Realtime] Error:', err);
        setFirestoreSyncStatus('error');
      }
    });
    setFirestoreSyncStatus('synced');
  }, []);

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
        activeFirestoreUidRef.current = null;
        setGoogleUser(null);
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
      activeFirestoreUidRef.current = null;
      await logOutGoogle();
    } catch (err) {
      console.warn('Logout error from Firebase auth:', err);
    } finally {
      activeFirestoreUidRef.current = null;
      setGoogleUser(null);
      setFirestoreSyncStatus('unauthenticated');
      setDriveSyncStatus('unauthenticated');
      clearAllInMemoryState();
    }
  };

  // Business Info updates (Saved directly in Cloud Firestore users/{uid}/businessProfile/profile)
  const updateBusinessInfo = useCallback((info: Partial<BusinessInfo>) => {
    setBusinessInfo(prev => {
      const next = { ...prev, ...info };
      const uid = getActiveUid();
      if (uid) {
        saveBusinessProfileToFirestore(uid, { businessInfo: next }).catch(e =>
          console.error('[PosVenecia Firestore] Error guardando perfil de negocio:', e)
        );
      }
      return next;
    });
  }, [getActiveUid]);

  // Categories helper (Saved directly in Cloud Firestore)
  const addCategory = useCallback((newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setCustomCategories(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      const uid = getActiveUid();
      if (uid) {
        saveBusinessProfileToFirestore(uid, { customCategories: next }).catch(e =>
          console.error('[PosVenecia Firestore] Error guardando categoría:', e)
        );
      }
      return next;
    });
  }, [getActiveUid]);

  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...customCategories,
    ...products.map(p => p.category)
  ])).filter(Boolean);

  // Product CRUD with real-time Firestore sync
  const addProduct = (prodData: Omit<Product, 'id'>) => {
    const uid = getActiveUid();
    if (!uid) return;
    const newProd: Product = {
      ...prodData,
      id: 'prod-' + Date.now()
    };
    setProducts(prev => [newProd, ...prev]);
    saveProductToFirestore(uid, newProd).catch(e =>
      console.error('[PosVenecia Firestore] Error en addProduct:', e)
    );
  };

  const updateProduct = (updated: Product) => {
    const uid = getActiveUid();
    if (!uid) return;
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    saveProductToFirestore(uid, updated).catch(e =>
      console.error('[PosVenecia Firestore] Error en updateProduct:', e)
    );
  };

  const deleteProduct = (id: string) => {
    const uid = getActiveUid();
    if (!uid) return;
    tombstonesRef.current.deletedProductIds = [
      ...(tombstonesRef.current.deletedProductIds || []),
      id
    ];
    setProducts(prev => prev.filter(p => p.id !== id));
    deleteProductFromFirestore(uid, id).catch(e =>
      console.error('[PosVenecia Firestore] Error en deleteProduct:', e)
    );
  };

  const adjustStock = (id: string, newStock: number): boolean => {
    let found = false;
    const safeStock = Math.max(0, newStock);
    setProducts(prev => {
      const exists = prev.some(p => p.id === id);
      if (!exists) return prev;
      found = true;
      return prev.map(p => p.id === id ? { ...p, stock: safeStock } : p);
    });

    const uid = getActiveUid();
    if (found && uid) {
      adjustProductStockInFirestore(uid, id, safeStock).catch(e =>
        console.error('[PosVenecia Firestore] Error en adjustProductStock:', e)
      );
    }
    return found;
  };

  const addQuickService = (serviceData: {
    name: string;
    category?: string;
    priceUSD: number;
    quantity: number;
    isExemptFromIVA: boolean;
    notes?: string;
    saveToCatalog?: boolean;
  }) => {
    const serviceProduct: Product = {
      id: 'srv-' + Date.now(),
      code: 'SRV-' + Date.now().toString().slice(-4),
      name: serviceData.name,
      category: serviceData.category || 'Servicios',
      costUSD: 0,
      priceUSD: serviceData.priceUSD,
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
  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                totalUSD: Number(((item.quantity + quantity) * item.unitPriceUSD).toFixed(2))
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity,
          unitPriceUSD: product.priceUSD,
          totalUSD: Number((quantity * product.priceUSD).toFixed(2))
        }
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
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
              totalUSD: Number((quantity * item.unitPriceUSD).toFixed(2))
            }
          : item
      )
    );
  };

  const clearCart = () => setCart([]);

  // Ref for double-submit protection in POS checkout
  const isCompletingSaleRef = useRef(false);

  // Sales operations
  const completeSale = (
    clientData: { name: string; rif: string; phone?: string; address?: string },
    paymentDetails: PaymentDetails
  ): Sale => {
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

    if (isCompletingSaleRef.current) {
      console.warn('[PosVenecia] Intento de venta concurrente bloqueado (double-submit protection).');
      throw new Error('Ya se está procesando una venta. Espere un momento.');
    }
    isCompletingSaleRef.current = true;

    try {
      let subtotalUSD = 0;
      let exemptUSD = 0;
      let taxableUSD = 0;

      cart.forEach(item => {
        const itemTotal = item.quantity * item.unitPriceUSD;
        subtotalUSD += itemTotal;
        if (item.product.isExemptFromIVA) {
          exemptUSD += itemTotal;
        } else {
          taxableUSD += itemTotal;
        }
      });

      const ivaUSD = applyIVA ? Number((taxableUSD * 0.16).toFixed(2)) : 0;
      let igtfUSD = 0;
      if (applyIGTF && paymentDetails.method === 'efectivo_usd') {
        igtfUSD = Number(((subtotalUSD + ivaUSD) * 0.03).toFixed(2));
      } else if (applyIGTF && paymentDetails.method === 'pago_combinado' && paymentDetails.combinedBreakdown?.usdCash) {
        igtfUSD = Number((paymentDetails.combinedBreakdown.usdCash * 0.03).toFixed(2));
      }

      const totalUSD = Number((subtotalUSD + ivaUSD + igtfUSD).toFixed(2));
      const subtotalBs = Number((subtotalUSD * bcvRate).toFixed(2));
      const exemptBs = Number((exemptUSD * bcvRate).toFixed(2));
      const taxableBs = Number((taxableUSD * bcvRate).toFixed(2));
      const ivaBs = Number((ivaUSD * bcvRate).toFixed(2));
      const igtfBs = Number((igtfUSD * bcvRate).toFixed(2));
      const totalBs = Number((totalUSD * bcvRate).toFixed(2));

      const terminalPrefix = `FACT-${terminalId}-`;
      const terminalSales = sales.filter(s => s.invoiceNumber && s.invoiceNumber.startsWith(terminalPrefix));
      const nextSeq = terminalSales.length + 1;
      const invoiceNumber = `FACT-${terminalId}-${String(nextSeq).padStart(6, '0')}`;
      const controlNumber = `00-${String(sales.length + 1).padStart(5, '0')}`;

      const snapshotItems: CartItem[] = cart.map(item => ({
        ...item,
        product: { ...item.product }
      }));

      const newSale: Sale = {
        id: 'sale-' + Date.now(),
        date: new Date().toISOString(),
        invoiceNumber,
        controlNumber,
        clientName: clientData.name || 'Consumidor Final',
        clientRIF: clientData.rif || 'V-00000000',
        clientPhone: clientData.phone,
        clientAddress: clientData.address,
        items: snapshotItems,
        subtotalUSD,
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

      // Optimistic in-memory update (EXACTLY ONCE)
      if (stockDeductions.length > 0) {
        setProducts(prevProducts =>
          prevProducts.map(prod => {
            const qtyToDeduct = deductionMap.get(prod.id);
            if (qtyToDeduct !== undefined && qtyToDeduct > 0) {
              let updatedBatches = prod.batches ? [...prod.batches] : undefined;
              if (updatedBatches && updatedBatches.length > 0) {
                let remainingToDeduct = qtyToDeduct;
                const nextBatches: ProductBatch[] = [];
                for (const b of updatedBatches) {
                  if (remainingToDeduct <= 0) {
                    nextBatches.push(b);
                  } else if (b.quantity > remainingToDeduct) {
                    nextBatches.push({ ...b, quantity: Number((b.quantity - remainingToDeduct).toFixed(2)) });
                    remainingToDeduct = 0;
                  } else {
                    remainingToDeduct -= b.quantity;
                  }
                }
                updatedBatches = nextBatches;
              }

              return {
                ...prod,
                stock: Math.max(0, prod.stock - qtyToDeduct),
                batches: updatedBatches
              };
            }
            return prod;
          })
        );
      }

      let createdFiado: FiadoRecord | undefined = undefined;
      if (paymentDetails.method === 'fiao' || (paymentDetails.method === 'pago_combinado' && (paymentDetails.combinedBreakdown?.fiaoRemaining || 0) > 0)) {
        const remainingDebt = paymentDetails.method === 'fiao'
          ? (paymentDetails.fiaoRemainingUSD ?? totalUSD)
          : (paymentDetails.combinedBreakdown?.fiaoRemaining || 0);

        createdFiado = {
          id: 'fiado-' + Date.now(),
          saleId: newSale.id,
          invoiceNumber: newSale.invoiceNumber,
          clientName: clientData.name,
          clientCI: clientData.rif.replace(/\D/g, '') || clientData.rif,
          clientPhone: clientData.phone || '0414-0000000',
          clientAddress: clientData.address,
          date: newSale.date,
          originalDebtUSD: remainingDebt,
          remainingDebtUSD: remainingDebt,
          status: 'pendiente',
          abonos: []
        };
        setFiados(prev => [createdFiado!, ...prev]);
      }

      setSales(prev => [newSale, ...prev]);
      setLastCompletedSale(newSale);
      clearCart();

      // Atomic Cloud Firestore persistence under users/{uid}/...
      saveSaleAtomic(uid, newSale, stockDeductions, createdFiado).then(() => {
        devLog(`[PosVenecia Firestore] Venta ${newSale.invoiceNumber} confirmada en Firestore.`);
        setSales(prev => prev.map(s => s.id === newSale.id ? { ...s, syncStatus: 'synced' } : s));
      }).catch(e => {
        console.error('Firestore atomic sale error:', e);
      });

      return newSale;
    } finally {
      setTimeout(() => {
        isCompletingSaleRef.current = false;
      }, 500);
    }
  };

  const cancelSale = (saleId: string) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale || targetSale.status === 'anulada') return;

    tombstonesRef.current.canceledSaleIds = [
      ...(tombstonesRef.current.canceledSaleIds || []),
      saleId
    ];

    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'anulada' } : s));

    if (targetSale.items && targetSale.items.length > 0) {
      setProducts(prevProducts => {
        const updated = [...prevProducts];
        targetSale.items.forEach(cartItem => {
          if (!cartItem.product.isService && cartItem.product.itemType !== 'servicio') {
            const idx = updated.findIndex(p => p.id === cartItem.product.id);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                stock: updated[idx].stock + cartItem.quantity
              };
            }
          }
        });
        return updated;
      });
    }

    const associatedFiado = fiados.find(f => f.saleId === saleId);
    setFiados(prevFiados => prevFiados.filter(f => f.saleId !== saleId));

    const uid = getActiveUid();
    if (uid) {
      const stockRestorations = (targetSale.items || [])
        .filter(item => !item.product.isService && item.product.itemType !== 'servicio')
        .map(item => ({ productId: item.product.id, quantity: item.quantity }));
      cancelSaleAtomic(uid, targetSale, stockRestorations, associatedFiado?.id).catch(e =>
        console.error('Firestore atomic cancelSale error:', e)
      );
    }
  };

  const updateSale = (updatedSale: Sale) => {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    setLastCompletedSale(prev => prev?.id === updatedSale.id ? updatedSale : prev);
    const uid = getActiveUid();
    if (uid) {
      saveSaleAtomic(uid, updatedSale, []).catch(e => console.error('Firestore updateSale error:', e));
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
        setProducts(prev => {
          const updated = prev.map(p => {
            const qty = restorationMap.get(p.id);
            return qty ? { ...p, stock: p.stock + qty } : p;
          });
          if (uid) {
            updated.forEach(p => {
              if (restorationMap.has(p.id)) {
                saveProductToFirestore(uid, p).catch(() => {});
              }
            });
          }
          return updated;
        });
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
  }): Promise<CreditNote> => {
    if (isCreatingCreditNoteRef.current) {
      throw new Error('Ya se está procesando una nota de crédito. Espere un momento.');
    }
    isCreatingCreditNoteRef.current = true;

    try {
      const originalSale = sales.find(s => s.id === data.saleId);
      if (!originalSale) {
        throw new Error('Venta no encontrada.');
      }

      if (data.items.length === 0) {
        throw new Error('Debe seleccionar al menos un producto para la devolución.');
      }

      let refundedSubtotalUSD = 0;
      let refundedTaxableUSD = 0;
      let refundedExemptUSD = 0;

      const ncItems: CreditNoteItem[] = [];
      const stockRestorations: { productId: string; quantity: number }[] = [];

      for (const itemReq of data.items) {
        const originalItem = originalSale.items.find(i => i.product.id === itemReq.productId);
        if (!originalItem) continue;

        const qty = Math.min(itemReq.quantity, originalItem.quantity);
        if (qty <= 0) continue;

        const unitPriceUSD = originalItem.unitPriceUSD;
        const totalItemUSD = Number((qty * unitPriceUSD).toFixed(2));
        refundedSubtotalUSD += totalItemUSD;

        if (originalItem.product.isExemptFromIVA) {
          refundedExemptUSD += totalItemUSD;
        } else {
          refundedTaxableUSD += totalItemUSD;
        }

        ncItems.push({
          productId: originalItem.product.id,
          productName: originalItem.product.name,
          quantity: qty,
          unitPriceUSD,
          totalUSD: totalItemUSD,
          isExemptFromIVA: Boolean(originalItem.product.isExemptFromIVA)
        });

        if (!originalItem.product.isService && originalItem.product.itemType !== 'servicio') {
          stockRestorations.push({
            productId: originalItem.product.id,
            quantity: qty
          });
        }
      }

      if (ncItems.length === 0) {
        throw new Error('No se seleccionaron productos válidos para devolución.');
      }

      const originalSubtotal = originalSale.subtotalUSD > 0 ? originalSale.subtotalUSD : 1;
      const refundRatio = Math.min(1, refundedSubtotalUSD / originalSubtotal);
      const refundedIvaUSD = originalSale.ivaUSD ? Number((originalSale.ivaUSD * refundRatio).toFixed(2)) : 0;
      const refundedIgtfUSD = originalSale.igtfUSD ? Number((originalSale.igtfUSD * refundRatio).toFixed(2)) : 0;
      const refundedTotalUSD = Number((refundedSubtotalUSD + refundedIvaUSD + refundedIgtfUSD).toFixed(2));

      const bcv = originalSale.bcvRate || bcvRate;
      const refundedTotalBs = Number((refundedTotalUSD * bcv).toFixed(2));

      const terminalPrefix = `NC-${terminalId}-`;
      const terminalNCs = creditNotes.filter(n => n.creditNoteNumber.startsWith(terminalPrefix));
      const nextSeq = terminalNCs.length + 1;
      const creditNoteNumber = `NC-${terminalId}-${String(nextSeq).padStart(6, '0')}`;
      const controlNumber = `NC00-${String(creditNotes.length + 1).padStart(5, '0')}`;

      const newCreditNote: CreditNote = {
        id: 'nc-' + Date.now(),
        creditNoteNumber,
        controlNumber,
        saleId: originalSale.id,
        originalInvoiceNumber: originalSale.invoiceNumber,
        date: new Date().toISOString(),
        clientName: originalSale.clientName || 'Consumidor Final',
        clientRIF: originalSale.clientRIF || 'V-00000000',
        clientPhone: originalSale.clientPhone,
        clientAddress: originalSale.clientAddress,
        items: ncItems,
        subtotalUSD: Number(refundedSubtotalUSD.toFixed(2)),
        exemptUSD: Number(refundedExemptUSD.toFixed(2)),
        taxableUSD: Number(refundedTaxableUSD.toFixed(2)),
        ivaUSD: refundedIvaUSD,
        igtfUSD: refundedIgtfUSD,
        totalUSD: refundedTotalUSD,
        subtotalBs: Number((refundedSubtotalUSD * bcv).toFixed(2)),
        exemptBs: Number((refundedExemptUSD * bcv).toFixed(2)),
        taxableBs: Number((refundedTaxableUSD * bcv).toFixed(2)),
        ivaBs: Number((refundedIvaUSD * bcv).toFixed(2)),
        igtfBs: Number((refundedIgtfUSD * bcv).toFixed(2)),
        totalBs: refundedTotalBs,
        bcvRate: bcv,
        refundMethod: data.refundMethod,
        reason: data.reason,
        cashierName: googleUser?.name || 'Cajero'
      };

      if (stockRestorations.length > 0) {
        setProducts(prevProducts => {
          const map = new Map(stockRestorations.map(s => [s.productId, s.quantity]));
          return prevProducts.map(p => {
            const addQty = map.get(p.id);
            if (addQty && addQty > 0) {
              return { ...p, stock: p.stock + addQty };
            }
            return p;
          });
        });
      }

      const updatedOriginalSale: Sale = {
        ...originalSale,
        status: 'devuelta',
        creditNoteId: newCreditNote.id,
        refundedUSD: (originalSale.refundedUSD || 0) + refundedTotalUSD
      };
      setSales(prev => prev.map(s => s.id === originalSale.id ? updatedOriginalSale : s));
      setCreditNotes(prev => [newCreditNote, ...prev]);
      setLastCompletedCreditNote(newCreditNote);

      const uid = getActiveUid();
      if (uid) {
        await saveCreditNoteAtomic(uid, newCreditNote, stockRestorations, updatedOriginalSale);
      }

      return newCreditNote;
    } finally {
      setTimeout(() => {
        isCreatingCreditNoteRef.current = false;
      }, 500);
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
      const totalCostUSD = Number((unitCostUSD * qty).toFixed(2));
      const totalCostBs = Number((totalCostUSD * bcvRate).toFixed(2));

      const seq = inventoryDischarges.length + 1;
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
        dueDate: new Date().toISOString().split('T')[0],
        amountUSD: totalCostUSD,
        bcvRate,
        amountBs: totalCostBs,
        status: 'pagado',
        paymentDate: new Date().toISOString(),
        paymentMethod: 'efectivo_usd',
        reference: discharge.dischargeNumber,
        notes: `Generado automáticamente por desincorporación de stock (${data.reason})`
      };

      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p));
      setInventoryDischarges(prev => [discharge, ...prev]);
      setGastosOperativos(prev => [lossExpense, ...prev]);
      setLastCompletedDischarge(discharge);

      const uid = getActiveUid();
      if (uid) {
        await saveInventoryDischargeAtomic(uid, discharge, lossExpense);
      }

      return discharge;
    } finally {
      setTimeout(() => {
        isCreatingDischargeRef.current = false;
      }, 500);
    }
  };

  // Expenses & Purchases operations
  const addExpense = (expData: Omit<Expense, 'id'>) => {
    if (!cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para registrar compras o egresos.');
    }

    const newExp: Expense = {
      ...expData,
      id: 'exp-' + Date.now()
    };

    let updatedProductsList: Product[] = [];

    if (newExp.items && newExp.items.length > 0) {
      setProducts(prevProducts => {
        const productMap = new Map(prevProducts.map(p => [p.id, { ...p }]));
        const impacted: Product[] = [];

        for (const item of newExp.items!) {
          const prod = productMap.get(item.productId);
          if (!prod) continue;

          const incomingQty = Math.max(0, item.quantity);
          const incomingCostUSD = Math.max(0, item.unitCostUSD);
          const previousStock = prod.stock || 0;
          prod.stock = previousStock + incomingQty;

          if (item.strategy === 'fifo') {
            const newBatch: ProductBatch = {
              id: 'batch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              invoiceNumber: newExp.invoiceNumber,
              supplierName: newExp.supplierName,
              date: newExp.date,
              quantity: incomingQty,
              initialQuantity: incomingQty,
              costUSD: incomingCostUSD,
              targetPriceUSD: item.newPriceUSD || prod.priceUSD
            };

            prod.batches = [...(prod.batches || []), newBatch];
            prod.purchaseNote = `Lote Factura ${newExp.invoiceNumber} (${incomingQty} unids a $${incomingCostUSD.toFixed(2)})`;
          } else {
            prod.costUSD = incomingCostUSD;
            if (item.newPriceUSD && item.newPriceUSD > 0) {
              prod.priceUSD = item.newPriceUSD;
            } else {
              const previousCost = (item.previousCostUSD !== undefined && item.previousCostUSD > 0)
                ? item.previousCostUSD
                : (prod.costUSD > 0 ? prod.costUSD : incomingCostUSD);
              const previousPrice = (item.previousPriceUSD !== undefined && item.previousPriceUSD > 0)
                ? item.previousPriceUSD
                : prod.priceUSD;
              const margin = previousCost > 0 ? (previousPrice - previousCost) / previousCost : 0.30;
              prod.priceUSD = Number((incomingCostUSD * (1 + Math.max(0, margin))).toFixed(2));
            }

            if (baseCurrency === 'VED') {
              prod.priceBsFixed = Number((prod.priceUSD * bcvRate).toFixed(2));
            }

            prod.purchaseNote = `Actualizado Factura ${newExp.invoiceNumber} - Costo $${incomingCostUSD.toFixed(2)} / Venta $${prod.priceUSD.toFixed(2)}`;
          }

          impacted.push(prod);
        }

        updatedProductsList = impacted;
        return Array.from(productMap.values());
      });
    }

    setExpenses(prev => [newExp, ...prev]);

    const uid = getActiveUid();
    if (uid) {
      if (updatedProductsList.length > 0) {
        saveExpenseWithInventoryAtomic(uid, newExp, updatedProductsList).catch(e =>
          console.error('Firestore atomic saveExpenseWithInventoryAtomic error:', e)
        );
      } else {
        saveExpenseToFirestore(uid, newExp).catch(e =>
          console.error('Firestore addExpense error:', e)
        );
      }
    }
  };

  const updateExpense = (updated: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
    const uid = getActiveUid();
    if (uid) {
      saveExpenseToFirestore(uid, updated).catch(e => console.error('Firestore updateExpense error:', e));
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
      deleteExpenseFromFirestore(uid, id).catch(e => console.error('Firestore deleteExpense error:', e));
    }
  };

  // Fiados operations
  const addAbonoToFiado = (
    fiadoId: string,
    amountUSD: number,
    method: PaymentMethod,
    reference?: string,
    notes?: string
  ) => {
    const uid = getActiveUid();
    setFiados(prev => prev.map(f => {
      if (f.id === fiadoId) {
        const newRemaining = Math.max(0, f.remainingDebtUSD - amountUSD);
        const newAbono = {
          id: 'abono-' + Date.now(),
          date: new Date().toISOString(),
          amountUSD,
          amountBs: amountUSD * bcvRate,
          bcvRate,
          paymentMethod: method,
          reference,
          notes
        };
        const updatedFiado: FiadoRecord = {
          ...f,
          remainingDebtUSD: newRemaining,
          status: newRemaining <= 0 ? 'saldado' : 'parcial',
          abonos: [newAbono, ...f.abonos]
        };
        if (uid) {
          saveFiadoToFirestore(uid, updatedFiado).catch(e => console.error('Firestore fiado abono error:', e));
        }
        return updatedFiado;
      }
      return f;
    }));
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

  // Cuentas por Pagar (Proveedores)
  const addCuentaPorPagar = (data: Omit<CuentaPorPagar, 'id' | 'paidAmountUSD' | 'remainingUSD' | 'status' | 'abonos'>) => {
    const newCuenta: CuentaPorPagar = {
      ...data,
      id: 'cpp-' + Date.now(),
      paidAmountUSD: 0,
      remainingUSD: data.totalAmountUSD,
      status: 'pendiente',
      abonos: []
    };
    setCuentasPorPagar(prev => [newCuenta, ...prev]);
    const uid = getActiveUid();
    if (uid) {
      saveCuentaPorPagarToFirestore(uid, newCuenta).catch(e => console.error('Firestore addCuentaPorPagar error:', e));
    }
  };

  const updateCuentaPorPagar = (updated: CuentaPorPagar) => {
    setCuentasPorPagar(prev => prev.map(c => c.id === updated.id ? updated : c));
    const uid = getActiveUid();
    if (uid) {
      saveCuentaPorPagarToFirestore(uid, updated).catch(e => console.error('Firestore updateCuentaPorPagar error:', e));
    }
  };

  const deleteCuentaPorPagar = (id: string) => {
    tombstonesRef.current.deletedCuentaIds = [
      ...(tombstonesRef.current.deletedCuentaIds || []),
      id
    ];
    setCuentasPorPagar(prev => prev.filter(c => c.id !== id));
    const uid = getActiveUid();
    if (uid) {
      deleteCuentaPorPagarFromFirestore(uid, id).catch(e => console.error('Firestore deleteCuentaPorPagar error:', e));
    }
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

  const addAbonoToCuentaPorPagar = (cuentaId: string, amountUSD: number, method: PaymentMethod, reference?: string, notes?: string) => {
    const target = cuentasPorPagar.find(c => c.id === cuentaId);
    if (!target) return;

    const payAmount = Math.min(target.remainingUSD, Math.max(0.01, Number(amountUSD.toFixed(2))));
    const newPaid = Number((target.paidAmountUSD + payAmount).toFixed(2));
    const newRemaining = Number(Math.max(0, target.totalAmountUSD - newPaid).toFixed(2));
    const nowIso = new Date().toISOString();
    const payBs = Number((payAmount * bcvRate).toFixed(2));

    const newAbono: Abono = {
      id: 'abono-cpp-' + Date.now(),
      date: nowIso,
      amountUSD: payAmount,
      amountBs: payBs,
      bcvRate,
      paymentMethod: method,
      reference,
      notes: notes || 'Abono realizado a proveedor'
    };

    const updatedCuenta: CuentaPorPagar = {
      ...target,
      paidAmountUSD: newPaid,
      remainingUSD: newRemaining,
      status: newRemaining <= 0.009 ? 'pagada' : 'parcial',
      abonos: [newAbono, ...target.abonos]
    };

    const cashOutflowExpense: Expense = {
      id: 'exp-cpp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      date: nowIso,
      invoiceNumber: target.invoiceNumber || 'CPP-ABONO',
      controlNumber: target.controlNumber || '00-00000',
      supplierName: target.supplierName,
      supplierRIF: target.supplierRIF || 'N/A',
      supplierPhone: target.supplierPhone,
      description: `Abono Cta. por Pagar (${target.invoiceNumber}): ${target.description}${notes ? ` - ${notes}` : ''}`,
      category: target.category === 'Alquiler' || target.category === 'Servicios' || target.category === 'Mantenimiento'
        ? target.category
        : (target.category === 'Mercancía' || target.category === 'Materia Prima' ? 'Mercancía' : 'Otros'),
      amountUSD: payAmount,
      amountBs: payBs,
      baseImponibleBs: payBs,
      ivaBs: 0,
      retencionIVABs: 0,
      retencionISLRBs: 0,
      bcvRate,
      paymentMethod: mapMethodToExpenseMethod(method),
      reference,
      linkedCuentaId: target.id
    };

    setCuentasPorPagar(prev => prev.map(c => c.id === cuentaId ? updatedCuenta : c));
    setExpenses(prev => [cashOutflowExpense, ...prev]);

    const uid = getActiveUid();
    if (uid) {
      saveCuentaWithCashOutflowAtomic(uid, updatedCuenta, cashOutflowExpense).catch(e =>
        console.error('Firestore abono cpp atomic error:', e)
      );
    }
  };

  // Gastos Operativos del Mes (Alquiler, Servicios, Insumos, Eventuales)
  const addGastoOperativo = (data: Omit<GastoOperativo, 'id'>) => {
    const nowIso = new Date().toISOString();
    const isPaidNow = data.status === 'pagado';
    const paidUSD = isPaidNow ? Number(data.amountUSD.toFixed(2)) : Number((data.paidAmountUSD || 0).toFixed(2));
    const remainingUSD = isPaidNow ? 0 : Number(Math.max(0, data.amountUSD - paidUSD).toFixed(2));

    const initialAbonos: Abono[] = isPaidNow
      ? [
          {
            id: 'abono-gasto-' + Date.now(),
            date: data.paymentDate || nowIso,
            amountUSD: paidUSD,
            amountBs: Number((paidUSD * (data.bcvRate || bcvRate)).toFixed(2)),
            bcvRate: data.bcvRate || bcvRate,
            paymentMethod: data.paymentMethod || 'pago_movil',
            reference: data.reference,
            notes: 'Pago completo al registrar el gasto'
          }
        ]
      : (data.abonos || []);

    const newGasto: GastoOperativo = {
      ...data,
      id: 'gasto-' + Date.now(),
      paidAmountUSD: paidUSD,
      remainingUSD,
      status: remainingUSD <= 0.009 ? 'pagado' : (paidUSD > 0 ? 'parcial' : 'pendiente'),
      abonos: initialAbonos
    };

    setGastosOperativos(prev => [newGasto, ...prev]);

    let cashOutflowExpense: Expense | undefined = undefined;
    if (isPaidNow && paidUSD > 0) {
      const rate = data.bcvRate || bcvRate;
      const amountBs = Number((paidUSD * rate).toFixed(2));
      cashOutflowExpense = {
        id: 'exp-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        date: data.paymentDate || nowIso,
        invoiceNumber: data.invoiceNumber || 'REC-GASTO',
        controlNumber: '00-00000',
        supplierName: data.supplierName || data.concept,
        supplierRIF: data.supplierRIF || 'N/A',
        supplierPhone: data.supplierPhone,
        description: `Gasto del Mes: ${data.concept}${data.notes ? ` (${data.notes})` : ''}`,
        category: mapGastoCategoryToExpenseCategory(data.category),
        amountUSD: paidUSD,
        amountBs,
        baseImponibleBs: amountBs,
        ivaBs: 0,
        retencionIVABs: 0,
        retencionISLRBs: 0,
        bcvRate: rate,
        paymentMethod: mapMethodToExpenseMethod(data.paymentMethod),
        reference: data.reference,
        linkedGastoId: newGasto.id
      };
      setExpenses(prev => [cashOutflowExpense!, ...prev]);
    }

    const uid = getActiveUid();
    if (uid) {
      if (cashOutflowExpense) {
        saveGastoWithCashOutflowAtomic(uid, newGasto, cashOutflowExpense).catch(e =>
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

  const markGastoOperativoPagado = (
    id: string,
    paymentMethod: PaymentMethod,
    reference?: string,
    amountUSD?: number,
    notes?: string
  ) => {
    const target = gastosOperativos.find(g => g.id === id);
    if (!target) return;

    const currentPaid = Number((target.paidAmountUSD ?? (target.status === 'pagado' ? target.amountUSD : 0)).toFixed(2));
    const currentRemaining = Number((target.remainingUSD ?? Math.max(0, target.amountUSD - currentPaid)).toFixed(2));
    if (currentRemaining <= 0) return;

    const requestedAmount = amountUSD !== undefined && !isNaN(amountUSD) && amountUSD > 0
      ? Number(amountUSD.toFixed(2))
      : currentRemaining;
    const payAmount = Math.min(currentRemaining, Math.max(0.01, requestedAmount));
    const payAmountBs = Number((payAmount * bcvRate).toFixed(2));

    const newPaid = Number((currentPaid + payAmount).toFixed(2));
    const newRemaining = Number(Math.max(0, target.amountUSD - newPaid).toFixed(2));
    const newStatus: GastoOperativo['status'] = newRemaining <= 0.009 ? 'pagado' : 'parcial';
    const nowIso = new Date().toISOString();

    const newAbono: Abono = {
      id: 'abono-gasto-' + Date.now(),
      date: nowIso,
      amountUSD: payAmount,
      amountBs: payAmountBs,
      bcvRate,
      paymentMethod,
      reference,
      notes: notes || (newStatus === 'pagado' && currentPaid === 0 ? 'Pago completo de gasto' : newStatus === 'pagado' ? 'Liquidación final de saldo pendiente' : 'Abono parcial a gasto pendiente')
    };

    const existingAbonos = target.abonos || [];

    const updatedGasto: GastoOperativo = {
      ...target,
      paidAmountUSD: newPaid,
      remainingUSD: newRemaining,
      status: newStatus,
      paymentDate: nowIso,
      paymentMethod,
      reference: reference || target.reference,
      abonos: [newAbono, ...existingAbonos]
    };

    const cashOutflowExpense: Expense = {
      id: 'exp-gasto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      date: nowIso,
      invoiceNumber: target.invoiceNumber || 'REC-GASTO',
      controlNumber: '00-00000',
      supplierName: target.supplierName || target.concept,
      supplierRIF: target.supplierRIF || 'N/A',
      supplierPhone: target.supplierPhone,
      description: `${newStatus === 'pagado' && currentPaid === 0 ? 'Pago' : 'Abono'} Gasto (${target.concept})${notes ? ` - ${notes}` : ''}`,
      category: mapGastoCategoryToExpenseCategory(target.category),
      amountUSD: payAmount,
      amountBs: payAmountBs,
      baseImponibleBs: payAmountBs,
      ivaBs: 0,
      retencionIVABs: 0,
      retencionISLRBs: 0,
      bcvRate,
      paymentMethod: mapMethodToExpenseMethod(paymentMethod),
      reference,
      linkedGastoId: target.id
    };

    setGastosOperativos(prev => prev.map(g => g.id === id ? updatedGasto : g));
    setExpenses(prev => [cashOutflowExpense, ...prev]);

    const uid = getActiveUid();
    if (uid) {
      saveGastoWithCashOutflowAtomic(uid, updatedGasto, cashOutflowExpense).catch(e =>
        console.error('Firestore markGastoPagado atomic error:', e)
      );
    }
  };

  // Clientes Habituales
  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: 'cli-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    setClients(prev => [newClient, ...prev]);
    const uid = getActiveUid();
    if (uid) {
      saveClientToFirestore(uid, newClient).catch(e => console.error('Firestore addClient error:', e));
    }
    return newClient;
  };

  const updateClient = (updated: Client) => {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedClientForPOS?.id === updated.id) {
      setSelectedClientForPOS(updated);
    }
    const uid = getActiveUid();
    if (uid) {
      saveClientToFirestore(uid, updated).catch(e => console.error('Firestore updateClient error:', e));
    }
  };

  const deleteClient = (id: string) => {
    tombstonesRef.current.deletedClientIds = [
      ...(tombstonesRef.current.deletedClientIds || []),
      id
    ];
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedClientForPOS?.id === id) {
      setSelectedClientForPOS(null);
    }
    const uid = getActiveUid();
    if (uid) {
      deleteClientFromFirestore(uid, id).catch(e => console.error('Firestore deleteClient error:', e));
    }
  };

  /**
   * Factory Reset: Arrancar de 0 limpiando todas las colecciones en Cloud Firestore del usuario actual
   */
  const factoryReset = (_mode: 'clean_zero' | 'restore_demo' = 'clean_zero') => {
    setProducts([]);
    setSales([]);
    setExpenses([]);
    setFiados([]);
    setClients([]);
    setCuentasPorPagar([]);
    setGastosOperativos([]);
    setCreditNotes([]);
    setInventoryDischarges([]);
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

    const uid = getActiveUid();
    if (uid) {
      clearUserFirestoreCollections(uid).catch(e =>
        console.error('Firestore factoryReset error:', e)
      );
    }
  };

  return (
    <AppContext.Provider
      value={{
        bcvRate,
        updateBcvRate,
        rateHistory,
        fetchLiveRate,
        isFetchingLiveRate,
        bcvEuroRate,
        updateBcvEuroRate,
        fetchLiveEuroRate,
        isFetchingLiveEuroRate,
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
        firestoreSyncStatus,
        backupClosingToDrive: syncToGoogleDrive,
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
