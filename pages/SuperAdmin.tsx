
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Shield, Users, Building, Plus, Search, Check, AlertTriangle, LogOut, LayoutDashboard, Smartphone, Lock, Unlock, RefreshCw, Mail, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Club {
    id: string;
    owner_id: string;
    name: string;
    is_active: boolean;
    created_at: string;
}

interface UserResult {
    id: string; // The user_id (linked to auth.users in concept)
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
    const [tempCredentials, setTempCredentials] = useState<{email: string, pass: string} | null>(null);

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
        
        // 1. Generate Temp Password
        const tempPass = "PadelPro" + Math.floor(1000 + Math.random() * 9000);

        try {
            // 2. Sign Up User (Client Side)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: quickEmail,
                password: tempPass,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("No se pudo crear el usuario.");

            // 3. Create Club Entry
            const { error: clubError } = await supabase.from('clubs').insert([{
                owner_id: authData.user.id,
                name: quickClubName,
                is_active: true
            }]);

            if (clubError) throw clubError;

            // 4. Trigger Password Reset Email (So they get a link)
            await supabase.auth.resetPasswordForEmail(quickEmail, {
                redirectTo: window.location.origin + '/#/auth?type=recovery'
            });

            setTempCredentials({ email: quickEmail, pass: tempPass });
            setSuccessMessage(`Usuario y Club creados. Se ha enviado un email de recuperación.`);
            setQuickEmail('');
            setQuickClubName('');
            fetchClubs();

        } catch (err: any) {
            setCreateError(err.message);
        }
    };

    const toggleClubStatus = async (club: Club) => {
        const newState = !club.is_active;
        const { error } = await supabase.from('clubs').update({ is_active: newState }).eq('id', club.id);
        if (!error) {
            setClubs(clubs.map(c => c.id === club.id ? { ...c, is_active: newState } : c));
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

            {/* TEMP CREDENTIALS MODAL */}
            {tempCredentials && (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm animate-slide-up relative">
                    <button onClick={() => setTempCredentials(null)} className="absolute top-4 right-4 text-emerald-600 hover:text-emerald-800"><div className="bg-white rounded-full p-1"><Check size={16}/></div></button>
                    <h3 className="font-bold text-emerald-800 text-lg mb-4 flex items-center gap-2"><Key size={20}/> Credenciales Temporales</h3>
                    <p className="text-sm text-emerald-700 mb-4">
                        Entrega estos datos al club. También se ha enviado un email para que cambien la contraseña ellos mismos.
                    </p>
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 grid grid-cols-1 gap-2 text-sm font-mono text-slate-700">
                        <div><strong>Usuario:</strong> {tempCredentials.email}</div>
                        <div><strong>Pass:</strong> {tempCredentials.pass}</div>
                        <div className="text-xs text-slate-400 mt-2">Link App: {window.location.origin}</div>
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
                        <button 
                            onClick={handleQuickInvite} 
                            disabled={!quickEmail || !quickClubName}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            Crear Usuario y Club
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
                        <div key={club.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                            <div>
                                <div className="font-black text-slate-800 text-lg">{club.name}</div>
                                <div className="text-xs text-slate-400 font-mono">ID: {club.id}</div>
                                <div className="text-xs text-slate-500 mt-1">Creado: {new Date(club.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => toggleClubStatus(club)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${club.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                >
                                    {club.is_active ? <Unlock size={14}/> : <Lock size={14}/>}
                                    {club.is_active ? 'Activo' : 'Bloqueado'}
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
        </div>
    );
};

export default SuperAdmin;
