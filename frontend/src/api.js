const BASE = '/api'

const tok = () => localStorage.getItem('cfo_token') || ''

const get = (path) => fetch(BASE + path, {
  headers: { Authorization: `Bearer ${tok()}` }
}).then(r => {
  if (r.status === 401) { localStorage.removeItem('cfo_token'); window.location.reload(); return }
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`)
  return r.json()
})

const post = (path, body) => fetch(BASE + path, {
  method: 'POST',
  headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => {
  if (!r.ok) return r.json().then(e => { throw new Error(e.detail || `Error ${r.status}`) })
  return r.json()
})

const patch = (path, body) => fetch(BASE + path, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })

const del = (path) => fetch(BASE + path, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${tok()}` },
}).then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })

// company_ids: array of ints or null → "1,2,8" or ""
const cids = (ids) => ids && ids.length ? `&company_ids=${ids.join(',')}` : ''

export const api = {
  // auth
  login:        (username, password)            => post('/auth/login', { username, password }),
  me:           ()                              => get('/auth/me'),
  listUsers:    ()                              => get('/auth/users'),
  createUser:   (body)                          => post('/auth/users', body),
  updateUser:   (id, body)                      => patch(`/auth/users/${id}`, body),
  deleteUser:   (id)                            => del(`/auth/users/${id}`),

  // data
  companies:     ()                              => get('/companies'),
  subCompanies:  (db)                            => get(`/sub-companies?db=${db}`),
  kpis:          (db, year, month, ids)          => get(`/kpis?db=${db}&year=${year}&month=${month}${cids(ids)}`),
  monthlyPnl:    (db, ids)                       => get(`/monthly-pnl?db=${db}${cids(ids)}`),
  yearlySummary: (db, ids)                       => get(`/yearly-summary?db=${db}${cids(ids)}`),
  arAging:       (db, ids)                       => get(`/ar-aging?db=${db}${cids(ids)}`),
  apAging:       (db, ids)                       => get(`/ap-aging?db=${db}${cids(ids)}`),
  arCustomers:   (db, ids)                       => get(`/ar-customers?db=${db}&limit=25${cids(ids)}`),
  apVendors:     (db, ids)                       => get(`/ap-vendors?db=${db}&limit=25${cids(ids)}`),
  pnlDetail:     (db, year, month, ids)          => get(`/pnl-detail?db=${db}&year=${year}&month=${month}${cids(ids)}`),
  balanceSheet:  (db, ids)                       => get(`/balance-sheet?db=${db}${cids(ids)}`),
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const fmt = (n, compact = false) => {
  if (n === null || n === undefined) return '–'
  const v = Number(n)
  if (compact) {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
    return v.toFixed(0)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)
}

export const fmtDate = (s) => {
  if (!s) return '–'
  return new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}
