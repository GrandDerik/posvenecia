import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  TreasuryAccount,
  TreasuryCurrency,
  TreasuryMovement,
  TreasuryMovementType
} from '../types';
import { formatBs, formatUSD, round2 } from '../utils/exportUtils';
import { RecoverManagerPinModal, useManagerPinRecovery } from './Modals/RecoverManagerPinModal';
import {
  Landmark,
  Banknote,
  ArrowLeftRight,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Building2,
  RotateCcw,
  Percent
} from 'lucide-react';

const VENEZUELA_BANKS = [
  '0102 - Banco de Venezuela',
  '0134 - Banesco',
  '0105 - Banco Mercantil',
  '0108 - BBVA Provincial',
  '0191 - BNC (Banco Nacional de Crédito)',
  '0114 - Bancaribe',
  '0172 - Bancamiga',
  '0174 - Banplus',
  '0115 - Banco Exterior',
  '0163 - Banco del Tesoro',
  '0151 - BFC Banco Fondo Común',
  'Zelle / Cuenta USD',
  'Binance / USDT',
  'Otro Banco'
];

const MOVEMENT_TYPE_META: Record<
  TreasuryMovementType,
  { label: string; badgeClass: string }
> = {
  venta: { label: 'Venta POS', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  abono_fiado: { label: 'Abono Fiado', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  compra: { label: 'Compra Mercancía', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
  pago_proveedor: { label: 'Pago Proveedor', badgeClass: 'bg-orange-50 text-orange-800 border-orange-200' },
  gasto_operativo: { label: 'Gasto Operativo', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  comision_bancaria: { label: 'Comisión Bancaria', badgeClass: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  sueldo: { label: 'Sueldo / Nómina', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  retiro_personal: { label: 'Retiro Socio / Dueño', badgeClass: 'bg-purple-50 text-purple-800 border-purple-200' },
  prestamo: { label: 'Préstamo / Crédito', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  transferencia: { label: 'Transferencia / Divisa', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  ajuste_inicial: { label: 'Ajuste de Saldo', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  nota_credito: { label: 'Nota de Crédito', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  anulacion: { label: 'Anulación Venta', badgeClass: 'bg-red-50 text-red-700 border-red-200' }
};

const formatNativeAmount = (amount: number, currency: TreasuryCurrency): string =>
  currency === 'USD' ? `$${formatUSD(amount)}` : `Bs. ${formatBs(amount)}`;

export const TesoreriaView: React.FC = () => {
  const {
    treasuryAccounts,
    treasuryMovements,
    bcvRate,
    verifyManagerPin,
    saveTreasuryAccount,
    deleteTreasuryAccount,
    transferBetweenTreasuryAccounts,
    adjustTreasuryAccountBalance,
    missingRuleCollections
  } = useApp();

  // Ledger filters
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal: Create / Edit Bank Account
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TreasuryAccount | null>(null);
  const [accBankName, setAccBankName] = useState(VENEZUELA_BANKS[0]);
  const [accCustomBank, setAccCustomBank] = useState('');
  const [accAlias, setAccAlias] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [accCurrency, setAccCurrency] = useState<TreasuryCurrency>('Bs');
  const [accInitialBalance, setAccInitialBalance] = useState('');
  const [accIsDefault, setAccIsDefault] = useState(false);
  const [accNotes, setAccNotes] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Modal: Transfer / Currency Exchange
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [trfSourceId, setTrfSourceId] = useState('');
  const [trfDestId, setTrfDestId] = useState('');
  const [trfAmount, setTrfAmount] = useState('');
  const [trfRate, setTrfRate] = useState(bcvRate.toFixed(2));
  const [trfBankFee, setTrfBankFee] = useState('');
  const [trfRef, setTrfRef] = useState('');
  const [trfNotes, setTrfNotes] = useState('');
  const [trfError, setTrfError] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Modal: Manager-PIN Protected Initial Balance Adjustment
  const [adjustTarget, setAdjustTarget] = useState<TreasuryAccount | null>(null);
  const [adjPin, setAdjPin] = useState('');
  const [adjNewBalance, setAdjNewBalance] = useState('');
  const [adjReason, setAdjReason] = useState('Saldo inicial verificado de apertura');
  const [adjSetAsInitial, setAdjSetAsInitial] = useState(true);
  const [adjError, setAdjError] = useState<string | null>(null);
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const pinRecovery = useManagerPinRecovery();

  // Modal: Delete bank account confirmation
  const [deleteTarget, setDeleteTarget] = useState<TreasuryAccount | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const safeBcv = bcvRate > 0 ? bcvRate : 1;

  // Derived account lists
  const cashUsdAccount = useMemo(
    () => treasuryAccounts.find((a) => a.id === 'cash_usd'),
    [treasuryAccounts]
  );
  const cashBsAccount = useMemo(
    () => treasuryAccounts.find((a) => a.id === 'cash_bs'),
    [treasuryAccounts]
  );
  const bankAccounts = useMemo(
    () => treasuryAccounts.filter((a) => a.accountType === 'bank' && a.isActive !== false),
    [treasuryAccounts]
  );

  // Consolidated reference totals (strictly from native balances, never mutating native values)
  const consolidated = useMemo(() => {
    let totalNativeUSD = 0;
    let totalNativeBs = 0;
    treasuryAccounts.forEach((acc) => {
      if (acc.isActive === false) return;
      const bal = round2(Number(acc.balance) || 0);
      if (acc.currency === 'USD') {
        totalNativeUSD = round2(totalNativeUSD + bal);
      } else {
        totalNativeBs = round2(totalNativeBs + bal);
      }
    });
    const totalRefUSD = round2(totalNativeUSD + totalNativeBs / safeBcv);
    const totalRefBs = round2(totalNativeBs + totalNativeUSD * safeBcv);
    return { totalNativeUSD, totalNativeBs, totalRefUSD, totalRefBs };
  }, [treasuryAccounts, safeBcv]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return treasuryMovements.filter((m) => {
      if (selectedAccountId !== 'all' && m.accountId !== selectedAccountId) return false;
      if (selectedType !== 'all' && m.type !== selectedType) return false;
      if (dateFrom) {
        const movYmd = (m.date || '').slice(0, 10);
        if (movYmd < dateFrom) return false;
      }
      if (dateTo) {
        const movYmd = (m.date || '').slice(0, 10);
        if (movYmd > dateTo) return false;
      }
      if (q) {
        const haystack = `${m.concept || ''} ${m.reference || ''} ${m.accountName || ''} ${m.notes || ''} ${m.counterpartyAccountName || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [treasuryMovements, selectedAccountId, selectedType, dateFrom, dateTo, searchTerm]);

  const movementSummary = useMemo(() => {
    let inUSD = 0;
    let inBs = 0;
    let outUSD = 0;
    let outBs = 0;
    let feesUSD = 0;
    let feesBs = 0;

    filteredMovements.forEach((m) => {
      const amt = round2(Number(m.amount) || 0);
      if (m.direction === 'in') {
        if (m.accountCurrency === 'USD') inUSD = round2(inUSD + amt);
        else inBs = round2(inBs + amt);
      } else {
        if (m.accountCurrency === 'USD') outUSD = round2(outUSD + amt);
        else outBs = round2(outBs + amt);
      }
      if (m.type === 'comision_bancaria') {
        if (m.accountCurrency === 'USD') feesUSD = round2(feesUSD + amt);
        else feesBs = round2(feesBs + amt);
      }
    });

    return { inUSD, inBs, outUSD, outBs, feesUSD, feesBs };
  }, [filteredMovements]);

  const openCreateBankModal = () => {
    setEditingAccount(null);
    setAccBankName(VENEZUELA_BANKS[0]);
    setAccCustomBank('');
    setAccAlias('');
    setAccNumber('');
    setAccCurrency('Bs');
    setAccInitialBalance('');
    setAccIsDefault(bankAccounts.length === 0);
    setAccNotes('');
    setIsAccountModalOpen(true);
  };

  const openEditBankModal = (acc: TreasuryAccount) => {
    setEditingAccount(acc);
    const presetMatch = VENEZUELA_BANKS.find((b) => b === acc.bankName || b === acc.name);
    if (presetMatch) {
      setAccBankName(presetMatch);
      setAccCustomBank('');
    } else {
      setAccBankName('Otro Banco');
      setAccCustomBank(acc.bankName || acc.name);
    }
    setAccAlias(acc.alias || '');
    setAccNumber(acc.accountNumber || '');
    setAccCurrency(acc.currency);
    setAccInitialBalance(String(acc.balance ?? 0));
    setAccIsDefault(Boolean(acc.isDefault));
    setAccNotes(acc.notes || '');
    setIsAccountModalOpen(true);
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBank = accBankName === 'Otro Banco' ? accCustomBank.trim() : accBankName;
    if (!resolvedBank) return;

    setIsSavingAccount(true);
    try {
      const displayName = accAlias.trim() ? `${resolvedBank} (${accAlias.trim()})` : resolvedBank;
      const initBal = editingAccount
        ? editingAccount.balance
        : round2(Math.max(0, parseFloat(accInitialBalance) || 0));

      const id = editingAccount
        ? editingAccount.id
        : `bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      await saveTreasuryAccount(
        {
          id,
          name: displayName,
          bankName: resolvedBank,
          alias: accAlias.trim() || undefined,
          accountNumber: accNumber.trim() || undefined,
          accountType: 'bank',
          currency: editingAccount ? editingAccount.currency : accCurrency,
          balance: initBal,
          initialBalance: editingAccount ? editingAccount.initialBalance : initBal,
          isSystemCash: false,
          isDefault: accIsDefault,
          isActive: true,
          notes: accNotes.trim() || undefined,
          createdAt: editingAccount?.createdAt
        },
        { recordInitialMovement: !editingAccount && initBal > 0 }
      );
      setIsAccountModalOpen(false);
    } finally {
      setIsSavingAccount(false);
    }
  };

  const openTransferModal = () => {
    const first = treasuryAccounts[0]?.id || 'cash_usd';
    const second = treasuryAccounts.find((a) => a.id !== first)?.id || 'cash_bs';
    setTrfSourceId(first);
    setTrfDestId(second);
    setTrfAmount('');
    setTrfRate(bcvRate.toFixed(2));
    setTrfBankFee('');
    setTrfRef('');
    setTrfNotes('');
    setTrfError(null);
    setIsTransferModalOpen(true);
  };

  const trfSourceAcc = treasuryAccounts.find((a) => a.id === trfSourceId);
  const trfDestAcc = treasuryAccounts.find((a) => a.id === trfDestId);
  const trfIsFx = Boolean(trfSourceAcc && trfDestAcc && trfSourceAcc.currency !== trfDestAcc.currency);
  const trfNumericAmt = parseFloat(trfAmount) || 0;
  const trfNumericRate = parseFloat(trfRate) || safeBcv;
  const trfNumericFee = trfSourceAcc?.accountType === 'bank' ? Math.max(0, parseFloat(trfBankFee) || 0) : 0;
  const trfTotalSourceDebit = round2(trfNumericAmt + trfNumericFee);
  const trfWouldGoNegative = Boolean(trfSourceAcc && trfTotalSourceDebit > (trfSourceAcc.balance || 0) + 0.001);

  const trfDestPreview = useMemo(() => {
    if (!(trfNumericAmt > 0) || !trfSourceAcc || !trfDestAcc) return 0;
    if (trfSourceAcc.currency === trfDestAcc.currency) return round2(trfNumericAmt);
    const rate = trfNumericRate > 0 ? trfNumericRate : safeBcv;
    if (!(rate > 0)) return 0;
    return trfSourceAcc.currency === 'USD'
      ? round2(trfNumericAmt * rate)
      : round2(trfNumericAmt / rate);
  }, [trfNumericAmt, trfSourceAcc, trfDestAcc, trfNumericRate, safeBcv]);

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrfError(null);
    if (!trfSourceId || !trfDestId || trfSourceId === trfDestId) {
      setTrfError('Selecciona una cuenta de origen y otra de destino distintas.');
      return;
    }
    if (!(trfNumericAmt > 0)) {
      setTrfError('Ingresa un monto mayor a cero.');
      return;
    }
    if (trfIsFx && !(trfNumericRate > 0)) {
      setTrfError('Ingresa una tasa de cambio válida.');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await transferBetweenTreasuryAccounts({
        sourceAccountId: trfSourceId,
        destinationAccountId: trfDestId,
        sourceAmount: trfNumericAmt,
        exchangeRate: trfIsFx ? trfNumericRate : undefined,
        bankFeeAmount: trfNumericFee > 0 ? trfNumericFee : undefined,
        reference: trfRef.trim() || undefined,
        notes: trfNotes.trim() || undefined
      });
      setIsTransferModalOpen(false);
    } catch (err: any) {
      setTrfError(err?.message || 'No se pudo completar la transferencia.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const openAdjustModal = (acc: TreasuryAccount) => {
    setAdjustTarget(acc);
    setAdjPin('');
    setAdjNewBalance(String(round2(acc.balance || 0)));
    setAdjReason('Ajuste de Saldo Inicial / Conciliación de Gerencia');
    setAdjSetAsInitial(true);
    setAdjError(null);
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || isSubmittingAdjust) return;
    setAdjError(null);

    const parsedBal = parseFloat(adjNewBalance);
    if (isNaN(parsedBal)) {
      setAdjError('Ingresa un monto numérico válido para el nuevo saldo.');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const isValidPin = await verifyManagerPin(adjPin);
      if (!isValidPin) {
        setAdjError('Clave de Gerente incorrecta. Verifica el PIN configurado en Mi Perfil.');
        return;
      }

      await adjustTreasuryAccountBalance({
        accountId: adjustTarget.id,
        newBalance: round2(parsedBal),
        reason: adjReason.trim() || 'Ajuste de Saldo Inicial',
        setAsInitialBalance: adjSetAsInitial
      });
      setAdjustTarget(null);
    } catch (err: any) {
      setAdjError(err?.message || 'Error al ajustar el saldo.');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteTarget) return;
    setIsDeletingAccount(true);
    try {
      await deleteTreasuryAccount(deleteTarget.id);
      if (selectedAccountId === deleteTarget.id) setSelectedAccountId('all');
      setDeleteTarget(null);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const hasActiveFilters =
    selectedAccountId !== 'all' || selectedType !== 'all' || Boolean(dateFrom) || Boolean(dateTo) || Boolean(searchTerm.trim());

  const treasuryRulesMissing =
    missingRuleCollections.includes('bankAccounts') || missingRuleCollections.includes('treasuryMovements');

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      {/* Header & Primary Actions */}
      <div className="bg-white rounded-2xl border border-[#DCE4F0] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-[#0B1528] tracking-tight">
                Estado de Cuenta / Tesorería
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Disponibilidad real en vivo de efectivo y bancos, sincronizada atómicamente con ventas, compras, gastos, sueldos, retiros y comisiones.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openTransferModal}
              disabled={treasuryAccounts.length < 2}
              className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              <span>Transferir / Divisas</span>
            </button>
            <button
              type="button"
              onClick={openCreateBankModal}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#0B1528] border border-[#DCE4F0] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Nueva Cuenta Bancaria</span>
            </button>
          </div>
        </div>

        {/* Consolidated Reference Strip */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#0B1528] text-white p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Consolidado Referencial ($ USD)
            </span>
            <div className="text-2xl font-extrabold font-mono-numbers tracking-tight mt-1">
              ${formatUSD(consolidated.totalRefUSD)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 font-mono-numbers">
              Nativo $: ${formatUSD(consolidated.totalNativeUSD)} · Nativo Bs: Bs. {formatBs(consolidated.totalNativeBs)}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-[#DCE4F0] p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Consolidado Referencial (Bs)
            </span>
            <div className="text-2xl font-extrabold font-mono-numbers text-[#0B1528] tracking-tight mt-1">
              Bs. {formatBs(consolidated.totalRefBs)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 font-mono-numbers">
              Calculado a tasa BCV activa: Bs. {formatBs(safeBcv)} / $
            </span>
          </div>

          <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Integridad Contable Nativa</span>
            </div>
            <p className="text-[11px] text-blue-900/80 leading-relaxed mt-1">
              Cada cuenta conserva su saldo exacto en su moneda nativa (USD o Bs) sin conversiones dobles. Las comisiones bancarias se debitan aparte sin alterar el Libro de Compras SENIAT.
            </p>
          </div>
        </div>
      </div>

      {treasuryRulesMissing && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold">Permisos de Firestore pendientes para Tesorería</p>
            <p className="text-amber-800 mt-0.5">
              Publica el archivo <code className="font-mono font-bold">firestore.rules</code> del repositorio en Firebase Console (<strong>Reglas → Publicar</strong>) o mediante <code className="font-mono font-bold">firebase deploy --only firestore:rules</code> y luego pulsa <strong>Reintentar</strong> para activar las colecciones <code className="font-mono font-bold">bankAccounts</code> y <code className="font-mono font-bold">treasuryMovements</code>.
            </p>
          </div>
        </div>
      )}

      {/* Live Availability Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#0B1528] tracking-tight flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-600" />
            <span>Disponibilidad Real por Cuenta ({treasuryAccounts.length})</span>
          </h2>
          {selectedAccountId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedAccountId('all')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Mostrar extracto de todas las cuentas
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Efectivo USD */}
          {cashUsdAccount && (
            <div
              onClick={() =>
                setSelectedAccountId((prev) => (prev === cashUsdAccount.id ? 'all' : cashUsdAccount.id))
              }
              className={`rounded-2xl bg-white border p-4 transition-all cursor-pointer ${
                selectedAccountId === cashUsdAccount.id
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-[#DCE4F0] hover:border-emerald-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Banknote className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-[#0B1528] truncate">
                      Efectivo en Caja ($ USD)
                    </div>
                    <div className="text-[11px] text-slate-500">Gaveta principal · Divisas</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  USD
                </span>
              </div>

              <div className="mt-4">
                <div
                  className={`text-2xl font-extrabold font-mono-numbers tracking-tight ${
                    cashUsdAccount.balance < 0 ? 'text-rose-600' : 'text-[#0B1528]'
                  }`}
                >
                  ${formatUSD(cashUsdAccount.balance)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono-numbers mt-0.5">
                  Ref. BCV: Bs. {formatBs(round2(cashUsdAccount.balance * safeBcv))}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400">
                  Inicial: ${formatUSD(cashUsdAccount.initialBalance || 0)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAdjustModal(cashUsdAccount);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Ajustar Saldo</span>
                </button>
              </div>
            </div>
          )}

          {/* Efectivo Bs */}
          {cashBsAccount && (
            <div
              onClick={() =>
                setSelectedAccountId((prev) => (prev === cashBsAccount.id ? 'all' : cashBsAccount.id))
              }
              className={`rounded-2xl bg-white border p-4 transition-all cursor-pointer ${
                selectedAccountId === cashBsAccount.id
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-[#DCE4F0] hover:border-blue-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                    <Banknote className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-[#0B1528] truncate">
                      Efectivo en Caja (Bs)
                    </div>
                    <div className="text-[11px] text-slate-500">Gaveta principal · Bolívares</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  Bs
                </span>
              </div>

              <div className="mt-4">
                <div
                  className={`text-2xl font-extrabold font-mono-numbers tracking-tight ${
                    cashBsAccount.balance < 0 ? 'text-rose-600' : 'text-[#0B1528]'
                  }`}
                >
                  Bs. {formatBs(cashBsAccount.balance)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono-numbers mt-0.5">
                  Ref. BCV: ${formatUSD(round2(cashBsAccount.balance / safeBcv))}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400">
                  Inicial: Bs. {formatBs(cashBsAccount.initialBalance || 0)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAdjustModal(cashBsAccount);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Ajustar Saldo</span>
                </button>
              </div>
            </div>
          )}

          {/* Individual Bank Accounts */}
          {bankAccounts.map((acc) => {
            const isSelected = selectedAccountId === acc.id;
            const isNeg = (acc.balance || 0) < 0;
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId((prev) => (prev === acc.id ? 'all' : acc.id))}
                className={`rounded-2xl bg-white border p-4 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                    : isNeg
                    ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400 shadow-2xs'
                    : 'border-[#DCE4F0] hover:border-indigo-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#0B1528] truncate" title={acc.name}>
                        {acc.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate font-mono-numbers">
                        {acc.accountNumber ? acc.accountNumber : acc.alias || 'Cuenta Bancaria'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {acc.isDefault && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                        Principal
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                        acc.currency === 'USD'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {acc.currency}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <div
                    className={`text-2xl font-extrabold font-mono-numbers tracking-tight ${
                      isNeg ? 'text-rose-600' : 'text-[#0B1528]'
                    }`}
                  >
                    {formatNativeAmount(acc.balance, acc.currency)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-numbers mt-0.5">
                    {acc.currency === 'USD'
                      ? `Ref. BCV: Bs. ${formatBs(round2(acc.balance * safeBcv))}`
                      : `Ref. BCV: $${formatUSD(round2(acc.balance / safeBcv))}`}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAdjustModal(acc);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>Ajustar</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditBankModal(acc);
                      }}
                      title="Editar cuenta bancaria"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(acc);
                      }}
                      title="Eliminar cuenta bancaria"
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Detailed Movements Ledger */}
      <section className="bg-white rounded-2xl border border-[#DCE4F0] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0B1528] tracking-tight">
                Extracto Detallado de Movimientos
              </h2>
              <p className="text-xs text-slate-500">
                Mostrando {filteredMovements.length} de {treasuryMovements.length} movimientos registrados en tiempo real.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId('all');
                  setSelectedType('all');
                  setDateFrom('');
                  setDateTo('');
                  setSearchTerm('');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar concepto o ref..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 bg-slate-50/60"
              />
            </div>

            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="all">Todas las cuentas</option>
                {treasuryAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="all">Todos los tipos</option>
              {(Object.keys(MOVEMENT_TYPE_META) as TreasuryMovementType[]).map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_META[t].label}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Fecha desde"
              className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Fecha hasta"
              className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Filtered KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-bold text-emerald-900">Entradas (+)</span>
              </div>
              <div className="text-right font-mono-numbers">
                <div className="text-xs font-extrabold text-emerald-800">${formatUSD(movementSummary.inUSD)}</div>
                <div className="text-[11px] font-bold text-emerald-700">Bs. {formatBs(movementSummary.inBs)}</div>
              </div>
            </div>

            <div className="rounded-xl bg-rose-50/70 border border-rose-200/80 px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span className="text-[11px] font-bold text-rose-900">Salidas (-)</span>
              </div>
              <div className="text-right font-mono-numbers">
                <div className="text-xs font-extrabold text-rose-800">${formatUSD(movementSummary.outUSD)}</div>
                <div className="text-[11px] font-bold text-rose-700">Bs. {formatBs(movementSummary.outBs)}</div>
              </div>
            </div>

            <div className="rounded-xl bg-fuchsia-50/70 border border-fuchsia-200/80 px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-fuchsia-700" />
                <span className="text-[11px] font-bold text-fuchsia-950">Comisiones Bancarias</span>
              </div>
              <div className="text-right font-mono-numbers">
                <div className="text-xs font-extrabold text-fuchsia-800">${formatUSD(movementSummary.feesUSD)}</div>
                <div className="text-[11px] font-bold text-fuchsia-700">Bs. {formatBs(movementSummary.feesBs)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        {filteredMovements.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Landmark className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">
              No hay movimientos registrados para este filtro
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cada venta, abono de fiado, compra pagada, gasto operativo, sueldo, retiro, comisión bancaria o transferencia aparecerá aquí automáticamente con su saldo posterior exacto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#DCE4F0] text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Fecha / Hora</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Cuenta</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Tipo</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Concepto</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Referencia</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Entrada (+)</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Salida (-)</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Saldo Posterior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMovements.map((m: TreasuryMovement) => {
                  const meta = MOVEMENT_TYPE_META[m.type] || {
                    label: m.type,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
                  };
                  const dt = new Date(m.date);
                  const dateLabel = isNaN(dt.getTime())
                    ? m.date
                    : dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' });
                  const timeLabel = isNaN(dt.getTime())
                    ? ''
                    : dt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-mono-numbers text-[11px] text-slate-600">
                        <div className="font-bold text-slate-800">{dateLabel}</div>
                        <div className="text-[10px] text-slate-400">{timeLabel}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-[#0B1528] text-xs max-w-[170px] truncate" title={m.accountName}>
                          {m.accountName}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">{m.accountCurrency}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 leading-snug">{m.concept}</div>
                        {m.exchangeRateUsed && (
                          <div className="text-[10px] font-mono-numbers text-blue-600 font-bold mt-0.5">
                            Tasa cambio aplicada: Bs. {formatBs(m.exchangeRateUsed)}
                          </div>
                        )}
                        {m.notes && (
                          <div className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                            {m.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono-numbers text-[11px] text-slate-600">
                        {m.reference || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono-numbers font-extrabold text-emerald-600">
                        {m.direction === 'in' ? `+${formatNativeAmount(m.amount, m.accountCurrency)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono-numbers font-extrabold text-rose-600">
                        {m.direction === 'out' ? `-${formatNativeAmount(m.amount, m.accountCurrency)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono-numbers">
                        <span
                          className={`font-extrabold ${
                            m.balanceAfter < 0 ? 'text-rose-600' : 'text-[#0B1528]'
                          }`}
                        >
                          {formatNativeAmount(m.balanceAfter, m.accountCurrency)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL 1: Add / Edit Bank Account */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DCE4F0] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-[#0B1528]">
                  {editingAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Banco / Entidad Financiera *
                </label>
                <select
                  value={accBankName}
                  onChange={(e) => setAccBankName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                >
                  {VENEZUELA_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {accBankName === 'Otro Banco' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre del Banco o Plataforma *
                  </label>
                  <input
                    type="text"
                    required
                    value={accCustomBank}
                    onChange={(e) => setAccCustomBank(e.target.value)}
                    placeholder="Ej: Banco Plaza, PayPal, Cuenta USD..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alias / Etiqueta (Opcional)
                  </label>
                  <input
                    type="text"
                    value={accAlias}
                    onChange={(e) => setAccAlias(e.target.value)}
                    placeholder="Ej: Cuenta Jurídica, Pago Móvil"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Moneda Nativa *
                  </label>
                  <select
                    value={accCurrency}
                    disabled={Boolean(editingAccount)}
                    onChange={(e) => setAccCurrency(e.target.value as TreasuryCurrency)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-bold text-slate-800 bg-white disabled:bg-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Bs">Bolívares (Bs)</option>
                    <option value="USD">Dólares ($ USD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    N° de Cuenta / Teléfono PM
                  </label>
                  <input
                    type="text"
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    placeholder="0102-0000-... o 0414-..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-mono-numbers focus:outline-none focus:border-blue-500"
                  />
                </div>

                {!editingAccount && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Saldo Inicial ({accCurrency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={accInitialBalance}
                      onChange={(e) => setAccInitialBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-mono-numbers font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accIsDefault}
                  onChange={(e) => setAccIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Establecer como cuenta bancaria predeterminada para cobros en POS</span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  value={accNotes}
                  onChange={(e) => setAccNotes(e.target.value)}
                  placeholder="Titular, uso exclusivo de punto de venta, etc."
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE4F0] text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
                >
                  {isSavingAccount ? 'Guardando...' : editingAccount ? 'Guardar Cambios' : 'Registrar Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Internal Transfer / Currency Exchange */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DCE4F0] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-[#0B1528]">
                  Transferir entre Cuentas / Cambio de Divisa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cuenta de Origen (Sale dinero) *
                  </label>
                  <select
                    value={trfSourceId}
                    onChange={(e) => setTrfSourceId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  >
                    {treasuryAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatNativeAmount(a.balance, a.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cuenta de Destino (Entra dinero) *
                  </label>
                  <select
                    value={trfDestId}
                    onChange={(e) => setTrfDestId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  >
                    {treasuryAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatNativeAmount(a.balance, a.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto a Transferir ({trfSourceAcc?.currency || 'Bs'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={trfAmount}
                    onChange={(e) => setTrfAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-mono-numbers font-extrabold focus:outline-none focus:border-blue-500"
                  />
                </div>

                {trfIsFx && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tasa de Cambio (Bs / $) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={trfRate}
                      onChange={(e) => setTrfRate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-blue-300 bg-blue-50/40 text-sm font-mono-numbers font-extrabold text-blue-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {trfDestAcc && trfNumericAmt > 0 && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900">
                    {trfIsFx ? 'Recibe por Cambio de Divisa:' : 'Recibe en cuenta destino:'}
                  </span>
                  <span className="font-extrabold font-mono-numbers text-blue-700 text-sm">
                    {formatNativeAmount(trfDestPreview, trfDestAcc.currency)}
                  </span>
                </div>
              )}

              {/* Optional Comisión Bancaria when source is a bank account */}
              {trfSourceAcc?.accountType === 'bank' && (
                <div className="rounded-xl bg-fuchsia-50/60 border border-fuchsia-200 p-3 space-y-1.5">
                  <label className="block text-xs font-extrabold text-fuchsia-950">
                    Comisión Bancaria (Opcional — en {trfSourceAcc.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={trfBankFee}
                    onChange={(e) => setTrfBankFee(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-fuchsia-200 bg-white text-sm font-mono-numbers font-bold focus:outline-none focus:border-fuchsia-500"
                  />
                  <p className="text-[11px] text-fuchsia-900/80 leading-snug">
                    Se debita adicionalmente de <strong>{trfSourceAcc.name}</strong> y se registra como gasto financiero operativo sin afectar el Libro de Compras.
                  </p>
                </div>
              )}

              {trfWouldGoNegative && trfSourceAcc && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 flex items-start gap-2 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">Saldo insuficiente en {trfSourceAcc.name}</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 font-mono-numbers">
                      Disponible: {formatNativeAmount(trfSourceAcc.balance, trfSourceAcc.currency)} · Total salida:{' '}
                      {formatNativeAmount(trfTotalSourceDebit, trfSourceAcc.currency)} → Saldo quedaría en{' '}
                      {formatNativeAmount(round2(trfSourceAcc.balance - trfTotalSourceDebit), trfSourceAcc.currency)}.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Referencia (Opcional)
                  </label>
                  <input
                    type="text"
                    value={trfRef}
                    onChange={(e) => setTrfRef(e.target.value)}
                    placeholder="N° operación / depósito"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-mono-numbers focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observaciones (Opcional)
                  </label>
                  <input
                    type="text"
                    value={trfNotes}
                    onChange={(e) => setTrfNotes(e.target.value)}
                    placeholder="Ej: Depósito bancario, compra divisas"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {trfError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {trfError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE4F0] text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
                >
                  {isSubmittingTransfer ? 'Procesando...' : 'Confirmar Transferencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manager-PIN Protected Initial Balance Adjustment */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DCE4F0] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-extrabold text-[#0B1528]">
                  Ajuste de Saldo Inicial
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-[#DCE4F0] p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-[#0B1528]">{adjustTarget.name}</div>
                  <div className="text-[11px] text-slate-500">Saldo actual registrado</div>
                </div>
                <div className="text-sm font-extrabold font-mono-numbers text-[#0B1528]">
                  {formatNativeAmount(adjustTarget.balance, adjustTarget.currency)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nuevo Saldo Exacto ({adjustTarget.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjNewBalance}
                  onChange={(e) => setAdjNewBalance(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DCE4F0] text-sm font-mono-numbers font-extrabold focus:outline-none focus:border-blue-500"
                />
                {!isNaN(parseFloat(adjNewBalance)) && (
                  <div className="text-[11px] font-mono-numbers mt-1 text-slate-500">
                    Diferencia auditada:{' '}
                    <strong
                      className={
                        parseFloat(adjNewBalance) - adjustTarget.balance >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }
                    >
                      {parseFloat(adjNewBalance) - adjustTarget.balance >= 0 ? '+' : '-'}
                      {formatNativeAmount(
                        Math.abs(round2(parseFloat(adjNewBalance) - adjustTarget.balance)),
                        adjustTarget.currency
                      )}
                    </strong>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo / Justificación *
                </label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Ej: Saldo inicial real en banco al iniciar módulo"
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE4F0] text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adjSetAsInitial}
                  onChange={(e) => setAdjSetAsInitial(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Guardar también como Saldo Inicial de referencia</span>
              </label>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Clave de Gerente (PIN de autorización) *
                </label>
                <input
                  type="password"
                  required
                  value={adjPin}
                  onChange={(e) => setAdjPin(e.target.value)}
                  placeholder="Ingresa tu PIN de Gerente"
                  className="w-full px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50/40 text-sm font-mono-numbers font-bold focus:outline-none focus:border-amber-500"
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    disabled={isSubmittingAdjust}
                    onClick={() => void pinRecovery.startRecovery()}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    ¿Olvidaste tu clave de gerente?
                  </button>
                </div>
              </div>

              {adjError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {adjError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE4F0] text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingAdjust ? 'Aplicando...' : 'Autorizar y Ajustar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RecoverManagerPinModal
        isOpen={pinRecovery.isRecoveryOpen}
        step={pinRecovery.recoveryStep}
        error={pinRecovery.recoveryError}
        verifiedEmail={pinRecovery.verifiedEmail}
        isReauthenticating={pinRecovery.isReauthenticating}
        onRetryReauth={() => void pinRecovery.retryReauth()}
        onRequireReauth={() => pinRecovery.setRecoveryStep('verifying')}
        onClose={pinRecovery.closeRecovery}
        onMarkSuccess={() => pinRecovery.setRecoveryStep('success')}
        onSuccess={() => {
          setAdjPin('');
          setAdjError(null);
        }}
      />

      {/* MODAL 4: Confirm Delete Bank Account */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DCE4F0] shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0B1528]">Eliminar cuenta bancaria</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  ¿Seguro que deseas eliminar <strong>{deleteTarget.name}</strong>? El historial de movimientos ya registrados se conservará en el extracto por auditoría.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#DCE4F0] text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
              >
                {isDeletingAccount ? 'Eliminando...' : 'Eliminar Cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
