import React, { useState, useEffect, useCallback } from 'react';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { useToast } from '../components/Toast';
import { Modal, Button, EmptyState, Badge, PlayerSelector } from '../components';
import { THEME } from '../utils/theme';
import { calculateDisplayRanking, calculateMatchDelta, getPairTeamElo } from '../utils/Elo';
import { supabase } from '../lib/supabase';
import { Player } from '../types';
import {
  Swords, Plus, CheckCircle2, Clock, Trash2, ChevronDown, ChevronUp,
  Calendar, MapPin, Zap
} from 'lucide-react';

interface Partido {
  id: string;
  club_id: string;
  date: string;
  start_time?: string;
  court?: string;
  player1_a?: string;
  player2_a?: string;
  player1_b?: string;
  player2_b?: string;
  score_a: number;
  score_b: number;
  is_finished: boolean;
  elo_processed: boolean;
  notes?: string;
  created_at: string;
  // Joined
  p1a?: Player;
  p2a?: Player;
  p1b?: Player;
  p2b?: Player;
}

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5','#7C3AED','#DB2777','#059669','#D97706','#DC2626','#0284C7','#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const MatchManager: React.FC = () => {
  const { state, formatPlayerName } = useTournament();
  const { clubData } = useHistory();
  const { success, error: toastError } = useToast();

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'finished'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    court: '',
    start_time: '',
    p1a: '', p2a: '', p1b: '', p2b: '',
    notes: '',
  });

  // Score modal state
  const [scorePartido, setScorePartido] = useState<Partido | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // All club players for selector
  const allPlayers: Player[] = state.players;

  const clubId = clubData?.id || state.players[0]?.user_id;

  const loadPartidos = useCallback(async () => {
    if (!clubId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('partidos')
      .select(`
        *,
        p1a:player1_a (id, name, nickname, global_rating, manual_rating, category_ratings, main_category, categories),
        p2a:player2_a (id, name, nickname, global_rating, manual_rating, category_ratings, main_category, categories),
        p1b:player1_b (id, name, nickname, global_rating, manual_rating, category_ratings, main_category, categories),
        p2b:player2_b (id, name, nickname, global_rating, manual_rating, category_ratings, main_category, categories)
      `)
      .eq('club_id', clubId)
      .order('date', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet — show empty state with migration hint
        setPartidos([]);
      } else {
        toastError('Error al cargar partidos');
      }
    } else {
      setPartidos((data || []) as Partido[]);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => { loadPartidos(); }, [loadPartidos]);

  // Create partido
  const handleCreate = async () => {
    if (!form.date || !form.p1a || !form.p1b) {
      toastError('Selecciona al menos un jugador por pareja y una fecha');
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('partidos').insert({
      club_id: clubId,
      date: form.date,
      start_time: form.start_time || null,
      court: form.court || null,
      player1_a: form.p1a || null,
      player2_a: form.p2a || null,
      player1_b: form.p1b || null,
      player2_b: form.p2b || null,
      score_a: 0,
      score_b: 0,
      is_finished: false,
      elo_processed: false,
      notes: form.notes || null,
    });
    setCreating(false);
    if (error) { toastError('Error al crear el partido'); return; }
    success('Partido creado');
    setShowCreate(false);
    setForm({ date: new Date().toISOString().split('T')[0], court: '', start_time: '', p1a: '', p2a: '', p1b: '', p2b: '', notes: '' });
    loadPartidos();
  };

  // Save score + process ELO
  const handleSaveScore = async () => {
    if (!scorePartido) return;
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) { toastError('Resultado inválido'); return; }
    if (a === b) { toastError('El resultado no puede ser empate'); return; }

    setSavingScore(true);

    // Update score in partido
    const { error } = await supabase.from('partidos').update({
      score_a: a,
      score_b: b,
      is_finished: true,
    }).eq('id', scorePartido.id);

    if (error) { toastError('Error al guardar resultado'); setSavingScore(false); return; }

    // Process ELO if players exist
    const p1a = scorePartido.p1a;
    const p2a = scorePartido.p2a;
    const p1b = scorePartido.p1b;
    const p2b = scorePartido.p2b;

    if (p1a && p1b && !scorePartido.elo_processed) {
      const teamAElo = p2a ? getPairTeamElo(p1a as Player, p2a as Player) : calculateDisplayRanking(p1a as Player);
      const teamBElo = p2b ? getPairTeamElo(p1b as Player, p2b as Player) : calculateDisplayRanking(p1b as Player);
      const delta = calculateMatchDelta(teamAElo, teamBElo, a, b);

      const updates: { id: string; delta: number }[] = [
        { id: p1a.id, delta },
        ...(p2a ? [{ id: p2a.id, delta }] : []),
        { id: p1b.id, delta: -delta },
        ...(p2b ? [{ id: p2b.id, delta: -delta }] : []),
      ];

      await Promise.all(updates.map(async ({ id, delta: d }) => {
        const player = [p1a, p2a, p1b, p2b].find(p => p?.id === id) as Player;
        if (!player) return;
        const currentElo = calculateDisplayRanking(player);
        const newElo = Math.max(100, Math.round(currentElo + d));
        await supabase.from('players').update({ global_rating: newElo }).eq('id', id);
      }));

      await supabase.from('partidos').update({ elo_processed: true }).eq('id', scorePartido.id);
    }

    setSavingScore(false);
    success('Resultado guardado · ELO actualizado');
    setScorePartido(null);
    setScoreA(''); setScoreB('');
    loadPartidos();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from('partidos').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) { toastError('Error al eliminar'); return; }
    success('Partido eliminado');
    setDeleteId(null);
    loadPartidos();
  };

  const filtered = partidos.filter(p => tab === 'pending' ? !p.is_finished : p.is_finished);

  const pairLabel = (p1?: Player, p2?: Player) => {
    if (!p1) return '—';
    const n1 = p1.nickname ? `"${p1.nickname}"` : p1.name.split(' ')[0];
    const n2 = p2 ? (p2.nickname ? `"${p2.nickname}"` : p2.name.split(' ')[0]) : null;
    return n2 ? `${n1} & ${n2}` : n1;
  };

  const eloPreview = () => {
    const p1a = allPlayers.find(p => p.id === form.p1a);
    const p2a = allPlayers.find(p => p.id === form.p2a);
    const p1b = allPlayers.find(p => p.id === form.p1b);
    const p2b = allPlayers.find(p => p.id === form.p2b);
    if (!p1a || !p1b) return null;
    const teamA = p2a ? getPairTeamElo(p1a, p2a) : calculateDisplayRanking(p1a);
    const teamB = p2b ? getPairTeamElo(p1b, p2b) : calculateDisplayRanking(p1b);
    const delta = Math.abs(calculateMatchDelta(teamA, teamB, 1, 0));
    return { teamA, teamB, deltaWin: delta, deltaLoss: -delta };
  };
  const preview = eloPreview();

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
            {l} {tab === v && <span className="ml-1 text-xs font-black text-slate-400">({filtered.length})</span>}
          </button>
        ))}
      </div>

      {/* No table warning */}
      {!loading && partidos.length === 0 && tab === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm">
          <div className="font-bold text-amber-800 mb-1">⚠️ Módulo pendiente de activar</div>
          <p className="text-amber-700 text-xs">
            Ejecuta la migración SQL en Supabase para habilitar los partidos libres. Encontrarás el script más abajo en la pantalla.
          </p>
        </div>
      )}

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
          {filtered.map(p => {
            const isExpanded = expandedId === p.id;
            const labelA = pairLabel(p.p1a, p.p2a);
            const labelB = pairLabel(p.p1b, p.p2b);
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <button
                  className="w-full p-4 text-left flex items-center gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                >
                  {/* Date */}
                  <div className="shrink-0 w-12 text-center">
                    <div className="text-lg font-black text-slate-800">
                      {new Date(p.date).getDate()}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {new Date(p.date).toLocaleDateString('es-ES', { month: 'short' })}
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <span className="truncate">{labelA}</span>
                      <span className="text-slate-300 shrink-0 text-xs font-black">VS</span>
                      <span className="truncate">{labelB}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.court && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin size={10} /> {p.court}
                        </span>
                      )}
                      {p.start_time && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10} /> {p.start_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score / Status */}
                  <div className="shrink-0 text-right">
                    {p.is_finished ? (
                      <div>
                        <div className="text-base font-black text-slate-800 tabular-nums">
                          {p.score_a} – {p.score_b}
                        </div>
                        {p.elo_processed && (
                          <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-0.5">
                            <Zap size={9} /> ELO ok
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="neutral">Pendiente</Badge>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3">
                    {/* Players */}
                    <div className="grid grid-cols-2 gap-3">
                      {(['A', 'B'] as const).map(side => {
                        const players = side === 'A'
                          ? [p.p1a, p.p2a].filter(Boolean)
                          : [p.p1b, p.p2b].filter(Boolean);
                        return (
                          <div key={side} className={`rounded-xl p-3 ${p.is_finished && (side === 'A' ? p.score_a > p.score_b : p.score_b > p.score_a) ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              Pareja {side}
                              {p.is_finished && (side === 'A' ? p.score_a > p.score_b : p.score_b > p.score_a) && (
                                <span className="ml-1 text-emerald-600">· Ganador</span>
                              )}
                            </div>
                            {players.map((pl: any) => (
                              <div key={pl.id} className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black"
                                  style={{ background: getAvatarColor(pl.name) }}>
                                  {pl.name[0]}
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate">{pl.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 ml-auto tabular-nums">
                                  {calculateDisplayRanking(pl as Player)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {p.notes && (
                      <p className="text-xs text-slate-400 italic">{p.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {!p.is_finished && (
                        <Button
                          variant="primary"
                          onClick={() => { setScorePartido(p); setExpandedId(null); }}
                        >
                          <CheckCircle2 size={14} /> Añadir resultado
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        onClick={() => setDeleteId(p.id)}
                      >
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

      {/* SQL Migration hint */}
      {!loading && (
        <div className="mt-8 bg-slate-900 rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 font-mono">Migración SQL requerida</div>
          <p className="text-xs text-slate-500 mb-3">Ejecuta esto en el SQL Editor de Supabase (producción y staging) si aún no lo has hecho:</p>
          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS partidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  court text,
  player1_a uuid REFERENCES players(id),
  player2_a uuid REFERENCES players(id),
  player1_b uuid REFERENCES players(id),
  player2_b uuid REFERENCES players(id),
  score_a integer DEFAULT 0,
  score_b integer DEFAULT 0,
  is_finished boolean DEFAULT false,
  elo_processed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_partidos" ON partidos
  FOR ALL USING (
    club_id = (SELECT id FROM clubs WHERE owner_id = auth.uid())
  );

CREATE POLICY "player_view_partidos" ON partidos
  FOR SELECT USING (
    club_id IN (
      SELECT user_id FROM players
      WHERE profile_user_id = auth.uid()
    )
  );`}
          </pre>
        </div>
      )}

      {/* CREATE MODAL */}
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
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pista</label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
              placeholder="Ej. Pista 2"
              value={form.court}
              onChange={e => setForm(f => ({ ...f, court: e.target.value }))}
            />
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
              <div className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1"><Zap size={12} /> ELO en juego</div>
              <div className="text-xs text-indigo-700">
                Si gana Pareja A: <strong>+{preview.deltaWin} / -{preview.deltaWin}</strong> pts
              </div>
              <div className="text-xs text-indigo-500">
                (ELO medio A: {preview.teamA} vs B: {preview.teamB})
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

      {/* SCORE MODAL */}
      <Modal
        isOpen={!!scorePartido}
        onClose={() => setScorePartido(null)}
        title="Resultado del partido"
        icon={<CheckCircle2 size={22} />}
        iconColor="success"
        actions={[
          { label: 'Cancelar', onClick: () => setScorePartido(null), variant: 'secondary' },
          { label: 'Guardar + procesar ELO', onClick: handleSaveScore, variant: 'primary', loading: savingScore },
        ]}
      >
        {scorePartido && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-center font-bold text-slate-700">
              {pairLabel(scorePartido.p1a, scorePartido.p2a)} <span className="text-slate-400 mx-2">VS</span> {pairLabel(scorePartido.p1b, scorePartido.p2b)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center">
                  {pairLabel(scorePartido.p1a, scorePartido.p2a)}
                </label>
                <input
                  type="number" min="0" max="9"
                  className="w-full px-3 py-4 border-2 border-slate-200 rounded-2xl text-3xl font-black text-center text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="0"
                  value={scoreA}
                  onChange={e => setScoreA(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center">
                  {pairLabel(scorePartido.p1b, scorePartido.p2b)}
                </label>
                <input
                  type="number" min="0" max="9"
                  className="w-full px-3 py-4 border-2 border-slate-200 rounded-2xl text-3xl font-black text-center text-slate-900 outline-none focus:border-indigo-400"
                  placeholder="0"
                  value={scoreB}
                  onChange={e => setScoreB(e.target.value)}
                />
              </div>
            </div>
            {scoreA && scoreB && scoreA !== scoreB && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                <Zap size={12} className="inline mr-1" />
                Al guardar se actualizará el ELO de los {[scorePartido.p1a, scorePartido.p2a, scorePartido.p1b, scorePartido.p2b].filter(Boolean).length} jugadores automáticamente.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* DELETE MODAL */}
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
        <p className="text-sm text-slate-600">Esta acción no se puede deshacer. Si el partido ya tenía ELO procesado, los puntos <strong>no se revertirán</strong>.</p>
      </Modal>
    </div>
  );
};

export default MatchManager;
