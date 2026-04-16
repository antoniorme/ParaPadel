import React, { useState, useEffect, useCallback } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { useToast } from '../components/Toast';
import { Modal, Button, EmptyState, Badge, PlayerSelector } from '../components';
import { THEME } from '../utils/theme';
import { calculateDisplayRanking, calculateMatchDelta, getPairTeamElo } from '../utils/Elo';
import { supabase } from '../lib/supabase';
import { Player, Match, MatchParticipant } from '../types';
import {
  Swords, Plus, CheckCircle2, Clock, Trash2,
  ChevronDown, ChevronUp, MapPin, Zap, Users,
} from 'lucide-react';

// ── HELPERS ───────────────────────────────────────────────────────────────────

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return { day: d.getDate(), month: d.toLocaleDateString('es-ES', { month: 'short' }) };
  } catch { return { day: '—', month: '' }; }
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────

const MatchManager: React.FC = () => {
  const { state, formatPlayerName } = useTournament();
  const { clubData } = useHistory();
  const { success, error: toastError } = useToast();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'finished'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '',
    court: '',
    level: '',
    p1a: '', p2a: '', p1b: '', p2b: '',
    notes: '',
  });

  // Score modal
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allPlayers: Player[] = state.players;
  const clubId = clubData?.id || state.players[0]?.user_id;

  // ── LOAD ────────────────────────────────────────────────────

  const loadMatches = useCallback(async () => {
    if (!clubId) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('free_matches')
      .select(`
        *,
        match_participants (
          id, player_id, team, slot_index, attendance_status, participant_type,
          player:player_id (
            id, name, nickname, global_rating, manual_rating,
            category_ratings, main_category, categories
          )
        ),
        match_results ( id, team_a_score, team_b_score, status, rating_impact_mode )
      `)
      .eq('club_id', clubId)
      .order('scheduled_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        setTableReady(false);
        setMatches([]);
      } else {
        toastError('Error al cargar partidos');
      }
    } else {
      setTableReady(true);
      setMatches((data || []) as Match[]);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  // ── CREATE ──────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.date || !form.p1a || !form.p1b) {
      toastError('Selecciona al menos un jugador por pareja y una fecha');
      return;
    }
    setCreating(true);

    const scheduledAt = form.time
      ? `${form.date}T${form.time}:00`
      : `${form.date}T00:00:00`;

    // 1. Crear el partido
    const { data: matchData, error: matchErr } = await supabase
      .from('free_matches')
      .insert({
        club_id: clubId,
        scheduled_at: scheduledAt,
        court: form.court || null,
        level: form.level || null,
        notes: form.notes || null,
        max_players: 4,
        status: 'open',
      })
      .select('id')
      .single();

    if (matchErr || !matchData) {
      toastError('Error al crear el partido');
      setCreating(false);
      return;
    }

    // 2. Insertar participantes
    const participants = [
      { match_id: matchData.id, player_id: form.p1a, team: 'A', slot_index: 1 },
      ...(form.p2a ? [{ match_id: matchData.id, player_id: form.p2a, team: 'A', slot_index: 2 }] : []),
      { match_id: matchData.id, player_id: form.p1b, team: 'B', slot_index: 3 },
      ...(form.p2b ? [{ match_id: matchData.id, player_id: form.p2b, team: 'B', slot_index: 4 }] : []),
    ].map(p => ({ ...p, participant_type: 'registered_player', joined_via: 'manual' }));

    const { error: partErr } = await supabase
      .from('match_participants')
      .insert(participants);

    if (partErr) {
      toastError('Partido creado pero hubo un error con los jugadores');
    } else {
      success('Partido creado');
    }

    setCreating(false);
    setShowCreate(false);
    setForm({ date: new Date().toISOString().split('T')[0], time: '', court: '', level: '', p1a: '', p2a: '', p1b: '', p2b: '', notes: '' });
    loadMatches();
  };

  // ── SAVE SCORE + ELO ────────────────────────────────────────

  const handleSaveScore = async () => {
    if (!scoreMatch) return;
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) { toastError('Resultado inválido'); return; }
    if (a === b) { toastError('El resultado no puede ser empate'); return; }

    setSavingScore(true);

    // 1. Insertar resultado
    const { error: resErr } = await supabase
      .from('match_results')
      .insert({
        match_id: scoreMatch.id,
        team_a_score: a,
        team_b_score: b,
        status: 'final',
        rating_impact_mode: 'full',
      });

    if (resErr) { toastError('Error al guardar resultado'); setSavingScore(false); return; }

    // 2. Actualizar estado del partido
    await supabase
      .from('free_matches')
      .update({ status: 'finished', result_status: 'final' })
      .eq('id', scoreMatch.id);

    // 3. Procesar ELO si no está procesado
    if (!scoreMatch.elo_processed) {
      const parts = scoreMatch.match_participants || [];
      const teamA = parts.filter(p => p.team === 'A' && p.player).map(p => p.player as Player);
      const teamB = parts.filter(p => p.team === 'B' && p.player).map(p => p.player as Player);

      if (teamA.length > 0 && teamB.length > 0) {
        const eloA = teamA.length === 2 ? getPairTeamElo(teamA[0], teamA[1]) : calculateDisplayRanking(teamA[0]);
        const eloB = teamB.length === 2 ? getPairTeamElo(teamB[0], teamB[1]) : calculateDisplayRanking(teamB[0]);
        const delta = calculateMatchDelta(eloA, eloB, a, b);

        const updates = [
          ...teamA.map(p => ({ id: p.id, delta, current: calculateDisplayRanking(p) })),
          ...teamB.map(p => ({ id: p.id, delta: -delta, current: calculateDisplayRanking(p) })),
        ];

        await Promise.all(updates.map(({ id, delta: d, current }) =>
          supabase.from('players').update({ global_rating: Math.max(100, Math.round(current + d)) }).eq('id', id)
        ));

        await supabase.from('free_matches').update({ elo_processed: true }).eq('id', scoreMatch.id);
      }
    }

    setSavingScore(false);
    success('Resultado guardado · ELO actualizado');
    setScoreMatch(null);
    setScoreA(''); setScoreB('');
    loadMatches();
  };

  // ── DELETE ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from('free_matches').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) { toastError('Error al eliminar'); return; }
    success('Partido eliminado');
    setDeleteId(null);
    loadMatches();
  };

  // ── HELPERS UI ──────────────────────────────────────────────

  const getTeamPlayers = (m: Match, team: 'A' | 'B'): Player[] =>
    (m.match_participants || [])
      .filter(p => p.team === team && p.player && p.attendance_status !== 'cancelled')
      .sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0))
      .map(p => p.player as Player);

  const pairLabel = (players: Player[]) => {
    if (players.length === 0) return '—';
    return players.map(p => p.nickname ? `"${p.nickname}"` : p.name.split(' ')[0]).join(' & ');
  };

  const getResult = (m: Match) => (m.match_results || [])[0] || null;

  const eloPreview = () => {
    const p1a = allPlayers.find(p => p.id === form.p1a);
    const p2a = allPlayers.find(p => p.id === form.p2a);
    const p1b = allPlayers.find(p => p.id === form.p1b);
    const p2b = allPlayers.find(p => p.id === form.p2b);
    if (!p1a || !p1b) return null;
    const eloA = p2a ? getPairTeamElo(p1a, p2a) : calculateDisplayRanking(p1a);
    const eloB = p2b ? getPairTeamElo(p1b, p2b) : calculateDisplayRanking(p1b);
    const delta = Math.abs(calculateMatchDelta(eloA, eloB, 1, 0));
    return { eloA, eloB, delta };
  };
  const preview = eloPreview();

  const filtered = matches.filter(m =>
    tab === 'pending' ? m.status !== 'finished' && m.status !== 'cancelled' : m.status === 'finished'
  );

  // ── RENDER ──────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Partidos</h1>
          <p className="text-sm text-slate-400 mt-0.5">Partidos libres del club</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Nuevo partido
        </Button>
      </div>

      {/* Migration warning */}
      {!tableReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm">
          <div className="font-bold text-amber-800 mb-1">⚠️ Migración pendiente</div>
          <p className="text-amber-700 text-xs">
            Ejecuta el archivo <code className="bg-amber-100 px-1 rounded">supabase/migrations/20260416_matches_unified.sql</code> en el SQL Editor de Supabase para activar este módulo.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
        {([['pending', 'Pendientes'], ['finished', 'Finalizados']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              tab === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {l}
            {tab === v && <span className="ml-1 text-xs font-black text-slate-400">({filtered.length})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 font-bold animate-pulse">Cargando partidos...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Swords size={28} />}
          title={tab === 'pending' ? 'Sin partidos pendientes' : 'Sin partidos finalizados'}
          body={tab === 'pending' ? 'Crea un partido libre entre jugadores del club.' : 'Los partidos terminados aparecerán aquí.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const isExpanded = expandedId === m.id;
            const teamA = getTeamPlayers(m, 'A');
            const teamB = getTeamPlayers(m, 'B');
            const result = getResult(m);
            const dateInfo = fmtDate(m.scheduled_at);

            return (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <button
                  className="w-full p-4 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                >
                  {/* Date */}
                  <div className="shrink-0 w-12 text-center">
                    <div className="text-lg font-black text-slate-800">{dateInfo.day}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{dateInfo.month}</div>
                  </div>

                  {/* Teams */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <span className="truncate">{pairLabel(teamA)}</span>
                      <span className="text-slate-300 shrink-0 text-xs font-black">VS</span>
                      <span className="truncate">{pairLabel(teamB)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.court && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin size={10} /> {m.court}
                        </span>
                      )}
                      {m.scheduled_at && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10} /> {fmtTime(m.scheduled_at)}
                        </span>
                      )}
                      {m.level && (
                        <span className="text-xs font-bold text-slate-400">{m.level}</span>
                      )}
                    </div>
                  </div>

                  {/* Score / Status */}
                  <div className="shrink-0 text-right">
                    {result ? (
                      <div>
                        <div className="text-base font-black text-slate-800 tabular-nums">
                          {result.team_a_score} – {result.team_b_score}
                        </div>
                        {m.elo_processed && (
                          <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-0.5">
                            <Zap size={9} /> ELO ok
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="neutral">Pendiente</Badge>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
                    : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {(['A', 'B'] as const).map(side => {
                        const players = getTeamPlayers(m, side);
                        const won = result
                          ? (side === 'A' ? result.team_a_score > result.team_b_score : result.team_b_score > result.team_a_score)
                          : false;
                        return (
                          <div key={side} className={`rounded-xl p-3 ${won ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              Pareja {side}
                              {won && <span className="ml-1 text-emerald-600">· Ganador</span>}
                            </div>
                            {players.length === 0 ? (
                              <div className="text-xs text-slate-400 italic">Sin jugadores</div>
                            ) : players.map(pl => (
                              <div key={pl.id} className="flex items-center gap-2 mb-1">
                                <div
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black shrink-0"
                                  style={{ background: getAvatarColor(pl.name) }}
                                >
                                  {pl.name[0]}
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate">{pl.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 ml-auto tabular-nums">
                                  {calculateDisplayRanking(pl)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {m.notes && (
                      <p className="text-xs text-slate-400 italic">{m.notes}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      {!result && (
                        <Button
                          variant="primary"
                          onClick={() => { setScoreMatch(m); setExpandedId(null); }}
                        >
                          <CheckCircle2 size={14} /> Añadir resultado
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => setDeleteId(m.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo partido"
        icon={<Swords size={22} />}
        iconColor="info"
        actions={[
          { label: 'Cancelar', onClick: () => setShowCreate(false), variant: 'secondary' },
          { label: 'Crear partido', onClick: handleCreate, variant: 'primary', loading: creating },
        ]}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fecha</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Hora</label>
              <input
                type="time"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pista</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                placeholder="Ej. Pista 2"
                value={form.court}
                onChange={e => setForm(f => ({ ...f, court: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nivel</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                placeholder="Ej. 4ª alta"
                value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pareja A</div>
            <div className="space-y-2">
              <PlayerSelector label="Jugador 1" selectedId={form.p1a} onSelect={id => setForm(f => ({ ...f, p1a: id }))} otherSelectedId={form.p2a} players={allPlayers} formatName={formatPlayerName} />
              <PlayerSelector label="Jugador 2 (opcional)" selectedId={form.p2a} onSelect={id => setForm(f => ({ ...f, p2a: id }))} otherSelectedId={form.p1a} players={allPlayers} formatName={formatPlayerName} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pareja B</div>
            <div className="space-y-2">
              <PlayerSelector label="Jugador 1" selectedId={form.p1b} onSelect={id => setForm(f => ({ ...f, p1b: id }))} otherSelectedId={form.p2b} players={allPlayers} formatName={formatPlayerName} />
              <PlayerSelector label="Jugador 2 (opcional)" selectedId={form.p2b} onSelect={id => setForm(f => ({ ...f, p2b: id }))} otherSelectedId={form.p1b} players={allPlayers} formatName={formatPlayerName} />
            </div>
          </div>

          {preview && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <div className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1">
                <Zap size={12} /> ELO en juego
              </div>
              <div className="text-xs text-indigo-700">
                Si gana Pareja A: <strong>+{preview.delta} / -{preview.delta}</strong> pts
              </div>
              <div className="text-xs text-indigo-500">
                ELO medio A: {preview.eloA} vs B: {preview.eloB}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Notas (opcional)</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-indigo-400 resize-none"
              rows={2}
              placeholder="Partido amistoso, eliminatoria..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* ── SCORE MODAL ──────────────────────────────────────── */}
      <Modal
        isOpen={!!scoreMatch}
        onClose={() => setScoreMatch(null)}
        title="Resultado del partido"
        icon={<CheckCircle2 size={22} />}
        iconColor="success"
        actions={[
          { label: 'Cancelar', onClick: () => setScoreMatch(null), variant: 'secondary' },
          { label: 'Guardar + procesar ELO', onClick: handleSaveScore, variant: 'primary', loading: savingScore },
        ]}
      >
        {scoreMatch && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-center font-bold text-slate-700">
              {pairLabel(getTeamPlayers(scoreMatch, 'A'))}
              <span className="text-slate-400 mx-2">VS</span>
              {pairLabel(getTeamPlayers(scoreMatch, 'B'))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['A', 'B'] as const).map(side => (
                <div key={side}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center">
                    {pairLabel(getTeamPlayers(scoreMatch, side))}
                  </label>
                  <input
                    type="number" min="0" max="9"
                    className="w-full px-3 py-4 border-2 border-slate-200 rounded-2xl text-3xl font-black text-center text-slate-900 outline-none focus:border-indigo-400"
                    placeholder="0"
                    value={side === 'A' ? scoreA : scoreB}
                    onChange={e => side === 'A' ? setScoreA(e.target.value) : setScoreB(e.target.value)}
                  />
                </div>
              ))}
            </div>
            {scoreA && scoreB && scoreA !== scoreB && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                <Zap size={12} className="inline mr-1" />
                Al guardar se actualizará el ELO automáticamente.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── DELETE MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="¿Eliminar partido?"
        icon={<Trash2 size={22} />}
        iconColor="danger"
        actions={[
          { label: 'Cancelar', onClick: () => setDeleteId(null), variant: 'secondary' },
          { label: 'Eliminar', onClick: handleDelete, variant: 'danger', loading: deleting },
        ]}
      >
        <p className="text-sm text-slate-600">
          Esta acción no se puede deshacer. Si el partido ya tenía ELO procesado, los puntos <strong>no se revertirán</strong>.
        </p>
      </Modal>
    </div>
  );
};

export default MatchManager;
