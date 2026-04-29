import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { StatusBadge } from '../components/Badges';

function ClientForm({ client, onSave, onClose }) {
  const [form, setForm] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    company: client?.company || '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Name and phone are required'); return; }
    setLoading(true);
    try {
      if (client?.id) {
        await api.patch(`/clients/${client.id}`, form);
        toast.success('Client updated');
      } else {
        await api.post('/clients', form);
        toast.success('Client added');
      }
      onSave(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={form.name} autoFocus onChange={e => set('name', e.target.value)} placeholder="Jane Doe or Company Name" />
        </div>
        <div className="form-group">
          <label className="form-label">Company</label>
          <input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Phone * (must be unique)</label>
          <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1-555-0100" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="modal-footer" style={{ marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner" /> : client?.id ? 'Save Changes' : 'Add Client'}
        </button>
      </div>
    </>
  );
}

function ClientHistory({ client, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/clients/${client.id}`).then(r => setData(r.data));
  }, [client.id]);

  return (
    <>
      {!data ? <div className="loading-page"><div className="spinner" /></div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              ['Phone', <span className="text-mono" style={{ fontSize: 13 }}>{data.phone}</span>],
              ['Email', data.email || '—'],
              ['Company', data.company || '—'],
              ['Client Since', new Date(data.created_at).toLocaleDateString()],
              ['Total Issues', <span className="text-accent" style={{ fontWeight: 700 }}>{data.notes?.length || 0}</span>],
              ['Notes Count', data.notes_count],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="form-label">{label}</div>
                <div style={{ fontSize: 13 }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="form-label" style={{ marginBottom: 8 }}>Issue History</div>
          {data.notes?.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>No issues recorded.</p>
          ) : data.notes.map(n => (
            <div key={n.id} style={{
              padding: 12, background: 'var(--bg3)', borderRadius: 8,
              marginBottom: 8, borderLeft: `3px solid ${n.priority === 'High' ? 'var(--red)' : n.priority === 'Medium' ? 'var(--amber)' : 'var(--border2)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="bold" style={{ marginBottom: 3 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {n.category_name && <span className="tag" style={{ marginRight: 6 }}>{n.category_name}</span>}
                    Agent: {n.agent_name} · {new Date(n.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <StatusBadge status={n.status} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{n.counter}×</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </>
  );
}

export default function ClientsPage() {
  const { can } = useAuth();
  const [clients, setClients]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [modal, setModal]           = useState(null); // null | 'new' | {mode:'edit'|'view', client}

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients', { params: { q: search || undefined, page, limit: 20 } });
      setClients(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client and all their notes?')) return;
    try { await api.delete(`/clients/${id}`); toast.success('Client deleted'); fetchClients(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title-text">Client Directory</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'new' })}>+ Add Client</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="filter-input" style={{ maxWidth: 360, width: '100%' }}
          placeholder="Search by name, phone or email…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card">
        {loading ? <div className="loading-page"><div className="spinner" /></div> :
          clients.length === 0 ? (
            <div className="empty-state">
              <p>No clients found. <button className="btn btn-ghost btn-xs" onClick={() => setModal({ mode: 'new' })}>Add one</button></p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Phone</th><th>Email</th><th>Company</th>
                    <th>Notes</th><th>Last Activity</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id}>
                      <td><span className="bold">{c.name}</span></td>
                      <td><span className="text-mono" style={{ fontSize: 12 }}>{c.phone}</span></td>
                      <td className="text-muted">{c.email || '—'}</td>
                      <td className="text-muted">{c.company || '—'}</td>
                      <td><span className="text-accent" style={{ fontWeight: 600 }}>{c.notes_count}</span></td>
                      <td className="text-dim" style={{ fontSize: 12 }}>
                        {c.last_activity ? new Date(c.last_activity).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => setModal({ mode: 'view', client: c })}>View</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => setModal({ mode: 'edit', client: c })}>Edit</button>
                          {can('admin') && (
                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(c.id)}>Del</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination pagination={pagination} onChange={setPage} />
            </div>
          )}
      </div>

      {modal?.mode === 'new' && (
        <Modal title="Add Client" onClose={() => setModal(null)}>
          <ClientForm onSave={fetchClients} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title={`Edit: ${modal.client.name}`} onClose={() => setModal(null)}>
          <ClientForm client={modal.client} onSave={fetchClients} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'view' && (
        <Modal title={modal.client.name} onClose={() => setModal(null)} wide>
          <ClientHistory client={modal.client} onClose={() => setModal(null)} />
        </Modal>
      )}
    </>
  );
}
