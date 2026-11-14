import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Users, 
  Printer, 
  CheckCircle, 
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileText,
  AlertCircle,
  Landmark,
  Download,
  ClipboardCheck
} from 'lucide-react';
import { formatBs, formatUSD, round2, safeDiv, getLocalDateStr, isSameLocalDate } from '../utils/exportUtils';
import { generateReporteZPDF, generateCorteParcialXPDF } from '../utils/pdfReceiptUtils';

export const CuadreCajaModal: React.FC = () => {
  const { 
    isCuadreModalOpen, 
    setIsCuadreModalOpen, 
    sales, 
    expenses,
    creditNotes,
    fiados,
    bcvRate, 
    businessInfo,
    cashShift,
    isCashRegisterOpen,
    googleUser,
    setIsAperturaModalOpen,
    setIsCierreModalOpen
  } = useApp();

  const [showRefsModal, setShowRefsModal] = useState(false);
  const [closedSuccess, setClosedSuccess] = useState(false);

  if (!isCuadreModalOpen) return null;

  // Scope to active cash shift if open, otherwise today in local timezone
  const todayStr = getLocalDateStr();
  const useShiftWindow = Boolean(isCashRegisterOpen && cashShift?.openedAt);
  const openedAtIso = cashShift?.openedAt || '';

  const todaySales = sales.filter(s =>
    s.status !== 'anulada' && (useShiftWindow ? s.date >= openedAtIso : isSameLocalDate(s.date, todayStr))
  );
  const todayExpenses = expenses.filter(e =>
    e.paymentMethod !== 'credito' && (useShiftWindow ? e.date >= openedAtIso : isSameLocalDate(e.date, todayStr))
  );
  const todayCreditNotes = creditNotes.filter(cn =>
    useShiftWindow ? cn.date >= openedAtIso : isSameLocalDate(cn.date, todayStr)
  );
  const todayFiadoAbonos = fiados
    .flatMap(f => f.abonos || [])
    .filter(a => (useShiftWindow ? a.date >= openedAtIso : isSameLocalDate(a.date, todayStr)));

  // Compute breakdown by method (including contributions from pago_combinado & fiado abonos)
  let cashUsdSalesAmount = 0;
  let cashBsSalesAmount = 0;
  let pmSalesBs = 0;
  let debitoSalesBs = 0;
  let transferenciaSalesBs = 0;
  let fiaoTotalUSD = 0;
  let casheaTotalUSD = 0;

  todaySales.forEach(s => {
    if (s.paymentMethod === 'efectivo_usd') {
      cashUsdSalesAmount += s.totalUSD;
    } else if (s.paymentMethod === 'efectivo_bs') {
      cashBsSalesAmount += s.totalBs;
    } else if (s.paymentMethod === 'pago_movil') {
      pmSalesBs += s.totalBs;
    } else if (s.paymentMethod === 'debito') {
      debitoSalesBs += s.totalBs;
    } else if (s.paymentMethod === 'transferencia') {
      transferenciaSalesBs += s.totalBs;
    } else if (s.paymentMethod === 'cashea') {
      casheaTotalUSD += s.totalUSD;
    } else if (s.paymentMethod === 'fiao') {
      fiaoTotalUSD += (s.paymentDetails?.fiaoRemainingUSD ?? s.totalUSD);
    } else if (s.paymentMethod === 'pago_combinado' && s.paymentDetails?.combinedBreakdown) {
      const cb = s.paymentDetails.combinedBreakdown;
      cashUsdSalesAmount += (cb.usdCash || 0);
      cashBsSalesAmount += (cb.bsCash || 0);
      pmSalesBs += (cb.pagoMovil || 0);
      debitoSalesBs += (cb.debito || 0);
      transferenciaSalesBs += (cb.transferencia || 0);
      fiaoTotalUSD += (cb.fiaoRemaining || 0);
    }
  });

  // Include Fiado Abonos received during shift/day
  todayFiadoAbonos.forEach(a => {
    if (a.paymentMethod === 'efectivo_usd') cashUsdSalesAmount += a.amountUSD;
    else if (a.paymentMethod === 'efectivo_bs') cashBsSalesAmount += a.amountBs;
    else if (a.paymentMethod === 'pago_movil') pmSalesBs += a.amountBs;
    else if (a.paymentMethod === 'debito') debitoSalesBs += a.amountBs;
    else if (a.paymentMethod === 'transferencia') transferenciaSalesBs += a.amountBs;
  });

  // Credit Note refunds by method
  const cashUsdRefund = todayCreditNotes.filter(cn => cn.refundMethod === 'efectivo_usd').reduce((a, cn) => a + cn.totalUSD, 0);
  const cashBsRefund = todayCreditNotes.filter(cn => cn.refundMethod === 'efectivo_bs').reduce((a, cn) => a + cn.totalBs, 0);
  const pmRefundBs = todayCreditNotes.filter(cn => cn.refundMethod === 'pago_movil').reduce((a, cn) => a + cn.totalBs, 0);
  const debitoRefundBs = todayCreditNotes.filter(cn => cn.refundMethod === 'debito').reduce((a, cn) => a + cn.totalBs, 0);
  const transferenciaRefundBs = todayCreditNotes.filter(cn => cn.refundMethod === 'transferencia').reduce((a, cn) => a + cn.totalBs, 0);

  // 1. Efectivo USD (incluye fondo base si la caja está abierta)
  const initialCashUSD = useShiftWindow ? (cashShift?.initialCashUSD || 0) : 0;
  const cashUsdExp = todayExpenses.filter(e => e.paymentMethod === 'efectivo_usd');
  const cashUsdExpAmount = round2(cashUsdExp.reduce((a, e) => a + e.amountUSD, 0) + cashUsdRefund);
  const cashUsdNet = round2(cashUsdSalesAmount - cashUsdExpAmount);
  const drawerCashUsdExpected = round2(initialCashUSD + cashUsdNet);

  // 2. Efectivo Bs (incluye fondo base si la caja está abierta)
  const initialCashBs = useShiftWindow ? (cashShift?.initialCashBs || 0) : 0;
  const cashBsExp = todayExpenses.filter(e => e.paymentMethod === 'efectivo_bs');
  const cashBsExpAmount = round2(cashBsExp.reduce((a, e) => a + e.amountBs, 0) + cashBsRefund);
  const cashBsNet = round2(cashBsSalesAmount - cashBsExpAmount);
  const drawerCashBsExpected = round2(initialCashBs + cashBsNet);

  // 3. Pago Móvil
  const pmSales = todaySales.filter(s => s.paymentMethod === 'pago_movil' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.pagoMovil ?? 0) > 0));
  const pmExp = todayExpenses.filter(e => e.paymentMethod === 'pago_movil');
  const pmExpBs = round2(pmExp.reduce((a, e) => a + e.amountBs, 0) + pmRefundBs);
  const pmNetBs = round2(pmSalesBs - pmExpBs);
  const pmNetUSD = round2(safeDiv(pmNetBs, bcvRate));

  // 4. Punto de Débito
  const debitoSales = todaySales.filter(s => s.paymentMethod === 'debito' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.debito ?? 0) > 0));
  const debitoExpBs = round2(todayExpenses.filter(e => e.paymentMethod === 'debito').reduce((a, e) => a + e.amountBs, 0) + debitoRefundBs);
  const debitoNetBs = round2(debitoSalesBs - debitoExpBs);
  const debitoNetUSD = round2(safeDiv(debitoNetBs, bcvRate));

  // 5. Transferencia Bancaria
  const transferenciaSales = todaySales.filter(s => s.paymentMethod === 'transferencia' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.transferencia ?? 0) > 0));
  const transferenciaExpBs = round2(todayExpenses.filter(e => e.paymentMethod === 'transferencia').reduce((a, e) => a + e.amountBs, 0) + transferenciaRefundBs);
  const transferenciaNetBs = round2(transferenciaSalesBs - transferenciaExpBs);
  const transferenciaNetUSD = round2(safeDiv(transferenciaNetBs, bcvRate));

  // 6. Fiao (Cuentas por cobrar de hoy)
  const fiaoSales = todaySales.filter(s => s.paymentMethod === 'fiao' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.fiaoRemaining ?? 0) > 0));
  const fiaoTotalBs = round2(fiaoTotalUSD * bcvRate);

  // 7. Cashea
  const casheaSales = todaySales.filter(s => s.paymentMethod === 'cashea');
  const casheaTotalBs = round2(casheaTotalUSD * bcvRate);

  // IGTF 3% collected today on USD cash
  const igtfTotalUSD = round2(todaySales.reduce((a, s) => a + s.igtfUSD, 0));
  const igtfTotalBs = round2(todaySales.reduce((a, s) => a + s.igtfBs, 0));

  // Consolidated Net in Cash Register (flows + drawer base)
  const totalSalesUSD = round2(todaySales.reduce((a, s) => a + s.totalUSD, 0) + todayFiadoAbonos.reduce((a, ab) => a + ab.amountUSD, 0));
  const totalExpUSD = round2(todayExpenses.reduce((a, e) => a + e.amountUSD, 0) + todayCreditNotes.reduce((a, cn) => a + cn.totalUSD, 0));
  const totalNetUSD = round2(totalSalesUSD - totalExpUSD);
  const totalNetBs = round2(totalNetUSD * bcvRate);
  const totalCashInDrawerUSD = round2(drawerCashUsdExpected + safeDiv(drawerCashBsExpected, bcvRate));

  const handlePrintReporteZ = () => {
    generateReporteZPDF(todaySales, todayExpenses, bcvRate, businessInfo);
  };

  const handleCorteParcialX = (action: 'save' | 'print') => {
    generateCorteParcialXPDF(
      {
        cashShift,
        isCashRegisterOpen,
        sales: todaySales,
        expenses: todayExpenses,
        creditNotes: todayCreditNotes,
        fiadoAbonos: todayFiadoAbonos,
        bcvRate,
        businessInfo,
        cashierName: googleUser?.name || cashShift?.openedBy || 'Cajero'
      },
      action
    );
  };

  const handleCerrarCuadre = () => {
    setClosedSuccess(true);
    setTimeout(() => {
      setClosedSuccess(false);
      setIsCuadreModalOpen(false);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#0B1528] via-blue-900 to-slate-900 text-white p-5 flex items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/40 border border-blue-400/30 text-blue-200">
                <ClipboardCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Corte Parcial de Caja (Cierre X)</h2>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  isCashRegisterOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                }`}
              >
                {isCashRegisterOpen ? 'Caja Permanece Abierta' : 'Resumen del Día'}
              </span>
            </div>
            <p className="text-xs text-blue-200/80 mt-1">
              Auditoría parcial sin cerrar jornada • {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} | Tasa BCV: Bs. {formatBs(bcvRate)}
            </p>
          </div>
          <button 
            onClick={() => setIsCuadreModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 text-blue-100 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {closedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm font-semibold">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>¡Cuadre de caja cerrado exitosamente! Registro archivado.</span>
            </div>
          )}

          {/* Cards for each payment method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Efectivo USD */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    $
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Efectivo USD (Gaveta)</h3>
                    <span className="text-[11px] text-slate-500">Fondo ${formatUSD(initialCashUSD)} + Neto ${formatUSD(cashUsdNet)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 font-mono-numbers">
                    ${formatUSD(drawerCashUsdExpected)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-slate-500">
                    ≈ Bs. {formatBs(drawerCashUsdExpected * bcvRate)}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex justify-between text-xs text-slate-600">
                <span className="flex items-center text-emerald-600">
                  <TrendingUp className="w-3 h-3 mr-1" /> Ingresos: ${formatUSD(cashUsdSalesAmount)}
                </span>
                <span className="flex items-center text-rose-500">
                  <TrendingDown className="w-3 h-3 mr-1" /> Egresos: ${formatUSD(cashUsdExpAmount)}
                </span>
              </div>
            </div>

            {/* 2. Efectivo Bs */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                    Bs.
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Efectivo Bs (Gaveta)</h3>
                    <span className="text-[11px] text-slate-500">Fondo Bs. {formatBs(initialCashBs)} + Neto Bs. {formatBs(cashBsNet)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 font-mono-numbers">
                    Bs. {formatBs(drawerCashBsExpected)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-slate-500">
                    ≈ ${formatUSD(safeDiv(drawerCashBsExpected, bcvRate))}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex justify-between text-xs text-slate-600">
                <span className="text-emerald-600">Ingresos: Bs. {formatBs(cashBsSalesAmount)}</span>
                <span className="text-rose-500">Egresos: Bs. {formatBs(cashBsExpAmount)}</span>
              </div>
            </div>

            {/* 3. Pago Móvil (With 'Ver refs' button) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Pago Móvil (Neto)</h3>
                    <button 
                      onClick={() => setShowRefsModal(true)}
                      className="inline-flex items-center text-[11px] font-bold text-teal-700 hover:text-teal-800 underline gap-0.5 mt-0.5"
                    >
                      <span>Ver {pmSales.length} refs</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 font-mono-numbers">
                    Bs. {formatBs(pmNetBs)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-slate-500">
                    ≈ ${formatUSD(pmNetUSD)}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex justify-between text-xs text-slate-600">
                <span className="text-emerald-600">Cobrado: Bs. {formatBs(pmSalesBs)}</span>
                <span className="text-rose-500">Egresos: Bs. {formatBs(pmExpBs)}</span>
              </div>
            </div>

            {/* 4. Punto de Débito */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-teal-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Punto de Débito</h3>
                    <span className="text-[11px] text-slate-500">{debitoSales.length} operaciones</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 font-mono-numbers">
                    Bs. {formatBs(debitoNetBs)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-slate-500">
                    ≈ ${formatUSD(debitoNetUSD)}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex justify-between text-xs text-slate-600">
                <span className="text-emerald-600">Cobrado: Bs. {formatBs(debitoSalesBs)}</span>
                <span className="text-rose-500">Egresos: Bs. {formatBs(debitoExpBs)}</span>
              </div>
            </div>

            {/* 5. Transferencia Bancaria */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-cyan-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Transferencia (Neto)</h3>
                    <span className="text-[11px] text-slate-500">{transferenciaSales.length} operaciones</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-slate-900 font-mono-numbers">
                    Bs. {formatBs(transferenciaNetBs)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-slate-500">
                    ≈ ${formatUSD(transferenciaNetUSD)}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex justify-between text-xs text-slate-600">
                <span className="text-emerald-600">Cobrado: Bs. {formatBs(transferenciaSalesBs)}</span>
                <span className="text-rose-500">Egresos: Bs. {formatBs(transferenciaExpBs)}</span>
              </div>
            </div>

            {/* 5. Fiao (Cuentas por cobrar) */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Fiao (Por Cobrar Hoy)</h3>
                    <span className="text-[11px] text-amber-700 font-medium">Indexado a tasa BCV</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-amber-900 font-mono-numbers">
                    ${formatUSD(fiaoTotalUSD)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-amber-700">
                    Bs. {formatBs(fiaoTotalBs)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-amber-800/80 mt-1">
                Créditos otorgados a clientes en el día. No suma en saldo líquido hasta abonar.
              </p>
            </div>

            {/* 6. Cashea */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-800 flex items-center justify-center font-bold text-xs">
                    C
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Cashea (Cuotas)</h3>
                    <span className="text-[11px] text-purple-700 font-medium">{casheaSales.length} compras</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-purple-900 font-mono-numbers">
                    ${formatUSD(casheaTotalUSD)}
                  </span>
                  <div className="text-[11px] font-mono-numbers text-purple-700">
                    Bs. {formatBs(casheaTotalBs)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-purple-800/80 mt-1">
                Liquidación quincenal por plataforma de cuotas.
              </p>
            </div>
          </div>

          {/* Opened Bank Balances (if configured when opening cash shift) */}
          {cashShift?.initialBanks && cashShift.initialBanks.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5 uppercase tracking-wide">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  Saldos Iniciales de Bancos Registrados al Abrir Caja
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {cashShift.openedDateFormatted}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cashShift.initialBanks.map((bk) => (
                  <div key={bk.bankId} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{bk.bankName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{bk.accountNumber}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-extrabold text-blue-700">Bs. {formatBs(bk.initialBalanceBs)}</div>
                      {bk.initialBalanceUSD ? (
                        <div className="text-[10px] text-slate-500">${formatUSD(bk.initialBalanceUSD)}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SENIAT IGTF Summary Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-emerald-950 uppercase tracking-wide">
                  Retención IGTF (3% Divisas en Efectivo)
                </h4>
                <p className="text-[11px] text-emerald-800">
                  Impuesto percibido sobre pagos en Efectivo USD según normativa legal SENIAT
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-emerald-900 font-mono-numbers">
                ${formatUSD(igtfTotalUSD)}
              </span>
              <div className="text-xs font-bold text-emerald-700 font-mono-numbers">
                Bs. {formatBs(igtfTotalBs)}
              </div>
            </div>
          </div>

          {/* Highlighted Card on Dark Background: TOTAL NETO EN CAJA */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 shadow-lg border border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-500/30 px-2 py-0.5 rounded-full inline-block mb-1">
                  Auditoría Corte Parcial X
                </span>
                <h3 className="text-lg font-black tracking-tight text-white">
                  FLUJO NETO DEL TURNO
                </h3>
                <p className="text-xs text-slate-300">
                  Efectivo físico esperado en gaveta (c/ fondo): <strong className="text-emerald-300 font-mono-numbers">${formatUSD(totalCashInDrawerUSD)}</strong>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-2xl sm:text-3xl font-black text-white font-mono-numbers tracking-tight">
                  ${formatUSD(totalNetUSD)}
                </div>
                <div className="text-sm sm:text-base font-bold text-blue-400 font-mono-numbers">
                  Bs. {formatBs(totalNetBs)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleCorteParcialX('save')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-blue-50 text-[#1D4ED8] border border-[#93C5FD] px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>PDF Corte X</span>
            </button>

            <button
              type="button"
              onClick={() => handleCorteParcialX('print')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Imprimir Corte X</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReporteZ}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 px-3 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Descargar Reporte Z rápido del día"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Reporte Z</span>
            </button>
          </div>

          {/* Primary Action: Cerrar Caja or Abrir Caja */}
          {isCashRegisterOpen ? (
            <button
              type="button"
              onClick={() => {
                setIsCuadreModalOpen(false);
                setIsCierreModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Cerrar Caja del Día (Arqueo Z)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsCuadreModalOpen(false);
                setIsAperturaModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
            >
              <CheckCircle className="w-4 h-4 text-white" />
              <span>Apertura de Caja (Iniciar Día)</span>
            </button>
          )}
        </div>
      </div>

      {/* Submodal 'Ver refs' de Pago Móvil */}
      {showRefsModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-900">Referencias de Pago Móvil de Hoy</h3>
                <p className="text-xs text-slate-500">Total recibido: Bs. {formatBs(pmSalesBs)}</p>
              </div>
              <button 
                onClick={() => setShowRefsModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
              {pmSales.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No hay transacciones registradas por Pago Móvil el día de hoy.
                </div>
              ) : (
                pmSales.map((s, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{s.clientName}</div>
                      <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Banco: <strong className="text-slate-700">{s.paymentDetails.pagoMovilBank || 'BNC/Banesco'}</strong></span>
                        <span>•</span>
                        <span>Ref: <strong className="font-mono text-teal-700">{s.paymentDetails.pagoMovilRef || 'N/A'}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-slate-900">Bs. {formatBs(s.totalBs)}</div>
                      <div className="text-[11px] font-mono text-slate-500">${formatUSD(s.totalUSD)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowRefsModal(false)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700"
              >
                Cerrar Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
