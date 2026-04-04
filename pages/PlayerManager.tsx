
import React, { useState, useMemo } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { Search, Edit2, Save, Eye, Trophy, Activity, Plus, Check, X, Trash2, AlertTriangle, ArrowRightCircle, ArrowLeftCircle, Shuffle, Mail, Phone, Merge, ArrowRight, ArrowLeft } from 'lucide-react';
import { Modal } from '../components';
import { Player } from '../types';
import { useNavigate } from 'react-router-dom';
import { calculateDisplayRanking, calculateInitialElo, manualToElo } from '../utils/Elo';
import { supabase } from '../lib/supabase';

interface AlertState {
    type: 'error' | 'success';
    message: string;
}

const PlayerManager: React.FC = () => {
  const { state, updatePlayerInDB, addPlayerToDB, deletePlayerDB, formatPlayerName, loadData } = useTournament();
  const navigate = useNavigate();
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<AlertState | null>(null);
  
  // MERGE STATE
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mainPlayerId, setMainPlayerId] = useState<string | null>(null);
  const [dupePlayerId, setDupePlayerId] = useState<string | null>(null);
  
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

  const executeMerge = async () => {
      if (!mainPlayerId || !dupePlayerId) return;
      if (mainPlayerId === dupePlayerId) {
          setAlertMessage({ type: 'error', message: "No puedes fusionar al jugador consigo mismo." });
          return;
      }

      try {
          // 1. Move Tournament Pairs (Minis)
          await supabase.from('tournament_pairs').update({ player1_id: mainPlayerId }).eq('player1_id', dupePlayerId);
          await supabase.from('tournament_pairs').update({ player2_id: mainPlayerId }).eq('player2_id', dupePlayerId);

          // 2. Move League Pairs (Leagues)
          await supabase.from('league_pairs').update({ player1_id: mainPlayerId }).eq('player1_id', dupePlayerId);
          await supabase.from('league_pairs').update({ player2_id: mainPlayerId }).eq('player2_id', dupePlayerId);

          // 3. Delete Duplicate Player
          await deletePlayerDB(dupePlayerId);

          // 4. Refresh Data
          await loadData();
          
          setAlertMessage({ type: 'success', message: "Jugadores fusionados correctamente. Historial unificado." });
          setShowMergeModal(false);
          setMainPlayerId(null);
          setDupePlayerId(null);
      } catch (e: any) {
          setAlertMessage({ type: 'error', message: "Error al fusionar: " + e.message });
      }
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

  // Logic for Merge Modal List
  const mergeList = state.players.filter(p => p.name.toLowerCase().includes(mergeSearch.toLowerCase()));

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Gestión Jugadores</h2>
          <div className="flex gap-2">
              <button 
                onClick={() => setShowMergeModal(true)}
                className="p-3 bg-slate-800 text-indigo-300 rounded-xl hover:bg-slate-700 transition-colors border border-indigo-900/50"
                title="Fusionar duplicados"
              >
                  <Merge size={20}/>
              </button>
              <button 
                onClick={() => setIsCreating(true)} 
                style={{ backgroundColor: THEME.cta }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-black text-sm shadow-lg active:scale-95 transition-transform hover:opacity-90"
              >
                  <Plus size={20} /> CREAR
              </button>
          </div>
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
                              {/* DISPLAY ALL CATEGORIES */}
                              {player.categories && player.categories.length > 0 ? (
                                  player.categories.map((cat, i) => (
                                      <span key={i} className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/50">
                                          {cat}
                                      </span>
                                  ))
                              ) : (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-800 px-2 py-0.5 rounded-lg">Sin Cat</span>
                              )}
                              
                              {getPositionLabel(player.preferred_position, player.play_both_sides)}
                              
                              <span className="text-[10px] font-black text-blue-300 flex items-center gap-1 uppercase ml-1"><Activity size={12}/> {rankingScore} pts</span>
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

      {/* MERGE MODAL */}
      <Modal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          title="Fusionar Duplicados"
          body="Elige el perfil 'Principal'. El historial del 'Duplicado' se moverá al principal y el duplicado se borrará."
          icon={<Merge size={28} />}
          iconColor="brand"
          size="lg"
          actions={[
              { label: 'Cancelar', onClick: () => setShowMergeModal(false), variant: 'secondary' },
              { label: 'Confirmar Fusión', onClick: executeMerge, variant: 'primary' },
          ]}
      >
          <div className="flex flex-col md:flex-row gap-4 max-h-64 overflow-hidden text-left">
              <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3">
                      <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">1. Jugador Principal (Se mantiene)</h4>
                      <input value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} placeholder="Buscar..." className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"/>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                      {mergeList.map(p => (
                          <button key={p.id} onClick={() => setMainPlayerId(p.id)} className={`w-full text-left p-2 rounded-lg text-sm font-bold flex justify-between items-center ${mainPlayerId === p.id ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'text-slate-600 hover:bg-slate-100'}`}>
                              <span>{formatPlayerName(p)}</span>
                              {mainPlayerId === p.id && <Check size={16}/>}
                          </button>
                      ))}
                  </div>
              </div>
              <div className="flex items-center justify-center text-slate-400">
                  <ArrowRight size={20} className="hidden md:block"/>
              </div>
              <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-3">2. Jugador Duplicado (Se borra)</h4>
                  <div className="flex-1 overflow-y-auto space-y-1">
                      {mergeList.map(p => {
                          if (p.id === mainPlayerId) return null;
                          return (
                              <button key={p.id} onClick={() => setDupePlayerId(p.id)} className={`w-full text-left p-2 rounded-lg text-sm font-bold flex justify-between items-center ${dupePlayerId === p.id ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'text-slate-600 hover:bg-slate-100'}`}>
                                  <span>{formatPlayerName(p)}</span>
                                  {dupePlayerId === p.id && <Trash2 size={16}/>}
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      </Modal>

      {/* CREATE MODAL */}
      <Modal
          isOpen={isCreating}
          onClose={() => setIsCreating(false)}
          title="Nuevo Jugador"
          icon={<Plus size={28} />}
          iconColor="brand"
          size="md"
          actions={[
              { label: 'Cancelar', onClick: () => setIsCreating(false), variant: 'secondary' },
              { label: 'Crear Jugador', onClick: handleCreate, variant: 'primary' },
          ]}
      >
          <div className="space-y-4 text-left">
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                  <input autoFocus value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 mt-1 text-slate-900 font-bold outline-none focus:border-[#575AF9]" placeholder="Ej. Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                      <div className="relative mt-1">
                          <Phone size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                          <input value={newPlayer.phone} onChange={e => setNewPlayer({...newPlayer, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-9 pr-3 text-slate-900 font-bold outline-none focus:border-[#575AF9]" placeholder="600000000" />
                      </div>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                      <div className="relative mt-1">
                          <Mail size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                          <input value={newPlayer.email} onChange={e => setNewPlayer({...newPlayer, email: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-9 pr-3 text-slate-900 font-bold outline-none focus:border-[#575AF9]" placeholder="email@club.com" />
                      </div>
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Apodo (Opcional)</label>
                  <input value={newPlayer.nickname} onChange={e => setNewPlayer({...newPlayer, nickname: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 mt-1 text-slate-900 font-bold outline-none focus:border-[#575AF9]" placeholder="Ej. El Muro" />
              </div>
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Posición Predilecta</label>
                  <div className="flex gap-2">
                      <button onClick={() => setNewPlayer({...newPlayer, preferred_position: 'right'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 border transition-all ${newPlayer.preferred_position === 'right' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}><ArrowRightCircle size={14}/> Derecha</button>
                      <button onClick={() => setNewPlayer({...newPlayer, preferred_position: 'backhand'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 border transition-all ${newPlayer.preferred_position === 'backhand' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}><ArrowLeftCircle size={14}/> Revés</button>
                  </div>
                  <div onClick={() => setNewPlayer({...newPlayer, play_both_sides: !newPlayer.play_both_sides})} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${newPlayer.play_both_sides ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${newPlayer.play_both_sides ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{newPlayer.play_both_sides && <Check size={10} className="text-white"/>}</div>
                      <span className={`text-xs font-bold ${newPlayer.play_both_sides ? 'text-emerald-700' : 'text-slate-500'}`}>Versátil (Juega en ambos lados)</span>
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categorías (Base ELO)</label>
                  <div className="flex flex-wrap gap-2">
                      {TOURNAMENT_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => toggleNewCategory(cat)} className={`px-2 py-1 rounded text-xs font-bold border transition-all ${newPlayer.categories?.includes(cat) ? 'bg-[#575AF9] border-[#575AF9] text-white' : 'bg-white text-slate-500 border-slate-300'}`}>{cat}</button>
                      ))}
                  </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <label className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1 mb-3"><Trophy size={12}/> Ajuste Manual (1-10)</label>
                  <div className="flex items-center gap-4">
                      <input type="range" min="1" max="10" step="0.5" value={newPlayer.manual_rating} onChange={e => setNewPlayer({...newPlayer, manual_rating: parseFloat(e.target.value)})} className="w-full accent-amber-500" />
                      <span className="font-black text-xl text-amber-600 w-8 text-center">{newPlayer.manual_rating}</span>
                  </div>
              </div>
          </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
          isOpen={!!editingPlayer}
          onClose={() => setEditingPlayer(null)}
          title="Editar Jugador"
          icon={<Edit2 size={28} />}
          iconColor="brand"
          size="md"
          actions={[
              { label: 'Cancelar', onClick: () => setEditingPlayer(null), variant: 'secondary' },
              { label: 'Guardar', onClick: handleSave, variant: 'primary' },
          ]}
      >
          {editingPlayer && (
              <div className="space-y-4 text-left">
                  <div><label className="text-xs font-bold text-slate-500 uppercase">Nombre Real</label><input value={editingPlayer.name} onChange={e => setEditingPlayer({...editingPlayer, name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 mt-1 text-slate-900 font-bold outline-none focus:border-[#575AF9]" /></div>
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                          <div className="relative mt-1"><Phone size={14} className="absolute left-3 top-3.5 text-slate-400"/><input value={editingPlayer.phone || ''} onChange={e => setEditingPlayer({...editingPlayer, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-9 pr-3 text-slate-900 font-bold outline-none focus:border-[#575AF9]" /></div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                          <div className="relative mt-1"><Mail size={14} className="absolute left-3 top-3.5 text-slate-400"/><input value={editingPlayer.email || ''} onChange={e => setEditingPlayer({...editingPlayer, email: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-9 pr-3 text-slate-900 font-bold outline-none focus:border-[#575AF9]" /></div>
                      </div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase">Apodo (Opcional)</label><input value={editingPlayer.nickname || ''} onChange={e => setEditingPlayer({...editingPlayer, nickname: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 mt-1 text-slate-900 font-bold outline-none focus:border-[#575AF9]" /></div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Posición Predilecta</label>
                      <div className="flex gap-2">
                          <button onClick={() => setEditingPlayer({...editingPlayer, preferred_position: 'right'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 border transition-all ${editingPlayer.preferred_position === 'right' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}><ArrowRightCircle size={14}/> Derecha</button>
                          <button onClick={() => setEditingPlayer({...editingPlayer, preferred_position: 'backhand'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 border transition-all ${editingPlayer.preferred_position === 'backhand' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}><ArrowLeftCircle size={14}/> Revés</button>
                      </div>
                      <div onClick={() => setEditingPlayer({...editingPlayer, play_both_sides: !editingPlayer.play_both_sides})} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${editingPlayer.play_both_sides ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${editingPlayer.play_both_sides ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{editingPlayer.play_both_sides && <Check size={10} className="text-white"/>}</div>
                          <span className={`text-xs font-bold ${editingPlayer.play_both_sides ? 'text-emerald-700' : 'text-slate-500'}`}>Versátil (Juega en ambos lados)</span>
                      </div>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categorías (Base ELO)</label>
                      <div className="flex flex-wrap gap-2">
                          {TOURNAMENT_CATEGORIES.map(cat => (
                              <button key={cat} onClick={() => toggleEditCategory(cat)} className={`px-2 py-1 rounded text-xs font-bold border transition-all ${editingPlayer.categories?.includes(cat) ? 'bg-[#575AF9] border-[#575AF9] text-white' : 'bg-white text-slate-500 border-slate-300'}`}>{cat}</button>
                          ))}
                      </div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <label className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1 mb-3"><Trophy size={12}/> Ajuste Manual (1-10)</label>
                      <div className="flex items-center gap-4">
                          <input type="range" min="1" max="10" step="0.5" value={editingPlayer.manual_rating || 5} onChange={e => setEditingPlayer({...editingPlayer, manual_rating: parseFloat(e.target.value)})} className="w-full accent-amber-500" />
                          <span className="font-black text-xl text-amber-600 w-8 text-center">{editingPlayer.manual_rating || 5}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200 text-xs">
                          <span className="text-slate-500 uppercase font-bold">Nuevo ELO Estimado</span>
                          <span className="font-black text-slate-900">{calculateInitialElo(editingPlayer.categories || [], editingPlayer.manual_rating || 5)} pts</span>
                      </div>
                  </div>
                  <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2 text-rose-500 text-xs font-bold border border-rose-100 rounded-xl hover:bg-rose-50 flex items-center justify-center gap-1">
                      <Trash2 size={14}/> Eliminar jugador
                  </button>
              </div>
          )}
      </Modal>

      <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="¿Eliminar Jugador?"
          body="Esta acción es irreversible. Se borrarán los datos del jugador de la base de datos del club."
          icon={<Trash2 size={28} />}
          iconColor="danger"
          actions={[
              { label: 'Cancelar', onClick: () => setShowDeleteConfirm(false), variant: 'secondary' },
              { label: 'Eliminar', onClick: handleDelete, variant: 'danger' },
          ]}
      />

      <Modal
          isOpen={!!alertMessage}
          onClose={() => setAlertMessage(null)}
          title={alertMessage?.type === 'error' ? 'Atención' : 'Éxito'}
          body={alertMessage?.message}
          icon={alertMessage?.type === 'error' ? <AlertTriangle size={28} /> : <Check size={28} />}
          iconColor={alertMessage?.type === 'error' ? 'danger' : 'success'}
          actions={[{ label: 'Entendido', onClick: () => setAlertMessage(null), variant: 'primary' }]}
      />
    </div>
  );
};

export default PlayerManager;
