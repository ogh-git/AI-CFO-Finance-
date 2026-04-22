const BASE = '/api'

const get = (path) => fetch(BASE + path).then(r => {
  if (!r.ok) throw new Error(`API error ${r.status}: ${path}`)
  return r.json()
})

export const api = {
  companies:   ()                    => get('/companies'),
  kpis:        (db, year, month)     => get(`/kpis?db=${db}&year=${year}&month=${month}`),
  monthlyPnl:  (db)                  => get(`/monthly-pnl?db=${db}`),
  arAging:     (db)                  => get(`/ar-aging?db=${db}`),
  apAging:     (db)                  => get(`/ap-aging?db=${db}`),
  arCustomers: (db)                  => get(`/ar-customers?db=${db}&limit=25`),
  apVendors:   (db)                  => get(`/ap-vendors?db=${db}&limit=25`),
  pnlDetail:   (db, year, month)     => get(`/pnl-detail?db=${db}&year=${year}&month=${month}`),
  balanceSheet:(db)                  => get(`/balance-sheet?db=${db}`),
  invoices:    (db)                  => get(`/invoices?db=${db}&limit=30`),
  cash:        (db)                  => get(`/cash?db=${db}&limit=30`),
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
