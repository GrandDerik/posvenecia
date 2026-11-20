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

export type ProductPriceCurrency = 'USD' | 'EUR' | 'Bs';
export type ProductAnchorCurrency = 'USD' | 'EUR';
export type RatePriceRecalcMode = 'update_bs_upward' | 'keep_static_bs';
export type RatePriceCurrencyScope = 'auto_anchor' | 'USD' | 'EUR';

export interface RateChangeModalState {
  isOpen: boolean;
  source: 'daily_auto' | 'manual';
  previousUsdRate: number;
  newUsdRate: number;
  previousEurRate: number;
  newEurRate: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  costUSD: number;
  priceUSD: number;
  priceEUR?: number; // Ancla o equivalente exacto en Euros (€ BCV)
  priceBsFixed?: number; // Precio estático asignado en Bolívares exactos
  costBsFixed?: number; // Costo unitario asignado en Bolívares exactos
  priceCurrency?: ProductPriceCurrency; // Moneda principal en que se fijó el precio de venta
  priceAnchorCurrency?: ProductAnchorCurrency; // Divisa ancla ($ USD o € EUR) para futuros cambios de tasa BCV
  costCurrency?: 'USD' | 'Bs'; // Moneda original en que se fijó el costo unitario
  stock: number;
  minStock: number;
  isExemptFromIVA: boolean; // Alimentos básicos exentos de IVA según ley venezolana
  priceIncludesIVA?: boolean; // True si el precio de venta ya incluye el 16% de IVA (desglose SENIAT)
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
  isExemptFromIVA?: boolean; // Tratamiento fiscal individual del ítem en el carrito (E = true, G = false)
}

export interface CartDiscount {
  amount: number; // Monto exacto introducido en la moneda elegida (sin conversión inversa)
  currency: 'USD' | 'Bs';
  reason?: string;
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
  treasuryBankAccountId?: string;
  fiaoClientId?: string;
  fiaoClientName?: string;
  fiaoClientCI?: string;
  fiaoClientPhone?: string;
  fiaoClientAddress?: string;
  fiaoInitialAbonoUSD?: number;
  fiaoInitialAbonoBs?: number;
  fiaoInitialAbonoCurrency?: 'USD' | 'Bs';
  fiaoRemainingUSD?: number;
  casheaInstallments?: number;
  combinedBreakdown?: {
    usdCash?: number;
    bsCash?: number;
    pagoMovil?: number;
    pagoMovilRef?: string;
    pagoMovilBank?: string;
    pagoMovilBankAccountId?: string;
    pagoMovilPhone?: string;
    debito?: number;
    debitoRef?: string;
    debitoBank?: string;
    debitoBankAccountId?: string;
    fiaoRemaining?: number;
    transferencia?: number;
    transferenciaRef?: string;
    transferenciaBank?: string;
    transferenciaBankAccountId?: string;
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
  grossSubtotalUSD?: number;
  discountUSD?: number;
  exemptUSD: number;
  taxableUSD: number;
  ivaUSD: number;
  igtfUSD: number; // 3% on Cash USD
  totalUSD: number;
  bcvRate: number;
  subtotalBs: number;
  grossSubtotalBs?: number;
  discountBs?: number;
  discountCurrency?: 'USD' | 'Bs';
  discountReason?: string;
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
  returnedQuantities?: Record<string, number>;
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
  originalControlNumber?: string;
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
  bankAccountId?: string;
  bankAccountLabel?: string;
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
  costCurrency?: 'USD' | 'Bs';
  unitCostBs?: number;
  totalCostBs?: number;
  strategy: PurchaseCostStrategy;
  previousCostUSD?: number;
  previousPriceUSD?: number;
  newPriceUSD?: number;
  newPriceCurrency?: 'USD' | 'Bs';
  newPriceBs?: number;
}

export interface Expense {
  id: string;
  date: string;
  invoiceNumber: string;
  controlNumber: string;
  supplierId?: string;
  supplierName: string;
  supplierRIF: string;
  supplierPhone?: string;
  description: string;
  category:
    | 'Mercancía'
    | 'Servicios'
    | 'Alquiler'
    | 'Nómina'
    | 'Sueldo Propietario / Nómina'
    | 'Retiro Personal / Adelanto Dueño'
    | 'Comisión Bancaria'
    | 'Mantenimiento'
    | 'Otros';
  amountUSD: number;
  amountBs: number;
  baseImponibleBs: number;
  ivaBs: number;
  retencionIVABs: number; // Retención 75% o 100%
  retencionISLRBs: number;
  bcvRate: number;
  enteredCurrency?: 'USD' | 'Bs';
  paymentMethod: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'debito' | 'transferencia' | 'credito';
  bankAccountId?: string;
  bankAccountLabel?: string;
  treasuryAccountId?: string;
  bankFeeAmount?: number;
  bankFeeCurrency?: TreasuryCurrency;
  excludeFromLibroCompras?: boolean;
  accountingType?: 'operating_expense' | 'owner_salary' | 'owner_withdrawal';
  dueDate?: string;
  reference?: string;
  items?: ExpenseItem[];
  costStrategy?: PurchaseCostStrategy;
  linkedGastoId?: string;
  linkedCuentaId?: string;
  linkedLoanId?: string;
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
  enteredCurrency?: 'USD' | 'Bs';
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  bankAccountLabel?: string;
  treasuryAccountId?: string;
  bankFeeAmount?: number;
  bankFeeCurrency?: TreasuryCurrency;
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
  supplierId?: string;
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
  | 'Sueldo Propietario / Nómina'
  | 'Retiro Personal / Adelanto Dueño'
  | 'Comisión Bancaria'
  | 'Alquiler' 
  | 'Servicios' 
  | 'Nómina' 
  | 'Mantenimiento' 
  | 'Transporte' 
  | 'Eventual' 
  | 'Papelería' 
  | 'Insumos / Papelería'
  | 'Pérdida por Merma / Vencimiento'
  | 'Uso Interno'
  | 'Otros';

export interface GastoOperativo {
  id: string;
  concept: string; // Ej: "Alquiler Local Comercial", "Resma de Hojas y Tinta", etc.
  category: GastoOperativoCategory;
  type: 'mensual_fijo' | 'eventual'; // Gasto mensual fijo recurrente vs Eventual / Imprevisto
  month: string; // Ej: "Noviembre 2026"
  date: string; // Fecha de emisión/asignación ISO
  dueDate: string; // Fecha límite de pago ISO
  // Datos fiscales y de contacto del proveedor/emisor:
  supplierId?: string;
  supplierName?: string;
  supplierRIF?: string;
  supplierPhone?: string;
  invoiceNumber?: string;
  amountUSD: number;
  amountBs: number;
  bcvRate: number;
  enteredCurrency?: 'USD' | 'Bs';
  status: 'pendiente' | 'parcial' | 'pagado';
  paidAmountUSD?: number;
  remainingUSD?: number;
  abonos?: Abono[];
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  bankAccountId?: string;
  bankAccountLabel?: string;
  treasuryAccountId?: string;
  bankFeeAmount?: number;
  bankFeeCurrency?: TreasuryCurrency;
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
  outflowsBs?: number;
  outflowsUSD?: number;
  expectedBalanceBs?: number;
  expectedBalanceUSD?: number;
  countedBalanceBs?: number;
  countedBalanceUSD?: number;
}

export type CashOpeningDifferenceReason =
  | 'Retiro / Adelanto al Socio'
  | 'Sueldo / Nómina'
  | 'Resguardo / Caja Fuerte'
  | 'Diferencia de Conteo / Faltante'
  | 'Pago/gasto fuera de turno'
  | 'Observación de apertura'
  | 'Resguardo / Caja fuerte'
  | 'Ajuste de conteo';

export interface CashOpeningAuditMeta {
  previousShiftId?: string;
  previousCloseDateFormatted?: string;
  previousCloseCashUSD?: number;
  previousCloseCashBs?: number;
  openingDifferenceUSD?: number;
  openingDifferenceBs?: number;
  openingMatchedOutflowsUSD?: number;
  openingMatchedOutflowsBs?: number;
  openingMatchedMovementsCount?: number;
  openingDifferenceReason?: CashOpeningDifferenceReason | string;
  openingDifferenceNotes?: string;
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
  // Auditoría interna de diferencia al abrir caja vs cierre anterior (no altera libros fiscales)
  previousShiftId?: string;
  previousCloseDateFormatted?: string;
  previousCloseCashUSD?: number;
  previousCloseCashBs?: number;
  openingDifferenceUSD?: number;
  openingDifferenceBs?: number;
  openingMatchedOutflowsUSD?: number;
  openingMatchedOutflowsBs?: number;
  openingMatchedMovementsCount?: number;
  openingDifferenceReason?: CashOpeningDifferenceReason | string;
  openingDifferenceNotes?: string;
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
  totalOwnerSalaryUSD?: number;
  totalOwnerSalaryBs?: number;
  totalOwnerWithdrawalsUSD?: number;
  totalOwnerWithdrawalsBs?: number;
  totalCreditNotesUSD?: number;
  totalCreditNotesBs?: number;
  totalFiadoAbonosUSD?: number;
  totalFiadoAbonosBs?: number;
  totalLoansInflowUSD?: number;
  totalLoansInflowBs?: number;
  closedBy?: string;
}

export type KardexMovementType =
  | 'entrada_compra'
  | 'venta'
  | 'nota_credito'
  | 'merma'
  | 'ajuste_manual';

export interface KardexEntry {
  id: string;
  date: string;
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  type: KardexMovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  unitCostUSD: number;
  totalCostUSD: number;
  valuationMethod: PurchaseCostStrategy;
  fifoBalanceUSD?: number;
  avgCostUSD?: number;
  avgBalanceUSD?: number;
  reference?: string;
  notes?: string;
  userName?: string;
}

export interface Supplier {
  id: string;
  name: string;
  rif: string;
  phone: string;
  address?: string;
  email?: string;
  creditDays: number;
  accumulatedBalanceUSD: number;
  notes?: string;
  createdAt: string;
}

export type LoanCashDestination =
  | 'efectivo_usd'
  | 'efectivo_bs'
  | 'banco_pago_movil'
  | 'externo_dueno';

export type LoanStatus = 'pendiente' | 'parcial' | 'pagado' | 'vencido';

export interface LoanAbono {
  id: string;
  date: string;
  amountUSD: number;
  amountBs: number;
  bcvRate: number;
  enteredCurrency?: 'USD' | 'Bs';
  paymentMethod: PaymentMethod | 'externo_dueno';
  bankAccountId?: string;
  bankAccountLabel?: string;
  bankFeeAmount?: number;
  bankFeeCurrency?: TreasuryCurrency;
  reference?: string;
  notes?: string;
}

export interface Loan {
  id: string;
  lenderName: string;
  lenderRIF?: string;
  lenderPhone?: string;
  reference?: string;
  description?: string;
  grantDate: string; // ISO string
  dueDate: string;   // ISO string
  enteredCurrency: 'USD' | 'Bs';
  originalAmountUSD: number;
  originalAmountBs: number;
  bcvRate: number;
  paidAmountUSD: number;
  paidAmountBs: number;
  remainingUSD: number;
  remainingBs: number;
  cashDestination: LoanCashDestination;
  bankAccountId?: string;
  bankAccountLabel?: string;
  status: LoanStatus;
  notes?: string;
  abonos: LoanAbono[];
  createdAt: string;
}

export type TreasuryAccountType = 'cash_usd' | 'cash_bs' | 'bank';
export type TreasuryCurrency = 'USD' | 'Bs';

export interface TreasuryAccount {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  alias?: string;
  accountType: TreasuryAccountType;
  currency: TreasuryCurrency;
  balance: number;
  initialBalance: number;
  isSystemCash?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type TreasuryMovementType =
  | 'venta'
  | 'abono_fiado'
  | 'compra'
  | 'pago_proveedor'
  | 'gasto_operativo'
  | 'comision_bancaria'
  | 'sueldo'
  | 'retiro_personal'
  | 'prestamo'
  | 'transferencia'
  | 'ajuste_inicial'
  | 'nota_credito'
  | 'anulacion';

export interface TreasuryMovement {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  accountCurrency: TreasuryCurrency;
  direction: 'in' | 'out';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  bcvRate: number;
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
  createdBy?: string;
}
