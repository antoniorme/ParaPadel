import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { calculateDisplayRanking } from '../../utils/Elo';
import { Share2, ArrowLeft, UserPlus, UserCheck, Shield, Loader2 } from 'lucide-react';
import { Player } from '../../types';
import { useAuth } from '../../store/AuthContext';

const getAvatarColor = (name: string): string => {
  const colors = ['#4F46E5', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626', '#0284C7', '#0F766E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getFiabilidadLabel = (matches: number): { score: number; label: string; color: string } => {
  const score = Math.min(100, Math.round((matches / 20) * 100));
  if (score >= 80) return { score, label: 'Alta', color: '#10b981' };
  if (score >= 50) return { score, label: 'Media', color: '#575AF9' };
  if (score >= 20) return { score, label: 'Baja', color: '#f59e0b' };
  return { score, label: 'Nueva', color: '#94a3b8' };
};

const PlayerPublicProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [player, setPlayer] = useState<Player | null>(null);
  const [clubName, setClubName] = useState<string>('');
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // Follow state
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Load profile
  useEffect(() => {
    if (!playerId) { setNotFound(true); setLoading(false); return; }
    supabase
      .from('players')
      .select('*, clubs:user_id (name)')
      .eq('id', playerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else {
          setPlayer(data as Player);
          setClubName((data as any).clubs?.name || '');
        }
        setLoading(false);
      });

    // Follower count
    supabase.from('player_follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', playerId)
      .then(({ count }) => setFollowerCount(count || 0))
      .catch(() => {});
  }, [playerId]);

  // Find my player ID from auth
  useEffect(() => {
    if (!user) return;
    supabase.from('players').select('id').eq('profile_user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyPlayerId(data.id); })
      .catch(() => {});
  }, [user]);

  // Check if I'm following
  useEffect(() => {
    if (!myPlayerId || !playerId || myPlayerId === playerId) return;
    supabase.from('player_follows').select('id')
      .eq('follower_id', myPlayerId).eq('following_id', playerId)
      .maybeSingle()
      .then(({ data }) => setIsFollowing(!!data))
      .catch(() => {});
  }, [myPlayerId, playerId]);

  const handleFollow = async () => {
    if (!myPlayerId || !playerId) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('player_follows').delete()
          .eq('follower_id', myPlayerId).eq('following_id', playerId);
        setIsFollowing(false);
        setFollowerCount(c => Math.max(0, c - 1));
      } else {
        await supabase.from('player_follows').insert({ follower_id: myPlayerId, following_id: playerId });
        setIsFollowing(true);
        setFollowerCount(c => c + 1);
      }
    } catch (_) {} finally { setFollowLoading(false); }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `Perfil de ${player?.name}`, url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 font-bold animate-pulse">Cargando perfil...</div>
      </div>
    );
  }

  if (notFound || !player) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🎾</div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Jugador no encontrado</h1>
        <p className="text-slate-400 text-sm mb-6">Este perfil no existe o ha sido eliminado.</p>
        <button onClick={() => navigate('/')} className="text-sm font-bold text-indigo-600">Volver al inicio</button>
      </div>
    );
  }

  const elo = calculateDisplayRanking(player);
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = getAvatarColor(player.name);
  const rangeFloor = Math.floor(elo / 1000) * 1000;
  const progressPct = Math.max(0, Math.min(100, ((elo - rangeFloor) / 1000) * 100));
  const categoryLabel = player.categories?.[0] || player.main_category || 'Avanzado';
  const fiabilidad = getFiabilidadLabel(player.matches_played || 0);
  const isOwnProfile = myPlayerId === playerId;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-sm">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-500 text-sm font-bold hover:text-slate-800">
            <ArrowLeft size={16} /> Volver
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
          >
            <Share2 size={14} />
            {copied ? '¡Copiado!' : 'Compartir'}
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-4">
          {/* Color band */}
          <div className="h-20" style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }} />

          <div className="flex flex-col items-center -mt-10 px-6 pb-6">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg border-4 border-white mb-3"
              style={{ background: color }}
            >
              {initials}
            </div>

            <h1 className="text-xl font-black text-slate-900 text-center">{player.name}</h1>
            {player.nickname && (
              <p className="text-slate-400 text-sm font-medium mt-0.5">"{player.nickname}"</p>
            )}
            {clubName && (
              <p className="text-xs font-bold text-slate-400 mt-1">{clubName}</p>
            )}

            {/* Follow button */}
            {user && !isOwnProfile && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`mt-4 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all ${
                  isFollowing
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'text-white shadow-md hover:opacity-90'
                }`}
                style={!isFollowing ? { background: '#575AF9' } : {}}
              >
                {followLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : isFollowing
                  ? <><UserCheck size={15} /> Siguiendo</>
                  : <><UserPlus size={15} /> Seguir</>
                }
              </button>
            )}
            {isOwnProfile && (
              <span className="mt-4 px-4 py-1.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-full">
                Este eres tú
              </span>
            )}

            {/* ELO block */}
            <div className="mt-5 w-full bg-slate-50 rounded-2xl p-4">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">ELO Actual</div>
                  <div className="text-4xl font-black" style={{ color: '#575AF9' }}>{elo}</div>
                </div>
                <div className="text-right pb-1 space-y-1">
                  <div className="text-sm font-black text-slate-700">{categoryLabel}</div>
                  {/* Fiabilidad chip */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: `${fiabilidad.color}15`, color: fiabilidad.color }}
                  >
                    <Shield size={9} /> {fiabilidad.label}
                  </span>
                </div>
              </div>
              {/* Progress */}
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #575AF9, #818CF8)' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                <span>{rangeFloor}</span>
                <span>{rangeFloor + 1000}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 w-full mt-3">
              {[
                { label: 'Seguidores', value: followerCount },
                { label: 'Categoría',  value: player.main_category || (player.categories || [])[0] || '—' },
                {
                  label: 'Posición',
                  value: player.preferred_position === 'right' ? 'Derecha'
                    : player.preferred_position === 'backhand' ? 'Revés' : '—',
                },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-base font-black text-slate-900">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="text-center">
          <div className="text-xs text-slate-400 font-medium mb-1">Perfil generado con</div>
          <div className="text-base font-black text-slate-700">
            Para<span style={{ color: '#575AF9' }}>Pádel</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPublicProfile;
