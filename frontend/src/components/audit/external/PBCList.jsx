import { useState, useEffect, useRef } from 'react'
import { fmtDate } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''

const STATUS_COLORS = {
  open:        'var(--text2)',
  in_progress: 'var(--yellow)',
  submitted:   'var(--purple)',
  accepted:    'var(--green)',
  rejected:    'var(--red)',
}

export default function PBCList({ dbs, userRole }) {
  const [engagements, setEngagements] = useState([])
  const [engId,       setEngId]       = useState('')
  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [updating,    setUpdating]    = useState({})
  const fileRef = useRef()

  useEffect(() => {
    fetch('/api/audit/engagements', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => {
        const list = (d.data || []).filter(e => e.type === 'external')
        setEngagements(list)
        if (list.length) setEngId(String(list[0].id))
      })
  }, [])

  useEffect(() => {
    if (!engId) return
    setLoading(true)
    fetch(`/api/audit/pbc?engagement_id=${engId}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    }).then(r => r.json()).then(d => setItems(d.data || []))
      .finally(() => setLoading(false))
  }, [engId])

  const updateStatus = async (id, status) => {
    setUpdating(u => ({ ...u, [id]: true }))
    await fetch(`/api/audit/pbc/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    setUpdating(u => ({ ...u, [id]: false }))
  }

  const bulkImport = async (e) => {
    const file = e.target.files[0]
    if (!file || !engId) return
    const text = await file.text()
    const lines = text.split('\n').filter(Boolean).slice(1) // skip header
    const itemsData = lines.map(line => {
      const [ref, description, owner, due_date] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
      return { ref, description, owner, due_date }
    }).filter(i => i.ref)
    await fetch('/api/audit/pbc/bulk-import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagement_id: Number(engId), items: itemsData }),
    })
    // reload
    const r = await fetch(`/api/audit/pbc?engagement_id=${engId}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
    const data = await r.json()
    setItems(data.data || [])
  }

  const canChangeStatus = ['external_auditor', 'internal_auditor', 'audit_admin', 'admin'].includes(userRole)

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>PBC Request List</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={bulkImport} />
          <button className="btn" onClick={() => fileRef.current?.click()}>↑ Bulk Import CSV</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)', marginRight: 8 }}>Engagement:</label>
        <select value={engId} onChange={e => setEngId(e.target.value)}>
          <option value="">— select —</option>
          {engagements.map(e => (
            <option key={e.id} value={e.id}>{e.title} ({e.period_from})</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <span key={s} className="pbc-status-chip" style={{ borderColor: c, color: c }}>
            {items.filter(i => i.status === s).length} {s}
          </span>
        ))}
      </div>

      {loading ? <div className="audit-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th><th>Description</th><th>Owner</th>
                <th>Due</th><th>Status</th>
                {canChangeStatus && <th>Update</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.ref}</td>
                  <td style={{ maxWidth: 300 }}>{item.description}</td>
                  <td style={{ fontSize: 12 }}>{item.owner}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(item.due_date)}</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[item.status], fontWeight: 600, fontSize: 12 }}>
                      {item.status}
                    </span>
                  </td>
                  {canChangeStatus && (
                    <td>
                      <select
                        value={item.status}
                        disabled={updating[item.id]}
                        onChange={e => updateStatus(item.id, e.target.value)}
                        style={{ fontSize: 12 }}
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="submitted">submitted</option>
                        <option value="accepted">accepted</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={canChangeStatus ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text2)' }}>
                  No PBC items. Import a CSV or add items.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
