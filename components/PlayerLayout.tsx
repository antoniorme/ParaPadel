
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, User, Compass, Dribbble, Bell } from 'lucide-react';
import { THEME } from '../utils/theme';
import { useNotifications } from '../store/NotificationContext';

export const PlayerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  const navItems = [
    { path: '/p/dashboard', label: 'Inicio', icon: Home },
    { path: '/p/explore', label: 'Explorar', icon: Compass },
    { path: '/p/tournaments', label: 'Mis Partidos', icon: Dribbble },
    { path: '/p/profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Player App Header (Dynamic based on route, simple back button logic could be added) */}
      <div className="px-6 py-4 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm sm:hidden">
          <div className="font-black text-xl italic tracking-tighter text-slate-900">
              Padel<span style={{color: THEME.cta}}>Pro</span>
          </div>
          <button 
            onClick={() => navigate('/notifications')} 
            className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
          >
              <Bell size={24} />
              {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                      {unreadCount}
                  </span>
              )}
          </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 overflow-y-auto">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl sm:my-4 sm:rounded-3xl sm:overflow-hidden relative">
            {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-4 pointer-events-none">
        <nav className="max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex justify-around items-center px-2 py-1 pointer-events-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center py-3 px-2 w-full transition-colors rounded-xl group"
              >
                <div 
                    className={`p-1.5 rounded-xl mb-1 transition-all duration-300 ${isActive ? 'scale-110 shadow-sm' : 'bg-transparent group-hover:bg-slate-50'}`}
                    style={{ backgroundColor: isActive ? `${THEME.cta}15` : undefined }}
                >
                  <Icon 
                    size={24} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    style={{ color: isActive ? THEME.cta : '#94a3b8' }}
                  />
                </div>
                <span 
                    className={`text-[10px] font-bold transition-colors ${isActive ? '' : 'text-slate-400'}`}
                    style={{ color: isActive ? THEME.cta : undefined }}
                >
                    {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
