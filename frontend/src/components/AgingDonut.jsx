import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fmt } from '../api'

const COLORS   = ['#3fb950', '#d29922', '#e3b341', '#f0883e', '#f85149']
const BUCKETS  = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days']
const KEYS     = ['current_bucket', 'bucket_1_30', 'bucket_31_60', 'bucket_61_90', 'bucket_over_90']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="custom-tooltip">
      <div className="label">{name}</div>
      <div className="item"><span>Amount</span><span>{fmt(value)}</span></div>
    </div>
  )
}

const renderLabel = ({ cx, cy, total }) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#e6edf3">
    <tspan x={cx} dy="-8" fontSize="11" fill="#8b949e">Total</tspan>
    <tspan x={cx} dy="22" fontSize="16" fontWeight="700">{fmt(total, true)}</tspan>
  </text>
)

export default function AgingDonut({ title, data }) {
  const slices = BUCKETS.map((name, i) => ({
    name,
    value: data ? Math.max(0, Number(data[KEYS[i]] || 0)) : 0,
  })).filter(s => s.value > 0)

  const total = slices.reduce((a, s) => a + s.value, 0)

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {total === 0 ? (
        <div style={{ textAlign: 'center', color: '#8b949e', padding: '60px 0', fontSize: 13 }}>
          No outstanding balance
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={slices}
              cx="50%" cy="50%"
              innerRadius={65} outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              label={({ cx, cy }) => renderLabel({ cx, cy, total })}
              labelLine={false}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#8b949e' }}
              formatter={(v, { payload }) => `${v}: ${fmt(payload.value, true)}`}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
