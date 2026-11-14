import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  Barcode, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  DollarSign, 
  Smartphone, 
  CreditCard, 
  Banknote, 
  Layers, 
  Users, 
  Sparkles, 
  Truck,
  Check, 
  AlertCircle,
  X,
  Package,
  Receipt,
  UserCheck,
  Edit,
  Landmark,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  List,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { Product, PaymentMethod, PaymentDetails, Sale, Client } from '../types';
import { formatBs, formatUSD } from '../utils/exportUtils';
import { PagoMovilModal } from './Modals/PagoMovilModal';
import { VentaFiadaModal } from './Modals/VentaFiadaModal';
import { PagoCombinadoModal } from './Modals/PagoCombinadoModal';
import { TransaccionExitosaModal } from './Modals/TransaccionExitosaModal';
import { ComprobanteTicketModal } from './Modals/ComprobanteTicketModal';
import { VenderServicioModal } from './Modals/VenderServicioModal';
import { RecargoModal } from './Modals/RecargoModal';

export const POSView: React.FC = () => {
  const { 
    bcvRate, 
    products, 
    categories: appCategories,
    cart, 
    addToCart, 
    removeFromCart, 
    updateCartQuantity, 
    clearCart,
    applyIVA,
    setApplyIVA,
    applyIGTF,
    setApplyIGTF,
    completeSale,
    fiados,
    businessInfo,
    clients,
    selectedClientForPOS,
    setSelectedClientForPOS,
    setActiveTab,
    baseCurrency,
    isCashRegisterOpen,
    setIsAperturaModalOpen,
    managerPin,
    setIsCreditNoteModalOpen
  } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [barcodeInput, setBarcodeInput] = useState('');

  // View Mode: Grid (tarjetas con foto) vs List (filas compactas)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('posvenecia_pos_view_mode') as 'grid' | 'list') || 'grid';
  });

  // Modal Producto Inexistente
  const [isNotFoundModalOpen, setIsNotFoundModalOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState('');
  const [notFoundMsg, setNotFoundMsg] = useState('');

  // Selected Payment Method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('efectivo_usd');
  
  // Modals state
  const [isPMModalOpen, setIsPMModalOpen] = useState(false);
  const [isFiadoModalOpen, setIsFiadoModalOpen] = useState(false);
  const [isCombinadoModalOpen, setIsCombinadoModalOpen] = useState(false);
  const [isServicioModalOpen, setIsServicioModalOpen] = useState(false);
  const [isRecargoModalOpen, setIsRecargoModalOpen] = useState(false);
  const [isTransferenciaModalOpen, setIsTransferenciaModalOpen] = useState(false);
  
  // Client selection modals (no browser prompt)
  const [isHabitualesModalOpen, setIsHabitualesModalOpen] = useState(false);
  const [isCustomClientModalOpen, setIsCustomClientModalOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // Custom client form state
  const [customClientName, setCustomClientName] = useState('Consumidor Final');
  const [customClientRIF, setCustomClientRIF] = useState('V-00000000');
  const [customClientPhone, setCustomClientPhone] = useState('');
  const [customClientAddress, setCustomClientAddress] = useState('');

  // Transferencia details
  const [transferenciaBank, setTransferenciaBank] = useState('0102 - Banco de Venezuela');
  const [transferenciaRef, setTransferenciaRef] = useState('');

  const [successSale, setSuccessSale] = useState<Sale | null>(null);
  const [ticketModalSale, setTicketModalSale] = useState<Sale | null>(null);

  // Stored details before finalizing
  const [pagoMovilData, setPagoMovilData] = useState<{ bank: string; ref: string; phone: string; ci: string } | null>(null);
  const [combinedData, setCombinedData] = useState<any>(null);
  const [fiadoData, setFiadoData] = useState<any>(null);

  // Double-submit protection
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const isProcessingCheckoutRef = useRef(false);

  // Manager PIN modal state to authorize disabling fiscal IVA
  const [isManagerPinModalOpen, setIsManagerPinModalOpen] = useState(false);
  const [managerPinInput, setManagerPinInput] = useState('');
  const [managerPinError, setManagerPinError] = useState('');

  // Active client details
  const [clientName, setClientName] = useState('Consumidor Final');
  const [clientRIF, setClientRIF] = useState('V-00000000');
  const [clientPhone, setClientPhone] = useState<string | undefined>(undefined);
  const [clientAddress, setClientAddress] = useState<string | undefined>(undefined);

  // Sync selectedClientForPOS from context
  useEffect(() => {
    if (selectedClientForPOS) {
      setClientName(selectedClientForPOS.name);
      setClientRIF(selectedClientForPOS.rif);
      setClientPhone(selectedClientForPOS.phone);
      setClientAddress(selectedClientForPOS.address);
    }
  }, [selectedClientForPOS]);

  // Categories list dynamic from context
  const categories = ['Todos', ...appCategories];

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Barcode / Code search and cart addition
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    const queryLower = query.toLowerCase();
    const found = products.find(p => {
      const pCode = (p.code || '').trim().toLowerCase();
      return pCode === queryLower || p.code === query;
    });

    if (found) {
      const isService = Boolean(found.isService || found.itemType === 'servicio');
      if (!isService && found.stock <= 0) {
        setNotFoundCode(query);
        setNotFoundMsg(`El producto "${found.name}" está registrado pero actualmente está agotado (Stock: 0).`);
        setIsNotFoundModalOpen(true);
      } else {
        addToCart(found, 1);
      }
      setBarcodeInput('');
    } else {
      // Producto inexistente: NO añadir nada al carrito y avisar al usuario
      setNotFoundCode(query);
      setNotFoundMsg(`No se encontró ningún producto registrado con el código "${query}".`);
      setIsNotFoundModalOpen(true);
      setBarcodeInput('');
    }
  };

  // Cart calculations
  let exemptUSD = 0;
  let taxableUSD = 0;

  cart.forEach(item => {
    if (applyIVA && !item.product.isExemptFromIVA) {
      taxableUSD += item.totalUSD;
    } else {
      exemptUSD += item.totalUSD;
    }
  });

  const subtotalUSD = exemptUSD + taxableUSD;
  const ivaUSD = taxableUSD * 0.16;

  let igtfUSD = 0;
  if (applyIGTF) {
    if (selectedMethod === 'efectivo_usd') {
      igtfUSD = Number(((subtotalUSD + ivaUSD) * 0.03).toFixed(2));
    } else if (selectedMethod === 'pago_combinado' && combinedData?.usdCash) {
      igtfUSD = Number((combinedData.usdCash * 0.03).toFixed(2));
    }
  }

  const totalUSD = Number((subtotalUSD + ivaUSD + igtfUSD).toFixed(2));

  const subtotalBs = subtotalUSD * bcvRate;
  const exemptBs = exemptUSD * bcvRate;
  const taxableBs = taxableUSD * bcvRate;
  const ivaBs = ivaUSD * bcvRate;
  const igtfBs = igtfUSD * bcvRate;
  const totalBs = totalUSD * bcvRate;

  // Handle Payment Method Selection
  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    if (method === 'pago_movil') {
      setIsPMModalOpen(true);
    } else if (method === 'fiao') {
      setIsFiadoModalOpen(true);
    } else if (method === 'pago_combinado') {
      setIsCombinadoModalOpen(true);
    } else if (method === 'transferencia') {
      setIsTransferenciaModalOpen(true);
    }
  };

  // Finalize sale checkout with double-submit protection
  const handleCheckout = () => {
    if (isProcessingCheckoutRef.current) {
      console.warn('[POSView] Prevenido doble envío de venta (double-submit protection)');
      return;
    }

    if (cart.length === 0) return;

    if (!isCashRegisterOpen) {
      setIsAperturaModalOpen(true);
      return;
    }

    if (selectedMethod === 'pago_movil' && !pagoMovilData) {
      setIsPMModalOpen(true);
      return;
    }

    if (selectedMethod === 'fiao' && !fiadoData) {
      setIsFiadoModalOpen(true);
      return;
    }

    if (selectedMethod === 'pago_combinado' && !combinedData) {
      setIsCombinadoModalOpen(true);
      return;
    }

    if (selectedMethod === 'transferencia' && !transferenciaRef) {
      setIsTransferenciaModalOpen(true);
      return;
    }

    // Lock immediate submission
    isProcessingCheckoutRef.current = true;
    setIsProcessingCheckout(true);

    try {
      const paymentDetails: PaymentDetails = {
        method: selectedMethod,
        pagoMovilRef: pagoMovilData?.ref,
        pagoMovilBank: pagoMovilData?.bank,
        pagoMovilPhone: pagoMovilData?.phone,
        pagoMovilCI: pagoMovilData?.ci,
        transferenciaRef: selectedMethod === 'transferencia' ? transferenciaRef : undefined,
        transferenciaBank: selectedMethod === 'transferencia' ? transferenciaBank : undefined,
        fiaoClientName: fiadoData?.clientName,
        fiaoClientCI: fiadoData?.clientCI,
        fiaoInitialAbonoUSD: fiadoData?.initialAbonoUSD,
        fiaoInitialAbonoBs: fiadoData?.initialAbonoBs,
        fiaoRemainingUSD: fiadoData?.remainingUSD,
        combinedBreakdown: combinedData
      };

      const finalClient = {
        name: fiadoData?.clientName || clientName,
        rif: fiadoData?.clientCI || clientRIF,
        phone: fiadoData?.clientPhone || clientPhone,
        address: fiadoData?.clientAddress || clientAddress
      };

      const createdSale = completeSale(finalClient, paymentDetails);

      // Reset flow states
      setPagoMovilData(null);
      setFiadoData(null);
      setCombinedData(null);
      setTransferenciaRef('');
      setSuccessSale(createdSale);
    } catch (err: any) {
      console.error('[POSView] Error al procesar venta:', err);
    } finally {
      // Cooldown timer to prevent accidental double clicks
      setTimeout(() => {
        isProcessingCheckoutRef.current = false;
        setIsProcessingCheckout(false);
      }, 600);
    }
  };

  // Filtered habitual clients
  const filteredHabituales = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.rif.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.phone.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5">
      {/* Caja Cerrada Alert Banner */}
      {!isCashRegisterOpen && (
        <div className="mb-5 bg-[#FFF3E8] border border-[#F5D3B3] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D96B27] text-white rounded-2xl shadow-xs shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#7C3A0B] text-sm sm:text-base">
                Caja Cerrada: Se requiere apertura para vender
              </h3>
              <p className="text-xs text-[#9A4B12] mt-0.5">
                Para iniciar la jornada diaria y registrar ventas en el punto de venta, abre la caja estableciendo el fondo inicial en efectivo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAperturaModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4" />
            <span>Abrir Caja Ahora</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Side: Product Catalog & Search (8 Columns) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Top Search & Barcode Scan Tool */}
          <div className="bg-white/95 p-4 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {/* Product search */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Barcode Scanner simulation input */}
              <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-1.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-44">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Escanear código..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono-numbers"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-[#0B1528] hover:bg-[#152440] text-white text-xs font-bold rounded-xl whitespace-nowrap shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Barcode className="w-3.5 h-3.5 text-blue-300" />
                  <span>Escanear</span>
                </button>
              </form>
            </div>

            {/* Category Filter Chips & Quick Service Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_-2px_rgba(37,99,235,0.4)]'
                        : 'bg-[#F8FAFC] border border-[#DCE4F0] hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Quick Actions: Servicio, Recargo & View Switcher */}
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {/* View Switcher: Grid vs List */}
                <div className="flex items-center bg-[#EEF2F7] p-0.5 rounded-xl border border-[#DCE4F0]">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('grid');
                      localStorage.setItem('posvenecia_pos_view_mode', 'grid');
                    }}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-[#0B1528]'
                    }`}
                    title="Vista Cuadrícula (Fotos y Tarjetas)"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('list');
                      localStorage.setItem('posvenecia_pos_view_mode', 'list');
                    }}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-[#0B1528]'
                    }`}
                    title="Vista Lista Compacta"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsServicioModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EBF3FE] hover:bg-blue-100 text-[#1D4ED8] border border-[#C5DCFC] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="Venta rápida de copias, impresiones o redacción de documentos"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Servicio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRecargoModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FFF3E8] hover:bg-[#FFE6CE] text-[#9A4B12] border border-[#F5D3B3] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="Agregar recargo de delivery, propina o servicio adicional"
                >
                  <Truck className="w-3.5 h-3.5 text-[#D96B27]" />
                  <span>+ Recargo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreditNoteModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FEECEF] hover:bg-rose-100 text-[#BE123C] border border-[#FBC4CD] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="Emitir Nota de Crédito o devolución de productos"
                >
                  <FileText className="w-3.5 h-3.5 text-[#BE123C]" />
                  <span>Nota de Crédito</span>
                </button>
              </div>
            </div>
          </div>

          {/* Product Catalog Display (Grid or List View) */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const inCartItem = cart.find(c => c.product.id === prod.id);
                const priceBs = prod.priceUSD * bcvRate;
                const isService = Boolean(prod.isService || prod.itemType === 'servicio');
                const isOutOfStock = !isService && prod.stock <= 0;
                const isMaxInCart = !isService && inCartItem && inCartItem.quantity >= prod.stock;

                return (
                  <div
                    key={prod.id}
                    onClick={() => {
                      if (!isOutOfStock && !isMaxInCart) {
                        addToCart(prod, 1);
                      }
                    }}
                    className={`bg-white/95 rounded-2xl border p-3.5 flex flex-col justify-between transition-all group relative ${
                      isOutOfStock 
                        ? 'opacity-50 border-[#DCE4F0] bg-[#F8FAFC] cursor-not-allowed'
                        : inCartItem
                          ? 'border-[#93C5FD] bg-gradient-to-b from-white to-[#F4F8FF] shadow-[0_2px_12px_-4px_rgba(37,99,235,0.18)] ring-1 ring-blue-500/20 cursor-pointer'
                          : 'border-[#DCE4F0] hover:border-[#93C5FD] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] cursor-pointer'
                    }`}
                  >
                    {/* Image & Category Badges */}
                    <div className="relative mb-2">
                      <div className="w-full h-24 rounded-xl bg-[#F8FAFC] overflow-hidden flex items-center justify-center border border-[#DCE4F0]/70">
                        {prod.imageUrl ? (
                          <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300 stroke-1" />
                        )}
                      </div>

                      <div className="absolute top-1 left-1 flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-slate-700 border border-[#DCE4F0] shadow-2xs">
                          {prod.category}
                        </span>
                      </div>

                      {isService && (
                        <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#0B1528] text-white shadow-2xs">
                          Servicio
                        </span>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="mb-2">
                      <h4 className="font-bold text-xs text-[#0B1528] line-clamp-2 leading-snug group-hover:text-blue-700">
                        {prod.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono-numbers">{prod.code}</span>
                    </div>

                    {/* Bimonetary Prices & Controls */}
                    <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
                      <div>
                        <div className="text-sm font-black text-[#0B1528] font-mono-numbers">
                          {baseCurrency === 'VED' ? `Bs ${formatBs(priceBs)}` : `$${formatUSD(prod.priceUSD)}`}
                        </div>
                        <div className="text-[10px] font-bold text-blue-700 font-mono-numbers">
                          {baseCurrency === 'VED' ? `$${formatUSD(prod.priceUSD)}` : `Bs ${formatBs(priceBs)}`}
                        </div>
                      </div>

                      {/* Stepper with Minus and Plus button right on the card */}
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-[#BE123C] bg-[#FEECEF] px-2 py-1 rounded-lg border border-[#FBC4CD]">
                          Sin stock
                        </span>
                      ) : inCartItem ? (
                        <div 
                          className="flex items-center gap-1 bg-[#EBF3FE] border border-[#C5DCFC] rounded-xl p-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(prod.id, inCartItem.quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-[#FEECEF] text-slate-700 hover:text-[#BE123C] border border-[#DCE4F0] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                            title="Disminuir o quitar"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <span className="w-5 text-center font-bold text-xs font-mono-numbers text-[#0B1528]">
                            {inCartItem.quantity}
                          </span>

                          <button
                            type="button"
                            disabled={isMaxInCart}
                            onClick={() => {
                              if (!isMaxInCart) addToCart(prod, 1);
                            }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shadow-2xs ${
                              isMaxInCart 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                            }`}
                            title={isMaxInCart ? 'Stock máximo alcanzado' : 'Añadir uno más'}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(prod, 1);
                          }}
                          className="w-7 h-7 rounded-xl bg-[#EBF3FE] hover:bg-blue-600 text-blue-700 hover:text-white border border-[#C5DCFC] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                          title={isService ? 'Vender este servicio' : 'Añadir a la venta'}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW: Compact touch-friendly rows */
            <div className="space-y-2">
              {filteredProducts.map((prod) => {
                const inCartItem = cart.find(c => c.product.id === prod.id);
                const priceBs = prod.priceUSD * bcvRate;
                const isService = Boolean(prod.isService || prod.itemType === 'servicio');
                const isOutOfStock = !isService && prod.stock <= 0;
                const isMaxInCart = !isService && inCartItem && inCartItem.quantity >= prod.stock;

                return (
                  <div
                    key={prod.id}
                    onClick={() => {
                      if (!isOutOfStock && !isMaxInCart) {
                        addToCart(prod, 1);
                      }
                    }}
                    className={`bg-white/95 rounded-2xl border p-2.5 sm:p-3 flex items-center justify-between gap-3 transition-all ${
                      isOutOfStock
                        ? 'opacity-50 border-[#DCE4F0] bg-[#F8FAFC] cursor-not-allowed'
                        : inCartItem
                          ? 'border-[#93C5FD] bg-gradient-to-b from-white to-[#F4F8FF] shadow-xs ring-1 ring-blue-500/20 cursor-pointer'
                          : 'border-[#DCE4F0] hover:border-[#93C5FD] shadow-[0_2px_10px_-4px_rgba(15,23,42,0.05)] cursor-pointer'
                    }`}
                  >
                    {/* Thumbnail & Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] overflow-hidden flex items-center justify-center border border-[#DCE4F0] shrink-0">
                        {prod.imageUrl ? (
                          <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400 stroke-1" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-[#0B1528] truncate">
                            {prod.name}
                          </h4>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#F8FAFC] border border-[#DCE4F0] text-slate-600">
                            {prod.category}
                          </span>
                          {isService && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC]">
                              Servicio
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                          <span>{prod.code}</span>
                          {!isService && (
                            <span className={prod.stock <= (prod.minStock || 5) ? 'text-[#D96B27] font-bold' : 'text-slate-500'}>
                              Stock: {prod.stock} {prod.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prices & Action Button */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-black text-[#0B1528] font-mono-numbers">
                          {baseCurrency === 'VED' ? `Bs ${formatBs(priceBs)}` : `$${formatUSD(prod.priceUSD)}`}
                        </div>
                        <div className="text-[10px] font-bold text-blue-700 font-mono-numbers">
                          {baseCurrency === 'VED' ? `$${formatUSD(prod.priceUSD)}` : `Bs ${formatBs(priceBs)}`}
                        </div>
                      </div>

                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-[#BE123C] bg-[#FEECEF] px-2.5 py-1 rounded-xl border border-[#FBC4CD]">
                          Agotado
                        </span>
                      ) : inCartItem ? (
                        <div 
                          className="flex items-center gap-1 bg-[#EBF3FE] border border-[#C5DCFC] rounded-xl p-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(prod.id, inCartItem.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-white hover:bg-[#FEECEF] text-slate-700 hover:text-[#BE123C] border border-[#DCE4F0] flex items-center justify-center transition-colors shadow-2xs cursor-pointer font-bold"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-[#0B1528] font-mono-numbers">
                            {inCartItem.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={isMaxInCart}
                            onClick={() => updateCartQuantity(prod.id, inCartItem.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer disabled:opacity-40 font-bold"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(prod, 1);
                          }}
                          className="px-3 py-1.5 bg-[#EBF3FE] hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl text-xs font-bold border border-[#C5DCFC] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Añadir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-8 text-center text-slate-400 space-y-3">
              <Package className="w-10 h-10 mx-auto text-blue-300" />
              {products.length === 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[#0B1528]">Catálogo en Cero (Listo para arrancar)</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Aún no tienes artículos registrados. Puedes ir a la pestaña <strong>Productos</strong> para cargar tu inventario, o vender servicios y recargos directamente.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsServicioModalOpen(true)}
                      className="px-3.5 py-2 bg-gradient-to-b from-blue-600 to-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      + Vender Servicio Rápido
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRecargoModalOpen(true)}
                      className="px-3.5 py-2 bg-[#FFF3E8] border border-[#F5D3B3] text-[#9A4B12] hover:bg-[#FFE6CE] rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      + Agregar Recargo / Delivery
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs">No se encontraron productos con el filtro aplicado.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Active Cart & Checkout Panel (4 Columns) */}
        <div className="lg:col-span-4 bg-white/95 rounded-3xl border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] p-4 space-y-4 sticky top-20">
          
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE4F0]">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-[#0B1528]">Carrito de Venta</h3>
              <span className="text-[11px] font-bold bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] px-2 py-0.5 rounded-full font-mono-numbers">
                {cart.reduce((a, b) => a + b.quantity, 0)} items
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-[#BE123C] hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {/* Client Selection Card with Dedicated "Consumidor Final" Button */}
          <div className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-2xl p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Cliente para Factura:
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                clientName === 'Consumidor Final' 
                  ? 'bg-white border-[#DCE4F0] text-slate-600' 
                  : 'bg-[#EBF3FE] border-[#C5DCFC] text-[#1D4ED8]'
              }`}>
                {clientName === 'Consumidor Final' ? 'Público General' : 'Cliente Registrado'}
              </span>
            </div>

            <div className="bg-white p-2 rounded-xl border border-[#DCE4F0] flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="font-extrabold text-xs text-[#0B1528] truncate">{clientName}</div>
                <div className="text-[11px] font-mono-numbers text-slate-500">{clientRIF}</div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* 1. Consumidor Final Button */}
                <button
                  type="button"
                  onClick={() => {
                    setClientName('Consumidor Final');
                    setClientRIF('V-00000000');
                    setClientPhone(undefined);
                    setClientAddress(undefined);
                    setSelectedClientForPOS(null);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    clientName === 'Consumidor Final'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Restablecer a Consumidor Final (V-00000000)"
                >
                  Consumidor Final
                </button>

                {/* 2. Habituales Button */}
                <button
                  type="button"
                  onClick={() => setIsHabitualesModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="Seleccionar de Clientes Habituales"
                >
                  <Users className="w-3 h-3 text-blue-600" />
                  <span>Habituales</span>
                </button>

                {/* 3. Custom Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCustomClientName(clientName === 'Consumidor Final' ? '' : clientName);
                    setCustomClientRIF(clientRIF === 'V-00000000' ? 'V-' : clientRIF);
                    setCustomClientPhone(clientPhone || '');
                    setCustomClientAddress(clientAddress || '');
                    setIsCustomClientModalOpen(true);
                  }}
                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title="Editar datos del cliente"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Items List in Cart */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 space-y-1">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                <p className="text-xs">El carrito está vacío. Agregue productos para iniciar la venta.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="pt-2 pb-2 flex items-center justify-between text-xs">
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-slate-800 leading-tight">
                      {item.product.name}
                      {item.product.isExemptFromIVA && (
                        <span className="ml-1 text-[9px] font-semibold text-emerald-700">(E)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      ${formatUSD(item.unitPriceUSD)} c/u • Bs. {formatBs(item.unitPriceUSD * bcvRate)}
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Disminuir cantidad"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold font-mono text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={!item.product.isService && item.quantity >= item.product.stock}
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        !item.product.isService && item.quantity >= item.product.stock
                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700'
                      }`}
                      title={!item.product.isService && item.quantity >= item.product.stock ? 'Stock máximo' : 'Aumentar cantidad'}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="w-20 text-right font-mono">
                    <div className="font-bold text-slate-900">${formatUSD(item.totalUSD)}</div>
                    <div className="text-[10px] text-blue-700">Bs {formatBs(item.totalUSD * bcvRate)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Fiscal Toggles & Totals Calculation */}
          {cart.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              
              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={applyIVA}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setManagerPinInput('');
                        setManagerPinError('');
                        setIsManagerPinModalOpen(true);
                      } else {
                        setApplyIVA(true);
                      }
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="font-semibold text-slate-700 text-[11px]">IVA 16% Fiscal</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={applyIGTF}
                    onChange={(e) => setApplyIGTF(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="font-semibold text-slate-700 text-[11px]">IGTF 3% Divisas</span>
                </label>
              </div>

              {/* Subtotal & Breakdown */}
              <div className="space-y-1 text-xs font-mono pt-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal Exento (E):</span>
                  <span>${formatUSD(exemptUSD)} (Bs {formatBs(exemptBs)})</span>
                </div>
                <div className="flex justify-between">
                  <span>Base Imponible (G):</span>
                  <span>${formatUSD(taxableUSD)} (Bs {formatBs(taxableBs)})</span>
                </div>
                {applyIVA && taxableUSD > 0 && (
                  <div className="flex justify-between text-blue-700 font-semibold">
                    <span>IVA (16%):</span>
                    <span>+${formatUSD(ivaUSD)} (+Bs {formatBs(ivaBs)})</span>
                  </div>
                )}
                {applyIGTF && igtfUSD > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>IGTF (3% Divisas):</span>
                    <span>+${formatUSD(igtfUSD)} (+Bs {formatBs(igtfBs)})</span>
                  </div>
                )}
              </div>

              {/* Total Card */}
              <div className="bg-[#0B1528] text-white rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider block">
                      Total a Cobrar
                    </span>
                    <span className="text-2xl font-black text-white font-mono-numbers">
                      ${formatUSD(totalUSD)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-300 block">Equivalente BCV</span>
                    <span className="text-lg font-bold text-emerald-300 font-mono-numbers">
                      Bs. {formatBs(totalBs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Seleccionar Medio de Pago:
                </label>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* 1. Efectivo USD */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('efectivo_usd')}
                    className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      selectedMethod === 'efectivo_usd'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="leading-tight">Efectivo USD</div>
                      <span className="text-[9px] text-emerald-700 font-normal">Aplica IGTF 3%</span>
                    </div>
                  </button>

                  {/* 2. Efectivo Bs */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('efectivo_bs')}
                    className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      selectedMethod === 'efectivo_bs'
                        ? 'border-teal-600 bg-teal-50 text-teal-950 font-bold ring-1 ring-teal-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-teal-600" />
                    <div>
                      <div className="leading-tight">Efectivo Bs</div>
                      <span className="text-[9px] text-slate-500 font-normal">Billetes nacionales</span>
                    </div>
                  </button>

                  {/* 3. Pago Móvil */}
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('pago_movil')}
                    className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      selectedMethod === 'pago_movil'
                        ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="leading-tight">Pago Móvil</div>
                      <span className="text-[9px] text-blue-700 font-normal">
                        {pagoMovilData ? `Ref: #${pagoMovilData.ref}` : 'Ingresar ref'}
                      </span>
                    </div>
                  </button>

                  {/* 4. Punto Débito */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('debito')}
                    className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      selectedMethod === 'debito'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="leading-tight">Punto Débito</div>
                      <span className="text-[9px] text-slate-500 font-normal">Tarjetas POS</span>
                    </div>
                  </button>

                  {/* 5. Transferencia Bancaria */}
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('transferencia')}
                    className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      selectedMethod === 'transferencia'
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-950 font-bold ring-1 ring-cyan-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Landmark className="w-4 h-4 text-cyan-600" />
                    <div>
                      <div className="leading-tight">Transferencia</div>
                      <span className="text-[9px] text-cyan-700 font-normal">
                        {transferenciaRef ? `Ref: ${transferenciaRef}` : 'Cuenta bancaria'}
                      </span>
                    </div>
                  </button>

                  {/* 6. Pago Combinado */}
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('pago_combinado')}
                    className={`p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      selectedMethod === 'pago_combinado'
                        ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold ring-1 ring-purple-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-purple-600" />
                    <div>
                      <div className="leading-tight">Combinado</div>
                      <span className="text-[9px] text-purple-700 font-normal">Varios métodos</span>
                    </div>
                  </button>
                </div>

                {/* 7. Fiao (Cuentas por cobrar) */}
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('fiao')}
                  className={`w-full p-2 rounded-xl border text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                    selectedMethod === 'fiao'
                      ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600" />
                    <div>
                      <span className="font-bold">Fiao (Crédito en Cuenta)</span>
                      <span className="text-[9px] text-amber-700 ml-1.5">
                        {fiadoData ? `Resta $${fiadoData.remainingUSD.toFixed(2)}` : 'Deuda indexada a BCV'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Abonos</span>
                </button>

                {/* 8. Cashea button */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('cashea')}
                  className={`w-full p-2 rounded-xl border text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                    selectedMethod === 'cashea'
                      ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold ring-1 ring-purple-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center">
                      C
                    </span>
                    <div>
                      <span className="font-bold">Cashea</span>
                      <span className="text-[10px] text-purple-700 ml-1.5">Compra ahora y paga en 3 cuotas</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    3x ${formatUSD(totalUSD / 3)}
                  </span>
                </button>
              </div>

              {/* Action Buttons: Checkout and Cancel Sale */}
              <div className="space-y-2 pt-1">
                {isCashRegisterOpen ? (
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isProcessingCheckout || cart.length === 0}
                    className={`w-full py-3.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl text-sm font-bold shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] transition-all active:scale-98 flex items-center justify-center gap-2 ${
                      isProcessingCheckout || cart.length === 0 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {isProcessingCheckout ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Procesando venta...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span className="font-mono-numbers">Cobrar ${formatUSD(totalUSD)} (Bs. {formatBs(totalBs)})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAperturaModalOpen(true)}
                    className="w-full py-3.5 bg-[#0B1528] hover:bg-[#152440] text-white rounded-xl text-sm font-black shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-5 h-5 text-amber-300" />
                    <span className="font-mono-numbers">Abrir Caja para Cobrar (${formatUSD(totalUSD)})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    clearCart();
                    setPagoMovilData(null);
                    setFiadoData(null);
                    setCombinedData(null);
                    setTransferenciaRef('');
                  }}
                  className="w-full py-2 bg-[#F8FAFC] border border-[#DCE4F0] hover:bg-[#FEECEF] text-slate-600 hover:text-[#BE123C] hover:border-[#FBC4CD] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Compra / Operación</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Modal: Clientes Habituales (In-App Picker) */}
      {isHabitualesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Seleccionar Cliente Habitual</h3>
                  <p className="text-[11px] text-slate-500">Asigne la venta a un cliente registrado en el sistema</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsHabitualesModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nombre, RIF o teléfono..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 divide-y divide-slate-100">
              {filteredHabituales.length === 0 ? (
                <div className="text-center py-6 text-slate-400 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">No se encontraron clientes habituales.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHabitualesModalOpen(false);
                      setActiveTab('clientes');
                    }}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    + Ir a registrar clientes
                  </button>
                </div>
              ) : (
                filteredHabituales.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setClientName(c.name);
                      setClientRIF(c.rif);
                      setClientPhone(c.phone);
                      setClientAddress(c.address);
                      setSelectedClientForPOS(c);
                      setIsHabitualesModalOpen(false);
                    }}
                    className="p-3 rounded-2xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        RIF: <strong>{c.rif}</strong> • Telf: {c.phone}
                      </div>
                      {c.address && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.address}</div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs"
                    >
                      Seleccionar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsHabitualesModalOpen(false);
                  setActiveTab('clientes');
                }}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Gestionar Todos los Clientes
              </button>
              <button
                type="button"
                onClick={() => setIsHabitualesModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Personalizar Datos del Cliente In-App */}
      {isCustomClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Edit className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-slate-900 text-base">Datos del Cliente en Factura</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsCustomClientModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setClientName(customClientName.trim() || 'Consumidor Final');
                setClientRIF(customClientRIF.trim().toUpperCase() || 'V-00000000');
                setClientPhone(customClientPhone.trim() || undefined);
                setClientAddress(customClientAddress.trim() || undefined);
                setIsCustomClientModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Inversiones Los Andes o Juan Pérez"
                  value={customClientName}
                  onChange={(e) => setCustomClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cédula o RIF *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: V-12345678 o J-12345678-0"
                  value={customClientRIF}
                  onChange={(e) => setCustomClientRIF(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 0414-1234567"
                  value={customClientPhone}
                  onChange={(e) => setCustomClientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Fiscal (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Av. Principal, Local 4"
                  value={customClientAddress}
                  onChange={(e) => setCustomClientAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomClientModalOpen(false)}
                  className="px-4 py-2 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Aplicar a Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transferencia Bancaria */}
      {isTransferenciaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-cyan-50 text-cyan-700 rounded-xl">
                  <Landmark className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Transferencia Bancaria</h3>
                  <p className="text-[11px] text-slate-500">Monto total: Bs. {formatBs(totalBs)} (${formatUSD(totalUSD)})</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsTransferenciaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsTransferenciaModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta Bancaria Receptora</label>
                <select
                  value={transferenciaBank}
                  onChange={(e) => setTransferenciaBank(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
                >
                  {businessInfo.bankAccounts && businessInfo.bankAccounts.length > 0 ? (
                    businessInfo.bankAccounts.map((b) => (
                      <option key={b.id} value={`${b.bank} - ${b.accountNumber.slice(-4)}`}>
                        {b.bank} (••• {b.accountNumber.slice(-4)})
                      </option>
                    ))
                  ) : (
                    <option value="0102 - Banco de Venezuela">0102 - Banco de Venezuela</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número de Referencia de Transferencia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: TR-894102 o 6 dígitos de confirmación"
                  value={transferenciaRef}
                  onChange={(e) => setTransferenciaRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferenciaModalOpen(false)}
                  className="px-4 py-2 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Confirmar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modales existentes de Pago */}
      <PagoMovilModal
        isOpen={isPMModalOpen}
        onClose={() => setIsPMModalOpen(false)}
        totalBs={totalBs}
        totalUSD={totalUSD}
        businessPMInfo={{
          phone: businessInfo.pagoMovilPhone,
          ci: businessInfo.pagoMovilCI,
          bank: businessInfo.pagoMovilBank
        }}
        onConfirm={(data) => {
          setPagoMovilData(data);
          setIsPMModalOpen(false);
        }}
      />

      <VentaFiadaModal
        isOpen={isFiadoModalOpen}
        onClose={() => setIsFiadoModalOpen(false)}
        totalUSD={totalUSD}
        bcvRate={bcvRate}
        existingFiados={fiados}
        onConfirm={(data) => {
          setFiadoData(data);
          setIsFiadoModalOpen(false);
        }}
      />

      <PagoCombinadoModal
        isOpen={isCombinadoModalOpen}
        onClose={() => setIsCombinadoModalOpen(false)}
        totalUSD={totalUSD}
        totalBs={totalBs}
        bcvRate={bcvRate}
        onConfirm={(breakdown) => {
          setCombinedData(breakdown);
          setIsCombinadoModalOpen(false);
        }}
      />

      <TransaccionExitosaModal
        sale={successSale}
        onClose={() => setSuccessSale(null)}
        onOpenReceiptTicket={(sale) => {
          setTicketModalSale(sale);
        }}
        businessInfo={businessInfo}
      />

      <ComprobanteTicketModal
        sale={ticketModalSale}
        onClose={() => setTicketModalSale(null)}
        businessInfo={businessInfo}
      />

      <VenderServicioModal
        isOpen={isServicioModalOpen}
        onClose={() => setIsServicioModalOpen(false)}
      />

      <RecargoModal
        isOpen={isRecargoModalOpen}
        onClose={() => setIsRecargoModalOpen(false)}
        subtotalUSD={subtotalUSD}
      />

      {/* Modal / Popup de Producto Inexistente */}
      {isNotFoundModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 text-center p-6 space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Producto Inexistente
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {notFoundMsg || `No se encontró ningún producto registrado con el código "${notFoundCode}".`}
              </p>
            </div>

            {notFoundCode && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800">
                Código: <span className="text-blue-700">{notFoundCode}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsNotFoundModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNotFoundModalOpen(false);
                  setActiveTab('productos');
                }}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                + Ir a Inventario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Autorización de Gerente para Desactivar IVA */}
      {isManagerPinModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full overflow-hidden border border-slate-200 p-6 space-y-4 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-base">Autorización Requerida</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Desactivar el IVA 16% fiscal requiere el PIN de gerente o administrador.
              </p>
            </div>

            <input
              type="password"
              maxLength={8}
              placeholder="Ingrese PIN"
              value={managerPinInput}
              onChange={(e) => {
                setManagerPinInput(e.target.value);
                setManagerPinError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (managerPinInput === managerPin) {
                    setApplyIVA(false);
                    setIsManagerPinModalOpen(false);
                  } else {
                    setManagerPinError('PIN incorrecto');
                  }
                }
              }}
              className="w-full text-center tracking-widest text-xl font-bold font-mono py-2.5 px-4 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600"
              autoFocus
            />

            {managerPinError && (
              <p className="text-xs text-rose-600 font-semibold">{managerPinError}</p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsManagerPinModalOpen(false);
                  setManagerPinInput('');
                  setManagerPinError('');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (managerPinInput === managerPin) {
                    setApplyIVA(false);
                    setIsManagerPinModalOpen(false);
                  } else {
                    setManagerPinError('PIN incorrecto');
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Autorizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
