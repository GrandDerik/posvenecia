import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutGrid, 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  Users, 
  UserCheck,
  CreditCard,
  FileSpreadsheet, 
  RotateCw,
  Edit2,
  Check,
  User,
  Sparkles,
  Coins,
  Wifi,
  WifiOff,
  Lock,
  LogOut,
  Cloud
} from 'lucide-react';
import { formatBs, formatUSD } from '../utils/exportUtils';
import { GoogleSyncModal } from './Modals/GoogleSyncModal';

export const Navbar: React.FC = () => {
  const { 
    bcvRate, 
    updateBcvRate, 
    fetchLiveRate,
    isFetchingLiveRate,
    bcvEuroRate,
    updateBcvEuroRate,
    fetchLiveEuroRate,
    isFetchingLiveEuroRate,
    baseCurrency,
    clients,
    cuentasPorPagar,
    gastosOperativos,
    activeTab, 
    setActiveTab, 
    cart, 
    fiados, 
    sales,
    businessInfo,
    setIsProfileModalOpen,
    googleUser,
    isGoogleModalOpen,
    setIsGoogleModalOpen,
    isCashRegisterOpen,
    setIsAperturaModalOpen,
    setIsCierreModalOpen,
    isOnline,
    logoutGoogle,
    firestoreSyncStatus
  } = useApp();

  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(bcvRate.toString());
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [displayedCurrencyRate, setDisplayedCurrencyRate] = useState<'USD' | 'EUR'>('USD');

  const activeFiadosCount = fiados.filter(f => f.status !== 'saldado').length;
  const activeCuentasPorPagarCount =
    cuentasPorPagar.filter(c => c.status !== 'pagada').length +
    gastosOperativos.filter(g => g.status !== 'pagado').length;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempRate);
    if (!isNaN(val) && val > 0) {
      if (displayedCurrencyRate === 'USD') {
        updateBcvRate(val);
      } else {
        updateBcvEuroRate(val);
      }
      setIsEditingRate(false);
    }
  };

  const handleLiveBcvFetch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (displayedCurrencyRate === 'USD') {
        const rate = await fetchLiveRate();
        setSyncFeedback(`Dólar BCV oficial: Bs. ${formatBs(rate)}`);
      } else {
        const rate = await fetchLiveEuroRate();
        setSyncFeedback(`Euro BCV oficial: Bs. ${formatBs(rate)}`);
      }
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch {
      setSyncFeedback('Error al consultar BCV');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  interface NavItem {
    id: 'inicio' | 'tasa' | 'vender' | 'productos' | 'clientes' | 'fiados' | 'cuentas_por_pagar' | 'contabilidad';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    seniat?: boolean;
  }

  const navItems: NavItem[] = [
    { id: 'inicio', label: 'Inicio', icon: LayoutGrid },
    { id: 'tasa', label: 'Tasa', icon: TrendingUp },
    { id: 'vender', label: 'Vender', icon: ShoppingCart, badge: cartItemCount > 0 ? cartItemCount : undefined },
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'clientes', label: 'Clientes', icon: UserCheck },
    { id: 'fiados', label: 'Fiados', icon: Users, badge: activeFiadosCount > 0 ? activeFiadosCount : undefined },
    { id: 'cuentas_por_pagar', label: 'Por Pagar', icon: CreditCard, badge: activeCuentasPorPagarCount > 0 ? activeCuentasPorPagarCount : undefined },
    { id: 'contabilidad', label: 'Contabilidad', icon: FileSpreadsheet, seniat: true },
  ];

  return (
    <header className="bg-slate-50/60 sticky top-0 z-30 pt-2 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-2.5">
        
        {/* Top Branding & Rate Header */}
        <div className="flex items-center justify-between py-1">
          {/* Logo with Stylized V & PosVenecia Branding */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none" 
            onClick={() => setActiveTab('inicio')}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-white shadow-sm relative overflow-hidden group shrink-0">
              {businessInfo.logoUrl ? (
                <img src={businessInfo.logoUrl} alt={businessInfo.name} className="w-full h-full object-cover" />
              ) : (
                <>
                  <div className="flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span className="text-[8px] font-black tracking-tighter text-blue-400 -mt-1 uppercase">
                    POS
                  </span>
                </>
              )}
            </div>

            <div className="leading-tight">
              <div className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight max-w-[140px] sm:max-w-[220px] truncate">
                {businessInfo.name || 'PosVenecia'}
              </div>
              <div className="text-xs font-semibold text-slate-600 -mt-0.5">
                {businessInfo.rif ? `${businessInfo.rif}` : 'Comercio'}
              </div>
            </div>
          </div>

          {/* Right Header items: BCV Rate Pill & Mi Perfil Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Orange/Amber BCV Rate Pill (Matching screenshot with USD/EUR switch) */}
            <div className="relative flex items-center bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-2.5 sm:px-3 py-1.5 shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-orange-600 flex-shrink-0" />
              
              {/* Currency Selector Toggle (USD / EUR) */}
              <button
                type="button"
                onClick={() => {
                  const nextCurr = displayedCurrencyRate === 'USD' ? 'EUR' : 'USD';
                  setDisplayedCurrencyRate(nextCurr);
                  setTempRate(nextCurr === 'USD' ? bcvRate.toString() : bcvEuroRate.toString());
                }}
                className="text-[10px] font-black mr-1 px-1.5 py-0.5 rounded-md bg-orange-200/80 hover:bg-orange-300 text-orange-950 transition-colors cursor-pointer"
                title="Clic para alternar entre Tasa Dólar y Tasa Euro del BCV"
              >
                {displayedCurrencyRate === 'USD' ? '$ BCV' : '€ BCV'}
              </button>
              
              {isEditingRate ? (
                <form onSubmit={handleSaveRate} className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    className="w-16 bg-white text-orange-950 px-1 py-0.5 rounded border border-orange-400 text-xs font-mono font-bold"
                    autoFocus
                  />
                  <button type="submit" className="p-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded">
                    <Check className="w-3 h-3" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => { 
                    setTempRate(displayedCurrencyRate === 'USD' ? bcvRate.toString() : bcvEuroRate.toString()); 
                    setIsEditingRate(true); 
                  }}
                  className="font-bold text-xs sm:text-sm font-mono-numbers text-orange-800 hover:text-orange-950 flex items-center gap-1 transition-colors"
                  title="Clic para editar tasa manualmente"
                >
                  Bs {formatBs(displayedCurrencyRate === 'USD' ? bcvRate : bcvEuroRate)}
                  <Edit2 className="w-2.5 h-2.5 text-orange-500 opacity-60 hover:opacity-100" />
                </button>
              )}

              {/* Botón de actualizar tasa oficial BCV en vivo */}
              <button
                type="button"
                disabled={isFetchingLiveRate || isFetchingLiveEuroRate}
                onClick={handleLiveBcvFetch}
                className="ml-1.5 p-1 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-800 hover:text-orange-950 transition-colors disabled:opacity-60 cursor-pointer"
                title={`Consultar tasa oficial en vivo de ${displayedCurrencyRate === 'USD' ? 'Dólar' : 'Euro'} desde el BCV`}
              >
                <RotateCw className={`w-3 h-3 ${(isFetchingLiveRate || isFetchingLiveEuroRate) ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              {/* Floating notification feedback toast */}
              {syncFeedback && (
                <div className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap z-50 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{syncFeedback}</span>
                </div>
              )}
            </div>

            {/* Google Account & Multi-Device Sync Button */}
            <button
              type="button"
              onClick={() => setIsGoogleModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border shadow-2xs transition-all active:scale-95 group cursor-pointer ${
                googleUser?.isConnected 
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-400'
              }`}
              title={googleUser?.isConnected 
                ? `Conectado como ${googleUser.email}. Clic para ver estado de sincronización en Google Drive.`
                : 'Iniciar sesión con Google para sincronizar y respaldar en tu Google Drive'}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {googleUser?.isConnected && googleUser.photoUrl ? (
                  <img 
                    src={googleUser.photoUrl} 
                    alt={googleUser.name} 
                    className="w-4.5 h-4.5 rounded-full object-cover border border-emerald-400"
                  />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                  </svg>
                )}
              </div>

              <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 hidden sm:inline max-w-[120px] truncate">
                {googleUser?.isConnected ? (googleUser.name?.split(' ')[0] || 'Mi Cuenta') : 'Entrar con Google'}
              </span>

              {googleUser?.isConnected ? (
                <span 
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    firestoreSyncStatus === 'synced' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                  }`} 
                  title={firestoreSyncStatus === 'synced' ? 'Sincronizado en tiempo real (Cloud Firestore)' : 'Conectando a la nube...'} 
                />
              ) : (
                <span className="text-[10px] font-semibold text-blue-600 sm:hidden">Entrar</span>
              )}
            </button>

            {/* Connection & Multi-Device Realtime Cloud Sync Status */}
            {!isOnline ? (
              <div 
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-black tracking-tight"
                title="Sin conexión a internet. Reconecta para continuar sincronizando en vivo con Cloud Firestore."
              >
                <WifiOff className="w-3 h-3 text-rose-700 shrink-0" />
                <span>Sin Red</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Sincronización en vivo multi-dispositivo (Firebase Firestore)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>En Vivo</span>
              </button>
            )}

            {/* Daily Cash Shift Status Button */}
            {isCashRegisterOpen ? (
              <button
                type="button"
                onClick={() => setIsCierreModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 shadow-2xs text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Caja Abierta: Clic para realizar el Cierre de Caja del día"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span>Caja Abierta</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAperturaModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 shadow-2xs text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Caja Cerrada: Clic para realizar la Apertura de Caja e iniciar el día"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>Abrir Caja</span>
              </button>
            )}



            {/* User Business Profile Button */}
            <button 
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-blue-50 border border-slate-200 text-slate-800 shadow-2xs hover:border-blue-300 transition-all active:scale-95 group cursor-pointer"
              title="Mi Perfil: Personalizar logo, RIF, dirección y datos del negocio"
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-[11px] overflow-hidden shrink-0 border border-blue-400 shadow-xs">
                {businessInfo.logoUrl ? (
                  <img src={businessInfo.logoUrl} alt={businessInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{businessInfo.name.charAt(0).toUpperCase() || 'B'}</span>
                )}
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 hidden sm:inline">
                Mi Perfil
              </span>
            </button>

            {/* Direct Cerrar Sesión Button to return to Google Login screen */}
            <button
              type="button"
              onClick={async () => {
                await logoutGoogle();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 shadow-2xs hover:border-rose-300 transition-all active:scale-95 group cursor-pointer"
              title="Cerrar sesión y volver a la pantalla de inicio con cuenta Google"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600 group-hover:text-rose-800" />
              <span className="text-xs font-bold text-rose-700 group-hover:text-rose-900 hidden sm:inline">
                Cerrar Sesión
              </span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Card (Matching screenshot's rounded tab container) */}
        <nav className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs p-1.5 sm:p-2 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 min-w-[62px] py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs transition-all duration-200 relative ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="text-[11px] sm:text-xs tracking-tight">{item.label}</span>

                {item.badge !== undefined && (
                  <span className={`absolute top-1 right-2 text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white text-blue-700 font-extrabold' : 'bg-blue-600 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}

                {item.seniat && !isActive && (
                  <span className="absolute -top-1 right-1 text-[8px] bg-red-100 text-red-700 border border-red-200 font-bold px-1 rounded-sm uppercase">
                    SENIAT
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Subtle Indicator bar below tabs */}
        <div className="w-24 sm:w-32 h-1 bg-blue-600/70 rounded-full mx-auto -mt-1 opacity-70"></div>
      </div>

      {/* Google Account, PWA Install & Multi-Device Sync Modal */}
      <GoogleSyncModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
      />

    </header>
  );
};
