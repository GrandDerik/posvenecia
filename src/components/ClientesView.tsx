import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  Mail, 
  CreditCard, 
  ShoppingCart, 
  Edit, 
  Trash2, 
  MessageCircle, 
  Check, 
  X, 
  AlertCircle,
  FileText,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { Client } from '../types';
import { formatBs, formatUSD } from '../utils/exportUtils';

export const ClientesView: React.FC = () => {
  const { 
    clients, 
    addClient, 
    updateClient, 
    deleteClient, 
    setSelectedClientForPOS, 
    setActiveTab, 
    fiados, 
    bcvRate 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [rifPrefix, setRifPrefix] = useState<'V' | 'J' | 'E' | 'G'>('V');
  const [rifNumber, setRifNumber] = useState('');
  const [phone, setPhone] = useState('0414-');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimitUSD, setCreditLimitUSD] = useState('50');
  const [notes, setNotes] = useState('');

  // Search filter
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingClient(null);
    setName('');
    setRifPrefix('V');
    setRifNumber('');
    setPhone('0414-');
    setAddress('');
    setEmail('');
    setCreditLimitUSD('50');
    setNotes('');
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    const parts = client.rif.split('-');
    if (parts.length > 1 && ['V', 'J', 'E', 'G'].includes(parts[0])) {
      setRifPrefix(parts[0] as any);
      setRifNumber(parts.slice(1).join('-'));
    } else {
      setRifPrefix('V');
      setRifNumber(client.rif.replace(/^[VJEG]-?/, ''));
    }
    setPhone(client.phone);
    setAddress(client.address || '');
    setEmail(client.email || '');
    setCreditLimitUSD(client.creditLimitUSD ? client.creditLimitUSD.toString() : '50');
    setNotes(client.notes || '');
    setIsModalOpen(true);
  };

  // Save client submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const fullRIF = `${rifPrefix}-${rifNumber.trim()}`;
    const clientPayload = {
      name: name.trim(),
      rif: fullRIF,
      phone: phone.trim(),
      address: address.trim(),
      email: email.trim(),
      creditLimitUSD: parseFloat(creditLimitUSD) || 0,
      notes: notes.trim()
    };

    if (editingClient) {
      updateClient({
        ...editingClient,
        ...clientPayload
      });
    } else {
      addClient(clientPayload);
    }

    setIsModalOpen(false);
  };

  // Direct sale to this client
  const handleStartSale = (client: Client) => {
    setSelectedClientForPOS(client);
    setActiveTab('vender');
  };

  // WhatsApp shortcut
  const handleWhatsApp = (client: Client) => {
    const cleanPhone = client.phone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (finalPhone.startsWith('0')) {
      finalPhone = '58' + finalPhone.substring(1);
    }
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(`Hola estimado(a) ${client.name}, le saludamos de PosVenecia.`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Compute pending fiados for a client
  const getClientPendingFiado = (clientRif: string) => {
    const activeClientFiados = fiados.filter(f => 
      f.status !== 'saldado' && 
      (f.clientCI.replace(/\D/g, '') === clientRif.replace(/\D/g, '') || f.clientCI === clientRif)
    );
    return activeClientFiados.reduce((acc, f) => acc + f.remainingDebtUSD, 0);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      
      {/* Top Banner */}
      <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0B1528] flex items-center justify-center text-white shadow-sm shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#0B1528] tracking-tight leading-tight">
              Clientes Habituales & Cuentas
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestiona los datos de tus clientes frecuentes, teléfonos para cobro y límites de fiado.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <div className="bg-white/95 rounded-2xl border border-[#DCE4F0] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Clientes Registrados
          </span>
          <div className="text-xl font-black text-[#0B1528] mt-1 font-mono-numbers">
            {clients.length} <span className="text-xs font-sans font-semibold text-slate-500">clientes</span>
          </div>
        </div>

        <div className="bg-[#FFF3E8] rounded-2xl border border-[#F5D3B3] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]">
          <span className="text-[10px] font-bold text-[#9A4B12] uppercase tracking-wider block">
            Con Saldo Fiado Activo
          </span>
          <div className="text-xl font-black text-[#D96B27] mt-1 font-mono-numbers">
            {clients.filter(c => getClientPendingFiado(c.rif) > 0).length} <span className="text-xs font-sans font-semibold text-[#9A4B12]">con deuda</span>
          </div>
        </div>

        <div className="bg-gradient-to-b from-white to-[#F4F8FF] rounded-2xl border border-[#93C5FD] p-4 shadow-[0_2px_12px_-4px_rgba(37,99,235,0.08)] col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
            Límite de Fiado Asignado
          </span>
          <div className="text-xl font-black text-[#0B1528] mt-1 font-mono-numbers">
            ${formatUSD(clients.reduce((acc, c) => acc + (c.creditLimitUSD || 0), 0))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white/95 rounded-2xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
        <input 
          type="text"
          placeholder="Buscar cliente por nombre, cédula (V-...), RIF o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs font-medium text-[#0B1528] placeholder-slate-400 bg-transparent focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Clients List */}
      <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EBF3FE] border border-[#C5DCFC] flex items-center justify-center text-blue-600 mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#0B1528]">
              {clients.length === 0 ? 'Sin clientes registrados' : 'No se encontraron clientes'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {clients.length === 0 
                ? 'Agrega a tus clientes frecuentes para seleccionarlos con un solo clic en la caja de ventas.'
                : 'Intenta con otro término de búsqueda o número de cédula.'}
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Primer Cliente</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredClients.map((client) => {
              const pendingDebt = getClientPendingFiado(client.rif);
              const pendingDebtBs = pendingDebt * bcvRate;
              const hasDebt = pendingDebt > 0;

              return (
                <div 
                  key={client.id}
                  className="p-3.5 sm:p-4 hover:bg-[#F8FAFC] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF3FE] border border-[#C5DCFC] flex items-center justify-center text-[#1D4ED8] font-black text-sm shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-[#0B1528] leading-tight">
                          {client.name}
                        </h3>
                        <span className="font-mono-numbers text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC]">
                          {client.rif}
                        </span>
                        {hasDebt && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3] flex items-center gap-1 font-mono-numbers">
                            Debe: ${formatUSD(pendingDebt)} (Bs. {formatBs(pendingDebtBs)})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <strong className="text-slate-700">{client.phone}</strong>
                        </span>
                        {client.address && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="line-clamp-1">{client.address}</span>
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono">
                          Límite Fiado: ${formatUSD(client.creditLimitUSD || 0)}
                        </span>
                      </div>

                      {client.notes && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1 pt-0.5">
                          Nota: {client.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleStartSale(client)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                      title="Seleccionar en caja y facturar"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Vender</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsApp(client)}
                      className="p-2 rounded-xl bg-[#E7F8EE] hover:bg-emerald-100 text-[#065F46] border border-[#A7E6C4] transition-colors cursor-pointer"
                      title="Abrir chat de WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(client)}
                      className="p-2 rounded-xl bg-[#F8FAFC] border border-[#DCE4F0] hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Editar datos del cliente"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setClientToDelete(client)}
                      className="p-2 rounded-xl bg-[#FEECEF] border border-[#FBC4CD] hover:bg-rose-100 text-[#BE123C] transition-colors cursor-pointer"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add or Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in fade-in zoom-in-95 my-auto">
            
            <div className="p-4 sm:p-5 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-blue-300" />
                </div>
                <h3 className="font-extrabold text-base">
                  {editingClient ? 'Editar Cliente Habitual' : 'Nuevo Cliente Habitual'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo / Razón Social <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Inversiones El Samán o Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={rifPrefix}
                    onChange={(e) => setRifPrefix(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="V">V - Venezolano</option>
                    <option value="J">J - Jurídico</option>
                    <option value="E">E - Extranjero</option>
                    <option value="G">G - Gobierno</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cédula o RIF <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 12345678 o 40912345-0"
                    value={rifNumber}
                    onChange={(e) => setRifNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono Móvil (WhatsApp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0414-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Límite Fiado ($ USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    placeholder="50"
                    value={creditLimitUSD}
                    onChange={(e) => setCreditLimitUSD(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dirección o Domicilio
                </label>
                <input
                  type="text"
                  placeholder="Calle, Sector, Edificio o Casa"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="cliente@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas o Preferencias
                </label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de crédito, persona autorizada para retirar, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  {editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-3 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">
              ¿Eliminar cliente habitual?
            </h3>
            <p className="text-xs text-slate-500">
              ¿Estás seguro de que deseas eliminar a <strong>{clientToDelete.name}</strong> ({clientToDelete.rif})?
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteClient(clientToDelete.id);
                  setClientToDelete(null);
                }}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
