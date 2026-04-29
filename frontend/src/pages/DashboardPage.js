import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../utils/api';
import { StatusBadge, PriorityBadge } from '../components/Badges';

const COLORS = ['#4f8ef7', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: 'var(--text3)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [summary, setSummary]   = useState(null);
  const [trend, setTrend]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    document.getElementById('topbar-title') && (document.getElementById('topbar-title').textContent = 'Dashboard');
    Promise.all([
      api.get('/reports/summary'),
      api.get('/reports/trend?period=monthly&months=6'),
    ]).then(([s, t]) => {
      setSummary(s.data);
      setTrend(t.data.map(r => ({
        period: new Date(r.period).toLocaleString('default', { month: 'short' }),
        Total: r.total,
        Resolved: r.resolved,
        Open: r.open,
      })));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!summary) return null;

  const { totals, top_issues, by_category, agent_performance, by_status } = summary;

  return (
    <>
      {/* Metric cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Notes</div>
          <div className="metric-value">{totals.total_notes}</div>
          <div className="metric-change up">↑ All time</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Clients</div>
          <div className="metric-value">{totals.total_clients}</div>
          <div className="metric-change up">Active accounts</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open Issues</div>
          <div className="metric-value" style={{ color: 'var(--amber)' }}>{totals.open_notes}</div>
          <div className="metric-change">Needs attention</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Resolution Rate</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>{totals.resolution_rate}%</div>
          <div className="metric-change up">↑ Target: 80%</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Issues Over Time</div>
            <span className="tag">Monthly</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <XAxis dataKey="period" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8892a4' }} />
                <Line type="monotone" dataKey="Total"    stroke="#4f8ef7" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Open"     stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Issues by Category</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={by_category} dataKey="count" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                    {by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {by_category.map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{c.name}</span>
                    <strong style={{ fontSize: 12 }}>{c.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">Top Recurring Issues</div></div>
          <div className="card-body">
            {top_issues.map((n, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, marginRight: 8 }}>{n.title}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <StatusBadge status={n.status} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{n.counter}×</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${Math.round((n.counter / top_issues[0].counter) * 100)}%`,
                    background: n.counter === top_issues[0].counter ? 'var(--red)'
                      : n.counter > 5 ? 'var(--amber)' : 'var(--accent)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Agent Performance</div></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agent_performance} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="agent_name" tick={{ fill: '#8892a4', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_notes" name="Total" fill="#4f8ef7" radius={[0, 4, 4, 0]} />
                <Bar dataKey="resolved"    name="Resolved" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="card">
        <div className="card-header"><div className="card-title">Status Breakdown</div></div>
        <div className="card-body" style={{ display: 'flex', gap: 24 }}>
          {by_status.map((s) => (
            <div key={s.status} style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--bg3)', borderRadius: 8 }}>
              <StatusBadge status={s.status} />
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{s.count}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
