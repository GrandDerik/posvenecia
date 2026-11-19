import {
  Abono,
  BankInitialBalance,
  CreditNote,
  Expense,
  GastoOperativoCategory,
  Loan,
  Sale
} from '../types';
import { round2 } from './exportUtils';

export const OWNER_SALARY_CATEGORY: GastoOperativoCategory = 'Sueldo Propietario / Nómina';
export const OWNER_WITHDRAWAL_CATEGORY: GastoOperativoCategory = 'Retiro Personal / Adelanto Dueño';
export const BANK_COMMISSION_CATEGORY: GastoOperativoCategory = 'Comisión Bancaria';

export const isBankCommissionCategory = (category?: string): boolean => {
  if (!category) return false;
  const norm = category.trim().toLowerCase();
  return (
    norm === 'comisión bancaria' ||
    norm === 'comision bancaria' ||
    norm === 'comisiones bancarias'
  );
};

export const isOwnerWithdrawalCategory = (category?: string): boolean => {
  if (!category) return false;
  const norm = category.trim().toLowerCase();
  return (
    norm === 'retiro personal / adelanto dueño' ||
    norm === 'retiro personal / adelanto dueno' ||
    norm === 'retiro personal' ||
    norm === 'adelanto dueño' ||
    norm === 'adelanto socio'
  );
};

export const isOwnerSalaryCategory = (category?: string): boolean => {
  if (!category) return false;
  const norm = category.trim().toLowerCase();
  return (
    norm === 'sueldo propietario / nómina' ||
    norm === 'sueldo propietario / nomina' ||
    norm === 'sueldo propietario' ||
    norm === 'nómina' ||
    norm === 'nomina'
  );
};

export const isNonFiscalPersonalOrSalaryCategory = (category?: string): boolean =>
  isOwnerWithdrawalCategory(category) || isOwnerSalaryCategory(category);

export const getExpenseAccountingType = (
  category?: string
): 'operating_expense' | 'owner_salary' | 'owner_withdrawal' => {
  if (isOwnerWithdrawalCategory(category)) return 'owner_withdrawal';
  if (isOwnerSalaryCategory(category)) return 'owner_salary';
  return 'operating_expense';
};

export const isExpenseOwnerWithdrawal = (
  exp: Pick<Expense, 'category' | 'accountingType'>
): boolean => {
  return exp.accountingType === 'owner_withdrawal' || isOwnerWithdrawalCategory(exp.category);
};

export const isExpenseOwnerSalary = (
  exp: Pick<Expense, 'category' | 'accountingType'>
): boolean => {
  return exp.accountingType === 'owner_salary' || isOwnerSalaryCategory(exp.category);
};

/**
 * Aislamiento Fiscal SENIAT:
 * Garantiza que Sueldo Propietario / Nómina, Retiro Personal / Adelanto Dueño
 * y Comisión Bancaria jamás entren en el Libro de Compras ni generen IVA o retenciones.
 */
export const isExpenseExcludedFromLibroCompras = (
  exp: Pick<Expense, 'category' | 'excludeFromLibroCompras' | 'accountingType'>
): boolean => {
  if (exp.excludeFromLibroCompras === true) return true;
  if (exp.accountingType === 'owner_withdrawal' || exp.accountingType === 'owner_salary') return true;
  if (isBankCommissionCategory(exp.category)) return true;
  return isNonFiscalPersonalOrSalaryCategory(exp.category);
};

export const mapGastoCategoryToExpenseCategory = (
  cat: GastoOperativoCategory
): Expense['category'] => {
  if (cat === 'Sueldo Propietario / Nómina') return 'Sueldo Propietario / Nómina';
  if (cat === 'Retiro Personal / Adelanto Dueño') return 'Retiro Personal / Adelanto Dueño';
  if (cat === 'Comisión Bancaria') return 'Comisión Bancaria';
  if (cat === 'Alquiler' || cat === 'Servicios' || cat === 'Nómina' || cat === 'Mantenimiento') {
    return cat;
  }
  if (cat === 'Insumos / Papelería' || cat === 'Papelería') {
    return 'Mercancía';
  }
  return 'Otros';
};

export const isBankPaymentMethod = (method?: string): boolean => {
  return method === 'pago_movil' || method === 'transferencia' || method === 'debito';
};

export interface ShiftBankTraceSummary {
  bankId: string;
  bankName: string;
  accountNumber: string;
  initialBalanceBs: number;
  initialBalanceUSD: number;
  inflowsBs: number;
  outflowsBs: number;
  outflowsUSD: number;
  ownerSalaryBs: number;
  ownerSalaryUSD: number;
  ownerWithdrawalsBs: number;
  ownerWithdrawalsUSD: number;
  expectedBalanceBs: number;
  expectedBalanceUSD: number;
}

const normalizeBankToken = (val?: string): string =>
  (val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const matchBankAccountIndex = (
  banks: BankInitialBalance[],
  bankAccountId?: string,
  bankLabelOrName?: string
): number => {
  if (banks.length === 0) return -1;
  if (bankAccountId) {
    const byId = banks.findIndex((b) => b.bankId === bankAccountId);
    if (byId >= 0) return byId;
  }
  if (bankLabelOrName) {
    const token = normalizeBankToken(bankLabelOrName);
    if (token.length >= 3) {
      const byName = banks.findIndex((b) => {
        const bTok = normalizeBankToken(b.bankName);
        const accTok = normalizeBankToken(b.accountNumber);
        return (bTok && (token.includes(bTok) || bTok.includes(token))) || (accTok.length >= 4 && token.includes(accTok.slice(-4)));
      });
      if (byName >= 0) return byName;
    }
  }
  // If only one bank is configured in the shift, attribute unlabelled bank movements to it
  if (banks.length === 1) return 0;
  return 0;
};

/**
 * Calcula trazabilidad por cuenta bancaria en el turno activo:
 * descuenta exactamente los pagos bancarios (sueldos, retiros, compras y reembolsos NC)
 * y suma los ingresos bancarios (ventas, abonos y préstamos depositados en banco).
 */
export const computeShiftBankSummaries = (
  initialBanks: BankInitialBalance[] | undefined,
  shiftSales: Sale[],
  shiftExpenses: Expense[],
  shiftCreditNotes: CreditNote[],
  shiftFiadoAbonos: Abono[],
  shiftLoans: Loan[]
): ShiftBankTraceSummary[] => {
  if (!initialBanks || initialBanks.length === 0) return [];

  const summaries: ShiftBankTraceSummary[] = initialBanks.map((b) => ({
    bankId: b.bankId,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
    initialBalanceBs: round2(b.initialBalanceBs || 0),
    initialBalanceUSD: round2(b.initialBalanceUSD || 0),
    inflowsBs: 0,
    outflowsBs: 0,
    outflowsUSD: 0,
    ownerSalaryBs: 0,
    ownerSalaryUSD: 0,
    ownerWithdrawalsBs: 0,
    ownerWithdrawalsUSD: 0,
    expectedBalanceBs: round2(b.initialBalanceBs || 0),
    expectedBalanceUSD: round2(b.initialBalanceUSD || 0)
  }));

  // 1. Bank inflows from sales
  shiftSales.forEach((s) => {
    if (s.paymentMethod === 'pago_movil') {
      const idx = matchBankAccountIndex(initialBanks, undefined, s.paymentDetails?.pagoMovilBank);
      if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + s.totalBs);
    } else if (s.paymentMethod === 'debito') {
      const idx = matchBankAccountIndex(initialBanks, undefined, s.paymentDetails?.debitoBank);
      if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + s.totalBs);
    } else if (s.paymentMethod === 'transferencia') {
      const idx = matchBankAccountIndex(initialBanks, undefined, s.paymentDetails?.transferenciaBank);
      if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + s.totalBs);
    } else if (s.paymentMethod === 'pago_combinado' && s.paymentDetails?.combinedBreakdown) {
      const cb = s.paymentDetails.combinedBreakdown;
      if ((cb.pagoMovil || 0) > 0) {
        const idx = matchBankAccountIndex(initialBanks, undefined, cb.pagoMovilBank);
        if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + (cb.pagoMovil || 0));
      }
      if ((cb.debito || 0) > 0) {
        const idx = matchBankAccountIndex(initialBanks, undefined, cb.debitoBank);
        if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + (cb.debito || 0));
      }
      if ((cb.transferencia || 0) > 0) {
        const idx = matchBankAccountIndex(initialBanks, undefined, cb.transferenciaBank);
        if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + (cb.transferencia || 0));
      }
    }
  });

  // 2. Bank inflows from fiado abonos
  shiftFiadoAbonos.forEach((a) => {
    if (isBankPaymentMethod(a.paymentMethod)) {
      const idx = matchBankAccountIndex(initialBanks, a.bankAccountId, a.bankAccountLabel);
      if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + a.amountBs);
    }
  });

  // 3. Bank inflows from loans
  shiftLoans.forEach((l) => {
    if (l.cashDestination === 'banco_pago_movil') {
      const idx = matchBankAccountIndex(initialBanks, l.bankAccountId, l.bankAccountLabel);
      if (idx >= 0) summaries[idx].inflowsBs = round2(summaries[idx].inflowsBs + l.originalAmountBs);
    }
  });

  // 4. Bank outflows from expenses (including Sueldo Propietario & Retiros Personales)
  shiftExpenses.forEach((e) => {
    if (!isBankPaymentMethod(e.paymentMethod)) return;
    const idx = matchBankAccountIndex(initialBanks, e.bankAccountId, e.bankAccountLabel);
    if (idx < 0) return;

    const target = summaries[idx];
    const isWithdrawal = isExpenseOwnerWithdrawal(e);
    const isSalary = isExpenseOwnerSalary(e);

    // Deduct from USD bank balance ONLY if entered in USD and that bank account tracks a USD balance with zero Bs balance
    const debitFromUsdAccount =
      e.enteredCurrency === 'USD' && target.initialBalanceUSD > 0 && target.initialBalanceBs <= 0;

    if (debitFromUsdAccount) {
      target.outflowsUSD = round2(target.outflowsUSD + e.amountUSD);
      if (isSalary) target.ownerSalaryUSD = round2(target.ownerSalaryUSD + e.amountUSD);
      if (isWithdrawal) target.ownerWithdrawalsUSD = round2(target.ownerWithdrawalsUSD + e.amountUSD);
    } else {
      target.outflowsBs = round2(target.outflowsBs + e.amountBs);
      if (isSalary) target.ownerSalaryBs = round2(target.ownerSalaryBs + e.amountBs);
      if (isWithdrawal) target.ownerWithdrawalsBs = round2(target.ownerWithdrawalsBs + e.amountBs);
    }
  });

  // 5. Bank refunds from credit notes
  shiftCreditNotes.forEach((cn) => {
    if (isBankPaymentMethod(cn.refundMethod)) {
      const idx = matchBankAccountIndex(initialBanks);
      if (idx >= 0) summaries[idx].outflowsBs = round2(summaries[idx].outflowsBs + cn.totalBs);
    }
  });

  summaries.forEach((s) => {
    s.expectedBalanceBs = round2(s.initialBalanceBs + s.inflowsBs - s.outflowsBs);
    s.expectedBalanceUSD = round2(s.initialBalanceUSD - s.outflowsUSD);
  });

  return summaries;
};
