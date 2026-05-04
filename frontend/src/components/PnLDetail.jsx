import { useState } from 'react'
import { fmt, MONTHS } from '../api'

const ORDER = ['Revenue', 'Cost of Sales', 'Operating Expense', 'Depreciation']
const COLOR  = { Revenue: '#3fb950', 'Cost of Sales': '#f85149', 'Operating Expense': '#d29922', Depreciation: '#8b949e' }

export default function PnLDetail({ data, period }) {
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(ORDER.map(c => [c, true])))
  const toggle = (cat) => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))

  const rows   = data || []
  const groups = ORDER.reduce((acc, cat) => {
    acc[cat] = rows.filter(r => r.category === cat)
    return acc
  }, {})

  const revenue     = rows.filter(r => r.category === 'Revenue').reduce((a, r) => a + (r.amount || 0), 0)
  const cos         = rows.filter(r => r.category === 'Cost of Sales').reduce((a, r) => a + (r.amount || 0), 0)
  const opex        = rows.filter(r => r.category === 'Operating Expense').reduce((a, r) => a + (r.amount || 0), 0)
  const depr        = rows.filter(r => r.category === 'Depreciation').reduce((a, r) => a + (r.amount || 0), 0)
  const grossProfit = revenue - cos
  const ebit        = grossProfit - opex - depr

  const monthLabel = period ? `${MONTHS[(period.month || 1) - 1]} ${period.year}` : ''

  return (
    <div className="card pnl-section">
      <div className="card-title">
        Profit & Loss — {monthLabel}
        <span>{rows.length} accounts</span>
      </div>

      {ORDER.map(cat => {
        const catRows = groups[cat]
        if (!catRows?.length) return null
        const subtotal   = catRows.reduce((a, r) => a + (r.amount || 0), 0)
        const isCollapsed = !!collapsed[cat]
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div
              className="pnl-group-header pnl-group-toggle"
              style={{ color: COLOR[cat] }}
              onClick={() => toggle(cat)}
            >
              <span>{cat}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(subtotal)}</span>
                <span className={`pnl-chevron${isCollapsed ? ' collapsed' : ''}`}>▾</span>
              </span>
            </div>
            {!isCollapsed && (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {catRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: '#8b949e', width: 100, minWidth: 80 }}>{r.account_code}</td>
                        <td style={{ textAlign: 'left' }}>{r.account_name}</td>
                        <td style={{ width: 140, fontWeight: 500 }}>{fmt(r.amount)}</td>
                      </tr>
                    ))}
                    <tr className="pnl-total-row">
                      <td></td>
                      <td style={{ textAlign: 'left', fontWeight: 700, color: COLOR[cat] }}>Total {cat}</td>
                      <td style={{ fontWeight: 700, color: COLOR[cat] }}>{fmt(subtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      <div style={{ borderTop: '1px solid #30363d', paddingTop: 12, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {[
          { label: 'Gross Profit', value: grossProfit, color: grossProfit >= 0 ? '#3fb950' : '#f85149' },
          { label: 'EBIT',         value: ebit,        color: ebit >= 0 ? '#7aab3a' : '#f85149' },
          { label: 'Gross Margin', value: revenue ? (grossProfit / revenue * 100).toFixed(1) + '%' : '–', color: '#8b949e' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{typeof value === 'number' ? fmt(value) : value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
