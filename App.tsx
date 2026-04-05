
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TournamentProvider } from './store/TournamentContext';
import { LeagueProvider } from './store/LeagueContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ToastProvider } from './components/Toast';
import { HistoryProvider, useHistory } from './store/HistoryContext';
import { TimerProvider } from './store/TimerContext';
import { NotificationProvider } from './store/NotificationContext';
import { Layout } from './components/Layout';
import { PlayerLayout } from './components/PlayerLayout';

// Pages
import GeneralDashboard from './pages/GeneralDashboard'; // Hub Principal
import MiniDashboard from './pages/MiniDashboard';       // Listado de Minis
import TournamentManager from './pages/TournamentManager'; // Gestión de 1 Mini
import Registration from './pages/Registration';
import CheckIn from './pages/CheckIn';
import ActiveTournament from './pages/ActiveTournament';
import Results from './pages/Results';
import Landing from './pages/Landing';
import AuthPage from './pages/Auth';
import ResetPassword from './pages/ResetPassword'; // NEW
import PlayerManager from './pages/PlayerManager';
import History from './pages/History';
import ClubProfile from './pages/ClubProfile';
import Help from './pages/Help';
import AdminPlayerProfile from './pages/PlayerProfile'; 
import Onboarding from './pages/Onboarding'; 
import JoinTournament from './pages/public/JoinTournament';
import TournamentSetup from './pages/TournamentSetup';
import SuperAdmin from './pages/SuperAdmin'; 
import Notifications from './pages/Notifications';
import NotificationSettings from './pages/NotificationSettings';
import PendingVerification from './pages/PendingVerification';
import LiteSetup from './pages/lite/LiteSetup'; // NEW
import ClubCalendar from './pages/ClubCalendar';

// League Pages
import LeagueDashboard from './pages/LeagueDashboard';
import LeagueSetup from './pages/LeagueSetup';
import LeagueGroups from './pages/LeagueGroups';
import LeagueActive from './pages/LeagueActive';

// Player Pages
import PlayerDashboard from './pages/player/PlayerDashboard';
import PlayerTournaments from './pages/player/PlayerTournaments';
import TournamentBrowser from './pages/player/TournamentBrowser';
import PlayerAppProfile from './pages/player/PlayerProfile';

// Handler para errores de auth que Supabase mete en el hash de la URL
// Ej: /#error=access_denied&error_code=otp_expired
const AuthErrorHandler: React.FC = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    const hash = window.location.hash;

    // Caso 1: Error en el enlace (otp_expired, etc.)
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const errorCode = params.get('error_code') || params.get('error');
      const errorDesc = params.get('error_description')?.replace(/\+/g, ' ') || 'Enlace inválido o expirado';
      window.history.replaceState(null, '', window.location.pathname);
      navigate(`/auth?auth_error=${encodeURIComponent(errorCode === 'otp_expired' ? 'El enlace ha expirado. Solicita uno nuevo.' : errorDesc)}`, { replace: true });
      return;
    }

    // Caso 2: Token de recovery en URL malformada (doble-hash): /#/reset-password#access_token=...
    // Ocurre cuando redirectTo tenía formato HashRouter (/#/reset-password) en lugar de /reset-password
    // Reencaminamos al token al formato correcto para que Supabase JS lo parsee
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      const secondHashIdx = hash.indexOf('#', 1);
      // Si hay doble-hash, los params están tras el segundo #; si no, tras el primero
      const tokenParams = secondHashIdx !== -1 ? hash.substring(secondHashIdx + 1) : hash.substring(1);
      navigate(`/reset-password#${tokenParams}`, { replace: true });
    }
  }, [navigate]);
  return null;
};

// Protected Route Wrapper
const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false }: { children?: React.ReactNode, requireAdmin?: boolean, requireSuperAdmin?: boolean }) => {
  const { user, loading, role } = useAuth();
  const { clubData, loadingClub } = useHistory(); 
  const location = useLocation();

  if (loading || (requireAdmin && user && role === 'admin' && loadingClub)) {
      return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold animate-pulse">Cargando...</div>;
  }
  
  if (!user) return <Navigate to="/" replace />;
  if (role === null) return <Navigate to="/" replace />;
  if (role === 'pending' && location.pathname !== '/pending') return <Navigate to="/pending" replace />;
  if (requireSuperAdmin && role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  if (requireAdmin && role === 'player') return <Navigate to="/p/dashboard" replace />;
  if (requireAdmin && role === 'admin' && !loadingClub && !clubData.id && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold animate-pulse">Cargando Aplicación...</div>;
  }

  const getHomeRoute = () => {
      if (!user) return <Landing />;
      if (role === null) return <Landing />;
      if (role === 'superadmin') return <Navigate to="/superadmin" replace />;
      if (role === 'player') return <Navigate to="/p/dashboard" replace />;
      if (role === 'pending') return <Navigate to="/pending" replace />;
      return <Navigate to="/dashboard" replace />;
  };

  return (
    <>
      <AuthErrorHandler />
      <Routes>
        <Route path="/" element={getHomeRoute()} />
        <Route path="/auth" element={user ? getHomeRoute() : <AuthPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pending" element={<ProtectedRoute><PendingVerification /></ProtectedRoute>} />
        <Route path="/join/:clubId" element={<JoinTournament />} />
        <Route path="/onboarding" element={<ProtectedRoute requireAdmin><Onboarding /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/notifications/settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />

        {/* PLAYER APP ROUTES */}
        <Route path="/p/*" element={
            <ProtectedRoute>
                <PlayerLayout>
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<PlayerDashboard />} />
                        <Route path="explore" element={<TournamentBrowser />} />
                        <Route path="tournaments" element={<PlayerTournaments />} />
                        <Route path="profile" element={<PlayerAppProfile />} />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </PlayerLayout>
            </ProtectedRoute>
        } />

        {/* SUPER ADMIN ROUTES */}
        <Route path="/superadmin" element={
            <Layout>
                <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                </ProtectedRoute>
            </Layout>
        } />

        {/* CLUB ADMIN ROUTES */}
        <Route path="/*" element={
            <Layout>
                <Routes>
                    {/* HUB & LISTS */}
                    <Route path="/dashboard" element={<ProtectedRoute requireAdmin><GeneralDashboard /></ProtectedRoute>} />
                    <Route path="/minis" element={<ProtectedRoute requireAdmin><MiniDashboard /></ProtectedRoute>} />
                    
                    {/* SPECIFIC MINI TOURNAMENT ROUTES */}
                    <Route path="/tournament/manage" element={<ProtectedRoute requireAdmin><TournamentManager /></ProtectedRoute>} />
                    <Route path="/setup" element={<ProtectedRoute requireAdmin><TournamentSetup /></ProtectedRoute>} />
                    <Route path="/lite/setup" element={<ProtectedRoute requireAdmin><LiteSetup /></ProtectedRoute>} /> {/* NEW */}
                    <Route path="/tournament/registration" element={<ProtectedRoute requireAdmin><Registration /></ProtectedRoute>} />
                    <Route path="/tournament/checkin" element={<ProtectedRoute requireAdmin><CheckIn /></ProtectedRoute>} />
                    <Route path="/tournament/active" element={<ProtectedRoute requireAdmin><ActiveTournament /></ProtectedRoute>} />
                    <Route path="/tournament/results" element={<ProtectedRoute requireAdmin><Results /></ProtectedRoute>} />
                    
                    {/* LEAGUE ROUTES */}
                    <Route path="/league" element={<ProtectedRoute requireAdmin><LeagueDashboard /></ProtectedRoute>} />
                    <Route path="/league/setup" element={<ProtectedRoute requireAdmin><LeagueSetup /></ProtectedRoute>} />
                    <Route path="/league/groups/:categoryId" element={<ProtectedRoute requireAdmin><LeagueGroups /></ProtectedRoute>} />
                    <Route path="/league/active" element={<ProtectedRoute requireAdmin><LeagueActive /></ProtectedRoute>} />
                    
                    {/* COURTS / CALENDAR */}
                    <Route path="/courts" element={<ProtectedRoute requireAdmin><ClubCalendar /></ProtectedRoute>} />

                    {/* SHARED MODULES */}
                    <Route path="/players" element={<ProtectedRoute requireAdmin><PlayerManager /></ProtectedRoute>} />
                    <Route path="/players/:playerId" element={<ProtectedRoute requireAdmin><AdminPlayerProfile /></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute requireAdmin><History /></ProtectedRoute>} />
                    <Route path="/club" element={<ProtectedRoute requireAdmin><ClubProfile /></ProtectedRoute>} />
                    <Route path="/help" element={<ProtectedRoute requireAdmin><Help /></ProtectedRoute>} />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Layout>
        } />
    </Routes>
    </>
  );
}

const App: React.FC = () => {
  return (
    <ToastProvider>
    <AuthProvider>
      <HistoryProvider>
        <NotificationProvider>
            <TournamentProvider>
                <LeagueProvider>
                    <TimerProvider>
                        <BrowserRouter>
                        <AppRoutes />
                        </BrowserRouter>
                    </TimerProvider>
                </LeagueProvider>
            </TournamentProvider>
        </NotificationProvider>
      </HistoryProvider>
    </AuthProvider>
    </ToastProvider>
  );
};

export default App;
