
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { ArrowLeft, Trophy, Medal, Edit2, Save, Calendar, User, Smartphone, Mail, Activity, BarChart2, Hash } from 'lucide-react';
import { TournamentState, Match } from '../types';
import { calculateDisplayRanking, manualToElo } from '../utils/Elo';

const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { state, updatePlayerInDB, formatPlayerName } = useTournament(); // Use helper
  const { pastTournaments } = useHistory();
  
  const [isEditing, setIsEditing] = useState(false);

  const player = state.players.find(p => p.id === playerId);
  const [editForm, setEditForm] = useState(player || { name: '', nickname: '', categories: [] as string[], email: '', phone: '', id: '', manual_rating: 5 });

  const stats = useMemo(() => {
      if (!playerId) return null;
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
                   if (oppPair) {
                       const p1 = tData.players.find(p => p.id === oppPair.player1Id);
                       const p2 = tData.players.find(p => p.id === oppPair.player2Id);
                       oppNames = `${formatPlayerName(p1)} & ${formatPlayerName(p2)}`;
                   }
                   result.matchHistory.push({
                       id: m.id, date: date, roundLabel: getRoundLabel(m),
                       partner: partnerName, opponent: oppNames, score: `${m.scoreA}-${m.scoreB}`, result: won ? 'W' : 'L'
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
  const toggleEditCategory = (cat: string) => { setEditForm(prev => { const cats = prev.categories || []; const exists = cats.includes(cat); return { ...prev, categories: exists ? cats.filter(c => c !== cat) : [...cats, cat] }; }); };

  // Calculate Ratings for Display
  const currentRanking = calculateDisplayRanking(player);
  const rawStatsElo = player.global_rating || 1200;
  const manualVal = player.manual_rating || 5;

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
          <div className="w-10"></div> 
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4"><button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Edit2 size={20} /></button></div>
          
          <div className="flex items-center gap-6">
               <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-inner border-4 border-slate-50 ${getAvatarColor(player.name)}`}>
                   {getInitials(player.name)}
               </div>
               <div className="flex flex-col items-start">
                   <h1 className="text-3xl font-black text-slate-900 leading-none mb-1">{player.nickname || player.name.split(' ')[0]}</h1>
                   <div className="text-sm font-bold text-slate-400 mb-3">{player.name}</div>
                   <div className="flex flex-wrap gap-2">
                       {player.categories?.map(c => <span key={c} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">{c}</span>)}
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
          
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-4">
              {/* Visual bar relative to max 2000 */}
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min((currentRanking / 2000) * 100, 100)}%` }}></div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-700 pt-3">
              <span>Estadístico: <span className="text-white font-bold">{rawStatsElo}</span> (70%)</span>
              <span>Manual: <span className="text-white font-bold">{manualToElo(manualVal)}</span> (30%)</span>
          </div>
      </div>

      {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               {/* Total Matches Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <Hash size={24} className="text-slate-500 mb-2"/>
                  <span className="text-2xl font-black text-slate-900">{stats.matchesPlayed}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Partidos</span>
              </div>

              {/* Win Rate (UNIFIED DESIGN) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                   <Activity size={24} className="text-rose-500 mb-2"/>
                   <span className="text-2xl font-black text-slate-900">{stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0}%</span>
                   <span className="text-[10px] uppercase font-bold text-slate-400 text-center">Win Rate</span>
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center"><Trophy size={24} className="text-emerald-500 mb-2"/><span className="text-2xl font-black text-slate-900">{stats.mainTitles}</span><span className="text-[10px] uppercase font-bold text-slate-400 text-center">Campeón</span></div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center"><Medal size={24} className="text-blue-500 mb-2"/><span className="text-2xl font-black text-slate-900">{stats.consTitles}</span><span className="text-[10px] uppercase font-bold text-slate-400 text-center">Consolación</span></div>
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
                      <div className="text-xl font-black text-slate-900 tracking-tight">{match.score}</div>
                  </div>
              ))}
              {stats?.matchHistory.length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No hay partidos registrados aún.
                  </div>
              )}
          </div>
      </div>

      {isEditing && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-6 text-slate-900">Editar Perfil</h3>
                  <div className="space-y-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Nombre</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Apodo</label><input value={editForm.nickname || ''} onChange={e => setEditForm({...editForm, nickname: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
                      
                      {/* MANUAL RATING SLIDER */}
                      <div>
                          <label className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1"><Trophy size={12}/> Valoración Manual (1-10)</label>
                          <div className="flex items-center gap-4 mt-1">
                              <input 
                                type="range" min="1" max="10" step="0.5"
                                value={editForm.manual_rating || 5} 
                                onChange={e => setEditForm({...editForm, manual_rating: parseFloat(e.target.value)})} 
                                className="w-full accent-amber-500" 
                              />
                              <span className="font-bold text-xl text-amber-700">{editForm.manual_rating || 5}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Afecta al 30% del Ranking PadelPro.</p>
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
                  <div className="grid grid-cols-2 gap-4 mt-8">
                      <button onClick={() => setIsEditing(false)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
                      <button onClick={handleSave} className="py-3 bg-emerald-600 text-white rounded-xl font-bold"><Save size={18} className="inline mr-2"/> Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlayerProfile;
