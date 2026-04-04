import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Play, RefreshCw, AlertTriangle, Users, Calendar, Trophy, Plus, Trash2, X, Check } from 'lucide-react';
import { useHistory } from '../../store/HistoryContext';
import { useTournament } from '../../store/TournamentContext';
import { TournamentFormat } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';

interface ParsedPair {
    id: string;
    player1: string;
    player2: string;
    originalText: string;
}

interface ParsedTournament {
    title: string;
    date: string;
    level: string;
    price: string;
    pairs: ParsedPair[];
    reserves: string[];
    prizes: string[];
    format: TournamentFormat;
}

const LiteSetup: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { createNewTournament, selectTournament, addPlayerToDB, createPairInDB } = useTournament();
    const { isOfflineMode } = useAuth();
    
    const [whatsappText, setWhatsappText] = useState('');
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [parsedData, setParsedData] = useState<ParsedTournament | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const parseWhatsAppText = () => {
        try {
            const lines = whatsappText.split('\n').map(l => l.trim()).filter(l => l);
            
            let title = "Mini Torneo Lite";
            let date = new Date().toLocaleDateString();
            let level = "Nivel General";
            let price = "0€";
            const pairs: ParsedPair[] = [];
            const reserves: string[] = [];
            const prizes: string[] = [];
            
            let isReservesSection = false;
            let isListSection = false;
            let isPrizesSection = false;

            lines.forEach(line => {
                const upperLine = line.toUpperCase();

                // Detect Title/Date (Usually first lines)
                if (upperLine.includes('MINI') || upperLine.includes('TORNEO')) {
                    title = line;
                }
                if (upperLine.includes('NIVEL')) level = line.split('//')[1]?.trim() || level;
                if (upperLine.includes('INSCRIPCION')) price = line.split('//')[1]?.trim() || price;

                // Detect Sections
                if (upperLine.includes('LISTA INSCRITOS') || upperLine.includes('INSCRITOS')) {
                    isListSection = true;
                    isReservesSection = false;
                    isPrizesSection = false;
                }
                else if (upperLine.includes('RESERVAS')) {
                    isReservesSection = true;
                    isListSection = false;
                    isPrizesSection = false;
                }
                else if (upperLine.includes('PREMIOS')) {
                    isPrizesSection = true;
                    isListSection = false;
                    isReservesSection = false;
                }

                // Parse Pairs
                // 1. Try to match standard list format "1. Name" or "1️⃣ Name"
                const pairMatch = line.match(/^(\d+[\.|️⃣]?|[\u0030-\u0039]\uFE0F?\u20E3|[\uD83C][\uDF00-\uDFFF])\s*(.+)/);
                const hasSeparator = line.match(/\s+(?:y|Y|&|e)\s+/);

                if (isListSection && !isReservesSection && !isPrizesSection) {
                    let rawNames = '';
                    
                    if (pairMatch) {
                        rawNames = pairMatch[2];
                    } else if (hasSeparator && line.length > 5) {
                        rawNames = line;
                    }

                    if (rawNames) {
                        // 1. Remove Keycap sequences globally (e.g. 1️⃣, 10️⃣)
                        // Matches digit/hash/star + optional VS16 + Keycap
                        rawNames = rawNames.replace(/[\d#\*]\uFE0F?\u20E3/g, '');

                        // 2. Remove standard emojis globally (Surrogate pairs)
                        rawNames = rawNames.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])+/g, '');

                        // 3. Remove other symbols and dingbats globally
                        rawNames = rawNames.replace(/[\u2600-\u27BF\u2B00-\u2BFF\u2000-\u206F\uFE0F]+/g, '');

                        // 4. Aggressive cleaning of leading garbage
                        // Removes digits, dots, dashes, parentheses, spaces, etc. at the start
                        // Keeps only letters (including accents) and numbers that are part of the name
                        rawNames = rawNames.replace(/^[^a-zA-Z\u00C0-\u00FF]+/, '');
                        
                        // Split by " y ", " Y ", " & ", " Y ", " / ", " - ", " e "
                        const splitNames = rawNames.split(/\s+(?:y|Y|&|e|\/|-)\s+/);
                        
                        if (splitNames.length >= 2 || rawNames.length > 5) {
                             pairs.push({
                                id: `pair-${pairs.length + 1}`,
                                player1: splitNames[0]?.trim() || 'Jugador 1',
                                player2: splitNames[1]?.trim() || 'Jugador 2',
                                originalText: rawNames
                            });
                        }
                    }
                }

                // Parse Reserves
                if (isReservesSection && !upperLine.includes('RESERVAS')) {
                    if (line.length > 2 && !line.match(/^[\uD800-\uDBFF][\uDC00-\uDFFF]$/)) {
                        reserves.push(line);
                    }
                }

                // Parse Prizes
                if (isPrizesSection && !upperLine.includes('PREMIOS')) {
                    if (line.length > 2) {
                        prizes.push(line);
                    }
                }
            });

            // Determine format based on pair count
            let format: TournamentFormat = '16_mini';
            if (pairs.length <= 8) format = '8_mini';
            else if (pairs.length <= 10) format = '10_mini';
            else if (pairs.length <= 12) format = '12_mini';
            else format = '16_mini';

            setParsedData({ title, date, level, price, pairs, reserves, prizes, format });
            setStep('review');
            setError(null);

        } catch (e) {
            setError("Error al procesar el texto. Intenta ajustarlo manualmente.");
        }
    };

    const handleUpdatePair = (id: string, field: 'player1' | 'player2', value: string) => {
        if (!parsedData) return;
        const newPairs = parsedData.pairs.map(p => p.id === id ? { ...p, [field]: value } : p);
        setParsedData({ ...parsedData, pairs: newPairs });
    };

    const handleAddPair = () => {
        if (!parsedData) return;
        const newPair: ParsedPair = {
            id: `pair-manual-${Date.now()}`,
            player1: '',
            player2: '',
            originalText: 'Manual Entry'
        };
        setParsedData({ ...parsedData, pairs: [...parsedData.pairs, newPair] });
    };

    const handleDeletePair = (id: string) => {
        if (!parsedData) return;
        setParsedData({ ...parsedData, pairs: parsedData.pairs.filter(p => p.id !== id) });
    };

    const handleFormatChange = (format: TournamentFormat) => {
        if (!parsedData) return;
        setParsedData({ ...parsedData, format });
    };

    const handleStartTournament = async () => {
        if (!parsedData || isCreating) return;
        setIsCreating(true);

        try {
            // 1. Create Tournament
            let currentUserId = user?.id;
            if (!currentUserId && !isOfflineMode) {
                const { data } = await supabase.auth.getUser();
                currentUserId = data.user?.id;
            }
            
            if (!currentUserId && !isOfflineMode) throw new Error("No se encontró usuario autenticado. Por favor, inicia sesión.");
            if (isOfflineMode && !currentUserId) currentUserId = 'offline-user';

            const tournamentId = await createNewTournament({
                title: parsedData.title,
                startDate: new Date().toISOString(),
                price: parseFloat(parsedData.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
                format: parsedData.format,
                levelRange: parsedData.level,
                description: `Importado desde WhatsApp.\n\nReservas:\n${parsedData.reserves.join('\n')}`,
                includedItems: ['Bolas Nuevas', 'Agua'],
                prizes: parsedData.prizes
            }, currentUserId);

            if (!tournamentId) throw new Error("No se pudo crear el torneo (ID nulo).");

            // 2. Create Players and Pairs using Context Methods (works for both Online and Offline)
            for (const pair of parsedData.pairs) {
                // Create Player 1
                const p1Id = await addPlayerToDB({ name: pair.player1 }, currentUserId);
                if (!p1Id) {
                    continue;
                }

                // Create Player 2
                const p2Id = await addPlayerToDB({ name: pair.player2 }, currentUserId);
                if (!p2Id) {
                    continue;
                }

                // Create Pair
                await createPairInDB(p1Id, p2Id, 'confirmed', tournamentId);
            }

            // 3. Select the tournament to refresh context
            // In offline mode, createNewTournament already selects it, but good to be sure
            if (!isOfflineMode) await selectTournament(tournamentId);

            // 4. Navigate to Tournament Manager
            navigate('/tournament/manage');

        } catch (e: any) {
            setCreateError(`Hubo un error al crear el torneo: ${e.message || e}`);
            setIsCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {createError && (
                <div className="fixed top-4 right-4 z-[300] p-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-xl animate-fade-in border-l-4 max-w-sm bg-white border-rose-500 text-rose-700">
                    <AlertTriangle size={20} className="shrink-0"/>
                    <div className="flex-1">{createError}</div>
                    <button onClick={() => setCreateError(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={16}/></button>
                </div>
            )}
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <button onClick={() => step === 'review' ? setStep('input') : navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-black text-lg text-slate-800">Mini Express ⚡</h1>
                <div className="w-10"></div>
            </div>

            <div className="max-w-md mx-auto p-4">
                
                {step === 'input' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
                            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600 shrink-0">
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-emerald-800 text-sm mb-1">Importar desde WhatsApp</h3>
                                <p className="text-xs text-emerald-600 leading-relaxed">
                                    Copia el mensaje completo del grupo de WhatsApp y pégalo aquí. El sistema detectará automáticamente las parejas y el formato.
                                </p>
                            </div>
                        </div>

                        <div className="relative">
                            <textarea
                                value={whatsappText}
                                onChange={(e) => setWhatsappText(e.target.value)}
                                placeholder="Pega aquí el mensaje del torneo..."
                                className="w-full h-64 p-4 rounded-2xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none resize-none text-sm font-medium text-slate-700 placeholder:text-slate-400 transition-all"
                            />
                            {whatsappText && (
                                <button 
                                    onClick={() => setWhatsappText('')}
                                    className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-lg"
                                >
                                    BORRAR
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold flex items-center gap-2 animate-shake">
                                <AlertTriangle size={18} />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={parseWhatsAppText}
                            disabled={!whatsappText.trim()}
                            className="w-full py-4 bg-slate-900 text-white rounded-xl font-black shadow-xl hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={20} /> ANALIZAR TEXTO
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        {/* Summary Card */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="font-black text-xl text-slate-900 mb-1">{parsedData?.title}</h2>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1">
                                    <Calendar size={12}/> {parsedData?.date}
                                </span>
                                <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1">
                                    <Trophy size={12}/> {parsedData?.level}
                                </span>
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <Users size={12}/> {parsedData?.pairs.length} Parejas
                                </span>
                            </div>
                        </div>

                        {/* Format Selection */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                             <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-3">Formato del Torneo</h3>
                             <div className="grid grid-cols-2 gap-2">
                                {(['8_mini', '10_mini', '12_mini', '16_mini'] as TournamentFormat[]).map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => handleFormatChange(fmt)}
                                        className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${parsedData?.format === fmt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                                    >
                                        {fmt.replace('_mini', '')} Parejas
                                    </button>
                                ))}
                             </div>
                        </div>

                        {/* Pairs Editor */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider">Revisar Parejas ({parsedData?.pairs.length})</h3>
                                <button onClick={handleAddPair} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                                    <Plus size={14}/> Añadir
                                </button>
                            </div>
                            
                            {parsedData?.pairs.map((pair, idx) => (
                                <div key={pair.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 animate-scale-in">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 text-sm shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <input 
                                            value={pair.player1}
                                            onChange={(e) => handleUpdatePair(pair.id, 'player1', e.target.value)}
                                            placeholder="Jugador 1"
                                            className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 w-full"
                                        />
                                        <input 
                                            value={pair.player2}
                                            onChange={(e) => handleUpdatePair(pair.id, 'player2', e.target.value)}
                                            placeholder="Jugador 2"
                                            className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 w-full"
                                        />
                                    </div>
                                    <button onClick={() => handleDeletePair(pair.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Reserves */}
                        {parsedData?.reserves && parsedData.reserves.length > 0 && (
                            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-2">Reservas Detectados</h3>
                                <ul className="space-y-1">
                                    {parsedData.reserves.map((res, i) => (
                                        <li key={i} className="text-sm font-medium text-slate-600">• {res}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button
                            onClick={handleStartTournament}
                            className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black shadow-xl hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 sticky bottom-4"
                        >
                            <Play size={24} fill="currentColor" /> COMENZAR TORNEO
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiteSetup;
