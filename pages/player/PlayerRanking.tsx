import React, { useState, useEffect } from 'react';
import { useHistory } from '../../store/HistoryContext';
import { useTournament } from '../../store/TournamentContext';
import { THEME } from '../../utils/theme';
import { calculateDisplayRanking } from '../../utils/Elo';
import { Award, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types';

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const MEDAL = ['🥇', '🥈', '🥉'];

const PlayerRanking: React.FC = () => {
  const { clubData } = useHistory();
  const { state } = useTournament();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('Todos');

  const [myPlayerId] = useState<string>(() => localStorage.getItem('padel_sim_player_id') || '');

  useEffect(() => {
    const clubId = clubData?.id || state.players[0]?.user_id;
    if (!clubId) { setLoading(false); return; }

    supabase
      .from('players')
      .select('*')
      .eq('user_id', clubId)
      .order('global_rating', { ascending: false })
      .then(({ data }) => {
        if (data) setPlayers(data as Player[]);
        setLoading(false);
      });
  }, [clubData?.id]);

  const categories = ['Todos', ...Array.from(new Set(
    players.flatMap(p => p.categories || [p.main_category]).filter(Boolean) as string[]
  ))];

  const sorted = players
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.nickname || '').toLowerCase().includes(search.toLowerCase());
      const matchesCat = filterCat === 'Todos' || (p.categories || []).includes(filterCat) || p.main_category === filterCat;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => calculateDisplayRanking(b) - calculateDisplayRanking(a));

  const myRank = sorted.findIndex(p => p.id === myPlayerId) + 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-400 text-sm font-bold animate-pulse">Cargando ranking...</div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
        <p className="text-sm text-slate-400">{clubData?.name || 'Tu club'} · {players.length} jugadores</p>
      </div>

      {/* My position card */}
      {myRank > 0 && (
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${THEME.cta}, #818CF8)` }}>
          <div className="text-3xl font-black text-white">#{myRank}</div>
          <div className="flex-1">
            <div className="text-xs font-bold text-white/70 uppercase tracking-widest">Tu posición</div>
            <div className="text-sm font-bold text-white">de {players.length} jugadores</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">
              {calculateDisplayRanking(players.find(p => p.id === myPlayerId) || players[0])}
            </div>
            <div className="text-xs font-bold text-white/60">ELO</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400"
          placeholder="Buscar jugador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterCat === cat
                  ? 'text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200'
              }`}
              style={filterCat === cat ? { background: THEME.cta } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Ranking list */}
      {sorted.length === 0 ? (
        <div className="text-center py-10">
          <Award size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 font-bold text-sm">Sin resultados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((player, idx) => {
            const isMe = player.id === myPlayerId;
            const elo = calculateDisplayRanking(player);
            const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const color = getAvatarColor(player.name);
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  isMe
                    ? 'border-indigo-200 shadow-md'
                    : 'bg-white border-slate-100'
                }`}
                style={isMe ? { background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' } : {}}
              >
                {/* Position */}
                <div className="w-7 text-center shrink-0">
                  {idx < 3 ? (
                    <span className="text-base">{MEDAL[idx]}</span>
                  ) : (
                    <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
                  style={{ background: color }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold truncate ${isMe ? 'text-indigo-700' : 'text-slate-900'}`}>
                    {player.name}
                    {player.nickname && (
                      <span className="text-slate-400 font-normal ml-1">"{player.nickname}"</span>
                    )}
                    {isMe && <span className="ml-1.5 text-[10px] font-black text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full">TÚ</span>}
                  </div>
                  {(player.main_category || (player.categories || [])[0]) && (
                    <div className="text-[10px] font-bold text-slate-400">
                      {player.main_category || (player.categories || [])[0]}
                    </div>
                  )}
                </div>

                {/* ELO */}
                <div className="text-right shrink-0">
                  <div className={`text-base font-black tabular-nums ${isMe ? 'text-indigo-600' : 'text-slate-800'}`}>
                    {elo}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">ELO</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlayerRanking;
