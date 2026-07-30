# AGENTS.md — Smart Inventory Management System

> Compact instruction file for AI agents. Every line here answers "would an agent likely miss this without help?"

---

## Repository layout

```
smart-inventory-management-system/
├── backend/          Python FastAPI + SQLAlchemy + PostgreSQL (Alembic for migrations)
├── frontend/         React 19 + Vite 8 + Tailwind CSS 3
├── AGENTS.md         This file
└── Design.md         *** REQUIRED reading before any frontend work ***
```

No root `package.json` — each project is independent.

---

## Frontend: Design.md is mandatory

**Before building any UI component, read `Design.md` at the project root.** It defines the full Shopifi-inspired design system this project follows.

### Key design rules (light / transactional track — this is a dashboard app):

| Rule | Value |
|---|---|
| Canvas | `#ffffff` (light) or `#fbfbf5` (cream) |
| Ink (text on light) | `#000000` |
| Body type | **Inter Variable** (16px/420 weight for body, 550 for strong, 500 for caption) |
| Heading type | **Neue Haas Grotesk Display** (thin weights 330–500, never 400+ for display tiers) |
| Buttons | **Pill shape only** (`rounded-full` / 9999px) — never rounded rectangles |
| Primary CTA | Filled black pill, white text (`button-primary-pill`) |
| Accent greens | Aloe `#c1fbd4` and pistachio `#d4f9e0` — light track only |
| Elevation for cards | Level 3 stacked tiny shadows on light surfaces |
| Radius scale | xs=4px, sm=5px, md=8px, lg=12px, xl=20px, pill=9999px |
| Spacing scale | 2/4/8/12/16/24/32/64px |
| `font-feature-settings` | `"ss03"` enabled globally across all text |

### Design do-nots (from Design.md):
- No third canvas color — stick to black or light/cream. No greys, beiges, blues as canvases.
- No drop shadows on dark cards beyond subtle inset top-highlight.
- Aloe/pistachio greens are surface fills, never text colors.
- Buttons are always pill-shaped — no rounded-rectangle replacements.

---

## Backend commands (run from `backend/`)

```powershell
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload          # Dev server (hot-reload), Swagger at /docs
alembic revision --autogenerate -m "msg"
alembic upgrade head
python test.py                          # Manual JWT token test (no server needed)
```

### Backend architecture rules (never break)

1. **All stock mutations → `inventory_service.adjust_stock()` only.** Never write `product.quantity = X` in routes. This also creates the `InventoryLog` audit entry.
2. **`adjust_stock` does NOT commit.** The caller owns the transaction boundary. One purchase with N line items adjusts stock atomically for all items in one transaction.
3. **`adjust_stock` uses `SELECT ... FOR UPDATE`** — row-level locking prevents race conditions on concurrent stock changes for the same product.
4. **Errors are plain Python exceptions** (`InsufficientStockError`, `ProductNotFoundError`), not HTTPExceptions. Routes catch and convert them.
5. **Purchase cancellation** reverses stock via `adjust_stock` with `quantity_changed=-item.quantity` and `change_type="PURCHASE_CANCELLED"`. Rejects if stock was already sold.
6. **Sales snapshot `cost_price_at_sale`** on `SaleItem` so P&L stays accurate after supplier prices change. Pre-migration rows have NULL and fall back to `Product.cost_price`.
7. **Auth:** `OAuth2PasswordBearer(tokenUrl="/auth/login")`. Login is form-encoded (`username` = email, `password`). Token payload: `sub`, `user_id`, `role_id`. Admin check: `admin_required(current_user)` → `current_user.role.name.lower() == "admin"`.
8. **Money is always `Decimal` in Python, `Numeric(10,2)` in PostgreSQL** — never float.
9. **Routes own `db.commit()`, services never commit.**
10. **Alembic owns schema changes** — never use `Base.metadata.create_all()`.
11. **All Pydantic schemas use** `model_config = ConfigDict(from_attributes=True)` (v2 style).

### Alembic quirks

- `alembic/env.py` inserts `backend/` into `sys.path` so `from app.xxx` imports work.
- All model classes must be imported in `env.py` for autogenerate to detect them.
- `DATABASE_URL` in `.env` must have `%` escaped as `%%` when passed to Alembic config (already handled in `env.py`).

### Backend endpoints overview

| Prefix | Notes |
|---|---|
| `/auth` | Register, login (form-encoded), `/me`, `/admin-only` |
| `/products` | CRUD with `skip`/`limit` pagination; create/update/delete require admin |
| `/categories` | CRUD with `skip`/`limit` pagination |
| `/suppliers` | CRUD with `skip`/`limit` pagination |
| `/purchases` | Create (with line items → stock increase), `PATCH /{id}/status` state machine |
| `/sales` | Create (with line items → stock decrease), oversell protection |
| `/dashboard` | Summary, activity, low-stock, out-of-stock, inventory-value, top-selling, top-purchased, monthly-sales, monthly-purchases, category-distribution, dead-stock |
| `/reports` | sales, purchases, inventory, profit-loss, stock-valuation, audit-trail — each has paired JSON + CSV export (`/reports/{report}/export`) |
| `/inventory-logs` | Full audit trail (newest first, `?limit=N`), per-product history (`/product/{id}`) |

### Known gaps (backend)

- No pagination on `/sales/` and `/purchases/` — only `?limit=N` supported.
- `Purchase.status` has no `RECEIVED` date timestamp.
- No Python formatter/linter config (no ruff, black, etc.).
- No test suite — only `backend/test.py` for manual JWT verification.

---

## Frontend commands (run from `frontend/`)

```powershell
npm run dev            # Vite dev server (HMR on localhost:5173)
npm run build          # Production build
npm run lint           # ESLint flat config on src/
npm run preview        # Preview production build
```

### Frontend state

- `src/App.jsx` is a stub (single heading). Entrypoint is `src/main.jsx`.
- `src/index.css` loads Tailwind directives.
- Tailwind scans `index.html` + `src/**/*.{js,ts,jsx,tsx}`.
- No proxy configured in `vite.config.js` yet — Axios talks directly to backend.
- No test setup (no vitest, no testing library).

---

## Environment

| | Detail |
|---|---|
| DB URL | `postgresql://postgres:paras%40123@localhost:5432/inventory-management` |
| Backend dev | `http://127.0.0.1:8000`, Swagger at `/docs` |
| Frontend dev | `http://localhost:5173` |
| OS | Windows (PowerShell — use `.\venv\Scripts\Activate.ps1`, not `source`) |

---

## Cross-project

- No CI/CD, no Docker, no deployment config exists.
- Only instruction files: this file + `Design.md` (mandatory for frontend work).
- Root `.gitignore` covers both `backend/.env` and `frontend/node_modules/`.
