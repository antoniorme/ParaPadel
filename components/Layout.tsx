
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
    Trophy, Users, ClipboardList, Activity, List, Menu, LogOut, 
    UserCog, History, Settings, HelpCircle, X, Bell, Shield, 
    LayoutGrid, Home, CalendarRange, GitMerge, ArrowLeft, 
    ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';
import { useTournament } from '../store/TournamentContext';
import { useNotifications } from '../store/NotificationContext';
import { THEME } from '../utils/theme';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { clubData } = useHistory();
  const { state, closeTournament } = useTournament(); 
  const { unreadCount } = useNotifications();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // CONTEXT DETECTION
  const isTournamentActive = !!state.id && state.status !== 'finished';
  const isLeagueActiveView = location.pathname.includes('/league/active');
  const isLeaguePath = location.pathname.startsWith('/league');
  
  const isDarkMode = !isTournamentActive && !isLeaguePath; 

  // 1. GLOBAL NAVIGATION (SIDEBAR)
  const menuItems = [
      { path: '/dashboard', label: 'Mis Torneos', icon: LayoutGrid },
      { path: '/league', label: 'Ligas', icon: CalendarRange },
      { path: '/players', label: 'Jugadores', icon: UserCog },
      { path: '/history', label: 'Historial', icon: History },
      { path: '/club', label: 'Mi Club', icon: Settings },
      { path: '/help', label: 'Ayuda', icon: HelpCircle },
  ];

  if (role === 'superadmin') {
      menuItems.unshift({ path: '/superadmin', label: 'Super Admin', icon: Shield });
  }

  // 2. CONTEXT NAVIGATION (BOTTOM DOCK)
  // Only for Active Tournament or Active League
  const tournamentNavItems = [
    { path: '/dashboard', label: 'Gestión', icon: Settings },
    { path: '/registration', label: 'Registro', icon: Users },
    { path: '/checkin', label: 'Control', icon: ClipboardList },
    { path: '/active', label: 'Directo', icon: Activity },
    { path: '/results', label: 'Clasi', icon: List },
  ];

  const leagueNavItems = [
    { path: '/league/active?tab=management', label: 'Gestión', icon: Settings },
    { path: '/league/active?tab=registration', label: 'Registro', icon: Users },
    { path: '/league/active?tab=standings', label: 'Clasi', icon: Trophy },
    { path: '/league/active?tab=calendar', label: 'Jornadas', icon: CalendarRange },
    { path: '/league/active?tab=playoffs', label: 'Playoff', icon: GitMerge },
  ];

  let contextNavItems = null;
  if (isTournamentActive) contextNavItems = tournamentNavItems;
  else if (isLeagueActiveView) contextNavItems = leagueNavItems;

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

  const getBodyBackground = () => {
      if (isLeaguePath) return 'bg-indigo-400';
      if (isDarkMode) return 'bg-slate-950';
      return 'bg-slate-50';
  };

  const showDefaultBranding = clubData.name === 'Mi Club de Padel' || clubData.name === 'ParaPadel';

  return (
    <div className={`min-h-screen transition-colors duration-500 flex flex-col md:flex-row ${getBodyBackground()} ${isDarkMode || isLeaguePath ? 'text-slate-50' : 'text-slate-900'}`}>
      
      {/* --- DESKTOP SIDEBAR (GLOBAL NAV) --- */}
      <aside 
        className={`hidden md:flex flex-col fixed inset-y-0 z-50 border-r transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} ${isDarkMode || isLeaguePath ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
      >
          {/* Logo Area */}
          <div className={`p-6 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} h-20 shrink-0`}>
              <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 border-2 ${isLeaguePath ? 'border-indigo-200 bg-indigo-600' : isDarkMode ? 'border-slate-800 bg-slate-800' : 'border-slate-100 bg-slate-50'} flex items-center justify-center`}>
                    {clubData.logoUrl ? (
                        <img src={clubData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <Trophy size={16} className={isDarkMode || isLeaguePath ? 'text-indigo-200' : 'text-slate-300'} />
                    )}
              </div>
              {!isSidebarCollapsed && (
                  <h1 className={`text-sm font-black leading-tight truncate ${isDarkMode || isLeaguePath ? 'text-white' : 'text-slate-900'}`}>
                      {showDefaultBranding ? 'ParaPádel' : clubData.name}
                  </h1>
              )}
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto px-3 space-y-2 mt-4 custom-scrollbar">
              {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  
                  return (
                      <Link 
                        key={item.path} 
                        to={item.path}
                        className={`group relative flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-xl font-bold transition-all ${isActive ? 'bg-[#575AF9] text-white shadow-md' : (isDarkMode || isLeaguePath ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}`}
                      >
                          <Icon size={20} strokeWidth={2.5} /> 
                          {!isSidebarCollapsed && <span className="text-sm">{item.label}</span>}
                          
                          {/* Tooltip on Hover when Collapsed */}
                          {isSidebarCollapsed && (
                              <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60] pointer-events-none shadow-xl border border-slate-700">
                                  {item.label}
                              </div>
                          )}
                      </Link>
                  )
              })}
          </div>

          {/* Footer Actions (Collapse & Logout) */}
          <div className="p-3 border-t border-white/5 space-y-2 mt-auto bg-inherit z-10 relative">
              
              {/* Collapse Button (Moved Bottom) */}
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`flex w-full items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-xl transition-colors ${isDarkMode || isLeaguePath ? 'text-slate-500 hover:bg-white/5 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                title={isSidebarCollapsed ? "Expandir Menú" : "Contraer Menú"}
              >
                  {isSidebarCollapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}
                  {!isSidebarCollapsed && <span className="text-xs font-bold uppercase">Contraer</span>}
              </button>

              <button 
                onClick={handleLogout} 
                className={`flex w-full items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold transition-colors group relative`}
              >
                  <LogOut size={20} /> 
                  {!isSidebarCollapsed && "Salir"}
                  {isSidebarCollapsed && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-rose-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60] pointer-events-none shadow-xl">
                          Cerrar Sesión
                      </div>
                  )}
              </button>
          </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className={`flex-1 flex flex-col ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'} min-h-screen transition-all duration-300`}>
          
          {/* MOBILE HEADER (Visible only on mobile) */}
          <div className="md:hidden pt-2 px-2 pb-2 sticky top-0 z-40 transition-colors duration-500">
              <header className={`px-4 py-3 flex justify-between items-center border rounded-2xl shadow-sm transition-all duration-500 ${isLeaguePath ? 'bg-indigo-500 border-indigo-300 shadow-indigo-500/20' : isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    {isTournamentActive && (
                        <button onClick={handleBackToHub} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors shrink-0" title="Volver a Mis Torneos">
                            <Home size={18} className="text-slate-600"/>
                        </button>
                    )}
                    {!isTournamentActive && isLeagueActiveView && (
                        <button onClick={() => navigate('/league')} className="p-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shrink-0 border border-indigo-400" title="Salir de la Liga">
                            <ArrowLeft size={18} className="text-white"/>
                        </button>
                    )}

                    <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 border-2 ${isLeaguePath ? 'border-indigo-200 bg-indigo-600' : isDarkMode ? 'border-slate-800 bg-slate-800' : 'border-slate-100 bg-slate-50'} flex items-center justify-center`}>
                        {clubData.logoUrl ? (
                            <img src={clubData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <Trophy size={16} className={isDarkMode || isLeaguePath ? 'text-indigo-200' : 'text-slate-300'} />
                        )}
                    </div>
                    
                    <div className="flex flex-col overflow-hidden">
                        <h1 className={`text-sm font-black truncate leading-tight ${isDarkMode || isLeaguePath ? 'text-white' : 'text-slate-900'}`}>
                            {clubData.name}
                        </h1>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/notifications')} className={`relative p-2 rounded-full transition-colors ${isDarkMode || isLeaguePath ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                        <Bell size={20} />
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 rounded-full border border-white"></span>}
                    </button>
                    <button onClick={() => setIsMenuOpen(true)} className={`p-2 rounded-full transition-colors ${isDarkMode || isLeaguePath ? 'text-slate-200' : 'text-slate-700'}`}>
                      <Menu size={24} />
                    </button>
                </div>
              </header>
          </div>

          {/* DESKTOP TOP BAR */}
          <div className="hidden md:flex justify-end items-center p-6 pb-2">
               <div className="flex items-center gap-4">
                   <button onClick={() => navigate('/notifications')} className={`relative p-2 rounded-full hover:bg-white/10 transition-colors ${isDarkMode || isLeaguePath ? 'text-white' : 'text-slate-600'}`}>
                       <Bell size={24}/>
                       {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white"></span>}
                   </button>
                   <div className={`h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold border-2 ${isDarkMode || isLeaguePath ? 'border-slate-700' : 'border-white'}`}>
                       {clubData.name.charAt(0)}
                   </div>
               </div>
          </div>

          {/* CONTENT */}
          <main className="flex-1 p-4 pb-32 md:p-8 md:pb-24 overflow-y-auto">
            <div className="w-full max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
      </div>

      {/* --- CONTEXT NAVIGATION (BOTTOM DOCK) --- */}
      {/* Visible on Mobile AND Desktop when inside a specific module */}
      {contextNavItems && (
        <div className="fixed bottom-0 left-0 right-0 z-[40] p-4 pointer-events-none flex justify-center md:pl-20">
            <nav className={`w-full max-w-md backdrop-blur-md border rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex justify-around items-center px-2 py-1 pointer-events-auto transition-all duration-500 ${isLeaguePath ? 'bg-indigo-500/95 border-indigo-400' : isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}>
              {contextNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isLeagueActiveView 
                    ? location.pathname + location.search === item.path
                    : location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    replace={isLeagueActiveView}
                    className={`flex flex-col items-center justify-center py-2 px-2 w-full transition-all rounded-xl group ${isActive ? '' : 'hover:bg-white/5'}`}
                  >
                    <div className={`p-1.5 rounded-xl mb-0.5 transition-all ${isActive ? (isDarkMode || isLeaguePath ? 'bg-white/20 scale-110' : 'bg-[#575AF9]/10 scale-110') : 'bg-transparent'}`}>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? (isDarkMode || isLeaguePath ? 'text-white' : 'text-[#575AF9]') : (isDarkMode || isLeaguePath ? 'text-white/50' : 'text-slate-400')}`}/>
                    </div>
                    <span className={`text-[9px] font-bold transition-colors ${isActive ? (isDarkMode || isLeaguePath ? 'text-white' : 'text-[#2B2DBF]') : (isDarkMode || isLeaguePath ? 'text-white/50' : 'text-slate-400')}`}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
        </div>
      )}

      {/* MOBILE BOTTOM NAV (GLOBAL FALLBACK) */}
      {/* Only visible on mobile if NOT in a specific context */}
      {!contextNavItems && user && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-2 pointer-events-none md:hidden">
            <nav className={`max-w-md mx-auto backdrop-blur-md border rounded-2xl shadow-lg flex justify-around items-center px-2 py-1 pointer-events-auto bg-white/95 border-slate-200`}>
              {menuItems.slice(0, 5).map((item) => { // Show first 5 items on mobile
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center justify-center py-3 px-2 w-full transition-all rounded-xl ${isActive ? 'text-[#575AF9]' : 'text-slate-400'}`}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </Link>
                );
              })}
            </nav>
        </div>
      )}

      {/* MOBILE MENU DRAWER (Overlay) */}
      {isMenuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              <div className={`absolute right-0 top-0 bottom-0 w-72 shadow-2xl p-6 animate-slide-left flex flex-col transition-colors duration-500 ${isDarkMode || isLeaguePath ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                  <div className="flex justify-between items-center mb-8">
                      <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Menú Principal</span>
                      <button onClick={() => setIsMenuOpen(false)} className={`p-2 rounded-full transition-colors ${isDarkMode || isLeaguePath ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}><X size={20}/></button>
                  </div>
                  <div className="space-y-4 flex-1">
                      {isTournamentActive && (
                          <button onClick={() => { handleBackToHub(); setIsMenuOpen(false); }} className={`flex w-full items-center gap-3 p-3 rounded-xl font-bold transition-colors ${isDarkMode || isLeaguePath ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                              <Home size={20} /> Volver a Mis Torneos
                          </button>
                      )}
                      {menuItems.map(item => (
                          <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${isDarkMode || isLeaguePath ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                              <item.icon size={20} /> {item.label}
                          </Link>
                      ))}
                  </div>
                  <div className={`border-t pt-6 ${isDarkMode || isLeaguePath ? 'border-slate-800' : 'border-slate-100'}`}>
                      <button onClick={handleLogout} className="flex w-full items-center gap-3 p-3 rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold transition-colors">
                          <LogOut size={20} /> Cerrar Sesión
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
