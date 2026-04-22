const BASE = '/api'

const get = (path) => fetch(BASE + path).then(r => {
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`)
  return r.json()
})

const cid = (company_id) => company_id ? `&company_id=${company_id}` : ''

export const api = {
  companies:    ()                              => get('/companies'),
  subCompanies: (db)                            => get(`/sub-companies?db=${db}`),
  kpis:         (db, year, month, company_id)   => get(`/kpis?db=${db}&year=${year}&month=${month}${cid(company_id)}`),
  monthlyPnl:   (db, company_id)               => get(`/monthly-pnl?db=${db}${cid(company_id)}`),
  arAging:      (db, company_id)               => get(`/ar-aging?db=${db}${cid(company_id)}`),
  apAging:      (db, company_id)               => get(`/ap-aging?db=${db}${cid(company_id)}`),
  arCustomers:  (db, company_id)               => get(`/ar-customers?db=${db}&limit=25${cid(company_id)}`),
  apVendors:    (db, company_id)               => get(`/ap-vendors?db=${db}&limit=25${cid(company_id)}`),
  pnlDetail:    (db, year, month, company_id)   => get(`/pnl-detail?db=${db}&year=${year}&month=${month}${cid(company_id)}`),
  balanceSheet: (db, company_id)               => get(`/balance-sheet?db=${db}${cid(company_id)}`),
  invoices:     (db)                            => get(`/invoices?db=${db}&limit=30`),
  cash:         (db)                            => get(`/cash?db=${db}&limit=30`),
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
