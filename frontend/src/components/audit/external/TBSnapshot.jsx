import { useState, useEffect } from 'react'
import { fmt } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''
const ALL_DBS   = ['ogh-live', '77asia', 'seeenviro']
const DB_LABELS = { 'ogh-live': 'OGH Live', '77asia': '77 Asia', 'seeenviro': 'SEE Enviro' }

export default function TBSnapshot({ dbs, userRole }) {
  const [snapshots,  setSnapshots]  = useState([])
  const [loading,    setLoading]    = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [tbRows,     setTbRows]     = useState([])
  const [adjRows,    setAdjRows]    = useState([])
  const [showLock,   setShowLock]   = useState(false)
  const [lockForm,   setLockForm]   = useState({ db: dbs[0] || 'ogh-live', period: '' })
  const [locking,    setLocking]    = useState(false)
  const [lockError,  setLockError]  = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/audit/tb/snapshots', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => setSnapshots(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const viewSnapshot = async (snap) => {
    setSelected(snap)
    setTbRows([])
    setAdjRows([])
    const [tbRes, adjRes] = await Promise.all([
      fetch(`/api/audit/tb/snapshot/${snap.id}`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json()),
      fetch(`/api/audit/tb/post-lock-adjustments?snapshot_id=${snap.id}`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json()),
    ])
    setTbRows((tbRes.payload?.rows || []).slice(0, 200))
    setAdjRows(adjRes.adjustments || [])
  }

  const lockTB = async () => {
    if (!lockForm.period) return
    setLocking(true)
    setLockError('')
    try {
      const r = await fetch('/api/audit/tb/lock', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(lockForm),
      })
      if (!r.ok) {
        const d = await r.json()
        setLockError(d.detail || 'Lock failed')
        return
      }
      setShowLock(false)
      load()
    } finally { setLocking(false) }
  }

  const canLock = ['admin', 'audit_admin', 'internal_auditor'].includes(userRole)

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Trial Balance Snapshots</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {canLock && (
            <button className="btn primary" onClick={() => setShowLock(v => !v)}>
              {showLock ? '✕ Cancel' : '🔒 Lock TB'}
            </button>
          )}
          <button className="btn" onClick={load} disabled={loading}>↻</button>
        </div>
      </div>

      {showLock && (
        <div className="audit-form">
          <h4>Lock Trial Balance</h4>
          <div className="form-row">
            <label>DB</label>
            <select value={lockForm.db} onChange={e => setLockForm(f => ({ ...f, db: e.target.value }))}>
              {ALL_DBS.map(db => <option key={db} value={db}>{DB_LABELS[db]}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Period (YYYY-MM)</label>
            <input type="month" value={lockForm.period}
              onChange={e => setLockForm(f => ({ ...f, period: e.target.value }))} />
          </div>
          {lockError && <div style={{ color: 'var(--red)', fontSize: 12 }}>{lockError}</div>}
          <button className="btn primary" onClick={lockTB} disabled={locking}>
            {locking ? 'Locking…' : 'Confirm Lock'}
          </button>
        </div>
      )}

      {loading ? <div className="audit-loading">Loading snapshots…</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>DB</th><th>Period</th><th>Locked At</th><th>Locked By</th><th>Rows</th><th>Hash</th><th>View</th></tr>
            </thead>
            <tbody>
              {snapshots.map(s => (
                <tr key={s.id} style={{ background: selected?.id === s.id ? 'var(--surface2)' : '' }}>
                  <td>{DB_LABELS[s.db] || s.db}</td>
                  <td style={{ fontFamily: 'monospace' }}>{s.period}</td>
                  <td style={{ fontSize: 12 }}>{s.locked_at?.slice(0, 16)}</td>
                  <td style={{ fontSize: 12 }}>{s.locked_by}</td>
                  <td>{s.row_count}</td>
                  <td style={{ fontSize: 10, fontFamily: 'monospace', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.hash}>{s.hash?.slice(0, 16)}…</td>
                  <td><button className="btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => viewSnapshot(s)}>View</button></td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)' }}>No snapshots locked yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && tbRows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 8 }}>TB — {selected.db} / {selected.period}</h4>
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Code</th><th>Account</th><th>Type</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
              <tbody>
                {tbRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace' }}>{r.account_code}</td>
                    <td>{r.account_name}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>{r.account_type}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.total_debit)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.total_credit)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {adjRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ color: 'var(--yellow)', marginBottom: 8 }}>
                ⚠ Post-Lock Adjustments ({adjRows.length})
              </h4>
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Ref</th><th>Date</th><th>Posted By</th><th style={{ textAlign: 'right' }}>Amount</th><th>Narration</th></tr></thead>
                  <tbody>
                    {adjRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace' }}>{r.ref}</td>
                        <td>{r.date}</td>
                        <td>{r.posted_by}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.total_amount)}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.narration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
