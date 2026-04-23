const SECTIONS = [
  { id: 'summary', icon: '◈', label: 'Summary' },
  { id: 'details', icon: '≡', label: 'Details'  },
  { id: 'users',   icon: '⊙', label: 'Users'    },
]

export default function Sidebar({ section, onSection, user, onLogout }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/OGH.jpg" alt="OGH" />
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`sidebar-nav-item ${section === s.id ? 'active' : ''}`}
            onClick={() => onSection(s.id)}
          >
            <span className="sidebar-nav-icon">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User info + logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout} title="Sign out">↩</button>
      </div>
    </aside>
  )
}
