import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { StatusBadge, PriorityBadge, Avatar } from '../components/Badges';

const STATUSES   = ['Open', 'In Progress', 'Resolved'];
const PRIORITIES = ['Low', 'Medium', 'High'];

function NoteForm({ note, clients, categories, agents, onSave, onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: note?.title || '',
    client_id: note?.client_id || '',
    category_id: note?.category_id || '',
    agent_id: note?.agent_id || user?.id || '',
    priority: note?.priority || 'Medium',
    status: note?.status || 'Open',
    description: note?.description || '',
  });
  const [dupes, setDupes] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const searchDupes = useCallback(async (val) => {
    if (val.length < 4 || note?.id) { setDupes([]); return; }
    try {
      const res = await api.get(`/notes/search?q=${encodeURIComponent(val)}`);
      setDupes(res.data);
    } catch {}
  }, [note?.id]);

  const handleTitleChange = (val) => {
    set('title', val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchDupes(val), 350);
  };

  const handleIncrement = async (id) => {
    await api.post(`/notes/${id}/increment`);
    toast.success('Counter incremented!');
    setDupes([]);
    onClose();
    onSave();
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.client_id) {
      toast.error('Title and client are required'); return;
    }
    setLoading(true);
    try {
      if (note?.id) {
        await api.patch(`/notes/${note.id}`, form);
        toast.success('Note updated');
      } else {
        await api.post('/notes', form);
        toast.success('Note created');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    } finally {
      setLoading(false);
    }
  };

  const rootCats = categories.filter(c => !c.parent_id);
  const subCats  = categories.filter(c => c.parent_id);

  return (
    <>
      {dupes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 8 }}>
            ⚠ Similar existing issues — increment instead of creating a duplicate?
          </p>
          {dupes.map(d => (
            <div key={d.id} className="dup-banner" onClick={() => handleIncrement(d.id)}>
              <strong>"{d.title}"</strong> — {d.counter}× occurrences · {d.status}
              <span style={{ float: 'right', fontSize: 11 }}>Click to +1 →</span>
            </div>
          ))}
        </div>
      )}
      <div className="form-row">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Describe the issue type…" autoFocus />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Client *</label>
          <select className="form-select" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
            <option value="">Uncategorized</option>
            {rootCats.map(c => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (general)</option>
                {subCats.filter(s => s.parent_id === c.id).map(s => (
                  <option key={s.id} value={s.id}>  {s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={3} value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Optional details…" />
      </div>
    </>
  );
}

export default function NotesPage() {
  const { user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [notes, setNotes]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [clients, setClients]       = useState([]);
  const [categories, setCategories] = useState([]);
  const [agents, setAgents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // null | 'new' | note object

  const [filters, setFilters] = useState({
    status: '', priority: '', category_id: '',
    q: searchParams.get('q') || '',
    page: 1,
  });

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await api.get('/notes', { params });
      setNotes(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    Promise.all([
      api.get('/clients?limit=200'),
      api.get('/categories'),
      can('admin', 'supervisor') ? api.get('/users') : Promise.resolve({ data: [user] }),
    ]).then(([c, cat, u]) => {
      setClients(c.data.data || c.data);
      setCategories(cat.data);
      setAgents(Array.isArray(u.data) ? u.data : [u.data]);
    });
    // Open new modal if ?new=1
    if (searchParams.get('new')) {
      setModal('new');
      setSearchParams({});
    }
  }, []);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  const handleIncrement = async (id) => {
    try {
      await api.post(`/notes/${id}/increment`);
      toast.success('Counter incremented');
      fetchNotes();
    } catch {
      toast.error('Failed to increment');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/notes/${id}`);
      toast.success('Note deleted');
      fetchNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleCycleStatus = async (note) => {
    const next = STATUSES[(STATUSES.indexOf(note.status) + 1) % STATUSES.length];
    try {
      await api.patch(`/notes/${note.id}`, { status: next });
      toast.success(`Status → ${next}`);
      fetchNotes();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title-text">Notes / Issues</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ New Note</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
          <option value="">All Priority</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filters.category_id} onChange={e => setFilter('category_id', e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.parent_name ? `  ${c.name}` : c.name}</option>)}
        </select>
        <input className="filter-input" placeholder="Search title or description…"
          value={filters.q} onChange={e => setFilter('q', e.target.value)} />
        {Object.values(filters).some(v => v && v !== 1) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '', category_id: '', q: '', page: 1 })}>
            Clear filters
          </button>
        )}
        {pagination && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{pagination.total} results</span>}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
            </svg>
            <p>No notes found. <button className="btn btn-ghost btn-xs" onClick={() => setModal('new')}>Create one</button></p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Client</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Counter</th>
                  <th>Agent</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.map(n => (
                  <tr key={n.id}>
                    <td>
                      <div className="bold" style={{ maxWidth: 220 }}>{n.title}</div>
                      {n.description && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.description}
                        </div>
                      )}
                    </td>
                    <td>{n.client_name || '—'}</td>
                    <td>{n.category_name ? <span className="tag">{n.category_name}</span> : '—'}</td>
                    <td><PriorityBadge priority={n.priority} /></td>
                    <td>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => handleCycleStatus(n)} title="Click to cycle status">
                        <StatusBadge status={n.status} />
                      </button>
                    </td>
                    <td>
                      <button className="counter-btn" onClick={() => handleIncrement(n.id)} title="Increment occurrence counter">
                        +1 <span className="count">{n.counter}</span>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar name={n.agent_name} size={24} />
                        <span style={{ fontSize: 12 }}>{n.agent_name?.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="text-dim" style={{ fontSize: 12 }}>
                      {new Date(n.updated_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setModal(n)}>Edit</button>
                        {can('admin', 'supervisor') && (
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(n.id)}>Del</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={pagination} onChange={p => setFilters(f => ({ ...f, page: p }))} />
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'new' ? 'New Issue Note' : `Edit Note #${modal.id}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => document.getElementById('note-save-btn').click()}>
                {modal === 'new' ? 'Create Note' : 'Save Changes'}
              </button>
            </>
          }
        >
          <NoteFormWrapper
            note={modal === 'new' ? null : modal}
            clients={clients}
            categories={categories}
            agents={agents}
            onSave={fetchNotes}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </>
  );
}

// Wrapper to expose save button via hidden trigger
function NoteFormWrapper(props) {
  const { user } = useAuth();
  const { note, clients, categories, agents, onSave, onClose } = props;
  const [form, setForm] = useState({
    title: note?.title || '',
    client_id: note?.client_id || '',
    category_id: note?.category_id || '',
    priority: note?.priority || 'Medium',
    status: note?.status || 'Open',
    description: note?.description || '',
  });
  const [dupes, setDupes] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const searchDupes = async (val) => {
    if (val.length < 4 || note?.id) { setDupes([]); return; }
    try {
      const res = await api.get(`/notes/search?q=${encodeURIComponent(val)}`);
      setDupes(res.data);
    } catch {}
  };

  const handleTitleChange = (val) => {
    set('title', val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchDupes(val), 350);
  };

  const handleIncrement = async (id) => {
    await api.post(`/notes/${id}/increment`);
    toast.success('Counter incremented!');
    setDupes([]);
    onClose(); onSave();
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.client_id) { toast.error('Title and client are required'); return; }
    setLoading(true);
    try {
      if (note?.id) {
        await api.patch(`/notes/${note.id}`, form);
        toast.success('Note updated');
      } else {
        await api.post('/notes', form);
        toast.success('Note created');
      }
      onSave(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    } finally { setLoading(false); }
  };

  const rootCats = categories.filter(c => !c.parent_id);
  const subCats  = categories.filter(c =>  c.parent_id);

  return (
    <>
      {dupes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 8 }}>
            ⚠ Similar existing issue — increment instead of creating a duplicate?
          </p>
          {dupes.map(d => (
            <div key={d.id} className="dup-banner" onClick={() => handleIncrement(d.id)}>
              <strong>"{d.title}"</strong> — {d.counter}× occurrences · {d.status}
              <span style={{ float: 'right', fontSize: 11 }}>Click to +1 →</span>
            </div>
          ))}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Title *</label>
        <input className="form-input" value={form.title} autoFocus
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Describe the issue type…" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Client *</label>
          <select className="form-select" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
            <option value="">Uncategorized</option>
            {rootCats.map(c => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (general)</option>
                {subCats.filter(s => s.parent_id === c.id).map(s => (
                  <option key={s.id} value={s.id}>↳ {s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={3} value={form.description}
          onChange={e => set('description', e.target.value)} placeholder="Optional details…" />
      </div>
      <button id="note-save-btn" style={{ display: 'none' }} onClick={handleSubmit} />
    </>
  );
}
