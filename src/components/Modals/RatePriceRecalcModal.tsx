import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import {
  X,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Euro,
  ArrowRight,
  Lock,
  Sparkles,
  CheckCircle2,
  Coins
} from 'lucide-react';
import {
  formatBs,
  formatUSD,
  round2,
  roundUpCommercialBs,
  computeCatalogPriceRecalculation
} from '../../utils/exportUtils';
import { RatePriceCurrencyScope } from '../../types';

const ROUNDING_STEPS = [
  { value: 1, label: 'Entero (1 Bs)', hint: 'Sin decimales (Math.ceil)' },
  { value: 5, label: 'Múltiplo 5 Bs', hint: 'Ej: 132,10 → 135 Bs' },
  { value: 10, label: 'Múltiplo 10 Bs', hint: 'Ej: 132,10 → 140 Bs' },
  { value: 50, label: 'Múltiplo 50 Bs', hint: 'Ej: 132,10 → 150 Bs' },
  { value: 100, label: 'Múltiplo 100 Bs', hint: 'Ej: 132,10 → 200 Bs' }
];

export const RatePriceRecalcModal: React.FC = () => {
  const {
    rateChangeModalState,
    closeRateRecalcModal,
    applyCatalogPriceRecalculation,
    products,
    bcvRate,
    bcvEuroRate,
    commercialRoundingStep
  } = useApp();

  const [currencyScope, setCurrencyScope] = useState<RatePriceCurrencyScope>('auto_anchor');
  const [roundingStep, setRoundingStep] = useState<number>(commercialRoundingStep || 1);
  const [previewTab, setPreviewTab] = useState<'update_bs_upward' | 'keep_static_bs'>('update_bs_upward');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<'update_bs_upward' | 'keep_static_bs' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (rateChangeModalState.isOpen) {
      setRoundingStep(commercialRoundingStep || 1);
      setCurrencyScope('auto_anchor');
      setPreviewTab('update_bs_upward');
      setErrorMsg(null);
      setIsProcessing(false);
      setActiveAction(null);
    }
  }, [rateChangeModalState.isOpen, commercialRoundingStep]);

  useEffect(() => {
    if (!rateChangeModalState.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        closeRateRecalcModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rateChangeModalState.isOpen, isProcessing, closeRateRecalcModal]);

  const effectiveNewUsd = rateChangeModalState.newUsdRate > 0 ? rateChangeModalState.newUsdRate : bcvRate;
  const effectivePrevUsd = rateChangeModalState.previousUsdRate > 0 ? rateChangeModalState.previousUsdRate : bcvRate;
  const effectiveNewEur = rateChangeModalState.newEurRate > 0 ? rateChangeModalState.newEurRate : bcvEuroRate;
  const effectivePrevEur = rateChangeModalState.previousEurRate > 0 ? rateChangeModalState.previousEurRate : bcvEuroRate;

  const usdChanged = Math.abs(effectiveNewUsd - effectivePrevUsd) >= 0.01;
  const eurChanged = Math.abs(effectiveNewEur - effectivePrevEur) >= 0.01;
  const usdDiffPct = effectivePrevUsd > 0 ? round2(((effectiveNewUsd - effectivePrevUsd) / effectivePrevUsd) * 100) : 0;
  const eurDiffPct = effectivePrevEur > 0 ? round2(((effectiveNewEur - effectivePrevEur) / effectivePrevEur) * 100) : 0;

  const previewItems = useMemo(() => {
    return computeCatalogPriceRecalculation({
      products,
      mode: previewTab,
      currencyScope,
      roundingStep,
      previousUsdRate: effectivePrevUsd,
      newUsdRate: effectiveNewUsd,
      previousEurRate: effectivePrevEur,
      newEurRate: effectiveNewEur
    });
  }, [
    products,
    previewTab,
    currencyScope,
    roundingStep,
    effectivePrevUsd,
    effectiveNewUsd,
    effectivePrevEur,
    effectiveNewEur
  ]);

  const eurAnchoredCount = useMemo(
    () => products.filter(p => p.priceAnchorCurrency === 'EUR' || p.priceCurrency === 'EUR').length,
    [products]
  );
  const usdAnchoredCount = Math.max(0, products.length - eurAnchoredCount);

  if (!rateChangeModalState.isOpen) return null;

  const handleApply = async (mode: 'update_bs_upward' | 'keep_static_bs') => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveAction(mode);
    setErrorMsg(null);
    try {
      await applyCatalogPriceRecalculation({
        mode,
        currencyScope,
        roundingStep
      });
      closeRateRecalcModal();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudieron actualizar los precios en Cloud Firestore. Intenta nuevamente.');
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };

  const sampleExampleRounded = roundUpCommercialBs(132.1, roundingStep);

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={() => {
        if (!isProcessing) closeRateRecalcModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-recalc-modal-title"
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-[#DCE4F0] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0B1528] via-[#122447] to-[#1D4ED8] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 id="rate-recalc-modal-title" className="text-sm sm:text-base font-black leading-tight truncate">
                {rateChangeModalState.source === 'daily_auto'
                  ? 'Alerta Diaria: Cambio de Tasa Oficial BCV'
                  : 'Recalcular Precios del Catálogo por Tasa BCV ($ / €)'}
              </h2>
              <p className="text-[11px] text-blue-100 truncate">
                Gestión de Precios Mixta (Bs Estático + Ancla $ / €) con Redondeo Comercial Arriba
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={closeRateRecalcModal}
            aria-label="Cerrar ventana"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Informative Alert Callout */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 leading-relaxed">
                {usdChanged ? (
                  <p className="font-bold">
                    La tasa del BCV ha cambiado hoy (de{' '}
                    <span className="font-mono-numbers underline">Bs. {formatBs(effectivePrevUsd)}</span> a{' '}
                    <span className="font-mono-numbers underline text-[#0B1528]">Bs. {formatBs(effectiveNewUsd)}</span>).
                    ¿Desea actualizar automáticamente los precios de los productos multiplicando su base en dólares por la nueva tasa, o prefiere mantener los precios estáticos actuales en Bs (afectando el equivalente en USD o euro)?
                  </p>
                ) : eurChanged ? (
                  <p className="font-bold">
                    La tasa del Euro BCV ha cambiado hoy (de{' '}
                    <span className="font-mono-numbers underline">Bs. {formatBs(effectivePrevEur)}</span> a{' '}
                    <span className="font-mono-numbers underline text-[#0B1528]">Bs. {formatBs(effectiveNewEur)}</span>).
                    ¿Desea actualizar automáticamente los precios de los productos multiplicando su base ancla por la nueva tasa, o prefiere mantener los precios estáticos actuales en Bs (afectando el equivalente en USD o euro)?
                  </p>
                ) : (
                  <p className="font-bold">
                    Revisión manual del catálogo a las tasas BCV vigentes (Dólar:{' '}
                    <span className="font-mono-numbers">Bs. {formatBs(effectiveNewUsd)}</span> • Euro:{' '}
                    <span className="font-mono-numbers">Bs. {formatBs(effectiveNewEur)}</span>).
                    Puede recalcular sus precios en Bolívares multiplicando la base en dólares o euros con redondeo comercial hacia arriba, o mantener los precios estáticos actuales en Bs ajustando solo sus equivalentes en divisas.
                  </p>
                )}
              </div>
            </div>

            {/* Rate Delta Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-white rounded-xl border border-amber-200/80 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#7C3A0B]">
                  <DollarSign className="w-4 h-4 text-[#D96B27]" />
                  <span>Dólar ($ BCV)</span>
                </div>
                <div className="text-right font-mono-numbers text-xs">
                  {usdChanged ? (
                    <span className="flex items-center gap-1 font-bold">
                      <span className="text-slate-400 line-through">{formatBs(effectivePrevUsd)}</span>
                      <ArrowRight className="w-3 h-3 text-amber-600" />
                      <span className="text-[#0B1528]">Bs. {formatBs(effectiveNewUsd)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                        usdDiffPct >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {usdDiffPct >= 0 ? `+${usdDiffPct}%` : `${usdDiffPct}%`}
                      </span>
                    </span>
                  ) : (
                    <span className="font-extrabold text-[#0B1528]">Bs. {formatBs(effectiveNewUsd)}</span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-blue-200/80 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A]">
                  <Euro className="w-4 h-4 text-blue-600" />
                  <span>Euro (€ BCV)</span>
                </div>
                <div className="text-right font-mono-numbers text-xs">
                  {eurChanged ? (
                    <span className="flex items-center gap-1 font-bold">
                      <span className="text-slate-400 line-through">{formatBs(effectivePrevEur)}</span>
                      <ArrowRight className="w-3 h-3 text-blue-600" />
                      <span className="text-[#0B1528]">Bs. {formatBs(effectiveNewEur)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                        eurDiffPct >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {eurDiffPct >= 0 ? `+${eurDiffPct}%` : `${eurDiffPct}%`}
                      </span>
                    </span>
                  ) : (
                    <span className="font-extrabold text-[#0B1528]">Bs. {formatBs(effectiveNewEur)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Controls: Currency Anchor & Upward Commercial Rounding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Currency Reference Selector */}
            <div className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-extrabold text-[#0B1528] uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-blue-600" />
                <span>Divisa de Referencia (Ancla)</span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setCurrencyScope('auto_anchor')}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                    currencyScope === 'auto_anchor'
                      ? 'bg-[#EBF3FE] border-blue-500 text-[#1E3A8A] shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Según ancla de cada producto</span>
                  <span className="text-[10px] font-mono bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                    {usdAnchoredCount}$ / {eurAnchoredCount}€
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrencyScope('USD')}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      currencyScope === 'USD'
                        ? 'bg-[#FFF3E8] border-[#D96B27] text-[#7C3A0B]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Todos en $ BCV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyScope('EUR')}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      currencyScope === 'EUR'
                        ? 'bg-[#EBF3FE] border-blue-600 text-[#1D4ED8]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Euro className="w-3.5 h-3.5" />
                    <span>Todos en € BCV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Commercial Upward Rounding Selector */}
            <div className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-extrabold text-[#0B1528] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Redondeo Comercial Arriba (Sin Decimales)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROUNDING_STEPS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRoundingStep(opt.value)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      roundingStep === opt.value
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 font-medium">
                Regla activa: cualquier decimal sube sin centavos (ej.{' '}
                <span className="font-mono-numbers font-bold">132,10 Bs</span> →{' '}
                <span className="font-mono-numbers font-black text-emerald-700">{sampleExampleRounded} Bs</span>).
              </div>
            </div>
          </div>

          {/* Live Catalog Preview */}
          <div className="border border-[#DCE4F0] rounded-2xl overflow-hidden bg-white">
            <div className="px-3.5 py-2.5 bg-[#F8FAFC] border-b border-[#DCE4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#0B1528]">
                Vista Previa de Impacto ({previewItems.length} producto{previewItems.length === 1 ? '' : 's'})
              </span>
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setPreviewTab('update_bs_upward')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'update_bs_upward'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Si actualizo Bs (Arriba)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('keep_static_bs')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    previewTab === 'keep_static_bs'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Si mantengo Bs estáticos
                </button>
              </div>
            </div>

            {previewItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No hay productos con precio registrado en tu catálogo todavía.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-center">Ancla</th>
                      <th className="py-2 px-3 text-right">Actual Bs</th>
                      <th className="py-2 px-3 text-right">
                        {previewTab === 'update_bs_upward' ? 'Nuevo Bs (Redondeado)' : 'Bs Estático'}
                      </th>
                      <th className="py-2 px-3 text-right">Equiv. Divisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.slice(0, 50).map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-bold text-[#0B1528] max-w-[160px] truncate" title={item.product.name}>
                          {item.product.name}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            item.anchorCurrency === 'EUR'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {item.anchorCurrency === 'EUR' ? '€ EUR' : '$ USD'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono-numbers text-slate-500">
                          Bs. {formatBs(item.currentBs)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-numbers">
                          {previewTab === 'update_bs_upward' ? (
                            <div>
                              <span className="font-black text-emerald-700">Bs. {formatBs(item.newBs)}</span>
                              {Math.abs(item.rawNewBs - item.newBs) >= 0.01 && (
                                <span className="block text-[9px] text-slate-400">
                                  exacto: {formatBs(item.rawNewBs)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="font-extrabold text-[#0B1528]">Bs. {formatBs(item.newBs)}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-numbers font-bold">
                          {item.anchorCurrency === 'EUR' ? (
                            <span className={previewTab === 'keep_static_bs' ? 'text-amber-700' : 'text-blue-700'}>
                              €{formatUSD(item.newEUR)}
                            </span>
                          ) : (
                            <span className={previewTab === 'keep_static_bs' ? 'text-amber-700' : 'text-slate-700'}>
                              ${formatUSD(item.newUSD)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewItems.length > 50 && (
                  <div className="px-3 py-2 text-[10px] text-center text-slate-500 bg-slate-50 border-t border-slate-100">
                    Mostrando 50 de {previewItems.length} productos. Al confirmar se actualizarán los {previewItems.length} productos en Cloud Firestore.
                  </div>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Fixed Footer Actions */}
        <div className="px-5 py-4 bg-[#F8FAFC] border-t border-[#DCE4F0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isProcessing || products.length === 0}
            onClick={() => handleApply('keep_static_bs')}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-[#0B1528] text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isProcessing && activeAction === 'keep_static_bs' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <Lock className="w-4 h-4 text-slate-600" />
            )}
            <span>Mantener Precios Estáticos en Bs</span>
          </button>

          <button
            type="button"
            disabled={isProcessing || products.length === 0}
            onClick={() => handleApply('update_bs_upward')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white text-xs font-extrabold shadow-[0_6px_16px_-4px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing && activeAction === 'update_bs_upward' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>
              {isProcessing && activeAction === 'update_bs_upward'
                ? 'Actualizando catálogo...'
                : 'Actualizar Precios (Redondeo Arriba)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
