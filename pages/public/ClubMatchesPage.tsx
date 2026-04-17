import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { THEME } from '../../utils/theme';
import { generateClubMatchesText, openWhatsApp } from '../../utils/whatsapp';
import {
  MapPin, BarChart2, Users, ChevronRight,
  MessageCircle, Loader2, CalendarDays, Clock
} from 'lucide-react';

interface OpenMatch {
  id: string;
  share_token: string;
  scheduled_at: string;
  level?: string | null;
  court?: string | null;
  notes?: string | null;
  max_players: number;
  spots_taken: number;
}

interface ClubInfo {
  id: string;
  name: string;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const formatDateLong = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

const formatDayShort = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'HOY';
  if (d.toDateString() === tomorrow.toDateString()) return 'MÑN';
  return d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().slice(0, 3);
};

const ClubMatchesPage: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [club, setClub] = useState<ClubInfo | null>(null);
  const [matches, setMatches] = useState<OpenMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!clubId) return;

    const load = async () => {
      // Club info
      const { data: clubData } = await supabase
        .from('clubs')
        .select('id, name')
        .eq('id', clubId)
        .maybeSingle();

      if (!clubData) { setNotFound(true); setLoading(false); return; }
      setClub(clubData);

      // All open future matches for this club
      const { data: matchData } = await supabase
        .from('free_matches')
        .select(`
          id, share_token, scheduled_at, level, court, notes, max_players,
          match_participants!match_id ( id, attendance_status )
        `)
        .eq('club_id', clubId)
        .eq('status', 'open')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });

      const rows: OpenMatch[] = (matchData || []).map((m: any) => ({
        id: m.id,
        share_token: m.share_token,
        scheduled_at: m.scheduled_at,
        level: m.level,
        court: m.court,
        notes: m.notes,
        max_players: m.max_players,
        spots_taken: (m.match_participants || []).filter(
          (p: any) => ['joined', 'confirmed'].includes(p.attendance_status)
        ).length,
      }));

      setMatches(rows);
      setLoading(false);
    };

    load();
  }, [clubId]);

  const handleShare = () => {
    if (!club) return;
    const text = generateClubMatchesText(club.name, club.id, matches);
    openWhatsApp(text);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (notFound || !club) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-black text-slate-800 mb-2">Club no encontrado</h1>
        <p className="text-slate-400 text-sm">El club que buscas no existe o ya no está disponible.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Partidos abiertos</p>
              <h1 className="text-xl font-black text-slate-900">{club.name}</h1>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-black shadow-sm"
              style={{ background: '#25D366' }}
            >
              <MessageCircle size={16} />
              Compartir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-24">
        {matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎾</div>
            <h2 className="text-lg font-black text-slate-700 mb-2">Sin partidos abiertos</h2>
            <p className="text-sm text-slate-400">Este club no tiene partidos disponibles ahora mismo.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 font-medium">
              {matches.length} partido{matches.length > 1 ? 's' : ''} disponible{matches.length > 1 ? 's' : ''}
            </p>

            {matches.map((m) => {
              const spotsLeft = m.max_players - m.spots_taken;
              const full = spotsLeft <= 0;
              const dateLabel = formatDateLong(m.scheduled_at);
              const dayShort = formatDayShort(m.scheduled_at);
              const timeLabel = formatTime(m.scheduled_at);

              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/m/${m.share_token}`)}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-left active:scale-[0.98] transition-all"
                >
                  {/* Time header — very prominent */}
                  <div
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ background: full ? '#94a3b8' : THEME.cta }}
                  >
                    <div className="text-white text-center">
                      <div className="text-xs font-black opacity-80 uppercase tracking-widest leading-none">
                        {dayShort}
                      </div>
                      <div className="text-4xl font-black leading-none mt-0.5 tabular-nums">
                        {timeLabel}
                      </div>
                    </div>
                    <div className="flex-1 text-white">
                      <div className="text-sm font-bold opacity-90 capitalize">{dateLabel}</div>
                      <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black ${
                        full ? 'bg-white/20 text-white' : 'bg-white/25 text-white'
                      }`}>
                        <Users size={11} />
                        {full ? 'Completo' : `${spotsLeft} plaza${spotsLeft > 1 ? 's' : ''} libre${spotsLeft > 1 ? 's' : ''}`}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-white/60 shrink-0" />
                  </div>

                  {/* Match details */}
                  <div className="px-5 py-3 flex items-center gap-4">
                    {m.level && (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                        <BarChart2 size={14} className="text-slate-400" />
                        {m.level}
                      </span>
                    )}
                    {m.court && (
                      <span className="flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin size={13} className="text-slate-400" />
                        {m.court}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                      <span className="font-bold text-slate-600">{m.spots_taken}</span>/{m.max_players}
                      <span>jugadores</span>
                    </div>
                  </div>

                  {/* Spots bar */}
                  <div className="px-5 pb-4">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (m.spots_taken / m.max_players) * 100)}%`,
                          background: full ? '#94a3b8' : THEME.cta,
                        }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Bottom share CTA */}
            <div className="pt-4">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black text-sm shadow-sm"
                style={{ background: '#25D366' }}
              >
                <MessageCircle size={18} />
                Compartir todos los partidos por WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClubMatchesPage;
