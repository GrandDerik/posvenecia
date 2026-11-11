import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  Package, 
  DollarSign, 
  FileText, 
  User, 
  CheckCircle,
  HelpCircle,
  TrendingDown,
  Layers
} from 'lucide-react';
import { InventoryDischargeReason, Product } from '../../types';
import { formatBs, formatUSD } from '../../utils/exportUtils';

export const DesincorporarStockModal: React.FC = () => {
  const { 
    isDischargeModalOpen, 
    setIsDischargeModalOpen, 
    selectedProductForDischarge, 
    setSelectedProductForDischarge,
    products, 
    bcvRate, 
    googleUser,
    createInventoryDischarge 
  } = useApp();

  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<InventoryDischargeReason>('Daño / Vencimiento');
  const [notes, setNotes] = useState<string>('');
  const [responsibleName, setResponsibleName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Filter physical products with available stock
  const physicalProducts = products.filter(p => !p.isService && p.itemType !== 'servicio');

  useEffect(() => {
    if (selectedProductForDischarge) {
      setProductId(selectedProductForDischarge.id);
    } else if (physicalProducts.length > 0 && !productId) {
      setProductId(physicalProducts[0].id);
    }
    setResponsibleName(googleUser?.name || 'Encargado de Almacén');
    setQuantity('1');
    setError(null);
    setSuccessCode(null);
  }, [selectedProductForDischarge, isDischargeModalOpen, googleUser?.name]);

  if (!isDischargeModalOpen) return null;

  const currentProduct = products.find(p => p.id === productId);
  const currentStock = currentProduct ? currentProduct.stock : 0;
  const numQuantity = Math.max(1, parseInt(quantity, 10) || 1);

  const unitCostUSD = currentProduct ? (currentProduct.costUSD && currentProduct.costUSD > 0 ? currentProduct.costUSD : currentProduct.priceUSD) : 0;
  const totalLossUSD = Number((unitCostUSD * numQuantity).toFixed(2));
  const totalLossBs = Number((totalLossUSD * bcvRate).toFixed(2));

  const handleClose = () => {
    setIsDischargeModalOpen(false);
    setSelectedProductForDischarge(null);
    setError(null);
    setSuccessCode(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentProduct) {
      setError('Por favor seleccione un producto.');
      return;
    }

    if (numQuantity <= 0) {
      setError('La cantidad a desincorporar debe ser mayor a 0.');
      return;
    }

    if (numQuantity > currentStock) {
      setError(`Stock insuficiente. Solo hay ${currentStock} unidades disponibles en inventario.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createInventoryDischarge({
        productId: currentProduct.id,
        quantity: numQuantity,
        reason,
        notes: notes.trim() || undefined,
        responsibleName: responsibleName.trim() || undefined
      });

      setSuccessCode(res.dischargeNumber);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Error al procesar la desincorporación de stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-rose-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-white/20 border border-white/30 text-white shadow-xs">
              <Trash2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Desincorporar de Inventario</h2>
              <p className="text-xs text-amber-100">
                Salida por Daño, Vencimiento, Uso Interno o Merma
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-amber-100 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {successCode ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 animate-in fade-in">
              <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-emerald-900">¡Desincorporación Exitosa!</h3>
              <p className="text-xs text-emerald-700">
                Comprobante <span className="font-mono font-bold text-emerald-800">{successCode}</span> registrado.
              </p>
              <p className="text-[11px] text-emerald-600">
                El stock fue descontado y clasificado contablemente como Pérdida / Gasto Operativo.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Product selector if not fixed */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Producto a Desincorporar
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={Boolean(selectedProductForDischarge)}
                  className="w-full text-sm font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:opacity-80"
                >
                  {physicalProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock} | Costo: ${formatUSD(p.costUSD || p.priceUSD)})
                    </option>
                  ))}
                </select>
                {currentProduct && (
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1 px-1">
                    <span>Stock actual: <strong className="text-slate-800">{currentStock} unidades</strong></span>
                    <span>Costo unitario: <strong className="text-slate-800">${formatUSD(unitCostUSD)}</strong></span>
                  </div>
                )}
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo de la Salida
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Daño / Vencimiento', 'Uso Interno', 'Merma'] as InventoryDischargeReason[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        reason === r
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 px-1">
                  {reason === 'Daño / Vencimiento' && '• Mercancía deteriorada, rota o vencida que no puede ser vendida.'}
                  {reason === 'Uso Interno' && '• Consumo del negocio: insumos de limpieza, cafetería o suministros.'}
                  {reason === 'Merma' && '• Disminución natural por manipulación, pesaje o merma de charcutería.'}
                </p>
              </div>

              {/* Quantity input & quick buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cantidad a Retirar
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white flex-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(String(Math.max(1, numQuantity - 1)))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={currentStock}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full text-center font-bold text-slate-800 text-base py-2 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(String(Math.min(currentStock, numQuantity + 1)))}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                  {currentStock > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuantity(String(currentStock))}
                      className="px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors"
                    >
                      Todo ({currentStock})
                    </button>
                  )}
                </div>
              </div>

              {/* Financial Impact Box */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-900 uppercase">Impacto Contable (Pérdida)</span>
                    <p className="text-xs text-amber-700">Se registrará en Gastos Operativos</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-amber-900 font-mono-numbers">
                    ${formatUSD(totalLossUSD)}
                  </div>
                  <div className="text-[11px] text-amber-700 font-mono-numbers">
                    Bs. {formatBs(totalLossBs)}
                  </div>
                </div>
              </div>

              {/* Notes and Responsible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Responsable
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Nombre del encargado"
                      className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Detalle / Observación
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Paquete roto, vencido 10/11..."
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || currentStock <= 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isSubmitting ? 'Procesando...' : 'Confirmar Desincorporación'}
                </button>
              </div>
            </>
          )}
        </form>

      </div>
    </div>
  );
};
