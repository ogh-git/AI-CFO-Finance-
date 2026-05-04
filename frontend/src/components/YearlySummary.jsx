import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fmt } from '../api'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="item" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function yoy(curr, prev, key) {
  if (!prev || !prev[key] || prev[key] === 0) return null
  return ((curr[key] - prev[key]) / Math.abs(prev[key]) * 100).toFixed(1)
}

function GrowthBadge({ pct }) {
  if (pct === null) return <span style={{ color: '#8b949e', fontSize: 11 }}>–</span>
  const pos = Number(pct) >= 0
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
      background: pos ? 'rgba(63,185,80,.15)' : 'rgba(248,81,73,.15)',
      color: pos ? '#3fb950' : '#f85149',
    }}>
      {pos ? '+' : ''}{pct}%
    </span>
  )
}

export default function YearlySummary({ data }) {
  const rows = data || []

  if (!rows.length) {
    return (
      <div className="card" style={{ textAlign: 'center', color: '#8b949e', padding: '60px 0' }}>
        No yearly data available
      </div>
    )
  }

  const maxRev = Math.max(...rows.map(r => r.total_revenue))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Bar + Line Chart ── */}
      <div className="card">
        <div className="card-title">
          Year-over-Year Performance
          <span>{rows[0]?.year} – {rows[rows.length - 1]?.year}</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis
              dataKey="year"
              tick={{ fill: '#8b949e', fontSize: 12 }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => fmt(v, true)}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e', paddingTop: 8 }} />
            <ReferenceLine y={0} stroke="#30363d" />
            <Bar dataKey="total_revenue" name="Revenue" fill="#3fb950" radius={[4,4,0,0]} maxBarSize={48} />
            <Bar dataKey="total_expense" name="Expense"  fill="#f85149" radius={[4,4,0,0]} maxBarSize={48} />
            <Line
              type="monotone"
              dataKey="net_profit"
              name="Net Profit"
              stroke="#7aab3a"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#7aab3a', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Summary Table ── */}
      <div className="card">
        <div className="card-title">
          Annual Breakdown
          <span>YoY = year-over-year change</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Year</th>
                <th>Revenue</th>
                <th>YoY</th>
                <th>Expense</th>
                <th>YoY</th>
                <th>Net Profit</th>
                <th>YoY</th>
                <th>Margin %</th>
                <th>Rev Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const prev = rows[i - 1] || null
                const revShare = maxRev > 0 ? (r.total_revenue / maxRev * 100).toFixed(0) : 0
                return (
                  <tr key={r.year}>
                    <td style={{ fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>{r.year}</td>
                    <td style={{ color: '#3fb950', fontWeight: 600 }}>{fmt(r.total_revenue)}</td>
                    <td><GrowthBadge pct={yoy(r, prev, 'total_revenue')} /></td>
                    <td style={{ color: '#f85149' }}>{fmt(r.total_expense)}</td>
                    <td><GrowthBadge pct={yoy(r, prev, 'total_expense')} /></td>
                    <td style={{ fontWeight: 600, color: r.net_profit >= 0 ? '#7aab3a' : '#f85149' }}>
                      {fmt(r.net_profit)}
                    </td>
                    <td><GrowthBadge pct={yoy(r, prev, 'net_profit')} /></td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        color: r.margin >= 20 ? '#3fb950' : r.margin >= 0 ? '#d29922' : '#f85149',
                      }}>
                        {r.margin}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          height: 6, borderRadius: 3, background: '#3fb950',
                          width: `${revShare}%`, minWidth: 4, maxWidth: 80,
                        }} />
                        <span style={{ fontSize: 11, color: '#8b949e' }}>{revShare}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
