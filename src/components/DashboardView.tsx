import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  Lock, 
  RotateCw, 
  Banknote, 
  Eye, 
  X, 
  Check, 
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  Plus,
  Building2,
  CreditCard,
  KeyRound,
  LockOpen,
  Sun
} from 'lucide-react';
import { formatBs, formatUSD } from '../utils/exportUtils';
import { Sale } from '../types';
import { ComprobanteTicketModal } from './Modals/ComprobanteTicketModal';
import { HourlySalesChart } from './HourlySalesChart';

export const DashboardView: React.FC = () => {
  const { 
    bcvRate, 
    sales, 
    expenses, 
    products, 
    fiados, 
    cuentasPorPagar,
    gastosOperativos,
    setActiveTab, 
    setIsCuadreModalOpen,
    setIsProfileModalOpen,
    businessInfo,
    managerPin,
    updateManagerPin,
    cashShift,
    isCashRegisterOpen,
    setIsAperturaModalOpen,
    setIsCierreModalOpen
  } = useApp();

  const [selectedTicketSale, setSelectedTicketSale] = useState<Sale | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState(false);
  const [pinErrorMsg, setPinErrorMsg] = useState('');

  // Calculations for today
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.date.startsWith(todayStr) && s.status === 'completada');
  const todayExpenses = expenses.filter(e => e.date.startsWith(todayStr));

  // 1. Efectivo en caja (Neto de efectivo USD + efectivo Bs convertido a USD, incluyendo pagos combinados)
  let cashUsdSales = 0;
  let cashBsSales = 0;
  todaySales.forEach(s => {
    if (s.paymentMethod === 'efectivo_usd') {
      cashUsdSales += s.totalUSD;
    } else if (s.paymentMethod === 'efectivo_bs') {
      cashBsSales += s.totalBs;
    } else if (s.paymentMethod === 'pago_combinado' && s.paymentDetails?.combinedBreakdown) {
      cashUsdSales += (s.paymentDetails.combinedBreakdown.usdCash || 0);
      cashBsSales += (s.paymentDetails.combinedBreakdown.bsCash || 0);
    }
  });

  const cashUsdExp = todayExpenses.filter(e => e.paymentMethod === 'efectivo_usd').reduce((a, e) => a + e.amountUSD, 0);
  const cashBsExp = todayExpenses.filter(e => e.paymentMethod === 'efectivo_bs').reduce((a, e) => a + e.amountBs, 0);

  const cashNetUSD = (cashUsdSales - cashUsdExp) + (bcvRate > 0 ? ((cashBsSales - cashBsExp) / bcvRate) : 0);
  const cashNetBs = cashNetUSD * bcvRate;

  // 2. Ventas Brutas
  const grossSalesUSD = todaySales.reduce((a, s) => a + s.totalUSD, 0);
  const grossSalesBs = grossSalesUSD * bcvRate;

  // 3. Valor Inventario (Calculado solo sobre mercancía física, excluyendo servicios)
  const physicalProducts = products.filter(p => !p.isService && p.itemType !== 'servicio');
  const inventoryUSD = physicalProducts.reduce((a, p) => a + (p.stock * p.priceUSD), 0);
  const inventoryBs = inventoryUSD * bcvRate;
  const lowStockCount = physicalProducts.filter(p => p.stock <= p.minStock).length;

  // 4. Deuda Fiados
  const activeFiados = fiados.filter(f => f.status !== 'saldado');
  const totalFiadosUSD = activeFiados.reduce((a, f) => a + f.remainingDebtUSD, 0);
  const totalFiadosBs = totalFiadosUSD * bcvRate;

  // 5. Cuentas por Pagar (Proveedores) & Gastos del Mes
  const activeCPP = cuentasPorPagar.filter(c => c.status !== 'pagada');
  const pendingGastos = gastosOperativos.filter(g => g.status !== 'pagado');
  const totalCPPUSD = activeCPP.reduce((a, c) => a + c.remainingUSD, 0);
  const totalPendingGastosUSD = pendingGastos.reduce((a, g) => a + (g.remainingUSD ?? g.amountUSD), 0);
  const totalCombinedDebtUSD = totalCPPUSD + totalPendingGastosUSD;
  const totalCombinedDebtBs = totalCombinedDebtUSD * bcvRate;
  const overdueCPPCount = activeCPP.filter(c => new Date(c.dueDate) < new Date()).length;

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPinInput !== managerPin) {
      setPinErrorMsg('La clave actual es incorrecta.');
      return;
    }
    if (newPinInput.length < 4) {
      setPinErrorMsg('La nueva clave debe tener al menos 4 dígitos.');
      return;
    }
    updateManagerPin(newPinInput);
    setPinErrorMsg('');
    setPinSuccessMsg(true);
    setTimeout(() => {
      setPinSuccessMsg(false);
      setIsPinModalOpen(false);
      setCurrentPinInput('');
      setNewPinInput('');
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      
      {/* Top Action Buttons: Mi Perfil & Clave de Gerente */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 rounded-2xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
          title="Personalizar datos de mi negocio, logo y comprobante"
        >
          <Building2 className="w-3.5 h-3.5 text-blue-600" />
          <span>Mi Perfil de Negocio</span>
        </button>

        <button
          onClick={() => {
            setCurrentPinInput('');
            setNewPinInput('');
            setPinErrorMsg('');
            setIsPinModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200/90 rounded-2xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
        >
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Gestionar Clave de Gerente</span>
        </button>
      </div>

      {/* Caja Cerrada Alert & Quick Open Banner */}
      {!isCashRegisterOpen && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-dashed border-amber-400/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-amber-950 text-sm">
                La caja se encuentra cerrada
              </h3>
              <p className="text-xs text-amber-800">
                Para iniciar la jornada diaria y habilitar las ventas y compras, realiza la apertura de caja registrando el fondo inicial en efectivo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAperturaModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <KeyRound className="w-4 h-4" />
            <span>Abrir Caja Ahora</span>
          </button>
        </div>
      )}

      {/* 4 Cards in 2x2 Grid (Matching Screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        
        {/* CARD 1: EFECTIVO EN CAJA (CON ESTADO DE APERTURA / CIERRE) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                EFECTIVO EN CAJA
              </span>
              
              {/* Cash Register Shift Badge */}
              {isCashRegisterOpen ? (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Caja Abierta
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  Caja Cerrada
                </span>
              )}
            </div>

            <div className="mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-numbers tracking-tight">
                ${formatUSD(cashNetUSD + (isCashRegisterOpen ? (cashShift?.initialCashUSD || 0) : 0))}
              </div>
              <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                Bs {formatBs(cashNetBs + (isCashRegisterOpen ? (cashShift?.initialCashBs || 0) : 0))}
              </div>
              {isCashRegisterOpen && (cashShift?.initialCashUSD || 0) > 0 && (
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Fondo base: ${formatUSD(cashShift?.initialCashUSD || 0)} | Neto hoy: ${formatUSD(cashNetUSD)}
                </div>
              )}
            </div>
          </div>

          {/* Buttons: Apertura / Cierre de Caja + Ver Cuadre de Caja (Placed side-by-side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {isCashRegisterOpen ? (
              <button
                type="button"
                onClick={() => setIsCierreModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-95"
                title="Cerrar la jornada diaria y realizar el arqueo de efectivo"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cerrar caja</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAperturaModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-95"
                title="Abrir la caja para iniciar las operaciones de venta y compra de hoy"
              >
                <KeyRound className="w-3.5 h-3.5 text-white" />
                <span>Apertura de caja</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCuadreModalOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 border border-blue-400 bg-white hover:bg-blue-50 text-blue-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Ver cuadre de caja</span>
            </button>
          </div>
        </div>

        {/* CARD 2: VENTAS BRUTAS */}
        <div 
          onClick={() => setActiveTab('contabilidad')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                VENTAS BRUTAS
              </span>
              <TrendingUp className="w-6 h-6 text-blue-500 stroke-[2.5]" />
            </div>

            <div className="mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-numbers tracking-tight">
                ${formatUSD(grossSalesUSD)}
              </div>
              <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                Bs {formatBs(grossSalesBs)}
              </div>
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500">
            {todaySales.length} transacciones
          </div>
        </div>

        {/* CARD 3: VALOR INVENTARIO */}
        <div 
          onClick={() => setActiveTab('productos')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 cursor-pointer hover:border-cyan-300 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                VALOR INVENTARIO
              </span>
              <Package className="w-6 h-6 text-cyan-500 stroke-[2.5]" />
            </div>

            <div className="mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-numbers tracking-tight">
                ${formatUSD(inventoryUSD)}
              </div>
              <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                Bs {formatBs(inventoryBs)}
              </div>
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>{products.length} productos</span>
            {lowStockCount > 0 ? (
              <span className="text-rose-600 font-bold">{lowStockCount} stock bajo</span>
            ) : (
              <span className="text-emerald-600 font-semibold">Stock óptimo</span>
            )}
          </div>
        </div>

        {/* CARD 4: DEUDA FIADOS */}
        <div 
          onClick={() => setActiveTab('fiados')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                DEUDA FIADOS
              </span>
              <AlertTriangle className="w-6 h-6 text-amber-500 stroke-[2.5]" />
            </div>

            <div className="mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-numbers tracking-tight">
                ${formatUSD(totalFiadosUSD)}
              </div>
              <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                Bs {formatBs(totalFiadosBs)}
              </div>
            </div>
          </div>

          <div className="text-xs font-bold text-amber-500">
            {activeFiados.length} pendientes
          </div>
        </div>

        {/* CARD 5: CUENTAS POR PAGAR & GASTOS DEL MES */}
        <div 
          onClick={() => setActiveTab('cuentas_por_pagar')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 cursor-pointer hover:border-rose-300 transition-colors sm:col-span-2"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-rose-500" />
                TOTAL POR PAGAR (PROVEEDORES Y GASTOS DEL MES)
              </span>
              <span className="text-xs font-bold text-blue-600 hover:underline">
                Gestionar gastos y deudas →
              </span>
            </div>

            <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono-numbers tracking-tight">
                  ${formatUSD(totalCombinedDebtUSD)}
                </div>
                <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                  Bs {formatBs(totalCombinedDebtBs)}
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-600 flex items-center gap-2 flex-wrap">
                <span>{activeCPP.length} factura(s) proveedor</span>
                <span>•</span>
                <span>{pendingGastos.length} gasto(s) del mes pendiente(s)</span>
                {overdueCPPCount > 0 && (
                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    {overdueCPPCount} vencida{overdueCPPCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Gráfica de Ventas del Día */}
      <HourlySalesChart sales={sales} bcvRate={bcvRate} />

      {/* BOTTOM SECTION: Ventas recientes (Matching Screenshot) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Header with banknote icon + title + refresh button */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm">Ventas recientes</h3>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
            title="Actualizar ventas"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Sales List or Empty State */}
        {sales.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No hay ventas registradas
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 font-mono">{sale.invoiceNumber}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                      {sale.paymentMethod.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {sale.clientName} <span className="text-[10px] text-slate-400 font-mono">({sale.clientRIF})</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(sale.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} • {sale.items.length} artículos
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-black text-sm text-slate-900 font-mono-numbers">
                      ${formatUSD(sale.totalUSD)}
                    </div>
                    <div className="text-[11px] font-bold text-blue-700 font-mono-numbers">
                      Bs {formatBs(sale.totalBs)}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTicketSale(sale)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors"
                    title="Ver recibo térmico"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Gestionar Clave de Gerente */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <h3 className="font-bold text-sm">Clave de Seguridad de Gerente</h3>
              </div>
              <button onClick={() => setIsPinModalOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-500">
                La clave protege autorizaciones sensibles (anulación de ventas, modificación de precios y cierre de caja). Clave predeterminada: <strong className="font-mono text-slate-700">1234</strong>
              </p>

              {pinErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {pinErrorMsg}
                </div>
              )}

              {pinSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>¡Clave de Gerente actualizada con éxito!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clave Actual
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ingrese clave actual..."
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nueva Clave (4 o más dígitos)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ej: 5821"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Guardar Clave
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Comprobante Ticket Preview Modal */}
      {selectedTicketSale && (
        <ComprobanteTicketModal
          sale={selectedTicketSale}
          onClose={() => setSelectedTicketSale(null)}
          businessInfo={businessInfo}
        />
      )}

    </div>
  );
};
