
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { ArrowLeft, Trophy, Medal, Edit2, Save, Calendar, User, Smartphone, Mail, Activity, BarChart2, Hash, Trash2, ArrowRightCircle, ArrowLeftCircle, Check, Shuffle } from 'lucide-react';
import { Modal, StatCard, useToast } from '../components';
import { TournamentState, TournamentMatch as Match } from '../types';
import { calculateDisplayRanking, manualToElo, calculateInitialElo, getPairTeamElo, calculateMatchDelta } from '../utils/Elo';
import { THEME } from '../utils/theme';

const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { state, updatePlayerInDB, deletePlayerDB, formatPlayerName } = useTournament();
  const { pastTournaments } = useHistory();
  const { error: showError } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const player = state.players.find(p => p.id === playerId);
  const [editForm, setEditForm] = useState(player || { name: '', nickname: '', categories: [] as string[], email: '', phone: '', id: '', manual_rating: 5, preferred_position: undefined as 'right' | 'backhand' | undefined, play_both_sides: false });

  const stats = useMemo(() => {
      if (!playerId || !player) return null;
      const result = { matchesPlayed: 0, wins: 0, losses: 0, mainTitles: 0, consTitles: 0, matchHistory: [] as any[] };

      const getRoundLabel = (m: Match) => {
          let label = '';
          if (m.phase === 'group') label = `R${m.round}`;
          else if (m.phase === 'qf') label = 'Cuartos';
          else if (m.phase === 'sf') label = 'Semis';
          else if (m.phase === 'final') label = 'Final';
          else label = `R${m.round}`;

          if (m.bracket === 'consolation') return `${label} Cons.`;
          return label;
      };

      const processTournamentData = (tData: TournamentState, date: string) => {
          const playerPairs = tData.pairs.filter(p => p.player1Id === playerId || p.player2Id === playerId);
          
          playerPairs.forEach(pair => {
               const partnerId = pair.player1Id === playerId ? pair.player2Id : pair.player1Id;
               const partner = tData.players.find(p => p.id === partnerId);
               const partnerName = formatPlayerName(partner);
               
               // Estimate My Team ELO for delta calc
               const myTeamElo = partner ? getPairTeamElo(player, partner) : 1200;

               const matches = tData.matches.filter(m => m.pairAId === pair.id || m.pairBId === pair.id);
               matches.forEach(m => {
                   if (!m.isFinished) return;
                   result.matchesPlayed++;
                   const isPairA = m.pairAId === pair.id;
                   const won = (isPairA && (m.scoreA || 0) > (m.scoreB || 0)) || (!isPairA && (m.scoreB || 0) > (m.scoreA || 0));
                   if (won) {
                       result.wins++;
                       if (m.round === 7) {
                           if (m.bracket === 'main') result.mainTitles++;
                           else if (m.bracket === 'consolation') result.consTitles++;
                       }
                   } else {
                       result.losses++;
                   }
                   
                   const opponentPairId = isPairA ? m.pairBId : m.pairAId;
                   const oppPair = tData.pairs.find(p => p.id === opponentPairId);
                   let oppNames = 'Desconocido';
                   let oppTeamElo = 1200;

                   if (oppPair) {
                       const p1 = tData.players.find(p => p.id === oppPair.player1Id);
                       const p2 = tData.players.find(p => p.id === oppPair.player2Id);
                       if (p1 && p2) oppTeamElo = getPairTeamElo(p1, p2);
                       oppNames = `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
                   }
                   
                   // Calculate ELO Delta (Estimated)
                   // If I am Pair A, use normal delta. If I am Pair B, use inverse? 
                   // calculateMatchDelta gives change for A.
                   // If A wins, delta > 0. If B wins, delta < 0.
                   // If I am B, my change is -delta.
                   const rawDelta = calculateMatchDelta(myTeamElo, oppTeamElo, m.scoreA || 0, m.scoreB || 0);
                   const myDelta = isPairA ? rawDelta : -rawDelta;

                   result.matchHistory.push({
                       id: m.id, date: date, roundLabel: getRoundLabel(m),
                       partner: partnerName, opponent: oppNames, score: `${m.scoreA}-${m.scoreB}`, result: won ? 'W' : 'L',
                       eloDelta: myDelta
                   });
               });
          });
      };

      pastTournaments.forEach(pt => { if (pt.data) processTournamentData(pt.data, pt.date); });
      if (state.status !== 'setup') { processTournamentData(state, new Date().toISOString()); }
      result.matchHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return result;
  }, [playerId, state, pastTournaments, formatPlayerName]);

  if (!player) return <div className="p-6 text-center">Jugador no encontrado</div>;

  const handleSave = () => { updatePlayerInDB(editForm); setIsEditing(false); };
  
  const handleDelete = async () => {
      try {
          await deletePlayerDB(player.id);
          navigate('/players');
      } catch (e: any) {
          showError("Error al eliminar: " + e.message);
      }
  };

  const toggleEditCategory = (cat: string) => { setEditForm(prev => { const cats = prev.categories || []; const exists = cats.includes(cat); return { ...prev, categories: exists ? cats.filter(c => c !== cat) : [...cats, cat] }; }); };

  // Calculate Ratings for Display
  const currentRanking = calculateDisplayRanking(player);
  const rawStatsElo = player.global_rating || 1200;
  const manualVal = player.manual_rating || 5;

  // VISUAL PROGRESS (Relative to category 1000 points range)
  const rangeFloor = Math.floor(currentRanking / 1000) * 1000;
  const rangeCeiling = rangeFloor + 1000;
  const progressPercent = Math.max(0, Math.min(100, ((currentRanking - rangeFloor) / 1000) * 100));

  // --- AVATAR LOGIC ---
  const getInitials = (name: string) => {
    return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };
  
  const getAvatarColor = (name: string) => {
    const colors = [
        'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 
        'bg-indigo-500', 'bg-purple-500', 'bg-teal-500', 'bg-cyan-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6 pb-20">
       <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">Perfil de Jugador</h2>
          <button onClick={() => setIsEditing(true)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors"><Edit2 size={20} /></button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
               <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-black shrink-0 ${getAvatarColor(player.name)}`}>
                   {getInitials(player.name)}
               </div>
               <div className="flex flex-col items-start min-w-0">
                   <h1 className="text-3xl font-black text-slate-900 leading-none mb-1">{player.nickname || player.name.split(' ')[0]}</h1>
                   <div className="text-sm font-bold text-slate-400 mb-3">{player.name}</div>
                   <div className="flex flex-wrap gap-2">
                       {player.categories?.map(c => <span key={c} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">{c}</span>)}
                       {player.preferred_position && (
                           <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-wider border border-indigo-100 flex items-center gap-1">
                               {player.preferred_position === 'right' ? 'Derecha' : 'Revés'}
                               {player.play_both_sides && <Shuffle size={10} className="text-emerald-500"/>}
                           </span>
                       )}
                   </div>
               </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 border-t border-slate-100 pt-6 mt-6">
               <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl"><Smartphone size={18} className="text-emerald-500"/><span>{player.phone || 'Sin teléfono'}</span></div>
               <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl"><Mail size={18} className="text-blue-500"/><span className="truncate">{player.email || 'Sin email'}</span></div>
          </div>
      </div>

      {/* ELO & RANKING CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart2 size={100} /></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Nivel de Juego</h3>
          
          <div className="flex items-end justify-between mb-2">
              <div>
                  <div className="text-4xl font-black text-white">{currentRanking}</div>
                  <div className="text-xs text-emerald-400 font-bold uppercase">Ranking PadelPro</div>
              </div>
              <div className="text-right">
                   <div className="text-xl font-bold text-slate-300">{manualVal} <span className="text-xs text-slate-500">/10</span></div>
                   <div className="text-[10px] text-slate-500 uppercase">Val. Manual</div>
              </div>
          </div>
          
          {/* VISUAL ELO BAR (CATEGORY RANGE) */}
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
              <span>Progreso Categoría</span>
              <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden mb-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-4">
              <span>{rangeFloor}</span>
              <span>{rangeCeiling}</span>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-700 pt-3">
              <span>Estadístico: <span className="text-white font-bold">{rawStatsElo}</span> (Base)</span>
              <span>Ajuste: <span className="text-white font-bold">{manualToElo(manualVal)} pts</span></span>
          </div>
      </div>

      {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard value={stats.matchesPlayed} label="Partidos" icon={<Hash size={20}/>}/>
              <StatCard value={stats.matchesPlayed > 0 ? `${Math.round((stats.wins / stats.matchesPlayed) * 100)}%` : '0%'} label="Win Rate" icon={<Activity size={20}/>} valueColor="danger"/>
              <StatCard value={stats.mainTitles} label="Campeón" icon={<Trophy size={20}/>} valueColor="success"/>
              <StatCard value={stats.consTitles} label="Consolación" icon={<Medal size={20}/>} valueColor="brand"/>
          </div>
      )}

      <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Calendar size={20} className="text-slate-400"/> Historial</h3>
          <div className="space-y-3">
              {stats?.matchHistory.map((match, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex justify-between items-center">
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded-full uppercase">{match.roundLabel}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${match.result === 'W' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{match.result === 'W' ? 'Victoria' : 'Derrota'}</span>
                              <span className="text-xs text-slate-400 font-medium">{new Date(match.date).toLocaleDateString()}</span>
                          </div>
                          <div className="text-sm font-bold text-slate-800 mt-1"><span className="text-slate-400 font-normal">con</span> {match.partner} <span className="text-slate-400 font-normal">vs</span> {match.opponent}</div>
                      </div>
                      <div className="flex flex-col items-end">
                          <div className="text-xl font-black text-slate-900 tracking-tight">{match.score}</div>
                          {match.eloDelta !== 0 && (
                              <div className={`text-xs font-bold px-1.5 rounded flex items-center ${match.eloDelta > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                                  {match.eloDelta > 0 ? '+' : ''}{match.eloDelta} ELO
                              </div>
                          )}
                      </div>
                  </div>
              ))}
              {stats?.matchHistory.length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No hay partidos registrados aún.
                  </div>
              )}
          </div>
      </div>

      <Modal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          title="Editar Perfil"
          size="md"
          actions={[
              { label: 'Cancelar', onClick: () => setIsEditing(false), variant: 'secondary' },
              { label: 'Guardar', onClick: handleSave, variant: 'primary' },
          ]}
      >
          <div className="space-y-4 text-left">
              <div><label className="text-xs font-bold text-slate-500 uppercase">Nombre</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Apodo</label><input value={editForm.nickname || ''} onChange={e => setEditForm({...editForm, nickname: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Posición Predilecta</label>
                  <div className="flex gap-2">
                      <button onClick={() => setEditForm({...editForm, preferred_position: 'right'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all border ${editForm.preferred_position === 'right' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}>
                          <ArrowRightCircle size={14}/> Derecha
                      </button>
                      <button onClick={() => setEditForm({...editForm, preferred_position: 'backhand'})} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all border ${editForm.preferred_position === 'backhand' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}>
                          <ArrowLeftCircle size={14}/> Revés
                      </button>
                  </div>
                  <div onClick={() => setEditForm({...editForm, play_both_sides: !editForm.play_both_sides})} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${editForm.play_both_sides ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${editForm.play_both_sides ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                          {editForm.play_both_sides && <Check size={10} className="text-white"/>}
                      </div>
                      <span className={`text-xs font-bold ${editForm.play_both_sides ? 'text-emerald-700' : 'text-slate-500'}`}>Se adapta al otro lado (Versátil)</span>
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1"><Trophy size={12}/> Valoración Manual (1-10)</label>
                  <div className="flex items-center gap-4 mt-1">
                      <input type="range" min="1" max="10" step="0.5" value={editForm.manual_rating || 5} onChange={e => setEditForm({...editForm, manual_rating: parseFloat(e.target.value)})} className="w-full accent-amber-500" />
                      <span className="font-bold text-xl text-amber-700">{editForm.manual_rating || 5}</span>
                  </div>
                  <div className="mt-3 flex justify-between items-center text-xs">
                      <div><span className="block text-slate-400 uppercase">Ajuste</span><span className="font-bold text-amber-600">{manualToElo(editForm.manual_rating || 5) > 0 ? '+' : ''}{manualToElo(editForm.manual_rating || 5)} pts</span></div>
                      <div className="text-right"><span className="block text-slate-400 uppercase">ELO Final</span><span style={{ color: THEME.cta }} className="font-black text-lg transition-all">{calculateInitialElo(editForm.categories || [], editForm.manual_rating || 5)} pts</span></div>
                  </div>
              </div>
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categorías</label>
                  <div className="flex flex-wrap gap-2">
                      {TOURNAMENT_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => toggleEditCategory(cat)} className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${editForm.categories?.includes(cat) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-300'}`}>{cat}</button>
                      ))}
                  </div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Email</label><input value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Teléfono</label><input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
          </div>
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
    </div>
  );
};

export default PlayerProfile;
