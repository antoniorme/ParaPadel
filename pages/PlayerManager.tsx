
import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { Search, Filter, Edit2, Save, User, Eye } from 'lucide-react';
import { Player } from '../types';
import { useNavigate } from 'react-router-dom';

const PlayerManager: React.FC = () => {
  const { state, dispatch } = useTournament();
  const navigate = useNavigate();
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const filteredPlayers = state.players.filter(p => {
      const matchesCat = filterCat === 'all' || (p.categories && p.categories.includes(filterCat));
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            (p.nickname && p.nickname.toLowerCase().includes(search.toLowerCase()));
      return matchesCat && matchesSearch;
  });

  const handleSave = () => {
      if (editingPlayer) {
          dispatch({ type: 'UPDATE_PLAYER', payload: editingPlayer });
          setEditingPlayer(null);
      }
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

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-3xl font-bold text-slate-900">Gestión Jugadores</h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={20}/>
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                placeholder="Buscar por nombre..."
              />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => setFilterCat('all')}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCat === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                  Todos
              </button>
              {TOURNAMENT_CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors uppercase ${filterCat === cat ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                      {cat}
                  </button>
              ))}
          </div>
      </div>

      {/* List */}
      <div className="space-y-3">
          {filteredPlayers.map(player => (
              <div key={player.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <User size={20} />
                      </div>
                      <div>
                          <div className="font-bold text-slate-800">{player.name}</div>
                          <div className="text-xs text-slate-500 flex flex-wrap gap-1 mt-1">
                              {player.categories && player.categories.length > 0 ? (
                                  player.categories.map(c => (
                                      <span key={c} className="bg-slate-100 px-1.5 rounded text-slate-600 font-bold uppercase text-[10px]">{c}</span>
                                  ))
                              ) : <span className="text-slate-300">Sin categoría</span>}
                              {player.nickname && <span className="italic text-slate-400 ml-1">"{player.nickname}"</span>}
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={() => navigate(`/players/${player.id}`)}
                        className="p-2 text-slate-400 hover:text-emerald-600 bg-slate-50 rounded-lg border border-slate-100 transition-colors"
                      >
                          <Eye size={20} />
                      </button>
                      <button onClick={() => setEditingPlayer(player)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg border border-slate-100 transition-colors">
                          <Edit2 size={20} />
                      </button>
                  </div>
              </div>
          ))}
          {filteredPlayers.length === 0 && <div className="text-center py-10 text-slate-400">No se encontraron jugadores.</div>}
      </div>

      {/* Edit Modal */}
      {editingPlayer && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
                  <h3 className="text-xl font-bold mb-6 text-slate-900">Editar Jugador</h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
                          <input value={editingPlayer.name} onChange={e => setEditingPlayer({...editingPlayer, name: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1" />
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Apodo</label>
                          <input value={editingPlayer.nickname || ''} onChange={e => setEditingPlayer({...editingPlayer, nickname: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1" />
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categorías</label>
                        <div className="flex flex-wrap gap-2">
                            {TOURNAMENT_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => toggleEditCategory(cat)}
                                    className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${editingPlayer.categories?.includes(cat) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-300'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                          <input value={editingPlayer.email || ''} onChange={e => setEditingPlayer({...editingPlayer, email: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label>
                          <input value={editingPlayer.phone || ''} onChange={e => setEditingPlayer({...editingPlayer, phone: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1" />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                      <button onClick={() => setEditingPlayer(null)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                      <button onClick={handleSave} className="py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Save size={18}/> Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlayerManager;
