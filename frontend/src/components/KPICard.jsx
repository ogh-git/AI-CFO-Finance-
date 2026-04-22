import { fmt } from '../api'

export default function KPICard({ label, value, sub, badge, color = 'blue' }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value !== undefined && value !== null ? fmt(value) : '–'}</div>
      {sub   && <div className="kpi-sub">{sub}</div>}
      {badge !== undefined && (
        <div className={`kpi-badge ${badge >= 0 ? 'pos' : 'neg'}`}>
          {badge >= 0 ? '▲' : '▼'} {Math.abs(badge).toFixed(1)}%
        </div>
      )}
    </div>
  )
}
