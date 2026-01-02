
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { 
    Shield, Building, Plus, Search, Check, AlertTriangle, 
    LayoutDashboard, Smartphone, Lock, Unlock, RefreshCw, 
    Mail, Key, Trash2, X, Copy, Edit2, Send, Save, 
    ShieldCheck, Users, Trophy, Activity, Eye, Calendar,
    UserCheck, TrendingUp, BarChart3
} from 'lucide-react';
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

interface ClubWithStats extends Club {
    playerCount: number;
    activeTourneys: number;
    finishedTourneys: number;
    ownerEmail?: string;
}

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
    
    // --- STATE ---
    const [clubs, setClubs] = useState<ClubWithStats[]>([]);
    const [globalStats, setGlobalStats] = useState({
        totalClubs: 0,
        totalPlayers: 0,
        activeTourneys: 0,
        finishedTourneys: 0
    });
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    
    // UI Controls
    const [inspectedClub, setInspectedClub] = useState<ClubWithStats | null>(null);
    const [clubDetailData, setClubDetailData] = useState<{
        players: any[],
        tournaments: any[]
    } | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Existing Logic States
    const [searchEmail, setSearchEmail] = useState('');
    const [foundUser, setFoundUser] = useState<UserResult | null>(null);
    const [clubName, setClubName] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [quickEmail, setQuickEmail] = useState('');
    const [quickClubName, setQuickClubName] = useState('');
    const [tempCredentials, setTempCredentials] = useState<{email: string, pass: string} | null>(null);
    const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
    const [clubToEdit, setClubToEdit] = useState<Club | null>(null);
    const [newName, setNewName] = useState('');
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [clubToRepair, setClubToRepair] = useState<Club | null>(null);
    const [manualEmailInput, setManualEmailInput] = useState('');
    const [modalMode, setModalMode] = useState<'repair' | 'send'>('send');
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const captchaRef = useRef<HCaptcha>(null);

    const fetchClubs = async () => {
        setLoading(true);
        setFetchError(null);
        
        if (isOfflineMode) {
            setClubs([{ 
                id: 'local-c1', owner_id: 'local-o1', name: 'Club Local Test', is_active: true, created_at: new Date().toISOString(),
                playerCount: 16, activeTourneys: 1, finishedTourneys: 5, ownerEmail: 'admin@local.test'
            }]);
            setGlobalStats({ totalClubs: 1, totalPlayers: 16, activeTourneys: 1, finishedTourneys: 5 });
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch Clubs
            const { data: clubsData, error: clubsError } = await supabase.from('clubs').select('*').order('created_at', { ascending: false });
            if (clubsError) throw clubsError;

            // 2. Fetch Aggregated Stats & Emails
            const { data: allPlayers } = await supabase.from('players').select('user_id, email');
            const { data: allTourneys } = await supabase.from('tournaments').select('user_id, status');

            const mappedClubs: ClubWithStats[] = (clubsData || []).map(club => {
                const clubPlayers = allPlayers?.filter(p => p.user_id === club.owner_id).length || 0;
                const clubTourneys = allTourneys?.filter(t => t.user_id === club.owner_id) || [];
                const ownerRecord = allPlayers?.find(p => p.user_id === club.owner_id);
                
                return {
                    ...club,
                    playerCount: clubPlayers,
                    activeTourneys: clubTourneys.filter(t => t.status !== 'finished').length,
                    finishedTourneys: clubTourneys.filter(t => t.status === 'finished').length,
                    ownerEmail: ownerRecord?.email
                };
            });

            setClubs(mappedClubs);
            setGlobalStats({
                totalClubs: mappedClubs.length,
                totalPlayers: allPlayers?.length || 0,
                activeTourneys: allTourneys?.filter(t => t.status !== 'finished').length || 0,
                finishedTourneys: allTourneys?.filter(t => t.status === 'finished').length || 0
            });

        } catch (error: any) {
            setFetchError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClubs();
    }, []);

    const fetchClubDetails = async (club: ClubWithStats) => {
        setLoadingDetails(true);
        setInspectedClub(club);
        
        if (isOfflineMode) {
            setClubDetailData({
                players: [{ name: 'Jugador Local' }],
                tournaments: [{ title: 'Torneo Local Test', status: 'active', date: new Date().toISOString() }]
            });
            setLoadingDetails(false);
            return;
        }

        const { data: players } = await supabase.from('players').select('name, categories, global_rating').eq('user_id', club.owner_id).order('name');
        const { data: tourneys } = await supabase.from('tournaments').select('title, status, date').eq('user_id', club.owner_id).order('date', { ascending: false });

        setClubDetailData({
            players: players || [],
            tournaments: tourneys || []
        });
        setLoadingDetails(false);
    };

    // --- LOGIC HANDLERS (MAINTAINED) ---
    const handleSearchUser = async () => {
        if (!searchEmail) return;
        setCreateError(null);
        setFoundUser(null);
        const { data } = await supabase.from('players').select('user_id, name, email').ilike('email', searchEmail.trim()).limit(1).maybeSingle();
        if (data) {
            const { data: existingClub } = await supabase.from('clubs').select('id').eq('owner_id', data.user_id).maybeSingle();
            if (existingClub) setCreateError("Este usuario ya es dueño de un club.");
            else setFoundUser({ id: data.user_id!, name: data.name, email: data.email! });
        } else setCreateError("Usuario no encontrado.");
    };

    const handleCreateClubFromExisting = async () => {
        if (!foundUser || !clubName) return;
        const { error } = await supabase.from('clubs').insert([{ owner_id: foundUser.id, name: clubName, is_active: true }]);
        if (error) setCreateError(error.message);
        else { setSuccessMessage(`Club "${clubName}" creado.`); setFoundUser(null); setClubName(''); setSearchEmail(''); fetchClubs(); }
    };

    const handleQuickInvite = async () => {
        if (!quickEmail || !quickClubName) return;
        setCreateError(null);
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const tempPass = `PadelPro${randomDigits}!`;
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) { setCreateError("Completa el Captcha."); return; }
        try {
            const tempClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
            const { data: authData, error: authError } = await tempClient.auth.signUp({ email: quickEmail, password: tempPass, options: { captchaToken: captchaToken || undefined } });
            if (authError) throw authError;
            await supabase.from('clubs').insert([{ owner_id: authData.user!.id, name: quickClubName, is_active: true }]);
            await supabase.from('players').insert([{ user_id: authData.user!.id, email: quickEmail, name: quickClubName, categories: ['Admin'], manual_rating: 5 }]);
            setTempCredentials({ email: quickEmail, pass: tempPass });
            setQuickEmail(''); setQuickClubName(''); if(captchaRef.current) captchaRef.current.resetCaptcha(); setCaptchaToken(null); fetchClubs();
        } catch (err: any) { setCreateError(err.message); if(captchaRef.current) captchaRef.current.resetCaptcha(); setCaptchaToken(null); }
    };

    const toggleClubStatus = async (club: Club) => {
        const newState = !club.is_active;
        const { error } = await supabase.from('clubs').update({ is_active: newState }).eq('id', club.id);
        if (!error) setClubs(clubs.map(c => c.id === club.id ? { ...c, is_active: newState } : c));
    };

    const handleDeleteClub = async () => {
        if (!clubToDelete) return;
        const { error } = await supabase.from('clubs').delete().eq('id', clubToDelete.id);
        if (error) setCreateError("Error eliminando club.");
        else { fetchClubs(); setClubToDelete(null); }
    };

    const handleUpdateName = async () => {
        if (!clubToEdit || !newName) return;
        const { error } = await supabase.from('clubs').update({ name: newName }).eq('id', clubToEdit.id);
        if (error) setCreateError(error.message);
        else { setClubs(clubs.map(c => c.id === clubToEdit.id ? { ...c, name: newName } : c)); setSuccessMessage("Nombre actualizado."); }
        setClubToEdit(null);
    };

    const handleResendEmail = async (club: Club) => {
        const { data: playerData } = await supabase.from('players').select('email').eq('user_id', club.owner_id).maybeSingle();
        setClubToRepair(club);
        if (playerData?.email) { setManualEmailInput(playerData.email); setModalMode('send'); }
        else { setManualEmailInput(''); setModalMode('repair'); }
        if(captchaRef.current) captchaRef.current.resetCaptcha(); setCaptchaToken(null);
    };

    const handleRepairAndSend = async () => {
        if (!clubToRepair || !manualEmailInput) return;
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) { setCreateError("Captcha requerido."); return; }
        try {
            await supabase.from('players').upsert([{ user_id: clubToRepair.owner_id, email: manualEmailInput, name: clubToRepair.name, categories: ['Admin'], manual_rating: 5 }], { onConflict: 'user_id' });
            await supabase.auth.resetPasswordForEmail(manualEmailInput, { redirectTo: window.location.origin + '/#/auth?type=recovery', captchaToken: captchaToken || undefined });
            setSuccessMessage(`Enviado a ${manualEmailInput}`); setClubToRepair(null); setCaptchaToken(null);
        } catch (err: any) { setCreateError(err.message); }
    };

    return (
        <div className="space-y-8 pb-32">
            {/* HEADER & GLOBAL STATS */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Shield size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-emerald-500 p-2 rounded-lg">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Super Admin Dashboard</h1>
                            <p className="text-slate-400 text-sm">Panel de control global de la plataforma PadelPro</p>
                        </div>
                    </div>
                    
                    {/* GLOBAL STATS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Building size={12} className="text-blue-400"/> Clubs
                            </div>
                            <div className="text-3xl font-black">{globalStats.totalClubs}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Activity size={12} className="text-rose-400"/> En Juego
                            </div>
                            <div className="text-3xl font-black text-rose-400">{globalStats.activeTourneys}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Trophy size={12} className="text-amber-400"/> Finalizados
                            </div>
                            <div className="text-3xl font-black">{globalStats.finishedTourneys}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Users size={12} className="text-emerald-400"/> Jugadores
                            </div>
                            <div className="text-3xl font-black text-emerald-400">{globalStats.totalPlayers}</div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-10">
                        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10">
                            <LayoutDashboard size={16}/> Mi Club
                        </button>
                        <button onClick={() => navigate('/p/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10">
                            <Smartphone size={16}/> App Jugador
                        </button>
                    </div>
                </div>
            </div>

            {/* ERROR/SUCCESS */}
            {(createError || successMessage) && (
                <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-sm animate-fade-in ${createError ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-700' : 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700'}`}>
                    {createError ? <AlertTriangle size={20}/> : <Check size={20}/>}
                    {createError || successMessage}
                </div>
            )}

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LIST OF CLUBS (Large Column) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Building size={20} className="text-slate-400"/> Gestión de Clubs
                        </h3>
                        <button onClick={fetchClubs} className="p-2 text-slate-400 hover:text-blue-500 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            Array.from({length: 4}).map((_, i) => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl"></div>)
                        ) : clubs.map(club => (
                            <div key={club.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-black text-slate-800 text-lg leading-tight truncate">{club.name}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${club.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                            {club.is_active ? 'ACTIVO' : 'BLOQUEADO'}
                                        </span>
                                    </div>
                                    
                                    {/* OWNER EMAIL DISPLAY */}
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                                        <Mail size={12} className="text-slate-300"/>
                                        <span className="truncate">{club.ownerEmail || 'Sin email asociado'}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                            <Users size={14} className="text-blue-500"/> {club.playerCount} <span className="font-normal text-slate-400">Jugadores</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                            <Activity size={14} className="text-rose-500"/> {club.activeTourneys} <span className="font-normal text-slate-400">Activos</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                            <Trophy size={14} className="text-amber-500"/> {club.finishedTourneys} <span className="font-normal text-slate-400">Historial</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                        onClick={() => fetchClubDetails(club)}
                                        className="p-3 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl border border-slate-100 transition-all"
                                        title="Inspeccionar Club"
                                    >
                                        <Eye size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => { setNewName(club.name); setClubToEdit(club); }}
                                        className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl border border-slate-100 transition-all"
                                        title="Renombrar"
                                    >
                                        <Edit2 size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handleResendEmail(club)}
                                        className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 transition-all"
                                        title="Claves"
                                    >
                                        <Send size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => toggleClubStatus(club)}
                                        className={`p-3 rounded-xl border transition-all ${club.is_active ? 'bg-slate-50 text-slate-400 hover:text-rose-600' : 'bg-rose-50 text-rose-600'}`}
                                        title={club.is_active ? 'Bloquear' : 'Desbloquear'}
                                    >
                                        {club.is_active ? <Unlock size={18}/> : <Lock size={18}/>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CREATION PANEL (Small Column) */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-24">
                        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Plus className="bg-indigo-100 text-indigo-600 p-1 rounded-md" size={24}/> Alta Rápida
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Administrador</label>
                                <div className="flex items-center gap-2 mt-1 border-b border-slate-100 pb-2">
                                    <Mail size={16} className="text-slate-300"/>
                                    <input value={quickEmail} onChange={e => setQuickEmail(e.target.value)} placeholder="admin@club.com" className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre del Club</label>
                                <div className="flex items-center gap-2 mt-1 border-b border-slate-100 pb-2">
                                    <Building size={16} className="text-slate-300"/>
                                    <input value={quickClubName} onChange={e => setQuickClubName(e.target.value)} placeholder="Padel Indoor Center" className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"/>
                                </div>
                            </div>

                            {!isOfflineMode && HCAPTCHA_SITE_TOKEN && (
                                <div className="flex justify-center mt-2 scale-90">
                                    <HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={token => setCaptchaToken(token)} ref={captchaRef}/>
                                </div>
                            )}

                            <button onClick={handleQuickInvite} disabled={!quickEmail || !quickClubName} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                CREAR CLUB
                            </button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100">
                             <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Vincular Usuario Existente</h4>
                             <div className="flex gap-2">
                                <input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Email..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-400"/>
                                <button onClick={handleSearchUser} className="bg-slate-200 p-2 rounded-xl text-slate-600 hover:bg-slate-300"><Search size={16}/></button>
                             </div>
                             {foundUser && (
                                 <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-fade-in">
                                     <div className="text-[10px] font-black text-emerald-700 uppercase mb-1">Usuario Encontrado</div>
                                     <div className="text-xs font-bold text-slate-800 mb-2 truncate">{foundUser.email}</div>
                                     <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Nombre del club..." className="w-full p-2 bg-white border border-emerald-200 rounded-lg text-xs mb-2 outline-none"/>
                                     <button onClick={handleCreateClubFromExisting} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-black">ASIGNAR CLUB</button>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CLUB INSPECTOR MODAL --- */}
            {inspectedClub && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-in">
                        {/* Modal Header */}
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <Building size={24} className="text-emerald-400"/>
                                    <h2 className="text-2xl font-black">{inspectedClub.name}</h2>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-slate-400 text-xs font-mono">Owner ID: {inspectedClub.owner_id}</p>
                                    <p className="text-emerald-400 text-xs font-bold">{inspectedClub.ownerEmail}</p>
                                </div>
                            </div>
                            <button onClick={() => setInspectedClub(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                                <X size={24}/>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <RefreshCw size={40} className="animate-spin text-emerald-500"/>
                                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Cargando Datos del Club...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* TOURNAMENTS SECTION */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                                <Trophy size={20} className="text-amber-500"/> Torneos ({clubDetailData?.tournaments.length})
                                            </h3>
                                        </div>
                                        <div className="space-y-2">
                                            {clubDetailData?.tournaments.length === 0 ? (
                                                <p className="text-slate-400 text-sm italic py-4">Sin torneos registrados.</p>
                                            ) : clubDetailData?.tournaments.map((t, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-slate-800 text-sm truncate">{t.title}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mt-1">
                                                            <Calendar size={10}/> {new Date(t.date).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${t.status === 'finished' ? 'bg-slate-200 text-slate-500' : 'bg-rose-100 text-rose-600 animate-pulse'}`}>
                                                        {t.status === 'finished' ? 'Finalizado' : 'Activo'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* PLAYERS SECTION */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                                <Users size={20} className="text-blue-500"/> Jugadores ({clubDetailData?.players.length})
                                            </h3>
                                        </div>
                                        <div className="space-y-2">
                                            {clubDetailData?.players.length === 0 ? (
                                                <p className="text-slate-400 text-sm italic py-4">Sin jugadores registrados.</p>
                                            ) : clubDetailData?.players.map((p, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mt-1">
                                                            {p.categories?.[0] || 'Sin nivel'}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                        {p.global_rating || '1200'} <span className="text-[8px] font-normal text-slate-400">ELO</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setInspectedClub(null)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg">CERRAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS (MAINTAINED) --- */}
            {tempCredentials && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-scale-in">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full relative">
                        <button onClick={() => setTempCredentials(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600"><Key size={32}/></div>
                            <h3 className="font-black text-slate-900 text-2xl mb-2">Club Creado</h3>
                            <p className="text-slate-500 text-sm">Copia las credenciales temporales.</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 space-y-4 mb-6">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Email</label><div className="flex items-center justify-between bg-white p-3 rounded-xl border mt-1"><code className="text-slate-800 font-bold select-all">{tempCredentials.email}</code><button onClick={() => navigator.clipboard.writeText(tempCredentials.email)} className="text-slate-400 hover:text-blue-500"><Copy size={16}/></button></div></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Password</label><div className="flex items-center justify-between bg-white p-3 rounded-xl border mt-1"><code className="text-emerald-600 font-black text-lg select-all">{tempCredentials.pass}</code><button onClick={() => navigator.clipboard.writeText(tempCredentials.pass)} className="text-slate-400 hover:text-blue-500"><Copy size={16}/></button></div></div>
                        </div>
                        <button onClick={() => setTempCredentials(null)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Cerrar</button>
                    </div>
                </div>
            )}

            {/* REPAIR/SEND MODAL */}
            {clubToRepair && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-scale-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => setClubToRepair(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                        <div className="text-center mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalMode === 'repair' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{modalMode === 'repair' ? <AlertTriangle size={32}/> : <Mail size={32}/>}</div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">{modalMode === 'repair' ? 'Reparar Ficha' : 'Enviar Acceso'}</h3>
                        </div>
                        <div className="space-y-4">
                            <input type="email" value={manualEmailInput} onChange={e => setManualEmailInput(e.target.value)} placeholder="Email admin..." className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-800" autoFocus/>
                            {!isOfflineMode && HCAPTCHA_SITE_TOKEN && (
                                <div className="flex justify-center min-h-[78px] scale-90"><HCaptcha sitekey={HCAPTCHA_SITE_TOKEN} onVerify={token => setCaptchaToken(token)} ref={captchaRef}/></div>
                            )}
                            <button onClick={handleRepairAndSend} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2">{modalMode === 'repair' ? <ShieldCheck size={18}/> : <Send size={18}/>} Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT NAME MODAL */}
            {clubToEdit && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                        <h3 className="text-xl font-black text-slate-900 mb-4">Editar Nombre</h3>
                        <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 mb-6" autoFocus/>
                        <div className="flex gap-3">
                            <button onClick={() => setClubToEdit(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                            <button onClick={handleUpdateName} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><Save size={18}/> Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {clubToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600"><Trash2 size={32} /></div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Eliminar Club</h3>
                        <p className="text-slate-500 mb-6 text-sm">¿Estás seguro de eliminar el acceso de <strong>{clubToDelete.name}</strong>?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setClubToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button>
                            <button onClick={handleDeleteClub} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdmin;
