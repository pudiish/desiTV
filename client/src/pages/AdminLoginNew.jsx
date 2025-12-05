/**
 * DesiTV™ Admin Login Page
 * 
 * Clean, simple login page using AuthContext
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setupAdmin, isAuthenticated, loading: authLoading, initialized } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' or 'setup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Get the redirect path
  const from = location.state?.from?.pathname || '/admin/dashboard';

  // Redirect if already authenticated (after context is initialized)
  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [initialized, isAuthenticated, navigate, from]);

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    const result = await login(username.trim(), password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  // Handle setup
  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const result = await setupAdmin(username.trim(), password);

    if (result.success) {
      setSuccess('Admin account created! You can now login.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } else {
      setError(result.error || 'Setup failed');
    }

    setLoading(false);
  };

  // Show loading while auth context initializes
  if (!initialized || authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}>📺</div>
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>📺</span>
          <h1 style={styles.title}>DesiTV™</h1>
          <p style={styles.subtitle}>Admin Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleSetup} style={styles.form}>
          {/* Success Message */}
          {success && (
            <div style={styles.successBox}>
              ✅ {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={styles.errorBox}>
              ⚠️ {error}
            </div>
          )}

          {/* Username */}
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Enter username"
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>

          {/* Password */}
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter password"
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* Confirm Password (setup mode only) */}
          {mode === 'setup' && (
            <div style={styles.field}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                placeholder="Confirm password"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? (
              '⏳ Please wait...'
            ) : mode === 'login' ? (
              '🔐 Login'
            ) : (
              '✨ Create Account'
            )}
          </button>
        </form>

        {/* Mode Toggle */}
        <div style={styles.toggleSection}>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'setup' : 'login');
              setError('');
              setSuccess('');
              setPassword('');
              setConfirmPassword('');
            }}
            style={styles.toggleBtn}
            disabled={loading}
          >
            {mode === 'login' ? '🆕 First time? Create account' : '← Back to login'}
          </button>
        </div>

        {/* Back to Home */}
        <div style={styles.backSection}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={styles.backBtn}
          >
            📺 Back to TV
          </button>
        </div>

        {/* Footer */}
        <p style={styles.footer}>
          🔒 Secured with JWT Authentication
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
    padding: '20px',
  },
  loadingBox: {
    textAlign: 'center',
    color: '#00d4ff',
  },
  spinner: {
    fontSize: '64px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '18px',
    color: '#888',
  },
  loginCard: {
    background: 'rgba(30, 30, 50, 0.95)',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 212, 255, 0.1)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  logo: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '10px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#00d4ff',
    margin: '0 0 5px 0',
    fontFamily: "'Courier New', monospace",
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  input: {
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #333',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.3s, box-shadow 0.3s',
  },
  successBox: {
    padding: '12px 16px',
    background: 'rgba(0, 200, 100, 0.1)',
    border: '1px solid rgba(0, 200, 100, 0.3)',
    borderRadius: '8px',
    color: '#00c864',
    fontSize: '14px',
    textAlign: 'center',
  },
  errorBox: {
    padding: '12px 16px',
    background: 'rgba(255, 80, 80, 0.1)',
    border: '1px solid rgba(255, 80, 80, 0.3)',
    borderRadius: '8px',
    color: '#ff5050',
    fontSize: '14px',
    textAlign: 'center',
  },
  submitBtn: {
    padding: '16px',
    fontSize: '16px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    marginTop: '10px',
  },
  toggleSection: {
    marginTop: '20px',
    textAlign: 'center',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#00d4ff',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
    opacity: 0.8,
  },
  backSection: {
    marginTop: '15px',
    textAlign: 'center',
  },
  backBtn: {
    background: 'none',
    border: '1px solid #444',
    color: '#888',
    fontSize: '13px',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  footer: {
    marginTop: '25px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#555',
  },
};
