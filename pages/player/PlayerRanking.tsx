import React, { useState, useEffect, useCallback } from 'react';
import { THEME } from '../../utils/theme';
import { calculateDisplayRanking } from '../../utils/Elo';
import { Award, Search, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types';

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const MEDAL = ['🥇', '🥈', '🥉'];
const CATEGORIES = ['Todos', '1ª', '2ª', '3ª', '4ª', '5ª', 'Iniciación'];

interface ClubInfo { id: string; name: string; }

const PlayerRanking: React.FC = () => {
  const [rankTab, setRankTab] = useState<'club' | 'general'>('club');

  // Club tab state
  const [myClubs, setMyClubs] = useState<ClubInfo[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [clubPlayers, setClubPlayers] = useState<Player[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [loadingClubRanking, setLoadingClubRanking] = useState(false);

  // General tab state
  const [generalPlayers, setGeneralPlayers] = useState<Player[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('Todos');

  const [search, setSearch] = useState('');
  const [myPlayerId] = useState<string>(() => localStorage.getItem('padel_sim_player_id') || '');

  // ── Load clubs the player has participated in ─────────────────
  useEffect(() => {
    if (!myPlayerId) { setLoadingClubs(false); return; }

    const loadMyClubs = async () => {
      // Get match_ids where this player participated
      const { data: participations } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('player_id', myPlayerId)
        .in('attendance_status', ['joined', 'confirmed']);

      const matchIds = (participations || []).map((p: any) => p.match_id);

      let clubIds: string[] = [];
      if (matchIds.length > 0) {
        const { data: matchData } = await supabase
          .from('free_matches')
          .select('club_id')
          .in('id', matchIds)
          .not('club_id', 'is', null);
        clubIds = [...new Set((matchData || []).map((m: any) => m.club_id).filter(Boolean))];
      }

      // Fallback: primary club via players.user_id
      if (clubIds.length === 0) {
        const { data: playerRow } = await supabase
          .from('players').select('user_id').eq('id', myPlayerId).maybeSingle();
        if (playerRow?.user_id) clubIds = [playerRow.user_id];
      }

      if (clubIds.length === 0) { setLoadingClubs(false); return; }

      const { data: clubs } = await supabase
        .from('clubs').select('id, name').in('id', clubIds);

      const sorted = (clubs || []) as ClubInfo[];
      setMyClubs(sorted);
      if (sorted.length > 0) setSelectedClubId(sorted[0].id);
      setLoadingClubs(false);
    };

    loadMyClubs();
  }, [myPlayerId]);

  // ── Load ranking for selected club ────────────────────────────
  const loadClubRanking = useCallback(async (clubId: string) => {
    setLoadingClubRanking(true);

    // Get all match IDs for this club
    const { data: matches } = await supabase
      .from('free_matches')
      .select('id')
      .eq('club_id', clubId);

    const matchIds = (matches || []).map((m: any) => m.id);

    let players: Player[] = [];

    if (matchIds.length > 0) {
      // Get unique player IDs who have played in those matches
      const { data: parts } = await supabase
        .from('match_participants')
        .select('player_id')
        .in('match_id', matchIds)
        .in('attendance_status', ['joined', 'confirmed'])
        .not('player_id', 'is', null);

      const playerIds = [...new Set((parts || []).map((p: any) => p.player_id).filter(Boolean))];

      if (playerIds.length > 0) {
        const { data: pData } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds);
        players = (pData || []) as Player[];
      }
    }

    // Also include primary members of the club (players.user_id = clubId)
    const { data: primaryMembers } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', clubId);

    // Merge, dedupe
    const merged = new Map<string, Player>();
    [...players, ...(primaryMembers || [])].forEach(p => merged.set(p.id, p));

    setClubPlayers(
      Array.from(merged.values()).sort((a, b) => calculateDisplayRanking(b) - calculateDisplayRanking(a))
    );
    setLoadingClubRanking(false);
  }, []);

  useEffect(() => {
    if (selectedClubId) loadClubRanking(selectedClubId);
  }, [selectedClubId, loadClubRanking]);

  // ── Load general ranking ──────────────────────────────────────
  useEffect(() => {
    if (rankTab !== 'general') return;
    if (generalPlayers.length > 0) return; // ya cargado
    setLoadingGeneral(true);
    supabase
      .from('players')
      .select('*')
      .order('global_rating', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setGeneralPlayers((data || []) as Player[]);
        setLoadingGeneral(false);
      });
  }, [rankTab]);

  // ── Derived lists ─────────────────────────────────────────────
  const activePlayers = rankTab === 'club' ? clubPlayers : generalPlayers;

  const sorted = activePlayers
    .filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.nickname || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (rankTab === 'general' && filterCat !== 'Todos') {
        return (p.categories || []).includes(filterCat) || p.main_category === filterCat;
      }
      return true;
    })
    .sort((a, b) => calculateDisplayRanking(b) - calculateDisplayRanking(a));

  const myRank = sorted.findIndex(p => p.id === myPlayerId) + 1;
  const myPlayer = sorted.find(p => p.id === myPlayerId);

  const isLoading = rankTab === 'club' ? (loadingClubs || loadingClubRanking) : loadingGeneral;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
        {!isLoading && <p className="text-sm text-slate-400">{sorted.length} jugadores</p>}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-2xl">
        {([['club', 'Mi Club'], ['general', 'General']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRankTab(key)}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
              rankTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Club selector */}
      {rankTab === 'club' && !loadingClubs && myClubs.length > 1 && (
        <div className="relative mb-4">
          <select
            value={selectedClubId}
            onChange={e => setSelectedClubId(e.target.value)}
            className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 pr-9"
          >
            {myClubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-indigo-400" />
        </div>
      ) : (
        <>
          {/* No clubs state */}
          {rankTab === 'club' && myClubs.length === 0 && (
            <div className="text-center py-12">
              <Award size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-bold text-sm">Aún no has jugado en ningún club</p>
              <p className="text-xs text-slate-400 mt-1">Únete a un partido para aparecer en el ranking</p>
            </div>
          )}

          {(rankTab === 'general' || myClubs.length > 0) && (<>
            {/* My position card */}
            {myRank > 0 && (
              <div
                className="rounded-2xl p-4 mb-4 flex items-center gap-3"
                style={{ background: `linear-gradient(135deg, ${THEME.cta}, #818CF8)` }}
              >
                <div className="text-3xl font-black text-white">#{myRank}</div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white/70 uppercase tracking-widest">Tu posición</div>
                  <div className="text-sm font-bold text-white">
                    de {sorted.length} jugadores
                    {rankTab === 'club' && myClubs.length > 0 && (
                      <span className="ml-1 font-normal text-white/70">
                        · {myClubs.find(c => c.id === selectedClubId)?.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white">
                    {myPlayer ? calculateDisplayRanking(myPlayer) : '—'}
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

            {/* Category filter — solo en General */}
            {rankTab === 'general' && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                {CATEGORIES.map(cat => (
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
                  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  const color = getAvatarColor(player.name);
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        isMe ? 'border-indigo-200 shadow-md' : 'bg-white border-slate-100'
                      }`}
                      style={isMe ? { background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' } : {}}
                    >
                      {/* Position */}
                      <div className="w-7 text-center shrink-0">
                        {idx < 3
                          ? <span className="text-base">{MEDAL[idx]}</span>
                          : <span className="text-xs font-black text-slate-400">#{idx + 1}</span>}
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
                          {isMe && (
                            <span className="ml-1.5 text-[10px] font-black text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full">TÚ</span>
                          )}
                        </div>
                        {(player.main_category || (player.categories || [])[0]) && (
                          <div className="text-[10px] font-bold text-slate-400">
                            {player.main_category || (player.categories || [])[0]}
                          </div>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="text-right shrink-0">
                        <div className={`text-base font-black tabular-nums ${isMe ? 'text-indigo-600' : 'text-slate-800'}`}>
                          {calculateDisplayRanking(player)}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">ELO</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>)}
        </>
      )}
    </div>
  );
};

export default PlayerRanking;
