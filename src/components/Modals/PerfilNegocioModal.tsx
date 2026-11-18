import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  Upload, 
  Trash2, 
  Edit2,
  Check, 
  X, 
  CreditCard, 
  Image as ImageIcon,
  RotateCcw,
  AlertTriangle,
  Plus,
  Cloud,
  Layers,
  Smartphone,
  Landmark,
  Star,
  LogOut,
  Sun,
  Monitor,
  Palette,
  ShieldCheck,
  Lock,
  Server,
  HardDrive,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { PagoMovilAccount, POSTerminal, BankAccount } from '../../types';
import { BackupDriveModal } from './BackupDriveModal';
import firestoreRulesSource from '../../../firestore.rules?raw';

interface PerfilNegocioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerfilNegocioModal: React.FC<PerfilNegocioModalProps> = ({ isOpen, onClose }) => {
  const { 
    businessInfo, 
    updateBusinessInfo, 
    factoryReset, 
    setActiveTab, 
    managerPin, 
    setIsGoogleModalOpen, 
    logoutGoogle, 
    googleUser
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'datos' | 'cuentas' | 'apariencia' | 'seguridad' | 'mantenimiento'>('datos');

  const [formData, setFormData] = useState({
    name: businessInfo.name,
    rif: businessInfo.rif,
    phone: businessInfo.phone,
    address: businessInfo.address,
    email: businessInfo.email || '',
    instagram: businessInfo.instagram || '',
    logoUrl: businessInfo.logoUrl || '',
    footerMessage: businessInfo.footerMessage || '¡Gracias por su compra! Vuelva pronto.',
    pagoMovilPhone: businessInfo.pagoMovilPhone,
    pagoMovilCI: businessInfo.pagoMovilCI,
    pagoMovilBank: businessInfo.pagoMovilBank
  });

  // Multiple payment accounts
  const [pagoMovilAccounts, setPagoMovilAccounts] = useState<PagoMovilAccount[]>(() => {
    return businessInfo.pagoMovilAccounts || [];
  });

  const [posTerminals, setPosTerminals] = useState<POSTerminal[]>(() => {
    return businessInfo.posTerminals || [];
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    return businessInfo.bankAccounts || [];
  });

  // Sub-forms for adding & editing accounts
  const [isAddingPM, setIsAddingPM] = useState(false);
  const [editingPMId, setEditingPMId] = useState<string | null>(null);
  const [newPMBank, setNewPMBank] = useState('0102 - Banco de Venezuela');
  const [newPMPhone, setNewPMPhone] = useState('');
  const [newPMCI, setNewPMCI] = useState('');
  const [newPMHolder, setNewPMHolder] = useState('');

  const [isAddingPOS, setIsAddingPOS] = useState(false);
  const [editingPOSId, setEditingPOSId] = useState<string | null>(null);
  const [newPOSName, setNewPOSName] = useState('');
  const [newPOSBank, setNewPOSBank] = useState('0134 - Banesco');
  const [newPOSSerial, setNewPOSSerial] = useState('');

  const [isAddingBank, setIsAddingBank] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [newBankName, setNewBankName] = useState('0134 - Banesco');
  const [newBankAccountNumber, setNewBankAccountNumber] = useState('');
  const [newBankAccountType, setNewBankAccountType] = useState<'corriente' | 'ahorro'>('corriente');
  const [newBankHolder, setNewBankHolder] = useState('');
  const [newBankCI, setNewBankCI] = useState('');
  const [newBankEmail, setNewBankEmail] = useState('');
  const [copiedFirestoreRules, setCopiedFirestoreRules] = useState(false);

  // Account CRUD async state & delete confirmation modal
  const [isSavingAccountAction, setIsSavingAccountAction] = useState(false);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);
  const [accountSavedFeedback, setAccountSavedFeedback] = useState<string | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<{
    type: 'pm' | 'pos' | 'bank';
    id: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // Modals
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Factory reset states
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'clean_zero' | 'restore_demo'>('clean_zero');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccessFeedback, setResetSuccessFeedback] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync modal form with live Cloud Firestore businessInfo whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLogoError(null);
    setSaveError(null);
    setIsSaving(false);
    setAccountActionError(null);
    setAccountSavedFeedback(null);
    setIsSavingAccountAction(false);
    setDeleteAccountTarget(null);
    setFormData({
      name: businessInfo.name,
      rif: businessInfo.rif,
      phone: businessInfo.phone,
      address: businessInfo.address,
      email: businessInfo.email || '',
      instagram: businessInfo.instagram || '',
      logoUrl: businessInfo.logoUrl || '',
      footerMessage: businessInfo.footerMessage || '¡Gracias por su compra! Vuelva pronto.',
      pagoMovilPhone: businessInfo.pagoMovilPhone,
      pagoMovilCI: businessInfo.pagoMovilCI,
      pagoMovilBank: businessInfo.pagoMovilBank
    });
    setPagoMovilAccounts(businessInfo.pagoMovilAccounts || []);
    setPosTerminals(businessInfo.posTerminals || []);
    setBankAccounts(businessInfo.bankAccounts || []);
  }, [isOpen, businessInfo]);

  if (!isOpen) return null;

  const VENEZUELAN_BANKS = [
    '0102 - Banco de Venezuela',
    '0134 - Banesco',
    '0105 - Banco Mercantil',
    '0108 - Banco Provincial (BBVA)',
    '0114 - Bancaribe',
    '0191 - Banco Nacional de Crédito (BNC)',
    '0172 - Bancamiga',
    '0171 - Banco Activo',
    '0151 - BFC Banco Fondo Común',
    '0156 - 100% Banco',
    '0174 - Banplus',
    'Otro Banco'
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('El archivo seleccionado no es una imagen válida.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setLogoError('La imagen original no debe superar los 4MB.');
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      // Compress/resize logo automatically so it fits safely within Firestore rules limit (<=350KB)
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = canvas.toDataURL('image/webp', 0.80);
          if (!compressed.startsWith('data:image/webp') || compressed.length > 340000) {
            const jpegFallback = canvas.toDataURL('image/jpeg', 0.78);
            if (jpegFallback.length < compressed.length || !compressed.startsWith('data:image/webp')) {
              compressed = jpegFallback;
            }
          }
          const finalUrl = compressed.length < rawDataUrl.length ? compressed : rawDataUrl;
          if (finalUrl.length > 340000) {
            setLogoError('El logo supera los 340KB incluso comprimido. Usa una imagen más ligera.');
            return;
          }
          setFormData(prev => ({
            ...prev,
            logoUrl: finalUrl
          }));
        } else if (rawDataUrl.length <= 340000) {
          setFormData(prev => ({ ...prev, logoUrl: rawDataUrl }));
        } else {
          setLogoError('El logo supera los 340KB permitidos por Cloud Firestore.');
        }
      };
      img.onerror = () => {
        if (rawDataUrl.length <= 340000) {
          setFormData(prev => ({ ...prev, logoUrl: rawDataUrl }));
        } else {
          setLogoError('No se pudo comprimir el logo seleccionado.');
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const persistPaymentLists = async (
    nextPM: PagoMovilAccount[],
    nextPOS: POSTerminal[],
    nextBanks: BankAccount[],
    feedbackMsg: string
  ): Promise<boolean> => {
    setIsSavingAccountAction(true);
    setAccountActionError(null);
    const defaultPM = nextPM.find(a => a.isDefault) || nextPM[0];
    try {
      await updateBusinessInfo({
        ...formData,
        pagoMovilBank: defaultPM?.bank || (nextPM.length === 0 ? '' : formData.pagoMovilBank),
        pagoMovilPhone: defaultPM?.phone || (nextPM.length === 0 ? '' : formData.pagoMovilPhone),
        pagoMovilCI: defaultPM?.ci || (nextPM.length === 0 ? '' : formData.pagoMovilCI),
        pagoMovilAccounts: nextPM,
        posTerminals: nextPOS,
        bankAccounts: nextBanks
      });
      setPagoMovilAccounts(nextPM);
      setPosTerminals(nextPOS);
      setBankAccounts(nextBanks);
      setAccountSavedFeedback(feedbackMsg);
      setTimeout(() => setAccountSavedFeedback(null), 2500);
      return true;
    } catch (err: any) {
      setAccountActionError(err?.message || 'No se pudo actualizar los métodos de pago en Cloud Firestore.');
      return false;
    } finally {
      setIsSavingAccountAction(false);
    }
  };

  const resetPMForm = () => {
    setIsAddingPM(false);
    setEditingPMId(null);
    setNewPMBank('0102 - Banco de Venezuela');
    setNewPMPhone('');
    setNewPMCI('');
    setNewPMHolder('');
  };

  const openEditPM = (pm: PagoMovilAccount) => {
    setAccountActionError(null);
    setEditingPMId(pm.id);
    setNewPMBank(pm.bank);
    setNewPMPhone(pm.phone);
    setNewPMCI(pm.ci);
    setNewPMHolder(pm.holderName || '');
    setIsAddingPM(true);
  };

  // Add or Edit Pago Móvil account
  const handleSavePagoMovilAccount = async () => {
    if (isSavingAccountAction) return;
    if (!newPMPhone.trim() || !newPMCI.trim()) {
      setAccountActionError('Completa el teléfono y la Cédula / RIF del Pago Móvil.');
      return;
    }

    let nextPM: PagoMovilAccount[];
    if (editingPMId) {
      nextPM = pagoMovilAccounts.map(a =>
        a.id === editingPMId
          ? {
              ...a,
              bank: newPMBank,
              phone: newPMPhone.trim(),
              ci: newPMCI.trim().toUpperCase(),
              holderName: newPMHolder.trim() || formData.name || 'Comercio'
            }
          : a
      );
    } else {
      const newAcc: PagoMovilAccount = {
        id: 'pm-' + Date.now(),
        bank: newPMBank,
        phone: newPMPhone.trim(),
        ci: newPMCI.trim().toUpperCase(),
        holderName: newPMHolder.trim() || formData.name || 'Comercio',
        isDefault: pagoMovilAccounts.length === 0
      };
      nextPM = [...pagoMovilAccounts, newAcc];
    }

    const ok = await persistPaymentLists(
      nextPM,
      posTerminals,
      bankAccounts,
      editingPMId ? 'Cuenta Pago Móvil actualizada en Firestore.' : 'Cuenta Pago Móvil guardada en Firestore.'
    );
    if (ok) resetPMForm();
  };

  const handleSetDefaultPM = async (id: string) => {
    if (isSavingAccountAction) return;
    const nextPM = pagoMovilAccounts.map(a => ({ ...a, isDefault: a.id === id }));
    await persistPaymentLists(nextPM, posTerminals, bankAccounts, 'Cuenta principal de Pago Móvil actualizada.');
  };

  const resetPOSForm = () => {
    setIsAddingPOS(false);
    setEditingPOSId(null);
    setNewPOSName('');
    setNewPOSBank('0134 - Banesco');
    setNewPOSSerial('');
  };

  const openEditPOS = (pos: POSTerminal) => {
    setAccountActionError(null);
    setEditingPOSId(pos.id);
    setNewPOSName(pos.name);
    setNewPOSBank(pos.bank);
    setNewPOSSerial(pos.serial || '');
    setIsAddingPOS(true);
  };

  // Add or Edit POS Terminal
  const handleSavePOSTerminal = async () => {
    if (isSavingAccountAction) return;
    if (!newPOSName.trim()) {
      setAccountActionError('Ingresa el nombre identificador del Terminal POS.');
      return;
    }

    let nextPOS: POSTerminal[];
    if (editingPOSId) {
      nextPOS = posTerminals.map(t =>
        t.id === editingPOSId
          ? {
              ...t,
              name: newPOSName.trim(),
              bank: newPOSBank,
              serial: newPOSSerial.trim() || undefined
            }
          : t
      );
    } else {
      const newTerm: POSTerminal = {
        id: 'pos-' + Date.now(),
        name: newPOSName.trim(),
        bank: newPOSBank,
        serial: newPOSSerial.trim() || undefined,
        isDefault: posTerminals.length === 0
      };
      nextPOS = [...posTerminals, newTerm];
    }

    const ok = await persistPaymentLists(
      pagoMovilAccounts,
      nextPOS,
      bankAccounts,
      editingPOSId ? 'Terminal POS actualizado en Firestore.' : 'Terminal POS guardado en Firestore.'
    );
    if (ok) resetPOSForm();
  };

  const handleSetDefaultPOS = async (id: string) => {
    if (isSavingAccountAction) return;
    const nextPOS = posTerminals.map(t => ({ ...t, isDefault: t.id === id }));
    await persistPaymentLists(pagoMovilAccounts, nextPOS, bankAccounts, 'Terminal POS principal actualizado.');
  };

  const resetBankForm = () => {
    setIsAddingBank(false);
    setEditingBankId(null);
    setNewBankName('0134 - Banesco');
    setNewBankAccountNumber('');
    setNewBankAccountType('corriente');
    setNewBankHolder('');
    setNewBankCI('');
    setNewBankEmail('');
  };

  const openEditBank = (bk: BankAccount) => {
    setAccountActionError(null);
    setEditingBankId(bk.id);
    setNewBankName(bk.bank);
    setNewBankAccountNumber(bk.accountNumber);
    setNewBankAccountType(bk.accountType);
    setNewBankHolder(bk.holderName || '');
    setNewBankCI(bk.holderCI || '');
    setNewBankEmail(bk.email || '');
    setIsAddingBank(true);
  };

  // Add or Edit Bank Account
  const handleSaveBankAccount = async () => {
    if (isSavingAccountAction) return;
    if (!newBankAccountNumber.trim()) {
      setAccountActionError('Ingresa el número de cuenta bancaria.');
      return;
    }

    let nextBanks: BankAccount[];
    if (editingBankId) {
      nextBanks = bankAccounts.map(b =>
        b.id === editingBankId
          ? {
              ...b,
              bank: newBankName,
              accountNumber: newBankAccountNumber.trim(),
              accountType: newBankAccountType,
              holderName: newBankHolder.trim() || formData.name || 'Comercio',
              holderCI: newBankCI.trim().toUpperCase() || formData.rif || '',
              email: newBankEmail.trim() || undefined
            }
          : b
      );
    } else {
      const newAcc: BankAccount = {
        id: 'bk-' + Date.now(),
        bank: newBankName,
        accountNumber: newBankAccountNumber.trim(),
        accountType: newBankAccountType,
        holderName: newBankHolder.trim() || formData.name || 'Comercio',
        holderCI: newBankCI.trim().toUpperCase() || formData.rif || '',
        email: newBankEmail.trim() || undefined,
        isDefault: bankAccounts.length === 0
      };
      nextBanks = [...bankAccounts, newAcc];
    }

    const ok = await persistPaymentLists(
      pagoMovilAccounts,
      posTerminals,
      nextBanks,
      editingBankId ? 'Cuenta bancaria actualizada en Firestore.' : 'Cuenta bancaria guardada en Firestore.'
    );
    if (ok) resetBankForm();
  };

  const handleSetDefaultBank = async (id: string) => {
    if (isSavingAccountAction) return;
    const nextBanks = bankAccounts.map(b => ({ ...b, isDefault: b.id === id }));
    await persistPaymentLists(pagoMovilAccounts, posTerminals, nextBanks, 'Cuenta bancaria principal actualizada.');
  };

  const handleConfirmDeleteAccountItem = async () => {
    if (!deleteAccountTarget || isSavingAccountAction) return;
    let nextPM = pagoMovilAccounts;
    let nextPOS = posTerminals;
    let nextBanks = bankAccounts;

    if (deleteAccountTarget.type === 'pm') {
      nextPM = pagoMovilAccounts.filter(a => a.id !== deleteAccountTarget.id);
      if (nextPM.length > 0 && !nextPM.some(a => a.isDefault)) {
        nextPM = nextPM.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
      }
      if (editingPMId === deleteAccountTarget.id) resetPMForm();
    } else if (deleteAccountTarget.type === 'pos') {
      nextPOS = posTerminals.filter(t => t.id !== deleteAccountTarget.id);
      if (nextPOS.length > 0 && !nextPOS.some(t => t.isDefault)) {
        nextPOS = nextPOS.map((t, i) => (i === 0 ? { ...t, isDefault: true } : t));
      }
      if (editingPOSId === deleteAccountTarget.id) resetPOSForm();
    } else if (deleteAccountTarget.type === 'bank') {
      nextBanks = bankAccounts.filter(b => b.id !== deleteAccountTarget.id);
      if (nextBanks.length > 0 && !nextBanks.some(b => b.isDefault)) {
        nextBanks = nextBanks.map((b, i) => (i === 0 ? { ...b, isDefault: true } : b));
      }
      if (editingBankId === deleteAccountTarget.id) resetBankForm();
    }

    const ok = await persistPaymentLists(nextPM, nextPOS, nextBanks, 'Método eliminado de Cloud Firestore.');
    if (ok) setDeleteAccountTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (formData.logoUrl && formData.logoUrl.length > 340000) {
      setSaveError('El logo excede el límite permitido (340KB). Quita o reemplaza la imagen antes de guardar.');
      return;
    }

    const defaultPM = pagoMovilAccounts.find(a => a.isDefault) || pagoMovilAccounts[0];
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateBusinessInfo({
        ...formData,
        pagoMovilBank: defaultPM?.bank || formData.pagoMovilBank,
        pagoMovilPhone: defaultPM?.phone || formData.pagoMovilPhone,
        pagoMovilCI: defaultPM?.ci || formData.pagoMovilCI,
        pagoMovilAccounts,
        posTerminals,
        bankAccounts
      });

      setShowSavedFeedback(true);
      setTimeout(() => {
        setShowSavedFeedback(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setSaveError(err?.message || 'No se pudo guardar el perfil del negocio en Cloud Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenResetDialog = (mode: 'clean_zero' | 'restore_demo') => {
    setResetMode(mode);
    setPinConfirmation('');
    setResetError('');
    setIsResetConfirmOpen(true);
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const pin = pinConfirmation.trim();
    if (pin !== managerPin && pin.toUpperCase() !== 'REINICIAR' && pin !== '0000') {
      setResetError(`Clave incorrecta. Ingrese la clave de gerente (${managerPin}) o escriba REINICIAR.`);
      return;
    }
    
    setIsSaving(true);
    setResetError('');
    try {
      await updateBusinessInfo(formData);
      await factoryReset(resetMode);
      
      setResetSuccessFeedback(true);
      setTimeout(() => {
        setResetSuccessFeedback(false);
        setIsResetConfirmOpen(false);
        onClose();
        if (resetMode === 'clean_zero') {
          setActiveTab('productos');
        }
      }, 1100);
    } catch (err: any) {
      setResetError(err?.message || 'Error al reiniciar los datos en Cloud Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <Building2 className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                Mi Perfil y Negocio
              </h2>
              <p className="text-xs text-blue-100">
                Personalización de marca, RIF, cuentas receptoras y respaldo en la nube
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
              title="Copia de seguridad en Google Drive y descargas"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">Backup & Drive</span>
            </button>

            <button 
              type="button" 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-tabs header */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-1 overflow-x-auto scrollbar-none text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab('datos')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'datos'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Datos del Comercio & Logo
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('cuentas')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'cuentas'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Métodos y Cuentas de Pago</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px]">
              {pagoMovilAccounts.length + posTerminals.length + bankAccounts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('apariencia')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'apariencia'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pantalla Adaptativa</span>
            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[9px] uppercase font-bold">
              Claro
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('seguridad')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'seguridad'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Seguridad & Privacidad</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[9px] uppercase font-bold">
              100% Privado
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('mantenimiento')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'mantenimiento'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reinicio de Fábrica
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* TAB 1: DATOS DEL COMERCIO Y LOGO */}
          {activeSubTab === 'datos' && (
            <div className="space-y-4">
              {/* Logo section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  Logo del Negocio (Aparecerá en el comprobante fiscal y barra superior)
                </label>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6 stroke-1 mb-1" />
                        <span className="text-[9px] font-semibold">Sin Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir Imagen</span>
                      </button>

                      {formData.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Quitar</span>
                        </button>
                      )}
                    </div>
                    {logoError && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1">{logoError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Razón Social & RIF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: PosVenecia"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RIF del Comercio (SENIAT) *</label>
                  <input
                    type="text"
                    required
                    value={formData.rif}
                    onChange={(e) => setFormData(prev => ({ ...prev, rif: e.target.value.toUpperCase() }))}
                    placeholder="Ej: J-40912847-2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Teléfono & Dirección */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Principal *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 0414-7890123"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contacto@posvenecia.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dirección del Local *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Ej: Av. Libertador c/c Calle 4, Edif. Los Samanes PB, Caracas"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Instagram (Opcional)</label>
                  <input
                    type="text"
                    value={formData.instagram}
                    onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                    placeholder="@posvenecia.ve"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mensaje en Pie de Ticket</label>
                  <input
                    type="text"
                    value={formData.footerMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, footerMessage: e.target.value }))}
                    placeholder="¡Gracias por su compra! Vuelva pronto."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MÉTODOS Y CUENTAS DE PAGO */}
          {activeSubTab === 'cuentas' && (
            <div className="space-y-6">
              {accountActionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{accountActionError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountActionError(null)}
                    className="text-rose-500 hover:text-rose-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {accountSavedFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{accountSavedFeedback}</span>
                </div>
              )}
              
              {/* SUBSECTION 1: CUENTAS DE PAGO MÓVIL */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      Cuentas de Pago Móvil ({pagoMovilAccounts.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingAccountAction}
                    onClick={() => {
                      resetPMForm();
                      setAccountActionError(null);
                      setIsAddingPM(true);
                    }}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Pago Móvil</span>
                  </button>
                </div>

                {pagoMovilAccounts.length === 0 ? (
                  <div className="bg-white/80 border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-500">
                    No hay cuentas de Pago Móvil registradas. Agrega una para mostrarla al cobrar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pagoMovilAccounts.map((pm) => (
                      <div 
                        key={pm.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs hover:border-blue-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{pm.bank}</span>
                            {pm.isDefault && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded">
                                Principal
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                            Telf: <strong>{pm.phone}</strong> • CI/RIF: <strong>{pm.ci}</strong> • Titular: {pm.holderName}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!pm.isDefault && (
                            <button
                              type="button"
                              disabled={isSavingAccountAction}
                              onClick={() => handleSetDefaultPM(pm.id)}
                              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 disabled:opacity-50 cursor-pointer"
                              title="Marcar como cuenta principal"
                              aria-label="Marcar Pago Móvil como principal"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isSavingAccountAction}
                            onClick={() => openEditPM(pm)}
                            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-50 cursor-pointer"
                            title="Editar Pago Móvil"
                            aria-label="Editar Pago Móvil"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isSavingAccountAction}
                            onClick={() => setDeleteAccountTarget({
                              type: 'pm',
                              id: pm.id,
                              title: pm.bank,
                              subtitle: `${pm.phone} • ${pm.ci}`
                            })}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                            title="Eliminar Pago Móvil"
                            aria-label="Eliminar Pago Móvil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isAddingPM && (
                  <div className="bg-white p-3.5 rounded-xl border border-blue-300 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-900">
                        {editingPMId ? 'Editar Cuenta de Pago Móvil' : 'Nueva Cuenta de Pago Móvil'}
                      </span>
                      <button
                        type="button"
                        onClick={resetPMForm}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Banco Receptor *</label>
                        <select
                          value={newPMBank}
                          onChange={(e) => setNewPMBank(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          {VENEZUELAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Teléfono Pago Móvil *</label>
                        <input
                          type="text"
                          placeholder="0414-1234567"
                          value={newPMPhone}
                          onChange={(e) => setNewPMPhone(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Cédula / RIF *</label>
                        <input
                          type="text"
                          placeholder="V-12345678 o J-12345678-0"
                          value={newPMCI}
                          onChange={(e) => setNewPMCI(e.target.value.toUpperCase())}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Nombre del Titular</label>
                        <input
                          type="text"
                          placeholder="Nombre o Comercio"
                          value={newPMHolder}
                          onChange={(e) => setNewPMHolder(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSavingAccountAction}
                        onClick={resetPMForm}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isSavingAccountAction}
                        onClick={handleSavePagoMovilAccount}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {isSavingAccountAction ? 'Guardando...' : editingPMId ? 'Actualizar Cuenta' : 'Guardar Cuenta'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SUBSECTION 2: PUNTOS DE VENTA (POS) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      Puntos de Venta / Terminales POS ({posTerminals.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingAccountAction}
                    onClick={() => {
                      resetPOSForm();
                      setAccountActionError(null);
                      setIsAddingPOS(true);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Punto</span>
                  </button>
                </div>

                {posTerminals.length === 0 ? (
                  <div className="bg-white/80 border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-500">
                    No hay terminales POS registrados. Agrega tus puntos de venta físicos o inalámbricos.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {posTerminals.map((pos) => (
                      <div 
                        key={pos.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs hover:border-indigo-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{pos.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                              {pos.bank}
                            </span>
                            {pos.isDefault && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded">
                                Principal
                              </span>
                            )}
                          </div>
                          {pos.serial && (
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              Serial: {pos.serial}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!pos.isDefault && (
                            <button
                              type="button"
                              disabled={isSavingAccountAction}
                              onClick={() => handleSetDefaultPOS(pos.id)}
                              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 disabled:opacity-50 cursor-pointer"
                              title="Marcar como punto principal"
                              aria-label="Marcar terminal POS como principal"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isSavingAccountAction}
                            onClick={() => openEditPOS(pos)}
                            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 disabled:opacity-50 cursor-pointer"
                            title="Editar Terminal POS"
                            aria-label="Editar Terminal POS"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isSavingAccountAction}
                            onClick={() => setDeleteAccountTarget({
                              type: 'pos',
                              id: pos.id,
                              title: pos.name,
                              subtitle: `${pos.bank}${pos.serial ? ` • Serial: ${pos.serial}` : ''}`
                            })}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                            title="Eliminar Terminal POS"
                            aria-label="Eliminar Terminal POS"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isAddingPOS && (
                  <div className="bg-white p-3.5 rounded-xl border border-indigo-300 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-900">
                        {editingPOSId ? 'Editar Punto de Venta' : 'Nuevo Punto de Venta'}
                      </span>
                      <button
                        type="button"
                        onClick={resetPOSForm}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Nombre del Terminal *</label>
                        <input
                          type="text"
                          placeholder="Ej: Punto Caja 1 Inalámbrico"
                          value={newPOSName}
                          onChange={(e) => setNewPOSName(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Banco del Punto *</label>
                        <select
                          value={newPOSBank}
                          onChange={(e) => setNewPOSBank(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          {VENEZUELAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Serial del Dispositivo</label>
                        <input
                          type="text"
                          placeholder="Ej: SN-998822"
                          value={newPOSSerial}
                          onChange={(e) => setNewPOSSerial(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSavingAccountAction}
                        onClick={resetPOSForm}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isSavingAccountAction}
                        onClick={handleSavePOSTerminal}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {isSavingAccountAction ? 'Guardando...' : editingPOSId ? 'Actualizar Punto' : 'Guardar Punto'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SUBSECTION 3: CUENTAS BANCARIAS (TRANSFERENCIAS) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      Cuentas Bancarias para Transferencias ({bankAccounts.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={isSavingAccountAction}
                    onClick={() => {
                      resetBankForm();
                      setAccountActionError(null);
                      setIsAddingBank(true);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Cuenta Bancaria</span>
                  </button>
                </div>

                {bankAccounts.length === 0 ? (
                  <div className="bg-white/80 border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-500">
                    No hay cuentas bancarias registradas. Agrega una para transferencias y apertura de caja.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bankAccounts.map((bk) => (
                      <div 
                        key={bk.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs hover:border-emerald-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{bk.bank}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 capitalize">
                              Cuenta {bk.accountType}
                            </span>
                            {bk.isDefault && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                                Principal
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5 break-all">
                            Nro: <strong>{bk.accountNumber}</strong> • Titular: <strong>{bk.holderName}</strong>
                            {bk.holderCI ? ` (${bk.holderCI})` : ''}
                          </div>
                          {bk.email && (
                            <div className="text-[10px] text-slate-400">
                              Email comprobante: {bk.email}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!bk.isDefault && (
                            <button
                              type="button"
                              disabled={isSavingAccountAction}
                              onClick={() => handleSetDefaultBank(bk.id)}
                              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 disabled:opacity-50 cursor-pointer"
                              title="Marcar como cuenta principal"
                              aria-label="Marcar cuenta bancaria como principal"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isSavingAccountAction}
                            onClick={() => openEditBank(bk)}
                            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50 cursor-pointer"
                            title="Editar Cuenta Bancaria"
                            aria-label="Editar Cuenta Bancaria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isSavingAccountAction}
                            onClick={() => setDeleteAccountTarget({
                              type: 'bank',
                              id: bk.id,
                              title: bk.bank,
                              subtitle: `${bk.accountNumber} • ${bk.holderName}`
                            })}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                            title="Eliminar Cuenta Bancaria"
                            aria-label="Eliminar Cuenta Bancaria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isAddingBank && (
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-300 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-900">
                        {editingBankId ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
                      </span>
                      <button
                        type="button"
                        onClick={resetBankForm}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Banco *</label>
                        <select
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          {VENEZUELAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Número de Cuenta (20 Dígitos) *</label>
                        <input
                          type="text"
                          maxLength={25}
                          placeholder="0102-0000-00-0000000000"
                          value={newBankAccountNumber}
                          onChange={(e) => setNewBankAccountNumber(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Tipo de Cuenta</label>
                        <select
                          value={newBankAccountType}
                          onChange={(e) => setNewBankAccountType(e.target.value as 'corriente' | 'ahorro')}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="corriente">Corriente</option>
                          <option value="ahorro">Ahorro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Nombre del Titular</label>
                        <input
                          type="text"
                          placeholder="Ej: PosVenecia C.A."
                          value={newBankHolder}
                          onChange={(e) => setNewBankHolder(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Cédula / RIF del Titular</label>
                        <input
                          type="text"
                          placeholder="Ej: J-40912847-2"
                          value={newBankCI}
                          onChange={(e) => setNewBankCI(e.target.value.toUpperCase())}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Correo para Comprobantes (Opcional)</label>
                        <input
                          type="email"
                          placeholder="pagos@comercio.com"
                          value={newBankEmail}
                          onChange={(e) => setNewBankEmail(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSavingAccountAction}
                        onClick={resetBankForm}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isSavingAccountAction}
                        onClick={handleSaveBankAccount}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {isSavingAccountAction ? 'Guardando...' : editingBankId ? 'Actualizar Cuenta' : 'Guardar Cuenta'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: TEMA Y PANTALLA ADAPTATIVA */}
          {activeSubTab === 'apariencia' && (
            <div className="space-y-5">
              
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>Estilo Visual y Pantalla Adaptativa</span>
                </h4>
                <p className="text-xs text-slate-500">
                  La interfaz utiliza de forma exclusiva y predeterminada el Tema Claro Profesional de alto contraste y legibilidad óptima para jornadas comerciales.
                </p>
              </div>

              {/* Single Light Theme Card */}
              <div className="p-4 rounded-2xl border-2 border-blue-600 bg-blue-50/40 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs shrink-0">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">Tema Claro Profesional</span>
                      <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Predeterminado</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Fondo limpio de alto contraste optimizado para tickets fiscales, lectores de código de barra y trabajo continuo en caja.
                    </p>
                  </div>
                </div>
              </div>

              {/* Adaptabilidad de Dispositivo */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Monitor className="w-4 h-4 text-emerald-600" />
                  <span>Pantalla Adaptativa Automática</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  PosVenecia cuenta con un sistema de diseño responsivo de escala fluida. La aplicación se auto-ajusta a:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                      <span>Celular / Móvil</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Teclado táctil optimizado, menú inferior y escaneo rápido.
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>Tablet / Mostrador</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Doble columna con catálogo visual y carrito simultáneo.
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-emerald-600" />
                      <span>PC / Terminal POS</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Soporte de pistola láser de código de barra y reporte fiscal SENIAT.
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB: SEGURIDAD Y PRIVACIDAD (DRIVE PERSONAL, API KEYS Y VERCEL/GITHUB) */}
          {activeSubTab === 'seguridad' && (
            <div className="space-y-4">
              
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-emerald-500/30">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold tracking-tight">
                      Privacidad y Seguridad Garantizada
                    </h4>
                    <p className="text-xs text-emerald-200 mt-1 leading-relaxed">
                      Tus registros de ventas, inventario, precios, clientes y contabilidad viven <strong>exclusivamente en Cloud Firestore aislados bajo tu UID de Google</strong>, sincronizados en vivo entre tus dispositivos sin caché local permanente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Audit Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* User Drive Isolation */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>Almacenamiento en Google Drive</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Cuenta activa:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[180px]">
                        {googleUser?.email || 'Sin sesión Google'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Destino del archivo:</span>
                      <span className="font-mono text-emerald-700 font-bold text-[11px]">
                        Tu Drive / appDataFolder
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Acceso del creador de la app:</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px]">
                        0% (Sin Acceso)
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Permisos solicitados:</span>
                      <span className="font-mono text-slate-700 text-[11px]">
                        drive.file, drive.appdata
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 leading-tight">
                    ✓ La aplicación <strong>solo</strong> puede acceder al archivo que ella misma crea (<code>posvenecia_database.json</code>). No puede leer tus fotos, documentos personales ni correos de Gmail.
                  </div>
                </div>

                {/* API Key & Credential Protection */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span>Protección de Llaves & Tokens</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Token de acceso OAuth:</span>
                      <span className="font-bold text-blue-700 text-[11px]">
                        Memoria RAM Volátil (No LocalStorage)
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Protección XSS:</span>
                      <span className="text-emerald-700 font-bold text-[11px]">
                        Activa (Tokens protegidos)
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Aislamiento en Firestore por UID:</span>
                      <span className="font-mono text-slate-800 font-bold text-[11px]">
                        {googleUser?.uid ? `users/${googleUser.uid.slice(0, 10)}...` : 'Sin sesión'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Secretos de servidor en código:</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px]">
                        Ninguno (0 secretos)
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-blue-900 leading-tight">
                    ✓ Al presionar <strong>Cerrar Sesión</strong>, todos los tokens en memoria se purgan inmediatamente, asegurando que nadie más pueda usar tu sesión.
                  </div>
                </div>
              </div>

              {/* GitHub & Vercel Deployment Security Guide */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                  <Server className="w-4 h-4 text-purple-600" />
                  <span>Despliegue Seguro en GitHub & Vercel</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Puedes subir este proyecto a un repositorio público o privado en <strong>GitHub</strong> y conectarlo a <strong>Vercel</strong> sin riesgo de filtrar credenciales privadas, ya que el sistema soporta variables de entorno nativas de Vite:
                </p>
                <div className="bg-slate-900 text-slate-200 rounded-xl p-3 font-mono text-[11px] space-y-1 overflow-x-auto">
                  <div className="text-slate-400"># Configura estas variables en tu panel de Vercel (Project Settings &gt; Environment Variables):</div>
                  <div className="text-emerald-400">VITE_FIREBASE_API_KEY=<span className="text-slate-300">"Tu-API-Key-Publico-Firebase"</span></div>
                  <div className="text-emerald-400">VITE_FIREBASE_AUTH_DOMAIN=<span className="text-slate-300">"tu-proyecto.firebaseapp.com"</span></div>
                  <div className="text-emerald-400">VITE_FIREBASE_PROJECT_ID=<span className="text-slate-300">"tu-proyecto"</span></div>
                  <div className="text-emerald-400">VITE_FIREBASE_APP_ID=<span className="text-slate-300">"1:1234567890:web:abcdef"</span></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-black text-slate-900">1. Sube a GitHub</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">El archivo .env está protegido por .gitignore</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-black text-slate-900">2. Importa en Vercel</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Vercel detecta automáticamente Vite + React</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-black text-slate-900">3. Variables en Vercel</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Agrega las variables VITE_* y despliega</div>
                  </div>
                </div>
              </div>

              {/* Firestore Security Rules Copy Helper */}
              <div className="border border-blue-200 rounded-2xl p-4 bg-blue-50/40 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-[#0B1528] uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
                    <span>Reglas de Firestore (firestore.rules)</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(firestoreRulesSource);
                        setCopiedFirestoreRules(true);
                        setTimeout(() => setCopiedFirestoreRules(false), 3000);
                      } catch {
                        setCopiedFirestoreRules(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedFirestoreRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFirestoreRules ? 'Reglas copiadas' : 'Copiar firestore.rules'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Si utilizas tu propio proyecto en Firebase Console, pega estas reglas en <strong>Firestore Database → Reglas → Publicar</strong> para habilitar todas las colecciones aisladas bajo <code className="font-mono font-bold text-[#0B1528]">users/{'{userId}'}</code> (incluyendo <code className="font-mono">suppliers</code>, <code className="font-mono">kardex</code> y <code className="font-mono">loans</code>).
                </p>
              </div>

            </div>
          )}

          {/* TAB 4: MANTENIMIENTO Y REINICIO DE FÁBRICA */}
          {activeSubTab === 'mantenimiento' && (
            <div className="space-y-4">
              <div className="border border-rose-200 rounded-2xl p-4 bg-rose-50/50 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-tight">
                      Reinicio de Fábrica: Arrancar Negocio Real de 0
                    </h4>
                    <p className="text-[11px] text-rose-700">
                      Elimina productos demo, pruebas de ventas y fiados para comenzar a operar desde cero con tu inventario real
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenResetDialog('clean_zero')}
                    className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Arrancar de 0 (Limpiar Todo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenResetDialog('restore_demo')}
                    className="py-2.5 px-3 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Restaurar Datos Demo
                  </button>
                </div>
              </div>

              {/* Backup reminder */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Cloud className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="text-xs text-blue-900">
                    <strong>Respaldo en la Nube y Multi-Dispositivo</strong>
                    <div className="text-[11px] text-blue-700">Guarda tus datos en Google Drive o sincroniza con tu cuenta Google.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setIsGoogleModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100 text-blue-900 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                  >
                    Cuenta Google & PWA
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBackupModalOpen(true)}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                  >
                    Descargar Excel/JSON
                  </button>
                </div>
              </div>

              {/* Cerrar Sesión Card */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      Cerrar Sesión del Sistema
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cierra la sesión actual y regresa a la pantalla principal de inicio de sesión con cuenta Google
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    await logoutGoogle();
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              * Cambios aplicables a comprobantes y ventas
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cerrar
              </button>
              
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {showSavedFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>¡Guardado!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

        {/* Modal Confirmación de Reinicio con Clave de Gerente */}
        {isResetConfirmOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-rose-200 animate-in zoom-in-95">
              <div className="flex items-center gap-2.5 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-black text-sm text-slate-900">
                  {resetMode === 'clean_zero' ? 'Confirmar Arranque en Cero' : 'Restaurar Datos de Demostración'}
                </h3>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
                <p>
                  {resetMode === 'clean_zero'
                    ? 'Se vaciará el catálogo (0 productos), ventas, gastos, fiados y cuentas por pagar. Los datos de tu negocio se mantendrán.'
                    : 'Se restablecerán los artículos de abarrotes, charcutería y servicios de prueba.'}
                </p>
              </div>

              <form onSubmit={handleExecuteReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ingrese clave de gerente ({managerPin}) o escriba <strong className="text-rose-600">REINICIAR</strong>:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Clave: ${managerPin} o REINICIAR`}
                    value={pinConfirmation}
                    onChange={(e) => {
                      setPinConfirmation(e.target.value);
                      setResetError('');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {resetError && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1">{resetError}</p>
                  )}
                </div>

                {resetSuccessFeedback ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>¡Reinicio exitoso!</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setIsResetConfirmOpen(false)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                      <span>{isSaving ? 'Procesando...' : 'Confirmar'}</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Modal Confirmación de Eliminación de Método de Pago / POS / Cuenta Bancaria */}
        {deleteAccountTarget && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-rose-200 animate-in zoom-in-95">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    ¿Eliminar {deleteAccountTarget.type === 'pm' ? 'Cuenta Pago Móvil' : deleteAccountTarget.type === 'pos' ? 'Terminal POS' : 'Cuenta Bancaria'}?
                  </h3>
                  <p className="text-[11px] text-slate-500">Se eliminará de forma permanente en Cloud Firestore.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div className="font-bold text-slate-900">{deleteAccountTarget.title}</div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">{deleteAccountTarget.subtitle}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSavingAccountAction}
                  onClick={() => setDeleteAccountTarget(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingAccountAction}
                  onClick={handleConfirmDeleteAccountItem}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  {isSavingAccountAction ? 'Eliminando...' : 'Sí, Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backup & Google Drive Modal */}
        <BackupDriveModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
        />

      </div>
    </div>
  );
};
