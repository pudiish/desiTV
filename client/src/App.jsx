/**
 * DesiTV™ Main Application
 * 
 * Restructured with proper auth flow using React Context
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './pages/AdminLoginNew';
import './App.css';

/**
 * Protected Route - requires authentication
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, initialized } = useAuth();
  const location = useLocation();

  // Wait for auth context to initialize
  if (!initialized || loading) {
    return (
      <div className="auth-checking">
        <div className="auth-spinner">📺</div>
        <p>Loading...</p>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Admin Dashboard with navigation buttons
 */
function AdminView() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="admin-view">
      <AdminDashboard />
      
      {/* Admin Navigation */}
      <div className="admin-nav-buttons">
        <div className="admin-user-info">
          👤 {user?.username || 'Admin'}
        </div>
        <button
          className="back-to-app-btn"
          onClick={() => navigate('/')}
          title="Back to TV"
        >
          📺 TV
        </button>
        <button
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

/**
 * Main TV View
 */
function TVView() {
  const navigate = useNavigate();

  return (
    <div className="tv-view">
      <Home />
      <button
        className="admin-button"
        onClick={() => navigate('/admin')}
        title="Admin Dashboard"
      >
        ⚙️
      </button>
    </div>
  );
}

/**
 * App Routes wrapped in AuthProvider
 */
function AppRoutes() {
  return (
    <div className="app">
      <Routes>
        {/* Public: TV View */}
        <Route path="/" element={<TVView />} />
        
        {/* Public: Admin Login */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Protected: Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminView />
            </ProtectedRoute>
          }
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

/**
 * Main App Component
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
