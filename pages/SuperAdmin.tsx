
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Shield, Users, Building, Plus, Search, Check, AlertTriangle, LogOut, LayoutDashboard, Smartphone, Lock, Unlock, RefreshCw } from 'lucide-react';
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
    
    // Create Club State
    const [searchEmail, setSearchEmail] = useState('');
    const [foundUser, setFoundUser] = useState<UserResult | null>(null);
    const [clubName, setClubName] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);

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

    const handleSearchUser = async () => {
        if (!searchEmail) return;
        setCreateError(null);
        setFoundUser(null);

        // Search in public.players table as a proxy for registered users
        // NOTE: This assumes users create a player profile. 
        // In a perfect world we would query auth.users via an Edge Function.
        const { data, error } = await supabase
            .from('players')
            .select('user_id, name, email')
            .eq('email', searchEmail)
            .limit(1)
            .maybeSingle();

        if (data) {
            // Check if they are already a club
            const { data: existingClub } = await supabase.from('clubs').select('id').eq('owner_id', data.user_id).maybeSingle();
            if (existingClub) {
                setCreateError("Este usuario ya es dueño de un club.");
            } else {
                setFoundUser({ id: data.user_id!, name: data.name, email: data.email! });
            }
        } else {
            setCreateError("Usuario no encontrado en la base de datos de jugadores. Pídeles que se registren en la App primero.");
        }
    };

    const handleCreateClub = async () => {
        if (!foundUser || !clubName) return;

        const { error } = await supabase.from('clubs').insert([{
            owner_id: foundUser.id,
            name: clubName,
            is_active: true
        }]);

        if (error) {
            setCreateError(error.message);
        } else {
            alert(`Club "${clubName}" creado correctamente.`);
            setFoundUser(null);
            setClubName('');
            setSearchEmail('');
            fetchClubs();
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

            {/* CREATE CLUB SECTION */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Plus className="bg-indigo-100 text-indigo-600 p-1 rounded-md" size={24}/> Alta Nuevo Club
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step 1: Find User */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-500 uppercase">1. Buscar Usuario (Email)</label>
                        <div className="flex gap-2">
                            <input 
                                value={searchEmail}
                                onChange={e => setSearchEmail(e.target.value)}
                                placeholder="usuario@email.com"
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                            />
                            <button onClick={handleSearchUser} className="bg-slate-900 text-white px-4 rounded-xl font-bold hover:bg-slate-700">
                                <Search size={20}/>
                            </button>
                        </div>
                        {createError && (
                            <div className="text-xs text-rose-500 font-medium flex items-center gap-1 bg-rose-50 p-2 rounded-lg">
                                <AlertTriangle size={12}/> {createError}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Confirm & Create */}
                    <div className={`space-y-4 transition-opacity ${foundUser ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="text-xs font-bold text-slate-500 uppercase">2. Asignar Nombre Club</label>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 mb-2">
                            <div className="text-xs text-emerald-800 font-bold flex items-center gap-2">
                                <Check size={14}/> Usuario Encontrado
                            </div>
                            <div className="text-sm font-bold text-slate-800">{foundUser?.name}</div>
                            <div className="text-xs text-slate-500">{foundUser?.email}</div>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                value={clubName}
                                onChange={e => setClubName(e.target.value)}
                                placeholder="Nombre del Club..."
                                className="flex-1 bg-white border border-slate-300 rounded-xl p-3 outline-none focus:border-emerald-500 font-bold"
                            />
                            <button onClick={handleCreateClub} className="bg-emerald-500 text-white px-6 rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-100">
                                Crear
                            </button>
                        </div>
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
