import React from 'react';
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
import { ShieldCheck, Heart, CheckCircle2, X, RotateCw } from 'lucide-react';
import { formatBs } from './utils/exportUtils';

const AppContent: React.FC = () => {
  const { 
    activeTab, 
    bcvRate, 
    businessInfo, 
    isProfileModalOpen, 
    setIsProfileModalOpen,
    googleUser,
    loginWithGoogle,
    isSessionStarted,
    startLocalSession,
    isOnline,
    offlineSyncNotification,
    dismissOfflineNotification,
    driveSyncStatus,
    renewGoogleSession,
    isDriveSyncing
  } = useApp();

  // Show modern LoginView if user has not logged in with Google or entered local session
  if (!isSessionStarted && !googleUser) {
    return (
      <LoginView
        onLoginWithGoogle={loginWithGoogle}
        onContinueAsGuest={startLocalSession}
        isOnline={isOnline}
        bcvRate={bcvRate}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-slate-100 text-slate-800">
      {/* Offline Sync Reconnection Toast Notification */}
      {offlineSyncNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 text-emerald-200 border border-emerald-500/40 p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-5 max-w-md">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <div className="font-extrabold text-white">Conexión Restablecida</div>
            <div className="text-slate-300 mt-0.5">{offlineSyncNotification}</div>
          </div>
          <button 
            onClick={dismissOfflineNotification} 
            className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navbar with BCV ticker and tabs */}
      <Navbar />


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

      {/* Footer */}
      <footer className="border-t py-4 px-4 sm:px-8 text-xs bg-white border-slate-200 text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-blue-900">PosVenecia</span>
            <span>•</span>
            <span>Sistema POS & Comercio Retail</span>
            <span>•</span>
            <span className="text-blue-500 font-mono font-bold">Tasa BCV: Bs. {formatBs(bcvRate)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
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
