import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { PlayerSelector } from './PlayerSelector';
import { useToast } from './Toast';
import { useTournament } from '../store/TournamentContext';
import { useHistory } from '../store/HistoryContext';
import { supabase } from '../lib/supabase';
import { Player } from '../types';
import { MATCH_LEVELS } from '../utils/categories';
import { PP, THEME } from '../utils/theme';
import { generateClubMatchesText, openWhatsApp } from '../utils/whatsapp';
import { Swords, Search, Plus } from 'lucide-react';

// ── HELPERS ──────────────────────────────────────────────────────────────────

const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minsToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ── TIPOS ─────────────────────────────────────────────────────────────────────

export interface CreateMatchPrefill {
  date?: string;       // 'YYYY-MM-DD'
  time?: string;       // 'HH:MM'
  courtNumber?: number;
  courtName?: string;
  lockSlot?: boolean;  // oculta fecha/hora/pista como inputs — muestra chip informativo
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  prefill?: CreateMatchPrefill;
  shareWhatsApp?: boolean; // abre WhatsApp tras crear
}

// ── COMPONENTE ────────────────────────────────────────────────────────────────

export const CreateMatchModal: React.FC<Props> = ({
  isOpen, onClose, onCreated, prefill, shareWhatsApp = false,
}) => {
  const { state, formatPlayerName, addPlayerToDB } = useTournament();
  const { clubData } = useHistory();
  const { success, error: toastError } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const allPlayers: Player[] = state.players;
  const clubId = clubData?.id;

  const emptyForm = () => ({
    date: prefill?.date || today,
    time: prefill?.time || '',
    court: prefill?.courtName || '',
    courtNumber: prefill?.courtNumber || 0,
    level: '',
    slots: [
      { name: '', playerId: '' },
      { name: '', playerId: '' },
      { name: '', playerId: '' },
      { name: '', playerId: '' },
    ] as { name: string; playerId: string }[],
    notes: '',
  });

  const [form, setForm] = useState(emptyForm);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [slotTab, setSlotTab] = useState<'search' | 'new'>('search');
  const [availableCourts, setAvailableCourts] = useState<{ courtNumber: number; courtName: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Resetear al abrir
  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm());
    setOpenSlot(null);
    if (!prefill?.lockSlot) loadCourts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadCourts = async () => {
    if (!clubId) return;
    const todayDow = new Date().getDay();
    const { data } = await supabase
      .from('court_availability')
      .select('court_number, court_name, active_days')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('sort_order');
    if (data) {
      setAvailableCourts(
        (data as any[])
          .filter(c => c.active_days.includes(todayDow))
          .map(c => ({ courtNumber: c.court_number, courtName: c.court_name }))
      );
    }
  };

  const handleCreate = async () => {
    if (!form.date || !form.time) {
      toastError('La fecha y la hora son obligatorias');
      return;
    }
    setCreating(true);

    const startDate = new Date(`${form.date}T${form.time}:00`);
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);
    const scheduledAt = startDate.toISOString();
    const startAt = startDate.toISOString();
    const endAt = endDate.toISOString();

    // Anti-solapamiento
    if (form.courtNumber) {
      const { data: overlap } = await supabase
        .from('court_reservations').select('id')
        .eq('club_id', clubId).eq('court_number', form.courtNumber)
        .not('status', 'in', '("rejected","cancelled")')
        .lt('start_at', endAt).gt('end_at', startAt).limit(1);
      if (overlap && overlap.length > 0) {
        toastError('Esa pista ya está ocupada en ese horario');
        setCreating(false);
        return;
      }
    }

    // 1. Crear partido
    const { data: matchData, error: matchErr } = await supabase
      .from('free_matches').insert({
        club_id: clubId,
        scheduled_at: scheduledAt,
        court: form.court || null,
        level: form.level || null,
        notes: form.notes || null,
        max_players: 4,
        status: 'open',
      }).select('id, share_token').single();

    if (matchErr || !matchData) {
      toastError('Error al crear el partido');
      setCreating(false);
      return;
    }

    // 2. Participantes
    const participants = form.slots
      .map((s, i) => {
        if (!s.name.trim() && !s.playerId) return null;
        return s.playerId
          ? { match_id: matchData.id, player_id: s.playerId, slot_index: i + 1, team: i < 2 ? 'A' : 'B', participant_type: 'registered_player', joined_via: 'manual', attendance_status: 'joined' }
          : { match_id: matchData.id, guest_name: s.name.trim(), slot_index: i + 1, team: i < 2 ? 'A' : 'B', participant_type: 'claimable_guest', joined_via: 'manual', attendance_status: 'joined' };
      })
      .filter(Boolean);

    if (participants.length > 0) {
      await supabase.from('match_participants').insert(participants);
    }

    // 3. Bloquear pista (fuente única de verdad)
    if (form.courtNumber) {
      await supabase.from('court_reservations').insert({
        club_id: clubId,
        court_number: form.courtNumber,
        start_at: startAt,
        end_at: endAt,
        status: 'confirmed',
        source: 'admin',
        notes: `match:${matchData.id}`,
      });
    }

    success('Partido creado');
    setCreating(false);
    onClose();
    onCreated?.();

    // WhatsApp
    if (shareWhatsApp && clubData.name && clubId) {
      const { data: allOpen } = await supabase
        .from('free_matches')
        .select('id, scheduled_at, level, court, max_players, match_participants(id, attendance_status)')
        .eq('club_id', clubId).eq('status', 'open')
        .gte('scheduled_at', new Date().toISOString());
      if (allOpen && allOpen.length > 0) {
        const text = generateClubMatchesText(clubData.name, clubId, allOpen.map((m: any) => ({
          scheduled_at: m.scheduled_at, level: m.level, court: m.court,
          max_players: m.max_players || 4,
          spots_taken: (m.match_participants || []).filter((p: any) => ['joined', 'confirmed'].includes(p.attendance_status)).length,
        })));
        openWhatsApp(text);
      }
    }
  };

  const endTimeStr = form.time
    ? minsToTime(timeToMins(form.time) + 90)
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo partido"
      icon={<Swords size={22} />}
      iconColor="info"
      actions={[
        { label: 'Cancelar', onClick: onClose, variant: 'secondary' },
        {
          label: shareWhatsApp ? 'Crear y compartir' : 'Crear partido',
          onClick: handleCreate,
          variant: 'primary',
          loading: creating,
        },
      ]}
    >
      <div className="space-y-4">

        {/* Fecha / hora / pista */}
        {prefill?.lockSlot ? (
          // Slot fijo desde el calendario → chip informativo
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3">
            <Swords size={18} className="text-violet-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-violet-600 uppercase">
                {form.court} · 90 min
              </div>
              <div className="font-black text-slate-800 text-sm">
                {form.time}{endTimeStr ? ` — ${endTimeStr}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <>
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
                {availableCourts.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 bg-white"
                    value={form.courtNumber || ''}
                    onChange={e => {
                      const cn = parseInt(e.target.value);
                      const c = availableCourts.find(x => x.courtNumber === cn);
                      setForm(f => ({ ...f, courtNumber: cn || 0, court: c?.courtName || '' }));
                    }}
                  >
                    <option value="">— Sin pista —</option>
                    {availableCourts.map(c => (
                      <option key={c.courtNumber} value={c.courtNumber}>{c.courtName}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400"
                    placeholder="Ej. Pista 2"
                    value={form.court}
                    onChange={e => setForm(f => ({ ...f, court: e.target.value, courtNumber: 0 }))}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nivel</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 bg-white"
                  value={form.level}
                  onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                >
                  <option value="">Abierto (cualquier nivel)</option>
                  {MATCH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* Nivel cuando el slot está bloqueado */}
        {prefill?.lockSlot && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nivel</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 bg-white"
              value={form.level}
              onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
            >
              <option value="">Abierto (cualquier nivel)</option>
              {MATCH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        {/* Jugadores 1–4 */}
        <div style={{ borderTop: `1px solid ${PP.hair}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: PP.mute, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Jugadores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.slots.map((slot, i) => {
              const linked = slot.playerId ? allPlayers.find(p => p.id === slot.playerId) : null;
              const isOpen = openSlot === i;
              return (
                <div key={i} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: PP.muteSoft, minWidth: 14, textAlign: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <input
                      style={{
                        flex: 1, padding: '8px 11px', borderRadius: 10,
                        border: `1.5px solid ${slot.name || slot.playerId ? PP.primary : PP.hair}`,
                        background: linked ? PP.primaryTint : PP.bg,
                        fontFamily: PP.font, fontSize: 13, fontWeight: 600,
                        color: PP.ink, outline: 'none', minWidth: 0,
                      }}
                      placeholder="Nombre del jugador"
                      value={slot.name}
                      onChange={e => setForm(f => ({
                        ...f,
                        slots: f.slots.map((s, j) => j === i ? { name: e.target.value, playerId: '' } : s),
                      }))}
                    />
                    <button
                      type="button"
                      onClick={() => { setSlotTab('search'); setOpenSlot(isOpen && slotTab === 'search' ? null : i); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '7px 9px', borderRadius: 8, border: `1px solid ${PP.hair}`, background: PP.card, fontSize: 11, fontWeight: 700, color: PP.ink2, cursor: 'pointer', flexShrink: 0, fontFamily: PP.font }}
                    >
                      <Search size={11} /> Buscar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSlotTab('new'); setOpenSlot(isOpen && slotTab === 'new' ? null : i); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '7px 9px', borderRadius: 8, border: 0, background: PP.primary, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0, fontFamily: PP.font }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 22, right: 0, zIndex: 500, background: PP.card, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: `1px solid ${PP.hair}`, overflow: 'hidden' }}>
                      <PlayerSelector
                        label=""
                        selectedId={slot.playerId}
                        onSelect={id => {
                          const p = allPlayers.find(x => x.id === id);
                          setForm(f => ({
                            ...f,
                            slots: f.slots.map((s, j) => j === i ? { name: p ? formatPlayerName(p) : '', playerId: id } : s),
                          }));
                          setOpenSlot(null);
                        }}
                        otherSelectedId=""
                        players={allPlayers.filter(p => !form.slots.some((s, j) => j !== i && s.playerId === p.id))}
                        onAddPlayer={async playerData => {
                          const id = await addPlayerToDB(playerData);
                          if (id) {
                            setForm(f => ({
                              ...f,
                              slots: f.slots.map((s, j) => j === i ? { name: playerData.name || '', playerId: id } : s),
                            }));
                            setOpenSlot(null);
                          }
                          return id;
                        }}
                        formatName={formatPlayerName}
                        initialTab={slotTab}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notas */}
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

        {shareWhatsApp && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700 font-medium">
            Al crear, se abrirá WhatsApp con todos los partidos abiertos del club para compartirlos.
          </div>
        )}
      </div>
    </Modal>
  );
};
