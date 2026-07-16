# Architecture — Stock Inventory Management System

## 1. High-level architecture

```
[ Phone Browser (PWA) ]
        |
        |  HTTPS
        v
[ Express API Server ] ---- [ PostgreSQL DB ]
        |
        |  (calls out to)
        v
[ Claude API (vision) ]  -- used only for extraction from sticker/bill photos
```

Single backend service, single database, no microservices — deliberately kept simple given the scale (2-3 users, small catalog).

## 2. App flow

### Take-Out Flow
```
User opens app → selects category → takes photo of sticker
  → POST /scan → backend calls Claude API vision extraction
  → backend fuzzy-matches extracted text against products table
  → returns match (or "new product") + extracted fields to frontend
  → user reviews/edits on confirmation screen → submits
  → POST /scan/:id/confirm → backend writes:
       - scan_events row (raw + final data)
       - stock_movements row (negative change_qty)
       - updates products.current_qty
```

### Add-Stock Flow (Bill)
```
User takes photo of bill → POST /bills
  → backend calls Claude API vision extraction (multi-item)
  → backend fuzzy-matches each line item
  → returns line items + match suggestions + extracted prices
  → user reviews table, corrects/confirms each row
  → POST /bills/:id/confirm → backend writes, per line item:
       - bill_line_items updated (confirmed = true)
       - stock_movements row (positive change_qty)
       - price_history row (with price-change flag pre-computed)
       - updates products.current_qty and last_known_price
```

### Add-Stock Flow (Individual sticker)
Same as Take-Out mechanically, but flow_type = 'add_stock' and change_qty is positive.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express | Matches existing skillset, simple REST API needs |
| Database | PostgreSQL | Relational fit for products/movements/history; JSONB support for flexible attributes |
| AI extraction | Claude API (vision) | Handles OCR + structured extraction from photos in one call |
| Auth | JWT + bcrypt | Lightweight, no external auth service needed for 2-3 users |
| Frontend | Single-page web app (vanilla JS or lightweight framework), installable as PWA | No app-store distribution needed; phone camera access via browser |
| Containerization | Docker + docker-compose | Enables lift-and-shift from cloud to Raspberry Pi later |
| Hosting (phase 1) | Railway / Render (small VPS-style host) | Cheap, quick to deploy Docker + Postgres |
| Hosting (phase 2) | Raspberry Pi + Tailscale | Near-zero recurring cost, private network access only |

## 4. Folder & file structure

```
stock-inventory/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── src/
│   │   ├── index.js                # app entrypoint
│   │   ├── config/
│   │   │   └── db.js               # Postgres connection pool
│   │   ├── middleware/
│   │   │   ├── auth.js             # JWT verification
│   │   │   └── requireRole.js      # role-gating helper
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── scan.routes.js
│   │   │   ├── bills.routes.js
│   │   │   └── products.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── scan.controller.js
│   │   │   ├── bills.controller.js
│   │   │   └── products.controller.js
│   │   ├── services/
│   │   │   ├── extraction.service.js   # Claude API calls, shared by scan + bills
│   │   │   ├── matching.service.js     # fuzzy-match logic, shared
│   │   │   ├── inventory.service.js    # shared stock-change logic (used by both flows)
│   │   │   └── pricing.service.js      # price comparison logic
│   │   ├── models/
│   │   │   └── (SQL query modules per table)
│   │   └── utils/
│   │       └── logger.js
│   ├── migrations/                 # SQL migration files, one per schema change
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── public/
│   │   ├── index.html              # single scan-flow entry screen
│   │   ├── manifest.json           # PWA manifest
│   │   └── icons/
│   ├── src/
│   │   ├── scan.js                 # camera capture + QR/photo submission
│   │   ├── confirm.js              # confirmation screen logic (shared component for both flows)
│   │   ├── owner-view.js           # products/history/reports view
│   │   └── api.js                  # single shared fetch wrapper for all API calls
│   └── Dockerfile
├── prd.md
├── architecture.md
├── rules.md
├── phases.md
├── design.md
└── memory.md
```

**Reuse principle baked into structure**: `inventory.service.js` and `matching.service.js` and `extraction.service.js` are shared by both the sticker flow and the bill flow — no duplicated logic between take-out/add-stock/bill paths. The frontend `confirm.js` component is also shared/parameterized across all three entry points rather than building three separate confirmation screens.

## 5. Data flow ownership
- **Extraction logic** (calling Claude API, parsing response into structured fields) lives in exactly one service, called by both scan and bill controllers.
- **Matching logic** (fuzzy string match against products) lives in exactly one service, used identically regardless of entry method.
- **Stock mutation logic** (apply change_qty, write movement, update products.current_qty) lives in exactly one service — the only place that ever writes to `stock_movements` or updates `current_qty`.

This avoids the common failure mode of "three flows, three slightly different copies of the same logic that drift apart over time."
