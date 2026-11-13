import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Check, 
  FileSpreadsheet, 
  Building, 
  DollarSign, 
  Banknote, 
  ShieldAlert, 
  KeyRound, 
  Package, 
  Plus, 
  Trash2, 
  Layers, 
  TrendingUp, 
  RefreshCw, 
  Info,
  ArrowRight
} from 'lucide-react';
import { formatBs, formatUSD } from '../utils/exportUtils';
import { Expense, ExpenseItem, PurchaseCostStrategy } from '../types';

interface RegistrarGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingExpense?: Expense | null;
}

export const RegistrarGastoModal: React.FC<RegistrarGastoModalProps> = ({ isOpen, onClose, editingExpense }) => {
  const { addExpense, updateExpense, products, bcvRate, isCashRegisterOpen, setIsAperturaModalOpen } = useApp();

  // Invoice & Supplier details
  const [supplierName, setSupplierName] = useState('');
  const [supplierRIF, setSupplierRIF] = useState('J-');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Mercancía' | 'Servicios' | 'Alquiler' | 'Nómina' | 'Mantenimiento' | 'Otros'>('Mercancía');
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');
  const [amountInput, setAmountInput] = useState('');
  const [hasIVA, setHasIVA] = useState(true);
  const [applyRetencionIVA, setApplyRetencionIVA] = useState(true); // 75% SENIAT retention
  const [paymentMethod, setPaymentMethod] = useState<'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'debito' | 'transferencia'>('pago_movil');
  const [reference, setReference] = useState('');

  // Inventory Integration Items state
  const [purchasedItems, setPurchasedItems] = useState<ExpenseItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [itemQuantityInput, setItemQuantityInput] = useState('1');
  const [itemCostInput, setItemCostInput] = useState('');
  const [itemCostCurrency, setItemCostCurrency] = useState<'USD' | 'Bs'>('USD');
  const [itemStrategy, setItemStrategy] = useState<PurchaseCostStrategy>('fifo');
  const [customNewPriceUSD, setCustomNewPriceUSD] = useState('');
  const [showItemSection, setShowItemSection] = useState(true);

  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const safeBcvRate = typeof bcvRate === 'number' && !isNaN(bcvRate) && bcvRate > 0 ? bcvRate : 1;

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return safeProducts;
    const query = productSearch.toLowerCase();
    return safeProducts.filter(p => 
      (p?.name || '').toLowerCase().includes(query) || 
      (p?.code && p.code.toLowerCase().includes(query)) ||
      (p?.category && p.category.toLowerCase().includes(query))
    );
  }, [safeProducts, productSearch]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return undefined;
    return safeProducts.find(p => p?.id === selectedProductId);
  }, [safeProducts, selectedProductId]);

  // When selected product changes, pre-fill cost & default price calculation
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = safeProducts.find(p => p?.id === prodId);
    if (prod) {
      const prodCost = Number(prod.costUSD) || 0;
      const prodPrice = Number(prod.priceUSD) || 0;
      const defaultCost = prodCost > 0 ? prodCost.toString() : '';
      setItemCostInput(defaultCost);
      setItemCostCurrency('USD');

      // Calculate suggested new price
      const unitCost = prodCost > 0 ? prodCost : (prodPrice * 0.7);
      const margin = prod.profitMarginPercent 
        ? prod.profitMarginPercent / 100 
        : (prodCost > 0 && prodPrice > prodCost 
            ? (prodPrice - prodCost) / prodCost 
            : 0.30);
      const calculatedPrice = (unitCost * (1 + margin)).toFixed(2);
      setCustomNewPriceUSD(calculatedPrice);
    } else {
      setItemCostInput('');
      setCustomNewPriceUSD('');
    }
  };

  // Recalculate suggested sale price when cost or product changes
  const handleCostChange = (val: string, curr: 'USD' | 'Bs' = itemCostCurrency) => {
    setItemCostInput(val);
    const numCost = parseFloat(val) || 0;
    const costUSD = curr === 'USD' ? numCost : (safeBcvRate > 0 ? numCost / safeBcvRate : 0);
    
    if (selectedProduct && costUSD > 0) {
      const prodCost = Number(selectedProduct.costUSD) || 0;
      const prodPrice = Number(selectedProduct.priceUSD) || 0;
      const margin = selectedProduct.profitMarginPercent 
        ? selectedProduct.profitMarginPercent / 100 
        : (prodCost > 0 && prodPrice > prodCost 
            ? (prodPrice - prodCost) / prodCost 
            : 0.30);
      const calculatedPrice = (costUSD * (1 + margin)).toFixed(2);
      setCustomNewPriceUSD(calculatedPrice);
    }
  };

  // Add item to list
  const handleAddItem = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(itemQuantityInput);
    if (!qty || qty <= 0) return;

    const rawCost = parseFloat(itemCostInput);
    if (isNaN(rawCost) || rawCost < 0) return;

    const unitCostUSD = itemCostCurrency === 'USD' ? rawCost : (safeBcvRate > 0 ? rawCost / safeBcvRate : 0);
    const totalCostUSD = Number((unitCostUSD * qty).toFixed(2));
    const currentPriceUSD = Number(selectedProduct.priceUSD) || 0;

    const finalNewPriceUSD = itemStrategy === 'average_cost'
      ? (parseFloat(customNewPriceUSD) || currentPriceUSD)
      : currentPriceUSD;

    const newItem: ExpenseItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name || 'Producto',
      quantity: qty,
      unitCostUSD: Number(unitCostUSD.toFixed(4)),
      totalCostUSD,
      strategy: itemStrategy,
      previousCostUSD: Number(selectedProduct.costUSD) || 0,
      previousPriceUSD: currentPriceUSD,
      newPriceUSD: finalNewPriceUSD
    };

    setPurchasedItems(prev => [...prev, newItem]);

    // Reset item input
    setSelectedProductId('');
    setProductSearch('');
    setItemQuantityInput('1');
    setItemCostInput('');
    setCustomNewPriceUSD('');
  };

  const handleRemoveItem = (index: number) => {
    setPurchasedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Items total calculation
  const totalItemsUSD = useMemo(() => {
    return purchasedItems.reduce((sum, item) => sum + (Number(item?.totalCostUSD) || 0), 0);
  }, [purchasedItems]);

  const totalItemsBs = totalItemsUSD * safeBcvRate;

  // Auto-sync invoice amount with items total
  const syncInvoiceAmountWithItems = () => {
    if (totalItemsUSD > 0) {
      if (currency === 'USD') {
        setAmountInput(totalItemsUSD.toFixed(2));
      } else {
        setAmountInput(totalItemsBs.toFixed(2));
      }
    }
  };

  useEffect(() => {
    if (isOpen && editingExpense) {
      setSupplierName(editingExpense.supplierName || '');
      setSupplierRIF(editingExpense.supplierRIF || 'J-');
      setSupplierPhone(editingExpense.supplierPhone || '');
      setInvoiceNumber(editingExpense.invoiceNumber || '');
      setControlNumber(editingExpense.controlNumber || '');
      setDescription(editingExpense.description || '');
      setCategory(editingExpense.category || 'Mercancía');
      setCurrency('USD');
      setAmountInput(editingExpense.amountUSD ? editingExpense.amountUSD.toFixed(2) : '');
      setHasIVA((editingExpense.ivaBs || 0) > 0);
      setApplyRetencionIVA((editingExpense.retencionIVABs || 0) > 0);
      setPaymentMethod(editingExpense.paymentMethod || 'pago_movil');
      setReference(editingExpense.reference || '');
      setPurchasedItems(Array.isArray(editingExpense.items) ? editingExpense.items : []);
      setSelectedProductId('');
      setProductSearch('');
      setItemQuantityInput('1');
      setItemCostInput('');
      setItemCostCurrency('USD');
      setItemStrategy('fifo');
      setCustomNewPriceUSD('');
    } else if (isOpen && !editingExpense) {
      setSupplierName('');
      setSupplierRIF('J-');
      setSupplierPhone('');
      setInvoiceNumber('');
      setControlNumber('');
      setDescription('');
      setCategory('Mercancía');
      setCurrency('USD');
      setAmountInput('');
      setHasIVA(true);
      setApplyRetencionIVA(true);
      setPaymentMethod('pago_movil');
      setReference('');
      setPurchasedItems([]);
      setSelectedProductId('');
      setProductSearch('');
      setItemQuantityInput('1');
      setItemCostInput('');
      setItemCostCurrency('USD');
      setItemStrategy('fifo');
      setCustomNewPriceUSD('');
    }
  }, [isOpen, editingExpense]);

  // Early return MUST appear after all React hooks to comply with Rules of Hooks
  if (!isOpen) return null;

  const rawAmount = parseFloat(amountInput) || 0;
  const amountUSD = currency === 'USD' ? rawAmount : (safeBcvRate > 0 ? rawAmount / safeBcvRate : 0);
  const amountBs = currency === 'USD' ? rawAmount * safeBcvRate : rawAmount;

  // SENIAT calculations for purchases
  const baseImponibleBs = hasIVA ? (amountBs / 1.16) : amountBs;
  const ivaBs = hasIVA ? (amountBs - baseImponibleBs) : 0;
  const retencionIVABs = applyRetencionIVA ? (ivaBs * 0.75) : 0; // 75% retention standard SENIAT
  const retencionISLRBs = baseImponibleBs * 0.02; // 2% ISLR retention

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || rawAmount <= 0) return;

    // Determine default global strategy if items exist
    const defaultStrategy = purchasedItems.length > 0 
      ? (purchasedItems.some(i => i.strategy === 'fifo') ? 'fifo' : 'average_cost') 
      : undefined;

    if (editingExpense) {
      updateExpense({
        ...editingExpense,
        invoiceNumber: invoiceNumber.trim() || editingExpense.invoiceNumber,
        controlNumber: controlNumber.trim() || editingExpense.controlNumber,
        supplierName: supplierName.trim(),
        supplierRIF: supplierRIF.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        description: description.trim() || editingExpense.description,
        category,
        amountUSD,
        amountBs,
        baseImponibleBs,
        ivaBs,
        retencionIVABs,
        retencionISLRBs,
        bcvRate: editingExpense.bcvRate || bcvRate,
        paymentMethod,
        reference
      });
    } else {
      addExpense({
        date: new Date().toISOString(),
        invoiceNumber: invoiceNumber.trim() || `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
        controlNumber: controlNumber.trim() || `00-${Math.floor(1000 + Math.random() * 9000)}`,
        supplierName: supplierName.trim(),
        supplierRIF: supplierRIF.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        description: description.trim() || (purchasedItems.length > 0 ? `Compra de ${purchasedItems.length} artículo(s) con entrada a inventario` : `Gasto en ${category}`),
        category,
        amountUSD,
        amountBs,
        baseImponibleBs,
        ivaBs,
        retencionIVABs,
        retencionISLRBs,
        bcvRate,
        paymentMethod,
        reference,
        items: purchasedItems.length > 0 ? purchasedItems : undefined,
        costStrategy: defaultStrategy
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-teal-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-600/40 text-teal-200">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base">
                {editingExpense ? `Editar Compra / Factura ${editingExpense.invoiceNumber}` : 'Registrar Compra / Factura Proveedor'}
              </h3>
              <p className="text-xs text-teal-200">Impacta el Libro de Compras, Inventario en Firestore y Cuadre de Caja</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {!isCashRegisterOpen && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Caja Cerrada:</strong> Requiere apertura diaria para registrar compras y egresos.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAperturaModalOpen(true);
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 cursor-pointer"
              >
                Abrir Caja
              </button>
            </div>
          )}

          {/* Supplier Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-teal-700" />
              Datos del Proveedor y Factura
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Proveedor / Empresa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Polar C.A."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  RIF / Cédula <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="J-30192847-1"
                  value={supplierRIF}
                  onChange={(e) => setSupplierRIF(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  placeholder="Ej: 0414-1234567"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  N° Factura
                </label>
                <input
                  type="text"
                  placeholder="FAC-9842"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  N° Control
                </label>
                <input
                  type="text"
                  placeholder="00-9842"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                >
                  <option value="Mercancía">Mercancía (Inventario)</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Alquiler">Alquiler</option>
                  <option value="Nómina">Nómina</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Descripción / Concepto
              </label>
              <input
                type="text"
                placeholder="Ej: Reposición de mercancía según despacho de proveedor"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* SECTION: DETALLE DE ARTÍCULOS COMPRADOS (ENTRADA A INVENTARIO) */}
          <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                <Package className="w-4 h-4 text-teal-700" />
                <span>Detalle de Artículos Comprados (Entrada a Inventario)</span>
                {purchasedItems.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-teal-200 text-teal-900 rounded-md text-[10px] font-mono">
                    {purchasedItems.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowItemSection(!showItemSection)}
                className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
              >
                {showItemSection ? 'Ocultar formulario' : 'Mostrar formulario'}
              </button>
            </div>

            {showItemSection && (
              <div className="space-y-3 bg-white p-3 rounded-xl border border-teal-100 shadow-xs">
                {/* Product Search & Selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Seleccionar Producto del Catálogo:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
                    />
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-600 focus:outline-hidden font-medium"
                    >
                      <option value="">-- Elegir producto ({filteredProducts.length}) --</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `[${p.code}]` : ''} | Stock: {p.stock || 0}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedProduct && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-slate-600 font-mono">
                      <span>Stock Actual: <strong className="text-slate-900">{selectedProduct.stock || 0} {selectedProduct.unit}</strong></span>
                      <span>Costo Actual: <strong className="text-slate-900">${(selectedProduct.costUSD || 0).toFixed(2)}</strong></span>
                      <span>Precio Venta Actual: <strong className="text-teal-800">${(selectedProduct.priceUSD || 0).toFixed(2)}</strong></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* Quantity */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Cantidad que Entra (+):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="1"
                          value={itemQuantityInput}
                          onChange={(e) => setItemQuantityInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      {/* Unit Cost */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-semibold text-slate-700">
                            Costo Unitario de Compra:
                          </label>
                          <div className="flex gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                setItemCostCurrency('USD');
                                handleCostChange(itemCostInput, 'USD');
                              }}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${itemCostCurrency === 'USD' ? 'bg-teal-700 text-white font-bold' : 'text-slate-600 bg-slate-200'}`}
                            >
                              $ USD
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setItemCostCurrency('Bs');
                                handleCostChange(itemCostInput, 'Bs');
                              }}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${itemCostCurrency === 'Bs' ? 'bg-teal-700 text-white font-bold' : 'text-slate-600 bg-slate-200'}`}
                            >
                              Bs
                            </button>
                          </div>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={itemCostInput}
                          onChange={(e) => handleCostChange(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* SELECTOR DE ESTRATEGIA DE COSTOS E INVENTARIO */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-teal-700" />
                        <span>Estrategia de Costos e Inventario:</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Option 1: FIFO */}
                        <div
                          onClick={() => setItemStrategy('fifo')}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            itemStrategy === 'fifo'
                              ? 'bg-teal-50 border-teal-500 shadow-xs ring-1 ring-teal-500'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900 flex items-center gap-1">
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${itemStrategy === 'fifo' ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-400'}`}>
                                {itemStrategy === 'fifo' && <Check className="w-2.5 h-2.5" />}
                              </span>
                              Opción 1: Lotes Separados (FIFO)
                            </span>
                            <span className="text-[10px] font-mono text-teal-800 font-bold bg-teal-100 px-1 rounded">Precios Justos</span>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-tight">
                            Suma el stock físico pero <strong>mantiene el precio actual (${(selectedProduct.priceUSD || 0).toFixed(2)})</strong> hasta agotar las unidades previas.
                          </p>
                        </div>

                        {/* Option 2: Average Cost / New Lot */}
                        <div
                          onClick={() => setItemStrategy('average_cost')}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            itemStrategy === 'average_cost'
                              ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900 flex items-center gap-1">
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${itemStrategy === 'average_cost' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400'}`}>
                                {itemStrategy === 'average_cost' && <Check className="w-2.5 h-2.5" />}
                              </span>
                              Opción 2: Actualizar Costo y Precio
                            </span>
                            <span className="text-[10px] font-mono text-blue-800 font-bold bg-blue-100 px-1 rounded">Recalcular</span>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-tight">
                            Suma stock y <strong>recalcula el precio de venta</strong> aplicando el margen comercial al nuevo costo unitario.
                          </p>
                        </div>
                      </div>

                      {/* Preview of Price / Stock impact */}
                      {itemStrategy === 'average_cost' && (
                        <div className="p-2 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between text-[11px]">
                          <span className="text-blue-900">
                            Precio de Venta Sugerido (Nuevo Lote):
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-blue-900">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={customNewPriceUSD}
                              onChange={(e) => setCustomNewPriceUSD(e.target.value)}
                              className="w-20 px-2 py-1 bg-white border border-blue-300 rounded font-mono font-bold text-blue-900 text-xs"
                            />
                            <span className="text-[10px] text-blue-700 font-mono">
                              (≈ Bs. {formatBs((parseFloat(customNewPriceUSD) || 0) * bcvRate)})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedProductId || (parseFloat(itemQuantityInput) || 0) <= 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Artículo a la Factura</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Added Items Table */}
            {purchasedItems.length > 0 ? (
              <div className="space-y-2">
                <div className="border border-teal-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-teal-900 text-white">
                      <tr>
                        <th className="py-1.5 px-2.5">Producto</th>
                        <th className="py-1.5 px-2 text-center">Cant.</th>
                        <th className="py-1.5 px-2 text-right">Costo Unit.</th>
                        <th className="py-1.5 px-2 text-right">Subtotal</th>
                        <th className="py-1.5 px-2 text-center">Estrategia</th>
                        <th className="py-1.5 px-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchasedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-teal-50/40">
                          <td className="py-2 px-2.5 font-medium text-slate-900">
                            {item?.productName || 'Producto'}
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">
                            +{item?.quantity ?? 0}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">
                            ${(Number(item?.unitCostUSD) || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-teal-800">
                            ${(Number(item?.totalCostUSD) || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {item?.strategy === 'fifo' ? (
                              <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-semibold">
                                FIFO (Lote)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                                Actualizado (${(Number(item?.newPriceUSD) || 0).toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                              title="Eliminar artículo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Items Total Summary & Sync Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-teal-100/70 border border-teal-200 rounded-xl text-xs">
                  <div className="font-medium text-teal-950">
                    Total Artículos Comprados: <strong className="font-mono text-sm">${totalItemsUSD.toFixed(2)}</strong>
                    <span className="text-[11px] text-teal-800 font-mono ml-1.5">
                      (≈ Bs. {formatBs(totalItemsBs)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={syncInvoiceAmountWithItems}
                    className="flex items-center gap-1 px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Usar como Monto de Factura</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white/70 border border-dashed border-teal-200 rounded-xl text-center text-xs text-slate-500">
                Opcional: Si esta factura incluye reposición de mercancía, añade los artículos arriba para actualizar el stock físico y los costos en Firestore.
              </div>
            )}
          </div>

          {/* Amount & Currency */}
          <div className="p-3.5 bg-slate-100 rounded-xl space-y-2 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Monto Total de la Factura / Pago:
              </label>
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    currency === 'USD' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  En USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('Bs')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    currency === 'Bs' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  En Bolívares (Bs)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">
                {currency === 'USD' ? '$' : 'Bs.'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>

            <div className="text-[11px] text-slate-600 flex justify-between font-mono">
              <span>Equivalente: {currency === 'USD' ? `Bs. ${formatBs(amountBs)}` : `$ ${formatUSD(amountUSD)}`}</span>
              <span>Tasa BCV: Bs. {safeBcvRate.toFixed(2)}</span>
            </div>
          </div>

          {/* Fiscal SENIAT options */}
          <div className="space-y-1.5 p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs">
            <div className="font-bold text-teal-900 mb-1">Normativa Fiscal (SENIAT):</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasIVA}
                onChange={(e) => setHasIVA(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-slate-700">Incluye IVA 16% (Crédito Fiscal)</span>
            </label>

            {hasIVA && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyRetencionIVA}
                  onChange={(e) => setApplyRetencionIVA(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-700">Aplicar Retención de IVA 75% (Contribuyente Especial)</span>
              </label>
            )}

            {hasIVA && (
              <div className="pt-2 border-t border-teal-200/80 text-[11px] text-teal-900 font-mono grid grid-cols-2 gap-1">
                <div>Base Imp: Bs. {formatBs(baseImponibleBs)}</div>
                <div>IVA 16%: Bs. {formatBs(ivaBs)}</div>
                {applyRetencionIVA && <div>Ret. IVA: Bs. {formatBs(retencionIVABs)}</div>}
                <div>Ret. ISLR: Bs. {formatBs(retencionISLRBs)}</div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Método de Pago Egresado
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
              >
                <option value="pago_movil">Pago Móvil</option>
                <option value="efectivo_usd">Efectivo USD (Caja)</option>
                <option value="efectivo_bs">Efectivo Bs (Caja)</option>
                <option value="debito">Punto de Venta</option>
                <option value="transferencia">Transferencia Bancaria</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Referencia de Pago
              </label>
              <input
                type="text"
                placeholder="Ej: Ref 849201"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-1 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            {isCashRegisterOpen || editingExpense ? (
              <button
                type="submit"
                disabled={!supplierName.trim() || rawAmount <= 0}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>
                  {editingExpense
                    ? 'Guardar Cambios de Factura'
                    : `Guardar Factura ${purchasedItems.length > 0 ? `e Ingresar ${purchasedItems.length} Artículos` : 'en Compras'}`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAperturaModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Abrir Caja para Registrar</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
