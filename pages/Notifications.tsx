
import React from 'react';
import { useNotifications } from '../store/NotificationContext';
import { THEME } from '../utils/theme';
import { Bell, Check, Trash2, Mail, Trophy, Activity, AlertTriangle, Info, ArrowLeft, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Notifications: React.FC = () => {
    const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const navigate = useNavigate();

    const getIcon = (type: string) => {
        switch (type) {
            case 'invite': return <Mail size={20} className="text-blue-500"/>;
            case 'match_start': return <Activity size={20} className="text-emerald-500"/>;
            case 'result': return <Trophy size={20} className="text-amber-500"/>;
            case 'alert': return <AlertTriangle size={20} className="text-rose-500"/>;
            default: return <Info size={20} className="text-slate-500"/>;
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        
        // Less than 24h
        if (diff < 86400000) {
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    const handleClick = (notif: any) => {
        markAsRead(notif.id);
        if (notif.link) {
            navigate(notif.link);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-24">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="bg-white p-6 pb-4 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 rounded-full hover:bg-slate-100">
                            <ArrowLeft size={24}/>
                        </button>
                        <h2 className="text-xl font-bold text-slate-900">Notificaciones</h2>
                        <button onClick={() => navigate('/notifications/settings')} className="p-2 -mr-2 text-slate-500 rounded-full hover:bg-slate-100">
                            <Settings size={24}/>
                        </button>
                    </div>
                    
                    {notifications.length > 0 && (
                        <div className="flex justify-end">
                            <button 
                                onClick={() => markAllAsRead()}
                                className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                            >
                                <Check size={14}/> Marcar todo como leído
                            </button>
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="p-4 space-y-3">
                    {notifications.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bell size={40} className="opacity-50"/>
                            </div>
                            <p className="font-medium">No tienes notificaciones.</p>
                            <p className="text-sm mt-1">Te avisaremos cuando haya actividad.</p>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => handleClick(n)}
                                className={`relative p-4 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer group flex gap-4 items-start ${n.read ? 'bg-white border-slate-100' : 'bg-blue-50/50 border-blue-100'}`}
                            >
                                <div className={`p-2.5 rounded-xl shrink-0 ${n.read ? 'bg-slate-100' : 'bg-white shadow-sm'}`}>
                                    {getIcon(n.type)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`text-sm font-bold truncate pr-2 ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</h4>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(n.createdAt)}</span>
                                    </div>
                                    <p className={`text-xs leading-relaxed line-clamp-2 ${n.read ? 'text-slate-500' : 'text-slate-600 font-medium'}`}>
                                        {n.message}
                                    </p>
                                </div>

                                {/* Swipe/Delete Action (Simple Button for now) */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                    className="absolute right-2 bottom-2 p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16}/>
                                </button>
                                
                                {!n.read && <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"></div>}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
