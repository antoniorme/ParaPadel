import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../store/TournamentContext';
import { useHistory } from '../../store/HistoryContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';
import { PP } from '../../utils/theme';
import { avatarColor, initials } from '../../utils/avatar';
import { calculateDisplayRanking } from '../../utils/Elo';
import { categoryFromElo } from '../../utils/categories';
import { ArrowLeft, MapPin, ChevronRight } from 'lucide-react';
import { TournamentMatch as Match, Player } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatMatchDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ELO range limits per category for progress calculation
const ELO_BOUNDS: Record<string, [number, number]> = {
  'Iniciación': [0,    1000],
  '5ª CAT':     [1000, 2000],
  '4ª CAT':     [2000, 3000],
  '3ª CAT':     [3000, 4000],
  '2ª CAT':     [4000, 5000],
  '1ª CAT':     [5000, 6000],
};

function eloProgress(elo: number): number {
  const cat = categoryFromElo(elo);
  const [min, max] = ELO_BOUNDS[cat] ?? [0, 1000];
  if (max === Infinity || max - min === 0) return 1;
  return Math.min(1, Math.max(0, (elo - min) / (max - min)));
}

// ─── sub-components ───────────────────────────────────────────────────────────

function QuickAction({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: PP.card, border: `1px solid ${PP.hair}`,
        borderRadius: 18, padding: '14px 12px',
        boxShadow: PP.shadow, display: 'flex', flexDirection: 'column',
        gap: 10, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: PP.primary, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: PP.ink, letterSpacing: -0.2 }}>{label}</div>
        <div style={{ fontSize: 11, color: PP.mute, fontWeight: 500, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

function MatchCard({ m, onClick }: { m: any; onClick: () => void }) {
  const time = formatTime(m.scheduled_at);
  const date = formatMatchDate(m.scheduled_at);
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: PP.card, border: `1px solid ${PP.hair}`,
        borderRadius: 20, display: 'flex', alignItems: 'stretch',
        boxShadow: PP.shadow, cursor: 'pointer', textAlign: 'left',
        overflow: 'hidden',
      }}
    >
      {/* Time hero */}
      <div style={{
        padding: '16px 14px 16px 18px',
        borderRight: `1px solid ${PP.hair}`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        minWidth: 88,
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: PP.ink, letterSpacing: -1, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
          {time}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 }}>
          {date}
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, padding: '14px 12px 14px 14px', minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: PP.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.title || m.court || 'Partido libre'}
        </div>
        {m.court && (
          <div style={{ fontSize: 11.5, color: PP.mute, fontWeight: 500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} color={PP.muteSoft} style={{ flexShrink: 0 }} />{m.court}{m.level ? ` · ${m.level}` : ''}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14 }}>
        <ChevronRight size={16} color={PP.muteSoft} />
      </div>
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const PlayerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useTournament();
  const { pastTournaments } = useHistory();
  const { role, user } = useAuth();

  const isPreviewMode = sessionStorage.getItem('superadmin_preview') === 'player';
  useEffect(() => {
    if (!isPreviewMode && (role === 'admin' || role === 'superadmin')) {
      navigate('/dashboard', { replace: true });
    }
  }, [role, navigate, isPreviewMode]);

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('players')
      .select('*')
      .eq('profile_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCurrentPlayer(data as Player | null);
        if (data?.id) localStorage.setItem('padel_sim_player_id', data.id);
        setProfileLoading(false);
      });
  }, [user?.id]);

  const myPlayerId = currentPlayer?.id || '';

  useEffect(() => {
    if (!myPlayerId) return;
    supabase
      .from('match_participants')
      .select('match_id, free_matches!match_id(id, scheduled_at, status, court, level, share_token, max_players, title)')
      .eq('player_id', myPlayerId)
      .in('attendance_status', ['joined', 'confirmed'])
      .then(({ data }) => {
        if (!data) return;
        const now = new Date().toISOString();
        const upcoming = data
          .map((row: any) => row.free_matches)
          .filter((m: any) => m && m.scheduled_at >= now && m.status !== 'cancelled')
          .sort((a: any, b: any) => a.scheduled_at.localeCompare(b.scheduled_at))
          .slice(0, 4) as Match[];
        setUpcomingMatches(upcoming);
      });
  }, [myPlayerId]);

  const stats = useMemo(() => {
    if (!currentPlayer) return { matches: 0, wins: 0, winRate: 0 };
    const result = { matches: 0, wins: 0, winRate: 0 };
    const processData = (tData: any) => {
      const myPairs = tData.pairs?.filter((p: any) => p.player1Id === myPlayerId || p.player2Id === myPlayerId) ?? [];
      myPairs.forEach((pair: any) => {
        const matches = (tData.matches ?? []).filter((m: any) => m.isFinished && (m.pairAId === pair.id || m.pairBId === pair.id));
        matches.forEach((m: any) => {
          result.matches++;
          const isPairA = m.pairAId === pair.id;
          const won = (isPairA && (m.scoreA || 0) > (m.scoreB || 0)) || (!isPairA && (m.scoreB || 0) > (m.scoreA || 0));
          if (won) result.wins++;
        });
      });
    };
    pastTournaments.forEach(pt => { if (pt.data) processData(pt.data); });
    if (state.status !== 'setup') processData(state);
    result.winRate = result.matches > 0 ? Math.round((result.wins / result.matches) * 100) : 0;
    return result;
  }, [currentPlayer, pastTournaments, state, myPlayerId]);

  if ((role === 'admin' || role === 'superadmin') && !isPreviewMode) return null;

  if (profileLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PP.bg }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${PP.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: PP.bg }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎾</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: PP.ink, marginBottom: 8 }}>Perfil no encontrado</h1>
        <p style={{ fontSize: 14, color: PP.mute, marginBottom: 24 }}>Tu cuenta no está vinculada a un jugador todavía.</p>
        <button onClick={() => navigate('/p/onboarding')} style={{ fontSize: 14, fontWeight: 700, color: PP.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
          Completar perfil →
        </button>
      </div>
    );
  }

  const elo = calculateDisplayRanking(currentPlayer);
  const cat = categoryFromElo(elo);
  const progress = eloProgress(elo);
  const ac = avatarColor(currentPlayer.name);

  return (
    <div style={{ background: PP.bg, minHeight: '100vh', fontFamily: PP.font, paddingBottom: 96 }}>

      {/* Preview banner */}
      {isPreviewMode && (
        <div style={{ background: '#fffbeb', borderBottom: `1px solid #fde68a`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>👁 Modo preview — Vista jugador</span>
          <button
            onClick={() => { sessionStorage.removeItem('superadmin_preview'); navigate('/superadmin'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: ac.bg, color: ac.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 17, flexShrink: 0,
            }}
          >{initials(currentPlayer.name)}</div>
          <div>
            <div style={{ fontSize: 12, color: PP.mute, fontWeight: 600, lineHeight: 1 }}>Hola,</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: PP.ink, marginTop: 2, letterSpacing: -0.3 }}>
              {currentPlayer.nickname || currentPlayer.name.split(' ')[0]}
            </div>
          </div>
        </div>
      </div>

      {/* ── ELO card ───────────────────────────────────── */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          background: PP.ink, borderRadius: 24, padding: 20, color: '#fff',
          boxShadow: '0 10px 30px rgba(11,13,23,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, textTransform: 'uppercase' }}>
                Índice ELO
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{elo}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, textTransform: 'uppercase' }}>
                Categoría
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, marginTop: 2 }}>
                {cat.replace(' CAT', 'ª')}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Progreso en categoría</span>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{Math.round(progress * 100)}%</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: '#A5B4FC', borderRadius: 999, transition: 'width .4s ease' }} />
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
            {[
              { label: 'Partidos', value: stats.matches },
              { label: 'Victorias', value: stats.matches > 0 ? `${stats.winRate}%` : '—' },
              { label: 'Racha', value: '—' },
              { label: 'Fiabilidad', value: 'Alta' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick actions ──────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', display: 'flex', gap: 10 }}>
        <QuickAction icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><ellipse cx="10" cy="9" rx="6" ry="7" stroke="currentColor" strokeWidth="2"/><path d="M14.5 13.5l5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
        } label="Mis Partidos" sub="Esta semana" onClick={() => navigate('/p/matches')} />
        <QuickAction icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>
        } label="Explorar" sub="Clubs cercanos" onClick={() => navigate('/p/matches?tab=explorar')} />
        <QuickAction icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4v-8H4v8zM10 20h4V4h-4v16zM16 20h4v-12h-4v12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
        } label="Ranking" sub="Mi posición" onClick={() => navigate('/p/ranking')} />
      </div>

      {/* ── Próximos partidos ──────────────────────────── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: PP.ink, letterSpacing: -0.3 }}>Próximos partidos</div>
          <button
            onClick={() => navigate('/p/matches')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: PP.primary, fontWeight: 600, fontSize: 13, fontFamily: PP.font }}
          >Ver todos</button>
        </div>

        {upcomingMatches.length === 0 ? (
          <div style={{
            background: PP.card, border: `1px solid ${PP.hair}`, borderRadius: 20,
            padding: '24px 20px', textAlign: 'center', boxShadow: PP.shadow,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎾</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: PP.ink2, margin: 0 }}>Sin partidos próximos</p>
            <p style={{ fontSize: 12, color: PP.mute, marginTop: 4, fontWeight: 500 }}>
              Únete a un partido abierto desde la sección Explorar.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcomingMatches.map(m => (
              <MatchCard key={m.id} m={m} onClick={() => navigate(`/m/${(m as any).share_token}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDashboard;
