# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: A-CFO — AI Finance Dashboard

A full-stack finance dashboard for **Olive Green Holding** that reads live data from three Odoo PostgreSQL databases and presents P&L, balance sheet, AR/AP aging, cash, invoices, transactions, and AI chat in a dark-themed React UI.

- **Production URL:** https://AICFO.olivegreenholding.com
- **Repo:** https://github.com/ogh-git/AI-CFO-Finance-
- **Default login:** `admin` / `admin123`

---

## Running locally

Both servers must run simultaneously. The Vite dev server proxies `/api/*` to the FastAPI backend on port 8000.

**Backend** (Python 3.14 via `uv`):
```bash
cd backend
uv run --with fastapi --with "uvicorn[standard]" --with asyncpg --with python-dotenv \
  --with "bcrypt>=4.0.0" --with "python-jose[cryptography]" \
  uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → frontend/dist/
```

**Docker (production):**
```bash
docker compose up -d --build   # backend :8000, frontend :3000
docker compose logs -f
```

After a `git pull` on the server: `docker compose up -d --build`

---

## Environment variables (`.env` in repo root)

| Variable | Purpose |
|---|---|
| `DB_HOST` | PostgreSQL host (`89.167.21.153`) |
| `DB_PORT` | PostgreSQL port (`22345`) |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | DB password |
| `JWT_SECRET` | HS256 signing key for user tokens |
| `ANTHROPIC_API_KEY` | Optional — enables AI chat via Claude Haiku |
| `USERS_DB` | SQLite path for auth users (defaults to `backend/data/users.db`) |

---

## Architecture

```
repo/
├── backend/
│   ├── main.py          # entire FastAPI app (~1350 lines)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── data/users.db    # SQLite — auth users only
└── frontend/
    ├── src/
    │   ├── App.jsx       # root component — all state, data fetching, layout
    │   ├── api.js        # fetch wrappers + 45s response cache + fmt/fmtDate helpers
    │   ├── index.css     # single global stylesheet (dark GitHub theme)
    │   └── components/   # pure display components
    └── vite.config.js    # proxy /api → localhost:8000
```

### Backend (`backend/main.py`)

Single-file FastAPI app. No ORM — all queries are raw asyncpg SQL against Odoo schema tables (`account_move`, `account_move_line`, `account_account`, `res_partner`, etc.).

**Three live PostgreSQL databases** — each is a separate Odoo instance:
- `ogh-live` → OGH Live
- `77asia` → 77 Asia
- `seeenviro` → SEE Enviro

Every data endpoint accepts `?db=<name>&company_ids=1,2,3` query params. `company_ids` filters by Odoo `res_company.id` (sub-entities within a database). Pass `$1::int[]` in SQL and call `parse_ids()` helper.

**Auth** uses SQLite (`users.db`) for user records and JWT (HS256, 24h expiry) for session tokens. `passlib` was removed — passwords are hashed/verified directly with the `bcrypt` library via a thin `_PwdCtx` wrapper class. The auth middleware exempts `/api/auth/login` and `/api/health`.

**Optional deps** guarded by try/import flags: `XLSX_OK` (openpyxl), `PDF_OK` (reportlab), `ANT_OK` (anthropic). The app starts fine without them — those endpoints return 501.

**Key endpoints:**

| Endpoint | What it returns |
|---|---|
| `GET /api/kpis` | Month + YTD revenue/expense/profit/margin + AR/AP totals |
| `GET /api/monthly-pnl` | Last 12 months revenue/expense/net_profit per month |
| `GET /api/yearly-summary` | Annual totals with margin % (all years) |
| `GET /api/pnl-detail` | Account-level P&L breakdown for a specific month |
| `GET /api/balance-sheet` | Asset/Liability/Equity balances |
| `GET /api/ar-aging` / `ap-aging` | 5-bucket aging summary |
| `GET /api/ar-customers` / `ap-vendors` | Per-partner aging detail |
| `GET /api/cash` | Recent bank/cash journal entries |
| `GET /api/invoices` | Recent invoices with aging bucket |
| `GET /api/purchase-orders` | Recent POs |
| `GET /api/journals` | Journal summary |
| `GET /api/partners` | Customer/vendor master |
| `GET /api/trial-balance` | Full trial balance |
| `POST /api/export/excel` | 6-sheet Excel workbook |
| `POST /api/export/pdf` | Multi-page PDF report |
| `POST /api/chat` | AI CFO answer (Claude Haiku) |

### Frontend (`frontend/src/`)

**`App.jsx`** owns all state and data fetching. Key state:
- `selectedDbs` — which of the 3 databases are active (`[]` = all)
- `selectedEntities` — Odoo `res_company` IDs within a single DB (`[]` = all)
- `selectedMonths` / `selectedYears` — multi-select period (`[]` = all); drives both the Period KPI row (computed from `monthlyPnl`) and the Year Total KPI row (computed from `yearlySummary`)
- `primaryYear` / `primaryMonth` — `Math.max()` of selected; used for API calls that need a single period (`kpis`, `pnlDetail`)

When multiple DBs are selected, `App.jsx` fires parallel requests per-DB and merges results with `mergeKpis`, `mergeMonthlyPnl`, `mergeAging`, etc. helper functions.

**`api.js`** — 45-second in-memory response cache keyed by URL path. Call `clearApiCache()` before a manual refresh. `fmt(n)` formats numbers (compact: K/M, full: locale). `fmtDate(s)` → `DD Mon YYYY`.

**`index.css`** — single file, CSS custom properties for the dark theme (`--bg`, `--surface`, `--primary`, etc.). Key layout classes: `.app-layout` (sidebar + main), `.kpi-grid-3` / `.kpi-grid-2` (KPI card rows), `.kpi-row-group` (label + grid unit), `.charts-row` (2fr 1fr 1fr), `.tables-row` (1fr 1fr).

**`MultiSelectDropdown.jsx`** — reusable dropdown; `selected=[]` means "all selected" (same convention as company/entity selectors throughout the app).

### Summary page layout

```
[Period label]   [Revenue] [Expense] [Net Profit]   ← from monthlyPnl (last 12 months)
[Year Total label] [Revenue] [Expense] [Net Profit] ← from yearlySummary
[Outstanding]    [AR] [AP]
[Monthly chart 12m] [AR donut] [AP donut]
[AR by Customer table] [AP by Vendor table]
```

---

## Key patterns to follow

- **Adding a new API endpoint:** add `@app.get("/api/my-endpoint")` to `main.py`, mirror it in `api.js` as `api.myEndpoint(db, ids) => get(...)`, fetch it inside `fetchAll` in `App.jsx`.
- **Adding a new KPI card:** use `<KPICard label="" value={} sub="" badge={} color="" />` inside a `.kpi-grid-3` or `.kpi-grid-2` div wrapped in a `.kpi-row-group`.
- **`company_ids` SQL pattern:** always pass as `$N::int[]` and check `IS NULL OR id = ANY(...)`.
- **Multi-DB merge:** period KPIs and year KPIs are derived with `useMemo` from already-loaded `monthlyPnl` / `yearlySummary` — no extra API calls.
- **Auth roles:** `admin` can manage users; `viewer` is read-only. Check `caller.get("role") != "admin"` in backend endpoints that mutate.
