import React, { useRef, useState } from 'react';
import { Plus, Mail, Building, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../../lib/supabase';
import { UserResult } from './types';

const HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN ?? '';

interface CreateClubModalProps {
    isOpen: boolean;
    isOfflineMode: boolean;
    onClose: () => void;
    onSuccess: (msg: string, credentials?: { email: string; pass: string }) => void;
    onError: (msg: string) => void;
    onRefresh: () => void;
}

const CreateClubModal: React.FC<CreateClubModalProps> = ({
    isOpen, isOfflineMode, onClose, onSuccess, onError, onRefresh
}) => {
    const [quickEmail, setQuickEmail] = useState('');
    const [quickClubName, setQuickClubName] = useState('');
    const [searchEmail, setSearchEmail] = useState('');
    const [foundUser, setFoundUser] = useState<UserResult | null>(null);
    const [clubName, setClubName] = useState('');
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);

    const reset = () => {
        setQuickEmail(''); setQuickClubName(''); setSearchEmail('');
        setFoundUser(null); setClubName(''); setCaptchaToken(null);
        captchaRef.current?.resetCaptcha();
    };

    const handleClose = () => { reset(); onClose(); };

    const handleQuickInvite = async () => {
        if (!quickEmail || !quickClubName) return;
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) { onError("Completa el Captcha."); return; }
        try {
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            const tempPass = `PadelPro${randomDigits}!`;
            const tempClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: quickEmail, password: tempPass,
                options: { captchaToken: captchaToken || undefined }
            });
            if (authError) throw authError;
            await supabase.from('clubs').insert([{
                owner_id: authData.user!.id, name: quickClubName, is_active: true, email: quickEmail
            }]);
            onSuccess(`Club "${quickClubName}" creado.`, { email: quickEmail, pass: tempPass });
            reset(); onClose(); onRefresh();
        } catch (err: any) {
            onError(err.message);
            captchaRef.current?.resetCaptcha(); setCaptchaToken(null);
        }
    };

    const handleSearchUser = async () => {
        if (!searchEmail) return;
        setFoundUser(null);
        const { data } = await supabase.from('players').select('user_id, name, email').ilike('email', searchEmail.trim()).limit(1).maybeSingle();
        if (data) {
            const { data: existingClub } = await supabase.from('clubs').select('id').eq('owner_id', data.user_id).maybeSingle();
            if (existingClub) onError("Este usuario ya es dueño de un club.");
            else setFoundUser({ id: data.user_id!, name: data.name, email: data.email! });
        } else onError("Usuario no encontrado.");
    };

    const handleCreateFromExisting = async () => {
        if (!foundUser || !clubName) return;
        const { error } = await supabase.from('clubs').insert([{ owner_id: foundUser.id, name: clubName, is_active: true, email: foundUser.email }]);
        if (error) onError(error.message);
        else { onSuccess(`Club "${clubName}" creado.`); reset(); onClose(); onRefresh(); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Plus className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg" size={32}/> Nuevo Club
                    </h3>
                    <button onClick={handleClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                    {/* Quick invite */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Administrador</label>
                            <div className="flex items-center gap-2 mt-1 border rounded-xl px-3 py-2 bg-slate-50 border-slate-200">
                                <Mail size={18} className="text-slate-400"/>
                                <input value={quickEmail} onChange={e => setQuickEmail(e.target.value)} placeholder="admin@club.com" className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre del Club</label>
                            <div className="flex items-center gap-2 mt-1 border rounded-xl px-3 py-2 bg-slate-50 border-slate-200">
                                <Building size={18} className="text-slate-400"/>
                                <input value={quickClubName} onChange={e => setQuickClubName(e.target.value)} placeholder="Padel Indoor Center" className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"/>
                            </div>
                        </div>
                        {!isOfflineMode && HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center mt-2 scale-90">
                                <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={token => setCaptchaToken(token)} ref={captchaRef}/>
                            </div>
                        )}
                        <button onClick={handleQuickInvite} disabled={!quickEmail || !quickClubName} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            CREAR CLUB Y GENERAR CLAVE
                        </button>
                    </div>

                    <div className="h-px bg-slate-100 w-full"/>

                    {/* Existing user */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">O vincular Usuario Existente</h4>
                        <div className="flex gap-2">
                            <input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Email..." className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"/>
                            <button onClick={handleSearchUser} className="bg-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-300 font-bold text-xs">BUSCAR</button>
                        </div>
                        {foundUser && (
                            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 animate-fade-in">
                                <div className="text-[10px] font-black text-emerald-700 uppercase mb-1">Usuario Encontrado</div>
                                <div className="text-sm font-bold text-slate-800 mb-2 truncate">{foundUser.email}</div>
                                <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Nombre del club..." className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-sm mb-2 outline-none"/>
                                <button onClick={handleCreateFromExisting} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-black">ASIGNAR CLUB</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateClubModal;
