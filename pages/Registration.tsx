import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { UserPlus, Users, Trash2, Save } from 'lucide-react';

type ViewMode = 'menu' | 'player-form' | 'pair-form';

const Registration: React.FC = () => {
  const { state, addPlayerToDB, createPairInDB, deletePairDB, startTournamentDB } = useTournament();
  const [viewMode, setViewMode] = useState<ViewMode>('menu');

  // Player Form
  const [playerForm, setPlayerForm] = useState({ name: '', nickname: '', phone: '', email: '', categories: [] as string[] });

  // Pair Form
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerForm.name.trim()) return;
    
    await addPlayerToDB(playerForm);
    setPlayerForm({ name: '', nickname: '', phone: '', email: '', categories: [] });
    setViewMode('menu');
  };

  const toggleCategory = (cat: string) => {
      setPlayerForm(prev => {
          const exists = prev.categories.includes(cat);
          return {
              ...prev,
              categories: exists ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat]
          };
      });
  };

  const handleCreatePair = async () => {
    if (!selectedP1 || !selectedP2) {
        alert("Selecciona dos jugadores.");
        return;
    }
    await createPairInDB(selectedP1, selectedP2);
    setSelectedP1('');
    setSelectedP2('');
    setViewMode('menu');
  };

  const activePairs = state.pairs || [];

  const PairList = ({ pairs, title, colorClass }: { pairs: any[], title: string, colorClass: string }) => (
      <div className="mt-8">
            <h3 className={`text-sm uppercase font-bold mb-4 tracking-wider ${colorClass}`}>{title}</h3>
            <div className="space-y-3">
                {pairs.map((pair, idx) => {
                    const p1 = state.players.find(p => p.id === pair.player1Id);
                    const p2 = state.players.find(p => p.id === pair.player2Id);
                    return (
                        <div key={pair.id} className="bg-white p-5 rounded-xl flex items-center justify-between border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-4 overflow-hidden w-full">
                                <span className="bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 text-slate-500 border border-slate-200">
                                    {idx + 1}
                                </span>
                                <div className="flex flex-col w-full">
                                    <div className="text-lg font-semibold text-slate-800 truncate">{p1?.name}</div>
                                    <div className="text-lg font-semibold text-slate-800 truncate text-slate-600">& {p2?.name}</div>
                                </div>
                            </div>
                            <button onClick={() => deletePairDB(pair.id)} className="p-3 text-slate-400 hover:text-red-600 bg-slate-50 rounded-xl border border-slate-200"><Trash2 size={20}/></button>
                        </div>
                    )
                })}
                 {pairs.length === 0 && <p className="text-slate-400 text-sm italic p-4 text-center">No hay parejas registradas.</p>}
            </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Registro</h2>
            <p className="text-sm text-slate-500">Gestión de Inscripciones</p>
        </div>
        <div className={`flex flex-col items-end ${activePairs.length === 16 ? 'text-emerald-600' : 'text-blue-600'}`}>
            <span className="text-4xl font-bold">{activePairs.length}<span className="text-xl text-slate-300">/16</span></span>
        </div>
      </div>

      {viewMode === 'menu' && (
          <>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setViewMode('player-form')}
                    className="bg-white hover:bg-blue-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all shadow-sm active:scale-95 group"
                >
                    <div className="bg-blue-100 p-4 rounded-full text-blue-600 group-hover:bg-blue-200">
                        <UserPlus size={36} />
                    </div>
                    <span className="font-bold text-slate-700 text-lg text-center">Añadir Jugador</span>
                </button>

                <button 
                    onClick={() => setViewMode('pair-form')}
                    className="bg-white hover:bg-emerald-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all shadow-sm active:scale-95 group"
                >
                    <div className="bg-emerald-100 p-4 rounded-full text-emerald-600 group-hover:bg-emerald-200">
                        <Users size={36} />
                    </div>
                    <span className="font-bold text-slate-700 text-lg text-center">Crear Pareja</span>
                </button>
            </div>

            <PairList pairs={activePairs} title="Parejas" colorClass="text-emerald-600" />

            {activePairs.length >= 2 && state.status === 'setup' && (
                <div className="fixed bottom-20 left-4 right-4 z-40">
                    <button 
                        onClick={startTournamentDB}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-5 rounded-2xl font-bold shadow-xl text-2xl animate-pulse"
                    >
                        EMPEZAR TORNEO
                    </button>
                </div>
            )}
          </>
      )}

      {viewMode === 'player-form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Nuevo Jugador</h3>
              <form onSubmit={handleAddPlayer} className="space-y-5">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre Completo</label>
                      <input 
                        required
                        value={playerForm.name}
                        onChange={e => setPlayerForm({...playerForm, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 text-lg focus:border-blue-500 outline-none mt-2"
                        placeholder="Ej: Juan Pérez"
                      />
                  </div>
                  <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Apodo</label>
                        <input 
                            value={playerForm.nickname}
                            onChange={e => setPlayerForm({...playerForm, nickname: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 focus:border-blue-500 outline-none mt-2"
                            placeholder="Ej: Juani"
                        />
                  </div>
                  <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Categorías</label>
                        <div className="flex flex-wrap gap-2">
                            {TOURNAMENT_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${playerForm.categories.includes(cat) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                      <button type="button" onClick={() => setViewMode('menu')} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button>
                      <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">Guardar</button>
                  </div>
              </form>
          </div>
      )}

      {viewMode === 'pair-form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Crear Pareja</h3>
              <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Jugador 1</label>
                    <select value={selectedP1} onChange={e => setSelectedP1(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-300 text-lg">
                        <option value="">Seleccionar...</option>
                        {state.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Jugador 2</label>
                    <select value={selectedP2} onChange={e => setSelectedP2(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-300 text-lg">
                        <option value="">Seleccionar...</option>
                        {state.players.filter(p => p.id !== selectedP1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-4">
                      <button onClick={() => setViewMode('menu')} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button>
                      <button onClick={handleCreatePair} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">Crear</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Registration;