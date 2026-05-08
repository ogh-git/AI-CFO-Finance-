import { useState, useEffect } from 'react'
import { fmtDate } from '../../api'

const tok = () => localStorage.getItem('cfo_token') || ''
const BASE = '/api'

export default function AuditLogViewer({ dbs }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(false)
  const [offset,  setOffset]  = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [verify,  setVerify]  = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', user: '', db: '' })

  const fetchLogs = async (reset = false) => {
    setLoading(true)
    const start = reset ? 0 : offset
    const p = new URLSearchParams({ limit: 50, offset: start })
    if (filters.from) p.set('from', filters.from)
    if (filters.to)   p.set('to',   filters.to)
    if (filters.user) p.set('user', filters.user)
    if (filters.db)   p.set('db',   filters.db)
    try {
      const r = await fetch(`${BASE}/audit/log?${p}`, {
        headers: { Authorization: `Bearer ${tok()}` },
      })
      const data = await r.json()
      const rows = data.data || []
      setLogs(prev => reset ? rows : [...prev, ...rows])
      setOffset(start + rows.length)
      setHasMore(rows.length === 50)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs(true) }, [filters])

  const runVerify = async () => {
    const r = await fetch(`${BASE}/audit/log?verify=true`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
    const data = await r.json()
    setVerify(data)
  }

  const exportCsv = () => {
    const header = 'ID,Timestamp,User,Action,Target Type,Target ID,DB,IP\n'
    const rows = logs.map(r =>
      [r.id, r.ts, r.username, r.action, r.target_type, r.target_id, r.db, r.ip]
        .map(v => `"${v ?? ''}"`)
        .join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Audit Log</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={runVerify}>⛓ Verify Chain</button>
          <button className="btn" onClick={exportCsv}>↓ CSV</button>
        </div>
      </div>

      {verify && (
        <div className={`audit-verify-banner ${verify.ok ? 'ok' : 'tampered'}`}>
          {verify.ok
            ? `✓ Chain intact — ${verify.rows_checked} rows verified`
            : `✗ TAMPERED — ${verify.broken_count} broken row(s), first at ID #${verify.first_broken_id}`
          }
        </div>
      )}

      <div className="audit-filters">
        <input placeholder="From date" type="date" value={filters.from}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
        <input placeholder="To date"   type="date" value={filters.to}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        <input placeholder="Username"  value={filters.user}
          onChange={e => setFilters(f => ({ ...f, user: e.target.value }))} />
        <select value={filters.db}
          onChange={e => setFilters(f => ({ ...f, db: e.target.value }))}>
          <option value="">All DBs</option>
          <option value="ogh-live">OGH Live</option>
          <option value="77asia">77 Asia</option>
          <option value="seeenviro">SEE Enviro</option>
        </select>
        <button className="btn primary" onClick={() => fetchLogs(true)}>Filter</button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th><th>User</th><th>Action</th>
              <th>Target</th><th>DB</th><th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.ts?.slice(0, 19)}</td>
                <td>{r.username}</td>
                <td><span className="audit-action-badge">{r.action}</span></td>
                <td style={{ fontSize: 12 }}>{r.target_type} {r.target_id && `#${r.target_id}`}</td>
                <td>{r.db}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.ip}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)' }}>No log entries</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button className="btn" onClick={() => fetchLogs(false)} disabled={loading}
          style={{ marginTop: 12 }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
