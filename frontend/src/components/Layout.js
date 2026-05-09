import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const IconDashboard = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconClients = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconNotes = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
  </svg>
);
const IconReports = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
);
const IconActivity = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconUsers = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197L15 21z"/>
  </svg>
);
const IconTags = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
  </svg>
);
const IconInvite = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197L15 21z"/>
    <path d="M17 13l4 4m0 0l-4 4m4-4h-6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSearch = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
);
const IconPlus = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/notes?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>IssueTrack CRM</h1>
          <span>v1.0 · enterprise</span>
        </div>

        <div className="sidebar-section">Overview</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconDashboard /> Dashboard
        </NavLink>

        <div className="sidebar-section">Core</div>
        <NavLink to="/clients" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconClients /> Clients
        </NavLink>
        <NavLink to="/notes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconNotes /> Notes / Issues
        </NavLink>

        <div className="sidebar-section">Analytics</div>
        {can('admin', 'supervisor') && (
          <NavLink to="/reports" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <IconReports /> Reports
          </NavLink>
        )}
        <NavLink to="/activity" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <IconActivity /> Activity Log
        </NavLink>

        {can('admin') && (
          <>
            <div className="sidebar-section">Admin</div>
            <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <IconUsers /> User Management
            </NavLink>
            <NavLink to="/invite-users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <IconInvite /> Invite Users
            </NavLink>
            <NavLink to="/categories" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <IconTags /> Categories
            </NavLink>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="user-card" onClick={logout} title="Click to sign out">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="uname">{user?.name}</div>
              <div className="urole">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title" id="topbar-title">Dashboard</div>
          <div className="search-bar">
            <IconSearch />
            <input
              placeholder="Search notes… (Enter)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/notes?new=1')}>
            <IconPlus /> New Note
          </button>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
