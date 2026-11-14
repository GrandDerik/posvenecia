import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  Database, 
  Lock,
  Sparkles,
  Store,
  DollarSign,
  Cloud
} from 'lucide-react';

interface LoginViewProps {
  onLoginWithGoogle: () => Promise<void>;
  isOnline: boolean;
  bcvRate: number;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginWithGoogle,
  isOnline,
  bcvRate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleClick = async () => {
    if (!isOnline) {
      setErrorMsg('Se requiere conexión a internet para autenticar tu cuenta y sincronizar en tiempo real.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await onLoginWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'No se pudo iniciar sesión con Google. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF2F7] text-[#0B1528] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden select-none">
      
      {/* Background ambient soft-ice lighting */}
      <div className="absolute -top-28 -left-28 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-emerald-200/35 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Connection & BCV Info */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between py-2 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#0B1528] flex items-center justify-center text-white shadow-sm">
            <Store className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-[#0B1528] block">PosVenecia</span>
            <span className="text-[11px] text-slate-500 font-medium">Punto de Venta Profesional en la Nube</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Rate indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF3E8] border border-[#F5D3B3] text-[11px] text-[#9A4B12]">
            <span className="font-semibold">Tasa BCV:</span>
            <span className="font-mono-numbers font-black text-[#7C3A0B]">Bs. {bcvRate.toFixed(2)}</span>
          </div>

          {/* Network status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
            isOnline 
              ? 'bg-[#E7F8EE] text-[#065F46] border-[#A7E6C4]' 
              : 'bg-[#FEECEF] text-[#BE123C] border-[#FBC4CD]'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Conexión activa' : 'Sin conexión a internet'}</span>
          </div>
        </div>
      </header>

      {/* Main Center Content */}
      <main className="relative z-10 max-w-5xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Value Proposition & Architecture */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] text-xs font-bold">
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Sincronización en Vivo Multi-Dispositivo (Cloud Firestore)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#0B1528] leading-tight">
            Gestión inteligente para tu negocio en <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">Bolívares y Divisas</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg font-medium">
            Facturación fiscal SENIAT, arqueo diario de caja, control de inventario, cuentas por pagar y sincronización instantánea en vivo entre PC y teléfono.
          </p>

          {/* Feature List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-white/95 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46] shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0B1528]">100% Tiempo Real</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Cada venta, cierre de caja o cambio de stock se refleja al instante en Firebase Firestore.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/95 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#EBF3FE] border border-[#C5DCFC] text-[#1D4ED8] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0B1528]">Aislamiento por Cuenta</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Tus datos están estrictamente protegidos y aislados bajo tu UID personal de Google.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/95 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#FFF3E8] border border-[#F5D3B3] text-[#D96B27] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0B1528]">Multi-Dispositivo</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Usa la misma cuenta en laptop, tablet o teléfono sin necesidad de copias manuales.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/95 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#F8FAFC] border border-[#DCE4F0] text-[#0B1528] shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#0B1528]">Dualidad Monetaria</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Cálculos automáticos con tasa BCV oficial, IGTF 3% y múltiples formas de pago.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Login Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-gradient-to-b from-white to-[#F4F8FF] border border-[#93C5FD] rounded-3xl p-6 sm:p-8 shadow-[0_12px_32px_-8px_rgba(37,99,235,0.16)] space-y-6 relative">
            
            {/* Top Badge */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#0B1528] mx-auto shadow-md flex items-center justify-center">
                <Lock className="w-6 h-6 text-blue-300" />
              </div>
              <h2 className="text-xl font-black text-[#0B1528] tracking-tight">Iniciar Sesión</h2>
              <p className="text-xs text-slate-500">Conecta tu cuenta de Google para acceder a tu comercio en vivo</p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] text-xs text-center font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Google Sign-in Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isLoading || !isOnline}
                className="w-full py-3.5 px-4 bg-[#0B1528] hover:bg-[#152440] text-white rounded-2xl font-extrabold text-xs sm:text-sm shadow-[0_6px_16px_-4px_rgba(11,21,40,0.35)] flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </span>
                )}
                <span>{isLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
              </button>
            </div>

            {/* Privacy note */}
            <div className="pt-3 border-t border-[#DCE4F0] flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-[#065F46] shrink-0" />
              <span>Acceso exclusivo en la nube. Al cerrar sesión, la memoria local se limpia por completo.</span>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center py-3 text-[11px] text-slate-500 font-medium">
        PosVenecia • Cumplimiento Normativo Fiscal Venezolano (SENIAT) • Sincronización Cloud en Vivo
      </footer>

    </div>
  );
};
