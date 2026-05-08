import { useState } from 'react'
import PBCList              from './PBCList'
import TBSnapshot           from './TBSnapshot'
import SamplingTool         from './SamplingTool'
import ReconciliationsBinder from './ReconciliationsBinder'
import EvidenceVault        from './EvidenceVault'
import PackageExport        from './PackageExport'

const SECTIONS = [
  { id: 'pbc',             label: '📋 PBC List'         },
  { id: 'snapshot',        label: '🔒 TB Snapshot'       },
  { id: 'sampling',        label: '⚂ Sampling'          },
  { id: 'reconciliations', label: '⇌ Reconciliations'   },
  { id: 'evidence',        label: '🗂 Evidence Vault'    },
  { id: 'export',          label: '⬇ Package Export'    },
]

export default function ExternalAudit({ dbs, selectedEntities, userRole }) {
  const [active, setActive] = useState('pbc')

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

      {active === 'pbc'             && <PBCList              dbs={dbs} userRole={userRole} />}
      {active === 'snapshot'        && <TBSnapshot           dbs={dbs} userRole={userRole} />}
      {active === 'sampling'        && <SamplingTool         dbs={dbs} />}
      {active === 'reconciliations' && <ReconciliationsBinder dbs={dbs} />}
      {active === 'evidence'        && <EvidenceVault        dbs={dbs} />}
      {active === 'export'          && <PackageExport        dbs={dbs} />}
    </div>
  )
}
