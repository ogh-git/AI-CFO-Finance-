import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { MONTHS, fmt } from '../api'

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

export default function MonthlyChart({ data }) {
  const mapped = (data || []).map(r => ({
    ...r,
    label: `${MONTHS[(r.month || 1) - 1]} ${String(r.year || '').slice(2)}`,
  }))

  return (
    <div className="card" style={{ gridColumn: '1' }}>
      <div className="card-title">
        Monthly Revenue vs Expense
        <span>last 12 months</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={mapped} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8b949e', fontSize: 11 }}
            axisLine={{ stroke: '#30363d' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => fmt(v, true)}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#8b949e', paddingTop: 8 }}
          />
          <Bar dataKey="total_revenue" name="Revenue" fill="#3fb950" radius={[3,3,0,0]} maxBarSize={32} />
          <Bar dataKey="total_expense" name="Expense"  fill="#f85149" radius={[3,3,0,0]} maxBarSize={32} />
          <Line
            type="monotone"
            dataKey="net_profit"
            name="Net Profit"
            stroke="#58a6ff"
            strokeWidth={2}
            dot={{ r: 3, fill: '#58a6ff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
