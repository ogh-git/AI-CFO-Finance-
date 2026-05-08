import { useState, useEffect } from 'react'
import { fmtDate } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''

function ExceptionsTable({ exceptions }) {
  if (!exceptions?.length) return <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>No exceptions found.</p>
  const keys = Object.keys(exceptions[0] || {}).slice(0, 6)
  return (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead><tr>{keys.map(k => <th key={k}>{k}</th>)}</tr></thead>
        <tbody>
          {exceptions.map((row, i) => (
            <tr key={i}>{keys.map(k => <td key={k}>{String(row[k] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ControlsMonitor({ dbs, selectedEntities }) {
  const [checks,     setChecks]     = useState([])
  const [running,    setRunning]    = useState({})
  const [results,    setResults]    = useState({})
  const [expanded,   setExpanded]   = useState({})
  const [loading,    setLoading]    = useState(false)

  const db = dbs[0] || 'ogh-live'
  const ids = selectedEntities?.length ? selectedEntities.join(',') : ''

  useEffect(() => {
    setLoading(true)
    fetch(`/api/audit/controls?db=${db}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
      .then(r => r.json())
      .then(d => setChecks(d.data || []))
      .finally(() => setLoading(false))
  }, [db])

  const runCheck = async (key) => {
    setRunning(r => ({ ...r, [key]: true }))
    try {
      const p = new URLSearchParams({ db })
      if (ids) p.set('company_ids', ids)
      const r = await fetch(`/api/audit/controls/run/${key}?${p}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}` },
      })
      const data = await r.json()
      setResults(prev => ({ ...prev, [key]: data }))
      setExpanded(e => ({ ...e, [key]: true }))
      setChecks(prev => prev.map(c =>
        c.key === key
          ? { ...c, last_run: data.run_at, last_status: data.status, exceptions_count: data.count }
          : c
      ))
    } catch (e) { console.error(e) }
    finally { setRunning(r => ({ ...r, [key]: false })) }
  }

  if (loading) return <div className="audit-loading">Loading controls…</div>

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Continuous Controls Monitoring</h3>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>DB: {db}</span>
      </div>

      <div className="controls-grid">
        {checks.map(check => (
          <div key={check.key} className="control-card">
            <div className="control-header">
              <span className="control-name">{check.description}</span>
              <span className={`badge badge-${check.last_status === 'pass' ? 'green' : check.last_status === 'exceptions' ? 'red' : 'gray'}`}>
                {check.last_status || 'Never run'}
              </span>
            </div>
            {check.last_run && (
              <div className="control-meta">
                Last run: {check.last_run?.slice(0, 10)} · {check.exceptions_count ?? 0} exceptions
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" onClick={() => runCheck(check.key)} disabled={running[check.key]}>
                {running[check.key] ? 'Running…' : '▶ Run Now'}
              </button>
              {results[check.key] && (
                <button className="btn" onClick={() => setExpanded(e => ({ ...e, [check.key]: !e[check.key] }))}>
                  {expanded[check.key] ? '▲ Hide' : '▼ Show'} {results[check.key].count} exceptions
                </button>
              )}
            </div>
            {expanded[check.key] && results[check.key] && (
              <ExceptionsTable exceptions={results[check.key].exceptions} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
