import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Expense, CashShift, CuentaPorPagar, GastoOperativo } from '../types';

// Helper to format currency
export const formatBs = (val: number) => {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

export const formatUSD = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

// 1. Export Libro de Ventas to Excel (.xlsx) - SENIAT Standard Format
export const exportLibroVentasExcel = (sales: Sale[], businessInfo: { name: string; rif: string }) => {
  const data = sales.map((sale, index) => ({
    'N° Operación': index + 1,
    'Fecha': new Date(sale.date).toLocaleDateString('es-VE'),
    'N° Factura': sale.invoiceNumber,
    'N° Control': sale.controlNumber,
    'RIF / Cédula': sale.clientRIF,
    'Nombre / Razón Social': sale.clientName,
    'Tasa BCV': sale.bcvRate.toFixed(2),
    'Total Ventas con IVA (Bs)': Number(sale.totalBs.toFixed(2)),
    'Ventas Exentas (Bs)': Number(sale.exemptBs.toFixed(2)),
    'Base Imponible (Bs)': Number(sale.taxableBs.toFixed(2)),
    '% Alícuota': '16%',
    'Impuesto IVA (Bs)': Number(sale.ivaBs.toFixed(2)),
    'IGTF 3% (Bs)': Number(sale.igtfBs.toFixed(2)),
    'Total USD': Number(sale.totalUSD.toFixed(2)),
    'Método Pago': sale.paymentMethod.replace('_', ' ').toUpperCase(),
    'Estatus': sale.status.toUpperCase()
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Libro de Ventas');
  
  // Header title in sheet
  XLSX.writeFile(workbook, `Libro_de_Ventas_SENIAT_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// 2. Export Libro de Ventas to PDF - Formato Oficial SENIAT
export const exportLibroVentasPDF = (sales: Sale[], businessInfo: { name: string; rif: string }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  // Header Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA - SENIAT', 14, 12);
  doc.setFontSize(11);
  doc.text('LIBRO DE VENTAS Y REGISTRO DE OPERACIONES FISCALES', 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Razón Social: ${businessInfo.name} | RIF: ${businessInfo.rif}`, 14, 23);
  doc.text(`Período Fiscal: ${new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })} | Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`, 14, 28);

  const tableData = sales.map((sale, index) => [
    (index + 1).toString(),
    new Date(sale.date).toLocaleDateString('es-VE'),
    sale.invoiceNumber,
    sale.controlNumber,
    sale.clientRIF,
    sale.clientName.substring(0, 22),
    formatBs(sale.totalBs),
    formatBs(sale.exemptBs),
    formatBs(sale.taxableBs),
    '16%',
    formatBs(sale.ivaBs),
    formatBs(sale.igtfBs),
    formatUSD(sale.totalUSD)
  ]);

  // Calculate totals
  const totalBs = sales.reduce((acc, s) => acc + s.totalBs, 0);
  const totalExemptBs = sales.reduce((acc, s) => acc + s.exemptBs, 0);
  const totalTaxableBs = sales.reduce((acc, s) => acc + s.taxableBs, 0);
  const totalIvaBs = sales.reduce((acc, s) => acc + s.ivaBs, 0);
  const totalIgtfBs = sales.reduce((acc, s) => acc + s.igtfBs, 0);
  const totalUSD = sales.reduce((acc, s) => acc + s.totalUSD, 0);

  autoTable(doc, {
    startY: 32,
    head: [[
      'Op', 'Fecha', 'Factura', 'Control', 'RIF/CI', 'Cliente', 
      'Total Bs', 'Exento Bs', 'Base Imp. Bs', 'Alic.', 'IVA Bs', 'IGTF Bs', 'Total $'
    ]],
    body: tableData,
    foot: [[
      'TOTALES', '', '', '', '', '',
      formatBs(totalBs),
      formatBs(totalExemptBs),
      formatBs(totalTaxableBs),
      '',
      formatBs(totalIvaBs),
      formatBs(totalIgtfBs),
      formatUSD(totalUSD)
    ]],
    styles: { fontSize: 7.5, cellPadding: 1.5, halign: 'right' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: 'center', fontStyle: 'bold' },
    footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'right' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'left', cellWidth: 20 },
      5: { halign: 'left', cellWidth: 38 },
      9: { halign: 'center', cellWidth: 12 },
    }
  });

  doc.save(`Libro_de_Ventas_SENIAT_${new Date().toISOString().split('T')[0]}.pdf`);
};

// 3. Export Libro de Compras to Excel (.xlsx)
export const exportLibroComprasExcel = (expenses: Expense[], businessInfo: { name: string; rif: string }) => {
  const data = expenses.map((exp, index) => ({
    'N° Operación': index + 1,
    'Fecha': new Date(exp.date).toLocaleDateString('es-VE'),
    'N° Factura': exp.invoiceNumber,
    'N° Control': exp.controlNumber,
    'RIF Proveedor': exp.supplierRIF,
    'Nombre Proveedor': exp.supplierName,
    'Concepto / Categoría': exp.category,
    'Tasa BCV': exp.bcvRate.toFixed(2),
    'Base Imponible (Bs)': Number(exp.baseImponibleBs.toFixed(2)),
    'IVA Crédito Fiscal (Bs)': Number(exp.ivaBs.toFixed(2)),
    'Retención IVA 75% (Bs)': Number(exp.retencionIVABs.toFixed(2)),
    'Retención ISLR (Bs)': Number(exp.retencionISLRBs.toFixed(2)),
    'Total Factura (Bs)': Number(exp.amountBs.toFixed(2)),
    'Total USD': Number(exp.amountUSD.toFixed(2)),
    'Método de Pago': exp.paymentMethod.replace('_', ' ').toUpperCase()
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Libro de Compras');
  XLSX.writeFile(workbook, `Libro_de_Compras_SENIAT_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// 4. Export Libro de Compras to PDF
export const exportLibroComprasPDF = (expenses: Expense[], businessInfo: { name: string; rif: string }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA - SENIAT', 14, 12);
  doc.setFontSize(11);
  doc.text('LIBRO DE COMPRAS Y GASTOS (CRÉDITO FISCAL)', 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Contribuyente: ${businessInfo.name} | RIF: ${businessInfo.rif}`, 14, 23);
  doc.text(`Período: ${new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}`, 14, 28);

  const tableData = expenses.map((exp, index) => [
    (index + 1).toString(),
    new Date(exp.date).toLocaleDateString('es-VE'),
    exp.invoiceNumber,
    exp.controlNumber,
    exp.supplierRIF,
    exp.supplierName.substring(0, 24),
    exp.category,
    formatBs(exp.baseImponibleBs),
    formatBs(exp.ivaBs),
    formatBs(exp.retencionIVABs),
    formatBs(exp.retencionISLRBs),
    formatBs(exp.amountBs),
    formatUSD(exp.amountUSD)
  ]);

  const totalBase = expenses.reduce((acc, e) => acc + e.baseImponibleBs, 0);
  const totalIva = expenses.reduce((acc, e) => acc + e.ivaBs, 0);
  const totalRetIva = expenses.reduce((acc, e) => acc + e.retencionIVABs, 0);
  const totalRetIslr = expenses.reduce((acc, e) => acc + e.retencionISLRBs, 0);
  const totalBs = expenses.reduce((acc, e) => acc + e.amountBs, 0);
  const totalUSD = expenses.reduce((acc, e) => acc + e.amountUSD, 0);

  autoTable(doc, {
    startY: 32,
    head: [[
      'Op', 'Fecha', 'Factura', 'Control', 'RIF Prov.', 'Proveedor', 'Categoría',
      'Base Imp. Bs', 'IVA Crédito', 'Ret. IVA 75%', 'Ret. ISLR', 'Total Bs', 'Total $'
    ]],
    body: tableData,
    foot: [[
      'TOTALES', '', '', '', '', '', '',
      formatBs(totalBase),
      formatBs(totalIva),
      formatBs(totalRetIva),
      formatBs(totalRetIslr),
      formatBs(totalBs),
      formatUSD(totalUSD)
    ]],
    styles: { fontSize: 7.5, cellPadding: 1.5, halign: 'right' },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, halign: 'center', fontStyle: 'bold' },
    footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'right' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 18 },
      4: { halign: 'left', cellWidth: 22 },
      5: { halign: 'left', cellWidth: 36 },
      6: { halign: 'left', cellWidth: 22 }
    }
  });

  doc.save(`Libro_de_Compras_SENIAT_${new Date().toISOString().split('T')[0]}.pdf`);
};

// 5. Export Estado de Cuenta y Balance to Excel
export const exportEstadoCuentaExcel = (
  summary: {
    ventasTotalBs: number;
    ventasTotalUSD: number;
    gastosTotalBs: number;
    gastosTotalUSD: number;
    netoBs: number;
    netoUSD: number;
    igtfBs: number;
    igtfUSD: number;
    metodosVentas: Record<string, { usd: number; bs: number }>;
    bcvRate: number;
  },
  businessInfo: { name: string; rif: string }
) => {
  const data = [
    { Concepto: 'Empresa', Valor: businessInfo.name },
    { Concepto: 'RIF', Valor: businessInfo.rif },
    { Concepto: 'Tasa BCV del Día', Valor: `${summary.bcvRate} Bs/USD` },
    { Concepto: 'Fecha de Corte', Valor: new Date().toLocaleDateString('es-VE') },
    { Concepto: '---', Valor: '---' },
    { Concepto: 'Total Ingresos por Ventas (USD)', Valor: summary.ventasTotalUSD },
    { Concepto: 'Total Ingresos por Ventas (Bs)', Valor: summary.ventasTotalBs },
    { Concepto: 'Total Egresos / Compras (USD)', Valor: summary.gastosTotalUSD },
    { Concepto: 'Total Egresos / Compras (Bs)', Valor: summary.gastosTotalBs },
    { Concepto: 'BALANCE NETO (USD)', Valor: summary.netoUSD },
    { Concepto: 'BALANCE NETO (Bs)', Valor: summary.netoBs },
    { Concepto: 'IGTF 3% Percibido en Divisas (USD)', Valor: summary.igtfUSD },
    { Concepto: 'IGTF 3% Percibido en Divisas (Bs)', Valor: summary.igtfBs },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Balance General');
  XLSX.writeFile(wb, `Estado_de_Cuenta_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// 6. Export Estado de Cuenta y Balance to PDF
export const exportEstadoCuentaPDF = (
  summary: {
    ventasTotalBs: number;
    ventasTotalUSD: number;
    gastosTotalBs: number;
    gastosTotalUSD: number;
    netoBs: number;
    netoUSD: number;
    igtfBs: number;
    igtfUSD: number;
    metodosVentas: Record<string, { usd: number; bs: number }>;
    bcvRate: number;
  },
  businessInfo: { name: string; rif: string }
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA Y BALANCE DEL NEGOCIO', 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${businessInfo.name} | RIF: ${businessInfo.rif}`, 14, 21);
  doc.text(`Tasa Oficial BCV: Bs. ${summary.bcvRate.toFixed(2)} / USD`, 14, 26);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleString('es-VE')}`, 14, 31);

  // Table with balances
  const tableData = [
    ['Ingresos Totales por Ventas', `$ ${formatUSD(summary.ventasTotalUSD)}`, `Bs. ${formatBs(summary.ventasTotalBs)}`],
    ['Egresos / Gastos y Compras', `$ ${formatUSD(summary.gastosTotalUSD)}`, `Bs. ${formatBs(summary.gastosTotalBs)}`],
    ['Saldo Neto en Operaciones', `$ ${formatUSD(summary.netoUSD)}`, `Bs. ${formatBs(summary.netoBs)}`],
    ['Retención IGTF 3% (Divisas Cobradas)', `$ ${formatUSD(summary.igtfUSD)}`, `Bs. ${formatBs(summary.igtfBs)}`]
  ];

  autoTable(doc, {
    startY: 37,
    head: [['Flujo de Caja Principal', 'Monto en Divisas (USD)', 'Equivalente Oficial (Bs)']],
    body: tableData,
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  // Table by payment methods
  const methodsData = Object.entries(summary.metodosVentas).map(([method, amounts]) => [
    method.replace('_', ' ').toUpperCase(),
    `$ ${formatUSD(amounts.usd)}`,
    `Bs. ${formatBs(amounts.bs)}`
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [['Desglose de Ventas por Método de Pago', 'Monto (USD)', 'Monto (Bs)']],
    body: methodsData,
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 2.5 },
  });

  doc.save(`Estado_de_Cuenta_${new Date().toISOString().split('T')[0]}.pdf`);
};

// 7. Export Individual Cierre de Caja to Excel (.xlsx)
export const exportCierreCajaExcel = (
  shift: CashShift,
  businessInfo: { name: string; rif: string }
) => {
  const summaryData = [
    { Concepto: 'Comercio', Detalle: businessInfo.name },
    { Concepto: 'RIF', Detalle: businessInfo.rif },
    { Concepto: 'Identificador Turno', Detalle: shift.id },
    { Concepto: 'Fecha y Hora de Apertura', Detalle: shift.openedDateFormatted || shift.openedAt },
    { Concepto: 'Fecha y Hora de Cierre', Detalle: shift.closedDateFormatted || shift.closedAt || 'En curso' },
    { Concepto: 'Responsable / Cajero', Detalle: shift.closedBy || shift.openedBy || 'Administrador' },
    { Concepto: 'Fondo Inicial Efectivo (USD)', Detalle: Number(shift.initialCashUSD.toFixed(2)) },
    { Concepto: 'Fondo Inicial Efectivo (Bs)', Detalle: Number(shift.initialCashBs.toFixed(2)) },
    { Concepto: 'Total Ventas del Turno (USD)', Detalle: Number((shift.totalSalesUSD || 0).toFixed(2)) },
    { Concepto: 'Total Ventas del Turno (Bs)', Detalle: Number((shift.totalSalesBs || 0).toFixed(2)) },
    { Concepto: 'Transacciones Completadas', Detalle: shift.transactionsCount || 0 },
    { Concepto: 'Total Gastos del Turno (USD)', Detalle: Number((shift.totalExpensesUSD || 0).toFixed(2)) },
    { Concepto: 'Total Gastos del Turno (Bs)', Detalle: Number((shift.totalExpensesBs || 0).toFixed(2)) },
    { Concepto: 'Efectivo Esperado en Caja (USD)', Detalle: Number((shift.expectedCashUSD || 0).toFixed(2)) },
    { Concepto: 'Efectivo Esperado en Caja (Bs)', Detalle: Number((shift.expectedCashBs || 0).toFixed(2)) },
    { Concepto: 'Efectivo Físico Contado (USD)', Detalle: Number((shift.countedCashUSD || 0).toFixed(2)) },
    { Concepto: 'Efectivo Físico Contado (Bs)', Detalle: Number((shift.countedCashBs || 0).toFixed(2)) },
    { Concepto: 'Diferencia / Descuadre (USD)', Detalle: Number((shift.differenceUSD || 0).toFixed(2)) },
    { Concepto: 'Diferencia / Descuadre (Bs)', Detalle: Number((shift.differenceBs || 0).toFixed(2)) },
    { Concepto: 'Observaciones de Cierre', Detalle: shift.closedNotes || 'Sin observaciones' }
  ];

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Cierre');

  // If bank balances exist, add sheet
  if (shift.initialBanks && shift.initialBanks.length > 0) {
    const bankData = shift.initialBanks.map(b => ({
      'Banco': b.bankName,
      'N° Cuenta': b.accountNumber,
      'Saldo Apertura (Bs)': Number(b.initialBalanceBs.toFixed(2)),
      'Saldo Apertura (USD)': Number((b.initialBalanceUSD || 0).toFixed(2)),
      'Saldo Contado (Bs)': Number((b.countedBalanceBs || b.initialBalanceBs).toFixed(2)),
      'Saldo Contado (USD)': Number((b.countedBalanceUSD || b.initialBalanceUSD || 0).toFixed(2))
    }));
    const wsBanks = XLSX.utils.json_to_sheet(bankData);
    XLSX.utils.book_append_sheet(wb, wsBanks, 'Cuentas Bancarias');
  }

  // If sales breakdown exists, add sheet
  if (shift.salesBreakdown && Object.keys(shift.salesBreakdown).length > 0) {
    const methodData = Object.entries(shift.salesBreakdown).map(([method, amounts]) => ({
      'Forma de Pago': method.replace('_', ' ').toUpperCase(),
      'Monto en Divisas (USD)': Number(amounts.usd.toFixed(2)),
      'Monto en Bolívares (Bs)': Number(amounts.bs.toFixed(2))
    }));
    const wsMethods = XLSX.utils.json_to_sheet(methodData);
    XLSX.utils.book_append_sheet(wb, wsMethods, 'Ventas por Medio de Pago');
  }

  const dateStr = (shift.closedAt || shift.openedAt).split('T')[0];
  XLSX.writeFile(wb, `Cierre_Caja_${dateStr}_${shift.id}.xlsx`);
};

// 8. Export Individual Cierre de Caja to PDF
export const exportCierreCajaPDF = (
  shift: CashShift,
  businessInfo: { name: string; rif: string; address?: string },
  bcvRate: number
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  // Header Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ACTA FISCAL DE CIERRE Y ARQUEO DE CAJA DIARIA', 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${businessInfo.name} | RIF: ${businessInfo.rif}`, 14, 21);
  if (businessInfo.address) {
    doc.text(`Dirección: ${businessInfo.address.substring(0, 75)}`, 14, 26);
  }
  doc.text(`Apertura: ${shift.openedDateFormatted || shift.openedAt} | Cierre: ${shift.closedDateFormatted || shift.closedAt || 'En curso'}`, 14, 31);
  doc.text(`Responsable / Cajero: ${shift.closedBy || shift.openedBy || 'Administrador'} | Tasa BCV: Bs. ${bcvRate.toFixed(2)}`, 14, 36);

  // Table 1: Efectivo y Arqueo
  const diffUSD = shift.differenceUSD || 0;
  const diffBs = shift.differenceBs || 0;
  const diffStatus = Math.abs(diffUSD) < 0.01 && Math.abs(diffBs) < 0.05 
    ? 'CUADRE EXACTO' 
    : diffUSD > 0 ? `SOBRANTE (+$${formatUSD(diffUSD)})` : `FALTANTE (-$${formatUSD(Math.abs(diffUSD))})`;

  const arqueoTable = [
    ['Fondo Inicial Apertura', `$ ${formatUSD(shift.initialCashUSD)}`, `Bs. ${formatBs(shift.initialCashBs)}`],
    ['Total Ventas Registradas en Turno', `$ ${formatUSD(shift.totalSalesUSD || 0)}`, `Bs. ${formatBs(shift.totalSalesBs || 0)}`],
    ['Total Gastos Pagados en Efectivo', `$ ${formatUSD(shift.totalExpensesUSD || 0)}`, `Bs. ${formatBs(shift.totalExpensesBs || 0)}`],
    ['Efectivo Teórico Esperado en Caja', `$ ${formatUSD(shift.expectedCashUSD || 0)}`, `Bs. ${formatBs(shift.expectedCashBs || 0)}`],
    ['Efectivo Real Físico Contado', `$ ${formatUSD(shift.countedCashUSD || 0)}`, `Bs. ${formatBs(shift.countedCashBs || 0)}`],
    ['Diferencia / Resultado del Cuadre', `$ ${formatUSD(diffUSD)}`, `Bs. ${formatBs(diffBs)} (${diffStatus})`]
  ];

  autoTable(doc, {
    startY: 42,
    head: [['Concepto Arqueo de Caja', 'Monto Divisas (USD)', 'Equivalente Oficial (Bs)']],
    body: arqueoTable,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 2.8 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Desglose por método de pago si existe
  if (shift.salesBreakdown && Object.keys(shift.salesBreakdown).length > 0) {
    const methodsRows = Object.entries(shift.salesBreakdown).map(([m, val]) => [
      m.replace('_', ' ').toUpperCase(),
      `$ ${formatUSD(val.usd)}`,
      `Bs. ${formatBs(val.bs)}`
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Desglose de Ventas por Medio de Pago en este Turno:', 14, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Forma de Pago', 'Monto USD', 'Monto Bs']],
      body: methodsRows,
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2.2 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Table 3: Bancos abiertos si existen
  if (shift.initialBanks && shift.initialBanks.length > 0) {
    const bankRows = shift.initialBanks.map(b => [
      b.bankName,
      b.accountNumber,
      `Bs. ${formatBs(b.initialBalanceBs)}`,
      `$ ${formatUSD(b.initialBalanceUSD || 0)}`,
      `Bs. ${formatBs(b.countedBalanceBs || b.initialBalanceBs)}`
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Saldos en Cuentas Bancarias Registradas:', 14, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Banco', 'Cuenta', 'Saldo Inicial Bs', 'Saldo Inicial $', 'Saldo Cierre Bs']],
      body: bankRows,
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 2 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Observaciones
  if (shift.closedNotes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(`Observaciones de Cierre: ${shift.closedNotes}`, 14, currentY);
    currentY += 8;
  }

  // Signatures
  currentY = Math.max(currentY + 12, 235);
  doc.line(20, currentY, 85, currentY);
  doc.line(130, currentY, 195, currentY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma Cajero / Responsable Entrega', 26, currentY + 5);
  doc.text('Firma Administrador / Auditor Recibe', 133, currentY + 5);

  const dateStr = (shift.closedAt || shift.openedAt).split('T')[0];
  doc.save(`Cierre_Caja_${dateStr}_${shift.id}.pdf`);
};

// 9. Export Historial de Cierres de Caja to Excel (.xlsx)
export const exportHistorialCierresExcel = (
  shifts: CashShift[],
  businessInfo: { name: string; rif: string }
) => {
  const data = shifts.map((shift, idx) => ({
    'N°': idx + 1,
    'ID Turno': shift.id,
    'Fecha Apertura': shift.openedDateFormatted || shift.openedAt,
    'Fecha Cierre': shift.closedDateFormatted || shift.closedAt || 'Abierto',
    'Responsable': shift.closedBy || shift.openedBy || 'Administrador',
    'Fondo Inicial USD': Number(shift.initialCashUSD.toFixed(2)),
    'Fondo Inicial Bs': Number(shift.initialCashBs.toFixed(2)),
    'Ventas Turno USD': Number((shift.totalSalesUSD || 0).toFixed(2)),
    'Ventas Turno Bs': Number((shift.totalSalesBs || 0).toFixed(2)),
    'Gastos Turno USD': Number((shift.totalExpensesUSD || 0).toFixed(2)),
    'Esperado USD': Number((shift.expectedCashUSD || 0).toFixed(2)),
    'Contado USD': Number((shift.countedCashUSD || 0).toFixed(2)),
    'Diferencia USD': Number((shift.differenceUSD || 0).toFixed(2)),
    'Diferencia Bs': Number((shift.differenceBs || 0).toFixed(2)),
    'Observaciones': shift.closedNotes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial de Cierres');
  XLSX.writeFile(wb, `Historial_Cierres_Caja_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// 10. Export Historial de Cierres de Caja to PDF
export const exportHistorialCierresPDF = (
  shifts: CashShift[],
  businessInfo: { name: string; rif: string }
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL DE CIERRES DIARIOS Y CUADRES DE CAJA', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${businessInfo.name} | RIF: ${businessInfo.rif} | Emisión: ${new Date().toLocaleDateString('es-VE')}`, 14, 17);

  const tableData = shifts.map((shift, idx) => [
    (idx + 1).toString(),
    shift.openedDateFormatted?.substring(0, 16) || shift.openedAt.substring(0, 10),
    shift.closedDateFormatted?.substring(0, 16) || (shift.isOpen ? 'ABIERTO' : 'Cerrado'),
    (shift.closedBy || shift.openedBy || 'Admin').substring(0, 15),
    `$${formatUSD(shift.initialCashUSD)}`,
    `$${formatUSD(shift.totalSalesUSD || 0)}`,
    `$${formatUSD(shift.expectedCashUSD || 0)}`,
    `$${formatUSD(shift.countedCashUSD || 0)}`,
    `$${formatUSD(shift.differenceUSD || 0)}`,
    Math.abs(shift.differenceUSD || 0) < 0.01 ? 'EXACTO' : (shift.differenceUSD || 0) > 0 ? 'SOBRANTE' : 'FALTANTE'
  ]);

  autoTable(doc, {
    startY: 22,
    head: [['N°', 'Apertura', 'Cierre', 'Cajero', 'Fondo USD', 'Ventas USD', 'Esperado $', 'Contado $', 'Dif $', 'Estatus']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
  });

  doc.save(`Historial_Cierres_Caja_${new Date().toISOString().split('T')[0]}.pdf`);
};

// 11. Export Cuentas por Pagar to Excel (.xlsx)
export const exportCuentasPorPagarExcel = (
  cuentas: CuentaPorPagar[],
  businessInfo: { name: string; rif: string },
  bcvRate: number = 889.26
) => {
  const data = cuentas.map((c, idx) => ({
    'N°': idx + 1,
    'Proveedor': c.supplierName,
    'RIF': c.supplierRIF || 'S/R',
    'Teléfono': c.supplierPhone || '',
    'N° Factura': c.invoiceNumber,
    'Fecha Emisión': c.date,
    'Fecha Vencimiento': c.dueDate,
    'Monto Total USD': Number(c.totalAmountUSD.toFixed(2)),
    'Monto Total Bs': Number((c.totalAmountUSD * bcvRate).toFixed(2)),
    'Abonado USD': Number(c.paidAmountUSD.toFixed(2)),
    'Saldo Pendiente USD': Number(c.remainingUSD.toFixed(2)),
    'Saldo Pendiente Bs': Number((c.remainingUSD * bcvRate).toFixed(2)),
    'Estatus': c.status.toUpperCase(),
    'Notas': c.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cuentas Por Pagar');
  XLSX.writeFile(wb, `Cuentas_Por_Pagar_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// 12. Export Cuentas por Pagar to PDF
export const exportCuentasPorPagarPDF = (
  cuentas: CuentaPorPagar[],
  businessInfo: { name: string; rif: string },
  bcvRate: number
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  const totalDeudaUSD = cuentas.reduce((acc, c) => acc + c.totalAmountUSD, 0);
  const totalAbonadoUSD = cuentas.reduce((acc, c) => acc + c.paidAmountUSD, 0);
  const totalPendienteUSD = cuentas.reduce((acc, c) => acc + c.remainingUSD, 0);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME CONTABLE DE CUENTAS POR PAGAR (PASIVOS A PROVEEDORES)', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${businessInfo.name} | RIF: ${businessInfo.rif} | Tasa BCV: Bs. ${bcvRate.toFixed(2)} | Fecha: ${new Date().toLocaleDateString('es-VE')}`, 14, 17);
  doc.text(`Deuda Global: $${formatUSD(totalDeudaUSD)} | Total Amortizado: $${formatUSD(totalAbonadoUSD)} | Saldo Pendiente por Pagar: $${formatUSD(totalPendienteUSD)} (Bs. ${formatBs(totalPendienteUSD * bcvRate)})`, 14, 22);

  const tableData: (string | number)[][] = cuentas.map((c, idx) => [
    (idx + 1).toString(),
    c.supplierName.substring(0, 25),
    c.supplierRIF || 'S/R',
    c.invoiceNumber,
    c.date,
    c.dueDate,
    `$${formatUSD(c.totalAmountUSD)}`,
    `$${formatUSD(c.paidAmountUSD)}`,
    `$${formatUSD(c.remainingUSD)}`,
    `Bs. ${formatBs(c.remainingUSD * bcvRate)}`,
    c.status.toUpperCase()
  ]);

  autoTable(doc, {
    startY: 27,
    head: [['N°', 'Proveedor', 'RIF', 'Factura', 'Emisión', 'Vence', 'Total $', 'Abonado $', 'Pendiente $', 'Pendiente Bs', 'Estatus']],
    body: tableData,
    headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
  });

  doc.save(`Cuentas_Por_Pagar_Proveedores_${new Date().toISOString().split('T')[0]}.pdf`);
};
