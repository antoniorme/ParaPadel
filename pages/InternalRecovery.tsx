import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Lock, Key, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

let HCAPTCHA_SITE_TOKEN = "";
try {
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env.VITE_HCAPTCHA_SITE_TOKEN) {
        // @ts-ignore
        HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN;
    }
} catch (e) {}

const InternalRecovery: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'editing' | 'success'>('editing');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError("Las claves no coinciden."); return; }
        if (password.length < 6) { setError("Mínimo 6 caracteres."); return; }
        if (HCAPTCHA_SITE_TOKEN && !captchaToken) { setError("Completa el captcha."); return; }
        
        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;
            
            setStatus('success');
            setTimeout(() => navigate('/'), 2000);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
            if(captchaRef.current) captchaRef.current.resetCaptcha();
            setCaptchaToken(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl border border-indigo-100 animate-slide-up relative">
                
                {status === 'editing' ? (
                    <form onSubmit={handleUpdate} className="space-y-6 animate-fade-in">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#575AF9]">
                                <Key size={32}/>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight">Nueva Contraseña</h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Tu acceso ha sido verificado</p>
                        </div>

                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                                <AlertCircle size={14}/> {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input 
                                    type={showPass ? "text" : "password"} 
                                    required 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-slate-900 focus:border-[#575AF9] outline-none font-bold text-lg shadow-inner" 
                                    placeholder="Nueva Clave" 
                                    autoFocus
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-4 text-slate-400">
                                    {showPass ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input 
                                    type="password" 
                                    required 
                                    value={confirm} 
                                    onChange={(e) => setConfirm(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:border-[#575AF9] outline-none font-bold text-lg shadow-inner" 
                                    placeholder="Repetir Clave"
                                />
                            </div>
                        </div>

                        {HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center scale-90 min-h-[78px]">
                                <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={setCaptchaToken} ref={captchaRef}/>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading || (HCAPTCHA_SITE_TOKEN && !captchaToken)} 
                            className="w-full bg-[#575AF9] hover:bg-[#484bf0] disabled:opacity-50 py-5 rounded-2xl font-black text-white shadow-xl shadow-indigo-100 flex justify-center items-center gap-2 text-lg active:scale-95 transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin" size={24} /> : "GUARDAR CAMBIOS"}
                        </button>
                    </form>
                ) : (
                    <div className="py-8 space-y-6 animate-fade-in">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-sm">
                            <CheckCircle2 size={48}/>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">¡Contraseña Cambiada!</h2>
                            <p className="text-emerald-600 font-bold text-sm">Tu seguridad ha sido actualizada.</p>
                        </div>
                        <p className="text-slate-400 text-xs animate-pulse font-bold uppercase tracking-widest">Entrando en el Dashboard...</p>
                    </div>
                )}
                
                <div className="text-center text-[9px] text-slate-300 mt-10 font-black uppercase tracking-[0.2em]">PadelPro Core Identity</div>
            </div>
        </div>
    );
};

export default InternalRecovery;