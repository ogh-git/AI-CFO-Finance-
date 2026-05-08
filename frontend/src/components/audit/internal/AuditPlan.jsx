import { useState, useEffect } from 'react'
import { fmtDate } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''
const ALL_DBS = ['ogh-live', '77asia', 'seeenviro']

const BLANK = { type: 'internal', title: '', period_from: '', period_to: '', lead_auditor: '', dbs: [] }

export default function AuditPlan({ dbs }) {
  const [engagements, setEngagements] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(BLANK)
  const [saving,      setSaving]      = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/audit/engagements', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => setEngagements(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title) return
    setSaving(true)
    try {
      const r = await fetch('/api/audit/engagements', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dbs: form.dbs.length ? form.dbs : ALL_DBS }),
      })
      const data = await r.json()
      setEngagements(prev => [data, ...prev])
      setShowForm(false)
      setForm(BLANK)
    } finally { setSaving(false) }
  }

  const toggleDb = (db) => {
    setForm(f => ({
      ...f,
      dbs: f.dbs.includes(db) ? f.dbs.filter(d => d !== db) : [...f.dbs, db],
    }))
  }

  const STATUS_COLORS = {
    planning:   'var(--text2)',
    active:     'var(--primary)',
    completed:  'var(--green)',
    closed:     'var(--text2)',
  }

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Audit Plan &amp; Engagements</h3>
        <button className="btn primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Engagement'}
        </button>
      </div>

      {showForm && (
        <div className="audit-form">
          <h4>New Engagement</h4>
          <div className="form-row">
            <label>Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="internal">Internal Audit</option>
              <option value="external">External Audit</option>
            </select>
          </div>
          {[['title','Title','text'],['lead_auditor','Lead Auditor','text'],
            ['period_from','Period From','date'],['period_to','Period To','date']].map(([k,l,t]) => (
            <div key={k} className="form-row">
              <label>{l}</label>
              <input type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="form-row">
            <label>DBs</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ALL_DBS.map(db => (
                <label key={db} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={form.dbs.includes(db)} onChange={() => toggleDb(db)} />
                  {db}
                </label>
              ))}
            </div>
          </div>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      )}

      {loading ? <div className="audit-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th><th>Title</th><th>Period</th>
                <th>Lead</th><th>DBs</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {engagements.map(e => (
                <tr key={e.id}>
                  <td><span className={`badge badge-${e.type === 'internal' ? 'blue' : 'purple'}`}>{e.type}</span></td>
                  <td>{e.title}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.period_from} → {e.period_to}</td>
                  <td style={{ fontSize: 12 }}>{e.lead_auditor}</td>
                  <td style={{ fontSize: 11 }}>{e.dbs}</td>
                  <td><span style={{ color: STATUS_COLORS[e.status] || 'var(--text2)', fontWeight: 600, fontSize: 12 }}>{e.status}</span></td>
                </tr>
              ))}
              {engagements.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)' }}>No engagements yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
