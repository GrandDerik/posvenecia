import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Check, FileSpreadsheet, Building, DollarSign, Banknote, ShieldAlert, KeyRound } from 'lucide-react';
import { formatBs, formatUSD } from '../utils/exportUtils';

interface RegistrarGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegistrarGastoModal: React.FC<RegistrarGastoModalProps> = ({ isOpen, onClose }) => {
  const { addExpense, bcvRate, isCashRegisterOpen, setIsAperturaModalOpen } = useApp();

  const [supplierName, setSupplierName] = useState('');
  const [supplierRIF, setSupplierRIF] = useState('J-');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Mercancía' | 'Servicios' | 'Alquiler' | 'Nómina' | 'Mantenimiento' | 'Otros'>('Mercancía');
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');
  const [amountInput, setAmountInput] = useState('');
  const [hasIVA, setHasIVA] = useState(true);
  const [applyRetencionIVA, setApplyRetencionIVA] = useState(true); // 75% SENIAT retention
  const [paymentMethod, setPaymentMethod] = useState<'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'debito'>('pago_movil');
  const [reference, setReference] = useState('');

  if (!isOpen) return null;

  const rawAmount = parseFloat(amountInput) || 0;
  const amountUSD = currency === 'USD' ? rawAmount : rawAmount / bcvRate;
  const amountBs = currency === 'USD' ? rawAmount * bcvRate : rawAmount;

  // SENIAT calculations for purchases
  const baseImponibleBs = hasIVA ? (amountBs / 1.16) : amountBs;
  const ivaBs = hasIVA ? (amountBs - baseImponibleBs) : 0;
  const retencionIVABs = applyRetencionIVA ? (ivaBs * 0.75) : 0; // 75% retention standard SENIAT
  const retencionISLRBs = baseImponibleBs * 0.02; // 2% ISLR retention

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || rawAmount <= 0) return;

    addExpense({
      date: new Date().toISOString(),
      invoiceNumber: invoiceNumber.trim() || `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
      controlNumber: controlNumber.trim() || `00-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierName: supplierName.trim(),
      supplierRIF: supplierRIF.trim(),
      description: description.trim() || `Gasto en ${category}`,
      category,
      amountUSD,
      amountBs,
      baseImponibleBs,
      ivaBs,
      retencionIVABs,
      retencionISLRBs,
      bcvRate,
      paymentMethod,
      reference
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-teal-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-600/40 text-teal-200">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base">Registrar Compra / Factura Proveedor</h3>
              <p className="text-xs text-teal-200">Alimentará el Libro de Compras y el Cuadre de Caja</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {!isCashRegisterOpen && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Caja Cerrada:</strong> Requiere apertura diaria para registrar compras.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAperturaModalOpen(true);
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 cursor-pointer"
              >
                Abrir Caja
              </button>
            </div>
          )}

          {/* Supplier Info */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proveedor / Empresa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Distribuidora Polar C.A."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                RIF Proveedor (J-, G-) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="J-30192847-1"
                value={supplierRIF}
                onChange={(e) => setSupplierRIF(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                N° Factura
              </label>
              <input
                type="text"
                placeholder="FAC-9842"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                N° Control
              </label>
              <input
                type="text"
                placeholder="00-9842"
                value={controlNumber}
                onChange={(e) => setControlNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              >
                <option value="Mercancía">Mercancía</option>
                <option value="Servicios">Servicios</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Nómina">Nómina</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción del Gasto / Compra
            </label>
            <input
              type="text"
              placeholder="Ej: Reposición de 10 bultos de harina y arroz"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          {/* Amount & Currency */}
          <div className="p-3 bg-slate-100 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Monto Total Pagado:
              </label>
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    currency === 'USD' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  En USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('Bs')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    currency === 'Bs' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  En Bolívares (Bs)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">
                {currency === 'USD' ? '$' : 'Bs.'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold"
              />
            </div>

            <div className="text-[11px] text-slate-600 flex justify-between font-mono">
              <span>Equivalente: {currency === 'USD' ? `Bs. ${formatBs(amountBs)}` : `$ ${formatUSD(amountUSD)}`}</span>
              <span>Tasa BCV: Bs. {bcvRate.toFixed(2)}</span>
            </div>
          </div>

          {/* Fiscal SENIAT options */}
          <div className="space-y-1.5 p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs">
            <div className="font-bold text-teal-900 mb-1">Normativa Fiscal (SENIAT):</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasIVA}
                onChange={(e) => setHasIVA(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-slate-700">Incluye IVA 16% (Crédito Fiscal)</span>
            </label>

            {hasIVA && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyRetencionIVA}
                  onChange={(e) => setApplyRetencionIVA(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-700">Aplicar Retención de IVA 75% (Contribuyente Especial)</span>
              </label>
            )}

            {hasIVA && (
              <div className="pt-2 border-t border-teal-200/80 text-[11px] text-teal-900 font-mono grid grid-cols-2 gap-1">
                <div>Base Imp: Bs. {formatBs(baseImponibleBs)}</div>
                <div>IVA 16%: Bs. {formatBs(ivaBs)}</div>
                {applyRetencionIVA && <div>Ret. IVA: Bs. {formatBs(retencionIVABs)}</div>}
                <div>Ret. ISLR: Bs. {formatBs(retencionISLRBs)}</div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Método de Pago Egresado
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              >
                <option value="pago_movil">Pago Móvil</option>
                <option value="efectivo_usd">Efectivo USD (Caja)</option>
                <option value="efectivo_bs">Efectivo Bs (Caja)</option>
                <option value="debito">Punto / Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Referencia de Pago
              </label>
              <input
                type="text"
                placeholder="Ej: Ref 849201"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            {isCashRegisterOpen ? (
              <button
                type="submit"
                disabled={!supplierName.trim() || rawAmount <= 0}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Factura en Compras</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAperturaModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Abrir Caja para Registrar</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
