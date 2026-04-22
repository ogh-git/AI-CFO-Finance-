import { fmt } from '../api'

const COLS = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days']

function colClass(col, value) {
  if (col === 'Over 90 Days' && value > 0) return 'td-overdue'
  if ((col === '61-90 Days' || col === '31-60 Days') && value > 0) return 'td-warn'
  return ''
}

export default function AgingTable({ title, data, nameKey }) {
  const rows = data || []
  if (!rows.length) {
    return (
      <div className="card">
        <div className="card-title">{title}</div>
        <div style={{ textAlign: 'center', color: '#8b949e', padding: '40px 0', fontSize: 13 }}>
          No data
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-title">
        {title}
        <span>{rows.length} records</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{nameKey === 'customer' ? 'Customer' : 'Vendor'}</th>
              {COLS.map(c => <th key={c}>{c}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td title={r[nameKey]}>{r[nameKey]}</td>
                {COLS.map(c => (
                  <td key={c} className={colClass(c, r[c])}>
                    {fmt(r[c])}
                  </td>
                ))}
                <td style={{ fontWeight: 600 }}>{fmt(r.total_outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
