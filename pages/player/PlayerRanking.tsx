import React, { useState, useEffect, useCallback } from 'react';
import { THEME, PP } from '../../utils/theme';
import { avatarColor, initials as getInitials } from '../../utils/avatar';
import { calculateDisplayRanking } from '../../utils/Elo';
import { Award, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Player } from '../../types';
import { PADEL_CATEGORIES, CATEGORY_SHORT, PadelCategory, categoryFromElo } from '../../utils/categories';

// Club mark — dark square with monogram (from design)
const CLUB_PALETTE = ['#0F172A','#1E3A5F','#2D5F4A','#5F2D4A','#3F3F5F','#5F3F2D','#1F3A3A'];
function clubMarkColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return CLUB_PALETTE[Math.abs(h) % CLUB_PALETTE.length];
}

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
    const ac = avatarColor(player.name);
    return (
      <div
        key={player.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: isMe ? PP.primaryTint : 'transparent',
          borderBottom: `1px solid ${PP.hair}`,
        }}
      >
        <div style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
          {idx < 3
            ? <span style={{ fontSize: 14 }}>{MEDAL[idx]}</span>
            : <span style={{ fontSize: 11, fontWeight: 800, color: PP.mute }}>#{idx + 1}</span>}
        </div>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: ac.bg, color: ac.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {getInitials(player.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? PP.primary : PP.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center', gap: 6 }}>
            {player.name}
            {isMe && <span style={{ fontSize: 9, fontWeight: 800, color: PP.primary, background: PP.primaryTint, border: `1px solid ${PP.primary}30`, padding: '2px 6px', borderRadius: 99 }}>TÚ</span>}
          </div>
          <div style={{ fontSize: 10, color: PP.mute, marginTop: 1 }}>
            {mode === 'club'
              ? `${player.club_confidence ?? 0} partidos verificados`
              : CATEGORY_SHORT[categoryFromElo(calculateDisplayRanking(player))]}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: isMe ? PP.primary : PP.ink, fontFeatureSettings: '"tnum"', flexShrink: 0 }}>
          {displayRating}
        </div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────
  return (
    <div style={{ background: PP.bg, minHeight: '100vh', padding: '16px 16px 96px', fontFamily: PP.font }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: PP.ink, letterSpacing: -0.9, lineHeight: 1, margin: 0 }}>Ranking</h1>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: PP.hairStrong, borderRadius: 14, padding: 4 }}>
        {([['club', 'Mi Club'], ['general', 'General']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setRankTab(key); setSearch(''); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: PP.font,
              fontWeight: 700, fontSize: 13,
              background: rankTab === key ? PP.card : 'transparent',
              color: rankTab === key ? PP.ink : PP.mute,
              boxShadow: rankTab === key ? '0 1px 3px rgba(11,13,23,0.08)' : 'none',
              transition: 'all .15s',
            }}
          >{label}</button>
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

              const clubBg = clubMarkColor(club.name);
              const clubLetters = club.name.split(/\s+/).filter((w: string) => /^[A-ZÁÉÍÓÚ]/i.test(w)).slice(0, 2).map((w: string) => w[0]).join('') || club.name.slice(0, 2).toUpperCase();
              return (
                <div key={club.id} style={{ background: PP.card, borderRadius: 20, border: `1px solid ${PP.hair}`, overflow: 'hidden', boxShadow: PP.shadow }}>
                  {/* Club card header */}
                  <button
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : club.id)}
                  >
                    {/* Club mark */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: clubBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, letterSpacing: -0.5 }}>
                      {clubLetters}
                    </div>

                    {/* Name + count */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: PP.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{club.name}</div>
                      <div style={{ fontSize: 12, color: PP.mute, marginTop: 2 }}>{club.players.length} jugadores</div>
                    </div>

                    {/* Mi posición */}
                    {myRankByMode > 0 ? (
                      <div style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 12, background: myRankByMode <= 3 ? PP.ink : PP.primary, color: '#fff', fontSize: 12, fontWeight: 800 }}>
                        {myRankByMode <= 3 ? MEDAL[myRankByMode - 1] : `#${myRankByMode}`}
                      </div>
                    ) : (
                      <div style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 12, background: PP.hair, color: PP.mute, fontSize: 12, fontWeight: 700 }}>
                        Sin pos.
                      </div>
                    )}

                    {isExpanded
                      ? <ChevronUp size={16} color={PP.muteSoft} style={{ flexShrink: 0 }} />
                      : <ChevronDown size={16} color={PP.muteSoft} style={{ flexShrink: 0 }} />}
                  </button>

                  {/* Expanded ranking */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${PP.hair}` }}>
                      {/* Search */}
                      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${PP.hair}` }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={13} color={PP.muteSoft} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                          <input
                            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 6, paddingBottom: 6, background: PP.bg, borderRadius: 10, border: `1px solid ${PP.hair}`, fontSize: 12, fontWeight: 500, color: PP.ink, outline: 'none', boxSizing: 'border-box' as const }}
                            placeholder="Buscar jugador..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {filteredPlayers.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: PP.mute }}>Sin resultados</div>
                      ) : (
                        <div>
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
