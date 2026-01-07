
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { 
    Shield, Building, Plus, Search, Check, AlertTriangle, 
    LayoutDashboard, Smartphone, Lock, RefreshCw, 
    Mail, Key, Trash2, X, Copy, Edit2, Send, Save, 
    ShieldCheck, Users, Trophy, Activity, Eye, 
    BarChart3, CalendarRange, Power, Clock, CheckCircle, FilePlus
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
    activeLeagues: number; // NEW
    finishedTourneys: number;
    ownerEmail?: string;
}

interface Club {
    id: string;
    owner_id: string;
    name: string;
    email?: string;
    is_active: boolean;
    league_enabled?: boolean; 
    created_at: string;
}

interface UserResult {
    id: string; 
    name: string;
    email: string;
}

// Stats Interface for Modal
interface InspectionStats {
    players: number;
    minis: {
        total: number;
        setup: number;
        active: number;
        finished: number;
    };
    leagues: {
        total: number;
        setup: number; // Registration
        active: number; // Groups/Playoffs
        finished: number;
    };
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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [inspectedClub, setInspectedClub] = useState<ClubWithStats | null>(null);
    const [inspectionStats, setInspectionStats] = useState<InspectionStats | null>(null);
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
                playerCount: 16, activeTourneys: 1, activeLeagues: 1, finishedTourneys: 5, ownerEmail: 'admin@local.test', email: 'admin@local.test', league_enabled: false
            }]);
            setGlobalStats({ totalClubs: 1, totalPlayers: 16, activeTourneys: 1, finishedTourneys: 5 });
            setLoading(false);
            return;
        }

        try {
            const { data: clubsData, error: clubsError } = await supabase.from('clubs').select('*').order('created_at', { ascending: false });
            if (clubsError) throw clubsError;

            // Fetch Aggregated Stats
            const { data: allPlayers } = await supabase.from('players').select('user_id, email');
            const { data: allTourneys } = await supabase.from('tournaments').select('user_id, status');
            const { data: allLeagues } = await supabase.from('leagues').select('club_id, status');

            const mappedClubs: ClubWithStats[] = (clubsData || []).map(club => {
                const clubPlayers = allPlayers?.filter(p => p.user_id === club.owner_id).length || 0;
                const clubTourneys = allTourneys?.filter(t => t.user_id === club.owner_id) || [];
                const clubLeagues = allLeagues?.filter(l => l.club_id === club.owner_id) || [];
                const ownerRecord = allPlayers?.find(p => p.user_id === club.owner_id);
                
                return {
                    ...club,
                    playerCount: clubPlayers,
                    activeTourneys: clubTourneys.filter(t => t.status === 'active').length,
                    activeLeagues: clubLeagues.filter(l => l.status === 'groups' || l.status === 'playoffs').length,
                    finishedTourneys: clubTourneys.filter(t => t.status === 'finished').length,
                    ownerEmail: club.email || ownerRecord?.email
                };
            });

            setClubs(mappedClubs);
            setGlobalStats({
                totalClubs: mappedClubs.length,
                totalPlayers: allPlayers?.length || 0,
                activeTourneys: allTourneys?.filter(t => t.status === 'active').length || 0,
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
        setInspectionStats(null);
        
        if (isOfflineMode) {
            setInspectionStats({
                players: 150,
                minis: { total: 10, setup: 1, active: 1, finished: 8 },
                leagues: { total: 3, setup: 1, active: 1, finished: 1 }
            });
            setLoadingDetails(false);
            return;
        }

        // Fetch Counts Breakdown Only
        try {
            const [playersRes, tourneysRes, leaguesRes] = await Promise.all([
                supabase.from('players').select('id', { count: 'exact', head: true }).eq('user_id', club.owner_id),
                supabase.from('tournaments').select('status').eq('user_id', club.owner_id),
                supabase.from('leagues').select('status').eq('club_id', club.owner_id)
            ]);

            const tourneys = tourneysRes.data || [];
            const leagues = leaguesRes.data || [];

            setInspectionStats({
                players: playersRes.count || 0,
                minis: {
                    total: tourneys.length,
                    setup: tourneys.filter(t => t.status === 'setup').length,
                    active: tourneys.filter(t => t.status === 'active').length,
                    finished: tourneys.filter(t => t.status === 'finished').length
                },
                leagues: {
                    total: leagues.length,
                    setup: leagues.filter(l => l.status === 'registration').length,
                    active: leagues.filter(l => l.status === 'groups' || l.status === 'playoffs').length,
                    finished: leagues.filter(l => l.status === 'finished').length
                }
            });
        } catch(e) {
            console.error("Error fetching detailed stats", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    // --- LOGIC HANDLERS ---
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
        const { error } = await supabase.from('clubs').insert([{ owner_id: foundUser.id, name: clubName, is_active: true, email: foundUser.email }]);
        if (error) setCreateError(error.message);
        else { 
            setSuccessMessage(`Club "${clubName}" creado.`); 
            setFoundUser(null); setClubName(''); setSearchEmail(''); setShowCreateModal(false); fetchClubs(); 
        }
    };

    const handleQuickInvite = async () => {
        if (!quickEmail || !quickClubName) return;
        setCreateError(null);
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) { setCreateError("Completa el Captcha."); return; }
        
        try {
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            const tempPass = `PadelPro${randomDigits}!`;
            
            const tempClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
            const { data: authData, error: authError } = await tempClient.auth.signUp({ email: quickEmail, password: tempPass, options: { captchaToken: captchaToken || undefined } });
            if (authError) throw authError;
            
            await supabase.from('clubs').insert([{ 
                owner_id: authData.user!.id, 
                name: quickClubName, 
                is_active: true,
                email: quickEmail 
            }]);
            
            setTempCredentials({ email: quickEmail, pass: tempPass });
            setQuickEmail(''); setQuickClubName(''); if(captchaRef.current) captchaRef.current.resetCaptcha(); setCaptchaToken(null); setShowCreateModal(false); fetchClubs();
        } catch (err: any) { setCreateError(err.message); if(captchaRef.current) captchaRef.current.resetCaptcha(); setCaptchaToken(null); }
    };

    const toggleClubStatus = async (club: Club) => {
        const newState = !club.is_active;
        const { error } = await supabase.from('clubs').update({ is_active: newState }).eq('id', club.id);
        if (!error) setClubs(clubs.map(c => c.id === club.id ? { ...c, is_active: newState } : c));
    };

    const toggleLeagueModule = async (club: ClubWithStats) => {
        const newState = !club.league_enabled;
        try {
            const { error } = await supabase.from('clubs').update({ league_enabled: newState }).eq('id', club.id);
            if (error) throw error;
            
            setClubs(prev => prev.map(c => c.id === club.id ? { ...c, league_enabled: newState } : c));
            if (inspectedClub && inspectedClub.id === club.id) {
                setInspectedClub({ ...inspectedClub, league_enabled: newState });
            }
        } catch(e: any) {
            alert("Error cambiando estado del módulo de liga: " + e.message);
        }
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
        let targetEmail = club.email;
        if (!targetEmail) {
             const { data: playerData } = await supabase.from('players').select('email').eq('user_id', club.owner_id).maybeSingle();
             targetEmail = playerData?.email;
        }
        setClubToRepair(club);
        if (targetEmail) { setManualEmailInput(targetEmail); setModalMode('send'); }
        else { setManualEmailInput(''); setModalMode('repair'); }
        if(captchaRef.current) captchaRef.current.resetCaptcha(); setCaptchaToken(null);
    };

    const handleRepairAndSend = async () => {
        if (!clubToRepair || !manualEmailInput) return;
        if (!isOfflineMode && HCAPTCHA_SITE_TOKEN && !captchaToken) { setCreateError("Captcha requerido."); return; }
        try {
            await supabase.from('clubs').update({ email: manualEmailInput }).eq('id', clubToRepair.id);
            await supabase.auth.resetPasswordForEmail(manualEmailInput, { redirectTo: window.location.origin + '/#/auth?type=recovery', captchaToken: captchaToken || undefined });
            setSuccessMessage(`Enviado a ${manualEmailInput}`); setClubToRepair(null); setCaptchaToken(null); fetchClubs();
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
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500 p-2 rounded-lg">
                                <Shield size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">Super Admin</h1>
                                <p className="text-slate-400 text-sm">Control global de ParaPadel</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10">
                                <LayoutDashboard size={16}/> Mi Club
                            </button>
                            <button onClick={() => navigate('/p/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10">
                                <Smartphone size={16}/> App Jugador
                            </button>
                        </div>
                    </div>
                    
                    <div className="mb-8 flex gap-4">
                        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95">
                            <Plus size={20}/> ALTA NUEVO CLUB
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Building size={12} className="text-blue-400"/> Clubs
                            </div>
                            <div className="text-3xl font-black">{globalStats.totalClubs}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Activity size={12} className="text-rose-400"/> Minis En Juego
                            </div>
                            <div className="text-3xl font-black text-rose-400">{globalStats.activeTourneys}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Trophy size={12} className="text-amber-400"/> Minis Finalizados
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
                </div>
            </div>

            {(createError || successMessage) && (
                <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-sm animate-fade-in ${createError ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-700' : 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700'}`}>
                    {createError ? <AlertTriangle size={20}/> : <Check size={20}/>}
                    {createError || successMessage}
                </div>
            )}

            {/* MAIN CONTENT: CLUB LIST */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Building size={20} className="text-slate-400"/> Listado de Clubs
                    </h3>
                    <button onClick={fetchClubs} className="p-2 text-slate-400 hover:text-blue-500 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {loading ? (
                        Array.from({length: 4}).map((_, i) => <div key={i} className="h-60 bg-slate-100 animate-pulse rounded-3xl"></div>)
                    ) : clubs.map(club => (
                        <div 
                            key={club.id} 
                            className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden transition-all relative ${club.is_active ? 'border-slate-100' : 'border-rose-100 opacity-80'}`}
                        >
                            <div className={`h-2 w-full ${club.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

                            <div className="p-6">
                                {/* HEADER SECTION */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {club.is_active ? (
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                                                    <Check size={10} strokeWidth={4}/> Activo
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 flex items-center gap-1">
                                                    <Lock size={10} strokeWidth={4}/> Bloqueado
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-400 font-mono">ID: {club.id.substring(0,6)}...</span>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 leading-tight">{club.name}</h2>
                                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 font-medium truncate">
                                            <Mail size={12}/> {club.ownerEmail || 'Sin email'}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => fetchClubDetails(club)}
                                        className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                        title="Ver Detalles Completos"
                                    >
                                        <Eye size={20}/>
                                    </button>
                                </div>

                                {/* CARD DASHBOARD (Summary Stats) */}
                                <div className="grid grid-cols-3 gap-2 mb-6">
                                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-slate-400 mb-1"><Users size={16}/></div>
                                        <div className="text-lg font-black text-slate-800">{club.playerCount}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Jugadores</div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="text-emerald-500 mb-1"><Trophy size={16}/></div>
                                        <div className="text-lg font-black text-emerald-700">{club.activeTourneys}</div>
                                        <div className="text-[9px] font-bold text-emerald-600 uppercase">Minis Act.</div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                        <div className="text-indigo-500 mb-1"><CalendarRange size={16}/></div>
                                        <div className="text-lg font-black text-indigo-700">{club.activeLeagues}</div>
                                        <div className="text-[9px] font-bold text-indigo-600 uppercase">Ligas Act.</div>
                                    </div>
                                </div>

                                {/* MODULES STATUS SECTION */}
                                <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulos Contratados</span>
                                    </div>
                                    <div className="flex gap-3">
                                        {/* Minis Module (Always Active) */}
                                        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm w-1/2">
                                            <Trophy size={14} className="text-blue-500"/>
                                            <span className="text-xs font-bold text-slate-700 flex-1">Minis</span>
                                            <Check size={14} className="text-emerald-500 ml-auto"/>
                                        </div>

                                        {/* League Module (Toggleable) */}
                                        <button 
                                            onClick={() => toggleLeagueModule(club)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-all w-1/2 ${club.league_enabled ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                                        >
                                            <CalendarRange size={14} className={club.league_enabled ? 'text-indigo-600' : 'text-slate-400'}/>
                                            <span className={`text-xs font-bold flex-1 text-left ${club.league_enabled ? 'text-indigo-700' : 'text-slate-500'}`}>Ligas</span>
                                            <div className={`w-3 h-3 rounded-full border ${club.league_enabled ? 'bg-indigo-500 border-indigo-600' : 'bg-slate-200 border-slate-300'}`}></div>
                                        </button>
                                    </div>
                                </div>

                                {/* ACTIONS FOOTER */}
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                                    <button 
                                        onClick={() => { setNewName(club.name); setClubToEdit(club); }}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border-2 border-slate-100 text-slate-600 font-bold text-xs hover:border-slate-300 transition-colors"
                                    >
                                        <Edit2 size={14}/> Editar Datos
                                    </button>
                                    
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleResendEmail(club)}
                                            className="flex-1 flex items-center justify-center py-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold transition-colors"
                                            title="Reenviar Acceso"
                                        >
                                            <Send size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => toggleClubStatus(club)}
                                            className={`flex-1 flex items-center justify-center py-3 rounded-xl font-bold transition-colors ${club.is_active ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                            title={club.is_active ? "Bloquear Acceso" : "Reactivar Acceso"}
                                        >
                                            <Power size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- CREATE CLUB MODAL --- */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                                <Plus className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg" size={32}/> Nuevo Club
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                        </div>

                        <div className="space-y-6">
                            {/* FORM BLOCK */}
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

                            <div className="h-px bg-slate-100 w-full"></div>

                            {/* EXISTING USER BLOCK */}
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
                                         <button onClick={handleCreateClubFromExisting} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-black">ASIGNAR CLUB</button>
                                     </div>
                                 )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CLUB INSPECTOR MODAL (UPDATED - PRIVACY MODE - 3 COLUMNS) --- */}
            {inspectedClub && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-5xl shadow-2xl flex flex-col animate-scale-in overflow-hidden">
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
                        <div className="p-10 bg-slate-50">
                            {loadingDetails || !inspectionStats ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <RefreshCw size={40} className="animate-spin text-emerald-500"/>
                                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Calculando Estadísticas...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    
                                    {/* COLUMN 1: PLAYERS */}
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                                            <Users size={40}/>
                                        </div>
                                        <div className="text-6xl font-black text-slate-800 mb-2">{inspectionStats.players}</div>
                                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Jugadores Totales</div>
                                        <div className="mt-6 text-xs text-slate-400 px-4">
                                            Base de datos acumulada de jugadores registrados en el club.
                                        </div>
                                    </div>

                                    {/* COLUMN 2: LEAGUES */}
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                                <CalendarRange size={28}/>
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-800">{inspectionStats.leagues.total}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ligas Totales</div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3 flex-1">
                                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <FilePlus size={14} className="text-slate-400"/> En Registro
                                                </div>
                                                <span className="font-black text-slate-800">{inspectionStats.leagues.setup}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                                                    <Activity size={14}/> Activas
                                                </div>
                                                <span className="font-black text-indigo-700">{inspectionStats.leagues.active}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <CheckCircle size={14} className="text-slate-400"/> Finalizadas
                                                </div>
                                                <span className="font-black text-slate-800">{inspectionStats.leagues.finished}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COLUMN 3: MINIS */}
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                                                <Trophy size={28}/>
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-800">{inspectionStats.minis.total}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Minis Totales</div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3 flex-1">
                                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <FilePlus size={14} className="text-slate-400"/> En Preparación
                                                </div>
                                                <span className="font-black text-slate-800">{inspectionStats.minis.setup}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                                                <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                                                    <Activity size={14}/> En Juego
                                                </div>
                                                <span className="font-black text-amber-700">{inspectionStats.minis.active}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                                    <CheckCircle size={14} className="text-slate-400"/> Finalizados
                                                </div>
                                                <span className="font-black text-slate-800">{inspectionStats.minis.finished}</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-6 bg-white border-t border-slate-200 flex justify-end">
                            <button onClick={() => setInspectedClub(null)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-colors">CERRAR INFORME</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS (MAINTAINED: Credentials, Repair, Edit, Delete) --- */}
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
