import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  Upload, 
  Trash2, 
  Check, 
  X, 
  Store, 
  FileText, 
  Phone, 
  MapPin, 
  Mail, 
  Instagram, 
  CreditCard, 
  Receipt,
  Sparkles,
  Image as ImageIcon,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Plus,
  Cloud,
  Layers,
  Smartphone,
  Landmark,
  Star,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Palette,
  ShieldCheck,
  Lock,
  Key,
  Server,
  HardDrive,
  CheckCircle2,
  Shield
} from 'lucide-react';
import { PagoMovilAccount, POSTerminal, BankAccount } from '../../types';
import { BackupDriveModal } from './BackupDriveModal';

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
    return businessInfo.pagoMovilAccounts || [
      {
        id: 'pm-1',
        bank: businessInfo.pagoMovilBank || '0102 - Banco de Venezuela',
        phone: businessInfo.pagoMovilPhone || '0414-7890123',
        ci: businessInfo.pagoMovilCI || 'V-20194852',
        holderName: businessInfo.name || 'PosVenecia',
        isDefault: true
      }
    ];
  });

  const [posTerminals, setPosTerminals] = useState<POSTerminal[]>(() => {
    return businessInfo.posTerminals || [
      {
        id: 'pos-1',
        name: 'Punto Inalámbrico (Caja 1)',
        bank: '0134 - Banesco',
        serial: 'BN-884920',
        isDefault: true
      }
    ];
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    return businessInfo.bankAccounts || [
      {
        id: 'bk-1',
        bank: '0102 - Banco de Venezuela',
        accountNumber: '0102-0123-45-0000123456',
        accountType: 'corriente',
        holderName: businessInfo.name || 'PosVenecia C.A.',
        holderCI: businessInfo.rif || 'J-40912847-2',
        email: businessInfo.email || 'pagos@posvenecia.com',
        isDefault: true
      }
    ];
  });

  // Sub-forms for adding new accounts
  const [isAddingPM, setIsAddingPM] = useState(false);
  const [newPMBank, setNewPMBank] = useState('0102 - Banco de Venezuela');
  const [newPMPhone, setNewPMPhone] = useState('');
  const [newPMCI, setNewPMCI] = useState('');
  const [newPMHolder, setNewPMHolder] = useState('');

  const [isAddingPOS, setIsAddingPOS] = useState(false);
  const [newPOSName, setNewPOSName] = useState('');
  const [newPOSBank, setNewPOSBank] = useState('0134 - Banesco');
  const [newPOSSerial, setNewPOSSerial] = useState('');

  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBankName, setNewBankName] = useState('0134 - Banesco');
  const [newBankAccountNumber, setNewBankAccountNumber] = useState('');
  const [newBankAccountType, setNewBankAccountType] = useState<'corriente' | 'ahorro'>('corriente');
  const [newBankHolder, setNewBankHolder] = useState('');
  const [newBankCI, setNewBankCI] = useState('');
  const [newBankEmail, setNewBankEmail] = useState('');

  // Modals
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Factory reset states
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'clean_zero' | 'restore_demo'>('clean_zero');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccessFeedback, setResetSuccessFeedback] = useState(false);

  // Sync modal form with live Cloud Firestore businessInfo whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
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
    if (businessInfo.pagoMovilAccounts) {
      setPagoMovilAccounts(businessInfo.pagoMovilAccounts);
    }
    if (businessInfo.posTerminals) {
      setPosTerminals(businessInfo.posTerminals);
    }
    if (businessInfo.bankAccounts) {
      setBankAccounts(businessInfo.bankAccounts);
    }
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
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('La imagen no debe superar los 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      // Compress/resize logo automatically so it fits safely within Firestore's 1MB document limit
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/webp', 0.82);
          setFormData(prev => ({
            ...prev,
            logoUrl: compressed.length < rawDataUrl.length ? compressed : rawDataUrl
          }));
        } else {
          setFormData(prev => ({ ...prev, logoUrl: rawDataUrl }));
        }
      };
      img.onerror = () => {
        setFormData(prev => ({ ...prev, logoUrl: rawDataUrl }));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLogoUrl = () => {
    if (logoInputUrl.trim()) {
      setFormData(prev => ({ ...prev, logoUrl: logoInputUrl.trim() }));
      setLogoInputUrl('');
      setShowUrlInput(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add Pago Móvil account
  const handleAddPagoMovilAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPMPhone.trim() || !newPMCI.trim()) return;

    const newAcc: PagoMovilAccount = {
      id: 'pm-' + Date.now(),
      bank: newPMBank,
      phone: newPMPhone.trim(),
      ci: newPMCI.trim().toUpperCase(),
      holderName: newPMHolder.trim() || formData.name,
      isDefault: pagoMovilAccounts.length === 0
    };

    setPagoMovilAccounts(prev => [...prev, newAcc]);
    setNewPMPhone('');
    setNewPMCI('');
    setNewPMHolder('');
    setIsAddingPM(false);
  };

  // Add POS Terminal
  const handleAddPOSTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOSName.trim()) return;

    const newTerm: POSTerminal = {
      id: 'pos-' + Date.now(),
      name: newPOSName.trim(),
      bank: newPOSBank,
      serial: newPOSSerial.trim() || undefined,
      isDefault: posTerminals.length === 0
    };

    setPosTerminals(prev => [...prev, newTerm]);
    setNewPOSName('');
    setNewPOSSerial('');
    setIsAddingPOS(false);
  };

  // Add Bank Account
  const handleAddBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankAccountNumber.trim()) return;

    const newAcc: BankAccount = {
      id: 'bk-' + Date.now(),
      bank: newBankName,
      accountNumber: newBankAccountNumber.trim(),
      accountType: newBankAccountType,
      holderName: newBankHolder.trim() || formData.name,
      holderCI: newBankCI.trim().toUpperCase() || formData.rif,
      email: newBankEmail.trim() || undefined,
      isDefault: bankAccounts.length === 0
    };

    setBankAccounts(prev => [...prev, newAcc]);
    setNewBankAccountNumber('');
    setNewBankHolder('');
    setNewBankCI('');
    setNewBankEmail('');
    setIsAddingBank(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const defaultPM = pagoMovilAccounts.find(a => a.isDefault) || pagoMovilAccounts[0];

    updateBusinessInfo({
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
  };

  const handleOpenResetDialog = (mode: 'clean_zero' | 'restore_demo') => {
    setResetMode(mode);
    setPinConfirmation('');
    setResetError('');
    setIsResetConfirmOpen(true);
  };

  const handleExecuteReset = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinConfirmation.trim();
    if (pin !== managerPin && pin.toUpperCase() !== 'REINICIAR' && pin !== '0000') {
      setResetError(`Clave incorrecta. Ingrese la clave de gerente (${managerPin}) o escriba REINICIAR.`);
      return;
    }
    
    updateBusinessInfo(formData);
    factoryReset(resetMode);
    
    setResetSuccessFeedback(true);
    setTimeout(() => {
      setResetSuccessFeedback(false);
      setIsResetConfirmOpen(false);
      onClose();
      if (resetMode === 'clean_zero') {
        setActiveTab('productos');
      }
    }, 1100);
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
              
              {/* SUBSECTION 1: CUENTAS DE PAGO MÓVIL */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      Cuentas de Pago Móvil ({pagoMovilAccounts.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingPM(true)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar Pago Móvil</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {pagoMovilAccounts.map((pm, idx) => (
                    <div 
                      key={pm.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{pm.bank}</span>
                          {pm.isDefault && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.2 rounded">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Telf: <strong>{pm.phone}</strong> • CI/RIF: <strong>{pm.ci}</strong> • Titular: {pm.holderName}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!pm.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              setPagoMovilAccounts(prev => prev.map(a => ({ ...a, isDefault: a.id === pm.id })));
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Marcar como cuenta principal"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        {pagoMovilAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPagoMovilAccounts(prev => prev.filter(a => a.id !== pm.id))}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Eliminar cuenta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingPM && (
                  <div className="bg-white p-3 rounded-xl border border-blue-300 space-y-2 animate-in fade-in">
                    <div className="text-xs font-bold text-blue-900">Nueva Cuenta de Pago Móvil</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Banco Receptor</label>
                        <select
                          value={newPMBank}
                          onChange={(e) => setNewPMBank(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          {VENEZUELAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Teléfono Pago Móvil</label>
                        <input
                          type="text"
                          placeholder="0414-1234567"
                          value={newPMPhone}
                          onChange={(e) => setNewPMPhone(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Cédula / RIF</label>
                        <input
                          type="text"
                          placeholder="V-12345678 o J-12345678-0"
                          value={newPMCI}
                          onChange={(e) => setNewPMCI(e.target.value)}
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
                        onClick={() => setIsAddingPM(false)}
                        className="px-2.5 py-1 text-slate-500 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPagoMovilAccount}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
                      >
                        Guardar Cuenta
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SUBSECTION 2: PUNTOS DE VENTA (POS) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      Puntos de Venta / Terminales POS ({posTerminals.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingPOS(true)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar Punto</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {posTerminals.map((pos) => (
                    <div 
                      key={pos.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{pos.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                            {pos.bank}
                          </span>
                        </div>
                        {pos.serial && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Serial: {pos.serial}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {posTerminals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPosTerminals(prev => prev.filter(t => t.id !== pos.id))}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingPOS && (
                  <div className="bg-white p-3 rounded-xl border border-indigo-300 space-y-2 animate-in fade-in">
                    <div className="text-xs font-bold text-indigo-900">Nuevo Punto de Venta</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Nombre del Terminal</label>
                        <input
                          type="text"
                          placeholder="Ej: Punto Caja 1 Inalámbrico"
                          value={newPOSName}
                          onChange={(e) => setNewPOSName(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Banco del Punto</label>
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
                        onClick={() => setIsAddingPOS(false)}
                        className="px-2.5 py-1 text-slate-500 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPOSTerminal}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                      >
                        Guardar Punto
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SUBSECTION 3: CUENTAS BANCARIAS (TRANSFERENCIAS) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                      Cuentas Bancarias para Transferencias ({bankAccounts.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingBank(true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar Cuenta Bancaria</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {bankAccounts.map((bk) => (
                    <div 
                      key={bk.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{bk.bank}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 capitalize">
                            Cuenta {bk.accountType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                          Nro: <strong>{bk.accountNumber}</strong> • Titular: <strong>{bk.holderName}</strong> ({bk.holderCI})
                        </div>
                        {bk.email && (
                          <div className="text-[10px] text-slate-400">
                            Email comprobante: {bk.email}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {bankAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBankAccounts(prev => prev.filter(b => b.id !== bk.id))}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingBank && (
                  <div className="bg-white p-3 rounded-xl border border-emerald-300 space-y-2 animate-in fade-in">
                    <div className="text-xs font-bold text-emerald-900">Nueva Cuenta Bancaria</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Banco</label>
                        <select
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          {VENEZUELAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Número de Cuenta (20 Dígitos)</label>
                        <input
                          type="text"
                          maxLength={20}
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
                          onChange={(e) => setNewBankAccountType(e.target.value as any)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="corriente">Corriente</option>
                          <option value="ahorro">Ahorro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">Titular y Cédula/RIF</label>
                        <input
                          type="text"
                          placeholder="PosVenecia C.A. / J-40912847-2"
                          value={newBankHolder}
                          onChange={(e) => setNewBankHolder(e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingBank(false)}
                        className="px-2.5 py-1 text-slate-500 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddBankAccount}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                      >
                        Guardar Cuenta
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

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              * Cambios aplicables a comprobantes y ventas
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {showSavedFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>¡Guardado!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar Cambios</span>
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
                      onClick={() => setIsResetConfirmOpen(false)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirmar</span>
                    </button>
                  </div>
                )}
              </form>
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
