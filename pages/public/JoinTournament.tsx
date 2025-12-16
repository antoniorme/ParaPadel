
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTournament, TOURNAMENT_CATEGORIES } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { THEME } from '../../utils/theme';
import { User, Check, Trophy, Search, ArrowRight, UserPlus, AlertTriangle, X, Calendar, Phone, AtSign, MapPin, ExternalLink, ArrowRightCircle, ArrowLeftCircle, Repeat, Shuffle, Lock, Eye, EyeOff, Link as LinkIcon, Share2, Copy } from 'lucide-react';
import { calculateInitialElo } from '../../utils/Elo';
import { supabase } from '../../lib/supabase';

const JoinTournament: React.FC = () => {
    const { clubId } = useParams<{ clubId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { addPlayerToDB, createPairInDB, updatePairDB, state, loadData, formatPlayerName } = useTournament();
    const { globalTournaments } = useHistory();

    const [step, setStep] = useState(1);
    const [alertMessage, setAlertMessage] = useState<{type: 'error'|'success', message: string} | null>(null);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    
    // PUBLIC DATA STATE
    const [realClubName, setRealClubName] = useState('Club de Padel');
    const [activeTournamentInfo, setActiveTournamentInfo] = useState<any>(null);
    
    // INCOMING INVITE STATE
    const inviteCode = searchParams.get('partnerCode');
    const [invitationData, setInvitationData] = useState<{ pairId: string, p1Name: string } | null>(null);

    // --- STEP 1: IDENTITY ---
    const [isGuest, setIsGuest] = useState(true); 
    
    // --- STEP 2: MY DATA ---
    const [myName, setMyName] = useState('');
    const [myNickname, setMyNickname] = useState('');
    const [myPhone, setMyPhone] = useState('');
    const [myEmail, setMyEmail] = useState(''); // NEW: Email field
    const [myCategories, setMyCategories] = useState<string[]>([]);
    const [myPosition, setMyPosition] = useState<'right' | 'backhand' | undefined>(undefined);
    const [myPlayBoth, setMyPlayBoth] = useState(false);

    // --- NEW: ACCOUNT CREATION ---
    const [createAccount, setCreateAccount] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // --- STEP 3: PARTNER ---
    const [partnerType, setPartnerType] = useState<'search' | 'new' | 'solo' | 'link' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    
    // New Partner Data
    const [partnerName, setPartnerName] = useState('');
    const [partnerPhone, setPartnerPhone] = useState('');
    const [partnerEmail, setPartnerEmail] = useState('');
    const [partnerCategories, setPartnerCategories] = useState<string[]>([]);
    const [partnerPosition, setPartnerPosition] = useState<'right' | 'backhand' | undefined>(undefined);
    const [partnerPlayBoth, setPartnerPlayBoth] = useState(false);

    // Computed Info (Fallback to Mock/Context if DB fetch hasn't finished or failed)
    const tournamentInfo = activeTournamentInfo || globalTournaments.find(t => t.clubId === clubId) || {
        name: 'Torneo del Club',
        clubName: realClubName,
        date: new Date().toISOString(),
        clubLogo: '🎾',
        address: '',
        mapsUrl: ''
    };

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return 'Fecha por determinar';
        }
    };

    // Initial Load & Auth Check & Invite Check
    useEffect(() => {
        const init = async () => {
            await loadData();
            
            if (clubId) {
                // 1. OFFLINE / LOCAL STORAGE FALLBACK
                // If we are testing on the same device or offline mode, try to get data from local storage
                try {
                    const localClubStr = localStorage.getItem('padelpro_club_v1');
                    if (localClubStr) {
                        const localClub = JSON.parse(localClubStr);
                        if (localClub.name) setRealClubName(localClub.name);
                        
                        // If we found local club data, try to find local active tournament
                        const localTourneyStr = localStorage.getItem('padelpro_local_db_v3');
                        if (localTourneyStr) {
                            const localTourney = JSON.parse(localTourneyStr);
                            if (localTourney.status !== 'finished' && localTourney.title) {
                                setActiveTournamentInfo({
                                    name: localTourney.title,
                                    date: localTourney.startDate || new Date().toISOString(),
                                    clubName: localClub.name,
                                    clubLogo: '🎾',
                                    address: localClub.address || '',
                                    mapsUrl: localClub.mapsUrl || ''
                                });
                            }
                        }
                    }
                } catch(e) {
                    console.warn("Local storage read failed", e);
                }

                // 2. SUPABASE FETCH (Online)
                try {
                    // Fetch Club & Tournament Info
                    const { data: clubData } = await supabase.from('clubs').select('name, address, maps_url').eq('owner_id', clubId).single();
                    if (clubData) setRealClubName(clubData.name);

                    const { data: tData } = await supabase.from('tournaments').select('title, date, price').eq('user_id', clubId).neq('status', 'finished').order('created_at', { ascending: false }).limit(1).maybeSingle();
                    if (tData) {
                        setActiveTournamentInfo({
                            name: tData.title, date: tData.date, clubName: clubData?.name || 'Club de Padel',
                            clubLogo: '🎾', address: clubData?.address || '', mapsUrl: (clubData as any)?.maps_url || ''
                        });
                    }

                    // CHECK INCOMING INVITE
                    if (inviteCode) {
                        const { data: pairData } = await supabase.from('tournament_pairs').select('id, player1_id').eq('id', inviteCode).single();
                        if (pairData) {
                            const { data: p1Data } = await supabase.from('players').select('name').eq('id', pairData.player1_id).single();
                            if (p1Data) {
                                setInvitationData({ pairId: pairData.id, p1Name: p1Data.name });
                                setPartnerType('link'); // Set logic to link mode
                            }
                        }
                    }

                } catch (error) {
                    console.warn("Error fetching public data from Supabase", error);
                }
            }
        };
        init();
    }, [loadData, clubId, inviteCode]);

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
        if (step === 2) {
            if (!myName) {
                setAlertMessage({ type: 'error', message: "Por favor, introduce tu nombre." });
                return;
            }
            if (createAccount) {
                if (!myEmail) {
                    setAlertMessage({ type: 'error', message: "El email es obligatorio para crear una cuenta." });
                    return;
                }
                if (password.length < 6) {
                    setAlertMessage({ type: 'error', message: "La contraseña debe tener al menos 6 caracteres." });
                    return;
                }
                if (password !== confirmPassword) {
                    setAlertMessage({ type: 'error', message: "Las contraseñas no coinciden." });
                    return;
                }
            }
        }
        if (step === 3 && !partnerType && !invitationData) {
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

    const copyToClipboard = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            setAlertMessage({ type: 'success', message: "Enlace copiado al portapapeles" });
        }
    };

    const handleFinish = async () => {
        if (!clubId) {
            setAlertMessage({ type: 'error', message: "Error crítico: ID de Club no encontrado." });
            return;
        }

        let myId = localStorage.getItem('padel_sim_player_id');
        let newAuthUserId = null;

        // 0. Create Supabase Auth User if requested
        if (createAccount && !myId) {
            try {
                const { data, error } = await supabase.auth.signUp({ email: myEmail, password: password });
                if (error) throw error;
                if (data.user) newAuthUserId = data.user.id;
            } catch (e: any) {
                setAlertMessage({ type: 'error', message: "Error al crear cuenta: " + e.message });
                return;
            }
        }

        // 1. Create Myself if not exists
        if (!myId) {
            const myElo = calculateInitialElo(myCategories, 5); 
            myId = await addPlayerToDB({
                name: myName + (createAccount ? '' : ' (App)'),
                nickname: myNickname || myName,
                phone: myPhone,
                email: myEmail,
                categories: myCategories,
                preferred_position: myPosition,
                play_both_sides: myPlayBoth,
                global_rating: myElo,
                profile_user_id: newAuthUserId || undefined
            }, clubId);
            
            if (myId) localStorage.setItem('padel_sim_player_id', myId);
        }

        if (!myId) {
            setAlertMessage({ type: 'error', message: "Error al procesar tu usuario. Inténtalo de nuevo." });
            return;
        }

        // 2. Handle Partner Logic
        let p2Id: string | null = null;
        let finalPairId: string | null = null;

        // SCENARIO A: JOINING EXISTING PAIR (INVITE LINK)
        if (invitationData) {
            // Update existing pair
            // Logic: updatePairDB(pairId, p1, p2). 
            const { data: currentPair } = await supabase.from('tournament_pairs').select('player1_id').eq('id', invitationData.pairId).single();
            if (currentPair) {
                await updatePairDB(invitationData.pairId, currentPair.player1_id, myId);
                setAlertMessage({ type: 'success', message: "¡Te has unido a la pareja correctamente!" });
            }
            return;
        }

        // SCENARIO B: CREATING NEW PARTNER (SMART LINKING)
        if (partnerType === 'search') {
            p2Id = selectedPartnerId;
        } else if (partnerType === 'new') {
            // Check if player exists by Email or Phone to avoid duplicates
            if (partnerEmail || partnerPhone) {
                const { data: existingPlayers } = await supabase
                    .from('players')
                    .select('id')
                    .or(`email.eq.${partnerEmail},phone.eq.${partnerPhone}`)
                    .eq('user_id', clubId) // Ensure matches club
                    .limit(1);
                
                if (existingPlayers && existingPlayers.length > 0) {
                    p2Id = existingPlayers[0].id; // Use existing ID
                }
            }

            // If not found, create new
            if (!p2Id) {
                const pElo = calculateInitialElo([...partnerCategories, 'Invitado'], 5);
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
            }
        } else if (partnerType === 'solo') {
            p2Id = null;
        } else if (partnerType === 'link') {
            p2Id = null; // We create a pair with just me, waiting for P2
        }

        // 3. Create Pair
        finalPairId = await createPairInDB(myId, p2Id, 'confirmed'); 

        if (partnerType === 'link' && finalPairId) {
            const link = `${window.location.origin}/#/join/${clubId}?partnerCode=${finalPairId}`;
            setGeneratedLink(link);
            setAlertMessage({ type: 'success', message: "Reserva creada. ¡Comparte el enlace!" });
        } else {
            setAlertMessage({ type: 'success', message: createAccount ? "¡Cuenta creada e inscripción realizada!" : "¡Inscripción realizada con éxito!" });
        }
    };

    const closeAlert = () => {
        if (alertMessage?.type === 'success' && !generatedLink) {
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

                            {/* EMAIL FIELD */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                                <div className="relative mt-1">
                                    <AtSign size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                                    <input value={myEmail} onChange={e => setMyEmail(e.target.value)} className="w-full pl-9 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#575AF9]" placeholder="usuario@email.com"/>
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

                            {/* CREATE ACCOUNT TOGGLE */}
                            <div className="pt-2 border-t border-slate-100">
                                <div 
                                    onClick={() => setCreateAccount(!createAccount)}
                                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${createAccount ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${createAccount ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                        {createAccount && <Check size={14} className="text-white"/>}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${createAccount ? 'text-indigo-800' : 'text-slate-700'}`}>Crear cuenta para próximas veces</div>
                                        <div className="text-xs text-slate-500">Guarda tu historial y nivel.</div>
                                    </div>
                                </div>

                                {createAccount && (
                                    <div className="space-y-3 mt-4 animate-slide-up pl-2 border-l-2 border-indigo-100 ml-4">
                                        {/* EMAIL FIELD - MOVED HERE */}
                                        <div>
                                            <label className="text-xs font-bold text-indigo-800 uppercase">Email</label>
                                            <div className="relative mt-1">
                                                <AtSign size={16} className="absolute left-3 top-3.5 text-indigo-300"/>
                                                <input 
                                                    type="email" 
                                                    value={myEmail} 
                                                    onChange={e => setMyEmail(e.target.value)} 
                                                    className="w-full pl-9 p-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#575AF9]" 
                                                    placeholder="usuario@email.com"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-indigo-800 uppercase">Contraseña</label>
                                            <div className="relative mt-1">
                                                <Lock size={16} className="absolute left-3 top-3.5 text-indigo-300"/>
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    value={password} 
                                                    onChange={e => setPassword(e.target.value)} 
                                                    className="w-full pl-9 pr-10 p-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#575AF9]" 
                                                    placeholder="Mínimo 6 caracteres"
                                                />
                                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-indigo-300 hover:text-indigo-500">
                                                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-indigo-800 uppercase">Confirmar Contraseña</label>
                                            <div className="relative mt-1">
                                                <Lock size={16} className="absolute left-3 top-3.5 text-indigo-300"/>
                                                <input 
                                                    type="password"
                                                    value={confirmPassword} 
                                                    onChange={e => setConfirmPassword(e.target.value)} 
                                                    className="w-full pl-9 p-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#575AF9]" 
                                                    placeholder="Repite la contraseña"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                            
                            {invitationData ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center animate-fade-in">
                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <LinkIcon size={32}/>
                                    </div>
                                    <h3 className="text-lg font-bold text-emerald-900">¡Invitación Detectada!</h3>
                                    <p className="text-sm text-emerald-700 mt-2">
                                        Te unirás a la pareja de:
                                    </p>
                                    <div className="text-xl font-black text-emerald-800 mt-1">
                                        {invitationData.p1Name}
                                    </div>
                                    <button 
                                        onClick={handleNext}
                                        className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700"
                                    >
                                        Confirmar y Unirse
                                    </button>
                                </div>
                            ) : (
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
                                                <div className="bg-emerald-100 p-2 rounded text-[10px] text-emerald-800 flex gap-2 items-center">
                                                    <Search size={12}/> Si el email/teléfono ya existe, se vinculará automáticamente.
                                                </div>
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

                                                {/* CATEGORY SELECTOR */}
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
                                                    Confirmar Amigo
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* OPTION C: SEND LINK */}
                                    <button 
                                        onClick={() => { setPartnerType('link'); handleNext(); }}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${partnerType === 'link' ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-full shadow-sm"><LinkIcon size={20} className="text-purple-500"/></div>
                                            <div>
                                                <div className="font-bold text-slate-800">Mandar Enlace</div>
                                                <div className="text-xs text-slate-500">Enviar por Whatsapp</div>
                                            </div>
                                            <div className="ml-auto">
                                                <Share2 size={20} className="text-slate-300"/>
                                            </div>
                                        </div>
                                    </button>

                                    {/* OPTION D: SOLO */}
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
                            )}

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
                                        {createAccount && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full uppercase">Cuenta</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap">
                                        <span>{myCategories.join(', ')}</span>
                                        {myPosition && <span className="bg-slate-200 px-1.5 rounded text-[10px] uppercase font-bold text-slate-600">{myPosition === 'right' ? 'Derecha' : 'Revés'}</span>}
                                        {myEmail && <span className="text-slate-400 truncate w-full mt-1">{myEmail}</span>}
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Jugador 2</div>
                                    {invitationData ? (
                                        <div className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                                            {invitationData.p1Name} <span className="bg-emerald-100 px-2 rounded text-[10px] uppercase">Host</span>
                                        </div>
                                    ) : (
                                        <div className="text-lg font-bold text-slate-900">
                                            {partnerType === 'solo' ? <span className="text-amber-500 italic">Buscando Pareja...</span> : 
                                             partnerType === 'link' ? <span className="text-purple-500 italic">Se unirá por Enlace...</span> :
                                             partnerType === 'search' ? (state.players.find(p => p.id === selectedPartnerId)?.name) : 
                                             partnerName}
                                        </div>
                                    )}
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
                            
                            {partnerType === 'link' && (
                                <div className="bg-purple-50 p-3 rounded-xl text-xs text-purple-800 flex items-start gap-2 text-left border border-purple-100">
                                    <Share2 size={16} className="shrink-0 mt-0.5"/>
                                    <span>Al confirmar, recibirás un enlace para compartir con tu compañero por WhatsApp.</span>
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
                        
                        {/* SHOW LINK IF GENERATED */}
                        {generatedLink && (
                            <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                                <p className="text-xs text-slate-500 font-bold uppercase text-left">Enlace para tu compañero:</p>
                                <div className="flex items-center gap-2">
                                    <input readOnly value={generatedLink} className="flex-1 text-xs p-2 bg-white border rounded text-slate-600 truncate"/>
                                    <button onClick={copyToClipboard} className="p-2 bg-slate-200 hover:bg-slate-300 rounded"><Copy size={16}/></button>
                                </div>
                            </div>
                        )}

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
