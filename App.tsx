
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TournamentProvider } from './store/TournamentContext';
import { LeagueProvider } from './store/LeagueContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { HistoryProvider, useHistory } from './store/HistoryContext';
import { TimerProvider } from './store/TimerContext';
import { NotificationProvider } from './store/NotificationContext';
import { Layout } from './components/Layout';
import { PlayerLayout } from './components/PlayerLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Registration from './pages/Registration';
import CheckIn from './pages/CheckIn';
import ActiveTournament from './pages/ActiveTournament';
import Results from './pages/Results';
import Landing from './pages/Landing';
import AuthPage from './pages/Auth';
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

// Protected Route Wrapper
const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false }: { children?: React.ReactNode, requireAdmin?: boolean, requireSuperAdmin?: boolean }) => {
  const { user, loading, role } = useAuth();
  const { clubData, loadingClub } = useHistory(); 
  const location = useLocation();

  // Unified Loading State: Wait for Auth AND Club Data (if admin required)
  // We only wait for loadingClub if we are actually logged in as admin, to prevent blocking other routes
  if (loading || (requireAdmin && user && role === 'admin' && loadingClub)) {
      return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold animate-pulse">Cargando...</div>;
  }
  
  if (!user) return <Navigate to="/" replace />;
  
  if (role === 'pending' && location.pathname !== '/pending') {
      return <Navigate to="/pending" replace />;
  }

  if (requireSuperAdmin && role !== 'superadmin') {
      return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && role !== 'admin' && role !== 'superadmin') {
      return <Navigate to="/p/dashboard" replace />;
  }

  // ROBUST ONBOARDING CHECK:
  // If we are admin, NOT loading, and have NO club ID (meaning data fetch didn't return a record),
  // we redirect to onboarding to set it up.
  // We exclude superadmin from this check.
  if (requireAdmin && !loadingClub && !clubData.id && location.pathname !== '/onboarding' && role !== 'superadmin') {
      return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, role, loading } = useAuth();

  if (loading) null;

  const getHomeRoute = () => {
      if (!user) return <Landing />;
      if (role === 'superadmin') return <Navigate to="/superadmin" replace />;
      if (role === 'admin') return <Navigate to="/dashboard" replace />;
      if (role === 'pending') return <Navigate to="/pending" replace />;
      return <Navigate to="/p/dashboard" replace />;
  };

  return (
    <Routes>
        <Route path="/" element={getHomeRoute()} />
        <Route path="/auth" element={user ? getHomeRoute() : <AuthPage />} />
        <Route path="/pending" element={<ProtectedRoute><PendingVerification /></ProtectedRoute>} />
        <Route path="/join/:clubId" element={<JoinTournament />} />
        <Route path="/onboarding" element={<ProtectedRoute requireAdmin><Onboarding /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/notifications/settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />

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

        <Route path="/superadmin" element={
            <Layout>
                <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                </ProtectedRoute>
            </Layout>
        } />

        <Route path="/*" element={
            <Layout>
                <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
                    <Route path="/setup" element={<ProtectedRoute requireAdmin><TournamentSetup /></ProtectedRoute>} />
                    <Route path="/registration" element={<ProtectedRoute requireAdmin><Registration /></ProtectedRoute>} />
                    <Route path="/checkin" element={<ProtectedRoute requireAdmin><CheckIn /></ProtectedRoute>} />
                    <Route path="/active" element={<ProtectedRoute requireAdmin><ActiveTournament /></ProtectedRoute>} />
                    <Route path="/results" element={<ProtectedRoute requireAdmin><Results /></ProtectedRoute>} />
                    
                    {/* LEAGUE ROUTES */}
                    <Route path="/league" element={<ProtectedRoute requireAdmin><LeagueDashboard /></ProtectedRoute>} />
                    <Route path="/league/setup" element={<ProtectedRoute requireAdmin><LeagueSetup /></ProtectedRoute>} />
                    <Route path="/league/groups/:categoryId" element={<ProtectedRoute requireAdmin><LeagueGroups /></ProtectedRoute>} />
                    <Route path="/league/active" element={<ProtectedRoute requireAdmin><LeagueActive /></ProtectedRoute>} />
                    
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
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HistoryProvider>
        <NotificationProvider>
            <TournamentProvider>
                <LeagueProvider>
                    <TimerProvider>
                        <HashRouter>
                        <AppRoutes />
                        </HashRouter>
                    </TimerProvider>
                </LeagueProvider>
            </TournamentProvider>
        </NotificationProvider>
      </HistoryProvider>
    </AuthProvider>
  );
};

export default App;
