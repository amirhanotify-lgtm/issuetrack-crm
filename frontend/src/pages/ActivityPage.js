import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Pagination from '../components/Pagination';

const actionColors = {
  create_note:       'var(--green)',
  update_note:       'var(--accent)',
  delete_note:       'var(--red)',
  increment_counter: 'var(--amber)',
  resolve_note:      'var(--green)',
  update_status:     'var(--purple)',
  create_client:     'var(--teal)',
  update_client:     'var(--accent)',
  delete_client:     'var(--red)',
  create_user:       'var(--purple)',
  update_user:       'var(--accent)',
  create_category:   'var(--teal)',
  delete_category:   'var(--red)',
  login:             'var(--text3)',
  export:            'var(--teal)',
};

const actionLabel = {
  create_note:       'Created note',
  update_note:       'Updated note',
  delete_note:       'Deleted note',
  increment_counter: 'Incremented counter',
  resolve_note:      'Resolved note',
  update_status:     'Updated status',
  create_client:     'Added client',
  update_client:     'Updated client',
  delete_client:     'Deleted client',
  create_user:       'Created user',
  update_user:       'Updated user',
  create_category:   'Created category',
  delete_category:   'Deleted category',
  login:             'Logged in',
  export:            'Exported report',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}

export default function ActivityPage() {
  const [logs, setLogs]             = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/activity', { params: { page, limit: 30 } });
      setLogs(res.data.data);
      setPagination(res.data.pagination);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <>
      <div className="page-header">
        <div className="page-title-text">Activity Log</div>
        <button className="btn btn-ghost btn-sm" onClick={fetchLogs}>↻ Refresh</button>
      </div>

      <div className="card">
        {loading ? <div className="loading-page"><div className="spinner" /></div> :
          logs.length === 0 ? <div className="empty-state"><p>No activity recorded yet.</p></div> : (
            <>
              <div className="card-body">
                {logs.map((log, i) => (
                  <div key={log.id} style={{
                    display: 'flex', gap: 12, paddingBottom: 14,
                    marginBottom: 14,
                    borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div className="activity-dot" style={{ background: actionColors[log.action] || 'var(--text3)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className="bold">{log.user_name || 'System'}</span>
                          <span style={{ color: 'var(--text3)', margin: '0 6px' }}>—</span>
                          <span style={{ color: actionColors[log.action] || 'var(--text2)', fontSize: 13 }}>
                            {actionLabel[log.action] || log.action}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, marginLeft: 16 }}>
                          {timeAgo(log.created_at)}
                        </span>
                      </div>
                      {log.target_name && (
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                          <span className="tag">{log.target_type}</span>
                          <span style={{ marginLeft: 6 }}>{log.target_name}</span>
                        </div>
                      )}
                      {log.meta && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                          {JSON.stringify(log.meta)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, textAlign: 'right' }}>
                      <div>{log.user_role && <span className={`badge badge-${log.user_role}`}>{log.user_role}</span>}</div>
                      <div style={{ marginTop: 4 }}>{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination pagination={pagination} onChange={setPage} />
            </>
          )}
      </div>
    </>
  );
}
