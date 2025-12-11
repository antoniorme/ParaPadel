

import React, { useState, useEffect } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { THEME, getFormatColor } from '../../utils/theme';
import { Calendar, Users, ArrowRight, Clock, CheckCircle, Search, UserPlus, X, Mail, Check, Trash2, AlertTriangle, User, Phone, AtSign, Edit2, RefreshCw, Heart, ChevronDown, ChevronUp, Gift, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateInitialElo } from '../../utils/Elo';

const PlayerTournaments: React.FC = () => {
    const { state, createPairInDB, updatePairDB, formatPlayerName, respondToInviteDB, deletePairDB, addPlayerToDB } = useTournament();
    const { globalTournaments } = useHistory();
    const navigate = useNavigate();

    // Get current logged-in player ID from LocalStorage (Simulator)
    const [myPlayerId, setMyPlayerId] = useState<string>('');
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isEditingMode, setIsEditingMode] = useState(false); // NEW: Track if we are editing
    const [modalTab, setModalTab] = useState<'club' | 'guest'>('club');
    
    // UI State for Card
    const [isCardExpanded, setIsCardExpanded] = useState(false);

    // Club Search State
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Guest Creation State
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    // const [guestLevel, setGuestLevel] = useState(5); // REMOVED SLIDER STATE
    const [guestCategories, setGuestCategories] = useState<string[]>([]);
    const [smartMatchWarning, setSmartMatchWarning] = useState<any[]>([]);

    useEffect(() => {
        const storedId = localStorage.getItem('padel_sim_player_id');
        if (storedId) setMyPlayerId(storedId);
        else navigate('/p/dashboard');
    }, [navigate]);

    // CHECK REGISTRATION STATUS
    const myRegistration = state.pairs.find(p => (p.player1Id === myPlayerId || p.player2Id === myPlayerId) && p.status !== 'rejected');
    const isRegistered = !!myRegistration;
    const isPending = myRegistration?.status === 'pending';
    
    const isInviter = myRegistration && myRegistration.player1Id === myPlayerId;

    // Resolve Partner Name if registered
    let partnerName = '...';
    let partnerId = '';
    if (isRegistered) {
        partnerId = myRegistration.player1Id === myPlayerId ? myRegistration.player2Id : myRegistration.player1Id;
        const partner = state.players.find(p => p.id === partnerId);
        partnerName = formatPlayerName(partner);
    }

    // Determine tournament status for display
    const hasTournament = state.status !== 'finished';
    const isRegistrationOpen = state.status === 'setup';
    const themeColor = getFormatColor(state.format);
    const formatLabel = state.format ? state.format.replace('_mini', '') : '16';

    // Find rich data for the current tournament from globalTournaments
    const foundTournament = globalTournaments.find(t => t.id === state.id);
    const richTournamentData = foundTournament || {
        prizes: state.prizes,
        price: state.price,
        description: state.description,
        clubId: undefined
    };

    const formatDate = () => {
        return new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    // --- ACTIONS ---

    const openRegisterModal = (editing: boolean = false) => {
        setIsEditingMode(editing);
        setSelectedPartnerId('');
        setGuestName('');
        setSearchTerm('');
        setGuestCategories([]);
        setIsRegisterModalOpen(true);
    };

    const handleInviteClubPlayer = async () => {
        if (!selectedPartnerId) return;
        
        if (isEditingMode && myRegistration) {
            await updatePairDB(myRegistration.id, myPlayerId, selectedPartnerId);
        } else {
            await createPairInDB(myPlayerId, selectedPartnerId, 'pending');
        }
        setIsRegisterModalOpen(false);
    };

    const toggleGuestCategory = (cat: string) => {
        setGuestCategories(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handleCreateGuest = async () => {
        if (!guestName) return;
        
        // CRITICAL: Find the Owner ID (Club ID) for the current tournament so the guest is visible to the Club
        // In local mode, we might fallback, but in real usage this links the guest to the club.
        const tournamentOwnerId = richTournamentData.clubId || 'local-admin';

        // 1. Create Guest Player - Auto calc ELO based on Categories, manual rating fixed to 5 (neutral)
        // We include 'Invitado' tag but calculating ELO based on selected categories is key
        const initialElo = calculateInitialElo([...guestCategories, 'Invitado'], 5);
        
        const newId = await addPlayerToDB({
            name: guestName + ' (Invitado)',
            nickname: guestName,
            phone: guestPhone,
            email: guestEmail,
            categories: [...guestCategories, 'Invitado'],
            manual_rating: 5, // Default neutral
            global_rating: initialElo
        }, tournamentOwnerId); // PASS CLUB ID HERE

        if (newId) {
            if (isEditingMode && myRegistration) {
                await updatePairDB(myRegistration.id, myPlayerId, newId);
            } else {
                await createPairInDB(myPlayerId, newId, 'confirmed');
            }
            setIsRegisterModalOpen(false);
        }
    };

    const handleAcceptInvite = async () => {
        if (myRegistration) await respondToInviteDB(myRegistration.id, 'accept');
    };

    const handleRejectInvite = async () => {
        if (myRegistration) {
            await respondToInviteDB(myRegistration.id, 'reject');
            await deletePairDB(myRegistration.id); 
        }
    };

    const handleCancelInvite = async () => {
        if (myRegistration) await deletePairDB(myRegistration.id);
    };

    // Filter available partners (Strictly exclude self)
    const availablePartners = state.players.filter(p => {
        if (p.id === myPlayerId) return false; // STRICT SELF EXCLUSION
        const isBusy = state.pairs.some(pair => (pair.player1Id === p.id || pair.player2Id === p.id) && pair.status !== 'rejected');
        if (isBusy) return false;
        return p.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    useEffect(() => {
        if (modalTab === 'guest' && guestName.length > 2) {
            const matches = state.players.filter(p => p.name.toLowerCase().includes(guestName.toLowerCase()));
            setSmartMatchWarning(matches);
        } else {
            setSmartMatchWarning([]);
        }
    }, [guestName, modalTab, state.players]);

    return (
        <div className="p-6 space-y-6 pb-24">
            <h2 className="text-2xl font-black text-slate-900">Mis Partidos</h2>

            {/* INBOX NOTIFICATION */}
            {isRegistered && isPending && !isInviter && (
                <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-md animate-slide-up">
                    <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Mail size={20}/></div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-800 text-sm">Invitación Recibida</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                <span className="font-bold text-slate-700">{partnerName}</span> te ha invitado a jugar.
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button onClick={handleAcceptInvite} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700">Aceptar</button>
                                <button onClick={handleRejectInvite} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200">Rechazar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REGISTERED TOURNAMENT CARD (Now matching TournamentBrowser style) */}
            {hasTournament && isRegistered ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                    {/* Consistent Header */}
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🎾</span>
                            <span className="font-bold text-slate-700 text-sm">Mi Club de Padel</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isPending ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`}>
                            {isPending ? 'Pendiente' : 'Confirmado'}
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-black text-slate-900 text-lg leading-tight w-3/4">{state.title || `Mini Torneo ${formatLabel}`}</h3>
                             <div className="text-right">
                                <div className="text-lg font-black text-slate-900">{richTournamentData.price || 15}€</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <span style={{ backgroundColor: themeColor }} className="text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                {formatLabel} PAREJAS
                            </span>
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                                {state.levelRange || 'Nivel Abierto'}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-6">
                            <div className="flex items-center gap-1"><Calendar size={14} className="text-[#575AF9]"/> {formatDate()}</div>
                            <div className="flex items-center gap-1"><Clock size={14}/> 10:00</div>
                        </div>

                        {/* PARTNER INFO BLOCK */}
                        <div className={`p-4 rounded-xl border mb-6 flex items-center gap-3 ${isPending ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                <div className={`bg-white p-2 rounded-full shadow-sm ${isPending ? 'text-amber-500' : 'text-blue-500'}`}>
                                    {isPending ? <Clock size={20}/> : <CheckCircle size={20}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold uppercase ${isPending ? 'text-amber-500' : 'text-slate-400'}`}>
                                        {isPending ? (isInviter ? 'Esperando a...' : 'Te invita...') : 'Tu Compañero'}
                                    </div>
                                    <div className="text-base font-black text-slate-800 truncate">{partnerName}</div>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                    {/* EDIT BUTTON */}
                                    {(isInviter || !isPending) && (
                                        <button 
                                        onClick={() => openRegisterModal(true)} 
                                        className="p-2 text-blue-600 bg-white hover:bg-blue-50 rounded-lg border border-blue-100 shadow-sm transition-colors"
                                        title="Cambiar Pareja"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                    )}
                                    
                                    {isPending && isInviter && (
                                        <button onClick={handleCancelInvite} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-lg border border-slate-100 shadow-sm"><Trash2 size={16}/></button>
                                    )}
                                </div>
                        </div>

                        {/* EXPANDABLE INFO (Prizes/Description) */}
                        {isCardExpanded && (
                            <div className="mb-6 animate-slide-up space-y-4">
                                {richTournamentData.description && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                            <FileText size={14}/> Detalles
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">{richTournamentData.description}</p>
                                    </div>
                                )}
                                
                                {richTournamentData.prizes && richTournamentData.prizes.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                            <Gift size={14}/> Premios
                                        </div>
                                        <ul className="space-y-1">
                                            {richTournamentData.prizes.map((prize: string, idx: number) => (
                                                <li key={idx} className="text-sm font-medium text-slate-700">
                                                    {prize}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 items-center">
                            {/* Expand Toggle */}
                            <button 
                                onClick={() => setIsCardExpanded(!isCardExpanded)}
                                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-1 transition-colors"
                                title="Ver Info"
                            >
                                {isCardExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                            </button>

                            {/* Main Action */}
                            {state.status === 'active' ? (
                                <button className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse">
                                    Ir al Directo <ArrowRight size={20}/>
                                </button>
                            ) : (
                                <div className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-xl font-bold flex items-center justify-center gap-2 text-xs">
                                    El torneo comenzará pronto
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <Calendar size={64} className="mx-auto text-slate-200 mb-6"/>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">No estás inscrito</h3>
                    <button onClick={() => navigate('/p/explore')} className="text-[#575AF9] font-bold text-sm">Explorar Torneos</button>
                </div>
            )}

            {/* PARTNER SELECTION MODAL */}
            {isRegisterModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
                     <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-3xl sm:max-w-md shadow-2xl animate-slide-up flex flex-col">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                             <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                {isEditingMode ? <RefreshCw className="text-blue-500"/> : <UserPlus className="text-blue-500"/>}
                                {isEditingMode ? 'Cambiar Pareja' : 'Inscripción'}
                             </h3>
                             <button onClick={() => setIsRegisterModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                        </div>
                        
                        {/* TABS */}
                        <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100">
                            <button onClick={() => setModalTab('club')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${modalTab === 'club' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Buscar Socio</button>
                            <button onClick={() => setModalTab('guest')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${modalTab === 'guest' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Invitado</button>
                        </div>

                        {/* CONTENT */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            
                            {/* TAB: CLUB */}
                            {modalTab === 'club' && (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar nombre..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700"/>
                                    </div>
                                    <div className="space-y-2">
                                        {availablePartners.map(p => (
                                            <button key={p.id} onClick={() => setSelectedPartnerId(p.id)} className={`w-full text-left p-3 rounded-xl border flex justify-between items-center transition-all ${selectedPartnerId === p.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-100 hover:border-blue-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedPartnerId === p.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{p.name[0]}</div>
                                                    <div><div className={`font-bold text-sm ${selectedPartnerId === p.id ? 'text-blue-900' : 'text-slate-700'}`}>{formatPlayerName(p)}</div><div className="text-xs text-slate-400">{p.categories?.[0] || 'Sin Nivel'}</div></div>
                                                </div>
                                                {selectedPartnerId === p.id && <CheckCircle className="text-blue-500" size={20}/>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB: GUEST */}
                            {modalTab === 'guest' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-xs text-amber-800 mb-4">
                                        Usar para amigos que no tienen la app.
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">Nombre Invitado</label>
                                        <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Ej. Primo de Juan" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"/>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Phone size={12}/> Teléfono</label>
                                            <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Opcional" className="w-full pl-9 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"/>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><AtSign size={12}/> Email</label>
                                            <input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="Opcional" className="w-full pl-9 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"/>
                                        </div>
                                    </div>

                                    {/* SMART MATCH WARNING */}
                                    {smartMatchWarning.length > 0 && (
                                        <div className="bg-white border-2 border-orange-100 p-3 rounded-xl shadow-sm">
                                            <h5 className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1 mb-2"><AlertTriangle size={14}/> Posibles Duplicados</h5>
                                            <div className="space-y-1">
                                                {smartMatchWarning.map(p => (
                                                    <div key={p.id} className="text-sm text-slate-600 flex items-center gap-2">
                                                        <User size={14} className="text-slate-400"/> {formatPlayerName(p)}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-2 italic">Si es uno de estos, búscalo en la pestaña "Buscar Socio".</p>
                                        </div>
                                    )}

                                    {/* CATEGORY SELECTOR REPLACING SLIDER */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoría Base</label>
                                        <div className="flex flex-wrap gap-2">
                                            {TOURNAMENT_CATEGORIES.map(cat => (
                                                <button 
                                                    key={cat} 
                                                    onClick={() => toggleGuestCategory(cat)} 
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${guestCategories.includes(cat) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-300'}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100">
                             {modalTab === 'club' ? (
                                <button 
                                    onClick={handleInviteClubPlayer}
                                    disabled={!selectedPartnerId}
                                    style={{ backgroundColor: selectedPartnerId ? THEME.cta : '#e2e8f0' }}
                                    className="w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Mail size={20}/> {isEditingMode ? 'Enviar Nueva Invitación' : 'Enviar Invitación'}
                                </button>
                             ) : (
                                <button 
                                    onClick={handleCreateGuest}
                                    disabled={!guestName}
                                    style={{ backgroundColor: guestName ? THEME.cta : '#e2e8f0' }}
                                    className="w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Check size={20}/> {isEditingMode ? 'Cambiar a Invitado' : 'Confirmar Invitado'}
                                </button>
                             )}
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};

export default PlayerTournaments;
