import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';

function CategoryForm({ categories, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', parent_id: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setLoading(true);
    try {
      await api.post('/categories', { name: form.name, parent_id: form.parent_id || null });
      toast.success('Category created');
      onSave(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    } finally { setLoading(false); }
  };

  const roots = categories.filter(c => !c.parent_id);

  return (
    <>
      <div className="form-group">
        <label className="form-label">Category Name *</label>
        <input className="form-input" value={form.name} autoFocus onChange={e => set('name', e.target.value)} placeholder="e.g. Billing Issue" />
      </div>
      <div className="form-group">
        <label className="form-label">Parent Category (optional)</label>
        <select className="form-select" value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
          <option value="">None — root category</option>
          {roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Add Category'}
        </button>
      </div>
    </>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);

  const fetchCats = async () => {
    setLoading(true);
    try { const res = await api.get('/categories'); setCategories(res.data); }
    catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCats(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try { await api.delete(`/categories/${id}`); toast.success('Deleted'); fetchCats(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const roots = categories.filter(c => !c.parent_id);
  const subs  = categories.filter(c =>  c.parent_id);

  return (
    <>
      <div className="page-header">
        <div className="page-title-text">Category Management</div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Add Category</button>
      </div>

      {loading ? <div className="loading-page"><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roots.map(root => (
            <div key={root.id} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} />
                  <span className="card-title">{root.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>root</span>
                  <span className="tag">{root.notes_count} notes</span>
                </div>
                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(root.id)}>Delete</button>
              </div>
              {subs.filter(s => s.parent_id === root.id).length > 0 && (
                <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
                  {subs.filter(s => s.parent_id === root.id).map(sub => (
                    <div key={sub.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6, marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: 'var(--text3)', fontSize: 14 }}>↳</span>
                        <span style={{ fontSize: 13 }}>{sub.name}</span>
                        <span className="tag">{sub.notes_count} notes</span>
                      </div>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDelete(sub.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {roots.length === 0 && (
            <div className="empty-state">
              <p>No categories yet. <button className="btn btn-ghost btn-xs" onClick={() => setModal(true)}>Add one</button></p>
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal title="Add Category" onClose={() => setModal(false)}>
          <CategoryForm categories={categories} onSave={fetchCats} onClose={() => setModal(false)} />
        </Modal>
      )}
    </>
  );
}
