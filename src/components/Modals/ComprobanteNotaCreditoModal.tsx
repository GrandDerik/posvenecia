import React from 'react';
import { X, Printer, Download, RotateCcw } from 'lucide-react';
import { CreditNote, BusinessInfo } from '../../types';
import { formatBs, formatUSD } from '../../utils/exportUtils';
import { generateTicketNotaCreditoPDF } from '../../utils/pdfReceiptUtils';

interface ComprobanteNotaCreditoModalProps {
  creditNote: CreditNote | null;
  onClose: () => void;
  businessInfo: BusinessInfo;
}

export const ComprobanteNotaCreditoModal: React.FC<ComprobanteNotaCreditoModalProps> = ({
  creditNote,
  onClose,
  businessInfo
}) => {
  if (!creditNote) return null;

  const handleDownloadPDF = () => {
    generateTicketNotaCreditoPDF(creditNote, businessInfo, 'download');
  };

  const handlePrint = () => {
    generateTicketNotaCreditoPDF(creditNote, businessInfo, 'print');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        {/* Modal Top Bar */}
        <div className="p-3 bg-rose-900 text-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <RotateCcw className="w-4 h-4 text-rose-300" />
            <span>Comprobante - Nota de Crédito</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-rose-800 text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Ticket Paper Area */}
        <div className="p-6 overflow-y-auto bg-slate-100/70 flex-1">
          <div className="bg-white p-5 rounded-xl shadow-md border border-slate-200 text-slate-800 font-mono text-[11px] leading-relaxed space-y-3">
            
            {/* Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
              {businessInfo.logoUrl && (
                <div className="flex justify-center mb-2">
                  <img 
                    src={businessInfo.logoUrl} 
                    alt={businessInfo.name} 
                    className="max-h-14 max-w-[140px] object-contain filter contrast-125"
                  />
                </div>
              )}
              <h3 className="font-extrabold text-xs text-slate-900 tracking-tight font-sans">
                {businessInfo.name.toUpperCase()}
              </h3>
              <p className="text-[10px] text-slate-600">RIF: {businessInfo.rif}</p>
              <p className="text-[9px] text-slate-500">{businessInfo.address}</p>
              <p className="text-[9px] text-slate-500">TELF: {businessInfo.phone}</p>
              
              <div className="pt-2 text-[11px] font-black text-rose-800 font-sans tracking-wider">
                *** NOTA DE CRÉDITO ***
              </div>
              <p className="font-bold text-rose-950 text-xs">{creditNote.creditNoteNumber}</p>
              <p className="text-[9px] text-slate-500">CONTROL SENIAT: {creditNote.controlNumber}</p>
              <p className="text-[9px] font-bold text-slate-700 bg-rose-50 py-0.5 rounded">
                AFECTA A FACTURA: {creditNote.originalInvoiceNumber}
                {creditNote.originalControlNumber ? ` (Ctrl: ${creditNote.originalControlNumber})` : ''}
              </p>
              <p className="text-[9px] text-slate-500">{new Date(creditNote.date).toLocaleString('es-VE')}</p>
              <p className="text-[9px] text-emerald-700 font-bold">TASA BCV: Bs. {creditNote.bcvRate.toFixed(2)}</p>
            </div>

            {/* Client Info */}
            <div className="border-b border-dashed border-slate-300 pb-2 text-[10px]">
              <div><strong>CLIENTE:</strong> {creditNote.clientName}</div>
              <div><strong>RIF/CI:</strong> {creditNote.clientRIF}</div>
              {creditNote.clientPhone && <div><strong>TELF:</strong> {creditNote.clientPhone}</div>}
              <div className="text-rose-900 mt-1 font-sans"><strong>MOTIVO:</strong> {creditNote.reason}</div>
            </div>

            {/* Returned Items */}
            <div className="border-b border-dashed border-slate-300 pb-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-slate-500">
                <span>CANT / ARTÍCULO DEVUELTO</span>
                <span>TOTAL Bs</span>
              </div>
              {creditNote.items.map((item, idx) => (
                <div key={idx} className="text-[10px]">
                  <div className="flex justify-between font-medium">
                    <span className="text-rose-950">
                      {item.quantity}x {item.productName} {item.isExemptFromIVA ? '(E)' : ''}
                    </span>
                    <span className="font-bold font-mono text-rose-800">
                      Bs. {formatBs(item.totalUSD * creditNote.bcvRate)}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    $ {formatUSD(item.unitPriceUSD)} c/u = $ {formatUSD(item.totalUSD)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between text-slate-600">
                <span>SUBTOTAL:</span>
                <span>Bs. {formatBs(creditNote.subtotalBs)}</span>
              </div>
              {creditNote.exemptBs > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>EXENTO (E):</span>
                  <span>Bs. {formatBs(creditNote.exemptBs)}</span>
                </div>
              )}
              {creditNote.taxableBs > 0 && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>BASE IMPONIBLE (16%):</span>
                    <span>Bs. {formatBs(creditNote.taxableBs)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>IVA (16%):</span>
                    <span>Bs. {formatBs(creditNote.ivaBs)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-xs font-black text-rose-950 pt-1 border-t border-slate-200">
                <span>TOTAL DEVUELTO:</span>
                <span>Bs. {formatBs(creditNote.totalBs)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-rose-900">
                <span>TOTAL EQUIV. USD:</span>
                <span>$ {formatUSD(creditNote.totalUSD)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[9px] text-center text-slate-500 space-y-1 pt-1">
              <div>FORMA DE REINTEGRO: {creditNote.refundMethod.replace('_', ' ').toUpperCase()}</div>
              <div>CAJERO: {creditNote.cashierName}</div>
              <div className="text-[8.5px] text-emerald-700 font-semibold pt-1">
                ✓ Mercancía reincorporada formalmente al inventario
              </div>
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Descargar PDF</span>
          </button>
          
          <button
            onClick={handlePrint}
            className="flex-1 py-2 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ticket</span>
          </button>
        </div>

      </div>
    </div>
  );
};
