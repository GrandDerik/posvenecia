import React, { useState } from 'react';
import { Users, X, DollarSign, Search, Check, AlertCircle, Calendar } from 'lucide-react';
import { formatBs, formatUSD, round2, safeDiv } from '../../utils/exportUtils';
import { FiadoRecord } from '../../types';

interface VentaFiadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUSD: number;
  bcvRate: number;
  existingFiados: FiadoRecord[];
  onConfirm: (data: {
    clientName: string;
    clientCI: string;
    clientPhone: string;
    clientAddress?: string;
    initialAbonoUSD: number;
    initialAbonoBs: number;
    abonoCurrency: 'USD' | 'Bs';
    remainingUSD: number;
  }) => void;
}

export const VentaFiadaModal: React.FC<VentaFiadaModalProps> = ({
  isOpen,
  onClose,
  totalUSD,
  bcvRate,
  existingFiados,
  onConfirm
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientCI, setClientCI] = useState('V-');
  const [clientPhone, setClientPhone] = useState('0414-');
  const [clientAddress, setClientAddress] = useState('');
  
  // Abono currency: 'USD' or 'Bs'
  const [abonoCurrency, setAbonoCurrency] = useState<'USD' | 'Bs'>('USD');
  const [abonoInput, setAbonoInput] = useState<string>('0');

  if (!isOpen) return null;

  // Compute calculated amounts
  const totalBs = round2(totalUSD * bcvRate);
  const numAbono = parseFloat(abonoInput) || 0;
  
  let initialAbonoUSD = 0;
  let initialAbonoBs = 0;

  if (abonoCurrency === 'USD') {
    initialAbonoUSD = round2(Math.min(totalUSD, Math.max(0, numAbono)));
    initialAbonoBs = round2(initialAbonoUSD * bcvRate);
  } else {
    initialAbonoBs = round2(Math.min(totalBs, Math.max(0, numAbono)));
    initialAbonoUSD = round2(safeDiv(initialAbonoBs, bcvRate));
  }

  const remainingUSD = round2(Math.max(0, totalUSD - initialAbonoUSD));
  const remainingBs = round2(remainingUSD * bcvRate);

  // Filter known clients from past fiados
  const matchingClients = existingFiados
    .filter(f => 
      searchTerm.trim().length > 1 && 
      (f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || f.clientCI.includes(searchTerm))
    )
    .slice(0, 3);

  const handleSelectClient = (f: FiadoRecord) => {
    setClientName(f.clientName);
    setClientCI(f.clientCI);
    setClientPhone(f.clientPhone || '');
    setClientAddress(f.clientAddress || '');
    setSearchTerm('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    onConfirm({
      clientName: clientName.trim(),
      clientCI: clientCI.trim(),
      clientPhone: clientPhone.trim(),
      clientAddress: clientAddress.trim(),
      initialAbonoUSD,
      initialAbonoBs,
      abonoCurrency,
      remainingUSD
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/40 text-white">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base">Configurar Venta Fiada</h3>
              <p className="text-xs text-amber-100">Registro de cuenta por cobrar indexada a tasa BCV</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Quick Client Search */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Buscar Cliente Habitual
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Escriba nombre o cédula para autocompletar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            {/* Suggestions dropdown */}
            {matchingClients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {matchingClients.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className="w-full px-3 py-2 text-left hover:bg-amber-50 text-xs flex items-center justify-between border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{c.clientName}</div>
                      <div className="text-[11px] text-slate-500">{c.clientCI} • {c.clientPhone}</div>
                    </div>
                    <span className="text-amber-700 font-semibold text-[10px] bg-amber-100 px-1.5 py-0.5 rounded">
                      Seleccionar
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre y Apellido <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Carmen Morales"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cédula / RIF <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="V-12345678"
                value={clientCI}
                onChange={(e) => setClientCI(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono WhatsApp
              </label>
              <input
                type="text"
                placeholder="0414-1234567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección / Referencia
              </label>
              <input
                type="text"
                placeholder="Calle Bolívar, Casa #4"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Abono Inicial Section */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Abono Inicial del Cliente:
              </label>
              {/* Currency toggle for abono */}
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAbonoCurrency('USD')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    abonoCurrency === 'USD' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  En USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setAbonoCurrency('Bs')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    abonoCurrency === 'Bs' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  En Bolívares (Bs)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  {abonoCurrency === 'USD' ? '$' : 'Bs.'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={abonoCurrency === 'USD' ? totalUSD : totalBs}
                  value={abonoInput}
                  onChange={(e) => setAbonoInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900"
                />
              </div>

              {/* Quick Zero button or Full button */}
              <button
                type="button"
                onClick={() => setAbonoInput('0')}
                className="px-2.5 py-2 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl"
              >
                $0 Abono
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>Total de la Compra: <strong>${formatUSD(totalUSD)}</strong> (Bs. {formatBs(totalBs)})</span>
              <span>Abono equiv: {abonoCurrency === 'USD' ? `Bs. ${formatBs(initialAbonoBs)}` : `$ ${formatUSD(initialAbonoUSD)}`}</span>
            </div>
          </div>

          {/* Automatic Calculation Banner: "Quedará Debiendo: $X.XX" */}
          <div className="p-4 bg-gradient-to-r from-amber-900 to-slate-900 text-white rounded-xl shadow-md border border-amber-800">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
              Resultado del Crédito
            </span>
            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="text-xs text-slate-300">Quedará Debiendo:</div>
                <div className="text-2xl font-black text-amber-300 font-mono-numbers">
                  ${formatUSD(remainingUSD)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-300">Equivalente a tasa BCV:</div>
                <div className="text-lg font-bold text-white font-mono-numbers">
                  Bs. {formatBs(remainingBs)}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-amber-200/80 mt-2 border-t border-amber-800/60 pt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>La deuda se mantiene fijada en USD y se liquida al valor BCV del día de cobro.</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors"
            >
              Cancelar Operación
            </button>

            <button
              type="submit"
              disabled={!clientName.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Finalizar y Registrar Fiado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
