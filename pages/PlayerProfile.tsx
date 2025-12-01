import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament, TOURNAMENT_CATEGORIES } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { ArrowLeft, Trophy, Medal, Edit2, Save, Calendar, User, Smartphone, Mail, Activity, Grid } from 'lucide-react';
import { TournamentState } from '../types';

const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { state, updatePlayerInDB, formatPlayerName } = useTournament(); // Use helper
  const { pastTournaments } = useHistory();
  
  const [isEditing, setIsEditing] = useState(false);

  const player = state.players.find(p => p.id === playerId);
  const [editForm, setEditForm] = useState(player || { name: '', nickname: '', categories: [] as string[], email: '', phone: '', id: '', paid: false });

  const stats = useMemo(() => {
      if (!playerId) return null;
      const result = { matchesPlayed: 0, wins: 0, losses: 0, mainTitles: 0, consTitles: 0, matchHistory: [] as any[] };

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
                       id: m.id, date: date, roundLabel: m.round <= 4 ? `R${m.round}` : 'PO',
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

  return (
    <div className="space-y-6 pb-20">
       <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600"><ArrowLeft size={20} /></button>
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">Perfil de Jugador</h2>
          <div className="w-10"></div> 
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4"><button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Edit2 size={20} /></button></div>
          <div className="flex flex-col items-center text-center mb-6">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 border-4 border-slate-50 shadow-inner"><User size={40} /></div>
               <h1 className="text-2xl font-black text-slate-900">{formatPlayerName(player)}</h1> {/* Use helper */}
               <div className="mt-2 flex flex-wrap justify-center gap-2">{player.categories?.map(c => <span key={c} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase">{c}</span>)}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 border-t border-slate-100 pt-4">
               <div className="flex items-center gap-3 p-2"><Smartphone size={18} className="text-emerald-500"/><span>{player.phone || 'Sin teléfono'}</span></div>
               <div className="flex items-center gap-3 p-2"><Mail size={18} className="text-blue-500"/><span className="truncate">{player.email || 'Sin email'}</span></div>
          </div>
      </div>

      {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2">
                   <div className="flex justify-between items-start mb-2"><div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><Activity size={20}/></div><span className="text-xs font-bold text-slate-400 uppercase">Win Rate</span></div>
                   <div className="flex items-end gap-2"><span className="text-4xl font-black text-slate-900">{stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0}%</span><span className="text-xs text-slate-500 mb-1 font-medium">{stats.wins}V - {stats.losses}D</span></div>
                   <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden"><div className="bg-rose-500 h-full rounded-full" style={{ width: `${stats.matchesPlayed > 0 ? (stats.wins / stats.matchesPlayed) * 100 : 0}%` }}></div></div>
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
                          <div className="flex items-center gap-2 mb-1"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${match.result === 'W' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{match.result === 'W' ? 'Victoria' : 'Derrota'}</span><span className="text-xs text-slate-400 font-medium">{new Date(match.date).toLocaleDateString()}</span></div>
                          <div className="text-sm font-bold text-slate-800"><span className="text-slate-400 font-normal">con</span> {match.partner} <span className="text-slate-400 font-normal">vs</span> {match.opponent}</div>
                      </div>
                      <div className="text-xl font-black text-slate-900 tracking-tight">{match.score}</div>
                  </div>
              ))}
          </div>
      </div>

      {isEditing && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-6 text-slate-900">Editar Perfil</h3>
                  <div className="space-y-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Nombre</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Apodo</label><input value={editForm.nickname || ''} onChange={e => setEditForm({...editForm, nickname: e.target.value})} className="w-full border border-slate-300 rounded-lg p-3 mt-1 bg-white text-slate-900" /></div>
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