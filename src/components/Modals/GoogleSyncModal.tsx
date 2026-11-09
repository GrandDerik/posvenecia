import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { 
  Cloud, 
  Download, 
  Smartphone, 
  Laptop, 
  Sparkles, 
  RefreshCw, 
  HardDrive, 
  ShieldCheck, 
  LogOut,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Share2,
  Copy,
  FolderLock,
  Database
} from 'lucide-react';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({ isOpen, onClose }) => {
  const { 
    googleUser, 
    loginWithGoogle, 
    logoutGoogle,
    renewGoogleSession,
    isAuthLoading,
    isDriveSyncing,
    driveSyncStatus,
    lastDriveSyncTime,
    syncToGoogleDrive,
    reloadFromGoogleDrive,
    checkRemoteChangesForMultiDevice,
    products, 
    sales, 
    cuentasPorPagar, 
    gastosOperativos,
    cashShiftHistory,
    clients
  } = useApp();

  const { isInstallable, isInstalled, isIOS, isStandalone, install } = usePWAInstall();

  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    try {
      setLocalFeedback('Abriendo autenticación con Google...');
      await loginWithGoogle();
      setLocalFeedback('¡Inicio de sesión exitoso! Tus datos en Google Drive están vinculados.');
      setTimeout(() => setLocalFeedback(null), 4500);
    } catch (err: any) {
      setLocalFeedback(`Error de inicio de sesión: ${err?.message || 'No se pudo conectar con Google'}`);
      setTimeout(() => setLocalFeedback(null), 5000);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
      onClose();
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err);
      onClose();
    }
  };

  const handleManualSync = async () => {
    try {
      setLocalFeedback('Guardando base de datos en tu Google Drive...');
      const ok = await syncToGoogleDrive();
      if (ok) {
        setLocalFeedback('¡Base de datos guardada exitosamente en tu Google Drive!');
      } else {
        setLocalFeedback('No se pudo guardar en Google Drive. Verifica tu conexión.');
      }
      setTimeout(() => setLocalFeedback(null), 4500);
    } catch (err: any) {
      setLocalFeedback(`Error al sincronizar: ${err?.message || 'Error en Google Drive'}`);
      setTimeout(() => setLocalFeedback(null), 4500);
    }
  };

  const handleManualReload = async () => {
    if (!googleUser?.isConnected) {
      setLocalFeedback('Debes iniciar sesión con tu cuenta Google primero.');
      setTimeout(() => setLocalFeedback(null), 4000);
      return;
    }
    try {
      setLocalFeedback('Consultando base de datos en tu Google Drive...');
      const ok = await reloadFromGoogleDrive();
      if (ok) {
        setLocalFeedback('¡Datos recargados y sincronizados exitosamente desde tu Google Drive!');
      } else {
        setLocalFeedback('Tu equipo ya tiene la versión más reciente o no hay datos previos.');
      }
      setTimeout(() => setLocalFeedback(null), 4500);
    } catch (err: any) {
      setLocalFeedback(`Error al recargar: ${err?.message || 'Error en Google Drive'}`);
      setTimeout(() => setLocalFeedback(null), 4500);
    }
  };

  const handleMultiDeviceSync = async () => {
    if (!googleUser?.isConnected) {
      setLocalFeedback('Inicia sesión con Google para sincronizar entre dispositivos.');
      setTimeout(() => setLocalFeedback(null), 4000);
      return;
    }
    try {
      setLocalFeedback('Consultando y sincronizando cambios de otros dispositivos...');
      await checkRemoteChangesForMultiDevice();
      await syncToGoogleDrive();
      setLocalFeedback('¡Sincronizado! Tu dispositivo tiene la información más reciente de todos los equipos.');
      setTimeout(() => setLocalFeedback(null), 4500);
    } catch (e: any) {
      setLocalFeedback(`Error de sincronización: ${e?.message || 'Error en Google Drive'}`);
      setTimeout(() => setLocalFeedback(null), 4500);
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 4000);
      }
    }
  };

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-2">
              <svg className="w-full h-full" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Cuenta Google & Google Drive
              </h3>
              <p className="text-xs text-slate-500">
                Almacenamiento privado en tu Drive personal y acceso multi-dispositivo
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

        {/* Feedback Banner */}
        {localFeedback && (
          <div className="p-3 bg-blue-50 border border-blue-300 text-blue-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{localFeedback}</span>
          </div>
        )}

        {/* SECTION 1: GOOGLE ACCOUNT LOGIN STATUS & MULTI-USER ISOLATION */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Autenticación Google
            </span>
            {googleUser?.isConnected ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cuenta Conectada
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                Sin Sesión Activa
              </span>
            )}
          </div>

          {googleUser?.isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {googleUser.photoUrl ? (
                  <img 
                    src={googleUser.photoUrl} 
                    alt={googleUser.name} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-lg shadow-sm shrink-0 border-2 border-white">
                    {googleUser.name ? googleUser.name.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-slate-900 text-sm truncate">
                    {googleUser.name}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 truncate font-mono">
                    {googleUser.email}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    ID: {googleUser.uid.substring(0, 16)}...
                  </div>
                </div>
              </div>

              {driveSyncStatus === 'token_expired' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Tu token de acceso a Google Drive ha vencido (~60 min).</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Los respaldos automáticos se encuentran en pausa hasta que renueves la autorización de Google.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setLocalFeedback('Renovando autorización con Google Drive...');
                      const ok = await renewGoogleSession();
                      if (ok) {
                        setLocalFeedback('¡Sesión de Google Drive renovada exitosamente!');
                      } else {
                        setLocalFeedback('No se pudo renovar. Por favor intenta de nuevo.');
                      }
                      setTimeout(() => setLocalFeedback(null), 4000);
                    }}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Renovar Sesión de Google Drive Ahora</span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                <span className="text-[11px] text-slate-500">
                  ¿Deseas cambiar de cuenta o desconectar?
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Inicia sesión con tu cuenta personal de Google. Tu catálogo de productos, inventario, ventas y gastos se almacenarán de forma independiente en tu propio Google Drive, iniciando completamente en blanco para nuevos usuarios.
              </p>

              <button
                type="button"
                disabled={isAuthLoading}
                onClick={handleLogin}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                </svg>
                <span>{isAuthLoading ? 'Conectando con Google...' : 'Iniciar Sesión con Google'}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                title="Salir al menú principal de inicio de sesión"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Volver a la Pantalla de Inicio de Sesión (Login)</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 2: GOOGLE DRIVE DIRECT STORAGE */}
        <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Database className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Almacenamiento en Google Drive
                </h4>
                <p className="text-[11px] text-slate-500">
                  Archivo privado: <span className="font-mono font-bold text-slate-700">posvenecia_database.json</span>
                </p>
              </div>
            </div>

            {/* Sync Badge */}
            {isDriveSyncing ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Sincronizando
              </span>
            ) : driveSyncStatus === 'synced' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Al día en Drive
              </span>
            ) : driveSyncStatus === 'error' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-600" /> Requiere sincronizar
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Sin sincronizar
              </span>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Ubicación en Google Drive:</span>
              <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                <FolderLock className="w-3 h-3 text-amber-600" /> Carpeta Privada de App (appDataFolder)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Último respaldo en Drive:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {lastDriveSyncTime || 'Aún no respaldado'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-700">
              <div>📦 {products.length} Productos/Servicios</div>
              <div>🛒 {sales.length} Ventas registradas</div>
              <div>👥 {clients.length} Clientes habituales</div>
              <div>💳 {cuentasPorPagar.length} Cuentas por pagar</div>
              <div>🏢 {gastosOperativos.length} Gastos del mes</div>
              <div>🔒 Multi-usuario aislado</div>
            </div>
          </div>

          {/* Drive Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isDriveSyncing || !googleUser?.isConnected}
              onClick={handleManualSync}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDriveSyncing ? 'animate-spin' : ''}`} />
              <span>{isDriveSyncing ? 'Guardando en Drive...' : 'Guardar en Google Drive'}</span>
            </button>

            <button
              type="button"
              disabled={isDriveSyncing || !googleUser?.isConnected}
              onClick={handleManualReload}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Descargar la base de datos guardada en tu Google Drive"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Cargar desde Drive</span>
            </button>
          </div>

          {/* Multi-Device Synchronize Card */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="text-xs font-extrabold text-emerald-950">
                Sincronización Multi-Dispositivo con una Sola Cuenta
              </div>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Puedes abrir PosVenecia en tu teléfono, tablet y computadora de caja con esta misma cuenta Google. Toda la información de ventas, inventario, cierres de caja y cuentas por pagar se mantiene idéntica en todos tus dispositivos.
            </p>
            <button
              type="button"
              disabled={isDriveSyncing || !googleUser?.isConnected}
              onClick={handleMultiDeviceSync}
              className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDriveSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar y Comprobar Cambios de Otros Dispositivos</span>
            </button>
          </div>
        </div>

        {/* SECTION 3: INSTALAR APLICACIÓN WEB (PWA) */}
        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200/90 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Smartphone className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Instalar PosVenecia en este Dispositivo
                </h4>
                <p className="text-[11px] text-slate-600">
                  Accede desde la pantalla de inicio o escritorio sin barras del navegador
                </p>
              </div>
            </div>
          </div>

          {isStandalone || isInstalled ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>¡PosVenecia ya está instalada como aplicación web en este dispositivo!</span>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Instalar Aplicación en este Dispositivo</span>
            </button>
          ) : isIOS ? (
            <div className="bg-white/90 p-2.5 rounded-xl border border-blue-200 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Instalar en iPhone o iPad (Safari):</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Presiona <strong>Compartir</strong> (cuadrado con flecha hacia arriba) y selecciona <strong>"Agregar a Inicio"</strong>.
              </p>
            </div>
          ) : (
            <div className="bg-white/90 p-2.5 rounded-xl border border-blue-200 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-blue-900">
                Instalar en Google Chrome o Android:
              </div>
              <p className="text-[11px] text-slate-600">
                Presiona el icono de instalar en la barra de direcciones de Chrome, o pulsa el menú (⋮) y selecciona <strong>"Instalar aplicación"</strong>.
              </p>
            </div>
          )}

          {/* Share App Link across devices */}
          <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-xs text-slate-600">
            <span>Abrir en otro teléfono o computadora:</span>
            <button
              type="button"
              onClick={handleCopyAppUrl}
              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-1 flex justify-end">
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
