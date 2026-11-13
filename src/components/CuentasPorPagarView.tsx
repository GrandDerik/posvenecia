import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Phone, 
  DollarSign, 
  FileText, 
  Trash2, 
  Coins, 
  ChevronDown, 
  Receipt,
  Home,
  Zap,
  Users,
  Wrench,
  Truck,
  Sparkles,
  Tag,
  Edit2,
  Eye,
  X,
  UserCheck,
  Hash
} from 'lucide-react';
import { formatUSD, formatBs } from '../utils/exportUtils';
import { CuentaPorPagar, PaymentMethod, GastoOperativo, GastoOperativoCategory } from '../types';

export const CuentasPorPagarView: React.FC = () => {
  const { 
    cuentasPorPagar, 
    addCuentaPorPagar, 
    updateCuentaPorPagar,
    deleteCuentaPorPagar, 
    addAbonoToCuentaPorPagar,
    gastosOperativos,
    addGastoOperativo,
    updateGastoOperativo,
    deleteGastoOperativo,
    markGastoOperativoPagado,
    bcvRate,
    isCashRegisterOpen,
    setIsAperturaModalOpen
  } = useApp();

  // Active Sub-Tab: 'proveedores' vs 'gastos_mes'
  const [activeSubTab, setActiveSubTab] = useState<'proveedores' | 'gastos_mes'>('gastos_mes');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'parcial' | 'pagado' | 'pagada' | 'vencida'>('todos');
  const [gastoTypeFilter, setGastoTypeFilter] = useState<'todos' | 'mensual_fijo' | 'eventual'>('todos');
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaPorPagar | null>(null);
  const [expandedGastoAbonosId, setExpandedGastoAbonosId] = useState<string | null>(null);

  // Detail Modals (Ojito)
  const [detailGasto, setDetailGasto] = useState<GastoOperativo | null>(null);
  const [detailCuenta, setDetailCuenta] = useState<CuentaPorPagar | null>(null);

  // Edit States
  const [editingGasto, setEditingGasto] = useState<GastoOperativo | null>(null);
  const [editingCuenta, setEditingCuenta] = useState<CuentaPorPagar | null>(null);

  // Modals
  const [isAddCuentaModalOpen, setIsAddCuentaModalOpen] = useState(false);
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [cuentaForAbono, setCuentaForAbono] = useState<CuentaPorPagar | null>(null);

  const [isAddGastoModalOpen, setIsAddGastoModalOpen] = useState(false);
  const [isPagarGastoModalOpen, setIsPagarGastoModalOpen] = useState(false);
  const [gastoForPagar, setGastoForPagar] = useState<GastoOperativo | null>(null);

  // Confirm delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New/Edit Cuenta por Pagar Form
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRIF, setNewSupplierRIF] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newControlNumber, setNewControlNumber] = useState('');
  const [newIssueDate, setNewIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [newCategory, setNewCategory] = useState<'Mercancía' | 'Servicios' | 'Alquiler' | 'Materia Prima' | 'Mantenimiento' | 'Otros'>('Mercancía');
  const [newDescription, setNewDescription] = useState('');
  const [newTotalUSD, setNewTotalUSD] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Abono Cuenta Por Pagar Form
  const [abonoAmountUSD, setAbonoAmountUSD] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('transferencia');
  const [abonoRef, setAbonoRef] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');

  // New/Edit Gasto Operativo Form
  const currentMonthName = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric' }).format(new Date());
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const [gastoConcept, setGastoConcept] = useState('');
  const [gastoCategory, setGastoCategory] = useState<GastoOperativoCategory>('Insumos / Papelería');
  const [gastoType, setGastoType] = useState<'mensual_fijo' | 'eventual'>('eventual');
  const [gastoSupplierName, setGastoSupplierName] = useState('');
  const [gastoSupplierRIF, setGastoSupplierRIF] = useState('');
  const [gastoSupplierPhone, setGastoSupplierPhone] = useState('');
  const [gastoInvoiceNumber, setGastoInvoiceNumber] = useState('');
  const [gastoMonth, setGastoMonth] = useState(capitalizedMonth);
  const [gastoDate, setGastoDate] = useState(new Date().toISOString().split('T')[0]);
  const [gastoDueDate, setGastoDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [gastoAmountUSD, setGastoAmountUSD] = useState('');
  const [gastoAmountBs, setGastoAmountBs] = useState('');
  const [gastoCurrencyInput, setGastoCurrencyInput] = useState<'USD' | 'Bs'>('USD');
  const [gastoInitialStatus, setGastoInitialStatus] = useState<'pendiente' | 'pagado'>('pendiente');
  const [gastoPayMethod, setGastoPayMethod] = useState<PaymentMethod>('pago_movil');
  const [gastoPayRef, setGastoPayRef] = useState('');
  const [gastoNotes, setGastoNotes] = useState('');

  // Pagar / Abonar Gasto Form (Partial Payment Support)
  const [pagarAmountUSD, setPagarAmountUSD] = useState('');
  const [pagarMethod, setPagarMethod] = useState<PaymentMethod>('pago_movil');
  const [pagarRef, setPagarRef] = useState('');
  const [pagarNotes, setPagarNotes] = useState('');

  const getCategoryIcon = (cat: GastoOperativoCategory) => {
    switch (cat) {
      case 'Alquiler': return <Home className="w-4 h-4 text-blue-600" />;
      case 'Servicios': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Nómina': return <Users className="w-4 h-4 text-emerald-600" />;
      case 'Mantenimiento': return <Wrench className="w-4 h-4 text-rose-500" />;
      case 'Transporte': return <Truck className="w-4 h-4 text-indigo-500" />;
      case 'Eventual': return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'Insumos / Papelería':
      case 'Papelería': return <FileText className="w-4 h-4 text-teal-600" />;
      default: return <Tag className="w-4 h-4 text-slate-500" />;
    }
  };

  // Helpers for Gasto partial payment calculations
  const getGastoPaidUSD = (g: GastoOperativo) =>
    g.paidAmountUSD !== undefined ? g.paidAmountUSD : (g.status === 'pagado' ? g.amountUSD : 0);

  const getGastoRemainingUSD = (g: GastoOperativo) =>
    g.remainingUSD !== undefined ? g.remainingUSD : (g.status === 'pagado' ? 0 : Math.max(0, g.amountUSD - getGastoPaidUSD(g)));

  // Metrics for Cuentas por Pagar (Proveedores)
  const totalCppPendingUSD = cuentasPorPagar
    .filter(c => c.status !== 'pagada')
    .reduce((sum, c) => sum + c.remainingUSD, 0);

  const totalCppPaidUSD = cuentasPorPagar.reduce((sum, c) => sum + c.paidAmountUSD, 0);
  
  const overdueCppCount = cuentasPorPagar.filter(c => 
    new Date(c.dueDate) < new Date() && c.status !== 'pagada'
  ).length;

  // Metrics for Gastos Operativos del Mes
  const totalGastosMesUSD = gastosOperativos.reduce((sum, g) => sum + g.amountUSD, 0);
  const totalGastosPendientesUSD = gastosOperativos
    .filter(g => g.status !== 'pagado')
    .reduce((sum, g) => sum + getGastoRemainingUSD(g), 0);
  const totalGastosPagadosUSD = gastosOperativos
    .reduce((sum, g) => sum + getGastoPaidUSD(g), 0);
  const totalGastosEventualesUSD = gastosOperativos
    .filter(g => g.type === 'eventual')
    .reduce((sum, g) => sum + g.amountUSD, 0);

  // Filtered Cuentas por Pagar
  const filteredCuentas = cuentasPorPagar.filter(cuenta => {
    const matchesSearch = 
      cuenta.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cuenta.supplierRIF && cuenta.supplierRIF.toLowerCase().includes(searchTerm.toLowerCase())) ||
      cuenta.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.description.toLowerCase().includes(searchTerm.toLowerCase());

    const isOverdue = new Date(cuenta.dueDate) < new Date() && cuenta.status !== 'pagada';
    const effectiveStatus = isOverdue ? 'vencida' : cuenta.status;

    if (statusFilter === 'todos') return matchesSearch;
    if (statusFilter === 'vencida') return matchesSearch && isOverdue;
    return matchesSearch && effectiveStatus === statusFilter;
  });

  // Filtered Gastos Operativos
  const filteredGastos = gastosOperativos.filter(g => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      g.concept.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q) ||
      (g.supplierName && g.supplierName.toLowerCase().includes(q)) ||
      (g.supplierRIF && g.supplierRIF.toLowerCase().includes(q)) ||
      (g.supplierPhone && g.supplierPhone.toLowerCase().includes(q)) ||
      (g.invoiceNumber && g.invoiceNumber.toLowerCase().includes(q)) ||
      (g.notes && g.notes.toLowerCase().includes(q)) ||
      (g.reference && g.reference.toLowerCase().includes(q));

    const matchesType = gastoTypeFilter === 'todos' || g.type === gastoTypeFilter;
    const matchesStatus = statusFilter === 'todos' || g.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const openNewGastoModal = () => {
    setEditingGasto(null);
    setGastoConcept('');
    setGastoCategory('Insumos / Papelería');
    setGastoType('eventual');
    setGastoSupplierName('');
    setGastoSupplierRIF('');
    setGastoSupplierPhone('');
    setGastoInvoiceNumber('');
    setGastoMonth(capitalizedMonth);
    setGastoDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 5);
    setGastoDueDate(d.toISOString().split('T')[0]);
    setGastoAmountUSD('');
    setGastoAmountBs('');
    setGastoCurrencyInput('USD');
    setGastoInitialStatus('pendiente');
    setGastoPayMethod('pago_movil');
    setGastoPayRef('');
    setGastoNotes('');
    setIsAddGastoModalOpen(true);
  };

  const openEditGastoModal = (g: GastoOperativo) => {
    setEditingGasto(g);
    setGastoConcept(g.concept);
    setGastoCategory(g.category);
    setGastoType(g.type);
    setGastoSupplierName(g.supplierName || '');
    setGastoSupplierRIF(g.supplierRIF || '');
    setGastoSupplierPhone(g.supplierPhone || '');
    setGastoInvoiceNumber(g.invoiceNumber || '');
    setGastoMonth(g.month);
    setGastoDate(g.date ? g.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setGastoDueDate(g.dueDate ? g.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setGastoCurrencyInput('USD');
    setGastoAmountUSD(g.amountUSD.toFixed(2));
    setGastoAmountBs((g.amountUSD * bcvRate).toFixed(2));
    setGastoInitialStatus(g.status === 'pagado' ? 'pagado' : 'pendiente');
    setGastoPayMethod(g.paymentMethod || 'pago_movil');
    setGastoPayRef(g.reference || '');
    setGastoNotes(g.notes || '');
    setIsAddGastoModalOpen(true);
  };

  const openNewCuentaModal = () => {
    setEditingCuenta(null);
    setNewSupplierName('');
    setNewSupplierRIF('');
    setNewSupplierPhone('');
    setNewInvoiceNumber('');
    setNewControlNumber('');
    setNewIssueDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setNewDueDate(d.toISOString().split('T')[0]);
    setNewCategory('Mercancía');
    setNewDescription('');
    setNewTotalUSD('');
    setNewNotes('');
    setIsAddCuentaModalOpen(true);
  };

  const openEditCuentaModal = (c: CuentaPorPagar) => {
    setEditingCuenta(c);
    setNewSupplierName(c.supplierName);
    setNewSupplierRIF(c.supplierRIF || '');
    setNewSupplierPhone(c.supplierPhone || '');
    setNewInvoiceNumber(c.invoiceNumber);
    setNewControlNumber(c.controlNumber || '');
    setNewIssueDate(c.date ? c.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setNewDueDate(c.dueDate ? c.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setNewCategory(c.category);
    setNewDescription(c.description);
    setNewTotalUSD(c.totalAmountUSD.toFixed(2));
    setNewNotes(c.notes || '');
    setIsAddCuentaModalOpen(true);
  };

  const handleCreateOrEditCuenta = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newTotalUSD);
    if (!newSupplierName.trim() || isNaN(amount) || amount <= 0) return;

    if (editingCuenta) {
      const remaining = Math.max(0, Number((amount - editingCuenta.paidAmountUSD).toFixed(2)));
      updateCuentaPorPagar({
        ...editingCuenta,
        supplierName: newSupplierName.trim(),
        supplierRIF: newSupplierRIF.trim() || undefined,
        supplierPhone: newSupplierPhone.trim() || undefined,
        invoiceNumber: newInvoiceNumber.trim() || editingCuenta.invoiceNumber,
        controlNumber: newControlNumber.trim() || undefined,
        date: new Date(newIssueDate).toISOString(),
        dueDate: new Date(newDueDate).toISOString(),
        category: newCategory,
        description: newDescription.trim() || 'Factura por compra a proveedor',
        totalAmountUSD: amount,
        remainingUSD: remaining,
        status: remaining <= 0.009 ? 'pagada' : (editingCuenta.paidAmountUSD > 0 ? 'parcial' : 'pendiente'),
        notes: newNotes.trim() || undefined
      });
    } else {
      addCuentaPorPagar({
        supplierName: newSupplierName.trim(),
        supplierRIF: newSupplierRIF.trim() || undefined,
        supplierPhone: newSupplierPhone.trim() || undefined,
        invoiceNumber: newInvoiceNumber.trim() || `FAC-${Date.now().toString().slice(-5)}`,
        controlNumber: newControlNumber.trim() || undefined,
        date: new Date(newIssueDate).toISOString(),
        dueDate: new Date(newDueDate).toISOString(),
        category: newCategory,
        description: newDescription.trim() || 'Factura por compra a proveedor',
        totalAmountUSD: amount,
        notes: newNotes.trim() || undefined
      });
    }

    setEditingCuenta(null);
    setIsAddCuentaModalOpen(false);
  };

  const handleRegisterAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaForAbono) return;
    const amount = parseFloat(abonoAmountUSD);
    if (isNaN(amount) || amount <= 0) return;

    if (!isCashRegisterOpen && (abonoMethod === 'efectivo_usd' || abonoMethod === 'efectivo_bs')) {
      setIsAperturaModalOpen(true);
      return;
    }

    addAbonoToCuentaPorPagar(
      cuentaForAbono.id,
      amount,
      abonoMethod,
      abonoRef.trim() || undefined,
      abonoNotes.trim() || undefined
    );

    setIsAbonoModalOpen(false);
    setCuentaForAbono(null);
    setAbonoAmountUSD('');
    setAbonoRef('');
    setAbonoNotes('');
  };

  const handleCreateOrEditGasto = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUSD = 0;
    let finalBs = 0;

    if (gastoCurrencyInput === 'USD') {
      finalUSD = parseFloat(gastoAmountUSD);
      finalBs = finalUSD * bcvRate;
    } else {
      finalBs = parseFloat(gastoAmountBs);
      finalUSD = bcvRate > 0 ? finalBs / bcvRate : 0;
    }

    if (!gastoConcept.trim() || isNaN(finalUSD) || finalUSD <= 0) return;

    if (editingGasto) {
      updateGastoOperativo({
        ...editingGasto,
        concept: gastoConcept.trim(),
        category: gastoCategory,
        type: gastoType,
        supplierName: gastoSupplierName.trim() || undefined,
        supplierRIF: gastoSupplierRIF.trim() || undefined,
        supplierPhone: gastoSupplierPhone.trim() || undefined,
        invoiceNumber: gastoInvoiceNumber.trim() || undefined,
        month: gastoMonth.trim() || capitalizedMonth,
        date: new Date(gastoDate).toISOString(),
        dueDate: new Date(gastoDueDate).toISOString(),
        amountUSD: Number(finalUSD.toFixed(2)),
        amountBs: Number(finalBs.toFixed(2)),
        bcvRate,
        notes: gastoNotes.trim() || undefined
      });
    } else {
      if (gastoInitialStatus === 'pagado' && !isCashRegisterOpen && (gastoPayMethod === 'efectivo_usd' || gastoPayMethod === 'efectivo_bs')) {
        setIsAperturaModalOpen(true);
        return;
      }

      addGastoOperativo({
        concept: gastoConcept.trim(),
        category: gastoCategory,
        type: gastoType,
        supplierName: gastoSupplierName.trim() || undefined,
        supplierRIF: gastoSupplierRIF.trim() || undefined,
        supplierPhone: gastoSupplierPhone.trim() || undefined,
        invoiceNumber: gastoInvoiceNumber.trim() || undefined,
        month: gastoMonth.trim() || capitalizedMonth,
        date: new Date(gastoDate).toISOString(),
        dueDate: new Date(gastoDueDate).toISOString(),
        amountUSD: Number(finalUSD.toFixed(2)),
        amountBs: Number(finalBs.toFixed(2)),
        bcvRate,
        status: gastoInitialStatus,
        paymentDate: gastoInitialStatus === 'pagado' ? new Date().toISOString() : undefined,
        paymentMethod: gastoInitialStatus === 'pagado' ? gastoPayMethod : undefined,
        reference: gastoInitialStatus === 'pagado' ? gastoPayRef.trim() || undefined : undefined,
        notes: gastoNotes.trim() || undefined
      });
    }

    setEditingGasto(null);
    setIsAddGastoModalOpen(false);
  };

  const openPagarGastoModal = (gasto: GastoOperativo) => {
    const remaining = getGastoRemainingUSD(gasto);
    setGastoForPagar(gasto);
    setPagarAmountUSD(remaining.toFixed(2));
    setPagarMethod('pago_movil');
    setPagarRef('');
    setPagarNotes('');
    setIsPagarGastoModalOpen(true);
  };

  const handleConfirmPagarGasto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoForPagar) return;

    const amountToPay = parseFloat(pagarAmountUSD);
    if (isNaN(amountToPay) || amountToPay <= 0) return;

    if (!isCashRegisterOpen && (pagarMethod === 'efectivo_usd' || pagarMethod === 'efectivo_bs')) {
      setIsAperturaModalOpen(true);
      return;
    }

    markGastoOperativoPagado(
      gastoForPagar.id,
      pagarMethod,
      pagarRef.trim() || undefined,
      amountToPay,
      pagarNotes.trim() || undefined
    );

    setIsPagarGastoModalOpen(false);
    setGastoForPagar(null);
    setPagarAmountUSD('');
    setPagarRef('');
    setPagarNotes('');
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-12">
      
      {/* Top Main Banner with Dual Tab Selector */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Control de Cuentas por Pagar & Gastos del Mes
              </h1>
              <p className="text-xs text-slate-500">
                Control de insumos (hojas, tinta), servicios, abonos parciales y facturas a proveedores sincronizado en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            {activeSubTab === 'gastos_mes' ? (
              <button
                type="button"
                onClick={openNewGastoModal}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Gasto del Mes</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openNewCuentaModal}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Factura Proveedor</span>
              </button>
            )}
          </div>
        </div>

        {/* Dual Sub-Navigation Switcher */}
        <div className="flex flex-col sm:flex-row p-1 bg-slate-100 rounded-2xl border border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('gastos_mes');
              setStatusFilter('todos');
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'gastos_mes'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Gastos del Mes & Insumos (Por Pagar)</span>
            {gastosOperativos.filter(g => g.status !== 'pagado').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
                {gastosOperativos.filter(g => g.status !== 'pagado').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('proveedores');
              setStatusFilter('todos');
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'proveedores'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Facturas a Proveedores (Compras a Crédito)</span>
            {cuentasPorPagar.filter(c => c.status !== 'pagada').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-extrabold">
                {cuentasPorPagar.filter(c => c.status !== 'pagada').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      {activeSubTab === 'gastos_mes' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-2xs">
            <div className="flex items-center justify-between text-blue-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Gastos Mes</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono-numbers">
              ${formatUSD(totalGastosMesUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalGastosMesUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs">
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Por Pagar</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-rose-600 font-mono-numbers">
              ${formatUSD(totalGastosPendientesUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalGastosPendientesUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Abonado / Pagado</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-emerald-600 font-mono-numbers">
              ${formatUSD(totalGastosPagadosUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalGastosPagadosUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-purple-200 shadow-2xs">
            <div className="flex items-center justify-between text-purple-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Gastos Eventuales</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-purple-700 font-mono-numbers">
              ${formatUSD(totalGastosEventualesUSD)}
            </div>
            <div className="text-[11px] text-slate-500">
              {gastosOperativos.filter(g => g.type === 'eventual').length} registro(s)
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs">
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Deuda Proveedores</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-rose-700 font-mono-numbers">
              ${formatUSD(totalCppPendingUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalCppPendingUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Abonado</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-emerald-700 font-mono-numbers">
              ${formatUSD(totalCppPaidUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalCppPaidUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Facturas Vencidas</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-amber-700 font-mono-numbers">
              {overdueCppCount}
            </div>
            <div className="text-[11px] text-slate-500">
              {overdueCppCount > 0 ? 'Requieren pago' : 'Al día con distribuidores'}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Facturas</span>
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-800 font-mono-numbers">
              {cuentasPorPagar.length}
            </div>
            <div className="text-[11px] text-slate-500">
              {cuentasPorPagar.filter(c => c.status === 'pagada').length} pagadas
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeSubTab === 'gastos_mes' 
              ? "Buscar por concepto, proveedor, RIF/Cédula, factura o teléfono..."
              : "Buscar factura, proveedor, RIF o número de control..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        {/* Filters specific to active sub-tab */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {activeSubTab === 'gastos_mes' ? (
            <>
              <select
                value={gastoTypeFilter}
                onChange={(e) => setGastoTypeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 focus:outline-none"
              >
                <option value="todos">Todos los Tipos</option>
                <option value="mensual_fijo">Mensuales Fijos</option>
                <option value="eventual">Eventuales / Insumos</option>
              </select>

              <div className="flex flex-wrap items-center gap-1">
                {([
                  { id: 'todos', label: 'Todos' },
                  { id: 'pendiente', label: 'Pendiente' },
                  { id: 'parcial', label: 'Parcial' },
                  { id: 'pagado', label: 'Pagado' }
                ] as const).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      statusFilter === st.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {(['todos', 'pendiente', 'parcial', 'vencida', 'pagada'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VIEW: GASTOS OPERATIVOS DEL MES */}
      {activeSubTab === 'gastos_mes' && (
        <div className="space-y-3">
          {filteredGastos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
              <Home className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No hay gastos operativos registrados</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm 
                  ? 'No encontramos gastos que coincidan con la búsqueda.'
                  : 'Registra insumos (hojas, tinta), alquiler, servicios o eventuales con datos fiscales y controla los abonos parciales.'}
              </p>
              <button
                type="button"
                onClick={openNewGastoModal}
                className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                + Registrar Primer Gasto del Mes
              </button>
            </div>
          ) : (
            filteredGastos.map((gasto) => {
              const paidUSD = getGastoPaidUSD(gasto);
              const remainingUSD = getGastoRemainingUSD(gasto);
              const progress = gasto.amountUSD > 0 ? (paidUSD / gasto.amountUSD) * 100 : 0;
              const isOverdue = new Date(gasto.dueDate) < new Date() && gasto.status !== 'pagado';
              const abonosList = gasto.abonos || [];

              return (
                <div
                  key={gasto.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 shrink-0 mt-0.5">
                        {getCategoryIcon(gasto.category)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">
                            {gasto.concept}
                          </span>
                          
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {gasto.category}
                          </span>

                          {gasto.type === 'eventual' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> EVENTUAL
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              FIJO MENSUAL
                            </span>
                          )}

                          {gasto.status === 'pagado' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> PAGADO
                            </span>
                          ) : gasto.status === 'parcial' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                              <Coins className="w-3 h-3" /> PARCIALMENTE PAGADO
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> VENCIDO
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              PENDIENTE POR PAGAR
                            </span>
                          )}
                        </div>

                        {/* Supplier & Invoice fiscal info */}
                        {(gasto.supplierName || gasto.supplierRIF || gasto.supplierPhone || gasto.invoiceNumber) && (
                          <div className="text-xs text-slate-600 flex items-center gap-2.5 flex-wrap pt-0.5">
                            {gasto.supplierName && (
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {gasto.supplierName}
                              </span>
                            )}
                            {gasto.supplierRIF && (
                              <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                {gasto.supplierRIF}
                              </span>
                            )}
                            {gasto.invoiceNumber && (
                              <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                Doc: {gasto.invoiceNumber}
                              </span>
                            )}
                            {gasto.supplierPhone && (
                              <a
                                href={`https://wa.me/58${gasto.supplierPhone.replace(/\D/g, '').slice(-10)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 text-[11px]"
                              >
                                <Phone className="w-3 h-3" /> {gasto.supplierPhone}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                          <span>Mes: <strong>{gasto.month}</strong></span>
                          <span>Emisión: {new Date(gasto.date).toLocaleDateString('es-VE')}</span>
                          <span>Vence: <strong className={isOverdue ? 'text-rose-600' : ''}>{new Date(gasto.dueDate).toLocaleDateString('es-VE')}</strong></span>
                          {gasto.reference && (
                            <span className="font-mono text-slate-600">Últ. Ref: {gasto.reference}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount & Remaining */}
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-[11px] text-slate-400 font-semibold">
                        {gasto.status === 'pagado' ? 'Monto pagado' : 'Saldo pendiente'}
                      </div>
                      <div className={`text-base sm:text-lg font-black font-mono-numbers ${gasto.status === 'pagado' ? 'text-emerald-700' : 'text-rose-600'}`}>
                        ${formatUSD(gasto.status === 'pagado' ? gasto.amountUSD : remainingUSD)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-numbers">
                        Bs {formatBs((gasto.status === 'pagado' ? gasto.amountUSD : remainingUSD) * bcvRate)}
                      </div>
                      {gasto.status !== 'pagado' && paidUSD > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Total factura: ${formatUSD(gasto.amountUSD)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar if partially paid or pending */}
                  {(paidUSD > 0 || gasto.status !== 'pagado') && (
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>Abonado: ${formatUSD(paidUSD)} de ${formatUSD(gasto.amountUSD)}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            gasto.status === 'pagado' ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes & Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-slate-600 italic truncate max-w-md">
                      {gasto.notes ? `Nota: ${gasto.notes}` : 'Sin observaciones adicionales.'}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {gasto.status !== 'pagado' && (
                        <button
                          type="button"
                          onClick={() => openPagarGastoModal(gasto)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>{paidUSD > 0 ? 'Abonar / Liquidar' : 'Abonar / Pagar'}</span>
                        </button>
                      )}

                      {abonosList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedGastoAbonosId(expandedGastoAbonosId === gasto.id ? null : gasto.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-slate-500" />
                          <span>{abonosList.length} Pago{abonosList.length > 1 ? 's' : ''}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedGastoAbonosId === gasto.id ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDetailGasto(gasto)}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                        title="Ver detalle completo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditGastoModal(gasto)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                        title="Editar gasto"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === gasto.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                          <button
                            type="button"
                            onClick={() => {
                              deleteGastoOperativo(gasto.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(gasto.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Audit Trail Accordion of Abonos */}
                  {expandedGastoAbonosId === gasto.id && abonosList.length > 0 && (
                    <div className="mt-2 pt-3 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-extrabold text-slate-700">Historial de Abonos y Pagos (Auditoría)</h4>
                      <div className="bg-slate-50 rounded-xl overflow-x-auto border border-slate-200/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/80 text-slate-600 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="p-2">Fecha</th>
                              <th className="p-2">Monto ($)</th>
                              <th className="p-2">Monto (Bs)</th>
                              <th className="p-2">Método</th>
                              <th className="p-2">Ref / Nota</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {abonosList.map(ab => (
                              <tr key={ab.id} className="hover:bg-white/80">
                                <td className="p-2 font-mono text-slate-600 whitespace-nowrap">
                                  {new Date(ab.date).toLocaleDateString('es-VE')} {new Date(ab.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-2 font-black text-emerald-600 font-mono-numbers">
                                  ${formatUSD(ab.amountUSD)}
                                </td>
                                <td className="p-2 font-mono-numbers text-slate-600">
                                  Bs {formatBs(ab.amountBs)}
                                </td>
                                <td className="p-2 uppercase font-semibold text-[11px] text-slate-700">
                                  {ab.paymentMethod.replace('_', ' ')}
                                </td>
                                <td className="p-2 text-slate-500">
                                  {ab.reference && <span className="font-mono text-slate-700 mr-1.5">Ref: {ab.reference}</span>}
                                  {ab.notes}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW: FACTURAS A PROVEEDORES (CUENTAS POR PAGAR) */}
      {activeSubTab === 'proveedores' && (
        <div className="space-y-3">
          {filteredCuentas.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No hay cuentas por pagar registradas</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm 
                  ? 'No encontramos facturas que coincidan con los filtros de búsqueda.'
                  : 'Registra tus deudas o compras a crédito de proveedores para llevar el calendario comercial.'}
              </p>
              <button
                type="button"
                onClick={openNewCuentaModal}
                className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                + Agregar Primera Factura Proveedor
              </button>
            </div>
          ) : (
            filteredCuentas.map((cuenta) => {
              const isOverdue = new Date(cuenta.dueDate) < new Date() && cuenta.status !== 'pagada';
              const progress = cuenta.totalAmountUSD > 0 ? (cuenta.paidAmountUSD / cuenta.totalAmountUSD) * 100 : 0;

              return (
                <div 
                  key={cuenta.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">
                            {cuenta.supplierName}
                          </span>
                          {cuenta.supplierRIF && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {cuenta.supplierRIF}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {cuenta.category}
                          </span>
                          {isOverdue ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> VENCIDA
                            </span>
                          ) : cuenta.status === 'pagada' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> PAGADA
                            </span>
                          ) : cuenta.status === 'parcial' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              ABONO PARCIAL
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                              PENDIENTE
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>Factura: <strong>{cuenta.invoiceNumber}</strong></span>
                          {cuenta.controlNumber && <span>Control: <strong>{cuenta.controlNumber}</strong></span>}
                          {cuenta.supplierPhone && (
                            <a 
                              href={`https://wa.me/58${cuenta.supplierPhone.replace(/\D/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" /> {cuenta.supplierPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amounts */}
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400 font-medium">Resta por pagar</div>
                      <div className="text-base sm:text-lg font-black text-rose-600 font-mono-numbers">
                        ${formatUSD(cuenta.remainingUSD)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-numbers">
                        Bs {formatBs(cuenta.remainingUSD * bcvRate)}
                      </div>
                    </div>
                  </div>

                  {/* Detail box */}
                  <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="truncate max-w-md">
                      <strong>Detalle:</strong> {cuenta.description}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
                      <span>Emisión: {new Date(cuenta.date).toLocaleDateString('es-VE')}</span>
                      <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                        Vence: {new Date(cuenta.dueDate).toLocaleDateString('es-VE')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar of Payments */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                      <span>Abonado: ${formatUSD(cuenta.paidAmountUSD)} de ${formatUSD(cuenta.totalAmountUSD)}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          cuenta.status === 'pagada' ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions & Abonos Details */}
                  <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cuenta.status !== 'pagada' && (
                        <button
                          type="button"
                          onClick={() => {
                            setCuentaForAbono(cuenta);
                            setAbonoAmountUSD(cuenta.remainingUSD.toString());
                            setIsAbonoModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Abonar / Pagar</span>
                        </button>
                      )}

                      {cuenta.abonos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCuenta(selectedCuenta?.id === cuenta.id ? null : cuenta)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ver {cuenta.abonos.length} Abono{cuenta.abonos.length > 1 ? 's' : ''}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${selectedCuenta?.id === cuenta.id ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailCuenta(cuenta)}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                        title="Ver detalle de factura"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCuentaModal(cuenta)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                        title="Editar factura"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCuentaPorPagar(cuenta.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Eliminar factura"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Abonos Accordion Table */}
                  {selectedCuenta?.id === cuenta.id && cuenta.abonos.length > 0 && (
                    <div className="mt-2 pt-3 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-extrabold text-slate-700">Historial de Abonos Realizados</h4>
                      <div className="bg-slate-50 rounded-xl overflow-x-auto border border-slate-200/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/80 text-slate-600 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="p-2">Fecha</th>
                              <th className="p-2">Monto ($)</th>
                              <th className="p-2">Monto (Bs)</th>
                              <th className="p-2">Método</th>
                              <th className="p-2">Ref / Nota</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cuenta.abonos.map(ab => (
                              <tr key={ab.id} className="hover:bg-white/80">
                                <td className="p-2 font-mono text-slate-600 whitespace-nowrap">
                                  {new Date(ab.date).toLocaleDateString('es-VE')} {new Date(ab.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-2 font-black text-emerald-600 font-mono-numbers">
                                  ${formatUSD(ab.amountUSD)}
                                </td>
                                <td className="p-2 font-mono-numbers text-slate-600">
                                  Bs {formatBs(ab.amountBs)}
                                </td>
                                <td className="p-2 uppercase font-semibold text-[11px] text-slate-700">
                                  {ab.paymentMethod.replace('_', ' ')}
                                </td>
                                <td className="p-2 text-slate-500">
                                  {ab.reference && <span className="font-mono text-slate-700 mr-1.5">Ref: {ab.reference}</span>}
                                  {ab.notes}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR GASTO OPERATIVO DEL MES */}
      {isAddGastoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 max-h-[92vh] overflow-y-auto space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Home className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingGasto ? 'Editar Gasto del Mes' : 'Registrar Gasto del Mes'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Insumos (hojas, tinta), alquiler, servicios o gastos por pagar
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsAddGastoModalOpen(false);
                  setEditingGasto(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrEditGasto} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Concepto / Nombre del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Resma de Hojas y Tinta Epson, Alquiler Local, Corpoelec..."
                  value={gastoConcept}
                  onChange={(e) => setGastoConcept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* DATOS FISCALES Y DE CONTACTO DEL PROVEEDOR / EMISOR */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Datos Fiscales y Contacto del Proveedor / Emisor
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre del Proveedor / Persona</label>
                    <input
                      type="text"
                      placeholder="Ej: Papelería El Sol / Juan Pérez"
                      value={gastoSupplierName}
                      onChange={(e) => setGastoSupplierName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">RIF o Cédula</label>
                    <input
                      type="text"
                      placeholder="Ej: J-30192847-1 o V-18492011"
                      value={gastoSupplierRIF}
                      onChange={(e) => setGastoSupplierRIF(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Teléfono de Contacto</label>
                    <input
                      type="text"
                      placeholder="Ej: 0414-1234567"
                      value={gastoSupplierPhone}
                      onChange={(e) => setGastoSupplierPhone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Número de Factura o Recibo</label>
                    <input
                      type="text"
                      placeholder="Ej: FAC-00412 o REC-89"
                      value={gastoInvoiceNumber}
                      onChange={(e) => setGastoInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rubro / Categoría *</label>
                  <select
                    value={gastoCategory}
                    onChange={(e) => setGastoCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Insumos / Papelería">Insumos (Hojas, Tinta, Papelería)</option>
                    <option value="Alquiler">Alquiler de Local</option>
                    <option value="Servicios">Servicios (Luz / Agua / Internet)</option>
                    <option value="Nómina">Sueldos y Nómina</option>
                    <option value="Mantenimiento">Mantenimiento y Reparación</option>
                    <option value="Transporte">Transporte / Fletes</option>
                    <option value="Eventual">Gasto Eventual / Imprevisto</option>
                    <option value="Papelería">Papelería</option>
                    <option value="Otros">Otros Gastos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Gasto *</label>
                  <select
                    value={gastoType}
                    onChange={(e) => setGastoType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="eventual">Eventual / Compra de Insumo</option>
                    <option value="mensual_fijo">Mensual Fijo / Recurrente</option>
                  </select>
                </div>
              </div>

              {/* Amount with USD / Bs Switcher */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Monto del Gasto *</label>
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setGastoCurrencyInput('USD')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        gastoCurrencyInput === 'USD' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Dólares ($ USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGastoCurrencyInput('Bs')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        gastoCurrencyInput === 'Bs' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Bolívares (Bs)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    {gastoCurrencyInput === 'USD' ? '$' : 'Bs'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={gastoCurrencyInput === 'USD' ? gastoAmountUSD : gastoAmountBs}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (gastoCurrencyInput === 'USD') {
                        setGastoAmountUSD(val);
                        const num = parseFloat(val);
                        setGastoAmountBs(!isNaN(num) ? (num * bcvRate).toFixed(2) : '');
                      } else {
                        setGastoAmountBs(val);
                        const num = parseFloat(val);
                        setGastoAmountUSD(!isNaN(num) && bcvRate > 0 ? (num / bcvRate).toFixed(2) : '');
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {gastoAmountUSD && !isNaN(parseFloat(gastoAmountUSD)) && (
                  <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                    <span>Equivalente:</span>
                    <strong className="text-slate-700">
                      {gastoCurrencyInput === 'USD'
                        ? `Bs ${formatBs(parseFloat(gastoAmountUSD) * bcvRate)} (Tasa BCV)`
                        : `$${formatUSD(parseFloat(gastoAmountUSD))} USD`}
                    </strong>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mes de Aplicación</label>
                  <input
                    type="text"
                    value={gastoMonth}
                    onChange={(e) => setGastoMonth(e.target.value)}
                    placeholder="Ej: Noviembre 2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Vencimiento *</label>
                  <input
                    type="date"
                    required
                    value={gastoDueDate}
                    onChange={(e) => setGastoDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Initial Status: Pendiente vs Pagado (only on new creation) */}
              {!editingGasto && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Estado del Gasto</label>
                    <div className="flex gap-2">
                      <label className={`flex-1 p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        gastoInitialStatus === 'pendiente' 
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="gastoStatus"
                          checked={gastoInitialStatus === 'pendiente'}
                          onChange={() => setGastoInitialStatus('pendiente')}
                          className="text-amber-600"
                        />
                        <span className="text-xs">Pendiente por Pagar</span>
                      </label>

                      <label className={`flex-1 p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        gastoInitialStatus === 'pagado' 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="gastoStatus"
                          checked={gastoInitialStatus === 'pagado'}
                          onChange={() => setGastoInitialStatus('pagado')}
                          className="text-emerald-600"
                        />
                        <span className="text-xs">Pagado Inmediatamente</span>
                      </label>
                    </div>
                  </div>

                  {gastoInitialStatus === 'pagado' && (
                    <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200 space-y-2 animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">Método de Pago</label>
                          <select
                            value={gastoPayMethod}
                            onChange={(e) => setGastoPayMethod(e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none"
                          >
                            <option value="pago_movil">Pago Móvil</option>
                            <option value="transferencia">Transferencia Bancaria</option>
                            <option value="efectivo_usd">Efectivo USD ($)</option>
                            <option value="efectivo_bs">Efectivo Bs</option>
                            <option value="debito">Tarjeta de Débito</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">Referencia / Comprobante</label>
                          <input
                            type="text"
                            placeholder="Ej: 789123"
                            value={gastoPayRef}
                            onChange={(e) => setGastoPayRef(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones / Notas Opcionales</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Compra a crédito de 5 resmas carta y tinta negra/color..."
                  value={gastoNotes}
                  onChange={(e) => setGastoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddGastoModalOpen(false);
                    setEditingGasto(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {editingGasto ? 'Guardar Cambios' : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PAGO / ABONO PARCIAL DE GASTO */}
      {isPagarGastoModalOpen && gastoForPagar && (() => {
        const remaining = getGastoRemainingUSD(gastoForPagar);
        const paidSoFar = getGastoPaidUSD(gastoForPagar);
        const enteredAmount = parseFloat(pagarAmountUSD) || 0;
        const clampedAmount = Math.min(remaining, Math.max(0, enteredAmount));
        const afterRemaining = Math.max(0, Number((remaining - clampedAmount).toFixed(2)));
        const willBeFull = afterRemaining <= 0.009;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-100 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Coins className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Registrar Abono / Pago de Gasto</h3>
                    <div className="text-[11px] text-slate-500 truncate max-w-[230px]">
                      {gastoForPagar.concept}
                      {gastoForPagar.supplierName ? ` • ${gastoForPagar.supplierName}` : ''}
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsPagarGastoModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Balance Summary */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Total Original del Gasto:</span>
                  <span className="font-mono font-bold text-slate-700">${formatUSD(gastoForPagar.amountUSD)}</span>
                </div>
                {paidSoFar > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <span>Abonado Previamente:</span>
                    <span className="font-mono font-bold">- ${formatUSD(paidSoFar)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-slate-600 font-bold">Saldo Pendiente Restante:</span>
                    <div className="font-mono font-black text-rose-600 text-base">
                      ${formatUSD(remaining)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Equivalente BCV:</span>
                    <div className="font-mono font-bold text-slate-700">
                      Bs {formatBs(remaining * bcvRate)}
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmPagarGasto} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Monto a Cancelar / Abonar ($ USD) *</label>
                    <button
                      type="button"
                      onClick={() => setPagarAmountUSD(remaining.toFixed(2))}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Pagar Total (${formatUSD(remaining)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remaining}
                      required
                      value={pagarAmountUSD}
                      onChange={(e) => setPagarAmountUSD(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  {enteredAmount > 0 && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-500">Salida en Bs: Bs {formatBs(clampedAmount * bcvRate)}</span>
                      <span className={`font-bold ${willBeFull ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {willBeFull ? '✓ Saldará por completo' : `Restará: $${formatUSD(afterRemaining)} (Parcial)`}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago Empleado *</label>
                  <select
                    value={pagarMethod}
                    onChange={(e) => setPagarMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo_usd">Efectivo USD ($)</option>
                    <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                    <option value="debito">Tarjeta de Débito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número de Referencia / Comprobante</label>
                  <input
                    type="text"
                    placeholder="Ej: 789123 o TR-449102"
                    value={pagarRef}
                    onChange={(e) => setPagarRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nota del Abono / Auditoría</label>
                  <input
                    type="text"
                    placeholder="Ej: Primer abono por compra de resmas y tinta"
                    value={pagarNotes}
                    onChange={(e) => setPagarNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPagarGastoModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enteredAmount <= 0 || enteredAmount > remaining + 0.01}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    {willBeFull ? 'Confirmar Pago Total' : 'Confirmar Abono Parcial'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: DETALLE COMPLETO DE GASTO (EL OJITO) */}
      {detailGasto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm">Detalle del Gasto / Insumo</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailGasto(null)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {detailGasto.category} • {detailGasto.type === 'eventual' ? 'Eventual' : 'Fijo Mensual'}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1.5">{detailGasto.concept}</h3>
                <p className="text-slate-500">Mes: <strong>{detailGasto.month}</strong> | Emisión: {new Date(detailGasto.date).toLocaleDateString('es-VE')} | Vence: {new Date(detailGasto.dueDate).toLocaleDateString('es-VE')}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-700 uppercase text-[10px]">Datos Fiscales y Contacto</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proveedor / Emisor:</span>
                  <span className="font-bold text-slate-900">{detailGasto.supplierName || 'No especificado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RIF / Cédula:</span>
                  <span className="font-mono font-bold text-slate-800">{detailGasto.supplierRIF || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Teléfono Contacto:</span>
                  <span className="font-mono font-semibold text-slate-800">{detailGasto.supplierPhone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nº Factura / Recibo:</span>
                  <span className="font-mono font-bold text-teal-800">{detailGasto.invoiceNumber || 'N/A'}</span>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Monto Total:</span>
                  <span>${formatUSD(detailGasto.amountUSD)} (Bs. {formatBs(detailGasto.amountBs)})</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Total Abonado:</span>
                  <span>${formatUSD(getGastoPaidUSD(detailGasto))}</span>
                </div>
                <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-slate-700 text-sm">
                  <span>Saldo Pendiente:</span>
                  <span>${formatUSD(getGastoRemainingUSD(detailGasto))}</span>
                </div>
              </div>

              {detailGasto.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <strong>Observaciones:</strong> {detailGasto.notes}
                </div>
              )}

              {detailGasto.abonos && detailGasto.abonos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700 uppercase text-[10px]">Auditoría de Pagos y Abonos ({detailGasto.abonos.length})</div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {detailGasto.abonos.map(ab => (
                      <div key={ab.id} className="p-2.5 border-b border-slate-100 last:border-0 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800 uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')} {ab.reference ? `• Ref: ${ab.reference}` : ''}</div>
                          <div className="text-[10px] text-slate-500">{new Date(ab.date).toLocaleString('es-VE')}</div>
                          {ab.notes && <div className="text-[11px] text-slate-600 italic">{ab.notes}</div>}
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-700">${formatUSD(ab.amountUSD)}</div>
                          <div className="text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const g = detailGasto;
                    setDetailGasto(null);
                    openEditGastoModal(g);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteGastoOperativo(detailGasto.id);
                    setDetailGasto(null);
                  }}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailGasto(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE CUENTA POR PAGAR A PROVEEDOR (EL OJITO) */}
      {detailCuenta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-sm">Detalle Cuenta por Pagar: {detailCuenta.invoiceNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailCuenta(null)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-black text-slate-900">{detailCuenta.supplierName}</h3>
                <p className="text-slate-500 font-mono">RIF: {detailCuenta.supplierRIF || 'N/A'} {detailCuenta.supplierPhone ? `• Tel: ${detailCuenta.supplierPhone}` : ''}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">Factura / Control:</span><span className="font-mono font-bold">{detailCuenta.invoiceNumber} / {detailCuenta.controlNumber || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Emisión:</span><span>{new Date(detailCuenta.date).toLocaleDateString('es-VE')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Vencimiento:</span><span className="font-bold">{new Date(detailCuenta.dueDate).toLocaleDateString('es-VE')}</span></div>
                <div className="pt-1 border-t border-slate-200"><span className="text-slate-500 block">Descripción:</span><span className="font-semibold text-slate-800">{detailCuenta.description}</span></div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-1 font-mono">
                <div className="flex justify-between"><span>Total Factura:</span><span>${formatUSD(detailCuenta.totalAmountUSD)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>Abonado:</span><span>${formatUSD(detailCuenta.paidAmountUSD)}</span></div>
                <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-slate-700 text-sm"><span>Saldo Restante:</span><span>${formatUSD(detailCuenta.remainingUSD)}</span></div>
              </div>

              {detailCuenta.abonos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700 uppercase text-[10px]">Historial de Abonos ({detailCuenta.abonos.length})</div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {detailCuenta.abonos.map(ab => (
                      <div key={ab.id} className="p-2.5 border-b border-slate-100 last:border-0 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800 uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')} {ab.reference ? `• Ref: ${ab.reference}` : ''}</div>
                          <div className="text-[10px] text-slate-500">{new Date(ab.date).toLocaleString('es-VE')}</div>
                          {ab.notes && <div className="text-[11px] text-slate-600 italic">{ab.notes}</div>}
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-700">${formatUSD(ab.amountUSD)}</div>
                          <div className="text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const c = detailCuenta;
                    setDetailCuenta(null);
                    openEditCuentaModal(c);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteCuentaPorPagar(detailCuenta.id);
                    setDetailCuenta(null);
                  }}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailCuenta(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR FACTURA PROVEEDOR */}
      {isAddCuentaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingCuenta ? 'Editar Factura de Proveedor' : 'Registrar Factura de Proveedor'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsAddCuentaModalOpen(false);
                  setEditingCuenta(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrEditCuenta} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Proveedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Alimentos Polar, Papelera El Sol..."
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RIF / Cédula del Proveedor</label>
                  <input
                    type="text"
                    placeholder="Ej: J-12345678-0"
                    value={newSupplierRIF}
                    onChange={(e) => setNewSupplierRIF(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ej: 0414-1234567"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número de Factura *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FAC-00921"
                    value={newInvoiceNumber}
                    onChange={(e) => setNewInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nro de Control SENIAT</label>
                  <input
                    type="text"
                    placeholder="Ej: 00-00921"
                    value={newControlNumber}
                    onChange={(e) => setNewControlNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={newIssueDate}
                    onChange={(e) => setNewIssueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Vencimiento *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rubro / Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Mercancía">Mercancía</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Materia Prima">Materia Prima</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monto Total ($ USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newTotalUSD}
                      onChange={(e) => setNewTotalUSD(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {newTotalUSD && !isNaN(parseFloat(newTotalUSD)) && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      ≈ Bs {formatBs(parseFloat(newTotalUSD) * bcvRate)}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción de la Factura</label>
                <input
                  type="text"
                  placeholder="Ej: 20 bultos de harina, 10 cajas de aceite..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones / Notas Adicionales</label>
                <textarea
                  rows={2}
                  placeholder="Condiciones de pago, plazo comercial, número de guía..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCuentaModalOpen(false);
                    setEditingCuenta(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {editingCuenta ? 'Guardar Cambios' : 'Guardar Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ABONO A PROVEEDOR */}
      {isAbonoModalOpen && cuentaForAbono && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Registrar Abono a Proveedor</h3>
                  <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                    {cuentaForAbono.supplierName} (Factura {cuentaForAbono.invoiceNumber})
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsAbonoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500">Deuda Restante:</span>
                <div className="font-mono font-black text-rose-600 text-base">
                  ${formatUSD(cuentaForAbono.remainingUSD)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500">En Bolívares (BCV):</span>
                <div className="font-mono font-bold text-slate-700">
                  Bs {formatBs(cuentaForAbono.remainingUSD * bcvRate)}
                </div>
              </div>
            </div>

            <form onSubmit={handleRegisterAbono} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto a Abonar ($ USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={cuentaForAbono.remainingUSD}
                    required
                    value={abonoAmountUSD}
                    onChange={(e) => setAbonoAmountUSD(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                {abonoAmountUSD && !isNaN(parseFloat(abonoAmountUSD)) && (
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Equivalente: Bs {formatBs(parseFloat(abonoAmountUSD) * bcvRate)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago Empleado</label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="efectivo_usd">Efectivo USD ($)</option>
                  <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                  <option value="debito">Tarjeta de Débito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número de Referencia / Comprobante</label>
                <input
                  type="text"
                  placeholder="Ej: 789123 o TR-449102"
                  value={abonoRef}
                  onChange={(e) => setAbonoRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nota del Abono</label>
                <input
                  type="text"
                  placeholder="Ej: Pago parcial desde cuenta Banesco comercial"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAbonoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
