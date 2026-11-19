import React, { useState, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Info, X, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { formatBs } from './utils/exportUtils';
import { firebaseConfig } from './config/firebaseConfig';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import firestoreRulesSource from '../firestore.rules?raw';

// Lazy-loaded tab views for fast initial startup and optimal code splitting
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const TasaBCVView = lazy(() => import('./components/TasaBCVView').then(m => ({ default: m.TasaBCVView })));
const POSView = lazy(() => import('./components/POSView').then(m => ({ default: m.POSView })));
const ProductsView = lazy(() => import('./components/ProductsView').then(m => ({ default: m.ProductsView })));
const ClientesView = lazy(() => import('./components/ClientesView').then(m => ({ default: m.ClientesView })));
const FiadosView = lazy(() => import('./components/FiadosView').then(m => ({ default: m.FiadosView })));
const CuentasPorPagarView = lazy(() => import('./components/CuentasPorPagarView').then(m => ({ default: m.CuentasPorPagarView })));
const TesoreriaView = lazy(() => import('./components/TesoreriaView').then(m => ({ default: m.TesoreriaView })));
const ContabilidadView = lazy(() => import('./components/ContabilidadView').then(m => ({ default: m.ContabilidadView })));

// Lazy-loaded global modals (downloaded on demand only when opened)
const CuadreCajaModal = lazy(() => import('./components/CuadreCajaModal').then(m => ({ default: m.CuadreCajaModal })));
const AperturaCajaModal = lazy(() => import('./components/Modals/AperturaCajaModal').then(m => ({ default: m.AperturaCajaModal })));
const CierreCajaModal = lazy(() => import('./components/Modals/CierreCajaModal').then(m => ({ default: m.CierreCajaModal })));
const PerfilNegocioModal = lazy(() => import('./components/Modals/PerfilNegocioModal').then(m => ({ default: m.PerfilNegocioModal })));
const NotaCreditoModal = lazy(() => import('./components/Modals/NotaCreditoModal').then(m => ({ default: m.NotaCreditoModal })));
const DesincorporarStockModal = lazy(() => import('./components/Modals/DesincorporarStockModal').then(m => ({ default: m.DesincorporarStockModal })));
const ComprobanteNotaCreditoModal = lazy(() => import('./components/Modals/ComprobanteNotaCreditoModal').then(m => ({ default: m.ComprobanteNotaCreditoModal })));
const RatePriceRecalcModal = lazy(() => import('./components/Modals/RatePriceRecalcModal').then(m => ({ default: m.RatePriceRecalcModal })));

const ViewLoaderFallback: React.FC = () => (
  <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-bold tracking-wide">Cargando módulo...</span>
  </div>
);

const AppContent: React.FC = () => {
  const {
    activeTab,
    bcvRate,
    businessInfo,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isCuadreModalOpen,
    isAperturaModalOpen,
    isCierreModalOpen,
    isDischargeModalOpen,
    rateChangeModalState,
    googleUser,
    isAuthLoading,
    loginWithGoogle,
    isOnline,
    isCreditNoteModalOpen,
    setIsCreditNoteModalOpen,
    selectedSaleForCreditNote,
    setSelectedSaleForCreditNote,
    lastCompletedCreditNote,
    setLastCompletedCreditNote,
    notification,
    dismissNotification,
    missingRuleCollections,
    retryFirestoreSubscriptions
  } = useApp();

  const [dismissedRulesBanner, setDismissedRulesBanner] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const { updateAvailable, isUpdating, applyUpdate, dismissUpdate } = usePWAUpdate();

  const handleCopyFirestoreRules = async () => {
    try {
      await navigator.clipboard.writeText(firestoreRulesSource);
      setCopiedRules(true);
      setTimeout(() => setCopiedRules(false), 3000);
    } catch {
      setCopiedRules(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] text-slate-700 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold tracking-wide text-slate-600">
          Conectando con tu cuenta y Cloud Firestore...
        </p>
      </div>
    );
  }

  // Require authenticated Google user for strict UID-isolated Cloud Firestore sync
  if (!googleUser) {
    return (
      <LoginView
        onLoginWithGoogle={loginWithGoogle}
        isOnline={isOnline}
        bcvRate={bcvRate}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-[#EEF2F7] text-slate-900">
      {/* Top Navbar with BCV ticker and tabs */}
      <Navbar />

      {/* Actionable Banner when external Firebase Console still runs older firestore.rules */}
      {missingRuleCollections.length > 0 && !dismissedRulesBanner && (() => {
        const targetProject = firebaseConfig.projectId || 'tu-proyecto';
        const targetDb = firebaseConfig.firestoreDatabaseId || '(default)';
        const rulesConsoleUrl = firebaseConfig.projectId
          ? `https://console.firebase.google.com/project/${encodeURIComponent(targetProject)}/firestore/databases/${encodeURIComponent(targetDb)}/rules`
          : '';
        return (
          <div className="max-w-6xl w-full mx-auto px-3 sm:px-6 pt-3">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <div className="font-extrabold">
                    Actualiza las reglas de Firestore para habilitar: {missingRuleCollections.join(', ')}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    En Firebase Console, asegúrate de seleccionar la base de datos{' '}
                    <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded break-all">{targetDb}</code>{' '}
                    (no <code className="font-mono">(default)</code> si es diferente) en el proyecto{' '}
                    <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{targetProject}</code>, pega las reglas en <strong>Reglas → Publicar</strong> y luego pulsa <strong>Reintentar</strong>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyFirestoreRules}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRules ? 'Reglas copiadas' : 'Copiar firestore.rules'}</span>
                </button>
                {rulesConsoleUrl && (
                  <a
                    href={rulesConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Reglas</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={retryFirestoreSubscriptions}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedRulesBanner(true)}
                  aria-label="Cerrar aviso"
                  className="p-1.5 rounded-lg hover:bg-amber-200/60 text-amber-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PWA New Version Available Floating Banner */}
      {updateAvailable && (
        <div
          role="status"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl border border-blue-500/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <RefreshCw className={`w-4 h-4 text-blue-400 shrink-0 mt-0.5 ${isUpdating ? 'animate-spin' : ''}`} />
              <div className="min-w-0">
                <p className="font-extrabold text-white leading-tight">Nueva versión disponible</p>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  Actualiza para cargar los últimos cambios sin borrar caché.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isUpdating}
                onClick={applyUpdate}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                {isUpdating ? 'Actualizando...' : 'Actualizar'}
              </button>
              <button
                type="button"
                onClick={dismissUpdate}
                aria-label="Cerrar aviso de actualización"
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Dismissible Notification Banner / Toast */}
      {notification && (
        <div
          role="alert"
          className="fixed top-20 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-top-2"
        >
          <div
            className={`rounded-2xl p-3.5 shadow-xl border flex items-start gap-3 text-xs ${
              notification.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : notification.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-blue-50 border-blue-300 text-blue-950'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
              {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold leading-snug">{notification.title}</div>
              <div className="mt-0.5 opacity-90 leading-relaxed break-words">{notification.message}</div>
            </div>
            <button
              type="button"
              onClick={dismissNotification}
              aria-label="Cerrar notificación"
              className="p-1 rounded-lg hover:bg-black/5 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content (Code-split per view) */}
      <main className="flex-1 pb-12">
        <Suspense fallback={<ViewLoaderFallback />}>
          {activeTab === 'inicio' && <DashboardView />}
          {activeTab === 'tasa' && <TasaBCVView />}
          {activeTab === 'vender' && <POSView />}
          {activeTab === 'productos' && <ProductsView />}
          {activeTab === 'clientes' && <ClientesView />}
          {activeTab === 'fiados' && <FiadosView />}
          {activeTab === 'cuentas_por_pagar' && <CuentasPorPagarView />}
          {activeTab === 'tesoreria' && <TesoreriaView />}
          {activeTab === 'contabilidad' && <ContabilidadView />}
        </Suspense>
      </main>

      {/* On-demand Global Modals (only loaded & mounted when open) */}
      <Suspense fallback={null}>
        {isCuadreModalOpen && <CuadreCajaModal />}
        {isAperturaModalOpen && <AperturaCajaModal />}
        {isCierreModalOpen && <CierreCajaModal />}

        {isProfileModalOpen && (
          <PerfilNegocioModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
          />
        )}

        {isCreditNoteModalOpen && (
          <NotaCreditoModal
            isOpen={isCreditNoteModalOpen}
            onClose={() => {
              setIsCreditNoteModalOpen(false);
              setSelectedSaleForCreditNote(null);
            }}
            initialSale={selectedSaleForCreditNote}
          />
        )}

        {lastCompletedCreditNote && (
          <ComprobanteNotaCreditoModal
            creditNote={lastCompletedCreditNote}
            onClose={() => setLastCompletedCreditNote(null)}
            businessInfo={businessInfo}
          />
        )}

        {isDischargeModalOpen && <DesincorporarStockModal />}

        {rateChangeModalState.isOpen && <RatePriceRecalcModal />}
      </Suspense>

      {/* Footer */}
      <footer className="border-t py-4 px-4 sm:px-8 text-xs bg-white/85 backdrop-blur-xs border-[#DCE4F0] text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#0B1528]">PosVenecia</span>
            <span>•</span>
            <span>Sistema POS & Comercio Retail</span>
            <span>•</span>
            <span className="text-blue-600 font-mono-numbers font-bold">Tasa BCV: Bs. {formatBs(bcvRate)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Adaptado a Normativa SENIAT Venezuela (IVA 16%, IGTF 3%)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
