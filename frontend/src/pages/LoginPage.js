import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm] = useState({ email: 'sarah@company.com', password: 'password123' });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email) => setForm(f => ({ ...f, email }));

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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => set('password', e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 10 }}>
            NEW USER?{' '}
            <button className="btn btn-link" onClick={() => navigate('/signup')}
              style={{ padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>
              Sign up here
            </button>
          </p>
          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 10, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 10 }}>
            DEMO QUICK LOGIN
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'Admin', email: 'sarah@company.com' },
              { label: 'Supervisor', email: 'marcus@company.com' },
              { label: 'Agent', email: 'aisha@company.com' },
            ].map(({ label, email }) => (
              <button key={label} className="btn btn-ghost btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                type="button" onClick={() => quickLogin(email)}>
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
            Password for all: <code style={{ color: 'var(--accent)' }}>password123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
