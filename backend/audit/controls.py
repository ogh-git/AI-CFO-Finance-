from datetime import datetime
from typing import Optional, Callable


async def check_dup_vendor_invoices(db: str, company_ids: Optional[list],
                                     params: dict, fetch_fn: Callable) -> dict:
    sql = """
        SELECT a.id AS move_id_1, b.id AS move_id_2,
               rp.name AS partner_name,
               a.amount_total,
               a.invoice_date AS date1, b.invoice_date AS date2,
               a.name AS ref1, b.name AS ref2
        FROM account_move a
        JOIN account_move b
          ON b.partner_id  = a.partner_id
         AND b.amount_total = a.amount_total
         AND b.id > a.id
         AND ABS(b.invoice_date - a.invoice_date) <= 3
        JOIN res_partner rp ON rp.id = a.partner_id
        WHERE a.state = 'posted' AND b.state = 'posted'
          AND a.move_type IN ('in_invoice','in_refund')
          AND b.move_type IN ('in_invoice','in_refund')
          AND ($1::int[] IS NULL OR a.company_id = ANY($1::int[]))
        LIMIT 200
    """
    rows = await fetch_fn(db, sql, company_ids)
    return {
        "check_key": "dup_vendor_invoices",
        "status": "exceptions" if rows else "pass",
        "exceptions": rows, "count": len(rows),
        "run_at": datetime.utcnow().isoformat(),
    }


async def check_weekend_je(db: str, company_ids: Optional[list],
                            params: dict, fetch_fn: Callable) -> dict:
    sql = """
        SELECT am.id AS move_id, am.name AS ref, am.date,
               ru.login AS user_login,
               EXTRACT(DOW FROM am.date::timestamp)::int AS day_of_week,
               am.write_date
        FROM account_move am
        LEFT JOIN res_users ru ON ru.id = am.create_uid
        WHERE am.state = 'posted'
          AND am.journal_id IN (
              SELECT id FROM account_journal WHERE type = 'general')
          AND (
              EXTRACT(DOW FROM am.date::timestamp) IN (0, 6)
              OR (am.write_date IS NOT NULL
                  AND am.write_date::time NOT BETWEEN '07:00:00' AND '20:00:00')
          )
          AND am.date >= CURRENT_DATE - INTERVAL '90 days'
          AND ($1::int[] IS NULL OR am.company_id = ANY($1::int[]))
        ORDER BY am.date DESC
        LIMIT 200
    """
    rows = await fetch_fn(db, sql, company_ids)
    return {
        "check_key": "weekend_je",
        "status": "exceptions" if rows else "pass",
        "exceptions": rows, "count": len(rows),
        "run_at": datetime.utcnow().isoformat(),
    }


async def check_round_number_je(db: str, company_ids: Optional[list],
                                 params: dict, fetch_fn: Callable) -> dict:
    threshold = float(params.get("threshold", 10_000))
    sql = """
        SELECT am.id AS move_id, am.name AS ref, am.date,
               ru.login AS user_login,
               SUM(ABS(aml.debit)) AS total_debit
        FROM account_move am
        JOIN account_move_line aml ON aml.move_id = am.id
        LEFT JOIN res_users ru ON ru.id = am.create_uid
        WHERE am.state = 'posted'
          AND am.journal_id IN (
              SELECT id FROM account_journal WHERE type = 'general')
          AND am.date >= CURRENT_DATE - INTERVAL '90 days'
          AND ($1::int[] IS NULL OR am.company_id = ANY($1::int[]))
        GROUP BY am.id, am.name, am.date, ru.login
        HAVING SUM(ABS(aml.debit)) >= $2
           AND MOD(SUM(ABS(aml.debit))::bigint, 1000) = 0
        ORDER BY total_debit DESC
        LIMIT 200
    """
    rows = await fetch_fn(db, sql, company_ids, threshold)
    return {
        "check_key": "round_number_je",
        "status": "exceptions" if rows else "pass",
        "exceptions": rows, "count": len(rows),
        "run_at": datetime.utcnow().isoformat(),
    }


async def check_self_approved_je(db: str, company_ids: Optional[list],
                                  params: dict, fetch_fn: Callable) -> dict:
    sql = """
        SELECT am.id AS move_id, am.name AS ref, am.date,
               ru.login AS user_login,
               am.create_uid, am.write_uid
        FROM account_move am
        LEFT JOIN res_users ru ON ru.id = am.create_uid
        WHERE am.state = 'posted'
          AND am.journal_id IN (
              SELECT id FROM account_journal WHERE type = 'general')
          AND am.create_uid = am.write_uid
          AND am.date >= CURRENT_DATE - INTERVAL '90 days'
          AND ($1::int[] IS NULL OR am.company_id = ANY($1::int[]))
        ORDER BY am.date DESC
        LIMIT 200
    """
    rows = await fetch_fn(db, sql, company_ids)
    return {
        "check_key": "self_approved_je",
        "status": "exceptions" if rows else "pass",
        "exceptions": rows, "count": len(rows),
        "run_at": datetime.utcnow().isoformat(),
    }


async def check_vendor_bank_change(db: str, company_ids: Optional[list],
                                    params: dict, fetch_fn: Callable) -> dict:
    sql = """
        SELECT DISTINCT am.id AS move_id, am.name AS ref,
               am.date AS payment_date,
               rp.name AS vendor_name, am.amount_total
        FROM account_move am
        JOIN res_partner rp ON rp.id = am.partner_id
        WHERE am.state = 'posted'
          AND am.move_type = 'in_invoice'
          AND am.date >= CURRENT_DATE - INTERVAL '60 days'
          AND EXISTS (
              SELECT 1 FROM res_partner_bank rpb
              WHERE rpb.partner_id = am.partner_id
                AND rpb.write_date::date >= am.date - INTERVAL '30 days'
                AND rpb.write_date::date <= am.date
          )
          AND ($1::int[] IS NULL OR am.company_id = ANY($1::int[]))
        ORDER BY am.date DESC
        LIMIT 200
    """
    rows = await fetch_fn(db, sql, company_ids)
    return {
        "check_key": "vendor_bank_change",
        "status": "exceptions" if rows else "pass",
        "exceptions": rows, "count": len(rows),
        "run_at": datetime.utcnow().isoformat(),
    }


async def check_credit_note_no_invoice(db: str, company_ids: Optional[list],
                                        params: dict, fetch_fn: Callable) -> dict:
    sql = """
        SELECT am.id AS move_id, am.name AS ref, am.date,
               rp.name AS partner_name, am.amount_total
        FROM account_move am
        LEFT JOIN res_partner rp ON rp.id = am.partner_id
        WHERE am.state = 'posted'
          AND am.move_type IN ('out_refund','in_refund')
          AND am.reversed_entry_id IS NULL
          AND am.date >= CURRENT_DATE - INTERVAL '180 days'
          AND ($1::int[] IS NULL OR am.company_id = ANY($1::int[]))
        ORDER BY am.date DESC
        LIMIT 200
    """
    rows = await fetch_fn(db, sql, company_ids)
    return {
        "check_key": "credit_note_no_invoice",
        "status": "exceptions" if rows else "pass",
        "exceptions": rows, "count": len(rows),
        "run_at": datetime.utcnow().isoformat(),
    }


CONTROLS_MAP = {
    "dup_vendor_invoices":    check_dup_vendor_invoices,
    "weekend_je":             check_weekend_je,
    "round_number_je":        check_round_number_je,
    "self_approved_je":       check_self_approved_je,
    "vendor_bank_change":     check_vendor_bank_change,
    "credit_note_no_invoice": check_credit_note_no_invoice,
}
