
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLeague } from '../store/LeagueContext';
import { useTournament } from '../store/TournamentContext';
import { PlayerSelector } from '../components/PlayerSelector';
import {
    Users, Plus, ArrowLeft, Save,
    Trash2, TrendingUp, Shuffle, ListOrdered,
    LayoutGrid, ChevronRight, CheckCircle, X, Repeat
} from 'lucide-react';
import { Modal, EmptyState, useToast } from '../components';

const LeagueGroups: React.FC = () => {
    const navigate = useNavigate();
    const { categoryId } = useParams();
    const { league, addPairToLeague, generateLeagueGroups } = useLeague();
    const { state, addPlayerToDB, formatPlayerName } = useTournament();

    const currentCategory = league.categories.find(c => c.id === categoryId);
    
    // UI State
    const [isAddingPair, setIsAddingPair] = useState(false);
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    
    // Configuration State
    const [doubleRound, setDoubleRound] = useState(false);
    const [generateConfirm, setGenerateConfirm] = useState<{ method: 'elo-balanced' | 'elo-mixed'; groupsCount: number; typeText: string } | null>(null);
    const { error: showError } = useToast();

    const pairsInCategory = league.pairs.filter(p => p.category_id === categoryId);

    const handleAddPair = async () => {
        if (!p1 || !p2) return;
        await addPairToLeague({
            player1Id: p1,
            player2Id: p2,
            category_id: categoryId,
            name: 'Pareja Liga'
        });
        setP1('');
        setP2('');
        setIsAddingPair(false);
    };

    const handleGenerate = (method: 'elo-balanced' | 'elo-mixed') => {
        if (pairsInCategory.length < 4) return showError("Mínimo 4 parejas para generar grupos");
        const groupsCount = pairsInCategory.length >= 12 ? 2 : 1;
        const typeText = doubleRound ? "Ida y Vuelta" : "Una Vuelta";
        setGenerateConfirm({ method, groupsCount, typeText });
    };

    const handleConfirmGenerate = async () => {
        if (!generateConfirm) return;
        await generateLeagueGroups(categoryId!, generateConfirm.groupsCount, generateConfirm.method, doubleRound);
        setGenerateConfirm(null);
        navigate('/league/active');
    };

    return (
        <div className="space-y-8 pb-32 animate-fade-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/league/active')} className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-white">{currentCategory?.name}</h2>
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Gestión de Parejas e Inscripciones</p>
                </div>
            </div>

            {/* Resumen Inscritos */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-indigo-100 text-center">
                    <div className="text-3xl font-black text-indigo-500">{pairsInCategory.length}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Inscritos</div>
                </div>
                <button 
                    onClick={() => setIsAddingPair(true)}
                    className="bg-indigo-500 rounded-[2rem] p-6 shadow-lg border border-indigo-400 text-center text-white active:scale-95 transition-transform group"
                >
                    <div className="flex justify-center mb-1 group-hover:scale-110 transition-transform"><Plus size={32} strokeWidth={3}/></div>
                    <div className="text-[10px] font-black uppercase tracking-widest">Añadir Pareja</div>
                </button>
            </div>

            {/* Listado de Parejas */}
            <div className="space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-widest px-2">Lista de Inscritos</h3>
                {pairsInCategory.length === 0 ? (
                    <EmptyState
                        icon={<Users size={32}/>}
                        title="No hay parejas en esta categoría"
                        dark
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {pairsInCategory.map((pair, idx) => {
                            const player1 = state.players.find(p => p.id === pair.player1Id);
                            const player2 = state.players.find(p => p.id === pair.player2Id);
                            return (
                                <div key={pair.id} className="bg-white p-5 rounded-[1.5rem] shadow-md border border-indigo-50 flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center font-black text-xs">{idx + 1}</div>
                                        <div>
                                            <div className="font-bold text-slate-800">{formatPlayerName(player1)}</div>
                                            <div className="font-bold text-slate-800">& {formatPlayerName(player2)}</div>
                                        </div>
                                    </div>
                                    <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Motor de Sorteo */}
            {pairsInCategory.length >= 4 && (
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-indigo-200 animate-slide-up">
                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <LayoutGrid className="text-indigo-500" size={24}/> Generar Calendario
                    </h3>
                    
                    {/* Format Toggle */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 flex items-center justify-between">
                        <div>
                            <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Formato de Liga</div>
                            <div className="font-bold text-indigo-900">{doubleRound ? 'Ida y Vuelta (Doble)' : 'Una sola Vuelta (Ida)'}</div>
                        </div>
                        <button 
                            onClick={() => setDoubleRound(!doubleRound)}
                            className={`p-3 rounded-xl transition-all ${doubleRound ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}
                        >
                            <Repeat size={20}/>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={() => handleGenerate('elo-balanced')}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border-2 border-transparent hover:border-indigo-200 transition-all text-left"
                        >
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-indigo-500"/>
                                <div className="font-black text-slate-800">Sorteo por ELO Equilibrado</div>
                            </div>
                            <ChevronRight size={20} className="text-slate-300"/>
                        </button>
                        <button 
                            onClick={() => handleGenerate('elo-mixed')}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border-2 border-transparent hover:border-indigo-200 transition-all text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Shuffle className="text-indigo-500"/>
                                <div className="font-black text-slate-800">Sorteo Mix (Cremallera)</div>
                            </div>
                            <ChevronRight size={20} className="text-slate-300"/>
                        </button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isAddingPair}
                onClose={() => setIsAddingPair(false)}
                title="Inscribir Pareja"
                icon={<Users size={28}/>}
                iconColor="brand"
                size="md"
                actions={[
                    { label: 'Cancelar', onClick: () => setIsAddingPair(false), variant: 'secondary' },
                    { label: 'Confirmar Inscripción', onClick: handleAddPair, variant: 'primary' },
                ]}
            >
                <PlayerSelector label="CAPITÁN (Jugador 1)" selectedId={p1} onSelect={setP1} otherSelectedId={p2} players={state.players} onAddPlayer={addPlayerToDB} formatName={formatPlayerName}/>
                <div className="flex justify-center my-2"><span className="bg-slate-100 text-slate-400 text-xs px-2 py-1 rounded-full font-bold border border-slate-200">&</span></div>
                <PlayerSelector label="JUGADOR 2" selectedId={p2} onSelect={setP2} otherSelectedId={p1} players={state.players} onAddPlayer={addPlayerToDB} formatName={formatPlayerName}/>
            </Modal>

            <Modal
                isOpen={!!generateConfirm}
                onClose={() => setGenerateConfirm(null)}
                title="Generar Grupos"
                body={generateConfirm ? `Se van a generar ${generateConfirm.groupsCount} grupos con formato ${generateConfirm.typeText}. ¿Continuar?` : ''}
                icon={<LayoutGrid size={24} />}
                iconColor="brand"
                actions={[
                    { label: 'Cancelar', onClick: () => setGenerateConfirm(null), variant: 'secondary' },
                    { label: 'Generar', onClick: handleConfirmGenerate, variant: 'primary' },
                ]}
            />
        </div>
    );
};

export default LeagueGroups;
