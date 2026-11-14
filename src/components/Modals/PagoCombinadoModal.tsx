import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Layers, 
  X, 
  Check, 
  DollarSign, 
  Smartphone, 
  CreditCard, 
  Banknote, 
  Users,
  Building,
  Landmark,
  AlertCircle,
  HelpCircle,
  PlusCircle
} from 'lucide-react';
import { formatBs, formatUSD, round2, safeDiv } from '../../utils/exportUtils';

interface PagoCombinadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUSD: number;
  totalBs: number;
  bcvRate: number;
  onConfirm: (breakdown: {
    usdCash?: number;
    bsCash?: number;
    pagoMovil?: number;
    pagoMovilRef?: string;
    pagoMovilBank?: string;
    pagoMovilPhone?: string;
    debito?: number;
    debitoRef?: string;
    debitoBank?: string;
    fiaoRemaining?: number;
    transferencia?: number;
    transferenciaRef?: string;
    transferenciaBank?: string;
    notes?: string;
  }) => void;
}

export const PagoCombinadoModal: React.FC<PagoCombinadoModalProps> = ({
  isOpen,
  onClose,
  totalUSD,
  totalBs,
  bcvRate,
  onConfirm
}) => {
  const { businessInfo } = useApp();

  // Enabled methods checkboxes / toggles
  const [useUsdCash, setUseUsdCash] = useState<boolean>(true);
  const [useBsCash, setUseBsCash] = useState<boolean>(false);
  const [usePagoMovil, setUsePagoMovil] = useState<boolean>(true);
  const [useDebito, setUseDebito] = useState<boolean>(false);
  const [useFiado, setUseFiado] = useState<boolean>(false);
  const [useTransferencia, setUseTransferencia] = useState<boolean>(false);

  // Field values
  const [usdCash, setUsdCash] = useState<string>('0');
  const [bsCash, setBsCash] = useState<string>('0');
  
  const [pagoMovil, setPagoMovil] = useState<string>('0');
  const [pagoMovilRef, setPagoMovilRef] = useState<string>('');
  const [pagoMovilBank, setPagoMovilBank] = useState<string>('Banesco');
  const [pagoMovilPhone, setPagoMovilPhone] = useState<string>('');

  const [debito, setDebito] = useState<string>('0');
  const [debitoRef, setDebitoRef] = useState<string>('');
  const [debitoBank, setDebitoBank] = useState<string>('Banesco');

  const [fiaoRemaining, setFiaoRemaining] = useState<string>('0');

  const [transferencia, setTransferencia] = useState<string>('0');
  const [transferenciaRef, setTransferenciaRef] = useState<string>('');
  const [transferenciaBank, setTransferenciaBank] = useState<string>('Banesco');

  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const numUsdCash = useUsdCash ? (parseFloat(usdCash) || 0) : 0;
  const numBsCash = useBsCash ? (parseFloat(bsCash) || 0) : 0;
  const numPagoMovil = usePagoMovil ? (parseFloat(pagoMovil) || 0) : 0;
  const numDebito = useDebito ? (parseFloat(debito) || 0) : 0;
  const numFiado = useFiado ? (parseFloat(fiaoRemaining) || 0) : 0;
  const numTransferencia = useTransferencia ? (parseFloat(transferencia) || 0) : 0;

  // Convert all Bs parts to USD for consolidated comparison
  const totalCoveredUSD = round2(
    numUsdCash + 
    safeDiv(numBsCash, bcvRate) + 
    safeDiv(numPagoMovil, bcvRate) + 
    safeDiv(numDebito, bcvRate) + 
    numFiado + 
    safeDiv(numTransferencia, bcvRate)
  );

  const remainingUSD = round2(totalUSD - totalCoveredUSD);
  const isComplete = Math.abs(remainingUSD) < 0.05;
  const remainingBs = round2(remainingUSD * bcvRate);

  const handleSetExactRemaining = (field: 'usd' | 'bs' | 'pm' | 'deb' | 'fiao' | 'trans') => {
    const neededUSD = Math.max(0, remainingUSD);
    if (field === 'usd') {
      setUseUsdCash(true);
      setUsdCash((numUsdCash + neededUSD).toFixed(2));
    } else if (field === 'bs') {
      setUseBsCash(true);
      setBsCash((numBsCash + (neededUSD * bcvRate)).toFixed(2));
    } else if (field === 'pm') {
      setUsePagoMovil(true);
      setPagoMovil((numPagoMovil + (neededUSD * bcvRate)).toFixed(2));
    } else if (field === 'deb') {
      setUseDebito(true);
      setDebito((numDebito + (neededUSD * bcvRate)).toFixed(2));
    } else if (field === 'fiao') {
      setUseFiado(true);
      setFiaoRemaining((numFiado + neededUSD).toFixed(2));
    } else if (field === 'trans') {
      setUseTransferencia(true);
      setTransferencia((numTransferencia + (neededUSD * bcvRate)).toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete && remainingUSD > 0.05) return;

    onConfirm({
      usdCash: useUsdCash ? numUsdCash : 0,
      bsCash: useBsCash ? numBsCash : 0,
      pagoMovil: usePagoMovil ? numPagoMovil : 0,
      pagoMovilRef: usePagoMovil ? pagoMovilRef.trim() : undefined,
      pagoMovilBank: usePagoMovil ? pagoMovilBank : undefined,
      pagoMovilPhone: usePagoMovil ? pagoMovilPhone.trim() : undefined,
      debito: useDebito ? numDebito : 0,
      debitoRef: useDebito ? debitoRef.trim() : undefined,
      debitoBank: useDebito ? debitoBank : undefined,
      fiaoRemaining: useFiado ? numFiado : 0,
      transferencia: useTransferencia ? numTransferencia : 0,
      transferenciaRef: useTransferencia ? transferenciaRef.trim() : undefined,
      transferenciaBank: useTransferencia ? transferenciaBank : undefined,
      notes: notes.trim() || undefined
    });
  };

  const VENEZUELAN_BANKS = [
    'Banesco (0134)',
    'Banco de Venezuela (0102)',
    'Mercantil (0105)',
    'BBVA Provincial (0108)',
    'Bancaribe (0114)',
    'Banco Nacional de Crédito BNC (0191)',
    'BAM / Banco Activo (0171)',
    'BFC Banco Fondo Común (0151)',
    '100% Banco (0156)',
    'Bancamiga (0172)',
    'Banplus (0174)',
    'Bancaribe (0114)',
    'Otros Bancos'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">Pago Combinado / Varios Métodos</h3>
              <p className="text-xs text-blue-100">Divida la cuenta entre divisas, bolívares, pago móvil, tarjeta o crédito</p>
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

        {/* Total Summary Sticky Bar */}
        <div className="p-3 sm:p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 font-medium">Monto Total de la Venta:</span>
            <div className="text-base sm:text-lg font-black text-slate-900 font-mono-numbers">
              ${formatUSD(totalUSD)} <span className="text-xs font-bold text-blue-700">({formatBs(totalBs)} Bs.)</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-slate-500 font-medium">
              {remainingUSD > 0.05 ? 'Por Cubrir:' : remainingUSD < -0.05 ? 'Cambio / Vuelto:' : 'Estado:'}
            </span>
            <div className={`text-base sm:text-lg font-black font-mono-numbers ${
              remainingUSD > 0.05 
                ? 'text-rose-600' 
                : remainingUSD < -0.05 
                  ? 'text-amber-600' 
                  : 'text-emerald-600'
            }`}>
              {remainingUSD > 0.05 
                ? `$${formatUSD(remainingUSD)}` 
                : remainingUSD < -0.05 
                  ? `Vuelto: $${formatUSD(Math.abs(remainingUSD))}` 
                  : '✓ Completo'}
            </div>
            {remainingUSD > 0.05 && (
              <span className="text-[10px] text-slate-500 font-mono">
                (Bs. {formatBs(remainingBs)})
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          
          {/* Method 1: Efectivo USD ($) */}
          <div className={`p-3 rounded-2xl border transition-all ${
            useUsdCash ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-500/20' : 'bg-slate-50 border-slate-200 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={useUsdCash}
                  onChange={(e) => setUseUsdCash(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Efectivo en Dólares ($)
                </span>
              </label>

              {useUsdCash && (
                <button
                  type="button"
                  onClick={() => handleSetExactRemaining('usd')}
                  className="text-[10px] text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded font-bold transition-colors"
                >
                  Pagar restante
                </button>
              )}
            </div>

            {useUsdCash && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">Monto en Dólares ($):</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={usdCash}
                      onChange={(e) => setUsdCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end text-xs text-slate-500 sm:pt-4">
                  <span>Equiv: <strong>Bs. {formatBs(numUsdCash * bcvRate)}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Method 2: Efectivo Bs */}
          <div className={`p-3 rounded-2xl border transition-all ${
            useBsCash ? 'bg-teal-50/50 border-teal-300 ring-1 ring-teal-500/20' : 'bg-slate-50 border-slate-200 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={useBsCash}
                  onChange={(e) => setUseBsCash(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <Banknote className="w-4 h-4 text-teal-600" />
                  Efectivo en Bolívares (Bs.)
                </span>
              </label>

              {useBsCash && (
                <button
                  type="button"
                  onClick={() => handleSetExactRemaining('bs')}
                  className="text-[10px] text-teal-700 bg-teal-100 hover:bg-teal-200 px-2 py-0.5 rounded font-bold transition-colors"
                >
                  Pagar restante
                </button>
              )}
            </div>

            {useBsCash && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">Monto en Bolívares (Bs.):</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bsCash}
                      onChange={(e) => setBsCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end text-xs text-slate-500 sm:pt-4">
                  <span>Equiv: <strong>${formatUSD(safeDiv(numBsCash, bcvRate))}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Method 3: Pago Móvil */}
          <div className={`p-3 rounded-2xl border transition-all ${
            usePagoMovil ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-500/20' : 'bg-slate-50 border-slate-200 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={usePagoMovil}
                  onChange={(e) => setUsePagoMovil(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  Pago Móvil (Bs.)
                </span>
              </label>

              {usePagoMovil && (
                <button
                  type="button"
                  onClick={() => handleSetExactRemaining('pm')}
                  className="text-[10px] text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded font-bold transition-colors"
                >
                  Pagar restante
                </button>
              )}
            </div>

            {usePagoMovil && (
              <div className="space-y-2 mt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">Monto Pago Móvil (Bs.):</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pagoMovil}
                      onChange={(e) => setPagoMovil(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">N° Referencia (Últimos 4 o completo):</span>
                    <input
                      type="text"
                      value={pagoMovilRef}
                      onChange={(e) => setPagoMovilRef(e.target.value)}
                      placeholder="Ej: 8492"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">Banco Receptor:</span>
                    <select
                      value={pagoMovilBank}
                      onChange={(e) => setPagoMovilBank(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                    >
                      {VENEZUELAN_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">Teléfono Pagador (Opcional):</span>
                    <input
                      type="text"
                      value={pagoMovilPhone}
                      onChange={(e) => setPagoMovilPhone(e.target.value)}
                      placeholder="0414-0000000"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Method 4: Punto de Débito */}
          <div className={`p-3 rounded-2xl border transition-all ${
            useDebito ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-500/20' : 'bg-slate-50 border-slate-200 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={useDebito}
                  onChange={(e) => setUseDebito(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Punto de Débito (Tarjeta en Terminal)
                </span>
              </label>

              {useDebito && (
                <button
                  type="button"
                  onClick={() => handleSetExactRemaining('deb')}
                  className="text-[10px] text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition-colors"
                >
                  Pagar restante
                </button>
              )}
            </div>

            {useDebito && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">Monto en Punto Débito (Bs.):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={debito}
                    onChange={(e) => setDebito(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">N° Aprobación POS:</span>
                  <input
                    type="text"
                    value={debitoRef}
                    onChange={(e) => setDebitoRef(e.target.value)}
                    placeholder="Ej: 004128"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Method: Transferencia Bancaria */}
          <div className={`p-3 rounded-2xl border transition-all ${
            useTransferencia ? 'bg-cyan-50/50 border-cyan-300 ring-1 ring-cyan-500/20' : 'bg-slate-50 border-slate-200 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={useTransferencia}
                  onChange={(e) => setUseTransferencia(e.target.checked)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Landmark className="w-4 h-4 text-cyan-600" />
                  Transferencia Bancaria (Bs.)
                </span>
              </label>

              {useTransferencia && (
                <button
                  type="button"
                  onClick={() => handleSetExactRemaining('trans')}
                  className="text-[10px] text-cyan-800 bg-cyan-100 hover:bg-cyan-200 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                >
                  Pagar restante
                </button>
              )}
            </div>

            {useTransferencia && (
              <div className="space-y-2 mt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">Monto en Transferencia (Bs.):</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transferencia}
                      onChange={(e) => setTransferencia(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">N° Referencia Transferencia:</span>
                    <input
                      type="text"
                      value={transferenciaRef}
                      onChange={(e) => setTransferenciaRef(e.target.value)}
                      placeholder="Ej: TR-998822"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">Cuenta Bancaria Receptora:</span>
                  <select
                    value={transferenciaBank}
                    onChange={(e) => setTransferenciaBank(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                  >
                    {businessInfo.bankAccounts && businessInfo.bankAccounts.length > 0 ? (
                      businessInfo.bankAccounts.map((b) => (
                        <option key={b.id} value={`${b.bank} - ${b.accountNumber.slice(-4)}`}>
                          {b.bank} (••• {b.accountNumber.slice(-4)})
                        </option>
                      ))
                    ) : (
                      VENEZUELAN_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Method 5: Fiado Parcial / Saldo Restante a Crédito */}
          <div className={`p-3 rounded-2xl border transition-all ${
            useFiado ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-500/20' : 'bg-slate-50 border-slate-200 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={useFiado}
                  onChange={(e) => setUseFiado(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-amber-600" />
                  Saldo Fiado / Queda Debiendo el Cliente ($)
                </span>
              </label>

              {useFiado && (
                <button
                  type="button"
                  onClick={() => handleSetExactRemaining('fiao')}
                  className="text-[10px] text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded font-bold transition-colors"
                >
                  Fiar restante
                </button>
              )}
            </div>

            {useFiado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">Monto que queda Debiendo ($ USD):</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fiaoRemaining}
                      onChange={(e) => setFiaoRemaining(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-amber-900"
                    />
                  </div>
                </div>

                <div className="flex items-center text-xs text-amber-800 sm:pt-4">
                  <span>Equivalente en Bs: <strong>Bs. {formatBs(numFiado * bcvRate)}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Status Feedback */}
          {remainingUSD > 0.05 ? (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>
                Falta por cubrir <strong>${formatUSD(remainingUSD)}</strong> (Bs. {formatBs(remainingBs)}). Presione "Pagar restante" en el método que corresponda.
              </span>
            </div>
          ) : remainingUSD < -0.05 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                El monto ingresado sobrepasa el total. <strong>Vuelto / Cambio a entregar: ${formatUSD(Math.abs(remainingUSD))}</strong> (Bs. {formatBs(Math.abs(remainingBs))}).
              </span>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>¡Monto cubierto exactamente al 100%! Listo para procesar la venta.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200"
            >
              Cancelar Operación
            </button>

            <button
              type="submit"
              disabled={remainingUSD > 0.05}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar y Procesar Cobro</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
