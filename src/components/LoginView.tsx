import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Lock,
  Sparkles,
  Users,
  Store,
  DollarSign
} from 'lucide-react';

interface LoginViewProps {
  onLoginWithGoogle: () => Promise<void>;
  onContinueAsGuest: () => void;
  isOnline: boolean;
  bcvRate: number;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginWithGoogle,
  onContinueAsGuest,
  isOnline,
  bcvRate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleClick = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await onLoginWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'No se pudo iniciar sesión con Google. Puedes continuar en modo local.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden select-none">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Connection & BCV Info */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between py-2 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xs">
            <Store className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block">POS Venecia</span>
            <span className="text-[10px] text-slate-400">Punto de Venta Profesional</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Rate indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-300">
            <span className="text-slate-400">Tasa BCV:</span>
            <span className="font-mono font-bold text-emerald-400">Bs. {bcvRate.toFixed(2)}</span>
          </div>

          {/* Network status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Conexión activa' : 'Modo Offline (Sin red)'}</span>
          </div>
        </div>
      </header>

      {/* Main Center Content */}
      <main className="relative z-10 max-w-4xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Value Proposition & Architecture */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Arquitectura Offline-First + Sincronización Google Drive</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Gestión inteligente para tu negocio en <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">Bolívares y Divisas</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
            Facturación fiscal SENIAT, arqueo diario de caja, control de inventario con fotos, cuentas por pagar y sincronización continua multi-dispositivo.
          </p>

          {/* Feature List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">100% Offline-First</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Sigue vendiendo aunque se caiga internet. Los datos se guardan en IndexedDB.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Nube Google Drive</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Tus datos pertenecen a tu cuenta personal de Google sin servidores de terceros.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Multi-Dispositivo</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Usa la misma cuenta en laptop, tablet o teléfono con sincronización continua automática.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Dualidad Monetaria</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Cálculos automáticos con tasa BCV oficial, IGTF 3% y múltiples formas de pago.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Login Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative">
            
            {/* Top Badge */}
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 p-0.5 mx-auto shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Lock className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Iniciar Sesión</h2>
              <p className="text-xs text-slate-400">Accede con tu cuenta autorizada para comenzar</p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            {/* Google Sign-in Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                )}
                <span>{isLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
              </button>

              <div className="relative flex items-center justify-center py-2">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-slate-900 px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider relative z-10">
                  O prueba sin conexión
                </span>
                <div className="border-t border-white/10 w-full" />
              </div>

              {/* Guest / Local Storage fallback */}
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <span>Acceder en Modo Local / Dispositivo</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Privacy note */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Autenticación oficial y almacenamiento cifrado en tu propia cuenta.</span>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center py-3 text-[11px] text-slate-300">
        POS Venecia • Cumplimiento Normativo Fiscal Venezolano (SENIAT) • Versión 2.5 Multi-Usuario Offline
      </footer>

    </div>
  );
};
