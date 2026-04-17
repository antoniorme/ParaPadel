import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { THEME } from '../../utils/theme';
import {
  MapPin, BarChart2, Users, ChevronRight, ChevronDown,
  Star, Bell, BellOff, Loader2, Search
} from 'lucide-react';

interface OpenMatch {
  id: string;
  share_token: string;
  scheduled_at: string;
  level?: string;
  court?: string;
  max_players: number;
  spots_taken: number;
}

interface ClubWithMatches {
  id: string;
  name: string;
  matches: OpenMatch[];
  isFollowed: boolean;
  notifyEnabled: boolean;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const formatDateShort = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const AVATAR_COLORS = ['#4F46E5','#7C3AED','#059669','#D97706','#DC2626','#0284C7'];
const getColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const ClubMatchBrowser: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [clubs, setClubs] = useState<ClubWithMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null); // club id being toggled

  // Obtener player_id del usuario actual
  useEffect(() => {
    if (!user) return;
    supabase.from('players').select('id').eq('profile_user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyPlayerId(data.id); });
  }, [user]);

  const loadData = useCallback(async () => {
    // 1. Todos los clubs + partidos abiertos (en paralelo)
    const [{ data: allClubsData }, { data: matchData }, followResult] = await Promise.all([
      supabase.from('clubs').select('id, name').order('name'),
      supabase
        .from('free_matches')
        .select(`
          id, share_token, scheduled_at, level, court, max_players, club_id,
          match_participants!match_id ( id, attendance_status )
        `)
        .eq('status', 'open')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true }),
      myPlayerId
        ? supabase.from('player_club_follows').select('club_id, notify_new_matches').eq('player_id', myPlayerId)
        : Promise.resolve({ data: null }),
    ]);

    // 2. Follows del jugador
    let followedClubIds: string[] = [];
    let notifyMap: Record<string, boolean> = {};
    if (followResult.data) {
      followedClubIds = followResult.data.map((f: any) => f.club_id);
      followResult.data.forEach((f: any) => { notifyMap[f.club_id] = f.notify_new_matches; });
    }

    // 3. Construir mapa de partidos por club
    const matchesByClub = new Map<string, OpenMatch[]>();
    (matchData || []).forEach((m: any) => {
      if (!m.club_id) return;
      const spots_taken = (m.match_participants || [])
        .filter((p: any) => ['joined', 'confirmed'].includes(p.attendance_status)).length;
      if (!matchesByClub.has(m.club_id)) matchesByClub.set(m.club_id, []);
      matchesByClub.get(m.club_id)!.push({
        id: m.id,
        share_token: m.share_token,
        scheduled_at: m.scheduled_at,
        level: m.level,
        court: m.court,
        max_players: m.max_players,
        spots_taken,
      });
    });

    // 4. Todos los clubs en el mapa (con o sin partidos)
    const clubMap = new Map<string, ClubWithMatches>();
    (allClubsData || []).forEach((c: any) => {
      clubMap.set(c.id, {
        id: c.id,
        name: c.name,
        matches: matchesByClub.get(c.id) || [],
        isFollowed: followedClubIds.includes(c.id),
        notifyEnabled: notifyMap[c.id] ?? true,
      });
    });

    // Ordenar: seguidos primero, luego con partidos, luego alfabético
    const sorted = Array.from(clubMap.values()).sort((a, b) => {
      if (a.isFollowed !== b.isFollowed) return a.isFollowed ? -1 : 1;
      if (b.matches.length !== a.matches.length) return b.matches.length - a.matches.length;
      return a.name.localeCompare(b.name);
    });

    setClubs(sorted);
    setLoading(false);
  }, [myPlayerId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Seguir / dejar de seguir
  const handleFollow = async (clubId: string, isFollowed: boolean) => {
    if (!myPlayerId) { navigate('/auth'); return; }
    setToggling(clubId);
    if (isFollowed) {
      await supabase.from('player_club_follows')
        .delete().eq('player_id', myPlayerId).eq('club_id', clubId);
    } else {
      await supabase.from('player_club_follows')
        .insert({ player_id: myPlayerId, club_id: clubId, notify_new_matches: true });
    }
    await loadData();
    setToggling(null);
  };

  // Toggle notificaciones del club
  const handleToggleNotify = async (clubId: string, current: boolean) => {
    if (!myPlayerId) return;
    await supabase.from('player_club_follows')
      .update({ notify_new_matches: !current })
      .eq('player_id', myPlayerId).eq('club_id', clubId);
    setClubs(prev => prev.map(c =>
      c.id === clubId ? { ...c, notifyEnabled: !current } : c
    ));
  };

  const filtered = clubs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const followed = filtered.filter(c => c.isFollowed);
  const others   = filtered.filter(c => !c.isFollowed);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  const renderClub = (club: ClubWithMatches) => {
    const isExpanded = expandedClub === club.id;
    const isFull = club.matches.every(m => m.spots_taken >= m.max_players);
    const openCount = club.matches.filter(m => m.spots_taken < m.max_players).length;

    return (
      <div key={club.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Club header */}
        <div className="flex items-center gap-3 p-4">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
            style={{ background: getColor(club.name) }}
          >
            {getInitials(club.name)}
          </div>

          {/* Info */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => club.matches.length > 0 && setExpandedClub(isExpanded ? null : club.id)}
          >
            <div className="font-black text-slate-900 text-sm truncate">{club.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {club.matches.length === 0
                ? 'Sin partidos abiertos'
                : openCount > 0
                  ? `${openCount} partido${openCount > 1 ? 's' : ''} disponible${openCount > 1 ? 's' : ''}`
                  : 'Partidos completos'}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notificaciones (solo si sigue) */}
            {club.isFollowed && (
              <button
                onClick={() => handleToggleNotify(club.id, club.notifyEnabled)}
                className={`p-1.5 rounded-lg transition-all ${
                  club.notifyEnabled
                    ? 'text-indigo-500 bg-indigo-50'
                    : 'text-slate-300 bg-slate-50'
                }`}
                title={club.notifyEnabled ? 'Desactivar avisos' : 'Activar avisos'}
              >
                {club.notifyEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              </button>
            )}

            {/* Seguir / dejar de seguir */}
            <button
              onClick={() => handleFollow(club.id, club.isFollowed)}
              disabled={toggling === club.id}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                club.isFollowed
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {toggling === club.id
                ? <Loader2 size={12} className="animate-spin" />
                : <><Star size={12} fill={club.isFollowed ? 'currentColor' : 'none'} />
                  {club.isFollowed ? 'Siguiendo' : 'Seguir'}</>
              }
            </button>

            {/* Expandir */}
            {club.matches.length > 0 && (
              <button
                onClick={() => setExpandedClub(isExpanded ? null : club.id)}
                className="p-1.5 text-slate-400"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Lista de partidos expandida */}
        {isExpanded && club.matches.length > 0 && (
          <div className="border-t border-slate-100 divide-y divide-slate-50">
            {club.matches.map(m => {
              const spotsLeft = m.max_players - m.spots_taken;
              const full = spotsLeft <= 0;
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/m/${m.share_token}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-all text-left"
                >
                  {/* Hora */}
                  <div
                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shrink-0"
                    style={{ background: full ? '#94a3b8' : THEME.cta }}
                  >
                    <span className="text-[10px] font-bold opacity-80 leading-none">
                      {formatDateShort(m.scheduled_at) === 'Hoy' ? 'HOY' :
                       formatDateShort(m.scheduled_at) === 'Mañana' ? 'MAÑ' :
                       formatDateShort(m.scheduled_at).slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-sm font-black leading-none mt-0.5">
                      {formatTime(m.scheduled_at)}
                    </span>
                  </div>

                  {/* Detalles */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.level && (
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <BarChart2 size={11} className="text-slate-400" />{m.level}
                        </span>
                      )}
                      {m.court && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin size={11} />{m.court}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Users size={11} className={full ? 'text-slate-300' : 'text-indigo-400'} />
                      <span className={`text-xs font-bold ${full ? 'text-slate-400' : 'text-indigo-600'}`}>
                        {full ? 'Completo' : `${spotsLeft} plaza${spotsLeft > 1 ? 's' : ''} libre${spotsLeft > 1 ? 's' : ''}`}
                      </span>
                      <span className="text-xs text-slate-300 ml-1">
                        ({m.spots_taken}/{m.max_players})
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={15} className="text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar club..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <div className="text-3xl mb-2">🔍</div>
          <p className="font-bold text-sm">No hay clubs con ese nombre</p>
        </div>
      )}

      {/* Clubs seguidos */}
      {followed.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Star size={11} fill="currentColor" /> Siguiendo
          </p>
          <div className="space-y-2">{followed.map(renderClub)}</div>
        </div>
      )}

      {/* Todos los clubs */}
      {others.length > 0 && (
        <div>
          {followed.length > 0 && (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 mt-4">
              Todos los clubs
            </p>
          )}
          <div className="space-y-2">{others.map(renderClub)}</div>
        </div>
      )}

      {clubs.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎾</div>
          <p className="font-black text-slate-700 mb-1">Sin partidos abiertos</p>
          <p className="text-sm text-slate-400">Los clubs aparecerán aquí cuando publiquen partidos.</p>
        </div>
      )}
    </div>
  );
};

export default ClubMatchBrowser;
