import { useState, useEffect } from 'react'

const tok = () => localStorage.getItem('cfo_token') || ''
const DB_LABELS = { 'ogh-live': 'OGH Live', '77asia': '77 Asia', 'seeenviro': 'SEE Enviro' }

export default function SoDMatrix({ dbs }) {
  const [conflicts, setConflicts] = useState([])
  const [loading,   setLoading]   = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all(
      dbs.map(db =>
        fetch(`/api/audit/sod?db=${db}`, {
          headers: { Authorization: `Bearer ${tok()}` },
        }).then(r => r.json()).then(d => (d.data || []).map(r => ({ ...r, _db: db })))
      )
    )
      .then(lists => setConflicts(lists.flat()))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [dbs.join(',')])

  const markReviewed = async (id) => {
    await fetch(`/api/audit/sod/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    })
    setConflicts(prev => prev.map(c => c.id === id ? { ...c, status: 'reviewed' } : c))
  }

  const open = conflicts.filter(c => c.status === 'open')

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Segregation of Duties Matrix</h3>
        <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      <div className="sod-summary">
        <span className={`badge badge-${open.length > 0 ? 'red' : 'green'}`}>
          {open.length} open conflicts
        </span>
        <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>
          across {new Set(open.map(c => c.odoo_username)).size} users
        </span>
      </div>

      {loading ? (
        <div className="audit-loading">Loading SoD data…</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>DB</th><th>Odoo User</th><th>Conflicting Roles</th>
                <th>Detected</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map(c => (
                <tr key={c.id} style={{ opacity: c.status === 'reviewed' ? 0.5 : 1 }}>
                  <td style={{ fontSize: 12 }}>{DB_LABELS[c._db] || c._db}</td>
                  <td>{c.odoo_username || `User #${c.odoo_user_id}`}</td>
                  <td>
                    {(JSON.parse(c.conflicting_roles || '[]')).map((r, i) => (
                      <span key={i} className="badge badge-yellow" style={{ marginRight: 4 }}>{r}</span>
                    ))}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.detected_at?.slice(0, 10)}</td>
                  <td>
                    <span className={`badge badge-${c.status === 'open' ? 'red' : 'green'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.status === 'open' && (
                      <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => markReviewed(c.id)}>
                        Mark Reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {conflicts.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)' }}>
                    No SoD conflicts detected
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
