# Phases — Build Plan

## Phase 0 — Project setup
- Repo structure per architecture.md.
- Docker + docker-compose skeleton (backend + Postgres).
- `.env.example` with required variables (DB creds, JWT secret, Anthropic API key).
- Base Express app with health-check endpoint.
- DB migrations for core tables: `users`, `products`, `stock_movements`.

**Goal**: empty but running app, deployable, connected to DB.

## Phase 1 — Auth & roles
- `users` table + seed script to create owner + staff accounts manually.
- Login endpoint (`POST /auth/login`) issuing JWT.
- Auth middleware + role-gating middleware.
- Minimal login screen on frontend.

**Goal**: only known users can reach any further functionality.

## Phase 2 — Take-Out flow (sticker scan, single product)
- `POST /scan` — accepts photo + category, calls extraction service, calls matching service, returns result.
- `POST /scan/:id/confirm` — applies stock decrement via inventory service, writes `scan_events` + `stock_movements`.
- Frontend: category selector → camera capture → confirmation screen → confirm action.
- New-product detection and inline "add new product" path.

**Goal**: staff can scan a product sticker and successfully reduce stock, end to end.

## Phase 3 — Add-Stock flow (individual sticker)
- Reuses Phase 2's extraction/matching/confirmation components with `flow_type = 'add_stock'` and positive `change_qty`.
- No new backend logic beyond flow_type branching in the shared inventory service.

**Goal**: staff can add stock one item at a time using the same UI pattern as take-out.

## Phase 4 — Add-Stock flow (bill photo, bulk)
- `bills` and `bill_line_items` tables.
- `POST /bills` — accepts bill photo, extracts multiple line items in one AI call.
- Fuzzy-match each line item; return match suggestions.
- `POST /bills/:id/confirm` — transactional bulk confirm: updates stock + records price per line item.
- Frontend: bill photo capture → editable confirmation table → bulk confirm.

**Goal**: a full supplier bill can be photographed and applied to inventory in one flow.

## Phase 5 — Price tracking & comparison
- `price_history` table + `products.last_known_price` column.
- Price comparison logic in `pricing.service.js`, triggered during bill confirmation.
- Confirmation table UI shows price-change flags (increase/decrease/same/first-time).

**Goal**: every bill-based stock addition also tracks and flags price changes.

## Phase 6 — Owner reporting view
- `GET /products` (role-aware field visibility).
- `GET /products/:id/history` — movement + price history for one product.
- Simple owner-only screen: product list, current quantities, low-stock flags, price trend per product.

**Goal**: owner has visibility beyond the daily scan screen.

## Phase 7 — Hardening & migration readiness
- HTTPS setup (or confirm host provides it).
- Automated DB backup script/schedule.
- Review error handling against rules.md across all endpoints.
- Verify docker-compose setup runs identically on a test Raspberry Pi (or Pi-equivalent) environment.

**Goal**: production-ready on cloud, and confirmed portable to the Pi migration path.

## Phase 8 — Cloud → Raspberry Pi migration (when ready)
- Export/import DB data.
- Deploy same Docker containers on Pi.
- Set up Tailscale for private remote access.
- Decommission cloud hosting once validated on Pi.

---

**Sequencing rationale**: Phases 2 and 3 deliberately come before Phase 4, since the single-item sticker flow is simpler and validates the extraction/matching/confirmation pattern before the more complex bulk-bill flow reuses it. Pricing (Phase 5) is layered on top of an already-working add-stock flow rather than built in parallel, avoiding rework if the core flow changes during Phase 4.
