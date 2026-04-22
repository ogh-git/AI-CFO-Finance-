import { useState, useEffect, useCallback, useRef } from 'react'
import { api, fmt, MONTHS } from './api'
import KPICard     from './components/KPICard'
import MonthlyChart from './components/MonthlyChart'
import AgingDonut  from './components/AgingDonut'
import AgingTable  from './components/AgingTable'
import PnLDetail   from './components/PnLDetail'
import BalanceSheet from './components/BalanceSheet'

const COMPANIES   = [
  { id: 'ogh-live',  name: 'OGH Live' },
  { id: '77asia',    name: '77 Asia' },
  { id: 'seeenviro', name: 'SEE Enviro' },
]
const INTERVALS   = [{ v: 30, l: '30 sec' }, { v: 60, l: '1 min' }, { v: 300, l: '5 min' }, { v: 900, l: '15 min' }]
const DETAIL_TABS = ['P&L Detail', 'Balance Sheet']

const now = new Date()

export default function App() {
  const [db,           setDb]           = useState('ogh-live')
  const [year,         setYear]         = useState(now.getFullYear())
  const [month,        setMonth]        = useState(now.getMonth() + 1)
  const [kpis,         setKpis]         = useState(null)
  const [monthlyPnl,   setMonthlyPnl]   = useState([])
  const [arAging,      setArAging]      = useState(null)
  const [apAging,      setApAging]      = useState(null)
  const [arCustomers,  setArCustomers]  = useState([])
  const [apVendors,    setApVendors]    = useState([])
  const [pnlDetail,    setPnlDetail]    = useState([])
  const [pnlPeriod,    setPnlPeriod]    = useState(null)
  const [balanceSheet, setBalanceSheet] = useState([])
  const [detailTab,    setDetailTab]    = useState('P&L Detail')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [autoRefresh,  setAutoRefresh]  = useState(true)
  const [interval,     setInterval_]    = useState(300)
  const [lastRefreshed,setLastRefreshed]= useState(null)
  const timerRef = useRef(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        kpisData, pnlData, arA, apA, arC, apV, pnlD, bs,
      ] = await Promise.all([
        api.kpis(db, year, month),
        api.monthlyPnl(db),
        api.arAging(db),
        api.apAging(db),
        api.arCustomers(db),
        api.apVendors(db),
        api.pnlDetail(db, year, month),
        api.balanceSheet(db),
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
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [db, year, month])

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

    </div>
  )
}
