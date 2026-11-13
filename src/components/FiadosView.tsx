import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  Plus, 
  Search, 
  DollarSign, 
  Phone, 
  MessageCircle, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  X, 
  Check,
  ChevronDown,
  ChevronUp,
  Receipt
} from 'lucide-react';
import { FiadoRecord, PaymentMethod } from '../types';
import { formatBs, formatUSD } from '../utils/exportUtils';

export const FiadosView: React.FC = () => {
  const { fiados, addAbonoToFiado, createManualFiado, bcvRate, businessInfo } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'parcial' | 'saldado'>('todos');
  
  // Abono modal
  const [selectedFiadoForAbono, setSelectedFiadoForAbono] = useState<FiadoRecord | null>(null);
  const [abonoCurrency, setAbonoCurrency] = useState<'USD' | 'Bs'>('USD');
  const [abonoAmountInput, setAbonoAmountInput] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('pago_movil');
  const [abonoRef, setAbonoRef] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');

  // Create manual fiado modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCI, setNewClientCI] = useState('V-');
  const [newClientPhone, setNewClientPhone] = useState('0414-');
  const [newDebtUSD, setNewDebtUSD] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Expanded rows for abonos history
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Copied reminder banner
  const [copiedReminderId, setCopiedReminderId] = useState<string | null>(null);

  // Filtered fiados
  const filtered = fiados.filter(f => {
    const matchesSearch = f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          f.clientCI.includes(searchTerm);
    const matchesStatus = statusFilter === 'todos' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Totals indexed to current BCV rate
  const activeFiados = fiados.filter(f => f.status !== 'saldado');
  const totalDebtUSD = activeFiados.reduce((a, f) => a + f.remainingDebtUSD, 0);
  const totalDebtBs = totalDebtUSD * bcvRate;

  // Total collected through abonos
  const totalCollectedUSD = fiados.reduce((acc, f) => {
    return acc + f.abonos.reduce((subAcc, a) => subAcc + a.amountUSD, 0);
  }, 0);

  const handleOpenAbono = (f: FiadoRecord) => {
    setSelectedFiadoForAbono(f);
    setAbonoCurrency('USD');
    setAbonoAmountInput(f.remainingDebtUSD.toFixed(2));
    setAbonoMethod('pago_movil');
    setAbonoRef('');
    setAbonoNotes('Abono a cuenta');
  };

  const handleConfirmAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiadoForAbono) return;
    const rawVal = parseFloat(abonoAmountInput) || 0;
    if (rawVal <= 0) return;

    const amountUSD = abonoCurrency === 'USD' ? rawVal : rawVal / bcvRate;
    addAbonoToFiado(selectedFiadoForAbono.id, amountUSD, abonoMethod, abonoRef, abonoNotes);
    setSelectedFiadoForAbono(null);
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newDebtUSD) return;
    createManualFiado({
      clientName: newClientName.trim(),
      clientCI: newClientCI.trim(),
      clientPhone: newClientPhone.trim(),
      debtUSD: parseFloat(newDebtUSD) || 0,
      notes: newNotes.trim()
    });
    setIsManualModalOpen(false);
  };

  const handleSendWhatsAppReminder = (f: FiadoRecord) => {
    const debtUSD = f.remainingDebtUSD;
    const debtBs = debtUSD * bcvRate;
    const message = 
`Hola ${f.clientName}, un saludo cordial de *${businessInfo.name}*.
Le recordamos que mantiene un saldo pendiente de:
💵 *$${formatUSD(debtUSD)} USD*
🇻🇪 *Bs. ${formatBs(debtBs)}* (a la tasa oficial BCV: Bs. ${bcvRate.toFixed(2)})

Para cancelar mediante Pago Móvil:
• Banco: ${businessInfo.pagoMovilBank}
• Teléfono: ${businessInfo.pagoMovilPhone}
• Cédula/RIF: ${businessInfo.pagoMovilCI}

¡Muchas gracias por su preferencia!`;

    navigator.clipboard.writeText(message);
    setCopiedReminderId(f.id);
    setTimeout(() => setCopiedReminderId(null), 3000);

    const cleanPhone = f.clientPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      const waPhone = cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone.replace(/^0/, '')}`;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Control de Fiados & Cuentas por Cobrar
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Indexación automática en Bolívares según la tasa oficial BCV del día: <strong className="text-amber-800 font-mono">Bs. {bcvRate.toFixed(2)}</strong>
          </p>
        </div>

        <button
          onClick={() => {
            setNewClientName('');
            setNewClientCI('V-');
            setNewClientPhone('0414-');
            setNewDebtUSD('');
            setNewNotes('');
            setIsManualModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Fiado Manual</span>
        </button>
      </div>

      {/* Indexation Warning Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="text-xs text-amber-900">
          <strong className="font-bold">Principio de Indexación Cambiaria (Comercio Venezuela):</strong>
          <span className="ml-1 text-amber-800">
            Los créditos otorgados se fijan en USD para proteger el capital de trabajo de la devaluación. Cuando el cliente paga en Bolívares (Pago Móvil o efectivo), el saldo se liquida a la tasa oficial BCV del momento del abono.
          </span>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Deuda en USD
          </span>
          <div className="text-2xl font-black text-amber-900 font-mono-numbers mt-1">
            ${formatUSD(totalDebtUSD)}
          </div>
          <span className="text-xs text-slate-400">Capital otorgado pendiente</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Deuda Indexada (Bs)
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
            Bs. {formatBs(totalDebtBs)}
          </div>
          <span className="text-xs text-blue-700 font-semibold">A tasa BCV de Bs. {formatBs(bcvRate)}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Clientes con Deuda Activa
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono-numbers mt-1">
            {activeFiados.length}
          </div>
          <span className="text-xs text-slate-400">Deudores en cuenta</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Cobrado en Abonos
          </span>
          <div className="text-2xl font-black text-emerald-700 font-mono-numbers mt-1">
            ${formatUSD(totalCollectedUSD)}
          </div>
          <span className="text-xs text-slate-400">Recuperación acumulada</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar deudor por nombre o cédula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'pendiente', label: 'Pendientes' },
            { id: 'parcial', label: 'Parciales' },
            { id: 'saldado', label: 'Saldados' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === tab.id ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fiados List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Cliente / Cédula</th>
                <th className="py-3 px-4">Fecha / Factura</th>
                <th className="py-3 px-4">Teléfono</th>
                <th className="py-3 px-4 text-right">Deuda Inicial</th>
                <th className="py-3 px-4 text-right">Resta ($)</th>
                <th className="py-3 px-4 text-right">Resta (Bs Hoy)</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((fiado) => {
                const isExpanded = expandedId === fiado.id;
                const remainingBs = fiado.remainingDebtUSD * bcvRate;

                return (
                  <React.Fragment key={fiado.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{fiado.clientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">{fiado.clientCI}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{new Date(fiado.date).toLocaleDateString('es-VE')}</div>
                        <div className="text-[10px] text-teal-700 font-mono">{fiado.invoiceNumber}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        {fiado.clientPhone || 'Sin teléfono'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        ${formatUSD(fiado.originalDebtUSD)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-amber-900 text-sm">
                        ${formatUSD(fiado.remainingDebtUSD)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        Bs. {formatBs(remainingBs)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          fiado.status === 'saldado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fiado.status === 'parcial'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fiado.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Abono Button */}
                          {fiado.remainingDebtUSD > 0 && (
                            <button
                              onClick={() => handleOpenAbono(fiado)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Abonar</span>
                            </button>
                          )}

                          {/* WhatsApp Reminder Button */}
                          <button
                            onClick={() => handleSendWhatsAppReminder(fiado)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                            title="Enviar / Copiar Recordatorio WhatsApp con tasa BCV"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* Expand Abonos History */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : fiado.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Historial de Abonos"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Copied feedback notification */}
                    {copiedReminderId === fiado.id && (
                      <tr>
                        <td colSpan={8} className="bg-emerald-50 text-emerald-800 px-4 py-2 text-xs font-semibold text-center border-b border-emerald-200">
                          ✓ Mensaje de cobro copiado al portapapeles y enlace de WhatsApp abierto para {fiado.clientName}.
                        </td>
                      </tr>
                    )}

                    {/* Expanded Abonos Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={8} className="p-4 border-y border-slate-200">
                          <div className="max-w-2xl mx-auto space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span>Historial de Abonos ({fiado.abonos.length} pagos)</span>
                              <span className="text-slate-500 font-normal">Notas: {fiado.notes || 'Ninguna'}</span>
                            </div>

                            {fiado.abonos.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">No se han registrado abonos todavía.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {fiado.abonos.map(abono => (
                                  <div key={abono.id} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-mono">
                                    <div>
                                      <div className="font-bold text-slate-800 font-sans">
                                        {abono.paymentMethod.replace('_', ' ').toUpperCase()}
                                        {abono.reference && ` (Ref: #${abono.reference})`}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {new Date(abono.date).toLocaleString('es-VE')} • Tasa: Bs. {abono.bcvRate.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-emerald-700 font-bold">+${formatUSD(abono.amountUSD)}</div>
                                      <div className="text-[10px] text-slate-500">Bs. {formatBs(abono.amountBs)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registrar Abono Modal */}
      {selectedFiadoForAbono && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Registrar Abono a Cuenta</h3>
                <p className="text-xs text-amber-100">{selectedFiadoForAbono.clientName} ({selectedFiadoForAbono.clientCI})</p>
              </div>
              <button onClick={() => setSelectedFiadoForAbono(null)} className="text-white hover:bg-white/10 p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAbono} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                <span>Deuda Actual:</span>
                <div className="text-right font-mono">
                  <div className="font-black text-amber-900 text-base">${formatUSD(selectedFiadoForAbono.remainingDebtUSD)}</div>
                  <div className="text-[11px] text-amber-700">Bs. {formatBs(selectedFiadoForAbono.remainingDebtUSD * bcvRate)}</div>
                </div>
              </div>

              {/* Currency Selector for Abono */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Monto del Abono:</label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setAbonoCurrency('USD')}
                      className={`px-2 py-0.5 rounded-md ${abonoCurrency === 'USD' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
                    >
                      En USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbonoCurrency('Bs')}
                      className={`px-2 py-0.5 rounded-md ${abonoCurrency === 'Bs' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
                    >
                      En Bolívares (Bs)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-xs text-slate-400">
                    {abonoCurrency === 'USD' ? '$' : 'Bs.'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={abonoAmountInput}
                    onChange={(e) => setAbonoAmountInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medio de Pago Recibido
                </label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                >
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="efectivo_usd">Efectivo USD (Divisas)</option>
                  <option value="efectivo_bs">Efectivo Bolívares</option>
                  <option value="debito">Punto de Débito / Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Referencia Bancaria (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Ref #904128"
                  value={abonoRef}
                  onChange={(e) => setAbonoRef(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFiadoForAbono(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Registrar Abono</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Fiado Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Registrar Nuevo Fiado Manual</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-white hover:bg-white/10 p-1 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Completo del Cliente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Alejandro Mendoza"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cédula / RIF <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="V-22119044"
                    value={newClientCI}
                    onChange={(e) => setNewClientCI(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="0414-0000000"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monto de la Deuda en USD ($) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  required
                  placeholder="25.00"
                  value={newDebtUSD}
                  onChange={(e) => setNewDebtUSD(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Equivalente a tasa BCV: Bs. {formatBs((parseFloat(newDebtUSD) || 0) * bcvRate)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones / Artículos fiados
                </label>
                <input
                  type="text"
                  placeholder="Mercancía surtida víveres fin de mes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Crear Cuenta Fiada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
