import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TournamentProvider } from './store/TournamentContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { HistoryProvider } from './store/HistoryContext';
import { Layout } from './components/Layout';

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
import PlayerProfile from './pages/PlayerProfile';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/registration" element={<ProtectedRoute><Registration /></ProtectedRoute>} />
        <Route path="/checkin" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
        <Route path="/active" element={<ProtectedRoute><ActiveTournament /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
        
        {/* Menu Routes */}
        <Route path="/players" element={<ProtectedRoute><PlayerManager /></ProtectedRoute>} />
        <Route path="/players/:playerId" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/club" element={<ProtectedRoute><ClubProfile /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HistoryProvider>
        <TournamentProvider>
            <HashRouter>
            <AppRoutes />
            </HashRouter>
        </TournamentProvider>
      </HistoryProvider>
    </AuthProvider>
  );
};

export default App;