import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Landmark,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  DollarSign,
  FileText,
  Trash2,
  Coins,
  ChevronDown,
  Edit2,
  Eye,
  X,
  Wallet,
  Banknote,
  Smartphone,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { formatUSD, formatBs, getLocalDateStr, round2, safeDiv } from '../utils/exportUtils';
import { Loan, LoanCashDestination, LoanStatus, PaymentMethod } from '../types';

interface LoansSubTabProps {
  openCreateSignal: number;
}

const DESTINATION_LABELS: Record<LoanCashDestination, string> = {
  efectivo_usd: 'Efectivo en Caja USD',
  efectivo_bs: 'Efectivo en Caja Bs',
  banco_pago_movil: 'Cuenta Bancaria / Pago Móvil',
  externo_dueno: 'Externo / Cuenta del Dueño (No suma a caja)'
};

const DESTINATION_SHORT: Record<LoanCashDestination, string> = {
  efectivo_usd: 'Sumado a Caja USD',
  efectivo_bs: 'Sumado a Caja Bs',
  banco_pago_movil: 'Sumado a Banco / PM',
  externo_dueno: 'Externo / Dueño (Sin caja)'
};

const ABONO_METHOD_LABELS: Record<PaymentMethod | 'externo_dueno', string> = {
  efectivo_usd: 'Efectivo USD (Gaveta)',
  efectivo_bs: 'Efectivo Bs (Gaveta)',
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia Bancaria',
  debito: 'Punto de Débito',
  fiao: 'Fiado',
  cashea: 'Cashea',
  pago_combinado: 'Pago Combinado',
  externo_dueno: 'Externo / Cuenta del Dueño (Sin caja)'
};

export const LoansSubTab: React.FC<LoansSubTabProps> = ({ openCreateSignal }) => {
  const {
    loans,
    addLoan,
    updateLoan,
    deleteLoan,
    addAbonoToLoan,
    bcvRate,
    businessInfo,
    isCashRegisterOpen,
    setIsAperturaModalOpen
  } = useApp();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | LoanStatus>('todos');
  const [destFilter, setDestFilter] = useState<'todos' | LoanCashDestination>('todos');
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Modals state
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Loan Create/Edit form state
  const [lenderName, setLenderName] = useState('');
  const [lenderRIF, setLenderRIF] = useState('');
  const [lenderPhone, setLenderPhone] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [currencyInput, setCurrencyInput] = useState<'USD' | 'Bs'>('USD');
  const [amountInput, setAmountInput] = useState('');
  const [grantDateInput, setGrantDateInput] = useState(getLocalDateStr());
  const [dueDateInput, setDueDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return getLocalDateStr(d);
  });
  const [cashDestination, setCashDestination] = useState<LoanCashDestination>('efectivo_usd');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [notes, setNotes] = useState('');
  const [loanFormError, setLoanFormError] = useState<string | null>(null);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  // Abono modal state
  const [abonoLoan, setAbonoLoan] = useState<Loan | null>(null);
  const [abonoCurrency, setAbonoCurrency] = useState<'USD' | 'Bs'>('USD');
  const [abonoAmountInput, setAbonoAmountInput] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod | 'externo_dueno'>('transferencia');
  const [abonoRef, setAbonoRef] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [abonoError, setAbonoError] = useState<string | null>(null);
  const [isSubmittingAbono, setIsSubmittingAbono] = useState(false);

  // Bank/PM options from businessInfo
  const bankAndPmOptions = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [];
    (businessInfo.bankAccounts || []).forEach(b => {
      list.push({
        id: b.id,
        label: `Banco: ${b.bank} (${b.accountNumber.slice(-4) || b.holderName})`
      });
    });
    (businessInfo.pagoMovilAccounts || []).forEach(pm => {
      list.push({
        id: pm.id,
        label: `Pago Móvil: ${pm.bank} (${pm.phone})`
      });
    });
    return list;
  }, [businessInfo.bankAccounts, businessInfo.pagoMovilAccounts]);

  const todayYMD = getLocalDateStr();

  const getEffectiveStatus = (loan: Loan): LoanStatus => {
    if (loan.status === 'pagado' || (loan.remainingUSD <= 0.009 && loan.remainingBs <= 0.01)) {
      return 'pagado';
    }
    if (loan.dueDate) {
      const dueYMD = getLocalDateStr(new Date(loan.dueDate));
      if (dueYMD < todayYMD) {
        return 'vencido';
      }
    }
    return loan.paidAmountUSD > 0 || loan.paidAmountBs > 0 ? 'parcial' : 'pendiente';
  };

  const getLoanRemainingDisplay = (loan: Loan) => {
    if (loan.enteredCurrency === 'Bs') {
      return {
        primary: `Bs ${formatBs(loan.remainingBs)}`,
        secondary: `≈ $${formatUSD(loan.remainingUSD)}`,
        isBsPrimary: true
      };
    }
    return {
      primary: `$${formatUSD(loan.remainingUSD)}`,
      secondary: `Bs ${formatBs(round2(loan.remainingUSD * bcvRate))}`,
      isBsPrimary: false
    };
  };

  const openCreateModal = () => {
    setEditingLoan(null);
    setLoanFormError(null);
    setIsSubmittingLoan(false);
    setLenderName('');
    setLenderRIF('');
    setLenderPhone('');
    setReference('');
    setDescription('');
    setCurrencyInput('USD');
    setAmountInput('');
    setGrantDateInput(getLocalDateStr());
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDateInput(getLocalDateStr(d));
    setCashDestination('efectivo_usd');
    setSelectedBankId(bankAndPmOptions[0]?.id || '');
    setNotes('');
    setIsLoanModalOpen(true);
  };

  useEffect(() => {
    if (openCreateSignal > 0) {
      openCreateModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateSignal]);

  const openEditModal = (loan: Loan) => {
    setEditingLoan(loan);
    setLoanFormError(null);
    setIsSubmittingLoan(false);
    setLenderName(loan.lenderName);
    setLenderRIF(loan.lenderRIF || '');
    setLenderPhone(loan.lenderPhone || '');
    setReference(loan.reference || '');
    setDescription(loan.description || '');
    setCurrencyInput(loan.enteredCurrency || 'USD');
    setAmountInput(
      loan.enteredCurrency === 'Bs'
        ? loan.originalAmountBs.toFixed(2)
        : loan.originalAmountUSD.toFixed(2)
    );
    setGrantDateInput(loan.grantDate ? getLocalDateStr(new Date(loan.grantDate)) : getLocalDateStr());
    setDueDateInput(loan.dueDate ? getLocalDateStr(new Date(loan.dueDate)) : getLocalDateStr());
    setCashDestination(loan.cashDestination);
    setSelectedBankId(loan.bankAccountId || '');
    setNotes(loan.notes || '');
    setIsLoanModalOpen(true);
  };

  const openAbonoModal = (loan: Loan) => {
    setAbonoLoan(loan);
    const defaultCurr = loan.enteredCurrency === 'Bs' ? 'Bs' : 'USD';
    setAbonoCurrency(defaultCurr);
    setAbonoAmountInput(
      defaultCurr === 'Bs' ? loan.remainingBs.toFixed(2) : loan.remainingUSD.toFixed(2)
    );
    setAbonoMethod(
      loan.cashDestination === 'externo_dueno'
        ? 'externo_dueno'
        : loan.cashDestination === 'efectivo_usd'
          ? 'efectivo_usd'
          : loan.cashDestination === 'efectivo_bs'
            ? 'efectivo_bs'
            : 'transferencia'
    );
    setAbonoRef('');
    setAbonoNotes('');
    setAbonoError(null);
    setIsSubmittingAbono(false);
  };

  // KPIs
  const kpis = useMemo(() => {
    let pendingUSD = 0;
    let pendingBs = 0;
    let paidUSD = 0;
    let paidBs = 0;
    let financedUSD = 0;
    let financedBs = 0;
    let overdueCount = 0;
    let activeCount = 0;
    let settledCount = 0;

    loans.forEach(l => {
      const st = getEffectiveStatus(l);
      financedUSD += l.originalAmountUSD || 0;
      financedBs += l.enteredCurrency === 'Bs' ? (l.originalAmountBs || 0) : round2((l.originalAmountUSD || 0) * bcvRate);
      paidUSD += l.paidAmountUSD || 0;
      paidBs += l.enteredCurrency === 'Bs' ? (l.paidAmountBs || 0) : round2((l.paidAmountUSD || 0) * bcvRate);

      if (st === 'pagado') {
        settledCount += 1;
      } else {
        activeCount += 1;
        pendingUSD += l.remainingUSD || 0;
        pendingBs += l.enteredCurrency === 'Bs' ? (l.remainingBs || 0) : round2((l.remainingUSD || 0) * bcvRate);
        if (st === 'vencido') {
          overdueCount += 1;
        }
      }
    });

    return {
      pendingUSD: round2(pendingUSD),
      pendingBs: round2(pendingBs),
      paidUSD: round2(paidUSD),
      paidBs: round2(paidBs),
      financedUSD: round2(financedUSD),
      financedBs: round2(financedBs),
      overdueCount,
      activeCount,
      settledCount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans, bcvRate, todayYMD]);

  // Filtered loans
  const filteredLoans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return loans.filter(l => {
      const st = getEffectiveStatus(l);
      const matchesSearch =
        !q ||
        (l.lenderName || '').toLowerCase().includes(q) ||
        (l.lenderRIF || '').toLowerCase().includes(q) ||
        (l.reference || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.bankAccountLabel || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'todos' || st === statusFilter;
      const matchesDest = destFilter === 'todos' || l.cashDestination === destFilter;
      return matchesSearch && matchesStatus && matchesDest;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans, searchTerm, statusFilter, destFilter, todayYMD]);

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingLoan) return;

    const cleanLender = lenderName.trim();
    if (!cleanLender) {
      setLoanFormError('El nombre del prestamista o entidad financiera es obligatorio.');
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setLoanFormError('Ingresa un monto válido mayor a cero.');
      return;
    }

    if (!editingLoan && (cashDestination === 'efectivo_usd' || cashDestination === 'efectivo_bs') && !isCashRegisterOpen) {
      setIsAperturaModalOpen(true);
      setLoanFormError('La caja está cerrada. Abre la caja primero para sumar efectivo del préstamo a la gaveta.');
      return;
    }

    const safeRate = bcvRate > 0 ? bcvRate : 1;
    let origUSD = 0;
    let origBs = 0;
    if (currencyInput === 'Bs') {
      origBs = round2(parsedAmount);
      origUSD = round2(safeDiv(origBs, safeRate, 0));
    } else {
      origUSD = round2(parsedAmount);
      origBs = round2(origUSD * safeRate);
    }

    const bankOpt = cashDestination === 'banco_pago_movil'
      ? bankAndPmOptions.find(b => b.id === selectedBankId)
      : undefined;

    // Preserve timestamp accurately for active cash shift comparisons when grantDate === today
    let grantIso: string;
    if (editingLoan) {
      const origYmd = editingLoan.grantDate ? getLocalDateStr(new Date(editingLoan.grantDate)) : '';
      if (grantDateInput === origYmd && editingLoan.grantDate) {
        grantIso = editingLoan.grantDate;
      } else if (grantDateInput === getLocalDateStr()) {
        grantIso = new Date().toISOString();
      } else {
        grantIso = new Date(`${grantDateInput}T12:00:00`).toISOString();
      }
    } else {
      grantIso = grantDateInput === getLocalDateStr()
        ? new Date().toISOString()
        : new Date(`${grantDateInput}T12:00:00`).toISOString();
    }

    const dueIso = dueDateInput
      ? new Date(`${dueDateInput}T12:00:00`).toISOString()
      : grantIso;

    setIsSubmittingLoan(true);
    setLoanFormError(null);
    try {
      if (editingLoan) {
        await updateLoan({
          ...editingLoan,
          lenderName: cleanLender,
          lenderRIF: lenderRIF.trim().toUpperCase() || undefined,
          lenderPhone: lenderPhone.trim() || undefined,
          reference: reference.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
          grantDate: grantIso,
          dueDate: dueIso,
          enteredCurrency: currencyInput,
          originalAmountUSD: origUSD,
          originalAmountBs: origBs,
          bcvRate: editingLoan.bcvRate || safeRate,
          cashDestination,
          bankAccountId: bankOpt?.id,
          bankAccountLabel: bankOpt?.label,
          notes: notes.trim() || undefined
        });
      } else {
        await addLoan({
          lenderName: cleanLender,
          lenderRIF: lenderRIF.trim().toUpperCase() || undefined,
          lenderPhone: lenderPhone.trim() || undefined,
          reference: reference.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
          grantDate: grantIso,
          dueDate: dueIso,
          enteredCurrency: currencyInput,
          originalAmountUSD: origUSD,
          originalAmountBs: origBs,
          bcvRate: safeRate,
          cashDestination,
          bankAccountId: bankOpt?.id,
          bankAccountLabel: bankOpt?.label,
          notes: notes.trim() || undefined
        });
      }
      setEditingLoan(null);
      setIsLoanModalOpen(false);
    } catch (err: any) {
      setLoanFormError(err?.message || 'No se pudo guardar el préstamo en Cloud Firestore.');
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const handleConfirmAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abonoLoan || isSubmittingAbono) return;

    const parsed = parseFloat(abonoAmountInput);
    if (isNaN(parsed) || parsed <= 0) {
      setAbonoError('Ingresa un monto de abono válido mayor a cero.');
      return;
    }

    if ((abonoMethod === 'efectivo_usd' || abonoMethod === 'efectivo_bs') && !isCashRegisterOpen) {
      setIsAperturaModalOpen(true);
      setAbonoError('La caja está cerrada. Abre la caja primero para registrar salidas de efectivo.');
      return;
    }

    setIsSubmittingAbono(true);
    setAbonoError(null);
    try {
      await addAbonoToLoan({
        loanId: abonoLoan.id,
        amount: parsed,
        enteredCurrency: abonoCurrency,
        method: abonoMethod,
        reference: abonoRef.trim() || undefined,
        notes: abonoNotes.trim() || undefined
      });
      setAbonoLoan(null);
    } catch (err: any) {
      setAbonoError(err?.message || 'No se pudo registrar el abono en Cloud Firestore.');
    } finally {
      setIsSubmittingAbono(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!loanToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLoan(loanToDelete.id);
      if (detailLoan?.id === loanToDelete.id) setDetailLoan(null);
      setLoanToDelete(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'No se pudo eliminar el préstamo en Cloud Firestore.');
    } finally {
      setIsDeleting(false);
    }
  };

  const computedPreviewBs = useMemo(() => {
    const v = parseFloat(amountInput);
    if (isNaN(v) || v <= 0) return null;
    if (currencyInput === 'USD') {
      return `≈ Bs ${formatBs(round2(v * bcvRate))}`;
    }
    return `≈ $${formatUSD(round2(safeDiv(v, bcvRate, 0)))}`;
  }, [amountInput, currencyInput, bcvRate]);

  const abonoPreviewOther = useMemo(() => {
    const v = parseFloat(abonoAmountInput);
    if (isNaN(v) || v <= 0) return null;
    if (abonoCurrency === 'USD') {
      return `≈ Bs ${formatBs(round2(v * bcvRate))}`;
    }
    return `≈ $${formatUSD(round2(safeDiv(v, bcvRate, 0)))}`;
  }, [abonoAmountInput, abonoCurrency, bcvRate]);

  return (
    <div className="space-y-4">
      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#FFF3E8] rounded-2xl p-4 border border-[#F5D3B3] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between text-[#D96B27] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Pendiente</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-lg font-black text-[#9A4B12] font-mono-numbers">
            ${formatUSD(kpis.pendingUSD)}
          </div>
          <div className="text-[11px] text-[#7C3A0B] font-mono-numbers">
            Bs {formatBs(kpis.pendingBs)}
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[#BE123C] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Préstamos Vencidos</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-lg font-black text-[#BE123C] font-mono-numbers">
            {kpis.overdueCount}
          </div>
          <div className="text-[11px] text-slate-500">
            {kpis.overdueCount > 0 ? 'Requieren atención' : `${kpis.activeCount} activo(s) al día`}
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl p-4 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[#065F46] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Abonado</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-lg font-black text-[#065F46] font-mono-numbers">
            ${formatUSD(kpis.paidUSD)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-numbers">
            Bs {formatBs(kpis.paidBs)}
          </div>
        </div>

        <div className="bg-gradient-to-b from-white to-[#F4F8FF] rounded-2xl p-4 border border-[#93C5FD] shadow-[0_2px_12px_-4px_rgba(37,99,235,0.1)]">
          <div className="flex items-center justify-between text-[#1D4ED8] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Financiado</span>
            <Landmark className="w-4 h-4" />
          </div>
          <div className="text-lg font-black text-[#0B1528] font-mono-numbers">
            ${formatUSD(kpis.financedUSD)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-numbers">
            {loans.length} registro(s) • {kpis.settledCount} pagado(s)
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-white/95 rounded-2xl p-3 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex flex-col lg:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar préstamo por prestamista, banco, RIF, contrato o concepto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-medium text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={destFilter}
            onChange={(e) => setDestFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-[#F8FAFC] text-[#0B1528] rounded-xl text-xs font-bold border border-[#DCE4F0] focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos los Destinos</option>
            <option value="efectivo_usd">Caja Efectivo USD</option>
            <option value="efectivo_bs">Caja Efectivo Bs</option>
            <option value="banco_pago_movil">Banco / Pago Móvil</option>
            <option value="externo_dueno">Externo / Dueño</option>
          </select>

          <div className="flex flex-wrap items-center gap-1">
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'pendiente', label: 'Pendiente' },
              { id: 'parcial', label: 'Parcial' },
              { id: 'vencido', label: 'Vencido' },
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
        </div>
      </div>

      {/* LOANS LIST */}
      {filteredLoans.length === 0 ? (
        <div className="bg-white/95 rounded-3xl p-8 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] text-center space-y-2">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            No hay créditos o préstamos por pagar registrados
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'todos' || destFilter !== 'todos'
              ? 'No encontramos préstamos que coincidan con los filtros aplicados.'
              : 'Registra financiamientos bancarios, préstamos de socios o terceros, define si el dinero entra a caja o queda externo, y controla cada abono en USD o Bolívares.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            + Registrar Primer Préstamo / Crédito
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLoans.map((loan) => {
            const effectiveStatus = getEffectiveStatus(loan);
            const isPaid = effectiveStatus === 'pagado';
            const isOverdue = effectiveStatus === 'vencido';
            const progress =
              loan.enteredCurrency === 'Bs'
                ? loan.originalAmountBs > 0
                  ? Math.min(100, (loan.paidAmountBs / loan.originalAmountBs) * 100)
                  : 0
                : loan.originalAmountUSD > 0
                  ? Math.min(100, (loan.paidAmountUSD / loan.originalAmountUSD) * 100)
                  : 0;
            const remDisplay = getLoanRemainingDisplay(loan);
            const isExpanded = expandedLoanId === loan.id;

            return (
              <div
                key={loan.id}
                className="bg-white/95 rounded-2xl border border-[#DCE4F0] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:border-[#93C5FD] transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[#EEF2F7] border border-[#DCE4F0] text-[#0B1528] shrink-0 mt-0.5">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[#0B1528]">
                          {loan.lenderName}
                        </span>
                        {loan.lenderRIF && (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[#F8FAFC] rounded border border-[#DCE4F0] text-slate-700">
                            {loan.lenderRIF}
                          </span>
                        )}
                        {loan.reference && (
                          <span className="font-mono text-[11px] font-bold text-[#1D4ED8] bg-[#EBF3FE] px-1.5 py-0.5 rounded border border-[#C5DCFC]">
                            Ref: {loan.reference}
                          </span>
                        )}

                        {isPaid ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7F8EE] text-[#065F46] border border-[#A7E6C4] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> PAGADO
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> VENCIDO
                          </span>
                        ) : effectiveStatus === 'parcial' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FE] text-[#1D4ED8] border border-[#C5DCFC] flex items-center gap-1">
                            <Coins className="w-3 h-3" /> ABONO PARCIAL
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#9A4B12] border border-[#F5D3B3]">
                            PENDIENTE
                          </span>
                        )}

                        {/* Cash Destination Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            loan.cashDestination === 'externo_dueno'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : loan.cashDestination === 'banco_pago_movil'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          <span>
                            {DESTINATION_SHORT[loan.cashDestination]}
                            {loan.bankAccountLabel ? ` (${loan.bankAccountLabel})` : ''}
                          </span>
                        </span>
                      </div>

                      {loan.description && (
                        <p className="text-xs text-slate-700 font-medium">{loan.description}</p>
                      )}

                      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Otorgado: <strong>{new Date(loan.grantDate).toLocaleDateString('es-VE')}</strong>
                        </span>
                        <span>
                          Vence:{' '}
                          <strong className={isOverdue ? 'text-[#BE123C]' : 'text-slate-700'}>
                            {new Date(loan.dueDate).toLocaleDateString('es-VE')}
                          </strong>
                        </span>
                        {loan.lenderPhone && (
                          <a
                            href={`https://wa.me/58${loan.lenderPhone.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#065F46] hover:underline font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> {loan.lenderPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Bimonetary Pending Amount */}
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-[11px] text-slate-400 font-semibold">
                      {isPaid ? 'Préstamo saldado' : 'Saldo pendiente'}
                    </div>
                    <div
                      className={`text-base sm:text-lg font-black font-mono-numbers ${
                        isPaid ? 'text-[#065F46]' : 'text-[#BE123C]'
                      }`}
                    >
                      {isPaid
                        ? loan.enteredCurrency === 'Bs'
                          ? `Bs ${formatBs(loan.originalAmountBs)}`
                          : `$${formatUSD(loan.originalAmountUSD)}`
                        : remDisplay.primary}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-numbers">
                      {isPaid
                        ? loan.enteredCurrency === 'Bs'
                          ? `≈ $${formatUSD(loan.originalAmountUSD)}`
                          : `Bs ${formatBs(loan.originalAmountBs)}`
                        : remDisplay.secondary}
                    </div>
                  </div>
                </div>

                {/* Progress Bar & 3-column Totals */}
                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-[#EEF2F7] rounded-full overflow-hidden border border-[#DCE4F0]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isPaid ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 bg-[#F8FAFC] p-2 rounded-xl border border-[#DCE4F0]">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold">Monto Original</span>
                      <span className="font-bold text-[#0B1528] font-mono-numbers">
                        {loan.enteredCurrency === 'Bs'
                          ? `Bs ${formatBs(loan.originalAmountBs)}`
                          : `$${formatUSD(loan.originalAmountUSD)}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold">Total Abonado</span>
                      <span className="font-bold text-[#065F46] font-mono-numbers">
                        {loan.enteredCurrency === 'Bs'
                          ? `Bs ${formatBs(loan.paidAmountBs)}`
                          : `$${formatUSD(loan.paidAmountUSD)}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] font-semibold">Progreso</span>
                      <span className="font-bold text-[#1D4ED8] font-mono-numbers">
                        {progress.toFixed(0)}% ({(loan.abonos || []).length} abono{(loan.abonos || []).length === 1 ? '' : 's'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                    className="text-xs font-bold text-slate-600 hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180 text-[#1D4ED8]' : ''}`}
                    />
                    <span>Estado de Cuenta / Historial ({(loan.abonos || []).length})</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => openAbonoModal(loan)}
                        className="px-3 py-1.5 rounded-xl bg-[#0B1528] hover:bg-[#152440] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Coins className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Registrar Abono</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDetailLoan(loan)}
                      className="p-1.5 rounded-xl bg-[#F8FAFC] text-slate-600 border border-[#DCE4F0] hover:bg-[#EBF3FE] hover:text-[#1D4ED8] cursor-pointer transition-colors"
                      title="Ver detalle completo"
                      aria-label={`Ver detalle de ${loan.lenderName}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(loan)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] text-slate-700 border border-[#DCE4F0] hover:bg-[#EBF3FE] hover:text-[#1D4ED8] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Editar préstamo"
                      aria-label={`Editar préstamo ${loan.lenderName}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setLoanToDelete(loan);
                      }}
                      className="p-1.5 rounded-xl bg-[#FEECEF] text-[#BE123C] border border-[#FBC4CD] hover:bg-rose-100 cursor-pointer transition-colors"
                      title="Eliminar préstamo"
                      aria-label={`Eliminar préstamo ${loan.lenderName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable Account Statement / Abonos History */}
                {isExpanded && (
                  <div className="pt-2 border-t border-[#DCE4F0] space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Historial de Abonos Aplicados</span>
                      <span className="text-[11px] text-slate-400">
                        Destino inicial: {DESTINATION_LABELS[loan.cashDestination]}
                      </span>
                    </div>

                    {!loan.abonos || loan.abonos.length === 0 ? (
                      <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#DCE4F0] text-center text-xs text-slate-400">
                        Aún no se han registrado abonos para este préstamo.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {loan.abonos.map((ab) => (
                          <div
                            key={ab.id}
                            className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#DCE4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[#0B1528]">
                                  {new Date(ab.date).toLocaleString('es-VE', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#DCE4F0] text-slate-700">
                                  {ABONO_METHOD_LABELS[ab.paymentMethod] || ab.paymentMethod}
                                </span>
                                {ab.reference && (
                                  <span className="font-mono text-[10px] text-[#1D4ED8] font-bold">
                                    Ref: {ab.reference}
                                  </span>
                                )}
                              </div>
                              {ab.notes && <p className="text-[11px] text-slate-500 mt-0.5">{ab.notes}</p>}
                            </div>

                            <div className="text-left sm:text-right font-mono-numbers shrink-0">
                              <div className="font-extrabold text-[#065F46]">
                                {ab.enteredCurrency === 'Bs'
                                  ? `Bs ${formatBs(ab.amountBs)}`
                                  : `$${formatUSD(ab.amountUSD)}`}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {ab.enteredCurrency === 'Bs'
                                  ? `≈ $${formatUSD(ab.amountUSD)} (Tasa ${formatBs(ab.bcvRate)})`
                                  : `Bs ${formatBs(ab.amountBs)} (Tasa ${formatBs(ab.bcvRate)})`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR PRÉSTAMO */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#DCE4F0] my-auto">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-300" />
                <h3 className="font-extrabold text-sm">
                  {editingLoan ? 'Editar Crédito / Préstamo' : 'Registrar Nuevo Crédito o Préstamo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLoanModalOpen(false);
                  setEditingLoan(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prestamista / Banco / Entidad Financiera *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Banco Nacional de Crédito / Socio Carlos Pérez / Cashea"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RIF / Cédula</label>
                  <input
                    type="text"
                    placeholder="J-12345678-0"
                    value={lenderRIF}
                    onChange={(e) => setLenderRIF(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="0414-1234567"
                    value={lenderPhone}
                    onChange={(e) => setLenderPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nro. Contrato / Ref</label>
                  <input
                    type="text"
                    placeholder="CR-0012"
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Concepto / Destino del Financiamiento</label>
                <input
                  type="text"
                  placeholder="Ej: Capital de trabajo para reposición de inventario"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Bimonetary Amount Input */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Monto del Préstamo *</label>
                  <div className="flex bg-white p-0.5 rounded-xl border border-[#DCE4F0]">
                    {(['USD', 'Bs'] as const).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setCurrencyInput(curr)}
                        className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                          currencyInput === curr
                            ? 'bg-[#0B1528] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {curr === 'USD' ? '$ Dólares' : 'Bs Bolívares'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                    {currencyInput === 'USD' ? '$' : 'Bs.'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCE4F0] rounded-xl text-sm font-mono font-extrabold text-[#0B1528] focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Tasa BCV actual: Bs. {formatBs(bcvRate)}</span>
                  <span className="font-bold text-[#1D4ED8]">{computedPreviewBs || '—'}</span>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Otorgamiento *</label>
                  <input
                    type="date"
                    required
                    value={grantDateInput}
                    onChange={(e) => setGrantDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Vencimiento *</label>
                  <input
                    type="date"
                    required
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Mandatory Cash / Money Destination Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Destino Contable del Dinero Recibido *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: 'efectivo_usd' as LoanCashDestination,
                      title: 'Sumar a Caja USD',
                      desc: 'Ingresa a gaveta en dólares',
                      icon: DollarSign,
                      activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    },
                    {
                      id: 'efectivo_bs' as LoanCashDestination,
                      title: 'Sumar a Caja Bs',
                      desc: 'Ingresa a gaveta en bolívares',
                      icon: Banknote,
                      activeClass: 'border-teal-500 bg-teal-50 text-teal-900'
                    },
                    {
                      id: 'banco_pago_movil' as LoanCashDestination,
                      title: 'Sumar a Banco / Pago Móvil',
                      desc: 'Ingresa a cuenta bancaria',
                      icon: Smartphone,
                      activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    },
                    {
                      id: 'externo_dueno' as LoanCashDestination,
                      title: 'No sumar a caja (Externo)',
                      desc: 'Cuenta del dueño / sin caja',
                      icon: ShieldAlert,
                      activeClass: 'border-slate-700 bg-slate-100 text-slate-900'
                    }
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = cashDestination === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCashDestination(opt.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                          isSelected
                            ? `${opt.activeClass} ring-2 ring-blue-500/20`
                            : 'border-[#DCE4F0] bg-[#F8FAFC] hover:bg-white text-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-extrabold">{opt.title}</div>
                          <div className="text-[10px] opacity-80">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {cashDestination === 'banco_pago_movil' && bankAndPmOptions.length > 0 && (
                  <div className="pt-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Cuenta Receptora (Opcional)
                    </label>
                    <select
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Seleccionar cuenta bancaria / Pago Móvil --</option>
                      {bankAndPmOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!editingLoan &&
                  (cashDestination === 'efectivo_usd' || cashDestination === 'efectivo_bs') &&
                  !isCashRegisterOpen && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-semibold flex items-center justify-between gap-2">
                      <span>La caja está cerrada. Debes abrir la caja para ingresar efectivo a la gaveta.</span>
                      <button
                        type="button"
                        onClick={() => setIsAperturaModalOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-[#0B1528] text-white text-[10px] font-bold shrink-0 cursor-pointer"
                      >
                        Abrir Caja
                      </button>
                    </div>
                  )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas / Condiciones</label>
                <textarea
                  rows={2}
                  placeholder="Cuotas acordadas, tasa de interés o comentarios..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {loanFormError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loanFormError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingLoan}
                  onClick={() => {
                    setIsLoanModalOpen(false);
                    setEditingLoan(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLoan}
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
                >
                  {isSubmittingLoan ? 'Guardando...' : editingLoan ? 'Actualizar Préstamo' : 'Guardar Préstamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ABONO A PRÉSTAMO */}
      {abonoLoan && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#DCE4F0]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm">Registrar Abono a Préstamo</h3>
              </div>
              <button
                type="button"
                onClick={() => setAbonoLoan(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAbono} className="p-5 space-y-3.5">
              <div className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-extrabold text-xs text-[#0B1528] truncate">{abonoLoan.lenderName}</div>
                  <div className="text-[11px] text-slate-500">
                    Saldo pendiente actual:
                  </div>
                </div>
                <div className="text-right font-mono-numbers shrink-0">
                  <div className="text-sm font-black text-[#BE123C]">
                    {abonoLoan.enteredCurrency === 'Bs'
                      ? `Bs ${formatBs(abonoLoan.remainingBs)}`
                      : `$${formatUSD(abonoLoan.remainingUSD)}`}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {abonoLoan.enteredCurrency === 'Bs'
                      ? `≈ $${formatUSD(abonoLoan.remainingUSD)}`
                      : `Bs ${formatBs(round2(abonoLoan.remainingUSD * bcvRate))}`}
                  </div>
                </div>
              </div>

              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700">Monto del Abono *</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAbonoAmountInput(
                          abonoCurrency === 'Bs'
                            ? abonoLoan.remainingBs.toFixed(2)
                            : abonoLoan.remainingUSD.toFixed(2)
                        );
                      }}
                      className="text-[10px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
                    >
                      Pagar Saldo Total
                    </button>
                    <div className="flex bg-white p-0.5 rounded-lg border border-[#DCE4F0]">
                      {(['USD', 'Bs'] as const).map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => {
                            setAbonoCurrency(curr);
                            setAbonoAmountInput(
                              curr === 'Bs'
                                ? (abonoLoan.enteredCurrency === 'Bs'
                                    ? abonoLoan.remainingBs.toFixed(2)
                                    : round2(abonoLoan.remainingUSD * bcvRate).toFixed(2))
                                : abonoLoan.remainingUSD.toFixed(2)
                            );
                          }}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer ${
                            abonoCurrency === curr
                              ? 'bg-[#0B1528] text-white'
                              : 'text-slate-600'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                    {abonoCurrency === 'USD' ? '$' : 'Bs.'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={abonoAmountInput}
                    onChange={(e) => setAbonoAmountInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#DCE4F0] rounded-xl text-sm font-mono font-extrabold text-[#0B1528] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span>Tasa BCV: Bs {formatBs(bcvRate)}</span>
                  <span className="font-bold text-[#1D4ED8]">{abonoPreviewOther || '—'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Origen del Pago *</label>
                <select
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-bold text-[#0B1528] focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="transferencia">Transferencia Bancaria (Egreso de negocio)</option>
                  <option value="pago_movil">Pago Móvil (Egreso de negocio)</option>
                  <option value="efectivo_usd">Efectivo USD (Descuenta de gaveta)</option>
                  <option value="efectivo_bs">Efectivo Bs (Descuenta de gaveta)</option>
                  <option value="debito">Punto de Débito</option>
                  <option value="externo_dueno">Pago Externo / Cuenta del Dueño (No afecta caja)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Referencia (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Nro. Ref / Comprobante"
                    value={abonoRef}
                    onChange={(e) => setAbonoRef(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nota (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Cuota #1"
                    value={abonoNotes}
                    onChange={(e) => setAbonoNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {abonoError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{abonoError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingAbono}
                  onClick={() => setAbonoLoan(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAbono}
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-[0_6px_14px_-4px_rgba(37,99,235,0.45)] cursor-pointer"
                >
                  {isSubmittingAbono ? 'Procesando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER DETALLE DEL PRÉSTAMO */}
      {detailLoan && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#DCE4F0]">
            <div className="p-4 bg-[#0B1528] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-300" />
                <h3 className="font-extrabold text-sm">Ficha de Crédito / Préstamo</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailLoan(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Prestamista / Entidad</span>
                <div className="text-base font-black text-[#0B1528]">{detailLoan.lenderName}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {detailLoan.lenderRIF || 'Sin RIF'} • {detailLoan.lenderPhone || 'Sin teléfono'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 bg-[#F8FAFC] p-3 rounded-2xl border border-[#DCE4F0]">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Monto Original</span>
                  <span className="font-extrabold text-[#0B1528] font-mono-numbers">
                    ${formatUSD(detailLoan.originalAmountUSD)} / Bs {formatBs(detailLoan.originalAmountBs)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Saldo Pendiente</span>
                  <span className="font-extrabold text-[#BE123C] font-mono-numbers">
                    ${formatUSD(detailLoan.remainingUSD)} / Bs {formatBs(detailLoan.remainingBs)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Otorgamiento</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(detailLoan.grantDate).toLocaleDateString('es-VE')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Vencimiento</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(detailLoan.dueDate).toLocaleDateString('es-VE')}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Destino Contable</span>
                <div className="p-2.5 rounded-xl bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] font-bold">
                  {DESTINATION_LABELS[detailLoan.cashDestination]}
                  {detailLoan.bankAccountLabel ? ` — ${detailLoan.bankAccountLabel}` : ''}
                </div>
              </div>

              {detailLoan.description && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Concepto</span>
                  <p className="text-slate-700 font-medium">{detailLoan.description}</p>
                </div>
              )}

              {detailLoan.notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Notas</span>
                  <p className="text-slate-600 italic">{detailLoan.notes}</p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailLoan(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN ELIMINAR PRÉSTAMO */}
      {loanToDelete && (
        <div className="fixed inset-0 bg-[#0B1528]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">¿Eliminar préstamo o crédito?</h3>
                <p className="text-[11px] text-slate-500">Se eliminará de Cloud Firestore de forma permanente.</p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#DCE4F0] rounded-xl p-3 text-xs space-y-1">
              <div className="font-extrabold text-[#0B1528]">{loanToDelete.lenderName}</div>
              <div className="text-[11px] font-mono text-slate-600">
                Original: ${formatUSD(loanToDelete.originalAmountUSD)} • Pendiente: ${formatUSD(loanToDelete.remainingUSD)}
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setLoanToDelete(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
