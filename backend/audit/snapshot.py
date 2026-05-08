import hashlib
import json
from datetime import datetime


def compute_snapshot_hash(db: str, period: str, locked_by: str, payload: dict) -> str:
    raw = json.dumps(
        {"db": db, "period": period, "locked_by": locked_by, "payload": payload},
        sort_keys=True, default=str,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


async def lock_tb_snapshot(audit_conn, db: str, period: str, locked_by: str,
                            company_ids, fetch_fn) -> dict:
    year, month = map(int, period.split("-"))
    tb_sql = """
        SELECT aa.code  AS account_code,
               aa.name  AS account_name,
               aa.account_type,
               COALESCE(SUM(aml.debit),  0)              AS total_debit,
               COALESCE(SUM(aml.credit), 0)              AS total_credit,
               COALESCE(SUM(aml.debit - aml.credit), 0)  AS balance
        FROM account_account aa
        LEFT JOIN account_move_line aml ON aml.account_id = aa.id
        LEFT JOIN account_move am ON am.id = aml.move_id
            AND am.state = 'posted'
            AND (
                EXTRACT(YEAR  FROM am.date)::int < $1
                OR (EXTRACT(YEAR  FROM am.date)::int = $1
                    AND EXTRACT(MONTH FROM am.date)::int <= $2)
            )
            AND ($3::int[] IS NULL OR am.company_id = ANY($3::int[]))
        GROUP BY aa.code, aa.name, aa.account_type
        ORDER BY aa.code
    """
    rows = await fetch_fn(db, tb_sql, year, month, company_ids)
    payload = {"rows": rows, "period": period, "db": db}
    snap_hash = compute_snapshot_hash(db, period, locked_by, payload)
    locked_at = datetime.utcnow().isoformat()

    try:
        audit_conn.execute(
            """INSERT INTO tb_snapshot (db, period, locked_at, locked_by, payload_json, hash)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (db, period, locked_at, locked_by, json.dumps(payload, default=str), snap_hash),
        )
        audit_conn.commit()
        snap_id = audit_conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        return {
            "id": snap_id, "db": db, "period": period,
            "locked_at": locked_at, "locked_by": locked_by,
            "hash": snap_hash, "row_count": len(rows),
        }
    except Exception as e:
        if "UNIQUE" in str(e):
            raise ValueError(f"Trial balance for {db}/{period} is already locked")
        raise


async def get_post_lock_adjustments(audit_conn, snapshot_id: int, fetch_fn) -> dict:
    row = audit_conn.execute(
        "SELECT db, period, locked_at FROM tb_snapshot WHERE id=?", (snapshot_id,)
    ).fetchone()
    if not row:
        return {"adjustments": [], "count": 0}
    db, period, locked_at = row
    year, month = map(int, period.split("-"))

    adj_sql = """
        SELECT am.id, am.name AS ref, am.date, am.write_date,
               ru.login  AS posted_by,
               am.narration,
               SUM(ABS(aml.debit)) AS total_amount
        FROM account_move am
        JOIN account_move_line aml ON aml.move_id = am.id
        LEFT JOIN res_users ru ON ru.id = am.write_uid
        WHERE am.state = 'posted'
          AND EXTRACT(YEAR  FROM am.date)::int  = $1
          AND EXTRACT(MONTH FROM am.date)::int  = $2
          AND am.write_date > $3
        GROUP BY am.id, am.name, am.date, am.write_date, ru.login, am.narration
        ORDER BY am.write_date DESC
        LIMIT 500
    """
    rows = await fetch_fn(db, adj_sql, year, month, locked_at)
    return {"snapshot_id": snapshot_id, "adjustments": rows, "count": len(rows)}
