import { useState, useEffect } from 'react'
import { fmt } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''
const DB_LABELS = { 'ogh-live': 'OGH Live', '77asia': '77 Asia', 'seeenviro': 'SEE Enviro' }

const REC_TYPES = [
  { key: 'bank',             label: 'Bank Reconciliation'   },
  { key: 'ar_aging_vs_gl',   label: 'AR Aging vs GL'        },
  { key: 'ap_aging_vs_gl',   label: 'AP Aging vs GL'        },
  { key: 'intercompany',     label: 'Intercompany Balances' },
]

export default function ReconciliationsBinder({ dbs }) {
  const [data,     setData]     = useState({})
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    setLoading(true)
    Promise.all(
      dbs.map(db =>
        fetch(`/api/audit/reconciliations?db=${db}`, {
          headers: { Authorization: `Bearer ${tok()}` },
        }).then(r => r.json()).then(d => ({ db, recs: d.data || {} }))
      )
    ).then(results => {
      const map = {}
      results.forEach(({ db, recs }) => { map[db] = recs })
      setData(map)
    }).finally(() => setLoading(false))
  }, [dbs.join(',')])

  if (loading) return <div className="audit-loading">Loading reconciliations…</div>

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Reconciliations Binder</h3>
      </div>

      <div className="rec-grid">
        {REC_TYPES.map(rt => (
          <div key={rt.key} className="rec-card">
            <div className="rec-card-header">
              <span className="rec-card-title">{rt.label}</span>
            </div>
            {dbs.map(db => {
              const rec = data[db]?.[rt.key]
              const variance = rec?.variance || 0
              const status = rec ? (Math.abs(variance) < 0.01 ? 'reconciled' : 'variance') : 'pending'
              return (
                <div key={db} className={`rec-row rec-${status}`}>
                  <span className="rec-db">{DB_LABELS[db] || db}</span>
                  <span className="rec-status-badge">{status}</span>
                  {variance !== 0 && (
                    <span style={{ color: 'var(--red)', fontSize: 12 }}>Δ {fmt(variance)}</span>
                  )}
                  {rec?.last_reconciled && (
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>
                      {rec.last_reconciled?.slice(0, 10)}
                    </span>
                  )}
                </div>
              )
            })}
            <button
              className="btn"
              style={{ fontSize: 11, marginTop: 6, padding: '3px 8px' }}
              onClick={() => setExpanded(e => ({ ...e, [rt.key]: !e[rt.key] }))}
            >
              {expanded[rt.key] ? '▲ Hide Detail' : '▼ View Detail'}
            </button>
            {expanded[rt.key] && (
              <div className="rec-detail">
                {dbs.map(db => {
                  const rec = data[db]?.[rt.key]
                  if (!rec?.detail) return null
                  return (
                    <div key={db} style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{DB_LABELS[db]}</div>
                      <table className="data-table" style={{ fontSize: 11 }}>
                        <thead><tr>{Object.keys(rec.detail[0] || {}).map(k => <th key={k}>{k}</th>)}</tr></thead>
                        <tbody>
                          {rec.detail.map((row, i) => (
                            <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v ?? '—')}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
