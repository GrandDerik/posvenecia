import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TransactionsDatePreset } from '../services/firestoreSyncService';
import { 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Plus, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Printer,
  Calendar,
  Cloud,
  Archive,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Clock,
  Landmark,
  Check,
  X,
  Edit2,
  Trash2,
  Coins,
  Building2,
  Phone,
  Hash,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  Wallet
} from 'lucide-react';
import { 
  formatBs, 
  formatUSD, 
  getLocalDateStr,
  round2,
  safeDiv,
  exportLibroVentasExcel, 
  exportLibroVentasPDF, 
  exportLibroComprasExcel, 
  exportLibroComprasPDF,
  exportEstadoCuentaExcel,
  exportEstadoCuentaPDF,
  exportCierreCajaExcel,
  exportCierreCajaPDF,
  exportHistorialCierresExcel,
  exportHistorialCierresPDF,
  exportCuentasPorPagarExcel,
  exportCuentasPorPagarPDF
} from '../utils/exportUtils';
import {
  CashShift,
  Sale,
  Expense,
  CreditNote,
  InventoryDischarge,
  CuentaPorPagar,
  GastoOperativo,
  GastoOperativoCategory,
  PaymentMethod
} from '../types';
import {
  OWNER_SALARY_CATEGORY,
  OWNER_WITHDRAWAL_CATEGORY,
  isBankPaymentMethod,
  isExpenseCreditSettlement,
  isExpenseExcludedFromLibroCompras,
  isExpenseLoanRepayment,
  isExpenseOwnerSalary,
  isExpenseOwnerWithdrawal
} from '../utils/accountingUtils';
import { RegistrarGastoModal } from './RegistrarGastoModal';
import { BackupDriveModal } from './Modals/BackupDriveModal';
import { ComprobanteTicketModal } from './Modals/ComprobanteTicketModal';
import { ComprobanteNotaCreditoModal } from './Modals/ComprobanteNotaCreditoModal';
import {
  TreasuryAccountSelector,
  getDefaultBankAccount,
  formatTreasuryAccountLabel
} from './TreasuryAccountSelector';

export const ContabilidadView: React.FC = () => {
  const { 
    sales, 
    updateSale,
    deleteSale,
    expenses, 
    deleteExpense,
    bcvRate, 
    businessInfo,
    treasuryAccounts,
    cashShift,
    cashShiftHistory,
    cuentasPorPagar,
    updateCuentaPorPagar,
    deleteCuentaPorPagar,
    addAbonoToCuentaPorPagar,
    gastosOperativos,
    updateGastoOperativo,
    deleteGastoOperativo,
    markGastoOperativoPagado,
    creditNotes,
    deleteCreditNote,
    setIsCreditNoteModalOpen,
    inventoryDischarges,
    deleteInventoryDischarge,
    setIsDischargeModalOpen,
    checkRemoteChangesForMultiDevice,
    syncToGoogleDrive,
    isDriveSyncing,
    googleUser,
    transactionsPreset,
    transactionsDateRange,
    isLoadingHistory,
    setTransactionsDateFilter,
    setIsCuadreModalOpen
  } = useApp();

  const [subTab, setSubTab] = useState<'ventas' | 'compras' | 'notas_credito' | 'salidas_inventario' | 'cierres_caja' | 'cuentas_por_pagar' | 'igtf' | 'estado_cuenta'>('ventas');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Firestore Date Range & Pagination state
  const [customStartDate, setCustomStartDate] = useState<string>(transactionsDateRange?.startDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(transactionsDateRange?.endDate || '');
  const [showCustomRangePicker, setShowCustomRangePicker] = useState<boolean>(transactionsPreset === 'custom');
  const [pageSize, setPageSize] = useState<number>(25);
  const [salesPage, setSalesPage] = useState<number>(1);
  const [expensesPage, setExpensesPage] = useState<number>(1);
  const [ncPage, setNcPage] = useState<number>(1);
  const [abonoCuentaError, setAbonoCuentaError] = useState<string | null>(null);
  const [isSubmittingAbonoCuenta, setIsSubmittingAbonoCuenta] = useState(false);
  const [abonoGastoError, setAbonoGastoError] = useState<string | null>(null);
  const [isSubmittingAbonoGasto, setIsSubmittingAbonoGasto] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  useEffect(() => {
    setSalesPage(1);
    setExpensesPage(1);
    setNcPage(1);
  }, [searchTerm, subTab, transactionsPreset, transactionsDateRange, pageSize]);

  // Detail ("Ojito") Modals
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<CashShift | null>(null);
  const [selectedSaleForTicket, setSelectedSaleForTicket] = useState<Sale | null>(null);
  const [selectedExpenseForTicket, setSelectedExpenseForTicket] = useState<Expense | null>(null);
  const [selectedCreditNoteForTicket, setSelectedCreditNoteForTicket] = useState<CreditNote | null>(null);
  const [selectedDischargeForDetail, setSelectedDischargeForDetail] = useState<InventoryDischarge | null>(null);
  const [selectedCuentaForDetail, setSelectedCuentaForDetail] = useState<CuentaPorPagar | null>(null);
  const [selectedGastoForDetail, setSelectedGastoForDetail] = useState<GastoOperativo | null>(null);

  // Edit Sale Modal state
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleInvoice, setEditSaleInvoice] = useState('');
  const [editSaleControl, setEditSaleControl] = useState('');
  const [editSaleClientName, setEditSaleClientName] = useState('');
  const [editSaleClientRIF, setEditSaleClientRIF] = useState('');
  const [editSaleClientPhone, setEditSaleClientPhone] = useState('');
  const [editSaleClientAddress, setEditSaleClientAddress] = useState('');
  const [editSaleStatus, setEditSaleStatus] = useState<'completada' | 'anulada' | 'devuelta'>('completada');

  // Edit Cuenta por Pagar Modal state
  const [editingCuenta, setEditingCuenta] = useState<CuentaPorPagar | null>(null);
  const [editCuentaSupplierName, setEditCuentaSupplierName] = useState('');
  const [editCuentaSupplierRIF, setEditCuentaSupplierRIF] = useState('');
  const [editCuentaSupplierPhone, setEditCuentaSupplierPhone] = useState('');
  const [editCuentaInvoice, setEditCuentaInvoice] = useState('');
  const [editCuentaDueDate, setEditCuentaDueDate] = useState('');
  const [editCuentaTotalUSD, setEditCuentaTotalUSD] = useState('');
  const [editCuentaDescription, setEditCuentaDescription] = useState('');
  const [editCuentaNotes, setEditCuentaNotes] = useState('');

  // Abono Cuenta por Pagar Modal state
  const [cuentaForAbono, setCuentaForAbono] = useState<CuentaPorPagar | null>(null);
  const [cuentaAbonoAmount, setCuentaAbonoAmount] = useState('');
  const [cuentaAbonoMethod, setCuentaAbonoMethod] = useState<PaymentMethod>('transferencia');
  const [cuentaAbonoBankAccountId, setCuentaAbonoBankAccountId] = useState('');
  const [cuentaAbonoBankAccountLabel, setCuentaAbonoBankAccountLabel] = useState('');
  const [cuentaAbonoBankFeeInput, setCuentaAbonoBankFeeInput] = useState('');
  const [cuentaAbonoRef, setCuentaAbonoRef] = useState('');
  const [cuentaAbonoNotes, setCuentaAbonoNotes] = useState('');

  // Edit Gasto Operativo Modal state
  const [editingGastoOp, setEditingGastoOp] = useState<GastoOperativo | null>(null);
  const [editGastoConcept, setEditGastoConcept] = useState('');
  const [editGastoCategory, setEditGastoCategory] = useState<GastoOperativoCategory>('Insumos / Papelería');
  const [editGastoSupplierName, setEditGastoSupplierName] = useState('');
  const [editGastoSupplierRIF, setEditGastoSupplierRIF] = useState('');
  const [editGastoSupplierPhone, setEditGastoSupplierPhone] = useState('');
  const [editGastoInvoiceNumber, setEditGastoInvoiceNumber] = useState('');
  const [editGastoDueDate, setEditGastoDueDate] = useState('');
  const [editGastoAmountUSD, setEditGastoAmountUSD] = useState('');
  const [editGastoNotes, setEditGastoNotes] = useState('');

  // Abono / Pago Parcial Gasto Operativo Modal state
  const [gastoForAbono, setGastoForAbono] = useState<GastoOperativo | null>(null);
  const [gastoAbonoAmount, setGastoAbonoAmount] = useState('');
  const [gastoAbonoMethod, setGastoAbonoMethod] = useState<PaymentMethod>('efectivo_usd');
  const [gastoAbonoBankAccountId, setGastoAbonoBankAccountId] = useState('');
  const [gastoAbonoBankAccountLabel, setGastoAbonoBankAccountLabel] = useState('');
  const [gastoAbonoBankFeeInput, setGastoAbonoBankFeeInput] = useState('');
  const [gastoAbonoRef, setGastoAbonoRef] = useState('');
  const [gastoAbonoNotes, setGastoAbonoNotes] = useState('');

  // Unified Delete Confirmation Modal state
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'sale'; item: Sale }
    | { type: 'expense'; item: Expense }
    | { type: 'credit_note'; item: CreditNote }
    | { type: 'discharge'; item: InventoryDischarge }
    | { type: 'cuenta'; item: CuentaPorPagar }
    | { type: 'gasto_op'; item: GastoOperativo }
    | null
  >(null);
  const [restoreStockOnSaleDelete, setRestoreStockOnSaleDelete] = useState(false);

  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  const handleOpenEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditSaleInvoice(sale.invoiceNumber);
    setEditSaleControl(sale.controlNumber);
    setEditSaleClientName(sale.clientName);
    setEditSaleClientRIF(sale.clientRIF);
    setEditSaleClientPhone(sale.clientPhone || '');
    setEditSaleClientAddress(sale.clientAddress || '');
    setEditSaleStatus(sale.status);
  };

  const handleSaveEditSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    updateSale({
      ...editingSale,
      invoiceNumber: editSaleInvoice.trim() || editingSale.invoiceNumber,
      controlNumber: editSaleControl.trim() || editingSale.controlNumber,
      clientName: editSaleClientName.trim() || editingSale.clientName,
      clientRIF: editSaleClientRIF.trim().toUpperCase() || editingSale.clientRIF,
      clientPhone: editSaleClientPhone.trim(),
      clientAddress: editSaleClientAddress.trim(),
      status: editSaleStatus,
    });
    setEditingSale(null);
  };

  const handleOpenEditCuenta = (c: CuentaPorPagar) => {
    setEditingCuenta(c);
    setEditCuentaSupplierName(c.supplierName);
    setEditCuentaSupplierRIF(c.supplierRIF || '');
    setEditCuentaSupplierPhone(c.supplierPhone || '');
    setEditCuentaInvoice(c.invoiceNumber);
    setEditCuentaDueDate(c.dueDate);
    setEditCuentaTotalUSD(c.totalAmountUSD.toString());
    setEditCuentaDescription(c.description);
    setEditCuentaNotes(c.notes || '');
  };

  const handleSaveEditCuenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCuenta) return;
    const total = Math.max(0, parseFloat(editCuentaTotalUSD) || editingCuenta.totalAmountUSD);
    const remaining = Math.max(0, total - editingCuenta.paidAmountUSD);
    const status = remaining <= 0.01 ? 'pagada' : editingCuenta.paidAmountUSD > 0 ? 'parcial' : 'pendiente';
    updateCuentaPorPagar({
      ...editingCuenta,
      supplierName: editCuentaSupplierName.trim() || editingCuenta.supplierName,
      supplierRIF: editCuentaSupplierRIF.trim().toUpperCase(),
      supplierPhone: editCuentaSupplierPhone.trim(),
      invoiceNumber: editCuentaInvoice.trim() || editingCuenta.invoiceNumber,
      dueDate: editCuentaDueDate || editingCuenta.dueDate,
      totalAmountUSD: total,
      remainingUSD: remaining,
      status,
      description: editCuentaDescription.trim(),
      notes: editCuentaNotes.trim(),
    });
    setEditingCuenta(null);
  };

  const handleOpenAbonoCuenta = (c: CuentaPorPagar) => {
    setCuentaForAbono(c);
    setCuentaAbonoAmount(c.remainingUSD.toFixed(2));
    setCuentaAbonoMethod('transferencia');
    const defBank = getDefaultBankAccount(treasuryAccounts);
    setCuentaAbonoBankAccountId(defBank?.id || '');
    setCuentaAbonoBankAccountLabel(defBank ? formatTreasuryAccountLabel(defBank) : '');
    setCuentaAbonoBankFeeInput('');
    setCuentaAbonoRef('');
    setCuentaAbonoNotes('');
    setAbonoCuentaError(null);
    setIsSubmittingAbonoCuenta(false);
  };

  const handleSaveAbonoCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaForAbono || isSubmittingAbonoCuenta) return;
    const amt = parseFloat(cuentaAbonoAmount) || 0;
    if (amt <= 0) return;

    const usesBank = isBankPaymentMethod(cuentaAbonoMethod);
    const chosenBank = usesBank
      ? (treasuryAccounts.find((a) => a.id === cuentaAbonoBankAccountId) || getDefaultBankAccount(treasuryAccounts))
      : undefined;
    const parsedBankFee = usesBank ? round2(Math.max(0, parseFloat(cuentaAbonoBankFeeInput) || 0)) : 0;

    setIsSubmittingAbonoCuenta(true);
    setAbonoCuentaError(null);
    try {
      await addAbonoToCuentaPorPagar(
        cuentaForAbono.id,
        Math.min(amt, cuentaForAbono.remainingUSD),
        cuentaAbonoMethod,
        cuentaAbonoRef.trim() || undefined,
        cuentaAbonoNotes.trim() || undefined,
        {
          bankAccountId: chosenBank?.id,
          bankAccountLabel: chosenBank ? (cuentaAbonoBankAccountLabel || formatTreasuryAccountLabel(chosenBank)) : undefined,
          enteredCurrency: 'USD',
          bankFeeAmount: parsedBankFee > 0 ? parsedBankFee : undefined
        }
      );
      setCuentaForAbono(null);
    } catch (err: any) {
      setAbonoCuentaError(err?.message || 'No se pudo registrar el abono en Cloud Firestore.');
    } finally {
      setIsSubmittingAbonoCuenta(false);
    }
  };

  const handleOpenEditGastoOp = (g: GastoOperativo) => {
    setEditingGastoOp(g);
    setEditGastoConcept(g.concept);
    setEditGastoCategory(g.category);
    setEditGastoSupplierName(g.supplierName || '');
    setEditGastoSupplierRIF(g.supplierRIF || '');
    setEditGastoSupplierPhone(g.supplierPhone || '');
    setEditGastoInvoiceNumber(g.invoiceNumber || '');
    setEditGastoDueDate(g.dueDate);
    setEditGastoAmountUSD(g.amountUSD.toString());
    setEditGastoNotes(g.notes || '');
  };

  const handleSaveEditGastoOp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGastoOp) return;
    const amt = Math.max(0, parseFloat(editGastoAmountUSD) || editingGastoOp.amountUSD);
    updateGastoOperativo({
      ...editingGastoOp,
      concept: editGastoConcept.trim() || editingGastoOp.concept,
      category: editGastoCategory,
      supplierName: editGastoSupplierName.trim() || undefined,
      supplierRIF: editGastoSupplierRIF.trim().toUpperCase() || undefined,
      supplierPhone: editGastoSupplierPhone.trim() || undefined,
      invoiceNumber: editGastoInvoiceNumber.trim() || undefined,
      dueDate: editGastoDueDate || editingGastoOp.dueDate,
      amountUSD: amt,
      amountBs: Number((amt * bcvRate).toFixed(2)),
      notes: editGastoNotes.trim() || undefined,
    });
    setEditingGastoOp(null);
  };

  const handleOpenAbonoGasto = (g: GastoOperativo) => {
    const remaining = g.remainingUSD ?? Math.max(0, g.amountUSD - (g.paidAmountUSD || 0));
    setGastoForAbono(g);
    setGastoAbonoAmount(remaining.toFixed(2));
    setGastoAbonoMethod(g.paymentMethod || 'efectivo_usd');
    setGastoAbonoRef('');
    setGastoAbonoNotes('');
    const matchedTreasuryBank = treasuryAccounts.find((a) => a.accountType === 'bank' && a.id === g.bankAccountId);
    const defaultBank = matchedTreasuryBank || getDefaultBankAccount(treasuryAccounts);
    setGastoAbonoBankAccountId(defaultBank?.id || g.bankAccountId || '');
    setGastoAbonoBankAccountLabel(defaultBank ? formatTreasuryAccountLabel(defaultBank) : (g.bankAccountLabel || ''));
    setGastoAbonoBankFeeInput('');
    setAbonoGastoError(null);
    setIsSubmittingAbonoGasto(false);
  };

  const handleSaveAbonoGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoForAbono || isSubmittingAbonoGasto) return;
    const remaining = gastoForAbono.remainingUSD ?? Math.max(0, gastoForAbono.amountUSD - (gastoForAbono.paidAmountUSD || 0));
    const amt = parseFloat(gastoAbonoAmount) || 0;
    if (amt <= 0) return;

    const usesBank = isBankPaymentMethod(gastoAbonoMethod);
    const chosenBank = usesBank
      ? (treasuryAccounts.find((a) => a.id === gastoAbonoBankAccountId) || getDefaultBankAccount(treasuryAccounts))
      : undefined;
    const parsedBankFee = usesBank ? round2(Math.max(0, parseFloat(gastoAbonoBankFeeInput) || 0)) : 0;

    setIsSubmittingAbonoGasto(true);
    setAbonoGastoError(null);
    try {
      await markGastoOperativoPagado(
        gastoForAbono.id,
        gastoAbonoMethod,
        gastoAbonoRef.trim() || undefined,
        Math.min(amt, remaining),
        gastoAbonoNotes.trim() || undefined,
        {
          bankAccountId: chosenBank?.id,
          bankAccountLabel: chosenBank ? (gastoAbonoBankAccountLabel || formatTreasuryAccountLabel(chosenBank)) : undefined,
          enteredCurrency: 'USD',
          bankFeeAmount: parsedBankFee > 0 ? parsedBankFee : undefined
        }
      );
      setGastoForAbono(null);
    } catch (err: any) {
      setAbonoGastoError(err?.message || 'No se pudo registrar el abono del gasto en Cloud Firestore.');
    } finally {
      setIsSubmittingAbonoGasto(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeletingRecord) return;
    setIsDeletingRecord(true);
    try {
      switch (deleteTarget.type) {
        case 'sale':
          await deleteSale(deleteTarget.item.id, restoreStockOnSaleDelete);
          if (selectedSaleForTicket?.id === deleteTarget.item.id) setSelectedSaleForTicket(null);
          break;
        case 'expense':
          await deleteExpense(deleteTarget.item.id);
          if (selectedExpenseForTicket?.id === deleteTarget.item.id) setSelectedExpenseForTicket(null);
          break;
        case 'credit_note':
          await deleteCreditNote(deleteTarget.item.id);
          if (selectedCreditNoteForTicket?.id === deleteTarget.item.id) setSelectedCreditNoteForTicket(null);
          break;
        case 'discharge':
          await deleteInventoryDischarge(deleteTarget.item.id);
          if (selectedDischargeForDetail?.id === deleteTarget.item.id) setSelectedDischargeForDetail(null);
          break;
        case 'cuenta':
          await deleteCuentaPorPagar(deleteTarget.item.id);
          if (selectedCuentaForDetail?.id === deleteTarget.item.id) setSelectedCuentaForDetail(null);
          break;
        case 'gasto_op':
          await deleteGastoOperativo(deleteTarget.item.id);
          if (selectedGastoForDetail?.id === deleteTarget.item.id) setSelectedGastoForDetail(null);
          break;
      }
      setDeleteTarget(null);
      setRestoreStockOnSaleDelete(false);
    } catch {
      // Error ya notificado por AppContext; mantener diálogo abierto o evitar rechazo no capturado
    } finally {
      setIsDeletingRecord(false);
    }
  };

  const pendingPayablesCount =
    cuentasPorPagar.filter(c => c.status !== 'pagada').length +
    gastosOperativos.filter(g => g.status !== 'pagado').length;

  const handleInstantSync = async () => {
    setIsSyncingNow(true);
    setSyncFeedback('Comprobando cambios en otros dispositivos...');
    try {
      await checkRemoteChangesForMultiDevice();
      await syncToGoogleDrive();
      setSyncFeedback('¡Sincronizado! Información al día con todos los dispositivos.');
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch {
      setSyncFeedback('Error al sincronizar con Google Drive');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Filter sales
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSales = useMemo(() => {
    if (!normalizedSearch) return sales;
    return sales.filter(s =>
      s.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
      s.controlNumber.toLowerCase().includes(normalizedSearch) ||
      s.clientName.toLowerCase().includes(normalizedSearch) ||
      s.clientRIF.toLowerCase().includes(normalizedSearch)
    );
  }, [sales, normalizedSearch]);

  // Active (non-anulada) sales for fiscal & balance math
  const activeSales = useMemo(() => sales.filter(s => s.status !== 'anulada'), [sales]);
  const activeFilteredSales = useMemo(
    () => filteredSales.filter(s => s.status !== 'anulada'),
    [filteredSales]
  );

  // Filter expenses (unconditionally exclude credit-purchase settlement outflows even across months;
  // bank commissions on those payments are preserved via !isExpenseBankCommission)
  const nonDuplicatedExpenses = useMemo(
    () => expenses.filter(e => !isExpenseCreditSettlement(e)),
    [expenses]
  );
  // Strict SENIAT Isolation: Libro de Compras excludes Sueldo Propietario, Retiros, Comisiones, Préstamos, Liquidaciones CPP y recibos sin factura fiscal
  const libroComprasExpenses = useMemo(
    () => nonDuplicatedExpenses.filter(e => !isExpenseExcludedFromLibroCompras(e)),
    [nonDuplicatedExpenses]
  );
  const filteredExpenses = useMemo(() => {
    if (!normalizedSearch) return libroComprasExpenses;
    return libroComprasExpenses.filter(e =>
      e.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
      e.supplierName.toLowerCase().includes(normalizedSearch) ||
      e.supplierRIF.toLowerCase().includes(normalizedSearch)
    );
  }, [libroComprasExpenses, normalizedSearch]);

  // Credit Notes deductions scoped to active transactionsDateRange (SENIAT)
  const { totalCreditNotesUSD, totalCreditNotesBs } = useMemo(() => {
    const scoped = transactionsDateRange
      ? creditNotes.filter(n => {
          const ymd = getLocalDateStr(n.date);
          return ymd >= transactionsDateRange.startDate && ymd <= transactionsDateRange.endDate;
        })
      : creditNotes;
    return {
      totalCreditNotesUSD: round2(scoped.reduce((a, n) => a + n.totalUSD, 0)),
      totalCreditNotesBs: round2(scoped.reduce((a, n) => a + n.totalBs, 0))
    };
  }, [creditNotes, transactionsDateRange]);

  // Sales totals (SENIAT - excluding anuladas)
  const {
    totalSalesBs,
    totalSalesUSD,
    totalExemptBs,
    totalTaxableBs,
    totalIvaBs,
    totalIgtfBs
  } = useMemo(() => {
    let salesBs = 0;
    let salesUSD = 0;
    let exemptBs = 0;
    let taxableBs = 0;
    let ivaBs = 0;
    let igtfBs = 0;
    for (const s of activeFilteredSales) {
      salesBs += s.totalBs;
      salesUSD += s.totalUSD;
      exemptBs += s.exemptBs;
      taxableBs += s.taxableBs;
      ivaBs += s.ivaBs;
      igtfBs += s.igtfBs;
    }
    return {
      totalSalesBs: round2(salesBs),
      totalSalesUSD: round2(salesUSD),
      totalExemptBs: round2(exemptBs),
      totalTaxableBs: round2(taxableBs),
      totalIvaBs: round2(ivaBs),
      totalIgtfBs: round2(igtfBs)
    };
  }, [activeFilteredSales]);

  // IGTF-subject sales (includes both full efectivo_usd and pago_combinado with USD cash portion)
  const getSaleIgtfBaseUSD = (s: Sale): number => {
    if (s.paymentMethod === 'pago_combinado') {
      const usdCash = s.paymentDetails?.combinedBreakdown?.usdCash || 0;
      if (usdCash > 0) return round2(usdCash);
      return s.igtfUSD > 0 ? round2(s.igtfUSD / 0.03) : 0;
    }
    return round2(s.subtotalUSD + s.ivaUSD);
  };
  const { igtfSales, totalIgtfBaseUSD, totalIgtfTabUSD, totalIgtfTabBs } = useMemo(() => {
    const matched = activeSales.filter(
      s =>
        s.paymentMethod === 'efectivo_usd' ||
        s.igtfUSD > 0 ||
        s.igtfBs > 0 ||
        (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.usdCash || 0) > 0)
    );
    let baseUSD = 0;
    let tabUSD = 0;
    let tabBs = 0;
    for (const s of matched) {
      baseUSD += getSaleIgtfBaseUSD(s);
      tabUSD += s.igtfUSD;
      tabBs += s.igtfBs;
    }
    return {
      igtfSales: matched,
      totalIgtfBaseUSD: round2(baseUSD),
      totalIgtfTabUSD: round2(tabUSD),
      totalIgtfTabBs: round2(tabBs)
    };
  }, [activeSales]);

  // Purchases totals (SENIAT — strictly fiscal records only)
  const {
    totalExpBs,
    totalExpUSD,
    totalBaseExpBs,
    totalIvaExpBs,
    totalRetIvaBs,
    totalRetIslrBs
  } = useMemo(() => {
    let expBs = 0;
    let expUSD = 0;
    let baseExpBs = 0;
    let ivaExpBs = 0;
    let retIvaBs = 0;
    let retIslrBs = 0;
    for (const e of filteredExpenses) {
      expBs += e.amountBs;
      expUSD += e.amountUSD;
      baseExpBs += e.baseImponibleBs;
      ivaExpBs += e.ivaBs;
      retIvaBs += e.retencionIVABs;
      retIslrBs += e.retencionISLRBs;
    }
    return {
      totalExpBs: round2(expBs),
      totalExpUSD: round2(expUSD),
      totalBaseExpBs: round2(baseExpBs),
      totalIvaExpBs: round2(ivaExpBs),
      totalRetIvaBs: round2(retIvaBs),
      totalRetIslrBs: round2(retIslrBs)
    };
  }, [filteredExpenses]);

  // Operating Expenses, Owner Salary/Withdrawals, Net Balance & Payment Method Breakdown
  const {
    sueldoPropietarioUSD,
    sueldoPropietarioBs,
    retirosPersonalesUSD,
    retirosPersonalesBs,
    allActiveSalesUSD,
    netIngresosUSD,
    netIngresosBs,
    allExpUSD,
    allExpBs,
    netUSD,
    netBs,
    flujoTrasRetirosUSD,
    flujoTrasRetirosBs,
    methodsVentas,
    estadoCuentaSummary
  } = useMemo(() => {
    let salUSD = 0;
    let salBs = 0;
    let withUSD = 0;
    let withBs = 0;
    let opExpUSD = 0;
    let opExpBs = 0;

    for (const e of nonDuplicatedExpenses) {
      const isWith = isExpenseOwnerWithdrawal(e);
      const isLoanRepay = isExpenseLoanRepayment(e);
      if (!isWith && !isLoanRepay) {
        opExpUSD += e.amountUSD;
        opExpBs += e.amountBs;
      }
      if (isExpenseOwnerSalary(e)) {
        salUSD += e.amountUSD;
        salBs += e.amountBs;
      }
      if (isWith) {
        withUSD += e.amountUSD;
        withBs += e.amountBs;
      }
    }

    let activeUSD = 0;
    let activeBs = 0;
    let sumIgtfBs = 0;
    let sumIgtfUSD = 0;
    const methods: Record<string, { usd: number; bs: number }> = {};
    for (const s of activeSales) {
      activeUSD += s.totalUSD;
      activeBs += s.totalBs;
      sumIgtfBs += s.igtfBs;
      sumIgtfUSD += s.igtfUSD;
      if (!methods[s.paymentMethod]) {
        methods[s.paymentMethod] = { usd: 0, bs: 0 };
      }
      methods[s.paymentMethod].usd = round2(methods[s.paymentMethod].usd + s.totalUSD);
      methods[s.paymentMethod].bs = round2(methods[s.paymentMethod].bs + s.totalBs);
    }

    const rActiveUSD = round2(activeUSD);
    const rActiveBs = round2(activeBs);
    const rNetIngUSD = round2(Math.max(0, rActiveUSD - totalCreditNotesUSD));
    const rNetIngBs = round2(Math.max(0, rActiveBs - totalCreditNotesBs));
    const rOpExpUSD = round2(opExpUSD);
    const rOpExpBs = round2(opExpBs);
    const rSalUSD = round2(salUSD);
    const rSalBs = round2(salBs);
    const rWithUSD = round2(withUSD);
    const rWithBs = round2(withBs);
    const rNetUSD = round2(rNetIngUSD - rOpExpUSD);
    const rNetBs = round2(rNetIngBs - rOpExpBs);
    const rFlujoUSD = round2(rNetUSD - rWithUSD);
    const rFlujoBs = round2(rNetBs - rWithBs);

    return {
      sueldoPropietarioUSD: rSalUSD,
      sueldoPropietarioBs: rSalBs,
      retirosPersonalesUSD: rWithUSD,
      retirosPersonalesBs: rWithBs,
      allActiveSalesUSD: rActiveUSD,
      netIngresosUSD: rNetIngUSD,
      netIngresosBs: rNetIngBs,
      allExpUSD: rOpExpUSD,
      allExpBs: rOpExpBs,
      netUSD: rNetUSD,
      netBs: rNetBs,
      flujoTrasRetirosUSD: rFlujoUSD,
      flujoTrasRetirosBs: rFlujoBs,
      methodsVentas: methods,
      estadoCuentaSummary: {
        ventasTotalBs: rNetIngBs,
        ventasTotalUSD: rNetIngUSD,
        gastosTotalBs: rOpExpBs,
        gastosTotalUSD: rOpExpUSD,
        sueldoPropietarioUSD: rSalUSD,
        sueldoPropietarioBs: rSalBs,
        retirosPersonalesUSD: rWithUSD,
        retirosPersonalesBs: rWithBs,
        netoBs: rNetBs,
        netoUSD: rNetUSD,
        flujoTrasRetirosUSD: rFlujoUSD,
        flujoTrasRetirosBs: rFlujoBs,
        igtfBs: round2(sumIgtfBs),
        igtfUSD: round2(sumIgtfUSD),
        metodosVentas: methods,
        bcvRate
      }
    };
  }, [activeSales, nonDuplicatedExpenses, totalCreditNotesUSD, totalCreditNotesBs, bcvRate]);

  // Pagination slices for Ventas & Compras
  const totalSalesPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const safeSalesPage = Math.min(salesPage, totalSalesPages);
  const paginatedSales = useMemo(
    () => filteredSales.slice((safeSalesPage - 1) * pageSize, safeSalesPage * pageSize),
    [filteredSales, safeSalesPage, pageSize]
  );

  const totalExpensesPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const safeExpensesPage = Math.min(expensesPage, totalExpensesPages);
  const paginatedExpenses = useMemo(
    () => filteredExpenses.slice((safeExpensesPage - 1) * pageSize, safeExpensesPage * pageSize),
    [filteredExpenses, safeExpensesPage, pageSize]
  );

  const handleSelectDatePreset = (preset: TransactionsDatePreset) => {
    if (preset === 'custom') {
      setShowCustomRangePicker(true);
      if (transactionsDateRange) {
        setCustomStartDate(transactionsDateRange.startDate);
        setCustomEndDate(transactionsDateRange.endDate);
      }
      return;
    }
    setShowCustomRangePicker(false);
    setTransactionsDateFilter(preset);
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStartDate || !customEndDate) return;
    setTransactionsDateFilter('custom', customStartDate, customEndDate);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-12 space-y-5">
      
      {/* Top Banner with SENIAT compliance indicator (Clean Two-Row Responsive Layout) */}
      <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
        {/* Row 1: Title + Sync & Drive Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-2 rounded-xl bg-[#0B1528] text-white shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#0B1528] tracking-tight">
                Módulo de Contabilidad y Reportes SENIAT
              </h1>
              <span className="bg-[#FEECEF] text-[#BE123C] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-[#FBC4CD] shrink-0">
                Leyes de Venezuela
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Libros fiscales oficiales, cálculo de retenciones de IVA (16%), IGTF (3%) y conciliación bimonetaria a tasa BCV (Bs. {formatBs(bcvRate)})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstantSync}
              disabled={isSyncingNow || isDriveSyncing}
              className="px-3.5 py-2 rounded-xl bg-[#E7F8EE] hover:bg-emerald-100 border border-[#A7E6C4] text-[#065F46] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
              title="Sincronizar inmediatamente con otros dispositivos"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#065F46] ${isSyncingNow || isDriveSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar Dispositivos</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Conectar Google Drive y descargar reportes contables completos"
            >
              <Cloud className="w-4 h-4 text-blue-100" />
              <span>Google Drive & Descargas</span>
            </button>
          </div>
        </div>

        {/* Row 2: Wrapped Sub-tab Navigation (Zero Horizontal Overflow) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#EEF2F7] p-1.5 rounded-2xl text-xs font-semibold w-full border border-[#DCE4F0]">
          <button
            type="button"
            onClick={() => setSubTab('ventas')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'ventas' ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            Libro de Ventas
          </button>
          <button
            type="button"
            onClick={() => setSubTab('compras')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'compras' ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            Libro de Compras
          </button>
          <button
            type="button"
            onClick={() => setSubTab('notas_credito')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              subTab === 'notas_credito' ? 'bg-white text-[#BE123C] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#BE123C]" />
            <span>Notas de Crédito</span>
            <span className="px-1.5 py-0.5 bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] rounded-full text-[10px] font-bold font-mono-numbers">
              {creditNotes.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('salidas_inventario')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              subTab === 'salidas_inventario' ? 'bg-white text-[#9A4B12] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-[#D96B27]" />
            <span>Salidas / Mermas</span>
            <span className="px-1.5 py-0.5 bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3] rounded-full text-[10px] font-bold font-mono-numbers">
              {inventoryDischarges.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cierres_caja')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              subTab === 'cierres_caja' ? 'bg-white text-[#065F46] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-[#065F46]" />
            <span>Cierres de Caja</span>
            <span className="px-1.5 py-0.5 bg-[#E7F8EE] text-[#065F46] border border-[#A7E6C4] rounded-full text-[10px] font-bold font-mono-numbers">
              {cashShiftHistory.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cuentas_por_pagar')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              subTab === 'cuentas_por_pagar' ? 'bg-white text-[#BE123C] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-[#BE123C]" />
            <span>Cuentas por Pagar</span>
            <span className="px-1.5 py-0.5 bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] rounded-full text-[10px] font-bold font-mono-numbers">
              {pendingPayablesCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('igtf')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'igtf' ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            Control del IGTF (3%)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('estado_cuenta')}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'estado_cuenta' ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0] font-bold' : 'text-slate-600 hover:text-[#0B1528] hover:bg-white/60'
            }`}
          >
            Estado de Cuenta
          </button>
        </div>

        {/* Row 3: Firestore Date-Range Filter Bar (Optimización Móvil y Carga Bajo Demanda) */}
        <div className="pt-3 border-t border-[#EEF2F7] space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0B1528]">
              <Calendar className="w-4 h-4 text-[#2563EB] shrink-0" />
              <span>Período de Consulta en Nube (Ventas y Gastos):</span>
              {isLoadingHistory ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] text-[10px] font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Cargando...
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] text-[10px] font-mono-numbers font-semibold">
                  {transactionsPreset === 'all_history'
                    ? 'Histórico Completo'
                    : transactionsDateRange
                      ? `${transactionsDateRange.startDate} → ${transactionsDateRange.endDate}`
                      : 'Mes Actual'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              {(
                [
                  { id: 'current_month', label: 'Mes Actual' },
                  { id: 'today', label: 'Hoy' },
                  { id: 'last_30_days', label: 'Últimos 30d' },
                  { id: 'previous_month', label: 'Mes Anterior' },
                  { id: 'custom', label: 'Rango Personalizado' },
                ] as Array<{ id: TransactionsDatePreset; label: string }>
              ).map((opt) => {
                const isActive = opt.id === 'custom' ? (showCustomRangePicker || transactionsPreset === 'custom') : (!showCustomRangePicker && transactionsPreset === opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectDatePreset(opt.id)}
                    className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0B1528] text-white border-[#0B1528]'
                        : 'bg-[#F8FAFC] text-slate-600 border-[#DCE4F0] hover:bg-white hover:text-[#0B1528]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => handleSelectDatePreset('all_history')}
                className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                  !showCustomRangePicker && transactionsPreset === 'all_history'
                    ? 'bg-[#D96B27] text-white border-[#D96B27]'
                    : 'bg-[#FFF3E8] text-[#9A4B12] border-[#F5D3B3] hover:bg-[#FFE6CE]'
                }`}
                title="Cargar todos los meses anteriores desde Firestore bajo demanda"
              >
                <History className="w-3.5 h-3.5" />
                <span>Cargar Todo el Histórico</span>
              </button>
            </div>
          </div>

          {showCustomRangePicker && (
            <form
              onSubmit={handleApplyCustomRange}
              className="p-3 bg-[#F8FAFC] border border-[#DCE4F0] rounded-2xl flex flex-wrap items-end gap-2.5 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#DCE4F0] rounded-xl text-xs font-mono text-[#0B1528] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#DCE4F0] rounded-xl text-xs font-mono text-[#0B1528] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Aplicar Rango
              </button>
            </form>
          )}
        </div>

        {/* Sync Feedback Toast Banner */}
        {syncFeedback && (
          <div className="p-2.5 bg-[#E7F8EE] border border-[#A7E6C4] rounded-xl text-xs font-bold text-[#065F46] flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#065F46] shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* SUBTAB 1: LIBRO DE VENTAS (SENIAT) */}
      {subTab === 'ventas' && (
        <div className="space-y-4">
          {/* Action Bar with visible Export buttons */}
          <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por factura, control, RIF o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportLibroVentasExcel(filteredSales, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportLibroVentasPDF(filteredSales, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Exportar a PDF (Formato Oficial)</span>
              </button>
            </div>
          </div>

          {/* Totals Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Imponible (16%)</span>
              <div className="text-lg font-black text-[#0B1528] font-mono-numbers mt-0.5">
                Bs. {formatBs(totalTaxableBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono-numbers">≈ ${formatUSD(safeDiv(totalTaxableBs, bcvRate, 0))}</span>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA Débito Fiscal (16%)</span>
              <div className="text-lg font-black text-[#1D4ED8] font-mono-numbers mt-0.5">
                Bs. {formatBs(totalIvaBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono-numbers">≈ ${formatUSD(safeDiv(totalIvaBs, bcvRate, 0))}</span>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ventas Exentas (E)</span>
              <div className="text-lg font-black text-[#065F46] font-mono-numbers mt-0.5">
                Bs. {formatBs(totalExemptBs)}
              </div>
              <span className="text-[11px] text-slate-500">Canasta básica exonerada</span>
            </div>

            <div className="bg-[#0B1528] text-white p-4 rounded-2xl border border-[#1E293B] shadow-md">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Total Facturado (Bs)</span>
              <div className="text-lg font-black text-white font-mono-numbers mt-0.5">
                Bs. {formatBs(totalSalesBs)}
              </div>
              <span className="text-[11px] text-emerald-300 font-mono-numbers font-bold">${formatUSD(totalSalesUSD)} USD</span>
            </div>
          </div>

          {/* SENIAT Table */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-3.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex items-center justify-between text-xs">
              <span className="font-bold text-[#0B1528]">Libro de Ventas Fiscal - Formato SENIAT</span>
              <span className="text-slate-500 font-mono-numbers">{filteredSales.length} registros en el período</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F8FAFC] text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-[#DCE4F0]">
                  <tr>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                    <th className="py-2.5 px-3 text-center">N° Op</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Factura</th>
                    <th className="py-2.5 px-3">Control</th>
                    <th className="py-2.5 px-3">RIF/Cédula</th>
                    <th className="py-2.5 px-3">Razón Social / Cliente</th>
                    <th className="py-2.5 px-3 text-right">Total Bs</th>
                    <th className="py-2.5 px-3 text-right">Exento Bs</th>
                    <th className="py-2.5 px-3 text-right">Base Imp. Bs</th>
                    <th className="py-2.5 px-3 text-center">% IVA</th>
                    <th className="py-2.5 px-3 text-right">IVA Bs</th>
                    <th className="py-2.5 px-3 text-right">IGTF 3%</th>
                    <th className="py-2.5 px-3 text-right">Total $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {paginatedSales.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-8 text-center text-slate-400 font-sans">
                        No hay ventas registradas en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    paginatedSales.map((sale, index) => (
                    <tr key={sale.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedSaleForTicket(sale)}
                            className="p-1.5 rounded-xl bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Ver recibo / ticket de venta"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSale(sale)}
                            className="p-1.5 rounded-xl bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-[#EEF2F7] hover:text-[#0B1528] transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Editar datos de la venta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRestoreStockOnSaleDelete(false); setDeleteTarget({ type: 'sale', item: sale }); }}
                            className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Eliminar venta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">{(safeSalesPage - 1) * pageSize + index + 1}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {new Date(sale.date).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-2 px-3 font-bold text-[#0B1528]">
                        {sale.invoiceNumber}
                        {sale.status === 'anulada' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] text-[9px] font-sans font-extrabold">ANULADA</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{sale.controlNumber}</td>
                      <td className="py-2 px-3 text-slate-800">{sale.clientRIF}</td>
                      <td className="py-2 px-3 font-sans text-[#0B1528] max-w-xs truncate">{sale.clientName}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#0B1528] font-mono-numbers">{formatBs(sale.totalBs)}</td>
                      <td className="py-2 px-3 text-right text-slate-500 font-mono-numbers">{formatBs(sale.exemptBs)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700 font-mono-numbers">{formatBs(sale.taxableBs)}</td>
                      <td className="py-2 px-3 text-center text-slate-500">
                        {sale.taxableBs > 0 ? '16%' : '0% (E)'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#1D4ED8] font-mono-numbers">{formatBs(sale.ivaBs)}</td>
                      <td className="py-2 px-3 text-right text-[#065F46] font-mono-numbers">{formatBs(sale.igtfBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#0B1528] font-mono-numbers">${formatUSD(sale.totalUSD)}</td>
                    </tr>
                  ))
                  )}
                </tbody>
                <tfoot className="bg-[#0B1528] text-white font-bold text-xs border-t border-[#1E293B] font-mono-numbers">
                  <tr>
                    <td colSpan={7} className="py-3 px-3 text-right uppercase font-sans">Totales del Período:</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalSalesBs)}</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalExemptBs)}</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalTaxableBs)}</td>
                    <td className="py-3 px-3 text-center">{totalTaxableBs > 0 ? '16%' : '0%'}</td>
                    <td className="py-3 px-3 text-right text-blue-300">Bs. {formatBs(totalIvaBs)}</td>
                    <td className="py-3 px-3 text-right text-emerald-300">Bs. {formatBs(totalIgtfBs)}</td>
                    <td className="py-3 px-3 text-right text-white">${formatUSD(totalSalesUSD)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredSales.length > 0 && (
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span>
                    Mostrando <strong className="font-mono-numbers">{(safeSalesPage - 1) * pageSize + 1}</strong>–<strong className="font-mono-numbers">{Math.min(safeSalesPage * pageSize, filteredSales.length)}</strong> de <strong className="font-mono-numbers">{filteredSales.length}</strong> ventas
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-[#DCE4F0] rounded-lg text-xs font-bold text-[#0B1528] cursor-pointer"
                  >
                    {[15, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n} / pág</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeSalesPage <= 1}
                    onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="px-2.5 py-1 font-mono-numbers font-bold text-[#0B1528]">
                    {safeSalesPage} / {totalSalesPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeSalesPage >= totalSalesPages}
                    onClick={() => setSalesPage((p) => Math.min(totalSalesPages, p + 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: LIBRO DE COMPRAS Y GASTOS (SENIAT) */}
      {subTab === 'compras' && (
        <div className="space-y-4">
          <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar factura de proveedor o RIF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setEditingExpense(null); setIsGastoModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Factura</span>
              </button>

              <button
                onClick={() => exportLibroComprasExcel(filteredExpenses, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportLibroComprasPDF(filteredExpenses, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Exportar PDF (Oficial)</span>
              </button>
            </div>
          </div>

          {/* Totals Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Imponible Compras</span>
              <div className="text-lg font-black text-[#0B1528] font-mono-numbers mt-0.5">
                Bs. {formatBs(totalBaseExpBs)}
              </div>
              <span className="text-[11px] text-slate-500">Materia gravable</span>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA Crédito Fiscal</span>
              <div className="text-lg font-black text-[#1D4ED8] font-mono-numbers mt-0.5">
                Bs. {formatBs(totalIvaExpBs)}
              </div>
              <span className="text-[11px] text-slate-500">Deducible en declaración</span>
            </div>

            <div className="bg-[#FFF3E8] p-4 rounded-2xl border border-[#F5D3B3] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
              <span className="text-[10px] font-bold text-[#9A4B12] uppercase tracking-wider">Retención IVA (75%)</span>
              <div className="text-lg font-black text-[#7C3A0B] font-mono-numbers mt-0.5">
                Bs. {formatBs(totalRetIvaBs)}
              </div>
              <span className="text-[11px] text-[#9A4B12]">Comprobantes emitidos</span>
            </div>

            <div className="bg-[#0B1528] text-white p-4 rounded-2xl border border-[#1E293B] shadow-md">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Total Egresado / Compras</span>
              <div className="text-lg font-black text-white font-mono-numbers mt-0.5">
                Bs. {formatBs(totalExpBs)}
              </div>
              <span className="text-[11px] text-emerald-300 font-mono-numbers font-bold">${formatUSD(totalExpUSD)} USD</span>
            </div>
          </div>

          {/* Compras Table */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-3.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-[#0B1528]">Libro de Compras y Gastos - Crédito Fiscal SENIAT</span>
                <span className="block text-[10px] text-slate-500">
                  Excluye automáticamente Sueldo Propietario / Nómina y Retiros Personales del Dueño (sin IVA ni retenciones).
                </span>
              </div>
              <span className="text-slate-500 font-mono-numbers">{filteredExpenses.length} facturas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F8FAFC] text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-[#DCE4F0]">
                  <tr>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                    <th className="py-2.5 px-3 text-center">N° Op</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Factura</th>
                    <th className="py-2.5 px-3">Control</th>
                    <th className="py-2.5 px-3">RIF Proveedor</th>
                    <th className="py-2.5 px-3">Razón Social / Proveedor</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-right">Base Imp. Bs</th>
                    <th className="py-2.5 px-3 text-right">IVA Crédito</th>
                    <th className="py-2.5 px-3 text-right">Ret. IVA 75%</th>
                    <th className="py-2.5 px-3 text-right">Ret. ISLR</th>
                    <th className="py-2.5 px-3 text-right">Total Bs</th>
                    <th className="py-2.5 px-3 text-right">Total $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-8 text-center text-slate-400 font-sans">
                        No hay facturas de compra o egresos registrados en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((exp, index) => (
                    <tr key={exp.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedExpenseForTicket(exp)}
                            className="p-1.5 rounded-xl bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Ver comprobante de compra / factura"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingExpense(exp); setIsGastoModalOpen(true); }}
                            className="p-1.5 rounded-xl bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-[#EEF2F7] hover:text-[#0B1528] transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Editar factura de compra"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'expense', item: exp })}
                            className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Eliminar factura de compra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">{(safeExpensesPage - 1) * pageSize + index + 1}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {new Date(exp.date).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-2 px-3 font-bold text-[#0B1528]">
                        {exp.invoiceNumber}
                        {exp.paymentMethod === 'credito' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3] text-[9px] font-sans font-extrabold">CRÉDITO</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{exp.controlNumber}</td>
                      <td className="py-2 px-3 text-slate-800">{exp.supplierRIF}</td>
                      <td className="py-2 px-3 font-sans text-[#0B1528] max-w-xs truncate">{exp.supplierName}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">{exp.category}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700 font-mono-numbers">{formatBs(exp.baseImponibleBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1D4ED8] font-mono-numbers">{formatBs(exp.ivaBs)}</td>
                      <td className="py-2 px-3 text-right text-[#D96B27] font-mono-numbers">{formatBs(exp.retencionIVABs)}</td>
                      <td className="py-2 px-3 text-right text-slate-600 font-mono-numbers">{formatBs(exp.retencionISLRBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#0B1528] font-mono-numbers">{formatBs(exp.amountBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#0B1528] font-mono-numbers">${formatUSD(exp.amountUSD)}</td>
                    </tr>
                  ))
                  )}
                </tbody>
                <tfoot className="bg-[#0B1528] text-white font-bold text-xs border-t border-[#1E293B] font-mono-numbers">
                  <tr>
                    <td colSpan={8} className="py-3 px-3 text-right uppercase font-sans">Totales Compras:</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalBaseExpBs)}</td>
                    <td className="py-3 px-3 text-right text-blue-300">Bs. {formatBs(totalIvaExpBs)}</td>
                    <td className="py-3 px-3 text-right text-amber-300">Bs. {formatBs(totalRetIvaBs)}</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalRetIslrBs)}</td>
                    <td className="py-3 px-3 text-right text-white">Bs. {formatBs(totalExpBs)}</td>
                    <td className="py-3 px-3 text-right text-emerald-300">${formatUSD(totalExpUSD)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredExpenses.length > 0 && (
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span>
                    Mostrando <strong className="font-mono-numbers">{(safeExpensesPage - 1) * pageSize + 1}</strong>–<strong className="font-mono-numbers">{Math.min(safeExpensesPage * pageSize, filteredExpenses.length)}</strong> de <strong className="font-mono-numbers">{filteredExpenses.length}</strong> facturas
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-[#DCE4F0] rounded-lg text-xs font-bold text-[#0B1528] cursor-pointer"
                  >
                    {[15, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n} / pág</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeExpensesPage <= 1}
                    onClick={() => setExpensesPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="px-2.5 py-1 font-mono-numbers font-bold text-[#0B1528]">
                    {safeExpensesPage} / {totalExpensesPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeExpensesPage >= totalExpensesPages}
                    onClick={() => setExpensesPage((p) => Math.min(totalExpensesPages, p + 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: NOTAS DE CRÉDITO Y DEVOLUCIONES (SENIAT) */}
      {subTab === 'notas_credito' && (
        <div className="space-y-4">
          <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Nº de Nota de Crédito, Factura original o Cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreditNoteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FEECEF] hover:bg-rose-100 text-[#BE123C] border border-[#FBC4CD] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Emitir Nota de Crédito</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          {(() => {
            const filteredNCs = creditNotes.filter(nc =>
              nc.creditNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              nc.controlNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              nc.originalInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (nc.originalControlNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              nc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              nc.clientRIF.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const totalNCRefundUSD = filteredNCs.reduce((acc, n) => acc + n.totalUSD, 0);
            const totalNCRefundBs = filteredNCs.reduce((acc, n) => acc + n.totalBs, 0);
            const totalNCIvaBs = filteredNCs.reduce((acc, n) => acc + n.ivaBs, 0);
            const totalNcPages = Math.max(1, Math.ceil(filteredNCs.length / pageSize));
            const safeNcPage = Math.min(ncPage, totalNcPages);
            const paginatedNCs = filteredNCs.slice((safeNcPage - 1) * pageSize, safeNcPage * pageSize);

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comprobantes Emitidos</span>
                    <div className="text-lg font-black text-[#0B1528] font-mono-numbers mt-0.5">
                      {filteredNCs.length}
                    </div>
                    <span className="text-[11px] text-slate-500">Notas de crédito registradas</span>
                  </div>

                  <div className="bg-[#FEECEF] p-4 rounded-2xl border border-[#FBC4CD] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
                    <span className="text-[10px] font-bold text-[#BE123C] uppercase tracking-wider">Total Reintegrado (Disminuye Ventas)</span>
                    <div className="text-lg font-black text-[#BE123C] font-mono-numbers mt-0.5">
                      Bs. {formatBs(totalNCRefundBs)}
                    </div>
                    <span className="text-[11px] font-bold text-[#BE123C] font-mono-numbers">≈ ${formatUSD(totalNCRefundUSD)} USD</span>
                  </div>

                  <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA Crédito Fiscal (Reversado)</span>
                    <div className="text-lg font-black text-[#1D4ED8] font-mono-numbers mt-0.5">
                      Bs. {formatBs(totalNCIvaBs)}
                    </div>
                    <span className="text-[11px] text-slate-500">Ajuste sobre débito fiscal</span>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
                  <div className="p-3.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0B1528]">Libro de Notas de Crédito / Devoluciones (SENIAT)</span>
                    <span className="text-slate-500 font-mono-numbers">{filteredNCs.length} registros</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#F8FAFC] text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-[#DCE4F0]">
                        <tr>
                          <th className="py-2.5 px-2 text-center">Acciones</th>
                          <th className="py-2.5 px-3 text-center">#</th>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Nº Nota Crédito</th>
                          <th className="py-2.5 px-3">Nº Control</th>
                          <th className="py-2.5 px-3">Factura Original</th>
                          <th className="py-2.5 px-3">RIF / C.I.</th>
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Motivo</th>
                          <th className="py-2.5 px-3 text-right">Subtotal Bs</th>
                          <th className="py-2.5 px-3 text-right">IVA Bs</th>
                          <th className="py-2.5 px-3 text-right font-bold">Total Bs</th>
                          <th className="py-2.5 px-3 text-right font-bold">Total $</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F7]">
                        {paginatedNCs.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="py-8 text-center text-slate-400 font-sans">
                              No hay notas de crédito registradas.
                            </td>
                          </tr>
                        ) : (
                          paginatedNCs.map((nc, idx) => (
                            <tr key={nc.id} className="hover:bg-[#F8FAFC] transition-colors">
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCreditNoteForTicket(nc)}
                                    className="p-1.5 rounded-xl bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="Ver comprobante de Nota de Crédito"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ type: 'credit_note', item: nc })}
                                    className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="Eliminar Nota de Crédito"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-400">{(safeNcPage - 1) * pageSize + idx + 1}</td>
                              <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                {new Date(nc.date).toLocaleDateString('es-VE')}
                              </td>
                              <td className="py-2 px-3 font-bold text-[#BE123C]">{nc.creditNoteNumber}</td>
                              <td className="py-2 px-3 text-slate-600">{nc.controlNumber}</td>
                              <td className="py-2 px-3 font-bold text-[#0B1528]">
                                <div>{nc.originalInvoiceNumber}</div>
                                {nc.originalControlNumber && (
                                  <div className="text-[10px] font-normal text-slate-500">
                                    Ctrl: {nc.originalControlNumber}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{nc.clientRIF}</td>
                              <td className="py-2 px-3 font-sans text-[#0B1528] max-w-xs truncate">{nc.clientName}</td>
                              <td className="py-2 px-3 font-sans text-slate-600 text-[11px] max-w-xs truncate">{nc.reason}</td>
                              <td className="py-2 px-3 text-right text-slate-700 font-mono-numbers">{formatBs(nc.subtotalBs)}</td>
                              <td className="py-2 px-3 text-right text-[#1D4ED8] font-mono-numbers">{formatBs(nc.ivaBs)}</td>
                              <td className="py-2 px-3 text-right font-bold text-[#BE123C] font-mono-numbers">-{formatBs(nc.totalBs)}</td>
                              <td className="py-2 px-3 text-right font-bold text-[#BE123C] font-mono-numbers">-${formatUSD(nc.totalUSD)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {filteredNCs.length > 0 && (
                    <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span>
                          Mostrando <strong className="font-mono-numbers">{(safeNcPage - 1) * pageSize + 1}</strong>–<strong className="font-mono-numbers">{Math.min(safeNcPage * pageSize, filteredNCs.length)}</strong> de <strong className="font-mono-numbers">{filteredNCs.length}</strong> notas
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safeNcPage <= 1}
                          onClick={() => setNcPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Anterior</span>
                        </button>
                        <span className="px-2.5 py-1 font-mono-numbers font-bold text-[#0B1528]">
                          {safeNcPage} / {totalNcPages}
                        </span>
                        <button
                          type="button"
                          disabled={safeNcPage >= totalNcPages}
                          onClick={() => setNcPage((p) => Math.min(totalNcPages, p + 1))}
                          className="px-2.5 py-1.5 rounded-lg border border-[#DCE4F0] bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <span>Siguiente</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* SUBTAB: DESINCORPORACIONES DE INVENTARIO Y MERMAS */}
      {subTab === 'salidas_inventario' && (
        <div className="space-y-4">
          <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código de salida, producto o responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDischargeModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFF3E8] hover:bg-[#FFE6CE] text-[#9A4B12] border border-[#F5D3B3] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Desincorporar Stock</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          {(() => {
            const filteredDischarges = inventoryDischarges.filter(d =>
              d.dischargeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              d.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (d.responsibleName && d.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()))
            );

            const totalUnits = filteredDischarges.reduce((acc, d) => acc + d.quantity, 0);
            const totalLossUSD = filteredDischarges.reduce((acc, d) => acc + d.totalLossUSD, 0);
            const totalLossBs = filteredDischarges.reduce((acc, d) => acc + d.totalLossBs, 0);

            const danoUSD = filteredDischarges.filter(d => d.reason === 'Daño / Vencimiento').reduce((acc, d) => acc + d.totalLossUSD, 0);
            const usoInternoUSD = filteredDischarges.filter(d => d.reason === 'Uso Interno').reduce((acc, d) => acc + d.totalLossUSD, 0);
            const mermaUSD = filteredDischarges.filter(d => d.reason === 'Merma').reduce((acc, d) => acc + d.totalLossUSD, 0);

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unidades Salientes</span>
                    <div className="text-lg font-black text-[#0B1528] font-mono-numbers mt-0.5">
                      {totalUnits}
                    </div>
                    <span className="text-[11px] text-slate-500">En {filteredDischarges.length} registros</span>
                  </div>

                  <div className="bg-[#FFF3E8] p-4 rounded-2xl border border-[#F5D3B3] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
                    <span className="text-[10px] font-bold text-[#9A4B12] uppercase tracking-wider">Pérdida Total (Gasto Op.)</span>
                    <div className="text-lg font-black text-[#7C3A0B] font-mono-numbers mt-0.5">
                      ${formatUSD(totalLossUSD)}
                    </div>
                    <span className="text-[11px] font-bold text-[#9A4B12] font-mono-numbers">≈ Bs. {formatBs(totalLossBs)}</span>
                  </div>

                  <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daño / Vencimiento</span>
                    <div className="text-lg font-black text-[#BE123C] font-mono-numbers mt-0.5">
                      ${formatUSD(danoUSD)}
                    </div>
                    <span className="text-[11px] text-slate-500">Mercancía no comercializable</span>
                  </div>

                  <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uso Interno & Mermas</span>
                    <div className="text-lg font-black text-[#1D4ED8] font-mono-numbers mt-0.5">
                      ${formatUSD(usoInternoUSD + mermaUSD)}
                    </div>
                    <span className="text-[11px] text-slate-500">Insumos y mermas operativas</span>
                  </div>
                </div>

                {/* Discharges Table */}
                <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
                  <div className="p-3.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0B1528]">Libro de Desincorporaciones de Inventario</span>
                    <span className="text-slate-500 font-mono-numbers">{filteredDischarges.length} comprobantes</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#F8FAFC] text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-[#DCE4F0]">
                        <tr>
                          <th className="py-2.5 px-2 text-center">Acciones</th>
                          <th className="py-2.5 px-3 text-center">#</th>
                          <th className="py-2.5 px-3">Comprobante</th>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-3 text-center">Cantidad</th>
                          <th className="py-2.5 px-3">Motivo</th>
                          <th className="py-2.5 px-3 text-right">Costo Unit. $</th>
                          <th className="py-2.5 px-3 text-right font-bold">Pérdida Total $</th>
                          <th className="py-2.5 px-3 text-right">Pérdida Bs</th>
                          <th className="py-2.5 px-3">Responsable</th>
                          <th className="py-2.5 px-3">Observación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F7]">
                        {filteredDischarges.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-8 text-center text-slate-400 font-sans">
                              No hay registros de salidas o desincorporación de inventario.
                            </td>
                          </tr>
                        ) : (
                          filteredDischarges.map((disc, idx) => (
                            <tr key={disc.id} className="hover:bg-[#F8FAFC] transition-colors">
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDischargeForDetail(disc)}
                                    className="p-1.5 rounded-xl bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3] hover:bg-[#FFE6CE] transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="Ver comprobante de desincorporación"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ type: 'discharge', item: disc })}
                                    className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="Eliminar salida de inventario"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-[#9A4B12]">{disc.dischargeNumber}</td>
                              <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                {new Date(disc.date).toLocaleDateString('es-VE')}
                              </td>
                              <td className="py-2 px-3 font-sans font-bold text-[#0B1528]">{disc.productName}</td>
                              <td className="py-2 px-3 text-center font-bold text-[#0B1528] bg-[#F8FAFC] font-mono-numbers">{disc.quantity}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  disc.reason === 'Daño / Vencimiento' 
                                    ? 'bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD]' 
                                    : disc.reason === 'Uso Interno'
                                    ? 'bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC]'
                                    : 'bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3]'
                                }`}>
                                  {disc.reason}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 font-mono-numbers">${formatUSD(disc.unitCostUSD)}</td>
                              <td className="py-2 px-3 text-right font-bold text-[#BE123C] font-mono-numbers">${formatUSD(disc.totalLossUSD)}</td>
                              <td className="py-2 px-3 text-right text-slate-700 font-mono-numbers">{formatBs(disc.totalLossBs)}</td>
                              <td className="py-2 px-3 font-sans text-slate-700">{disc.responsibleName}</td>
                              <td className="py-2 px-3 font-sans text-slate-500 text-[11px] max-w-xs truncate">{disc.notes || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* SUBTAB: CIERRES DE CAJA DIARIOS Y ARQUEOS FISCALES */}
      {subTab === 'cierres_caja' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white/95 p-4 sm:p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Archive className="w-5 h-5 text-blue-600" />
                <span>Historial de Cierres Diarios y Arqueos de Caja</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Libro de cuadres, balances de apertura en efectivo/bancos, arqueos físicos y diferencias por turno
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCuadreModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#EBF3FE] hover:bg-blue-100 text-[#1D4ED8] border border-[#93C5FD] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Emitir Corte Parcial de Caja (Cierre X) del turno activo sin cerrar la caja"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Corte Parcial (Cierre X)</span>
              </button>

              <button
                type="button"
                onClick={() => exportHistorialCierresExcel(cashShiftHistory, businessInfo)}
                disabled={cashShiftHistory.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Descargar libro consolidado de todos los cierres de caja en Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Historial Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => exportHistorialCierresPDF(cashShiftHistory, businessInfo)}
                disabled={cashShiftHistory.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Descargar reporte formal en PDF de los cierres de caja"
              >
                <FileText className="w-4 h-4" />
                <span>Historial PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Cierres Realizados</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
                {cashShiftHistory.length}
              </div>
              <span className="text-[11px] text-slate-500">
                {cashShift?.isOpen ? '1 turno abierto actualmente' : 'Caja cerrada'}
              </span>
            </div>

            <div className="bg-gradient-to-b from-white to-[#F4F8FF] p-4 rounded-2xl border border-[#93C5FD] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase">
                <span>Ventas Acumuladas</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
                ${formatUSD(cashShiftHistory.reduce((acc, s) => acc + (s.totalSalesUSD || 0), 0))}
              </div>
              <span className="text-[11px] text-blue-700 font-mono-numbers font-bold">
                Bs. {formatBs(cashShiftHistory.reduce((acc, s) => acc + (s.totalSalesBs || 0), 0))}
              </span>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Efectivo Contado</span>
                <DollarSign className="w-4 h-4 text-[#065F46]" />
              </div>
              <div className="text-2xl font-black text-[#065F46] font-mono-numbers mt-1">
                ${formatUSD(cashShiftHistory.reduce((acc, s) => acc + (s.countedCashUSD || 0), 0))}
              </div>
              <span className="text-[11px] text-slate-500">
                Efectivo físico auditado en gavetas
              </span>
            </div>

            <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Sincronización Nube</span>
                <Cloud className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-sm font-black text-slate-900 mt-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Firestore Live Activo</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {googleUser?.email ? `Respaldado en ${googleUser.email}` : 'Sesión en tiempo real'}
              </span>
            </div>
          </div>

          {/* Active Shift Alert if open */}
          {cashShift?.isOpen && (
            <div className="p-4 bg-[#E7F8EE] border border-[#A7E6C4] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/80 text-[#065F46] border border-[#A7E6C4] flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#065F46] text-sm">Turno en Curso (Caja Abierta)</span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-[#065F46] border border-[#A7E6C4] text-[10px] font-black uppercase">
                      En Operación
                    </span>
                  </div>
                  <div className="text-xs text-[#065F46] mt-0.5 font-mono-numbers">
                    Apertura: {cashShift.openedDateFormatted || cashShift.openedAt} • Responsable: {cashShift.openedBy || 'Cajero'} • Fondo inicial: ${formatUSD(cashShift.initialCashUSD)} (Bs. {formatBs(cashShift.initialCashBs)})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCuadreModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Emitir Corte Parcial (Cierre X)</span>
              </button>
            </div>
          )}

          {/* Table of Closed Shifts */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Registros de Cierre y Arqueo ({cashShiftHistory.length} turnos)
              </span>
              <span className="text-[11px] text-slate-500">
                Haz clic en PDF o Excel en cada fila para descargar el acta del turno
              </span>
            </div>

            {cashShiftHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Archive className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Aún no hay reportes de cierre de caja guardados</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Al abrir la caja y realizar el Cierre de Caja al final del día, cada reporte se guardará automáticamente en tiempo real.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-slate-600 font-semibold uppercase text-[11px] border-b border-[#DCE4F0]">
                    <tr>
                      <th className="py-2.5 px-3 text-center">N°</th>
                      <th className="py-2.5 px-3">Apertura</th>
                      <th className="py-2.5 px-3">Cierre</th>
                      <th className="py-2.5 px-3">Cajero / Operador</th>
                      <th className="py-2.5 px-3 text-right">Fondo Inicial</th>
                      <th className="py-2.5 px-3 text-right">Ventas Turno</th>
                      <th className="py-2.5 px-3 text-right">Esperado $</th>
                      <th className="py-2.5 px-3 text-right">Contado $</th>
                      <th className="py-2.5 px-3 text-center">Resultado</th>
                      <th className="py-2.5 px-3 text-center">Descargar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4F0]/60 font-mono-numbers">
                    {cashShiftHistory.map((shift, idx) => {
                      const diffUSD = shift.differenceUSD || 0;
                      const isExact = Math.abs(diffUSD) < 0.01;
                      const isSurplus = diffUSD > 0.01;

                      return (
                        <tr key={shift.id || idx} className="hover:bg-[#EEF2F7]/60 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-sans">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-sans text-[11px]">
                            {shift.openedDateFormatted || shift.openedAt?.substring(0, 16)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-sans text-[11px]">
                            {shift.closedDateFormatted || shift.closedAt?.substring(0, 16) || 'Abierto'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-bold font-sans">
                            {shift.closedBy || shift.openedBy || 'Admin'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            <div>${formatUSD(shift.initialCashUSD)}</div>
                            {(Math.abs(shift.openingDifferenceUSD || 0) >= 0.01 || Math.abs(shift.openingDifferenceBs || 0) >= 0.01) && (
                              <span
                                title={`${shift.openingDifferenceReason || 'Diferencia de apertura'}${shift.openingDifferenceNotes ? ': ' + shift.openingDifferenceNotes : ''}`}
                                className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-sans text-[9px] font-extrabold"
                              >
                                Var. apertura
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#1D4ED8]">
                            ${formatUSD(shift.totalSalesUSD || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            ${formatUSD(shift.expectedCashUSD || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            ${formatUSD(shift.countedCashUSD || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {isExact ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46] font-bold text-[10px]">
                                Cuadre Exacto
                              </span>
                            ) : isSurplus ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] font-bold text-[10px]">
                                +${formatUSD(diffUSD)} Sobrante
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] font-bold text-[10px]">
                                -${formatUSD(Math.abs(diffUSD))} Faltante
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => exportCierreCajaPDF(shift, businessInfo, bcvRate)}
                                className="p-1.5 rounded-lg bg-[#FEECEF] hover:bg-rose-100 text-[#BE123C] border border-[#FBC4CD] transition-colors cursor-pointer"
                                title="Descargar Acta de Cierre en PDF"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => exportCierreCajaExcel(shift, businessInfo)}
                                className="p-1.5 rounded-lg bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] transition-colors cursor-pointer"
                                title="Descargar Acta de Cierre en Excel"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedShiftForDetail(shift)}
                                className="p-1.5 rounded-lg bg-[#EBF3FE] hover:bg-blue-100 text-[#1D4ED8] border border-[#C5DCFC] transition-colors cursor-pointer"
                                title="Ver desglose completo del turno"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: CUENTAS POR PAGAR Y GASTOS OPERATIVOS */}
      {subTab === 'cuentas_por_pagar' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="bg-white/95 p-4 sm:p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#BE123C]" />
                <span>Libro de Cuentas por Pagar y Pasivos con Proveedores</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Control contable de deudas a crédito comercial, abonos y gastos operativos del ejercicio
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportCuentasPorPagarExcel(cuentasPorPagar, businessInfo)}
                disabled={cuentasPorPagar.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Descargar libro de cuentas por pagar en Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => exportCuentasPorPagarPDF(cuentasPorPagar, businessInfo, bcvRate)}
                disabled={cuentasPorPagar.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                title="Descargar informe oficial de pasivos comerciales en PDF"
              >
                <FileText className="w-4 h-4" />
                <span>Exportar PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Accounts Payable Financial Cards */}
          {(() => {
            const totalDeudaUSD = cuentasPorPagar.reduce((acc, c) => acc + c.totalAmountUSD, 0);
            const totalAbonadoUSD = cuentasPorPagar.reduce((acc, c) => acc + c.paidAmountUSD, 0);
            const totalPendienteProveedoresUSD = cuentasPorPagar.reduce((acc, c) => acc + c.remainingUSD, 0);
            const totalPendienteGastosUSD = gastosOperativos
              .filter(g => g.status !== 'pagado')
              .reduce((acc, g) => acc + (g.remainingUSD ?? Math.max(0, g.amountUSD - (g.paidAmountUSD || 0))), 0);
            const totalGastosOpUSD = gastosOperativos.reduce((acc, g) => acc + g.amountUSD, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Deuda Global Proveedores</span>
                  <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">${formatUSD(totalDeudaUSD)}</div>
                  <span className="text-[11px] text-slate-500 font-mono-numbers">Bs. {formatBs(totalDeudaUSD * bcvRate)}</span>
                </div>

                <div className="bg-white/95 p-4 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                  <span className="text-xs font-bold text-[#065F46] uppercase block">Total Amortizado Proveedores</span>
                  <div className="text-2xl font-black text-[#065F46] font-mono-numbers mt-1">${formatUSD(totalAbonadoUSD)}</div>
                  <span className="text-[11px] text-[#065F46] font-mono-numbers">Bs. {formatBs(totalAbonadoUSD * bcvRate)}</span>
                </div>

                <div className="bg-[#FFF3E8] p-4 rounded-2xl border border-[#F5D3B3] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                  <span className="text-xs font-bold text-[#9A4B12] uppercase block">Saldo Pendiente Total</span>
                  <div className="text-2xl font-black text-[#7C3A0B] font-mono-numbers mt-1">${formatUSD(totalPendienteProveedoresUSD + totalPendienteGastosUSD)}</div>
                  <span className="text-[11px] text-[#9A4B12] font-mono-numbers font-bold">
                    Prov: ${formatUSD(totalPendienteProveedoresUSD)} • Gastos: ${formatUSD(totalPendienteGastosUSD)}
                  </span>
                </div>

                <div className="bg-gradient-to-b from-white to-[#F4F8FF] p-4 rounded-2xl border border-[#93C5FD] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
                  <span className="text-xs font-bold text-[#1D4ED8] uppercase block">Gastos Operativos (Mes)</span>
                  <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">${formatUSD(totalGastosOpUSD)}</div>
                  <span className="text-[11px] text-slate-500">Nómina, alquiler, insumos y servicios</span>
                </div>
              </div>
            );
          })()}

          {/* Table 1: Facturas a Proveedores */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Facturas y Compromisos de Pago a Proveedores ({cuentasPorPagar.length})</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Abonos parciales sincronizados en tiempo real con Firestore
              </span>
            </div>

            {cuentasPorPagar.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500" />
                <p className="text-sm font-bold text-slate-700">Sin facturas pendientes a proveedores</p>
                <p className="text-xs text-slate-400">
                  No tienes deudas comerciales registradas con proveedores en este momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-slate-600 font-semibold uppercase text-[11px] border-b border-[#DCE4F0]">
                    <tr>
                      <th className="py-2.5 px-2 text-center">Acciones</th>
                      <th className="py-2.5 px-3">Proveedor</th>
                      <th className="py-2.5 px-3">RIF / Contacto</th>
                      <th className="py-2.5 px-3">Factura N°</th>
                      <th className="py-2.5 px-3">Emisión</th>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3 text-right">Monto Total</th>
                      <th className="py-2.5 px-3 text-right">Abonado</th>
                      <th className="py-2.5 px-3 text-right">Saldo Restante</th>
                      <th className="py-2.5 px-3 text-center">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4F0]/60 font-mono-numbers">
                    {cuentasPorPagar.map((c) => (
                      <tr key={c.id} className="hover:bg-[#EEF2F7]/60 transition-colors">
                        <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedCuentaForDetail(c)}
                              className="p-1.5 rounded-lg bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                              title="Ver detalle e historial de abonos"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {c.status !== 'pagada' && (
                              <button
                                type="button"
                                onClick={() => handleOpenAbonoCuenta(c)}
                                className="p-1.5 rounded-lg bg-[#E7F8EE] text-[#065F46] border border-[#A7E6C4] hover:bg-emerald-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Registrar abono o pago"
                              >
                                <Coins className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditCuenta(c)}
                              className="p-1.5 rounded-lg bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center"
                              title="Editar cuenta por pagar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'cuenta', item: c })}
                              className="p-1.5 rounded-lg bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                              title="Eliminar cuenta por pagar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold font-sans text-slate-900">{c.supplierName}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans">
                          <div>{c.supplierRIF || '-'}</div>
                          {c.supplierPhone && <div className="text-[10px] text-slate-400">{c.supplierPhone}</div>}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{c.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{c.date}</td>
                        <td className="py-2.5 px-3 text-slate-700">{c.dueDate}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">${formatUSD(c.totalAmountUSD)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#065F46]">${formatUSD(c.paidAmountUSD)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[#BE123C]">${formatUSD(c.remainingUSD)}</td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          {c.status === 'pagada' ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46] font-bold text-[10px]">
                              Saldada
                            </span>
                          ) : c.status === 'parcial' ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#FFF3E8] border border-[#F5D3B3] text-[#9A4B12] font-bold text-[10px]">
                              Abono Parcial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] font-bold text-[10px]">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Table 2: Gastos del Mes e Insumos Operativos */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Gastos del Mes e Insumos (Papelería, Servicios, Nómina) ({gastosOperativos.length})</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Soporta abonos parciales con descuento directo en el flujo de caja diario
              </span>
            </div>

            {gastosOperativos.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-2">
                <Receipt className="w-9 h-9 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">Sin gastos operativos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-slate-600 font-semibold uppercase text-[11px] border-b border-[#DCE4F0]">
                    <tr>
                      <th className="py-2.5 px-2 text-center">Acciones</th>
                      <th className="py-2.5 px-3">Concepto / Categoría</th>
                      <th className="py-2.5 px-3">Proveedor / Emisor</th>
                      <th className="py-2.5 px-3">Factura / Recibo</th>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3 text-right">Total ($)</th>
                      <th className="py-2.5 px-3 text-right">Abonado ($)</th>
                      <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                      <th className="py-2.5 px-3 text-center">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4F0]/60 font-mono-numbers">
                    {gastosOperativos.map((g) => {
                      const paidUSD = g.paidAmountUSD ?? (g.status === 'pagado' ? g.amountUSD : 0);
                      const remainingUSD = g.remainingUSD ?? Math.max(0, g.amountUSD - paidUSD);
                      return (
                        <tr key={g.id} className="hover:bg-[#EEF2F7]/60 transition-colors">
                          <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedGastoForDetail(g)}
                                className="p-1.5 rounded-lg bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Ver detalle del gasto y abonos"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {g.status !== 'pagado' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAbonoGasto(g)}
                                  className="p-1.5 rounded-lg bg-[#E7F8EE] text-[#065F46] border border-[#A7E6C4] hover:bg-emerald-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                  title="Registrar abono parcial o pago total"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditGastoOp(g)}
                                className="p-1.5 rounded-lg bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Editar gasto operativo"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ type: 'gasto_op', item: g })}
                                className="p-1.5 rounded-lg bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Eliminar gasto operativo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-bold text-slate-900">{g.concept}</div>
                            <span className="text-[10px] font-bold text-[#1D4ED8] bg-[#EBF3FE] border border-[#C5DCFC] px-1.5 py-0.5 rounded">
                              {g.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">
                            <div className="font-semibold">{g.supplierName || 'Sin proveedor'}</div>
                            {(g.supplierRIF || g.supplierPhone) && (
                              <div className="text-[10px] text-slate-500">
                                {g.supplierRIF || ''}{g.supplierRIF && g.supplierPhone ? ' • ' : ''}{g.supplierPhone || ''}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{g.invoiceNumber || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{g.dueDate}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">${formatUSD(g.amountUSD)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#065F46]">${formatUSD(paidUSD)}</td>
                          <td className="py-2.5 px-3 text-right font-black text-[#BE123C]">${formatUSD(remainingUSD)}</td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {g.status === 'pagado' ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46] font-bold text-[10px]">
                                Pagado
                              </span>
                            ) : g.status === 'parcial' ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#FFF3E8] border border-[#F5D3B3] text-[#9A4B12] font-bold text-[10px]">
                                Abono Parcial
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] font-bold text-[10px]">
                                Pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: CONTROL DEL IGTF (3%) */}
      {subTab === 'igtf' && (
        <div className="space-y-6">
          <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#065F46]" />
                  <span>Control del IGTF (Impuesto a las Grandes Transacciones Financieras)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alícuota del 3% percibida sobre pagos recibidos en divisas (Efectivo USD) según providencia administrativa SENIAT
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportLibroVentasExcel(igtfSales, businessInfo)}
                  className="px-3.5 py-2 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Relación IGTF</span>
                </button>
              </div>
            </div>

            {/* IGTF Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-[#E7F8EE] border border-[#A7E6C4] rounded-2xl">
                <span className="text-xs font-bold text-[#065F46] uppercase block">
                  Base Gravable en Efectivo USD
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
                  ${formatUSD(totalIgtfBaseUSD)}
                </div>
                <span className="text-[11px] text-[#065F46]">Total cobrado en billetes divisa (directo y mixto)</span>
              </div>

              <div className="p-4 bg-[#0B1528] text-white rounded-2xl border border-[#0B1528]">
                <span className="text-xs font-bold text-blue-300 uppercase block">
                  Total IGTF 3% Percibido ($)
                </span>
                <div className="text-2xl font-black text-white font-mono-numbers mt-1">
                  ${formatUSD(totalIgtfTabUSD)}
                </div>
                <span className="text-[11px] text-slate-300">Fondos retenidos para enterar al SENIAT</span>
              </div>

              <div className="p-4 bg-gradient-to-b from-white to-[#F4F8FF] border border-[#93C5FD] rounded-2xl">
                <span className="text-xs font-bold text-[#1D4ED8] uppercase block">
                  Equivalente IGTF en Bolívares
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
                  Bs. {formatBs(totalIgtfTabBs)}
                </div>
                <span className="text-[11px] text-slate-500">A tasa BCV de facturación</span>
              </div>
            </div>
          </div>

          {/* IGTF Transactions Table */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#DCE4F0] text-xs font-bold text-slate-700">
              Operaciones Sujetas a Retención de IGTF (Efectivo USD y Pagos Combinados con Divisa)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-numbers">
                <thead className="bg-[#F8FAFC] text-slate-600 font-semibold uppercase text-[11px] border-b border-[#DCE4F0]">
                  <tr>
                    <th className="py-2.5 px-2 text-center">Acciones</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Factura</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">RIF</th>
                    <th className="py-2.5 px-3 text-right">Base Divisa ($)</th>
                    <th className="py-2.5 px-3 text-right">IGTF 3% ($)</th>
                    <th className="py-2.5 px-3 text-right">IGTF 3% (Bs)</th>
                    <th className="py-2.5 px-3 text-right">Total Factura ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4F0]/60">
                  {igtfSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-[#EEF2F7]/60">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedSaleForTicket(sale)}
                            className="p-1.5 rounded-lg bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Ver recibo / ticket de venta"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSale(sale)}
                            className="p-1.5 rounded-lg bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Editar datos de la venta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRestoreStockOnSaleDelete(false); setDeleteTarget({ type: 'sale', item: sale }); }}
                            className="p-1.5 rounded-lg bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Eliminar venta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700">{new Date(sale.date).toLocaleDateString('es-VE')}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {sale.invoiceNumber}
                        {sale.paymentMethod === 'pago_combinado' && (
                          <span className="ml-1.5 text-[9px] font-sans font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Mixto
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-800">{sale.clientName}</td>
                      <td className="py-2 px-3 text-slate-600">{sale.clientRIF}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">${formatUSD(getSaleIgtfBaseUSD(sale))}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#065F46]">${formatUSD(sale.igtfUSD)}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#065F46]">Bs. {formatBs(sale.igtfBs)}</td>
                      <td className="py-2 px-3 text-right font-black text-slate-900">${formatUSD(sale.totalUSD)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ESTADO DE CUENTA DEL NEGOCIO & BALANCE GENERAL */}
      {subTab === 'estado_cuenta' && (
        <div className="space-y-6">
          {/* Header Action with export */}
          <div className="bg-white/95 p-4 sm:p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Estado de Cuenta y Cuadre General</h3>
              <p className="text-xs text-slate-500">Conciliación bimonetaria de Ingresos vs Egresos</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportEstadoCuentaExcel(estadoCuentaSummary, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportEstadoCuentaPDF(estadoCuentaSummary, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>Exportar a PDF (Oficial)</span>
              </button>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ingresos */}
            <div className="bg-white/95 p-5 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Ingresos (Ventas)</span>
                <span className="p-1.5 rounded-lg bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46]">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers">
                ${formatUSD(netIngresosUSD)}
              </div>
              <div className="text-xs font-bold text-[#065F46] font-mono-numbers">
                Bs. {formatBs(netIngresosBs)}
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-[#DCE4F0]">
                {activeSales.length} ventas activas{totalCreditNotesUSD > 0 ? ` (-$${formatUSD(totalCreditNotesUSD)} en notas de crédito)` : ''}
              </p>
            </div>

            {/* Egresos */}
            <div className="bg-white/95 p-5 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Gastos Operativos y Compras</span>
                <span className="p-1.5 rounded-lg bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C]">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers">
                ${formatUSD(allExpUSD)}
              </div>
              <div className="text-xs font-bold text-[#BE123C] font-mono-numbers">
                Bs. {formatBs(allExpBs)}
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-[#DCE4F0]">
                Incluye compras, operativos y sueldo propietario (excluye retiros personales)
              </p>
            </div>

            {/* Saldo Neto */}
            <div className="bg-[#0B1528] text-white p-5 rounded-2xl shadow-md border border-[#0B1528] space-y-2">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                Rentabilidad Operativa Real
              </span>
              <div className="text-3xl font-black text-white font-mono-numbers">
                ${formatUSD(netUSD)}
              </div>
              <div className="text-sm font-bold text-blue-200 font-mono-numbers">
                Bs. {formatBs(netBs)}
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-white/10">
                Utilidad real del negocio antes de retiros personales e impuestos
              </p>
            </div>
          </div>

          {/* Separated Owner Salary & Personal Withdrawals Breakdown */}
          {(sueldoPropietarioUSD > 0 || sueldoPropietarioBs > 0 || retirosPersonalesUSD > 0 || retirosPersonalesBs > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 space-y-1">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                  Sueldo Propietario / Nómina (en Gastos Operativos)
                </span>
                <div className="text-xl font-black text-indigo-950 font-mono-numbers">
                  ${formatUSD(sueldoPropietarioUSD)}
                </div>
                <div className="text-xs font-bold text-indigo-700 font-mono-numbers">
                  Bs. {formatBs(sueldoPropietarioBs)}
                </div>
                <p className="text-[10px] text-indigo-800/80">
                  Incluido en rentabilidad operativa • Excluido del Libro de Compras SENIAT
                </p>
              </div>

              <div className="bg-purple-50/80 p-4 rounded-2xl border border-purple-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">
                    Retiros Personales / Adelanto Dueño
                  </span>
                  <Wallet className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl font-black text-purple-950 font-mono-numbers">
                  ${formatUSD(retirosPersonalesUSD)}
                </div>
                <div className="text-xs font-bold text-purple-700 font-mono-numbers">
                  Bs. {formatBs(retirosPersonalesBs)}
                </div>
                <p className="text-[10px] text-purple-800/80">
                  Separado de costos operativos • Descontado de caja/banco • Sin SENIAT
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Flujo Neto Disponible tras Retiros Personales
                </span>
                <div className={`text-xl font-black font-mono-numbers ${flujoTrasRetirosUSD >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                  ${formatUSD(flujoTrasRetirosUSD)}
                </div>
                <div className="text-xs font-bold text-slate-700 font-mono-numbers">
                  Bs. {formatBs(flujoTrasRetirosBs)}
                </div>
                <p className="text-[10px] text-slate-500">
                  Rentabilidad operativa menos retiros personales del dueño
                </p>
              </div>
            </div>
          )}

          {/* Breakdown by Payment Method Table */}
          <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#DCE4F0] text-xs font-bold text-slate-800">
              Desglose de Ingresos por Medio de Pago
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-slate-600 font-semibold uppercase text-[11px] border-b border-[#DCE4F0]">
                  <tr>
                    <th className="py-2.5 px-4">Método de Pago</th>
                    <th className="py-2.5 px-4 text-center">N° Operaciones</th>
                    <th className="py-2.5 px-4 text-right">Total USD ($)</th>
                    <th className="py-2.5 px-4 text-right">Total Bolívares (Bs)</th>
                    <th className="py-2.5 px-4 text-right">Participación (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4F0]/60 font-mono-numbers">
                  {Object.entries(methodsVentas).map(([method, amounts]) => {
                    const count = activeSales.filter(s => s.paymentMethod === method).length;
                    const pct = allActiveSalesUSD > 0 ? (amounts.usd / allActiveSalesUSD) * 100 : 0;

                    return (
                      <tr key={method} className="hover:bg-[#EEF2F7]/60">
                        <td className="py-3 px-4 font-bold font-sans text-slate-800 uppercase">
                          {method.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">{count}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">${formatUSD(amounts.usd)}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#1D4ED8]">Bs. {formatBs(amounts.bs)}</td>
                        <td className="py-3 px-4 text-right font-sans text-slate-600">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Registrar / Editar Gasto Modal */}
      <RegistrarGastoModal
        isOpen={isGastoModalOpen}
        onClose={() => { setIsGastoModalOpen(false); setEditingExpense(null); }}
        editingExpense={editingExpense}
      />

      {/* Backup en Google Drive y Descargas Contables Modal */}
      <BackupDriveModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* Modal Detalle de Cierre de Caja Seleccionado */}
      {selectedShiftForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1528]/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#DCE4F0] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] flex items-center justify-center">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Acta y Auditoría del Cierre de Caja
                  </h3>
                  <p className="text-xs text-slate-500">
                    Turno ID: <span className="font-mono-numbers font-bold text-slate-700">{selectedShiftForDetail.id}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="w-8 h-8 rounded-full bg-[#EEF2F7] hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shift metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#DCE4F0] text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cajero / Operador</span>
                <span className="font-bold text-slate-900">{selectedShiftForDetail.closedBy || selectedShiftForDetail.openedBy || 'Admin'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Apertura</span>
                <span className="font-medium text-slate-800">{selectedShiftForDetail.openedDateFormatted || selectedShiftForDetail.openedAt}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cierre</span>
                <span className="font-medium text-slate-800">{selectedShiftForDetail.closedDateFormatted || selectedShiftForDetail.closedAt || 'En curso'}</span>
              </div>
            </div>

            {/* Financial Reconciliation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#DCE4F0] space-y-2 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                  Fondo Inicial & Ventas
                </span>
                <div className="flex justify-between py-1 border-b border-[#DCE4F0]">
                  <span className="text-slate-500">Fondo Inicial Apertura ($):</span>
                  <span className="font-bold text-slate-900 font-mono-numbers">${formatUSD(selectedShiftForDetail.initialCashUSD)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#DCE4F0]">
                  <span className="text-slate-500">Fondo Inicial Apertura (Bs):</span>
                  <span className="font-bold text-slate-900 font-mono-numbers">Bs. {formatBs(selectedShiftForDetail.initialCashBs)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#DCE4F0]">
                  <span className="text-slate-500">Ventas Totales del Turno ($):</span>
                  <span className="font-bold text-[#1D4ED8] font-mono-numbers">${formatUSD(selectedShiftForDetail.totalSalesUSD || 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Gastos Pagados en Efectivo ($):</span>
                  <span className="font-bold text-[#BE123C] font-mono-numbers">${formatUSD(selectedShiftForDetail.totalExpensesUSD || 0)}</span>
                </div>
                {((selectedShiftForDetail.totalOwnerSalaryUSD || 0) > 0 || (selectedShiftForDetail.totalOwnerSalaryBs || 0) > 0) && (
                  <div className="flex justify-between py-1 border-t border-[#DCE4F0] text-indigo-800">
                    <span>Sueldo Propietario (Turno):</span>
                    <span className="font-bold font-mono-numbers">
                      ${formatUSD(selectedShiftForDetail.totalOwnerSalaryUSD || 0)} / Bs {formatBs(selectedShiftForDetail.totalOwnerSalaryBs || 0)}
                    </span>
                  </div>
                )}
                {((selectedShiftForDetail.totalOwnerWithdrawalsUSD || 0) > 0 || (selectedShiftForDetail.totalOwnerWithdrawalsBs || 0) > 0) && (
                  <div className="flex justify-between py-1 border-t border-[#DCE4F0] text-purple-800">
                    <span>Retiros Personales (Turno):</span>
                    <span className="font-bold font-mono-numbers">
                      ${formatUSD(selectedShiftForDetail.totalOwnerWithdrawalsUSD || 0)} / Bs {formatBs(selectedShiftForDetail.totalOwnerWithdrawalsBs || 0)}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#E7F8EE] rounded-2xl border border-[#A7E6C4] space-y-2 text-xs">
                <span className="font-bold text-[#065F46] uppercase tracking-wider block text-[11px]">
                  Resultado del Cuadre Físico
                </span>
                <div className="flex justify-between py-1 border-b border-[#A7E6C4]">
                  <span className="text-[#065F46]">Efectivo Teórico Esperado ($):</span>
                  <span className="font-black text-slate-900 font-mono-numbers">${formatUSD(selectedShiftForDetail.expectedCashUSD || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#A7E6C4]">
                  <span className="text-[#065F46]">Efectivo Físico Contado ($):</span>
                  <span className="font-black text-slate-900 font-mono-numbers">${formatUSD(selectedShiftForDetail.countedCashUSD || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#A7E6C4]">
                  <span className="text-[#065F46]">Diferencia / Descuadre ($):</span>
                  <span className={`font-black font-mono-numbers ${
                    Math.abs(selectedShiftForDetail.differenceUSD || 0) < 0.01 
                      ? 'text-[#065F46]' 
                      : (selectedShiftForDetail.differenceUSD || 0) > 0 ? 'text-[#1D4ED8]' : 'text-[#BE123C]'
                  }`}>
                    ${formatUSD(selectedShiftForDetail.differenceUSD || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#065F46]">Estatus:</span>
                  <span className="font-extrabold text-[#065F46] uppercase text-[11px]">
                    {Math.abs(selectedShiftForDetail.differenceUSD || 0) < 0.01 
                      ? '✓ Cuadre Exacto' 
                      : (selectedShiftForDetail.differenceUSD || 0) > 0 ? '+ Sobrante' : '- Faltante'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Balances if available */}
            {selectedShiftForDetail.initialBanks && selectedShiftForDetail.initialBanks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Cuentas Bancarias Registradas en este Turno
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-[#DCE4F0]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F8FAFC] text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Banco</th>
                        <th className="py-2 px-3">Cuenta</th>
                        <th className="py-2 px-3 text-right">Inicial Bs</th>
                        <th className="py-2 px-3 text-right">Egresos Bs</th>
                        <th className="py-2 px-3 text-right">Esperado Bs</th>
                        <th className="py-2 px-3 text-right">Cierre Bs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE4F0]/60 font-mono-numbers">
                      {selectedShiftForDetail.initialBanks.map((b, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-sans font-bold text-slate-800">{b.bankName}</td>
                          <td className="py-2 px-3 text-slate-600">{b.accountNumber}</td>
                          <td className="py-2 px-3 text-right text-slate-700">Bs. {formatBs(b.initialBalanceBs)}</td>
                          <td className="py-2 px-3 text-right text-rose-600">
                            {(b.outflowsBs || 0) > 0 ? `-Bs. ${formatBs(b.outflowsBs || 0)}` : 'Bs. 0,00'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-[#1D4ED8]">
                            Bs. {formatBs(b.expectedBalanceBs ?? b.initialBalanceBs)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            Bs. {formatBs(b.countedBalanceBs ?? b.expectedBalanceBs ?? b.initialBalanceBs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sales breakdown by method if available */}
            {selectedShiftForDetail.salesBreakdown && Object.keys(selectedShiftForDetail.salesBreakdown).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Desglose de Formas de Pago Recibidas
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(selectedShiftForDetail.salesBreakdown).map(([method, val]) => (
                    <div key={method} className="p-2.5 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs">
                      <span className="font-bold text-slate-600 block uppercase text-[10px]">{method.replace('_', ' ')}</span>
                      <div className="font-bold text-slate-900 font-mono-numbers mt-0.5">${formatUSD(val.usd)}</div>
                      <span className="text-[10px] text-[#1D4ED8] font-mono-numbers">Bs. {formatBs(val.bs)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opening Audit vs Previous Shift (Internal Cash Control Only) */}
            {(Math.abs(selectedShiftForDetail.openingDifferenceUSD || 0) >= 0.01 ||
              Math.abs(selectedShiftForDetail.openingDifferenceBs || 0) >= 0.01 ||
              selectedShiftForDetail.openingDifferenceReason ||
              selectedShiftForDetail.openingDifferenceNotes ||
              selectedShiftForDetail.notes) && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-extrabold uppercase tracking-wider text-[11px] text-amber-900">
                    Auditoría de Apertura vs Cierre Anterior
                  </span>
                  {selectedShiftForDetail.previousCloseDateFormatted && (
                    <span className="text-[10px] font-semibold text-amber-800">
                      Ref. cierre: {selectedShiftForDetail.previousCloseDateFormatted}
                    </span>
                  )}
                </div>

                {(typeof selectedShiftForDetail.openingDifferenceUSD === 'number' ||
                  typeof selectedShiftForDetail.openingDifferenceBs === 'number') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/80 border border-amber-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Variación apertura USD:</span>
                      <span className="font-mono-numbers font-extrabold text-slate-900">
                        {(selectedShiftForDetail.openingDifferenceUSD || 0) > 0 ? '+' : (selectedShiftForDetail.openingDifferenceUSD || 0) < 0 ? '-' : ''}
                        ${formatUSD(Math.abs(selectedShiftForDetail.openingDifferenceUSD || 0))}
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/80 border border-amber-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Variación apertura Bs:</span>
                      <span className="font-mono-numbers font-extrabold text-slate-900">
                        {(selectedShiftForDetail.openingDifferenceBs || 0) > 0 ? '+' : (selectedShiftForDetail.openingDifferenceBs || 0) < 0 ? '-' : ''}
                        Bs. {formatBs(Math.abs(selectedShiftForDetail.openingDifferenceBs || 0))}
                      </span>
                    </div>
                  </div>
                )}

                {selectedShiftForDetail.openingDifferenceReason && (
                  <div>
                    <strong>Motivo de apertura:</strong> {selectedShiftForDetail.openingDifferenceReason}
                  </div>
                )}
                {(selectedShiftForDetail.openingMatchedMovementsCount || 0) > 0 && (
                  <div className="text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5">
                    <strong>Respaldo por retiros/egresos entre turnos ({selectedShiftForDetail.openingMatchedMovementsCount}):</strong>{' '}
                    {(selectedShiftForDetail.openingMatchedOutflowsUSD || 0) > 0 ? `$${formatUSD(selectedShiftForDetail.openingMatchedOutflowsUSD || 0)}` : ''}
                    {(selectedShiftForDetail.openingMatchedOutflowsUSD || 0) > 0 && (selectedShiftForDetail.openingMatchedOutflowsBs || 0) > 0 ? ' • ' : ''}
                    {(selectedShiftForDetail.openingMatchedOutflowsBs || 0) > 0 ? `Bs. ${formatBs(selectedShiftForDetail.openingMatchedOutflowsBs || 0)}` : ''}
                  </div>
                )}
                {selectedShiftForDetail.openingDifferenceNotes && (
                  <div>
                    <strong>Justificación:</strong> {selectedShiftForDetail.openingDifferenceNotes}
                  </div>
                )}
                {selectedShiftForDetail.notes && (
                  <div>
                    <strong>Notas de apertura:</strong> {selectedShiftForDetail.notes}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {selectedShiftForDetail.closedNotes && (
              <div className="p-3 bg-[#FFF3E8] border border-[#F5D3B3] rounded-xl text-xs text-[#7C3A0B]">
                <strong>Observaciones de Cierre:</strong> {selectedShiftForDetail.closedNotes}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#DCE4F0]">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => exportCierreCajaPDF(selectedShiftForDetail, businessInfo, bcvRate)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileText className="w-4 h-4 text-rose-300" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportCierreCajaExcel(selectedShiftForDetail, businessInfo)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar Excel</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#EEF2F7] hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Comprobante Ticket de Venta */}
      {selectedSaleForTicket && (
        <ComprobanteTicketModal
          sale={selectedSaleForTicket}
          onClose={() => setSelectedSaleForTicket(null)}
          businessInfo={businessInfo}
        />
      )}

      {/* Modal: Comprobante Nota de Crédito */}
      {selectedCreditNoteForTicket && (
        <ComprobanteNotaCreditoModal
          creditNote={selectedCreditNoteForTicket}
          onClose={() => setSelectedCreditNoteForTicket(null)}
          businessInfo={businessInfo}
        />
      )}

      {/* Modal: Comprobante de Factura de Compra / Gasto */}
      {selectedExpenseForTicket && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-3.5 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-300" />
                Comprobante de Compra / Gasto
              </span>
              <button 
                onClick={() => setSelectedExpenseForTicket(null)} 
                className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="text-center border-b border-dashed border-[#DCE4F0] pb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] uppercase">
                  {selectedExpenseForTicket.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {selectedExpenseForTicket.supplierName}
                </h3>
                <p className="text-xs text-slate-500 font-mono-numbers">
                  RIF: {selectedExpenseForTicket.supplierRIF}
                  {selectedExpenseForTicket.supplierPhone ? ` • Tel: ${selectedExpenseForTicket.supplierPhone}` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fecha: {new Date(selectedExpenseForTicket.date).toLocaleString('es-VE')}
                </p>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl p-3.5 space-y-2 border border-[#DCE4F0] text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nº Factura:</span>
                  <span className="font-bold text-slate-900 font-mono-numbers">{selectedExpenseForTicket.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nº Control:</span>
                  <span className="font-bold text-slate-700 font-mono-numbers">{selectedExpenseForTicket.controlNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Método de Pago:</span>
                  <span className="font-bold text-slate-800 uppercase text-[11px]">
                    {selectedExpenseForTicket.paymentMethod.replace('_', ' ')}
                  </span>
                </div>
                {selectedExpenseForTicket.reference && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Referencia:</span>
                    <span className="font-bold text-slate-700 font-mono-numbers">{selectedExpenseForTicket.reference}</span>
                  </div>
                )}
                {selectedExpenseForTicket.description && (
                  <div className="pt-2 border-t border-[#DCE4F0] text-slate-600">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Concepto:</span>
                    <span>{selectedExpenseForTicket.description}</span>
                  </div>
                )}

                {selectedExpenseForTicket.items && selectedExpenseForTicket.items.length > 0 && (
                  <div className="pt-2 border-t border-[#DCE4F0]">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      <span>Artículos Comprados ({selectedExpenseForTicket.items.length}):</span>
                      {selectedExpenseForTicket.costStrategy && (
                        <span className="text-[#1D4ED8] normal-case font-semibold">
                          {selectedExpenseForTicket.costStrategy === 'fifo' ? 'Estrategia FIFO' : 'Precio Actualizado'}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 bg-white rounded-xl p-2 border border-[#DCE4F0] text-[11px]">
                      {selectedExpenseForTicket.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-[#DCE4F0]/60 last:border-0">
                          <div>
                            <span className="font-semibold text-slate-800">{it.productName}</span>
                            <span className="text-slate-500 text-[10px] block font-mono-numbers">
                              +{it.quantity} unids × ${it.unitCostUSD.toFixed(2)} (≈ Bs. {formatBs(it.unitCostUSD * (selectedExpenseForTicket.bcvRate || bcvRate))})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono-numbers font-bold text-slate-900">${it.totalCostUSD.toFixed(2)}</span>
                            <span className={`block text-[9px] font-bold ${it.strategy === 'fifo' ? 'text-[#065F46]' : 'text-[#1D4ED8]'}`}>
                              {it.strategy === 'fifo'
                                ? 'Lote FIFO'
                                : it.newPriceCurrency === 'Bs' && typeof it.newPriceBs === 'number' && it.newPriceBs > 0
                                  ? `Venta: Bs. ${formatBs(it.newPriceBs)}`
                                  : `Venta: $${it.newPriceUSD?.toFixed(2) || '0'}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Financial SENIAT Breakdown */}
              <div className="space-y-1.5 text-xs font-mono-numbers">
                <div className="flex justify-between text-slate-600">
                  <span>Base Imponible (16%):</span>
                  <span>Bs. {formatBs(selectedExpenseForTicket.baseImponibleBs)}</span>
                </div>
                <div className="flex justify-between text-[#1D4ED8] font-semibold">
                  <span>IVA Crédito Fiscal (16%):</span>
                  <span>+ Bs. {formatBs(selectedExpenseForTicket.ivaBs)}</span>
                </div>
                {selectedExpenseForTicket.retencionIVABs > 0 && (
                  <div className="flex justify-between text-[#9A4B12]">
                    <span>Retención IVA 75%:</span>
                    <span>- Bs. {formatBs(selectedExpenseForTicket.retencionIVABs)}</span>
                  </div>
                )}
                {selectedExpenseForTicket.retencionISLRBs > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Retención ISLR:</span>
                    <span>- Bs. {formatBs(selectedExpenseForTicket.retencionISLRBs)}</span>
                  </div>
                )}
                <div className="pt-2 border-t-2 border-[#0B1528] flex justify-between font-bold text-sm text-slate-900">
                  <span>TOTAL PAGADO:</span>
                  <span>Bs. {formatBs(selectedExpenseForTicket.amountBs)}</span>
                </div>
                <div className="text-right text-xs text-[#065F46] font-bold">
                  ≈ ${formatUSD(selectedExpenseForTicket.amountUSD)} USD (Tasa: Bs. {formatBs(selectedExpenseForTicket.bcvRate || bcvRate)})
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const exp = selectedExpenseForTicket;
                    setSelectedExpenseForTicket(null);
                    setEditingExpense(exp);
                    setIsGastoModalOpen(true);
                  }}
                  className="px-3 py-2 bg-white border border-[#DCE4F0] text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const exp = selectedExpenseForTicket;
                    setSelectedExpenseForTicket(null);
                    setDeleteTarget({ type: 'expense', item: exp });
                  }}
                  className="px-3 py-2 bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseForTicket(null)}
                className="px-4 py-2 bg-[#0B1528] text-white rounded-xl text-xs font-bold hover:bg-[#152440] transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Desincorporación / Salida de Inventario (Ojito) */}
      {selectedDischargeForDetail && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-amber-300" />
                Comprobante de Salida / Merma
              </span>
              <button onClick={() => setSelectedDischargeForDetail(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[#DCE4F0] pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nº Comprobante</span>
                  <span className="text-base font-black text-[#9A4B12] font-mono-numbers">{selectedDischargeForDetail.dischargeNumber}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  selectedDischargeForDetail.reason === 'Daño / Vencimiento'
                    ? 'bg-[#FEECEF] border-[#FBC4CD] text-[#BE123C]'
                    : selectedDischargeForDetail.reason === 'Uso Interno'
                    ? 'bg-[#EBF3FE] border-[#C5DCFC] text-[#1D4ED8]'
                    : 'bg-[#FFF3E8] border-[#F5D3B3] text-[#9A4B12]'
                }`}>
                  {selectedDischargeForDetail.reason}
                </span>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl p-3.5 space-y-2 border border-[#DCE4F0]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Producto:</span>
                  <span className="font-bold text-slate-900">{selectedDischargeForDetail.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Código / Categoría:</span>
                  <span className="font-mono-numbers text-slate-700">{selectedDischargeForDetail.productCode} • {selectedDischargeForDetail.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cantidad Desincorporada:</span>
                  <span className="font-black text-slate-900 font-mono-numbers">{selectedDischargeForDetail.quantity} unid.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Costo Unitario:</span>
                  <span className="font-mono-numbers font-bold text-slate-700">${formatUSD(selectedDischargeForDetail.unitCostUSD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Responsable:</span>
                  <span className="font-bold text-slate-800">{selectedDischargeForDetail.responsibleName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha y Hora:</span>
                  <span className="font-mono-numbers text-slate-600">{new Date(selectedDischargeForDetail.date).toLocaleString('es-VE')}</span>
                </div>
                {selectedDischargeForDetail.notes && (
                  <div className="pt-2 border-t border-[#DCE4F0]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Observaciones:</span>
                    <p className="text-slate-700 mt-0.5">{selectedDischargeForDetail.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#FEECEF] border border-[#FBC4CD] rounded-2xl flex items-center justify-between">
                <span className="font-bold text-[#BE123C]">Pérdida Contable Total:</span>
                <div className="text-right font-mono-numbers">
                  <div className="text-base font-black text-[#BE123C]">${formatUSD(selectedDischargeForDetail.totalLossUSD)}</div>
                  <div className="text-[11px] font-bold text-[#BE123C]">Bs. {formatBs(selectedDischargeForDetail.totalLossBs)}</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const item = selectedDischargeForDetail;
                  setSelectedDischargeForDetail(null);
                  setDeleteTarget({ type: 'discharge', item });
                }}
                className="px-3 py-2 bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDischargeForDetail(null)}
                className="px-4 py-2 bg-[#0B1528] text-white rounded-xl text-xs font-bold hover:bg-[#152440] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Cuenta por Pagar a Proveedor (Ojito) */}
      {selectedCuentaForDetail && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-300" />
                Detalle de Cuenta por Pagar (Proveedor)
              </span>
              <button onClick={() => setSelectedCuentaForDetail(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-[#DCE4F0] pb-3">
                <div>
                  <h4 className="text-base font-black text-slate-900">{selectedCuentaForDetail.supplierName}</h4>
                  <p className="text-slate-500 font-mono-numbers mt-0.5">
                    {selectedCuentaForDetail.supplierRIF || 'Sin RIF'}
                    {selectedCuentaForDetail.supplierPhone ? ` • ${selectedCuentaForDetail.supplierPhone}` : ''}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                  selectedCuentaForDetail.status === 'pagada'
                    ? 'bg-[#E7F8EE] border-[#A7E6C4] text-[#065F46]'
                    : selectedCuentaForDetail.status === 'parcial'
                    ? 'bg-[#FFF3E8] border-[#F5D3B3] text-[#9A4B12]'
                    : 'bg-[#FEECEF] border-[#FBC4CD] text-[#BE123C]'
                }`}>
                  {selectedCuentaForDetail.status === 'pagada' ? 'Saldada' : selectedCuentaForDetail.status === 'parcial' ? 'Abono Parcial' : 'Pendiente'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0] font-mono-numbers">
                <div>
                  <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Total</span>
                  <span className="font-black text-slate-900">${formatUSD(selectedCuentaForDetail.totalAmountUSD)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Abonado</span>
                  <span className="font-black text-[#065F46]">${formatUSD(selectedCuentaForDetail.paidAmountUSD)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Saldo</span>
                  <span className="font-black text-[#BE123C]">${formatUSD(selectedCuentaForDetail.remainingUSD)}</span>
                </div>
              </div>

              <div className="space-y-1.5 bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0]">
                <div className="flex justify-between"><span className="text-slate-500">Factura Nº:</span><span className="font-mono-numbers font-bold">{selectedCuentaForDetail.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Emisión / Vence:</span><span className="font-mono-numbers">{selectedCuentaForDetail.date} → {selectedCuentaForDetail.dueDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Categoría:</span><span className="font-bold">{selectedCuentaForDetail.category}</span></div>
                {selectedCuentaForDetail.description && (
                  <div className="pt-1.5 border-t border-[#DCE4F0]"><span className="text-slate-500 block">Concepto:</span><span className="text-slate-800">{selectedCuentaForDetail.description}</span></div>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 uppercase text-[11px]">Historial de Abonos ({selectedCuentaForDetail.abonos.length})</h5>
                {selectedCuentaForDetail.abonos.length === 0 ? (
                  <p className="text-slate-400 italic">No se han registrado abonos todavía.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedCuentaForDetail.abonos.map(ab => (
                      <div key={ab.id} className="flex items-center justify-between p-2.5 bg-[#E7F8EE] border border-[#A7E6C4] rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')}</span>
                          <span className="block text-[10px] text-slate-500 font-mono-numbers">
                            {new Date(ab.date).toLocaleDateString('es-VE')} {ab.reference ? `• Ref: ${ab.reference}` : ''}
                          </span>
                        </div>
                        <div className="text-right font-mono-numbers">
                          <span className="font-black text-[#065F46]">${formatUSD(ab.amountUSD)}</span>
                          <span className="block text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex items-center justify-between">
              {selectedCuentaForDetail.status !== 'pagada' ? (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCuentaForDetail;
                    setSelectedCuentaForDetail(null);
                    handleOpenAbonoCuenta(c);
                  }}
                  className="px-3.5 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Registrar Abono</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedCuentaForDetail(null)}
                className="px-4 py-2 bg-[#0B1528] text-white rounded-xl text-xs font-bold hover:bg-[#152440] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Gasto del Mes / Insumos (Ojito) */}
      {selectedGastoForDetail && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-300" />
                Detalle de Gasto Operativo / Insumo
              </span>
              <button onClick={() => setSelectedGastoForDetail(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-[#DCE4F0] pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] text-[10px] font-bold uppercase">
                    {selectedGastoForDetail.category}
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-1">{selectedGastoForDetail.concept}</h4>
                  <p className="text-slate-500 mt-0.5">{selectedGastoForDetail.month}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                  selectedGastoForDetail.status === 'pagado'
                    ? 'bg-[#E7F8EE] border-[#A7E6C4] text-[#065F46]'
                    : selectedGastoForDetail.status === 'parcial'
                    ? 'bg-[#FFF3E8] border-[#F5D3B3] text-[#9A4B12]'
                    : 'bg-[#FEECEF] border-[#FBC4CD] text-[#BE123C]'
                }`}>
                  {selectedGastoForDetail.status === 'pagado' ? 'Pagado' : selectedGastoForDetail.status === 'parcial' ? 'Abono Parcial' : 'Pendiente'}
                </span>
              </div>

              {(selectedGastoForDetail.supplierName || selectedGastoForDetail.supplierRIF || selectedGastoForDetail.supplierPhone || selectedGastoForDetail.invoiceNumber) && (
                <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#DCE4F0] space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Datos Fiscales y Contacto del Proveedor</div>
                  {selectedGastoForDetail.supplierName && (
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{selectedGastoForDetail.supplierName}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-slate-600 font-mono-numbers">
                    {selectedGastoForDetail.supplierRIF && <span>RIF/CI: {selectedGastoForDetail.supplierRIF}</span>}
                    {selectedGastoForDetail.supplierPhone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedGastoForDetail.supplierPhone}
                      </span>
                    )}
                    {selectedGastoForDetail.invoiceNumber && (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                        <Hash className="w-3 h-3" />
                        Fact: {selectedGastoForDetail.invoiceNumber}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                const paidUSD = selectedGastoForDetail.paidAmountUSD ?? (selectedGastoForDetail.status === 'pagado' ? selectedGastoForDetail.amountUSD : 0);
                const remUSD = selectedGastoForDetail.remainingUSD ?? Math.max(0, selectedGastoForDetail.amountUSD - paidUSD);
                return (
                  <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0] font-mono-numbers">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Total</span>
                      <span className="font-black text-slate-900">${formatUSD(selectedGastoForDetail.amountUSD)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Abonado</span>
                      <span className="font-black text-[#065F46]">${formatUSD(paidUSD)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Pendiente</span>
                      <span className="font-black text-[#BE123C]">${formatUSD(remUSD)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 uppercase text-[11px]">
                  Historial de Abonos / Pagos ({(selectedGastoForDetail.abonos || []).length})
                </h5>
                {!selectedGastoForDetail.abonos || selectedGastoForDetail.abonos.length === 0 ? (
                  <p className="text-slate-400 italic">No hay abonos registrados aún.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedGastoForDetail.abonos.map(ab => (
                      <div key={ab.id} className="flex items-center justify-between p-2.5 bg-[#E7F8EE] border border-[#A7E6C4] rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')}</span>
                          <span className="block text-[10px] text-slate-500 font-mono-numbers">
                            {new Date(ab.date).toLocaleDateString('es-VE')} {ab.reference ? `• Ref: ${ab.reference}` : ''}
                          </span>
                          {ab.notes && <span className="block text-[10px] text-slate-600">{ab.notes}</span>}
                        </div>
                        <div className="text-right font-mono-numbers">
                          <span className="font-black text-[#065F46]">${formatUSD(ab.amountUSD)}</span>
                          <span className="block text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex items-center justify-between">
              {selectedGastoForDetail.status !== 'pagado' ? (
                <button
                  type="button"
                  onClick={() => {
                    const g = selectedGastoForDetail;
                    setSelectedGastoForDetail(null);
                    handleOpenAbonoGasto(g);
                  }}
                  className="px-3.5 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Abonar / Pagar</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedGastoForDetail(null)}
                className="px-4 py-2 bg-[#0B1528] text-white rounded-xl text-xs font-bold hover:bg-[#152440] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Venta */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditSale} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-blue-300" />
                Editar Datos de Venta
              </span>
              <button type="button" onClick={() => setEditingSale(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Factura</label>
                  <input type="text" required value={editSaleInvoice} onChange={e => setEditSaleInvoice(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Control</label>
                  <input type="text" required value={editSaleControl} onChange={e => setEditSaleControl(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Razón Social / Cliente</label>
                <input type="text" required value={editSaleClientName} onChange={e => setEditSaleClientName(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RIF / Cédula</label>
                  <input type="text" required value={editSaleClientRIF} onChange={e => setEditSaleClientRIF(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={editSaleClientPhone} onChange={e => setEditSaleClientPhone(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección Fiscal</label>
                <input type="text" value={editSaleClientAddress} onChange={e => setEditSaleClientAddress(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Estatus</label>
                <select value={editSaleStatus} onChange={e => setEditSaleStatus(e.target.value as 'completada' | 'anulada' | 'devuelta')} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-semibold">
                  <option value="completada">Completada</option>
                  <option value="devuelta">Devuelta</option>
                  <option value="anulada">Anulada</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSale(null)} className="px-4 py-2 bg-white border border-[#DCE4F0] text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]">
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Cuenta por Pagar */}
      {editingCuenta && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditCuenta} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-rose-300" />
                Editar Cuenta por Pagar
              </span>
              <button type="button" onClick={() => setEditingCuenta(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Proveedor</label>
                <input type="text" required value={editCuentaSupplierName} onChange={e => setEditCuentaSupplierName(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RIF / Cédula</label>
                  <input type="text" value={editCuentaSupplierRIF} onChange={e => setEditCuentaSupplierRIF(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={editCuentaSupplierPhone} onChange={e => setEditCuentaSupplierPhone(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Factura</label>
                  <input type="text" required value={editCuentaInvoice} onChange={e => setEditCuentaInvoice(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vencimiento</label>
                  <input type="date" value={editCuentaDueDate} onChange={e => setEditCuentaDueDate(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total ($)</label>
                  <input type="number" step="0.01" min="0" required value={editCuentaTotalUSD} onChange={e => setEditCuentaTotalUSD(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers font-bold" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concepto / Descripción</label>
                <input type="text" value={editCuentaDescription} onChange={e => setEditCuentaDescription(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas</label>
                <input type="text" value={editCuentaNotes} onChange={e => setEditCuentaNotes(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCuenta(null)} className="px-4 py-2 bg-white border border-[#DCE4F0] text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]">
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Registrar Abono a Cuenta por Pagar */}
      {cuentaForAbono && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveAbonoCuenta} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-300" />
                Registrar Abono a Proveedor
              </span>
              <button type="button" onClick={() => setCuentaForAbono(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#DCE4F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-900 block">{cuentaForAbono.supplierName}</span>
                  <span className="text-[11px] text-slate-500 font-mono-numbers">Fact: {cuentaForAbono.invoiceNumber}</span>
                </div>
                <div className="text-right font-mono-numbers">
                  <span className="text-[10px] text-slate-400 block">Saldo Pendiente</span>
                  <span className="text-sm font-black text-[#BE123C]">${formatUSD(cuentaForAbono.remainingUSD)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">Monto a Abonar ($ USD)</label>
                  <button type="button" onClick={() => setCuentaAbonoAmount(cuentaForAbono.remainingUSD.toFixed(2))} className="text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer">
                    Pagar Saldo Total
                  </button>
                </div>
                <input type="number" step="0.01" min="0.01" max={cuentaForAbono.remainingUSD} required value={cuentaAbonoAmount} onChange={e => setCuentaAbonoAmount(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers font-bold text-sm" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Método de Pago</label>
                <select value={cuentaAbonoMethod} onChange={e => setCuentaAbonoMethod(e.target.value as PaymentMethod)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-semibold">
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="efectivo_usd">Efectivo USD ($)</option>
                  <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                  <option value="debito">Tarjeta / Débito</option>
                </select>
              </div>

              <TreasuryAccountSelector
                paymentMethod={cuentaAbonoMethod}
                treasuryAccounts={treasuryAccounts}
                selectedBankAccountId={cuentaAbonoBankAccountId}
                onSelectBankAccount={(id, label) => {
                  setCuentaAbonoBankAccountId(id);
                  if (label) setCuentaAbonoBankAccountLabel(label);
                }}
                amountUSD={round2(parseFloat(cuentaAbonoAmount) || 0)}
                amountBs={round2((parseFloat(cuentaAbonoAmount) || 0) * bcvRate)}
                mode="outflow"
                showBankFee={true}
                bankFeeInput={cuentaAbonoBankFeeInput}
                onChangeBankFeeInput={setCuentaAbonoBankFeeInput}
                compact
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nº Referencia</label>
                <input type="text" value={cuentaAbonoRef} onChange={e => setCuentaAbonoRef(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Observación</label>
                <input type="text" value={cuentaAbonoNotes} onChange={e => setCuentaAbonoNotes(e.target.value)} placeholder="Ej: Abono parcial factura..." className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
              {abonoCuentaError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{abonoCuentaError}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex justify-end gap-2">
              <button type="button" disabled={isSubmittingAbonoCuenta} onClick={() => setCuentaForAbono(null)} className="px-4 py-2 bg-white border border-[#DCE4F0] text-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSubmittingAbonoCuenta} className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]">
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmittingAbonoCuenta ? 'Confirmando...' : 'Confirmar Abono'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Gasto Operativo */}
      {editingGastoOp && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditGastoOp} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-blue-300" />
                Editar Gasto del Mes / Insumo
              </span>
              <button type="button" onClick={() => setEditingGastoOp(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concepto</label>
                <input type="text" required value={editGastoConcept} onChange={e => setEditGastoConcept(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <select value={editGastoCategory} onChange={e => setEditGastoCategory(e.target.value as GastoOperativoCategory)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-semibold">
                    <option value={OWNER_SALARY_CATEGORY}>Sueldo Propietario / Nómina</option>
                    <option value={OWNER_WITHDRAWAL_CATEGORY}>Retiro Personal / Adelanto Dueño</option>
                    <option value="Insumos / Papelería">Insumos / Papelería</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Nómina">Nómina</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Eventual">Eventual</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monto Total ($)</label>
                  <input type="number" step="0.01" min="0" required value={editGastoAmountUSD} onChange={e => setEditGastoAmountUSD(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proveedor / Persona</label>
                  <input type="text" value={editGastoSupplierName} onChange={e => setEditGastoSupplierName(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RIF o Cédula</label>
                  <input type="text" value={editGastoSupplierRIF} onChange={e => setEditGastoSupplierRIF(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={editGastoSupplierPhone} onChange={e => setEditGastoSupplierPhone(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Factura</label>
                  <input type="text" value={editGastoInvoiceNumber} onChange={e => setEditGastoInvoiceNumber(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vencimiento</label>
                  <input type="date" value={editGastoDueDate} onChange={e => setEditGastoDueDate(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas</label>
                <input type="text" value={editGastoNotes} onChange={e => setEditGastoNotes(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex justify-end gap-2">
              <button type="button" onClick={() => setEditingGastoOp(null)} className="px-4 py-2 bg-white border border-[#DCE4F0] text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]">
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Registrar Abono / Pago Parcial de Gasto del Mes */}
      {gastoForAbono && (() => {
        const remaining = gastoForAbono.remainingUSD ?? Math.max(0, gastoForAbono.amountUSD - (gastoForAbono.paidAmountUSD || 0));
        const parsedPay = Math.min(remaining, Math.max(0, parseFloat(gastoAbonoAmount) || 0));
        const newRemaining = Math.max(0, remaining - parsedPay);
        return (
          <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handleSaveAbonoGasto} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-300" />
                  Registrar Abono / Pago de Gasto
                </span>
                <button type="button" onClick={() => setGastoForAbono(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#DCE4F0] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 block">{gastoForAbono.concept}</span>
                    <span className="text-[11px] text-slate-500">
                      {gastoForAbono.supplierName || gastoForAbono.category}
                    </span>
                  </div>
                  <div className="text-right font-mono-numbers">
                    <span className="text-[10px] text-slate-400 block">Saldo Pendiente</span>
                    <span className="text-sm font-black text-[#BE123C]">${formatUSD(remaining)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">Monto a Cancelar ($ USD)</label>
                    <button type="button" onClick={() => setGastoAbonoAmount(remaining.toFixed(2))} className="text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer">
                      Pagar Total
                    </button>
                  </div>
                  <input type="number" step="0.01" min="0.01" max={remaining} required value={gastoAbonoAmount} onChange={e => setGastoAbonoAmount(e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers font-bold text-sm" />
                  <div className="flex justify-between text-[11px] mt-1 font-mono-numbers text-slate-500">
                    <span>Equiv: Bs. {formatBs(parsedPay * bcvRate)}</span>
                    <span className={newRemaining <= 0.01 ? 'text-[#065F46] font-bold' : 'text-[#9A4B12] font-bold'}>
                      {newRemaining <= 0.01 ? 'Salda deuda por completo' : `Restante: $${formatUSD(newRemaining)}`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Método de Pago</label>
                  <select value={gastoAbonoMethod} onChange={e => setGastoAbonoMethod(e.target.value as PaymentMethod)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-semibold">
                    <option value="efectivo_usd">Efectivo USD ($)</option>
                    <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="debito">Tarjeta / Débito</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                  </select>
                </div>

                <TreasuryAccountSelector
                  paymentMethod={gastoAbonoMethod}
                  treasuryAccounts={treasuryAccounts}
                  selectedBankAccountId={gastoAbonoBankAccountId}
                  onSelectBankAccount={(id, label) => {
                    setGastoAbonoBankAccountId(id);
                    if (label) setGastoAbonoBankAccountLabel(label);
                  }}
                  amountUSD={parsedPay}
                  amountBs={round2(parsedPay * bcvRate)}
                  mode="outflow"
                  showBankFee={true}
                  bankFeeInput={gastoAbonoBankFeeInput}
                  onChangeBankFeeInput={setGastoAbonoBankFeeInput}
                  compact
                />

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Referencia</label>
                  <input type="text" value={gastoAbonoRef} onChange={e => setGastoAbonoRef(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl font-mono-numbers" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Observación</label>
                  <input type="text" value={gastoAbonoNotes} onChange={e => setGastoAbonoNotes(e.target.value)} placeholder="Ej: Abono parcial de insumos..." className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl" />
                </div>
                {abonoGastoError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{abonoGastoError}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex justify-end gap-2">
                <button type="button" disabled={isSubmittingAbonoGasto} onClick={() => setGastoForAbono(null)} className="px-4 py-2 bg-white border border-[#DCE4F0] text-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSubmittingAbonoGasto} className="px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)]">
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingAbonoGasto ? 'Confirmando...' : 'Confirmar Abono'}</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Modal: Confirmar Eliminación Unificado */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Confirmar Eliminación
              </span>
              <button type="button" onClick={() => setDeleteTarget(null)} className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed">
                ¿Estás seguro de eliminar{' '}
                <strong className="text-slate-900">
                  {deleteTarget.type === 'sale'
                    ? `la venta ${deleteTarget.item.invoiceNumber} (${deleteTarget.item.clientName})`
                    : deleteTarget.type === 'expense'
                    ? `la factura de compra ${deleteTarget.item.invoiceNumber} (${deleteTarget.item.supplierName})`
                    : deleteTarget.type === 'credit_note'
                    ? `la nota de crédito ${deleteTarget.item.creditNoteNumber}`
                    : deleteTarget.type === 'discharge'
                    ? `la salida de inventario ${deleteTarget.item.dischargeNumber}`
                    : deleteTarget.type === 'cuenta'
                    ? `la cuenta por pagar ${deleteTarget.item.invoiceNumber} (${deleteTarget.item.supplierName})`
                    : `el gasto "${deleteTarget.item.concept}"`}
                </strong>?
                Esta acción se sincronizará en tiempo real con todos tus dispositivos.
              </p>

              {deleteTarget.type === 'sale' && deleteTarget.item.status === 'completada' && (
                <label className="flex items-center gap-2 p-2.5 bg-[#FFF3E8] border border-[#F5D3B3] rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreStockOnSaleDelete}
                    onChange={e => setRestoreStockOnSaleDelete(e.target.checked)}
                    className="rounded border-amber-400 text-amber-600"
                  />
                  <span className="text-[#7C3A0B] font-semibold">Reincorporar los productos al inventario</span>
                </label>
              )}
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex justify-end gap-2">
              <button type="button" disabled={isDeletingRecord} onClick={() => setDeleteTarget(null)} className="px-4 py-2 bg-white border border-[#DCE4F0] text-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" disabled={isDeletingRecord} onClick={() => { void handleConfirmDelete(); }} className="px-4 py-2 bg-[#BE123C] hover:bg-rose-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingRecord ? 'Eliminando...' : 'Sí, Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
