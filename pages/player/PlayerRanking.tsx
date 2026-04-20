import React, { useState, useEffect, useCallback } from 'react';
import { THEME } from '../../utils/theme';
import { calculateDisplayRanking } from '../../utils/Elo';
import { Award, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types';
import { PADEL_CATEGORIES, CATEGORY_SHORT, PadelCategory, categoryFromElo } from '../../utils/categories';

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getClubColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#059669','#D97706','#DC2626','#0284C7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const MEDAL = ['🥇', '🥈', '🥉'];

interface ClubInfo { id: string; name: string; }

interface ClubWithRanking extends ClubInfo {
  players: Player[];
  myRank: number;
  loaded: boolean;
}

const PlayerRanking: React.FC = () => {
  const [rankTab, setRankTab] = useState<'club' | 'general'>('club');

  // Club tab
  const [clubs, setClubs] = useState<ClubWithRanking[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingClubs, setLoadingClubs] = useState(true);

  // General tab
  const [generalPlayers, setGeneralPlayers] = useState<Player[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('Todos');

  const [search, setSearch] = useState('');
  const [ratingMode, setRatingMode] = useState<'global' | 'club'>('global');
  const [myPlayerId] = useState<string>(() => localStorage.getItem('padel_sim_player_id') || '');

  // ── Cargar clubs del jugador ───────────────────────────────────
  useEffect(() => {
    if (!myPlayerId) { setLoadingClubs(false); return; }

    const load = async () => {
      // Matches donde participé → club_ids
      const { data: parts } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('player_id', myPlayerId)
        .in('attendance_status', ['joined', 'confirmed']);

      const matchIds = (parts || []).map((p: any) => p.match_id);
      let clubIds: string[] = [];

      if (matchIds.length > 0) {
        const { data: fms } = await supabase
          .from('free_matches')
          .select('club_id')
          .in('id', matchIds)
          .not('club_id', 'is', null);
        clubIds = [...new Set((fms || []).map((m: any) => m.club_id).filter(Boolean))];
      }

      // Fallback: club primario del jugador
      if (clubIds.length === 0) {
        const { data: me } = await supabase
          .from('players').select('user_id').eq('id', myPlayerId).maybeSingle();
        if (me?.user_id) clubIds = [me.user_id];
      }

      if (clubIds.length === 0) { setLoadingClubs(false); return; }

      const { data: clubsData } = await supabase
        .from('clubs').select('id, name').in('id', clubIds);

      // Para cada club, cargar jugadores y calcular mi posición
      const results: ClubWithRanking[] = await Promise.all(
        (clubsData || []).map(async (club: ClubInfo) => {
          const players = await loadClubPlayers(club.id);
          const sorted = players.sort((a, b) => calculateDisplayRanking(b) - calculateDisplayRanking(a));
          const myRank = sorted.findIndex(p => p.id === myPlayerId) + 1;
          return { ...club, players: sorted, myRank, loaded: true };
        })
      );

      // Primero los que tengo posición
      results.sort((a, b) => {
        if (a.myRank > 0 && b.myRank > 0) return a.myRank - b.myRank;
        if (a.myRank > 0) return -1;
        if (b.myRank > 0) return 1;
        return 0;
      });

      setClubs(results);
      if (results.length === 1) setExpandedId(results[0].id); // auto-expand si solo hay uno
      setLoadingClubs(false);
    };

    load();
  }, [myPlayerId]);

  const loadClubPlayers = async (clubId: string): Promise<Player[]> => {
    // Jugadores que han participado en matches del club
    const { data: matches } = await supabase
      .from('free_matches').select('id').eq('club_id', clubId);
    const matchIds = (matches || []).map((m: any) => m.id);

    let players: Player[] = [];
    if (matchIds.length > 0) {
      const { data: ps } = await supabase
        .from('match_participants')
        .select('player_id')
        .in('match_id', matchIds)
        .in('attendance_status', ['joined', 'confirmed'])
        .not('player_id', 'is', null);
      const ids = [...new Set((ps || []).map((p: any) => p.player_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: pData } = await supabase.from('players').select('*').in('id', ids);
        players = (pData || []) as Player[];
      }
    }

    // Añadir miembros primarios del club
    const { data: primary } = await supabase.from('players').select('*').eq('user_id', clubId);
    const merged = new Map<string, Player>();
    [...players, ...(primary || [])].forEach(p => merged.set(p.id, p));
    return Array.from(merged.values());
  };

  // ── Ranking general ───────────────────────────────────────────
  useEffect(() => {
    if (rankTab !== 'general') return;
    if (generalPlayers.length > 0) return;
    setLoadingGeneral(true);
    supabase
      .from('players').select('*').order('global_rating', { ascending: false }).limit(300)
      .then(({ data }) => {
        setGeneralPlayers((data || []) as Player[]);
        setLoadingGeneral(false);
      });
  }, [rankTab]);

  // ── Lista general filtrada ────────────────────────────────────
  const generalSorted = generalPlayers
    .filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(q) || (p.nickname || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filterCat === 'Todos') return true;
      // Filtrar por categoría real según ELO
      return categoryFromElo(calculateDisplayRanking(p)) === filterCat;
    })
    .sort((a, b) => calculateDisplayRanking(b) - calculateDisplayRanking(a));

  const myGeneralRank = generalSorted.findIndex(p => p.id === myPlayerId) + 1;
  const myGeneralPlayer = generalSorted.find(p => p.id === myPlayerId);

  // ── Render helpers ────────────────────────────────────────────
  const renderPlayerRow = (player: Player, idx: number, mode: 'global' | 'club' = 'global') => {
    const isMe = player.id === myPlayerId;
    const displayRating = mode === 'club'
      ? (player.club_rating ?? 1200)
      : calculateDisplayRanking(player);
    return (
      <div
        key={player.id}
        className={`flex items-center gap-3 px-4 py-2.5 ${
          isMe ? 'bg-indigo-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
        }`}
      >
        <div className="w-6 text-center shrink-0">
          {idx < 3
            ? <span className="text-sm">{MEDAL[idx]}</span>
            : <span className="text-xs font-black text-slate-400">#{idx + 1}</span>}
        </div>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
          style={{ background: getAvatarColor(player.name) }}
        >
          {getInitials(player.name)}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-bold truncate block ${isMe ? 'text-indigo-700' : 'text-slate-900'}`}>
            {player.name}
            {player.nickname && <span className="text-slate-400 font-normal ml-1">"{player.nickname}"</span>}
            {isMe && <span className="ml-1.5 text-[10px] font-black text-indigo-500 bg-indigo-100 px-1 py-0.5 rounded-full">TÚ</span>}
          </span>
          <span className="text-[10px] text-slate-400">
            {mode === 'club'
              ? `Confianza: ${player.club_confidence ?? 0} partidos`
              : CATEGORY_SHORT[categoryFromElo(calculateDisplayRanking(player))]}
          </span>
        </div>
        <div className={`text-sm font-black tabular-nums shrink-0 ${isMe ? 'text-indigo-600' : 'text-slate-700'}`}>
          {displayRating}
        </div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-6">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-2xl">
        {([['club', 'Mi Club'], ['general', 'General']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setRankTab(key); setSearch(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
              rankTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: MI CLUB ── */}
      {rankTab === 'club' && (
        loadingClubs ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-12">
            <Award size={36} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-bold text-sm">Aún no has jugado en ningún club</p>
            <p className="text-xs text-slate-400 mt-1">Únete a un partido para aparecer en el ranking</p>
          </div>
        ) : (<>
          {/* Rating mode toggle */}
          <div className="flex gap-1 mb-3 bg-slate-100 rounded-xl p-1">
            {([['global', 'ELO Torneos'], ['club', 'Partidos Libres']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRatingMode(key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                  ratingMode === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {clubs.map(club => {
              const isExpanded = expandedId === club.id;
              const color = getClubColor(club.name);
              const clubSearch = search.toLowerCase();
              const sortedByMode = [...club.players].sort((a, b) =>
                ratingMode === 'club'
                  ? (b.club_rating ?? 1200) - (a.club_rating ?? 1200)
                  : calculateDisplayRanking(b) - calculateDisplayRanking(a)
              );
              const filteredPlayers = isExpanded
                ? sortedByMode.filter(p =>
                    p.name.toLowerCase().includes(clubSearch) ||
                    (p.nickname || '').toLowerCase().includes(clubSearch)
                  )
                : [];
              const myRankByMode = sortedByMode.findIndex(p => p.id === myPlayerId) + 1;

              return (
                <div key={club.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  {/* Club card header */}
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : club.id)}
                  >
                    {/* Club avatar */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
                      style={{ background: color }}
                    >
                      {getInitials(club.name)}
                    </div>

                    {/* Name + rank */}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-900 text-sm truncate">{club.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {club.players.length} jugadores
                      </div>
                    </div>

                    {/* Mi posición */}
                    {myRankByMode > 0 ? (
                      <div
                        className="shrink-0 px-3 py-1.5 rounded-xl text-white text-xs font-black"
                        style={{ background: myRankByMode <= 3 ? color : THEME.cta }}
                      >
                        {myRankByMode <= 3 ? MEDAL[myRankByMode - 1] : `#${myRankByMode}`}
                      </div>
                    ) : (
                      <div className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold">
                        Sin pos.
                      </div>
                    )}

                    {isExpanded
                      ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
                      : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                  </button>

                  {/* Expanded ranking */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {/* Search dentro del club */}
                      <div className="px-4 py-2.5 border-b border-slate-50">
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none border border-slate-100 focus:border-indigo-300"
                            placeholder="Buscar jugador..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {filteredPlayers.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">Sin resultados</div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {filteredPlayers.map((p, idx) => renderPlayerRow(p, sortedByMode.indexOf(p), ratingMode))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>)
      )}

      {/* ── TAB: GENERAL ── */}
      {rankTab === 'general' && (
        loadingGeneral ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : (<>
          {/* Mi posición */}
          {myGeneralRank > 0 && (
            <div
              className="rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{ background: `linear-gradient(135deg, ${THEME.cta}, #818CF8)` }}
            >
              <div className="text-3xl font-black text-white">#{myGeneralRank}</div>
              <div className="flex-1">
                <div className="text-xs font-bold text-white/70 uppercase tracking-widest">Tu posición global</div>
                <div className="text-sm font-bold text-white">de {generalSorted.length} jugadores</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">
                  {myGeneralPlayer ? calculateDisplayRanking(myGeneralPlayer) : '—'}
                </div>
                <div className="text-xs font-bold text-white/60">ELO</div>
              </div>
            </div>
          )}

          {/* Búsqueda */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400"
              placeholder="Buscar jugador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro categorías */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {(['Todos', ...PADEL_CATEGORIES] as const).map(cat => {
              const label = cat === 'Todos' ? 'Todos' : CATEGORY_SHORT[cat as PadelCategory];
              return (
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
                  {label}
                </button>
              );
            })}
          </div>

          {/* Lista */}
          {generalSorted.length === 0 ? (
            <div className="text-center py-10">
              <Award size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 font-bold text-sm">Sin resultados</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-50">
                {generalSorted.map((player, idx) => renderPlayerRow(player, idx))}
              </div>
            </div>
          )}
        </>)
      )}
    </div>
  );
};

export default PlayerRanking;
