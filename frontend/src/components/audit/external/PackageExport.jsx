import { useState, useEffect } from 'react'

const tok = () => localStorage.getItem('cfo_token') || ''

const PACKAGE_ITEMS = [
  { key: 'include_tb',       label: 'Locked Trial Balance'        },
  { key: 'include_samples',  label: 'Sample Lists + Evidence'     },
  { key: 'include_findings', label: 'Findings Register'           },
  { key: 'include_pbc',      label: 'PBC Request List'            },
]

export default function PackageExport({ dbs }) {
  const [engagements, setEngagements] = useState([])
  const [engId,       setEngId]       = useState('')
  const [options,     setOptions]     = useState({
    include_tb: true, include_samples: true, include_findings: true, include_pbc: true,
  })
  const [status,     setStatus]      = useState('')
  const [generating, setGenerating]  = useState(false)

  useEffect(() => {
    fetch('/api/audit/engagements', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => {
        setEngagements(d.data || [])
        if (d.data?.length) setEngId(String(d.data[0].id))
      })
  }, [])

  const generate = async () => {
    if (!engId) { setStatus('error: select an engagement'); return }
    setGenerating(true); setStatus('Generating package…')
    try {
      const r = await fetch('/api/audit/export/package', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagement_id: Number(engId), ...options }),
      })
      if (!r.ok) {
        const d = await r.json()
        setStatus(`error: ${d.detail || r.status}`)
        return
      }
      const blob = await r.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url
      a.download = `audit-package-eng${engId}-${new Date().toISOString().slice(0,10)}.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setStatus('Package generated and downloaded.')
    } catch (e) { setStatus(`error: ${e.message}`) }
    finally { setGenerating(false) }
  }

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Audit Package Export</h3>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        Generate a signed ZIP containing all audit artifacts for the selected engagement,
        with a SHA-256 manifest for every included file.
      </p>

      <div className="audit-form" style={{ maxWidth: 480 }}>
        <div className="form-row">
          <label>Engagement</label>
          <select value={engId} onChange={e => setEngId(e.target.value)}>
            {engagements.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Include in package:</div>
          {PACKAGE_ITEMS.map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
              <input type="checkbox" checked={options[item.key]}
                onChange={e => setOptions(o => ({ ...o, [item.key]: e.target.checked }))} />
              {options[item.key] ? '☑' : '☐'} {item.label}
            </label>
          ))}
          <div style={{ marginTop: 4, paddingLeft: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Always included:</div>
            {['JE Listing', 'Risk Register', 'Audit Log Extract', 'SHA-256 File Manifest'].map(s => (
              <div key={s} style={{ fontSize: 12, color: 'var(--green)', paddingLeft: 8 }}>☑ {s}</div>
            ))}
          </div>
        </div>

        {status && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 8,
            background: status.startsWith('error') ? 'rgba(248,81,73,.1)' : 'rgba(122,171,58,.1)',
            color: status.startsWith('error') ? 'var(--red)' : 'var(--green)',
            border: `1px solid ${status.startsWith('error') ? 'var(--red)' : 'var(--primary)'}`,
          }}>
            {status}
          </div>
        )}

        <button className="btn primary" onClick={generate} disabled={generating || !engId}>
          {generating ? '⌛ Generating…' : '⬇ Generate Audit Package'}
        </button>
      </div>
    </div>
  )
}
