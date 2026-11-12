export type PaymentMethod = 
  | 'efectivo_usd' 
  | 'efectivo_bs' 
  | 'pago_movil' 
  | 'debito' 
  | 'transferencia'
  | 'pago_combinado' 
  | 'fiao' 
  | 'cashea';

export type ItemType = 'producto' | 'servicio';

export type BaseCurrency = 'USD' | 'VED';

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  costUSD: number;
  priceUSD: number;
  priceBsFixed?: number; // Precio asignado cuando la tienda opera en base Bolívares (VED)
  stock: number;
  minStock: number;
  isExemptFromIVA: boolean; // Alimentos básicos exentos de IVA según ley venezolana
  unit: string;
  imageUrl?: string;
  itemType?: ItemType; // 'producto' o 'servicio'
  isService?: boolean; // True si es copiado, impresión, redacción u otro servicio sin inventario rígido
  purchaseNote?: string; // Nota de compra opcional (fecha, factura, proveedor o nro de control)
  profitMarginPercent?: number; // Margen de ganancia porcentual guardado (ej. 30%)
  batches?: ProductBatch[]; // Lotes separados para trazabilidad FIFO (precios justos)
}

export interface ProductBatch {
  id: string;
  invoiceNumber: string;
  supplierName?: string;
  date: string;
  quantity: number;
  initialQuantity: number;
  costUSD: number;
  targetPriceUSD?: number;
}

export interface Client {
  id: string;
  name: string;
  rif: string; // V-12345678, J-12345678-0, E-..., G-...
  phone: string;
  address?: string;
  email?: string;
  creditLimitUSD?: number; // Límite para fiados
  notes?: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPriceUSD: number;
  totalUSD: number;
}

export interface PaymentDetails {
  method: PaymentMethod;
  pagoMovilRef?: string;
  pagoMovilBank?: string;
  pagoMovilPhone?: string;
  pagoMovilCI?: string;
  pagoMovilAccountName?: string;
  debitoRef?: string;
  debitoBank?: string;
  posTerminalName?: string;
  transferenciaRef?: string;
  transferenciaBank?: string;
  transferenciaAccount?: string;
  fiaoClientId?: string;
  fiaoClientName?: string;
  fiaoClientCI?: string;
  fiaoClientPhone?: string;
  fiaoClientAddress?: string;
  fiaoInitialAbonoUSD?: number;
  fiaoInitialAbonoBs?: number;
  fiaoRemainingUSD?: number;
  casheaInstallments?: number;
  combinedBreakdown?: {
    usdCash?: number;
    bsCash?: number;
    pagoMovil?: number;
    pagoMovilRef?: string;
    pagoMovilBank?: string;
    pagoMovilPhone?: string;
    debito?: number;
    debitoRef?: string;
    debitoBank?: string;
    fiaoRemaining?: number;
    transferencia?: number;
    transferenciaRef?: string;
    transferenciaBank?: string;
    notes?: string;
  };
}

export interface Sale {
  id: string;
  date: string; // ISO string
  invoiceNumber: string; // Ej: FACT-000342
  controlNumber: string; // Ej: 00-00342 (Control SENIAT)
  clientName: string;
  clientRIF: string; // V-12345678 o J-30492819-0
  clientPhone?: string;
  clientAddress?: string;
  items: CartItem[];
  subtotalUSD: number;
  exemptUSD: number;
  taxableUSD: number;
  ivaUSD: number;
  igtfUSD: number; // 3% on Cash USD
  totalUSD: number;
  bcvRate: number;
  subtotalBs: number;
  exemptBs: number;
  taxableBs: number;
  ivaBs: number;
  igtfBs: number;
  totalBs: number;
  paymentMethod: PaymentMethod;
  paymentDetails: PaymentDetails;
  status: 'completada' | 'anulada' | 'devuelta';
  creditNoteId?: string;
  refundedUSD?: number;
  cashierName: string;
  syncStatus?: 'synced' | 'pending_sync';
}

export interface CreditNoteItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceUSD: number;
  totalUSD: number;
  isExemptFromIVA: boolean;
}

export interface CreditNote {
  id: string; // Ej: "nc-1731301234567"
  creditNoteNumber: string; // Ej: "NC-000001"
  controlNumber: string; // Ej: "00-00001" (SENIAT)
  saleId: string;
  originalInvoiceNumber: string;
  date: string; // ISO string
  clientName: string;
  clientRIF: string;
  clientPhone?: string;
  clientAddress?: string;
  items: CreditNoteItem[];
  subtotalUSD: number;
  exemptUSD: number;
  taxableUSD: number;
  ivaUSD: number;
  igtfUSD: number;
  totalUSD: number;
  subtotalBs: number;
  exemptBs: number;
  taxableBs: number;
  ivaBs: number;
  igtfBs: number;
  totalBs: number;
  bcvRate: number;
  reason: string; // Motivo de la devolución / nota de crédito
  refundMethod: PaymentMethod;
  cashierName: string;
  syncStatus?: 'synced' | 'pending_sync';
}

export type InventoryDischargeReason = 'Daño / Vencimiento' | 'Uso Interno' | 'Merma';

export interface InventoryDischarge {
  id: string; // Ej: "disc-1731301234567"
  dischargeNumber: string; // Ej: "SAL-000001"
  date: string; // ISO string
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  quantity: number;
  unitCostUSD: number;
  totalLossUSD: number;
  totalLossBs: number;
  bcvRate: number;
  reason: InventoryDischargeReason;
  notes?: string;
  responsibleName: string;
  syncStatus?: 'synced' | 'pending_sync';
}

export type PurchaseCostStrategy = 'fifo' | 'average_cost';

export interface ExpenseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCostUSD: number;
  totalCostUSD: number;
  strategy: PurchaseCostStrategy;
  previousCostUSD?: number;
  previousPriceUSD?: number;
  newPriceUSD?: number;
}

export interface Expense {
  id: string;
  date: string;
  invoiceNumber: string;
  controlNumber: string;
  supplierName: string;
  supplierRIF: string;
  description: string;
  category: 'Mercancía' | 'Servicios' | 'Alquiler' | 'Nómina' | 'Mantenimiento' | 'Otros';
  amountUSD: number;
  amountBs: number;
  baseImponibleBs: number;
  ivaBs: number;
  retencionIVABs: number; // Retención 75% o 100%
  retencionISLRBs: number;
  bcvRate: number;
  paymentMethod: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'debito' | 'transferencia';
  reference?: string;
  items?: ExpenseItem[];
  costStrategy?: PurchaseCostStrategy;
  syncStatus?: 'synced' | 'pending_sync';
}

export interface FiadoRecord {
  id: string;
  saleId: string;
  invoiceNumber: string;
  clientName: string;
  clientCI: string;
  clientPhone: string;
  clientAddress?: string;
  date: string;
  originalDebtUSD: number;
  remainingDebtUSD: number;
  notes?: string;
  status: 'pendiente' | 'parcial' | 'saldado';
  abonos: Abono[];
}

export interface Abono {
  id: string;
  date: string;
  amountUSD: number;
  amountBs: number;
  bcvRate: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface CashRegisterReport {
  date: string;
  bcvRate: number;
  salesUSD: {
    efectivo_usd: number;
    efectivo_bs: number;
    pago_movil: number;
    debito: number;
    fiao: number;
    cashea: number;
  };
  salesBs: {
    efectivo_usd: number;
    efectivo_bs: number;
    pago_movil: number;
    debito: number;
    fiao: number;
    cashea: number;
  };
  expensesUSD: {
    efectivo_usd: number;
    efectivo_bs: number;
    pago_movil: number;
    debito: number;
  };
  expensesBs: {
    efectivo_usd: number;
    efectivo_bs: number;
    pago_movil: number;
    debito: number;
  };
  totalIgtfUSD: number;
  totalIgtfBs: number;
  totalNetUSD: number;
  totalNetBs: number;
  transactionsCount: number;
}

export interface PagoMovilAccount {
  id: string;
  bank: string;
  phone: string;
  ci: string;
  holderName: string;
  isDefault?: boolean;
}

export interface POSTerminal {
  id: string;
  name: string; // Ej: "Punto Banesco Inalámbrico Caja 1"
  bank: string;
  serial?: string;
  isDefault?: boolean;
}

export interface BankAccount {
  id: string;
  bank: string;
  accountNumber: string; // 20 dígitos
  accountType: 'corriente' | 'ahorro';
  holderName: string;
  holderCI: string;
  email?: string;
  isDefault?: boolean;
}

export interface BusinessInfo {
  name: string;
  rif: string;
  phone: string;
  address: string;
  email?: string;
  instagram?: string;
  logoUrl?: string; // Data URL (base64) or external URL
  footerMessage?: string; // Ticket footer slogan/thank you message
  pagoMovilPhone: string;
  pagoMovilCI: string;
  pagoMovilBank: string;
  // Cuentas múltiples configurables:
  pagoMovilAccounts?: PagoMovilAccount[];
  posTerminals?: POSTerminal[];
  bankAccounts?: BankAccount[];
}

export interface CuentaPorPagar {
  id: string;
  supplierName: string;
  supplierRIF?: string;
  supplierPhone?: string;
  invoiceNumber: string;
  controlNumber?: string;
  date: string;
  dueDate: string;
  category: 'Mercancía' | 'Servicios' | 'Alquiler' | 'Materia Prima' | 'Mantenimiento' | 'Otros';
  description: string;
  totalAmountUSD: number;
  paidAmountUSD: number;
  remainingUSD: number;
  status: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  notes?: string;
  abonos: Abono[];
}

export type GastoOperativoCategory = 
  | 'Alquiler' 
  | 'Servicios' 
  | 'Nómina' 
  | 'Mantenimiento' 
  | 'Transporte' 
  | 'Eventual' 
  | 'Papelería' 
  | 'Pérdida por Merma / Vencimiento'
  | 'Uso Interno'
  | 'Otros';

export interface GastoOperativo {
  id: string;
  concept: string; // Ej: "Alquiler Local Comercial", "Luz Eléctrica (Corpoelec)", "Fibra Óptica Cantv", "Nómina Semanal", "Reparación Santamaría (Eventual)"
  category: GastoOperativoCategory;
  type: 'mensual_fijo' | 'eventual'; // Gasto mensual fijo recurrente vs Eventual / Imprevisto
  month: string; // Ej: "Noviembre 2026"
  date: string; // Fecha de emisión/asignación ISO
  dueDate: string; // Fecha límite de pago ISO
  amountUSD: number;
  amountBs: number;
  bcvRate: number;
  status: 'pendiente' | 'pagado';
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface GoogleAccount {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  photoUrl?: string;
  isConnected: boolean;
  lastSync?: string;
  autoSyncEnabled?: boolean;
}

export type AppTheme = 'light';

export interface BankInitialBalance {
  bankId: string;
  bankName: string;
  accountNumber: string;
  initialBalanceBs: number;
  initialBalanceUSD?: number;
  countedBalanceBs?: number;
  countedBalanceUSD?: number;
}

export interface CashShift {
  id: string;
  isOpen: boolean;
  openedAt: string;
  openedDateFormatted: string;
  closedAt?: string;
  closedDateFormatted?: string;
  initialCashUSD: number;
  initialCashBs: number;
  initialBanks?: BankInitialBalance[];
  notes?: string;
  openedBy?: string;
  expectedCashUSD?: number;
  expectedCashBs?: number;
  countedCashUSD?: number;
  countedCashBs?: number;
  differenceUSD?: number;
  differenceBs?: number;
  closedNotes?: string;
  totalSalesUSD?: number;
  totalSalesBs?: number;
  salesBreakdown?: Record<string, { usd: number; bs: number }>;
  transactionsCount?: number;
  totalExpensesUSD?: number;
  totalExpensesBs?: number;
  closedBy?: string;
}

export interface OfflineSyncItem {
  id: string;
  action: 'create_sale' | 'create_expense' | 'update_product' | 'close_shift';
  payload: any;
  timestamp: string;
  synced: boolean;
}
