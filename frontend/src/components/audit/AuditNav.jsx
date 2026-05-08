const TABS = [
  { id: 'internal', label: 'Internal Audit' },
  { id: 'external', label: 'External Audit' },
  { id: 'log',      label: 'Audit Log'      },
]

export default function AuditNav({ activeTab, onTab, userRole }) {
  const visible = TABS.filter(t =>
    !(t.id === 'internal' && userRole === 'external_auditor')
  )
  return (
    <div className="audit-nav">
      {visible.map(t => (
        <button
          key={t.id}
          className={`audit-nav-tab ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
