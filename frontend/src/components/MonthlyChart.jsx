import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid,
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

export default function MonthlyChart({ data, selectedMonth, onBarClick }) {
  const mapped = (data || []).map(r => ({
    ...r,
    label: `${MONTHS[(r.month || 1) - 1]} ${String(r.year || '').slice(2)}`,
  }))

  const handleClick = (barData) => {
    if (onBarClick && barData?.month && barData?.year) {
      onBarClick(Number(barData.month), Number(barData.year))
    }
  }

  const isActive = (entry) =>
    !selectedMonth ||
    (Number(entry.month) === selectedMonth.month && Number(entry.year) === selectedMonth.year)

  const hasSelection = !!selectedMonth

  return (
    <div className="card" style={{ gridColumn: '1' }}>
      <div className="card-title">
        Monthly Revenue vs Expense
        {hasSelection ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--primary)' }}>
              {MONTHS[selectedMonth.month - 1]} {selectedMonth.year}
            </span>
            <button
              onClick={() => onBarClick(null, null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text2)', fontSize: 13, padding: '0 2px',
                lineHeight: 1,
              }}
              title="Clear selection"
            >×</button>
          </span>
        ) : (
          <span>click a bar to filter</span>
        )}
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e', paddingTop: 8 }} />

          <Bar
            dataKey="total_revenue"
            name="Revenue"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {mapped.map((entry, i) => (
              <Cell key={i} fill="#3fb950" fillOpacity={isActive(entry) ? 1 : 0.2} />
            ))}
          </Bar>

          <Bar
            dataKey="total_expense"
            name="Expense"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {mapped.map((entry, i) => (
              <Cell key={i} fill="#f85149" fillOpacity={isActive(entry) ? 1 : 0.2} />
            ))}
          </Bar>

          <Line
            type="monotone"
            dataKey="net_profit"
            name="Net Profit"
            stroke="#58a6ff"
            strokeWidth={2}
            dot={{ r: 3, fill: '#58a6ff' }}
            strokeOpacity={1}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
