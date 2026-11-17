import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { TasaBCVView } from './components/TasaBCVView';
import { POSView } from './components/POSView';
import { ProductsView } from './components/ProductsView';
import { ClientesView } from './components/ClientesView';
import { FiadosView } from './components/FiadosView';
import { CuentasPorPagarView } from './components/CuentasPorPagarView';
import { ContabilidadView } from './components/ContabilidadView';
import { CuadreCajaModal } from './components/CuadreCajaModal';
import { AperturaCajaModal } from './components/Modals/AperturaCajaModal';
import { CierreCajaModal } from './components/Modals/CierreCajaModal';
import { PerfilNegocioModal } from './components/Modals/PerfilNegocioModal';
import { NotaCreditoModal } from './components/Modals/NotaCreditoModal';
import { DesincorporarStockModal } from './components/Modals/DesincorporarStockModal';
import { ComprobanteNotaCreditoModal } from './components/Modals/ComprobanteNotaCreditoModal';
import { LoginView } from './components/LoginView';
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Info, X, Copy, Check } from 'lucide-react';
import { formatBs } from './utils/exportUtils';
import firestoreRulesSource from '../firestore.rules?raw';

const AppContent: React.FC = () => {
  const { 
    activeTab, 
    bcvRate, 
    businessInfo, 
    isProfileModalOpen, 
    setIsProfileModalOpen,
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
    missingRuleCollections
  } = useApp();

  const [dismissedRulesBanner, setDismissedRulesBanner] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

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
      {missingRuleCollections.length > 0 && !dismissedRulesBanner && (
        <div className="max-w-6xl w-full mx-auto px-3 sm:px-6 pt-3">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <div className="font-extrabold">
                  Actualiza tus reglas de Firestore para habilitar: {missingRuleCollections.join(', ')}
                </div>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Copia el archivo <code className="font-mono font-bold">firestore.rules</code> actualizado y pégalo en <strong>Firebase Console → Firestore Database → Reglas → Publicar</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyFirestoreRules}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRules ? 'Reglas copiadas' : 'Copiar firestore.rules'}</span>
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

      {/* Main Tab Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'inicio' && <DashboardView />}
        {activeTab === 'tasa' && <TasaBCVView />}
        {activeTab === 'vender' && <POSView />}
        {activeTab === 'productos' && <ProductsView />}
        {activeTab === 'clientes' && <ClientesView />}
        {activeTab === 'fiados' && <FiadosView />}
        {activeTab === 'cuentas_por_pagar' && <CuentasPorPagarView />}
        {activeTab === 'contabilidad' && <ContabilidadView />}
      </main>

      {/* Cuadre de Caja & Apertura / Cierre Modals */}
      <CuadreCajaModal />
      <AperturaCajaModal />
      <CierreCajaModal />

      {/* Perfil del Negocio Modal */}
      <PerfilNegocioModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Nota de Crédito / Devolución Modal */}
      <NotaCreditoModal
        isOpen={isCreditNoteModalOpen}
        onClose={() => {
          setIsCreditNoteModalOpen(false);
          setSelectedSaleForCreditNote(null);
        }}
        initialSale={selectedSaleForCreditNote}
      />

      {/* Comprobante de Nota de Crédito Modal (después de emitir) */}
      {lastCompletedCreditNote && (
        <ComprobanteNotaCreditoModal
          creditNote={lastCompletedCreditNote}
          onClose={() => setLastCompletedCreditNote(null)}
          businessInfo={businessInfo}
        />
      )}

      {/* Desincorporación de Inventario Modal */}
      <DesincorporarStockModal />

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
