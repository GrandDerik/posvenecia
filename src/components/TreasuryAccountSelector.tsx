import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, Landmark, Wallet, Receipt } from 'lucide-react';
import { PaymentMethod, TreasuryAccount, TreasuryCurrency } from '../types';
import { isBankPaymentMethod } from '../utils/accountingUtils';
import { formatBs, formatUSD, round2 } from '../utils/exportUtils';

export const getActiveBankAccounts = (accounts: TreasuryAccount[]): TreasuryAccount[] =>
  (accounts || []).filter((a) => a.accountType === 'bank' && a.isActive !== false);

export const getDefaultBankAccount = (accounts: TreasuryAccount[]): TreasuryAccount | undefined => {
  const banks = getActiveBankAccounts(accounts);
  return banks.find((b) => b.currency === 'Bs') || banks[0];
};

export const formatTreasuryAccountLabel = (account: TreasuryAccount): string => {
  const aliasPart = account.alias ? ` (${account.alias})` : '';
  const suffix = account.accountNumber ? ` ••••${account.accountNumber.slice(-4)}` : '';
  return `${account.name}${aliasPart}${suffix}`;
};

interface TreasuryAccountSelectorProps {
  paymentMethod: PaymentMethod | 'credito' | 'externo_dueno';
  treasuryAccounts: TreasuryAccount[];
  selectedBankAccountId: string;
  onSelectBankAccount: (accountId: string, accountLabel?: string, currency?: TreasuryCurrency) => void;
  amountUSD: number;
  amountBs: number;
  mode: 'outflow' | 'inflow';
  showBankFee?: boolean;
  bankFeeInput?: string;
  onChangeBankFeeInput?: (value: string) => void;
  isPurchaseInvoice?: boolean;
  compact?: boolean;
}

export const TreasuryAccountSelector: React.FC<TreasuryAccountSelectorProps> = ({
  paymentMethod,
  treasuryAccounts,
  selectedBankAccountId,
  onSelectBankAccount,
  amountUSD,
  amountBs,
  mode,
  showBankFee = false,
  bankFeeInput = '',
  onChangeBankFeeInput,
  isPurchaseInvoice = false,
  compact = false
}) => {
  const bankAccounts = useMemo(() => getActiveBankAccounts(treasuryAccounts), [treasuryAccounts]);
  const isBankMethod =
    paymentMethod !== 'credito' &&
    paymentMethod !== 'externo_dueno' &&
    isBankPaymentMethod(paymentMethod);

  // Auto-select default bank account when switching to a bank payment method
  useEffect(() => {
    if (!isBankMethod || bankAccounts.length === 0) return;
    const exists = bankAccounts.some((b) => b.id === selectedBankAccountId);
    if (!exists) {
      const def = getDefaultBankAccount(treasuryAccounts) || bankAccounts[0];
      if (def) {
        onSelectBankAccount(def.id, formatTreasuryAccountLabel(def), def.currency);
      }
    }
  }, [isBankMethod, bankAccounts, selectedBankAccountId, treasuryAccounts, onSelectBankAccount]);

  if (paymentMethod === 'credito' || paymentMethod === 'externo_dueno' || paymentMethod === 'fiao' || paymentMethod === 'cashea') {
    return null;
  }

  const activeAccount: TreasuryAccount | undefined = (() => {
    if (paymentMethod === 'efectivo_usd') {
      return treasuryAccounts.find((a) => a.id === 'cash_usd');
    }
    if (paymentMethod === 'efectivo_bs') {
      return treasuryAccounts.find((a) => a.id === 'cash_bs');
    }
    if (isBankMethod) {
      return (
        bankAccounts.find((b) => b.id === selectedBankAccountId) ||
        getDefaultBankAccount(treasuryAccounts) ||
        bankAccounts[0]
      );
    }
    return undefined;
  })();

  const nativeCurrency: TreasuryCurrency = activeAccount?.currency || (paymentMethod === 'efectivo_usd' ? 'USD' : 'Bs');
  const currentBalance = round2(activeAccount?.balance ?? 0);
  const operationAmountInAccountCurrency = round2(
    nativeCurrency === 'USD' ? Math.max(0, amountUSD || 0) : Math.max(0, amountBs || 0)
  );
  const parsedFee = isBankMethod && mode === 'outflow' && showBankFee
    ? round2(Math.max(0, parseFloat(bankFeeInput) || 0))
    : 0;
  const totalOutflowInAccountCurrency = round2(operationAmountInAccountCurrency + parsedFee);
  const projectedBalance =
    mode === 'outflow'
      ? round2(currentBalance - totalOutflowInAccountCurrency)
      : round2(currentBalance + operationAmountInAccountCurrency);
  const wouldGoNegative = mode === 'outflow' && activeAccount !== undefined && totalOutflowInAccountCurrency > 0 && projectedBalance < -0.005;

  const formatMoney = (val: number, curr: TreasuryCurrency) =>
    curr === 'USD' ? `$${formatUSD(val)}` : `Bs. ${formatBs(val)}`;

  return (
    <div
      className={`rounded-2xl border ${
        wouldGoNegative
          ? 'bg-amber-50/80 border-amber-300'
          : 'bg-slate-50/90 border-slate-200'
      } ${compact ? 'p-2.5 space-y-2' : 'p-3 space-y-2.5'}`}
    >
      {/* Bank Account Selector when bank payment method is active */}
      {isBankMethod && (
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {mode === 'outflow'
                ? 'Cuenta Bancaria de Origen (Tesorería)'
                : 'Cuenta Bancaria Destino (Tesorería)'}
            </span>
          </label>
          {bankAccounts.length > 0 ? (
            <select
              value={activeAccount?.id || ''}
              onChange={(e) => {
                const found = bankAccounts.find((b) => b.id === e.target.value);
                onSelectBankAccount(
                  e.target.value,
                  found ? formatTreasuryAccountLabel(found) : undefined,
                  found?.currency
                );
              }}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              {bankAccounts.map((bk) => (
                <option key={bk.id} value={bk.id}>
                  {formatTreasuryAccountLabel(bk)} — Saldo: {formatMoney(bk.balance, bk.currency)}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              No hay cuentas bancarias creadas en <strong>Tesorería</strong> todavía. Puedes registrar tus bancos en la pestaña Tesorería para llevar saldos exactos por banco.
            </div>
          )}
        </div>
      )}

      {/* Live Account Balance Bar */}
      {activeAccount && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white px-2.5 py-2 rounded-xl border border-slate-200/90">
          <div className="flex items-center gap-1.5 min-w-0">
            {activeAccount.accountType === 'bank' ? (
              <Landmark className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            ) : (
              <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span className="font-bold text-slate-700 truncate">{activeAccount.name}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
              {nativeCurrency}
            </span>
          </div>
          <div className="font-mono-numbers text-right shrink-0">
            <span className="text-slate-500 mr-1.5">Disponible:</span>
            <span
              className={`font-extrabold ${
                currentBalance < 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {formatMoney(currentBalance, nativeCurrency)}
            </span>
          </div>
        </div>
      )}

      {/* Optional Bank Commission Field on Every Outgoing Bank Transaction */}
      {mode === 'outflow' && showBankFee && isBankMethod && onChangeBankFeeInput && (
        <div className="pt-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              <span>Comisión Bancaria (Opcional)</span>
            </label>
            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
              En {nativeCurrency}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
              {nativeCurrency === 'USD' ? '$' : 'Bs.'}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={bankFeeInput}
              onChange={(e) => onChangeBankFeeInput(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono-numbers font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {parsedFee > 0 && (
            <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 text-[10px] text-indigo-950 space-y-0.5">
              <div className="flex items-center justify-between font-mono-numbers font-bold">
                <span>Débito total en cuenta bancaria:</span>
                <span className="text-indigo-800">
                  {formatMoney(totalOutflowInAccountCurrency, nativeCurrency)}
                </span>
              </div>
              <p className="text-indigo-800/90 leading-snug">
                {isPurchaseInvoice
                  ? 'La comisión se debitará del banco y se registrará como gasto financiero operativo sin alterar el subtotal ni el IVA de la factura en el Libro de Compras.'
                  : 'La comisión se debitará del banco en Tesorería y se registrará automáticamente como gasto financiero operativo (exento de Libro de Compras).'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Insufficient Balance Warning Banner */}
      {wouldGoNegative && activeAccount && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-extrabold">Saldo insuficiente en {activeAccount.name}</div>
            <div className="font-mono-numbers text-[10px] text-rose-800">
              Salida total: <strong>{formatMoney(totalOutflowInAccountCurrency, nativeCurrency)}</strong> • Saldo resultante:{' '}
              <strong className="text-rose-700">{formatMoney(projectedBalance, nativeCurrency)}</strong>
            </div>
            <div className="text-[10px] text-rose-700">
              Puedes continuar si deseas registrar el sobregiro o elegir otra cuenta con fondos disponibles.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
