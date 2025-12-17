
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Shield, Users, Building, Plus, Search, Check, AlertTriangle, LogOut, LayoutDashboard, Smartphone, Lock, Unlock, RefreshCw, Mail, Key, Trash2, X, Copy, Edit2, Send, Save, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import HCaptcha from '@hcaptcha/react-hcaptcha';

// ENVIRONMENT CHECK FOR CAPTCHA
let HCAPTCHA_SITE_TOKEN = "";
try {
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env.VITE_HCAPTCHA_SITE_TOKEN) {
        // @ts-ignore
        HCAPTCHA_SITE_TOKEN = import.meta.env.VITE_HCAPTCHA_SITE_TOKEN;
    }
} catch (e) {}

interface Club {
    id: string;
    owner_id: string;
    name: string;
    is_active: boolean;
    created_at: string;
}

interface UserResult {
    id: string; 
    name: string;
    email: string;
}

const SuperAdmin: React.FC = () => {
    const { isOfflineMode, signOut } = useAuth();
    const navigate = useNavigate();
    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    
    // Existing Club Search State
    const [searchEmail, setSearchEmail] = useState('');
    const [foundUser, setFoundUser] = useState<UserResult | null>(null);
    const [clubName, setClubName] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // New Quick Invite State
    const [quickEmail, setQuickEmail] = useState('');
    const [quickClubName, setQuickClubName] = useState('');
    
    // TEMP CREDENTIALS STATE (For the Modal)
    const [tempCredentials, setTempCredentials] = useState<{email: string, pass: string} | null>(null);
    
    // EDIT & DELETE STATE
    const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
    const [clubToEdit, setClubToEdit] = useState<Club | null>(null); // For renaming
    const [newName, setNewName] = useState('');
    const [resendingId, setResendingId] = useState<string | null>(null); // For loading state of email resend
    
    // REPAIR / MANUAL EMAIL MODAL STATE
    const [clubToRepair, setClubToRepair] = useState<Club | null>(null);
    const [manualEmailInput, setManualEmailInput] = useState('');
    const [modalMode, setModalMode] = useState<'repair' | 'send'>('send');

    // CAPTCHA STATE FOR ADMIN ACTIONS
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);

    const fetchClubs = async () => {
        setLoading(true);
        setFetchError(null);
        
        if (isOfflineMode) {
            setClubs([{ id: 'local-c1', owner_id: 'local-o1', name: 'Club Local Test', is_active: true, created_at: new Date().toISOString() }]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.from('clubs').select('*').order('created_at', { ascending: false });
        
        if (error) {
            setFetchError(error.message);
        } else if (data) {
            setClubs(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchClubs();
    }, []);

    // --- EXISTING USER SEARCH FLOW ---
    const handleSearchUser = async () => {
        if (!searchEmail) return;
        setCreateError(null);
        setFoundUser(null);

        const { data, error } = await supabase
            .from('players')
            .select('user_id, name, email')
            .ilike('email', searchEmail.trim()) 
            .limit(1)
            .maybeSingle();

        if (data) {
            const { data: existingClub } = await supabase.from('clubs').select('id').eq('owner_id', data.user_id).maybeSingle();
            if (existingClub) {
                setCreateError("Este usuario ya es dueño de un club.");
            } else {
                setFoundUser({ id: data.user_id!, name: data.name, email: data.email! });
            }
        } else {
            setCreateError("Usuario no encontrado en registros. Usa el alta rápida abajo.");
        }
    };

    const handleCreateClubFromExisting = async () => {
        if (!foundUser || !clubName) return;

        const { error } = await supabase.from('clubs').insert([{
            owner_id: foundUser.id,
            name: clubName,
            is_active: true
        }]);

        if (error) {
            setCreateError(error.message);
        } else {
            setSuccessMessage(`Club "${clubName}" asignado a ${foundUser.email}.`);
            setFoundUser(null);
            setClubName('');
            setSearchEmail('');
            fetchClubs();
        }
    };

    // --- NEW QUICK INVITE FLOW ---
    const handleQuickInvite = async () => {
        if (!quickEmail || !quickClubName) return;
        setCreateError(null);
        setSuccessMessage(null);
        
        // 1. Generate Temp Password (Random but readable)
        const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4 digits
        const tempPass = `PadelPro${randomDigits}!`;

        // 2. CHECK CAPTCHA IF NOT OFFLINE
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) {
            setCreateError("SuperAdmin: Por favor completa el Captcha para crear el usuario.");
            return;
        }

        try {
            // 3. Create SEPARATE client instance to sign up the new user
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            // 4. Sign Up User (Using Temp Client + Captcha)
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: quickEmail,
                password: tempPass,
                options: {
                    captchaToken: captchaToken || undefined
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("No se pudo crear el usuario (Auth Error).");

            // 5. Create Club Entry (Using MAIN Admin Client)
            const { error: clubError } = await supabase.from('clubs').insert([{
                owner_id: authData.user.id,
                name: quickClubName,
                is_active: true
            }]);

            if (clubError) throw clubError;

            // 6. CRITICAL: Create Player Record
            await supabase.from('players').insert([{
                user_id: authData.user.id,
                email: quickEmail,
                name: quickClubName, 
                categories: ['Admin'],
                manual_rating: 5
            }]);

            // 7. Trigger Password Reset Email
            try {
                await tempClient.auth.resetPasswordForEmail(quickEmail, {
                    redirectTo: window.location.origin + '/#/auth?type=recovery'
                });
            } catch (e) {
                console.warn("Could not trigger reset email", e);
            }

            // 8. SHOW CREDENTIALS MODAL
            setTempCredentials({ email: quickEmail, pass: tempPass });
            
            // Clean up UI
            setQuickEmail('');
            setQuickClubName('');
            if(captchaRef.current) captchaRef.current.resetCaptcha();
            setCaptchaToken(null);
            fetchClubs();

        } catch (err: any) {
            setCreateError(err.message || "Error al crear usuario.");
            if(captchaRef.current) captchaRef.current.resetCaptcha();
            setCaptchaToken(null);
        }
    };

    const toggleClubStatus = async (club: Club) => {
        const newState = !club.is_active;
        const { error } = await supabase.from('clubs').update({ is_active: newState }).eq('id', club.id);
        if (!error) {
            setClubs(clubs.map(c => c.id === club.id ? { ...c, is_active: newState } : c));
        }
    };

    const handleDeleteClub = async () => {
        if (!clubToDelete) return;
        
        try {
            const { error } = await supabase.from('clubs').delete().eq('id', clubToDelete.id);
            
            if (error) {
                if (error.message.includes('foreign key constraint')) {
                    throw new Error("No se puede eliminar: El club tiene dependencias directas. Bloquéalo en su lugar.");
                }
                throw error;
            }

            setClubs(clubs.filter(c => c.id !== clubToDelete.id));
            setClubToDelete(null);
            setSuccessMessage("Club eliminado. El usuario ahora es 'Jugador' pero sus datos persisten.");
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err: any) {
            setCreateError(err.message || "Error al eliminar club.");
            setClubToDelete(null);
        }
    };

    // --- NEW: EDIT CLUB NAME ---
    const openEditModal = (club: Club) => {
        setClubToEdit(club);
        setNewName(club.name);
    };

    const handleUpdateName = async () => {
        if (!clubToEdit || !newName) return;
        
        const { error } = await supabase.from('clubs').update({ name: newName }).eq('id', clubToEdit.id);
        
        if (error) {
            setCreateError("Error al renombrar: " + error.message);
        } else {
            setClubs(clubs.map(c => c.id === clubToEdit.id ? { ...c, name: newName } : c));
            setSuccessMessage("Nombre del club actualizado.");
            setTimeout(() => setSuccessMessage(null), 3000);
        }
        setClubToEdit(null);
    };

    // --- NEW: RESEND PASSWORD RESET ---
    const handleResendEmail = async (club: Club) => {
        setResendingId(club.id);
        setSuccessMessage(null);
        setCreateError(null);

        try {
            // 1. Find the email associated with this club
            const { data: playerData } = await supabase
                .from('players')
                .select('email')
                .eq('user_id', club.owner_id)
                .maybeSingle();

            // ALWAYS open modal to require Captcha
            setClubToRepair(club);
            
            if (playerData?.email) {
                setManualEmailInput(playerData.email);
                setModalMode('send');
            } else {
                setManualEmailInput('');
                setModalMode('repair');
            }
            
            // Reset Captcha
            if(captchaRef.current) captchaRef.current.resetCaptcha();
            setCaptchaToken(null);

        } catch (err: any) {
            setCreateError(err.message || "Error al comprobar datos.");
        } finally {
            setResendingId(null);
        }
    };

    // --- HANDLE REPAIR/SEND SUBMIT (FROM MODAL) ---
    const handleRepairAndSend = async () => {
        if (!clubToRepair || !manualEmailInput) return;
        setCreateError(null);

        // Verify email format
        if (!manualEmailInput.includes('@') || !manualEmailInput.includes('.')) {
            setCreateError("Email inválido.");
            return;
        }

        // Verify Captcha if online
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) {
            setCreateError("Por favor completa el Captcha.");
            return;
        }

        try {
            // 1. ENSURE PLAYER RECORD EXISTS (Upsert Logic)
            const { data: existing } = await supabase
                .from('players')
                .select('id')
                .eq('user_id', clubToRepair.owner_id)
                .maybeSingle();
            
            if (existing) {
                // Update email if changed
                await supabase.from('players').update({ email: manualEmailInput }).eq('id', existing.id);
            } else {
                // Insert new record (Repair)
                await supabase.from('players').insert([{
                    user_id: clubToRepair.owner_id,
                    email: manualEmailInput,
                    name: clubToRepair.name,
                    categories: ['Admin'],
                    manual_rating: 5
                }]);
            }

            // 2. Trigger Password Reset (Using Captcha if provided)
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(manualEmailInput, {
                redirectTo: window.location.origin + '/#/auth?type=recovery',
                captchaToken: captchaToken || undefined
            });

            if (resetError) throw resetError;

            setSuccessMessage(`Email enviado a ${manualEmailInput}`);
            
            // Close modal
            setClubToRepair(null);
            setManualEmailInput('');
            setCaptchaToken(null);

        } catch (err: any) {
            setCreateError(err.message || "Error al procesar la solicitud.");
            if(captchaRef.current) captchaRef.current.resetCaptcha();
            setCaptchaToken(null);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* HEADER */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Shield size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/10 p-2 rounded-lg">
                            <Shield size={24} className="text-emerald-400" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">Super Admin</h1>
                    </div>
                    <p className="text-slate-400 max-w-md">
                        Gestión global de la plataforma. Da de alta clubs y supervisa la actividad.
                    </p>
                    
                    <div className="flex gap-4 mt-8">
                        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors">
                            <LayoutDashboard size={16}/> Mi Club Dashboard
                        </button>
                        <button onClick={() => navigate('/p/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors">
                            <Smartphone size={16}/> App Jugadores
                        </button>
                    </div>
                </div>
            </div>

            {/* ERROR DISPLAY */}
            {createError && (
                <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 p-4 rounded-r-xl text-sm font-bold flex items-center gap-2 shadow-sm">
                    <AlertTriangle size={20}/> {createError}
                </div>
            )}
            
            {/* SUCCESS DISPLAY (General) */}
            {successMessage && !tempCredentials && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-4 rounded-r-xl text-sm font-bold flex items-center gap-2 shadow-sm animate-fade-in">
                    <Check size={20}/> {successMessage}
                </div>
            )}

            {/* --- TEMP CREDENTIALS MODAL --- */}
            {tempCredentials && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-2xl max-w-md w-full relative animate-scale-in">
                        <button onClick={() => setTempCredentials(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                            <X size={20}/>
                        </button>
                        
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                                <Key size={32}/>
                            </div>
                            <h3 className="font-black text-slate-900 text-2xl mb-2">¡Club Creado!</h3>
                            <p className="text-slate-500 text-sm">
                                Copia estas credenciales y envíaselas al dueño del club ahora mismo.
                            </p>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email (Usuario)</label>
                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 mt-1">
                                    <code className="text-slate-800 font-bold select-all">{tempCredentials.email}</code>
                                    <button onClick={() => navigator.clipboard.writeText(tempCredentials.email)} className="text-slate-400 hover:text-blue-500"><Copy size={16}/></button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contraseña Temporal</label>
                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 mt-1">
                                    <code className="text-emerald-600 font-black text-lg select-all">{tempCredentials.pass}</code>
                                    <button onClick={() => navigator.clipboard.writeText(tempCredentials.pass)} className="text-slate-400 hover:text-blue-500"><Copy size={16}/></button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 bg-blue-50 p-4 rounded-xl flex gap-3 items-start text-xs text-blue-800">
                            <Mail size={16} className="shrink-0 mt-0.5"/>
                            <p>También hemos enviado un email de "Restablecer Contraseña" a esta dirección, por si prefieren poner la suya propia.</p>
                        </div>

                        <button 
                            onClick={() => setTempCredentials(null)}
                            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800"
                        >
                            He copiado los datos, cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* --- REPAIR / SEND EMAIL MODAL --- */}
            {clubToRepair && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-scale-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => setClubToRepair(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                            <X size={20}/>
                        </button>

                        <div className="text-center mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalMode === 'repair' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                {modalMode === 'repair' ? <AlertTriangle size={32}/> : <Mail size={32}/>}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">
                                {modalMode === 'repair' ? 'Faltan Datos' : 'Enviar Acceso'}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {modalMode === 'repair' 
                                    ? `No encontramos el email de ${clubToRepair.name}.` 
                                    : `Confirmar envío de claves a ${clubToRepair.name}.`}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {modalMode === 'repair' && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                                    Introduce el email del administrador para reparar su ficha y enviarle un enlace de acceso.
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Email del Administrador</label>
                                <input 
                                    type="email"
                                    value={manualEmailInput}
                                    onChange={e => setManualEmailInput(e.target.value)}
                                    placeholder="admin@club.com"
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-500 font-bold text-slate-800"
                                    autoFocus={modalMode === 'repair'}
                                />
                            </div>

                            {/* CAPTCHA INSIDE MODAL */}
                            {(!isOfflineMode && HCAPTCHA_SITE_TOKEN) ? (
                                <div className="flex justify-center min-h-[78px]">
                                    <HCaptcha
                                        sitekey={HCAPTCHA_SITE_TOKEN}
                                        onVerify={token => setCaptchaToken(token)}
                                        ref={captchaRef}
                                    />
                                </div>
                            ) : (
                                <div className="bg-slate-100 p-2 rounded text-center text-xs text-slate-400 font-mono">
                                    Captcha Omitido (Modo Local/Offline)
                                </div>
                            )}

                            <button 
                                onClick={handleRepairAndSend}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2"
                            >
                                {modalMode === 'repair' ? <ShieldCheck size={18}/> : <Send size={18}/>}
                                {modalMode === 'repair' ? 'Reparar y Enviar' : 'Confirmar Envío'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. QUICK CREATE (NEW USER) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Plus className="bg-indigo-100 text-indigo-600 p-1 rounded-md" size={24}/> Alta Rápida (Nuevo Usuario)
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Email del Club</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Mail size={16} className="text-slate-400"/>
                                <input 
                                    value={quickEmail}
                                    onChange={e => setQuickEmail(e.target.value)}
                                    placeholder="contacto@clubpadel.com"
                                    className="flex-1 bg-slate-50 border-b border-slate-200 p-2 outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Nombre del Club</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Building size={16} className="text-slate-400"/>
                                <input 
                                    value={quickClubName}
                                    onChange={e => setQuickClubName(e.target.value)}
                                    placeholder="Club Padel Norte"
                                    className="flex-1 bg-slate-50 border-b border-slate-200 p-2 outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        </div>

                        {/* CAPTCHA FOR SUPERADMIN */}
                        {!isOfflineMode && HCAPTCHA_SITE_TOKEN && (
                            <div className="flex justify-center mt-2">
                                <HCaptcha
                                    sitekey={HCAPTCHA_SITE_TOKEN}
                                    onVerify={token => setCaptchaToken(token)}
                                    ref={captchaRef}
                                />
                            </div>
                        )}

                        <button 
                            onClick={handleQuickInvite} 
                            disabled={!quickEmail || !quickClubName}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            Crear y Generar Claves
                        </button>
                    </div>
                </div>

                {/* 2. ASSIGN EXISTING USER */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Search className="bg-slate-100 text-slate-600 p-1 rounded-md" size={24}/> Asignar a Usuario Existente
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input 
                                value={searchEmail}
                                onChange={e => setSearchEmail(e.target.value)}
                                placeholder="Buscar email..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-400 text-sm"
                            />
                            <button onClick={handleSearchUser} className="bg-slate-200 text-slate-600 px-4 rounded-xl font-bold hover:bg-slate-300">
                                <Search size={18}/>
                            </button>
                        </div>

                        {foundUser && (
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 animate-fade-in">
                                <div className="text-xs text-emerald-800 font-bold mb-1">Usuario Encontrado</div>
                                <div className="text-sm font-bold text-slate-800">{foundUser.name}</div>
                                <div className="text-xs text-slate-500 mb-3">{foundUser.email}</div>
                                
                                <div className="flex gap-2">
                                    <input 
                                        value={clubName}
                                        onChange={e => setClubName(e.target.value)}
                                        placeholder="Nombre Club..."
                                        className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none"
                                    />
                                    <button onClick={handleCreateClubFromExisting} className="bg-emerald-500 text-white px-3 rounded-lg font-bold text-xs hover:bg-emerald-600">
                                        Asignar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CLUBS LIST */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Building size={20} className="text-slate-400"/> Clubs Activos ({clubs.length})
                    </h3>
                    <button onClick={fetchClubs} className="p-2 text-slate-400 hover:text-blue-500 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
                
                {fetchError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
                        <AlertTriangle size={18}/> Error cargando clubs: {fetchError}
                    </div>
                )}

                {loading ? <div className="text-center py-10 text-slate-400">Cargando clubs...</div> : (
                    clubs.map(club => (
                        <div key={club.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <div className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    {club.name}
                                </div>
                                <div className="text-xs text-slate-400 font-mono">ID: {club.id}</div>
                                <div className="text-xs text-slate-500 mt-1">Creado: {new Date(club.created_at).toLocaleDateString()}</div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* EDIT NAME */}
                                <button 
                                    onClick={() => openEditModal(club)}
                                    className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                                    title="Editar Nombre"
                                >
                                    <Edit2 size={16}/>
                                </button>

                                {/* RESEND EMAIL */}
                                <button 
                                    onClick={() => handleResendEmail(club)}
                                    disabled={resendingId === club.id}
                                    className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                    title="Reenviar Email de Acceso"
                                >
                                    {resendingId === club.id ? <RefreshCw size={16} className="animate-spin"/> : <Send size={16}/>}
                                </button>

                                {/* STATUS TOGGLE */}
                                <button 
                                    onClick={() => toggleClubStatus(club)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${club.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                >
                                    {club.is_active ? <Unlock size={14}/> : <Lock size={14}/>}
                                    {club.is_active ? 'Activo' : 'Bloqueado'}
                                </button>
                                
                                {/* DELETE */}
                                <button 
                                    onClick={() => setClubToDelete(club)}
                                    className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors"
                                    title="Eliminar Club"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    ))
                )}
                {!loading && clubs.length === 0 && !fetchError && (
                    <div className="text-center py-10 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No hay clubs registrados.
                    </div>
                )}
            </div>

            {/* EDIT NAME MODAL */}
            {clubToEdit && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                        <h3 className="text-xl font-black text-slate-900 mb-4">Editar Nombre</h3>
                        <input 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 mb-6"
                            placeholder="Nombre del club"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setClubToEdit(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">
                                Cancelar
                            </button>
                            <button onClick={handleUpdateName} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                                <Save size={18}/> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {clubToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">¿Eliminar Club?</h3>
                        <p className="text-slate-500 mb-4 text-sm">
                            Estás a punto de eliminar el acceso de administrador para <strong>{clubToDelete.name}</strong>.
                        </p>
                        <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-left mb-6">
                            <p className="text-xs text-rose-700 font-bold flex items-start gap-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                                <span>Advertencia: Esto eliminará el perfil del Club. El usuario pasará a ser 'Jugador' pero los datos históricos (torneos, partidos) se mantendrán en la base de datos.</span>
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setClubToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">
                                Cancelar
                            </button>
                            <button onClick={handleDeleteClub} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdmin;
