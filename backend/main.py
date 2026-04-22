import logging
import os
import ssl
import decimal
from datetime import date
from typing import Any

import asyncpg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "ogh-live-pg.techleara.net")
DB_PORT = int(os.getenv("DB_PORT", "22345"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
VALID_DBS = ["ogh-live", "77asia", "seeenviro"]
DB_LABELS = {"ogh-live": "OGH Live", "77asia": "77 Asia", "seeenviro": "SEE Enviro"}

app = FastAPI(title="AI CFO Finance Dashboard API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def _conn(db: str) -> asyncpg.Connection:
    if db not in VALID_DBS:
        raise HTTPException(400, f"Unknown database: {db}")
    try:
        return await asyncpg.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER,
            password=DB_PASSWORD, database=db, ssl=_ssl_ctx(),
        )
    except Exception as exc:
        log.error("DB connect error [%s@%s:%s/%s]: %s", DB_USER, DB_HOST, DB_PORT, db, exc)
        raise HTTPException(503, detail=f"Cannot connect to database '{db}': {exc}")


def _clean(v: Any) -> Any:
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def _row(row) -> dict:
    return {k: _clean(v) for k, v in dict(row).items()}


async def fetch(db: str, sql: str, *args) -> list[dict]:
    conn = await _conn(db)
    try:
        rows = await conn.fetch(sql, *args)
        return [_row(r) for r in rows]
    except Exception as exc:
        log.error("fetch error [%s]: %s", db, exc, exc_info=True)
        raise HTTPException(500, detail=str(exc))
    finally:
        await conn.close()


async def fetch_one(db: str, sql: str, *args) -> dict:
    conn = await _conn(db)
    try:
        row = await conn.fetchrow(sql, *args)
        return _row(row) if row else {}
    except Exception as exc:
        log.error("fetch_one error [%s]: %s", db, exc, exc_info=True)
        raise HTTPException(500, detail=str(exc))
    finally:
        await conn.close()


# ─────────────────────────────────────────────
# /api/health
# ─────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────
# /api/companies
# ─────────────────────────────────────────────
@app.get("/api/companies")
async def companies():
    return {"companies": [{"id": k, "name": v} for k, v in DB_LABELS.items()]}


# ─────────────────────────────────────────────
# /api/sub-companies
# ─────────────────────────────────────────────
@app.get("/api/sub-companies")
async def sub_companies(db: str = Query("ogh-live")):
    rows = await fetch(db, "SELECT id, name FROM res_company ORDER BY name")
    return {"data": rows}


# ─────────────────────────────────────────────
# /api/kpis   – KPI summary cards
# ─────────────────────────────────────────────
@app.get("/api/kpis")
async def kpis(
    db: str = Query("ogh-live"),
    year: int = Query(None),
    month: int = Query(None),
    company_id: int = Query(None),
):
    today = date.today()
    y = year or today.year
    m = month or today.month

    pnl_sql = """
        SELECT
            COALESCE(SUM(CASE
                WHEN aa.account_type IN ('income','income_other')
                     AND EXTRACT(MONTH FROM am.date)::int = $1
                     AND EXTRACT(YEAR  FROM am.date)::int = $2
                THEN aml.credit - aml.debit ELSE 0 END), 0) AS month_revenue,
            COALESCE(SUM(CASE
                WHEN aa.account_type IN ('expense','expense_depreciation','expense_direct_cost')
                     AND EXTRACT(MONTH FROM am.date)::int = $1
                     AND EXTRACT(YEAR  FROM am.date)::int = $2
                THEN aml.debit - aml.credit ELSE 0 END), 0) AS month_expense,
            COALESCE(SUM(CASE
                WHEN aa.account_type IN ('income','income_other')
                     AND EXTRACT(YEAR  FROM am.date)::int = $2
                     AND EXTRACT(MONTH FROM am.date)::int <= $1
                THEN aml.credit - aml.debit ELSE 0 END), 0) AS ytd_revenue,
            COALESCE(SUM(CASE
                WHEN aa.account_type IN ('expense','expense_depreciation','expense_direct_cost')
                     AND EXTRACT(YEAR  FROM am.date)::int = $2
                     AND EXTRACT(MONTH FROM am.date)::int <= $1
                THEN aml.debit - aml.credit ELSE 0 END), 0) AS ytd_expense
        FROM account_move_line aml
        JOIN account_move    am ON am.id = aml.move_id
        JOIN account_account aa ON aa.id = aml.account_id
        WHERE am.state = 'posted'
          AND aa.account_type IN (
              'income','income_other',
              'expense','expense_depreciation','expense_direct_cost')
          AND EXTRACT(YEAR FROM am.date)::int = $2
          AND ($3::int IS NULL OR am.company_id = $3)
    """
    ar_sql = """
        SELECT
            COALESCE(SUM(am.amount_residual), 0) AS total_ar,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due > 30
                         THEN am.amount_residual ELSE 0 END), 0) AS overdue_ar
        FROM account_move am
        WHERE am.state = 'posted'
          AND am.move_type IN ('out_invoice','out_refund')
          AND am.amount_residual > 0
          AND ($1::int IS NULL OR am.company_id = $1)
    """
    ap_sql = """
        SELECT
            COALESCE(SUM(am.amount_residual), 0) AS total_ap,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due > 30
                         THEN am.amount_residual ELSE 0 END), 0) AS overdue_ap
        FROM account_move am
        WHERE am.state = 'posted'
          AND am.move_type IN ('in_invoice','in_refund')
          AND am.amount_residual > 0
          AND ($1::int IS NULL OR am.company_id = $1)
    """
    pnl = await fetch_one(db, pnl_sql, m, y, company_id)
    ar  = await fetch_one(db, ar_sql, company_id)
    ap  = await fetch_one(db, ap_sql, company_id)

    mr, me = float(pnl.get("month_revenue") or 0), float(pnl.get("month_expense") or 0)
    yr, ye = float(pnl.get("ytd_revenue") or 0),   float(pnl.get("ytd_expense") or 0)

    return {
        "period": {"year": y, "month": m},
        "month_revenue": mr,
        "month_expense": me,
        "month_profit":  mr - me,
        "month_margin":  round((mr - me) / mr * 100, 1) if mr else 0,
        "ytd_revenue":   yr,
        "ytd_expense":   ye,
        "ytd_profit":    yr - ye,
        "ytd_margin":    round((yr - ye) / yr * 100, 1) if yr else 0,
        "total_ar":      float(ar.get("total_ar") or 0),
        "overdue_ar":    float(ar.get("overdue_ar") or 0),
        "total_ap":      float(ap.get("total_ap") or 0),
        "overdue_ap":    float(ap.get("overdue_ap") or 0),
    }


# ─────────────────────────────────────────────
# /api/monthly-pnl   – Query 11
# ─────────────────────────────────────────────
@app.get("/api/monthly-pnl")
async def monthly_pnl(db: str = Query("ogh-live"), company_id: int = Query(None)):
    sql = """
        SELECT
            TO_CHAR(am.date, 'YYYY-MM')            AS year_month,
            EXTRACT(YEAR  FROM am.date)::int        AS year,
            EXTRACT(MONTH FROM am.date)::int        AS month,
            COALESCE(SUM(CASE WHEN aa.account_type IN ('income','income_other')
                THEN aml.credit - aml.debit ELSE 0 END), 0) AS total_revenue,
            COALESCE(SUM(CASE WHEN aa.account_type IN (
                'expense','expense_depreciation','expense_direct_cost')
                THEN aml.debit - aml.credit ELSE 0 END), 0) AS total_expense
        FROM account_move_line aml
        JOIN account_move    am ON am.id = aml.move_id
        JOIN account_account aa ON aa.id = aml.account_id
        WHERE am.state = 'posted'
          AND am.date IS NOT NULL
          AND aa.account_type IN (
              'income','income_other',
              'expense','expense_depreciation','expense_direct_cost')
          AND am.date >= (CURRENT_DATE - INTERVAL '12 months')::date
          AND ($1::int IS NULL OR am.company_id = $1)
        GROUP BY TO_CHAR(am.date, 'YYYY-MM'),
                 EXTRACT(YEAR  FROM am.date)::int,
                 EXTRACT(MONTH FROM am.date)::int
        ORDER BY year_month
    """
    rows = await fetch(db, sql, company_id)
    return {"data": [
        {**r,
         "total_revenue": float(r["total_revenue"] or 0),
         "total_expense": float(r["total_expense"] or 0),
         "net_profit": float(r["total_revenue"] or 0) - float(r["total_expense"] or 0)}
        for r in rows
    ]}


# ─────────────────────────────────────────────
# /api/ar-aging   – Query 9 (summary)
# ─────────────────────────────────────────────
@app.get("/api/ar-aging")
async def ar_aging(db: str = Query("ogh-live"), company_id: int = Query(None)):
    sql = """
        SELECT
            COALESCE(SUM(CASE WHEN am.invoice_date_due >= CURRENT_DATE
                              OR am.invoice_date_due IS NULL
                         THEN am.amount_residual ELSE 0 END), 0) AS current_bucket,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 1  AND 30
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_1_30,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 31 AND 60
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_31_60,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 61 AND 90
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_61_90,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due > 90
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_over_90,
            COALESCE(SUM(am.amount_residual), 0)                  AS total
        FROM account_move am
        WHERE am.state = 'posted'
          AND am.move_type IN ('out_invoice','out_refund')
          AND am.amount_residual > 0
          AND ($1::int IS NULL OR am.company_id = $1)
    """
    row = await fetch_one(db, sql, company_id)
    return {k: float(v or 0) for k, v in row.items()}


# ─────────────────────────────────────────────
# /api/ap-aging   – Query 10 (summary)
# ─────────────────────────────────────────────
@app.get("/api/ap-aging")
async def ap_aging(db: str = Query("ogh-live"), company_id: int = Query(None)):
    sql = """
        SELECT
            COALESCE(SUM(CASE WHEN am.invoice_date_due >= CURRENT_DATE
                              OR am.invoice_date_due IS NULL
                         THEN am.amount_residual ELSE 0 END), 0) AS current_bucket,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 1  AND 30
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_1_30,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 31 AND 60
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_31_60,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 61 AND 90
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_61_90,
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due > 90
                         THEN am.amount_residual ELSE 0 END), 0) AS bucket_over_90,
            COALESCE(SUM(am.amount_residual), 0)                  AS total
        FROM account_move am
        WHERE am.state = 'posted'
          AND am.move_type IN ('in_invoice','in_refund')
          AND am.amount_residual > 0
          AND ($1::int IS NULL OR am.company_id = $1)
    """
    row = await fetch_one(db, sql, company_id)
    return {k: float(v or 0) for k, v in row.items()}


# ─────────────────────────────────────────────
# /api/ar-customers  – Query 9 (detail)
# ─────────────────────────────────────────────
@app.get("/api/ar-customers")
async def ar_customers(db: str = Query("ogh-live"), limit: int = Query(25), company_id: int = Query(None)):
    sql = """
        SELECT
            rp.name AS customer,
            COALESCE(SUM(CASE WHEN am.invoice_date_due >= CURRENT_DATE
                              OR am.invoice_date_due IS NULL
                         THEN am.amount_residual ELSE 0 END), 0) AS "Current",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 1  AND 30
                         THEN am.amount_residual ELSE 0 END), 0) AS "1-30 Days",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 31 AND 60
                         THEN am.amount_residual ELSE 0 END), 0) AS "31-60 Days",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 61 AND 90
                         THEN am.amount_residual ELSE 0 END), 0) AS "61-90 Days",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due > 90
                         THEN am.amount_residual ELSE 0 END), 0) AS "Over 90 Days",
            COALESCE(SUM(am.amount_residual), 0)                  AS total_outstanding
        FROM account_move am
        JOIN res_partner rp ON rp.id = am.partner_id
        WHERE am.state = 'posted'
          AND am.move_type IN ('out_invoice','out_refund')
          AND am.amount_residual > 0
          AND ($2::int IS NULL OR am.company_id = $2)
        GROUP BY rp.name
        ORDER BY total_outstanding DESC
        LIMIT $1
    """
    rows = await fetch(db, sql, limit, company_id)
    return {"data": rows}


# ─────────────────────────────────────────────
# /api/ap-vendors  – Query 10 (detail)
# ─────────────────────────────────────────────
@app.get("/api/ap-vendors")
async def ap_vendors(db: str = Query("ogh-live"), limit: int = Query(25), company_id: int = Query(None)):
    sql = """
        SELECT
            rp.name AS vendor,
            COALESCE(SUM(CASE WHEN am.invoice_date_due >= CURRENT_DATE
                              OR am.invoice_date_due IS NULL
                         THEN am.amount_residual ELSE 0 END), 0) AS "Current",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 1  AND 30
                         THEN am.amount_residual ELSE 0 END), 0) AS "1-30 Days",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 31 AND 60
                         THEN am.amount_residual ELSE 0 END), 0) AS "31-60 Days",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 61 AND 90
                         THEN am.amount_residual ELSE 0 END), 0) AS "61-90 Days",
            COALESCE(SUM(CASE WHEN CURRENT_DATE - am.invoice_date_due > 90
                         THEN am.amount_residual ELSE 0 END), 0) AS "Over 90 Days",
            COALESCE(SUM(am.amount_residual), 0)                  AS total_outstanding
        FROM account_move am
        JOIN res_partner rp ON rp.id = am.partner_id
        WHERE am.state = 'posted'
          AND am.move_type IN ('in_invoice','in_refund')
          AND am.amount_residual > 0
          AND ($2::int IS NULL OR am.company_id = $2)
        GROUP BY rp.name
        ORDER BY total_outstanding DESC
        LIMIT $1
    """
    rows = await fetch(db, sql, limit, company_id)
    return {"data": rows}


# ─────────────────────────────────────────────
# /api/pnl-detail  – Query 3
# ─────────────────────────────────────────────
@app.get("/api/pnl-detail")
async def pnl_detail(
    db: str = Query("ogh-live"),
    year: int = Query(None),
    month: int = Query(None),
    company_id: int = Query(None),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    sql = """
        SELECT
            CASE
                WHEN aa.account_type IN ('income','income_other') THEN 'Revenue'
                WHEN aa.account_type = 'expense_direct_cost'      THEN 'Cost of Sales'
                WHEN aa.account_type = 'expense_depreciation'     THEN 'Depreciation'
                WHEN aa.account_type = 'expense'                  THEN 'Operating Expense'
                ELSE aa.account_type
            END AS category,
            aa.code_store->>(aml.company_id::text) AS account_code,
            aa.name->>'en_US'                       AS account_name,
            COALESCE(SUM(
                CASE WHEN aa.account_type IN ('income','income_other')
                     THEN aml.credit - aml.debit
                     ELSE aml.debit - aml.credit END
            ), 0) AS amount
        FROM account_move_line aml
        JOIN account_move    am ON am.id = aml.move_id
        JOIN account_account aa ON aa.id = aml.account_id
        WHERE am.state = 'posted'
          AND aa.account_type IN (
              'income','income_other',
              'expense','expense_depreciation','expense_direct_cost')
          AND EXTRACT(YEAR  FROM am.date)::int = $1
          AND EXTRACT(MONTH FROM am.date)::int = $2
          AND ($3::int IS NULL OR am.company_id = $3)
        GROUP BY aa.account_type,
                 aa.code_store->>(aml.company_id::text),
                 aa.name->>'en_US'
        ORDER BY category, account_code
    """
    rows = await fetch(db, sql, y, m, company_id)
    return {"data": rows, "period": {"year": y, "month": m}}


# ─────────────────────────────────────────────
# /api/balance-sheet  – Query 4
# ─────────────────────────────────────────────
@app.get("/api/balance-sheet")
async def balance_sheet(db: str = Query("ogh-live"), company_id: int = Query(None)):
    sql = """
        SELECT
            CASE
                WHEN aa.account_type LIKE 'asset%'         THEN 'Asset'
                WHEN aa.account_type LIKE 'liability%'     THEN 'Liability'
                WHEN aa.account_type = 'equity'            THEN 'Equity'
                WHEN aa.account_type = 'equity_unaffected' THEN 'Retained Earnings'
                ELSE aa.account_type
            END AS category,
            aa.code_store->>(aml.company_id::text) AS account_code,
            aa.name->>'en_US'                       AS account_name,
            COALESCE(SUM(aml.balance), 0)           AS net_balance
        FROM account_move_line aml
        JOIN account_move    am ON am.id = aml.move_id
        JOIN account_account aa ON aa.id = aml.account_id
        WHERE am.state = 'posted'
          AND aa.account_type IN (
              'asset_receivable','asset_cash','asset_current',
              'asset_non_current','asset_prepayments','asset_fixed',
              'liability_payable','liability_current','liability_non_current',
              'equity','equity_unaffected')
          AND ($1::int IS NULL OR am.company_id = $1)
        GROUP BY aa.account_type,
                 aa.code_store->>(aml.company_id::text),
                 aa.name->>'en_US'
        ORDER BY category, account_code
    """
    rows = await fetch(db, sql, company_id)
    return {"data": rows}


# ─────────────────────────────────────────────
# /api/trial-balance  – Query 2
# ─────────────────────────────────────────────
@app.get("/api/trial-balance")
async def trial_balance(db: str = Query("ogh-live")):
    sql = """
        SELECT
            aa.code_store->>(aml.company_id::text) AS account_code,
            aa.name->>'en_US'                       AS account_name,
            aa.account_type,
            COALESCE(SUM(aml.debit),   0)           AS total_debit,
            COALESCE(SUM(aml.credit),  0)           AS total_credit,
            COALESCE(SUM(aml.balance), 0)           AS net_balance
        FROM account_move_line aml
        JOIN account_move    am ON am.id = aml.move_id
        JOIN account_account aa ON aa.id = aml.account_id
        WHERE am.state = 'posted'
        GROUP BY aa.code_store->>(aml.company_id::text),
                 aa.name->>'en_US', aa.account_type
        ORDER BY account_code
    """
    rows = await fetch(db, sql)
    return {"data": rows}


# ─────────────────────────────────────────────
# /api/cash  – Query 7
# ─────────────────────────────────────────────
@app.get("/api/cash")
async def cash(db: str = Query("ogh-live"), limit: int = Query(30)):
    sql = """
        SELECT
            am.name                 AS payment_reference,
            am.date                 AS payment_date,
            aj.code                 AS journal_code,
            aj.name->>'en_US'       AS journal_name,
            aj.type                 AS journal_type,
            rp.name                 AS partner,
            rc.name                 AS currency,
            COALESCE(am.amount_total, 0) AS amount,
            am.move_type,
            am.state
        FROM account_move am
        JOIN account_journal aj ON aj.id = am.journal_id
        JOIN res_company     co ON co.id = am.company_id
        JOIN res_currency    rc ON rc.id = am.currency_id
        LEFT JOIN res_partner rp ON rp.id = am.partner_id
        WHERE am.state = 'posted'
          AND aj.type IN ('bank','cash')
        ORDER BY am.date DESC
        LIMIT $1
    """
    rows = await fetch(db, sql, limit)
    return {"data": rows}


# ─────────────────────────────────────────────
# /api/invoices  – Query 5
# ─────────────────────────────────────────────
@app.get("/api/invoices")
async def invoices(db: str = Query("ogh-live"), limit: int = Query(30)):
    sql = """
        SELECT
            am.name                 AS invoice_number,
            am.invoice_date         AS invoice_date,
            am.invoice_date_due     AS due_date,
            am.move_type,
            am.state,
            am.payment_state,
            rp.name                 AS customer,
            rc.name                 AS currency,
            COALESCE(am.amount_total,    0) AS total_amount,
            COALESCE(am.amount_residual, 0) AS amount_due,
            CASE
                WHEN am.amount_residual = 0                               THEN 'Paid'
                WHEN am.invoice_date_due IS NULL                          THEN 'No Due Date'
                WHEN am.invoice_date_due >= CURRENT_DATE                  THEN 'Current'
                WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 1  AND 30 THEN '1-30 Days'
                WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 31 AND 60 THEN '31-60 Days'
                WHEN CURRENT_DATE - am.invoice_date_due BETWEEN 61 AND 90 THEN '61-90 Days'
                ELSE 'Over 90 Days'
            END AS aging_bucket,
            GREATEST(0, CURRENT_DATE - am.invoice_date_due) AS days_overdue
        FROM account_move am
        JOIN res_partner  rp ON rp.id = am.partner_id
        JOIN res_currency rc ON rc.id = am.currency_id
        WHERE am.state = 'posted'
          AND am.move_type IN ('out_invoice','out_refund')
        ORDER BY am.invoice_date DESC
        LIMIT $1
    """
    rows = await fetch(db, sql, limit)
    return {"data": rows}
