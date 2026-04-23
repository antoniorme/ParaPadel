import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../store/NotificationContext';
import { PP } from '../../utils/theme';
import {
  Bell, Check, Trash2, Mail, Trophy, Activity,
  AlertTriangle, Info, ArrowLeft, Settings
} from 'lucide-react';

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const getIcon = (type: string) => {
  switch (type) {
    case 'invite':      return <Mail size={18} style={{ color: '#3B82F6' }}/>;
    case 'match_start': return <Activity size={18} style={{ color: PP.ok }}/>;
    case 'result':      return <Trophy size={18} style={{ color: PP.warn }}/>;
    case 'alert':       return <AlertTriangle size={18} style={{ color: PP.error }}/>;
    default:            return <Info size={18} style={{ color: PP.mute }}/>;
  }
};

const PlayerNotifications: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const handleClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const unread = notifications.filter((n: any) => !n.read).length;

  return (
    <div style={{ fontFamily: PP.font, minHeight: '100%', background: PP.bg }}>

      {/* Header */}
      <div style={{
        background: PP.card, borderBottom: `1px solid ${PP.hair}`,
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${PP.hair}`, background: PP.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PP.ink2, cursor: 'pointer' }}
        >
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: PP.ink, letterSpacing: -0.4 }}>Notificaciones</div>
          {unread > 0 && <div style={{ fontSize: 12, color: PP.mute, fontWeight: 500 }}>{unread} sin leer</div>}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={() => markAllAsRead()}
            style={{ fontSize: 12, fontWeight: 700, color: PP.primary, background: 'none', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Check size={14}/> Leer todas
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div style={{ padding: '60px 32px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: PP.primaryTint,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Bell size={28} style={{ color: PP.primary }}/>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: PP.ink, letterSpacing: -0.3 }}>Sin notificaciones</div>
          <div style={{ fontSize: 13, color: PP.mute, fontWeight: 500, marginTop: 6 }}>Cuando haya novedades aparecerán aquí</div>
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {notifications.map((notif: any) => (
            <div
              key={notif.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 20px',
                background: notif.read ? PP.card : PP.primaryTint,
                borderBottom: `1px solid ${PP.hair}`,
                cursor: 'pointer',
              }}
              onClick={() => handleClick(notif)}
            >
              {/* Icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: PP.card,
                border: `1px solid ${PP.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getIcon(notif.type)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: notif.read ? 500 : 700, color: PP.ink, lineHeight: 1.4 }}>
                  {notif.title || notif.message}
                </div>
                {notif.body && (
                  <div style={{ fontSize: 12, color: PP.mute, fontWeight: 500, marginTop: 3, lineHeight: 1.4 }}>
                    {notif.body}
                  </div>
                )}
                <div style={{ fontSize: 11, color: PP.muteSoft, fontWeight: 600, marginTop: 4 }}>
                  {formatDate(notif.created_at || notif.timestamp || new Date().toISOString())}
                </div>
              </div>

              {/* Unread dot + delete */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                {!notif.read && (
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: PP.primary }}/>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deleteNotification(notif.id); }}
                  style={{ background: 'none', border: 0, color: PP.muteSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerNotifications;
