
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Trophy, Users, ClipboardList, Activity, List, Menu, LogOut,
    UserCog, History, Settings, HelpCircle, X, Bell, Shield,
    LayoutGrid, Home, CalendarRange, GitMerge,
    ArrowLeft, CalendarDays, Swords, Search
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useHistory } from '../store/HistoryContext';
import { useTournament } from '../store/TournamentContext';
import { useNotifications } from '../store/NotificationContext';
import { PP } from '../utils/theme';
import { avatarColor, initials } from '../utils/avatar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { clubData } = useHistory();
  const { state, closeTournament, isOverlayOpen } = useTournament();
  const { unreadCount } = useNotifications();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // CONTEXT DETECTION
  const isMiniList = location.pathname === '/minis';
  const isSpecificMini = location.pathname.startsWith('/tournament/');
  const isSetup = location.pathname === '/setup';
  const isMiniContext = isMiniList || isSpecificMini || isSetup;
  const isLeagueContext = location.pathname.startsWith('/league');

  // Active nav id derived from route
  const getActiveNav = () => {
    const p = location.pathname;
    if (p === '/dashboard') return 'dashboard';
    if (p.startsWith('/minis') || p.startsWith('/tournament') || p === '/setup') return 'minis';
    if (p.startsWith('/league')) return 'ligas';
    if (p.startsWith('/partidos')) return 'partidos';
    if (p.startsWith('/courts')) return 'pistas';
    if (p.startsWith('/players')) return 'jugadores';
    if (p.startsWith('/club')) return 'club';
    return 'dashboard';
  };
  const activeNav = getActiveNav();

  // NAV ITEMS
  const navItems = [
    { id: 'dashboard', label: 'Dashboard',   path: '/dashboard', visible: true },
    { id: 'minis',     label: 'Minis',        path: '/minis',     visible: clubData.minis_full_enabled !== false || clubData.minis_lite_enabled === true },
    { id: 'ligas',     label: 'Ligas',        path: '/league',    visible: clubData.league_enabled === true },
    { id: 'partidos',  label: 'Partidos',     path: '/partidos',  visible: true },
    { id: 'pistas',    label: 'Pistas',       path: '/courts',    visible: clubData.courts_enabled === true || role === 'superadmin' },
    { id: 'jugadores', label: 'Jugadores',    path: '/players',   visible: clubData.show_players !== false || clubData.minis_lite_enabled === true },
    { id: 'club',      label: 'Mi Club',      path: '/club',      visible: true },
  ].filter(i => i.visible);

  if (role === 'superadmin') {
    navItems.unshift({ id: 'superadmin', label: 'Super Admin', path: '/superadmin', visible: true });
  }

  // MOBILE MENU ITEMS (full set, including extras)
  const mobileMenuItems = [
    { path: '/dashboard', label: 'Inicio',         icon: Home,       visible: true },
    { path: '/minis',     label: 'Minis',           icon: Trophy,     visible: clubData.minis_full_enabled !== false || clubData.minis_lite_enabled === true },
    { path: '/league',    label: 'Ligas',           icon: GitMerge,   visible: clubData.league_enabled === true },
    { path: '/partidos',  label: 'Partidos',        icon: Swords,     visible: true },
    { path: '/courts',    label: 'Pistas',          icon: LayoutGrid, visible: clubData.courts_enabled === true },
    { path: '/players',   label: 'Jugadores',       icon: UserCog,    visible: clubData.show_players !== false || clubData.minis_lite_enabled === true },
    { path: '/history',   label: 'Historial',       icon: History,    visible: clubData.show_history !== false },
    { path: '/club',      label: 'Mi Club',         icon: Settings,   visible: true },
    { path: '/help',      label: 'Ayuda',           icon: HelpCircle, visible: true },
  ].filter(i => i.visible);

  // CONTEXT SUBNAV (bottom dock on mobile, horizontal strip on desktop)
  const tournamentNavItems = [
    { path: '/tournament/manage',       label: 'Gestión',  icon: Settings },
    { path: '/tournament/registration', label: 'Registro', icon: Users },
    { path: '/tournament/checkin',      label: 'Control',  icon: ClipboardList },
    { path: '/tournament/active',       label: 'Directo',  icon: Activity },
    { path: '/tournament/results',      label: 'Clasi',    icon: List },
  ];
  const leagueNavItems = [
    { path: '/league/active?tab=management',  label: 'Gestión',  icon: Settings },
    { path: '/league/active?tab=registration',label: 'Registro', icon: Users },
    { path: '/league/active?tab=standings',   label: 'Clasi',    icon: Trophy },
    { path: '/league/active?tab=calendar',    label: 'Jornadas', icon: CalendarRange },
    { path: '/league/active?tab=playoffs',    label: 'Playoff',  icon: GitMerge },
  ];

  let contextNavItems: typeof tournamentNavItems | null = null;
  if (isSpecificMini) contextNavItems = tournamentNavItems;
  else if (isLeagueContext && location.pathname.includes('/league/active')) contextNavItems = leagueNavItems;

  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';
  if (isPublicPage) return <>{children}</>;

  const handleLogout = async () => { await signOut(); navigate('/'); };
  const handleBackToHub = () => {
    if (isSpecificMini) { closeTournament(); navigate('/minis'); }
    else navigate('/dashboard');
  };

  const showDefaultBranding = clubData.name === 'Mi Club de Padel' || clubData.name === 'ParaPadel';
  const clubDisplayName = showDefaultBranding ? 'ParaPádel' : clubData.name;

  // DARK TOPBAR for Minis active context
  const dark = isMiniContext;
  const topbarBg   = dark ? 'rgba(11,16,32,0.85)' : 'rgba(255,255,255,0.92)';
  const topbarBdr  = dark ? 'rgba(255,255,255,0.08)' : PP.hair;
  const inkColor   = dark ? '#F5F7FF' : PP.ink;
  const muteColor  = dark ? 'rgba(255,255,255,0.55)' : PP.mute;
  const activeNavBg   = dark ? 'rgba(255,255,255,0.12)' : PP.primaryTint;
  const activeNavFg   = dark ? '#fff' : PP.primary;
  const inactiveNavFg = dark ? 'rgba(255,255,255,0.55)' : PP.ink2;

  // Admin display name from email
  const adminName = user?.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Admin';
  const adminInitials = initials(adminName);
  const adminAc = avatarColor(adminName);

  // BACKGROUND
  let bgStyle: React.CSSProperties = { background: PP.bg };
  if (isMiniContext) bgStyle = {
    background: '#0B1020',
    backgroundImage: 'radial-gradient(1200px 600px at 15% -10%, rgba(87,90,249,0.35), transparent 60%), radial-gradient(900px 500px at 85% 10%, rgba(168,85,247,0.25), transparent 60%)',
    color: '#F5F7FF',
  };
  else if (isLeagueContext) bgStyle = { background: '#6366F1', color: '#fff' };

  return (
    <div style={{ minHeight: '100vh', fontFamily: PP.font, ...bgStyle }} className="flex flex-col">

      {/* ── DESKTOP TOPBAR ───────────────────────────────────────────────────── */}
      <header className="hidden md:flex items-center sticky top-0 z-50"
        style={{
          height: 60,
          padding: '0 32px',
          gap: 24,
          background: topbarBg,
          borderBottom: `1px solid ${topbarBdr}`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>

        {/* Logo + club */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: PP.primary, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, letterSpacing: -0.3,
          }}>P</div>
          <span style={{ fontSize: 14, fontWeight: 800, color: inkColor, letterSpacing: -0.3 }}>ParaPádel</span>
          <span style={{ width: 1, height: 20, background: topbarBdr, margin: '0 4px' }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: muteColor }}>
            {clubDisplayName}
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {navItems.map(item => {
            const on = item.id === activeNav;
            return (
              <Link key={item.id} to={item.path} style={{
                background: on ? activeNavBg : 'transparent',
                color: on ? activeNavFg : inactiveNavFg,
                border: 0,
                padding: '7px 11px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: on ? 700 : 600,
                textDecoration: 'none',
                letterSpacing: -0.1,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
              }}>{item.label}</Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }}/>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: dark ? 'rgba(255,255,255,0.06)' : '#F1F3F7',
          border: `1px solid ${dark ? 'transparent' : PP.hair}`,
          padding: '6px 12px', borderRadius: 10, width: 220, flexShrink: 0,
        }}>
          <Search size={14} style={{ color: muteColor }}/>
          <span style={{ fontSize: 13, color: muteColor, fontWeight: 500 }}>Buscar…</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: muteColor,
            background: dark ? 'rgba(255,255,255,0.08)' : '#fff',
            padding: '2px 6px', borderRadius: 5,
            border: `1px solid ${topbarBdr}` }}>⌘K</span>
        </div>

        {/* Bell */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: dark ? 'rgba(255,255,255,0.06)' : '#fff',
            border: `1px solid ${topbarBdr}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: muteColor, cursor: 'pointer', position: 'relative', flexShrink: 0,
          }}>
          <Bell size={16}/>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 8, right: 9,
              width: 7, height: 7, borderRadius: 4,
              background: PP.primary,
              boxShadow: `0 0 0 2px ${dark ? '#0B1020' : '#fff'}`,
            }}/>
          )}
        </button>

        {/* Admin avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: adminAc.bg, color: adminAc.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12,
          }}>{adminInitials}</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: inkColor, letterSpacing: -0.2 }}>{adminName}</span>
            <span style={{ fontSize: 11, color: muteColor, fontWeight: 500 }}>Admin</span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{ background: 'none', border: 0, color: muteColor, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
          >
            <LogOut size={14}/>
          </button>
        </div>
      </header>

      {/* ── MOBILE HEADER ──────────────────────────────────────────────────────── */}
      <div className="md:hidden pt-2 px-2 pb-2 sticky top-0 z-40">
        <header className={`px-4 py-3 flex justify-between items-center border rounded-2xl shadow-sm transition-all duration-500 ${isMiniContext ? 'bg-slate-900/90 border-slate-700 backdrop-blur-md text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {isMiniContext && (
              <button onClick={handleBackToHub} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors shrink-0 text-white" title="Volver">
                <ArrowLeft size={18}/>
              </button>
            )}
            {isLeagueContext && (
              <button onClick={() => navigate('/dashboard')} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors shrink-0 text-white" title="Volver al Panel">
                <ArrowLeft size={18}/>
              </button>
            )}
            <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 border-2 flex items-center justify-center ${isMiniContext ? 'border-slate-600 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}>
              {clubData.logoUrl
                ? <img src={clubData.logoUrl} alt="Logo" className="w-full h-full object-cover"/>
                : <Trophy size={16} className={isMiniContext ? 'text-slate-400' : 'text-slate-300'}/>
              }
            </div>
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-sm font-black truncate leading-tight">{clubDisplayName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMenuOpen(true)} className={`p-2 rounded-full transition-colors ${isMiniContext ? 'text-slate-200' : 'text-slate-700'}`}>
              <Menu size={24}/>
            </button>
          </div>
        </header>
      </div>

      {/* ── DESKTOP CONTEXT SUBNAV ─────────────────────────────────────────────── */}
      {contextNavItems && !isOverlayOpen && (
        <div className="hidden md:flex sticky z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm" style={{ top: 60 }}>
          <nav className="flex items-center gap-1 px-6 h-12 w-full max-w-[1600px] mx-auto">
            {contextNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname + location.search === item.path || location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${isActive ? 'bg-[#575AF9]/10 text-[#575AF9]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2}/>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────────── */}
      <main className={`flex-1 p-4 md:p-8 md:pt-6 overflow-y-auto ${contextNavItems ? 'pb-32 md:pb-10' : 'pb-10'}`}>
        <div className="w-full max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM DOCK ─────────────────────────────────────────────────── */}
      {contextNavItems && !isOverlayOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[40] p-4 pointer-events-none flex justify-center safe-pb">
          <nav className="w-full max-w-md backdrop-blur-md border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex justify-around items-center px-2 py-1 pointer-events-auto bg-white/95">
            {contextNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname + location.search === item.path || location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className="flex flex-col items-center justify-center py-2 px-2 w-full transition-all rounded-xl">
                  <div className={`p-1.5 rounded-xl mb-0.5 transition-all ${isActive ? 'bg-[#575AF9]/10 scale-110' : 'bg-transparent'}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-[#575AF9]' : 'text-slate-400'}`}/>
                  </div>
                  <span className={`text-[9px] font-bold transition-colors ${isActive ? 'text-[#575AF9]' : 'text-slate-400'}`}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── MOBILE MENU DRAWER ─────────────────────────────────────────────────── */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}/>
          <div className="absolute right-0 top-0 bottom-0 w-72 shadow-2xl p-6 animate-slide-left flex flex-col bg-slate-900 text-white">
            <div className="flex justify-between items-center mb-8">
              <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Menú Principal</span>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full bg-slate-800 text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-2 flex-1">
              {mobileMenuItems.map(item => (
                <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl font-medium transition-colors text-slate-300 hover:bg-slate-800">
                  <item.icon size={20}/>
                  <span className="flex-1">{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="border-t pt-6 border-slate-800">
              <button onClick={handleLogout} className="flex w-full items-center gap-3 p-3 rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold transition-colors">
                <LogOut size={20}/> Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
