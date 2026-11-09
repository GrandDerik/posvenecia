import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Truck, 
  Bike, 
  Package, 
  Zap, 
  Plus, 
  X, 
  DollarSign, 
  Percent, 
  Check, 
  ShieldCheck,
  MapPin
} from 'lucide-react';
import { formatBs, formatUSD } from '../../utils/exportUtils';

interface RecargoModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotalUSD: number;
}

export const RecargoModal: React.FC<RecargoModalProps> = ({
  isOpen,
  onClose,
  subtotalUSD
}) => {
  const { bcvRate, addQuickService } = useApp();

  const [concept, setConcept] = useState('Delivery en Moto');
  const [chargeType, setChargeType] = useState<'fixed_usd' | 'fixed_bs' | 'percent'>('fixed_usd');
  const [amountInput, setAmountInput] = useState<string>('1.50');
  const [isExemptIVA, setIsExemptIVA] = useState<boolean>(true);
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  if (!isOpen) return null;

  const presets = [
    { name: 'Delivery en Moto', amountUSD: 1.50, icon: Bike, desc: 'Entregas rápidas locales' },
    { name: 'Delivery en Carro / Flete', amountUSD: 3.00, icon: Truck, desc: 'Cajas o pedidos voluminosos' },
    { name: 'Servicio Express Urgente', amountUSD: 2.00, icon: Zap, desc: 'Prioridad de despacho inmediato' },
    { name: 'Empaque / Embalaje Especial', amountUSD: 0.50, icon: Package, desc: 'Protección para traslados' },
    { name: 'Envío Foráneo / Nacional', amountUSD: 5.00, icon: MapPin, desc: 'Envío por MRW / Zoom / Tealca' }
  ];

  const handleSelectPreset = (p: typeof presets[0]) => {
    setConcept(p.name);
    setChargeType('fixed_usd');
    setAmountInput(p.amountUSD.toString());
  };

  // Calculate equivalent USD amount
  const parsedValue = parseFloat(amountInput) || 0;
  let finalUSD = 0;

  if (chargeType === 'fixed_usd') {
    finalUSD = parsedValue;
  } else if (chargeType === 'fixed_bs') {
    finalUSD = parsedValue / (bcvRate || 1);
  } else if (chargeType === 'percent') {
    finalUSD = (subtotalUSD * parsedValue) / 100;
  }

  const finalBs = finalUSD * bcvRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finalUSD <= 0) return;

    const formattedNotes = deliveryNotes.trim() ? deliveryNotes.trim() : undefined;

    addQuickService({
      name: `Recargo: ${concept.trim()}`,
      category: 'Recargo / Delivery',
      priceUSD: Number(finalUSD.toFixed(2)),
      quantity: 1,
      isExemptFromIVA: isExemptIVA,
      notes: formattedNotes
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">Agregar Recargo o Delivery</h3>
              <p className="text-xs text-blue-100">Cargos adicionales, delivery a domicilio o servicios de despacho</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Recargos Frecuentes:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((p, idx) => {
                const IconComponent = p.icon;
                const isSelected = concept === p.name && chargeType === 'fixed_usd' && parseFloat(amountInput) === p.amountUSD;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`p-2.5 rounded-xl border text-left transition-all text-xs flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600">
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-800 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.desc}</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-blue-700 text-xs whitespace-nowrap">
                      ${formatUSD(p.amountUSD)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Surcharge Name / Concept */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre o Concepto del Recargo: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Delivery a Chacao / Empaque frágil"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Charge Type selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Cálculo:
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setChargeType('fixed_usd')}
                className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1 ${
                  chargeType === 'fixed_usd'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Monto USD ($)</span>
              </button>

              <button
                type="button"
                onClick={() => setChargeType('fixed_bs')}
                className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1 ${
                  chargeType === 'fixed_bs'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>Bs. Bolívares</span>
              </button>

              <button
                type="button"
                onClick={() => setChargeType('percent')}
                className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1 ${
                  chargeType === 'percent'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Porcentaje (%)</span>
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {chargeType === 'fixed_usd' ? 'Monto del Recargo en Dólares ($):' : chargeType === 'fixed_bs' ? 'Monto del Recargo en Bolívares (Bs.):' : 'Porcentaje sobre Subtotal (%):'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                {chargeType === 'fixed_usd' ? '$' : chargeType === 'fixed_bs' ? 'Bs.' : '%'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Destination / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dirección de Entrega o Datos del Delivery (Opcional):
            </label>
            <input
              type="text"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Ej: Av. Francisco de Miranda, Res. Avila, Apto 4-B. Tel: 0414-1122334"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tax treatment */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Tratamiento Fiscal (SENIAT)</span>
                <span className="text-[10px] text-slate-500">
                  {isExemptIVA ? 'Recargo exento de IVA (Transporte / Flete)' : 'Gravado con alícuota general 16%'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExemptIVA(!isExemptIVA)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                isExemptIVA
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
            >
              {isExemptIVA ? 'Exento (E)' : 'IVA 16% (G)'}
            </button>
          </div>

          {/* Total Box */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-300 uppercase tracking-wider font-bold block">
                Total Recargo a Sumar
              </span>
              <span className="text-xs text-slate-300">
                Se agregará al ticket de venta
              </span>
            </div>

            <div className="text-right">
              <div className="text-lg font-black text-white font-mono-numbers">
                +${formatUSD(finalUSD)}
              </div>
              <div className="text-xs font-extrabold text-blue-300 font-mono-numbers">
                +Bs. {formatBs(finalBs)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={finalUSD <= 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md shadow-blue-500/25 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Aplicar Recargo a la Venta</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
