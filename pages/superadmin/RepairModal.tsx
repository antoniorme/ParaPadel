import React, { useRef, useState } from 'react';
import { X, AlertTriangle, Mail, ShieldCheck, Send } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../../lib/supabase';
import { Club } from './types';

const HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN ?? '';

interface RepairModalProps {
    club: Club | null;
    isOfflineMode: boolean;
    onClose: () => void;
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
    onRefresh: () => void;
}

const RepairModal: React.FC<RepairModalProps> = ({ club, isOfflineMode, onClose, onSuccess, onError, onRefresh }) => {
    const [manualEmail, setManualEmail] = useState('');
    const [mode, setMode] = useState<'repair' | 'send'>('send');
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);

    React.useEffect(() => {
        if (club) {
            if (club.email) { setManualEmail(club.email); setMode('send'); }
            else { setManualEmail(''); setMode('repair'); }
        }
        captchaRef.current?.resetCaptcha(); setCaptchaToken(null);
    }, [club]);

    const handleConfirm = async () => {
        if (!club || !manualEmail) return;
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) { onError("Captcha requerido."); return; }
        try {
            await supabase.from('clubs').update({ email: manualEmail }).eq('id', club.id);
            await supabase.auth.resetPasswordForEmail(manualEmail, {
                redirectTo: window.location.origin + '/#/reset-password',
                captchaToken: captchaToken || undefined
            });
            onSuccess(`Enviado a ${manualEmail}`); onClose(); onRefresh();
        } catch (err: any) { onError(err.message); }
    };

    if (!club) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-scale-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                <div className="text-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${mode === 'repair' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {mode === 'repair' ? <AlertTriangle size={32}/> : <Mail size={32}/>}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">{mode === 'repair' ? 'Reparar Ficha' : 'Enviar Acceso'}</h3>
                </div>
                <div className="space-y-4">
                    <input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="Email admin..." className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-800" autoFocus/>
                    {!isOfflineMode && HCAPTCHA_SITE_TOKEN && (
                        <div className="flex justify-center min-h-[78px] scale-90">
                            <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={token => setCaptchaToken(token)} ref={captchaRef}/>
                        </div>
                    )}
                    <button onClick={handleConfirm} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2">
                        {mode === 'repair' ? <ShieldCheck size={18}/> : <Send size={18}/>} Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RepairModal;
