import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tag, DollarSign, X, Check, Trash2, AlertCircle } from 'lucide-react';
import { CartDiscount } from '../../types';
import { formatBs, formatUSD, round2, safeDiv } from '../../utils/exportUtils';

interface DescuentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  bcvRate: number;
  grossSubtotalUSD: number;
  grossSubtotalBs: number;
  currentDiscount: CartDiscount | null;
  onApply: (discount: CartDiscount | null) => void;
}

export const DescuentoModal: React.FC<DescuentoModalProps> = ({
  isOpen,
  onClose,
  bcvRate,
  grossSubtotalUSD,
  grossSubtotalBs,
  currentDiscount,
  onApply
}) => {
  const [currency, setCurrency] = useState<'Bs' | 'USD'>(currentDiscount?.currency || 'Bs');
  const [amountInput, setAmountInput] = useState<string>(
    currentDiscount && currentDiscount.amount > 0 ? currentDiscount.amount.toString() : ''
  );
  const [reason, setReason] = useState<string>(currentDiscount?.reason || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrency(currentDiscount?.currency || 'Bs');
    setAmountInput(
      currentDiscount && currentDiscount.amount > 0 ? currentDiscount.amount.toString() : ''
    );
    setReason(currentDiscount?.reason || '');
    setErrorMsg(null);
  }, [isOpen, currentDiscount]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeRate = Number.isFinite(bcvRate) && bcvRate > 0 ? bcvRate : 1;
  const parsedAmount = Math.max(0, parseFloat(amountInput) || 0);
  const maxAllowed = currency === 'Bs' ? grossSubtotalBs : grossSubtotalUSD;
  const exceedsSubtotal = parsedAmount > maxAllowed + 0.001;

  // Preserve exact entered currency without reverse cross-rounding
  let previewDiscountBs = 0;
  let previewDiscountUSD = 0;
  if (parsedAmount > 0) {
    if (currency === 'Bs') {
      previewDiscountBs = round2(Math.min(parsedAmount, grossSubtotalBs));
      previewDiscountUSD =
        grossSubtotalBs > 0 && previewDiscountBs >= grossSubtotalBs
          ? grossSubtotalUSD
          : round2(Math.min(safeDiv(previewDiscountBs, safeRate, 0), grossSubtotalUSD));
    } else {
      previewDiscountUSD = round2(Math.min(parsedAmount, grossSubtotalUSD));
      previewDiscountBs =
        grossSubtotalUSD > 0 && previewDiscountUSD >= grossSubtotalUSD
          ? grossSubtotalBs
          : round2(Math.min(previewDiscountUSD * safeRate, grossSubtotalBs));
    }
  }

  const netSubtotalBs = round2(Math.max(0, grossSubtotalBs - previewDiscountBs));
  const netSubtotalUSD = round2(Math.max(0, grossSubtotalUSD - previewDiscountUSD));

  const handleCurrencyChange = (nextCurrency: 'Bs' | 'USD') => {
    if (nextCurrency === currency) return;
    setCurrency(nextCurrency);
    setAmountInput('');
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setErrorMsg('Ingrese un monto de descuento mayor a cero.');
      return;
    }
    if (exceedsSubtotal) {
      setErrorMsg(
        currency === 'Bs'
          ? `El descuento no puede superar el subtotal de Bs. ${formatBs(grossSubtotalBs)}.`
          : `El descuento no puede superar el subtotal de $${formatUSD(grossSubtotalUSD)}.`
      );
      return;
    }

    onApply({
      amount: round2(parsedAmount),
      currency,
      reason: reason.trim() || undefined
    });
    onClose();
  };

  const handleRemoveDiscount = () => {
    onApply(null);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="descuento-modal-title"
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="shrink-0 bg-[#0B1528] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 id="descuento-modal-title" className="font-extrabold text-base leading-tight truncate">
                Aplicar Descuento Global
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                Se deduce del subtotal antes de calcular IVA e IGTF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de descuento"
            className="w-9 h-9 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form id="descuento-global-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {/* Currency Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Moneda del Descuento:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCurrencyChange('Bs')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currency === 'Bs'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>Bs. Bolívares</span>
              </button>

              <button
                type="button"
                onClick={() => handleCurrencyChange('USD')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>$ USD Dólares</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {currency === 'Bs'
                ? 'Se respetará el monto exacto en Bolívares sin alteración por decimales.'
                : 'Se respetará el monto exacto en Dólares ($ USD) sin redondeos cruzados.'}
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="descuento-amount-input" className="text-xs font-bold text-slate-700">
                {currency === 'Bs' ? 'Monto a Rebajar (Bs.):' : 'Monto a Rebajar ($ USD):'}
              </label>
              <span className="text-[11px] font-mono-numbers text-slate-500">
                Máx: {currency === 'Bs' ? `Bs. ${formatBs(grossSubtotalBs)}` : `$${formatUSD(grossSubtotalUSD)}`}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                {currency === 'Bs' ? 'Bs.' : '$'}
              </span>
              <input
                id="descuento-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                max={maxAllowed > 0 ? maxAllowed : undefined}
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="0.00"
                autoFocus
                className={`w-full pl-11 pr-3 py-2.5 bg-white border rounded-xl text-base font-mono-numbers font-black text-[#0B1528] focus:outline-none focus:ring-2 ${
                  exceedsSubtotal
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
            </div>

            {exceedsSubtotal && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>El monto supera el subtotal disponible del carrito.</span>
              </p>
            )}
          </div>

          {/* Optional Reason */}
          <div>
            <label htmlFor="descuento-reason-input" className="block text-xs font-bold text-slate-700 mb-1">
              Motivo o Concepto (Opcional):
            </label>
            <input
              id="descuento-reason-input"
              type="text"
              maxLength={80}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cliente frecuente, Promoción, Pago contado"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Live Impact Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs font-mono-numbers">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-sans font-semibold">Subtotal Bruto:</span>
              <span>${formatUSD(grossSubtotalUSD)} · Bs. {formatBs(grossSubtotalBs)}</span>
            </div>

            <div className="flex items-center justify-between text-emerald-700 font-bold">
              <span className="font-sans">
                Descuento ({currency === 'Bs' ? 'Exacto Bs' : 'Exacto USD'}):
              </span>
              <span>
                {currency === 'Bs'
                  ? `-Bs. ${formatBs(previewDiscountBs)} (-$${formatUSD(previewDiscountUSD)})`
                  : `-$${formatUSD(previewDiscountUSD)} (-Bs. ${formatBs(previewDiscountBs)})`}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[#0B1528] font-black">
              <span className="font-sans text-xs">Subtotal Neto (pre-IVA):</span>
              <span>${formatUSD(netSubtotalUSD)} · Bs. {formatBs(netSubtotalBs)}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* Fixed Footer */}
        <div className="shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
          <div>
            {currentDiscount && currentDiscount.amount > 0 && (
              <button
                type="button"
                onClick={handleRemoveDiscount}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="descuento-global-form"
              disabled={parsedAmount <= 0 || exceedsSubtotal}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Descuento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
