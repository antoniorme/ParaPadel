
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { Modal } from '../components';
import { AlertTriangle, Check, X, RefreshCw, Key, Edit2, Trash2, Copy } from 'lucide-react';

import SuperAdminHeader from './superadmin/SuperAdminHeader';
import ClubCard from './superadmin/ClubCard';
import ClubInspectorModal from './superadmin/ClubInspectorModal';
import CreateClubModal from './superadmin/CreateClubModal';
import RepairModal from './superadmin/RepairModal';
import { ClubWithStats, Club, InspectionStats } from './superadmin/types';

const SuperAdmin: React.FC = () => {
    const { isOfflineMode } = useAuth();

    // ── DATA ──────────────────────────────────────────────────────────────────
    const [clubs, setClubs] = useState<ClubWithStats[]>([]);
    const [globalStats, setGlobalStats] = useState({ totalClubs: 0, totalPlayers: 0, activeTourneys: 0, finishedTourneys: 0 });
    const [loading, setLoading] = useState(true);

    // ── INSPECTOR ─────────────────────────────────────────────────────────────
    const [inspectedClub, setInspectedClub] = useState<ClubWithStats | null>(null);
    const [inspectionStats, setInspectionStats] = useState<InspectionStats | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // ── MODALS ────────────────────────────────────────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [clubToRepair, setClubToRepair] = useState<Club | null>(null);
    const [clubToEdit, setClubToEdit] = useState<Club | null>(null);
    const [newName, setNewName] = useState('');
    const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
    const [tempCredentials, setTempCredentials] = useState<{ email: string; pass: string } | null>(null);

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // ── FETCH ─────────────────────────────────────────────────────────────────
    const fetchClubs = async () => {
        setLoading(true);
        if (isOfflineMode) {
            setClubs([{ id: 'local-c1', owner_id: 'local-o1', name: 'Club Local Test', is_active: true, created_at: new Date().toISOString(), playerCount: 16, activeTourneys: 1, activeLeagues: 1, finishedTourneys: 5, ownerEmail: 'admin@local.test', email: 'admin@local.test', league_enabled: false }]);
            setGlobalStats({ totalClubs: 1, totalPlayers: 16, activeTourneys: 1, finishedTourneys: 5 });
            setLoading(false);
            return;
        }
        try {
            const { data: clubsData, error } = await supabase.from('clubs').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            const { data: allPlayers } = await supabase.from('players').select('user_id, email');
            const { data: allTourneys } = await supabase.from('tournaments').select('user_id, status');
            const { data: allLeagues } = await supabase.from('leagues').select('club_id, status');

            const mapped: ClubWithStats[] = (clubsData || []).map(club => ({
                ...club,
                playerCount: allPlayers?.filter(p => p.user_id === club.owner_id).length || 0,
                activeTourneys: allTourneys?.filter(t => t.user_id === club.owner_id && t.status === 'active').length || 0,
                activeLeagues: allLeagues?.filter(l => l.club_id === club.owner_id && (l.status === 'groups' || l.status === 'playoffs')).length || 0,
                finishedTourneys: allTourneys?.filter(t => t.user_id === club.owner_id && t.status === 'finished').length || 0,
                ownerEmail: club.email || allPlayers?.find(p => p.user_id === club.owner_id)?.email
            }));

            setClubs(mapped);
            setGlobalStats({
                totalClubs: mapped.length,
                totalPlayers: allPlayers?.length || 0,
                activeTourneys: allTourneys?.filter(t => t.status === 'active').length || 0,
                finishedTourneys: allTourneys?.filter(t => t.status === 'finished').length || 0
            });
        } catch (e: any) {
            setErrorMsg(e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchClubDetails = async (club: ClubWithStats) => {
        setLoadingDetails(true);
        setInspectedClub(club);
        setInspectionStats(null);
        if (isOfflineMode) {
            setInspectionStats({ players: 150, minis: { total: 10, setup: 1, active: 1, finished: 8 }, leagues: { total: 3, setup: 1, active: 1, finished: 1 } });
            setLoadingDetails(false);
            return;
        }
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
                minis: { total: tourneys.length, setup: tourneys.filter(t => t.status === 'setup').length, active: tourneys.filter(t => t.status === 'active').length, finished: tourneys.filter(t => t.status === 'finished').length },
                leagues: { total: leagues.length, setup: leagues.filter(l => l.status === 'registration').length, active: leagues.filter(l => l.status === 'groups' || l.status === 'playoffs').length, finished: leagues.filter(l => l.status === 'finished').length }
            });
        } catch { /* silent */ } finally { setLoadingDetails(false); }
    };

    useEffect(() => { fetchClubs(); }, []);

    // ── HANDLERS ──────────────────────────────────────────────────────────────

    const handleToggleStatus = async (club: ClubWithStats) => {
        const newState = !club.is_active;
        const { error } = await supabase.from('clubs').update({ is_active: newState }).eq('id', club.id);
        if (!error) setClubs(prev => prev.map(c => c.id === club.id ? { ...c, is_active: newState } : c));
    };

    const handleToggleModule = async (clubId: string, field: string, current: boolean) => {
        const newState = !current;
        const { error } = await supabase.from('clubs').update({ [field]: newState }).eq('id', clubId);
        if (error) setErrorMsg(`Error actualizando módulo: ${error.message}`);
        else {
            setClubs(prev => prev.map(c => c.id === clubId ? { ...c, [field]: newState } : c));
            if (inspectedClub?.id === clubId) setInspectedClub(prev => prev ? { ...prev, [field]: newState } : null);
        }
    };

    const handleUpdateName = async () => {
        if (!clubToEdit || !newName) return;
        const { error } = await supabase.from('clubs').update({ name: newName }).eq('id', clubToEdit.id);
        if (error) setErrorMsg(error.message);
        else { setClubs(prev => prev.map(c => c.id === clubToEdit.id ? { ...c, name: newName } : c)); setSuccessMsg("Nombre actualizado."); }
        setClubToEdit(null);
    };

    const handleDeleteClub = async () => {
        if (!clubToDelete) return;
        const { error } = await supabase.from('clubs').delete().eq('id', clubToDelete.id);
        if (error) setErrorMsg("Error eliminando club.");
        else { fetchClubs(); setClubToDelete(null); }
    };

    const handleResendEmail = async (club: Club) => {
        setClubToRepair(club);
    };

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 pb-32">
            <SuperAdminHeader
                globalStats={globalStats}
                onNewClub={() => setShowCreateModal(true)}
            />

            {/* Toast notification */}
            {(errorMsg || successMsg) && (
                <div className={`fixed top-4 right-4 z-[300] p-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-xl animate-fade-in border-l-4 max-w-sm ${errorMsg ? 'bg-white border-rose-500 text-rose-700' : 'bg-white border-emerald-500 text-emerald-700'}`}>
                    {errorMsg ? <AlertTriangle size={20} className="shrink-0"/> : <Check size={20} className="shrink-0"/>}
                    <div className="flex-1">{errorMsg || successMsg}</div>
                    <button onClick={() => { setErrorMsg(null); setSuccessMsg(null); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X size={16}/></button>
                </div>
            )}

            {/* Club list */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-black text-slate-800">Listado de Clubs</h3>
                    <button onClick={fetchClubs} className="p-2 text-slate-400 hover:text-blue-500 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-60 bg-slate-100 animate-pulse rounded-3xl"/>)
                        : clubs.map(club => (
                            <ClubCard
                                key={club.id}
                                club={club}
                                onInspect={fetchClubDetails}
                                onToggleStatus={handleToggleStatus}
                                onToggleModule={handleToggleModule}
                                onEdit={c => { setNewName(c.name); setClubToEdit(c); }}
                                onResendEmail={handleResendEmail}
                            />
                        ))
                    }
                </div>
            </div>

            {/* Modals */}
            <CreateClubModal
                isOpen={showCreateModal}
                isOfflineMode={isOfflineMode}
                onClose={() => setShowCreateModal(false)}
                onSuccess={(msg, creds) => { setSuccessMsg(msg); if (creds) setTempCredentials(creds); }}
                onError={setErrorMsg}
                onRefresh={fetchClubs}
            />

            <ClubInspectorModal
                club={inspectedClub}
                inspectionStats={inspectionStats}
                loadingDetails={loadingDetails}
                onClose={() => setInspectedClub(null)}
            />

            <RepairModal
                club={clubToRepair}
                isOfflineMode={isOfflineMode}
                onClose={() => setClubToRepair(null)}
                onSuccess={setSuccessMsg}
                onError={setErrorMsg}
                onRefresh={fetchClubs}
            />

            <Modal
                isOpen={!!tempCredentials}
                onClose={() => setTempCredentials(null)}
                title="Club Creado"
                body="Copia las credenciales temporales."
                icon={<Key size={24}/>}
                iconColor="success"
                size="md"
                actions={[{ label: 'Cerrar', onClick: () => setTempCredentials(null), variant: 'secondary' }]}
            >
                {tempCredentials && (
                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 space-y-3 text-left">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl border mt-1">
                                <code className="text-slate-800 font-bold select-all text-sm">{tempCredentials.email}</code>
                                <button onClick={() => navigator.clipboard.writeText(tempCredentials.email)} className="text-slate-400 hover:text-blue-500 ml-2 shrink-0"><Copy size={16}/></button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Password</label>
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl border mt-1">
                                <code className="text-emerald-600 font-black text-lg select-all">{tempCredentials.pass}</code>
                                <button onClick={() => navigator.clipboard.writeText(tempCredentials.pass)} className="text-slate-400 hover:text-blue-500 ml-2 shrink-0"><Copy size={16}/></button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!clubToEdit}
                onClose={() => setClubToEdit(null)}
                title="Editar Nombre"
                icon={<Edit2 size={24}/>}
                iconColor="brand"
                actions={[
                    { label: 'Cancelar', onClick: () => setClubToEdit(null), variant: 'secondary' },
                    { label: 'Guardar', onClick: handleUpdateName, variant: 'primary' },
                ]}
            >
                <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500"
                    autoFocus
                />
            </Modal>

            <Modal
                isOpen={!!clubToDelete}
                onClose={() => setClubToDelete(null)}
                title="Eliminar Club"
                body={clubToDelete ? `¿Estás seguro de eliminar el acceso de ${clubToDelete.name}?` : ''}
                icon={<Trash2 size={24}/>}
                iconColor="danger"
                actions={[
                    { label: 'Cancelar', onClick: () => setClubToDelete(null), variant: 'secondary' },
                    { label: 'Confirmar', onClick: handleDeleteClub, variant: 'danger' },
                ]}
            />
        </div>
    );
};

export default SuperAdmin;
