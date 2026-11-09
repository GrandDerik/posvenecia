import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertTriangle,
  ArrowUpDown,
  Barcode,
  Image as ImageIcon,
  Upload,
  FileText,
  DollarSign,
  Coins
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatBs, formatUSD } from '../utils/exportUtils';

export const ProductsView: React.FC = () => {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    adjustStock, 
    bcvRate, 
    categories: appCategories, 
    addCategory,
    baseCurrency
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Víveres');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  
  // Pricing
  const [priceUSD, setPriceUSD] = useState('');
  const [priceBs, setPriceBs] = useState('');
  const [costUSD, setCostUSD] = useState('');
  const [costBs, setCostBs] = useState('');
  const [activeCurrencyInput, setActiveCurrencyInput] = useState<'USD' | 'Bs'>(baseCurrency === 'VED' ? 'Bs' : 'USD');

  // Stock & specs
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [unit, setUnit] = useState('unidad');
  const [isExemptFromIVA, setIsExemptFromIVA] = useState(true);
  const [isService, setIsService] = useState(false);

  // Photo & Purchase Note
  const [imageUrl, setImageUrl] = useState<string>('');
  const [purchaseNote, setPurchaseNote] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Todos', ...appCategories];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.includes(searchTerm) ||
                          (p.purchaseNote && p.purchaseNote.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = categoryFilter === 'Todos' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setCode(''); // Blanco por defecto según solicitud del usuario para escanear o escribir directo
    setName('');
    setCategory('Víveres');
    setIsCreatingCategory(false);
    setNewCategoryInput('');
    setCostUSD('');
    setCostBs('');
    setPriceUSD('');
    setPriceBs('');
    setActiveCurrencyInput(baseCurrency === 'VED' ? 'Bs' : 'USD');
    setStock('20');
    setMinStock('5');
    setUnit('unidad');
    setIsExemptFromIVA(true);
    setIsService(false);
    setImageUrl('');
    setPurchaseNote('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setCategory(p.category);
    setIsCreatingCategory(false);
    setNewCategoryInput('');
    setCostUSD(p.costUSD ? p.costUSD.toString() : '');
    setCostBs(p.costUSD ? (p.costUSD * bcvRate).toFixed(2) : '');
    setPriceUSD(p.priceUSD ? p.priceUSD.toString() : '');
    setPriceBs(p.priceUSD ? (p.priceUSD * bcvRate).toFixed(2) : '');
    setActiveCurrencyInput(baseCurrency === 'VED' ? 'Bs' : 'USD');
    setStock(p.stock.toString());
    setMinStock(p.minStock.toString());
    setUnit(p.unit);
    setIsExemptFromIVA(p.isExemptFromIVA);
    setIsService(Boolean(p.isService || p.itemType === 'servicio'));
    setImageUrl(p.imageUrl || '');
    setPurchaseNote(p.purchaseNote || '');
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen no debe superar los 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Price changes sync
  const handlePriceUSDChange = (val: string) => {
    setPriceUSD(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setPriceBs((num * bcvRate).toFixed(2));
    } else {
      setPriceBs('');
    }
  };

  const handlePriceBsChange = (val: string) => {
    setPriceBs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && bcvRate > 0) {
      setPriceUSD((num / bcvRate).toFixed(2));
    } else {
      setPriceUSD('');
    }
  };

  const handleCostUSDChange = (val: string) => {
    setCostUSD(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setCostBs((num * bcvRate).toFixed(2));
    } else {
      setCostBs('');
    }
  };

  const handleCostBsChange = (val: string) => {
    setCostBs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && bcvRate > 0) {
      setCostUSD((num / bcvRate).toFixed(2));
    } else {
      setCostUSD('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalCategory = category;
    if (isCreatingCategory && newCategoryInput.trim()) {
      addCategory(newCategoryInput.trim());
      finalCategory = newCategoryInput.trim();
    } else if (isService && category === 'Víveres') {
      finalCategory = 'Servicios';
    }

    const calculatedPriceUSD = parseFloat(priceUSD) || 0;
    const calculatedCostUSD = parseFloat(costUSD) || 0;

    const prodData: Omit<Product, 'id'> = {
      code: code.trim() || (isService ? 'SRV-' + Math.floor(1000 + Math.random() * 9000) : '759' + Date.now().toString().slice(-9)),
      name: name.trim(),
      category: finalCategory,
      costUSD: calculatedCostUSD,
      priceUSD: calculatedPriceUSD,
      priceBsFixed: baseCurrency === 'VED' ? (parseFloat(priceBs) || undefined) : undefined,
      stock: isService ? 999999 : (parseInt(stock) || 0),
      minStock: isService ? 0 : (parseInt(minStock) || 5),
      unit: unit.trim() || (isService ? 'servicio' : 'unidad'),
      isExemptFromIVA,
      itemType: isService ? 'servicio' : 'producto',
      isService,
      imageUrl: imageUrl.trim() || undefined,
      purchaseNote: purchaseNote.trim() || undefined
    };

    if (editingProduct) {
      updateProduct({
        ...prodData,
        id: editingProduct.id
      });
    } else {
      addProduct(prodData);
    }

    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const data = products.map((p, idx) => ({
      'N°': idx + 1,
      'Tipo': (p.isService || p.itemType === 'servicio') ? 'Servicio' : 'Producto',
      'Código de Barra': p.code,
      'Nombre': p.name,
      'Categoría': p.category,
      'Costo USD': p.costUSD,
      'Precio USD': p.priceUSD,
      'Precio Bs (Tasa BCV)': Number((p.priceUSD * bcvRate).toFixed(2)),
      'Stock Actual': (p.isService || p.itemType === 'servicio') ? 'Ilimitado' : p.stock,
      'Stock Mínimo': (p.isService || p.itemType === 'servicio') ? '-' : p.minStock,
      'Unidad': p.unit,
      'Tratamiento Fiscal': p.isExemptFromIVA ? 'Exento de IVA' : 'Gravado 16%',
      'Nota de Compra / Factura': p.purchaseNote || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
    XLSX.writeFile(wb, `PosVenecia_Productos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-blue-100 text-blue-800">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Catálogo de Productos & Precios Bimonetarios
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Precios sincronizados con la tasa oficial BCV: <strong>Bs. {formatBs(bcvRate)}</strong> • Moneda base: <strong>{baseCurrency === 'VED' ? 'Bolívares (VED)' : 'Dólar (USD)'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Producto</span>
          </button>
        </div>
      </div>

      {/* Search & Categories Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, código de barra o nota de compra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === c
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Foto</th>
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Producto / Servicio</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-center">Régimen IVA</th>
                <th className="py-3.5 px-4 text-right">
                  {baseCurrency === 'VED' ? 'Precio Bs (VED)' : 'Precio USD'}
                </th>
                <th className="py-3.5 px-4 text-right">
                  {baseCurrency === 'VED' ? 'Equiv USD ($)' : 'Precio Bs (BCV)'}
                </th>
                <th className="py-3.5 px-4 text-center">Stock</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((prod) => {
                const priceBsVal = prod.priceUSD * bcvRate;
                const isService = Boolean(prod.isService || prod.itemType === 'servicio');
                const isLow = !isService && prod.stock <= prod.minStock;

                return (
                  <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Thumbnail Photo */}
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {prod.imageUrl ? (
                          <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-400 stroke-1" />
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500 font-semibold">
                      {prod.code}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 leading-tight">
                        {prod.name}
                        {isService && (
                          <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded uppercase">
                            Servicio
                          </span>
                        )}
                      </div>
                      {prod.purchaseNote && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate max-w-xs">{prod.purchaseNote}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-medium">
                        {prod.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        prod.isExemptFromIVA 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {prod.isExemptFromIVA ? 'Exento (E)' : 'Gravado 16%'}
                      </span>
                    </td>

                    {/* Primary Price */}
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      {baseCurrency === 'VED' 
                        ? `Bs. ${formatBs(priceBsVal)}` 
                        : `$${formatUSD(prod.priceUSD)}`}
                    </td>

                    {/* Secondary Converted Price */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 text-sm">
                      {baseCurrency === 'VED' 
                        ? `$${formatUSD(prod.priceUSD)}` 
                        : `Bs. ${formatBs(priceBsVal)}`}
                    </td>

                    {/* Stock */}
                    <td className="py-3 px-4 text-center">
                      {isService ? (
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded-lg text-[10px] whitespace-nowrap">
                          ⚡ Servicio
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => adjustStock(prod.id, prod.stock - 1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                            isLow ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {prod.stock} {prod.unit}
                          </span>
                          <button
                            onClick={() => adjustStock(prod.id, prod.stock + 1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(prod)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(prod)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {products.length === 0 ? 'Catálogo Vacío (Listo para arrancar)' : 'No se encontraron productos'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {products.length === 0 
                  ? 'No hay productos ni servicios registrados aún. Comience agregando sus propios artículos con foto, notas y precios.'
                  : 'Prueba con otro término de búsqueda o selecciona otra categoría.'}
              </p>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primer Producto</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">
                {editingProduct ? 'Editar Producto / Servicio' : 'Nuevo Producto / Servicio'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Type selector: Físico vs Servicio */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsService(false);
                    if (category === 'Servicios') setCategory('Víveres');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    !isService ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📦 Producto Físico (con stock)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsService(true);
                    setCategory('Servicios');
                    setUnit('servicio');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    isService ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚡ Servicio (Copiado / Redacción)
                </button>
              </div>

              {/* Photo section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Foto producto" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300 stroke-1" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 block">Foto del Producto (Opcional)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{imageUrl ? 'Cambiar Foto' : 'Cargar Foto'}</span>
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Code & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Código {isService ? 'de Referencia' : 'de Barra'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setCode('759' + Math.floor(100000000 + Math.random() * 900000000))}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      title="Generar código aleatorio si el artículo no tiene barra física"
                    >
                      + Generar auto
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Escanear o escribir código..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Categoría</label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {isCreatingCategory ? 'Seleccionar lista' : '+ Nueva'}
                    </button>
                  </div>
                  {isCreatingCategory ? (
                    <input
                      type="text"
                      required
                      placeholder="Nueva Categoría"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="w-full px-3 py-2 bg-blue-50/50 border border-blue-300 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      {categories.filter(c => c !== 'Todos').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre del {isService ? 'Servicio' : 'Producto'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={isService ? "Ej: Fotocopia B/N o Redacción de Carta" : "Ej: Harina PAN Blanca 1kg"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              {/* Price Fields with Dual USD & VED */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Precios Bimonetarios (Tasa BCV: Bs. {formatBs(bcvRate)})
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveCurrencyInput('USD')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        activeCurrencyInput === 'USD' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      En $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCurrencyInput('Bs')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        activeCurrencyInput === 'Bs' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      En Bs VED
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Precio de Venta {activeCurrencyInput === 'USD' ? '($ USD) *' : '(Bs VED) *'}
                    </label>
                    {activeCurrencyInput === 'USD' ? (
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="1.35"
                          value={priceUSD}
                          onChange={(e) => handlePriceUSDChange(e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">Bs.</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="1200.00"
                          value={priceBs}
                          onChange={(e) => handlePriceBsChange(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      {activeCurrencyInput === 'USD' 
                        ? `≈ Bs. ${formatBs((parseFloat(priceUSD) || 0) * bcvRate)}`
                        : `≈ $${formatUSD(parseFloat(priceUSD) || 0)} USD`}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Costo Unitario ({activeCurrencyInput === 'USD' ? '$ USD' : 'Bs VED'})
                    </label>
                    {activeCurrencyInput === 'USD' ? (
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="1.00"
                          value={costUSD}
                          onChange={(e) => handleCostUSDChange(e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">Bs.</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="900.00"
                          value={costBs}
                          onChange={(e) => handleCostBsChange(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                        />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      Margen: {priceUSD && costUSD && parseFloat(priceUSD) > 0 
                        ? `${Math.round(((parseFloat(priceUSD) - parseFloat(costUSD)) / parseFloat(priceUSD)) * 100)}%` 
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock controls or Service indicator */}
              {isService ? (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">⚡ Servicio Continuo</span>
                    <span className="text-[11px] text-indigo-700">Disponibilidad sin agotamiento de inventario</span>
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">Unidad</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="servicio / copia"
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Stock Inicial
                    </label>
                    <input
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Stock Mínimo
                    </label>
                    <input
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Unidad
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Optional Purchase Note / Invoice number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota Opcional de Compra (Fecha o N° de Factura de Compra)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Comprado el 28/10/2026 en Factura #8921 de Alimentos Polar"
                  value={purchaseNote}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Treatment SENIAT (Exempt from IVA) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isExemptFromIVA}
                    onChange={(e) => setIsExemptFromIVA(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Producto Exento de IVA (Alimentos de la cesta básica según SENIAT)</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-sm text-slate-900">¿Eliminar este producto?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Se eliminará <strong className="text-slate-900">{productToDelete.name}</strong> del catálogo de ventas.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
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
