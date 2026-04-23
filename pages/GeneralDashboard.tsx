
import React, { useEffect, useState } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useLeague } from '../store/LeagueContext';
import { useHistory } from '../store/HistoryContext';
import { PP } from '../utils/theme';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import {
  Trophy, Swords, LayoutGrid, Users, Plus, ChevronRight,
  Activity, Lock, Check, GitMerge, Settings,
  CalendarDays, Smartphone
} from 'lucide-react';

// ── Design tokens for bento tiles ─────────────────────────────────────────────

const card: React.CSSProperties = {
  background: PP.card,
  border: `1px solid ${PP.hair}`,
  borderRadius: 16,
  boxShadow: PP.shadow,
};

// ── KPI Tile ──────────────────────────────────────────────────────────────────

interface KPITileProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: string;
  accent?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const KPITile: React.FC<KPITileProps> = ({ label, value, sub, delta, accent = PP.primary, icon, onClick }) => (
  <div
    onClick={onClick}
    style={{
      ...card,
      padding: 18,
      minHeight: 120,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.15s',
      display: 'flex',
      flexDirection: 'column',
    }}
    onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = PP.shadowLg; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = PP.shadow; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      <div style={{
        width: 30, height: 30, borderRadius: 9,
        background: `${accent}18`,
        color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
    </div>
    <div style={{ fontSize: 44, fontWeight: 800, color: PP.ink, letterSpacing: -1.6, lineHeight: 1, marginTop: 12, fontFeatureSettings: '"tnum"' }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
      {sub && <span style={{ fontSize: 12, color: PP.mute, fontWeight: 600 }}>{sub}</span>}
      {delta && <span style={{ fontSize: 12, fontWeight: 700, color: delta.startsWith('-') ? PP.error : PP.ok }}>{delta}</span>}
    </div>
  </div>
);

// ── Module card (enabled) ─────────────────────────────────────────────────────

interface ModuleCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  accentTint: string;
  stats?: { label: string; value: React.ReactNode }[];
  description: string;
  ctaLabel: string;
  ctaBg: string;
  onClick: () => void;
  badge?: string;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  title, subtitle, icon, accentColor, accentTint, stats, description, ctaLabel, ctaBg, onClick, badge
}) => (
  <div
    onClick={onClick}
    style={{
      ...card,
      padding: 24,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'box-shadow 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = PP.shadowLg; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = PP.shadow; }}
  >
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: accentTint, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: PP.ink, letterSpacing: -0.5 }}>{title}</h3>
            {badge && <span style={{ fontSize: 9, fontWeight: 800, background: PP.ok, color: '#fff', padding: '2px 6px', borderRadius: 99 }}>{badge}</span>}
          </div>
          <p style={{ fontSize: 11, color: PP.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{subtitle}</p>
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 10, marginBottom: 16 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: PP.bg, padding: '10px 12px', borderRadius: 10, border: `1px solid ${PP.hair}` }}>
              <div style={{ fontSize: 10, color: PP.mute, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: PP.ink }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 13, color: PP.mute, lineHeight: 1.5, marginBottom: 20 }}>{description}</p>
    </div>

    <button
      style={{
        width: '100%', padding: '12px 0',
        background: ctaBg, color: '#fff',
        border: 0, borderRadius: 12,
        fontFamily: PP.font, fontSize: 13, fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >{ctaLabel} <ChevronRight size={15}/></button>
  </div>
);

// ── Locked module card ────────────────────────────────────────────────────────

const LockedCard: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; features: string[] }> = ({
  title, subtitle, icon, features
}) => {
  const handleContact = () => {
    const msg = encodeURIComponent(`Hola, me interesa activar el módulo *${title}* en mi club de ParaPádel. ¿Me podéis dar más info?`);
    window.open(`https://wa.me/34600000000?text=${msg}`, '_blank');
  };
  return (
    <div style={{
      background: PP.card, border: `2px dashed ${PP.hairStrong}`, borderRadius: 16,
      padding: 24, opacity: 0.75, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: PP.bg, color: PP.muteSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: PP.muteSoft, letterSpacing: -0.4 }}>{title}</h3>
              <p style={{ fontSize: 11, color: PP.muteSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{subtitle}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: PP.bg, color: PP.muteSoft, fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 99, border: `1px solid ${PP.hair}` }}>
            <Lock size={10}/> No activado
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {features.map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: PP.muteSoft }}>
              <div style={{ width: 16, height: 16, borderRadius: 99, background: PP.hairStrong, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={9} color={PP.muteSoft} strokeWidth={3}/>
              </div>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleContact}
        style={{
          width: '100%', padding: '12px 0',
          background: PP.bg, color: PP.mute,
          border: `2px dashed ${PP.hairStrong}`, borderRadius: 12,
          fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      ><Lock size={14}/> SOLICITAR ACTIVACIÓN</button>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const GeneralDashboard: React.FC = () => {
  const { state, fetchTournamentList } = useTournament();
  const { leaguesList, fetchLeagues } = useLeague();
  const { clubData } = useHistory();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [openMatchCount, setOpenMatchCount] = useState<number | null>(null);
  const [courtsStats, setCourtsStats] = useState<{ occupied: number; total: number } | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  useEffect(() => {
    fetchTournamentList();
    fetchLeagues();
  }, [fetchTournamentList, fetchLeagues]);

  useEffect(() => {
    if (!clubData.id) return;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Open matches today
    supabase.from('free_matches').select('id', { count: 'exact', head: true })
      .eq('club_id', clubData.id).eq('status', 'open')
      .gte('scheduled_at', todayStart.toISOString())
      .then(({ count }) => setOpenMatchCount(count ?? 0));

    // Courts occupied today
    if (clubData.courts_enabled) {
      supabase.from('court_reservations').select('court_number')
        .eq('club_id', clubData.id)
        .not('status', 'in', '("rejected","cancelled")')
        .gte('start_at', todayStart.toISOString())
        .lte('start_at', todayEnd.toISOString())
        .then(({ data }) => {
          const unique = new Set((data || []).map((r: any) => r.court_number));
          setCourtsStats({ occupied: unique.size, total: clubData.courtCount || 0 });
        });
    }

    // Player count
    supabase.from('players').select('id', { count: 'exact', head: true })
      .eq('club_id', clubData.id)
      .then(({ count }) => setPlayerCount(count ?? 0));
  }, [clubData.id, clubData.courts_enabled, clubData.courtCount]);

  const allMinis       = state.tournamentList || [];
  const activeMinis    = allMinis.filter(t => t.status === 'active');
  const setupMinis     = allMinis.filter(t => t.status === 'setup');
  const activeLeagues  = leaguesList.filter(l => l.status === 'groups' || l.status === 'playoffs');
  const totalLeaguePairs = leaguesList.reduce((acc, l) => acc + (l.pairsCount || 0), 0);

  const showMinisFull  = clubData.minis_full_enabled !== false;
  const showMinisLite  = clubData.minis_lite_enabled === true;
  const showLeague     = clubData.league_enabled === true;
  const showCourts     = clubData.courts_enabled === true;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const adminName = user?.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '';
  const showDefaultBranding = clubData.name === 'Mi Club de Padel' || clubData.name === 'ParaPadel';
  const clubDisplayName = showDefaultBranding ? 'ParaPádel' : clubData.name;

  return (
    <div style={{ fontFamily: PP.font, color: PP.ink }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: PP.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>
          {greeting}{adminName ? `, ${adminName}` : ''}
        </h1>
        <p style={{ fontSize: 13.5, color: PP.mute, fontWeight: 500, marginTop: 6 }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · {clubDisplayName}
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}
           className="md:grid-cols-4">
        <KPITile
          label="Partidos abiertos hoy"
          value={openMatchCount ?? '—'}
          sub={openMatchCount != null ? `${openMatchCount > 0 ? 'activos' : 'sin partidos'}` : 'Cargando…'}
          accent={PP.primary}
          icon={<Swords size={16}/>}
          onClick={() => navigate('/partidos')}
        />
        {clubData.courts_enabled && courtsStats != null ? (
          <KPITile
            label="Pistas ocupadas"
            value={`${courtsStats.occupied}/${courtsStats.total}`}
            sub={`${Math.round((courtsStats.occupied / (courtsStats.total || 1)) * 100)}% ocupación`}
            accent={PP.ok}
            icon={<LayoutGrid size={16}/>}
            onClick={() => navigate('/courts')}
          />
        ) : (
          <KPITile
            label="Torneos activos"
            value={activeMinis.length}
            sub={`${setupMinis.length} en inscripción`}
            accent={PP.primary}
            icon={<Trophy size={16}/>}
            onClick={() => navigate('/minis')}
          />
        )}
        <KPITile
          label={showMinisFull ? 'Inscritos Minis' : 'Parejas en liga'}
          value={showMinisFull
            ? allMinis.reduce((a, t) => a + ((t as any).pairsCount || 0), 0)
            : totalLeaguePairs}
          sub={showMinisFull ? `en ${allMinis.length} torneo${allMinis.length !== 1 ? 's' : ''}` : `en ${activeLeagues.length} liga${activeLeagues.length !== 1 ? 's' : ''}`}
          accent="#F59E0B"
          icon={<Activity size={16}/>}
          onClick={() => navigate(showMinisFull ? '/minis' : '/league')}
        />
        <KPITile
          label="Jugadores en el club"
          value={playerCount ?? '—'}
          sub="miembros activos"
          accent="#6F3FD9"
          icon={<Users size={16}/>}
          onClick={() => navigate('/players')}
        />
      </div>

      {/* ── Quick actions row ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/partidos')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 10,
            background: PP.primary, color: '#fff',
            border: 0, fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        ><Plus size={15}/> Nuevo partido</button>
        {showMinisFull && (
          <button
            onClick={() => navigate('/setup')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 10,
              background: PP.card, color: PP.ink2,
              border: `1px solid ${PP.hairStrong}`,
              fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          ><Trophy size={15}/> Crear torneo</button>
        )}
        {showCourts && (
          <button
            onClick={() => navigate('/courts')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 10,
              background: PP.card, color: PP.ink2,
              border: `1px solid ${PP.hairStrong}`,
              fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          ><LayoutGrid size={15}/> Reservar pista</button>
        )}
        <button
          onClick={() => navigate('/players')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 10,
            background: PP.card, color: PP.ink2,
            border: `1px solid ${PP.hairStrong}`,
            fontFamily: PP.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        ><Users size={15}/> Jugadores</button>
      </div>

      {/* ── Modules grid ── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: PP.ink, letterSpacing: -0.2, marginBottom: 14 }}>
        Módulos
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }} className="md:grid-cols-2">

        {/* MINIS FULL */}
        {showMinisFull && (
          <ModuleCard
            title="Minis"
            subtitle="Torneos Express"
            icon={<Trophy size={24}/>}
            accentColor={PP.primary}
            accentTint={PP.primaryTint}
            stats={[
              { label: 'En juego', value: activeMinis.length },
              { label: 'Inscripción', value: setupMinis.length },
            ]}
            description="Gestiona torneos rápidos de 8, 10, 12 o 16 parejas. Sorteos automáticos y directo en vivo."
            ctaLabel="GESTIONAR MINIS"
            ctaBg={PP.primary}
            onClick={() => navigate('/minis')}
          />
        )}

        {/* MINIS LITE */}
        {showMinisLite && (
          <ModuleCard
            title="Minis"
            subtitle="Gestión Simplificada"
            badge="LITE"
            icon={<Smartphone size={24}/>}
            accentColor={PP.ok}
            accentTint={PP.okTint}
            description="Versión optimizada para gestión rápida desde móvil. Crea torneos y comparte resultados al instante."
            ctaLabel="ACCEDER A LITE"
            ctaBg={PP.ok}
            onClick={() => navigate('/lite/setup')}
          />
        )}

        {/* LIGAS */}
        {showLeague ? (
          <ModuleCard
            title="Ligas"
            subtitle="Larga Duración"
            icon={<GitMerge size={24}/>}
            accentColor="#059669"
            accentTint="#E7F8F1"
            stats={[
              { label: 'Activas', value: activeLeagues.length },
              { label: 'Parejas', value: totalLeaguePairs },
            ]}
            description="Competición por jornadas, grupos y playoffs finales. Seguimiento mensual."
            ctaLabel="GESTIONAR LIGAS"
            ctaBg={PP.ink}
            onClick={() => navigate('/league')}
          />
        ) : (
          <LockedCard
            title="Ligas"
            subtitle="Larga Duración"
            icon={<GitMerge size={22}/>}
            features={['Clasificaciones automáticas', 'Sistema de grupos + playoffs', 'Jornadas y calendario', 'Seguimiento de ELO por liga']}
          />
        )}

        {/* PISTAS */}
        {showCourts ? (
          <ModuleCard
            title="Pistas"
            subtitle="Calendario de Reservas"
            icon={<CalendarDays size={24}/>}
            accentColor="#7C3AED"
            accentTint="#F0E6FF"
            stats={courtsStats ? [
              { label: 'Ocupadas hoy', value: `${courtsStats.occupied}/${courtsStats.total}` },
            ] : undefined}
            description="Calendario semanal de pistas con reservas, partidos abiertos, clases y bloqueos."
            ctaLabel="GESTIONAR PISTAS"
            ctaBg="#7C3AED"
            onClick={() => navigate('/courts')}
          />
        ) : (
          <LockedCard
            title="Pistas"
            subtitle="Calendario de Reservas"
            icon={<CalendarDays size={22}/>}
            features={['Slots de 60 y 90 minutos', 'Hasta 12 pistas simultáneas', 'Integración con WhatsApp', 'Confirmación por el admin']}
          />
        )}

        {/* PARTIDOS ABIERTOS */}
        <ModuleCard
          title="Partidos Abiertos"
          subtitle="Partidas Libres"
          icon={<Swords size={24}/>}
          accentColor="#D97706"
          accentTint="#FFF4CC"
          stats={openMatchCount != null ? [
            { label: 'Abiertos hoy', value: openMatchCount },
          ] : undefined}
          description="Crea partidos abiertos que los jugadores pueden unirse por enlace público. Comparte por WhatsApp."
          ctaLabel="VER PARTIDOS"
          ctaBg="#D97706"
          onClick={() => navigate('/partidos')}
        />

        {/* JUGADORES */}
        <ModuleCard
          title="Jugadores"
          subtitle="Gestión de Miembros"
          icon={<Users size={24}/>}
          accentColor="#6F3FD9"
          accentTint="#F0E6FF"
          stats={playerCount != null ? [
            { label: 'Miembros', value: playerCount },
          ] : undefined}
          description="Lista de jugadores con ELO, categorías y estadísticas. Filtro, búsqueda e importación CSV."
          ctaLabel="VER JUGADORES"
          ctaBg="#6F3FD9"
          onClick={() => navigate('/players')}
        />

      </div>
    </div>
  );
};

export default GeneralDashboard;
