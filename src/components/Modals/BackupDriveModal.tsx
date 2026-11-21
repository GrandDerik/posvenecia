import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { 
  Cloud, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  Sparkles, 
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { 
  downloadComprehensiveAccountingExcel, 
  downloadSystemBackupJSON, 
  sanitizeBackupPayload
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
    googleUser,
    loginWithGoogle,
    logoutGoogle,
    syncToGoogleDrive,
    reloadFromGoogleDrive,
    renewGoogleSession,
    driveSyncStatus,
    isDriveSyncing,
    lastDriveSyncTime,
    restoreDatabase,
    getFullDatabasePayload
  } = useApp();

  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const scheduleTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownloadExcel = async () => {
    setIsExporting(true);
    try {
      const full = await getFullDatabasePayload();
      const filename = downloadComprehensiveAccountingExcel({
        sales: full.sales,
        expenses: full.expenses,
        products: full.products,
        fiados: full.fiados,
        cuentasPorPagar: full.cuentasPorPagar,
        gastosOperativos: full.gastosOperativos,
        cashShiftHistory: full.cashShiftHistory,
        suppliers: full.suppliers,
        loans: full.loans,
        creditNotes: full.creditNotes,
        inventoryDischarges: full.inventoryDischarges,
        kardex: full.kardex,
        bcvRate: full.bcvRate,
        businessInfo: full.businessInfo
      });
      setDownloadFeedback(`Descargado con éxito (histórico completo): ${filename}`);
      scheduleTimer(() => setDownloadFeedback(null), 4000);
    } catch (err: any) {
      setDownloadFeedback(`Error al generar reporte Excel: ${err?.message || 'Error desconocido'}`);
      scheduleTimer(() => setDownloadFeedback(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadJSON = async () => {
    setIsExporting(true);
    try {
      const full = await getFullDatabasePayload();
      const filename = downloadSystemBackupJSON(full);
      setDownloadFeedback(`Copia JSON completa descargada: ${filename}`);
      scheduleTimer(() => setDownloadFeedback(null), 4000);
    } catch (err: any) {
      setDownloadFeedback(`Error al generar backup: ${err?.message || 'Error desconocido'}`);
      scheduleTimer(() => setDownloadFeedback(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_BACKUP_BYTES) {
      setDownloadFeedback('El archivo de respaldo excede el límite máximo permitido (25 MB).');
      scheduleTimer(() => setDownloadFeedback(null), 5000);
      return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') {
          throw new Error('El contenido del archivo no es un JSON válido.');
        }
        const parsed = sanitizeBackupPayload(JSON.parse(content));

        await restoreDatabase(parsed);

        setDownloadFeedback('¡Copia de seguridad completa restaurada en Cloud Firestore con éxito!');
        scheduleTimer(() => setDownloadFeedback(null), 4000);
      } catch (err: any) {
        setDownloadFeedback(`Error al restaurar: ${err?.message || 'Error desconocido'}`);
        scheduleTimer(() => setDownloadFeedback(null), 5000);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.onerror = () => {
      setIsRestoring(false);
      setDownloadFeedback('Error al leer el archivo JSON seleccionado.');
      scheduleTimer(() => setDownloadFeedback(null), 5000);
    };
    reader.readAsText(file);
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setSyncStatus('Conectando con Google...');
      await loginWithGoogle();
      setSyncStatus('¡Google Drive conectado correctamente!');
      scheduleTimer(() => setSyncStatus(null), 3500);
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'No se pudo conectar'}`);
      scheduleTimer(() => setSyncStatus(null), 4000);
    }
  };

  const handleRenewSession = async () => {
    try {
      setSyncStatus('Reconectando sesión de Google Drive...');
      const ok = await renewGoogleSession();
      if (ok) {
        setSyncStatus('¡Sesión reconectada y datos actualizados desde Google Drive!');
      } else {
        setSyncStatus('No se pudo reconectar la sesión.');
      }
      scheduleTimer(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'Error al renovar sesión'}`);
      scheduleTimer(() => setSyncStatus(null), 4000);
    }
  };

  const handleReloadFromDrive = async () => {
    setIsSyncingLocal(true);
    setSyncStatus('Descargando y sincronizando versión más reciente de Google Drive...');
    try {
      const ok = await reloadFromGoogleDrive();
      if (ok) {
        setSyncStatus('¡Base de datos sincronizada con Google Drive exitosamente!');
      } else {
        setSyncStatus('La base de datos ya está al día con la nube.');
      }
      scheduleTimer(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'Error al descargar datos'}`);
      scheduleTimer(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncingLocal(false);
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
      scheduleTimer(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      setSyncStatus(`Error: ${err?.message || 'Error al respaldar'}`);
      scheduleTimer(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      await logoutGoogle();
      onClose();
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error(e);
      }
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-drive-modal-title"
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Fixed Header (always visible on mobile) */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 shrink-0 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
              <Cloud className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <h3 id="backup-drive-modal-title" className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                Respaldo en Google Drive & Descargas Contables
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Histórico integral de productos, compras, ventas, cuentas por pagar y flujo de caja
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-9 h-9 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">

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
                {driveSyncStatus === 'token_expired' ? (
                  <button
                    type="button"
                    disabled={isDriveSyncing || isSyncingLocal}
                    onClick={handleRenewSession}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${(isDriveSyncing || isSyncingLocal) ? 'animate-spin' : ''}`} />
                    <span>⚠️ Reconectar Sesión y Sincronizar</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={isDriveSyncing || isSyncingLocal}
                  onClick={handleReloadFromDrive}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Descargar y combinar la versión más reciente guardada desde tu teléfono u otro equipo"
                >
                  <Download className={`w-3.5 h-3.5 ${(isDriveSyncing || isSyncingLocal) ? 'animate-spin' : ''}`} />
                  <span>Traer Cambios de la Nube</span>
                </button>

                <button
                  type="button"
                  disabled={isDriveSyncing || isSyncingLocal}
                  onClick={handleSyncToDrive}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(isDriveSyncing || isSyncingLocal) ? 'animate-spin' : ''}`} />
                  <span>{(isDriveSyncing || isSyncingLocal) ? 'Sincronizando...' : 'Subir Copia a Google Drive'}</span>
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
            disabled={isExporting || isRestoring}
            onClick={handleDownloadExcel}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Recopilando histórico desde Firestore...' : 'Descargar Libro Contable Completo (.xlsx)'}</span>
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
              disabled={isExporting || isRestoring}
              onClick={handleDownloadJSON}
              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generando Backup...' : 'Descargar Backup (.json)'}</span>
            </button>

            <label className={`flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 ${(isExporting || isRestoring) ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>{isRestoring ? 'Restaurando en la nube...' : 'Restaurar desde (.json)'}</span>
              <input
                type="file"
                accept=".json"
                disabled={isExporting || isRestoring}
                onChange={handleRestoreJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>

        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200/80 hover:bg-slate-300/80 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
