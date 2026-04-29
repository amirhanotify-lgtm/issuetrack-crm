import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { StatusBadge } from '../components/Badges';
import { Avatar } from '../components/Badges';

const COLORS = ['#4f8ef7','#22c55e','#f59e0b','#a855f7','#14b8a6','#ef4444'];

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
      <p style={{ color:'var(--text3)', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  );
};

export default function ReportsPage() {
  const [summary, setSummary]   = useState(null);
  const [trend, setTrend]       = useState([]);
  const [tab, setTab]           = useState('overview');
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/reports/trend?period=monthly&months=6'),
    ]).then(([s, t]) => {
      setSummary(s.data);
      setTrend(t.data.map(r => ({
        period: new Date(r.period).toLocaleString('default', { month: 'short', year: '2-digit' }),
        Total: r.total, Resolved: r.resolved, Open: r.open,
      })));
    }).finally(() => setLoading(false));
  }, []);

  const exportFile = async (type) => {
    setExporting(type);
    try {
      const res = await api.get(`/reports/export/${type}`, { responseType: 'blob' });
      const ext  = type === 'excel' ? 'xlsx' : 'pdf';
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      a.href = url; a.download = `issuetrack_report.${ext}`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} exported!`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!summary) return null;

  const { totals, top_issues, by_category, agent_performance, by_status, by_priority } = summary;

  return (
    <>
      <div className="page-header">
        <div className="page-title-text">Reports & Analytics</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportFile('excel')} disabled={!!exporting}>
            {exporting === 'excel' ? <span className="spinner" /> : '↓'} Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportFile('pdf')} disabled={!!exporting}>
            {exporting === 'pdf' ? <span className="spinner" /> : '↓'} PDF
          </button>
        </div>
      </div>

      <div className="tabs">
        {[['overview','Overview'],['agents','Agent Performance'],['categories','Categories']].map(([id,label]) => (
          <div key={id} className={`tab${tab===id?' active':''}`} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Total Issues</div>
              <div className="metric-value">{totals.total_notes}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Open</div>
              <div className="metric-value" style={{ color:'var(--red)' }}>{totals.open_notes}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">In Progress</div>
              <div className="metric-value" style={{ color:'var(--amber)' }}>{totals.in_progress_notes}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Resolution Rate</div>
              <div className="metric-value" style={{ color:'var(--green)' }}>{totals.resolution_rate}%</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Monthly Trend</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend}>
                    <XAxis dataKey="period" tick={{ fill:'#8892a4', fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'#8892a4', fontSize:11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    <Line type="monotone" dataKey="Total"    stroke="#4f8ef7" strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="Open"     stroke="#ef4444" strokeWidth={2} dot={{ r:3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">Status Distribution</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={by_status}>
                    <XAxis dataKey="status" tick={{ fill:'#8892a4', fontSize:11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'#8892a4', fontSize:11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {by_status.map((s,i) => (
                        <Cell key={i} fill={s.status==='Resolved'?'#22c55e':s.status==='Open'?'#ef4444':'#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Top 10 Recurring Issues</div></div>
            <div className="card-body">
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th>#</th><th>Issue Title</th><th>Category</th><th>Status</th><th>Priority</th><th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {top_issues.map((n,i) => (
                    <tr key={i}>
                      <td style={{ color:'var(--text3)', width:32 }}>{i+1}</td>
                      <td><span className="bold">{n.title}</span></td>
                      <td>{n.category ? <span className="tag">{n.category}</span> : '—'}</td>
                      <td><StatusBadge status={n.status} /></td>
                      <td>{n.priority}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="progress-bar" style={{ flex:1 }}>
                            <div className="progress-fill" style={{
                              width:`${Math.round((n.counter/top_issues[0].counter)*100)}%`,
                              background: i===0?'var(--red)':i<3?'var(--amber)':'var(--accent)'
                            }} />
                          </div>
                          <strong style={{ fontSize:12, minWidth:28 }}>{n.counter}×</strong>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'agents' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Agent Performance</div></div>
          <div className="card-body">
            <div style={{ marginBottom:24 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agent_performance}>
                  <XAxis dataKey="agent_name" tick={{ fill:'#8892a4', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'#8892a4', fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TT />} />
                  <Legend wrapperStyle={{ fontSize:12 }} />
                  <Bar dataKey="total_notes" name="Total" fill="#4f8ef7" radius={[4,4,0,0]} />
                  <Bar dataKey="resolved"    name="Resolved" fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table>
              <thead>
                <tr><th>Agent</th><th>Total Notes</th><th>Open</th><th>Resolved</th><th>Resolution Rate</th><th>Avg. Resolve Time</th></tr>
              </thead>
              <tbody>
                {agent_performance.map(a => (
                  <tr key={a.agent_name}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar name={a.agent_name} size={26} />
                        <span className="bold">{a.agent_name}</span>
                      </div>
                    </td>
                    <td>{a.total_notes}</td>
                    <td style={{ color:'var(--red)' }}>{a.open}</td>
                    <td style={{ color:'var(--green)' }}>{a.resolved}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="progress-bar" style={{ width:80 }}>
                          <div className="progress-fill" style={{ width:`${a.resolution_rate||0}%`, background:'var(--green)' }} />
                        </div>
                        <span style={{ fontSize:12, color:'var(--green)' }}>{a.resolution_rate||0}%</span>
                      </div>
                    </td>
                    <td className="text-dim">{a.avg_hours_to_resolve ? `${a.avg_hours_to_resolve}h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">Issues by Category</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={by_category} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} paddingAngle={3} label={({ name, percent }) => `${name} ${Math.round(percent*100)}%`} labelLine={false}>
                    {by_category.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Category Breakdown</div></div>
            <div className="card-body">
              <table>
                <thead><tr><th>Category</th><th>Notes</th><th>Occurrences</th></tr></thead>
                <tbody>
                  {by_category.map((c,i) => (
                    <tr key={c.name}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:COLORS[i%COLORS.length], flexShrink:0 }} />
                          <span className="bold">{c.name}</span>
                        </div>
                      </td>
                      <td>{c.count}</td>
                      <td style={{ color:'var(--accent)' }}>{c.total_occurrences || c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
