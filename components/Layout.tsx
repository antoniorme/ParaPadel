import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Users, ClipboardList, Activity, List, Menu, LogOut, UserCog, History, Settings, HelpCircle, X, Bell, Shield, LayoutGrid, Home } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';
import { useTournament } from '../store/TournamentContext';
import { useNotifications } from '../store/NotificationContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { clubData } = useHistory();
  const { state, closeTournament } = useTournament(); 
  const { unreadCount } = useNotifications();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isTournamentActive = !!state.id && state.status !== 'finished';

  // --- MENU 1: CLUB HUB (Outer) ---
  const clubNavItems = [
      { path: '/dashboard', label: 'Torneos', icon: LayoutGrid },
      { path: '/players', label: 'Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial', icon: History },
      { path: '/club', label: 'Club', icon: Settings },
  ];

  // --- MENU 2: TOURNAMENT (Inner) ---
  const tournamentNavItems = [
    { path: '/dashboard', label: 'Gestión', icon: Settings }, // Renamed from Inicio to Gestion to imply "Tournament Settings"
    { path: '/registration', label: 'Registro', icon: Users },
    { path: '/checkin', label: 'Control', icon: ClipboardList },
    { path: '/active', label: 'Directo', icon: Activity },
    { path: '/results', label: 'Clasi', icon: List },
  ];

  const currentNavItems = isTournamentActive ? tournamentNavItems : clubNavItems;

  const menuItems = [
      { path: '/players', label: 'Gestión Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial Minis', icon: History },
      { path: '/club', label: 'Datos del Club', icon: Settings },
      { path: '/help', label: 'Ayuda / FAQ', icon: HelpCircle },
  ];

  if (role === 'superadmin') {
      menuItems.unshift({ path: '/superadmin', label: 'Super Admin', icon: Shield });
  }

  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleBackToHub = () => {
      closeTournament();
      navigate('/dashboard');
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
                {/* LOGO OR BACK BUTTON */}
                {isTournamentActive ? (
                    <button onClick={handleBackToHub} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        <Home size={20} className="text-slate-600"/>
                    </button>
                ) : (
                    clubData.logoUrl && (
                        <img 
                        src={clubData.logoUrl} 
                        alt="Club Logo" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0" 
                        />
                    )
                )}
                
                {/* TITLE */}
                <div className="flex flex-col overflow-hidden">
                    <h1 className="text-lg font-black bg-gradient-to-r from-[#2B2DBF] to-[#575AF9] bg-clip-text text-transparent truncate leading-tight">
                        {isTournamentActive ? (state.title || 'Torneo') : (clubData.name || 'Minis de Padel')}
                    </h1>
                    {isTournamentActive && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Gestión de Torneo</span>}
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => navigate('/notifications')} 
                    className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <Bell size={24} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button onClick={() => setIsMenuOpen(true)} className="text-slate-700 hover:text-[#575AF9] p-2 rounded-full hover:bg-slate-100 transition-colors">
                  <Menu size={28} />
                </button>
            </div>
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
                      {isTournamentActive && (
                          <button 
                            onClick={() => { handleBackToHub(); setIsMenuOpen(false); }}
                            className="flex w-full items-center gap-3 p-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                              <Home size={20} /> Volver a Mis Torneos
                          </button>
                      )}
                      
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
              {currentNavItems.map((item) => {
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