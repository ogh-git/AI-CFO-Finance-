import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmt, MONTHS } from './api'
import KPICard      from './components/KPICard'
import MonthlyChart from './components/MonthlyChart'
import AgingDonut   from './components/AgingDonut'
import AgingTable   from './components/AgingTable'
import PnLDetail    from './components/PnLDetail'
import BalanceSheet from './components/BalanceSheet'
import ChatPanel    from './components/ChatPanel'

const COMPANIES   = [
  { id: 'all',       name: 'All Companies' },
  { id: 'ogh-live',  name: 'OGH Live' },
  { id: '77asia',    name: '77 Asia' },
  { id: 'seeenviro', name: 'SEE Enviro' },
]
const ALL_DBS = ['ogh-live', '77asia', 'seeenviro']

function mergeKpis(list) {
  const sum = (k) => list.reduce((a, x) => a + (Number(x?.[k]) || 0), 0)
  const rev  = sum('month_revenue')
  const exp  = sum('month_expense')
  const profit = rev - exp
  const ytdRev  = sum('ytd_revenue')
  const ytdExp  = sum('ytd_expense')
  const ytdProfit = ytdRev - ytdExp
  return {
    month_revenue: rev,
    month_expense: exp,
    month_profit:  profit,
    month_margin:  rev ? ((profit / rev) * 100).toFixed(1) : '0.0',
    ytd_revenue:   ytdRev,
    ytd_expense:   ytdExp,
    ytd_profit:    ytdProfit,
    ytd_margin:    ytdRev ? ((ytdProfit / ytdRev) * 100).toFixed(1) : '0.0',
    total_ar:      sum('total_ar'),
    total_ap:      sum('total_ap'),
    overdue_ar:    sum('overdue_ar'),
    overdue_ap:    sum('overdue_ap'),
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
    current_bucket:  sum('current_bucket'),
    bucket_1_30:     sum('bucket_1_30'),
    bucket_31_60:    sum('bucket_31_60'),
    bucket_61_90:    sum('bucket_61_90'),
    bucket_over_90:  sum('bucket_over_90'),
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
    if (!map[key]) map[key] = { ...row, balance: 0 }
    map[key].balance += Number(row.balance) || 0
  })
  return Object.values(map)
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
const DETAIL_TABS = ['P&L Detail', 'Balance Sheet']

const now = new Date()

export default function App() {
  const [db,            setDb]            = useState('ogh-live')
  const [subCompanies,  setSubCompanies]  = useState([])
  const [companyId,     setCompanyId]     = useState(null)
  const [year,          setYear]          = useState(now.getFullYear())
  const [month,         setMonth]         = useState(now.getMonth() + 1)
  const [kpis,          setKpis]          = useState(null)
  const [monthlyPnl,    setMonthlyPnl]    = useState([])
  const [arAging,       setArAging]       = useState(null)
  const [apAging,       setApAging]       = useState(null)
  const [arCustomers,   setArCustomers]   = useState([])
  const [apVendors,     setApVendors]     = useState([])
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

  const makeExportUrl = (type) => {
    const p = new URLSearchParams({ db, year, month })
    if (companyId) p.set('company_id', companyId)
    return `/api/export/${type}?${p}`
  }

  // load sub-companies when db changes (skip for 'all')
  useEffect(() => {
    if (db === 'all') { setSubCompanies([]); setCompanyId(null); return }
    api.subCompanies(db).then(res => {
      const list = res.data || []
      setSubCompanies(list.length > 1 ? list : [])
      setCompanyId(null)
    }).catch(() => { setSubCompanies([]); setCompanyId(null) })
  }, [db])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (db === 'all') {
        const results = await Promise.all(
          ALL_DBS.map(d => Promise.all([
            api.kpis(d, year, month, null),
            api.monthlyPnl(d, null),
            api.arAging(d, null),
            api.apAging(d, null),
            api.arCustomers(d, null),
            api.apVendors(d, null),
            api.pnlDetail(d, year, month, null),
            api.balanceSheet(d, null),
          ]))
        )
        setKpis(mergeKpis(results.map(r => r[0])))
        setMonthlyPnl(mergeMonthlyPnl(results.map(r => r[1].data || [])))
        setArAging(mergeAging(results.map(r => r[2])))
        setApAging(mergeAging(results.map(r => r[3])))
        setArCustomers(mergeTableRows(results.map(r => r[4].data || []), 'customer'))
        setApVendors(mergeTableRows(results.map(r => r[5].data || []), 'vendor'))
        setPnlDetail(mergePnlDetail(results.map(r => r[6].data || [])))
        setPnlPeriod(results[0][6].period || null)
        setBalanceSheet(mergeBalanceSheet(results.map(r => r[7].data || [])))
      } else {
        const [
          kpisData, pnlData, arA, apA, arC, apV, pnlD, bs,
        ] = await Promise.all([
          api.kpis(db, year, month, companyId),
          api.monthlyPnl(db, companyId),
          api.arAging(db, companyId),
          api.apAging(db, companyId),
          api.arCustomers(db, companyId),
          api.apVendors(db, companyId),
          api.pnlDetail(db, year, month, companyId),
          api.balanceSheet(db, companyId),
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
      }
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [db, year, month, companyId])

  // initial + re-fetch when dependencies change
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // auto-refresh timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!autoRefresh) return
    timerRef.current = window.setInterval(fetchAll, interval * 1000)
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, interval, fetchAll])

  const profit      = kpis ? kpis.month_profit  : null
  const ytdProfit   = kpis ? kpis.ytd_profit    : null

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="dashboard">

      {/* ── Header ── */}
      <div className="header">
        <div className="header-left">
          <div className="header-logo">CFO</div>
          <div>
            <div className="header h1" style={{ fontSize: 18, fontWeight: 600 }}>AI Finance Dashboard</div>
            <div className="header-sub">Executive Overview — SEE Institute Group</div>
          </div>
        </div>
        <div className="header-right">
          <div className="company-tabs">
            {COMPANIES.map(c => (
              <button
                key={c.id}
                className={`company-tab ${db === c.id ? 'active' : ''}`}
                onClick={() => setDb(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {subCompanies.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: '#8b949e' }}>Entity</label>
              <select
                value={companyId ?? ''}
                onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: 12 }}
              >
                <option value="">All Entities</option>
                {subCompanies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="controls">
        <label>Period</label>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />

        <label>Auto-refresh</label>
        <button
          className={`btn ${autoRefresh ? 'primary' : ''}`}
          onClick={() => setAutoRefresh(v => !v)}
        >
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
          <button className="btn" onClick={() => setExportOpen(v => !v)}>
            ↓ Export
          </button>
          {exportOpen && (
            <div className="export-menu" onMouseLeave={() => setExportOpen(false)}>
              <a href={makeExportUrl('excel')} onClick={() => setExportOpen(false)}>
                Excel (.xlsx) — all sheets
              </a>
              <a href={makeExportUrl('pdf')} onClick={() => setExportOpen(false)}>
                PDF Report
              </a>
            </div>
          )}
        </div>

        <div className="refresh-info">
          {lastRefreshed && `Updated ${lastRefreshed.toLocaleTimeString()}`}
        </div>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        <KPICard
          label="Month Revenue"
          value={kpis?.month_revenue}
          sub={`YTD: ${fmt(kpis?.ytd_revenue)}`}
          color="green"
        />
        <KPICard
          label="Month Expense"
          value={kpis?.month_expense}
          sub={`YTD: ${fmt(kpis?.ytd_expense)}`}
          color="red"
        />
        <KPICard
          label="Net Profit"
          value={profit}
          sub={`Margin: ${kpis?.month_margin ?? '–'}%`}
          badge={kpis?.month_margin}
          color={profit >= 0 ? 'blue' : 'red'}
        />
        <KPICard
          label="YTD Net Profit"
          value={ytdProfit}
          sub={`Margin: ${kpis?.ytd_margin ?? '–'}%`}
          badge={kpis?.ytd_margin}
          color={ytdProfit >= 0 ? 'blue' : 'red'}
        />
        <KPICard
          label="AR Outstanding"
          value={kpis?.total_ar}
          sub={`Overdue >30d: ${fmt(kpis?.overdue_ar)}`}
          color="teal"
        />
        <KPICard
          label="AP Outstanding"
          value={kpis?.total_ap}
          sub={`Overdue >30d: ${fmt(kpis?.overdue_ap)}`}
          color="purple"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="charts-row">
        <MonthlyChart data={monthlyPnl} />
        <AgingDonut title="AR Aging" data={arAging} />
        <AgingDonut title="AP Aging" data={apAging} />
      </div>

      {/* ── Aging detail tables ── */}
      <div className="tables-row">
        <AgingTable title="AR by Customer"  data={arCustomers} nameKey="customer" />
        <AgingTable title="AP by Vendor"    data={apVendors}   nameKey="vendor" />
      </div>

      {/* ── Detail section ── */}
      <div className="section-tabs">
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

      {detailTab === 'P&L Detail' && (
        <PnLDetail data={pnlDetail} period={pnlPeriod} />
      )}
      {detailTab === 'Balance Sheet' && (
        <BalanceSheet data={balanceSheet} />
      )}

      {/* ── AI Chat ── */}
      <button className="chat-fab" onClick={() => setChatOpen(v => !v)} title="AI CFO Assistant">
        AI
      </button>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        context={{
          company_name: COMPANIES.find(c => c.id === db)?.name || db,
          db, year, month,
          company_id: companyId,
          kpis:         kpis         || {},
          monthly_pnl:  monthlyPnl,
          ar_customers: arCustomers.slice(0, 10),
          ap_vendors:   apVendors.slice(0, 10),
          pnl_detail:   pnlDetail,
        }}
      />

    </div>
  )
}
