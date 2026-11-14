import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Lock, 
  DollarSign, 
  Coins, 
  Calendar, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  ShieldCheck, 
  ArrowRight,
  FileText,
  Calculator,
  Receipt,
  Download,
  Landmark
} from 'lucide-react';
import { formatBs, formatUSD, round2 } from '../../utils/exportUtils';
import { generateReporteZPDF, generateComprobanteCierrePDF } from '../../utils/pdfReceiptUtils';

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
    bcvRate, 
    businessInfo,
    setIsCuadreModalOpen
  } = useApp();

  const [countedUSD, setCountedUSD] = useState<string>('');
  const [countedBs, setCountedBs] = useState<string>('');
  const [closedNotes, setClosedNotes] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Bank closing balance capture
  const [countedBanks, setCountedBanks] = useState<Record<string, { countedBs: string; countedUSD: string }>>(() => {
    const map: Record<string, { countedBs: string; countedUSD: string }> = {};
    if (cashShift?.initialBanks) {
      cashShift.initialBanks.forEach(b => {
        map[b.bankId] = {
          countedBs: b.countedBalanceBs !== undefined ? b.countedBalanceBs.toString() : b.initialBalanceBs.toString(),
          countedUSD: b.countedBalanceUSD !== undefined ? b.countedBalanceUSD.toString() : (b.initialBalanceUSD ? b.initialBalanceUSD.toString() : '')
        };
      });
    }
    return map;
  });

  if (!isCierreModalOpen || !cashShift) return null;

  const openedAtIso = cashShift.openedAt;
  const shiftSales = sales.filter(s => s.status !== 'anulada' && s.date >= openedAtIso);
  const shiftExpenses = expenses.filter(e => e.date >= openedAtIso && e.paymentMethod !== 'credito');
  const shiftCreditNotes = creditNotes.filter(cn => cn.date >= openedAtIso);
  const shiftFiadoAbonos = fiados.flatMap(f => f.abonos || []).filter(a => a.date >= openedAtIso);

  // Inflow in cash (sales + fiado abonos in cash)
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

  // Outflow in cash (expenses + credit note refunds in cash)
  const cashUsdOutflow = round2(
    shiftExpenses.filter(e => e.paymentMethod === 'efectivo_usd').reduce((acc, e) => acc + e.amountUSD, 0) +
    shiftCreditNotes.filter(cn => cn.refundMethod === 'efectivo_usd').reduce((acc, cn) => acc + cn.totalUSD, 0)
  );
  const cashBsOutflow = round2(
    shiftExpenses.filter(e => e.paymentMethod === 'efectivo_bs').reduce((acc, e) => acc + e.amountBs, 0) +
    shiftCreditNotes.filter(cn => cn.refundMethod === 'efectivo_bs').reduce((acc, cn) => acc + cn.totalBs, 0)
  );

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
      return {
        ...b,
        countedBalanceBs: entry?.countedBs !== '' && entry?.countedBs !== undefined 
          ? parseFloat(entry.countedBs) || 0 
          : b.initialBalanceBs,
        countedBalanceUSD: entry?.countedUSD !== '' && entry?.countedUSD !== undefined 
          ? parseFloat(entry.countedUSD) || 0 
          : (b.initialBalanceUSD || 0)
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
      closedNotes: closedNotes.trim(),
      initialBanks: buildCountedBanksList()
    };
    generateComprobanteCierrePDF(shiftForReport, shiftSales, shiftExpenses, bcvRate, businessInfo, 'print');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBanks = buildCountedBanksList();
    closeCashShift(parsedCountedUSD, parsedCountedBs, closedNotes.trim(), finalBanks);
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-start justify-between">
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
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            
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
                    <div className="text-emerald-700">Ingresos: +${formatUSD(cashUsdInflow)}</div>
                    <div className="text-rose-600">Egresos/NC: -${formatUSD(cashUsdOutflow)}</div>
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
                    <div className="text-emerald-700">Ingresos: +Bs {formatBs(cashBsInflow)}</div>
                    <div className="text-rose-600">Egresos/NC: -Bs {formatBs(cashBsOutflow)}</div>
                  </div>
                </div>
              </div>
            </div>

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
                        updated[b.bankId] = {
                          countedBs: b.initialBalanceBs.toString(),
                          countedUSD: b.initialBalanceUSD ? b.initialBalanceUSD.toString() : ''
                        };
                      });
                      setCountedBanks(updated);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Mantener saldos iniciales
                  </button>
                </div>

                <div className="space-y-2.5">
                  {cashShift.initialBanks.map(bk => {
                    const currentEntry = countedBanks[bk.bankId] || { countedBs: '', countedUSD: '' };
                    const parsedBs = parseFloat(currentEntry.countedBs) || 0;
                    const diffBankBs = Number((parsedBs - bk.initialBalanceBs).toFixed(2));

                    return (
                      <div key={bk.bankId} className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{bk.bankName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{bk.accountNumber}</div>
                          </div>
                          <div className="text-right text-[11px] font-mono text-slate-500">
                            <span>Inicial: </span>
                            <span className="font-bold text-slate-800">Bs {formatBs(bk.initialBalanceBs)}</span>
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
                              placeholder={bk.initialBalanceBs.toFixed(2)}
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
                              <div className={`text-[10px] font-mono mt-0.5 ${diffBankBs >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}`}>
                                {diffBankBs === 0 ? '✓ Mismo saldo inicial' : diffBankBs > 0 ? `+ Bs ${formatBs(diffBankBs)}` : `- Bs ${formatBs(Math.abs(diffBankBs))}`}
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
                                placeholder={bk.initialBalanceUSD.toFixed(2)}
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

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCierreModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Volver
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Lock className="w-4 h-4" />
                <span>Confirmar Cierre de Caja</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
