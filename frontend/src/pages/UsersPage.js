import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { RoleBadge, Avatar } from '../components/Badges';

function UserForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'agent' });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) { toast.error('All fields required'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('User created');
      onSave(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={form.name} autoFocus onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Password * (min 8 chars)</label>
          <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="agent">Agent</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Create User'}
        </button>
      </div>
    </>
  );
}

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [page, setPage]       = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try { 
      const res = await api.get('/users', { params: { page, limit: 20 } });
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      toast.success(`User ${u.active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch { toast.error('Failed to update'); }
  };

  const changeRole = async (u, role) => {
    try {
      await api.patch(`/users/${u.id}`, { role });
      toast.success('Role updated');
      fetchUsers();
    } catch { toast.error('Failed to update role'); }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title-text">User Management</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Add User</button>
      </div>

      <div className="card">
        {loading ? <div className="loading-page"><div className="spinner" /></div> : (
          <>
            <table>
              <thead>
                <tr><th>User</th><th>Email</th><th>Role</th><th>Notes</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Avatar name={u.name} size={30} color={u.active ? 'var(--accent)' : 'var(--border2)'} />
                        <span className="bold">{u.name}</span>
                      </div>
                    </td>
                    <td className="text-mono" style={{ fontSize:12 }}>{u.email}</td>
                    <td>
                      <select
                        className="filter-select" style={{ padding:'3px 8px', fontSize:11 }}
                        value={u.role} onChange={e => changeRole(u, e.target.value)}
                      >
                        <option value="agent">Agent</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ color:'var(--accent)' }}>{u.notes_count}</td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-resolved' : 'badge-high'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-dim" style={{ fontSize:12 }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination && <Pagination pagination={pagination} onChange={setPage} />}
          </>
        )}
      </div>

      {modal && (
        <Modal title="Add Team Member" onClose={() => setModal(false)}>
          <UserForm onSave={fetchUsers} onClose={() => setModal(false)} />
        </Modal>
      )}
    </>
  );
}
