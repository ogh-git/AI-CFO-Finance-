import { useState, useEffect } from 'react'
import { api, fmt, fmtDate } from '../api'

const TABS = [
  { id: 'cash',     label: 'Cash & Bank'      },
  { id: 'invoices', label: 'Invoices'          },
  { id: 'purchase', label: 'Purchase Orders'   },
  { id: 'partners', label: 'Partner Master'    },
  { id: 'journals', label: 'Journal Master'    },
  { id: 'trial',    label: 'Trial Balance'     },
]

const AGING_COLOR = {
  'Paid':        { bg: 'rgba(63,185,80,.12)',  color: '#3fb950' },
  'Current':     { bg: 'rgba(88,166,255,.12)', color: '#58a6ff' },
  '1-30 Days':   { bg: 'rgba(210,153,34,.15)', color: '#d29922' },
  '31-60 Days':  { bg: 'rgba(210,153,34,.2)',  color: '#d29922' },
  '61-90 Days':  { bg: 'rgba(248,81,73,.15)',  color: '#f85149' },
  'Over 90 Days':{ bg: 'rgba(248,81,73,.25)',  color: '#f85149' },
  'No Due Date': { bg: 'rgba(139,148,158,.15)',color: '#8b949e' },
}

const PAY_COLOR = {
  'paid':         { bg: 'rgba(63,185,80,.12)',  color: '#3fb950' },
  'partial':      { bg: 'rgba(210,153,34,.15)', color: '#d29922' },
  'not_paid':     { bg: 'rgba(248,81,73,.15)',  color: '#f85149' },
  'in_payment':   { bg: 'rgba(88,166,255,.12)', color: '#58a6ff' },
  'reversed':     { bg: 'rgba(139,148,158,.15)',color: '#8b949e' },
}

const Badge = ({ label, map }) => {
  const style = map[label] || { bg: 'rgba(139,148,158,.12)', color: '#8b949e' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
      background: style.bg, color: style.color, whiteSpace: 'nowrap',
    }}>
      {label?.replace(/_/g, ' ')}
    </span>
  )
}

const MOVE_LABEL = {
  out_payment: 'Customer Payment', in_payment: 'Vendor Payment',
  out_receipt: 'Customer Receipt', in_receipt: 'Vendor Receipt',
  out_invoice: 'Invoice', out_refund: 'Credit Note',
  in_invoice:  'Vendor Bill', in_refund: 'Vendor Refund',
}

const JOURNAL_TYPE_COLOR = {
  sale:     '#3fb950', purchase: '#f85149',
  bank:     '#58a6ff', cash:     '#bc8cff',
  general:  '#d29922',
}

function LoadingRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: 'center', color: '#8b949e', padding: '32px 0' }}>
        Loading…
      </td>
    </tr>
  )
}

function EmptyRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: 'center', color: '#8b949e', padding: '32px 0' }}>
        No data
      </td>
    </tr>
  )
}

/* ── Individual tab panels ── */

function CashTab({ db, ids }) {
  const [data, setData]   = useState([])
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState(null)
  useEffect(() => {
    setBusy(true); setErr(null)
    api.cash(db, ids).then(r => setData(r.data || [])).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }, [db, ids?.join(',')])
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Date</th>
            <th style={{ textAlign:'left' }}>Reference</th>
            <th style={{ textAlign:'left' }}>Journal</th>
            <th style={{ textAlign:'left' }}>Partner</th>
            <th>Currency</th>
            <th>Amount</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {busy ? <LoadingRow cols={7} /> : err ? <tr><td colSpan={7} style={{color:'var(--red)',padding:'16px'}}>{err}</td></tr>
          : !data.length ? <EmptyRow cols={7} />
          : data.map((r, i) => (
            <tr key={i}>
              <td style={{ textAlign:'left', color:'#8b949e', fontSize:12 }}>{fmtDate(r.payment_date)}</td>
              <td style={{ textAlign:'left', fontWeight:500 }}>{r.payment_reference || '–'}</td>
              <td style={{ textAlign:'left' }}>
                <span style={{ fontSize:11, fontWeight:600, color: JOURNAL_TYPE_COLOR[r.journal_type] || '#8b949e', marginRight:4 }}>
                  [{r.journal_code}]
                </span>
                {r.journal_name}
              </td>
              <td style={{ textAlign:'left' }}>{r.partner || '–'}</td>
              <td>{r.currency}</td>
              <td style={{ fontWeight:600 }}>{fmt(r.amount)}</td>
              <td>{MOVE_LABEL[r.move_type] || r.move_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvoicesTab({ db, ids }) {
  const [data, setData]   = useState([])
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState(null)
  useEffect(() => {
    setBusy(true); setErr(null)
    api.invoices(db, ids).then(r => setData(r.data || [])).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }, [db, ids?.join(',')])
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Invoice #</th>
            <th style={{ textAlign:'left' }}>Date</th>
            <th style={{ textAlign:'left' }}>Customer</th>
            <th style={{ textAlign:'left' }}>Due Date</th>
            <th>Currency</th>
            <th>Total</th>
            <th>Due</th>
            <th>Status</th>
            <th>Days</th>
          </tr>
        </thead>
        <tbody>
          {busy ? <LoadingRow cols={9} /> : err ? <tr><td colSpan={9} style={{color:'var(--red)',padding:'16px'}}>{err}</td></tr>
          : !data.length ? <EmptyRow cols={9} />
          : data.map((r, i) => (
            <tr key={i}>
              <td style={{ textAlign:'left', fontWeight:500 }}>{r.invoice_number}</td>
              <td style={{ textAlign:'left', color:'#8b949e', fontSize:12 }}>{fmtDate(r.invoice_date)}</td>
              <td style={{ textAlign:'left' }}>{r.customer}</td>
              <td style={{ textAlign:'left', color:'#8b949e', fontSize:12 }}>{fmtDate(r.due_date)}</td>
              <td>{r.currency}</td>
              <td>{fmt(r.total_amount)}</td>
              <td style={{ color: r.amount_due > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(r.amount_due)}</td>
              <td><Badge label={r.aging_bucket} map={AGING_COLOR} /></td>
              <td style={{ color: r.days_overdue > 0 ? 'var(--red)' : 'var(--text2)', fontSize:12 }}>
                {r.days_overdue > 0 ? r.days_overdue : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PurchaseTab({ db, ids }) {
  const [data, setData]   = useState([])
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState(null)
  useEffect(() => {
    setBusy(true); setErr(null)
    api.purchaseOrders(db, ids).then(r => setData(r.data || [])).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }, [db, ids?.join(',')])
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Bill #</th>
            <th style={{ textAlign:'left' }}>Vendor</th>
            <th style={{ textAlign:'left' }}>Bill Date</th>
            <th style={{ textAlign:'left' }}>Due Date</th>
            <th>Currency</th>
            <th>Subtotal</th>
            <th>Tax</th>
            <th>Total</th>
            <th>Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {busy ? <LoadingRow cols={10} /> : err ? <tr><td colSpan={10} style={{color:'var(--red)',padding:'16px'}}>{err}</td></tr>
          : !data.length ? <EmptyRow cols={10} />
          : data.map((r, i) => (
            <tr key={i}>
              <td style={{ textAlign:'left', fontWeight:500 }}>{r.bill_number}</td>
              <td style={{ textAlign:'left' }}>{r.vendor}</td>
              <td style={{ textAlign:'left', color:'#8b949e', fontSize:12 }}>{fmtDate(r.bill_date)}</td>
              <td style={{ textAlign:'left', color:'#8b949e', fontSize:12 }}>{fmtDate(r.due_date)}</td>
              <td>{r.currency}</td>
              <td>{fmt(r.subtotal)}</td>
              <td>{fmt(r.tax_amount)}</td>
              <td style={{ fontWeight:600 }}>{fmt(r.total_amount)}</td>
              <td style={{ color: r.amount_due > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(r.amount_due)}</td>
              <td><Badge label={r.payment_state} map={PAY_COLOR} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PartnersTab({ db }) {
  const [data, setData]   = useState([])
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState(null)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    setBusy(true); setErr(null)
    api.partners(db).then(r => setData(r.data || [])).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }, [db])
  const PTYPE_COLOR = {
    'Customer': '#3fb950', 'Vendor': '#f85149', 'Customer & Vendor': '#58a6ff'
  }
  const lf = filter.toLowerCase()
  const visible = filter ? data.filter(r => r.partner_name?.toLowerCase().includes(lf)) : data
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <input
          className="um-input"
          placeholder="Search partners…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: 260 }}
        />
        <span style={{ marginLeft: 12, fontSize: 12, color: '#8b949e' }}>{visible.length} partners</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign:'left' }}>Partner Name</th>
              <th>Type</th>
              <th style={{ textAlign:'left' }}>Email</th>
              <th style={{ textAlign:'left' }}>Phone</th>
              <th style={{ textAlign:'left' }}>Tax ID</th>
              <th style={{ textAlign:'left' }}>Country</th>
            </tr>
          </thead>
          <tbody>
            {busy ? <LoadingRow cols={6} /> : err ? <tr><td colSpan={6} style={{color:'var(--red)',padding:'16px'}}>{err}</td></tr>
            : !visible.length ? <EmptyRow cols={6} />
            : visible.map((r, i) => (
              <tr key={i}>
                <td style={{ textAlign:'left', fontWeight:500 }}>{r.partner_name}</td>
                <td>
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10,
                    background: `${PTYPE_COLOR[r.partner_type] || '#8b949e'}22`,
                    color: PTYPE_COLOR[r.partner_type] || '#8b949e',
                  }}>{r.partner_type}</span>
                </td>
                <td style={{ textAlign:'left', fontSize:12 }}>{r.email || '–'}</td>
                <td style={{ textAlign:'left', fontSize:12 }}>{r.phone || '–'}</td>
                <td style={{ textAlign:'left', fontSize:12 }}>{r.tax_id || '–'}</td>
                <td style={{ textAlign:'left' }}>{r.country || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function JournalsTab({ db, ids }) {
  const [data, setData]   = useState([])
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState(null)
  useEffect(() => {
    setBusy(true); setErr(null)
    api.journals(db, ids).then(r => setData(r.data || [])).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }, [db, ids?.join(',')])
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Code</th>
            <th style={{ textAlign:'left' }}>Journal Name</th>
            <th>Type</th>
            <th>Currency</th>
            <th>Entries</th>
            <th>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {busy ? <LoadingRow cols={6} /> : err ? <tr><td colSpan={6} style={{color:'var(--red)',padding:'16px'}}>{err}</td></tr>
          : !data.length ? <EmptyRow cols={6} />
          : data.map((r, i) => (
            <tr key={i}>
              <td style={{ textAlign:'left', fontWeight:700, color: JOURNAL_TYPE_COLOR[r.journal_type] || '#8b949e' }}>
                {r.journal_code}
              </td>
              <td style={{ textAlign:'left' }}>{r.journal_name}</td>
              <td>
                <span style={{
                  fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10, textTransform:'capitalize',
                  background: `${JOURNAL_TYPE_COLOR[r.journal_type] || '#8b949e'}22`,
                  color: JOURNAL_TYPE_COLOR[r.journal_type] || '#8b949e',
                }}>{r.journal_type}</span>
              </td>
              <td style={{ fontSize:12 }}>{r.currency || '–'}</td>
              <td style={{ fontWeight:500 }}>{Number(r.move_count).toLocaleString()}</td>
              <td>{fmt(r.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrialTab({ db, ids }) {
  const [data, setData]   = useState([])
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState(null)
  useEffect(() => {
    setBusy(true); setErr(null)
    api.trialBalance(db, ids).then(r => setData(r.data || [])).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }, [db, ids?.join(',')])
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Code</th>
            <th style={{ textAlign:'left' }}>Account Name</th>
            <th style={{ textAlign:'left' }}>Type</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Net Balance</th>
          </tr>
        </thead>
        <tbody>
          {busy ? <LoadingRow cols={6} /> : err ? <tr><td colSpan={6} style={{color:'var(--red)',padding:'16px'}}>{err}</td></tr>
          : !data.length ? <EmptyRow cols={6} />
          : data.map((r, i) => {
            const net = Number(r.net_balance || 0)
            return (
              <tr key={i}>
                <td style={{ textAlign:'left', color:'#8b949e', fontSize:12 }}>{r.account_code}</td>
                <td style={{ textAlign:'left' }}>{r.account_name}</td>
                <td style={{ textAlign:'left', fontSize:11, color:'#8b949e', textTransform:'capitalize' }}>
                  {r.account_type?.replace(/_/g,' ')}
                </td>
                <td style={{ color:'var(--green)' }}>{fmt(r.total_debit)}</td>
                <td style={{ color:'var(--red)' }}>{fmt(r.total_credit)}</td>
                <td style={{ fontWeight:600, color: net >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmt(net)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Main component ── */
export default function Transactions({ db, ids }) {
  const [tab, setTab] = useState('cash')

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="section-tabs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`section-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {tab === 'cash'     && <CashTab     db={db} ids={ids} />}
        {tab === 'invoices' && <InvoicesTab db={db} ids={ids} />}
        {tab === 'purchase' && <PurchaseTab db={db} ids={ids} />}
        {tab === 'partners' && <PartnersTab db={db} />}
        {tab === 'journals' && <JournalsTab db={db} ids={ids} />}
        {tab === 'trial'    && <TrialTab    db={db} ids={ids} />}
      </div>
    </div>
  )
}
