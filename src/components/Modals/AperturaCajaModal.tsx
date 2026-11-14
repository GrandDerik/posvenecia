import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  KeyRound, 
  DollarSign, 
  Coins, 
  Calendar, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  Sparkles, 
  Store, 
  ShieldCheck, 
  AlertCircle,
  X,
  FileText,
  Landmark,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { formatBs, formatUSD } from '../../utils/exportUtils';
import { BankInitialBalance } from '../../types';

export const AperturaCajaModal: React.FC = () => {
  const { 
    isAperturaModalOpen, 
    setIsAperturaModalOpen, 
    openCashShift, 
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualRateInput, setManualRateInput] = useState<string>('');
  const [bcvSyncFeedback, setBcvSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const hasAttemptedAutoSyncRef = useRef(false);

  // Bank balances map: key -> { balanceBs, balanceUSD }
  const [bankBalances, setBankBalances] = useState<Record<string, { balanceBs: string; balanceUSD: string }>>({});

  const configuredBanks = businessInfo.bankAccounts || [];

  // Initialize or reset bank balance fields + auto-sync daily BCV rate if stale on modal open
  useEffect(() => {
    if (isAperturaModalOpen) {
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

  const handleConvertUsdToBs = () => {
    const parsedUsd = parseFloat(initialUSD);
    if (!isNaN(parsedUsd) && parsedUsd > 0) {
      setInitialBs((parsedUsd * bcvRate).toFixed(2));
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(initialUSD) || 0;
    const bs = parseFloat(initialBs) || 0;

    if (usd < 0 || bs < 0) {
      setErrorMsg('Los montos del fondo inicial no pueden ser negativos.');
      return;
    }

    // Build initial bank balances array
    const initialBanksList: BankInitialBalance[] = [];
    if (configuredBanks.length > 0) {
      configuredBanks.forEach(bk => {
        const entry = bankBalances[bk.id];
        const bBs = parseFloat(entry?.balanceBs || '0') || 0;
        const bUsd = parseFloat(entry?.balanceUSD || '0') || 0;
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
      const bBs = parseFloat(entry?.balanceBs || '0') || 0;
      const bUsd = parseFloat(entry?.balanceUSD || '0') || 0;
      initialBanksList.push({
        bankId: 'default-pm',
        bankName: businessInfo.pagoMovilBank,
        accountNumber: businessInfo.pagoMovilPhone || 'Pago Móvil Principal',
        initialBalanceBs: bBs,
        initialBalanceUSD: bUsd
      });
    }

    openCashShift(usd, bs, notes.trim(), initialBanksList);
    setErrorMsg(null);
    setInitialUSD('');
    setInitialBs('');
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-5 flex items-start justify-between">
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
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          
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
                      fetchLiveEuroRate().catch(() => {});
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
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              Fondo de Caja Inicial (Base en Efectivo)
            </label>

            {/* USD Cash Base Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Efectivo en Dólares ($ USD)
                </span>
                <span className="text-[11px] text-slate-400">Si arrancas sin base, deja 0</span>
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
                {parseFloat(initialUSD) > 0 && (
                  <button
                    type="button"
                    onClick={handleConvertUsdToBs}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer underline"
                  >
                    Calcular desde USD
                  </button>
                )}
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
              onClick={() => setIsAperturaModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <KeyRound className="w-4 h-4" />
              <span>Abrir Caja e Iniciar Día</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
