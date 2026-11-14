import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  ArrowRightLeft, 
  Calculator, 
  Coins, 
  DollarSign, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Calendar,
  History,
  RotateCcw,
  RotateCw,
  Globe,
  Euro,
  Layers,
  Settings2
} from 'lucide-react';
import { formatBs, formatUSD } from '../utils/exportUtils';

export const TasaBCVView: React.FC = () => {
  const { 
    bcvRate, 
    updateBcvRate, 
    rateHistory, 
    fetchLiveRate, 
    isFetchingLiveRate,
    bcvEuroRate,
    updateBcvEuroRate,
    fetchLiveEuroRate,
    isFetchingLiveEuroRate,
    baseCurrency,
    setBaseCurrency
  } = useApp();

  // Selected consultation currency
  const [selectedCurrencyToFetch, setSelectedCurrencyToFetch] = useState<'USD' | 'EUR'>('USD');
  
  // Rate inputs for manual editing
  const [dollarRateInput, setDollarRateInput] = useState(bcvRate.toString());
  const [euroRateInput, setEuroRateInput] = useState(bcvEuroRate.toString());
  
  const [rateUpdatedSuccess, setRateUpdatedSuccess] = useState<string | null>(null);
  const [liveSuccessMessage, setLiveSuccessMessage] = useState<string | null>(null);

  // Converter state
  const [convertAmount, setConvertAmount] = useState<string>('10');
  const [convertFrom, setConvertFrom] = useState<'USD' | 'EUR' | 'Bs'>('USD');

  // Change calculator state
  const [billUSD, setBillUSD] = useState<string>('20');
  const [purchaseUSD, setPurchaseUSD] = useState<string>('12.50');

  // IGTF / IVA calculator
  const [calcAmount, setCalcAmount] = useState<string>('100');

  const handleConsultLiveBCV = async () => {
    try {
      if (selectedCurrencyToFetch === 'USD') {
        const rate = await fetchLiveRate();
        setDollarRateInput(rate.toFixed(2));
        setLiveSuccessMessage(`Tasa Dólar BCV oficial obtenida: Bs. ${formatBs(rate)}`);
      } else {
        const rate = await fetchLiveEuroRate();
        setEuroRateInput(rate.toFixed(2));
        setLiveSuccessMessage(`Tasa Euro BCV oficial obtenida: Bs. ${formatBs(rate)}`);
      }
      setTimeout(() => setLiveSuccessMessage(null), 4000);
    } catch {
      setLiveSuccessMessage(`No se pudo conectar a la API del BCV para ${selectedCurrencyToFetch}. Puede ingresarla manualmente.`);
      setTimeout(() => setLiveSuccessMessage(null), 4000);
    }
  };

  const handleUpdateDollarRate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(dollarRateInput);
    if (!isNaN(val) && val > 0) {
      updateBcvRate(val);
      setRateUpdatedSuccess('¡Tasa Dólar BCV guardada exitosamente!');
      setTimeout(() => setRateUpdatedSuccess(null), 3000);
    }
  };

  const handleUpdateEuroRate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(euroRateInput);
    if (!isNaN(val) && val > 0) {
      updateBcvEuroRate(val);
      setRateUpdatedSuccess('¡Tasa Euro BCV guardada exitosamente!');
      setTimeout(() => setRateUpdatedSuccess(null), 3000);
    }
  };

  // Conversions
  const inputAmt = parseFloat(convertAmount) || 0;
  let resultUSD = 0;
  let resultEUR = 0;
  let resultBs = 0;

  if (convertFrom === 'USD') {
    resultUSD = inputAmt;
    resultBs = inputAmt * bcvRate;
    resultEUR = bcvEuroRate > 0 ? (resultBs / bcvEuroRate) : 0;
  } else if (convertFrom === 'EUR') {
    resultEUR = inputAmt;
    resultBs = inputAmt * bcvEuroRate;
    resultUSD = bcvRate > 0 ? (resultBs / bcvRate) : 0;
  } else {
    resultBs = inputAmt;
    resultUSD = bcvRate > 0 ? (inputAmt / bcvRate) : 0;
    resultEUR = bcvEuroRate > 0 ? (inputAmt / bcvEuroRate) : 0;
  }

  // Change computation
  const clientBill = parseFloat(billUSD) || 0;
  const purchaseCost = parseFloat(purchaseUSD) || 0;
  const changeUSD = Math.max(0, clientBill - purchaseCost);
  const changeBs = changeUSD * bcvRate;

  // IGTF & IVA computations
  const amountToCalculate = parseFloat(calcAmount) || 0;
  const igtf3Pct = amountToCalculate * 0.03;
  const iva16Pct = amountToCalculate * 0.16;
  const totalWithTax = amountToCalculate + iva16Pct + igtf3Pct;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      
      {/* Title Banner */}
      <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-[#EBF3FE] border border-[#C5DCFC] text-blue-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#0B1528] tracking-tight">
              Gestor de Tasas Oficiales BCV (Dólar & Euro)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consulta en vivo desde el Banco Central de Venezuela, fijación de tasa manual y selector de moneda base
          </p>
        </div>

        {/* Live Badges for USD and EUR */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-[#FFF3E8] border border-[#F5D3B3] rounded-2xl px-4 py-2 text-right">
            <span className="text-[10px] font-bold text-[#9A4B12] uppercase tracking-wider block">
              Dólar ($ BCV)
            </span>
            <span className="text-xl font-black text-[#0B1528] font-mono-numbers">
              Bs {formatBs(bcvRate)}
            </span>
          </div>

          <div className="bg-[#EBF3FE] border border-[#C5DCFC] rounded-2xl px-4 py-2 text-right">
            <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider block">
              Euro (€ BCV)
            </span>
            <span className="text-xl font-black text-[#0B1528] font-mono-numbers">
              Bs {formatBs(bcvEuroRate)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION: CONFIGURACIÓN DE MONEDA BASE DE LA TIENDA (USD vs VED) */}
      <div className="bg-gradient-to-b from-white to-[#F4F8FF] text-[#0B1528] p-5 rounded-3xl shadow-[0_2px_12px_-4px_rgba(37,99,235,0.1)] border border-[#93C5FD] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0B1528] flex items-center justify-center text-white shadow-xs shrink-0">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[#0B1528]">
                Moneda Base del Negocio: {baseCurrency === 'VED' ? 'Bolívares (VED / Bs)' : 'Dólar Estadounidense (USD / $)'}
              </h3>
              <p className="text-xs text-slate-600">
                Elija en qué moneda desea fijar los precios principales de su catálogo comercial
              </p>
            </div>
          </div>

          {/* Toggle buttons */}
          <div className="flex items-center gap-1.5 bg-[#EEF2F7] p-1.5 rounded-2xl border border-[#DCE4F0] shrink-0">
            <button
              type="button"
              onClick={() => setBaseCurrency('USD')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                baseCurrency === 'USD'
                  ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[0_4px_12px_-2px_rgba(37,99,235,0.4)]'
                  : 'text-slate-600 hover:text-[#0B1528]'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Dólar USD ($)</span>
            </button>

            <button
              type="button"
              onClick={() => setBaseCurrency('VED')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                baseCurrency === 'VED'
                  ? 'bg-[#0B1528] text-white shadow-sm'
                  : 'text-slate-600 hover:text-[#0B1528]'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Bolívares VED (Bs)</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-[#1E3A8A] bg-[#EBF3FE]/80 p-3 rounded-2xl border border-[#C5DCFC] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {baseCurrency === 'VED'
              ? 'Modo Bolívares VED activo: Los precios de tus productos se expresan primariamente en Bolívares. El sistema calcula en tiempo real su contravalor en Divisas USD y Euros a la tasa oficial del BCV.'
              : 'Modo Dólar USD activo: Los precios se fijan en Dólares. Al momento de vender, el sistema indexa y calcula automáticamente el monto en Bolívares según la tasa del BCV.'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Tasa BCV Live & Manual Updater (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Rate Updater Box with Live Sync (Choice of Dollar or Euro) */}
          <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-[#0B1528] flex items-center gap-2">
                  <Coins className="w-5 h-5 text-blue-600" />
                  <span>Consultar Tasa Oficial BCV en Vivo</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccione si desea consultar la cotización oficial del Dólar o del Euro
                </p>
              </div>

              {/* Botón selector y de consulta en vivo */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedCurrencyToFetch}
                  onChange={(e) => setSelectedCurrencyToFetch(e.target.value as any)}
                  className="px-2.5 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <option value="USD">Dólar ($ BCV)</option>
                  <option value="EUR">Euro (€ BCV)</option>
                </select>

                <button
                  type="button"
                  disabled={isFetchingLiveRate || isFetchingLiveEuroRate}
                  onClick={handleConsultLiveBCV}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] transition-all cursor-pointer whitespace-nowrap"
                >
                  <RotateCw className={`w-4 h-4 ${(isFetchingLiveRate || isFetchingLiveEuroRate) ? 'animate-spin' : ''}`} />
                  <span>
                    {(isFetchingLiveRate || isFetchingLiveEuroRate) 
                      ? 'Consultando...' 
                      : `Consultar ${selectedCurrencyToFetch === 'USD' ? 'Dólar' : 'Euro'} BCV`}
                  </span>
                </button>
              </div>
            </div>

            {liveSuccessMessage && (
              <div className="p-3 bg-[#EBF3FE] border border-[#C5DCFC] rounded-xl text-xs font-bold text-[#1E3A8A] flex items-center gap-2 animate-in fade-in">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>{liveSuccessMessage}</span>
              </div>
            )}

            {rateUpdatedSuccess && (
              <div className="p-3 bg-[#E7F8EE] border border-[#A7E6C4] rounded-xl text-xs font-bold text-[#065F46] flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{rateUpdatedSuccess}</span>
              </div>
            )}

            {/* Dual Manual Adjustment Forms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              
              {/* Form 1: Tasa Dólar USD */}
              <div className="bg-[#FFF3E8] border border-[#F5D3B3] rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#7C3A0B]">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-[#D96B27]" />
                    Tasa Dólar ($)
                  </span>
                  <span className="text-[11px] text-[#9A4B12] font-mono-numbers">Actual: Bs {formatBs(bcvRate)}</span>
                </div>
                <form onSubmit={handleUpdateDollarRate} className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-500 font-mono-numbers">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={dollarRateInput}
                      onChange={(e) => setDollarRateInput(e.target.value)}
                      placeholder="Ej: 889.26"
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#F5D3B3] rounded-xl text-xs font-mono-numbers font-bold text-[#0B1528]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-[#D96B27] hover:bg-[#C25A1A] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    Guardar Tasa Dólar
                  </button>
                </form>
              </div>

              {/* Form 2: Tasa Euro EUR */}
              <div className="bg-[#EBF3FE] border border-[#C5DCFC] rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E3A8A]">
                  <span className="flex items-center gap-1">
                    <Euro className="w-4 h-4 text-blue-600" />
                    Tasa Euro (€)
                  </span>
                  <span className="text-[11px] text-[#1D4ED8] font-mono-numbers">Actual: Bs {formatBs(bcvEuroRate)}</span>
                </div>
                <form onSubmit={handleUpdateEuroRate} className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-500 font-mono-numbers">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={euroRateInput}
                      onChange={(e) => setEuroRateInput(e.target.value)}
                      placeholder="Ej: 997.92"
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#C5DCFC] rounded-xl text-xs font-mono-numbers font-bold text-[#0B1528]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    Guardar Tasa Euro
                  </button>
                </form>
              </div>

            </div>
          </div>

          {/* Tri-Currency Converter (USD, EUR, Bs) */}
          <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#0B1528] flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                <span>Conversor Multidivisa BCV (USD / EUR / Bolívares)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Monto a Convertir</label>
                <input
                  type="number"
                  step="0.01"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-base font-mono-numbers font-bold text-[#0B1528]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Desde</label>
                <select
                  value={convertFrom}
                  onChange={(e) => setConvertFrom(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-bold text-[#0B1528] cursor-pointer"
                >
                  <option value="USD">Dólares USD ($)</option>
                  <option value="EUR">Euros EUR (€)</option>
                  <option value="Bs">Bolívares VED (Bs)</option>
                </select>
              </div>

              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0] text-xs space-y-1">
                <div>Dólares: <strong className="font-mono-numbers text-[#0B1528]">${formatUSD(resultUSD)}</strong></div>
                <div>Euros: <strong className="font-mono-numbers text-[#0B1528]">€{formatUSD(resultEUR)}</strong></div>
                <div>Bolívares: <strong className="font-mono-numbers text-blue-700">Bs {formatBs(resultBs)}</strong></div>
              </div>
            </div>
          </div>

          {/* Historical Trend */}
          <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-3">
            <h3 className="font-bold text-sm text-[#0B1528] flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <span>Historial Reciente de la Tasa Oficial</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#DCE4F0] text-slate-500 text-left">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-right">Tasa Oficial</th>
                    <th className="py-2.5 px-3 text-right">Variación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {rateHistory.slice(-5).reverse().map((h, i, arr) => {
                    const prev = arr[i + 1];
                    const diff = prev ? (h.rate - prev.rate) : 0;
                    return (
                      <tr key={h.date} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 px-3 text-slate-700">{h.date}</td>
                        <td className="py-2 px-3 text-right font-bold text-[#0B1528]">
                          Bs. {h.rate.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {diff > 0 ? (
                            <span className="text-rose-600">+{diff.toFixed(2)}</span>
                          ) : diff < 0 ? (
                            <span className="text-emerald-600">{diff.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Calculadora de Vuelto Mixto & Impuestos SENIAT (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Calculadora de Vuelto Mixto */}
          <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calculator className="w-4 h-4 text-blue-600" />
              <div>
                <h3 className="font-bold text-sm text-[#0B1528]">Calculadora de Vuelto Mixto</h3>
                <p className="text-[11px] text-slate-500">Cliente paga con billete USD y vuelto en Bolívares</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billete USD entregado por el cliente ($)
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {['5', '10', '20', '50'].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBillUSD(b)}
                      className={`py-1.5 text-xs font-mono-numbers font-bold rounded-xl border cursor-pointer transition-colors ${
                        billUSD === b ? 'bg-[#0B1528] text-white border-[#0B1528]' : 'bg-[#F8FAFC] border-[#DCE4F0] text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ${b}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={billUSD}
                  onChange={(e) => setBillUSD(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono-numbers font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monto de la compra ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={purchaseUSD}
                  onChange={(e) => setPurchaseUSD(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono-numbers font-bold"
                />
              </div>

              {/* Vuelto result */}
              <div className="p-4 bg-[#0B1528] text-white rounded-2xl shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                  Vuelto exacto a entregar al cliente
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">En Bolívares (Pago Móvil / Efectivo):</span>
                  <span className="text-lg font-black text-emerald-300 font-mono-numbers">
                    Bs. {formatBs(changeBs)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 border-t border-white/10 pt-1.5">
                  <span>En Divisas (USD):</span>
                  <span className="font-mono-numbers font-bold text-white">${formatUSD(changeUSD)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calculadora Legal SENIAT (IGTF 3% & IVA 16%) */}
          <div className="bg-white/95 p-5 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="font-bold text-sm text-[#0B1528]">Desglose de Impuestos SENIAT</h3>
                <p className="text-[11px] text-slate-500">Cálculo de IVA (16%) y retención IGTF (3%)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Monto Base a Calcular ($ o Bs)
              </label>
              <input
                type="number"
                step="0.01"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-sm font-mono-numbers font-bold"
              />
            </div>

            <div className="space-y-2 text-xs font-mono-numbers">
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4F0] flex justify-between">
                <span className="text-slate-600 font-sans">Monto Base:</span>
                <span className="font-bold text-[#0B1528]">{formatUSD(amountToCalculate)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4F0] flex justify-between">
                <span className="text-slate-600 font-sans">IVA 16% (Alícuota General):</span>
                <span className="font-bold text-[#0B1528]">{formatUSD(iva16Pct)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#E7F8EE] border border-[#A7E6C4] flex justify-between text-[#065F46]">
                <span className="font-sans font-semibold">IGTF 3% (Pagos Divisa Efectivo):</span>
                <span className="font-bold">{formatUSD(igtf3Pct)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0B1528] text-white flex justify-between">
                <span className="font-sans font-bold">Total con IVA + IGTF:</span>
                <span className="font-black text-blue-300">{formatUSD(totalWithTax)}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
