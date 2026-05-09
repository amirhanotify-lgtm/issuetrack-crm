import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function InviteUsersPage() {
  const { user, can } = useAuth();
  const [form, setForm] = useState({ email: '', role: 'agent' });
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Fetch pending invitations
  useEffect(() => {
    if (!can('admin')) return;
    loadInvitations();
  }, [can]);

  const loadInvitations = async () => {
    try {
      setFetching(true);
      const res = await api.get('/auth/invitations');
      setInvitations(res.data);
    } catch (err) {
      toast.error('Failed to load invitations');
    } finally {
      setFetching(false);
    }
  };

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error('Please enter an email');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/invite', {
        email: form.email,
        role: form.role,
      });

      toast.success('Invitation sent successfully!');
      setForm({ email: '', role: 'agent' });
      setInvitations([res.data, ...invitations]);
    } catch (err) {
      const error = err.response?.data?.error || 'Failed to send invitation';
      toast.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      await api.post(`/auth/invitations/${invitationId}/resend`);
      toast.success('Invitation resent successfully!');
    } catch (err) {
      toast.error('Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!window.confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await api.delete(`/auth/invitations/${invitationId}`);
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      toast.success('Invitation cancelled');
    } catch (err) {
      toast.error('Failed to cancel invitation');
    }
  };

  if (!can('admin')) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: 'var(--text2)' }}>You don't have permission to access this page</p>
      </div>
    );
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: '#667eea',
      supervisor: '#f59e0b',
      agent: '#10b981',
    };
    return colors[role] || '#6b7280';
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Invite Users</h1>
        <p style={{ color: 'var(--text3)' }}>Send invitations to new team members</p>
      </div>

      {/* Invite Form */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 12, padding: 24, marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Send New Invitation</h2>

        <form onSubmit={handleSendInvitation} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="user@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={form.role}
              onChange={e => set('role', e.target.value)}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            >
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="agent">Agent</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ padding: '10px 24px' }}
          >
            {loading ? <span className="spinner" /> : 'Send Invitation'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
          The user will receive an email with a link to create their account.
        </p>
      </div>

      {/* Pending Invitations */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 12, padding: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Pending Invitations {invitations.length > 0 && `(${invitations.length})`}
        </h2>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <span className="spinner" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text3)' }}>Loading invitations...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div style={{
            background: 'var(--bg3)', borderRadius: 8, padding: 24, textAlign: 'center',
          }}>
            <p style={{ color: 'var(--text3)', marginBottom: 0 }}>No pending invitations</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: 'var(--text3)' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: 'var(--text3)' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: 'var(--text3)' }}>Invited By</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: 'var(--text3)' }}>Sent Date</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: 'var(--text3)' }}>Expires</th>
                  <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 600, color: 'var(--text3)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} style={{
                    borderBottom: '1px solid var(--border)',
                    hoverBg: 'var(--bg3)',
                  }}>
                    <td style={{ padding: '12px 0', color: 'var(--text1)' }}>{inv.email}</td>
                    <td style={{ padding: '12px 0' }}>
                      <span style={{
                        background: getRoleColor(inv.role),
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-block',
                      }}>
                        {inv.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text2)' }}>{inv.created_by_name || 'System'}</td>
                    <td style={{ padding: '12px 0', color: 'var(--text2)', fontSize: 12 }}>
                      {formatDate(inv.created_at)}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--text2)', fontSize: 12 }}>
                      {formatDate(inv.expires_at)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleResendInvitation(inv.id)}
                          title="Resend invitation email"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          Resend
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleCancelInvitation(inv.id)}
                          title="Cancel and delete this invitation"
                          style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
