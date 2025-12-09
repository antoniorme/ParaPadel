
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Users, ClipboardList, Activity, List, Menu, LogOut, UserCog, History, Settings, HelpCircle, X, Clock, Play, Square, Shield } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';
import { useTimer } from '../store/TimerContext'; 
import { useTournament } from '../store/TournamentContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { clubData } = useHistory();
  const { state } = useTournament(); 
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Inicio', icon: Trophy },
    { path: '/registration', label: 'Registro', icon: Users },
    { path: '/checkin', label: 'Control', icon: ClipboardList },
    { path: '/active', label: 'Directo', icon: Activity },
    { path: '/results', label: 'Clasi', icon: List },
  ];

  const menuItems = [
      { path: '/players', label: 'Gestión Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial Minis', icon: History },
      { path: '/club', label: 'Datos del Club', icon: Settings },
      { path: '/help', label: 'Ayuda / FAQ', icon: HelpCircle },
  ];

  // Add SuperAdmin Item if applicable
  if (role === 'superadmin') {
      menuItems.unshift({ path: '/superadmin', label: 'Super Admin', icon: Shield });
  }

  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
      
      {/* Main Header (Boxed) - Sticky */}
      <div className="bg-slate-50 pt-2 px-2 md:pt-4 sticky top-0 z-40">
          <header className="max-w-3xl mx-auto bg-white px-4 py-3 flex justify-between items-center border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center gap-4 overflow-hidden">
                {clubData.logoUrl && (
                    <img 
                      src={clubData.logoUrl} 
                      alt="Club Logo" 
                      className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0" 
                    />
                )}
                <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-[#2B2DBF] to-[#575AF9] bg-clip-text text-transparent truncate leading-tight">
                    {clubData.name || 'Minis de Padel'}
                </h1>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="text-slate-700 hover:text-[#575AF9] p-2 rounded-full hover:bg-slate-100 transition-colors">
              <Menu size={28} />
            </button>
          </header>
      </div>

      {/* Hamburger Menu Drawer */}
      {isMenuOpen && (
          <div className="fixed inset-0 z-[100]">
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl p-6 animate-slide-left flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                      <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Menú Principal</span>
                      <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200"><X size={20}/></button>
                  </div>

                  <div className="space-y-4 flex-1">
                      {menuItems.map(item => (
                          <Link 
                            key={item.path} 
                            to={item.path} 
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${item.path === '/superadmin' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-700 hover:bg-[#EEFF00]/20 hover:text-[#2B2DBF]'}`}
                          >
                              <item.icon size={20} />
                              {item.label}
                          </Link>
                      ))}
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                      <button onClick={handleLogout} className="flex w-full items-center gap-3 p-3 rounded-xl text-rose-600 hover:bg-rose-50 font-bold transition-colors">
                          <LogOut size={20} />
                          Cerrar Sesión
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 pb-32 md:p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation (Boxed) */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-2 pointer-events-none">
            <nav className="max-w-3xl mx-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex justify-around items-center px-2 py-1 pointer-events-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center justify-center py-3 px-2 w-full transition-colors rounded-xl ${
                      isActive
                        ? 'text-[#575AF9]'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div className={`p-1 rounded-xl mb-0.5 transition-all ${isActive ? 'bg-[#575AF9]/10 scale-110' : 'bg-transparent'}`}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? 'text-[#2B2DBF]' : 'text-slate-400'}`}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
        </div>
      )}
    </div>
  );
};
