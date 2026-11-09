import React from 'react';
import { X, Printer, Download, Share2, Check } from 'lucide-react';
import { Sale, BusinessInfo } from '../../types';
import { formatBs, formatUSD } from '../../utils/exportUtils';
import { generateTicketVentaPDF } from '../../utils/pdfReceiptUtils';

interface ComprobanteTicketModalProps {
  sale: Sale | null;
  onClose: () => void;
  businessInfo: BusinessInfo;
}

export const ComprobanteTicketModal: React.FC<ComprobanteTicketModalProps> = ({
  sale,
  onClose,
  businessInfo
}) => {
  if (!sale) return null;

  const handleDownloadPDF = () => {
    generateTicketVentaPDF(sale, businessInfo);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        {/* Modal Top Bar */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs">
          <span className="font-bold">Vista Previa - Recibo Térmico</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Ticket Paper Area */}
        <div className="p-6 overflow-y-auto bg-slate-100/70 flex-1">
          <div className="bg-white p-5 rounded-xl shadow-md border border-slate-200 text-slate-800 font-mono text-[11px] leading-relaxed space-y-3">
            
            {/* Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
              {/* Custom Business Logo if uploaded */}
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
              {businessInfo.email && <p className="text-[9px] text-slate-500">EMAIL: {businessInfo.email}</p>}
              {businessInfo.instagram && <p className="text-[9px] text-slate-500">IG: {businessInfo.instagram}</p>}
              
              <div className="pt-2 text-[10px] font-bold text-slate-800 font-sans">
                COMPROBANTE ELECTRÓNICO
              </div>
              <p className="font-bold text-teal-700">{sale.invoiceNumber}</p>
              <p className="text-[9px] text-slate-500">CONTROL SENIAT: {sale.controlNumber}</p>
              <p className="text-[9px] text-slate-500">{new Date(sale.date).toLocaleString('es-VE')}</p>
              <p className="text-[9px] text-emerald-700 font-bold">TASA OFICIAL BCV: Bs. {sale.bcvRate.toFixed(2)}</p>
            </div>

            {/* Client Info */}
            <div className="border-b border-dashed border-slate-300 pb-2 text-[10px]">
              <div><strong>CLIENTE:</strong> {sale.clientName}</div>
              <div><strong>RIF/CI:</strong> {sale.clientRIF}</div>
              {sale.clientPhone && <div><strong>TELF:</strong> {sale.clientPhone}</div>}
            </div>

            {/* Product Items */}
            <div className="border-b border-dashed border-slate-300 pb-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-slate-500">
                <span>CANT / ARTÍCULO</span>
                <span>TOTAL Bs</span>
              </div>
              {sale.items.map((item, idx) => (
                <div key={idx} className="text-[10px]">
                  <div className="flex justify-between font-medium">
                    <span>
                      {item.quantity}x {item.product.name} {item.product.isExemptFromIVA ? '(E)' : ''}
                    </span>
                    <span className="font-bold font-mono">
                      Bs. {formatBs(item.totalUSD * sale.bcvRate)}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    $ {formatUSD(item.product.priceUSD)} c/u = $ {formatUSD(item.totalUSD)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>Bs. {formatBs(sale.subtotalBs)}</span>
              </div>
              {sale.exemptBs > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>EXENTO (E):</span>
                  <span>Bs. {formatBs(sale.exemptBs)}</span>
                </div>
              )}
              {sale.taxableBs > 0 && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>BASE IMPONIBLE (16%):</span>
                    <span>Bs. {formatBs(sale.taxableBs)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA (16%):</span>
                    <span>Bs. {formatBs(sale.ivaBs)}</span>
                  </div>
                </>
              )}
              {sale.igtfBs > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>IGTF (3% DIVISAS):</span>
                  <span>Bs. {formatBs(sale.igtfBs)} (${formatUSD(sale.igtfUSD)})</span>
                </div>
              )}

              <div className="pt-1.5 flex justify-between font-extrabold text-xs text-slate-900 border-t border-slate-200">
                <span>TOTAL BS:</span>
                <span>Bs. {formatBs(sale.totalBs)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-xs text-teal-800">
                <span>TOTAL USD:</span>
                <span>$ {formatUSD(sale.totalUSD)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="text-[10px] space-y-0.5">
              <div><strong>FORMA DE PAGO:</strong> {sale.paymentMethod.replace('_', ' ').toUpperCase()}</div>
              {sale.paymentMethod === 'pago_combinado' && sale.paymentDetails.combinedBreakdown && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200 mt-1 space-y-0.5">
                  <div className="font-bold text-slate-700">Desglose Recibido:</div>
                  {Boolean(sale.paymentDetails.combinedBreakdown.usdCash && sale.paymentDetails.combinedBreakdown.usdCash > 0) && (
                    <div>• Efectivo USD: ${formatUSD(sale.paymentDetails.combinedBreakdown.usdCash!)}</div>
                  )}
                  {Boolean(sale.paymentDetails.combinedBreakdown.bsCash && sale.paymentDetails.combinedBreakdown.bsCash > 0) && (
                    <div>• Efectivo Bs: Bs. {formatBs(sale.paymentDetails.combinedBreakdown.bsCash!)}</div>
                  )}
                  {Boolean(sale.paymentDetails.combinedBreakdown.pagoMovil && sale.paymentDetails.combinedBreakdown.pagoMovil > 0) && (
                    <div>• Pago Móvil: Bs. {formatBs(sale.paymentDetails.combinedBreakdown.pagoMovil!)} {sale.paymentDetails.combinedBreakdown.pagoMovilRef ? `(Ref: #${sale.paymentDetails.combinedBreakdown.pagoMovilRef})` : ''}</div>
                  )}
                  {Boolean(sale.paymentDetails.combinedBreakdown.debito && sale.paymentDetails.combinedBreakdown.debito > 0) && (
                    <div>• Débito POS: Bs. {formatBs(sale.paymentDetails.combinedBreakdown.debito!)} {sale.paymentDetails.combinedBreakdown.debitoRef ? `(Ref: #${sale.paymentDetails.combinedBreakdown.debitoRef})` : ''}</div>
                  )}
                  {Boolean(sale.paymentDetails.combinedBreakdown.fiaoRemaining && sale.paymentDetails.combinedBreakdown.fiaoRemaining > 0) && (
                    <div className="text-amber-800 font-bold">• Saldo Fiado: ${formatUSD(sale.paymentDetails.combinedBreakdown.fiaoRemaining!)}</div>
                  )}
                </div>
              )}
              {sale.paymentDetails.pagoMovilRef && sale.paymentMethod !== 'pago_combinado' && (
                <div><strong>REF PAGO MÓVIL:</strong> {sale.paymentDetails.pagoMovilRef}</div>
              )}
              {sale.paymentDetails.debitoRef && sale.paymentMethod !== 'pago_combinado' && (
                <div><strong>REF TARJETA:</strong> {sale.paymentDetails.debitoRef}</div>
              )}
              {sale.paymentMethod === 'fiao' && (
                <div className="text-amber-800">
                  <div><strong>ABONO RECIBIDO:</strong> ${formatUSD(sale.paymentDetails.fiaoInitialAbonoUSD || 0)}</div>
                  <div><strong>SALDO RESTANTE:</strong> ${formatUSD(sale.paymentDetails.fiaoRemainingUSD || 0)}</div>
                </div>
              )}
            </div>

            <div className="text-center pt-2 text-[9px] text-slate-500 space-y-0.5 border-t border-dashed border-slate-300">
              <p className="font-bold text-slate-700 uppercase">{businessInfo.footerMessage || '¡GRACIAS POR SU PREFERENCIA!'}</p>
              <p>Comprobante sin validez de crédito fiscal directo.</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-2">
          <button
            onClick={handleDownloadPDF}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Guardar PDF</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
