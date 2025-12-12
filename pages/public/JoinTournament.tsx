
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament, TOURNAMENT_CATEGORIES } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { THEME } from '../../utils/theme';
import { User, Check, Trophy, Search, ArrowRight, UserPlus, AlertTriangle, X, Calendar, Phone, AtSign, MapPin, ExternalLink, ArrowRightCircle, ArrowLeftCircle, Repeat, Shuffle } from 'lucide-react';
import { calculateInitialElo } from '../../utils/Elo';
import { supabase } from '../../lib/supabase';

const JoinTournament: React.FC = () => {
    const { clubId } = useParams<{ clubId: string }>();
    const navigate = useNavigate();
    const { addPlayerToDB, createPairInDB, state, loadData, formatPlayerName } = useTournament();
    const { globalTournaments } = useHistory();

    const [step, setStep] = useState(1);
    const [alertMessage, setAlertMessage] = useState<{type: 'error'|'success', message: string} | null>(null);
    const [realClubName, setRealClubName] = useState('Club de Padel');
    
    // --- STEP 1: IDENTITY ---
    const [isGuest, setIsGuest] = useState(true); 
    
    // --- STEP 2: MY DATA ---
    const [myName, setMyName] = useState('');
    const [myNickname, setMyNickname] = useState(''); // NEW
    const [myPhone, setMyPhone] = useState('');
    const [myCategories, setMyCategories] = useState<string[]>([]);
    const [myPosition, setMyPosition] = useState<'right' | 'backhand' | undefined>(undefined);
    const [myPlayBoth, setMyPlayBoth] = useState(false);
    
    // --- STEP 3: PARTNER ---
    const [partnerType, setPartnerType] = useState<'search' | 'new' | 'solo' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    
    // New Partner Data
    const [partnerName, setPartnerName] = useState('');
    const [partnerPhone, setPartnerPhone] = useState('');
    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerCategories, setPartnerCategories] = useState<string[]>([]);
    const [partnerPosition, setPartnerPosition] = useState<'right' | 'backhand' | undefined>(undefined);
    const [partnerPlayBoth, setPartnerPlayBoth] = useState(false);

    // Context Data
    const tournamentInfo = globalTournaments.find(t => t.clubId === clubId) || {
        name: 'Torneo del Club',
        clubName: realClubName,
        date: new Date().toISOString(),
        clubLogo: '🎾',
        address: '',
        mapsUrl: ''
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    // Initial Load & Auth Check
    useEffect(() => {
        const init = async () => {
            await loadData();
            if (clubId) {
                // Fetch Real Club Name directly from Supabase
                const { data } = await supabase.from('clubs').select('name').eq('owner_id', clubId).single();
                if (data) setRealClubName(data.name);
            }
        };
        init();
    }, [loadData, clubId]);

    // Effect to auto-skip steps if logged in
    useEffect(() => {
        const storedId = localStorage.getItem('padel_sim_player_id');
        if (storedId && state.players.length > 0) {
            const me = state.players.find(p => p.id === storedId);
            if (me) {
                setMyName(me.name);
                setMyNickname(me.nickname || '');
                setMyPhone(me.phone || '');
                setMyCategories(me.categories || []);
                setMyPosition(me.preferred_position);
                setMyPlayBoth(me.play_both_sides || false);
                setIsGuest(false);
                setStep(3); // Jump straight to partner selection
            }
        }
    }, [state.players]);

    const handleNext = () => {
        if (step === 2 && !myName) {
            setAlertMessage({ type: 'error', message: "Por favor, introduce tu nombre." });
            return;
        }
        if (step === 3 && !partnerType) {
            setAlertMessage({ type: 'error', message: "Elige una opción para tu compañero." });
            return;
        }
        setStep(prev => prev + 1);
    };

    const toggleMyCategory = (cat: string) => {
        setMyCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const togglePartnerCategory = (cat: string) => {
        setPartnerCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const handleFinish = async () => {
        if (!clubId) {
            setAlertMessage({ type: 'error', message: "Error crítico: ID de Club no encontrado." });
            return;
        }

        let myId = localStorage.getItem('padel_sim_player_id');

        // 1. Create Myself if not exists
        if (!myId) {
            const myElo = calculateInitialElo(myCategories, 5); 
            // IMPORTANT: Pass clubId as second arg to associate with the club
            myId = await addPlayerToDB({
                name: myName + ' (App)',
                nickname: myNickname || myName,
                phone: myPhone,
                categories: myCategories,
                preferred_position: myPosition,
                play_both_sides: myPlayBoth,
                global_rating: myElo
            }, clubId);
            
            // Auto-login for future
            if (myId) localStorage.setItem('padel_sim_player_id', myId);
        }

        if (!myId) {
            setAlertMessage({ type: 'error', message: "Error al procesar tu usuario. Inténtalo de nuevo." });
            return;
        }

        // 2. Handle Partner
        let p2Id: string | null = null;

        if (partnerType === 'search') {
            p2Id = selectedPartnerId;
        } else if (partnerType === 'new') {
            const pElo = calculateInitialElo([...partnerCategories, 'Invitado'], 5);
            // IMPORTANT: Pass clubId here too
            p2Id = await addPlayerToDB({
                name: partnerName + ' (Invitado)',
                nickname: partnerName,
                categories: [...partnerCategories, 'Invitado'],
                preferred_position: partnerPosition,
                play_both_sides: partnerPlayBoth,
                phone: partnerPhone,
                email: partnerEmail,
                manual_rating: 5,
                global_rating: pElo
            }, clubId);
        } else if (partnerType === 'solo') {
            p2Id = null;
        }

        // 3. Create Pair
        await createPairInDB(myId, p2Id, 'confirmed'); 

        setAlertMessage({ type: 'success', message: "¡Inscripción realizada con éxito!" });
    };

    const closeAlert = () => {
        if (alertMessage?.type === 'success') {
            navigate('/');
        }
        setAlertMessage(null);
    };

    // Filter players for search - EXCLUDING CURRENT USER
    const filteredPlayers = state.players.filter(p => {
        const myId = localStorage.getItem('padel_sim_player_id');
        if (myId && p.id === myId) return false; // Exclude self
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    }).slice(0, 10);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-0 sm:p-6">
            <div className="w-full max-w-md bg-white sm:rounded-3xl shadow-xl overflow-hidden flex flex-col h-screen sm:h-[90vh] relative">
                
                {/* CLOSE BUTTON */}
                <button 
                    onClick={() => navigate(-1)} 
                    className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-sm"
                >
                    <X size={20} />
                </button>

                {/* --- HEADER LOGIC --- */}
                {step === 1 ? (
                    /* HERO HEADER (STEP 1) */
                    <div className="bg-slate-900 p-6 pt-12 text-white relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                            <Trophy size={150} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                                <span>{tournamentInfo.clubLogo}</span>
                                <span>{realClubName}</span>
                            </div>
                            <h1 className="text-3xl font-black leading-tight mb-2">{tournamentInfo.name}</h1>
                            <div className="flex flex-col gap-1.5 mt-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                    <Calendar size={14} className="text-[#575AF9]" /> {formatDate(tournamentInfo.date)}
                                </div>
                                {tournamentInfo.address && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <MapPin size={14} className="shrink-0"/> {tournamentInfo.address}
                                        {tournamentInfo.mapsUrl && (
                                            <a href={tournamentInfo.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#575AF9] hover:underline flex items-center gap-0.5">
                                                <ExternalLink size={10}/> Mapa
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* COMPACT HEADER (STEPS 2+) */
                    <div className="bg-slate-900 px-6 pt-10 pb-4 text-white shrink-0 shadow-md z-10">
                        <div className="flex justify-between items-end mb-3">
                            <div className="flex-1 pr-4">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                                    {realClubName} <span className="text-slate-600">//</span> {tournamentInfo.name}
                                </div>
                                <div className="text-xs font-medium text-slate-200 flex items-center gap-2 mt-0.5">
                                    <Calendar size={12} className="text-[#575AF9]"/> {formatDate(tournamentInfo.date)}
                                </div>
                            </div>
                            <div className="text-2xl font-black text-white">{step}/4</div>
                        </div>
                        {/* Stepper */}
                        <div className="flex gap-1">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-[#575AF9]' : 'bg-slate-800'}`}></div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CONTENT - SCROLLABLE AREA */}
                <div className="flex-1 overflow-y-auto p-6 pb-10 custom-scrollbar">
                    
                    {/* STEP 1: WELCOME (Only if not logged in) */}
                    {step === 1 && (
                        <div className="text-center space-y-6 animate-fade-in pt-4">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-[#575AF9] shadow-sm">
                                <Trophy size={40}/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 mb-2">¡Vamos a jugar!</h2>
                                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                                    Para inscribirte al torneo, necesitamos saber quién eres.
                                </p>
                            </div>
                            
                            <div className="space-y-3 pt-4">
                                <button onClick={() => navigate('/auth')} className="w-full py-4 border-2 border-slate-100 rounded-xl font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all">
                                    Ya tengo cuenta en la App
                                </button>
                                <button 
                                    onClick={() => { setIsGuest(true); setStep(2); }} 
                                    style={{ backgroundColor: THEME.cta }} 
                                    className="w-full py-4 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
                                >
                                    Soy nuevo / Invitado
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: MY DATA */}
                    {step === 2 && (
                        <div className="space-y-6 animate-slide-left pb-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Tus Datos</h2>
                                <p className="text-sm text-slate-400">Cuéntanos un poco sobre ti.</p>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                                <input value={myName} onChange={e => setMyName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="Ej. Alex García" autoFocus/>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Apodo</label>
                                    <input value={myNickname} onChange={e => setMyNickname(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 text-sm font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="Ej. Alex"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                                    <input value={myPhone} onChange={e => setMyPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 text-sm font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="600..."/>
                                </div>
                            </div>
                            
                            {/* Position Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tu Posición Preferida</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setMyPosition('right')} className={`flex-1 py-3 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all border ${myPosition === 'right' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}><ArrowRightCircle size={14}/> Derecha</button>
                                    <button onClick={() => setMyPosition('backhand')} className={`flex-1 py-3 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all border ${myPosition === 'backhand' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}><ArrowLeftCircle size={14}/> Revés</button>
                                </div>
                                <div 
                                    onClick={() => setMyPlayBoth(!myPlayBoth)}
                                    className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-colors ${myPlayBoth ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${myPlayBoth ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                        {myPlayBoth && <Check size={10} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs font-bold ${myPlayBoth ? 'text-emerald-700' : 'text-slate-500'}`}>Me adapto al otro lado (Versátil)</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">¿En qué categoría/s juegas?</label>
                                <div className="flex flex-wrap gap-2">
                                    {TOURNAMENT_CATEGORIES.map(cat => (
                                        <button 
                                            key={cat} 
                                            onClick={() => toggleMyCategory(cat)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${myCategories.includes(cat) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* FLOW BUTTONS (IN CONTENT) */}
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setStep(prev => prev - 1)} className="px-6 py-4 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                                    Atrás
                                </button>
                                <button 
                                    onClick={handleNext}
                                    style={{ backgroundColor: THEME.cta }} 
                                    className="flex-1 py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                                >
                                    Siguiente <ArrowRight size={20}/>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PARTNER */}
                    {step === 3 && (
                        <div className="space-y-6 animate-slide-left pb-4">
                             <div>
                                <h2 className="text-xl font-black text-slate-900">Tu Compañero</h2>
                                <p className="text-sm text-slate-400">¿Con quién vas a jugar hoy?</p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                                {/* OPTION A: SEARCH */}
                                <div className={`rounded-xl border-2 overflow-hidden transition-all ${partnerType === 'search' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-100'}`}>
                                    <button 
                                        onClick={() => setPartnerType(partnerType === 'search' ? null : 'search')}
                                        className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="bg-white p-2 rounded-full shadow-sm"><Search size={20} className="text-blue-500"/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Buscar en el Club</div>
                                            <div className="text-xs text-slate-500">Ya ha jugado antes</div>
                                        </div>
                                    </button>
                                    
                                    {partnerType === 'search' && (
                                        <div className="px-4 pb-4 animate-fade-in">
                                            <div className="h-px bg-blue-200 w-full mb-3"></div>
                                            <input 
                                                placeholder="Escribe nombre..." 
                                                value={searchQuery} 
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full p-3 border rounded-lg text-sm mb-2 outline-none focus:border-blue-500 bg-white"
                                                autoFocus
                                            />
                                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar mb-2">
                                                {filteredPlayers.length > 0 ? filteredPlayers.map(p => (
                                                    <button 
                                                        key={p.id} 
                                                        onClick={() => setSelectedPartnerId(p.id)}
                                                        className={`w-full text-left p-2 text-sm rounded flex items-center justify-between ${selectedPartnerId === p.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
                                                    >
                                                        <span>{formatPlayerName(p)}</span>
                                                        {selectedPartnerId === p.id && <Check size={14}/>}
                                                    </button>
                                                )) : (
                                                    <p className="text-xs text-slate-400 italic p-2">No encontrado</p>
                                                )}
                                            </div>
                                            <button 
                                                onClick={handleNext}
                                                disabled={!selectedPartnerId}
                                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                                            >
                                                Seleccionar y Continuar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* OPTION B: NEW GUEST */}
                                <div className={`rounded-xl border-2 overflow-hidden transition-all ${partnerType === 'new' ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-slate-100'}`}>
                                    <button 
                                        onClick={() => setPartnerType(partnerType === 'new' ? null : 'new')}
                                        className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="bg-white p-2 rounded-full shadow-sm"><UserPlus size={20} className="text-emerald-500"/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Registrar Amigo</div>
                                            <div className="text-xs text-slate-500">Es nuevo</div>
                                        </div>
                                    </button>

                                    {partnerType === 'new' && (
                                        <div className="px-4 pb-4 space-y-3 animate-fade-in">
                                            <div className="h-px bg-emerald-200 w-full mb-3"></div>
                                            <input 
                                                placeholder="Nombre completo" 
                                                value={partnerName} 
                                                onChange={e => setPartnerName(e.target.value)}
                                                className="w-full p-3 border rounded-lg text-sm outline-none focus:border-emerald-500 bg-white"
                                                autoFocus
                                            />
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="relative">
                                                    <Phone size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                                                    <input 
                                                        placeholder="Teléfono (Opc.)" 
                                                        value={partnerPhone} 
                                                        onChange={e => setPartnerPhone(e.target.value)}
                                                        className="w-full pl-9 p-3 border rounded-lg text-sm outline-none focus:border-emerald-500 bg-white"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <AtSign size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                                                    <input 
                                                        placeholder="Email (Opc.)" 
                                                        value={partnerEmail} 
                                                        onChange={e => setPartnerEmail(e.target.value)}
                                                        className="w-full pl-9 p-3 border rounded-lg text-sm outline-none focus:border-emerald-500 bg-white"
                                                    />
                                                </div>
                                            </div>

                                            {/* Partner Position */}
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                <button onClick={() => setPartnerPosition('right')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-md flex items-center justify-center gap-1 transition-all ${partnerPosition === 'right' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}><ArrowRightCircle size={12}/> Der.</button>
                                                <button onClick={() => setPartnerPosition('backhand')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-md flex items-center justify-center gap-1 transition-all ${partnerPosition === 'backhand' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}><ArrowLeftCircle size={12}/> Rev.</button>
                                                <button onClick={() => setPartnerPosition('both')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-md flex items-center justify-center gap-1 transition-all ${partnerPosition === 'both' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}><Repeat size={12}/> Ambas</button>
                                            </div>

                                            {/* CATEGORY SELECTOR REPLACING SLIDER */}
                                            <div>
                                                <label className="text-xs font-bold text-emerald-800 uppercase mb-2 block">Categoría Base</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {TOURNAMENT_CATEGORIES.map(cat => (
                                                        <button 
                                                            key={cat} 
                                                            onClick={() => togglePartnerCategory(cat)} 
                                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${partnerCategories.includes(cat) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-300'}`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                onClick={handleNext}
                                                disabled={!partnerName}
                                                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
                                            >
                                                Crear y Continuar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* OPTION C: SOLO */}
                                <button 
                                    onClick={() => { setPartnerType('solo'); handleNext(); }}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${partnerType === 'solo' ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-full shadow-sm"><User size={20} className="text-amber-500"/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Voy Solo</div>
                                            <div className="text-xs text-slate-500">Busco pareja</div>
                                        </div>
                                        <div className="ml-auto">
                                            <ArrowRight size={20} className="text-slate-300"/>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <button onClick={() => setStep(prev => prev - 1)} className="w-full py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors mt-4">
                                Atrás
                            </button>
                        </div>
                    )}

                    {/* STEP 4: CONFIRM */}
                    {step === 4 && (
                        <div className="text-center space-y-6 animate-fade-in pt-4 pb-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Resumen</h2>
                                <p className="text-sm text-slate-400">Revisa los datos antes de confirmar</p>
                            </div>
                            
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left space-y-4 shadow-sm">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Jugador 1</div>
                                    <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        {myName}
                                        {!isGuest && <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full uppercase">Tú</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                        <span>{myCategories.join(', ')}</span>
                                        {myPosition && <span className="bg-slate-200 px-1.5 rounded text-[10px] uppercase font-bold text-slate-600">{myPosition === 'right' ? 'Derecha' : 'Revés'}</span>}
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Jugador 2</div>
                                    <div className="text-lg font-bold text-slate-900">
                                        {partnerType === 'solo' ? <span className="text-amber-500 italic">Buscando Pareja...</span> : 
                                         partnerType === 'search' ? (state.players.find(p => p.id === selectedPartnerId)?.name) : 
                                         partnerName}
                                    </div>
                                    {/* Partner Categories Display */}
                                    {partnerType === 'new' && (
                                        <div className="text-xs text-slate-500 mt-1">{partnerCategories.join(', ')}</div>
                                    )}
                                </div>
                            </div>

                            {partnerType === 'solo' && (
                                <div className="bg-amber-50 p-3 rounded-xl text-xs text-amber-800 flex items-start gap-2 text-left border border-amber-100">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                                    <span>Entrarás en la bolsa de jugadores individuales. El organizador te asignará una pareja si hay disponibilidad.</span>
                                </div>
                            )}

                            {/* Flow Buttons */}
                            <div className="flex gap-3">
                                <button onClick={() => setStep(prev => prev - 1)} className="px-6 py-4 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                                    Atrás
                                </button>
                                <button 
                                    onClick={handleFinish}
                                    style={{ backgroundColor: THEME.cta }} 
                                    className="flex-1 py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                                >
                                    Confirmar Inscripción <Check size={20}/>
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ALERT MODAL */}
            {alertMessage && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alertMessage.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {alertMessage.type === 'error' ? <AlertTriangle size={32} /> : <Check size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">{alertMessage.type === 'error' ? 'Atención' : 'Todo listo'}</h3>
                        <p className="text-slate-500 mb-6">{alertMessage.message}</p>
                        <button onClick={closeAlert} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">
                            {alertMessage.type === 'error' ? 'Revisar' : 'Continuar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinTournament;
