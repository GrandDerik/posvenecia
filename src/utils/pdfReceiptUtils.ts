import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Expense, BusinessInfo, CashShift, CreditNote } from '../types';
import { formatBs, formatUSD } from './exportUtils';

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
  doc.text(`N° CIERRE: Z-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`, pageWidth / 2, y, { align: 'center' });
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

  doc.save(`Reporte_Z_Cierre_Diario_${new Date().toISOString().split('T')[0]}.pdf`);
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

  const fileName = `Reporte_Cierre_Caja_${new Date().toISOString().split('T')[0]}_Turno_${shift.id.slice(-6)}.pdf`;

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
  doc.text(`AFECTA A FACTURA: ${creditNote.originalInvoiceNumber}`, pageWidth / 2, y, { align: 'center' });
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

