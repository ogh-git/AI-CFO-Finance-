import { useState, useEffect } from 'react'
import { fmtDate, fmt } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''
const DB_LABELS = { 'ogh-live': 'OGH Live', '77asia': '77 Asia', 'seeenviro': 'SEE Enviro' }

function riskColor(score) {
  if (score >= 50) return 'var(--red)'
  if (score >= 25) return 'var(--yellow)'
  return 'var(--green)'
}

function DetailModal({ je, onClose }) {
  if (!je) return null
  const fields = Object.entries(je).filter(([k]) => !k.startsWith('_'))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>JE Detail — {je.ref || je.move_id}</h4>
          <button className="btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {fields.map(([k, v]) => (
            <div key={k} className="detail-row">
              <span className="detail-key">{k}</span>
              <span className="detail-val">{String(v ?? '—')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function JETesting({ dbs, selectedEntities }) {
  const [jets,     setJets]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [sortKey,  setSortKey]  = useState('risk_score')
  const [selected, setSelected] = useState(null)

  const ids = selectedEntities?.length ? selectedEntities.join(',') : ''

  useEffect(() => {
    setLoading(true)
    Promise.all(
      dbs.map(db => {
        const p = new URLSearchParams({ db })
        if (ids) p.set('company_ids', ids)
        return fetch(`/api/audit/jet?${p}`, {
          headers: { Authorization: `Bearer ${tok()}` },
        })
          .then(r => r.json())
          .then(d => (d.data || []).map(r => ({ ...r, _db: db })))
          .catch(() => [])
      })
    )
      .then(lists => {
        const merged = lists.flat().sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
        setJets(merged)
      })
      .finally(() => setLoading(false))
  }, [dbs.join(','), ids])

  const sorted = [...jets].sort((a, b) => {
    if (sortKey === 'risk_score') return (b.risk_score || 0) - (a.risk_score || 0)
    if (sortKey === 'amount')     return (b.total_amount || 0) - (a.total_amount || 0)
    if (sortKey === 'date')       return (b.date || '') > (a.date || '') ? 1 : -1
    return 0
  })

  if (loading) return <div className="audit-loading">Loading journal entries…</div>

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Journal Entry Testing</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--text2)' }}>Sort:</label>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="risk_score">Risk Score</option>
            <option value="amount">Amount</option>
            <option value="date">Date</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{jets.length} entries</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Risk</th><th>Date</th><th>Ref</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>User</th><th>Narration</th><th>DB</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((je, i) => (
              <tr key={i} onClick={() => setSelected(je)} style={{ cursor: 'pointer' }}>
                <td>
                  <span style={{
                    display: 'inline-block', width: 42, textAlign: 'center',
                    background: riskColor(je.risk_score || 0),
                    color: '#0d1117', borderRadius: 4, fontWeight: 700, fontSize: 12, padding: '2px 0',
                  }}>
                    {je.risk_score ?? '—'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{je.date}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{je.ref || je.name}</td>
                <td style={{ textAlign: 'right' }}>{fmt(je.total_amount)}</td>
                <td style={{ fontSize: 12 }}>{je.user_login || '—'}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {je.narration || '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {DB_LABELS[je._db] || je._db}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)' }}>No entries found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <DetailModal je={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
