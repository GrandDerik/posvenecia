import React, { useState } from 'react';
import { Smartphone, X, Check, Building2, Hash, Phone, User } from 'lucide-react';
import { formatBs, formatUSD } from '../../utils/exportUtils';

interface PagoMovilModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalBs: number;
  totalUSD: number;
  businessPMInfo: {
    phone: string;
    ci: string;
    bank: string;
  };
  onConfirm: (details: { bank: string; ref: string; phone: string; ci: string }) => void;
}

const VENEZUELAN_BANKS = [
  '0102 - Banco de Venezuela',
  '0134 - Banesco',
  '0105 - Mercantil',
  '0108 - BBVA Provincial',
  '0191 - BNC (Banco Nacional de Crédito)',
  '0172 - Bancamiga',
  '0114 - Bancaribe',
  '0115 - Banco Exterior',
  '0175 - Banco Bicentenario',
  '0163 - Banco del Tesoro'
];

export const PagoMovilModal: React.FC<PagoMovilModalProps> = ({
  isOpen,
  onClose,
  totalBs,
  totalUSD,
  businessPMInfo,
  onConfirm
}) => {
  const [bank, setBank] = useState(VENEZUELAN_BANKS[0]);
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState('0414-');
  const [ci, setCi] = useState('V-');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref.trim()) return;
    onConfirm({ bank, ref: ref.trim(), phone, ci });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/40 text-white">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base">Registrar Pago Móvil</h3>
              <p className="text-xs text-blue-100">Ingrese referencia bancaria del cliente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Pago Móvil Data Box */}
        <div className="p-4 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 space-y-1">
          <div className="font-semibold text-blue-950 flex items-center justify-between">
            <span>Datos receptores del comercio:</span>
            <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">ACTIVO</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[11px]">
            <div><strong>Banco:</strong> {businessPMInfo.bank}</div>
            <div><strong>Teléfono:</strong> {businessPMInfo.phone}</div>
            <div><strong>Cédula/RIF:</strong> {businessPMInfo.ci}</div>
            <div className="text-right font-bold text-blue-950 text-xs">
              Monto: Bs. {formatBs(totalBs)}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Banco Emisor del Cliente
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {VENEZUELAN_BANKS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Número o Últimos 4 Dígitos de Referencia <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="Ej: 839201 o 4920"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono Origen (Opcional)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="0414-0000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cédula del Pagador
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="V-00000000"
                  value={ci}
                  onChange={(e) => setCi(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!ref.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Pago Móvil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
