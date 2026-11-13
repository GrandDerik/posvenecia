import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Search, 
  Plus, 
  Filter, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Calculator,
  ArrowUpRight,
  Printer,
  Calendar,
  Building,
  Cloud,
  Archive,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Clock,
  ArrowDownRight,
  Layers,
  Landmark,
  Check,
  X,
  Edit2,
  Trash2,
  Coins,
  Building2,
  Phone,
  Hash,
  Receipt
} from 'lucide-react';
import { 
  formatBs, 
  formatUSD, 
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
import { RegistrarGastoModal } from './RegistrarGastoModal';
import { BackupDriveModal } from './Modals/BackupDriveModal';
import { ComprobanteTicketModal } from './Modals/ComprobanteTicketModal';
import { ComprobanteNotaCreditoModal } from './Modals/ComprobanteNotaCreditoModal';

export const ContabilidadView: React.FC = () => {
  const { 
    sales, 
    updateSale,
    deleteSale,
    expenses, 
    deleteExpense,
    bcvRate, 
    businessInfo,
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
    googleUser
  } = useApp();

  const [subTab, setSubTab] = useState<'ventas' | 'compras' | 'notas_credito' | 'salidas_inventario' | 'cierres_caja' | 'cuentas_por_pagar' | 'igtf' | 'estado_cuenta'>('ventas');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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
    setCuentaAbonoRef('');
    setCuentaAbonoNotes('');
  };

  const handleSaveAbonoCuenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaForAbono) return;
    const amt = parseFloat(cuentaAbonoAmount) || 0;
    if (amt <= 0) return;
    addAbonoToCuentaPorPagar(
      cuentaForAbono.id,
      Math.min(amt, cuentaForAbono.remainingUSD),
      cuentaAbonoMethod,
      cuentaAbonoRef.trim() || undefined,
      cuentaAbonoNotes.trim() || undefined
    );
    setCuentaForAbono(null);
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
  };

  const handleSaveAbonoGasto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoForAbono) return;
    const remaining = gastoForAbono.remainingUSD ?? Math.max(0, gastoForAbono.amountUSD - (gastoForAbono.paidAmountUSD || 0));
    const amt = parseFloat(gastoAbonoAmount) || 0;
    if (amt <= 0) return;
    markGastoOperativoPagado(
      gastoForAbono.id,
      gastoAbonoMethod,
      gastoAbonoRef.trim() || undefined,
      Math.min(amt, remaining),
      gastoAbonoNotes.trim() || undefined
    );
    setGastoForAbono(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    switch (deleteTarget.type) {
      case 'sale':
        deleteSale(deleteTarget.item.id, restoreStockOnSaleDelete);
        if (selectedSaleForTicket?.id === deleteTarget.item.id) setSelectedSaleForTicket(null);
        break;
      case 'expense':
        deleteExpense(deleteTarget.item.id);
        if (selectedExpenseForTicket?.id === deleteTarget.item.id) setSelectedExpenseForTicket(null);
        break;
      case 'credit_note':
        deleteCreditNote(deleteTarget.item.id);
        if (selectedCreditNoteForTicket?.id === deleteTarget.item.id) setSelectedCreditNoteForTicket(null);
        break;
      case 'discharge':
        deleteInventoryDischarge(deleteTarget.item.id);
        if (selectedDischargeForDetail?.id === deleteTarget.item.id) setSelectedDischargeForDetail(null);
        break;
      case 'cuenta':
        deleteCuentaPorPagar(deleteTarget.item.id);
        if (selectedCuentaForDetail?.id === deleteTarget.item.id) setSelectedCuentaForDetail(null);
        break;
      case 'gasto_op':
        deleteGastoOperativo(deleteTarget.item.id);
        if (selectedGastoForDetail?.id === deleteTarget.item.id) setSelectedGastoForDetail(null);
        break;
    }
    setDeleteTarget(null);
    setRestoreStockOnSaleDelete(false);
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
  const filteredSales = sales.filter(s => 
    s.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.controlNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.clientRIF.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter expenses
  const filteredExpenses = expenses.filter(e => 
    e.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.supplierRIF.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sales totals (SENIAT)
  const totalSalesBs = filteredSales.reduce((a, s) => a + s.totalBs, 0);
  const totalSalesUSD = filteredSales.reduce((a, s) => a + s.totalUSD, 0);
  const totalExemptBs = filteredSales.reduce((a, s) => a + s.exemptBs, 0);
  const totalTaxableBs = filteredSales.reduce((a, s) => a + s.taxableBs, 0);
  const totalIvaBs = filteredSales.reduce((a, s) => a + s.ivaBs, 0);
  const totalIgtfBs = filteredSales.reduce((a, s) => a + s.igtfBs, 0);
  const totalIgtfUSD = filteredSales.reduce((a, s) => a + s.igtfUSD, 0);

  // Purchases totals (SENIAT)
  const totalExpBs = filteredExpenses.reduce((a, e) => a + e.amountBs, 0);
  const totalExpUSD = filteredExpenses.reduce((a, e) => a + e.amountUSD, 0);
  const totalBaseExpBs = filteredExpenses.reduce((a, e) => a + e.baseImponibleBs, 0);
  const totalIvaExpBs = filteredExpenses.reduce((a, e) => a + e.ivaBs, 0);
  const totalRetIvaBs = filteredExpenses.reduce((a, e) => a + e.retencionIVABs, 0);
  const totalRetIslrBs = filteredExpenses.reduce((a, e) => a + e.retencionISLRBs, 0);

  // Net Balance
  const netUSD = totalSalesUSD - totalExpUSD;
  const netBs = totalSalesBs - totalExpBs;

  // Breakdown by payment methods for sales
  const methodsVentas: Record<string, { usd: number; bs: number }> = {};
  sales.forEach(s => {
    if (!methodsVentas[s.paymentMethod]) {
      methodsVentas[s.paymentMethod] = { usd: 0, bs: 0 };
    }
    methodsVentas[s.paymentMethod].usd += s.totalUSD;
    methodsVentas[s.paymentMethod].bs += s.totalBs;
  });

  const estadoCuentaSummary = {
    ventasTotalBs: totalSalesBs,
    ventasTotalUSD: totalSalesUSD,
    gastosTotalBs: totalExpBs,
    gastosTotalUSD: totalExpUSD,
    netoBs: netBs,
    netoUSD: netUSD,
    igtfBs: totalIgtfBs,
    igtfUSD: totalIgtfUSD,
    metodosVentas: methodsVentas,
    bcvRate
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner with SENIAT compliance indicator (Clean Two-Row Responsive Layout) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Title + Sync & Drive Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-100 text-blue-800 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Módulo de Contabilidad y Reportes SENIAT
              </h1>
              <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-red-200 shrink-0">
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
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Sincronizar inmediatamente con otros dispositivos"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingNow || isDriveSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar Dispositivos</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              title="Conectar Google Drive y descargar reportes contables completos"
            >
              <Cloud className="w-4 h-4 text-blue-200" />
              <span>Google Drive & Descargas</span>
            </button>
          </div>
        </div>

        {/* Row 2: Wrapped Sub-tab Navigation (Zero Horizontal Overflow) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold w-full border border-slate-200/70">
          <button
            type="button"
            onClick={() => setSubTab('ventas')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'ventas' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Libro de Ventas
          </button>
          <button
            type="button"
            onClick={() => setSubTab('compras')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'compras' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Libro de Compras
          </button>
          <button
            type="button"
            onClick={() => setSubTab('notas_credito')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              subTab === 'notas_credito' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Notas de Crédito</span>
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
              {creditNotes.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('salidas_inventario')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              subTab === 'salidas_inventario' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
            <span>Salidas / Mermas</span>
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
              {inventoryDischarges.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cierres_caja')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              subTab === 'cierres_caja' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cierres de Caja</span>
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
              {cashShiftHistory.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cuentas_por_pagar')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              subTab === 'cuentas_por_pagar' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-rose-600" />
            <span>Cuentas por Pagar</span>
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
              {pendingPayablesCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('igtf')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'igtf' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Control del IGTF (3%)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('estado_cuenta')}
            className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'estado_cuenta' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Estado de Cuenta
          </button>
        </div>

        {/* Sync Feedback Toast Banner */}
        {syncFeedback && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* SUBTAB 1: LIBRO DE VENTAS (SENIAT) */}
      {subTab === 'ventas' && (
        <div className="space-y-4">
          {/* Action Bar with visible Export buttons */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por factura, control, RIF o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportLibroVentasExcel(filteredSales, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportLibroVentasPDF(filteredSales, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Exportar a PDF (Formato Oficial)</span>
              </button>
            </div>
          </div>

          {/* Totals Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Base Imponible (16%)</span>
              <div className="text-lg font-black text-slate-900 font-mono-numbers">
                Bs. {formatBs(totalTaxableBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">≈ ${formatUSD(totalTaxableBs / bcvRate)}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">IVA Débito Fiscal (16%)</span>
              <div className="text-lg font-black text-teal-700 font-mono-numbers">
                Bs. {formatBs(totalIvaBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">≈ ${formatUSD(totalIvaBs / bcvRate)}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Ventas Exentas (E)</span>
              <div className="text-lg font-black text-emerald-800 font-mono-numbers">
                Bs. {formatBs(totalExemptBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Canasta básica exonerada</span>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-teal-400 uppercase">Total Facturado (Bs)</span>
              <div className="text-lg font-black text-white font-mono-numbers">
                Bs. {formatBs(totalSalesBs)}
              </div>
              <span className="text-[11px] text-teal-300 font-mono font-bold">${formatUSD(totalSalesUSD)} USD</span>
            </div>
          </div>

          {/* SENIAT Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Libro de Ventas Fiscal - Formato SENIAT</span>
              <span className="text-slate-500">{filteredSales.length} registros en el período</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale, index) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedSaleForTicket(sale)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Ver recibo / ticket de venta"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSale(sale)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Editar datos de la venta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRestoreStockOnSaleDelete(false); setDeleteTarget({ type: 'sale', item: sale }); }}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Eliminar venta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">{index + 1}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {new Date(sale.date).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900">{sale.invoiceNumber}</td>
                      <td className="py-2 px-3 text-slate-600">{sale.controlNumber}</td>
                      <td className="py-2 px-3 text-slate-800">{sale.clientRIF}</td>
                      <td className="py-2 px-3 font-sans text-slate-800 max-w-xs truncate">{sale.clientName}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatBs(sale.totalBs)}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{formatBs(sale.exemptBs)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">{formatBs(sale.taxableBs)}</td>
                      <td className="py-2 px-3 text-center text-slate-500">16%</td>
                      <td className="py-2 px-3 text-right font-bold text-teal-700">{formatBs(sale.ivaBs)}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">{formatBs(sale.igtfBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">${formatUSD(sale.totalUSD)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-bold text-xs border-t border-slate-700">
                  <tr>
                    <td colSpan={7} className="py-3 px-3 text-right uppercase">Totales del Período:</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalSalesBs)}</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalExemptBs)}</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalTaxableBs)}</td>
                    <td className="py-3 px-3 text-center">16%</td>
                    <td className="py-3 px-3 text-right text-teal-300">Bs. {formatBs(totalIvaBs)}</td>
                    <td className="py-3 px-3 text-right text-emerald-300">Bs. {formatBs(totalIgtfBs)}</td>
                    <td className="py-3 px-3 text-right text-white">${formatUSD(totalSalesUSD)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: LIBRO DE COMPRAS Y GASTOS (SENIAT) */}
      {subTab === 'compras' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar factura de proveedor o RIF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setEditingExpense(null); setIsGastoModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Factura</span>
              </button>

              <button
                onClick={() => exportLibroComprasExcel(filteredExpenses, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportLibroComprasPDF(filteredExpenses, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Exportar PDF (Oficial)</span>
              </button>
            </div>
          </div>

          {/* Totals Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Base Imponible Compras</span>
              <div className="text-lg font-black text-slate-900 font-mono-numbers">
                Bs. {formatBs(totalBaseExpBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Materia gravable</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">IVA Crédito Fiscal</span>
              <div className="text-lg font-black text-blue-700 font-mono-numbers">
                Bs. {formatBs(totalIvaExpBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Deducible en declaración</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Retención IVA (75%)</span>
              <div className="text-lg font-black text-amber-700 font-mono-numbers">
                Bs. {formatBs(totalRetIvaBs)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Comprobantes emitidos</span>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-teal-400 uppercase">Total Egresado / Compras</span>
              <div className="text-lg font-black text-white font-mono-numbers">
                Bs. {formatBs(totalExpBs)}
              </div>
              <span className="text-[11px] text-teal-300 font-mono font-bold">${formatUSD(totalExpUSD)} USD</span>
            </div>
          </div>

          {/* Compras Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Libro de Compras y Gastos - Crédito Fiscal SENIAT</span>
              <span className="text-slate-500">{filteredExpenses.length} facturas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((exp, index) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedExpenseForTicket(exp)}
                            className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Ver comprobante de compra / factura"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingExpense(exp); setIsGastoModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Editar factura de compra"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'expense', item: exp })}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Eliminar factura de compra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">{index + 1}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {new Date(exp.date).toLocaleDateString('es-VE')}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900">{exp.invoiceNumber}</td>
                      <td className="py-2 px-3 text-slate-600">{exp.controlNumber}</td>
                      <td className="py-2 px-3 text-slate-800">{exp.supplierRIF}</td>
                      <td className="py-2 px-3 font-sans text-slate-800 max-w-xs truncate">{exp.supplierName}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">{exp.category}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-700">{formatBs(exp.baseImponibleBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-blue-700">{formatBs(exp.ivaBs)}</td>
                      <td className="py-2 px-3 text-right text-amber-700">{formatBs(exp.retencionIVABs)}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatBs(exp.retencionISLRBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatBs(exp.amountBs)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">${formatUSD(exp.amountUSD)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-bold text-xs border-t border-slate-700">
                  <tr>
                    <td colSpan={8} className="py-3 px-3 text-right uppercase">Totales Compras:</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalBaseExpBs)}</td>
                    <td className="py-3 px-3 text-right text-blue-300">Bs. {formatBs(totalIvaExpBs)}</td>
                    <td className="py-3 px-3 text-right text-amber-300">Bs. {formatBs(totalRetIvaBs)}</td>
                    <td className="py-3 px-3 text-right">Bs. {formatBs(totalRetIslrBs)}</td>
                    <td className="py-3 px-3 text-right text-white">Bs. {formatBs(totalExpBs)}</td>
                    <td className="py-3 px-3 text-right text-teal-300">${formatUSD(totalExpUSD)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: NOTAS DE CRÉDITO Y DEVOLUCIONES (SENIAT) */}
      {subTab === 'notas_credito' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por Nº de Nota de Crédito, Factura original o Cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreditNoteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
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
              nc.originalInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              nc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              nc.clientRIF.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const totalNCRefundUSD = filteredNCs.reduce((acc, n) => acc + n.totalUSD, 0);
            const totalNCRefundBs = filteredNCs.reduce((acc, n) => acc + n.totalBs, 0);
            const totalNCIvaBs = filteredNCs.reduce((acc, n) => acc + n.ivaBs, 0);

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Comprobantes Emitidos</span>
                    <div className="text-lg font-black text-slate-900 font-mono-numbers">
                      {filteredNCs.length}
                    </div>
                    <span className="text-[11px] text-slate-500">Notas de crédito registradas</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Total Reintegrado (Disminuye Ventas)</span>
                    <div className="text-lg font-black text-rose-700 font-mono-numbers">
                      Bs. {formatBs(totalNCRefundBs)}
                    </div>
                    <span className="text-[11px] font-bold text-rose-600 font-mono">≈ ${formatUSD(totalNCRefundUSD)} USD</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">IVA Crédito Fiscal (Reversado)</span>
                    <div className="text-lg font-black text-teal-700 font-mono-numbers">
                      Bs. {formatBs(totalNCIvaBs)}
                    </div>
                    <span className="text-[11px] text-slate-500">Ajuste sobre débito fiscal</span>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Libro de Notas de Crédito / Devoluciones (SENIAT)</span>
                    <span className="text-slate-500">{filteredNCs.length} registros</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
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
                      <tbody className="divide-y divide-slate-100">
                        {filteredNCs.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="py-8 text-center text-slate-400 font-sans">
                              No hay notas de crédito registradas.
                            </td>
                          </tr>
                        ) : (
                          filteredNCs.map((nc, idx) => (
                            <tr key={nc.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCreditNoteForTicket(nc)}
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                    title="Ver comprobante de Nota de Crédito"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ type: 'credit_note', item: nc })}
                                    className="p-1.5 rounded-lg bg-slate-100 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                    title="Eliminar Nota de Crédito"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                {new Date(nc.date).toLocaleDateString('es-VE')}
                              </td>
                              <td className="py-2 px-3 font-bold text-rose-700">{nc.creditNoteNumber}</td>
                              <td className="py-2 px-3 text-slate-600">{nc.controlNumber}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">{nc.originalInvoiceNumber}</td>
                              <td className="py-2 px-3 text-slate-700">{nc.clientRIF}</td>
                              <td className="py-2 px-3 font-sans text-slate-800 max-w-xs truncate">{nc.clientName}</td>
                              <td className="py-2 px-3 font-sans text-slate-600 text-[11px] max-w-xs truncate">{nc.reason}</td>
                              <td className="py-2 px-3 text-right text-slate-700">{formatBs(nc.subtotalBs)}</td>
                              <td className="py-2 px-3 text-right text-teal-700">{formatBs(nc.ivaBs)}</td>
                              <td className="py-2 px-3 text-right font-bold text-rose-700">-{formatBs(nc.totalBs)}</td>
                              <td className="py-2 px-3 text-right font-bold text-rose-700">-${formatUSD(nc.totalUSD)}</td>
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

      {/* SUBTAB: DESINCORPORACIONES DE INVENTARIO Y MERMAS */}
      {subTab === 'salidas_inventario' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por código de salida, producto o responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDischargeModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
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
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Unidades Salientes</span>
                    <div className="text-lg font-black text-slate-900 font-mono-numbers">
                      {totalUnits}
                    </div>
                    <span className="text-[11px] text-slate-500">En {filteredDischarges.length} registros</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/40">
                    <span className="text-[10px] font-bold text-amber-700 uppercase">Pérdida Total (Gasto Op.)</span>
                    <div className="text-lg font-black text-amber-900 font-mono-numbers">
                      ${formatUSD(totalLossUSD)}
                    </div>
                    <span className="text-[11px] font-bold text-amber-700 font-mono">≈ Bs. {formatBs(totalLossBs)}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Daño / Vencimiento</span>
                    <div className="text-lg font-black text-rose-700 font-mono-numbers">
                      ${formatUSD(danoUSD)}
                    </div>
                    <span className="text-[11px] text-slate-500">Mercancía no comercializable</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Uso Interno & Mermas</span>
                    <div className="text-lg font-black text-blue-700 font-mono-numbers">
                      ${formatUSD(usoInternoUSD + mermaUSD)}
                    </div>
                    <span className="text-[11px] text-slate-500">Insumos y mermas operativas</span>
                  </div>
                </div>

                {/* Discharges Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Libro de Desincorporaciones de Inventario</span>
                    <span className="text-slate-500">{filteredDischarges.length} comprobantes</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
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
                      <tbody className="divide-y divide-slate-100">
                        {filteredDischarges.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-8 text-center text-slate-400 font-sans">
                              No hay registros de salidas o desincorporación de inventario.
                            </td>
                          </tr>
                        ) : (
                          filteredDischarges.map((disc, idx) => (
                            <tr key={disc.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDischargeForDetail(disc)}
                                    className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                    title="Ver comprobante de desincorporación"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ type: 'discharge', item: disc })}
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                    title="Eliminar salida de inventario"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-amber-700">{disc.dischargeNumber}</td>
                              <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                {new Date(disc.date).toLocaleDateString('es-VE')}
                              </td>
                              <td className="py-2 px-3 font-sans font-bold text-slate-800">{disc.productName}</td>
                              <td className="py-2 px-3 text-center font-bold text-slate-900 bg-slate-50">{disc.quantity}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  disc.reason === 'Daño / Vencimiento' 
                                    ? 'bg-rose-100 text-rose-800' 
                                    : disc.reason === 'Uso Interno'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {disc.reason}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600">${formatUSD(disc.unitCostUSD)}</td>
                              <td className="py-2 px-3 text-right font-bold text-rose-700">${formatUSD(disc.totalLossUSD)}</td>
                              <td className="py-2 px-3 text-right text-slate-700">{formatBs(disc.totalLossBs)}</td>
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
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Archive className="w-5 h-5 text-emerald-600" />
                <span>Historial de Cierres Diarios y Arqueos de Caja</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Libro de cuadres, balances de apertura en efectivo/bancos, arqueos físicos y diferencias por turno
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportHistorialCierresExcel(cashShiftHistory, businessInfo)}
                disabled={cashShiftHistory.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Descargar libro consolidado de todos los cierres de caja en Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Historial Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => exportHistorialCierresPDF(cashShiftHistory, businessInfo)}
                disabled={cashShiftHistory.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Descargar reporte formal en PDF de los cierres de caja"
              >
                <FileText className="w-4 h-4" />
                <span>Historial PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Cierres Realizados</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                {cashShiftHistory.length}
              </div>
              <span className="text-[11px] text-slate-500">
                {cashShift?.isOpen ? '1 turno abierto actualmente' : 'Caja cerrada'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Ventas Acumuladas</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                ${formatUSD(cashShiftHistory.reduce((acc, s) => acc + (s.totalSalesUSD || 0), 0))}
              </div>
              <span className="text-[11px] text-blue-700 font-mono font-bold">
                Bs. {formatBs(cashShiftHistory.reduce((acc, s) => acc + (s.totalSalesBs || 0), 0))}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Efectivo Contado</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                ${formatUSD(cashShiftHistory.reduce((acc, s) => acc + (s.countedCashUSD || 0), 0))}
              </div>
              <span className="text-[11px] text-slate-500">
                Efectivo físico auditado en gavetas
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                <span>Sincronización Nube</span>
                <Cloud className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-sm font-black text-slate-900 mt-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Google Drive Activo</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {googleUser?.email ? `Respaldado en ${googleUser.email}` : 'Sesión local'}
              </span>
            </div>
          </div>

          {/* Active Shift Alert if open */}
          {cashShift?.isOpen && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-emerald-950 text-sm">Turno en Curso (Caja Abierta)</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 text-[10px] font-black uppercase">
                      En Operación
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 mt-0.5">
                    Apertura: {cashShift.openedDateFormatted || cashShift.openedAt} • Responsable: {cashShift.openedBy || 'Cajero'} • Fondo inicial: ${formatUSD(cashShift.initialCashUSD)} (Bs. {formatBs(cashShift.initialCashBs)})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table of Closed Shifts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                  Al abrir la caja y realizar el Cierre de Caja al final del día, cada reporte se guardará automáticamente aquí y en tu Google Drive.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {cashShiftHistory.map((shift, idx) => {
                      const diffUSD = shift.differenceUSD || 0;
                      const isExact = Math.abs(diffUSD) < 0.01;
                      const isSurplus = diffUSD > 0.01;

                      return (
                        <tr key={shift.id || idx} className="hover:bg-slate-50/80 transition-colors">
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
                            ${formatUSD(shift.initialCashUSD)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-700">
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
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                Cuadre Exacto
                              </span>
                            ) : isSurplus ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                                +${formatUSD(diffUSD)} Sobrante
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                -${formatUSD(Math.abs(diffUSD))} Faltante
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => exportCierreCajaPDF(shift, businessInfo, bcvRate)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                                title="Descargar Acta de Cierre en PDF"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => exportCierreCajaExcel(shift, businessInfo)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                                title="Descargar Acta de Cierre en Excel"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedShiftForDetail(shift)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
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
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-rose-600" />
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
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="Descargar libro de cuentas por pagar en Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => exportCuentasPorPagarPDF(cuentasPorPagar, businessInfo, bcvRate)}
                disabled={cuentasPorPagar.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Deuda Global Proveedores</span>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-1">${formatUSD(totalDeudaUSD)}</div>
                  <span className="text-[11px] text-slate-500 font-mono">Bs. {formatBs(totalDeudaUSD * bcvRate)}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-emerald-700 uppercase block">Total Amortizado Proveedores</span>
                  <div className="text-2xl font-black text-emerald-700 font-mono mt-1">${formatUSD(totalAbonadoUSD)}</div>
                  <span className="text-[11px] text-emerald-600 font-mono">Bs. {formatBs(totalAbonadoUSD * bcvRate)}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
                  <span className="text-xs font-bold text-rose-700 uppercase block">Saldo Pendiente Total</span>
                  <div className="text-2xl font-black text-rose-700 font-mono mt-1">${formatUSD(totalPendienteProveedoresUSD + totalPendienteGastosUSD)}</div>
                  <span className="text-[11px] text-rose-600 font-mono font-bold">
                    Prov: ${formatUSD(totalPendienteProveedoresUSD)} • Gastos: ${formatUSD(totalPendienteGastosUSD)}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-indigo-700 uppercase block">Gastos Operativos (Mes)</span>
                  <div className="text-2xl font-black text-indigo-700 font-mono mt-1">${formatUSD(totalGastosOpUSD)}</div>
                  <span className="text-[11px] text-slate-500">Nómina, alquiler, insumos y servicios</span>
                </div>
              </div>
            );
          })()}

          {/* Table 1: Facturas a Proveedores */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" />
                <span>Facturas y Compromisos de Pago a Proveedores ({cuentasPorPagar.length})</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Abonos parciales sincronizados en tiempo real con Firestore
              </span>
            </div>

            {cuentasPorPagar.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-400" />
                <p className="text-sm font-bold text-slate-700">Sin facturas pendientes a proveedores</p>
                <p className="text-xs text-slate-400">
                  No tienes deudas comerciales registradas con proveedores en este momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {cuentasPorPagar.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedCuentaForDetail(c)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                              title="Ver detalle e historial de abonos"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {c.status !== 'pagada' && (
                              <button
                                type="button"
                                onClick={() => handleOpenAbonoCuenta(c)}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                title="Registrar abono o pago"
                              >
                                <Coins className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditCuenta(c)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                              title="Editar cuenta por pagar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'cuenta', item: c })}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
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
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">${formatUSD(c.paidAmountUSD)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-700">${formatUSD(c.remainingUSD)}</td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          {c.status === 'pagada' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Saldada
                            </span>
                          ) : c.status === 'parcial' ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              Abono Parcial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-indigo-600" />
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
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {gastosOperativos.map((g) => {
                      const paidUSD = g.paidAmountUSD ?? (g.status === 'pagado' ? g.amountUSD : 0);
                      const remainingUSD = g.remainingUSD ?? Math.max(0, g.amountUSD - paidUSD);
                      return (
                        <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedGastoForDetail(g)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                title="Ver detalle del gasto y abonos"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {g.status !== 'pagado' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAbonoGasto(g)}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                  title="Registrar abono parcial o pago total"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditGastoOp(g)}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                title="Editar gasto operativo"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ type: 'gasto_op', item: g })}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                title="Eliminar gasto operativo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-bold text-slate-900">{g.concept}</div>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
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
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">${formatUSD(paidUSD)}</td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-700">${formatUSD(remainingUSD)}</td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {g.status === 'pagado' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                Pagado
                              </span>
                            ) : g.status === 'parcial' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                Abono Parcial
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Control del IGTF (Impuesto a las Grandes Transacciones Financieras)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alícuota del 3% percibida sobre pagos recibidos en divisas (Efectivo USD) según providencia administrativa SENIAT
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportLibroVentasExcel(sales.filter(s => s.paymentMethod === 'efectivo_usd'), businessInfo)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Relación IGTF</span>
                </button>
              </div>
            </div>

            {/* IGTF Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-xs font-bold text-emerald-800 uppercase block">
                  Base Gravable en Efectivo USD
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
                  ${formatUSD(sales.filter(s => s.paymentMethod === 'efectivo_usd').reduce((a, s) => a + (s.subtotalUSD + s.ivaUSD), 0))}
                </div>
                <span className="text-[11px] text-emerald-700">Total cobrado en billetes divisa</span>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-teal-400 uppercase block">
                  Total IGTF 3% Percibido ($)
                </span>
                <div className="text-2xl font-black text-white font-mono-numbers mt-1">
                  ${formatUSD(totalIgtfUSD)}
                </div>
                <span className="text-[11px] text-slate-400">Fondos retenidos para enterar al SENIAT</span>
              </div>

              <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                <span className="text-xs font-bold text-teal-800 uppercase block">
                  Equivalente IGTF en Bolívares
                </span>
                <div className="text-2xl font-black text-teal-950 font-mono-numbers mt-1">
                  Bs. {formatBs(totalIgtfBs)}
                </div>
                <span className="text-[11px] text-teal-700">A tasa BCV de facturación</span>
              </div>
            </div>
          </div>

          {/* IGTF Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
              Operaciones Sujetas a Retención de IGTF (Pagos en Efectivo USD)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {sales.filter(s => s.paymentMethod === 'efectivo_usd').map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedSaleForTicket(sale)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Ver recibo / ticket de venta"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSale(sale)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Editar datos de la venta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRestoreStockOnSaleDelete(false); setDeleteTarget({ type: 'sale', item: sale }); }}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                            title="Eliminar venta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700">{new Date(sale.date).toLocaleDateString('es-VE')}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{sale.invoiceNumber}</td>
                      <td className="py-2 px-3 font-sans text-slate-800">{sale.clientName}</td>
                      <td className="py-2 px-3 text-slate-600">{sale.clientRIF}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">${formatUSD(sale.subtotalUSD + sale.ivaUSD)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">${formatUSD(sale.igtfUSD)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">Bs. {formatBs(sale.igtfBs)}</td>
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
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Estado de Cuenta y Cuadre General</h3>
              <p className="text-xs text-slate-500">Conciliación bimonetaria de Ingresos vs Egresos</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportEstadoCuentaExcel(estadoCuentaSummary, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportEstadoCuentaPDF(estadoCuentaSummary, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Exportar a PDF (Oficial)</span>
              </button>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Ingresos */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Ingresos (Ventas)</span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers">
                ${formatUSD(totalSalesUSD)}
              </div>
              <div className="text-xs font-bold text-emerald-700 font-mono-numbers">
                Bs. {formatBs(totalSalesBs)}
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                Registrados en {sales.length} transacciones fiscales
              </p>
            </div>

            {/* Egresos */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Egresos (Gastos)</span>
                <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono-numbers">
                ${formatUSD(totalExpUSD)}
              </div>
              <div className="text-xs font-bold text-rose-600 font-mono-numbers">
                Bs. {formatBs(totalExpBs)}
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                Compras a proveedores y gastos operativos
              </p>
            </div>

            {/* Saldo Neto */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white p-5 rounded-2xl shadow-md border border-slate-700 space-y-2">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                Balance Operativo Neto
              </span>
              <div className="text-3xl font-black text-white font-mono-numbers">
                ${formatUSD(netUSD)}
              </div>
              <div className="text-sm font-bold text-teal-300 font-mono-numbers">
                Bs. {formatBs(netBs)}
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-white/10">
                Utilidad bruta antes de deducciones tributarias
              </p>
            </div>

          </div>

          {/* Breakdown by Payment Method Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
              Desglose de Ingresos por Medio de Pago
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Método de Pago</th>
                    <th className="py-2.5 px-4 text-center">N° Operaciones</th>
                    <th className="py-2.5 px-4 text-right">Total USD ($)</th>
                    <th className="py-2.5 px-4 text-right">Total Bolívares (Bs)</th>
                    <th className="py-2.5 px-4 text-right">Participación (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {Object.entries(methodsVentas).map(([method, amounts]) => {
                    const count = sales.filter(s => s.paymentMethod === method).length;
                    const pct = totalSalesUSD > 0 ? (amounts.usd / totalSalesUSD) * 100 : 0;

                    return (
                      <tr key={method} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold font-sans text-slate-800 uppercase">
                          {method.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">{count}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">${formatUSD(amounts.usd)}</td>
                        <td className="py-3 px-4 text-right font-bold text-teal-700">Bs. {formatBs(amounts.bs)}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Acta y Auditoría del Cierre de Caja
                  </h3>
                  <p className="text-xs text-slate-500">
                    Turno ID: <span className="font-mono font-bold text-slate-700">{selectedShiftForDetail.id}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shift metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-xs">
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
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                  Fondo Inicial & Ventas
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Fondo Inicial Apertura ($):</span>
                  <span className="font-bold text-slate-900 font-mono">${formatUSD(selectedShiftForDetail.initialCashUSD)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Fondo Inicial Apertura (Bs):</span>
                  <span className="font-bold text-slate-900 font-mono">Bs. {formatBs(selectedShiftForDetail.initialCashBs)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Ventas Totales del Turno ($):</span>
                  <span className="font-bold text-blue-700 font-mono">${formatUSD(selectedShiftForDetail.totalSalesUSD || 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Gastos Pagados en Efectivo ($):</span>
                  <span className="font-bold text-rose-700 font-mono">${formatUSD(selectedShiftForDetail.totalExpensesUSD || 0)}</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                <span className="font-bold text-emerald-900 uppercase tracking-wider block text-[11px]">
                  Resultado del Cuadre Físico
                </span>
                <div className="flex justify-between py-1 border-b border-emerald-200/60">
                  <span className="text-emerald-800">Efectivo Teórico Esperado ($):</span>
                  <span className="font-black text-slate-900 font-mono">${formatUSD(selectedShiftForDetail.expectedCashUSD || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-200/60">
                  <span className="text-emerald-800">Efectivo Físico Contado ($):</span>
                  <span className="font-black text-slate-900 font-mono">${formatUSD(selectedShiftForDetail.countedCashUSD || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-200/60">
                  <span className="text-emerald-800">Diferencia / Descuadre ($):</span>
                  <span className={`font-black font-mono ${
                    Math.abs(selectedShiftForDetail.differenceUSD || 0) < 0.01 
                      ? 'text-emerald-700' 
                      : (selectedShiftForDetail.differenceUSD || 0) > 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}>
                    ${formatUSD(selectedShiftForDetail.differenceUSD || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-emerald-800">Estatus:</span>
                  <span className="font-extrabold text-emerald-950 uppercase text-[11px]">
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
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Banco</th>
                        <th className="py-2 px-3">Cuenta</th>
                        <th className="py-2 px-3 text-right">Saldo Inicial Bs</th>
                        <th className="py-2 px-3 text-right">Saldo Inicial $</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedShiftForDetail.initialBanks.map((b, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-sans font-bold text-slate-800">{b.bankName}</td>
                          <td className="py-2 px-3 text-slate-600">{b.accountNumber}</td>
                          <td className="py-2 px-3 text-right font-bold text-teal-700">Bs. {formatBs(b.initialBalanceBs)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800">${formatUSD(b.initialBalanceUSD || 0)}</td>
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
                    <div key={method} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-bold text-slate-600 block uppercase text-[10px]">{method.replace('_', ' ')}</span>
                      <div className="font-bold text-slate-900 font-mono mt-0.5">${formatUSD(val.usd)}</div>
                      <span className="text-[10px] text-teal-700 font-mono">Bs. {formatBs(val.bs)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedShiftForDetail.closedNotes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong>Observaciones de Caja:</strong> {selectedShiftForDetail.closedNotes}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => exportCierreCajaPDF(selectedShiftForDetail, businessInfo, bcvRate)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-300" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportCierreCajaExcel(selectedShiftForDetail, businessInfo)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar Excel</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-400" />
                Comprobante de Compra / Gasto
              </span>
              <button 
                onClick={() => setSelectedExpenseForTicket(null)} 
                className="p-1 rounded-full hover:bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="text-center border-b border-dashed border-slate-200 pb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                  {selectedExpenseForTicket.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {selectedExpenseForTicket.supplierName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  RIF: {selectedExpenseForTicket.supplierRIF}
                  {selectedExpenseForTicket.supplierPhone ? ` • Tel: ${selectedExpenseForTicket.supplierPhone}` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fecha: {new Date(selectedExpenseForTicket.date).toLocaleString('es-VE')}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-200 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nº Factura:</span>
                  <span className="font-bold text-slate-900 font-mono">{selectedExpenseForTicket.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nº Control:</span>
                  <span className="font-bold text-slate-700 font-mono">{selectedExpenseForTicket.controlNumber}</span>
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
                    <span className="font-bold text-slate-700 font-mono">{selectedExpenseForTicket.reference}</span>
                  </div>
                )}
                {selectedExpenseForTicket.description && (
                  <div className="pt-2 border-t border-slate-200/80 text-slate-600">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Concepto:</span>
                    <span>{selectedExpenseForTicket.description}</span>
                  </div>
                )}

                {selectedExpenseForTicket.items && selectedExpenseForTicket.items.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      <span>Artículos Comprados ({selectedExpenseForTicket.items.length}):</span>
                      {selectedExpenseForTicket.costStrategy && (
                        <span className="text-teal-700 normal-case font-semibold">
                          {selectedExpenseForTicket.costStrategy === 'fifo' ? 'Estrategia FIFO' : 'Precio Actualizado'}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 bg-white rounded-lg p-2 border border-slate-200 text-[11px]">
                      {selectedExpenseForTicket.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                          <div>
                            <span className="font-semibold text-slate-800">{it.productName}</span>
                            <span className="text-slate-500 text-[10px] block font-mono">
                              +{it.quantity} unids × ${it.unitCostUSD.toFixed(2)} (≈ Bs. {formatBs(it.unitCostUSD * (selectedExpenseForTicket.bcvRate || bcvRate))})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900">${it.totalCostUSD.toFixed(2)}</span>
                            <span className={`block text-[9px] font-bold ${it.strategy === 'fifo' ? 'text-teal-700' : 'text-blue-700'}`}>
                              {it.strategy === 'fifo' ? 'Lote FIFO' : `Venta: $${it.newPriceUSD?.toFixed(2) || '0'}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Financial SENIAT Breakdown */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Base Imponible (16%):</span>
                  <span>Bs. {formatBs(selectedExpenseForTicket.baseImponibleBs)}</span>
                </div>
                <div className="flex justify-between text-blue-700 font-semibold">
                  <span>IVA Crédito Fiscal (16%):</span>
                  <span>+ Bs. {formatBs(selectedExpenseForTicket.ivaBs)}</span>
                </div>
                {selectedExpenseForTicket.retencionIVABs > 0 && (
                  <div className="flex justify-between text-amber-700">
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
                <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-bold text-sm text-slate-900">
                  <span>TOTAL PAGADO:</span>
                  <span>Bs. {formatBs(selectedExpenseForTicket.amountBs)}</span>
                </div>
                <div className="text-right text-xs text-teal-700 font-bold">
                  ≈ ${formatUSD(selectedExpenseForTicket.amountUSD)} USD (Tasa: Bs. {formatBs(selectedExpenseForTicket.bcvRate || bcvRate)})
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const exp = selectedExpenseForTicket;
                    setSelectedExpenseForTicket(null);
                    setEditingExpense(exp);
                    setIsGastoModalOpen(true);
                  }}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                  className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseForTicket(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Desincorporación / Salida de Inventario (Ojito) */}
      {selectedDischargeForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-amber-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-amber-300" />
                Comprobante de Salida / Merma
              </span>
              <button onClick={() => setSelectedDischargeForDetail(null)} className="p-1 rounded-full hover:bg-amber-800 text-amber-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nº Comprobante</span>
                  <span className="text-base font-black text-amber-700 font-mono">{selectedDischargeForDetail.dischargeNumber}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  selectedDischargeForDetail.reason === 'Daño / Vencimiento'
                    ? 'bg-rose-100 text-rose-800'
                    : selectedDischargeForDetail.reason === 'Uso Interno'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedDischargeForDetail.reason}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Producto:</span>
                  <span className="font-bold text-slate-900">{selectedDischargeForDetail.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Código / Categoría:</span>
                  <span className="font-mono text-slate-700">{selectedDischargeForDetail.productCode} • {selectedDischargeForDetail.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cantidad Desincorporada:</span>
                  <span className="font-black text-slate-900">{selectedDischargeForDetail.quantity} unid.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Costo Unitario:</span>
                  <span className="font-mono font-bold text-slate-700">${formatUSD(selectedDischargeForDetail.unitCostUSD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Responsable:</span>
                  <span className="font-bold text-slate-800">{selectedDischargeForDetail.responsibleName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha y Hora:</span>
                  <span className="font-mono text-slate-600">{new Date(selectedDischargeForDetail.date).toLocaleString('es-VE')}</span>
                </div>
                {selectedDischargeForDetail.notes && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Observaciones:</span>
                    <p className="text-slate-700 mt-0.5">{selectedDischargeForDetail.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-rose-900">Pérdida Contable Total:</span>
                <div className="text-right font-mono">
                  <div className="text-base font-black text-rose-700">${formatUSD(selectedDischargeForDetail.totalLossUSD)}</div>
                  <div className="text-[11px] font-bold text-rose-600">Bs. {formatBs(selectedDischargeForDetail.totalLossBs)}</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const item = selectedDischargeForDetail;
                  setSelectedDischargeForDetail(null);
                  setDeleteTarget({ type: 'discharge', item });
                }}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDischargeForDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Cuenta por Pagar a Proveedor (Ojito) */}
      {selectedCuentaForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-400" />
                Detalle de Cuenta por Pagar (Proveedor)
              </span>
              <button onClick={() => setSelectedCuentaForDetail(null)} className="p-1 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-black text-slate-900">{selectedCuentaForDetail.supplierName}</h4>
                  <p className="text-slate-500 font-mono mt-0.5">
                    {selectedCuentaForDetail.supplierRIF || 'Sin RIF'}
                    {selectedCuentaForDetail.supplierPhone ? ` • ${selectedCuentaForDetail.supplierPhone}` : ''}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  selectedCuentaForDetail.status === 'pagada'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedCuentaForDetail.status === 'parcial'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedCuentaForDetail.status === 'pagada' ? 'Saldada' : selectedCuentaForDetail.status === 'parcial' ? 'Abono Parcial' : 'Pendiente'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
                <div>
                  <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Total</span>
                  <span className="font-black text-slate-900">${formatUSD(selectedCuentaForDetail.totalAmountUSD)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Abonado</span>
                  <span className="font-black text-emerald-700">${formatUSD(selectedCuentaForDetail.paidAmountUSD)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Saldo</span>
                  <span className="font-black text-rose-700">${formatUSD(selectedCuentaForDetail.remainingUSD)}</span>
                </div>
              </div>

              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between"><span className="text-slate-500">Factura Nº:</span><span className="font-mono font-bold">{selectedCuentaForDetail.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Emisión / Vence:</span><span className="font-mono">{selectedCuentaForDetail.date} → {selectedCuentaForDetail.dueDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Categoría:</span><span className="font-bold">{selectedCuentaForDetail.category}</span></div>
                {selectedCuentaForDetail.description && (
                  <div className="pt-1.5 border-t border-slate-200"><span className="text-slate-500 block">Concepto:</span><span className="text-slate-800">{selectedCuentaForDetail.description}</span></div>
                )}
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 uppercase text-[11px]">Historial de Abonos ({selectedCuentaForDetail.abonos.length})</h5>
                {selectedCuentaForDetail.abonos.length === 0 ? (
                  <p className="text-slate-400 italic">No se han registrado abonos todavía.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedCuentaForDetail.abonos.map(ab => (
                      <div key={ab.id} className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {new Date(ab.date).toLocaleDateString('es-VE')} {ab.reference ? `• Ref: ${ab.reference}` : ''}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-black text-emerald-700">${formatUSD(ab.amountUSD)}</span>
                          <span className="block text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              {selectedCuentaForDetail.status !== 'pagada' ? (
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCuentaForDetail;
                    setSelectedCuentaForDetail(null);
                    handleOpenAbonoCuenta(c);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Registrar Abono</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedCuentaForDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Gasto del Mes / Insumos (Ojito) */}
      {selectedGastoForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-indigo-950 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-indigo-300" />
                Detalle de Gasto Operativo / Insumo
              </span>
              <button onClick={() => setSelectedGastoForDetail(null)} className="p-1 rounded-full hover:bg-indigo-900 text-indigo-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                    {selectedGastoForDetail.category}
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-1">{selectedGastoForDetail.concept}</h4>
                  <p className="text-slate-500 mt-0.5">{selectedGastoForDetail.month}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  selectedGastoForDetail.status === 'pagado'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedGastoForDetail.status === 'parcial'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedGastoForDetail.status === 'pagado' ? 'Pagado' : selectedGastoForDetail.status === 'parcial' ? 'Abono Parcial' : 'Pendiente'}
                </span>
              </div>

              {(selectedGastoForDetail.supplierName || selectedGastoForDetail.supplierRIF || selectedGastoForDetail.supplierPhone || selectedGastoForDetail.invoiceNumber) && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Datos Fiscales y Contacto del Proveedor</div>
                  {selectedGastoForDetail.supplierName && (
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{selectedGastoForDetail.supplierName}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-slate-600 font-mono">
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
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Total</span>
                      <span className="font-black text-slate-900">${formatUSD(selectedGastoForDetail.amountUSD)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Abonado</span>
                      <span className="font-black text-emerald-700">${formatUSD(paidUSD)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 font-bold uppercase block">Pendiente</span>
                      <span className="font-black text-rose-700">${formatUSD(remUSD)}</span>
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
                      <div key={ab.id} className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {new Date(ab.date).toLocaleDateString('es-VE')} {ab.reference ? `• Ref: ${ab.reference}` : ''}
                          </span>
                          {ab.notes && <span className="block text-[10px] text-slate-600">{ab.notes}</span>}
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-black text-emerald-700">${formatUSD(ab.amountUSD)}</span>
                          <span className="block text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              {selectedGastoForDetail.status !== 'pagado' ? (
                <button
                  type="button"
                  onClick={() => {
                    const g = selectedGastoForDetail;
                    setSelectedGastoForDetail(null);
                    handleOpenAbonoGasto(g);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Abonar / Pagar</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedGastoForDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Venta */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditSale} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-blue-300" />
                Editar Datos de Venta
              </span>
              <button type="button" onClick={() => setEditingSale(null)} className="p-1 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Factura</label>
                  <input type="text" required value={editSaleInvoice} onChange={e => setEditSaleInvoice(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Control</label>
                  <input type="text" required value={editSaleControl} onChange={e => setEditSaleControl(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Razón Social / Cliente</label>
                <input type="text" required value={editSaleClientName} onChange={e => setEditSaleClientName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RIF / Cédula</label>
                  <input type="text" required value={editSaleClientRIF} onChange={e => setEditSaleClientRIF(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={editSaleClientPhone} onChange={e => setEditSaleClientPhone(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección Fiscal</label>
                <input type="text" value={editSaleClientAddress} onChange={e => setEditSaleClientAddress(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Estatus</label>
                <select value={editSaleStatus} onChange={e => setEditSaleStatus(e.target.value as 'completada' | 'anulada' | 'devuelta')} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold">
                  <option value="completada">Completada</option>
                  <option value="devuelta">Devuelta</option>
                  <option value="anulada">Anulada</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSale(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Cuenta por Pagar */}
      {editingCuenta && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditCuenta} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-rose-300" />
                Editar Cuenta por Pagar
              </span>
              <button type="button" onClick={() => setEditingCuenta(null)} className="p-1 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Proveedor</label>
                <input type="text" required value={editCuentaSupplierName} onChange={e => setEditCuentaSupplierName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RIF / Cédula</label>
                  <input type="text" value={editCuentaSupplierRIF} onChange={e => setEditCuentaSupplierRIF(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={editCuentaSupplierPhone} onChange={e => setEditCuentaSupplierPhone(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Factura</label>
                  <input type="text" required value={editCuentaInvoice} onChange={e => setEditCuentaInvoice(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vencimiento</label>
                  <input type="date" value={editCuentaDueDate} onChange={e => setEditCuentaDueDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total ($)</label>
                  <input type="number" step="0.01" min="0" required value={editCuentaTotalUSD} onChange={e => setEditCuentaTotalUSD(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concepto / Descripción</label>
                <input type="text" value={editCuentaDescription} onChange={e => setEditCuentaDescription(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas</label>
                <input type="text" value={editCuentaNotes} onChange={e => setEditCuentaNotes(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCuenta(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Registrar Abono a Cuenta por Pagar */}
      {cuentaForAbono && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveAbonoCuenta} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-300" />
                Registrar Abono a Proveedor
              </span>
              <button type="button" onClick={() => setCuentaForAbono(null)} className="p-1 rounded-full hover:bg-emerald-700 text-emerald-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-900 block">{cuentaForAbono.supplierName}</span>
                  <span className="text-[11px] text-slate-500 font-mono">Fact: {cuentaForAbono.invoiceNumber}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-400 block">Saldo Pendiente</span>
                  <span className="text-sm font-black text-rose-700">${formatUSD(cuentaForAbono.remainingUSD)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">Monto a Abonar ($ USD)</label>
                  <button type="button" onClick={() => setCuentaAbonoAmount(cuentaForAbono.remainingUSD.toFixed(2))} className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer">
                    Pagar Saldo Total
                  </button>
                </div>
                <input type="number" step="0.01" min="0.01" max={cuentaForAbono.remainingUSD} required value={cuentaAbonoAmount} onChange={e => setCuentaAbonoAmount(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Método de Pago</label>
                <select value={cuentaAbonoMethod} onChange={e => setCuentaAbonoMethod(e.target.value as PaymentMethod)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold">
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="efectivo_usd">Efectivo USD ($)</option>
                  <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                  <option value="debito">Tarjeta / Débito</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nº Referencia</label>
                <input type="text" value={cuentaAbonoRef} onChange={e => setCuentaAbonoRef(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Observación</label>
                <input type="text" value={cuentaAbonoNotes} onChange={e => setCuentaAbonoNotes(e.target.value)} placeholder="Ej: Abono parcial factura..." className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setCuentaForAbono(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Check className="w-3.5 h-3.5" />
                <span>Confirmar Abono</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Gasto Operativo */}
      {editingGastoOp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditGastoOp} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-indigo-950 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-indigo-300" />
                Editar Gasto del Mes / Insumo
              </span>
              <button type="button" onClick={() => setEditingGastoOp(null)} className="p-1 rounded-full hover:bg-indigo-900 text-indigo-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concepto</label>
                <input type="text" required value={editGastoConcept} onChange={e => setEditGastoConcept(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <select value={editGastoCategory} onChange={e => setEditGastoCategory(e.target.value as GastoOperativoCategory)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold">
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
                  <input type="number" step="0.01" min="0" required value={editGastoAmountUSD} onChange={e => setEditGastoAmountUSD(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proveedor / Persona</label>
                  <input type="text" value={editGastoSupplierName} onChange={e => setEditGastoSupplierName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">RIF o Cédula</label>
                  <input type="text" value={editGastoSupplierRIF} onChange={e => setEditGastoSupplierRIF(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={editGastoSupplierPhone} onChange={e => setEditGastoSupplierPhone(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Factura</label>
                  <input type="text" value={editGastoInvoiceNumber} onChange={e => setEditGastoInvoiceNumber(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vencimiento</label>
                  <input type="date" value={editGastoDueDate} onChange={e => setEditGastoDueDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas</label>
                <input type="text" value={editGastoNotes} onChange={e => setEditGastoNotes(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingGastoOp(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
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
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handleSaveAbonoGasto} className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-emerald-800 text-white flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-300" />
                  Registrar Abono / Pago de Gasto
                </span>
                <button type="button" onClick={() => setGastoForAbono(null)} className="p-1 rounded-full hover:bg-emerald-700 text-emerald-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 block">{gastoForAbono.concept}</span>
                    <span className="text-[11px] text-slate-500">
                      {gastoForAbono.supplierName || gastoForAbono.category}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 block">Saldo Pendiente</span>
                    <span className="text-sm font-black text-rose-700">${formatUSD(remaining)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">Monto a Cancelar ($ USD)</label>
                    <button type="button" onClick={() => setGastoAbonoAmount(remaining.toFixed(2))} className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer">
                      Pagar Total
                    </button>
                  </div>
                  <input type="number" step="0.01" min="0.01" max={remaining} required value={gastoAbonoAmount} onChange={e => setGastoAbonoAmount(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm" />
                  <div className="flex justify-between text-[11px] mt-1 font-mono text-slate-500">
                    <span>Equiv: Bs. {formatBs(parsedPay * bcvRate)}</span>
                    <span className={newRemaining <= 0.01 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                      {newRemaining <= 0.01 ? 'Salda deuda por completo' : `Restante: $${formatUSD(newRemaining)}`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Método de Pago</label>
                  <select value={gastoAbonoMethod} onChange={e => setGastoAbonoMethod(e.target.value as PaymentMethod)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold">
                    <option value="efectivo_usd">Efectivo USD ($)</option>
                    <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="debito">Tarjeta / Débito</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nº Referencia</label>
                  <input type="text" value={gastoAbonoRef} onChange={e => setGastoAbonoRef(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Observación</label>
                  <input type="text" value={gastoAbonoNotes} onChange={e => setGastoAbonoNotes(e.target.value)} placeholder="Ej: Abono parcial de insumos..." className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
              </div>

              <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={() => setGastoForAbono(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Abono</span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Modal: Confirmar Eliminación Unificado */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-200" />
                Confirmar Eliminación
              </span>
              <button type="button" onClick={() => setDeleteTarget(null)} className="p-1 rounded-full hover:bg-rose-600 text-rose-100 cursor-pointer">
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
                <label className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreStockOnSaleDelete}
                    onChange={e => setRestoreStockOnSaleDelete(e.target.checked)}
                    className="rounded border-amber-400 text-amber-600"
                  />
                  <span className="text-amber-900 font-semibold">Reincorporar los productos al inventario</span>
                </label>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
