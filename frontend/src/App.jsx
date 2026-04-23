import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmt, MONTHS } from './api'
import Login         from './pages/Login'
import Sidebar       from './components/Sidebar'
import UserManager   from './components/UserManager'
import KPICard       from './components/KPICard'
import MonthlyChart  from './components/MonthlyChart'
import AgingDonut    from './components/AgingDonut'
import AgingTable    from './components/AgingTable'
import PnLDetail     from './components/PnLDetail'
import BalanceSheet  from './components/BalanceSheet'
import ChatPanel     from './components/ChatPanel'
import YearlySummary from './components/YearlySummary'
import Transactions  from './components/Transactions'

const ALL_DBS = ['ogh-live', '77asia', 'seeenviro']
const DB_LABELS = { 'ogh-live': 'OGH Live', '77asia': '77 Asia', 'seeenviro': 'SEE Enviro' }

function mergeKpis(list) {
  const sum = (k) => list.reduce((a, x) => a + (Number(x?.[k]) || 0), 0)
  const rev      = sum('month_revenue')
  const exp      = sum('month_expense')
  const profit   = rev - exp
  const ytdRev   = sum('ytd_revenue')
  const ytdExp   = sum('ytd_expense')
  const ytdProfit = ytdRev - ytdExp
  return {
    month_revenue: rev, month_expense: exp, month_profit: profit,
    month_margin:  rev ? ((profit / rev) * 100).toFixed(1) : '0.0',
    ytd_revenue: ytdRev, ytd_expense: ytdExp, ytd_profit: ytdProfit,
    ytd_margin:  ytdRev ? ((ytdProfit / ytdRev) * 100).toFixed(1) : '0.0',
    total_ar: sum('total_ar'), total_ap: sum('total_ap'),
    overdue_ar: sum('overdue_ar'), overdue_ap: sum('overdue_ap'),
  }
}

function mergeMonthlyPnl(lists) {
  const map = {}
  lists.flat().forEach(row => {
    const key = row.month
    if (!map[key]) map[key] = { ...row, revenue: 0, expense: 0, profit: 0 }
    map[key].revenue += Number(row.revenue) || 0
    map[key].expense += Number(row.expense) || 0
    map[key].profit  += Number(row.profit)  || 0
  })
  return Object.values(map).sort((a, b) => a.month < b.month ? -1 : 1)
}

function mergeAging(list) {
  const sum = (k) => list.reduce((a, x) => a + (Number(x?.[k]) || 0), 0)
  return {
    current_bucket: sum('current_bucket'), bucket_1_30: sum('bucket_1_30'),
    bucket_31_60:   sum('bucket_31_60'),   bucket_61_90: sum('bucket_61_90'),
    bucket_over_90: sum('bucket_over_90'),
  }
}

function mergeTableRows(lists, nameKey) {
  const map = {}
  lists.flat().forEach(row => {
    const key = row[nameKey]
    if (!map[key]) map[key] = { ...row, total: 0 }
    map[key].total += Number(row.total) || 0
  })
  return Object.values(map).sort((a, b) => b.total - a.total)
}

function mergePnlDetail(lists) {
  const map = {}
  lists.flat().forEach(row => {
    const key = `${row.account_code}|${row.account_name}`
    if (!map[key]) map[key] = { ...row, amount: 0 }
    map[key].amount += Number(row.amount || row.balance) || 0
  })
  return Object.values(map)
}

function mergeYearlySummary(lists) {
  const map = {}
  lists.flat().forEach(row => {
    const key = row.year
    if (!map[key]) map[key] = { year: key, total_revenue: 0, total_expense: 0 }
    map[key].total_revenue += Number(row.total_revenue) || 0
    map[key].total_expense += Number(row.total_expense) || 0
  })
  return Object.values(map).sort((a, b) => a.year - b.year).map(r => ({
    ...r, net_profit: r.total_revenue - r.total_expense,
    margin: r.total_revenue ? +((r.total_revenue - r.total_expense) / r.total_revenue * 100).toFixed(1) : 0,
  }))
}

function mergeBalanceSheet(lists) {
  const map = {}
  lists.flat().forEach(row => {
    const key = `${row.account_type}|${row.account_code}|${row.account_name}`
    if (!map[key]) map[key] = { ...row, balance: 0 }
    map[key].balance += Number(row.balance) || 0
  })
  return Object.values(map)
}

const INTERVALS   = [{ v: 30, l: '30 sec' }, { v: 60, l: '1 min' }, { v: 300, l: '5 min' }, { v: 900, l: '15 min' }]
const DETAIL_TABS = ['P&L Detail', 'Balance Sheet', 'Year Summary']
const now = new Date()

export default function App() {
  // Auth
  const [user,        setUser]        = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [section,     setSection]     = useState('summary')

  // Company / entity selection ([] = all selected)
  const [selectedDbs,      setSelectedDbs]      = useState([])
  const [subCompanies,     setSubCompanies]     = useState([])
  const [selectedEntities, setSelectedEntities] = useState([])

  // Period
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // Data
  const [kpis,          setKpis]          = useState(null)
  const [monthlyPnl,    setMonthlyPnl]    = useState([])
  const [arAging,       setArAging]       = useState(null)
  const [apAging,       setApAging]       = useState(null)
  const [arCustomers,   setArCustomers]   = useState([])
  const [apVendors,     setApVendors]     = useState([])
  const [yearlySummary, setYearlySummary] = useState([])
  const [pnlDetail,     setPnlDetail]     = useState([])
  const [pnlPeriod,     setPnlPeriod]     = useState(null)
  const [balanceSheet,  setBalanceSheet]  = useState([])
  const [detailTab,     setDetailTab]     = useState('P&L Detail')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [autoRefresh,   setAutoRefresh]   = useState(true)
  const [interval,      setInterval_]     = useState(300)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [exportOpen,    setExportOpen]    = useState(false)
  const [chatOpen,      setChatOpen]      = useState(false)
  const timerRef = useRef(null)

  // Verify stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('cfo_token')
    if (!token) { setAuthChecked(true); return }
    api.me()
      .then(u  => { setUser(u); setAuthChecked(true) })
      .catch(() => { localStorage.removeItem('cfo_token'); setAuthChecked(true) })
  }, [])

  const handleLogout = () => { localStorage.removeItem('cfo_token'); setUser(null) }

  const handleDbToggle = (id) => {
    if (id === 'all') { setSelectedDbs([]); setSelectedEntities([]); return }
    setSelectedDbs(prev => {
      const next = prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
      if (next.length === 0 || next.length === ALL_DBS.length) return []
      return next
    })
    setSelectedEntities([])
  }

  const handleEntityToggle = (id) => {
    if (id === 'all') { setSelectedEntities([]); return }
    setSelectedEntities(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  // Load sub-companies when exactly 1 db is selected
  useEffect(() => {
    const effectiveDbs = selectedDbs.length === 0 ? ALL_DBS : selectedDbs
    if (effectiveDbs.length !== 1) { setSubCompanies([]); return }
    api.subCompanies(effectiveDbs[0])
      .then(res => { const list = res.data || []; setSubCompanies(list.length > 1 ? list : []) })
      .catch(() => setSubCompanies([]))
  }, [selectedDbs])

  const downloadExport = async (type) => {
    const effectiveDbs = selectedDbs.length === 0 ? ALL_DBS : selectedDbs
    const db = effectiveDbs[0]
    const p = new URLSearchParams({ db, year, month })
    if (selectedEntities.length > 0) p.set('company_ids', selectedEntities.join(','))
    setExportOpen(false)
    try {
      const token = localStorage.getItem('cfo_token') || ''
      const r = await fetch(`/api/export/${type}?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) {
        const msg = await r.text().catch(() => r.status)
        throw new Error(`Export failed (${r.status}): ${msg}`)
      }
      const blob = await r.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `finance-export-${db}-${year}-${String(month).padStart(2, '0')}.${type === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) { setError(e.message) }
  }

  // Serialize arrays to primitives to avoid stale-closure / reference issues in useCallback
  const selectedDbsKey      = selectedDbs.join(',')
  const selectedEntitiesKey = selectedEntities.join(',')

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    const effectiveDbs = selectedDbsKey === '' || selectedDbsKey.split(',').length === ALL_DBS.length
      ? ALL_DBS : selectedDbsKey.split(',')
    const entityIds = effectiveDbs.length === 1 && selectedEntitiesKey
      ? selectedEntitiesKey.split(',').map(Number) : null
    try {
      if (effectiveDbs.length > 1) {
        const results = await Promise.all(
          effectiveDbs.map(d => Promise.all([
            api.kpis(d, year, month, null),
            api.monthlyPnl(d, null),
            api.arAging(d, null),
            api.apAging(d, null),
            api.arCustomers(d, null),
            api.apVendors(d, null),
            api.pnlDetail(d, year, month, null),
            api.balanceSheet(d, null),
            api.yearlySummary(d, null),
          ]))
        )
        setKpis(mergeKpis(results.map(r => r[0])))
        setMonthlyPnl(mergeMonthlyPnl(results.map(r => r[1].data || [])))
        setArAging(mergeAging(results.map(r => r[2])))
        setApAging(mergeAging(results.map(r => r[3])))
        setArCustomers(mergeTableRows(results.map(r => r[4].data || []), 'customer'))
        setApVendors(mergeTableRows(results.map(r => r[5].data || []), 'vendor'))
        setPnlDetail(mergePnlDetail(results.map(r => r[6].data || [])))
        setPnlPeriod(results[0]?.[6]?.period || null)
        setBalanceSheet(mergeBalanceSheet(results.map(r => r[7].data || [])))
        setYearlySummary(mergeYearlySummary(results.map(r => r[8].data || [])))
      } else {
        const db = effectiveDbs[0]
        const [kpisData, pnlData, arA, apA, arC, apV, pnlD, bs, yrly] = await Promise.all([
          api.kpis(db, year, month, entityIds),
          api.monthlyPnl(db, entityIds),
          api.arAging(db, entityIds),
          api.apAging(db, entityIds),
          api.arCustomers(db, entityIds),
          api.apVendors(db, entityIds),
          api.pnlDetail(db, year, month, entityIds),
          api.balanceSheet(db, entityIds),
          api.yearlySummary(db, entityIds),
        ])
        setKpis(kpisData)
        setMonthlyPnl(pnlData.data || [])
        setArAging(arA)
        setApAging(apA)
        setArCustomers(arC.data || [])
        setApVendors(apV.data || [])
        setPnlDetail(pnlD.data || [])
        setPnlPeriod(pnlD.period || null)
        setBalanceSheet(bs.data || [])
        setYearlySummary(yrly.data || [])
      }
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDbsKey, selectedEntitiesKey, year, month])

  useEffect(() => { if (user) fetchAll() }, [fetchAll, user])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!autoRefresh || !user) return
    timerRef.current = window.setInterval(fetchAll, interval * 1000)
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, interval, fetchAll, user])

  const profit    = kpis ? kpis.month_profit : null
  const ytdProfit = kpis ? kpis.ytd_profit   : null
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  const effectiveDbs = selectedDbs.length === 0 ? ALL_DBS : selectedDbs
  const dbLabel = effectiveDbs.length === ALL_DBS.length
    ? 'All Companies'
    : effectiveDbs.map(d => DB_LABELS[d]).join(', ')

  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b949e', fontSize: 14 }}>
      Loading…
    </div>
  )
  if (!user) return <Login onLogin={setUser} />

  return (
    <div className="app-layout">
      <Sidebar
        section={section}
        onSection={setSection}
        user={user}
        onLogout={handleLogout}
      />

      <div className="main-content">

        {(section === 'summary' || section === 'details' || section === 'transactions') && (
          <div className="company-bar">
            <div className="company-bar-pills">
              <button
                className={`company-tab ${selectedDbs.length === 0 ? 'active' : ''}`}
                onClick={() => handleDbToggle('all')}
              >All Companies</button>
              {[
                { id: 'ogh-live',  label: 'OGH Live'   },
                { id: '77asia',    label: '77 Asia'     },
                { id: 'seeenviro', label: 'SEE Enviro'  },
              ].map(d => (
                <button
                  key={d.id}
                  className={`company-tab ${selectedDbs.includes(d.id) ? 'active' : ''}`}
                  onClick={() => handleDbToggle(d.id)}
                >{d.label}</button>
              ))}
            </div>

            {subCompanies.length > 0 && selectedDbs.length === 1 && (
              <div className="company-bar-pills" style={{ marginTop: 10 }}>
                <span className="company-bar-label">Entity</span>
                <button
                  className={`pill ${selectedEntities.length === 0 ? 'active' : ''}`}
                  onClick={() => handleEntityToggle('all')}
                >All</button>
                {subCompanies.map(c => (
                  <button
                    key={c.id}
                    className={`pill ${selectedEntities.includes(c.id) ? 'active' : ''}`}
                    onClick={() => handleEntityToggle(c.id)}
                    title={c.name}
                  >
                    {c.name.length > 28 ? c.name.slice(0, 26) + '…' : c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(section === 'summary' || section === 'details') && (
          <div className="controls" style={{ paddingTop: 4 }}>
            <div style={{ flex: '0 0 auto', marginRight: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{dbLabel}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 6 }}>
                {MONTHS[month - 1]} {year}
              </span>
            </div>
            <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />
            <label>Period</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />
            <label>Auto-refresh</label>
            <button className={`btn ${autoRefresh ? 'primary' : ''}`} onClick={() => setAutoRefresh(v => !v)}>
              {autoRefresh ? '● On' : '○ Off'}
            </button>
            {autoRefresh && (
              <select value={interval} onChange={e => setInterval_(Number(e.target.value))}>
                {INTERVALS.map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
              </select>
            )}
            <button className="btn primary" onClick={fetchAll} disabled={loading}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
            <div className="export-wrap">
              <button className="btn" onClick={() => setExportOpen(v => !v)}>↓ Export</button>
              {exportOpen && (
                <div className="export-menu" onMouseLeave={() => setExportOpen(false)}>
                  <button className="export-menu-btn" onClick={() => downloadExport('excel')}>Excel (.xlsx)</button>
                  <button className="export-menu-btn" onClick={() => downloadExport('pdf')}>PDF Report</button>
                </div>
              )}
            </div>
            <div className="refresh-info">
              {lastRefreshed && `Updated ${lastRefreshed.toLocaleTimeString()}`}
            </div>
          </div>
        )}

        {error && <div className="error-banner">⚠ {error}</div>}

        {section === 'users'        && <UserManager currentUser={user} />}
        {section === 'transactions' && (
          <Transactions
            db={effectiveDbs[0]}
            ids={selectedEntities.length > 0 ? selectedEntities : null}
          />
        )}

        {section === 'summary' && (
          <>
            <div className="kpi-grid">
              <KPICard label="Month Revenue"  value={kpis?.month_revenue} sub={`YTD: ${fmt(kpis?.ytd_revenue)}`} color="green" />
              <KPICard label="Month Expense"  value={kpis?.month_expense} sub={`YTD: ${fmt(kpis?.ytd_expense)}`} color="red" />
              <KPICard label="Net Profit"     value={profit}    sub={`Margin: ${kpis?.month_margin ?? '–'}%`} badge={kpis?.month_margin} color={profit >= 0 ? 'blue' : 'red'} />
              <KPICard label="YTD Net Profit" value={ytdProfit} sub={`Margin: ${kpis?.ytd_margin ?? '–'}%`}   badge={kpis?.ytd_margin}   color={ytdProfit >= 0 ? 'blue' : 'red'} />
              <KPICard label="AR Outstanding" value={kpis?.total_ar} sub={`Overdue >30d: ${fmt(kpis?.overdue_ar)}`} color="teal" />
              <KPICard label="AP Outstanding" value={kpis?.total_ap} sub={`Overdue >30d: ${fmt(kpis?.overdue_ap)}`} color="purple" />
            </div>
            <div className="charts-row">
              <MonthlyChart
                data={monthlyPnl}
                selectedMonth={{ month, year }}
                onBarClick={(m, y) => {
                  if (m === null) {
                    setMonth(now.getMonth() + 1)
                    setYear(now.getFullYear())
                  } else {
                    setMonth(m)
                    setYear(y)
                  }
                }}
              />
              <AgingDonut title="AR Aging" data={arAging} />
              <AgingDonut title="AP Aging" data={apAging} />
            </div>
            <div className="tables-row">
              <AgingTable title="AR by Customer" data={arCustomers} nameKey="customer" />
              <AgingTable title="AP by Vendor"   data={apVendors}   nameKey="vendor" />
            </div>
          </>
        )}

        {section === 'details' && (
          <>
            <div className="section-tabs" style={{ marginTop: 20 }}>
              {DETAIL_TABS.map(t => (
                <button
                  key={t}
                  className={`section-tab ${detailTab === t ? 'active' : ''}`}
                  onClick={() => setDetailTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {detailTab === 'P&L Detail'    && <PnLDetail    data={pnlDetail}    period={pnlPeriod} />}
            {detailTab === 'Balance Sheet' && <BalanceSheet data={balanceSheet} />}
            {detailTab === 'Year Summary'  && <YearlySummary data={yearlySummary} />}
          </>
        )}

        <button className="chat-fab" onClick={() => setChatOpen(v => !v)} title="AI CFO Assistant">AI</button>
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          context={{
            company_name: dbLabel,
            db: effectiveDbs[0],
            company_ids: selectedEntities.length > 0 ? selectedEntities.join(',') : null,
            year, month,
            kpis:         kpis || {},
            monthly_pnl:  monthlyPnl,
            ar_customers: arCustomers.slice(0, 10),
            ap_vendors:   apVendors.slice(0, 10),
            pnl_detail:   pnlDetail,
          }}
        />
      </div>
    </div>
  )
}
