import { useState, useEffect } from 'react'

const tok = () => localStorage.getItem('cfo_token') || ''
const AREAS = ['Revenue', 'Procurement', 'Payroll', 'Cash', 'Inventory', 'IT']
const DB_LABELS = { 'ogh-live': 'OGH Live', '77asia': '77 Asia', 'seeenviro': 'SEE Enviro' }

function scoreColor(score) {
  if (score >= 13) return 'red'
  if (score >= 7)  return 'yellow'
  return 'green'
}

export default function RiskDashboard({ dbs }) {
  const [data,    setData]    = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all(
      dbs.map(db =>
        fetch(`/api/audit/risk-register?db=${db}`, {
          headers: { Authorization: `Bearer ${tok()}` },
        }).then(r => r.json()).then(d => ({ db, rows: d.data || [] }))
      )
    ).then(results => {
      const map = {}
      results.forEach(({ db, rows }) => {
        map[db] = {}
        rows.forEach(r => { map[db][r.area] = r })
      })
      setData(map)
    }).finally(() => setLoading(false))
  }, [dbs.join(',')])

  if (loading) return <div className="audit-loading">Loading risk register…</div>

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Risk &amp; Controls Dashboard</h3>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          Score = Likelihood × Impact (1–5 scale)
        </span>
      </div>

      <div className="risk-legend">
        <span className="risk-chip green">Low ≤6</span>
        <span className="risk-chip yellow">Medium 7–12</span>
        <span className="risk-chip red">High ≥13</span>
      </div>

      <div className="risk-heatmap">
        <div className="risk-header-row">
          <div className="risk-area-label" />
          {dbs.map(db => (
            <div key={db} className="risk-db-header">{DB_LABELS[db] || db}</div>
          ))}
        </div>
        {AREAS.map(area => (
          <div key={area} className="risk-row">
            <div className="risk-area-label">{area}</div>
            {dbs.map(db => {
              const risk  = data[db]?.[area]
              const score = risk ? (risk.likelihood || 1) * (risk.impact || 1) : 0
              const color = risk ? scoreColor(score) : 'gray'
              return (
                <div key={db} className={`risk-cell risk-${color}`}>
                  {risk ? (
                    <>
                      <div className="risk-score">{score}</div>
                      <div className="risk-lxm">{risk.likelihood}×{risk.impact}</div>
                      <div className="risk-status">{risk.status}</div>
                    </>
                  ) : (
                    <div className="risk-status" style={{ color: 'var(--text2)' }}>—</div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
