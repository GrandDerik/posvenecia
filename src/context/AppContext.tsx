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
  GoogleAccount,
  CashShift,
  AppTheme,
  BankInitialBalance
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
  syncPendingOfflineData
} from '../services/indexedDBService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export type DriveSyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unauthenticated' | 'token_expired';

interface AppContextType {
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
  lastCompletedSale: Sale | null;
  setLastCompletedSale: (sale: Sale | null) => void;
  
  // Expenses / Purchases (Libro de Compras)
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => void;
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
  markGastoOperativoPagado: (id: string, paymentMethod: PaymentMethod, reference?: string) => void;

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

  // Network Status and Automatic Offline-First Queue Sync
  const handleReconnected = useCallback((syncedCount: number) => {
    if (syncedCount > 0) {
      setOfflineSyncNotification(
        `¡Conexión restablecida! Se han sincronizado automáticamente ${syncedCount} operaciones con Google Drive.`
      );
      setTimeout(() => setOfflineSyncNotification(null), 6000);
    }
  }, []);

  const executeCloudSyncCallback = useCallback(() => {
    return syncToGoogleDriveRef.current();
  }, []);

  const {
    isOnline,
    isSyncing: isSyncingOffline,
    pendingCount: pendingOfflineCount,
    triggerSync: syncOfflineData
  } = useNetworkStatus(handleReconnected, executeCloudSyncCallback);

  // Initialize IndexedDB on mount
  useEffect(() => {
    initIndexedDB().catch(err => console.error('IndexedDB init error:', err));
  }, []);

  // Ref to track if user data has loaded from Drive or local scope to avoid overwriting
  const isDataLoadedRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [googleUser?.name]);

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

    return closedShift;
  }, [cashShift, sales, expenses, googleUser?.name]);

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

    // Deep asynchronous hydration from IndexedDB with master fallback
    loadAppStateFromIndexedDB(scope).then(async (idbData) => {
      let finalData = idbData;
      if (!finalData || (!finalData.products?.length && !finalData.sales?.length)) {
        finalData = (await loadAppStateFromIndexedDB('master')) || (await loadAppStateFromIndexedDB('guest'));
      }
      if (finalData) {
        if (finalData.products && Array.isArray(finalData.products) && finalData.products.length > 0) {
          setProducts(prev => prev.length > 0 ? prev : finalData.products);
        }
        if (finalData.sales && Array.isArray(finalData.sales) && finalData.sales.length > 0) {
          setSales(prev => prev.length > 0 ? prev : finalData.sales);
        }
        if (finalData.expenses && Array.isArray(finalData.expenses) && finalData.expenses.length > 0) {
          setExpenses(prev => prev.length > 0 ? prev : finalData.expenses);
        }
        if (finalData.fiados && Array.isArray(finalData.fiados) && finalData.fiados.length > 0) {
          setFiados(prev => prev.length > 0 ? prev : finalData.fiados);
        }
        if (finalData.clients && Array.isArray(finalData.clients) && finalData.clients.length > 0) {
          setClients(prev => prev.length > 0 ? prev : finalData.clients);
        }
        if (finalData.cuentasPorPagar && Array.isArray(finalData.cuentasPorPagar) && finalData.cuentasPorPagar.length > 0) {
          setCuentasPorPagar(prev => prev.length > 0 ? prev : finalData.cuentasPorPagar);
        }
        if (finalData.gastosOperativos && Array.isArray(finalData.gastosOperativos) && finalData.gastosOperativos.length > 0) {
          setGastosOperativos(prev => prev.length > 0 ? prev : finalData.gastosOperativos);
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

  // Periodic token expiration monitor (every 60s)
  useEffect(() => {
    if (!googleUser?.isConnected) return;
    const interval = setInterval(() => {
      if (isGoogleTokenExpired()) {
        setDriveSyncStatus('token_expired');
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [googleUser?.isConnected]);

  // Keep stable refs to avoid re-running initAuth
  const loadScopedLocalStorageRef = useRef(loadScopedLocalStorage);
  loadScopedLocalStorageRef.current = loadScopedLocalStorage;
  const saveScopedLocalStorageRef = useRef(saveScopedLocalStorage);
  saveScopedLocalStorageRef.current = saveScopedLocalStorage;
  const buildCurrentPayloadRef = useRef(buildCurrentPayload);
  buildCurrentPayloadRef.current = buildCurrentPayload;

  /**
   * Firebase Auth initialization and auto-sync on mount (Strictly single-mount listener)
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
        setDriveSyncStatus(token ? 'syncing' : 'token_expired');

        // First load any local cached records for this specific user
        loadScopedLocalStorageRef.current(firebaseUser.uid);
        isDataLoadedRef.current = true;

        // If we have access token, check Google Drive for remote database file
        if (token) {
          try {
            const meta = await getRemoteDatabaseMetadata(token);
            if (meta && meta.fileId) {
              lastDriveFileIdRef.current = meta.fileId;
              const remoteRes = await readDatabaseFromDrive(token, meta.fileId);
              if (remoteRes?.data) {
                const localPayload = buildCurrentPayloadRef.current();
                const merged = mergeDatabasePayloads(localPayload, remoteRes.data);

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
                if (merged.businessInfo) setBusinessInfo(merged.businessInfo);
                if (merged.bcvRate) setBcvRateState(merged.bcvRate);
                if (merged.bcvEuroRate) setBcvEuroRateState(merged.bcvEuroRate);
                if (merged.tombstones) {
                  tombstonesRef.current = merged.tombstones;
                }

                saveScopedLocalStorageRef.current(firebaseUser.uid, {
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
                if (remoteRes.etag || meta.etag) {
                  lastRemoteEtagRef.current = remoteRes.etag || meta.etag || null;
                }
              }
            } else {
              // Remote file not created yet in Google Drive:
              // PRESERVE local products and upload them to initialize the user's cloud database!
              const localPayload = buildCurrentPayloadRef.current();
              const saveRes = await saveDatabaseToDrive(token, localPayload).catch(e => {
                console.warn('Init drive file error', e);
                return null;
              });
              if (saveRes?.fileId) {
                lastDriveFileIdRef.current = saveRes.fileId;
              }
              if (saveRes?.modifiedTime) {
                lastRemoteModifiedTimeRef.current = saveRes.modifiedTime;
              }
              if (saveRes?.etag) {
                lastRemoteEtagRef.current = saveRes.etag;
              }
            }
            setDriveSyncStatus('synced');
            setLastDriveSyncTime(new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }));
          } catch (e) {
            console.warn('Drive sync error during login:', e);
            setDriveSyncStatus('error');
          }
        }
      } else {
        // No authenticated user: clean state []
        setGoogleUser(null);
        setDriveSyncStatus('unauthenticated');
        loadScopedLocalStorageRef.current(undefined);
        isDataLoadedRef.current = true;
      }
    });

    return () => unsubscribe();
  }, []); // Run ONLY once on mount!

  /**
   * Real-time debounced auto-save to Google Drive & scoped storage
   */
  useEffect(() => {
    if (!isDataLoadedRef.current || !googleUser?.uid) return;

    // Save to local scoped storage immediately
    saveScopedLocalStorage(googleUser.uid, {
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

    // Fast debounced upload to Google Drive (1.5 seconds)
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const token = getGoogleAccessToken();
      if (token && googleUser?.isConnected) {
        syncToGoogleDrive();
      }
    }, 1500);

    // Flush pending changes immediately if user switches tabs or navigates away
    const handleVisibilityFlush = () => {
      if (document.visibilityState === 'hidden' && autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        const token = getGoogleAccessToken();
        if (token && googleUser?.isConnected) {
          syncToGoogleDrive();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityFlush);
    window.addEventListener('pagehide', handleVisibilityFlush);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityFlush);
      window.removeEventListener('pagehide', handleVisibilityFlush);
    };
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
    googleUser?.isConnected,
    saveScopedLocalStorage,
    syncToGoogleDrive
  ]);

  /**
   * Continuous multi-device polling & window focus synchronization
   */
  useEffect(() => {
    if (!googleUser?.isConnected) return;

    // Background interval: check every 7 seconds for changes from other devices
    const intervalId = setInterval(() => {
      checkRemoteChangesForMultiDevice();
    }, 7000);

    // Immediate check when tab or window gains focus or becomes visible
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        checkRemoteChangesForMultiDevice();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [googleUser?.isConnected, checkRemoteChangesForMultiDevice]);

  /**
   * Google Sign-in flow handler
   */
  const loginWithGoogle = async () => {
    try {
      setIsDriveSyncing(true);
      setDriveSyncStatus('syncing');
      const { user, accessToken } = await signInWithGoogle();
      
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

      // Check user's Google Drive for existing database
      const meta = await getRemoteDatabaseMetadata(accessToken);
      if (meta && meta.fileId) {
        lastDriveFileIdRef.current = meta.fileId;
        const remoteRes = await readDatabaseFromDrive(accessToken, meta.fileId);
        if (remoteRes?.data) {
          const localPayload = buildCurrentPayloadRef.current();
          const merged = mergeDatabasePayloads(localPayload, remoteRes.data);

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
          if (merged.businessInfo) setBusinessInfo(merged.businessInfo);
          if (merged.bcvRate) setBcvRateState(merged.bcvRate);
          if (merged.bcvEuroRate) setBcvEuroRateState(merged.bcvEuroRate);
          if (merged.tombstones) {
            tombstonesRef.current = merged.tombstones;
          }

          saveScopedLocalStorageRef.current(user.uid, {
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
          if (remoteRes.etag || meta.etag) {
            lastRemoteEtagRef.current = remoteRes.etag || meta.etag || null;
          }
        }
      } else {
        // Remote file not created yet in Google Drive:
        // PRESERVE local products and upload them to initialize the user's cloud database!
        const localPayload = buildCurrentPayloadRef.current();
        const saveRes = await saveDatabaseToDrive(accessToken, localPayload).catch(e => {
          console.warn('Init drive file error', e);
          return null;
        });
        if (saveRes?.fileId) {
          lastDriveFileIdRef.current = saveRes.fileId;
        }
        if (saveRes?.modifiedTime) {
          lastRemoteModifiedTimeRef.current = saveRes.modifiedTime;
        }
        if (saveRes?.etag) {
          lastRemoteEtagRef.current = saveRes.etag;
        }
      }

      setDriveSyncStatus('synced');
      setLastDriveSyncTime(new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }));
      setIsSessionStarted(true);
      localStorage.setItem('posvenecia_session_started', 'true');
    } catch (err: any) {
      console.error('Login error:', err);
      setDriveSyncStatus('error');
      throw err;
    } finally {
      setIsDriveSyncing(false);
    }
  };

  /**
   * Google Log-out flow handler
   * Does NOT wipe products or sales; preserves store data on the terminal while disconnecting cloud session.
   */
  const logoutGoogle = async () => {
    try {
      await logOutGoogle();
    } catch (err) {
      console.warn('Logout error from Firebase auth:', err);
    } finally {
      setGoogleUser(null);
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

  // Product CRUD
  const addProduct = (prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: 'prod-' + Date.now()
    };
    setProducts(prev => [newProd, ...prev]);
  };

  const updateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const deleteProduct = (id: string) => {
    tombstonesRef.current.deletedProductIds = [
      ...(tombstonesRef.current.deletedProductIds || []),
      id
    ];
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const adjustStock = (id: string, newStock: number): boolean => {
    let found = false;
    setProducts(prev => {
      const exists = prev.some(p => p.id === id);
      if (!exists) {
        console.warn(`[PosVenecia] adjustStock: No se encontró el producto con ID "${id}". Puede haber sido eliminado.`);
        return prev;
      }
      found = true;
      return prev.map(p => p.id === id ? { ...p, stock: Math.max(0, newStock) } : p);
    });
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

  // Sales operations
  const completeSale = (
    clientData: { name: string; rif: string; phone?: string; address?: string },
    paymentDetails: PaymentDetails
  ): Sale => {
    if (!cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para iniciar la jornada y procesar ventas.');
    }

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
      cashierName: googleUser?.name || `Caja ${terminalId}`
    };

    // Deduct physical inventory
    cart.forEach(item => {
      if (!item.product.isService && item.product.itemType !== 'servicio') {
        adjustStock(item.product.id, item.product.stock - item.quantity);
      }
    });

    // Record Fiado if credit
    if (paymentDetails.method === 'fiao' || (paymentDetails.method === 'pago_combinado' && (paymentDetails.combinedBreakdown?.fiaoRemaining || 0) > 0)) {
      const remainingDebt = paymentDetails.method === 'fiao' 
        ? (paymentDetails.fiaoRemainingUSD ?? totalUSD)
        : (paymentDetails.combinedBreakdown?.fiaoRemaining || 0);

      const newFiado: FiadoRecord = {
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
      setFiados(prev => [newFiado, ...prev]);
    }

    setSales(prev => [newSale, ...prev]);
    setLastCompletedSale(newSale);
    clearCart();

    // Persist immediately in IndexedDB for Offline-First architecture
    saveOfflineSale(newSale).catch(e => console.error('Error saving sale to IndexedDB:', e));

    return newSale;
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
    setFiados(prevFiados => prevFiados.filter(f => f.saleId !== saleId));
    // Note: Past closed shifts in cashShiftHistory remain immutable for fiscal closing integrity
  };

  const updateSale = (updatedSale: Sale) => {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    setLastCompletedSale(prev => prev?.id === updatedSale.id ? updatedSale : prev);
    // Note: Past closed shifts in cashShiftHistory remain immutable for fiscal closing integrity
  };

  // Expenses operations
  const addExpense = (expData: Omit<Expense, 'id'>) => {
    if (!cashShift?.isOpen) {
      setIsAperturaModalOpen(true);
      throw new Error('La caja se encuentra cerrada. Debe abrir la caja para registrar compras o egresos.');
    }

    const newExp: Expense = {
      ...expData,
      id: 'exp-' + Date.now()
    };
    setExpenses(prev => [newExp, ...prev]);

    // Persist immediately in IndexedDB for Offline-First architecture
    saveOfflineExpense(newExp).catch(e => console.error('Error saving expense to IndexedDB:', e));
  };

  const deleteExpense = (id: string) => {
    tombstonesRef.current.deletedExpenseIds = [
      ...(tombstonesRef.current.deletedExpenseIds || []),
      id
    ];
    setExpenses(prev => prev.filter(e => e.id !== id));
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
        return {
          ...f,
          remainingDebtUSD: newRemaining,
          status: newRemaining <= 0 ? 'saldado' : 'parcial',
          abonos: [newAbono, ...f.abonos]
        };
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
  };

  const updateCuentaPorPagar = (updated: CuentaPorPagar) => {
    setCuentasPorPagar(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const deleteCuentaPorPagar = (id: string) => {
    tombstonesRef.current.deletedCuentaIds = [
      ...(tombstonesRef.current.deletedCuentaIds || []),
      id
    ];
    setCuentasPorPagar(prev => prev.filter(c => c.id !== id));
  };

  const addAbonoToCuentaPorPagar = (cuentaId: string, amountUSD: number, method: PaymentMethod, reference?: string, notes?: string) => {
    setCuentasPorPagar(prev => prev.map(c => {
      if (c.id === cuentaId) {
        const newPaid = c.paidAmountUSD + amountUSD;
        const newRemaining = Math.max(0, c.totalAmountUSD - newPaid);
        const newAbono = {
          id: 'abono-cpp-' + Date.now(),
          date: new Date().toISOString(),
          amountUSD,
          amountBs: amountUSD * bcvRate,
          bcvRate,
          paymentMethod: method,
          reference,
          notes: notes || 'Abono realizado a proveedor'
        };

        return {
          ...c,
          paidAmountUSD: newPaid,
          remainingUSD: newRemaining,
          status: newRemaining <= 0 ? 'pagada' : 'parcial',
          abonos: [newAbono, ...c.abonos]
        };
      }
      return c;
    }));
  };

  // Gastos Operativos del Mes (Alquiler, Servicios, Eventuales)
  const addGastoOperativo = (data: Omit<GastoOperativo, 'id'>) => {
    const newGasto: GastoOperativo = {
      ...data,
      id: 'gasto-' + Date.now()
    };
    setGastosOperativos(prev => [newGasto, ...prev]);
  };

  const updateGastoOperativo = (updated: GastoOperativo) => {
    setGastosOperativos(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const deleteGastoOperativo = (id: string) => {
    tombstonesRef.current.deletedGastoIds = [
      ...(tombstonesRef.current.deletedGastoIds || []),
      id
    ];
    setGastosOperativos(prev => prev.filter(g => g.id !== id));
  };

  const markGastoOperativoPagado = (id: string, paymentMethod: PaymentMethod, reference?: string) => {
    setGastosOperativos(prev => prev.map(g => {
      if (g.id === id) {
        return {
          ...g,
          status: 'pagado',
          paymentDate: new Date().toISOString(),
          paymentMethod,
          reference
        };
      }
      return g;
    }));
  };

  // Clientes Habituales
  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: 'cli-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    setClients(prev => [newClient, ...prev]);
    return newClient;
  };

  const updateClient = (updated: Client) => {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
    if (selectedClientForPOS?.id === updated.id) {
      setSelectedClientForPOS(updated);
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
  };

  /**
   * Factory Reset: Arrancar de 0 limpiando todos los datos del usuario actual
   */
  const factoryReset = (mode: 'clean_zero' | 'restore_demo' = 'clean_zero') => {
    setProducts([]);
    setSales([]);
    setExpenses([]);
    setFiados([]);
    setClients([]);
    setCuentasPorPagar([]);
    setGastosOperativos([]);
    setSelectedClientForPOS(null);
    setCart([]);
    setLastCompletedSale(null);

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
        customCategories: []
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
        lastCompletedSale,
        setLastCompletedSale,
        expenses,
        addExpense,
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
