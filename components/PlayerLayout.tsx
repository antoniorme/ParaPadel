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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans sm:py-6">
      
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-slate-50 h-screen sm:h-[85vh] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative sm:border-[8px] sm:border-slate-800">
          
          {/* Top Bar - Always Visible */}
          <div className="px-6 py-4 flex justify-between items-center bg-white sticky top-0 z-30 border-b border-slate-100">
              <div className="font-black text-xl italic tracking-tighter text-slate-900">
                  Padel<span style={{color: THEME.cta}}>Pro</span>
              </div>
              <button 
                onClick={() => navigate('/notifications')} 
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              >
                  <Bell size={24} />
                  {unreadCount > 0 && (
                      <span className="absolute top-1 right-1.5 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm px-0.5">
                          {unreadCount}
                      </span>
                  )}
              </button>
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto pb-24 scrollbar-hide bg-slate-50">
            {children}
          </main>

          {/* Bottom Navigation */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-4 py-2 z-30 sm:rounded-b-[2rem]">
            <nav className="flex justify-around items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex flex-col items-center justify-center py-2 px-2 w-full transition-colors rounded-xl group"
                  >
                    <div 
                        className={`p-1.5 rounded-xl mb-1 transition-all duration-300 ${isActive ? 'translate-y-[-2px]' : 'group-hover:bg-slate-50'}`}
                    >
                      <Icon 
                        size={24} 
                        strokeWidth={isActive ? 2.5 : 2} 
                        fill={isActive ? `${THEME.cta}20` : 'none'}
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
    </div>
  );
};
