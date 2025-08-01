import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/ui/Sidebar';
import { Header } from './components/ui/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import Actions from './pages/Actions';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Usuarios from './pages/Usuarios';
import Entidades from './pages/Entidades';
import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, validateSession } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      await validateSession();
      if (isMounted) setLoading(false);
    };
    checkSession();

    return () => { isMounted = false; };
    // eslint-disable-next-line
  }, [location.pathname]);

  React.useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('lastValidRoute', location.pathname);
    }
  }, [location.pathname, isAuthenticated]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to the last valid route if available, otherwise to login
    const lastValidRoute = localStorage.getItem('lastValidRoute') || '/login';
    return <Navigate to={lastValidRoute} replace />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/casos" element={
              <ProtectedRoute>
                <Cases />
              </ProtectedRoute>
            } />
            
            <Route path="/pj" element={
              <ProtectedRoute>
                <Cases />
              </ProtectedRoute>
            } />
            
            <Route path="/pas" element={
              <ProtectedRoute>
                <Cases />
              </ProtectedRoute>
            } />
            
            <Route path="/acciones" element={
              <ProtectedRoute>
                <Actions />
              </ProtectedRoute>
            } />
            
            <Route path="/calendario" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            
            <Route path="/usuarios" element={
              <ProtectedRoute>
                <Usuarios />
              </ProtectedRoute>
            } />

            <Route path="/entidades" element={
              <ProtectedRoute>
                <Entidades />
              </ProtectedRoute>
            } />

            <Route path="/ajustes" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            
            {/* Mantener rutas antiguas para compatibilidad */}
            <Route path="/cases" element={<Navigate to="/casos" replace />} />
            <Route path="/actions" element={<Navigate to="/acciones" replace />} />
            <Route path="/calendar" element={<Navigate to="/calendario" replace />} />
            <Route path="/settings" element={<Navigate to="/ajustes" replace />} />
            
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;