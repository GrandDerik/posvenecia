import * as XLSX from 'xlsx';
import { Product, Sale, Expense, FiadoRecord, CuentaPorPagar, Client, BusinessInfo, GastoOperativo, GoogleAccount, CashShift } from '../types';
import { formatBs, formatUSD, getLocalDateStr } from './exportUtils';

export interface BackupDataPayload {
  version: string;
  timestamp: string;
  businessInfo: BusinessInfo;
  bcvRate: number;
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  fiados: FiadoRecord[];
  cuentasPorPagar: CuentaPorPagar[];
  gastosOperativos?: GastoOperativo[];
  clients: Client[];
  cashShift?: CashShift | null;
  cashShiftHistory?: CashShift[];
  googleAccount?: GoogleAccount;
}

/**
 * Generates and downloads a complete Excel workbook with all accounting, operational,
 * product history, sales, expenses, income/outflow, and debt records.
 */
export const downloadComprehensiveAccountingExcel = (data: {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  fiados: FiadoRecord[];
  cuentasPorPagar: CuentaPorPagar[];
  gastosOperativos?: GastoOperativo[];
  cashShiftHistory?: CashShift[];
  bcvRate: number;
  businessInfo: BusinessInfo;
}) => {
  const wb = XLSX.utils.book_new();
  const dateStr = getLocalDateStr();

  // 1. Sheet: Histórico de Ventas
  const salesSheetData = data.sales.map((s, idx) => ({
    'N°': idx + 1,
    'Fecha': new Date(s.date).toLocaleDateString('es-VE') + ' ' + new Date(s.date).toLocaleTimeString('es-VE'),
    'Factura': s.invoiceNumber,
    'Nro Control': s.controlNumber,
    'Cliente': s.clientName,
    'RIF/Cédula': s.clientRIF,
    'Items Vendidos': s.items.map(i => `${i.product.name} (x${i.quantity})`).join(', '),
    'Subtotal USD': s.subtotalUSD,
    'Exento USD': s.exemptUSD,
    'Gravable USD': s.taxableUSD,
    'IVA USD (16%)': s.ivaUSD,
    'IGTF USD (3%)': s.igtfUSD,
    'Total USD': s.totalUSD,
    'Tasa BCV': s.bcvRate,
    'Total Bs': s.totalBs,
    'Método Pago': s.paymentMethod.replace('_', ' ').toUpperCase(),
    'Referencia': s.paymentDetails?.pagoMovilRef || s.paymentDetails?.debitoRef || s.paymentDetails?.transferenciaRef || '-',
    'Estado': s.status
  }));
  const wsSales = XLSX.utils.json_to_sheet(salesSheetData);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Historico_Ventas');

  // 2. Sheet: Histórico de Compras y Gastos (Libro de Compras)
  const expensesSheetData = data.expenses.map((e, idx) => ({
    'N°': idx + 1,
    'Fecha': new Date(e.date).toLocaleDateString('es-VE'),
    'Factura Proveedor': e.invoiceNumber,
    'Nro Control': e.controlNumber,
    'Proveedor': e.supplierName,
    'RIF Proveedor': e.supplierRIF,
    'Descripción': e.description,
    'Categoría': e.category,
    'Monto USD': e.amountUSD,
    'Monto Bs': e.amountBs,
    'Base Imponible Bs': e.baseImponibleBs,
    'IVA Bs (16%)': e.ivaBs,
    'Retención IVA Bs': e.retencionIVABs,
    'Retención ISLR Bs': e.retencionISLRBs,
    'Tasa BCV': e.bcvRate,
    'Método Pago': e.paymentMethod.replace('_', ' ').toUpperCase(),
    'Referencia': e.reference || '-'
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expensesSheetData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Compras_y_Gastos');

  // 3. Sheet: Catálogo de Productos y Servicios
  const productsSheetData = data.products.map((p, idx) => ({
    'N°': idx + 1,
    'Tipo': (p.isService || p.itemType === 'servicio') ? 'Servicio' : 'Producto',
    'Código': p.code,
    'Nombre': p.name,
    'Categoría': p.category,
    'Costo USD': p.costUSD,
    'Precio USD': p.priceUSD,
    'Precio Bs (Tasa BCV)': Number((p.priceUSD * data.bcvRate).toFixed(2)),
    'Stock': (p.isService || p.itemType === 'servicio') ? 'Ilimitado' : p.stock,
    'Stock Mínimo': (p.isService || p.itemType === 'servicio') ? '-' : p.minStock,
    'Unidad': p.unit,
    'Tratamiento IVA': p.isExemptFromIVA ? 'Exento' : 'Gravado 16%',
    'Nota de Compra / Factura': p.purchaseNote || '-'
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productsSheetData);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Catalogo_Productos');

  // 4. Sheet: Cuentas por Cobrar (Fiados)
  const fiadosSheetData = data.fiados.map((f, idx) => ({
    'N°': idx + 1,
    'Fecha': new Date(f.date).toLocaleDateString('es-VE'),
    'Comprobante': f.invoiceNumber,
    'Cliente': f.clientName,
    'Cédula / RIF': f.clientCI,
    'Teléfono': f.clientPhone,
    'Deuda Inicial USD': f.originalDebtUSD,
    'Saldo Restante USD': f.remainingDebtUSD,
    'Saldo Restante Bs (BCV)': Number((f.remainingDebtUSD * data.bcvRate).toFixed(2)),
    'Estado': f.status.toUpperCase(),
    'Total Abonos': f.abonos.length,
    'Notas': f.notes || '-'
  }));
  const wsFiados = XLSX.utils.json_to_sheet(fiadosSheetData);
  XLSX.utils.book_append_sheet(wb, wsFiados, 'Cuentas_Cobrar_Fiados');

  // 5. Sheet: Cuentas por Pagar (Proveedores)
  const cppSheetData = data.cuentasPorPagar.map((c, idx) => ({
    'N°': idx + 1,
    'Fecha Emisión': new Date(c.date).toLocaleDateString('es-VE'),
    'Fecha Vencimiento': new Date(c.dueDate).toLocaleDateString('es-VE'),
    'Factura': c.invoiceNumber,
    'Proveedor': c.supplierName,
    'RIF Proveedor': c.supplierRIF || '-',
    'Rubro': c.category,
    'Detalle': c.description,
    'Total USD': c.totalAmountUSD,
    'Abonado USD': c.paidAmountUSD,
    'Resta USD': c.remainingUSD,
    'Resta Bs (BCV)': Number((c.remainingUSD * data.bcvRate).toFixed(2)),
    'Estado': c.status.toUpperCase(),
    'Notas': c.notes || '-'
  }));
  const wsCPP = XLSX.utils.json_to_sheet(cppSheetData);
  XLSX.utils.book_append_sheet(wb, wsCPP, 'Cuentas_Pagar_Proveedores');

  // 6. Sheet: Gastos Operativos del Mes (Alquiler, Servicios, Nómina y Eventuales)
  if (data.gastosOperativos && data.gastosOperativos.length > 0) {
    const gastosSheetData = data.gastosOperativos.map((g, idx) => ({
      'N°': idx + 1,
      'Mes': g.month,
      'Concepto': g.concept,
      'Rubro': g.category,
      'Tipo Gasto': g.type === 'mensual_fijo' ? 'Mensual Fijo' : 'Eventual / Imprevisto',
      'Fecha': new Date(g.date).toLocaleDateString('es-VE'),
      'Fecha Vencimiento': new Date(g.dueDate).toLocaleDateString('es-VE'),
      'Monto USD': g.amountUSD,
      'Monto Bs (BCV)': g.amountBs,
      'Estado': g.status.toUpperCase(),
      'Fecha Pago': g.paymentDate ? new Date(g.paymentDate).toLocaleDateString('es-VE') : '-',
      'Método Pago': g.paymentMethod ? g.paymentMethod.replace('_', ' ').toUpperCase() : '-',
      'Referencia': g.reference || '-',
      'Notas': g.notes || '-'
    }));
    const wsGastos = XLSX.utils.json_to_sheet(gastosSheetData);
    XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos_Operativos_Mes');
  }

  // 7. Sheet: Resumen de Ingresos y Egresos (Flujo de Caja)
  const totalIngresosUSD = data.sales.reduce((sum, s) => sum + s.totalUSD, 0);
  const totalIngresosBs = data.sales.reduce((sum, s) => sum + s.totalBs, 0);
  const totalEgresosUSD = data.expenses.reduce((sum, e) => sum + e.amountUSD, 0);
  const totalEgresosBs = data.expenses.reduce((sum, e) => sum + e.amountBs, 0);
  const totalDeudaFiadosUSD = data.fiados.filter(f => f.status !== 'saldado').reduce((sum, f) => sum + f.remainingDebtUSD, 0);
  const totalDeudaProveedoresUSD = data.cuentasPorPagar.filter(c => c.status !== 'pagada').reduce((sum, c) => sum + c.remainingUSD, 0);

  const balanceSheetData = [
    { 'Concepto': 'TOTAL VENTAS E INGRESOS BRUTOS', 'USD ($)': totalIngresosUSD, 'Bolívares (Bs)': totalIngresosBs },
    { 'Concepto': 'TOTAL COMPRAS Y GASTOS OPERATIVOS', 'USD ($)': totalEgresosUSD, 'Bolívares (Bs)': totalEgresosBs },
    { 'Concepto': 'RESULTADO NETO OPERATIVO', 'USD ($)': totalIngresosUSD - totalEgresosUSD, 'Bolívares (Bs)': totalIngresosBs - totalEgresosBs },
    { 'Concepto': 'CUENTAS POR COBRAR PENDIENTES (FIADOS)', 'USD ($)': totalDeudaFiadosUSD, 'Bolívares (Bs)': totalDeudaFiadosUSD * data.bcvRate },
    { 'Concepto': 'CUENTAS POR PAGAR PENDIENTES (PROVEEDORES)', 'USD ($)': totalDeudaProveedoresUSD, 'Bolívares (Bs)': totalDeudaProveedoresUSD * data.bcvRate },
    { 'Concepto': 'TASA OFICIAL BCV UTILIZADA', 'USD ($)': 1, 'Bolívares (Bs)': data.bcvRate }
  ];
  const wsBalance = XLSX.utils.json_to_sheet(balanceSheetData);
  XLSX.utils.book_append_sheet(wb, wsBalance, 'Flujo_Caja_Resumen');

  // 7. Sheet: Historial de Cierres de Caja
  if (data.cashShiftHistory && data.cashShiftHistory.length > 0) {
    const shiftData = data.cashShiftHistory.map((s, idx) => ({
      'N°': idx + 1,
      'ID Turno': s.id,
      'Apertura': s.openedDateFormatted || s.openedAt,
      'Cierre': s.closedDateFormatted || s.closedAt || 'Abierto',
      'Cajero/Responsable': s.closedBy || s.openedBy || 'Admin',
      'Fondo Inicial ($)': s.initialCashUSD,
      'Fondo Inicial (Bs)': s.initialCashBs,
      'Ventas Turno ($)': s.totalSalesUSD || 0,
      'Ventas Turno (Bs)': s.totalSalesBs || 0,
      'Efectivo Esperado ($)': s.expectedCashUSD || 0,
      'Efectivo Contado ($)': s.countedCashUSD || 0,
      'Diferencia ($)': s.differenceUSD || 0,
      'Diferencia (Bs)': s.differenceBs || 0,
      'Observaciones': s.closedNotes || ''
    }));
    const wsShifts = XLSX.utils.json_to_sheet(shiftData);
    XLSX.utils.book_append_sheet(wb, wsShifts, 'Cierres_de_Caja');
  }

  // Save Excel file
  const filename = `PosVenecia_Contabilidad_Integral_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
};

/**
 * Downloads full system backup as JSON for local storage and device migration
 */
export const downloadSystemBackupJSON = (payload: BackupDataPayload) => {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `PosVenecia_Backup_Completo_${dateStr}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
};

/**
 * Upload backup directly to Google Drive via Google Drive API v3
 */
export const uploadBackupToGoogleDrive = async (
  accessToken: string,
  backupPayload: BackupDataPayload
): Promise<{ fileId: string; fileName: string; webViewLink?: string }> => {
  const dateStr = getLocalDateStr();
  const fileName = `PosVenecia_Backup_${backupPayload.businessInfo.name.replace(/\s+/g, '_')}_${dateStr}.json`;
  const fileContent = JSON.stringify(backupPayload, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Copia de seguridad del sistema comercial PosVenecia generada el ${new Date().toLocaleString('es-VE')}`
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelim;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error ${response.status}: No se pudo subir el archivo a Google Drive`);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    fileName: result.name,
    webViewLink: result.webViewLink
  };
};
