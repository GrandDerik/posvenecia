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
  PagoMovilAccount,
  POSTerminal,
  BankAccount,
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
  findDriveDatabaseFile, 
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
import { 
  initIndexedDB, 
  saveOfflineSale, 
  saveOfflineExpense, 
  saveOfflineProducts,
  saveAppStateToIndexedDB,
  loadAppStateFromIndexedDB,
  syncPendingOfflineData,
  removeSyncItemBySaleId
} from '../services/indexedDBService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { testConnection, auth } from '../config/firebaseConfig';
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
  saveStoreMetadataToFirestore,
  checkAndMigrateLocalDataToFirestore,
  getCanonicalBusinessId,
  saveCashRegisterStatusToFirestore,
  waitForAllPendingWrites,
  flushPendingQueueToFirestore,
  CashRegisterStatusDoc,
  saveCreditNoteAtomic,
  deleteCreditNoteFromFirestore,
  saveInventoryDischargeAtomic,
  deleteInventoryDischargeFromFirestore,
  saveExpenseWithInventoryAtomic,
  saveGastoWithCashOutflowAtomic,
  saveCuentaWithCashOutflowAtomic,
  deleteSaleFromFirestore
} from '../services/firestoreSyncService';

export type DriveSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated' | 'token_expired';
export type FirestoreSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.info(...args);
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

  // Google Account, OAuth & Google Drive Sync
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

  // Session & Offline-First
  isSessionStarted: boolean;
  startLocalSession: () => void;
  isOnline: boolean;
  isSyncingOffline: boolean;
  pendingOfflineCount: number;
  syncOfflineData: () => Promise<number>;
  offlineSyncNotification: string | null;
  dismissOfflineNotification: () => void;

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
  const [lastDriveSyncTime, setLastDriveSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('posvenecia_last_drive_sync_time') || null;
  });
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // Terminal / Caja ID for multi-device conflict-free sequential invoicing (e.g. FACT-C1-000048 vs FACT-C2-000048)
  const [terminalId, setTerminalIdState] = useState<string>(() => {
    const saved = localStorage.getItem('posvenecia_terminal_id');
    if (saved) return saved;
    const defaultId = 'C1';
    localStorage.setItem('posvenecia_terminal_id', defaultId);
    return defaultId;
  });

  const setTerminalId = useCallback((id: string) => {
    const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'C1';
    setTerminalIdState(cleanId);
    localStorage.setItem('posvenecia_terminal_id', cleanId);
  }, []);

  // Multi-device optimistic concurrency and tombstone tracking refs
  const lastDriveFileIdRef = useRef<string | null>(null);
  const lastRemoteEtagRef = useRef<string | null>(null);
  const tombstonesRef = useRef<DatabaseTombstones>({
    deletedProductIds: [],
    canceledSaleIds: [],
    deletedClientIds: [],
    deletedExpenseIds: [],
    deletedCuentaIds: [],
    deletedGastoIds: []
  });

  // Active user storage scope key generator
  const getStorageKey = useCallback((key: string): string => {
    const userScope = googleUser?.uid ? `usr_${googleUser.uid}` : 'guest';
    return `posvenecia_${userScope}_${key}`;
  }, [googleUser?.uid]);

  // BCV Rate states
  const [bcvRate, setBcvRateState] = useState<number>(() => {
    const saved = localStorage.getItem('posvenecia_bcv_rate');
    return saved ? parseFloat(saved) : INITIAL_BCV_RATE;
  });

  const [rateHistory, setRateHistory] = useState<{ date: string; rate: number }[]>(() => {
    const saved = localStorage.getItem('posvenecia_bcv_history');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [{ date: new Date().toISOString().split('T')[0], rate: INITIAL_BCV_RATE }];
  });

  const updateBcvRate = (newRate: number) => {
    setBcvRateState(newRate);
    localStorage.setItem('posvenecia_bcv_rate', newRate.toString());
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedHistory = [...rateHistory.filter(h => h.date !== todayStr), { date: todayStr, rate: newRate }];
    setRateHistory(updatedHistory);
    localStorage.setItem('posvenecia_bcv_history', JSON.stringify(updatedHistory));
  };

  const [isFetchingLiveRate, setIsFetchingLiveRate] = useState(false);

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

  // BCV Euro Rate
  const [bcvEuroRate, setBcvEuroRateState] = useState<number>(() => {
    const saved = localStorage.getItem('posvenecia_bcv_euro_rate');
    return saved ? parseFloat(saved) : INITIAL_BCV_EURO_RATE;
  });

  const updateBcvEuroRate = (newRate: number) => {
    setBcvEuroRateState(newRate);
    localStorage.setItem('posvenecia_bcv_euro_rate', newRate.toString());
  };

  const [isFetchingLiveEuroRate, setIsFetchingLiveEuroRate] = useState(false);

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

  // Base Currency (USD vs VED)
  const [baseCurrency, setBaseCurrencyState] = useState<BaseCurrency>(() => {
    const saved = localStorage.getItem('posvenecia_base_currency');
    return (saved === 'VED' || saved === 'USD') ? (saved as BaseCurrency) : 'USD';
  });

  const setBaseCurrency = (curr: BaseCurrency) => {
    setBaseCurrencyState(curr);
    localStorage.setItem('posvenecia_base_currency', curr);
  };

  // CLEAN EMPTY INITIAL STATES (Zero preloaded demo records per user requirement)
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

  // Desincorporación de Inventario (Salidas por Daño / Vencimiento / Merma / Uso Interno)
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

  // Cash Register Shift State (Apertura y Cierre de Caja Diaria)
  const [cashShift, setCashShift] = useState<CashShift | null>(null);
  const [cashShiftHistory, setCashShiftHistory] = useState<CashShift[]>([]);
  const isCashRegisterOpen = Boolean(cashShift?.isOpen);

  // Manager PIN
  const [managerPin, setManagerPin] = useState<string>(() => {
    return localStorage.getItem('posvenecia_manager_pin') || '1234';
  });

  const updateManagerPin = (newPin: string) => {
    setManagerPin(newPin);
    localStorage.setItem('posvenecia_manager_pin', newPin);
  };

  // App Theme: light (default and exclusive theme)
  const [appTheme] = useState<AppTheme>('light');

  const setAppTheme = useCallback((_theme: AppTheme) => {
    localStorage.setItem('posvenecia_theme', 'light');
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('theme-dark', 'dark', 'theme-liquid-glass');
      root.classList.add('theme-light');
    }
  }, []);

  // Initialize light theme on mount
  useEffect(() => {
    setAppTheme('light');
  }, [setAppTheme]);

  // Multi-device sync tracking refs
  const lastRemoteModifiedTimeRef = useRef<string | null>(null);
  const isCheckingRemoteRef = useRef<boolean>(false);
  const [offlineSyncNotification, setOfflineSyncNotification] = useState<string | null>(null);

  // Session state (Shows LoginView if not started)
  const [isSessionStarted, setIsSessionStarted] = useState<boolean>(() => {
    return localStorage.getItem('posvenecia_session_started') === 'true';
  });

  const startLocalSession = useCallback(() => {
    setIsSessionStarted(true);
    localStorage.setItem('posvenecia_session_started', 'true');
  }, []);

  const dismissOfflineNotification = useCallback(() => {
    setOfflineSyncNotification(null);
  }, []);

  // Forward ref for real Google Drive cloud sync callback
  const syncToGoogleDriveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  const offlineSyncTimerRef = useRef<number | null>(null);

  // Network Status and Automatic Offline-First Queue Sync
  const handleReconnected = useCallback((syncedCount: number) => {
    if (syncedCount > 0) {
      setOfflineSyncNotification(
        `¡Conexión restablecida! Se han sincronizado ${syncedCount} operaciones pendientes.`
      );
      if (offlineSyncTimerRef.current) {
        window.clearTimeout(offlineSyncTimerRef.current);
      }
      offlineSyncTimerRef.current = window.setTimeout(() => setOfflineSyncNotification(null), 6000);
    }
  }, []);

  const executeCloudSyncCallback = useCallback(() => {
    // Background cloud upload to Google Drive is disabled during regular POS operation.
    // Google Drive runs exclusively on manual button click or on Cierre de Caja.
    return Promise.resolve(true);
  }, []);

  const {
    isOnline,
    isSyncing: isSyncingOffline,
    pendingCount: pendingOfflineCount,
    triggerSync: syncOfflineData
  } = useNetworkStatus(handleReconnected, executeCloudSyncCallback);

  // Realtime Cloud Database (Firestore) status and unsubscribe ref
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<FirestoreSyncStatus>('unauthenticated');
  const firestoreUnsubRef = useRef<(() => void) | null>(null);
  const activeFirestoreUidRef = useRef<string | null>(null);
  const hasReceivedFirestoreDataRef = useRef(false);

  // Initialize IndexedDB and verify Firestore connection on mount
  useEffect(() => {
    initIndexedDB().catch(err => console.error('IndexedDB init error:', err));
    testConnection().catch(e => {
      if (import.meta.env.DEV) console.warn('Firestore connection check:', e);
    });
    return () => {
      if (offlineSyncTimerRef.current) {
        window.clearTimeout(offlineSyncTimerRef.current);
      }
    };
  }, []);

  // Ref to track if user data has loaded from Firestore or local scope to avoid overwriting
  const isDataLoadedRef = useRef(false);

  // Ref with latest state values to decouple callbacks from re-renders and eliminate freezing loops
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
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveCashRegisterStatusToFirestore(businessId, {
        isOpen: true,
        activeShift: newShift,
        updatedAt: now.toISOString(),
        updatedBy: googleUser?.name || 'Administrador'
      }).catch(e => console.warn('Sync open shift error:', e));
    }
  }, [googleUser?.uid, googleUser?.name]);

  /**
   * Cierre de Caja al final de la jornada diaria:
   * 1. Registra el arqueo y balance del turno
   * 2. Guarda el cierre en Firestore en tiempo real para todos los dispositivos
   * 3. Sube automáticamente la copia de respaldo segura del día (posvenecia_database.json) a Google Drive
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

    // Sync closed shift to Firestore and trigger closing backup to Google Drive
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveCashShiftToFirestore(businessId, closedShift).catch(e => console.error('Sync close shift error:', e));
      saveCashRegisterStatusToFirestore(businessId, {
        isOpen: false,
        activeShift: null,
        updatedAt: now.toISOString(),
        updatedBy: googleUser?.name || 'Administrador'
      }).catch(e => console.error('Sync close shift status error:', e));
      syncToGoogleDriveRef.current().then(() => {
        devLog('[PosVenecia] Respaldo de cierre guardado en Google Drive automáticamente.');
      }).catch(e => console.warn('Drive closing backup notice:', e));
    }

    return closedShift;
  }, [cashShift, sales, expenses, googleUser?.uid, googleUser?.name]);

  /**
   * Load scoped storage for active user (IndexedDB as robust storage with localStorage fast-cache)
   * Resilient fallback across scopes: if a scoped user has no data yet, seamlessly reads from master/guest
   */
  const loadScopedLocalStorage = useCallback((uid?: string) => {
    const scope = uid ? `usr_${uid}` : 'guest';
    const read = (key: string) => {
      try {
        const candidateKeys = [
          `posvenecia_${scope}_${key}`,
          `posvenecia_master_${key}`,
          `posvenecia_guest_${key}`,
          `posvenecia_${key}_v4`,
          `tupunto_${key}`
        ];
        for (const k of candidateKeys) {
          const saved = localStorage.getItem(k);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) ? parsed.length > 0 : parsed) {
              return parsed;
            }
          }
        }
      } catch (e) {
        /* ignore parsing or access error */
      }
      return null;
    };

    // Fast sync hydration from localStorage cache
    const storedProducts = read('products') || [];
    const storedSales = read('sales') || [];
    const storedExpenses = read('expenses') || [];
    const storedFiados = read('fiados') || [];
    const storedClients = read('clients') || [];
    const storedCPP = read('cuentas_por_pagar') || [];
    const storedGastos = read('gastos_operativos') || [];
    const storedBusiness = read('business_info') || DEFAULT_BUSINESS_INFO;
    const storedCategories = read('custom_categories') || [];
    const storedCashShift = read('cash_shift') || null;
    const storedShiftHistory = read('cash_shift_history') || [];

    setProducts(storedProducts);
    setSales(storedSales);
    setExpenses(storedExpenses);
    setFiados(storedFiados);
    setClients(storedClients);
    setCuentasPorPagar(storedCPP);
    setGastosOperativos(storedGastos);
    setBusinessInfo(storedBusiness);
    setCustomCategories(storedCategories);
    setCashShift(storedCashShift);
    setCashShiftHistory(storedShiftHistory);

    // Deep asynchronous hydration from IndexedDB with master fallback (only if Firestore data has not yet arrived)
    loadAppStateFromIndexedDB(scope).then(async (idbData) => {
      // If Firestore has already delivered remote real-time data, do not overwrite with stale local cache
      if (hasReceivedFirestoreDataRef.current) {
        return;
      }
      let finalData = idbData;
      if (!finalData || (!finalData.products?.length && !finalData.sales?.length)) {
        finalData = (await loadAppStateFromIndexedDB('master')) || (await loadAppStateFromIndexedDB('guest'));
      }
      if (finalData && !hasReceivedFirestoreDataRef.current) {
        if (finalData.products && Array.isArray(finalData.products) && finalData.products.length > 0) {
          setProducts(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.products);
        }
        if (finalData.sales && Array.isArray(finalData.sales) && finalData.sales.length > 0) {
          setSales(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.sales);
        }
        if (finalData.expenses && Array.isArray(finalData.expenses) && finalData.expenses.length > 0) {
          setExpenses(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.expenses);
        }
        if (finalData.fiados && Array.isArray(finalData.fiados) && finalData.fiados.length > 0) {
          setFiados(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.fiados);
        }
        if (finalData.clients && Array.isArray(finalData.clients) && finalData.clients.length > 0) {
          setClients(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.clients);
        }
        if (finalData.cuentasPorPagar && Array.isArray(finalData.cuentasPorPagar) && finalData.cuentasPorPagar.length > 0) {
          setCuentasPorPagar(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.cuentasPorPagar);
        }
        if (finalData.gastosOperativos && Array.isArray(finalData.gastosOperativos) && finalData.gastosOperativos.length > 0) {
          setGastosOperativos(prev => (prev.length > 0 || hasReceivedFirestoreDataRef.current) ? prev : finalData.gastosOperativos);
        }
        if (finalData.businessInfo) setBusinessInfo(finalData.businessInfo);
        if (finalData.customCategories) setCustomCategories(finalData.customCategories);
        if (finalData.cashShift !== undefined) setCashShift(finalData.cashShift);
        if (finalData.cashShiftHistory) setCashShiftHistory(finalData.cashShiftHistory);
      }
    }).catch(err => console.warn('Error hydrating from IndexedDB:', err));
  }, []);

  /**
   * Save scoped storage for active user
   * Saves to both active user scope AND master fallback so data is never wiped on login/logout
   */
  const saveScopedLocalStorage = useCallback((uid: string | undefined, data: {
    products: Product[];
    sales: Sale[];
    expenses: Expense[];
    fiados: FiadoRecord[];
    clients: Client[];
    cuentasPorPagar: CuentaPorPagar[];
    gastosOperativos: GastoOperativo[];
    businessInfo: BusinessInfo;
    customCategories: string[];
    cashShift?: CashShift | null;
    cashShiftHistory?: CashShift[];
  }) => {
    const scope = uid ? `usr_${uid}` : 'guest';

    // 1. Primary storage: IndexedDB (stores under active scope AND master backup)
    saveAppStateToIndexedDB(scope, data).catch(err => console.error('IndexedDB saveAppState error:', err));
    saveAppStateToIndexedDB('master', data).catch(err => console.error('IndexedDB saveAppState master error:', err));

    // 2. Secondary fast cache: localStorage
    const safeSetItem = (key: string, value: any) => {
      try {
        localStorage.setItem(`posvenecia_${scope}_${key}`, JSON.stringify(value));
        localStorage.setItem(`posvenecia_master_${key}`, JSON.stringify(value));
      } catch (e: any) {
        if (e?.name === 'QuotaExceededError' || e?.code === 22) {
          console.warn(`LocalStorage quota exceeded on key: ${key}. Data is safely stored in IndexedDB.`);
        }
      }
    };

    safeSetItem('products', data.products);
    safeSetItem('sales', data.sales);
    safeSetItem('expenses', data.expenses);
    safeSetItem('fiados', data.fiados);
    safeSetItem('clients', data.clients);
    safeSetItem('cuentas_por_pagar', data.cuentasPorPagar);
    safeSetItem('gastos_operativos', data.gastosOperativos);
    safeSetItem('business_info', data.businessInfo);
    safeSetItem('custom_categories', data.customCategories);
    safeSetItem('cash_shift', data.cashShift ?? null);
    safeSetItem('cash_shift_history', data.cashShiftHistory ?? []);
  }, []);

  /**
   * Build current database payload for Google Drive
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
   * Save current application database directly into the user's personal Google Drive
   * Wrapped in driveSyncMutex with If-Match (ETag) optimistic concurrency.
   * If a 412 conflict occurs, automatically runs intelligent 3-way merge by ID with tombstones.
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
        console.warn('Google Drive token expired (TTL > 55 min)');
        setDriveSyncStatus('token_expired');
        return false;
      }

      setIsDriveSyncing(true);
      setDriveSyncStatus('syncing');

      try {
        let payload = buildCurrentPayload();

        // Safety guard: If local state on this device is completely empty, check if remote cloud has data before uploading empty state!
        if (payload.products.length === 0 && payload.sales.length === 0) {
          const meta = await getRemoteDatabaseMetadata(token);
          if (meta?.fileId) {
            const remoteRes = await readDatabaseFromDrive(token, meta.fileId);
            if (remoteRes?.data && ((remoteRes.data.products?.length || 0) > 0 || (remoteRes.data.sales?.length || 0) > 0)) {
              console.warn('[PosVenecia] Protección contra sobreescritura vacía: se descargaron los datos de la nube en lugar de sobreescribir con vacío.');
              const remoteData = remoteRes.data;
              setProducts(remoteData.products || []);
              setSales(remoteData.sales || []);
              setExpenses(remoteData.expenses || []);
              setFiados(remoteData.fiados || []);
              setClients(remoteData.clients || []);
              setCuentasPorPagar(remoteData.cuentasPorPagar || []);
              setGastosOperativos(remoteData.gastosOperativos || []);
              if (remoteData.cashShift !== undefined) setCashShift(remoteData.cashShift);
              if (remoteData.cashShiftHistory) setCashShiftHistory(remoteData.cashShiftHistory);
              if (remoteData.businessInfo) setBusinessInfo(remoteData.businessInfo);
              if (remoteData.bcvRate) setBcvRateState(remoteData.bcvRate);
              if (remoteData.bcvEuroRate) setBcvEuroRateState(remoteData.bcvEuroRate);
              saveScopedLocalStorage(curUser.uid, {
                products: remoteData.products || [],
                sales: remoteData.sales || [],
                expenses: remoteData.expenses || [],
                fiados: remoteData.fiados || [],
                clients: remoteData.clients || [],
                cuentasPorPagar: remoteData.cuentasPorPagar || [],
                gastosOperativos: remoteData.gastosOperativos || [],
                businessInfo: remoteData.businessInfo || DEFAULT_BUSINESS_INFO,
                customCategories: [],
                cashShift: remoteData.cashShift,
                cashShiftHistory: remoteData.cashShiftHistory || []
              });
              setDriveSyncStatus('synced');
              return true;
            }
          }
        }

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
            console.warn('[PosVenecia] Concurrencia multi-dispositivo detectada (412 Precondition Failed). Ejecutando merge inteligente por ID con tombstones...');
            const meta = await getRemoteDatabaseMetadata(token);
            if (meta?.fileId) {
              const remoteRes = await readDatabaseFromDrive(token, meta.fileId);
              if (remoteRes?.data) {
                const mergedPayload = mergeDatabasePayloads(payload, remoteRes.data);
                
                // Hydrate React state with merged results
                setProducts(mergedPayload.products);
                setSales(mergedPayload.sales);
                setExpenses(mergedPayload.expenses);
                setFiados(mergedPayload.fiados);
                setClients(mergedPayload.clients);
                setCuentasPorPagar(mergedPayload.cuentasPorPagar);
                setGastosOperativos(mergedPayload.gastosOperativos);
                if (mergedPayload.cashShift !== undefined) {
                  setCashShift(mergedPayload.cashShift);
                }
                if (mergedPayload.cashShiftHistory) {
                  setCashShiftHistory(mergedPayload.cashShiftHistory);
                }
                if (mergedPayload.tombstones) {
                  tombstonesRef.current = mergedPayload.tombstones;
                }

                // Retry upload with merged payload and updated remote ETag
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

        if (saveRes?.fileId) {
          lastDriveFileIdRef.current = saveRes.fileId;
        }
        if (saveRes?.modifiedTime) {
          lastRemoteModifiedTimeRef.current = saveRes.modifiedTime;
        }
        if (saveRes?.etag) {
          lastRemoteEtagRef.current = saveRes.etag;
        }

        const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        setLastDriveSyncTime(timeStr);
        localStorage.setItem('posvenecia_last_drive_sync_time', timeStr);
        setDriveSyncStatus('synced');
        
        const cur = latestDataRef.current;
        saveScopedLocalStorage(curUser.uid, {
          products: cur.products,
          sales: cur.sales,
          expenses: cur.expenses,
          fiados: cur.fiados,
          clients: cur.clients,
          cuentasPorPagar: cur.cuentasPorPagar,
          gastosOperativos: cur.gastosOperativos,
          businessInfo: cur.businessInfo,
          customCategories: cur.customCategories,
          cashShift: cur.cashShift,
          cashShiftHistory: cur.cashShiftHistory
        });

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
  }, [buildCurrentPayload, saveScopedLocalStorage]);

  // Keep syncToGoogleDriveRef up-to-date for offline sync queue execution
  useEffect(() => {
    syncToGoogleDriveRef.current = syncToGoogleDrive;
  }, [syncToGoogleDrive]);

  /**
   * Reload database directly from user's Google Drive with intelligent merge
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

            setProducts(merged.products);
            setSales(merged.sales);
            setExpenses(merged.expenses);
            setFiados(merged.fiados);
            setClients(merged.clients);
            setCuentasPorPagar(merged.cuentasPorPagar);
            setGastosOperativos(merged.gastosOperativos);
            if (merged.cashShift !== undefined) {
              setCashShift(merged.cashShift);
            }
            if (merged.cashShiftHistory) {
              setCashShiftHistory(merged.cashShiftHistory);
            }
            if (merged.businessInfo) {
              setBusinessInfo(merged.businessInfo);
            }
            if (merged.bcvRate) setBcvRateState(merged.bcvRate);
            if (merged.bcvEuroRate) setBcvEuroRateState(merged.bcvEuroRate);
            if (merged.tombstones) {
              tombstonesRef.current = merged.tombstones;
            }

            saveScopedLocalStorage(curUser.uid, {
              products: merged.products,
              sales: merged.sales,
              expenses: merged.expenses,
              fiados: merged.fiados,
              clients: merged.clients,
              cuentasPorPagar: merged.cuentasPorPagar,
              gastosOperativos: merged.gastosOperativos,
              businessInfo: merged.businessInfo || DEFAULT_BUSINESS_INFO,
              customCategories: [],
              cashShift: merged.cashShift,
              cashShiftHistory: merged.cashShiftHistory || []
            });

            if (meta.modifiedTime) {
              lastRemoteModifiedTimeRef.current = meta.modifiedTime;
            }
            if (remoteResult.etag || meta.etag) {
              lastRemoteEtagRef.current = remoteResult.etag || meta.etag || null;
            }

            const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
            setLastDriveSyncTime(timeStr);
            localStorage.setItem('posvenecia_last_drive_sync_time', timeStr);
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
  }, [buildCurrentPayload, saveScopedLocalStorage]);

  /**
   * Renews Google Drive OAuth session via 1-click popup and pulls latest data from other devices
   */
  const renewGoogleSession = useCallback(async (): Promise<boolean> => {
    try {
      setIsDriveSyncing(true);
      setDriveSyncStatus('syncing');
      const token = await renewGoogleToken();
      if (token) {
        // Immediately reload from Google Drive to pull products/changes from other devices
        const reloaded = await reloadFromGoogleDrive();
        if (!reloaded) {
          // If remote file doesn't exist yet, save current local state
          await syncToGoogleDrive();
        }
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
  }, [reloadFromGoogleDrive, syncToGoogleDrive]);

  /**
   * Continuous multi-device background sync: checks remote Google Drive file
   * If remote ETag or modifiedTime changed, performs seamless 3-way merge by ID with tombstones
   */
  const checkRemoteChangesForMultiDevice = useCallback(async () => {
    if (isCheckingRemoteRef.current) return;
    const token = getGoogleAccessToken();
    const curUser = latestDataRef.current.googleUser;
    if (!token || !curUser || !navigator.onLine) return;

    if (isGoogleTokenExpired()) {
      setDriveSyncStatus('token_expired');
      return;
    }

    isCheckingRemoteRef.current = true;
    try {
      await driveSyncMutex.runExclusive(async () => {
        const meta = await getRemoteDatabaseMetadata(token);
        if (meta && meta.fileId) {
          lastDriveFileIdRef.current = meta.fileId;
          const hasChanged = 
            (meta.etag && meta.etag !== lastRemoteEtagRef.current) ||
            (meta.modifiedTime && meta.modifiedTime !== lastRemoteModifiedTimeRef.current);

          if (hasChanged) {
            const remoteResult = await readDatabaseFromDrive(token, meta.fileId);
            if (remoteResult && remoteResult.data) {
              const localPayload = buildCurrentPayload();
              const merged = mergeDatabasePayloads(localPayload, remoteResult.data);

              setProducts(merged.products);
              setSales(merged.sales);
              setExpenses(merged.expenses);
              setFiados(merged.fiados);
              setClients(merged.clients);
              setCuentasPorPagar(merged.cuentasPorPagar);
              setGastosOperativos(merged.gastosOperativos);
              if (merged.cashShift !== undefined) {
                setCashShift(merged.cashShift);
              }
              if (merged.cashShiftHistory) {
                setCashShiftHistory(merged.cashShiftHistory);
              }
              if (merged.businessInfo) {
                setBusinessInfo(merged.businessInfo);
              }
              if (merged.bcvRate) setBcvRateState(merged.bcvRate);
              if (merged.bcvEuroRate) setBcvEuroRateState(merged.bcvEuroRate);
              if (merged.tombstones) {
                tombstonesRef.current = merged.tombstones;
              }

              saveScopedLocalStorage(curUser.uid, {
                products: merged.products,
                sales: merged.sales,
                expenses: merged.expenses,
                fiados: merged.fiados,
                clients: merged.clients,
                cuentasPorPagar: merged.cuentasPorPagar,
                gastosOperativos: merged.gastosOperativos,
                businessInfo: merged.businessInfo || DEFAULT_BUSINESS_INFO,
                customCategories: [],
                cashShift: merged.cashShift,
                cashShiftHistory: merged.cashShiftHistory || []
              });

              lastRemoteModifiedTimeRef.current = meta.modifiedTime || null;
              lastRemoteEtagRef.current = remoteResult.etag || meta.etag || null;
              const timeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
              setLastDriveSyncTime(timeStr);
              localStorage.setItem('posvenecia_last_drive_sync_time', timeStr);
              setDriveSyncStatus('synced');
            }
          }
        }
      });
    } catch (e: any) {
      console.warn('Multi-device background check error:', e);
      if (e instanceof GoogleDriveAuthError || e?.isExpired || isGoogleTokenExpired()) {
        setDriveSyncStatus('token_expired');
      }
    } finally {
      isCheckingRemoteRef.current = false;
    }
  }, [buildCurrentPayload, saveScopedLocalStorage]);

  /**
   * Robust Database Restore function from JSON backup:
   * Restores all data into React state, scoped IndexedDB and LocalStorage,
   * and synchronizes to Google Drive without silent overwrites.
   */
  const restoreDatabase = useCallback(async (payload: any): Promise<boolean> => {
    if (!payload || !payload.products || !payload.sales) {
      throw new Error('El archivo no tiene el formato de copia de seguridad válido de PosVenecia.');
    }

    const newProducts = payload.products || [];
    const newSales = payload.sales || [];
    const newExpenses = payload.expenses || [];
    const newFiados = payload.fiados || [];
    const newClients = payload.clients || [];
    const newCPP = payload.cuentasPorPagar || [];
    const newGastos = payload.gastosOperativos || [];
    const newBusiness = payload.businessInfo || DEFAULT_BUSINESS_INFO;
    const newCategories = payload.customCategories || [];
    const newCashShift = payload.cashShift !== undefined ? payload.cashShift : null;
    const newShiftHistory = payload.cashShiftHistory || [];

    setProducts(newProducts);
    setSales(newSales);
    setExpenses(newExpenses);
    setFiados(newFiados);
    setClients(newClients);
    setCuentasPorPagar(newCPP);
    setGastosOperativos(newGastos);
    setBusinessInfo(newBusiness);
    setCustomCategories(newCategories);
    setCashShift(newCashShift);
    setCashShiftHistory(newShiftHistory);

    if (payload.bcvRate) setBcvRateState(payload.bcvRate);
    if (payload.bcvEuroRate) setBcvEuroRateState(payload.bcvEuroRate);

    const uid = latestDataRef.current.googleUser?.uid;
    saveScopedLocalStorage(uid, {
      products: newProducts,
      sales: newSales,
      expenses: newExpenses,
      fiados: newFiados,
      clients: newClients,
      cuentasPorPagar: newCPP,
      gastosOperativos: newGastos,
      businessInfo: newBusiness,
      customCategories: newCategories,
      cashShift: newCashShift,
      cashShiftHistory: newShiftHistory
    });

    const token = getGoogleAccessToken();
    if (token && latestDataRef.current.googleUser?.isConnected) {
      const drivePayload: AppDatabasePayload = {
        version: '2.0',
        updatedAt: new Date().toISOString(),
        userEmail: latestDataRef.current.googleUser.email,
        userUid: latestDataRef.current.googleUser.uid,
        businessInfo: newBusiness,
        bcvRate: payload.bcvRate || bcvRate,
        bcvEuroRate: payload.bcvEuroRate || bcvEuroRate,
        products: newProducts,
        sales: newSales,
        expenses: newExpenses,
        fiados: newFiados,
        cuentasPorPagar: newCPP,
        gastosOperativos: newGastos,
        clients: newClients,
        cashShift: newCashShift,
        cashShiftHistory: newShiftHistory
      };
      await saveDatabaseToDrive(token, drivePayload).catch(e => console.warn('Error saving restored backup to Drive:', e));
    }

    return true;
  }, [bcvRate, bcvEuroRate, saveScopedLocalStorage]);


  // Keep stable refs to avoid re-running initAuth
  const loadScopedLocalStorageRef = useRef(loadScopedLocalStorage);
  loadScopedLocalStorageRef.current = loadScopedLocalStorage;
  const saveScopedLocalStorageRef = useRef(saveScopedLocalStorage);
  saveScopedLocalStorageRef.current = saveScopedLocalStorage;
  const buildCurrentPayloadRef = useRef(buildCurrentPayload);
  buildCurrentPayloadRef.current = buildCurrentPayload;

  const attachRealtimeSync = useCallback((uid: string) => {
    const businessId = getCanonicalBusinessId(uid);
    // Prevent redundant tear-down and duplicate listener attachment when loginWithGoogle & onAuthStateChanged fire together
    if (activeFirestoreUidRef.current === businessId && firestoreUnsubRef.current) {
      return;
    }

    if (firestoreUnsubRef.current) {
      firestoreUnsubRef.current();
      firestoreUnsubRef.current = null;
    }

    activeFirestoreUidRef.current = businessId;
    setFirestoreSyncStatus('syncing');

    firestoreUnsubRef.current = subscribeToStoreRealtime(businessId, {
      onProducts: (newProds) => {
        hasReceivedFirestoreDataRef.current = true;
        setProducts(newProds);
        saveOfflineProducts(newProds).catch(e => console.warn('Cache products in IndexedDB:', e));
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
        devLog(`[PosVenecia Realtime] Caja sincronizada en tiempo real: ${status.isOpen ? 'ABIERTA' : 'CERRADA'}`);
        setCashShift(status.activeShift || null);
      },
      onMetadata: (metadata) => {
        if (metadata.businessInfo) setBusinessInfo(metadata.businessInfo);
        if (metadata.bcvRate) setBcvRateState(metadata.bcvRate);
        if (metadata.bcvEuroRate) setBcvEuroRateState(metadata.bcvEuroRate);
        if (metadata.activeCashShift !== undefined) setCashShift(metadata.activeCashShift);
        if (metadata.customCategories) setCustomCategories(metadata.customCategories);
      },
      onError: (err) => {
        console.warn('[PosVenecia Firestore Realtime] Error:', err);
        setFirestoreSyncStatus('error');
      }
    });
    setFirestoreSyncStatus('synced');

    // Migrate existing local catalog to Firestore if the cloud store is newly created
    const curPayload = buildCurrentPayloadRef.current();
    checkAndMigrateLocalDataToFirestore(uid, {
      products: curPayload.products,
      sales: curPayload.sales,
      expenses: curPayload.expenses,
      fiados: curPayload.fiados,
      clients: curPayload.clients,
      cuentasPorPagar: curPayload.cuentasPorPagar,
      gastosOperativos: curPayload.gastosOperativos,
      cashShiftHistory: curPayload.cashShiftHistory || [],
      businessInfo: curPayload.businessInfo,
      bcvRate: curPayload.bcvRate,
      bcvEuroRate: curPayload.bcvEuroRate,
      cashShift: curPayload.cashShift
    }).catch(e => console.warn('Firestore initial migration check:', e));
  }, []);

  /**
   * Firebase Auth initialization and real-time Firestore synchronization on mount (Strictly single-mount listener)
   */
  useEffect(() => {
    const unsubscribe = initAuth(async (firebaseUser, token) => {
      setIsAuthLoading(false);

      if (firebaseUser) {
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

        // First load any local cached records for this specific user if not already hydrated
        if (activeFirestoreUidRef.current !== firebaseUser.uid) {
          loadScopedLocalStorageRef.current(firebaseUser.uid);
        }
        isDataLoadedRef.current = true;

        // Attach real-time Firestore subscription (deduplicated)
        attachRealtimeSync(firebaseUser.uid);

        setDriveSyncStatus(token ? 'synced' : 'token_expired');
      } else {
        if (firestoreUnsubRef.current) {
          firestoreUnsubRef.current();
          firestoreUnsubRef.current = null;
        }
        activeFirestoreUidRef.current = null;
        hasReceivedFirestoreDataRef.current = false;
        setGoogleUser(null);
        setFirestoreSyncStatus('unauthenticated');
        setDriveSyncStatus('unauthenticated');
        if (!isDataLoadedRef.current) {
          loadScopedLocalStorageRef.current(undefined);
          isDataLoadedRef.current = true;
        }
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
  }, [attachRealtimeSync]); // Run ONLY once on mount!

  /**
   * Save local fast-cache (localStorage + IndexedDB) on state changes for offline reliability (debounced to keep main thread snappy)
   */
  useEffect(() => {
    if (!isDataLoadedRef.current || !googleUser?.uid) return;

    const uid = googleUser.uid;
    const timerId = window.setTimeout(() => {
      saveScopedLocalStorage(uid, {
        products,
        sales,
        expenses,
        fiados,
        clients,
        cuentasPorPagar,
        gastosOperativos,
        businessInfo,
        customCategories,
        cashShift,
        cashShiftHistory
      });
    }, 350);

    return () => window.clearTimeout(timerId);
  }, [
    products, 
    sales, 
    expenses, 
    fiados, 
    clients, 
    cuentasPorPagar, 
    gastosOperativos, 
    businessInfo, 
    customCategories, 
    cashShift, 
    cashShiftHistory,
    googleUser?.uid, 
    saveScopedLocalStorage
  ]);

  /**
   * Google Sign-in flow handler:
   * Logs in with Google, attaches Firestore real-time listeners (deduplicated with initAuth), and starts session
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

      // Connect Firestore real-time listeners (idempotent if onAuthStateChanged fires alongside)
      attachRealtimeSync(user.uid);

      setIsSessionStarted(true);
      localStorage.setItem('posvenecia_session_started', 'true');
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
   * Guarantees that all in-flight and pending queued Firestore transactions (sales, stock deductions, shifts)
   * are confirmed in Cloud Firestore BEFORE disconnecting auth credentials, preventing sale loss and resetting stats to zero.
   * Preserves catalog and sales in local storage without wiping to empty arrays.
   */
  const logoutGoogle = async () => {
    try {
      const businessId = auth.currentUser?.uid || googleUser?.uid;
      if (businessId) {
        setFirestoreSyncStatus('syncing');
        // 1. Wait for all in-flight Cloud Firestore promises to complete
        await waitForAllPendingWrites();
        // 2. Flush any pending offline queue items directly to Cloud Firestore
        await flushPendingQueueToFirestore(businessId);
        // 3. Confirm all flush writes have completed
        await waitForAllPendingWrites();
      }

      // 4. Detach real-time listeners BEFORE terminating credentials
      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
        firestoreUnsubRef.current = null;
      }
      activeFirestoreUidRef.current = null;
      hasReceivedFirestoreDataRef.current = false;
      await logOutGoogle();
    } catch (err) {
      console.warn('Logout error from Firebase auth:', err);
    } finally {
      activeFirestoreUidRef.current = null;
      hasReceivedFirestoreDataRef.current = false;
      setGoogleUser(null);
      setFirestoreSyncStatus('unauthenticated');
      setDriveSyncStatus('unauthenticated');
      setIsSessionStarted(false);
      localStorage.removeItem('posvenecia_session_started');
      // Store inventory and sales are PRESERVED on this device!
      setSelectedClientForPOS(null);
      setCart([]);
      setLastCompletedSale(null);
      // Close open modals
      setIsGoogleModalOpen(false);
      setIsProfileModalOpen(false);
      setIsAperturaModalOpen(false);
      setIsCierreModalOpen(false);
      setIsCuadreModalOpen(false);
    }
  };

  // Business Info updates
  const updateBusinessInfo = (info: Partial<BusinessInfo>) => {
    setBusinessInfo(prev => ({ ...prev, ...info }));
  };

  // Categories helper
  const addCategory = (newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (!customCategories.includes(trimmed)) {
      setCustomCategories(prev => [...prev, trimmed]);
    }
  };

  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...customCategories,
    ...products.map(p => p.category)
  ])).filter(Boolean);

  // Product CRUD with real-time Firestore sync
  const addProduct = (prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: 'prod-' + Date.now()
    };
    setProducts(prev => [newProd, ...prev]);
    saveOfflineProducts([newProd]).catch(e => console.warn('Cache product to IndexedDB:', e));

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveProductToFirestore(businessId, newProd).then(() => {
        devLog('[PosVenecia Firestore] Producto creado en Cloud Firestore:', newProd.id);
      }).catch(e => {
        console.error('[PosVenecia Firestore] Error en addProduct:', e);
      });
    } else {
      console.warn('[PosVenecia Firestore] No hay sesión autenticada. Producto almacenado en caché local.');
    }
  };

  const updateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    saveOfflineProducts([updated]).catch(e => console.warn('Cache updated product in IndexedDB:', e));

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveProductToFirestore(businessId, updated).then(() => {
        devLog('[PosVenecia Firestore] Producto actualizado en Cloud Firestore:', updated.id);
      }).catch(e => {
        console.error('[PosVenecia Firestore] Error en updateProduct:', e);
      });
    }
  };

  const deleteProduct = (id: string) => {
    tombstonesRef.current.deletedProductIds = [
      ...(tombstonesRef.current.deletedProductIds || []),
      id
    ];
    setProducts(prev => prev.filter(p => p.id !== id));

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteProductFromFirestore(businessId, id).then(() => {
        devLog('[PosVenecia Firestore] Producto eliminado de Cloud Firestore:', id);
      }).catch(e => {
        console.error('[PosVenecia Firestore] Error en deleteProduct:', e);
      });
    }
  };

  const adjustStock = (id: string, newStock: number): boolean => {
    let found = false;
    const safeStock = Math.max(0, newStock);
    setProducts(prev => {
      const exists = prev.some(p => p.id === id);
      if (!exists) {
        console.warn(`[PosVenecia] adjustStock: No se encontró el producto con ID "${id}". Puede haber sido eliminado.`);
        return prev;
      }
      found = true;
      return prev.map(p => p.id === id ? { ...p, stock: safeStock } : p);
    });

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (found && businessId) {
      adjustProductStockInFirestore(businessId, id, safeStock).then(() => {
        devLog(`[PosVenecia Firestore] Stock de ${id} ajustado en Cloud Firestore: ${safeStock}`);
      }).catch(e => {
        console.error('[PosVenecia Firestore] Error en adjustProductStock:', e);
      });
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
    // Only save to permanent catalog if explicitly requested, preventing catalog pollution from one-off delivery/surcharges
    if (serviceData.saveToCatalog) {
      setProducts(prev => [serviceProduct, ...prev]);
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
    if (cart.length === 0) {
      throw new Error('El carrito de compras está vacío.');
    }

    if (!cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para iniciar la jornada y procesar ventas.');
    }

    // Double-submit protection: reject concurrent executions
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

      // Multi-device terminal-scoped invoice numbering (e.g. FACT-C1-000048 vs FACT-C2-000048)
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

      // Consolidate deductions by productId to guarantee each product is deducted exactly once
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

      // Deduct physical inventory in local state optimistically (EXACTLY ONCE)
      // Note: We do NOT call adjustStock() here because adjustStock() triggers an independent network write
      // to Firestore, which would result in a double deduction when combined with saveSaleAtomic() in Firestore!
      if (stockDeductions.length > 0) {
        setProducts(prevProducts => {
          const updated = prevProducts.map(prod => {
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
          });
          saveOfflineProducts(updated).catch(e => console.warn('Cache updated products in IndexedDB:', e));
          return updated;
        });
      }

      // Record Fiado if credit
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

      // Persist immediately in IndexedDB for Offline-First architecture
      saveOfflineSale(newSale).catch(e => console.error('Error saving sale to IndexedDB:', e));

      // Save atomically in Firebase Firestore in real time for instant multi-device reflection!
      const businessId = auth.currentUser?.uid || googleUser?.uid;
      if (businessId) {
        saveSaleAtomic(businessId, newSale, stockDeductions, createdFiado).then(() => {
          devLog(`[PosVenecia Firestore] Venta ${newSale.invoiceNumber} sincronizada y confirmada en Firestore.`);
          // Mark sale as synced and purge from sync queue
          removeSyncItemBySaleId(newSale.id).catch(err => console.warn('Remove sync item error:', err));
          setSales(prev => prev.map(s => s.id === newSale.id ? { ...s, syncStatus: 'synced' } : s));
        }).catch(e => {
          console.error('Firestore atomic sale error:', e);
        });
      }

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

    // Track tombstone so subsequent remote pulls or other devices do not revert the cancellation
    tombstonesRef.current.canceledSaleIds = [
      ...(tombstonesRef.current.canceledSaleIds || []),
      saleId
    ];

    // 1. Mark sale status as 'anulada'
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'anulada' } : s));

    // 2. Restore stock for physical items
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

    // 3. Void/cancel associated Fiado debt
    const associatedFiado = fiados.find(f => f.saleId === saleId);
    setFiados(prevFiados => prevFiados.filter(f => f.saleId !== saleId));

    // 4. Cancel atomically in Firebase Firestore in real time!
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      const stockRestorations = (targetSale.items || [])
        .filter(item => !item.product.isService && item.product.itemType !== 'servicio')
        .map(item => ({ productId: item.product.id, quantity: item.quantity }));
      cancelSaleAtomic(businessId, targetSale, stockRestorations, associatedFiado?.id).then(() => {
        devLog(`[PosVenecia Firestore] Venta ${targetSale.invoiceNumber} anulada en Firestore.`);
      }).catch(e => {
        console.error('Firestore atomic cancelSale error:', e);
      });
    }
  };

  const updateSale = (updatedSale: Sale) => {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    setLastCompletedSale(prev => prev?.id === updatedSale.id ? updatedSale : prev);
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveSaleAtomic(businessId, updatedSale, []).catch(e => console.error('Firestore updateSale error:', e));
    }
  };

  const deleteSale = (saleId: string, restoreStock: boolean = false) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return;

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
          saveOfflineProducts(updated).catch(() => {});
          const businessId = auth.currentUser?.uid || googleUser?.uid;
          if (businessId) {
            updated.forEach(p => {
              if (restorationMap.has(p.id)) {
                saveProductToFirestore(businessId, p).catch(() => {});
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

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteSaleFromFirestore(businessId, saleId).catch(e => console.error('Firestore deleteSale error:', e));
    }
  };

  const deleteCreditNote = (id: string) => {
    setCreditNotes(prev => prev.filter(nc => nc.id !== id));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteCreditNoteFromFirestore(businessId, id).catch(e => console.error('Firestore deleteCreditNote error:', e));
    }
  };

  const deleteInventoryDischarge = (id: string) => {
    setInventoryDischarges(prev => prev.filter(d => d.id !== id));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteInventoryDischargeFromFirestore(businessId, id).catch(e => console.error('Firestore deleteInventoryDischarge error:', e));
    }
  };

  // Ref for double-submit protection on credit note creation
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

      // Calculate refunded totals and items
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

        // Only restore physical inventory items (non-services)
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

      // Proportional IVA & IGTF calculation
      const originalSubtotal = originalSale.subtotalUSD > 0 ? originalSale.subtotalUSD : 1;
      const refundRatio = Math.min(1, refundedSubtotalUSD / originalSubtotal);
      const refundedIvaUSD = originalSale.ivaUSD ? Number((originalSale.ivaUSD * refundRatio).toFixed(2)) : 0;
      const refundedIgtfUSD = originalSale.igtfUSD ? Number((originalSale.igtfUSD * refundRatio).toFixed(2)) : 0;
      const refundedTotalUSD = Number((refundedSubtotalUSD + refundedIvaUSD + refundedIgtfUSD).toFixed(2));

      const bcv = originalSale.bcvRate || bcvRate;
      const refundedTotalBs = Number((refundedTotalUSD * bcv).toFixed(2));

      // Sequential numbering for credit note
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

      // 1. Optimistically update local states:
      // a. Restock products in local state
      if (stockRestorations.length > 0) {
        setProducts(prevProducts => {
          const map = new Map(stockRestorations.map(s => [s.productId, s.quantity]));
          const updated = prevProducts.map(p => {
            const addQty = map.get(p.id);
            if (addQty && addQty > 0) {
              return { ...p, stock: p.stock + addQty };
            }
            return p;
          });
          saveOfflineProducts(updated).catch(e => console.warn('Cache updated products in IndexedDB:', e));
          return updated;
        });
      }

      // b. Update original sale status and refunded total
      const updatedOriginalSale: Sale = {
        ...originalSale,
        status: 'devuelta',
        creditNoteId: newCreditNote.id,
        refundedUSD: (originalSale.refundedUSD || 0) + refundedTotalUSD
      };
      setSales(prev => prev.map(s => s.id === originalSale.id ? updatedOriginalSale : s));

      // c. Add credit note to state
      setCreditNotes(prev => [newCreditNote, ...prev]);
      setLastCompletedCreditNote(newCreditNote);

      // 2. Persist in Firestore atomically
      const businessId = auth.currentUser?.uid || googleUser?.uid;
      if (businessId) {
        await saveCreditNoteAtomic(businessId, newCreditNote, stockRestorations, updatedOriginalSale);
        devLog(`[PosVenecia Firestore] Nota de Crédito ${newCreditNote.creditNoteNumber} guardada atómicamente.`);
      }

      return newCreditNote;
    } finally {
      setTimeout(() => {
        isCreatingCreditNoteRef.current = false;
      }, 500);
    }
  };

  // Ref for double-submit protection on inventory discharge
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

      // Sequential discharge code
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

      // Associated operational loss / expense in GastoOperativo
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

      // 1. Optimistically deduct in local state
      setProducts(prev => {
        const updated = prev.map(p => p.id === product.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p);
        saveOfflineProducts(updated).catch(e => console.warn('Cache updated products in IndexedDB:', e));
        return updated;
      });
      setInventoryDischarges(prev => [discharge, ...prev]);
      setGastosOperativos(prev => [lossExpense, ...prev]);
      setLastCompletedDischarge(discharge);

      // 2. Persist in Firestore atomically
      const businessId = auth.currentUser?.uid || googleUser?.uid;
      if (businessId) {
        await saveInventoryDischargeAtomic(businessId, discharge, lossExpense);
        devLog(`[PosVenecia Firestore] Desincorporación ${discharge.dischargeNumber} procesada atómicamente.`);
      }

      return discharge;
    } finally {
      setTimeout(() => {
        isCreatingDischargeRef.current = false;
      }, 500);
    }
  };

  // Expenses & Purchases operations (Libro de Compras e Integración con Inventario)
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

    // If purchase has purchased items, process inventory stock and cost/price strategy
    if (newExp.items && newExp.items.length > 0) {
      setProducts(prevProducts => {
        const productMap = new Map(prevProducts.map(p => [p.id, { ...p }]));
        const impacted: Product[] = [];

        for (const item of newExp.items!) {
          const prod = productMap.get(item.productId);
          if (!prod) continue;

          const incomingQty = Math.max(0, item.quantity);
          const incomingCostUSD = Math.max(0, item.unitCostUSD);

          // 1. Physical stock always increases
          const previousStock = prod.stock || 0;
          const newStock = previousStock + incomingQty;
          prod.stock = newStock;

          // 2. Evaluate Strategy
          if (item.strategy === 'fifo') {
            // Opción 1: Mantener Lotes Separados (FIFO)
            // Suma stock físico al inventario pero respeta el precio de venta actual del producto
            // hasta que se agoten las unidades previas (normativa de precios justos).
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
            // Opción 2: Actualizar Costo y Precio (Costo Promedio / Nuevo Lote)
            // Suma el stock y recalcula automáticamente el precio de venta usando el nuevo costo unitario
            // y aplicando el margen de ganancia guardado en el producto.
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
        const nextProducts = Array.from(productMap.values());
        saveOfflineProducts(nextProducts).catch(e => console.warn('Cache updated products in IndexedDB:', e));
        return nextProducts;
      });
    }

    setExpenses(prev => [newExp, ...prev]);

    // Persist immediately in IndexedDB for Offline-First architecture
    saveOfflineExpense(newExp).catch(e => console.error('Error saving expense to IndexedDB:', e));

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      if (updatedProductsList.length > 0) {
        saveExpenseWithInventoryAtomic(businessId, newExp, updatedProductsList).catch(e =>
          console.error('Firestore atomic saveExpenseWithInventoryAtomic error:', e)
        );
      } else {
        saveExpenseToFirestore(businessId, newExp).catch(e =>
          console.error('Firestore addExpense error:', e)
        );
      }
    }
  };

  const updateExpense = (updated: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
    saveOfflineExpense(updated).catch(e => console.error('Error updating expense in IndexedDB:', e));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveExpenseToFirestore(businessId, updated).catch(e => console.error('Firestore updateExpense error:', e));
    }
  };

  const deleteExpense = (id: string) => {
    tombstonesRef.current.deletedExpenseIds = [
      ...(tombstonesRef.current.deletedExpenseIds || []),
      id
    ];
    setExpenses(prev => prev.filter(e => e.id !== id));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteExpenseFromFirestore(businessId, id).catch(e => console.error('Firestore deleteExpense error:', e));
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
        const businessId = auth.currentUser?.uid || googleUser?.uid;
        if (businessId) {
          saveFiadoToFirestore(businessId, updatedFiado).catch(e => console.error('Firestore fiado abono error:', e));
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
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveFiadoToFirestore(businessId, newFiado).catch(e => console.error('Firestore createManualFiado error:', e));
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
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveCuentaPorPagarToFirestore(businessId, newCuenta).catch(e => console.error('Firestore addCuentaPorPagar error:', e));
    }
  };

  const updateCuentaPorPagar = (updated: CuentaPorPagar) => {
    setCuentasPorPagar(prev => prev.map(c => c.id === updated.id ? updated : c));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveCuentaPorPagarToFirestore(businessId, updated).catch(e => console.error('Firestore updateCuentaPorPagar error:', e));
    }
  };

  const deleteCuentaPorPagar = (id: string) => {
    tombstonesRef.current.deletedCuentaIds = [
      ...(tombstonesRef.current.deletedCuentaIds || []),
      id
    ];
    setCuentasPorPagar(prev => prev.filter(c => c.id !== id));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteCuentaPorPagarFromFirestore(businessId, id).catch(e => console.error('Firestore deleteCuentaPorPagar error:', e));
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

    // Generate cash outflow Expense for daily cash flow accuracy
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
    saveOfflineExpense(cashOutflowExpense).catch(() => {});

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveCuentaWithCashOutflowAtomic(businessId, updatedCuenta, cashOutflowExpense).catch(e =>
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
      saveOfflineExpense(cashOutflowExpense).catch(() => {});
    }

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      if (cashOutflowExpense) {
        saveGastoWithCashOutflowAtomic(businessId, newGasto, cashOutflowExpense).catch(e =>
          console.error('Firestore addGastoOperativo atomic error:', e)
        );
      } else {
        saveGastoOperativoToFirestore(businessId, newGasto).catch(e =>
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
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveGastoOperativoToFirestore(businessId, normalizedGasto).catch(e => console.error('Firestore updateGastoOperativo error:', e));
    }
  };

  const deleteGastoOperativo = (id: string) => {
    tombstonesRef.current.deletedGastoIds = [
      ...(tombstonesRef.current.deletedGastoIds || []),
      id
    ];
    setGastosOperativos(prev => prev.filter(g => g.id !== id));
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteGastoOperativoFromFirestore(businessId, id).catch(e => console.error('Firestore deleteGastoOperativo error:', e));
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

    // Create cash outflow Expense so daily cash flow / cuadre / cierre reflects exact payment amount
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
    saveOfflineExpense(cashOutflowExpense).catch(() => {});

    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveGastoWithCashOutflowAtomic(businessId, updatedGasto, cashOutflowExpense).catch(e =>
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
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveClientToFirestore(businessId, newClient).catch(e => console.error('Firestore addClient error:', e));
    }
    return newClient;
  };

  const updateClient = (updated: Client) => {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedClientForPOS?.id === updated.id) {
      setSelectedClientForPOS(updated);
    }
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      saveClientToFirestore(businessId, updated).catch(e => console.error('Firestore updateClient error:', e));
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
    const businessId = auth.currentUser?.uid || googleUser?.uid;
    if (businessId) {
      deleteClientFromFirestore(businessId, id).catch(e => console.error('Firestore deleteClient error:', e));
    }
  };

  /**
   * Factory Reset: Arrancar de 0 limpiando todos los datos del usuario actual
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

    if (googleUser?.uid) {
      saveScopedLocalStorage(googleUser.uid, {
        products: [],
        sales: [],
        expenses: [],
        fiados: [],
        clients: [],
        cuentasPorPagar: [],
        gastosOperativos: [],
        businessInfo: DEFAULT_BUSINESS_INFO,
        customCategories: [],
        cashShift: null,
        cashShiftHistory: []
      });

      // Also sync empty database to Drive
      const token = getGoogleAccessToken();
      if (token) {
        const blankPayload: AppDatabasePayload = {
          version: '2.0',
          updatedAt: new Date().toISOString(),
          userEmail: googleUser.email,
          userUid: googleUser.uid,
          businessInfo: DEFAULT_BUSINESS_INFO,
          bcvRate,
          bcvEuroRate,
          products: [],
          sales: [],
          expenses: [],
          fiados: [],
          cuentasPorPagar: [],
          gastosOperativos: [],
          clients: []
        };
        saveDatabaseToDrive(token, blankPayload).catch(e => console.warn(e));
      }
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
        isSessionStarted,
        startLocalSession,
        isOnline,
        isSyncingOffline,
        pendingOfflineCount,
        syncOfflineData,
        offlineSyncNotification,
        dismissOfflineNotification,
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
