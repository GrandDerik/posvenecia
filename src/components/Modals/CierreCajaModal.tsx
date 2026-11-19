import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Lock, 
  DollarSign, 
  Coins, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  FileText,
  Calculator,
  Receipt,
  Download,
  Landmark,
  Wallet
} from 'lucide-react';
import { formatBs, formatUSD, round2 } from '../../utils/exportUtils';
import { generateReporteZPDF, generateComprobanteCierrePDF } from '../../utils/pdfReceiptUtils';
import {
  computeShiftBankSummaries,
  isExpenseOwnerSalary,
  isExpenseOwnerWithdrawal
} from '../../utils/accountingUtils';

export const CierreCajaModal: React.FC = () => {
  const { 
    isCierreModalOpen, 
    setIsCierreModalOpen, 
    cashShift, 
    closeCashShift, 
    sales, 
    expenses,
    creditNotes,
    fiados,
    loans,
    bcvRate, 
    businessInfo,
    setIsCuadreModalOpen
  } = useApp();

  const [countedUSD, setCountedUSD] = useState<string>('');
  const [countedBs, setCountedBs] = useState<string>('');
  const [closedNotes, setClosedNotes] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bank closing balance capture
  const [countedBanks, setCountedBanks] = useState<Record<string, { countedBs: string; countedUSD: string }>>({});

  const openedAtIso = cashShift?.openedAt || '';
  const shiftSales = useMemo(
    () => (cashShift ? sales.filter(s => s.status !== 'anulada' && s.date >= openedAtIso) : []),
    [cashShift, sales, openedAtIso]
  );
  const shiftExpenses = useMemo(
    () => (cashShift ? expenses.filter(e => e.date >= openedAtIso && e.paymentMethod !== 'credito') : []),
    [cashShift, expenses, openedAtIso]
  );
  const shiftCreditNotes = useMemo(
    () => (cashShift ? creditNotes.filter(cn => cn.date >= openedAtIso) : []),
    [cashShift, creditNotes, openedAtIso]
  );
  const shiftFiadoAbonos = useMemo(
    () => (cashShift ? fiados.flatMap(f => f.abonos || []).filter(a => a.date >= openedAtIso) : []),
    [cashShift, fiados, openedAtIso]
  );
  const shiftLoans = useMemo(
    () => (cashShift ? loans.filter(l => (l.grantDate || l.createdAt) >= openedAtIso) : []),
    [cashShift, loans, openedAtIso]
  );

  // Per-bank traceability (initial + inflows - outflows including owner salary/withdrawals)
  const bankSummaries = useMemo(
    () =>
      computeShiftBankSummaries(
        cashShift?.initialBanks,
        shiftSales,
        shiftExpenses,
        shiftCreditNotes,
        shiftFiadoAbonos,
        shiftLoans
      ),
    [cashShift?.initialBanks, shiftSales, shiftExpenses, shiftCreditNotes, shiftFiadoAbonos, shiftLoans]
  );

  useEffect(() => {
    if (isCierreModalOpen && cashShift?.initialBanks) {
      const map: Record<string, { countedBs: string; countedUSD: string }> = {};
      cashShift.initialBanks.forEach(b => {
        const summary = bankSummaries.find(s => s.bankId === b.bankId);
        const defaultBs = b.countedBalanceBs !== undefined
          ? b.countedBalanceBs
          : (summary ? summary.expectedBalanceBs : b.initialBalanceBs);
        const defaultUSD = b.countedBalanceUSD !== undefined
          ? b.countedBalanceUSD
          : (summary ? summary.expectedBalanceUSD : (b.initialBalanceUSD || 0));
        map[b.bankId] = {
          countedBs: round2(defaultBs).toFixed(2),
          countedUSD: defaultUSD > 0 ? round2(defaultUSD).toFixed(2) : ''
        };
      });
      setCountedBanks(map);
    }
  }, [isCierreModalOpen, cashShift?.id]);

  if (!isCierreModalOpen || !cashShift) return null;

  // Inflow in cash (sales + fiado abonos + loan inflows in cash)
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

  shiftFiadoAbonos.forEach(a => {
    if (a.paymentMethod === 'efectivo_usd') {
      cashUsdInflow += a.amountUSD;
    } else if (a.paymentMethod === 'efectivo_bs') {
      cashBsInflow += a.amountBs;
    }
  });

  let loansCashUsd = 0;
  let loansCashBs = 0;
  shiftLoans.forEach(l => {
    if (l.cashDestination === 'efectivo_usd') {
      loansCashUsd += l.originalAmountUSD;
      cashUsdInflow += l.originalAmountUSD;
    } else if (l.cashDestination === 'efectivo_bs') {
      loansCashBs += l.originalAmountBs;
      cashBsInflow += l.originalAmountBs;
    }
  });

  // Owner salary & personal withdrawals breakdown (cash vs bank)
  const shiftOwnerSalaryExpenses = shiftExpenses.filter(isExpenseOwnerSalary);
  const shiftOwnerWithdrawalExpenses = shiftExpenses.filter(isExpenseOwnerWithdrawal);

  const ownerSalaryCashUSD = round2(
    shiftOwnerSalaryExpenses.filter(e => e.paymentMethod === 'efectivo_usd').reduce((acc, e) => acc + e.amountUSD, 0)
  );
  const ownerSalaryCashBs = round2(
    shiftOwnerSalaryExpenses.filter(e => e.paymentMethod === 'efectivo_bs').reduce((acc, e) => acc + e.amountBs, 0)
  );
  const ownerSalaryBankBs = round2(
    shiftOwnerSalaryExpenses
      .filter(e => e.paymentMethod !== 'efectivo_usd' && e.paymentMethod !== 'efectivo_bs')
      .reduce((acc, e) => acc + e.amountBs, 0)
  );
  const totalOwnerSalaryUSD = round2(shiftOwnerSalaryExpenses.reduce((acc, e) => acc + e.amountUSD, 0));
  const totalOwnerSalaryBs = round2(shiftOwnerSalaryExpenses.reduce((acc, e) => acc + e.amountBs, 0));

  const ownerWithdrawalsCashUSD = round2(
    shiftOwnerWithdrawalExpenses.filter(e => e.paymentMethod === 'efectivo_usd').reduce((acc, e) => acc + e.amountUSD, 0)
  );
  const ownerWithdrawalsCashBs = round2(
    shiftOwnerWithdrawalExpenses.filter(e => e.paymentMethod === 'efectivo_bs').reduce((acc, e) => acc + e.amountBs, 0)
  );
  const ownerWithdrawalsBankBs = round2(
    shiftOwnerWithdrawalExpenses
      .filter(e => e.paymentMethod !== 'efectivo_usd' && e.paymentMethod !== 'efectivo_bs')
      .reduce((acc, e) => acc + e.amountBs, 0)
  );
  const totalOwnerWithdrawalsUSD = round2(shiftOwnerWithdrawalExpenses.reduce((acc, e) => acc + e.amountUSD, 0));
  const totalOwnerWithdrawalsBs = round2(shiftOwnerWithdrawalExpenses.reduce((acc, e) => acc + e.amountBs, 0));
  const hasOwnerDisbursements =
    totalOwnerSalaryUSD > 0 ||
    totalOwnerSalaryBs > 0 ||
    totalOwnerWithdrawalsUSD > 0 ||
    totalOwnerWithdrawalsBs > 0;

  // Outflow in cash (expenses + credit note refunds in cash)
  const cashUsdOutflow = round2(
    shiftExpenses.filter(e => e.paymentMethod === 'efectivo_usd').reduce((acc, e) => acc + e.amountUSD, 0) +
    shiftCreditNotes.filter(cn => cn.refundMethod === 'efectivo_usd').reduce((acc, cn) => acc + cn.totalUSD, 0)
  );
  const cashBsOutflow = round2(
    shiftExpenses.filter(e => e.paymentMethod === 'efectivo_bs').reduce((acc, e) => acc + e.amountBs, 0) +
    shiftCreditNotes.filter(cn => cn.refundMethod === 'efectivo_bs').reduce((acc, cn) => acc + cn.totalBs, 0)
  );

  const regularCashUsdOutflow = round2(Math.max(0, cashUsdOutflow - ownerSalaryCashUSD - ownerWithdrawalsCashUSD));
  const regularCashBsOutflow = round2(Math.max(0, cashBsOutflow - ownerSalaryCashBs - ownerWithdrawalsCashBs));

  const initialUSD = cashShift.initialCashUSD || 0;
  const initialBs = cashShift.initialCashBs || 0;

  const expectedUSD = round2(initialUSD + cashUsdInflow - cashUsdOutflow);
  const expectedBs = round2(initialBs + cashBsInflow - cashBsOutflow);

  const parsedCountedUSD = round2(parseFloat(countedUSD) || 0);
  const parsedCountedBs = round2(parseFloat(countedBs) || 0);

  const hasEnteredCounts = countedUSD !== '' || countedBs !== '';
  const diffUSD = round2(parsedCountedUSD - expectedUSD);
  const diffBs = round2(parsedCountedBs - expectedBs);

  const handleCopyExpected = () => {
    setCountedUSD(expectedUSD.toFixed(2));
    setCountedBs(expectedBs.toFixed(2));
  };

  const buildCountedBanksList = () => {
    if (!cashShift.initialBanks) return undefined;
    return cashShift.initialBanks.map(b => {
      const entry = countedBanks[b.bankId];
      const summary = bankSummaries.find(s => s.bankId === b.bankId);
      const expectedBsVal = summary ? summary.expectedBalanceBs : b.initialBalanceBs;
      const expectedUsdVal = summary ? summary.expectedBalanceUSD : (b.initialBalanceUSD || 0);
      return {
        ...b,
        outflowsBs: summary ? summary.outflowsBs : 0,
        outflowsUSD: summary ? summary.outflowsUSD : 0,
        expectedBalanceBs: expectedBsVal,
        expectedBalanceUSD: expectedUsdVal,
        countedBalanceBs: entry?.countedBs !== '' && entry?.countedBs !== undefined 
          ? round2(parseFloat(entry.countedBs) || 0) 
          : expectedBsVal,
        countedBalanceUSD: entry?.countedUSD !== '' && entry?.countedUSD !== undefined 
          ? round2(parseFloat(entry.countedUSD) || 0) 
          : expectedUsdVal
      };
    });
  };

  const handlePrintZ = () => {
    generateReporteZPDF(shiftSales, shiftExpenses, bcvRate, businessInfo);
  };

  const handleSaveClosingPDF = () => {
    const shiftForReport = {
      ...cashShift,
      closedAt: new Date().toISOString(),
      closedDateFormatted: new Date().toLocaleString('es-VE'),
      expectedCashUSD: expectedUSD,
      expectedCashBs: expectedBs,
      countedCashUSD: parsedCountedUSD,
      countedCashBs: parsedCountedBs,
      differenceUSD: diffUSD,
      differenceBs: diffBs,
      totalOwnerSalaryUSD,
      totalOwnerSalaryBs,
      totalOwnerWithdrawalsUSD,
      totalOwnerWithdrawalsBs,
      closedNotes: closedNotes.trim(),
      initialBanks: buildCountedBanksList()
    };
    generateComprobanteCierrePDF(shiftForReport, shiftSales, shiftExpenses, bcvRate, businessInfo, 'save');
  };

  const handlePrintClosingPDF = () => {
    const shiftForReport = {
      ...cashShift,
      closedAt: new Date().toISOString(),
      closedDateFormatted: new Date().toLocaleString('es-VE'),
      expectedCashUSD: expectedUSD,
      expectedCashBs: expectedBs,
      countedCashUSD: parsedCountedUSD,
      countedCashBs: parsedCountedBs,
      differenceUSD: diffUSD,
      differenceBs: diffBs,
      totalOwnerSalaryUSD,
      totalOwnerSalaryBs,
      totalOwnerWithdrawalsUSD,
      totalOwnerWithdrawalsBs,
      closedNotes: closedNotes.trim(),
      initialBanks: buildCountedBanksList()
    };
    generateComprobanteCierrePDF(shiftForReport, shiftSales, shiftExpenses, bcvRate, businessInfo, 'print');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const finalBanks = buildCountedBanksList();
      await closeCashShift(parsedCountedUSD, parsedCountedBs, closedNotes.trim(), finalBanks);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo cerrar la caja en Cloud Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Lock className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">
                  Cierre de Caja del Día
                </h3>
                <span className="text-[10px] font-black uppercase bg-indigo-500/80 text-white px-2 py-0.5 rounded-full">
                  Fin de Turno
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Arqueo de efectivo y balance final de la jornada comercial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCierreModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-extrabold text-slate-900">
              ¡Caja Cerrada Exitosamente!
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              La jornada ha concluido y el arqueo ha quedado registrado. Puedes imprimir o guardar el comprobante formal ahora:
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSaveClosingPDF}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Guardar Reporte en PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrintClosingPDF}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Reporte de Cierre</span>
              </button>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setIsCierreModalOpen(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
              >
                Finalizar y cerrar ventana
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            
            {/* Shift Info Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">APERTURA DE TURNO:</span>
                <span className="font-extrabold text-slate-900">{cashShift.openedDateFormatted}</span>
                <span className="text-slate-400 ml-1.5 font-medium">({cashShift.openedBy || 'Admin'})</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] font-semibold">TASA BCV APLICADA:</span>
                <span className="font-extrabold text-orange-800 font-mono">Bs. {formatBs(bcvRate)}</span>
              </div>
            </div>

            {/* Breakdown Card: Theoretical Expected Cash */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 rounded-2xl p-4 border border-indigo-100/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Efectivo Teórico Esperado en Caja
                </span>
                <button
                  type="button"
                  onClick={handleCopyExpected}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  title="Copiar montos calculados al arqueo si coinciden exactamente"
                >
                  Usar montos calculados
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Expected USD */}
                <div className="bg-white rounded-xl p-3 border border-indigo-200/60 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500">Dólares en Caja ($)</div>
                  <div className="text-xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                    ${formatUSD(expectedUSD)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5 border-t border-slate-100 pt-1 font-mono">
                    <div>Base: +${formatUSD(initialUSD)}</div>
                    <div className="text-emerald-700">
                      Ingresos: +${formatUSD(cashUsdInflow)}
                      {loansCashUsd > 0 ? ` (Prést: +$${formatUSD(loansCashUsd)})` : ''}
                    </div>
                    <div className="text-rose-600">Egresos/NC: -${formatUSD(regularCashUsdOutflow)}</div>
                    {ownerSalaryCashUSD > 0 && (
                      <div className="text-indigo-700 font-semibold">Sueldo Prop.: -${formatUSD(ownerSalaryCashUSD)}</div>
                    )}
                    {ownerWithdrawalsCashUSD > 0 && (
                      <div className="text-purple-700 font-semibold">Retiro Pers.: -${formatUSD(ownerWithdrawalsCashUSD)}</div>
                    )}
                  </div>
                </div>

                {/* Expected Bs */}
                <div className="bg-white rounded-xl p-3 border border-indigo-200/60 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500">Bolívares en Caja (Bs.)</div>
                  <div className="text-xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                    Bs {formatBs(expectedBs)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5 border-t border-slate-100 pt-1 font-mono">
                    <div>Base: +Bs {formatBs(initialBs)}</div>
                    <div className="text-emerald-700">
                      Ingresos: +Bs {formatBs(cashBsInflow)}
                      {loansCashBs > 0 ? ` (Prést: +Bs ${formatBs(loansCashBs)})` : ''}
                    </div>
                    <div className="text-rose-600">Egresos/NC: -Bs {formatBs(regularCashBsOutflow)}</div>
                    {ownerSalaryCashBs > 0 && (
                      <div className="text-indigo-700 font-semibold">Sueldo Prop.: -Bs {formatBs(ownerSalaryCashBs)}</div>
                    )}
                    {ownerWithdrawalsCashBs > 0 && (
                      <div className="text-purple-700 font-semibold">Retiro Pers.: -Bs {formatBs(ownerWithdrawalsCashBs)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dedicated Traceability Card: Sueldo Propietario & Retiros Personales del Turno */}
            {hasOwnerDisbursements && (
              <div className="bg-purple-50/70 rounded-2xl p-3.5 border border-purple-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-purple-600" />
                    Sueldo Propietario y Retiros Personales del Turno
                  </span>
                  <span className="text-[10px] font-bold text-purple-700 bg-white border border-purple-200 px-2 py-0.5 rounded-md">
                    Excluidos de Libro de Compras SENIAT
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(totalOwnerSalaryUSD > 0 || totalOwnerSalaryBs > 0) && (
                    <div className="bg-white rounded-xl p-2.5 border border-indigo-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-indigo-900">Sueldo Propietario / Nómina</span>
                        <span className="text-[9px] font-bold uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Gasto Operativo</span>
                      </div>
                      <div className="font-mono font-black text-slate-900">
                        ${formatUSD(totalOwnerSalaryUSD)} <span className="text-xs font-semibold text-slate-500">(Bs {formatBs(totalOwnerSalaryBs)})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {ownerSalaryCashUSD > 0 ? `Gaveta USD: $${formatUSD(ownerSalaryCashUSD)} ` : ''}
                        {ownerSalaryCashBs > 0 ? `Gaveta Bs: ${formatBs(ownerSalaryCashBs)} ` : ''}
                        {ownerSalaryBankBs > 0 ? `Banco: Bs ${formatBs(ownerSalaryBankBs)}` : ''}
                      </div>
                    </div>
                  )}

                  {(totalOwnerWithdrawalsUSD > 0 || totalOwnerWithdrawalsBs > 0) && (
                    <div className="bg-white rounded-xl p-2.5 border border-purple-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-purple-900">Retiro Personal / Dueño</span>
                        <span className="text-[9px] font-bold uppercase text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Fuera de Costos</span>
                      </div>
                      <div className="font-mono font-black text-slate-900">
                        ${formatUSD(totalOwnerWithdrawalsUSD)} <span className="text-xs font-semibold text-slate-500">(Bs {formatBs(totalOwnerWithdrawalsBs)})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {ownerWithdrawalsCashUSD > 0 ? `Gaveta USD: $${formatUSD(ownerWithdrawalsCashUSD)} ` : ''}
                        {ownerWithdrawalsCashBs > 0 ? `Gaveta Bs: ${formatBs(ownerWithdrawalsCashBs)} ` : ''}
                        {ownerWithdrawalsBankBs > 0 ? `Banco: Bs ${formatBs(ownerWithdrawalsBankBs)}` : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Breakdown Card: Cuentas Bancarias Registradas & Arqueo Bancario */}
            {cashShift.initialBanks && cashShift.initialBanks.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    Arqueo de Saldos en Cuentas Bancarias
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated: Record<string, { countedBs: string; countedUSD: string }> = {};
                      cashShift.initialBanks?.forEach(b => {
                        const summary = bankSummaries.find(s => s.bankId === b.bankId);
                        const expBs = summary ? summary.expectedBalanceBs : b.initialBalanceBs;
                        const expUsd = summary ? summary.expectedBalanceUSD : (b.initialBalanceUSD || 0);
                        updated[b.bankId] = {
                          countedBs: round2(expBs).toFixed(2),
                          countedUSD: expUsd > 0 ? round2(expUsd).toFixed(2) : ''
                        };
                      });
                      setCountedBanks(updated);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Usar saldos esperados
                  </button>
                </div>

                <div className="space-y-2.5">
                  {cashShift.initialBanks.map(bk => {
                    const currentEntry = countedBanks[bk.bankId] || { countedBs: '', countedUSD: '' };
                    const summary = bankSummaries.find(s => s.bankId === bk.bankId);
                    const expectedBankBs = summary ? summary.expectedBalanceBs : bk.initialBalanceBs;
                    const parsedBs = round2(parseFloat(currentEntry.countedBs) || 0);
                    const diffBankBs = round2(parsedBs - expectedBankBs);

                    return (
                      <div key={bk.bankId} className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{bk.bankName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{bk.accountNumber}</div>
                          </div>
                          <div className="text-right text-[10px] font-mono text-slate-600 shrink-0 space-y-0.5">
                            <div>Inicial: <span className="font-bold text-slate-800">Bs {formatBs(bk.initialBalanceBs)}</span></div>
                            {summary && summary.inflowsBs > 0 && (
                              <div className="text-emerald-700">+Ingresos: Bs {formatBs(summary.inflowsBs)}</div>
                            )}
                            {summary && summary.outflowsBs > 0 && (
                              <div className="text-rose-600">
                                -Egresos: Bs {formatBs(summary.outflowsBs)}
                                {(summary.ownerSalaryBs > 0 || summary.ownerWithdrawalsBs > 0) && (
                                  <span className="text-purple-700 font-semibold">
                                    {' '}(
                                    {summary.ownerSalaryBs > 0 ? `Sueldo Bs ${formatBs(summary.ownerSalaryBs)}` : ''}
                                    {summary.ownerSalaryBs > 0 && summary.ownerWithdrawalsBs > 0 ? ' · ' : ''}
                                    {summary.ownerWithdrawalsBs > 0 ? `Retiro Bs ${formatBs(summary.ownerWithdrawalsBs)}` : ''}
                                    )
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-blue-800 font-extrabold">
                              Esperado: Bs {formatBs(expectedBankBs)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Saldo Final Contado (Bs.)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={expectedBankBs.toFixed(2)}
                              value={currentEntry.countedBs}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCountedBanks(prev => ({
                                  ...prev,
                                  [bk.bankId]: {
                                    ...prev[bk.bankId],
                                    countedBs: val
                                  }
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                            />
                            {currentEntry.countedBs !== '' && (
                              <div className={`text-[10px] font-mono mt-0.5 ${diffBankBs === 0 ? 'text-emerald-700 font-semibold' : diffBankBs > 0 ? 'text-blue-700 font-semibold' : 'text-rose-600 font-semibold'}`}>
                                {diffBankBs === 0 ? '✓ Coincide con saldo esperado' : diffBankBs > 0 ? `+ Bs ${formatBs(diffBankBs)} vs esperado` : `- Bs ${formatBs(Math.abs(diffBankBs))} vs esperado`}
                              </div>
                            )}
                          </div>

                          {bk.initialBalanceUSD !== undefined && bk.initialBalanceUSD > 0 && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                Saldo Final Contado ($ USD)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={(summary ? summary.expectedBalanceUSD : bk.initialBalanceUSD).toFixed(2)}
                                value={currentEntry.countedUSD}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCountedBanks(prev => ({
                                    ...prev,
                                    [bk.bankId]: {
                                      ...prev[bk.bankId],
                                      countedUSD: val
                                    }
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section: Arqueo de Caja (Conteo real) */}
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Arqueo de Efectivo Físico en Gaveta
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Counted USD */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Efectivo Contado ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={expectedUSD.toFixed(2)}
                    value={countedUSD}
                    onChange={(e) => setCountedUSD(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                    autoFocus
                  />
                  {hasEnteredCounts && (
                    <div className={`text-[11px] font-bold mt-1 flex items-center gap-1 font-mono ${
                      diffUSD === 0 ? 'text-emerald-600' : diffUSD > 0 ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {diffUSD === 0 ? '✓ Cuadre exacto en USD' : diffUSD > 0 ? `+ Sobrante: $${formatUSD(diffUSD)}` : `- Faltante: $${formatUSD(Math.abs(diffUSD))}`}
                    </div>
                  )}
                </div>

                {/* Counted Bs */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-blue-600" />
                    Efectivo Contado (Bs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={expectedBs.toFixed(2)}
                    value={countedBs}
                    onChange={(e) => setCountedBs(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                  {hasEnteredCounts && (
                    <div className={`text-[11px] font-bold mt-1 flex items-center gap-1 font-mono ${
                      diffBs === 0 ? 'text-emerald-600' : diffBs > 0 ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {diffBs === 0 ? '✓ Cuadre exacto en Bs' : diffBs > 0 ? `+ Sobrante: Bs ${formatBs(diffBs)}` : `- Faltante: Bs ${formatBs(Math.abs(diffBs))}`}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1 pt-1">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Observaciones del Cierre (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Cuadre verificado con Daniel, gaveta entregada..."
                value={closedNotes}
                onChange={(e) => setClosedNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Print & View Cuadre buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveClosingPDF}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Descargar acta de cierre en PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>Reporte Cierre PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintZ}
                  className="text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Reporte Z SENIAT</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCierreModalOpen(false);
                  setIsCuadreModalOpen(true);
                }}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ver desglose por método</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsCierreModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Cerrando Caja...' : 'Confirmar Cierre de Caja'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
