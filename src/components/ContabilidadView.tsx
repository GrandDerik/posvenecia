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
  X
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
import { CashShift, Sale, Expense, CreditNote, InventoryDischarge } from '../types';
import { RegistrarGastoModal } from './RegistrarGastoModal';
import { BackupDriveModal } from './Modals/BackupDriveModal';
import { ComprobanteTicketModal } from './Modals/ComprobanteTicketModal';
import { ComprobanteNotaCreditoModal } from './Modals/ComprobanteNotaCreditoModal';

export const ContabilidadView: React.FC = () => {
  const { 
    sales, 
    expenses, 
    bcvRate, 
    businessInfo,
    cashShift,
    cashShiftHistory,
    cuentasPorPagar,
    gastosOperativos,
    creditNotes,
    setIsCreditNoteModalOpen,
    inventoryDischarges,
    setIsDischargeModalOpen,
    checkRemoteChangesForMultiDevice,
    syncToGoogleDrive,
    isDriveSyncing,
    driveSyncStatus,
    googleUser
  } = useApp();

  const [subTab, setSubTab] = useState<'ventas' | 'compras' | 'notas_credito' | 'salidas_inventario' | 'cierres_caja' | 'cuentas_por_pagar' | 'igtf' | 'estado_cuenta'>('ventas');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<CashShift | null>(null);
  const [selectedSaleForTicket, setSelectedSaleForTicket] = useState<Sale | null>(null);
  const [selectedExpenseForTicket, setSelectedExpenseForTicket] = useState<Expense | null>(null);
  const [selectedCreditNoteForTicket, setSelectedCreditNoteForTicket] = useState<CreditNote | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

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
      
      {/* Top Banner with SENIAT compliance indicator */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-800">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Módulo de Contabilidad y Reportes SENIAT
            </h1>
            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-red-200">
              Leyes de Venezuela
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Libros fiscales oficiales, cálculo de retenciones de IVA (16%), IGTF (3%) y conciliación bimonetaria a tasa BCV (Bs. {formatBs(bcvRate)})
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSubTab('ventas')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'ventas' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Libro de Ventas
            </button>
            <button
              onClick={() => setSubTab('compras')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'compras' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Libro de Compras
            </button>
            <button
              onClick={() => setSubTab('notas_credito')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'notas_credito' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>Notas de Crédito</span>
              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
                {creditNotes.length}
              </span>
            </button>
            <button
              onClick={() => setSubTab('salidas_inventario')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'salidas_inventario' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              <span>Salidas / Mermas</span>
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                {inventoryDischarges.length}
              </span>
            </button>
            <button
              onClick={() => setSubTab('cierres_caja')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'cierres_caja' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cierres de Caja</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                {cashShiftHistory.length}
              </span>
            </button>
            <button
              onClick={() => setSubTab('cuentas_por_pagar')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                subTab === 'cuentas_por_pagar' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-rose-600" />
              <span>Cuentas por Pagar</span>
              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">
                {cuentasPorPagar.filter(c => c.status !== 'pagada').length}
              </span>
            </button>
            <button
              onClick={() => setSubTab('igtf')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'igtf' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Control del IGTF (3%)
            </button>
            <button
              onClick={() => setSubTab('estado_cuenta')}
              className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'estado_cuenta' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Estado de Cuenta
            </button>
          </div>

          {/* Multi-Device Instant Sync & Backup Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstantSync}
              disabled={isSyncingNow || isDriveSyncing}
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Sincronizar inmediatamente con otros dispositivos a través de Google Drive"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingNow || isDriveSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Sincronizar Dispositivos</span>
              <span className="lg:hidden">Sync</span>
            </button>

            {/* Google Drive & Data Download Button */}
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

        {/* Sync Feedback Toast Banner */}
        {syncFeedback && (
          <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportLibroVentasExcel(filteredSales, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportLibroVentasPDF(filteredSales, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
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
                    <th className="py-2.5 px-2 text-center">Ticket</th>
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
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSaleForTicket(sale)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                          title="Ver recibo / ticket de venta"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsGastoModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Factura</span>
              </button>

              <button
                onClick={() => exportLibroComprasExcel(filteredExpenses, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportLibroComprasPDF(filteredExpenses, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
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
                    <th className="py-2.5 px-2 text-center">Ticket</th>
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
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseForTicket(exp)}
                          className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                          title="Ver comprobante de compra / factura"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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
                          <th className="py-2.5 px-2 text-center">Ticket</th>
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
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCreditNoteForTicket(nc)}
                                  className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                  title="Ver comprobante de Nota de Crédito"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
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
                            <td colSpan={11} className="py-8 text-center text-slate-400 font-sans">
                              No hay registros de salidas o desincorporación de inventario.
                            </td>
                          </tr>
                        ) : (
                          filteredDischarges.map((disc, idx) => (
                            <tr key={disc.id} className="hover:bg-slate-50/80 transition-colors">
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
            const totalPendienteUSD = cuentasPorPagar.reduce((acc, c) => acc + c.remainingUSD, 0);
            const totalGastosOpUSD = gastosOperativos.reduce((acc, g) => acc + g.amountUSD, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Deuda Global Proveedores</span>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-1">${formatUSD(totalDeudaUSD)}</div>
                  <span className="text-[11px] text-slate-500 font-mono">Bs. {formatBs(totalDeudaUSD * bcvRate)}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-emerald-700 uppercase block">Total Amortizado / Abonado</span>
                  <div className="text-2xl font-black text-emerald-700 font-mono mt-1">${formatUSD(totalAbonadoUSD)}</div>
                  <span className="text-[11px] text-emerald-600 font-mono">Bs. {formatBs(totalAbonadoUSD * bcvRate)}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
                  <span className="text-xs font-bold text-rose-700 uppercase block">Saldo Pendiente por Pagar</span>
                  <div className="text-2xl font-black text-rose-700 font-mono mt-1">${formatUSD(totalPendienteUSD)}</div>
                  <span className="text-[11px] text-rose-600 font-mono font-bold">Bs. {formatBs(totalPendienteUSD * bcvRate)}</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-indigo-700 uppercase block">Gastos Operativos (Mes)</span>
                  <div className="text-2xl font-black text-indigo-700 font-mono mt-1">${formatUSD(totalGastosOpUSD)}</div>
                  <span className="text-[11px] text-slate-500">Nómina, alquiler, servicios</span>
                </div>
              </div>
            );
          })()}

          {/* Table of Cuentas por Pagar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Facturas y Compromisos de Pago a Proveedores ({cuentasPorPagar.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Amortizaciones sincronizadas en tiempo real con Google Drive
              </span>
            </div>

            {cuentasPorPagar.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                <p className="text-sm font-bold text-slate-700">Sin cuentas pendientes por pagar</p>
                <p className="text-xs text-slate-400">
                  No tienes deudas comerciales registradas con proveedores en este momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                    <tr>
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
                        <td className="py-2.5 px-3 font-bold font-sans text-slate-900">{c.supplierName}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans">{c.supplierRIF}</td>
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportLibroVentasExcel(sales.filter(s => s.paymentMethod === 'efectivo_usd'), businessInfo)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportEstadoCuentaExcel(estadoCuentaSummary, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar a Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => exportEstadoCuentaPDF(estadoCuentaSummary, businessInfo)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
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

      {/* Registrar Gasto Modal */}
      <RegistrarGastoModal
        isOpen={isGastoModalOpen}
        onClose={() => setIsGastoModalOpen(false)}
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
                <p className="text-xs text-slate-500 font-mono">RIF: {selectedExpenseForTicket.supplierRIF}</p>
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

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
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
    </div>
  );
};
