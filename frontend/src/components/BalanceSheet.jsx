import { fmt } from '../api'

const ORDER   = ['Asset', 'Liability', 'Equity', 'Retained Earnings']
const COLORS  = { Asset: '#3fb950', Liability: '#f85149', Equity: '#58a6ff', 'Retained Earnings': '#bc8cff' }

export default function BalanceSheet({ data }) {
  const rows   = data || []
  const groups = ORDER.reduce((acc, cat) => {
    acc[cat] = rows.filter(r => r.category === cat)
    return acc
  }, {})

  const totalAssets = groups['Asset']?.reduce((a, r) => a + (r.net_balance || 0), 0) || 0
  const totalLiab   = groups['Liability']?.reduce((a, r) => a + (r.net_balance || 0), 0) || 0
  const totalEquity = (groups['Equity']?.reduce((a, r) => a + (r.net_balance || 0), 0) || 0)
                    + (groups['Retained Earnings']?.reduce((a, r) => a + (r.net_balance || 0), 0) || 0)

  return (
    <div className="card">
      <div className="card-title">
        Balance Sheet
        <span>cumulative (all posted moves)</span>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Assets',      value: totalAssets, color: '#3fb950' },
          { label: 'Total Liabilities', value: totalLiab,   color: '#f85149' },
          { label: 'Total Equity',      value: totalEquity, color: '#58a6ff' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{fmt(value)}</div>
          </div>
        ))}
      </div>

      {ORDER.map(cat => {
        const catRows = groups[cat]
        if (!catRows?.length) return null
        const subtotal = catRows.reduce((a, r) => a + (r.net_balance || 0), 0)
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div className="pnl-group-header" style={{ color: COLORS[cat] }}>{cat}</div>
            <div className="table-wrap">
              <table>
                <tbody>
                  {catRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: '#8b949e', width: 100, minWidth: 80 }}>{r.account_code}</td>
                      <td style={{ textAlign: 'left' }}>{r.account_name}</td>
                      <td style={{ width: 140, fontWeight: 500 }}>{fmt(r.net_balance)}</td>
                    </tr>
                  ))}
                  <tr className="pnl-total-row">
                    <td></td>
                    <td style={{ textAlign: 'left', fontWeight: 700, color: COLORS[cat] }}>Total {cat}</td>
                    <td style={{ fontWeight: 700, color: COLORS[cat] }}>{fmt(subtotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
