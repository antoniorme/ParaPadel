
import React, { useState, useMemo, useEffect } from 'react';
import { useLeague } from '../store/LeagueContext';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { 
    Edit3, X, Image as ImageIcon,
    ChevronDown, ChevronUp, Clock, GitMerge,
    Users, ArrowRight, Settings, PlusCircle, CheckCircle,
    LayoutGrid, TrendingUp, Shuffle, Repeat, Plus, ChevronRight, Edit2, AlertTriangle, Save, Trophy, UserPlus, ArrowRightCircle, ArrowLeftCircle, FolderPlus, BarChart3, AlertCircle, Trash2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PosterGenerator } from '../components/PosterGenerator';
import { THEME } from '../utils/theme';
import { PlayerSelector } from '../components/PlayerSelector';
import { calculateDisplayRanking } from '../utils/Elo';
import { LevelProgressBar } from '../components/LevelProgressBar';

interface Standing {
    pairId: string;
    pairName: string;
    played: number;
    won: number;
    lost: number;
    setsF: number;
    setsC: number;
    points: number;
}

const LeagueActive: React.FC = () => {
    const { league, updateLeagueScore, advanceToPlayoffs, addPairToLeague, deletePairFromLeague, updateLeaguePair, generateLeagueGroups, addLeagueCategory, updateLeagueCategory } = useLeague();
    const { state, formatPlayerName, addPlayerToDB } = useTournament();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // TAB CONTROL VIA URL (Default: management)
    const activeTab = (searchParams.get('tab') as 'management' | 'registration' | 'standings' | 'calendar' | 'playoffs') || 'management';

    // NAVIGATION STATE (Context ID: can be 'overview', a categoryId, or a groupId)
    const [activeContextId, setActiveContextId] = useState<string>('overview');
    
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Category Editing State
    const [editingCategory, setEditingCategory] = useState<{ id: string, name: string } | null>(null);

    // Match Editing
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [scoreText, setScoreText] = useState('');
    const [setsA, setSetsA] = useState(0);
    const [setsB, setSetsB] = useState(0);
    const [expandedRound, setExpandedRound] = useState<number | null>(null);
    
    // Modals & Confirmations
    const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
    const [isPairModalOpen, setIsPairModalOpen] = useState(false); // Handles Add & Edit
    const [editingPairId, setEditingPairId] = useState<string | null>(null); // For pair editing
    
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showGenerateConfirm, setShowGenerateConfirm] = useState<boolean>(false);
    
    // PLAYOFF WIZARD STATE
    const [showPlayoffWizard, setShowPlayoffWizard] = useState(false);
    const [poQuota, setPoQuota] = useState(4); // Qualifiers per group
    const [poCross, setPoCross] = useState<'crossed' | 'internal'>('crossed');
    const [poFormat, setPoFormat] = useState<'single' | 'double'>('single');

    const [alertMessage, setAlertMessage] = useState<{type: 'error' | 'success', message: string} | null>(null);

    // Form Data
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [doubleRound, setDoubleRound] = useState(false);
    const [genMethod, setGenMethod] = useState<'elo-balanced' | 'elo-mixed'>('elo-balanced');

    // Poster Logic
    const [showPoster, setShowPoster] = useState(false);
    const [posterData, setPosterData] = useState<any>(null);

    // Helper: Change tab
    const setTab = (tab: string) => {
        setSearchParams({ tab });
    };

    const getPairName = (id: string) => {
        if (id === 'TBD') return 'Por determinar...';
        const pair = league.pairs.find(p => p.id === id);
        if (!pair) return 'Pareja Desc.';
        const p1 = state.players.find(p => p.id === pair.player1Id);
        const p2 = state.players.find(p => p.id === pair.player2Id);
        return `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
    };

    const getContextRange = () => {
        // Find category name
        let name = '';
        if (currentContext.type === 'category') name = currentContext.label;
        else if (currentContext.type === 'group') {
            const cat = league.categories.find(c => c.id === currentContext.parentId);
            if(cat) name = cat.name;
        }
        name = name.toLowerCase();

        let baseMin = 0; let baseMax = 6000;
        if (name.includes('iniciacion') || name.includes('iniciación')) return { min: 0, max: 1000 };
        if (name.includes('5')) { baseMin = 1000; baseMax = 2000; }
        else if (name.includes('4')) { baseMin = 2000; baseMax = 3000; }
        else if (name.includes('3')) { baseMin = 3000; baseMax = 4000; }
        else if (name.includes('2')) { baseMin = 4000; baseMax = 5000; }
        else if (name.includes('1')) { baseMin = 5000; baseMax = 6000; }
        
        if (name.includes('alta')) baseMin = baseMin + 500; 
        else if (name.includes('baja')) baseMax = baseMax - 500;
        
        return { min: baseMin, max: baseMax };
    };

    // --- NAVIGATION STRUCTURE BUILDER ---
    const navItems = useMemo(() => {
        const items: { id: string; label: string; type: 'category' | 'group' | 'overview'; parentId?: string }[] = [
            { id: 'overview', label: 'Resumen', type: 'overview' }
        ];

        league.categories.forEach(cat => {
            const catGroups = league.groups.filter(g => g.category_id === cat.id);
            if (catGroups.length > 0) {
                catGroups.sort((a,b) => a.name.localeCompare(b.name)).forEach(g => {
                    const shortGroupName = g.name.replace('Grupo ', '');
                    items.push({ 
                        id: g.id, 
                        label: `${cat.name} ${shortGroupName}`, 
                        type: 'group',
                        parentId: cat.id
                    });
                });
            } else {
                items.push({ id: cat.id, label: cat.name, type: 'category' });
            }
        });

        return items;
    }, [league.categories, league.groups]);

    const currentContext = navItems.find(i => i.id === activeContextId) || navItems[0];

    const calculateStandings = useMemo(() => {
        if (activeContextId === 'overview') return [];
        
        const contextPairs = getFilteredPairs();
        const contextMatches = getFilteredMatches().filter(m => m.phase === 'group' && m.isFinished);

        const standings: Record<string, Standing> = {};
        
        contextPairs.filter(p => p.player2Id).forEach(p => {
            standings[p.id] = { pairId: p.id, pairName: getPairName(p.id), played: 0, won: 0, lost: 0, setsF: 0, setsC: 0, points: 0 };
        });

        contextMatches.forEach(m => {
            if (standings[m.pairAId]) {
                standings[m.pairAId].played++;
                standings[m.pairAId].setsF += m.setsA || 0; standings[m.pairAId].setsC += m.setsB || 0;
                if (m.setsA! > m.setsB!) { standings[m.pairAId].won++; standings[m.pairAId].points += 3; }
                else { standings[m.pairAId].lost++; standings[m.pairAId].points += 1; }
            }
            if (standings[m.pairBId]) {
                standings[m.pairBId].played++;
                standings[m.pairBId].setsF += m.setsB || 0; standings[m.pairBId].setsC += m.setsA || 0;
                if (m.setsB! > m.setsA!) { standings[m.pairBId].won++; standings[m.pairBId].points += 3; }
                else { standings[m.pairBId].lost++; standings[m.pairBId].points += 1; }
            }
        });

        return Object.values(standings).sort((a, b) => b.points !== a.points ? b.points - a.points : (b.setsF - b.setsC) - (a.setsF - a.setsC));
    }, [league.matches, league.pairs, activeContextId]);

    // HANDLERS
    const handleGenerateWinnerPoster = () => {
        if (calculateStandings.length === 0) return;
        const leader = calculateStandings[0];
        setPosterData({
            title: league.title,
            winnerNames: leader.pairName,
            category: currentContext.label,
            type: 'podium'
        });
        setShowPoster(true);
    };

    const handleSaveScore = async () => {
        if (editingMatchId) {
            await updateLeagueScore(editingMatchId, setsA, setsB, scoreText);
            setEditingMatchId(null);
            setScoreText('');
            setSetsA(0);
            setSetsB(0);
        }
    };

    const handleConfirmGenerate = async () => {
        if (currentContext.type === 'category') {
             const catPairs = league.pairs.filter(p => p.category_id === currentContext.id);
             const groupsCount = catPairs.length >= 12 ? 2 : 1;
             await generateLeagueGroups(currentContext.id, groupsCount, genMethod, doubleRound);
             setShowGenerateConfirm(false);
        }
    };

    const handleConfirmPlayoffs = async () => {
        if (currentContext.type === 'category') {
            await advanceToPlayoffs(currentContext.id, {
                qualifiersPerGroup: poQuota,
                crossType: poCross,
                mode: poFormat
            });
            setShowPlayoffWizard(false);
            setTab('playoffs');
        }
    };

    function getFilteredPairs() {
        if (currentContext.type === 'group') {
            return league.pairs.filter(p => p.groupId === currentContext.id);
        } else if (currentContext.type === 'category') {
            return league.pairs.filter(p => p.category_id === currentContext.id);
        }
        return [];
    }

    function getFilteredMatches() {
        if (currentContext.type === 'group') {
            return league.matches.filter(m => m.group_id === currentContext.id);
        } else if (currentContext.type === 'category') {
            return league.matches.filter(m => m.category_id === currentContext.id);
        }
        return [];
    }

    const matchesByRound = useMemo(() => {
        if (activeContextId === 'overview') return {};
        const matches = getFilteredMatches().filter(m => m.phase === 'group');
        const rounds: Record<number, any[]> = {};
        matches.forEach(m => {
            const r = m.round || 1;
            if (!rounds[r]) rounds[r] = [];
            rounds[r].push(m);
        });
        return rounds;
    }, [league.matches, activeContextId]);

    const roundNumbers = Object.keys(matchesByRound).map(Number).sort((a,b) => a - b);

    const openAddModal = () => {
        setEditingPairId(null);
        setP1('');
        setP2('');
        setIsPairModalOpen(true);
    };

    const openEditModal = (pairId: string) => {
        const pair = league.pairs.find(p => p.id === pairId);
        if (!pair) return;
        setEditingPairId(pairId);
        setP1(pair.player1Id);
        setP2(pair.player2Id || '');
        setIsPairModalOpen(true);
    };

    const handleSavePair = async () => {
        const targetCategory = currentContext.type === 'group' ? currentContext.parentId : (currentContext.type === 'category' ? currentContext.id : league.categories[0]?.id);
        if (!p1 || !targetCategory) return; 
        if (editingPairId) { await updateLeaguePair(editingPairId, p1, p2); } else { await addPairToLeague({ player1Id: p1, player2Id: p2 || null, category_id: targetCategory, name: 'Pareja Liga' }); }
        setP1(''); setP2(''); setIsPairModalOpen(false); setEditingPairId(null);
    };

    const handleDeleteConfirm = async () => {
        if (showDeleteConfirm) { await deletePairFromLeague(showDeleteConfirm); setShowDeleteConfirm(null); }
    };

    // --- CATEGORY LOGIC ---
    const handleAddCategory = async () => {
        if (!newCategoryName) return;
        await addLeagueCategory(newCategoryName);
        setShowAddCategory(false);
        setNewCategoryName('');
    };

    const handleUpdateCategory = async () => {
        if (!editingCategory || !editingCategory.name) return;
        await updateLeagueCategory(editingCategory.id, editingCategory.name);
        setEditingCategory(null);
    };

    // MatchRow Component
    const MatchRow: React.FC<{ match: any }> = ({ match }) => (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
            <div className="flex-1 min-w-0 pr-4">
                {match.round_label && <div className="text-[9px] font-black uppercase text-indigo-400 mb-1">{match.round_label}</div>}
                <div className={`flex justify-between items-center mb-1 ${match.winnerId === match.pairAId ? 'text-indigo-600 font-black' : 'text-slate-700 font-medium'}`}>
                    <span className="text-sm truncate">{getPairName(match.pairAId)}</span>
                    <span className="text-lg ml-2">{match.setsA ?? '-'}</span>
                </div>
                <div className={`flex justify-between items-center ${match.winnerId === match.pairBId ? 'text-indigo-600 font-black' : 'text-slate-700 font-medium'}`}>
                    <span className="text-sm truncate">{getPairName(match.pairBId)}</span>
                    <span className="text-lg ml-2">{match.setsB ?? '-'}</span>
                </div>
                {match.score_text && <div className="text-[10px] text-slate-400 mt-1">{match.score_text}</div>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setEditingMatchId(match.id); setSetsA(match.setsA || 0); setSetsB(match.setsB || 0); setScoreText(match.score_text || ''); }} className="p-2 bg-slate-50 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 transition-colors"><Edit3 size={18}/></button>
        </div>
    );

    const availablePlayers = useMemo(() => {
        return state.players.filter(p => {
            const isAssigned = league.pairs.some(lp => {
                if (editingPairId && lp.id === editingPairId) return false;
                return lp.player1Id === p.id || lp.player2Id === p.id;
            });
            return !isAssigned;
        });
    }, [state.players, league.pairs, editingPairId]);

    // Helper for category stats (needed for overview)
    const getCategoryOverviewStats = (catId: string) => {
        const catPairs = league.pairs.filter(p => p.category_id === catId && p.player2Id);
        const catMatches = league.matches.filter(m => m.category_id === catId && m.phase === 'group');
        const finishedMatches = catMatches.filter(m => m.isFinished).length;
        return {
            totalPairs: catPairs.length,
            finishedMatches,
            totalMatches: catMatches.length,
            progress: catMatches.length > 0 ? Math.round((finishedMatches / catMatches.length) * 100) : 0,
            leaderName: null,
            leaderPoints: 0,
            inactivePairs: 0
        };
    };

    if (activeContextId === 'overview' && league.categories.length === 0 && !league.loading) return <div className="p-10 text-center animate-pulse text-white">Cargando datos de la liga...</div>;

    const displayPairs = [...getFilteredPairs().filter(p => !p.player2Id), ...getFilteredPairs().filter(p => p.player2Id)];
    const hasMatches = getFilteredMatches().length > 0;
    const hasPlayoffMatches = getFilteredMatches().some(m => m.phase === 'playoff');
    let currentCategoryStatus = 'Inscripción';
    if (hasMatches) currentCategoryStatus = 'Fase Grupos';
    if (hasPlayoffMatches) currentCategoryStatus = 'Playoffs';
    const contextRange = getContextRange();

    return (
        <div className="space-y-6 pb-32 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div><h2 className="text-2xl font-black text-white">{league.title}</h2></div>
                <div className="flex gap-2">
                    {activeTab === 'standings' && (<button onClick={handleGenerateWinnerPoster} className="p-2.5 bg-amber-500 text-white rounded-xl shadow-lg hover:scale-105 transition-transform"><ImageIcon size={20}/></button>)}
                </div>
            </div>

            {/* NAV BAR */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button onClick={() => setActiveContextId('overview')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${activeContextId === 'overview' ? 'bg-white text-indigo-900 border-white' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}><LayoutGrid size={12}/> Resumen</button>
                <div className="w-px h-6 bg-white/20 mx-1"></div>
                {navItems.filter(i => i.type !== 'overview').map(item => (
                    <button key={item.id} onClick={() => { setActiveContextId(item.id); setTab('management'); }} style={{ backgroundColor: activeContextId === item.id ? THEME.cta : 'rgba(255,255,255,0.1)', color: 'white' }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${activeContextId === item.id ? 'border-transparent' : 'border-white/10 hover:bg-white/20'}`}>
                        {item.label}
                        {item.type === 'category' && activeContextId === item.id && (
                            <div onClick={(e) => { e.stopPropagation(); setEditingCategory({ id: item.id, name: item.label }); }} className="p-1 hover:bg-white/20 rounded-full transition-colors"><Edit2 size={10} className="text-white/80 hover:text-white"/></div>
                        )}
                    </button>
                ))}
                <button onClick={() => setShowAddCategory(true)} className="px-3 py-2 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-colors"><Plus size={14}/></button>
            </div>

            {/* VIEWS */}
            {activeContextId === 'overview' ? (
                /* OVERVIEW */
                <div className="space-y-6 animate-slide-up">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-200">
                            <div className="flex items-center gap-2 mb-1 opacity-80 text-xs font-bold uppercase tracking-widest"><Users size={14}/> Total Parejas</div>
                            <div className="text-3xl font-black">{league.pairs.filter(p=>p.player2Id).length}</div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-1 text-slate-400 text-xs font-bold uppercase tracking-widest"><BarChart3 size={14}/> Progreso Liga</div>
                            <div className="text-3xl font-black text-slate-800">{league.matches.length > 0 ? Math.round((league.matches.filter(m=>m.isFinished).length / league.matches.length) * 100) : 0}%</div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider ml-1">Resumen por Categoría</h3>
                        {league.categories.map(cat => {
                            const stats = getCategoryOverviewStats(cat.id);
                            return (
                                <div key={cat.id} onClick={() => { setActiveContextId(cat.id); setTab('management'); }} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:scale-[1.02] active:scale-100 transition-all cursor-pointer relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{cat.name}</h4>
                                        <div className="text-right"><div className="text-2xl font-black text-slate-800">{stats.totalPairs}</div><div className="text-[9px] text-slate-400 uppercase font-bold">Inscritos</div></div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.progress}%` }}></div></div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <>
                    {activeTab === 'management' && (
                        /* MANAGEMENT */
                        <div className="space-y-6 animate-slide-up">
                            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-indigo-100">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-2"><h3 className="text-lg font-black text-slate-900">Estado: {currentContext.label}</h3>
                                        {currentContext.type === 'category' && <button onClick={() => setEditingCategory({ id: currentContext.id, name: currentContext.label })} className="p-1.5 bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={14}/></button>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1"><span className={`w-2.5 h-2.5 rounded-full ${!hasMatches ? 'bg-orange-500' : 'bg-emerald-500'}`}></span><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{currentCategoryStatus}</span></div>
                                    </div>
                                    <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600"><Settings size={24}/></div>
                                </div>
                                {currentContext.type === 'category' && !hasMatches && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><LayoutGrid size={16} className="text-indigo-500"/> Configuración Calendario</h4>
                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 mb-2"><div className="text-xs font-bold text-slate-600">Formato: {doubleRound ? 'Ida y Vuelta' : 'Solo Ida'}</div><button onClick={() => setDoubleRound(!doubleRound)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-500"><Repeat size={14}/></button></div>
                                        <div className="grid grid-cols-2 gap-2"><button onClick={() => { setGenMethod('elo-balanced'); setShowGenerateConfirm(true); }} className="p-3 bg-white border-2 border-slate-100 hover:border-indigo-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex flex-col items-center gap-1"><TrendingUp size={16} className="text-indigo-500"/> Por Nivel</button><button onClick={() => { setGenMethod('elo-mixed'); setShowGenerateConfirm(true); }} className="p-3 bg-white border-2 border-slate-100 hover:border-indigo-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex flex-col items-center gap-1"><Shuffle size={16} className="text-indigo-500"/> Sorteo Mix</button></div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest px-2">Accesos Directos</h4>
                                <button onClick={() => setTab('registration')} className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all text-left text-white"><div className="flex items-center gap-3"><Users size={20}/> <div><div className="font-bold">Listado Inscritos</div><div className="text-[10px] opacity-70">Ver parejas participantes</div></div></div><ChevronRight size={20} className="opacity-50"/></button>
                                {hasMatches && <button onClick={() => setTab('standings')} className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all text-left text-white"><div className="flex items-center gap-3"><GitMerge size={20}/> <div><div className="font-bold">Playoffs</div><div className="text-[10px] opacity-70">Generar cruces</div></div></div><ChevronRight size={20} className="opacity-50"/></button>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'registration' && (
                        /* REGISTRATION */
                        <div className="space-y-6 animate-slide-up">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-indigo-100 text-center"><div className="text-3xl font-black text-indigo-500">{displayPairs.filter(p=>p.player2Id).length}</div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Parejas</div></div>
                                <button onClick={openAddModal} className="bg-indigo-500 rounded-[2rem] p-6 shadow-lg border border-indigo-400 text-center text-white active:scale-95 transition-transform group"><div className="flex justify-center mb-1 group-hover:scale-110 transition-transform"><Plus size={32} strokeWidth={3}/></div><div className="text-[10px] font-black uppercase tracking-widest">Añadir Pareja</div></button>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 px-2">Listado {currentContext.label}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {displayPairs.map((pair, idx) => {
                                        const player1 = state.players.find(p => p.id === pair.player1Id);
                                        const player2 = pair.player2Id ? state.players.find(p => p.id === pair.player2Id) : null;
                                        const isSolo = !player2;
                                        let pairElo = 0;
                                        if (player1) { const p1Elo = calculateDisplayRanking(player1); const p2Elo = player2 ? calculateDisplayRanking(player2) : p1Elo; pairElo = Math.round((p1Elo + p2Elo) / 2); }
                                        return (
                                            <div key={pair.id} className={`rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isSolo ? 'bg-amber-50 border-2 border-amber-200' : 'bg-white border border-slate-200'}`}>
                                                <div className="p-4 flex flex-col h-full">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSolo ? 'bg-amber-200 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>{isSolo && <span className="text-[9px] uppercase font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Busca Pareja</span>}</div>
                                                        <div className="flex items-center gap-1"><button onClick={() => openEditModal(pair.id)} className="p-1.5 rounded-lg transition-colors text-slate-400 hover:text-blue-600 hover:bg-slate-50"><Edit2 size={16}/></button><button onClick={() => setShowDeleteConfirm(pair.id)} className="p-1.5 rounded-lg transition-colors text-slate-400 hover:text-red-600 hover:bg-slate-50"><Trash2 size={16}/></button></div>
                                                    </div>
                                                    <div className="space-y-1 mb-3 flex-1">
                                                        <div className="text-sm font-bold text-slate-800 truncate">{formatPlayerName(player1)}</div>
                                                        {player2 ? (<div className="flex items-center gap-2"><span style={{ color: THEME.cta }} className="text-xs font-black">&</span><div className="text-sm font-bold text-slate-800 truncate">{formatPlayerName(player2)}</div></div>) : (<div className="text-xs text-amber-500 italic mt-1 flex items-center gap-1"><UserPlus size={12}/> Esperando compañero...</div>)}
                                                    </div>
                                                </div>
                                                {!isSolo && <div className="bg-slate-50 px-4 py-2 border-t border-slate-100"><LevelProgressBar elo={pairElo} rangeMin={contextRange?.min} rangeMax={contextRange?.max} /></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'standings' && (
                        /* STANDINGS */
                        <div className="space-y-4 animate-slide-up">
                            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-indigo-100">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Pos</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Pareja</th><th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase">PG</th><th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase">Pts</th></tr></thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {calculateStandings.map((s, idx) => (<tr key={s.pairId} className="hover:bg-slate-50/80 cursor-pointer transition-colors"><td className="px-6 py-5"><span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${idx < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span></td><td className="px-6 py-5"><div className="font-bold text-slate-800 text-sm">{s.pairName}</div></td><td className="px-4 py-5 text-center font-bold text-emerald-500">{s.won}</td><td className="px-4 py-5 text-center"><span className="bg-indigo-50 text-indigo-600 font-black px-3 py-1 rounded-lg text-sm">{s.points}</span></td></tr>))}
                                    </tbody>
                                </table>
                            </div>
                            {hasMatches && <button onClick={() => setShowPlayoffWizard(true)} className="w-full py-4 bg-white text-indigo-500 border-2 border-dashed border-indigo-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-colors">GENERAR CUADRO ELIMINATORIO</button>}
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        /* CALENDAR */
                        <div className="space-y-4 animate-slide-up">
                            {roundNumbers.map(round => {
                                const isExpanded = expandedRound === round;
                                const roundMatches = matchesByRound[round];
                                return (
                                    <div key={round} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                                        <button onClick={() => setExpandedRound(isExpanded ? null : round)} className={`w-full p-5 flex justify-between items-center transition-colors ${isExpanded ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}>
                                            <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isExpanded ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>J{round}</div><div className="text-left"><div className="font-bold text-slate-900">Jornada {round}</div><div className="text-[10px] font-bold uppercase text-slate-400">{roundMatches.filter(m=>m.isFinished).length}/{roundMatches.length} Partidos</div></div></div>{isExpanded ? <ChevronUp className="text-slate-400"/> : <ChevronDown className="text-slate-400"/>}
                                        </button>
                                        {isExpanded && <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">{roundMatches.map(m => <MatchRow key={m.id} match={m} />)}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'playoffs' && (
                        /* PLAYOFFS */
                        <div className="space-y-8 animate-slide-up">
                            {!hasPlayoffMatches ? <div className="text-center py-20 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/20"><GitMerge size={48} className="mx-auto text-white/50 mb-4"/><p className="text-white/70 font-bold px-10">Termina la fase de grupos para generar el cuadro final.</p></div> : <div className="space-y-4">{league.matches.filter(m => (m.category_id === activeContextId || m.category_id === currentContext.parentId) && m.phase === 'playoff').map(m => <MatchRow key={m.id} match={m} />)}</div>}
                        </div>
                    )}
                </>
            )}

            {/* --- EDIT CATEGORY MODAL (UPDATED WITH GLOBAL CATEGORIES) --- */}
            {editingCategory && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Edit2 className="text-indigo-500"/> Editar Categoría</h3>
                        <p className="text-xs text-slate-500 mb-4">Selecciona el nivel oficial para esta categoría:</p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {TOURNAMENT_CATEGORIES.map(cat => (
                                <button 
                                    key={cat} 
                                    onClick={() => setEditingCategory({ ...editingCategory, name: cat })}
                                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${editingCategory.name === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-200'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setEditingCategory(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                            <button onClick={handleUpdateCategory} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Other Modals (Add Category, Pair, Delete, etc.) remain... */}
            {/* ADD CATEGORY MODAL */}
            {showAddCategory && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><FolderPlus className="text-indigo-500"/> Nueva Categoría</h3>
                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {TOURNAMENT_CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => setNewCategoryName(cat)} className={`p-3 rounded-xl border text-xs font-bold transition-all ${newCategoryName === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-200'}`}>{cat}</button>
                            ))}
                        </div>
                        <div className="flex gap-2"><button onClick={() => setShowAddCategory(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button><button onClick={handleAddCategory} disabled={!newCategoryName} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">Crear</button></div>
                    </div>
                </div>
            )}

            {/* REUSED MODALS FROM PREVIOUS STEP (Pair, Delete, Generate, Playoff, Alert, Score) - Ensure they exist in the closure */}
            {isPairModalOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"><div className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-[2.5rem] sm:max-w-md shadow-2xl animate-slide-up flex flex-col"><div className="flex justify-between items-center px-8 py-6 border-b border-slate-100"><h3 className="text-xl font-black text-slate-900">{editingPairId ? 'Editar Pareja' : 'Inscribir Pareja'}</h3><button onClick={() => setIsPairModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-8 custom-scrollbar"><PlayerSelector label="CAPITÁN (Jugador 1)" selectedId={p1} onSelect={setP1} otherSelectedId={p2} players={availablePlayers.concat(p1 ? [state.players.find(p=>p.id===p1)!].filter(Boolean) : [])} onAddPlayer={addPlayerToDB} formatName={formatPlayerName}/><div className="flex justify-center -my-3 relative z-10"><span className="bg-white text-indigo-400 text-xs px-2 py-1 rounded-full font-black border border-indigo-100">&</span></div><PlayerSelector label="JUGADOR 2" selectedId={p2} onSelect={setP2} otherSelectedId={p1} players={availablePlayers.concat(p2 ? [state.players.find(p=>p.id===p2)!].filter(Boolean) : [])} onAddPlayer={addPlayerToDB} formatName={formatPlayerName}/><div className="mt-8"><button onClick={handleSavePair} disabled={!p1 && !p2} className="w-full py-5 bg-indigo-500 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2"><Save size={20}/> {editingPairId ? 'GUARDAR CAMBIOS' : (!p2 ? 'AÑADIR COMO SOLO' : 'CONFIRMAR INSCRIPCIÓN')}</button></div></div></div></div>}
            
            {showDeleteConfirm && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"><div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600"><Trash2 size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-2">¿Eliminar Pareja?</h3><p className="text-slate-500 mb-6 text-sm">Esta acción eliminará a la pareja de la liga.</p><div className="flex gap-3"><button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button><button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg">Eliminar</button></div></div></div>}
            
            {showGenerateConfirm && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"><div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><LayoutGrid size={32} /></div><h3 className="text-xl font-black text-slate-900 mb-2">Generar Calendario</h3><p className="text-slate-500 mb-6 text-sm">Se generarán los grupos y partidos. <br/><strong>Método:</strong> {genMethod === 'elo-balanced' ? 'Equilibrado' : 'Mix'}. <strong>Formato:</strong> {doubleRound ? 'Ida y Vuelta' : 'Solo Ida'}.</p><div className="flex gap-3"><button onClick={() => setShowGenerateConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button><button onClick={handleConfirmGenerate} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Confirmar</button></div></div></div>}
            
            {showPlayoffWizard && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"><div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-scale-in"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Trophy className="text-amber-500"/> Configurar Playoffs</h3><button onClick={() => setShowPlayoffWizard(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button></div><div className="space-y-6"><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Clasificados por Grupo</label><div className="grid grid-cols-4 gap-2">{[1, 2, 4, 8].map(num => (<button key={num} onClick={() => setPoQuota(num)} className={`py-3 rounded-xl font-bold transition-all border-2 ${poQuota === num ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{num}</button>))}</div></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Tipo de Cruce</label><div className="grid grid-cols-2 gap-3"><button onClick={() => setPoCross('crossed')} className={`p-3 rounded-xl border-2 text-left transition-all ${poCross === 'crossed' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}><div className="font-bold text-slate-800 text-sm">Cruzado</div><div className="text-[10px] text-slate-500">1º A vs 4º B</div></button><button onClick={() => setPoCross('internal')} className={`p-3 rounded-xl border-2 text-left transition-all ${poCross === 'internal' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}><div className="font-bold text-slate-800 text-sm">Interno</div><div className="text-[10px] text-slate-500">1º A vs 4º A</div></button></div></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Formato</label><div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setPoFormat('single')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${poFormat === 'single' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Partido Único</button><button onClick={() => setPoFormat('double')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${poFormat === 'double' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Ida y Vuelta</button></div></div><div className="pt-4"><button onClick={handleConfirmPlayoffs} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"><GitMerge size={20}/> GENERAR CUADRO</button></div></div></div></div>}
            
            {alertMessage && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4"><div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in text-center"><div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alertMessage.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{alertMessage.type === 'error' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}</div><h3 className="text-xl font-black text-slate-900 mb-2">{alertMessage.type === 'error' ? 'Atención' : 'Éxito'}</h3><p className="text-slate-500 mb-6 text-sm">{alertMessage.message}</p><button onClick={() => setAlertMessage(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Entendido</button></div></div>}
            
            {editingMatchId && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scale-in relative"><button onClick={() => setEditingMatchId(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full"><X size={20}/></button><h3 className="text-xl font-black text-slate-900 mb-8">Editar Resultado</h3><div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Sets P1</label><input type="number" value={setsA} onChange={e => setSetsA(parseInt(e.target.value))} className="w-full bg-slate-50 border p-4 text-2xl font-black text-center rounded-2xl outline-none focus:border-indigo-400"/></div><div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Sets P2</label><input type="number" value={setsB} onChange={e => setSetsB(parseInt(e.target.value))} className="w-full bg-slate-50 border p-4 text-2xl font-black text-center rounded-2xl outline-none focus:border-indigo-400"/></div></div><input value={scoreText} onChange={e => setScoreText(e.target.value)} placeholder="6/4 7/5" className="w-full bg-slate-50 border p-4 font-bold rounded-2xl text-center outline-none focus:border-indigo-400"/><button onClick={handleSaveScore} className="w-full py-5 bg-indigo-500 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">GUARDAR RESULTADO</button></div></div></div>}
            
            {selectedPairId && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center sm:p-4"><div className="bg-white w-full h-[85vh] sm:h-auto sm:max-h-[85vh] sm:rounded-[2.5rem] sm:max-w-md shadow-2xl animate-slide-up flex flex-col overflow-hidden"><div className="bg-slate-900 p-6 text-white shrink-0"><div className="flex justify-between items-start mb-4"><h3 className="text-xl font-black leading-tight w-3/4">{getPairName(selectedPairId)}</h3><button onClick={() => setSelectedPairId(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={20}/></button></div><div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Calendario Completo</div></div><div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 space-y-3">{league.matches.filter(m => (m.pairAId === selectedPairId || m.pairBId === selectedPairId) && (m.category_id === activeContextId || m.group_id === activeContextId)).sort((a,b) => (a.round || 0) - (b.round || 0)).map(m => (<div key={m.id} className="relative"><div className="absolute -left-2 top-4 w-4 h-px bg-slate-300"></div><div className="pl-4"><div className="text-[10px] font-black text-slate-400 uppercase mb-1">Jornada {m.round}</div><MatchRow match={m} /></div></div>))}</div></div></div>}

            <PosterGenerator isOpen={showPoster} onClose={() => setShowPoster(false)} data={posterData} />
        </div>
    );
};

export default LeagueActive;
