import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  FileText, 
  ArrowRight,
  Package,
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Sale, PaymentMethod } from '../../types';
import { formatBs, formatUSD } from '../../utils/exportUtils';

interface NotaCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSale?: Sale | null;
}

export const NotaCreditoModal: React.FC<NotaCreditoModalProps> = ({
  isOpen,
  onClose,
  initialSale = null
}) => {
  const { 
    sales, 
    bcvRate, 
    createCreditNote, 
    setIsCreditNoteModalOpen 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(initialSale);
  const [returnItems, setReturnItems] = useState<{ [productId: string]: { selected: boolean; quantity: number } }>({});
  const [reason, setReason] = useState('Devolución de mercancía por cliente');
  const [customReason, setCustomReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('efectivo_usd');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial sale if provided
  useEffect(() => {
    if (initialSale) {
      setSelectedSale(initialSale);
    }
  }, [initialSale]);

  // When sale is selected, initialize return items mapping
  useEffect(() => {
    if (selectedSale) {
      const initialMap: { [productId: string]: { selected: boolean; quantity: number } } = {};
      selectedSale.items.forEach(item => {
        initialMap[item.product.id] = {
          selected: true,
          quantity: item.quantity
        };
      });
      setReturnItems(initialMap);
      setRefundMethod(selectedSale.paymentMethod || 'efectivo_usd');
      setErrorMsg(null);
    } else {
      setReturnItems({});
    }
  }, [selectedSale]);

  // Filter completed sales for search (exclude already voided or fully returned)
  const availableSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sales.filter(s => {
      if (s.status === 'anulada' || s.status === 'devuelta') return false;
      if (!term) return true;
      return (
        s.invoiceNumber.toLowerCase().includes(term) ||
        s.controlNumber.toLowerCase().includes(term) ||
        s.clientName.toLowerCase().includes(term) ||
        s.clientRIF.toLowerCase().includes(term)
      );
    }).slice(0, 20);
  }, [sales, searchTerm]);

  // Calculate refund totals in real time
  const refundTotals = useMemo(() => {
    if (!selectedSale) return { subtotalUSD: 0, ivaUSD: 0, igtfUSD: 0, totalUSD: 0, totalBs: 0, count: 0 };
    
    let subUSD = 0;
    let taxUSD = 0;
    let count = 0;

    selectedSale.items.forEach(item => {
      const ret = returnItems[item.product.id];
      if (ret && ret.selected && ret.quantity > 0) {
        const itemTotal = Number((item.unitPriceUSD * ret.quantity).toFixed(2));
        subUSD += itemTotal;
        count += ret.quantity;
        if (!item.product.isExemptFromIVA) {
          taxUSD += itemTotal;
        }
      }
    });

    const rate = selectedSale.bcvRate || bcvRate;
    const ivaUSD = selectedSale.ivaUSD > 0 ? Number((taxUSD * 0.16).toFixed(2)) : 0;
    const igtfUSD = (selectedSale.igtfUSD > 0 && refundMethod === 'efectivo_usd') ? Number((subUSD * 0.03).toFixed(2)) : 0;
    const totalUSD = Number((subUSD + ivaUSD + igtfUSD).toFixed(2));
    const totalBs = Number((totalUSD * rate).toFixed(2));

    return { subtotalUSD: subUSD, ivaUSD, igtfUSD, totalUSD, totalBs, count };
  }, [selectedSale, returnItems, refundMethod, bcvRate]);

  if (!isOpen) return null;

  const handleToggleItem = (productId: string) => {
    setReturnItems(prev => {
      const cur = prev[productId];
      if (!cur) return prev;
      return {
        ...prev,
        [productId]: {
          ...cur,
          selected: !cur.selected
        }
      };
    });
  };

  const handleQuantityChange = (productId: string, qty: number, maxQty: number) => {
    const validQty = Math.max(1, Math.min(maxQty, qty));
    setReturnItems(prev => {
      const cur = prev[productId];
      return {
        ...prev,
        [productId]: {
          selected: true,
          quantity: validQty
        }
      };
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (!selectedSale) return;
    setReturnItems(prev => {
      const next = { ...prev };
      selectedSale.items.forEach(item => {
        if (next[item.product.id]) {
          next[item.product.id].selected = select;
        }
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) {
      setErrorMsg('Seleccione una factura válida.');
      return;
    }

    const itemsToReturn = selectedSale.items
      .filter(item => returnItems[item.product.id]?.selected && returnItems[item.product.id]?.quantity > 0)
      .map(item => ({
        productId: item.product.id,
        quantity: returnItems[item.product.id].quantity
      }));

    if (itemsToReturn.length === 0) {
      setErrorMsg('Debe seleccionar al menos un producto para devolver.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalReason = reason === 'Otro' ? (customReason.trim() || 'Devolución de mercancía') : reason;
      await createCreditNote({
        saleId: selectedSale.id,
        reason: finalReason,
        refundMethod,
        items: itemsToReturn
      });
      onClose();
    } catch (err: any) {
      console.error('Error al emitir nota de crédito:', err);
      setErrorMsg(err?.message || 'Error al procesar la nota de crédito');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-900 via-rose-800 to-rose-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-700/60 text-white rounded-2xl shadow-xs">
              <RotateCcw className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Emitir Nota de Crédito / Devolución</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-600/60 text-[10px] font-mono font-bold uppercase">
                  SENIAT
                </span>
              </h2>
              <p className="text-xs text-rose-200 mt-0.5">
                Reincorpora mercancía al inventario y genera el comprobante fiscal oficial
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-rose-700/60 text-rose-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Search / Select Sale */}
          {!selectedSale ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                1. Buscar Factura de Venta previa a afectar:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Escriba N° Factura (FACT-C1-000001), Control SENIAT o Cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
                {availableSales.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No se encontraron facturas completadas para devolución con ese criterio.
                  </div>
                ) : (
                  availableSales.map(sale => (
                    <button
                      key={sale.id}
                      type="button"
                      onClick={() => setSelectedSale(sale)}
                      className="w-full text-left p-3 bg-white hover:bg-rose-50/80 border border-slate-200 hover:border-rose-300 rounded-xl transition-all flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs font-mono">{sale.invoiceNumber}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Control: {sale.controlNumber}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {new Date(sale.date).toLocaleDateString('es-VE')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 font-medium">{sale.clientName} ({sale.clientRIF})</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {sale.items.length} artículo(s) • Pago: {sale.paymentMethod.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-slate-900 font-mono">
                          ${formatUSD(sale.totalUSD)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Bs. {formatBs(sale.totalBs)}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                          Seleccionar <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Selected Sale Pill */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-rose-950 font-mono">{selectedSale.invoiceNumber}</span>
                      <span className="text-[10px] text-rose-700 font-mono">Control: {selectedSale.controlNumber}</span>
                      <span className="text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded font-mono">
                        {new Date(selectedSale.date).toLocaleDateString('es-VE')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium mt-0.5">
                      Cliente: {selectedSale.clientName} ({selectedSale.clientRIF})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="px-2.5 py-1 text-[11px] text-rose-700 hover:text-rose-900 hover:bg-rose-100 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Cambiar factura
                </button>
              </div>

              {/* STEP 2: Products to Return */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    2. Seleccione los productos que el cliente está devolviendo:
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-rose-700 hover:underline font-semibold"
                    >
                      Marcar todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-slate-500 hover:underline"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {selectedSale.items.map(item => {
                    const retState = returnItems[item.product.id] || { selected: false, quantity: item.quantity };
                    return (
                      <div 
                        key={item.product.id}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          retState.selected ? 'bg-rose-50/40' : 'bg-white opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={retState.selected}
                            onChange={() => handleToggleItem(item.product.id)}
                            className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.product.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Vendido: {item.quantity} {item.product.unit} • ${formatUSD(item.unitPriceUSD)} c/u
                              {item.product.isExemptFromIVA ? ' (Exento IVA)' : ' (Gravable 16%)'}
                            </p>
                          </div>
                        </div>

                        {retState.selected ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Devolver:</span>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={retState.quantity}
                              onChange={(e) => handleQuantityChange(item.product.id, parseInt(e.target.value) || 1, item.quantity)}
                              className="w-16 px-2 py-1 text-center font-bold text-xs bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 font-mono"
                            />
                            <span className="text-xs font-bold text-rose-900 font-mono w-20 text-right">
                              ${formatUSD(item.unitPriceUSD * retState.quantity)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">No devuelto</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 3: Reason & Refund Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Motivo de la Devolución:
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Devolución de mercancía por cliente">Devolución voluntaria del cliente</option>
                    <option value="Producto defectuoso o con falla de fábrica">Producto defectuoso / falla</option>
                    <option value="Producto vencido o en mal estado">Producto vencido / mal estado</option>
                    <option value="Error de facturación o cobro incorrecto">Error de facturación / precio</option>
                    <option value="Inconformidad con el servicio o producto">Inconformidad del cliente</option>
                    <option value="Otro">Otro motivo personalizado...</option>
                  </select>

                  {reason === 'Otro' && (
                    <input
                      type="text"
                      placeholder="Especifique el motivo de la Nota de Crédito..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. Forma de Reintegro del Dinero:
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="efectivo_usd">Efectivo USD ($)</option>
                    <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="debito">Punto de Venta / Débito</option>
                  </select>
                </div>
              </div>

              {/* Refund Summary Box */}
              <div className="bg-gradient-to-r from-rose-950 to-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                    Total a Reembolsar en Nota de Crédito
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono-numbers text-white mt-0.5">
                    ${formatUSD(refundTotals.totalUSD)} USD
                  </div>
                  <span className="text-xs font-mono text-rose-300">
                    Bs. {formatBs(refundTotals.totalBs)} (Tasa BCV: {selectedSale.bcvRate.toFixed(2)})
                  </span>
                </div>
                
                <div className="text-right text-[11px] text-slate-300 space-y-0.5 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-4">
                  <div>Subtotal: ${formatUSD(refundTotals.subtotalUSD)}</div>
                  {refundTotals.ivaUSD > 0 && <div>IVA (16%): ${formatUSD(refundTotals.ivaUSD)}</div>}
                  <div className="text-emerald-400 font-bold mt-1">
                    ✓ {refundTotals.count} unidades se sumarán al inventario
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Modal Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {selectedSale && (
              <button
                type="submit"
                disabled={isSubmitting || refundTotals.count === 0}
                className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Emitiendo Nota de Crédito...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Nota de Crédito (${formatUSD(refundTotals.totalUSD)})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
};
