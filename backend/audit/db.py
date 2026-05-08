import hashlib
import hmac
import json
import os
import sqlite3
from datetime import datetime

AUDIT_DB = os.getenv("AUDIT_DB", os.path.join(os.path.dirname(__file__), "..", "data", "audit.db"))
AUDIT_LOG_HASH_SECRET = os.getenv("AUDIT_LOG_HASH_SECRET", "audit-hash-secret-change-in-prod")

CONTROLS_SEED = [
    ("dup_vendor_invoices",    "Duplicate vendor invoices (same vendor, amount, date ±3 days)", "daily"),
    ("weekend_je",             "Manual JEs posted on weekends or outside 07:00–20:00",          "daily"),
    ("round_number_je",        "Round-number JEs above threshold (default 10,000)",             "weekly"),
    ("self_approved_je",       "JEs posted and approved by same user (SoD breach)",             "daily"),
    ("vendor_bank_change",     "Vendor bank account change followed by payment within 30 days", "weekly"),
    ("credit_note_no_invoice", "Credit notes issued without a matching originating invoice",    "weekly"),
]

RISK_AREAS_SEED = ["Revenue", "Procurement", "Payroll", "Cash", "Inventory", "IT"]


def get_audit_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(AUDIT_DB)), exist_ok=True)
    return sqlite3.connect(AUDIT_DB, check_same_thread=False)


def init_audit_db():
    c = get_audit_conn()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS audit_engagement (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            type          TEXT    NOT NULL CHECK(type IN ('internal','external')),
            title         TEXT    NOT NULL,
            period_from   TEXT    NOT NULL,
            period_to     TEXT    NOT NULL,
            status        TEXT    NOT NULL DEFAULT 'planning',
            lead_auditor  TEXT,
            dbs           TEXT    NOT NULL DEFAULT '[]',
            created_by    TEXT,
            created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pbc_item (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            engagement_id  INTEGER NOT NULL,
            ref            TEXT    NOT NULL,
            description    TEXT    NOT NULL,
            owner          TEXT,
            due_date       TEXT,
            status         TEXT    NOT NULL DEFAULT 'open',
            evidence_paths TEXT    NOT NULL DEFAULT '[]',
            comments       TEXT    NOT NULL DEFAULT '[]',
            created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_finding (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            engagement_id       INTEGER NOT NULL,
            severity            TEXT    NOT NULL DEFAULT 'medium',
            title               TEXT    NOT NULL,
            description         TEXT,
            recommendation      TEXT,
            owner               TEXT,
            due_date            TEXT,
            status              TEXT    NOT NULL DEFAULT 'open',
            root_cause          TEXT,
            management_response TEXT,
            retest_date         TEXT,
            created_by          TEXT,
            created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_sample (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            engagement_id    INTEGER NOT NULL,
            db               TEXT    NOT NULL,
            population_query TEXT,
            method           TEXT    NOT NULL,
            params_json      TEXT    NOT NULL DEFAULT '{}',
            seed             INTEGER NOT NULL DEFAULT 42,
            items_json       TEXT    NOT NULL DEFAULT '[]',
            status           TEXT    NOT NULL DEFAULT 'draft',
            created_by       TEXT,
            created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tb_snapshot (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            db           TEXT    NOT NULL,
            period       TEXT    NOT NULL,
            locked_at    TEXT    NOT NULL,
            locked_by    TEXT    NOT NULL,
            payload_json TEXT    NOT NULL,
            hash         TEXT    NOT NULL,
            UNIQUE(db, period)
        );

        CREATE TABLE IF NOT EXISTS risk_register (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            db         TEXT    NOT NULL,
            area       TEXT    NOT NULL,
            risk       TEXT,
            likelihood INTEGER NOT NULL DEFAULT 3 CHECK(likelihood BETWEEN 1 AND 5),
            impact     INTEGER NOT NULL DEFAULT 3 CHECK(impact     BETWEEN 1 AND 5),
            control    TEXT,
            owner      TEXT,
            status     TEXT    NOT NULL DEFAULT 'open',
            created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sod_conflict (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            db                TEXT NOT NULL,
            odoo_user_id      INTEGER,
            odoo_username     TEXT,
            conflicting_roles TEXT NOT NULL DEFAULT '[]',
            detected_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status            TEXT NOT NULL DEFAULT 'open'
        );

        CREATE TABLE IF NOT EXISTS controls_check (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            key                  TEXT    UNIQUE NOT NULL,
            description          TEXT    NOT NULL,
            frequency            TEXT    NOT NULL DEFAULT 'on_demand',
            last_run             TEXT,
            last_status          TEXT,
            exceptions_count     INTEGER NOT NULL DEFAULT 0,
            last_exceptions_json TEXT    NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            ts           TEXT    NOT NULL,
            user_id      TEXT,
            username     TEXT,
            action       TEXT    NOT NULL,
            target_type  TEXT,
            target_id    TEXT,
            db           TEXT,
            ip           TEXT,
            payload_json TEXT    NOT NULL DEFAULT '{}',
            prev_hash    TEXT    NOT NULL,
            hash         TEXT    NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pbc_engagement  ON pbc_item(engagement_id);
        CREATE INDEX IF NOT EXISTS idx_finding_eng     ON audit_finding(engagement_id);
        CREATE INDEX IF NOT EXISTS idx_sample_eng      ON audit_sample(engagement_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_ts    ON audit_log(ts);
        CREATE INDEX IF NOT EXISTS idx_risk_db_area    ON risk_register(db, area);
    """)
    c.commit()

    # Seed controls_check
    for key, desc, freq in CONTROLS_SEED:
        c.execute(
            "INSERT OR IGNORE INTO controls_check (key, description, frequency) VALUES (?,?,?)",
            (key, desc, freq),
        )

    # Seed risk_register with default areas per DB if empty
    if c.execute("SELECT COUNT(*) FROM risk_register").fetchone()[0] == 0:
        for db in ["ogh-live", "77asia", "seeenviro"]:
            for area in RISK_AREAS_SEED:
                c.execute(
                    "INSERT INTO risk_register (db, area, risk) VALUES (?,?,?)",
                    (db, area, f"Default {area.lower()} risk — assess and update"),
                )

    c.commit()
    c.close()


def _compute_log_hash(prev_hash: str, ts: str, username: str,
                       action: str, payload: str) -> str:
    raw = f"{prev_hash}|{ts}|{username}|{action}|{payload}"
    return hmac.new(
        AUDIT_LOG_HASH_SECRET.encode(), raw.encode(), hashlib.sha256,
    ).hexdigest()


def append_audit_log(conn: sqlite3.Connection, user_id: str, username: str,
                      action: str, target_type: str, target_id: str,
                      db: str, ip: str, payload: dict) -> int:
    ts = datetime.utcnow().isoformat()
    payload_json = json.dumps(payload, default=str)

    last = conn.execute(
        "SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1"
    ).fetchone()
    prev_hash = last[0] if last else "GENESIS"

    row_hash = _compute_log_hash(prev_hash, ts, username or "", action, payload_json)

    conn.execute(
        """INSERT INTO audit_log
           (ts, user_id, username, action, target_type, target_id, db, ip, payload_json, prev_hash, hash)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (ts, str(user_id or ""), username or "", action,
         target_type or "", str(target_id or ""), db or "",
         ip or "", payload_json, prev_hash, row_hash),
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def verify_audit_log(conn: sqlite3.Connection) -> dict:
    rows = conn.execute(
        "SELECT id, ts, username, action, payload_json, prev_hash, hash FROM audit_log ORDER BY id"
    ).fetchall()
    if not rows:
        return {"ok": True, "rows_checked": 0}

    broken = []
    for i, row in enumerate(rows):
        rid, ts, username, action, payload_json, prev_hash, stored_hash = row
        expected_prev = rows[i - 1][6] if i > 0 else "GENESIS"
        if prev_hash != expected_prev:
            broken.append(rid)
            continue
        expected_hash = _compute_log_hash(prev_hash, ts, username, action, payload_json)
        if stored_hash != expected_hash:
            broken.append(rid)

    return {
        "ok": len(broken) == 0,
        "rows_checked": len(rows),
        "broken_count": len(broken),
        "first_broken_id": broken[0] if broken else None,
    }
