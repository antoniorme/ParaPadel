
import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { Search, Edit2, Save, Eye, Trophy, Activity, Plus, Check, X, Trash2, AlertTriangle, ArrowRightCircle, ArrowLeftCircle, Shuffle, Mail, Phone } from 'lucide-react';
import { Player } from '../types';
import { useNavigate } from 'react-router-dom';
import { calculateDisplayRanking, calculateInitialElo, manualToElo } from '../utils/Elo';

interface AlertState {
    type: 'error' | 'success';
    message: string;
}

const PlayerManager: React.FC = () => {
  const { state, updatePlayerInDB, addPlayerToDB, deletePlayerDB, formatPlayerName } = useTournament();
  const navigate = useNavigate();
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<AlertState | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', nickname: '', categories: [] as string[], manual_rating: 5, email: '', phone: '', preferred_position: undefined as 'right' | 'backhand' | undefined, play_both_sides: false });

  const filteredPlayers = state.players.filter(p => {
      const matchesCat = filterCat === 'all' || (p.categories && p.categories.includes(filterCat));
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            (p.nickname && p.nickname.toLowerCase().includes(search.toLowerCase()));
      return matchesCat && matchesSearch;
  });

  filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = () => {
      if (editingPlayer) {
          const newElo = calculateInitialElo(editingPlayer.categories || [], editingPlayer.manual_rating || 5);
          updatePlayerInDB({ ...editingPlayer, global_rating: newElo });
          setEditingPlayer(null);
      }
  };

  const handleDelete = async () => {
      if (!editingPlayer) return;
      try {
          await deletePlayerDB(editingPlayer.id);
          setEditingPlayer(null);
          setShowDeleteConfirm(false);
      } catch (e: any) {
          setAlertMessage({ type: 'error', message: "Error al eliminar: " + e.message });
      }
  };
  
  const handleCreate = async () => {
      if (!newPlayer.name) {
          setAlertMessage({ type: 'error', message: "El nombre es obligatorio." });
          return;
      }
      const initialElo = calculateInitialElo(newPlayer.categories, newPlayer.manual_rating);
      
      const newId = await addPlayerToDB({
          ...newPlayer,
          global_rating: initialElo
      });

      if (!newId) {
          setAlertMessage({ type: 'error', message: "Error al crear el jugador. Inténtalo de nuevo." });
      } else {
          setIsCreating(false);
          setNewPlayer({ name: '', nickname: '', categories: [], manual_rating: 5, email: '', phone: '', preferred_position: undefined, play_both_sides: false });
          setAlertMessage({ type: 'success', message: "Jugador creado correctamente." });
      }
  };
  
  const toggleNewCategory = (cat: string) => {
      setNewPlayer(prev => {
          const cats = prev.categories || [];
          const exists = cats.includes(cat);
          return {
              ...prev,
              categories: exists ? cats.filter(c => c !== cat) : [...cats, cat]
          };
      });
  };

  const toggleEditCategory = (cat: string) => {
      if (!editingPlayer) return;
      setEditingPlayer(prev => {
          if (!prev) return null;
          const cats = prev.categories || [];
          const exists = cats.includes(cat);
          return {
              ...prev,
              categories: exists ? cats.filter(c => c !== cat) : [...cats, cat]
          };
      });
  };

  const getPositionLabel = (pos?: string, both?: boolean) => {
      if (!pos) return null;
      let label = pos === 'right' ? 'Derecha' : 'Revés';
      return (
          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold border flex items-center gap-1 ${both ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
              {label} {both && <Shuffle size={8}/>}
          </span>
      );
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Gestión Jugadores</h2>
          <button 
            onClick={() => setIsCreating(true)} 
            style={{ backgroundColor: THEME.cta }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-black text-sm shadow-lg active:scale-95 transition-transform hover:opacity-90"
          >
              <Plus size={20} /> CREAR
          </button>
      </div>

      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-5">
          <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-500" size={20}/>
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-[#575AF9] text-slate-200 placeholder:text-slate-600 font-bold"
                placeholder="Buscar por nombre..."
              />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button onClick={() => setFilterCat('all')} className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors ${filterCat === 'all' ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'}`}>Todos</button>
              {TOURNAMENT_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)} className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap ${filterCat === cat ? 'bg-[#575AF9] text-white' : 'bg-slate-800 text-slate-400'}`}>{cat}</button>
              ))}
          </div>
      </div>

      <div className="space-y-3">
          {filteredPlayers.length === 0 && <div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest text-xs">No se encontraron jugadores</div>}
          {filteredPlayers.map((player) => {
              const rankingScore = calculateDisplayRanking(player);
              return (
              <div key={player.id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg flex justify-between items-center group hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center font-black text-lg shadow-inner">
                          {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                          <div className="font-black text-slate-100 text-lg leading-tight">
                              {formatPlayerName(player)}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">{player.categories?.[0] || 'Sin Cat'}</span>
                              {getPositionLabel(player.preferred_position, player.play_both_sides)}
                              <span className="text-[10px] font-black text-blue-300 flex items-center gap-1 uppercase"><Activity size={12}/> {rankingScore} pts</span>
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/players/${player.id}`)} className="p-3 text-slate-400 hover:text-white bg-slate-800 rounded-2xl border border-slate-700 transition-all"><Eye size={20} /></button>
                      <button onClick={() => setEditingPlayer(player)} className="p-3 text-slate-400 hover:text-blue-300 bg-slate-800 rounded-2xl border border-slate-700 transition-all"><Edit2 size={20} /></button>
                  </div>
              </div>
              );
          })}
      </div>

      {/* CREATE MODAL */}
      {isCreating && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
              <div className="bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-scale-in border border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-black text-white">Nuevo Jugador</h3>
                      <button onClick={() => setIsCreating(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="space-y-5">
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                          <input autoFocus value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 mt-1.5 text-slate-100 font-bold outline-none focus:border-[#575AF9]" placeholder="Ej. Juan Pérez" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                              <div className="relative mt-1.5">
                                  <Phone size={16} className="absolute left-4 top-4 text-slate-600"/>
                                  <input value={newPlayer.phone} onChange={e => setNewPlayer({...newPlayer, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-slate-100 font-bold outline-none focus:border-[#575AF9]" placeholder="600000000" />
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                              <div className="relative mt-1.5">
                                  <Mail size={16} className="absolute left-4 top-4 text-slate-600"/>
                                  <input value={newPlayer.email} onChange={e => setNewPlayer({...newPlayer, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-slate-100 font-bold outline-none focus:border-[#575AF9]" placeholder="email@club.com" />
                              </div>
                          </div>
                      </div>

                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apodo (Opcional)</label>
                          <input value={newPlayer.nickname} onChange={e => setNewPlayer({...newPlayer, nickname: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 mt-1.5 text-slate-100 font-bold outline-none focus:border-[#575AF9]" placeholder="Ej. El Muro" />
                      </div>
                      
                      <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Posición Predilecta</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setNewPlayer({...newPlayer, preferred_position: 'right'})}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all border ${newPlayer.preferred_position === 'right' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ArrowRightCircle size={16}/> Derecha
                                </button>
                                <button 
                                    onClick={() => setNewPlayer({...newPlayer, preferred_position: 'backhand'})}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all border ${newPlayer.preferred_position === 'backhand' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ArrowLeftCircle size={16}/> Revés
                                </button>
                            </div>
                            <div 
                                onClick={() => setNewPlayer({...newPlayer, play_both_sides: !newPlayer.play_both_sides})}
                                className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border transition-colors ${newPlayer.play_both_sides ? 'bg-emerald-900/30 border-emerald-800' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${newPlayer.play_both_sides ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 bg-slate-950'}`}>
                                    {newPlayer.play_both_sides && <Check size={12} strokeWidth={4}/>}
                                </div>
                                <span className={`text-xs font-bold ${newPlayer.play_both_sides ? 'text-emerald-400' : 'text-slate-500'}`}>Versátil (Juega en ambos lados)</span>
                            </div>
                        </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categorías (Base ELO)</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {TOURNAMENT_CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => toggleNewCategory(cat)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${newPlayer.categories?.includes(cat) ? 'bg-[#575AF9] border-[#575AF9] text-white' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'}`}>{cat}</button>
                            ))}
                        </div>
                      </div>

                      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                          <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Trophy size={14}/> Ajuste Manual (1-10)</label>
                          <div className="flex items-center gap-5">
                              <input type="range" min="1" max="10" step="0.5" value={newPlayer.manual_rating} onChange={e => setNewPlayer({...newPlayer, manual_rating: parseFloat(e.target.value)})} className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                              <span className="font-black text-2xl text-amber-400 w-10 text-center">{newPlayer.manual_rating}</span>
                          </div>
                      </div>
                  </div>
                  <div className="mt-10">
                      <button onClick={handleCreate} style={{ backgroundColor: THEME.cta }} className="w-full py-5 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest text-sm">
                          <Check size={20} strokeWidth={3}/> CREAR JUGADOR
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT MODAL - FULL FEATURES RESTORED */}
      {editingPlayer && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
              <div className="bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-scale-in border border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-black text-white">Editar Jugador</h3>
                      <button onClick={() => setShowDeleteConfirm(true)} className="p-3 bg-rose-950/40 text-rose-400 rounded-2xl hover:bg-rose-900/50 transition-colors border border-rose-900/50">
                          <Trash2 size={20} />
                      </button>
                  </div>
                  <div className="space-y-5">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Real</label><input value={editingPlayer.name} onChange={e => setEditingPlayer({...editingPlayer, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 mt-1.5 text-slate-100 font-bold outline-none focus:border-[#575AF9]" /></div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                              <div className="relative mt-1.5">
                                  <Phone size={16} className="absolute left-4 top-4 text-slate-600"/>
                                  <input value={editingPlayer.phone || ''} onChange={e => setEditingPlayer({...editingPlayer, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-slate-100 font-bold outline-none focus:border-[#575AF9]" />
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                              <div className="relative mt-1.5">
                                  <Mail size={16} className="absolute left-4 top-4 text-slate-600"/>
                                  <input value={editingPlayer.email || ''} onChange={e => setEditingPlayer({...editingPlayer, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-slate-100 font-bold outline-none focus:border-[#575AF9]" />
                              </div>
                          </div>
                      </div>

                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apodo (Opcional)</label><input value={editingPlayer.nickname || ''} onChange={e => setEditingPlayer({...editingPlayer, nickname: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 mt-1.5 text-slate-100 font-bold outline-none focus:border-[#575AF9]" /></div>

                      {/* POSICIÓN Y LADO */}
                      <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Posición Predilecta</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setEditingPlayer({...editingPlayer, preferred_position: 'right'})}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all border ${editingPlayer.preferred_position === 'right' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ArrowRightCircle size={16}/> Derecha
                                </button>
                                <button 
                                    onClick={() => setEditingPlayer({...editingPlayer, preferred_position: 'backhand'})}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all border ${editingPlayer.preferred_position === 'backhand' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    <ArrowLeftCircle size={16}/> Revés
                                </button>
                            </div>
                            <div 
                                onClick={() => setEditingPlayer({...editingPlayer, play_both_sides: !editingPlayer.play_both_sides})}
                                className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border transition-colors ${editingPlayer.play_both_sides ? 'bg-emerald-900/30 border-emerald-800' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${editingPlayer.play_both_sides ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 bg-slate-950'}`}>
                                    {editingPlayer.play_both_sides && <Check size={12} strokeWidth={4}/>}
                                </div>
                                <span className={`text-xs font-bold ${editingPlayer.play_both_sides ? 'text-emerald-400' : 'text-slate-500'}`}>Versátil (Juega en ambos lados)</span>
                            </div>
                      </div>

                      {/* CATEGORÍAS */}
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categorías (Base ELO)</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {TOURNAMENT_CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => toggleEditCategory(cat)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${editingPlayer.categories?.includes(cat) ? 'bg-[#575AF9] border-[#575AF9] text-white' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'}`}>{cat}</button>
                            ))}
                        </div>
                      </div>

                      {/* AJUSTE MANUAL */}
                      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                          <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Trophy size={14}/> Ajuste Manual (1-10)</label>
                          <div className="flex items-center gap-5">
                              <input type="range" min="1" max="10" step="0.5" value={editingPlayer.manual_rating || 5} onChange={e => setEditingPlayer({...editingPlayer, manual_rating: parseFloat(e.target.value)})} className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                              <span className="font-black text-2xl text-amber-400 w-10 text-center">{editingPlayer.manual_rating || 5}</span>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Nuevo ELO Estimado</span>
                              <span className="text-sm font-black text-white">{calculateInitialElo(editingPlayer.categories || [], editingPlayer.manual_rating || 5)} pts</span>
                          </div>
                      </div>

                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-10">
                      <button onClick={() => setEditingPlayer(null)} className="py-4 bg-slate-800 text-slate-400 rounded-2xl font-black text-sm tracking-widest uppercase">Cancelar</button>
                      <button onClick={handleSave} style={{ backgroundColor: THEME.cta }} className="py-4 text-white rounded-2xl font-black shadow-lg hover:opacity-90 active:scale-95 text-sm tracking-widest uppercase flex items-center justify-center gap-2"><Save size={18}/> Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlayerManager;
