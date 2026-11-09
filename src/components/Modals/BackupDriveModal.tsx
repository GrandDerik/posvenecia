import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Cloud, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  X, 
  Sparkles, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { 
  downloadComprehensiveAccountingExcel, 
  downloadSystemBackupJSON, 
  BackupDataPayload 
} from '../../utils/cloudBackupUtils';

interface BackupDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupDriveModal: React.FC<BackupDriveModalProps> = ({ isOpen, onClose }) => {
  const { 
    products, 
    sales, 
    expenses, 
    fiados, 
    cuentasPorPagar, 
    gastosOperativos,
    clients, 
    businessInfo, 
    bcvRate,
    googleUser,
    loginWithGoogle,
    logoutGoogle,
    syncToGoogleDrive,
    isDriveSyncing,
    lastDriveSyncTime,
    cashShift,
    cashShiftHistory,
    restoreDatabase
  } = useApp();

  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPayload: BackupDataPayload = {
    version: '1.2',
    timestamp: new Date().toISOString(),
    businessInfo,
    bcvRate,
    products,
    sales,
    expenses,
    fiados,
    cuentasPorPagar,
    gastosOperativos,
    clients,
    cashShift,
    cashShiftHistory
  };

  const handleDownloadExcel = () => {
    try {
      const filename = downloadComprehensiveAccountingExcel({
        sales,
        expenses,
        products,
        fiados,
        cuentasPorPagar,
        gastosOperativos,
        cashShiftHistory,
        bcvRate,
        businessInfo
      });
      setDownloadFeedback(`Descargado con éxito: ${filename}`);
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (err: any) {
      setDownloadFeedback(`Error al generar reporte Excel: ${err.message}`);
      setTimeout(() => setDownloadFeedback(null), 5000);
    }
  };

  const handleDownloadJSON = () => {
    try {
      const filename = downloadSystemBackupJSON(currentPayload);
      setDownloadFeedback(`Copia JSON descargada: ${filename}`);
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (err: any) {
      setDownloadFeedback(`Error al generar backup: ${err.message}`);
      setTimeout(() => setDownloadFeedback(null), 5000);
    }
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as BackupDataPayload;

        if (!parsed.products || !parsed.sales) {
          throw new Error('El archivo no tiene el formato de copia de seguridad de PosVenecia.');
        }

        await restoreDatabase(parsed);

        setDownloadFeedback('¡Copia de seguridad restaurada e importada con éxito!');
        setTimeout(() => setDownloadFeedback(null), 4000);
      } catch (err: any) {
        setDownloadFeedback(`Error al restaurar: ${err.message}`);
        setTimeout(() => setDownloadFeedback(null), 5000);
      }
    };
    reader.readAsText(file);
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setSyncStatus('Conectando con Google...');
      await loginWithGoogle();
      setSyncStatus('¡Google Drive conectado correctamente!');
      setTimeout(() => setSyncStatus(null), 3500);
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'No se pudo conectar'}`);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  const handleSyncToDrive = async () => {
    setIsSyncingLocal(true);
    setSyncStatus('Subiendo base de datos a tu Google Drive personal...');
    try {
      const ok = await syncToGoogleDrive();
      if (ok) {
        setSyncStatus('¡Respaldo subido a tu Google Drive exitosamente!');
      } else {
        setSyncStatus('No se pudo subir a Google Drive. Inicia sesión primero.');
      }
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'Error al respaldar'}`);
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      await logoutGoogle();
      onClose();
    } catch (e) {
      console.error(e);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
              <Cloud className="w-6 h-6" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Respaldo en Google Drive & Descargas Contables
              </h3>
              <p className="text-xs text-slate-500">
                Histórico integral de productos, compras, ventas, cuentas por pagar y flujo de caja
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Feedback message banner */}
        {downloadFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{downloadFeedback}</span>
          </div>
        )}

        {syncStatus && (
          <div className="p-3 bg-blue-50 border border-blue-300 text-blue-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* SECTION 1: GOOGLE DRIVE CLOUD SYNC */}
        <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/70 rounded-2xl p-4 border border-blue-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.25z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.25z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Respaldo en la Nube con Google Drive</h4>
                <p className="text-[11px] text-slate-500">
                  {googleUser?.isConnected 
                    ? `Conectado como: ${googleUser.email}` 
                    : 'Guarda tus datos de forma segura en tu propio Google Drive'}
                </p>
              </div>
            </div>

            {googleUser?.isConnected && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Check className="w-3 h-3" /> Conectado
              </span>
            )}
          </div>

          {lastDriveSyncTime && (
            <div className="text-[11px] text-slate-600 bg-white/80 px-3 py-1.5 rounded-xl border border-blue-200/50 flex items-center justify-between">
              <span>Última sincronización a Drive:</span>
              <strong className="font-mono text-slate-800">{lastDriveSyncTime}</strong>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {googleUser?.isConnected ? (
              <>
                <button
                  type="button"
                  disabled={isDriveSyncing || isSyncingLocal}
                  onClick={handleSyncToDrive}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(isDriveSyncing || isSyncingLocal) ? 'animate-spin' : ''}`} />
                  <span>{(isDriveSyncing || isSyncingLocal) ? 'Sincronizando...' : 'Subir Copia a Google Drive Ahora'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar Sesión Google
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Conectar con Google</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION 2: EXCEL ACCOUNTING WORKBOOK */}
        <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Descarga de Datos Contables & Histórico (.xlsx)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Libro de Ventas SENIAT, Compras/Gastos, Inventario, Fiados y Cuentas por Pagar en un solo archivo Excel con pestañas
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div>✓ {sales.length} Ventas registradas</div>
            <div>✓ {expenses.length} Compras y gastos</div>
            <div>✓ {products.length} Productos/Servicios</div>
            <div>✓ {fiados.length} Cuentas fiadas</div>
            <div>✓ {cuentasPorPagar.length} Cuentas por pagar</div>
            <div>✓ Balances a tasa BCV</div>
          </div>

          <button
            type="button"
            onClick={handleDownloadExcel}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Libro Contable Completo (.xlsx)</span>
          </button>
        </div>

        {/* SECTION 3: SYSTEM BACKUP & RESTORE (JSON) */}
        <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
              <HardDrive className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Copia de Seguridad y Migración (.json)
              </h4>
              <p className="text-[11px] text-slate-500">
                Guarde un archivo para restaurar la aplicación completa en cualquier teléfono, tablet o computadora
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadJSON}
              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Backup (.json)</span>
            </button>

            <label className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200">
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Restaurar desde (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
