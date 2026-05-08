import { useState } from 'react'
import RiskDashboard   from './RiskDashboard'
import ControlsMonitor from './ControlsMonitor'
import JETesting       from './JETesting'
import SoDMatrix       from './SoDMatrix'
import FindingsRegister from './FindingsRegister'
import AuditPlan        from './AuditPlan'

const SECTIONS = [
  { id: 'controls',  label: '⚡ Controls Monitor' },
  { id: 'risk',      label: '⬡ Risk Dashboard'   },
  { id: 'jet',       label: '≡ JE Testing'       },
  { id: 'sod',       label: '⊘ SoD Matrix'       },
  { id: 'findings',  label: '⚑ Findings'         },
  { id: 'plan',      label: '◷ Audit Plan'        },
]

export default function InternalAudit({ dbs, selectedEntities }) {
  const [active, setActive] = useState('controls')

  return (
    <div>
      <div className="audit-section-pills">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`audit-pill ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {active === 'controls' && <ControlsMonitor dbs={dbs} selectedEntities={selectedEntities} />}
      {active === 'risk'     && <RiskDashboard   dbs={dbs} />}
      {active === 'jet'      && <JETesting        dbs={dbs} selectedEntities={selectedEntities} />}
      {active === 'sod'      && <SoDMatrix        dbs={dbs} />}
      {active === 'findings' && <FindingsRegister dbs={dbs} />}
      {active === 'plan'     && <AuditPlan        dbs={dbs} />}
    </div>
  )
}
