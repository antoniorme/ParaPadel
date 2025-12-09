

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament, TOURNAMENT_CATEGORIES } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { THEME } from '../../utils/theme';
import { User, Check, Trophy, Search, ArrowRight, UserPlus, AlertTriangle, X, Calendar, Phone, AtSign, MapPin, ExternalLink } from 'lucide-react';
import { calculateInitialElo } from '../../utils/Elo';

const JoinTournament: React.FC = () => {
    const { clubId } = useParams<{ clubId: string }>();
    const navigate = useNavigate();
    const { addPlayerToDB, createPairInDB, state, loadData, formatPlayerName } = useTournament();
    const { globalTournaments } = useHistory();

    const [step, setStep] = useState(1);
    
    // --- STEP 1: IDENTITY ---
    const [isGuest, setIsGuest] = useState(true); 
    
    // --- STEP 2: MY DATA ---
    const [myName, setMyName] = useState('');
    const [myPhone, setMyPhone] = useState('');
    const [myCategories, setMyCategories] = useState<string[]>([]);
    
    // --- STEP 3: PARTNER ---
    const [partnerType, setPartnerType] = useState<'search' | 'new' | 'solo' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    
    // New Partner Data
    const [partnerName, setPartnerName] = useState('');
    const [partnerPhone, setPartnerPhone] = useState('');
    const [partnerEmail, setPartnerEmail] = useState('');
    // const [partnerLevel, setPartnerLevel] = useState(5); // REMOVED SLIDER
    const [partnerCategories, setPartnerCategories] = useState<string[]>([]);

    // Context Data
    const tournamentInfo = globalTournaments.find(t => t.clubId === clubId) || {
        name: 'Torneo del Club',
        clubName: 'Club de Padel',
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
        };
        init();
    }, [loadData]);

    // Effect to auto-skip steps if logged in
    useEffect(() => {
        const storedId = localStorage.getItem('padel_sim_player_id');
        if (storedId && state.players.length > 0) {
            const me = state.players.find(p => p.id === storedId);
            if (me) {
                setMyName(me.name);
                setMyPhone(me.phone || '');
                setMyCategories(me.categories || []);
                setIsGuest(false);
                setStep(3); // Jump straight to partner selection
            }
        }
    }, [state.players]);

    const handleNext = () => {
        if (step === 2 && !myName) return alert("Por favor, introduce tu nombre.");
        if (step === 3 && !partnerType) return alert("Elige una opción para tu compañero.");
        setStep(prev => prev + 1);
    };

    const toggleMyCategory = (cat: string) => {
        setMyCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const togglePartnerCategory = (cat: string) => {
        setPartnerCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const handleFinish = async () => {
        if (!clubId) return;

        let myId = localStorage.getItem('padel_sim_player_id');

        // 1. Create Myself if not exists
        if (!myId) {
            const myElo = calculateInitialElo(myCategories, 5); 
            myId = await addPlayerToDB({
                name: myName + ' (App)',
                nickname: myName,
                phone: myPhone,
                categories: myCategories,
                global_rating: myElo
            }, clubId);
            
            // Auto-login for future
            if (myId) localStorage.setItem('padel_sim_player_id', myId);
        }

        if (!myId) return alert("Error al procesar tu usuario.");

        // 2. Handle Partner
        let p2Id: string | null = null;

        if (partnerType === 'search') {
            p2Id = selectedPartnerId;
        } else if (partnerType === 'new') {
            // ELO Calculation for Partner based on multi-select categories
            const pElo = calculateInitialElo([...partnerCategories, 'Invitado'], 5);
            p2Id = await addPlayerToDB({
                name: partnerName + ' (Invitado)',
                nickname: partnerName,
                categories: [...partnerCategories, 'Invitado'],
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

        alert("¡Inscripción realizada con éxito!");
        navigate('/'); 
    };

    // Filter players for search - EXCLUDING CURRENT USER
    const filteredPlayers = state.players.filter(p => {
        const myId = localStorage.getItem('padel_sim_player_id');
        if (myId && p.id === myId) return false; // Exclude self
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    }).slice(0, 10);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-6">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[90vh] relative">
                
                {/* CLOSE BUTTON */}
                <button 
                    onClick={() => navigate(-1)} 
                    className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                {/* HEADER WITH CONTEXT */}
                <div className="bg-slate-900 p-6 pt-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                        <Trophy size={150} />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                            <span>{tournamentInfo.clubLogo}</span>
                            <span>{tournamentInfo.clubName}</span>
                        </div>
                        <h1 className="text-2xl font-black leading-tight mb-2">{tournamentInfo.name}</h1>
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

                    <div className="flex gap-1 mt-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-[#575AF9]' : 'bg-slate-800'}`}></div>
                        ))}
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    
                    {/* STEP 1: WELCOME (Only if not logged in) */}
                    {step === 1 && (
                        <div className="text-center space-y-6 animate-fade-in pt-4">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-[#575AF9] shadow-sm">
                                <Trophy size={40}/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 mb-2">¡Vamos a jugar!</h2>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Para inscribirte, necesitamos saber quién eres.
                                </p>
                            </div>
                            
                            <div className="space-y-3">
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
                        <div className="space-y-6 animate-slide-left">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Tus Datos</h2>
                                <p className="text-sm text-slate-400">¿Cómo te llamas?</p>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                                <input value={myName} onChange={e => setMyName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="Ej. Alex García" autoFocus/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                                <input value={myPhone} onChange={e => setMyPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="600 000 000"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tu Nivel Aproximado</label>
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
                        </div>
                    )}

                    {/* STEP 3: PARTNER */}
                    {step === 3 && (
                        <div className="space-y-6 animate-slide-left">
                             <div>
                                <h2 className="text-xl font-black text-slate-900">Tu Compañero</h2>
                                <p className="text-sm text-slate-400">¿Con quién vas a jugar hoy?</p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                                {/* OPTION A: SEARCH */}
                                <button 
                                    onClick={() => setPartnerType(partnerType === 'search' ? null : 'search')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${partnerType === 'search' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-full shadow-sm"><Search size={20} className="text-blue-500"/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Buscar en el Club</div>
                                            <div className="text-xs text-slate-500">Ya ha jugado antes</div>
                                        </div>
                                    </div>
                                </button>
                                {partnerType === 'search' && (
                                    <div className="pl-4 animate-fade-in border-l-2 border-blue-100 ml-6 py-2">
                                        <input 
                                            placeholder="Escribe nombre..." 
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full p-3 border rounded-lg text-sm mb-2 outline-none focus:border-blue-500"
                                            autoFocus
                                        />
                                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
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
                                    </div>
                                )}

                                {/* OPTION B: NEW GUEST */}
                                <button 
                                    onClick={() => setPartnerType(partnerType === 'new' ? null : 'new')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${partnerType === 'new' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-full shadow-sm"><UserPlus size={20} className="text-emerald-500"/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Registrar Amigo</div>
                                            <div className="text-xs text-slate-500">Es nuevo</div>
                                        </div>
                                    </div>
                                </button>
                                {partnerType === 'new' && (
                                    <div className="pl-4 space-y-3 animate-fade-in border-l-2 border-emerald-100 ml-6 py-2">
                                        <input 
                                            placeholder="Nombre completo" 
                                            value={partnerName} 
                                            onChange={e => setPartnerName(e.target.value)}
                                            className="w-full p-3 border rounded-lg text-sm outline-none focus:border-emerald-500"
                                            autoFocus
                                        />
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="relative">
                                                <Phone size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                                                <input 
                                                    placeholder="Teléfono (Opc.)" 
                                                    value={partnerPhone} 
                                                    onChange={e => setPartnerPhone(e.target.value)}
                                                    className="w-full pl-9 p-3 border rounded-lg text-sm outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                            <div className="relative">
                                                <AtSign size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                                                <input 
                                                    placeholder="Email (Opc.)" 
                                                    value={partnerEmail} 
                                                    onChange={e => setPartnerEmail(e.target.value)}
                                                    className="w-full pl-9 p-3 border rounded-lg text-sm outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                        </div>

                                        {/* CATEGORY SELECTOR REPLACING SLIDER */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoría Base</label>
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
                                    </div>
                                )}

                                {/* OPTION C: SOLO */}
                                <button 
                                    onClick={() => setPartnerType('solo')}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${partnerType === 'solo' ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-full shadow-sm"><User size={20} className="text-amber-500"/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Voy Solo</div>
                                            <div className="text-xs text-slate-500">Busco pareja</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: CONFIRM */}
                    {step === 4 && (
                        <div className="text-center space-y-6 animate-fade-in pt-4">
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
                                    <div className="text-xs text-slate-500 mt-1">{myCategories.join(', ')}</div>
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
                        </div>
                    )}

                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button onClick={() => setStep(prev => prev - 1)} className="px-6 py-4 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                                Atrás
                            </button>
                        )}
                        <button 
                            onClick={step === 4 ? handleFinish : handleNext}
                            style={{ backgroundColor: THEME.cta }} 
                            className="flex-1 py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                        >
                            {step === 4 ? <>Confirmar Inscripción <Check size={20}/></> : <>Siguiente <ArrowRight size={20}/></>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinTournament;