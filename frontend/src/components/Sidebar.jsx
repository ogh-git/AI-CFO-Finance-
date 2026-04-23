const SECTIONS = [
  { id: 'summary', icon: '◈', label: 'Summary' },
  { id: 'details', icon: '≡', label: 'Details'  },
  { id: 'users',   icon: '⊙', label: 'Users'    },
]

const DBS = [
  { id: 'ogh-live',  label: 'OGH Live' },
  { id: '77asia',    label: '77 Asia'  },
  { id: 'seeenviro', label: 'SEE Enviro' },
]

export default function Sidebar({
  section, onSection,
  selectedDbs, onDbToggle,
  subCompanies, selectedEntities, onEntityToggle,
  user, onLogout,
}) {
  const allSelected = selectedDbs.length === 0 || selectedDbs.length === DBS.length

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

      <div className="sidebar-divider" />

      {/* Company selector */}
      <div className="sidebar-section-label">Companies</div>
      <div className="sidebar-pills">
        <button
          className={`pill ${allSelected ? 'active' : ''}`}
          onClick={() => onDbToggle('all')}
        >
          All
        </button>
        {DBS.map(d => (
          <button
            key={d.id}
            className={`pill ${selectedDbs.includes(d.id) ? 'active' : ''}`}
            onClick={() => onDbToggle(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Entity selector — only when exactly 1 db selected */}
      {subCompanies.length > 0 && selectedDbs.length === 1 && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">Entities</div>
          <div className="sidebar-pills entity-pills">
            <button
              className={`pill ${selectedEntities.length === 0 ? 'active' : ''}`}
              onClick={() => onEntityToggle('all')}
            >
              All
            </button>
            {subCompanies.map(c => (
              <button
                key={c.id}
                className={`pill ${selectedEntities.includes(c.id) ? 'active' : ''}`}
                onClick={() => onEntityToggle(c.id)}
                title={c.name}
              >
                {c.name.length > 22 ? c.name.slice(0, 20) + '…' : c.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User info + logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.username}</div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout} title="Sign out">↩</button>
      </div>
    </aside>
  )
}
