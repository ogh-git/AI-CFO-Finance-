import { useState } from 'react'
import AuditNav       from '../components/audit/AuditNav'
import ExternalBanner from '../components/audit/ExternalBanner'
import InternalAudit  from '../components/audit/internal/InternalAudit'
import ExternalAudit  from '../components/audit/external/ExternalAudit'
import AuditLogViewer from '../components/audit/AuditLogViewer'

export default function Audit({ user, effectiveDbs, selectedEntities }) {
  const defaultTab = user?.role === 'external_auditor' ? 'external' : 'internal'
  const [auditTab, setAuditTab] = useState(defaultTab)

  return (
    <div className="audit-page">
      {user?.role === 'external_auditor' && <ExternalBanner user={user} />}

      <AuditNav
        activeTab={auditTab}
        onTab={setAuditTab}
        userRole={user?.role}
      />

      <div className="audit-content">
        {auditTab === 'internal' && (
          <InternalAudit
            dbs={effectiveDbs}
            selectedEntities={selectedEntities}
          />
        )}
        {auditTab === 'external' && (
          <ExternalAudit
            dbs={effectiveDbs}
            selectedEntities={selectedEntities}
            userRole={user?.role}
          />
        )}
        {auditTab === 'log' && (
          <AuditLogViewer dbs={effectiveDbs} />
        )}
      </div>
    </div>
  )
}
