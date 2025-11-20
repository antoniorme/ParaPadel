
import React, { useState } from 'react';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { UserPlus, Users, Check, ArrowLeft, Trash2, Edit2, Save } from 'lucide-react';

type ViewMode = 'menu' | 'player-form' | 'pair-form';

const Registration: React.FC = () => {
  const { state, dispatch } = useTournament();
  const [viewMode, setViewMode] = useState<ViewMode>('menu');

  // Player Form State
  const [playerForm, setPlayerForm] = useState({
    name: '',
    nickname: '',
    phone: '',
    email: '',
    categories: [] as string[],
    saveRecord: false
  });

  // Pair Form State
  const [isEditingPairId, setIsEditingPairId] = useState<string | null>(null);
  const [pairType, setPairType] = useState<'existing' | 'guest'>('existing');
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');
  const [guestP1Name, setGuestP1Name] = useState('');
  const [guestP2Name, setGuestP2Name] = useState('');

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerForm.name.trim()) return;
    
    dispatch({
      type: 'ADD_PLAYER',
      payload: {
        id: Date.now().toString(),
        name: playerForm.name,
        nickname: playerForm.nickname,
        phone: playerForm.phone,
        email: playerForm.email,
        categories: playerForm.categories,
        saveRecord: playerForm.saveRecord,
        paid: false
      }
    });
    setPlayerForm({ name: '', nickname: '', phone: '', email: '', categories: [], saveRecord: false });
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

  const handleCreateOrUpdatePair = () => {
    if (!isEditingPairId && state.pairs.length >= 20) {
        alert("Límite máximo de parejas alcanzado.");
        return;
    }

    if (pairType === 'existing') {
        if (!selectedP1 || !selectedP2 || selectedP1 === selectedP2) {
            alert("Selecciona dos jugadores distintos.");
            return;
        }
        const payload = { pairId: isEditingPairId!, player1Id: selectedP1, player2Id: selectedP2 };
        if (isEditingPairId) dispatch({ type: 'UPDATE_PAIR', payload });
        else dispatch({ type: 'CREATE_PAIR', payload });
    } else {
        if (!guestP1Name.trim() || !guestP2Name.trim()) return alert("Introduce nombres.");
        const p1Id = `guest-${Date.now()}-1`;
        const p2Id = `guest-${Date.now()}-2`;

        dispatch({ type: 'ADD_PLAYER', payload: { id: p1Id, name: guestP1Name, nickname: '', paid: false, categories: [] } });
        dispatch({ type: 'ADD_PLAYER', payload: { id: p2Id, name: guestP2Name, nickname: '', paid: false, categories: [] } });

        setTimeout(() => {
            const payload = { pairId: isEditingPairId!, player1Id: p1Id, player2Id: p2Id };
            if (isEditingPairId) dispatch({ type: 'UPDATE_PAIR', payload });
            else dispatch({ type: 'CREATE_PAIR', payload });
        }, 50);
    }
    // Reset
    setSelectedP1(''); setSelectedP2(''); setGuestP1Name(''); setGuestP2Name('');
    setIsEditingPairId(null); setViewMode('menu');
  };

  const handleEditPair = (pairId: string) => {
      const pair = state.pairs.find(p => p.id === pairId);
      if (!pair) return;
      setSelectedP1(pair.player1Id); setSelectedP2(pair.player2Id);
      setIsEditingPairId(pairId); setPairType('existing'); setViewMode('pair-form');
  };

  const handleDeletePair = (pairId: string) => {
      if (window.confirm('¿Eliminar esta pareja?')) dispatch({ type: 'DELETE_PAIR', payload: pairId });
  };

  const activePairs = state.pairs.filter(p => !p.isReserve);
  const reservePairs = state.pairs.filter(p => p.isReserve);
  const assignedPlayerIds = state.pairs.flatMap(p => [p.player1Id, p.player2Id]);
  const availablePlayers = state.players.filter(p => {
      if (isEditingPairId) {
          const pair = state.pairs.find(pr => pr.id === isEditingPairId);
          if (pair && (p.id === pair.player1Id || p.id === pair.player2Id)) return true;
      }
      return !assignedPlayerIds.includes(p.id);
  });

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
                                    {title === 'Reservas' ? `R${idx + 1}` : idx + 1}
                                </span>
                                <div className="flex flex-col w-full">
                                    <div className="text-lg font-semibold text-slate-800 truncate">{p1?.name}</div>
                                    <div className="text-lg font-semibold text-slate-800 truncate text-slate-600">& {p2?.name}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                <button onClick={() => handleEditPair(pair.id)} className="p-3 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-xl border border-slate-200"><Edit2 size={20}/></button>
                                <button onClick={() => handleDeletePair(pair.id)} className="p-3 text-slate-400 hover:text-red-600 bg-slate-50 rounded-xl border border-slate-200"><Trash2 size={20}/></button>
                            </div>
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
                    onClick={() => {
                        setIsEditingPairId(null); setPairType('existing'); setSelectedP1(''); setSelectedP2(''); setViewMode('pair-form');
                    }}
                    className="bg-white hover:bg-emerald-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all shadow-sm active:scale-95 group"
                >
                    <div className="bg-emerald-100 p-4 rounded-full text-emerald-600 group-hover:bg-emerald-200">
                        <Users size={36} />
                    </div>
                    <span className="font-bold text-slate-700 text-lg text-center">Crear Pareja</span>
                </button>
            </div>

            <PairList pairs={activePairs} title="Titulares" colorClass="text-emerald-600" />
            {reservePairs.length > 0 && <PairList pairs={reservePairs} title="Reservas" colorClass="text-orange-600" />}

            {state.pairs.length > 0 && (
                 <div className="mt-10 flex justify-center">
                     <button 
                         onClick={() => { if(window.confirm('¿Borrar todo el torneo?')) dispatch({type: 'RESET_TOURNAMENT'}); }}
                         className="text-sm text-red-500 flex items-center gap-2 px-6 py-3 border border-red-200 rounded-full hover:bg-red-50"
                     >
                         <Trash2 size={16}/> Resetear Torneo
                     </button>
                 </div>
            )}

            {activePairs.length >= 16 && state.status === 'setup' && (
                <div className="fixed bottom-20 left-4 right-4 z-40">
                    <button 
                        onClick={() => dispatch({ type: 'START_TOURNAMENT' })}
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
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setViewMode('menu')} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200">
                      <ArrowLeft size={24} className="text-slate-600" />
                  </button>
                  <h3 className="text-xl font-bold text-slate-800">Nuevo Jugador</h3>
              </div>
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
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Categorías (Selecciona varias)</label>
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

                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Teléfono</label>
                      <input 
                        type="tel"
                        value={playerForm.phone}
                        onChange={e => setPlayerForm({...playerForm, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 focus:border-blue-500 outline-none mt-2"
                        placeholder="600 000 000"
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label>
                      <input 
                        type="email"
                        value={playerForm.email}
                        onChange={e => setPlayerForm({...playerForm, email: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 focus:border-blue-500 outline-none mt-2"
                        placeholder="juan@example.com"
                      />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer border border-slate-200 mt-4" onClick={() => setPlayerForm(p => ({...p, saveRecord: !p.saveRecord}))}>
                      <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${playerForm.saveRecord ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400 bg-white'}`}>
                          {playerForm.saveRecord && <Check size={16} className="text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">Guardar en base de datos</span>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 py-4 rounded-xl font-bold text-white text-lg shadow-lg mt-6 active:scale-95 transition-transform">
                      Guardar Jugador
                  </button>
              </form>
          </div>
      )}

      {viewMode === 'pair-form' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
               <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setViewMode('menu')} className="p-2 hover:bg-slate-100 rounded-full border border-slate-200">
                      <ArrowLeft size={24} className="text-slate-600" />
                  </button>
                  <h3 className="text-xl font-bold text-slate-800">{isEditingPairId ? 'Editar Pareja' : 'Crear Pareja'}</h3>
              </div>

              {!isEditingPairId && (
                <div className="flex bg-slate-100 p-1.5 rounded-xl mb-8">
                    <button onClick={() => setPairType('existing')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${pairType === 'existing' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>Registrados</button>
                    <button onClick={() => setPairType('guest')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${pairType === 'guest' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>Invitados</button>
                </div>
              )}

              {pairType === 'existing' ? (
                  <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Jugador 1</label>
                        <select value={selectedP1} onChange={e => setSelectedP1(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-300 text-lg">
                            <option value="">Seleccionar...</option>
                            {availablePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Jugador 2</label>
                        <select value={selectedP2} onChange={e => setSelectedP2(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-300 text-lg">
                            <option value="">Seleccionar...</option>
                            {availablePlayers.filter(p => p.id !== selectedP1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                  </div>
              ) : (
                  <div className="space-y-6">
                       <input value={guestP1Name} onChange={e => setGuestP1Name(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-300 text-lg" placeholder="Nombre Jugador 1" />
                       <input value={guestP2Name} onChange={e => setGuestP2Name(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl text-slate-900 border border-slate-300 text-lg" placeholder="Nombre Jugador 2" />
                  </div>
              )}

              <button onClick={handleCreateOrUpdatePair} className="w-full bg-emerald-600 py-4 rounded-xl font-bold text-white text-lg shadow-lg mt-8 flex items-center justify-center gap-2">
                  <Save size={24}/> {isEditingPairId ? 'Actualizar' : 'Guardar'}
              </button>
          </div>
      )}
    </div>
  );
};

export default Registration;
