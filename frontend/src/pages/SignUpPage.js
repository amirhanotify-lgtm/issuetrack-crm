import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function SignUpPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('loading'); // 'loading', 'firstAdmin', 'invited', 'inviteRequired'
  const [invitationData, setInvitationData] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Check if this should be first admin or invited signup
  useEffect(() => {
    const checkMode = async () => {
      try {
        if (token) {
          // Validate token and get invitation details
          try {
            const res = await api.get(`/auth/invitation-info/${token}`);
            setInvitationData({ email: res.data.email, role: res.data.role });
            setForm(f => ({ ...f, email: res.data.email }));
            setMode('invited');
          } catch (err) {
            toast.error('Invalid or expired invitation');
            setMode('error');
          }
          return;
        }

        const storedToken = localStorage.getItem('crm_token');
        if (storedToken) {
          try {
            const res = await api.get('/auth/me');
            if (res?.data) {
              navigate('/');
              return;
            }
          } catch {
            // Invalid token or not logged in, allow signup logic below
          }
        }

        const setupRes = await api.get('/auth/setup');
        if (setupRes.data.adminsExist) {
          setMode('inviteRequired');
        } else {
          setMode('firstAdmin');
        }
      } catch (err) {
        toast.error('Failed to load signup form');
        setMode('error');
      }
    };

    checkMode();
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, token || null);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (err) {
      const error = err.response?.data?.error || 'Signup failed';
      toast.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner" style={{ marginBottom: 16, display: 'block' }} />
          <p style={{ color: 'var(--text2)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (mode === 'inviteRequired') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
      }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 14, padding: 40, width: 420, textAlign: 'center',
        }}>
          <h2 style={{ color: 'var(--text1)', marginBottom: 16 }}>Signup by Invitation Only</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
            An admin already exists for this organization. To create a new account, please accept an invitation email or ask an admin to invite you.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
      }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 14, padding: 40, width: 400, textAlign: 'center',
        }}>
          <h2 style={{ color: 'var(--text1)', marginBottom: 16 }}>Error</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
            Failed to load the signup form. Please try again later.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const pageTitle = mode === 'firstAdmin' ? 'Create Admin Account' : 'Create Your Account';
  const pageSubtitle = mode === 'firstAdmin' 
    ? 'Set up your organization by creating the admin account' 
    : 'Complete your account setup';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 14, padding: 40, width: 400,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: 'var(--accent)',
            borderRadius: 14, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>IssueTrack CRM</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Customer Service Intelligence</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{pageTitle}</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>{pageSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" type="text" value={form.name}
              onChange={e => set('name', e.target.value)} required autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} required
              readOnly={token ? true : false}
              style={token ? { backgroundColor: 'var(--bg3)', cursor: 'not-allowed' } : {}} />
            {token && invitationData && (
              <>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Email from your invitation
                </p>
                <div style={{ marginTop: 12, padding: 12, backgroundColor: 'var(--bg3)', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 8px 0' }}>Your role:</p>
                  <span style={{
                    background: invitationData.role === 'admin' ? '#667eea' : 
                               invitationData.role === 'supervisor' ? '#f59e0b' : '#10b981',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-block',
                  }}>
                    {invitationData.role?.charAt(0).toUpperCase() + invitationData.role?.slice(1)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => set('password', e.target.value)} required
              placeholder="At least 8 characters" />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" value={form.confirmPassword}
              onChange={e => set('confirmPassword', e.target.value)} required />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Already have an account?{' '}
            <button className="btn btn-link" onClick={() => navigate('/login')}
              style={{ padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
