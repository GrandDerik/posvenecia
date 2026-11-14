import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Expense, BusinessInfo, CashShift, CreditNote, Abono } from '../types';
import { formatBs, formatUSD, getLocalDateStr, round2, safeDiv } from './exportUtils';

// 1. Reporte Z / Cierre Diario SENIAT
export const generateReporteZPDF = (
  todaySales: Sale[],
  todayExpenses: Expense[],
  bcvRate: number,
  businessInfo: BusinessInfo
) => {
  // Format as standard thermal 80mm roll or small page (80mm x 260mm)
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 260],
    orientation: 'portrait'
  });

  const pageWidth = 80;
  let y = 8;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(businessInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${businessInfo.rif}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(businessInfo.address.substring(0, 42), pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`TELF: ${businessInfo.phone}`, pageWidth / 2, y, { align: 'center' });
  if (businessInfo.email) {
    y += 4;
    doc.text(`EMAIL: ${businessInfo.email.substring(0, 42)}`, pageWidth / 2, y, { align: 'center' });
  }
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REPORTE Z - CIERRE DIARIO', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`FECHA / HORA: ${new Date().toLocaleString('es-VE')}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`TASA BCV OFICIAL: Bs. ${bcvRate.toFixed(2)}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`N° CIERRE: Z-${getLocalDateStr().replace(/-/g, '')}-01`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setLineWidth(0.3);
  doc.line(6, y, pageWidth - 6, y);
  y += 5;

  // Totals Breakdown
  const totalSalesBs = todaySales.reduce((acc, s) => acc + s.totalBs, 0);
  const totalSalesUSD = todaySales.reduce((acc, s) => acc + s.totalUSD, 0);
  const totalExemptBs = todaySales.reduce((acc, s) => acc + s.exemptBs, 0);
  const totalTaxableBs = todaySales.reduce((acc, s) => acc + s.taxableBs, 0);
  const totalIvaBs = todaySales.reduce((acc, s) => acc + s.ivaBs, 0);
  const totalIgtfBs = todaySales.reduce((acc, s) => acc + s.igtfBs, 0);
  const totalIgtfUSD = todaySales.reduce((acc, s) => acc + s.igtfUSD, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('RESUMEN FISCAL (SENIAT)', 6, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  
  const printLine = (label: string, valBs: string, valUSD?: string) => {
    doc.text(label, 6, y);
    doc.text(valBs, pageWidth - 6, y, { align: 'right' });
    y += 4;
    if (valUSD) {
      doc.setFontSize(6.5);
      doc.setTextColor(100);
      doc.text(`Equiv. USD: $ ${valUSD}`, pageWidth - 6, y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(7.5);
      y += 4;
    }
  };

  printLine('Transacciones registradas:', `${todaySales.length} comprobantes`);
  printLine('Ventas Exentas (E):', `Bs. ${formatBs(totalExemptBs)}`);
  printLine('Base Imponible General (G 16%):', `Bs. ${formatBs(totalTaxableBs)}`);
  printLine('Impuesto IVA 16% Recaudado:', `Bs. ${formatBs(totalIvaBs)}`);
  printLine('IGTF 3% Percibido en Divisas:', `Bs. ${formatBs(totalIgtfBs)}`, formatUSD(totalIgtfUSD));
  
  doc.setFont('helvetica', 'bold');
  printLine('TOTAL VENTAS BRUTAS (Bs):', `Bs. ${formatBs(totalSalesBs)}`, formatUSD(totalSalesUSD));
  
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(6, y, pageWidth - 6, y);
  y += 5;

  // Breakdown by payment method
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DESGLOSE POR MEDIO DE PAGO', 6, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const methods = [
    { key: 'efectivo_usd', label: 'Efectivo USD' },
    { key: 'efectivo_bs', label: 'Efectivo Bs' },
    { key: 'pago_movil', label: 'Pago Móvil' },
    { key: 'debito', label: 'Punto de Débito' },
    { key: 'fiao', label: 'Fiao / Cuentas Cobrar' },
    { key: 'cashea', label: 'Cashea' }
  ];

  methods.forEach(m => {
    const matching = todaySales.filter(s => s.paymentMethod === m.key);
    const sumBs = matching.reduce((acc, s) => acc + s.totalBs, 0);
    const sumUSD = matching.reduce((acc, s) => acc + s.totalUSD, 0);
    if (matching.length > 0) {
      doc.text(`${m.label} (${matching.length}):`, 6, y);
      doc.text(`Bs. ${formatBs(sumBs)}`, pageWidth - 6, y, { align: 'right' });
      y += 4;
      doc.setFontSize(6.5);
      doc.setTextColor(100);
      doc.text(`$ ${formatUSD(sumUSD)}`, pageWidth - 6, y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(7.5);
      y += 4;
    }
  });

  y += 2;
  doc.line(6, y, pageWidth - 6, y);
  y += 5;

  // Expenses summary
  const totalExpBs = todayExpenses.reduce((acc, e) => acc + e.amountBs, 0);
  const totalExpUSD = todayExpenses.reduce((acc, e) => acc + e.amountUSD, 0);
  const netBs = totalSalesBs - totalExpBs;
  const netUSD = totalSalesUSD - totalExpUSD;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BALANCE NETO DE CAJA', 6, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  printLine('Total Egresos / Gastos:', `Bs. ${formatBs(totalExpBs)}`, formatUSD(totalExpUSD));
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  printLine('TOTAL NETO EN CAJA:', `Bs. ${formatBs(netBs)}`, formatUSD(netUSD));

  y += 4;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.text('DOCUMENTO DE CONTROL FISCAL INTERNO', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('*** FIN DEL REPORTE Z ***', pageWidth / 2, y, { align: 'center' });

  doc.save(`Reporte_Z_Cierre_Diario_${getLocalDateStr()}.pdf`);
};

// 2. Comprobante Digital (PDF) Ticket de Venta Térmico
export const generateTicketVentaPDF = (
  sale: Sale,
  businessInfo: BusinessInfo
) => {
  const hasLogo = Boolean(businessInfo.logoUrl && businessInfo.logoUrl.startsWith('data:image'));
  const dynamicHeight = Math.max(160, 120 + (sale.items.length * 8) + (hasLogo ? 18 : 0));
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, dynamicHeight],
    orientation: 'portrait'
  });

  const pageWidth = 80;
  let y = 8;

  // Header Logo (if provided and valid data URI)
  if (hasLogo && businessInfo.logoUrl) {
    try {
      const format = businessInfo.logoUrl.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(businessInfo.logoUrl, format, (pageWidth - 22) / 2, y, 22, 14);
      y += 16;
    } catch (e) {
      // Ignore if image format cannot be parsed by jsPDF
    }
  }

  // Header Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(businessInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${businessInfo.rif}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(businessInfo.address.substring(0, 42), pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`TELF: ${businessInfo.phone}`, pageWidth / 2, y, { align: 'center' });
  if (businessInfo.email) {
    y += 4;
    doc.text(`EMAIL: ${businessInfo.email.substring(0, 42)}`, pageWidth / 2, y, { align: 'center' });
  }
  if (businessInfo.instagram) {
    y += 4;
    doc.text(`IG: ${businessInfo.instagram}`, pageWidth / 2, y, { align: 'center' });
  }
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text(`COMPROBANTE: ${sale.invoiceNumber}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° CONTROL SENIAT: ${sale.controlNumber}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`FECHA: ${new Date(sale.date).toLocaleString('es-VE')}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`TASA BCV APLICADA: Bs. ${sale.bcvRate.toFixed(2)}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Client
  doc.line(6, y, pageWidth - 6, y);
  y += 4;
  doc.text(`CLIENTE: ${sale.clientName}`, 6, y);
  y += 4;
  doc.text(`CI / RIF: ${sale.clientRIF}`, 6, y);
  if (sale.clientPhone) {
    y += 4;
    doc.text(`TELÉFONO: ${sale.clientPhone}`, 6, y);
  }
  y += 4;
  doc.line(6, y, pageWidth - 6, y);
  y += 5;

  // Table items
  doc.setFont('helvetica', 'bold');
  doc.text('CANT  DESCRIPCIÓN', 6, y);
  doc.text('TOTAL Bs', pageWidth - 6, y, { align: 'right' });
  y += 4;
  doc.setFont('helvetica', 'normal');

  sale.items.forEach(item => {
    const itemTotalBs = item.totalUSD * sale.bcvRate;
    const nameStr = `${item.quantity}x ${item.product.name}${item.product.isExemptFromIVA ? ' (E)' : ''}`;
    doc.text(nameStr.substring(0, 26), 6, y);
    doc.text(`Bs. ${formatBs(itemTotalBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
    doc.setFontSize(6);
    doc.setTextColor(110);
    doc.text(`   $ ${formatUSD(item.product.priceUSD)} c/u  =  $ ${formatUSD(item.totalUSD)}`, 6, y);
    doc.setTextColor(0);
    doc.setFontSize(7);
    y += 4;
  });

  doc.line(6, y, pageWidth - 6, y);
  y += 4;

  // Totals
  doc.text('SUBTOTAL:', 6, y);
  doc.text(`Bs. ${formatBs(sale.subtotalBs)}`, pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  if (sale.exemptBs > 0) {
    doc.text('VENTAS EXENTAS (E):', 6, y);
    doc.text(`Bs. ${formatBs(sale.exemptBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  if (sale.taxableBs > 0) {
    doc.text('BASE IMPONIBLE (16%):', 6, y);
    doc.text(`Bs. ${formatBs(sale.taxableBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
    doc.text('IVA (16%):', 6, y);
    doc.text(`Bs. ${formatBs(sale.ivaBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  if (sale.igtfBs > 0) {
    doc.text('IGTF (3% DIVISAS):', 6, y);
    doc.text(`Bs. ${formatBs(sale.igtfBs)} ($ ${formatUSD(sale.igtfUSD)})`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  y += 1;
  doc.text('TOTAL A PAGAR:', 6, y);
  doc.text(`Bs. ${formatBs(sale.totalBs)}`, pageWidth - 6, y, { align: 'right' });
  y += 4;
  doc.text('TOTAL EQUIV. DIVISA:', 6, y);
  doc.text(`$ ${formatUSD(sale.totalUSD)}`, pageWidth - 6, y, { align: 'right' });
  y += 5;

  // Payment method info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`FORMA DE PAGO: ${sale.paymentMethod.replace('_', ' ').toUpperCase()}`, 6, y);
  y += 4;

  if (sale.paymentMethod === 'pago_combinado' && sale.paymentDetails.combinedBreakdown) {
    const cb = sale.paymentDetails.combinedBreakdown;
    doc.setFont('helvetica', 'bold');
    doc.text('DESGLOSE DE PAGO:', 6, y);
    y += 3.5;
    doc.setFont('helvetica', 'normal');
    if (cb.usdCash && cb.usdCash > 0) {
      doc.text(`* Efectivo USD: $ ${formatUSD(cb.usdCash)}`, 6, y);
      y += 3.5;
    }
    if (cb.bsCash && cb.bsCash > 0) {
      doc.text(`* Efectivo Bs: Bs. ${formatBs(cb.bsCash)}`, 6, y);
      y += 3.5;
    }
    if (cb.pagoMovil && cb.pagoMovil > 0) {
      doc.text(`* Pago Móvil: Bs. ${formatBs(cb.pagoMovil)} (Ref: ${cb.pagoMovilRef || 'S/R'})`, 6, y);
      y += 3.5;
    }
    if (cb.debito && cb.debito > 0) {
      doc.text(`* Punto Débito: Bs. ${formatBs(cb.debito)} (Ref: ${cb.debitoRef || 'S/R'})`, 6, y);
      y += 3.5;
    }
    if (cb.fiaoRemaining && cb.fiaoRemaining > 0) {
      doc.text(`* Saldo Fiado: $ ${formatUSD(cb.fiaoRemaining)}`, 6, y);
      y += 3.5;
    }
  } else {
    if (sale.paymentDetails.pagoMovilRef) {
      doc.text(`REF PAGO MÓVIL: ${sale.paymentDetails.pagoMovilRef} (${sale.paymentDetails.pagoMovilBank || 'Banco'})`, 6, y);
      y += 4;
    }
    if (sale.paymentDetails.debitoRef) {
      doc.text(`REF DÉBITO: ${sale.paymentDetails.debitoRef}`, 6, y);
      y += 4;
    }
    if (sale.paymentMethod === 'fiao') {
      doc.text(`ABONO INICIAL: $ ${formatUSD(sale.paymentDetails.fiaoInitialAbonoUSD || 0)}`, 6, y);
      y += 3.5;
      doc.setFont('helvetica', 'bold');
      doc.text(`RESTA POR PAGAR: $ ${formatUSD(sale.paymentDetails.fiaoRemainingUSD || 0)}`, 6, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
    }
  }

  y += 2;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const footerText = (businessInfo.footerMessage || '¡GRACIAS POR SU COMPRA!').toUpperCase();
  doc.text(footerText, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Conserve este comprobante para cualquier reclamo', pageWidth / 2, y, { align: 'center' });

  doc.save(`Ticket_${sale.invoiceNumber}_${sale.clientName.replace(/\s+/g, '_')}.pdf`);
};

// 3. Comprobante Formal de Cierre de Caja y Arqueo Diario
export const generateComprobanteCierrePDF = (
  shift: CashShift,
  sales: Sale[],
  expenses: Expense[],
  bcvRate: number,
  businessInfo: BusinessInfo,
  action: 'save' | 'print' = 'save'
) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidth = 210;
  let y = 16;

  // Header Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(businessInfo.name.toUpperCase(), 20, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`RIF: ${businessInfo.rif} | TELF: ${businessInfo.phone}`, 20, y + 14);
  doc.text(`DIRECCIÓN: ${businessInfo.address.substring(0, 75)}`, 20, y + 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text('ACTA DE ARQUEO Y CIERRE DE CAJA', pageWidth - 20, y + 9, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`TURNO ID: ${shift.id.substring(0, 16)}`, pageWidth - 20, y + 15, { align: 'right' });
  doc.text(`TASA BCV: Bs. ${bcvRate.toFixed(2)}`, pageWidth - 20, y + 20, { align: 'right' });

  y += 30;

  // Shift metadata table
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    head: [['Apertura de Caja', 'Cierre de Caja', 'Responsable de Caja', 'Fondo Inicial en Caja']],
    body: [
      [
        shift.openedDateFormatted || shift.openedAt,
        shift.closedDateFormatted || new Date().toLocaleString('es-VE'),
        shift.openedBy || 'Cajero en Turno',
        `$ ${formatUSD(shift.initialCashUSD)}  |  Bs. ${formatBs(shift.initialCashBs)}`
      ]
    ],
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Breakdown by payment methods for sales during the shift
  const cashUSDSales = sales.filter(s => s.paymentMethod === 'efectivo_usd').reduce((a, s) => a + s.totalUSD, 0);
  const cashBsSales = sales.filter(s => s.paymentMethod === 'efectivo_bs').reduce((a, s) => a + s.totalBs, 0);
  const pagoMovilSales = sales.filter(s => s.paymentMethod === 'pago_movil').reduce((a, s) => a + s.totalBs, 0);
  const debitoSales = sales.filter(s => s.paymentMethod === 'debito').reduce((a, s) => a + s.totalBs, 0);
  const fiaoSales = sales.filter(s => s.paymentMethod === 'fiao').reduce((a, s) => a + s.totalUSD, 0);
  const totalSalesUSD = sales.reduce((a, s) => a + s.totalUSD, 0);
  const totalSalesBs = sales.reduce((a, s) => a + s.totalBs, 0);

  // Gastos
  const totalExpUSD = expenses.reduce((a, e) => a + e.amountUSD, 0);
  const totalExpBs = expenses.reduce((a, e) => a + e.amountBs, 0);

  // Arqueo Data
  const expectedUSD = shift.expectedCashUSD ?? (shift.initialCashUSD + cashUSDSales - totalExpUSD);
  const expectedBs = shift.expectedCashBs ?? (shift.initialCashBs + cashBsSales - totalExpBs);
  const countedUSD = shift.countedCashUSD ?? expectedUSD;
  const countedBs = shift.countedCashBs ?? expectedBs;
  const diffUSD = shift.differenceUSD ?? (countedUSD - expectedUSD);
  const diffBs = shift.differenceBs ?? (countedBs - expectedBs);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Resumen de Operaciones y Medios de Pago', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    head: [['Medio de Pago', 'N° Transacciones', 'Monto en Divisa (USD)', 'Monto en Bolívares (Bs)']],
    body: [
      ['Efectivo Dólares (USD)', sales.filter(s => s.paymentMethod === 'efectivo_usd').length.toString(), `$ ${formatUSD(cashUSDSales)}`, `Bs. ${formatBs(cashUSDSales * bcvRate)}`],
      ['Efectivo Bolívares (Bs)', sales.filter(s => s.paymentMethod === 'efectivo_bs').length.toString(), `$ ${formatUSD(cashBsSales / bcvRate)}`, `Bs. ${formatBs(cashBsSales)}`],
      ['Pago Móvil Interbancario', sales.filter(s => s.paymentMethod === 'pago_movil').length.toString(), `$ ${formatUSD(pagoMovilSales / bcvRate)}`, `Bs. ${formatBs(pagoMovilSales)}`],
      ['Punto de Venta Débito', sales.filter(s => s.paymentMethod === 'debito').length.toString(), `$ ${formatUSD(debitoSales / bcvRate)}`, `Bs. ${formatBs(debitoSales)}`],
      ['Ventas a Crédito / Fiao', sales.filter(s => s.paymentMethod === 'fiao').length.toString(), `$ ${formatUSD(fiaoSales)}`, `Bs. ${formatBs(fiaoSales * bcvRate)}`],
      ['Otros / Combinados', sales.filter(s => !['efectivo_usd', 'efectivo_bs', 'pago_movil', 'debito', 'fiao'].includes(s.paymentMethod)).length.toString(), `$ ${formatUSD(sales.filter(s => !['efectivo_usd', 'efectivo_bs', 'pago_movil', 'debito', 'fiao'].includes(s.paymentMethod)).reduce((a, s) => a + s.totalUSD, 0))}`, `Bs. ${formatBs(sales.filter(s => !['efectivo_usd', 'efectivo_bs', 'pago_movil', 'debito', 'fiao'].includes(s.paymentMethod)).reduce((a, s) => a + s.totalBs, 0))}`],
      ['TOTAL VENTAS BRUTAS', sales.length.toString(), `$ ${formatUSD(totalSalesUSD)}`, `Bs. ${formatBs(totalSalesBs)}`],
      ['EGRESOS Y GASTOS DEL TURNO', expenses.length.toString(), `-$ ${formatUSD(totalExpUSD)}`, `-Bs. ${formatBs(totalExpBs)}`],
    ],
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Cuadre y Arqueo Físico de Efectivo', 14, y);
  y += 3;

  const diffLabelUSD = diffUSD === 0 ? 'CUADRE EXACTO ($ 0.00)' : diffUSD > 0 ? `SOBRANTE (+$ ${formatUSD(diffUSD)})` : `FALTANTE (-$ ${formatUSD(Math.abs(diffUSD))})`;
  const diffLabelBs = diffBs === 0 ? 'CUADRE EXACTO (Bs. 0.00)' : diffBs > 0 ? `SOBRANTE (+Bs. ${formatBs(diffBs)})` : `FALTANTE (-Bs. ${formatBs(Math.abs(diffBs))})`;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    head: [['Concepto Arqueo', 'Valores en Dólares (USD)', 'Valores en Bolívares (Bs)']],
    body: [
      ['Fondo Inicial Apertura', `$ ${formatUSD(shift.initialCashUSD)}`, `Bs. ${formatBs(shift.initialCashBs)}`],
      ['Efectivo Teórico Esperado', `$ ${formatUSD(expectedUSD)}`, `Bs. ${formatBs(expectedBs)}`],
      ['Efectivo Físico Contado', `$ ${formatUSD(countedUSD)}`, `Bs. ${formatBs(countedBs)}`],
      ['DIFERENCIA / RESULTADO', diffLabelUSD, diffLabelBs],
    ],
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Notes & observations
  if (shift.closedNotes || shift.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVACIONES DE CIERRE:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteText = shift.closedNotes || shift.notes || 'Sin observaciones adicionales';
    doc.text(doc.splitTextToSize(noteText, pageWidth - 28), 14, y);
    y += 14;
  } else {
    y += 8;
  }

  // Signatures
  y = Math.max(y + 12, 240);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(24, y, 90, y);
  doc.line(pageWidth - 90, y, pageWidth - 24, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('FIRMA DEL CAJERO / OPERADOR', 57, y + 4, { align: 'center' });
  doc.text('FIRMA DEL ADMINISTRADOR / SUPERVISOR', pageWidth - 57, y + 4, { align: 'center' });

  const fileName = `Reporte_Cierre_Caja_${getLocalDateStr()}_Turno_${shift.id.slice(-6)}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = blobUrl as any;
    document.body.appendChild(printFrame);

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 2000);
    };

    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.warn('Error invoking print dialog on iframe:', e);
      } finally {
        cleanup();
      }
    };
  } else {
    doc.save(fileName);
  }
};

// 5. Comprobante Fiscal de Nota de Crédito / Devolución (Formato Térmico 80mm)
export const generateTicketNotaCreditoPDF = (
  creditNote: CreditNote,
  businessInfo: BusinessInfo,
  action: 'download' | 'print' = 'download'
) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 200 + creditNote.items.length * 10],
    orientation: 'portrait'
  });

  const pageWidth = 80;
  let y = 8;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(businessInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${businessInfo.rif}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(businessInfo.address.substring(0, 42), pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`TELF: ${businessInfo.phone}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Title Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NOTA DE CRÉDITO', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(8);
  doc.text(creditNote.creditNoteNumber, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`CONTROL SENIAT: ${creditNote.controlNumber}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(
    `AFECTA FACTURA: ${creditNote.originalInvoiceNumber}${creditNote.originalControlNumber ? ` (CTRL: ${creditNote.originalControlNumber})` : ''}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;
  doc.text(`FECHA: ${new Date(creditNote.date).toLocaleString('es-VE')}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`TASA BCV: Bs. ${creditNote.bcvRate.toFixed(2)}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setLineWidth(0.3);
  doc.line(6, y, pageWidth - 6, y);
  y += 4;

  // Client Info
  doc.setFontSize(7);
  doc.text(`CLIENTE: ${creditNote.clientName.substring(0, 36)}`, 6, y);
  y += 3.5;
  doc.text(`RIF/CI: ${creditNote.clientRIF}`, 6, y);
  y += 3.5;
  doc.text(`MOTIVO: ${creditNote.reason.substring(0, 40)}`, 6, y);
  y += 4;

  doc.line(6, y, pageWidth - 6, y);
  y += 4;

  // Table header
  doc.setFont('helvetica', 'bold');
  doc.text('CANT / ARTÍCULO DEVUELTO', 6, y);
  doc.text('TOTAL Bs', pageWidth - 6, y, { align: 'right' });
  y += 4;
  doc.setFont('helvetica', 'normal');

  creditNote.items.forEach(item => {
    const itemTotalBs = item.totalUSD * creditNote.bcvRate;
    const nameStr = `${item.quantity}x ${item.productName}${item.isExemptFromIVA ? ' (E)' : ''}`;
    doc.text(nameStr.substring(0, 26), 6, y);
    doc.text(`Bs. ${formatBs(itemTotalBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
    doc.setFontSize(6);
    doc.setTextColor(110);
    doc.text(`   $ ${formatUSD(item.unitPriceUSD)} c/u = $ ${formatUSD(item.totalUSD)}`, 6, y);
    doc.setTextColor(0);
    doc.setFontSize(7);
    y += 4;
  });

  doc.line(6, y, pageWidth - 6, y);
  y += 4;

  // Totals
  doc.text('SUBTOTAL:', 6, y);
  doc.text(`Bs. ${formatBs(creditNote.subtotalBs)}`, pageWidth - 6, y, { align: 'right' });
  y += 3.5;

  if (creditNote.exemptBs > 0) {
    doc.text('EXENTO (E):', 6, y);
    doc.text(`Bs. ${formatBs(creditNote.exemptBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  if (creditNote.taxableBs > 0) {
    doc.text('BASE IMPONIBLE (16%):', 6, y);
    doc.text(`Bs. ${formatBs(creditNote.taxableBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
    doc.text('IVA (16%):', 6, y);
    doc.text(`Bs. ${formatBs(creditNote.ivaBs)}`, pageWidth - 6, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  y += 1;
  doc.text('TOTAL DEVUELTO:', 6, y);
  doc.text(`Bs. ${formatBs(creditNote.totalBs)}`, pageWidth - 6, y, { align: 'right' });
  y += 4;
  doc.text('TOTAL EQUIV. USD:', 6, y);
  doc.text(`$ ${formatUSD(creditNote.totalUSD)}`, pageWidth - 6, y, { align: 'right' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`FORMA DE REINTEGRO: ${creditNote.refundMethod.replace('_', ' ').toUpperCase()}`, 6, y);
  y += 4;
  doc.text(`CAJERO: ${creditNote.cashierName}`, 6, y);
  y += 5;

  doc.setFontSize(6.5);
  doc.setTextColor(100);
  doc.text('Mercancía reincorporada formalmente al inventario.', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);

  const fileName = `Nota_Credito_${creditNote.creditNoteNumber}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = blobUrl as any;
    document.body.appendChild(printFrame);

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 2000);
    };

    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.warn('Error invoking print dialog on iframe:', e);
      } finally {
        cleanup();
      }
    };
  } else {
    doc.save(fileName);
  }
};

// 6. Corte Parcial de Caja (Cierre X — Auditoría sin Cierre de Jornada)
export const generateCorteParcialXPDF = (
  params: {
    cashShift: CashShift | null;
    isCashRegisterOpen: boolean;
    sales: Sale[];
    expenses: Expense[];
    creditNotes: CreditNote[];
    fiadoAbonos: Abono[];
    bcvRate: number;
    businessInfo: BusinessInfo;
    cashierName?: string;
  },
  action: 'save' | 'print' = 'save'
) => {
  const {
    cashShift,
    isCashRegisterOpen,
    sales,
    expenses,
    creditNotes,
    fiadoAbonos,
    bcvRate,
    businessInfo,
    cashierName
  } = params;

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait'
  });

  const pageWidth = 210;
  let y = 16;

  // Header Box
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, y, pageWidth - 28, 25, 3, 3, 'F');
  doc.setDrawColor(147, 197, 253);
  doc.roundedRect(14, y, pageWidth - 28, 25, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(11, 21, 40);
  doc.text((businessInfo.name || 'POSVENECIA').toUpperCase(), 20, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`RIF: ${businessInfo.rif || 'N/A'} | TELF: ${businessInfo.phone || 'N/A'}`, 20, y + 14);
  doc.text(`DIRECCIÓN: ${(businessInfo.address || 'Venezuela').substring(0, 72)}`, 20, y + 19.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text('CORTE PARCIAL DE CAJA (CIERRE X)', pageWidth - 20, y + 9, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    isCashRegisterOpen ? 'AUDITORÍA DE TURNO ACTIVO (CAJA ABIERTA)' : 'RESUMEN DEL DÍA (CAJA CERRADA)',
    pageWidth - 20,
    y + 14.5,
    { align: 'right' }
  );
  doc.text(`TASA BCV: Bs. ${bcvRate.toFixed(2)}`, pageWidth - 20, y + 20, { align: 'right' });

  y += 30;

  // Compute exact method flows (including pago_combinado & fiado abonos & NC refunds)
  let cashUsdSales = 0;
  let cashBsSales = 0;
  let pmSalesBs = 0;
  let debitoSalesBs = 0;
  let transferenciaSalesBs = 0;
  let fiaoTotalUSD = 0;
  let casheaTotalUSD = 0;

  sales.forEach(s => {
    if (s.paymentMethod === 'efectivo_usd') {
      cashUsdSales += s.totalUSD;
    } else if (s.paymentMethod === 'efectivo_bs') {
      cashBsSales += s.totalBs;
    } else if (s.paymentMethod === 'pago_movil') {
      pmSalesBs += s.totalBs;
    } else if (s.paymentMethod === 'debito') {
      debitoSalesBs += s.totalBs;
    } else if (s.paymentMethod === 'transferencia') {
      transferenciaSalesBs += s.totalBs;
    } else if (s.paymentMethod === 'cashea') {
      casheaTotalUSD += s.totalUSD;
    } else if (s.paymentMethod === 'fiao') {
      fiaoTotalUSD += s.paymentDetails?.fiaoRemainingUSD ?? s.totalUSD;
    } else if (s.paymentMethod === 'pago_combinado' && s.paymentDetails?.combinedBreakdown) {
      const cb = s.paymentDetails.combinedBreakdown;
      cashUsdSales += cb.usdCash || 0;
      cashBsSales += cb.bsCash || 0;
      pmSalesBs += cb.pagoMovil || 0;
      debitoSalesBs += cb.debito || 0;
      transferenciaSalesBs += cb.transferencia || 0;
      fiaoTotalUSD += cb.fiaoRemaining || 0;
    }
  });

  fiadoAbonos.forEach(a => {
    if (a.paymentMethod === 'efectivo_usd') cashUsdSales += a.amountUSD;
    else if (a.paymentMethod === 'efectivo_bs') cashBsSales += a.amountBs;
    else if (a.paymentMethod === 'pago_movil') pmSalesBs += a.amountBs;
    else if (a.paymentMethod === 'debito') debitoSalesBs += a.amountBs;
    else if (a.paymentMethod === 'transferencia') transferenciaSalesBs += a.amountBs;
  });

  const cashUsdRefund = creditNotes.filter(cn => cn.refundMethod === 'efectivo_usd').reduce((a, cn) => a + cn.totalUSD, 0);
  const cashBsRefund = creditNotes.filter(cn => cn.refundMethod === 'efectivo_bs').reduce((a, cn) => a + cn.totalBs, 0);
  const pmRefundBs = creditNotes.filter(cn => cn.refundMethod === 'pago_movil').reduce((a, cn) => a + cn.totalBs, 0);
  const debitoRefundBs = creditNotes.filter(cn => cn.refundMethod === 'debito').reduce((a, cn) => a + cn.totalBs, 0);
  const transferenciaRefundBs = creditNotes.filter(cn => cn.refundMethod === 'transferencia').reduce((a, cn) => a + cn.totalBs, 0);

  const cashUsdExp = round2(expenses.filter(e => e.paymentMethod === 'efectivo_usd').reduce((a, e) => a + e.amountUSD, 0) + cashUsdRefund);
  const cashBsExp = round2(expenses.filter(e => e.paymentMethod === 'efectivo_bs').reduce((a, e) => a + e.amountBs, 0) + cashBsRefund);
  const pmExpBs = round2(expenses.filter(e => e.paymentMethod === 'pago_movil').reduce((a, e) => a + e.amountBs, 0) + pmRefundBs);
  const debitoExpBs = round2(expenses.filter(e => e.paymentMethod === 'debito').reduce((a, e) => a + e.amountBs, 0) + debitoRefundBs);
  const transferenciaExpBs = round2(expenses.filter(e => e.paymentMethod === 'transferencia').reduce((a, e) => a + e.amountBs, 0) + transferenciaRefundBs);

  const initialUSD = isCashRegisterOpen ? (cashShift?.initialCashUSD || 0) : 0;
  const initialBs = isCashRegisterOpen ? (cashShift?.initialCashBs || 0) : 0;

  const cashUsdNet = round2(cashUsdSales - cashUsdExp);
  const cashBsNet = round2(cashBsSales - cashBsExp);
  const drawerCashUSD = round2(initialUSD + cashUsdNet);
  const drawerCashBs = round2(initialBs + cashBsNet);

  const pmNetBs = round2(pmSalesBs - pmExpBs);
  const debitoNetBs = round2(debitoSalesBs - debitoExpBs);
  const transferenciaNetBs = round2(transferenciaSalesBs - transferenciaExpBs);

  const igtfTotalUSD = round2(sales.reduce((a, s) => a + (s.igtfUSD || 0), 0));
  const igtfTotalBs = round2(sales.reduce((a, s) => a + (s.igtfBs || 0), 0));

  const totalSalesGrossUSD = round2(sales.reduce((a, s) => a + s.totalUSD, 0));
  const totalAbonosUSD = round2(fiadoAbonos.reduce((a, ab) => a + ab.amountUSD, 0));
  const totalExpUSD = round2(expenses.reduce((a, e) => a + e.amountUSD, 0));
  const totalNcUSD = round2(creditNotes.reduce((a, cn) => a + cn.totalUSD, 0));
  const netConsolidatedUSD = round2(totalSalesGrossUSD + totalAbonosUSD - totalExpUSD - totalNcUSD);
  const netConsolidatedBs = round2(netConsolidatedUSD * bcvRate);

  const nowStr = new Date().toLocaleString('es-VE');

  // Shift Metadata Table
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [11, 21, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    head: [['Apertura del Turno', 'Fecha/Hora Corte X', 'Operador / Cajero', 'Fondo Inicial Gaveta']],
    body: [
      [
        cashShift?.openedDateFormatted || (cashShift?.openedAt ? new Date(cashShift.openedAt).toLocaleString('es-VE') : 'Jornada del Día'),
        nowStr,
        cashierName || cashShift?.openedBy || 'Cajero en Turno',
        `$ ${formatUSD(initialUSD)}  |  Bs. ${formatBs(initialBs)}`
      ]
    ],
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Section 1: Drawer Cash Audit (USD & Bs)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 21, 40);
  doc.text('1. Auditoría de Efectivo en Gaveta (USD y Bolívares)', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    head: [['Moneda en Gaveta', 'Fondo Inicial', '+ Ingresos (Ventas/Abonos)', '- Egresos / NC', '= Esperado en Gaveta']],
    body: [
      [
        'Efectivo Dólares ($ USD)',
        `$ ${formatUSD(initialUSD)}`,
        `+$ ${formatUSD(cashUsdSales)}`,
        `-$ ${formatUSD(cashUsdExp)}`,
        `$ ${formatUSD(drawerCashUSD)}`
      ],
      [
        'Efectivo Bolívares (Bs.)',
        `Bs. ${formatBs(initialBs)}`,
        `+Bs. ${formatBs(cashBsSales)}`,
        `-Bs. ${formatBs(cashBsExp)}`,
        `Bs. ${formatBs(drawerCashBs)}`
      ]
    ],
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Section 2: Electronic & Credit Channels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 21, 40);
  doc.text('2. Desglose por Canales Electrónicos y Crédito del Turno', 14, y);
  y += 3;

  const pmCount = sales.filter(s => s.paymentMethod === 'pago_movil' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.pagoMovil ?? 0) > 0)).length;
  const debitoCount = sales.filter(s => s.paymentMethod === 'debito' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.debito ?? 0) > 0)).length;
  const transfCount = sales.filter(s => s.paymentMethod === 'transferencia' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.transferencia ?? 0) > 0)).length;
  const fiaoCount = sales.filter(s => s.paymentMethod === 'fiao' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.fiaoRemaining ?? 0) > 0)).length;
  const casheaCount = sales.filter(s => s.paymentMethod === 'cashea').length;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    head: [['Canal / Método', 'Operaciones', 'Cobrado Bruto', 'Egresos / NC', 'Neto en Bolívares', 'Equivalente USD']],
    body: [
      ['Pago Móvil', pmCount.toString(), `Bs. ${formatBs(pmSalesBs)}`, `-Bs. ${formatBs(pmExpBs)}`, `Bs. ${formatBs(pmNetBs)}`, `$ ${formatUSD(safeDiv(pmNetBs, bcvRate))}`],
      ['Punto de Venta (Débito)', debitoCount.toString(), `Bs. ${formatBs(debitoSalesBs)}`, `-Bs. ${formatBs(debitoExpBs)}`, `Bs. ${formatBs(debitoNetBs)}`, `$ ${formatUSD(safeDiv(debitoNetBs, bcvRate))}`],
      ['Transferencia Bancaria', transfCount.toString(), `Bs. ${formatBs(transferenciaSalesBs)}`, `-Bs. ${formatBs(transferenciaExpBs)}`, `Bs. ${formatBs(transferenciaNetBs)}`, `$ ${formatUSD(safeDiv(transferenciaNetBs, bcvRate))}`],
      ['Crédito / Fiao (Por Cobrar)', fiaoCount.toString(), `$ ${formatUSD(fiaoTotalUSD)}`, '-', `Bs. ${formatBs(fiaoTotalUSD * bcvRate)}`, `$ ${formatUSD(fiaoTotalUSD)}`],
      ['Cashea (Cuotas)', casheaCount.toString(), `$ ${formatUSD(casheaTotalUSD)}`, '-', `Bs. ${formatBs(casheaTotalUSD * bcvRate)}`, `$ ${formatUSD(casheaTotalUSD)}`]
    ],
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Section 3: Summary Totals
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: [11, 21, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    head: [['Resumen Consolidado del Corte X', 'Monto USD', 'Equivalente Bs (BCV)']],
    body: [
      [`Ventas Brutas (${sales.length} facturas)`, `$ ${formatUSD(totalSalesGrossUSD)}`, `Bs. ${formatBs(totalSalesGrossUSD * bcvRate)}`],
      [`Abonos a Fiados Recibidos (${fiadoAbonos.length})`, `+$ ${formatUSD(totalAbonosUSD)}`, `+Bs. ${formatBs(totalAbonosUSD * bcvRate)}`],
      [`Notas de Crédito Emitidas (${creditNotes.length})`, `-$ ${formatUSD(totalNcUSD)}`, `-Bs. ${formatBs(totalNcUSD * bcvRate)}`],
      [`Egresos y Pagos de Caja (${expenses.length})`, `-$ ${formatUSD(totalExpUSD)}`, `-Bs. ${formatBs(totalExpUSD * bcvRate)}`],
      ['IGTF 3% Percibido en Divisas', `$ ${formatUSD(igtfTotalUSD)}`, `Bs. ${formatBs(igtfTotalBs)}`],
      ['FLUJOS NETOS DEL TURNO (SIN FONDO BASE)', `$ ${formatUSD(netConsolidatedUSD)}`, `Bs. ${formatBs(netConsolidatedBs)}`]
    ],
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  // Payment Mobile references list if space & refs exist
  const pmRefSales = sales.filter(
    s => s.paymentMethod === 'pago_movil' || (s.paymentMethod === 'pago_combinado' && (s.paymentDetails?.combinedBreakdown?.pagoMovil ?? 0) > 0)
  );
  if (pmRefSales.length > 0 && y < 235) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(11, 21, 40);
    doc.text(`3. Referencias de Pago Móvil (${pmRefSales.length})`, 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      head: [['Factura', 'Cliente', 'Banco', 'Referencia', 'Monto Bs']],
      body: pmRefSales.slice(0, 12).map(s => [
        s.invoiceNumber,
        s.clientName.substring(0, 26),
        (s.paymentDetails?.pagoMovilBank || 'Banco').substring(0, 22),
        s.paymentDetails?.pagoMovilRef || s.paymentDetails?.combinedBreakdown?.pagoMovilRef || 'N/A',
        `Bs. ${formatBs(s.paymentMethod === 'pago_combinado' ? (s.paymentDetails?.combinedBreakdown?.pagoMovil || 0) : s.totalBs)}`
      ]),
      margin: { left: 14, right: 14 }
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 6;
  }

  // Disclaimer footer
  y = Math.min(276, Math.max(y + 8, 258));
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, pageWidth - 14, y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'DOCUMENTO DE AUDITORÍA INTERNA (CIERRE X): La caja continúa abierta y operativa hasta emitir el Cierre Z definitivo.',
    pageWidth / 2,
    y + 5,
    { align: 'center' }
  );

  const fileName = `Corte_Parcial_Cierre_X_${getLocalDateStr()}.pdf`;

  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = blobUrl as any;
    document.body.appendChild(printFrame);

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 2000);
    };

    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.warn('Error invoking print dialog on iframe:', e);
      } finally {
        cleanup();
      }
    };
  } else {
    doc.save(fileName);
  }
};

