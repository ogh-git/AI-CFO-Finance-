import { useState, useEffect } from 'react'
import { fmtDate } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''

const SEVERITY_COLORS = {
  critical: 'var(--red)',
  high:     '#d29922',
  medium:   'var(--yellow)',
  low:      'var(--green)',
}

const STATUS_COLORS = {
  open:        'var(--red)',
  in_progress: 'var(--yellow)',
  resolved:    'var(--purple)',
  closed:      'var(--green)',
}

const BLANK = { severity: 'medium', title: '', description: '', recommendation: '', owner: '', due_date: '' }

export default function FindingsRegister({ dbs, engagementId }) {
  const [findings,  setFindings]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(BLANK)
  const [saving,    setSaving]    = useState(false)
  const [engId,     setEngId]     = useState(engagementId || '')
  const [engagements, setEngagements] = useState([])

  useEffect(() => {
    fetch('/api/audit/engagements', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => setEngagements(d.data || []))
  }, [])

  const load = () => {
    if (!engId) return
    setLoading(true)
    fetch(`/api/audit/findings?engagement_id=${engId}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
      .then(r => r.json())
      .then(d => setFindings(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [engId])

  const save = async () => {
    if (!form.title || !engId) return
    setSaving(true)
    try {
      const r = await fetch('/api/audit/findings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, engagement_id: Number(engId) }),
      })
      const data = await r.json()
      setFindings(prev => [data, ...prev])
      setShowForm(false)
      setForm(BLANK)
    } finally { setSaving(false) }
  }

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Findings Register</h3>
        <button className="btn primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Finding'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)', marginRight: 8 }}>Engagement:</label>
        <select value={engId} onChange={e => setEngId(e.target.value)}>
          <option value="">— select —</option>
          {engagements.map(e => (
            <option key={e.id} value={e.id}>{e.title} ({e.period_from} → {e.period_to})</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="audit-form">
          <h4>New Finding</h4>
          <div className="form-row">
            <label>Severity</label>
            <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {[
            ['title',          'Title',          'text'],
            ['description',    'Description',    'textarea'],
            ['recommendation', 'Recommendation', 'textarea'],
            ['owner',          'Owner',          'text'],
            ['due_date',       'Due Date',       'date'],
          ].map(([key, label, type]) => (
            <div key={key} className="form-row">
              <label>{label}</label>
              {type === 'textarea' ? (
                <textarea value={form[key]} rows={3}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              ) : (
                <input type={type} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              )}
            </div>
          ))}
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Finding'}
          </button>
        </div>
      )}

      {loading ? <div className="audit-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th><th>Title</th><th>Owner</th>
                <th>Due Date</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {findings.map(f => (
                <tr key={f.id}>
                  <td>
                    <span style={{
                      background: SEVERITY_COLORS[f.severity], color: '#0d1117',
                      borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700,
                    }}>
                      {f.severity}
                    </span>
                  </td>
                  <td>{f.title}</td>
                  <td style={{ fontSize: 12 }}>{f.owner}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(f.due_date)}</td>
                  <td>
                    <span style={{
                      color: STATUS_COLORS[f.status] || 'var(--text2)',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
              {findings.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)' }}>No findings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
