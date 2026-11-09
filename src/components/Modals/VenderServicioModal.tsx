import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Copy, 
  Printer, 
  FileEdit, 
  Sparkles, 
  Plus, 
  X, 
  Calculator,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { formatBs, formatUSD } from '../../utils/exportUtils';

interface VenderServicioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ServiceTab = 'copiado' | 'impresiones' | 'redacciones' | 'personalizado';

export const VenderServicioModal: React.FC<VenderServicioModalProps> = ({ isOpen, onClose }) => {
  const { bcvRate, addQuickService, categories, addCategory } = useApp();

  const [activeTab, setActiveTab] = useState<ServiceTab>('copiado');

  // Service form fields
  const [serviceName, setServiceName] = useState('Fotocopia Blanco y Negro Carta');
  const [unitPriceUSD, setUnitPriceUSD] = useState<number>(0.05);
  const [quantity, setQuantity] = useState<number>(1);
  const [isExemptIVA, setIsExemptIVA] = useState<boolean>(true);
  const [details, setDetails] = useState<string>('');
  
  // Custom category
  const [selectedCategory, setSelectedCategory] = useState<string>('Servicios');
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  if (!isOpen) return null;

  // Preset services by tab
  const presets: Record<ServiceTab, { name: string; priceUSD: number; exempt: boolean; defaultQty?: number; placeholder?: string }[]> = {
    copiado: [
      { name: 'Fotocopia Blanco y Negro (Carta)', priceUSD: 0.05, exempt: true, defaultQty: 5 },
      { name: 'Fotocopia B/N Oficio / Doble Faz', priceUSD: 0.08, exempt: true, defaultQty: 5 },
      { name: 'Fotocopia a Color (Carta)', priceUSD: 0.20, exempt: false, defaultQty: 1 },
      { name: 'Fondo Negro Certificado de Título', priceUSD: 1.00, exempt: false, defaultQty: 1 },
    ],
    impresiones: [
      { name: 'Impresión Digital B/N Láser (Página)', priceUSD: 0.10, exempt: false, defaultQty: 5 },
      { name: 'Impresión Digital Color Láser (Página)', priceUSD: 0.35, exempt: false, defaultQty: 1 },
      { name: 'Foto Carnet / Documento (Juego 4 fotos)', priceUSD: 1.50, exempt: false, defaultQty: 1 },
      { name: 'Plastificado / Enmicado Térmico', priceUSD: 0.60, exempt: false, defaultQty: 1 },
    ],
    redacciones: [
      { name: 'Redacción: Carta de Trabajo / Aval / Carta Formal', priceUSD: 2.00, exempt: true, defaultQty: 1, placeholder: 'Ej: Carta de trabajo para banco o aval de residencia' },
      { name: 'Redacción: Contrato de Alquiler / Documento Legal Básico', priceUSD: 5.00, exempt: false, defaultQty: 1, placeholder: 'Ej: Contrato de arrendamiento de local o apartamento' },
      { name: 'Redacción: Asesoría de Trabajo Académico o Informe', priceUSD: 4.00, exempt: false, defaultQty: 1, placeholder: 'Ej: Ensayo universitario, informe de pasantías o normas APA' },
      { name: 'Redacción: Transcripción de Texto por Cuartilla / Página', priceUSD: 1.00, exempt: true, defaultQty: 1, placeholder: 'Ej: Transcripción de manuscrito, audio o apuntes' },
      { name: 'Redacción: Curriculum Vitae (CV) / Hoja de Vida', priceUSD: 3.00, exempt: false, defaultQty: 1, placeholder: 'Ej: Formato profesional ATS con diseño limpio' }
    ],
    personalizado: [
      { name: 'Servicio Personalizado / Mano de Obra a Medida', priceUSD: 3.00, exempt: false, defaultQty: 1, placeholder: 'Detalle o descripción del servicio prestado' }
    ]
  };

  const handleSelectPreset = (preset: { name: string; priceUSD: number; exempt: boolean; defaultQty?: number }) => {
    setServiceName(preset.name);
    setUnitPriceUSD(preset.priceUSD);
    setIsExemptIVA(preset.exempt);
    if (preset.defaultQty) {
      setQuantity(preset.defaultQty);
    }
  };

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return;
    addCategory(newCategoryName.trim());
    setSelectedCategory(newCategoryName.trim());
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unitPriceUSD <= 0 || quantity <= 0) return;

    let finalCategory = activeTab === 'redacciones' 
      ? 'Redacciones' 
      : activeTab === 'copiado' 
        ? 'Copiado' 
        : activeTab === 'impresiones' 
          ? 'Impresiones' 
          : (selectedCategory || 'Servicios');

    if (isCreatingCategory && newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      finalCategory = newCategoryName.trim();
    }

    addQuickService({
      name: serviceName,
      category: finalCategory,
      priceUSD: unitPriceUSD,
      quantity: quantity,
      isExemptFromIVA: isExemptIVA,
      notes: details.trim() || undefined
    });

    onClose();
  };

  const totalUSD = unitPriceUSD * quantity;
  const totalBs = totalUSD * bcvRate;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">Vender Servicios</h3>
              <p className="text-xs text-blue-100">Copiado, Impresiones y Servicios de Redacción</p>
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

        {/* Category Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 grid grid-cols-4 gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('copiado');
              handleSelectPreset(presets.copiado[0]);
              setSelectedCategory('Copiado');
            }}
            className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'copiado'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>Copiado</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('impresiones');
              handleSelectPreset(presets.impresiones[0]);
              setSelectedCategory('Impresiones');
            }}
            className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'impresiones'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Impresiones</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('redacciones');
              handleSelectPreset(presets.redacciones[0]);
              setSelectedCategory('Redacciones');
            }}
            className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'redacciones'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            <span>Redacciones</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('personalizado');
              handleSelectPreset(presets.personalizado[0]);
              setSelectedCategory('Servicios');
            }}
            className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'personalizado'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Personalizado</span>
          </button>
        </div>

        {/* Service Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Quick presets list for active tab */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Servicios Sugeridos ({activeTab.toUpperCase()}):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets[activeTab].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                    serviceName === p.name
                      ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="font-bold text-slate-800 line-clamp-2 leading-tight">{p.name}</span>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60">
                    <span className="font-mono font-black text-blue-700">${formatUSD(p.priceUSD)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Bs. {formatBs(p.priceUSD * bcvRate)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Service Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre o Concepto del Servicio:
            </label>
            <input
              type="text"
              required
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Ej: Redacción de Carta de Trabajo / Aval"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category selection and creation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Tag className="w-3 h-3 text-blue-600" />
                Categoría del Servicio:
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                {isCreatingCategory ? 'Seleccionar existente' : '+ Crear nueva categoría'}
              </button>
            </div>

            {isCreatingCategory ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Ej: Asesoría Legal, Diseño, Trámites..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-blue-50/50 border border-blue-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCreateNewCategory}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Crear
                </button>
              </div>
            ) : (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Details / Notes / Device / Document details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones o Detalles del Documento / Servicio:
            </label>
            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Ej: Carta para Banesco a nombre de Pedro Pérez / 3 páginas"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quantity & Unit Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cantidad / Páginas / Hojas:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-center"
                />
              </div>

              {/* Quick count chips */}
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 5, 10, 20].map(qty => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setQuantity(qty)}
                    className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      quantity === qty ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio Unitario ($ USD):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={unitPriceUSD}
                  onChange={(e) => setUnitPriceUSD(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                Equiv: Bs. {formatBs(unitPriceUSD * bcvRate)}
              </span>
            </div>
          </div>

          {/* Tax treatment */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Tratamiento Fiscal SENIAT</span>
                <span className="text-[10px] text-slate-500">
                  {isExemptIVA ? 'Servicio exento de IVA' : 'Gravado con alícuota general 16%'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExemptIVA(!isExemptIVA)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                isExemptIVA
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
            >
              {isExemptIVA ? 'Exento (E)' : 'IVA 16% (G)'}
            </button>
          </div>

          {/* Total Bimonetary Box */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-300 uppercase tracking-wider font-bold block">
                Total a Facturar
              </span>
              <span className="text-xs text-slate-300">
                {quantity} {quantity === 1 ? 'servicio' : 'servicios'} x ${formatUSD(unitPriceUSD)}
              </span>
            </div>

            <div className="text-right">
              <div className="text-lg font-black text-white font-mono-numbers">
                ${formatUSD(totalUSD)}
              </div>
              <div className="text-xs font-extrabold text-blue-300 font-mono-numbers">
                Bs. {formatBs(totalBs)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar al Carrito</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
