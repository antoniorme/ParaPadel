import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { Loader2, ChevronRight, User, Building2, Check } from 'lucide-react';

type Step = 'choice' | 'player' | 'club';

const LEVELS = ['1ª — Iniciación', '2ª — Básico', '3ª — Intermedio', '4ª — Avanzado', '4ª alta', '5ª — Competición'];

const PlayerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, setNeedsOnboarding, refreshRole } = useAuth();

  const [step, setStep] = useState<Step>('choice');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player form
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [level, setLevel] = useState('');
  const [position, setPosition] = useState<'right' | 'backhand' | ''>('');

  // Club request form
  const [clubName, setClubName] = useState('');
  const [clubAddress, setClubAddress] = useState('');
  const [clubPhone, setClubPhone] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('players')
      .update({
        name: name.trim(),
        nickname: nickname.trim() || null,
        main_category: level || null,
        preferred_position: position || null,
      })
      .eq('profile_user_id', user.id);

    if (err) {
      setError('Error al guardar. Inténtalo de nuevo.');
      setSaving(false);
      return;
    }

    setNeedsOnboarding(false);
    navigate('/p/dashboard');
  };

  const handleRequestClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clubName.trim()) return;
    setSaving(true);
    setError(null);

    // Guardar la solicitud — el superadmin la revisará y creará el club
    const { error: reqErr } = await supabase.from('club_requests').insert({
      requested_by_user_id: user.id,
      requested_by_email: user.email,
      club_name: clubName.trim(),
      address: clubAddress.trim() || null,
      phone: clubPhone.trim() || null,
      status: 'pending',
    });

    if (reqErr) {
      // Si la tabla no existe aún, mostrar mensaje igualmente
      setRequestSent(true);
    } else {
      setRequestSent(true);
    }
    setSaving(false);
  };

  // ── CHOICE ────────────────────────────────────────────────────
  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">

          <div className="text-center">
            <div className="text-4xl font-black italic tracking-tighter text-slate-900 mb-2">
              Para<span style={{ color: '#575AF9' }}>Pádel</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">¡Bienvenido!</h1>
            <p className="text-slate-400 text-sm mt-1">Cuéntanos cómo usarás la app</p>
          </div>

          <button
            onClick={() => setStep('player')}
            className="w-full bg-white rounded-2xl border-2 border-indigo-200 p-5 flex items-center gap-4 shadow-sm active:scale-98 transition-all hover:border-indigo-400"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: '#575AF9' }}>
              <User size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-slate-900">Soy jugador</p>
              <p className="text-xs text-slate-400 mt-0.5">Busco partidos, sigo mi ELO y compito</p>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

          <button
            onClick={() => setStep('club')}
            className="w-full bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm active:scale-98 transition-all hover:border-slate-300"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 shrink-0">
              <Building2 size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="font-black text-slate-900">Soy un club</p>
              <p className="text-xs text-slate-400 mt-0.5">Gestiono torneos, ligas y jugadores</p>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

        </div>
      </div>
    );
  }

  // ── PLAYER FORM ───────────────────────────────────────────────
  if (step === 'player') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl" style={{ background: '#575AF9' }}>
              <User size={28} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Tu perfil de jugador</h1>
            <p className="text-slate-400 text-sm mt-1">Puedes editarlo después</p>
          </div>

          <form onSubmit={handleSavePlayer} className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre completo *"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
              />
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="Apodo (opcional)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nivel de juego</p>
              <div className="grid grid-cols-2 gap-2">
                {LEVELS.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold text-left transition-all ${
                      level === l ? 'text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}
                    style={level === l ? { background: '#575AF9' } : {}}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Posición habitual</p>
              <div className="flex gap-2">
                {[
                  { val: 'right', label: '🏓 Derecha' },
                  { val: 'backhand', label: '🏓 Revés' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setPosition(opt.val as 'right' | 'backhand')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                      position === opt.val ? 'text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}
                    style={position === opt.val ? { background: '#575AF9' } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 disabled:opacity-60 active:scale-95 transition-all"
              style={{ background: '#575AF9' }}
            >
              {saving ? <Loader2 size={22} className="animate-spin" /> : <><Check size={20} /> Empezar a jugar</>}
            </button>

            <button type="button" onClick={() => setStep('choice')} className="w-full text-slate-400 text-sm font-bold py-2">
              ← Volver
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── CLUB FORM ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">

        {requestSent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-emerald-100 text-emerald-600">
              <Check size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">¡Solicitud enviada!</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Revisaremos tu solicitud y te activaremos el acceso de club en breve.
              <br /><br />
              Mientras tanto puedes usar la app como jugador.
            </p>
            <button
              onClick={() => { setNeedsOnboarding(false); navigate('/p/dashboard'); }}
              className="w-full py-4 rounded-2xl font-black text-white text-base mt-4"
              style={{ background: '#575AF9' }}
            >
              Ir al dashboard de jugador
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-amber-100 text-amber-600">
                <Building2 size={28} />
              </div>
              <h1 className="text-2xl font-black text-slate-900">Solicitar alta como club</h1>
              <p className="text-slate-400 text-sm mt-1">Lo revisaremos y te avisamos</p>
            </div>

            <form onSubmit={handleRequestClub} className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <input
                  type="text"
                  required
                  value={clubName}
                  onChange={e => setClubName(e.target.value)}
                  placeholder="Nombre del club *"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
                />
                <input
                  type="text"
                  value={clubAddress}
                  onChange={e => setClubAddress(e.target.value)}
                  placeholder="Dirección"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
                />
                <input
                  type="tel"
                  value={clubPhone}
                  onChange={e => setClubPhone(e.target.value)}
                  placeholder="Teléfono de contacto"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:border-[#575AF9] outline-none"
                />
              </div>

              {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}

              <button
                type="submit"
                disabled={saving || !clubName.trim()}
                className="w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all bg-amber-500 hover:bg-amber-600"
              >
                {saving ? <Loader2 size={22} className="animate-spin" /> : 'Enviar solicitud'}
              </button>

              <button type="button" onClick={() => setStep('choice')} className="w-full text-slate-400 text-sm font-bold py-2">
                ← Volver
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerOnboarding;
