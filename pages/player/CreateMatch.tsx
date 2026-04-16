import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../components/Toast';
import { ArrowLeft, Calendar, Clock, MapPin, Users, FileText, BarChart2, Loader2 } from 'lucide-react';

const LEVELS = [
  '1ª — Iniciación',
  '2ª — Básico',
  '3ª — Intermedio',
  '4ª — Avanzado',
  '4ª alta',
  '5ª — Competición',
];

const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8];

const CreateMatch: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState({
    date: today,
    time: nowTime,
    level: '',
    max_players: 4,
    court: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      // Buscar el player_id del creador
      const { data: playerRec } = await supabase
        .from('players')
        .select('id')
        .eq('profile_user_id', user.id)
        .maybeSingle();

      const scheduled_at = `${form.date}T${form.time}:00`;

      // Crear el partido
      const { data: match, error: matchErr } = await supabase
        .from('free_matches')
        .insert({
          created_by_user_id: user.id,
          host_user_id: user.id,
          scheduled_at,
          level: form.level || null,
          max_players: form.max_players,
          court: form.court || null,
          notes: form.notes || null,
          status: 'open',
          visibility: 'link_only',
        })
        .select('id, share_token')
        .single();

      if (matchErr || !match) throw matchErr || new Error('No se pudo crear el partido');

      // Añadir al creador como primer participante
      if (playerRec?.id) {
        await supabase.from('match_participants').insert({
          match_id: match.id,
          participant_type: 'registered_player',
          user_id: user.id,
          player_id: playerRec.id,
          slot_index: 1,
          joined_via: 'manual',
          attendance_status: 'joined',
        });
      }

      success('¡Partido creado!');
      navigate(`/m/${match.share_token}`);
    } catch (err: any) {
      toastError(err.message || 'Error al crear el partido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Nuevo Partido</h1>
          <p className="text-slate-400 text-sm">Crea y comparte por WhatsApp</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fecha y hora */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuándo</p>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Calendar size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="date"
                required
                value={form.date}
                min={today}
                onChange={(e) => set('date', e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
              />
            </div>
            <div className="w-32 relative">
              <Clock size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Jugadores */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nº Jugadores</p>
          <div className="flex gap-2">
            {MAX_PLAYERS_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set('max_players', n)}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                  form.max_players === n
                    ? 'text-white shadow-md'
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}
                style={form.max_players === n ? { background: '#575AF9' } : {}}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Nivel */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nivel</p>
          <div className="relative">
            <BarChart2 size={16} className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={form.level}
              onChange={(e) => set('level', e.target.value)}
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none appearance-none bg-white"
            >
              <option value="">Sin especificar</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pista */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pista</p>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              value={form.court}
              onChange={(e) => set('court', e.target.value)}
              placeholder="Ej: Pista 3, Club Los Pinos…"
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notas</p>
          <div className="relative">
            <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Info extra, cómo llegar…"
              rows={3}
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none placeholder:text-slate-300 resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95"
          style={{ background: '#575AF9' }}
        >
          {saving ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <>Crear Partido →</>
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateMatch;
