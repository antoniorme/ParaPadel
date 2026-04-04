
import React from 'react';
import { useNotifications } from '../store/NotificationContext';
import { THEME } from '../utils/theme';
import { ArrowLeft, Bell, Mail, Trophy, Activity, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotificationSettings: React.FC = () => {
    const { settings, updateSettings } = useNotifications();
    const navigate = useNavigate();

    const Toggle = ({ label, desc, checked, onChange, icon: Icon }: any) => (
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${checked ? 'bg-indigo-50 text-[#575AF9]' : 'bg-slate-50 text-slate-400'}`}>
                    <Icon size={24} />
                </div>
                <div>
                    <div className="font-bold text-slate-800">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#575AF9]"></div>
            </label>
        </div>
    );

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white p-6 pb-4 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 rounded-full hover:bg-slate-100">
                            <ArrowLeft size={24}/>
                        </button>
                        <h2 className="text-xl font-bold text-slate-900">Configuración Avisos</h2>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pl-2">Tipos de Notificación</h3>
                        <div className="space-y-3">
                            <Toggle 
                                label="Invitaciones" 
                                desc="Cuando alguien quiere jugar contigo"
                                icon={Mail}
                                checked={settings.invites} 
                                onChange={(v: boolean) => updateSettings({ invites: v })} 
                            />
                            <Toggle 
                                label="Inicio de Partido" 
                                desc="Cuando se asigna pista y rivales"
                                icon={Activity}
                                checked={settings.matchStart} 
                                onChange={(v: boolean) => updateSettings({ matchStart: v })} 
                            />
                            <Toggle 
                                label="Resultados y ELO" 
                                desc="Confirmación de marcador y ranking"
                                icon={Trophy}
                                checked={settings.results} 
                                onChange={(v: boolean) => updateSettings({ results: v })} 
                            />
                            <Toggle 
                                label="Sistema" 
                                desc="Avisos importantes de la app"
                                icon={Info}
                                checked={settings.system} 
                                onChange={(v: boolean) => updateSettings({ system: v })} 
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm text-blue-800">
                        <Bell size={20} className="shrink-0 mt-0.5"/>
                        <p>
                            Estas preferencias solo afectan a las notificaciones dentro de la aplicación. Para emails o notificaciones push, consulta la configuración de tu dispositivo.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationSettings;
