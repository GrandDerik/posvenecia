import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  KeyRound, 
  DollarSign, 
  Coins, 
  Calendar, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  Store, 
  ShieldCheck, 
  AlertCircle,
  AlertTriangle,
  FileText,
  Landmark,
  CreditCard,
  RefreshCw,
  History
} from 'lucide-react';
import { formatBs, formatUSD, round2 } from '../../utils/exportUtils';
import { BankInitialBalance, CashOpeningAuditMeta, CashOpeningDifferenceReason } from '../../types';
import {
  isExpenseOwnerSalary,
  isExpenseOwnerWithdrawal,
  isOwnerSalaryCategory,
  isOwnerWithdrawalCategory
} from '../../utils/accountingUtils';

const OPENING_DIFF_REASONS: CashOpeningDifferenceReason[] = [
  'Retiro / Adelanto al Socio',
  'Sueldo / Nómina',
  'Resguardo / Caja Fuerte',
  'Diferencia de Conteo / Faltante',
  'Pago/gasto fuera de turno',
  'Observación de apertura'
];

interface BetweenShiftCashOutflow {
  id: string;
  date: string;
  category: string;
  description: string;
  paymentMethod: 'efectivo_usd' | 'efectivo_bs';
  amountUSD: number;
  amountBs: number;
  isOwnerWithdrawal: boolean;
  isOwnerSalary: boolean;
}

const formatExactInputNumber = (value: number): string => {
  const clean = round2(Math.max(0, Number(value) || 0));
  return Number.isInteger(clean) ? String(clean) : clean.toFixed(2);
};

export const AperturaCajaModal: React.FC = () => {
  const { 
    isAperturaModalOpen, 
    setIsAperturaModalOpen, 
    openCashShift, 
    cashShiftHistory,
    expenses,
    gastosOperativos,
    treasuryMovements,
    bcvRate, 
    bcvEuroRate,
    isBcvRateUpdatedToday,
    fetchLiveRate,
    fetchLiveEuroRate,
    isFetchingLiveRate,
    updateBcvRate,
    isOnline,
    googleUser,
    businessInfo,
    setIsProfileModalOpen
  } = useApp();

  const [initialUSD, setInitialUSD] = useState<string>('');
  const [initialBs, setInitialBs] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [openingDiffReason, setOpeningDiffReason] = useState<CashOpeningDifferenceReason | ''>('');
  const [openingDiffNotes, setOpeningDiffNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualRateInput, setManualRateInput] = useState<string>('');
  const [bcvSyncFeedback, setBcvSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const hasAttemptedAutoSyncRef = useRef(false);

  // Bank balances map: key -> { balanceBs, balanceUSD }
  const [bankBalances, setBankBalances] = useState<Record<string, { balanceBs: string; balanceUSD: string }>>({});

  const configuredBanks = businessInfo.bankAccounts || [];

  // Most recent closed shift to compare physical cash continuity (independent USD and Bs)
  const lastClosedShift = useMemo(() => {
    const closed = cashShiftHistory.filter(
      (s) => !s.isOpen && (s.closedAt || typeof s.countedCashUSD === 'number' || typeof s.countedCashBs === 'number')
    );
    if (closed.length === 0) return null;
    return [...closed].sort((a, b) => {
      const tA = new Date(a.closedAt || a.openedAt).getTime();
      const tB = new Date(b.closedAt || b.openedAt).getTime();
      return tB - tA;
    })[0];
  }, [cashShiftHistory]);

  const lastCloseUSD = useMemo(
    () => (lastClosedShift ? round2(lastClosedShift.countedCashUSD ?? lastClosedShift.expectedCashUSD ?? 0) : 0),
    [lastClosedShift]
  );

  const lastCloseBs = useMemo(
    () => (lastClosedShift ? round2(lastClosedShift.countedCashBs ?? lastClosedShift.expectedCashBs ?? 0) : 0),
    [lastClosedShift]
  );

  const parsedInitialUSD = round2(Math.max(0, parseFloat(initialUSD) || 0));
  const parsedInitialBs = round2(Math.max(0, parseFloat(initialBs) || 0));

  // Independent exact differences per currency — zero inverse USD<->Bs conversion
  const openingDiffUSD = lastClosedShift ? round2(parsedInitialUSD - lastCloseUSD) : 0;
  const openingDiffBs = lastClosedShift ? round2(parsedInitialBs - lastCloseBs) : 0;
  const hasUsdDiff = Boolean(lastClosedShift && Math.abs(openingDiffUSD) >= 0.01);
  const hasBsDiff = Boolean(lastClosedShift && Math.abs(openingDiffBs) >= 0.01);
  const hasOpeningDifference = hasUsdDiff || hasBsDiff;

  // Cross-check cash outflows registered AFTER the previous close (retiros personales, sueldos, pagos en efectivo)
  const recentBetweenShiftCashOutflows = useMemo<BetweenShiftCashOutflow[]>(() => {
    if (!lastClosedShift) return [];
    const lastCloseMs = new Date(lastClosedShift.closedAt || lastClosedShift.openedAt).getTime();
    if (Number.isNaN(lastCloseMs)) return [];

    const items: BetweenShiftCashOutflow[] = [];

    const afterCloseExpenses = expenses.filter((e) => {
      if (e.paymentMethod !== 'efectivo_usd' && e.paymentMethod !== 'efectivo_bs') return false;
      const ms = new Date(e.date).getTime();
      return !Number.isNaN(ms) && ms > lastCloseMs;
    });

    afterCloseExpenses.forEach((e) => {
      items.push({
        id: e.id,
        date: e.date,
        category: e.category,
        description: e.description || e.category,
        paymentMethod: e.paymentMethod as 'efectivo_usd' | 'efectivo_bs',
        amountUSD: e.paymentMethod === 'efectivo_usd' ? round2(e.amountUSD || 0) : 0,
        amountBs: e.paymentMethod === 'efectivo_bs' ? round2(e.amountBs || 0) : 0,
        isOwnerWithdrawal: isExpenseOwnerWithdrawal(e),
        isOwnerSalary: isExpenseOwnerSalary(e)
      });
    });

    // Also inspect gastosOperativos abonos in case any cash abono isn't mirrored in expenses
    gastosOperativos.forEach((g) => {
      (g.abonos || []).forEach((ab) => {
        if (ab.paymentMethod !== 'efectivo_usd' && ab.paymentMethod !== 'efectivo_bs') return;
        const ms = new Date(ab.date).getTime();
        if (Number.isNaN(ms) || ms <= lastCloseMs) return;

        const alreadyLinked = afterCloseExpenses.some((e) => {
          if (e.linkedGastoId !== g.id || e.paymentMethod !== ab.paymentMethod) return false;
          const diff = ab.paymentMethod === 'efectivo_usd'
            ? Math.abs((e.amountUSD || 0) - (ab.amountUSD || 0))
            : Math.abs((e.amountBs || 0) - (ab.amountBs || 0));
          return diff < 0.05;
        });

        if (!alreadyLinked) {
          items.push({
            id: `${g.id}_${ab.id}`,
            date: ab.date,
            category: g.category,
            description: g.concept || g.category,
            paymentMethod: ab.paymentMethod,
            amountUSD: ab.paymentMethod === 'efectivo_usd' ? round2(ab.amountUSD || 0) : 0,
            amountBs: ab.paymentMethod === 'efectivo_bs' ? round2(ab.amountBs || 0) : 0,
            isOwnerWithdrawal: isOwnerWithdrawalCategory(g.category),
            isOwnerSalary: isOwnerSalaryCategory(g.category)
          });
        }
      });
    });

    // Also inspect outgoing Treasury transfers/adjustments from cash_usd / cash_bs (e.g. bank deposits / resguardo)
    treasuryMovements.forEach((tm) => {
      if (tm.direction !== 'out') return;
      if (tm.accountId !== 'cash_usd' && tm.accountId !== 'cash_bs') return;
      if (tm.type !== 'transferencia' && tm.type !== 'ajuste_inicial') return;
      const ms = new Date(tm.date).getTime();
      if (Number.isNaN(ms) || ms <= lastCloseMs) return;
      items.push({
        id: `tmov_${tm.id}`,
        date: tm.date,
        category: tm.type === 'transferencia' ? 'Transferencia / Depósito Bancario' : 'Ajuste de Tesorería',
        description: tm.concept || (tm.type === 'transferencia' ? 'Transferencia desde caja a banco' : 'Ajuste de saldo en efectivo'),
        paymentMethod: tm.accountId === 'cash_usd' ? 'efectivo_usd' : 'efectivo_bs',
        amountUSD: tm.accountId === 'cash_usd' ? round2(tm.amount || 0) : 0,
        amountBs: tm.accountId === 'cash_bs' ? round2(tm.amount || 0) : 0,
        isOwnerWithdrawal: false,
        isOwnerSalary: false
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [lastClosedShift, expenses, gastosOperativos, treasuryMovements]);

  const isUsdLower = Boolean(lastClosedShift && openingDiffUSD <= -0.01);
  const isBsLower = Boolean(lastClosedShift && openingDiffBs <= -0.01);
  const isOpeningLower = isUsdLower || isBsLower;

  const shortfallUSD = isUsdLower ? round2(Math.abs(openingDiffUSD)) : 0;
  const shortfallBs = isBsLower ? round2(Math.abs(openingDiffBs)) : 0;

  const registeredOutflowsUSD = round2(recentBetweenShiftCashOutflows.reduce((s, m) => s + m.amountUSD, 0));
  const registeredOutflowsBs = round2(recentBetweenShiftCashOutflows.reduce((s, m) => s + m.amountBs, 0));

  const matchedOutflowsUSD = round2(Math.min(shortfallUSD, registeredOutflowsUSD));
  const matchedOutflowsBs = round2(Math.min(shortfallBs, registeredOutflowsBs));

  const unexplainedShortfallUSD = round2(Math.max(0, shortfallUSD - registeredOutflowsUSD));
  const unexplainedShortfallBs = round2(Math.max(0, shortfallBs - registeredOutflowsBs));

  const hasRegisteredSupport = isOpeningLower && (matchedOutflowsUSD >= 0.01 || matchedOutflowsBs >= 0.01);
  const isFullyExplainedByMovements =
    hasRegisteredSupport && unexplainedShortfallUSD < 0.01 && unexplainedShortfallBs < 0.01;

  // Initialize or reset bank balance fields + auto-sync daily BCV rate if stale on modal open
  useEffect(() => {
    if (isAperturaModalOpen) {
      setErrorMsg(null);
      setIsSubmitting(false);
      setOpeningDiffReason('');
      setOpeningDiffNotes('');
      const initialMap: Record<string, { balanceBs: string; balanceUSD: string }> = {};
      if (configuredBanks.length > 0) {
        configuredBanks.forEach(bk => {
          initialMap[bk.id] = { balanceBs: '', balanceUSD: '' };
        });
      } else if (businessInfo.pagoMovilBank) {
        initialMap['default-pm'] = { balanceBs: '', balanceUSD: '' };
      }
      setBankBalances(initialMap);
      setManualRateInput(bcvRate > 0 ? bcvRate.toFixed(2) : '');

      if (!isBcvRateUpdatedToday && isOnline && !hasAttemptedAutoSyncRef.current) {
        hasAttemptedAutoSyncRef.current = true;
        setBcvSyncFeedback(null);
        Promise.allSettled([fetchLiveRate(), fetchLiveEuroRate()])
          .then((results) => {
            const usdRes = results[0];
            if (usdRes.status === 'fulfilled') {
              setManualRateInput(usdRes.value.toFixed(2));
              setBcvSyncFeedback({
                type: 'success',
                text: `Tasa oficial BCV sincronizada automáticamente: Bs. ${formatBs(usdRes.value)}`
              });
            } else {
              setBcvSyncFeedback({
                type: 'error',
                text: 'No se pudo consultar la tasa BCV automáticamente. Puedes reintentar o ingresarla manualmente.'
              });
            }
          });
      }
    } else {
      hasAttemptedAutoSyncRef.current = false;
      setBcvSyncFeedback(null);
    }
  }, [isAperturaModalOpen, configuredBanks.length, businessInfo.pagoMovilBank]);

  useEffect(() => {
    if (isAperturaModalOpen && bcvRate > 0) {
      setManualRateInput(bcvRate.toFixed(2));
    }
  }, [bcvRate, isAperturaModalOpen]);

  if (!isAperturaModalOpen) return null;

  const todayDateStr = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const nowTimeStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const handleQuickBaseUSD = (val: number) => {
    setInitialUSD(val.toString());
  };

  const handleCopyLastCloseAmounts = () => {
    if (!lastClosedShift) return;
    setInitialUSD(formatExactInputNumber(lastCloseUSD));
    setInitialBs(formatExactInputNumber(lastCloseBs));
    setErrorMsg(null);
  };

  const handleApplyDetectedMovements = () => {
    if (recentBetweenShiftCashOutflows.length === 0) return;
    const hasWithdrawal = recentBetweenShiftCashOutflows.some((m) => m.isOwnerWithdrawal);
    const hasSalary = recentBetweenShiftCashOutflows.some((m) => m.isOwnerSalary);
    const hasVaultOrTransfer = recentBetweenShiftCashOutflows.some((m) => m.id.startsWith('tmov_'));
    const autoReason: CashOpeningDifferenceReason = hasWithdrawal
      ? 'Retiro / Adelanto al Socio'
      : hasSalary
        ? 'Sueldo / Nómina'
        : hasVaultOrTransfer
          ? 'Resguardo / Caja Fuerte'
          : 'Pago/gasto fuera de turno';
    setOpeningDiffReason(autoReason);

    const summaryParts = recentBetweenShiftCashOutflows.slice(0, 3).map((m) => {
      const amtStr = m.paymentMethod === 'efectivo_usd'
        ? `$${formatUSD(m.amountUSD)}`
        : `Bs ${formatBs(m.amountBs)}`;
      return `${m.category} (${amtStr})`;
    });
    const extraCount = recentBetweenShiftCashOutflows.length > 3
      ? ` +${recentBetweenShiftCashOutflows.length - 3} más`
      : '';
    setOpeningDiffNotes(`Respaldado por egresos registrados: ${summaryParts.join(', ')}${extraCount}`);
    setErrorMsg(null);
  };

  const handleBankBalanceChange = (id: string, field: 'balanceBs' | 'balanceUSD', val: string) => {
    setBankBalances(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const rawUsd = parseFloat(initialUSD);
    const rawBs = parseFloat(initialBs);

    if ((!isNaN(rawUsd) && rawUsd < 0) || (!isNaN(rawBs) && rawBs < 0)) {
      setErrorMsg('Los montos del fondo inicial no pueden ser negativos.');
      return;
    }

    const usd = round2(Math.max(0, isNaN(rawUsd) ? 0 : rawUsd));
    const bs = round2(Math.max(0, isNaN(rawBs) ? 0 : rawBs));

    if (hasOpeningDifference && !openingDiffReason && !openingDiffNotes.trim()) {
      setErrorMsg('Existe una diferencia respecto al último cierre. Selecciona un motivo o escribe una breve justificación de apertura.');
      return;
    }

    // Build initial bank balances array
    const initialBanksList: BankInitialBalance[] = [];
    if (configuredBanks.length > 0) {
      configuredBanks.forEach(bk => {
        const entry = bankBalances[bk.id];
        const bBs = round2(Math.max(0, parseFloat(entry?.balanceBs || '0') || 0));
        const bUsd = round2(Math.max(0, parseFloat(entry?.balanceUSD || '0') || 0));
        initialBanksList.push({
          bankId: bk.id,
          bankName: bk.bank,
          accountNumber: bk.accountNumber,
          initialBalanceBs: bBs,
          initialBalanceUSD: bUsd
        });
      });
    } else if (businessInfo.pagoMovilBank) {
      const entry = bankBalances['default-pm'];
      const bBs = round2(Math.max(0, parseFloat(entry?.balanceBs || '0') || 0));
      const bUsd = round2(Math.max(0, parseFloat(entry?.balanceUSD || '0') || 0));
      initialBanksList.push({
        bankId: 'default-pm',
        bankName: businessInfo.pagoMovilBank,
        accountNumber: businessInfo.pagoMovilPhone || 'Pago Móvil Principal',
        initialBalanceBs: bBs,
        initialBalanceUSD: bUsd
      });
    }

    const openingAudit: CashOpeningAuditMeta | undefined = lastClosedShift
      ? {
          previousShiftId: lastClosedShift.id,
          previousCloseDateFormatted: lastClosedShift.closedDateFormatted || lastClosedShift.openedDateFormatted,
          previousCloseCashUSD: lastCloseUSD,
          previousCloseCashBs: lastCloseBs,
          openingDifferenceUSD: round2(usd - lastCloseUSD),
          openingDifferenceBs: round2(bs - lastCloseBs),
          openingDifferenceReason: hasOpeningDifference ? (openingDiffReason || 'Observación de apertura') : undefined,
          openingDifferenceNotes: hasOpeningDifference && openingDiffNotes.trim() ? openingDiffNotes.trim() : undefined,
          openingMatchedOutflowsUSD: matchedOutflowsUSD > 0 ? matchedOutflowsUSD : undefined,
          openingMatchedOutflowsBs: matchedOutflowsBs > 0 ? matchedOutflowsBs : undefined,
          openingMatchedMovementsCount: hasRegisteredSupport ? recentBetweenShiftCashOutflows.length : undefined
        }
      : undefined;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await openCashShift(usd, bs, notes.trim(), initialBanksList, openingAudit);
      setInitialUSD('');
      setInitialBs('');
      setNotes('');
      setOpeningDiffReason('');
      setOpeningDiffNotes('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo abrir la caja en Cloud Firestore.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
              <KeyRound className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">
                  Apertura de Caja Diaria
                </h3>
                <span className="text-[10px] font-black uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full">
                  Nuevo Día
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Inicia la jornada comercial y establece tu fondo en efectivo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAperturaModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Date & BCV Rate Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 font-medium capitalize">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{todayDateStr}</span>
            <span className="text-slate-400">|</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">{nowTimeStr}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-100/80 px-2.5 py-0.5 rounded-full border border-orange-200">
            <TrendingUp className="w-3 h-3 text-orange-600" />
            <span>BCV: Bs. {formatBs(bcvRate)}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* User Responsible Banner */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Store className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Caja de: <strong>{businessInfo.name || 'PosVenecia'}</strong></span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
              Operador: {googleUser?.name?.split(' ')[0] || 'Administrador'}
            </div>
          </div>

          {/* Daily BCV Rate Sync & Verification Card */}
          <div
            className={`p-3 rounded-2xl border text-xs space-y-2 transition-colors ${
              isFetchingLiveRate
                ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                : isBcvRateUpdatedToday
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold">
                {isFetchingLiveRate ? (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                ) : isBcvRateUpdatedToday ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {isFetchingLiveRate
                    ? 'Sincronizando tasa oficial del BCV de hoy...'
                    : isBcvRateUpdatedToday
                      ? `Tasa BCV de hoy al día: Bs. ${formatBs(bcvRate)}`
                      : 'Tasa BCV del día aún no actualizada'}
                </span>
              </div>
              {bcvEuroRate > 0 && (
                <span className="text-[11px] font-mono font-semibold opacity-80">
                  EUR: Bs. {formatBs(bcvEuroRate)}
                </span>
              )}
            </div>

            {bcvSyncFeedback && (
              <p className={`text-[11px] font-semibold ${bcvSyncFeedback.type === 'success' ? 'text-emerald-800' : 'text-rose-700'}`}>
                {bcvSyncFeedback.text}
              </p>
            )}

            {!isBcvRateUpdatedToday && !isFetchingLiveRate && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!isOnline || isFetchingLiveRate}
                  onClick={async () => {
                    setBcvSyncFeedback(null);
                    try {
                      const newRate = await fetchLiveRate();
                      fetchLiveEuroRate().catch((err) => {
                        if (import.meta.env.DEV) console.warn('[AperturaCajaModal] Euro rate background sync skipped:', err);
                      });
                      setManualRateInput(newRate.toFixed(2));
                      setBcvSyncFeedback({
                        type: 'success',
                        text: `Tasa BCV actualizada: Bs. ${formatBs(newRate)}`
                      });
                    } catch {
                      setBcvSyncFeedback({
                        type: 'error',
                        text: 'Error al consultar tasa BCV en línea. Ingresa el valor manual.'
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sincronizar BCV Hoy</span>
                </button>

                <div className="flex items-center gap-1.5 flex-1">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Bs</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={manualRateInput}
                      onChange={(e) => setManualRateInput(e.target.value)}
                      placeholder="Ej. 52.40"
                      className="w-full pl-7 pr-2 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseFloat(manualRateInput);
                      if (!isNaN(parsed) && parsed > 0) {
                        updateBcvRate(parsed);
                        setBcvSyncFeedback({
                          type: 'success',
                          text: `Tasa manual guardada para hoy: Bs. ${formatBs(parsed)}`
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-[#0B1528] hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    Guardar Tasa
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Fondo Inicial en Efectivo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                Fondo de Caja Inicial (Base en Efectivo)
              </label>
              {lastClosedShift && (
                <button
                  type="button"
                  onClick={handleCopyLastCloseAmounts}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Usar último cierre
                </button>
              )}
            </div>

            {/* Previous Closing Reference Box */}
            {lastClosedShift && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    Último cierre registrado
                  </span>
                  <span className="text-slate-500 font-medium">
                    {lastClosedShift.closedDateFormatted || lastClosedShift.openedDateFormatted}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">Cierre USD:</span>
                    <span className="font-mono font-extrabold text-slate-900">${formatUSD(lastCloseUSD)}</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">Cierre Bs:</span>
                    <span className="font-mono font-extrabold text-slate-900">Bs. {formatBs(lastCloseBs)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* USD Cash Base Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Efectivo en Dólares ($ USD)
                </span>
                <span className="text-[11px] text-slate-400">Monto exacto en divisas</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={initialUSD}
                  onChange={(e) => setInitialUSD(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400">Base rápida:</span>
                {[0, 10, 20, 50, 100].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickBaseUSD(val)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Bs Cash Base Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-blue-600" />
                  Efectivo en Bolívares (Bs.)
                </span>
                <span className="text-[11px] text-slate-400">Independiente del monto en USD</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Bs</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={initialBs}
                  onChange={(e) => setInitialBs(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Opening Difference Detection & Audit Justification */}
            {hasOpeningDifference && lastClosedShift && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-3 text-xs animate-in fade-in">
                <div className="flex items-start gap-2 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-extrabold leading-snug">
                      Diferencia detectada respecto al último cierre de caja
                    </p>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      Indica brevemente qué ocurrió con esta variación para el registro interno de auditoría de caja.
                    </p>
                  </div>
                </div>

                {/* Independent Exact Variation Breakdown (USD & Bs) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className={`p-2.5 rounded-xl border ${hasUsdDiff ? 'bg-white border-amber-300' : 'bg-amber-50/50 border-amber-200/70'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block">
                      Variación en USD
                    </span>
                    <div className={`font-mono font-black text-sm mt-0.5 ${
                      !hasUsdDiff
                        ? 'text-emerald-700'
                        : openingDiffUSD > 0
                          ? 'text-blue-700'
                          : 'text-rose-700'
                    }`}>
                      {!hasUsdDiff
                        ? 'Sin variación ($0.00)'
                        : `${openingDiffUSD > 0 ? '+' : '-'}$${formatUSD(Math.abs(openingDiffUSD))}`}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Cierre: ${formatUSD(lastCloseUSD)} → Hoy: ${formatUSD(parsedInitialUSD)}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${hasBsDiff ? 'bg-white border-amber-300' : 'bg-amber-50/50 border-amber-200/70'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block">
                      Variación en Bolívares
                    </span>
                    <div className={`font-mono font-black text-sm mt-0.5 ${
                      !hasBsDiff
                        ? 'text-emerald-700'
                        : openingDiffBs > 0
                          ? 'text-blue-700'
                          : 'text-rose-700'
                    }`}>
                      {!hasBsDiff
                        ? 'Sin variación (Bs. 0,00)'
                        : `${openingDiffBs > 0 ? '+' : '-'}Bs. ${formatBs(Math.abs(openingDiffBs))}`}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Cierre: Bs. {formatBs(lastCloseBs)} → Hoy: Bs. {formatBs(parsedInitialBs)}
                    </span>
                  </div>
                </div>

                {/* Cross-check with recent between-shift cash withdrawals/outflows when opening is lower */}
                {isOpeningLower && (
                  <div
                    className={`p-3 rounded-xl border space-y-2 ${
                      isFullyExplainedByMovements
                        ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                        : hasRegisteredSupport
                          ? 'bg-blue-50/90 border-blue-300 text-blue-950'
                          : 'bg-rose-50/90 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-start gap-2">
                        {isFullyExplainedByMovements ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${hasRegisteredSupport ? 'text-blue-600' : 'text-rose-600'}`} />
                        )}
                        <div>
                          <p className="font-extrabold text-[11px] leading-snug">
                            {isFullyExplainedByMovements
                              ? 'Disminución respaldada por retiros / egresos ya registrados'
                              : hasRegisteredSupport
                                ? 'Disminución parcialmente respaldada — existe faltante sin movimiento registrado'
                                : 'Sin retiros ni pagos en efectivo registrados desde el último cierre'}
                          </p>
                          <p className="text-[10px] opacity-85 leading-snug mt-0.5">
                            {isFullyExplainedByMovements
                              ? 'El sistema detectó egresos de efectivo posteriores al último cierre que justifican esta diferencia.'
                              : hasRegisteredSupport
                                ? `Faltante sin movimiento registrado: ${unexplainedShortfallUSD >= 0.01 ? `$${formatUSD(unexplainedShortfallUSD)}` : ''}${unexplainedShortfallUSD >= 0.01 && unexplainedShortfallBs >= 0.01 ? ' y ' : ''}${unexplainedShortfallBs >= 0.01 ? `Bs. ${formatBs(unexplainedShortfallBs)}` : ''}.`
                                : 'No hay retiros personales, sueldos ni pagos en efectivo registrados tras el cierre anterior. Indica si fue resguardo, retiro pendiente por anotar o faltante de conteo.'}
                          </p>
                        </div>
                      </div>

                      {recentBetweenShiftCashOutflows.length > 0 && (
                        <button
                          type="button"
                          onClick={handleApplyDetectedMovements}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-extrabold cursor-pointer transition-colors shrink-0"
                        >
                          Aplicar como justificación
                        </button>
                      )}
                    </div>

                    {recentBetweenShiftCashOutflows.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-black/10">
                        <span className="block text-[10px] font-bold uppercase tracking-wide opacity-75">
                          Egresos de efectivo detectados tras el último cierre ({recentBetweenShiftCashOutflows.length}):
                        </span>
                        <div className="max-h-28 overflow-y-auto space-y-1">
                          {recentBetweenShiftCashOutflows.map((mov) => (
                            <div
                              key={mov.id}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/90 border border-black/10 text-[11px]"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 truncate block">{mov.category}</span>
                                <span className="text-[10px] text-slate-500 truncate block">{mov.description}</span>
                              </div>
                              <span className="font-mono font-extrabold text-rose-700 shrink-0">
                                {mov.paymentMethod === 'efectivo_usd'
                                  ? `-$${formatUSD(mov.amountUSD)}`
                                  : `-Bs. ${formatBs(mov.amountBs)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reason Selector */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-extrabold text-amber-950">
                    Motivo / Justificación de Apertura (Auditoría C.A.):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {OPENING_DIFF_REASONS.map((reason) => {
                      const active = openingDiffReason === reason;
                      const isShortageOption = reason === 'Diferencia de Conteo / Faltante';
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            setOpeningDiffReason(reason);
                            setErrorMsg(null);
                          }}
                          className={`px-2.5 py-2 rounded-xl border text-left text-[11px] font-bold transition-all cursor-pointer ${
                            active
                              ? isShortageOption
                                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                : 'bg-amber-600 text-white border-amber-700 shadow-xs'
                              : isShortageOption
                                ? 'bg-white hover:bg-rose-50 text-rose-900 border-rose-200'
                                : 'bg-white hover:bg-amber-100/70 text-amber-950 border-amber-200'
                          }`}
                        >
                          {reason}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Brief Justification Text */}
                <div className="space-y-1">
                  <input
                    type="text"
                    maxLength={250}
                    placeholder="Detalle breve (Ej: Retiro del socio $50 / Resguardo en caja fuerte / Faltante al contar)..."
                    value={openingDiffNotes}
                    onChange={(e) => {
                      setOpeningDiffNotes(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-amber-800/90 leading-snug">
                    Guardado en el historial de caja (auditoría interna). No altera el Libro de Ventas, Libro de Compras ni cálculos fiscales SENIAT.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Bancos Agregados en Mi Perfil (Apertura de Saldos Bancarios) */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                <span>Bancos de Mi Perfil (Saldos Iniciales)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAperturaModalOpen(false);
                  setIsProfileModalOpen(true);
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                + Gestionar en Perfil
              </button>
            </div>

            {configuredBanks.length > 0 ? (
              <div className="space-y-2.5">
                {configuredBanks.map((bk) => (
                  <div key={bk.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-800 truncate">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{bk.bank}</span>
                        {bk.isDefault && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-extrabold">
                            Principal
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        •••• {bk.accountNumber.slice(-4)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Saldo Inicial Bs:</span>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Bs</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={bankBalances[bk.id]?.balanceBs || ''}
                            onChange={(e) => handleBankBalanceChange(bk.id, 'balanceBs', e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Saldo Inicial USD (opcional):</span>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={bankBalances[bk.id]?.balanceUSD || ''}
                            onChange={(e) => handleBankBalanceChange(bk.id, 'balanceUSD', e.target.value)}
                            className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : businessInfo.pagoMovilBank ? (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{businessInfo.pagoMovilBank}</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-extrabold">
                      Pago Móvil
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {businessInfo.pagoMovilPhone || 'Principal'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Saldo Inicial Bs:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Bs</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={bankBalances['default-pm']?.balanceBs || ''}
                        onChange={(e) => handleBankBalanceChange('default-pm', 'balanceBs', e.target.value)}
                        className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Saldo Inicial USD (opcional):</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={bankBalances['default-pm']?.balanceUSD || ''}
                        onChange={(e) => handleBankBalanceChange('default-pm', 'balanceUSD', e.target.value)}
                        className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-2">
                <span>No has registrado cuentas bancarias en tu perfil.</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAperturaModalOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                >
                  + Agregar Bancos
                </button>
              </div>
            )}
          </div>

          {/* Optional Notes */}
          <div className="space-y-1 pt-1">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Notas de apertura (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Turno de la mañana, Caja principal, billetes de baja denominación..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Policy Information Box */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Control de Caja Activo:</strong> Al abrir la caja quedará habilitado el procesamiento de ventas, cobros y compras de productos. Al finalizar el turno podrás emitir el Cuadre y realizar el Cierre de Caja del día.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAperturaModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'Abriendo Caja...' : 'Abrir Caja e Iniciar Día'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
