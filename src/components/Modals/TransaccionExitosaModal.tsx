import React, { useState } from 'react';
import { 
  CheckCircle2, 
  UserPlus, 
  FileText, 
  Printer, 
  Check, 
  X, 
  DollarSign, 
  Sparkles,
  ArrowRight,
  Store
} from 'lucide-react';
import { Sale, BusinessInfo } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatBs, formatUSD } from '../../utils/exportUtils';
import { generateTicketVentaPDF } from '../../utils/pdfReceiptUtils';

interface TransaccionExitosaModalProps {
  sale: Sale | null;
  onClose: () => void;
  onOpenReceiptTicket: (sale: Sale) => void;
  businessInfo: BusinessInfo;
}

export const TransaccionExitosaModal: React.FC<TransaccionExitosaModalProps> = ({
  sale,
  onClose,
  onOpenReceiptTicket,
  businessInfo
}) => {
  const { updateSale } = useApp();
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [clientName, setClientName] = useState(sale?.clientName || '');
  const [clientRif, setClientRif] = useState(sale?.clientRIF || 'V-');
  const [clientPhone, setClientPhone] = useState(sale?.clientPhone || '');
  const [clientAddress, setClientAddress] = useState(sale?.clientAddress || '');
  const [clientSaved, setClientSaved] = useState(false);

  if (!sale) return null;

  const currentDisplaySale: Sale = {
    ...sale,
    clientName: clientSaved ? clientName : sale.clientName,
    clientRIF: clientSaved ? clientRif : sale.clientRIF,
    clientPhone: clientSaved ? (clientPhone || undefined) : sale.clientPhone,
    clientAddress: clientSaved ? (clientAddress || undefined) : sale.clientAddress
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSale: Sale = {
      ...sale,
      clientName: clientName.trim() || 'Consumidor Final',
      clientRIF: clientRif.trim() || 'V-00000000',
      clientPhone: clientPhone.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined
    };
    updateSale(updatedSale);
    setClientSaved(true);
    setTimeout(() => {
      setShowAddClientForm(false);
    }, 1000);
  };

  const handleEmitirNotaEntrega = () => {
    // Generate PDF ticket formatted as delivery note
    generateTicketVentaPDF(currentDisplaySale, businessInfo);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Success Header banner with Business Identity & Logo */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white p-5 text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            {businessInfo.logoUrl ? (
              <img 
                src={businessInfo.logoUrl} 
                alt={businessInfo.name} 
                className="w-10 h-10 object-contain rounded-xl bg-white/20 p-1 backdrop-blur-xs border border-white/30" 
              />
            ) : (
              <div className="w-10 h-10 bg-white/20 backdrop-blur-xs rounded-xl flex items-center justify-center border border-white/20">
                <Store className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="text-left leading-tight">
              <span className="text-xs font-black tracking-tight block text-white">
                {businessInfo.name}
              </span>
              <span className="text-[10px] text-blue-200 font-mono">
                RIF: {businessInfo.rif}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-extrabold tracking-widest uppercase bg-blue-950/50 text-blue-200 px-3 py-0.5 rounded-full inline-block mb-1">
            Transacción Exitosa
          </span>
          <h2 className="text-2xl font-black tracking-tight">{sale.invoiceNumber}</h2>
          <p className="text-xs text-blue-200 mt-0.5">Control SENIAT: {sale.controlNumber}</p>
        </div>

        {/* Payment Summary */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <span className="text-xs text-slate-500 font-medium">Monto Total Cobrado</span>
            <div className="text-3xl font-black text-slate-900 font-mono-numbers mt-0.5">
              ${formatUSD(sale.totalUSD)}
            </div>
            <div className="text-sm font-bold text-blue-700 font-mono-numbers">
              Bs. {formatBs(sale.totalBs)}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1.5 bg-slate-200/70 px-2.5 py-0.5 rounded-full font-medium">
              <span>Método: <strong>{sale.paymentMethod.replace('_', ' ').toUpperCase()}</strong></span>
              <span>•</span>
              <span>Tasa: Bs. {formatBs(sale.bcvRate)}</span>
            </div>
          </div>

          {/* Client summary or Add Client Box */}
          {!showAddClientForm ? (
            <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-800">Cliente Asignado</span>
                <div className="text-xs font-bold text-slate-800">{currentDisplaySale.clientName}</div>
                <div className="text-[11px] text-slate-500">{currentDisplaySale.clientRIF}</div>
              </div>
              <button
                onClick={() => setShowAddClientForm(true)}
                className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 bg-white border border-teal-300 px-2.5 py-1.5 rounded-lg shadow-2xs hover:bg-teal-50 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{currentDisplaySale.clientName === 'Consumidor Final' ? 'Agregar Cliente' : 'Editar Datos'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveClient} className="p-3 bg-teal-50/80 border border-teal-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-teal-200">
                <span className="text-xs font-bold text-teal-900">Datos Fiscales del Cliente</span>
                <button type="button" onClick={() => setShowAddClientForm(false)} className="text-teal-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Nombre o Razón Social"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="RIF / CI (V- o J-)"
                  value={clientRif}
                  onChange={(e) => setClientRif(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  required
                />
                <input
                  type="text"
                  placeholder="Teléfono (Opcional)"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="submit"
                  className="px-3 py-1 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Cliente</span>
                </button>
              </div>
            </form>
          )}

          {/* Action Buttons as requested */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Emitir Nota de Entrega */}
            <button
              onClick={handleEmitirNotaEntrega}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-colors"
            >
              <FileText className="w-4 h-4 text-teal-600" />
              <span>Emitir Nota Entrega</span>
            </button>

            {/* Comprobante Digital (PDF) / Imprimir */}
            <button
              onClick={() => onOpenReceiptTicket(currentDisplaySale)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold border border-blue-200 transition-colors"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Comprobante (PDF)</span>
            </button>
          </div>

          {/* Accept / Continue Button */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>Aceptar y Siguiente Venta</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
