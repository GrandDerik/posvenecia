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
import { ShieldCheck } from 'lucide-react';
import { formatBs } from './utils/exportUtils';

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
    setLastCompletedCreditNote
  } = useApp();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold tracking-wide text-slate-300">
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
    <div className="min-h-screen flex flex-col relative bg-slate-100 text-slate-800">
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
