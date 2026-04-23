
import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { THEME } from '../utils/theme';
import { Search, Edit2, Trophy, Activity, Plus, Check, X, Trash2, AlertTriangle, ArrowRightCircle, ArrowLeftCircle, Shuffle, Mail, Phone, Merge, ArrowRight, ArrowLeft, Users, Upload, FileText, AlertCircle } from 'lucide-react';
import { Modal, EmptyState } from '../components';
import { Player } from '../types';
import { useNavigate } from 'react-router-dom';
import { calculateDisplayRanking, calculateInitialElo, manualToElo } from '../utils/Elo';
import { supabase } from '../lib/supabase';
import { avatarColor, initials } from '../utils/avatar';

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

  // CSV IMPORT STATE
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvRows, setCsvRows] = useState<{ name: string; phone: string; email: string; categories: string[]; isDupe: boolean }[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const csvInputRef = React.useRef<HTMLInputElement>(null);


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

  // CSV IMPORT LOGIC
  const VALID_CATEGORIES = new Set(['Iniciación', '5ª CAT', '4ª CAT', '3ª CAT', '2ª CAT', '1ª CAT']);

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCsvError(null); setImportDone(false);
      const reader = new FileReader();
      reader.onload = (ev) => {
          const text = ev.target?.result as string;
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) { setCsvError('El archivo está vacío.'); return; }

          // Detect separator: ; or ,
          const sep = lines[0].includes(';') ? ';' : ',';
          const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

          const nameIdx = header.findIndex(h => ['nombre', 'name'].includes(h));
          if (nameIdx === -1) { setCsvError('Columna "Nombre" no encontrada. La primera fila debe tener cabeceras: Nombre, Teléfono, Email, Categoría'); return; }
          const phoneIdx = header.findIndex(h => ['teléfono', 'telefono', 'phone', 'tel'].includes(h));
          const emailIdx = header.findIndex(h => ['email', 'correo'].includes(h));
          const catIdx = header.findIndex(h => ['categoría', 'categoria', 'category', 'cat'].includes(h));

          const existingNames = new Set(state.players.map(p => p.name.toLowerCase().trim()));
          const parsed = [];
          const errors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
              const name = cols[nameIdx]?.trim();
              if (!name) continue;
              const phone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() || '' : '';
              const email = emailIdx >= 0 ? cols[emailIdx]?.trim() || '' : '';
              const catRaw = catIdx >= 0 ? cols[catIdx]?.trim() || '' : '';
              const categories = catRaw ? catRaw.split(/[,/]/).map(c => c.trim()).filter(c => VALID_CATEGORIES.has(c)) : [];
              if (catRaw && categories.length === 0) errors.push(`Fila ${i+1}: categoría "${catRaw}" no reconocida (ignorada)`);
              parsed.push({ name, phone, email, categories, isDupe: existingNames.has(name.toLowerCase()) });
          }
          if (parsed.length === 0) { setCsvError('No se encontraron jugadores válidos en el archivo.'); return; }
          if (errors.length > 0) setCsvError(`Avisos: ${errors.slice(0,3).join(' | ')}${errors.length > 3 ? ` (+${errors.length-3} más)` : ''}`);
          setCsvRows(parsed);
          setShowImportModal(true);
      };
      reader.readAsText(file, 'UTF-8');
      e.target.value = '';
  };

  const handleImport = async () => {
      const toImport = csvRows.filter(r => !r.isDupe);
      if (toImport.length === 0) return;
      setImporting(true);
      for (const row of toImport) {
          const initialElo = calculateInitialElo(row.categories, 5);
          await addPlayerToDB({ name: row.name, phone: row.phone || undefined, email: row.email || undefined, categories: row.categories, global_rating: initialElo, manual_rating: 5 });
      }
      setImporting(false);
      setImportDone(true);
      setCsvRows([]);
      setAlertMessage({ type: 'success', message: `${toImport.length} jugador${toImport.length > 1 ? 'es importados' : ' importado'} correctamente.` });
      setShowImportModal(false);
  };

  // Logic for Merge Modal List
  const mergeList = state.players.filter(p => p.name.toLowerCase().includes(mergeSearch.toLowerCase()));

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-end gap-4 flex-wrap">
          <div>
            <h1 className="font-black text-slate-900" style={{ fontSize: 28, letterSpacing: -0.8, lineHeight: 1.05 }}>Jugadores</h1>
            <p className="text-sm font-medium mt-1.5 text-slate-500">Miembros del club · ELO y categorías</p>
          </div>
          <div className="flex gap-2">
              <button
                onClick={() => setShowMergeModal(true)}
                className="p-3 bg-slate-800 text-indigo-300 rounded-xl hover:bg-slate-700 transition-colors border border-indigo-900/50"
                title="Fusionar duplicados"
              >
                  <Merge size={20}/>
              </button>
              <label
                className="p-3 bg-slate-800 text-emerald-300 rounded-xl hover:bg-slate-700 transition-colors border border-emerald-900/50 cursor-pointer"
                title="Importar CSV"
              >
                  <Upload size={20}/>
                  <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvFile}/>
              </label>
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
          {filteredPlayers.length === 0 && (
              <EmptyState
                  icon={<Users size={28}/>}
                  title={search ? "Sin resultados" : "No hay jugadores"}
                  body={search ? `No hay jugadores que coincidan con "${search}".` : "Crea el primer jugador del club para empezar."}
              />
          )}
          {filteredPlayers.map((player) => {
              const rankingScore = calculateDisplayRanking(player);
              return (
              <div
                  key={player.id}
                  onClick={() => navigate(`/players/${player.id}`)}
                  className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg flex justify-between items-center group hover:border-[#575AF9]/50 hover:bg-slate-800/50 transition-all cursor-pointer"
              >
                  <div className="flex items-center gap-4">
                      {(() => { const ac = avatarColor(player.name || ''); return (
                      <div
                          className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shrink-0"
                          style={{ background: ac.bg, color: ac.fg }}
                      >
                          {initials(player.name || '')}
                      </div>
                      ); })()}
                      <div>
                          <div className="font-black text-slate-100 text-lg leading-tight">
                              {formatPlayerName(player)}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
                  <button
                      onClick={e => { e.stopPropagation(); setEditingPlayer(player); }}
                      className="p-3 text-slate-400 hover:text-blue-300 bg-slate-800 rounded-2xl border border-slate-700 transition-all shrink-0"
                  >
                      <Edit2 size={20} />
                  </button>
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

      {/* CSV IMPORT PREVIEW MODAL */}
      <Modal
          isOpen={showImportModal}
          onClose={() => { setShowImportModal(false); setCsvRows([]); }}
          title="Importar Jugadores CSV"
          icon={<FileText size={28}/>}
          iconColor="brand"
          size="lg"
          actions={[
              { label: 'Cancelar', onClick: () => { setShowImportModal(false); setCsvRows([]); }, variant: 'secondary' },
              { label: `Importar ${csvRows.filter(r => !r.isDupe).length} jugadores`, onClick: handleImport, variant: 'primary', loading: importing },
          ]}
      >
          <div className="text-left space-y-4">
              {csvError && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      <AlertCircle size={14} className="shrink-0 mt-0.5"/>
                      <span>{csvError}</span>
                  </div>
              )}
              <div className="flex gap-4 text-xs font-bold">
                  <span className="text-emerald-600">{csvRows.filter(r => !r.isDupe).length} nuevos</span>
                  <span className="text-amber-600">{csvRows.filter(r => r.isDupe).length} duplicados (se omitirán)</span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {csvRows.map((row, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm ${row.isDupe ? 'bg-amber-50 border-amber-100 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${row.isDupe ? 'bg-amber-400' : 'bg-emerald-500'}`}/>
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-800 truncate">{row.name} {row.isDupe && <span className="text-[10px] font-normal text-amber-600">(ya existe)</span>}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                  {[row.phone, row.email, row.categories.join(', ')].filter(Boolean).join(' · ') || 'Sin datos extra'}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed border border-slate-100">
                  <strong className="text-slate-600 block mb-1">Formato esperado del CSV:</strong>
                  Nombre;Teléfono;Email;Categoría<br/>
                  Juan Pérez;600000001;juan@email.com;3ª CAT<br/>
                  María García;600000002;;4ª CAT<br/>
                  <span className="text-slate-500">Separador: ; o coma. Columna Nombre obligatoria. Categorías válidas: Iniciación, 5ª CAT, 4ª CAT, 3ª CAT, 2ª CAT, 1ª CAT</span>
              </div>
          </div>
      </Modal>

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
