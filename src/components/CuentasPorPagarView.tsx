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
  Hash,
  Briefcase,
  MapPin,
  Mail
} from 'lucide-react';
import { formatUSD, formatBs, getLocalDateStr, round2 } from '../utils/exportUtils';
import { CuentaPorPagar, PaymentMethod, GastoOperativo, GastoOperativoCategory, Supplier } from '../types';

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
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    bcvRate,
    isCashRegisterOpen,
    setIsAperturaModalOpen
  } = useApp();

  // Active Sub-Tab: 'proveedores' vs 'gastos_mes' vs 'maestro_proveedores'
  const [activeSubTab, setActiveSubTab] = useState<'gastos_mes' | 'proveedores' | 'maestro_proveedores'>('gastos_mes');

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
  const [confirmDeleteSupplierId, setConfirmDeleteSupplierId] = useState<string | null>(null);

  // Maestro de Proveedores Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supRif, setSupRif] = useState('J-');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supCreditDays, setSupCreditDays] = useState('15');
  const [supNotes, setSupNotes] = useState('');

  // New/Edit Cuenta por Pagar Form
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRIF, setNewSupplierRIF] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newControlNumber, setNewControlNumber] = useState('');
  const [newIssueDate, setNewIssueDate] = useState(getLocalDateStr());
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return getLocalDateStr(d);
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
  const [gastoSupplierId, setGastoSupplierId] = useState('');
  const [gastoSupplierName, setGastoSupplierName] = useState('');
  const [gastoSupplierRIF, setGastoSupplierRIF] = useState('');
  const [gastoSupplierPhone, setGastoSupplierPhone] = useState('');
  const [gastoInvoiceNumber, setGastoInvoiceNumber] = useState('');
  const [gastoMonth, setGastoMonth] = useState(capitalizedMonth);
  const [gastoDate, setGastoDate] = useState(getLocalDateStr());
  const [gastoDueDate, setGastoDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return getLocalDateStr(d);
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

  const getLiveSupplierBalance = (sup: Supplier): number => {
    const supRif = (sup.rif || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const supNameLower = (sup.name || '').trim().toLowerCase();
    const cppPending = cuentasPorPagar
      .filter(c => {
        if (c.status === 'pagada' || (c.remainingUSD || 0) <= 0.009) return false;
        if (c.supplierId) return c.supplierId === sup.id;
        const cRif = (c.supplierRIF || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (supRif.length > 2 && cRif === supRif) return true;
        return supNameLower.length > 0 && (c.supplierName || '').trim().toLowerCase() === supNameLower;
      })
      .reduce((s, c) => s + (c.remainingUSD || 0), 0);
    return round2(Math.max(cppPending, sup.accumulatedBalanceUSD || 0));
  };

  const filteredSuppliers = suppliers.filter(s => {
    const q = searchTerm.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.rif || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  const openNewSupplierModal = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupRif('J-');
    setSupPhone('');
    setSupAddress('');
    setSupEmail('');
    setSupCreditDays('15');
    setSupNotes('');
    setIsSupplierModalOpen(true);
  };

  const openEditSupplierModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupRif(sup.rif || '');
    setSupPhone(sup.phone || '');
    setSupAddress(sup.address || '');
    setSupEmail(sup.email || '');
    setSupCreditDays(String(sup.creditDays ?? 15));
    setSupNotes(sup.notes || '');
    setIsSupplierModalOpen(true);
  };

  const handleCreateOrEditSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    const creditDays = Math.max(0, parseInt(supCreditDays, 10) || 0);
    if (editingSupplier) {
      updateSupplier({
        ...editingSupplier,
        name: supName.trim(),
        rif: supRif.trim().toUpperCase(),
        phone: supPhone.trim(),
        address: supAddress.trim() || undefined,
        email: supEmail.trim() || undefined,
        creditDays,
        notes: supNotes.trim() || undefined
      });
    } else {
      addSupplier({
        name: supName.trim(),
        rif: supRif.trim().toUpperCase(),
        phone: supPhone.trim(),
        address: supAddress.trim() || undefined,
        email: supEmail.trim() || undefined,
        creditDays,
        notes: supNotes.trim() || undefined
      });
    }
    setEditingSupplier(null);
    setIsSupplierModalOpen(false);
  };

  const openNewGastoModal = () => {
    setEditingGasto(null);
    setGastoConcept('');
    setGastoCategory('Insumos / Papelería');
    setGastoType('eventual');
    setGastoSupplierId('');
    setGastoSupplierName('');
    setGastoSupplierRIF('');
    setGastoSupplierPhone('');
    setGastoInvoiceNumber('');
    setGastoMonth(capitalizedMonth);
    setGastoDate(getLocalDateStr());
    const d = new Date();
    d.setDate(d.getDate() + 5);
    setGastoDueDate(getLocalDateStr(d));
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
    setGastoSupplierId(g.supplierId || '');
    setGastoSupplierName(g.supplierName || '');
    setGastoSupplierRIF(g.supplierRIF || '');
    setGastoSupplierPhone(g.supplierPhone || '');
    setGastoInvoiceNumber(g.invoiceNumber || '');
    setGastoMonth(g.month);
    setGastoDate(g.date ? getLocalDateStr(new Date(g.date)) : getLocalDateStr());
    setGastoDueDate(g.dueDate ? getLocalDateStr(new Date(g.dueDate)) : getLocalDateStr());
    setGastoCurrencyInput('USD');
    setGastoAmountUSD(g.amountUSD.toFixed(2));
    setGastoAmountBs((g.amountUSD * bcvRate).toFixed(2));
    setGastoInitialStatus(g.status === 'pagado' ? 'pagado' : 'pendiente');
    setGastoPayMethod(g.paymentMethod || 'pago_movil');
    setGastoPayRef(g.reference || '');
    setGastoNotes(g.notes || '');
    setIsAddGastoModalOpen(true);
  };

  const openNewCuentaModal = (preselectedSupplier?: Supplier) => {
    setEditingCuenta(null);
    setNewSupplierId(preselectedSupplier?.id || '');
    setNewSupplierName(preselectedSupplier?.name || '');
    setNewSupplierRIF(preselectedSupplier?.rif || '');
    setNewSupplierPhone(preselectedSupplier?.phone || '');
    setNewInvoiceNumber('');
    setNewControlNumber('');
    setNewIssueDate(getLocalDateStr());
    const d = new Date();
    d.setDate(d.getDate() + (preselectedSupplier?.creditDays ?? 15));
    setNewDueDate(getLocalDateStr(d));
    setNewCategory('Mercancía');
    setNewDescription('');
    setNewTotalUSD('');
    setNewNotes('');
    setIsAddCuentaModalOpen(true);
  };

  const openEditCuentaModal = (c: CuentaPorPagar) => {
    setEditingCuenta(c);
    setNewSupplierId(c.supplierId || '');
    setNewSupplierName(c.supplierName);
    setNewSupplierRIF(c.supplierRIF || '');
    setNewSupplierPhone(c.supplierPhone || '');
    setNewInvoiceNumber(c.invoiceNumber);
    setNewControlNumber(c.controlNumber || '');
    setNewIssueDate(c.date ? getLocalDateStr(new Date(c.date)) : getLocalDateStr());
    setNewDueDate(c.dueDate ? getLocalDateStr(new Date(c.dueDate)) : getLocalDateStr());
    setNewCategory(c.category);
    setNewDescription(c.description);
    setNewTotalUSD(c.totalAmountUSD.toFixed(2));
    setNewNotes(c.notes || '');
    setIsAddCuentaModalOpen(true);
  };

  const handleSelectCuentaSupplier = (supId: string) => {
    setNewSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      setNewSupplierName(sup.name);
      setNewSupplierRIF(sup.rif);
      setNewSupplierPhone(sup.phone);
      const base = newIssueDate ? new Date(`${newIssueDate}T12:00:00`) : new Date();
      base.setDate(base.getDate() + (sup.creditDays ?? 15));
      setNewDueDate(getLocalDateStr(base));
    }
  };

  const handleSelectGastoSupplier = (supId: string) => {
    setGastoSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      setGastoSupplierName(sup.name);
      setGastoSupplierRIF(sup.rif);
      setGastoSupplierPhone(sup.phone);
      if (sup.creditDays > 0) {
        const base = gastoDate ? new Date(`${gastoDate}T12:00:00`) : new Date();
        base.setDate(base.getDate() + sup.creditDays);
        setGastoDueDate(getLocalDateStr(base));
      }
    }
  };

  const handleCreateOrEditCuenta = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newTotalUSD);
    if (!newSupplierName.trim() || isNaN(amount) || amount <= 0) return;

    if (editingCuenta) {
      const remaining = Math.max(0, Number((amount - editingCuenta.paidAmountUSD).toFixed(2)));
      updateCuentaPorPagar({
        ...editingCuenta,
        supplierId: newSupplierId || editingCuenta.supplierId,
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
        supplierId: newSupplierId || undefined,
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
        supplierId: gastoSupplierId || editingGasto.supplierId,
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
        supplierId: gastoSupplierId || undefined,
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
    <div className="space-y-4 max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-12">
      
      {/* Top Main Banner with Dual Tab Selector */}
      <div className="bg-white/95 rounded-3xl p-5 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-[#0B1528] text-white shrink-0">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-black text-[#0B1528] tracking-tight">
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
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Gasto del Mes</span>
              </button>
            ) : activeSubTab === 'proveedores' ? (
              <button
                type="button"
                onClick={() => openNewCuentaModal()}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Factura Proveedor</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openNewSupplierModal}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Proveedor</span>
              </button>
            )}
          </div>
        </div>

        {/* Triple Sub-Navigation Switcher */}
        <div className="flex flex-col sm:flex-row p-1 bg-[#EEF2F7] rounded-2xl border border-[#DCE4F0] gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('gastos_mes');
              setStatusFilter('todos');
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'gastos_mes'
                ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0]'
                : 'text-slate-600 hover:text-[#0B1528]'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Gastos del Mes & Insumos</span>
            {gastosOperativos.filter(g => g.status !== 'pagado').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] font-extrabold font-mono-numbers">
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
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'proveedores'
                ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0]'
                : 'text-slate-600 hover:text-[#0B1528]'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Facturas a Proveedores</span>
            {cuentasPorPagar.filter(c => c.status !== 'pagada').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3] font-extrabold font-mono-numbers">
                {cuentasPorPagar.filter(c => c.status !== 'pagada').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('maestro_proveedores');
              setStatusFilter('todos');
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'maestro_proveedores'
                ? 'bg-white text-[#1D4ED8] shadow-xs border border-[#DCE4F0]'
                : 'text-slate-600 hover:text-[#0B1528]'
            }`}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>Maestro de Proveedores</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] font-extrabold font-mono-numbers">
              {suppliers.length}
            </span>
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      {activeSubTab === 'gastos_mes' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-b from-white to-[#F4F8FF] rounded-2xl p-4 border border-[#93C5FD] shadow-[0_2px_12px_-4px_rgba(37,99,235,0.1)]">
            <div className="flex items-center justify-between text-[#1D4ED8] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Gastos Mes</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#0B1528] font-mono-numbers">
              ${formatUSD(totalGastosMesUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalGastosMesUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-[#FFF3E8] rounded-2xl p-4 border border-[#F5D3B3] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between text-[#D96B27] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Por Pagar</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#9A4B12] font-mono-numbers">
              ${formatUSD(totalGastosPendientesUSD)}
            </div>
            <div className="text-[11px] text-[#7C3A0B] font-mono-numbers">
              Bs {formatBs(totalGastosPendientesUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between text-[#065F46] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Abonado / Pagado</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#065F46] font-mono-numbers">
              ${formatUSD(totalGastosPagadosUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalGastosPagadosUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between text-[#1D4ED8] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Gastos Eventuales</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#0B1528] font-mono-numbers">
              ${formatUSD(totalGastosEventualesUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              {gastosOperativos.filter(g => g.type === 'eventual').length} registro(s)
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#FFF3E8] rounded-2xl p-4 border border-[#F5D3B3] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between text-[#D96B27] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Deuda Proveedores</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#9A4B12] font-mono-numbers">
              ${formatUSD(totalCppPendingUSD)}
            </div>
            <div className="text-[11px] text-[#7C3A0B] font-mono-numbers">
              Bs {formatBs(totalCppPendingUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between text-[#065F46] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Abonado</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#065F46] font-mono-numbers">
              ${formatUSD(totalCppPaidUSD)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              Bs {formatBs(totalCppPaidUSD * bcvRate)}
            </div>
          </div>

          <div className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between text-[#BE123C] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Facturas Vencidas</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#BE123C] font-mono-numbers">
              {overdueCppCount}
            </div>
            <div className="text-[11px] text-slate-500">
              {overdueCppCount > 0 ? 'Requieren pago' : 'Al día con distribuidores'}
            </div>
          </div>

          <div className="bg-gradient-to-b from-white to-[#F4F8FF] rounded-2xl p-4 border border-[#93C5FD] shadow-[0_2px_12px_-4px_rgba(37,99,235,0.1)]">
            <div className="flex items-center justify-between text-[#1D4ED8] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Facturas</span>
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-[#0B1528] font-mono-numbers">
              {cuentasPorPagar.length}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              {cuentasPorPagar.filter(c => c.status === 'pagada').length} pagadas
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="bg-white/95 rounded-2xl p-3 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeSubTab === 'gastos_mes' 
              ? "Buscar por concepto, proveedor, RIF/Cédula, factura o teléfono..."
              : activeSubTab === 'maestro_proveedores'
                ? "Buscar proveedor por razón social, RIF, teléfono o dirección..."
                : "Buscar factura, proveedor, RIF o número de control..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        {/* Filters specific to active sub-tab */}
        {activeSubTab !== 'maestro_proveedores' && (
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {activeSubTab === 'gastos_mes' ? (
              <>
                <select
                  value={gastoTypeFilter}
                  onChange={(e) => setGastoTypeFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] text-[#0B1528] rounded-xl text-xs font-bold border border-[#DCE4F0] focus:outline-none focus:border-blue-500"
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        statusFilter === st.id
                          ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_-2px_rgba(37,99,235,0.4)]'
                          : 'bg-[#EEF2F7] text-slate-600 hover:bg-[#E2E8F0]'
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_-2px_rgba(37,99,235,0.4)]'
                        : 'bg-[#EEF2F7] text-slate-600 hover:bg-[#E2E8F0]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* VIEW: GASTOS OPERATIVOS DEL MES */}
      {activeSubTab === 'gastos_mes' && (
        <div className="space-y-3">
          {filteredGastos.length === 0 ? (
            <div className="bg-white/95 rounded-3xl p-8 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] text-center space-y-2">
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
                  className="bg-white/95 rounded-2xl border border-[#DCE4F0] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:border-[#93C5FD] transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-[#EEF2F7] border border-[#DCE4F0] shrink-0 mt-0.5">
                        {getCategoryIcon(gasto.category)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-[#0B1528]">
                            {gasto.concept}
                          </span>
                          
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F8FAFC] text-slate-700 border border-[#DCE4F0]">
                            {gasto.category}
                          </span>

                          {gasto.type === 'eventual' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> EVENTUAL
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC]">
                              FIJO MENSUAL
                            </span>
                          )}

                          {gasto.status === 'pagado' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7F8EE] text-[#065F46] border border-[#A7E6C4] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> PAGADO
                            </span>
                          ) : gasto.status === 'parcial' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] flex items-center gap-1">
                              <Coins className="w-3 h-3" /> PARCIALMENTE PAGADO
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> VENCIDO
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3]">
                              PENDIENTE POR PAGAR
                            </span>
                          )}
                        </div>

                        {/* Supplier & Invoice fiscal info */}
                        {(gasto.supplierName || gasto.supplierRIF || gasto.supplierPhone || gasto.invoiceNumber) && (
                          <div className="text-xs text-slate-600 flex items-center gap-2.5 flex-wrap pt-0.5">
                            {gasto.supplierName && (
                              <span className="font-semibold text-[#0B1528] flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {gasto.supplierName}
                              </span>
                            )}
                            {gasto.supplierRIF && (
                              <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[#F8FAFC] rounded border border-[#DCE4F0]">
                                {gasto.supplierRIF}
                              </span>
                            )}
                            {gasto.invoiceNumber && (
                              <span className="font-mono text-[11px] font-bold text-[#1D4ED8] bg-[#EBF3FE] px-1.5 py-0.5 rounded border border-[#C5DCFC]">
                                Doc: {gasto.invoiceNumber}
                              </span>
                            )}
                            {gasto.supplierPhone && (
                              <a
                                href={`https://wa.me/58${gasto.supplierPhone.replace(/\D/g, '').slice(-10)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#065F46] hover:underline font-semibold flex items-center gap-1 text-[11px]"
                              >
                                <Phone className="w-3 h-3" /> {gasto.supplierPhone}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                          <span>Mes: <strong>{gasto.month}</strong></span>
                          <span>Emisión: {new Date(gasto.date).toLocaleDateString('es-VE')}</span>
                          <span>Vence: <strong className={isOverdue ? 'text-[#BE123C]' : ''}>{new Date(gasto.dueDate).toLocaleDateString('es-VE')}</strong></span>
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
                      <div className={`text-base sm:text-lg font-black font-mono-numbers ${gasto.status === 'pagado' ? 'text-[#065F46]' : 'text-[#BE123C]'}`}>
                        ${formatUSD(gasto.status === 'pagado' ? gasto.amountUSD : remainingUSD)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-numbers">
                        Bs {formatBs((gasto.status === 'pagado' ? gasto.amountUSD : remainingUSD) * bcvRate)}
                      </div>
                      {gasto.status !== 'pagado' && paidUSD > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                          Total factura: ${formatUSD(gasto.amountUSD)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar if partially paid or pending */}
                  {(paidUSD > 0 || gasto.status !== 'pagado') && (
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1 font-mono-numbers">
                        <span>Abonado: ${formatUSD(paidUSD)} de ${formatUSD(gasto.amountUSD)}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#EEF2F7] rounded-full overflow-hidden">
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
                  <div className="pt-2 border-t border-[#EEF2F7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-slate-500 italic truncate max-w-md">
                      {gasto.notes ? `Nota: ${gasto.notes}` : 'Sin observaciones adicionales.'}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {gasto.status !== 'pagado' && (
                        <button
                          type="button"
                          onClick={() => openPagarGastoModal(gasto)}
                          className="px-3 py-1.5 rounded-xl bg-[#0B1528] hover:bg-[#152440] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Coins className="w-3.5 h-3.5 text-emerald-300" />
                          <span>{paidUSD > 0 ? 'Abonar / Liquidar' : 'Abonar / Pagar'}</span>
                        </button>
                      )}

                      {abonosList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedGastoAbonosId(expandedGastoAbonosId === gasto.id ? null : gasto.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#EEF2F7] hover:bg-[#E2E8F0] text-[#0B1528] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-slate-500" />
                          <span>{abonosList.length} Pago{abonosList.length > 1 ? 's' : ''}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedGastoAbonosId === gasto.id ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDetailGasto(gasto)}
                        className="p-1.5 rounded-xl bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Ver detalle completo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditGastoModal(gasto)}
                        className="p-1.5 rounded-xl bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-[#FFF3E8] hover:text-[#9A4B12] transition-colors cursor-pointer"
                        title="Editar gasto"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === gasto.id ? (
                        <div className="flex items-center gap-1 bg-[#FEECEF] px-2 py-1 rounded-xl border border-[#FBC4CD]">
                          <button
                            type="button"
                            onClick={() => {
                              deleteGastoOperativo(gasto.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-[11px] font-bold text-[#BE123C] hover:underline cursor-pointer"
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
                          className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Audit Trail Accordion of Abonos */}
                  {expandedGastoAbonosId === gasto.id && abonosList.length > 0 && (
                    <div className="mt-2 pt-3 border-t border-[#EEF2F7] space-y-2">
                      <h4 className="text-xs font-extrabold text-[#0B1528]">Historial de Abonos y Pagos (Auditoría)</h4>
                      <div className="bg-[#F8FAFC] rounded-xl overflow-x-auto border border-[#DCE4F0]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#EEF2F7] text-slate-600 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="p-2">Fecha</th>
                              <th className="p-2">Monto ($)</th>
                              <th className="p-2">Monto (Bs)</th>
                              <th className="p-2">Método</th>
                              <th className="p-2">Ref / Nota</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EEF2F7]">
                            {abonosList.map(ab => (
                              <tr key={ab.id} className="hover:bg-white/80">
                                <td className="p-2 font-mono text-slate-600 whitespace-nowrap">
                                  {new Date(ab.date).toLocaleDateString('es-VE')} {new Date(ab.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-2 font-black text-[#065F46] font-mono-numbers">
                                  ${formatUSD(ab.amountUSD)}
                                </td>
                                <td className="p-2 font-mono-numbers text-slate-600">
                                  Bs {formatBs(ab.amountBs)}
                                </td>
                                <td className="p-2 uppercase font-semibold text-[11px] text-[#0B1528]">
                                  {ab.paymentMethod.replace('_', ' ')}
                                </td>
                                <td className="p-2 text-slate-500">
                                  {ab.reference && <span className="font-mono text-[#0B1528] mr-1.5">Ref: {ab.reference}</span>}
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
            <div className="bg-white/95 rounded-3xl p-8 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] text-center space-y-2">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-[#0B1528]">No hay cuentas por pagar registradas</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm 
                  ? 'No encontramos facturas que coincidan con los filtros de búsqueda.'
                  : 'Registra tus deudas o compras a crédito de proveedores para llevar el calendario comercial.'}
              </p>
              <button
                type="button"
                onClick={() => openNewCuentaModal()}
                className="mt-2 px-4 py-2 bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
                  className="bg-white/95 rounded-2xl border border-[#DCE4F0] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:border-[#93C5FD] transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-[#EEF2F7] border border-[#DCE4F0] text-[#0B1528] shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-[#0B1528]">
                            {cuenta.supplierName}
                          </span>
                          {cuenta.supplierRIF && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0]">
                              {cuenta.supplierRIF}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC]">
                            {cuenta.category}
                          </span>
                          {isOverdue ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> VENCIDA
                            </span>
                          ) : cuenta.status === 'pagada' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7F8EE] text-[#065F46] border border-[#A7E6C4] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> PAGADA
                            </span>
                          ) : cuenta.status === 'parcial' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3]">
                              ABONO PARCIAL
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEF2F7] text-[#0B1528] border border-[#DCE4F0]">
                              PENDIENTE
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>Factura: <strong className="text-[#0B1528]">{cuenta.invoiceNumber}</strong></span>
                          {cuenta.controlNumber && <span>Control: <strong>{cuenta.controlNumber}</strong></span>}
                          {cuenta.supplierPhone && (
                            <a 
                              href={`https://wa.me/58${cuenta.supplierPhone.replace(/\D/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#065F46] hover:underline font-semibold flex items-center gap-1"
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
                      <div className="text-base sm:text-lg font-black text-[#BE123C] font-mono-numbers">
                        ${formatUSD(cuenta.remainingUSD)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-numbers">
                        Bs {formatBs(cuenta.remainingUSD * bcvRate)}
                      </div>
                    </div>
                  </div>

                  {/* Detail box */}
                  <div className="bg-[#F8FAFC] rounded-xl p-2.5 text-xs text-slate-600 border border-[#DCE4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="truncate max-w-md">
                      <strong className="text-[#0B1528]">Detalle:</strong> {cuenta.description}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
                      <span>Emisión: {new Date(cuenta.date).toLocaleDateString('es-VE')}</span>
                      <span className={isOverdue ? 'text-[#BE123C] font-bold' : ''}>
                        Vence: {new Date(cuenta.dueDate).toLocaleDateString('es-VE')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar of Payments */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1 font-mono-numbers">
                      <span>Abonado: ${formatUSD(cuenta.paidAmountUSD)} de ${formatUSD(cuenta.totalAmountUSD)}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#EEF2F7] rounded-full overflow-hidden">
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
                          className="px-3 py-1.5 rounded-xl bg-[#0B1528] hover:bg-[#152440] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Abonar / Pagar</span>
                        </button>
                      )}

                      {cuenta.abonos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCuenta(selectedCuenta?.id === cuenta.id ? null : cuenta)}
                          className="px-3 py-1.5 rounded-xl bg-[#EEF2F7] hover:bg-[#E2E8F0] text-[#0B1528] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
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
                        className="p-1.5 rounded-xl bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Ver detalle de factura"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCuentaModal(cuenta)}
                        className="p-1.5 rounded-xl bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-[#FFF3E8] hover:text-[#9A4B12] transition-colors cursor-pointer"
                        title="Editar factura"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCuentaPorPagar(cuenta.id)}
                        className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col shadow-2xl border border-[#DCE4F0]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-white/10 text-blue-300 rounded-xl">
                  <Home className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-extrabold text-white text-sm">
                    {editingGasto ? 'Editar Gasto del Mes' : 'Registrar Gasto del Mes'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
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
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrEditGasto} className="p-5 overflow-y-auto space-y-3.5">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Datos Fiscales y Contacto del Proveedor / Emisor
                  </div>
                  {suppliers.length > 0 && (
                    <select
                      value={gastoSupplierId}
                      onChange={(e) => handleSelectGastoSupplier(e.target.value)}
                      className="px-2 py-1 bg-white border border-blue-300 rounded-lg text-[11px] font-bold text-blue-900 focus:outline-none"
                    >
                      <option value="">-- Elegir Proveedor ({suppliers.length}) --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.rif})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre del Proveedor / Persona</label>
                    <input
                      type="text"
                      placeholder="Ej: Papelería El Sol / Juan Pérez"
                      value={gastoSupplierName}
                      onChange={(e) => {
                        setGastoSupplierName(e.target.value);
                        if (gastoSupplierId) setGastoSupplierId('');
                      }}
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
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
          <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#DCE4F0] max-h-[92vh] flex flex-col">
              <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-white/10 text-emerald-300 rounded-xl">
                    <Coins className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-white text-sm">Registrar Abono / Pago de Gasto</h3>
                    <div className="text-[11px] text-slate-300 truncate max-w-[230px]">
                      {gastoForPagar.concept}
                      {gastoForPagar.supplierName ? ` • ${gastoForPagar.supplierName}` : ''}
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsPagarGastoModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">

              {/* Balance Summary */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#DCE4F0] space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Total Original del Gasto:</span>
                  <span className="font-mono-numbers font-bold text-[#0B1528]">${formatUSD(gastoForPagar.amountUSD)}</span>
                </div>
                {paidSoFar > 0 && (
                  <div className="flex justify-between items-center text-[#065F46]">
                    <span>Abonado Previamente:</span>
                    <span className="font-mono-numbers font-bold">- ${formatUSD(paidSoFar)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-[#DCE4F0] flex justify-between items-center">
                  <div>
                    <span className="text-slate-600 font-bold">Saldo Pendiente Restante:</span>
                    <div className="font-mono-numbers font-black text-[#BE123C] text-base">
                      ${formatUSD(remaining)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Equivalente BCV:</span>
                    <div className="font-mono-numbers font-bold text-[#0B1528]">
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
                      className="text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
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
                      className="w-full pl-7 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-sm font-mono-numbers font-black text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {enteredAmount > 0 && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono-numbers">
                      <span className="text-slate-500">Salida en Bs: Bs {formatBs(clampedAmount * bcvRate)}</span>
                      <span className={`font-bold ${willBeFull ? 'text-[#065F46]' : 'text-[#1D4ED8]'}`}>
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
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
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
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nota del Abono / Auditoría</label>
                  <input
                    type="text"
                    placeholder="Ej: Primer abono por compra de resmas y tinta"
                    value={pagarNotes}
                    onChange={(e) => setPagarNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPagarGastoModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-[#EEF2F7] font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enteredAmount <= 0 || enteredAmount > remaining + 0.01}
                    className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
                  >
                    {willBeFull ? 'Confirmar Pago Total' : 'Confirmar Abono Parcial'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: DETALLE COMPLETO DE GASTO (EL OJITO) */}
      {detailGasto && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#DCE4F0] max-h-[90vh] flex flex-col">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-300" />
                <span className="font-bold text-sm">Detalle del Gasto / Insumo</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailGasto(null)}
                className="p-1 rounded-full hover:bg-white/15 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#1D4ED8] bg-[#EBF3FE] px-2.5 py-0.5 rounded-full border border-[#C5DCFC]">
                  {detailGasto.category} • {detailGasto.type === 'eventual' ? 'Eventual' : 'Fijo Mensual'}
                </span>
                <h3 className="text-lg font-black text-[#0B1528] mt-1.5">{detailGasto.concept}</h3>
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

              <div className="bg-[#0B1528] text-white rounded-2xl p-4 space-y-1.5 font-mono-numbers">
                <div className="flex justify-between text-slate-300">
                  <span>Monto Total:</span>
                  <span>${formatUSD(detailGasto.amountUSD)} (Bs. {formatBs(detailGasto.amountBs)})</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Total Abonado:</span>
                  <span>${formatUSD(getGastoPaidUSD(detailGasto))}</span>
                </div>
                <div className="flex justify-between text-rose-300 font-bold pt-1 border-t border-white/15 text-sm">
                  <span>Saldo Pendiente:</span>
                  <span>${formatUSD(getGastoRemainingUSD(detailGasto))}</span>
                </div>
              </div>

              {detailGasto.notes && (
                <div className="p-3 bg-[#FFF3E8] border border-[#F5D3B3] rounded-xl text-[#7C3A0B]">
                  <strong>Observaciones:</strong> {detailGasto.notes}
                </div>
              )}

              {detailGasto.abonos && detailGasto.abonos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700 uppercase text-[10px]">Auditoría de Pagos y Abonos ({detailGasto.abonos.length})</div>
                  <div className="border border-[#DCE4F0] rounded-xl overflow-hidden">
                    {detailGasto.abonos.map(ab => (
                      <div key={ab.id} className="p-2.5 border-b border-[#EEF2F7] last:border-0 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-[#0B1528] uppercase text-[11px]">{ab.paymentMethod.replace('_', ' ')} {ab.reference ? `• Ref: ${ab.reference}` : ''}</div>
                          <div className="text-[10px] text-slate-500">{new Date(ab.date).toLocaleString('es-VE')}</div>
                          {ab.notes && <div className="text-[11px] text-slate-600 italic">{ab.notes}</div>}
                        </div>
                        <div className="text-right font-mono-numbers">
                          <div className="font-bold text-[#065F46]">${formatUSD(ab.amountUSD)}</div>
                          <div className="text-[10px] text-slate-500">Bs. {formatBs(ab.amountBs)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const g = detailGasto;
                    setDetailGasto(null);
                    openEditGastoModal(g);
                  }}
                  className="px-3 py-1.5 bg-white border border-[#DCE4F0] hover:bg-[#EEF2F7] text-[#0B1528] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteGastoOperativo(detailGasto.id);
                    setDetailGasto(null);
                  }}
                  className="px-3 py-1.5 bg-[#FEECEF] border border-[#FBC4CD] hover:bg-rose-100 text-[#BE123C] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailGasto(null)}
                className="px-4 py-1.5 bg-[#0B1528] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE CUENTA POR PAGAR A PROVEEDOR (EL OJITO) */}
      {detailCuenta && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#DCE4F0] max-h-[90vh] flex flex-col">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-300" />
                <span className="font-bold text-sm">Detalle Cuenta por Pagar: {detailCuenta.invoiceNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailCuenta(null)}
                className="p-1 rounded-full hover:bg-white/15 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-black text-[#0B1528]">{detailCuenta.supplierName}</h3>
                <p className="text-slate-500 font-mono">RIF: {detailCuenta.supplierRIF || 'N/A'} {detailCuenta.supplierPhone ? `• Tel: ${detailCuenta.supplierPhone}` : ''}</p>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#DCE4F0] space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">Factura / Control:</span><span className="font-mono font-bold">{detailCuenta.invoiceNumber} / {detailCuenta.controlNumber || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Emisión:</span><span>{new Date(detailCuenta.date).toLocaleDateString('es-VE')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Vencimiento:</span><span className="font-bold">{new Date(detailCuenta.dueDate).toLocaleDateString('es-VE')}</span></div>
                <div className="pt-1 border-t border-[#DCE4F0]"><span className="text-slate-500 block">Descripción:</span><span className="font-semibold text-[#0B1528]">{detailCuenta.description}</span></div>
              </div>

              <div className="bg-[#0B1528] text-white rounded-2xl p-4 space-y-1 font-mono-numbers">
                <div className="flex justify-between"><span>Total Factura:</span><span>${formatUSD(detailCuenta.totalAmountUSD)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>Abonado:</span><span>${formatUSD(detailCuenta.paidAmountUSD)}</span></div>
                <div className="flex justify-between text-rose-300 font-bold pt-1 border-t border-white/15 text-sm"><span>Saldo Restante:</span><span>${formatUSD(detailCuenta.remainingUSD)}</span></div>
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

            <div className="p-3 bg-[#F8FAFC] border-t border-[#DCE4F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const c = detailCuenta;
                    setDetailCuenta(null);
                    openEditCuentaModal(c);
                  }}
                  className="px-3 py-1.5 bg-white border border-[#DCE4F0] hover:bg-[#EEF2F7] text-[#0B1528] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteCuentaPorPagar(detailCuenta.id);
                    setDetailCuenta(null);
                  }}
                  className="px-3 py-1.5 bg-[#FEECEF] border border-[#FBC4CD] hover:bg-rose-100 text-[#BE123C] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailCuenta(null)}
                className="px-4 py-1.5 bg-[#0B1528] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR FACTURA PROVEEDOR */}
      {isAddCuentaModalOpen && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col shadow-2xl border border-[#DCE4F0]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-white/10 text-blue-300 rounded-xl">
                  <Building2 className="w-4 h-4" />
                </span>
                <h3 className="font-extrabold text-white text-sm">
                  {editingCuenta ? 'Editar Factura de Proveedor' : 'Registrar Factura de Proveedor'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsAddCuentaModalOpen(false);
                  setEditingCuenta(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">

            <form onSubmit={handleCreateOrEditCuenta} className="space-y-3.5">
              {suppliers.length > 0 && (
                <div className="bg-[#EBF3FE] border border-[#C5DCFC] rounded-2xl p-3">
                  <label className="block text-[11px] font-extrabold text-[#1D4ED8] mb-1">
                    Seleccionar desde Maestro de Proveedores
                  </label>
                  <select
                    value={newSupplierId}
                    onChange={(e) => handleSelectCuentaSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#93C5FD] rounded-xl text-xs font-bold text-[#0B1528] focus:outline-none"
                  >
                    <option value="">-- Elegir proveedor registrado (o ingresar manualmente abajo) --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.rif}) • {s.creditDays} días crédito
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Proveedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Alimentos Polar, Papelera El Sol..."
                  value={newSupplierName}
                  onChange={(e) => {
                    setNewSupplierName(e.target.value);
                    if (newSupplierId) setNewSupplierId('');
                  }}
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
                >
                  {editingCuenta ? 'Guardar Cambios' : 'Guardar Factura'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ABONO A PROVEEDOR */}
      {isAbonoModalOpen && cuentaForAbono && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#DCE4F0]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-white/10 text-emerald-300 rounded-xl">
                  <Coins className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-extrabold text-white text-sm">Registrar Abono a Proveedor</h3>
                  <div className="text-[11px] text-slate-300 truncate max-w-[220px]">
                    {cuentaForAbono.supplierName} (Factura {cuentaForAbono.invoiceNumber})
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsAbonoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">

            <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0] flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500">Deuda Restante:</span>
                <div className="font-mono-numbers font-black text-[#BE123C] text-base">
                  ${formatUSD(cuentaForAbono.remainingUSD)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500">En Bolívares (BCV):</span>
                <div className="font-mono-numbers font-bold text-[#0B1528]">
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
                    className="w-full pl-7 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono-numbers font-black text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {abonoAmountUSD && !isNaN(parseFloat(abonoAmountUSD)) && (
                  <div className="text-[10px] text-slate-500 font-mono-numbers mt-0.5">
                    Equivalente: Bs {formatBs(parseFloat(abonoAmountUSD) * bcvRate)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago Empleado</label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
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
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nota del Abono</label>
                <input
                  type="text"
                  placeholder="Ej: Pago parcial desde cuenta Banesco comercial"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAbonoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-[#EEF2F7] font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MAESTRO DE PROVEEDORES */}
      {activeSubTab === 'maestro_proveedores' && (
        <div className="space-y-3">
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white/95 rounded-3xl p-8 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] text-center space-y-2">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-[#0B1528]">No hay proveedores registrados en el Maestro</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Centraliza tus distribuidores con su RIF, teléfono, dirección y días de crédito para seleccionarlos con un clic en Compras y Cuentas por Pagar.
              </p>
              <button
                type="button"
                onClick={openNewSupplierModal}
                className="mt-2 px-4 py-2 bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                + Registrar Primer Proveedor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSuppliers.map((sup) => {
                const liveBalanceUSD = getLiveSupplierBalance(sup);
                return (
                  <div
                    key={sup.id}
                    className="bg-white/95 rounded-2xl border border-[#DCE4F0] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:border-[#93C5FD] transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] shrink-0">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-[#0B1528]">{sup.name}</div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0]">
                              {sup.rif || 'Sin RIF'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEF2F7] text-[#0B1528] border border-[#DCE4F0]">
                              {sup.creditDays} días crédito
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Saldo Acumulado</div>
                        <div className={`text-base font-black font-mono-numbers ${liveBalanceUSD > 0 ? 'text-[#BE123C]' : 'text-[#065F46]'}`}>
                          ${formatUSD(liveBalanceUSD)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-numbers">
                          Bs {formatBs(liveBalanceUSD * bcvRate)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#F8FAFC] rounded-xl p-2.5 text-xs text-slate-600 border border-[#DCE4F0] space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        {sup.phone && (
                          <a
                            href={`https://wa.me/58${sup.phone.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#065F46] hover:underline font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> {sup.phone}
                          </a>
                        )}
                        {sup.email && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Mail className="w-3 h-3" /> {sup.email}
                          </span>
                        )}
                      </div>
                      {sup.address && (
                        <div className="flex items-start gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{sup.address}</span>
                        </div>
                      )}
                      {sup.notes && (
                        <div className="text-[11px] italic text-slate-500">{sup.notes}</div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSubTab('proveedores');
                          openNewCuentaModal(sup);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#0B1528] hover:bg-[#152440] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-300" />
                        <span>Cargar Factura</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditSupplierModal(sup)}
                          className="p-1.5 rounded-xl bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-[#EBF3FE] hover:text-[#1D4ED8] cursor-pointer"
                          title="Editar proveedor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {confirmDeleteSupplierId === sup.id ? (
                          <div className="flex items-center gap-1 bg-[#FEECEF] px-2 py-1 rounded-xl border border-[#FBC4CD]">
                            <button
                              type="button"
                              onClick={() => {
                                deleteSupplier(sup.id);
                                setConfirmDeleteSupplierId(null);
                              }}
                              className="text-[11px] font-bold text-[#BE123C] hover:underline cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSupplierId(null)}
                              className="text-[11px] font-semibold text-slate-500 cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSupplierId(sup.id)}
                            className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 cursor-pointer"
                            title="Eliminar proveedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR PROVEEDOR EN MAESTRO */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#DCE4F0]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-300" />
                <h3 className="font-extrabold text-sm">
                  {editingSupplier ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSupplierModalOpen(false);
                  setEditingSupplier(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrEditSupplier} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre / Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Alimentos Polar C.A."
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RIF / Cédula *</label>
                  <input
                    type="text"
                    required
                    placeholder="J-12345678-0"
                    value={supRif}
                    onChange={(e) => setSupRif(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="0414-1234567"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Días de Crédito *</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    required
                    value={supCreditDays}
                    onChange={(e) => setSupCreditDays(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correo (Opcional)</label>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.com"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Fiscal / Despacho</label>
                <input
                  type="text"
                  placeholder="Ej: Zona Industrial Los Montones, Barcelona..."
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas / Condiciones Comerciales</label>
                <textarea
                  rows={2}
                  placeholder="Despacho los martes y jueves, contacto asesor..."
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSupplierModalOpen(false);
                    setEditingSupplier(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
                >
                  {editingSupplier ? 'Guardar Cambios' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
