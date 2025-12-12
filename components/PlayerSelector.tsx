
import React, { useState } from 'react';
import { Player } from '../types';
import { TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { User, X, Search, Plus, Phone, Check, Database, ArrowRightCircle, ArrowLeftCircle, Shuffle } from 'lucide-react';

interface PlayerSelectorProps {
    label: string;
    selectedId: string;
    onSelect: (id: string) => void;
    otherSelectedId: string;
    players: Player[];
    onAddPlayer: (p: Partial<Player>) => Promise<string | null>;
    formatName: (p?: Player) => string;
}

export const PlayerSelector: React.FC<PlayerSelectorProps> = ({ label, selectedId, onSelect, otherSelectedId, players, onAddPlayer, formatName }) => {
    const [tab, setTab] = useState<'search' | 'new'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Form State
    const [newPlayer, setNewPlayer] = useState({ 
        name: '', 
        nickname: '', 
        phone: '', 
        categories: [] as string[], 
        preferred_position: undefined as 'right' | 'backhand' | undefined,
        play_both_sides: false,
        saveRecord: true, 
        manual_rating: 5 
    });
    
    const selectedPlayer = players.find(p => p.id === selectedId);
    
    const filteredPlayers = players.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (p.nickname && p.nickname.toLowerCase().includes(searchQuery.toLowerCase()));
        const notOtherSlot = p.id !== otherSelectedId;
        return matchesSearch && notOtherSlot;
    });

    const handleCreatePlayer = async () => {
        if(!newPlayer.name) return;
        
        const newId = await onAddPlayer({
            name: newPlayer.name,
            nickname: newPlayer.nickname,
            phone: newPlayer.phone,
            categories: newPlayer.categories,
            preferred_position: newPlayer.preferred_position,
            play_both_sides: newPlayer.play_both_sides,
            manual_rating: newPlayer.manual_rating,
        });

        if(newId) { 
            onSelect(newId); 
            setNewPlayer({ name: '', nickname: '', phone: '', categories: [], preferred_position: undefined, play_both_sides: false, saveRecord: true, manual_rating: 5 }); 
            setTab('search'); 
        }
    };

    const toggleNewCat = (cat: string) => { 
        setNewPlayer(prev => { 
            const exists = prev.categories.includes(cat); 
            return { ...prev, categories: exists ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat] }; 
        }); 
    };

    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 shadow-sm">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{label}</label>
            {selectedId ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-indigo-200 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div style={{ color: THEME.cta }} className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center border border-indigo-200"><User size={16} /></div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">{formatName(selectedPlayer)}</div>
                            {selectedPlayer?.preferred_position && (
                                <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                                    {selectedPlayer.preferred_position === 'right' ? 'Derecha' : 'Revés'}
                                    {selectedPlayer.play_both_sides && <Shuffle size={10} className="text-emerald-500"/>}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={() => onSelect('')} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
                </div>
            ) : (
                <>
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 mb-3 shadow-sm">
                        <button onClick={() => setTab('search')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${tab === 'search' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Search size={14}/> Buscar</button>
                        <button onClick={() => setTab('new')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${tab === 'new' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Plus size={14}/> Nuevo</button>
                    </div>
                    {tab === 'search' ? (
                        <div className="animate-fade-in">
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Escribe para buscar..." className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg mb-2 focus:border-[#575AF9] outline-none text-slate-800 placeholder:text-slate-400 shadow-inner" />
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                {filteredPlayers.slice(0, 50).map(p => (
                                    <button key={p.id} onClick={() => onSelect(p.id)} className="w-full text-left p-2 hover:bg-blue-50 rounded flex items-center justify-between text-sm text-slate-700 border border-transparent hover:border-blue-100 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{formatName(p)}</span>
                                            {p.preferred_position && (
                                                <span className="text-[9px] text-slate-400 uppercase flex items-center gap-1">
                                                    {p.preferred_position === 'right' ? 'Derecha' : 'Revés'}
                                                    {p.play_both_sides && <Shuffle size={8} className="text-emerald-500"/>}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">{p.categories?.[0] && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.categories[0]}</span>}</div>
                                    </button>
                                ))}
                                {filteredPlayers.length === 0 && <p className="text-xs text-center text-slate-400 py-4 italic">No hay jugadores disponibles.</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 animate-fade-in">
                            <input placeholder="Nombre completo" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-[#575AF9] text-slate-800 placeholder:text-slate-400" />
                            
                            <div className="grid grid-cols-2 gap-2">
                                <input placeholder="Apodo" value={newPlayer.nickname} onChange={e => setNewPlayer({...newPlayer, nickname: e.target.value})} className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-[#575AF9] text-slate-800 placeholder:text-slate-400" />
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                                    <input placeholder="Teléfono" value={newPlayer.phone} onChange={e => setNewPlayer({...newPlayer, phone: e.target.value})} className="w-full pl-9 p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-[#575AF9] text-slate-800 placeholder:text-slate-400" />
                                </div>
                            </div>

                            {/* Position Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Posición Predilecta</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setNewPlayer({...newPlayer, preferred_position: 'right'})}
                                        className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all border ${newPlayer.preferred_position === 'right' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <ArrowRightCircle size={14}/> Derecha
                                    </button>
                                    <button 
                                        onClick={() => setNewPlayer({...newPlayer, preferred_position: 'backhand'})}
                                        className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all border ${newPlayer.preferred_position === 'backhand' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <ArrowLeftCircle size={14}/> Revés
                                    </button>
                                </div>
                                <div 
                                    onClick={() => setNewPlayer({...newPlayer, play_both_sides: !newPlayer.play_both_sides})}
                                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${newPlayer.play_both_sides ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${newPlayer.play_both_sides ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                        {newPlayer.play_both_sides && <Check size={10} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs font-bold ${newPlayer.play_both_sides ? 'text-emerald-700' : 'text-slate-500'}`}>Se adapta al otro lado (Versátil)</span>
                                </div>
                            </div>
                            
                            <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nivel (ELO Manual)</label>
                                  <span style={{ color: THEME.cta }} className="text-sm font-black">{newPlayer.manual_rating}</span>
                                </div>
                                <input 
                                  type="range" min="1" max="10" step="0.5" 
                                  value={newPlayer.manual_rating} 
                                  onChange={e => setNewPlayer({...newPlayer, manual_rating: parseFloat(e.target.value)})}
                                  className="w-full accent-[#575AF9] h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5">{TOURNAMENT_CATEGORIES.map(c => (<button key={c} onClick={() => toggleNewCat(c)} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md border transition-all ${newPlayer.categories.includes(c) ? 'bg-[#575AF9] text-white border-[#575AF9] shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}>{c}</button>))}</div>
                            
                            <div 
                                onClick={() => setNewPlayer({...newPlayer, saveRecord: !newPlayer.saveRecord})}
                                className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg"
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newPlayer.saveRecord ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-slate-300'}`}>
                                    {newPlayer.saveRecord && <Check size={14} className="text-white"/>}
                                </div>
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><Database size={12}/> Guardar en base de datos</span>
                            </div>

                            <button onClick={handleCreatePlayer} style={{ backgroundColor: THEME.cta }} className="w-full py-3 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2 hover:opacity-90"><Check size={16}/> Crear y Usar Jugador</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
