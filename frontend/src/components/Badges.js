import React from 'react';

export function StatusBadge({ status }) {
  const map = {
    'Open':        'badge-open',
    'In Progress': 'badge-inprogress',
    'Resolved':    'badge-resolved',
  };
  return <span className={`badge ${map[status] || 'badge-low'}`}>{status}</span>;
}

export function PriorityBadge({ priority }) {
  const map = {
    'High':   'badge-high',
    'Medium': 'badge-medium',
    'Low':    'badge-low',
  };
  return <span className={`badge ${map[priority] || 'badge-low'}`}>{priority}</span>;
}

export function RoleBadge({ role }) {
  const map = {
    'admin':      'badge-admin',
    'supervisor': 'badge-supervisor',
    'agent':      'badge-agent',
  };
  return <span className={`badge ${map[role] || 'badge-low'}`}>{role}</span>;
}

export function Avatar({ name, size = 28, color = 'var(--accent)' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color, color: '#fff',
        display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.38,
        fontWeight: 600, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
