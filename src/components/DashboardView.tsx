import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Clock,
  Lock,
  RotateCw,
  Banknote,
  Eye,
  X,
  Check,
  Building2,
  CreditCard,
  KeyRound,
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
    setIsCierreModalOpen,
    checkRemoteChangesForMultiDevice,
  } = useApp();

  const [selectedTicketSale, setSelectedTicketSale] = useState<Sale | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState(false);
  const [pinErrorMsg, setPinErrorMsg] = useState('');
  const [isRefreshingSales, setIsRefreshingSales] = useState(false);

  // Calculations for today
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter((s) => s.date.startsWith(todayStr) && s.status === 'completada');
  const todayExpenses = expenses.filter((e) => e.date.startsWith(todayStr));

  // 1. Efectivo en caja (Neto de efectivo USD + efectivo Bs convertido a USD, incluyendo pagos combinados)
  let cashUsdSales = 0;
  let cashBsSales = 0;
  todaySales.forEach((s) => {
    if (s.paymentMethod === 'efectivo_usd') {
      cashUsdSales += s.totalUSD;
    } else if (s.paymentMethod === 'efectivo_bs') {
      cashBsSales += s.totalBs;
    } else if (s.paymentMethod === 'pago_combinado' && s.paymentDetails?.combinedBreakdown) {
      cashUsdSales += s.paymentDetails.combinedBreakdown.usdCash || 0;
      cashBsSales += s.paymentDetails.combinedBreakdown.bsCash || 0;
    }
  });

  const cashUsdExp = todayExpenses
    .filter((e) => e.paymentMethod === 'efectivo_usd')
    .reduce((a, e) => a + e.amountUSD, 0);
  const cashBsExp = todayExpenses
    .filter((e) => e.paymentMethod === 'efectivo_bs')
    .reduce((a, e) => a + e.amountBs, 0);

  const cashNetUSD = cashUsdSales - cashUsdExp + (bcvRate > 0 ? (cashBsSales - cashBsExp) / bcvRate : 0);
  const cashNetBs = cashNetUSD * bcvRate;

  // 2. Ventas Brutas
  const grossSalesUSD = todaySales.reduce((a, s) => a + s.totalUSD, 0);
  const grossSalesBs = grossSalesUSD * bcvRate;

  // Mini sparkline points from today's hourly totals
  const sparklinePath = useMemo(() => {
    const buckets = new Array(8).fill(0);
    todaySales.forEach((s) => {
      const hr = new Date(s.date).getHours();
      const idx = Math.max(0, Math.min(7, Math.floor((hr - 7) / 2)));
      buckets[idx] += s.totalUSD;
    });
    const maxB = Math.max(...buckets, 1);
    const pts = buckets.map((v, i) => {
      const x = (i / 7) * 58 + 2;
      const y = 20 - (v / maxB) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [todaySales]);

  // 3. Valor Inventario (Solo mercancía física)
  const physicalProducts = products.filter((p) => !p.isService && p.itemType !== 'servicio');
  const inventoryUSD = physicalProducts.reduce((a, p) => a + p.stock * p.priceUSD, 0);
  const inventoryBs = inventoryUSD * bcvRate;
  const lowStockCount = physicalProducts.filter((p) => p.stock <= p.minStock).length;

  // 4. Deuda Fiados & Antigüedad real (Corriente / 30 Días / 60+ Días)
  const activeFiados = fiados.filter((f) => f.status !== 'saldado');
  const totalFiadosUSD = activeFiados.reduce((a, f) => a + f.remainingDebtUSD, 0);
  const totalFiadosBs = totalFiadosUSD * bcvRate;

  const fiadoAging = useMemo(() => {
    const now = Date.now();
    let currentUSD = 0;
    let currentCount = 0;
    let days30USD = 0;
    let days30Count = 0;
    let days60USD = 0;
    let days60Count = 0;

    activeFiados.forEach((f) => {
      const ageDays = Math.max(0, Math.floor((now - new Date(f.date).getTime()) / (1000 * 60 * 60 * 24)));
      if (ageDays >= 60) {
        days60USD += f.remainingDebtUSD;
        days60Count += 1;
      } else if (ageDays >= 30) {
        days30USD += f.remainingDebtUSD;
        days30Count += 1;
      } else {
        currentUSD += f.remainingDebtUSD;
        currentCount += 1;
      }
    });

    return { currentUSD, currentCount, days30USD, days30Count, days60USD, days60Count };
  }, [activeFiados]);

  // 5. Cuentas por Pagar (Proveedores) & Gastos del Mes
  const activeCPP = cuentasPorPagar.filter((c) => c.status !== 'pagada');
  const pendingGastos = gastosOperativos.filter((g) => g.status !== 'pagado');
  const totalCPPUSD = activeCPP.reduce((a, c) => a + c.remainingUSD, 0);
  const totalPendingGastosUSD = pendingGastos.reduce((a, g) => a + (g.remainingUSD ?? g.amountUSD), 0);
  const totalCombinedDebtUSD = totalCPPUSD + totalPendingGastosUSD;
  const totalCombinedDebtBs = totalCombinedDebtUSD * bcvRate;
  const overdueCPPCount = activeCPP.filter((c) => new Date(c.dueDate) < new Date()).length;

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

  const handleRefreshRecentSales = async () => {
    setIsRefreshingSales(true);
    try {
      await checkRemoteChangesForMultiDevice();
    } finally {
      setTimeout(() => setIsRefreshingSales(false), 500);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Top Action Pills: Mi Perfil & Clave de Gerente */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#EBF3FE] hover:bg-[#DCEAFE] text-[#1D4ED8] border border-[#C5DCFC] rounded-full text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
          title="Personalizar datos de mi negocio, logo y comprobante"
        >
          <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Mi Perfil de Negocio</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentPinInput('');
            setNewPinInput('');
            setPinErrorMsg('');
            setIsPinModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-[#DCE4F0] rounded-full text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Gestionar Clave de Gerente</span>
        </button>
      </div>

      {/* Caja Cerrada Alert Banner */}
      {!isCashRegisterOpen && (
        <div className="bg-[#FFF3E8] border border-[#F5D3B3] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#D96B27] text-white shadow-xs shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#7C3A0B] text-sm">
                La caja se encuentra cerrada
              </h3>
              <p className="text-xs text-[#9A4B12]">
                Para iniciar la jornada diaria y habilitar las ventas y compras, realiza la apertura de caja registrando el fondo inicial en efectivo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAperturaModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-[#0B1528] hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>Abrir Caja Ahora</span>
          </button>
        </div>
      )}

      {/* ROW 1: HERO TOP CARDS (Efectivo en Caja + Ventas Brutas del Día) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: EFECTIVO EN CAJA (Focused Soft-Ice Highlight) */}
        <div className="rounded-2xl p-5 border border-[#93C5FD] bg-gradient-to-b from-white to-[#F4F8FF] shadow-[0_4px_16px_-4px_rgba(37,99,235,0.12)] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                EFECTIVO EN CAJA
              </span>

              {isCashRegisterOpen ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#065F46] bg-[#E7F8EE] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-[#A7E6C4]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  CAJA ABIERTA
                </span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9A4B12] bg-[#FEF3E7] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-[#F5D3B3]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D96B27]"></span>
                  CAJA CERRADA
                </span>
              )}
            </div>

            <div className="mt-1.5">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#0B1528] font-mono-numbers tracking-tight">
                ${formatUSD(cashNetUSD + (isCashRegisterOpen ? cashShift?.initialCashUSD || 0 : 0))}
              </div>
              <div className="text-xs font-semibold text-slate-600 font-mono-numbers mt-0.5">
                Bs {formatBs(cashNetBs + (isCashRegisterOpen ? cashShift?.initialCashBs || 0 : 0))}
              </div>
              {isCashRegisterOpen && (
                <div className="text-[11px] text-slate-400 font-mono-numbers mt-1">
                  Fondo base: ${formatUSD(cashShift?.initialCashUSD || 0)} | Neto hoy: ${formatUSD(cashNetUSD)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {isCashRegisterOpen ? (
              <button
                type="button"
                onClick={() => setIsCierreModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-98"
                title="Cerrar la jornada diaria y realizar el arqueo de efectivo"
              >
                <Lock className="w-3.5 h-3.5 text-blue-300" />
                <span>Cerrar caja</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAperturaModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer active:scale-98"
                title="Abrir la caja para iniciar las operaciones de venta y compra de hoy"
              >
                <KeyRound className="w-3.5 h-3.5 text-white" />
                <span>Apertura de caja</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCuadreModalOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-[#93C5FD] bg-white hover:bg-[#EBF3FE] text-[#0B1528] rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Ver cuadre de caja</span>
            </button>
          </div>
        </div>

        {/* CARD 2: VENTAS BRUTAS DEL DÍA */}
        <div
          onClick={() => setActiveTab('contabilidad')}
          className="bg-white/95 rounded-2xl p-5 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-4 cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                VENTAS BRUTAS DEL DÍA
              </span>
              <TrendingUp className="w-6 h-6 text-[#2563EB] stroke-[2.2]" />
            </div>

            <div className="mt-1.5">
              <div className="text-3xl sm:text-4xl font-extrabold text-[#0B1528] font-mono-numbers tracking-tight">
                ${formatUSD(grossSalesUSD)}
              </div>
              <div className="text-xs font-semibold text-slate-600 font-mono-numbers mt-0.5">
                Bs {formatBs(grossSalesBs)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-slate-500">
              {todaySales.length} {todaySales.length === 1 ? 'transacción' : 'transacciones'}
            </span>
            <svg width="64" height="24" viewBox="0 0 64 24" className="overflow-visible">
              <path
                d={sparklinePath}
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ROW 2: 4-CARD KPI STRIP (Valor Inventario, Stock Bajo Peach, Deuda Fiados, Estado Cuentas por Cobrar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: VALOR INVENTARIO */}
        <div
          onClick={() => setActiveTab('productos')}
          className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-3 cursor-pointer hover:border-cyan-300 transition-colors"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                VALOR INVENTARIO
              </span>
              <span className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200/70 flex items-center justify-center text-cyan-600 shrink-0">
                <Package className="w-4 h-4" />
              </span>
            </div>

            <div className="mt-1.5">
              <div className="text-2xl font-extrabold text-[#0B1528] font-mono-numbers tracking-tight">
                ${formatUSD(inventoryUSD)}
              </div>
              <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                Bs {formatBs(inventoryBs)}
              </div>
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500">
            {physicalProducts.length} {physicalProducts.length === 1 ? 'producto' : 'productos'}
          </div>
        </div>

        {/* KPI 2: STOCK BAJO ALERTAS (Warm Peach Card matching screenshot) */}
        <div
          onClick={() => setActiveTab('productos')}
          className="bg-[#FFF3E8] rounded-2xl p-4 border border-[#F5D3B3] shadow-[0_2px_10px_-4px_rgba(217,107,39,0.08)] flex flex-col justify-between space-y-3 cursor-pointer hover:border-orange-300 transition-colors"
        >
          <div>
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              STOCK BAJO ALERTAS
            </span>
            <div className="text-3xl font-extrabold text-[#D96B27] font-mono-numbers mt-1.5">
              {lowStockCount}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
            {lowStockCount > 0 ? (
              <span className="font-bold text-[#B45309]">Requiere reposición</span>
            ) : (
              <span className="font-bold text-emerald-700">Stock óptimo</span>
            )}
          </div>
        </div>

        {/* KPI 3: DEUDA FIADOS */}
        <div
          onClick={() => setActiveTab('fiados')}
          className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-3 cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              DEUDA FIADOS
            </span>

            <div className="mt-1.5">
              <div className="text-2xl font-extrabold text-[#0B1528] font-mono-numbers tracking-tight">
                ${formatUSD(totalFiadosUSD)}
              </div>
              <div className="text-xs font-medium text-slate-500 font-mono-numbers mt-0.5">
                Bs {formatBs(totalFiadosBs)}
              </div>
            </div>
          </div>

          <div className="text-xs font-bold text-[#D97706]">
            {activeFiados.length} {activeFiados.length === 1 ? 'pendiente' : 'pendientes'}
          </div>
        </div>

        {/* KPI 4: ESTADO DE CUENTAS POR COBRAR (Real Aging Table) */}
        <div
          onClick={() => setActiveTab('fiados')}
          className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-2.5 cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-snug">
              ESTADO DE CUENTAS POR COBRAR
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#FEF3E7] border border-[#F5D3B3] flex items-center justify-center text-[#D97706] shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="text-[11px] space-y-1.5 pt-1">
            <div className="grid grid-cols-3 text-slate-400 font-bold text-[10px] border-b border-slate-100 pb-1">
              <span>Tramo</span>
              <span className="text-center">Cuentas</span>
              <span className="text-right">Saldo</span>
            </div>
            <div className="grid grid-cols-3 items-center font-medium text-slate-700">
              <span>Corriente</span>
              <span className="text-center font-mono-numbers text-slate-500">{fiadoAging.currentCount}</span>
              <span className="text-right font-mono-numbers font-bold text-[#0B1528]">${formatUSD(fiadoAging.currentUSD)}</span>
            </div>
            <div className="grid grid-cols-3 items-center font-medium text-slate-700">
              <span>30 Días</span>
              <span className="text-center font-mono-numbers text-amber-600">{fiadoAging.days30Count}</span>
              <span className="text-right font-mono-numbers font-bold text-amber-700">${formatUSD(fiadoAging.days30USD)}</span>
            </div>
            <div className="grid grid-cols-3 items-center font-medium text-slate-700">
              <span>60+ Días</span>
              <span className="text-center font-mono-numbers text-rose-600">{fiadoAging.days60Count}</span>
              <span className="text-right font-mono-numbers font-bold text-rose-700">${formatUSD(fiadoAging.days60USD)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: TOTAL POR PAGAR (PROVEEDORES Y GASTOS DEL MES) */}
      <div
        onClick={() => setActiveTab('cuentas_por_pagar')}
        className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-2.5 cursor-pointer hover:border-rose-300 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#FEECEF] border border-[#FBC4CD] flex items-center justify-center text-[#DC2626] shrink-0">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
            <span>TOTAL POR PAGAR (PROVEEDORES Y GASTOS DEL MES)</span>
          </span>
          <span className="text-xs font-bold text-[#2563EB] hover:underline">
            Gestionar gastos y deudas →
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#DC2626] font-mono-numbers tracking-tight">
              ${formatUSD(totalCombinedDebtUSD)}
            </div>
            <div className="text-xs font-semibold text-slate-500 font-mono-numbers mt-0.5">
              Bs {formatBs(totalCombinedDebtBs)}
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-600 flex items-center gap-2 flex-wrap">
            <span>{activeCPP.length} factura(s) proveedor</span>
            <span className="text-slate-300">•</span>
            <span>{pendingGastos.length} gasto(s) del mes pendiente(s)</span>
            {overdueCPPCount > 0 && (
              <span className="text-[#BE123C] font-bold bg-[#FEECEF] px-2.5 py-0.5 rounded-full border border-[#FBC4CD]">
                {overdueCPPCount} vencida{overdueCPPCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ROW 4: CURVA DE VENTAS DEL DÍA */}
      <HourlySalesChart sales={sales} bcvRate={bcvRate} />

      {/* ROW 5: VENTAS RECIENTES (Tabular layout matching screenshot) */}
      <div className="bg-white/95 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#E7F8EE] border border-[#A7E6C4] flex items-center justify-center text-emerald-600">
              <Banknote className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-[#0B1528] text-sm">Ventas recientes</h3>
          </div>

          <button
            type="button"
            onClick={handleRefreshRecentSales}
            disabled={isRefreshingSales}
            className="p-2 rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Sincronizar ventas recientes"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshingSales ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {sales.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No hay ventas registradas
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sales.slice(0, 5).map((sale) => {
              const methodLabel = sale.paymentMethod.replace(/_/g, ' ').toUpperCase();
              const refText =
                sale.paymentDetails?.pagoMovilRef ||
                sale.paymentDetails?.transferenciaRef ||
                '—';

              return (
                <div
                  key={sale.id}
                  className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors"
                >
                  {/* Left: Invoice + Method Tag + Client + Timestamp */}
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-[#0B1528] font-mono-numbers">
                        {sale.invoiceNumber}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] uppercase">
                        {methodLabel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {sale.clientName}{' '}
                      <span className="text-[11px] text-slate-400 font-mono-numbers">({sale.clientRIF})</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(sale.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {sale.items.length} {sale.items.length === 1 ? 'artículo' : 'artículos'}
                    </div>
                  </div>

                  {/* Middle metadata columns on desktop */}
                  <div className="hidden md:grid grid-cols-3 gap-6 text-xs flex-1 max-w-md px-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Método de Pago</span>
                      <span className="font-semibold text-slate-700 capitalize">{sale.paymentMethod.replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Cliente</span>
                      <span className="font-semibold text-slate-700 truncate block">{sale.clientName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Referencia</span>
                      <span className="font-mono-numbers font-semibold text-slate-600">{refText}</span>
                    </div>
                  </div>

                  {/* Right: Bimonetary Totals + Circular Blue Eye Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="font-extrabold text-sm text-[#0B1528] font-mono-numbers">
                        ${formatUSD(sale.totalUSD)}
                      </div>
                      <div className="text-[11px] font-bold text-[#2563EB] font-mono-numbers">
                        Bs {formatBs(sale.totalBs)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTicketSale(sale)}
                      className="w-8 h-8 rounded-full bg-[#EBF3FE] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#C5DCFC] flex items-center justify-center transition-colors cursor-pointer"
                      title="Ver recibo térmico"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Gestionar Clave de Gerente */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#0B1528] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm">Clave de Seguridad de Gerente</h3>
              </div>
              <button onClick={() => setIsPinModalOpen(false)} className="text-white/80 hover:bg-white/10 p-1 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-500">
                La clave protege autorizaciones sensibles (anulación de ventas, modificación de precios y cierre de caja). Clave predeterminada:{' '}
                <strong className="font-mono text-slate-700">1234</strong>
              </p>

              {pinErrorMsg && (
                <div className="p-2.5 rounded-xl bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] text-xs font-semibold">
                  {pinErrorMsg}
                </div>
              )}

              {pinSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46] text-xs font-semibold flex items-center gap-1.5">
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
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-mono"
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
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
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
