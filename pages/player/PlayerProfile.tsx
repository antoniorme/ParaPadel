
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { useAuth } from '../../store/AuthContext';
import { THEME, getFormatColor } from '../../utils/theme';
import { ArrowLeft, Trophy, Medal, Calendar, Hash, Activity, BarChart2, TrendingUp, ChevronDown, ChevronUp, Shuffle, Trash2, AlertTriangle, LogOut } from 'lucide-react';
import { calculateDisplayRanking, calculateMatchDelta, getPairTeamElo } from '../../utils/Elo';
import { TournamentState, Match } from '../../types';

// Interfaces for structured history
interface ProcessedMatch {
    id: string;
    roundLabel: string;
    partnerName: string;
    opponentsName: string;
    score: string;
    result: 'win' | 'loss' | 'pending';
    eloDelta: number;
    timestamp: number; // for sorting
}

interface ProcessedTournament {
    id: string;
    title: string;
    date: string;
    format: string;
    resultBadge?: 'champion' | 'consolation' | null;
    matches: ProcessedMatch[];
    eloChangeTotal: number;
}

const PlayerProfile: React.FC = () => {
    const navigate = useNavigate();
    const { state, formatPlayerName, deletePlayerDB } = useTournament();
    const { pastTournaments } = useHistory();
    const { signOut, user } = useAuth();

    // ID Simulator
    const [myPlayerId, setMyPlayerId] = useState<string>(() => localStorage.getItem('padel_sim_player_id') || '');
    const currentPlayer = state.players.find(p => p.id === myPlayerId);

    const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // --- DATA PROCESSING ENGINE ---
    const historyData = useMemo(() => {
        if (!currentPlayer) return { tournaments: [], stats: { matches: 0, wins: 0, winRate: 0, titles: 0 } };

        const stats = { matches: 0, wins: 0, titles: 0, winRate: 0 };
        const processedTournaments: ProcessedTournament[] = [];

        // Helper to process a single tournament state into our view model
        const processTournamentState = (tId: string, tData: TournamentState, tDate: string, tTitle?: string) => {
            const myPair = tData.pairs.find(p => p.player1Id === myPlayerId || p.player2Id === myPlayerId);
            if (!myPair) return null; // Didn't play in this tournament

            const partnerId = myPair.player1Id === myPlayerId ? myPair.player2Id : myPair.player1Id;
            const partner = tData.players.find(p => p.id === partnerId);
            const partnerName = formatPlayerName(partner);
            
            // Estimated Team ELO for Delta Calculation
            const myTeamElo = partner ? getPairTeamElo(currentPlayer, partner) : 1200;

            const tMatches: ProcessedMatch[] = [];
            let tEloChange = 0;
            let resultBadge: 'champion' | 'consolation' | null = null;

            // Find all matches involving this pair
            const rawMatches = tData.matches.filter(m => m.pairAId === myPair.id || m.pairBId === myPair.id);
            
            rawMatches.forEach(m => {
                if (!m.isFinished) return; // Only finished matches

                stats.matches++;
                const isPairA = m.pairAId === myPair.id;
                const myScore = isPairA ? m.scoreA : m.scoreB;
                const oppScore = isPairA ? m.scoreB : m.scoreA;
                const won = (myScore || 0) > (oppScore || 0);
                
                if (won) {
                    stats.wins++;
                    // Check for titles (Final Rounds)
                    if (m.round === 7 || (tData.format === '10_mini' && m.round === 6)) {
                        if (m.bracket === 'main') { resultBadge = 'champion'; stats.titles++; }
                        else if (m.bracket === 'consolation') resultBadge = 'consolation';
                    }
                }

                // Opponent Info
                const oppId = isPairA ? m.pairBId : m.pairAId;
                const oppPair = tData.pairs.find(p => p.id === oppId);
                let oppNames = 'Desconocidos';
                let oppTeamElo = 1200;

                if (oppPair) {
                    const op1 = tData.players.find(p => p.id === oppPair.player1Id);
                    const op2 = tData.players.find(p => p.id === oppPair.player2Id);
                    if (op1 && op2) oppTeamElo = getPairTeamElo(op1, op2);
                    oppNames = `${formatPlayerName(op1)} & ${formatPlayerName(op2)}`;
                }

                // Calculate ELO Delta
                // Logic: calculateMatchDelta returns change for Pair A. 
                // If I am Pair B, my change is inverted (-delta).
                const rawDelta = calculateMatchDelta(myTeamElo, oppTeamElo, m.scoreA || 0, m.scoreB || 0);
                const myDelta = isPairA ? rawDelta : -rawDelta;
                tEloChange += myDelta;

                tMatches.push({
                    id: m.id,
                    roundLabel: m.phase === 'group' ? `R${m.round}` : m.phase.toUpperCase(),
                    partnerName,
                    opponentsName: oppNames,
                    score: `${myScore} - ${oppScore}`,
                    result: won ? 'win' : 'loss',
                    eloDelta: myDelta,
                    timestamp: m.round // Use round as timestamp proxy for sorting within tournament
                });
            });

            // Sort matches: Latest round first? Or chronological? Usually chrono R1 -> Final is better for story.
            tMatches.sort((a, b) => a.timestamp - b.timestamp);

            if (tMatches.length > 0) {
                processedTournaments.push({
                    id: tId,
                    title: tTitle || `Mini Torneo ${tData.format?.replace('_mini', '') || '16'}`,
                    date: tDate,
                    format: tData.format,
                    resultBadge,
                    matches: tMatches,
                    eloChangeTotal: tEloChange
                });
            }
        };

        // 1. Process Past Tournaments
        pastTournaments.forEach(pt => {
            if (pt.data) processTournamentState(pt.id, pt.data, pt.date);
        });

        // 2. Process Active Tournament (if participated)
        if (state.status !== 'setup') {
            processTournamentState(state.id || 'active', state, new Date().toISOString(), state.title);
        }

        // Sort Tournaments: Newest First
        processedTournaments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        stats.winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;

        return { tournaments: processedTournaments, stats };

    }, [currentPlayer, pastTournaments, state]);

    const handleDeleteAccount = async () => {
        if (!currentPlayer) return;
        try {
            await deletePlayerDB(currentPlayer.id);
            localStorage.removeItem('padel_sim_player_id');
            if (user) await signOut();
            navigate('/');
        } catch (e) {
            console.error("Error deleting account", e);
        }
    };

    if (!currentPlayer) {
        return (
            <div className="p-8 text-center text-slate-400">
                <p>Perfil no encontrado.</p>
                <button onClick={() => navigate('/p/dashboard')} className="mt-4 text-[#575AF9] font-bold">Volver al inicio</button>
            </div>
        );
    }

    const currentElo = calculateDisplayRanking(currentPlayer);
    const initials = currentPlayer.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            
            {/* HEADER PROFILE */}
            <div className="bg-white p-6 pb-8 rounded-b-3xl shadow-sm border-b border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => navigate('/p/dashboard')} className="p-2 bg-slate-50 border border-slate-100 rounded-full text-slate-500 hover:text-slate-800"><ArrowLeft size={20}/></button>
                    <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Mi Historial</h1>
                    <div className="w-10"></div>
                </div>

                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#2B2DBF] to-[#575AF9] rounded-full p-1 shadow-xl mb-4">
                        <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-white">
                            {initials}
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">{currentPlayer.nickname || currentPlayer.name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-bold uppercase">{currentPlayer.categories?.[0] || 'Sin Nivel'}</span>
                        {currentPlayer.preferred_position && (
                           <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs font-bold uppercase border border-indigo-100 flex items-center gap-1">
                               {currentPlayer.preferred_position === 'right' ? 'Derecha' : 'Revés'}
                               {currentPlayer.play_both_sides && <Shuffle size={10} className="text-emerald-500"/>}
                           </span>
                        )}
                        <span className="text-[#575AF9] font-black text-lg flex items-center gap-1 ml-2"><Activity size={16}/> {currentElo} pts</span>
                    </div>
                </div>

                {/* STATS ROW */}
                <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-2xl font-black text-slate-800">{historyData.stats.matches}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Partidos</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-2xl font-black text-emerald-500">{historyData.stats.winRate}%</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Victorias</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-2xl font-black text-amber-500">{historyData.stats.titles}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Títulos</span>
                    </div>
                </div>
            </div>

            {/* HISTORY FEED */}
            <div className="p-4 space-y-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider ml-2">Actividad Reciente</h3>
                
                {historyData.tournaments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20"/>
                        <p>Aún no has jugado ningún torneo.</p>
                        <button onClick={() => navigate('/p/tournaments')} className="mt-4 text-[#575AF9] font-bold text-sm">Buscar partidos</button>
                    </div>
                ) : (
                    historyData.tournaments.map(t => {
                        const isExpanded = expandedTournamentId === t.id; // Support state toggle
                        const toggle = () => setExpandedTournamentId(isExpanded ? null : t.id);
                        
                        return (
                            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Tournament Header */}
                                <div onClick={toggle} className="p-5 cursor-pointer hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <Calendar size={10}/> {new Date(t.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <h4 className="font-black text-slate-900 text-lg leading-tight">{t.title}</h4>
                                        </div>
                                        {t.resultBadge === 'champion' && (
                                            <div className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm border border-amber-200">
                                                <Trophy size={10}/> Campeón
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                        <div className="text-xs text-slate-500 font-medium">
                                            {t.matches.length} Partidos jugados
                                        </div>
                                        <div className={`text-sm font-black flex items-center gap-1 ${t.eloChangeTotal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {t.eloChangeTotal > 0 ? '+' : ''}{t.eloChangeTotal} pts
                                            {isExpanded ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                                        </div>
                                    </div>
                                </div>

                                {/* Matches List (Collapsible) */}
                                {isExpanded && (
                                    <div className="bg-slate-50 border-t border-slate-100 divide-y divide-slate-100">
                                        {t.matches.map(m => (
                                            <div key={m.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                                                {/* Left: Opponent info */}
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`w-2 h-2 rounded-full ${m.result === 'win' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.roundLabel}</span>
                                                    </div>
                                                    <div className="font-bold text-slate-800 text-sm truncate">
                                                        vs {m.opponentsName}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate">
                                                        con {m.partnerName}
                                                    </div>
                                                </div>

                                                {/* Right: Score & ELO */}
                                                <div className="text-right flex flex-col items-end">
                                                    <div className="text-lg font-black text-slate-900 tracking-tight">{m.score}</div>
                                                    {m.eloDelta !== 0 && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.eloDelta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {m.eloDelta > 0 ? '+' : ''}{m.eloDelta} pts
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* DELETE ACCOUNT BUTTON */}
            <div className="p-6 pt-0">
                <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-4 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 hover:border-rose-200 transition-colors"
                >
                    <Trash2 size={18}/> Eliminar mi Cuenta
                </button>
            </div>

            {/* CONFIRM DELETE MODAL */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">¿Estás seguro?</h3>
                        <p className="text-slate-500 mb-6 text-sm">
                            Esta acción es irreversible. Se borrará tu perfil, tu historial de partidos y tu ranking ELO.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">
                                Cancelar
                            </button>
                            <button onClick={handleDeleteAccount} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700">
                                Sí, eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerProfile;
