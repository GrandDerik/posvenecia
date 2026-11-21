import React, { useState, useCallback, useEffect } from 'react';
import { ShieldCheck, Lock, Check, X, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type PinRecoveryStep = 'verifying' | 'reset_form' | 'success';

export const useManagerPinRecovery = () => {
  const { reauthenticateForPinReset, googleUser } = useApp();
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<PinRecoveryStep>('verifying');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  const runReauth = useCallback(async () => {
    setIsReauthenticating(true);
    setRecoveryError(null);
    setRecoveryStep('verifying');
    try {
      const { email } = await reauthenticateForPinReset();
      setVerifiedEmail(email || googleUser?.email || '');
      setRecoveryStep('reset_form');
    } catch (err: any) {
      setRecoveryError(err?.message || 'No se pudo confirmar tu identidad con Google.');
    } finally {
      setIsReauthenticating(false);
    }
  }, [reauthenticateForPinReset, googleUser?.email]);

  const startRecovery = useCallback(async () => {
    setIsRecoveryOpen(true);
    await runReauth();
  }, [runReauth]);

  const closeRecovery = useCallback(() => {
    setIsRecoveryOpen(false);
    setRecoveryError(null);
    setRecoveryStep('verifying');
  }, []);

  return {
    isRecoveryOpen,
    recoveryStep,
    recoveryError,
    verifiedEmail: verifiedEmail || googleUser?.email || '',
    isReauthenticating,
    startRecovery,
    retryReauth: runReauth,
    closeRecovery,
    setRecoveryStep,
    setRecoveryError
  };
};

interface RecoverManagerPinModalProps {
  isOpen: boolean;
  step: PinRecoveryStep;
  error: string | null;
  verifiedEmail: string;
  isReauthenticating: boolean;
  onRetryReauth: () => void;
  onRequireReauth: () => void;
  onClose: () => void;
  onSuccess?: () => void;
  onMarkSuccess: () => void;
}

export const RecoverManagerPinModal: React.FC<RecoverManagerPinModalProps> = ({
  isOpen,
  step,
  error,
  verifiedEmail,
  isReauthenticating,
  onRetryReauth,
  onRequireReauth,
  onClose,
  onSuccess,
  onMarkSuccess
}) => {
  const { resetManagerPinAfterReauth } = useApp();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setNewPin('');
      setConfirmPin('');
      setShowPin(false);
      setFormError(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;

    const cleanPin = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (cleanPin.length < 4) {
      setFormError('La nueva clave debe tener al menos 4 caracteres o dígitos.');
      return;
    }
    if (cleanPin.length > 16) {
      setFormError('La nueva clave no puede superar los 16 caracteres.');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setFormError('Las claves ingresadas no coinciden.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await resetManagerPinAfterReauth(cleanPin);
      onMarkSuccess();
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1100);
    } catch (err: any) {
      const msg = err?.message || 'No se pudo restablecer la clave de gerente.';
      if (msg.toLowerCase().includes('expiró') || msg.toLowerCase().includes('verificación')) {
        setFormError(msg);
        onRequireReauth();
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-[#DCE4F0] overflow-hidden animate-in zoom-in-95 text-left">
        <div className="bg-[#0B1528] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm">Recuperar Clave de Gerente</h3>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="text-white/80 hover:bg-white/10 p-1 rounded-full cursor-pointer disabled:opacity-50"
            aria-label="Cerrar recuperación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'verifying' && (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                {isReauthenticating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </div>
              <div className="text-xs text-blue-950 space-y-1">
                <p className="font-bold">Verificación de Seguridad con Google</p>
                <p className="text-blue-800 leading-relaxed">
                  {isReauthenticating
                    ? 'Confirma tu identidad en la ventana emergente de Google para autorizar el cambio de clave.'
                    : 'Para restablecer tu clave sin conocer la anterior, confirma tu identidad con tu cuenta de Google activa.'}
                </p>
                {verifiedEmail && (
                  <p className="font-mono text-[11px] font-bold text-blue-900 pt-0.5 truncate">
                    Cuenta activa: {verifiedEmail}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReauthenticating}
                onClick={onRetryReauth}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReauthenticating ? 'animate-spin' : ''}`} />
                <span>{isReauthenticating ? 'Verificando con Google...' : 'Verificar con Google'}</span>
              </button>
            </div>
          </div>
        )}

        {step === 'reset_form' && (
          <form onSubmit={handleSaveNewPin} className="p-5 space-y-3.5">
            <div className="p-2.5 rounded-xl bg-[#E7F8EE] border border-[#A7E6C4] text-[#065F46] text-xs font-semibold flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Identidad confirmada con Google</div>
                {verifiedEmail && (
                  <div className="text-[11px] font-mono text-emerald-800 truncate">{verifiedEmail}</div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Establece tu nueva clave de gerente. No es necesario ingresar el PIN anterior.
            </p>

            {formError && (
              <div className="p-2.5 rounded-xl bg-[#FEECEF] border border-[#FBC4CD] text-[#BE123C] text-xs font-semibold">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nueva Clave de Gerente (4 a 16 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  minLength={4}
                  maxLength={16}
                  autoComplete="new-password"
                  placeholder="Ej: 5821"
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full pl-3 pr-9 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-600"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmar Nueva Clave
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                required
                minLength={4}
                maxLength={16}
                autoComplete="new-password"
                placeholder="Repite la nueva clave"
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value);
                  setFormError(null);
                }}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {isSaving ? 'Guardando...' : 'Guardar Nueva Clave'}
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">¡Clave Restablecida!</h4>
              <p className="text-xs text-slate-500 mt-1">
                Tu nueva clave de gerente se guardó de forma segura en la nube.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
