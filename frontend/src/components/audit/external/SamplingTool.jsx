import { useState } from 'react'
import { fmt } from '../../../api'

const tok = () => localStorage.getItem('cfo_token') || ''
const ALL_DBS = ['ogh-live', '77asia', 'seeenviro']

export default function SamplingTool({ dbs }) {
  const [form, setForm] = useState({
    db: dbs[0] || 'ogh-live',
    method: 'random',
    target_size: 25,
    seed: 42,
    confidence: 0.95,
    tolerable_misstatement: 0.05,
    population_filter: { move_type: 'out_invoice', min_amount: 1000, year: new Date().getFullYear() },
  })
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [engId,   setEngId]   = useState('')
  const [engagements, setEngagements] = useState([])

  useState(() => {
    fetch('/api/audit/engagements', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => setEngagements(d.data || []))
  }, [])

  const run = async () => {
    if (!engId) { setError('Select an engagement first'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch('/api/audit/sampling/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, engagement_id: Number(engId) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Sampling failed')
      setResult(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPop = (k, v) => setForm(f => ({ ...f, population_filter: { ...f.population_filter, [k]: v } }))

  const sampleKeys = result?.items?.[0] ? Object.keys(result.items[0]).slice(0, 6) : []

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Sampling Tool</h3>
      </div>

      <div className="audit-form">
        <div className="form-row">
          <label>Engagement</label>
          <select value={engId} onChange={e => setEngId(e.target.value)}>
            <option value="">— select —</option>
            {engagements.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Database</label>
          <select value={form.db} onChange={e => set('db', e.target.value)}>
            {ALL_DBS.map(db => <option key={db} value={db}>{db}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Method</label>
          <select value={form.method} onChange={e => set('method', e.target.value)}>
            <option value="random">Random</option>
            <option value="stratified">Stratified</option>
            <option value="mus">MUS (Monetary Unit)</option>
            <option value="judgmental">Judgmental</option>
          </select>
        </div>
        <div className="form-row">
          <label>Seed</label>
          <input type="number" value={form.seed} onChange={e => set('seed', Number(e.target.value))} style={{ width: 100 }} />
        </div>
        {form.method !== 'mus' && (
          <div className="form-row">
            <label>Target size</label>
            <input type="number" value={form.target_size} onChange={e => set('target_size', Number(e.target.value))} style={{ width: 100 }} />
          </div>
        )}
        {form.method === 'mus' && (
          <>
            <div className="form-row">
              <label>Confidence</label>
              <select value={form.confidence} onChange={e => set('confidence', Number(e.target.value))}>
                <option value={0.90}>90%</option>
                <option value={0.95}>95%</option>
                <option value={0.99}>99%</option>
              </select>
            </div>
            <div className="form-row">
              <label>Tolerable misstatement %</label>
              <input type="number" step="0.01" value={form.tolerable_misstatement}
                onChange={e => set('tolerable_misstatement', Number(e.target.value))} style={{ width: 100 }} />
            </div>
          </>
        )}
        <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Population Filter</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Move type</label>
              <select value={form.population_filter.move_type} onChange={e => setPop('move_type', e.target.value)}>
                <option value="out_invoice">Customer Invoices</option>
                <option value="in_invoice">Vendor Bills</option>
                <option value="out_refund">Customer Credit Notes</option>
                <option value="in_refund">Vendor Credit Notes</option>
              </select>
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Min amount</label>
              <input type="number" value={form.population_filter.min_amount}
                onChange={e => setPop('min_amount', Number(e.target.value))} style={{ width: 100 }} />
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Year</label>
              <input type="number" value={form.population_filter.year}
                onChange={e => setPop('year', Number(e.target.value))} style={{ width: 80 }} />
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</div>}
        <button className="btn primary" onClick={run} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Running…' : '▶ Run Sample'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="audit-section-header" style={{ marginBottom: 8 }}>
            <h4>Result</h4>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span>Method: <strong>{result.method}</strong></span>
              <span>Seed: <strong>{result.seed}</strong></span>
              <span>Population: <strong>{result.population_size}</strong></span>
              <span>Sample: <strong>{result.sample_size}</strong></span>
              {result.truncated && <span style={{ color: 'var(--yellow)' }}>⚠ truncated</span>}
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {sampleKeys.map(k => <th key={k}>{k}</th>)}
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, i) => (
                  <tr key={i}>
                    {sampleKeys.map(k => <td key={k}>{String(item[k] ?? '—')}</td>)}
                    <td><input type="file" style={{ fontSize: 11 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
