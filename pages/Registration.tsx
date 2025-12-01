import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { Users, Trash2, Edit2, Plus, Search, Check, Save, User, X } from 'lucide-react';

type ViewMode = 'menu' | 'pair-form';

const Registration: React.FC = () => {
  // IMPORTANTE: Extraemos formatPlayerName del contexto global
  const { state, addPlayerToDB, createPairInDB, updatePairDB, deletePairDB, startTournamentDB, formatPlayerName } = useTournament();
  const [viewMode, setViewMode] = useState<ViewMode>('menu');

  const [isEditingPairId, setIsEditingPairId] = useState<string | null>(null);
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');

  const activePairs = state.pairs || [];

  // La función local formatPlayerName SE HA ELIMINADO para usar la del contexto

  const PlayerSelector = ({ label, selectedId, onSelect }: any) => {
      const [tab, setTab] = useState<'search' | 'new'>('search');
      const [searchQuery, setSearchQuery] = useState('');
      const [newPlayer, setNewPlayer] = useState({ name: '', nickname: '', categories: [] as string[], saveRecord: false });
      const selectedPlayer = state.players.find(p => p.id === selectedId);
      const filteredPlayers = state.players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.nickname && p.nickname.toLowerCase().includes(searchQuery.toLowerCase())));

      const handleCreatePlayer = async () => {
          if(!newPlayer.name) return;
          const newId = await addPlayerToDB(newPlayer);
          if(newId) { onSelect(newId); setNewPlayer({ name: '', nickname: '', categories: [], saveRecord: false }); setTab('search'); }
      };
      const toggleNewCat = (cat: string) => { setNewPlayer(prev => { const exists = prev.categories.includes(cat); return { ...prev, categories: exists ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat] }; }); };

      return (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 shadow-sm">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">{label}</label>
              {selectedId ? (
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200"><User size={16} /></div>
                          <div>
                              {/* Usamos formatPlayerName aquí también para consistencia visual en la selección */}
                              <div className="font-bold text-slate-800 text-sm">{formatPlayerName(selectedPlayer)}</div>
                          </div>
                      </div>
                      <button onClick={() => onSelect('')} className="p-2 text-slate-400 hover:text-red-500"><X size={18}/></button>
                  </div>
              ) : (
                  <>
                      <div className="flex bg-white p-1 rounded-lg border border-slate-200 mb-3 shadow-sm">
                          <button onClick={() => setTab('search')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${tab === 'search' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Search size={14}/> Buscar</button>
                          <button onClick={() => setTab('new')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${tab === 'new' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Plus size={14}/> Nuevo</button>
                      </div>
                      {tab === 'search' ? (
                          <div className="animate-fade-in">
                              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Escribe para buscar..." className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg mb-2 focus:border-blue-500 outline-none text-slate-800 placeholder:text-slate-400 shadow-inner" autoFocus />
                              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                  {filteredPlayers.slice(0, 50).map(p => (
                                      <button key={p.id} onClick={() => onSelect(p.id)} className="w-full text-left p-2 hover:bg-blue-50 rounded flex items-center justify-between text-sm text-slate-700 border border-transparent hover:border-blue-100 transition-colors">
                                          <span className="font-medium">{formatPlayerName(p)}</span>
                                          <div className="flex items-center gap-2">{p.categories?.[0] && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.categories[0]}</span>}</div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-3 animate-fade-in">
                              <input placeholder="Nombre completo" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-slate-800 placeholder:text-slate-400" autoFocus />
                              <input placeholder="Apodo (opcional)" value={newPlayer.nickname} onChange={e => setNewPlayer({...newPlayer, nickname: e.target.value})} className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-slate-800 placeholder:text-slate-400" />
                              <div className="flex flex-wrap gap-1.5">{TOURNAMENT_CATEGORIES.map(c => (<button key={c} onClick={() => toggleNewCat(c)} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md border transition-all ${newPlayer.categories.includes(c) ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200'}`}>{c}</button>))}</div>
                              <div onClick={() => setNewPlayer(p => ({...p, saveRecord: !p.saveRecord}))} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${newPlayer.saveRecord ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newPlayer.saveRecord ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>{newPlayer.saveRecord && <Check size={14} className="text-white" strokeWidth={3} />}</div>
                                  <span className={`text-xs font-bold ${newPlayer.saveRecord ? 'text-emerald-700' : 'text-slate-500'}`}>Guardar en Base de Datos</span>
                              </div>
                              <button onClick={handleCreatePlayer} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"><Check size={16}/> Usar Jugador</button>
                          </div>
                      )}
                  </>
              )}
          </div>
      );
  };

  const handleSavePair = async () => {
      if (!selectedP1 || !selectedP2) return alert("Selecciona dos jugadores.");
      if (selectedP1 === selectedP2) return alert("Los jugadores deben ser distintos.");

      if (isEditingPairId) {
          await updatePairDB(isEditingPairId, selectedP1, selectedP2);
      } else {
          if (state.pairs.length >= 20) return alert("Límite de parejas alcanzado.");
          await createPairInDB(selectedP1, selectedP2);
      }
      
      // Reset
      setSelectedP1(''); setSelectedP2(''); setIsEditingPairId(null);
      setViewMode('menu');
  };

  const startEditPair = (pairId: string) => {
      const pair = state.pairs.find(p => p.id === pairId);
      if (!pair) return;
      setSelectedP1(pair.player1Id);
      setSelectedP2(pair.player2Id);
      setIsEditingPairId(pairId);
      setViewMode('pair-form');
  };

  const deletePairHandler = async (pairId: string) => {
      if (window.confirm('¿Estás seguro de que quieres eliminar esta pareja?')) {
          await deletePairDB(pairId);
      }
  };

  const canStart = activePairs.length === 16;

  const PairList = ({ pairs, title, colorClass }: { pairs: any[], title: string, colorClass: string }) => (
      <div className="mt-8">
            <h3 className={`text-sm uppercase font-bold mb-4 tracking-wider ${colorClass}`}>{title}</h3>
            <div className="space-y-3">
                {pairs.map((pair, idx) => {
                    const p1 = state.players.find(p => p.id === pair.player1Id);
                    const p2 = state.players.find(p => p.id === pair.player2Id);
                    return (
                        <div key={pair.id} className="bg-white p-4 rounded-xl flex items-center justify-between border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4 overflow-hidden w-full">
                                <span className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-slate-500 border border-slate-200">{idx + 1}</span>
                                <div className="flex flex-col w-full">
                                    <div className="text-base font-bold text-slate-800 truncate">{formatPlayerName(p1)}</div>
                                    <div className="text-base font-bold text-slate-800 truncate text-slate-500">& {formatPlayerName(p2)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                                <button onClick={() => startEditPair(pair.id)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors"><Edit2 size={18}/></button>
                                <button onClick={() => deletePairHandler(pair.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg border border-slate-100 hover:border-red-200 transition-colors"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    )
                })}
            </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div><h2 className="text-2xl font-bold text-slate-900">Registro</h2><p className="text-sm text-slate-500">Gestión de Inscripciones</p></div>
        <div className={`flex flex-col items-end ${activePairs.length === 16 ? 'text-emerald-600' : 'text-blue-600'}`}><span className="text-4xl font-bold">{activePairs.length}<span className="text-xl text-slate-300">/16</span></span></div>
      </div>

      {viewMode === 'menu' && (
          <>
            <button onClick={() => { setIsEditingPairId(null); setSelectedP1(''); setSelectedP2(''); setViewMode('pair-form'); }} className="w-full bg-white hover:bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-300 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95 group">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 group-hover:bg-emerald-200 transition-colors"><Users size={32} /></div>
                <span className="font-black text-emerald-800 text-lg">AÑADIR NUEVA PAREJA</span>
            </button>

            <PairList pairs={activePairs} title="Parejas Confirmadas" colorClass="text-emerald-600" />

            {state.status === 'setup' && (
                <div className="fixed bottom-20 left-4 right-4 z-40">
                    <button 
                        onClick={startTournamentDB}
                        disabled={!canStart}
                        className={`w-full py-5 rounded-2xl font-bold shadow-xl text-2xl transition-all ${canStart ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white animate-pulse active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        EMPEZAR TORNEO
                    </button>
                </div>
            )}
          </>
      )}

      {viewMode === 'pair-form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-slide-up">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Users className="text-emerald-600"/>{isEditingPairId ? 'Editar Pareja' : 'Nueva Pareja'}</h3>
              
              <PlayerSelector label="JUGADOR 1" selectedId={selectedP1} onSelect={setSelectedP1} />
              
              <div className="flex justify-center items-center gap-4 my-6">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="bg-slate-100 text-slate-400 text-xs px-3 py-1 rounded-full font-bold border border-slate-200">&</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <PlayerSelector label="JUGADOR 2" selectedId={selectedP2} onSelect={setSelectedP2} />

              <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                  <button onClick={() => setViewMode('menu')} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button onClick={handleSavePair} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-colors active:scale-95"><Save size={20} /> Guardar Pareja</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Registration;