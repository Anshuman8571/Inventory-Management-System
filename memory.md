# Memory — Project State Log

> Purpose: this file is the single source of truth for "what has been decided and built so far." Update it after every meaningful change so a new chat/session can pick up context instantly without re-reading the whole conversation history. Newest entries at the top of the log; keep the "Current State" section always accurate and current (don't just append — update it).

## Current State (as of last update)

**Stage**: Phase 2 (Take-Out flow) complete. Phase 3 (Add-Stock via individual sticker) is next — should be a thin layer on top of Phase 2, since scan.js/scan.controller.js already branch on flowType.

**Environment notes (local dev machine)**: frontend host port moved 8080 → 8082 (port conflict). Postgres host port moved 5432 → 5433 (port conflict with old Phase 1 containers/local Postgres) — this only affects connecting a local DB tool directly from Windows; the backend still talks to `db` over the internal Docker network regardless. Also fixed a docker-compose validation warning: `volumes: db_data:` → `volumes: db_data: {}` (explicit empty mapping).

**Confirmed product decisions**:
- No QR codes exist on products — all stock changes go through phone photo + AI extraction + human confirmation.
- Two flows: Take-Out (sticker scan, decrement) and Add-Stock (bill photo bulk OR individual sticker scan, increment).
- Pricing tracked via bill flow only; price compared against last known price and flagged at confirmation.
- Single `products` table with `category` + JSONB `attributes` (not split per category — CPVC/PVC/Paint share one table).
- Full audit trail via `scan_events`, `stock_movements`, `price_history`.
- Two roles: Owner (full access) and Staff (scan flows only, no delete, limited price visibility).
- Auth: simple username/password (bcrypt) + JWT, no complex auth system.
- Hosting: cloud first (Railway/Render) to validate, migrate later to Raspberry Pi + Tailscale.
- Only 2-3 concurrent users expected — architecture deliberately kept simple (no ORM, no microservices, no Redis).
- Reuse principle: extraction/matching/stock-mutation logic each live in exactly one shared service, used by all flows — not duplicated per flow.

**Not yet decided / open items**:
- Exact confidence threshold for fuzzy matching (needs tuning once real sticker photos are tested).
- Whether staff can see cost prices at all, or only owner (currently leaning "owner only" but not finalized).
- Specific low-stock alert delivery method (in-app only vs. notification of some kind) — not yet discussed.
- Paint tinting/colorant tracking (explicitly deferred, future phase, not designed yet).

## Reference documents
- `prd.md` — requirements, users, features, scope boundaries.
- `architecture.md` — app flow, tech stack, folder structure.
- `rules.md` — libraries to use/avoid, error handling, coding conventions, token-efficiency rules.
- `phases.md` — build order, Phase 0 through Phase 8.
- `design.md` — color palette, typography, layout, UX principles.

## Log

### [Entry 5] Fix — Android camera capture "low memory" error
- Issue found during real-phone testing (Phase 2 flow): tapping a category opened the phone camera, but Android threw a native "unable to complete the previous operation due to low memory" error and nothing happened after taking the photo.
- Root cause: `camera.js` was setting `input.capture = 'environment'`, which forces a direct hand-off to the native camera app via an Android intent. On some devices this fails when the browser process gets suspended while the camera app is open — a known issue with this specific attribute, not an app logic bug.
- Fix: removed `capture = 'environment'` from the file input — the OS now shows its normal picker (Camera / Gallery / Files) instead of forcing a direct camera intent, which is more stable across devices.
- Also added client-side image resizing (`resizeImage` in `camera.js`, via canvas — caps at 1600px longest side, JPEG quality 0.8) before the photo is sent anywhere. This reduces memory pressure holding a full-resolution phone photo and also satisfies the rules.md token-efficiency guidance (smaller images = cheaper/faster AI extraction calls). This was a planned improvement that got pulled forward while already in this file.
- Testing note: environment confirmed working end-to-end from PC browser → phone hotspot IP; camera capture flow was the one open item, now fixed. Should retest on the actual phone to confirm the picker-based approach resolves the low-memory error.

### [Entry 4] Phase 2 — Take-Out flow completed
- Backend models: `products.model.js` (findByCategory, findById, create, incrementQty, list — all accept an optional transaction `client`), `scanEvents.model.js` (create, findById, findByIdForUpdate with row locking, confirm), `stockMovements.model.js` (create, findByProduct).
- Backend services: `extraction.service.js` (calls Claude API directly via `fetch`, model = `claude-haiku-4-5-20251001` deliberately chosen over Sonnet/Opus for cost, since this runs on every scan — see rules.md token-efficiency section), `matching.service.js` (Levenshtein-based similarity, `MATCH_THRESHOLD = 0.75`, returns null below threshold so caller treats it as "new product" rather than a shaky auto-match), `inventory.service.js` (the one and only place that mutates `products.current_qty` or writes `stock_movements` — wraps everything in a Postgres transaction with row-locking via `FOR UPDATE` to prevent double-confirming the same scan).
- `POST /scan` (extract + match, creates a *pending* scan_events row, nothing written to inventory yet) and `POST /scan/:id/confirm` (the only step that actually changes stock) — both behind `requireAuth`.
- Frontend: `camera.js` (native file-input capture, shared for future bill photos too), `categorySelect.js`, `confirmCard.js` (the status-colored card — green/amber — this is the design system's signature element per design.md §6), `scan.js` (orchestrates category → photo → confirm → success, loops back to "scan next item"). `auth.js` updated to launch this real flow instead of the Phase 1 placeholder.
- `styles.css` extended with `.status-card`/`.status-success`/`.status-warning`, `.category-grid`/`.btn-category`, `.btn-secondary` — all using the existing design.md color tokens, nothing new invented.
- **Local environment note**: frontend host port changed from 8080 → 8082 due to a local port conflict on the dev machine. `docker-compose.yml` updated to match.
- Known simplification for this phase: if a take-out drops a product's quantity below zero, it's allowed (not blocked) — just logged as a server-side warning. Revisit if this becomes a real problem in practice.
- Not yet built: Add-Stock (Phase 3), bill flow (Phase 4), pricing (Phase 5), owner reporting view (Phase 6).
- Next step: Phase 3 — Add-Stock via individual sticker. Should mostly be wiring the existing scan.js/confirmCard.js to call `startScanFlow(container, { flowType: 'add_stock' })` from a new entry point (a way for the user to choose Take-Out vs Add-Stock before the category picker), since the backend already branches correctly on `flowType`.

### [Entry 3] Phase 1 — Auth & roles completed
- Backend: `models/users.model.js` (findByUsername, create), `validators/auth.validator.js` (zod login schema), `controllers/auth.controller.js` (login issues JWT with 12h expiry, generic "invalid username or password" message to avoid leaking which usernames exist; `/auth/me` endpoint added to verify a token is valid), `middleware/auth.js` (requireAuth — verifies Bearer JWT), `middleware/requireRole.js` (role gate, e.g. `requireRole('owner')`), `routes/auth.routes.js` (POST /auth/login, GET /auth/me).
- `scripts/seedUsers.js` — CLI script: `node scripts/seedUsers.js <username> <password> <owner|staff>`. No public signup, matches prd.md's "owner creates accounts manually" decision. Re-running with an existing username currently errors out (no accidental overwrite) — this is the current behavior, flagged here in case we want upsert-on-rerun behavior later instead.
- Frontend: `public/index.html` (login form, single entry point), `src/auth.js` (login submit handler, session check via /auth/me on load, placeholder "Logged in" state shown in-place since Phase 2 hasn't built the real scan screen yet — this is a single-page app, screens swap in place rather than separate HTML files), `src/api.js` and `src/styles.css` (already existed, consistent with design.md tokens).
- **Architecture decision made during this phase**: frontend and backend are same-origin via an nginx reverse proxy (`frontend/nginx.conf` proxies `/auth/`, `/scan/`, `/bills/`, `/products/`, `/health` to the backend container) rather than using CORS. Chosen because it avoids adding a CORS dependency to the backend and the same reverse-proxy pattern carries over unchanged to the Raspberry Pi migration later.
- `frontend/Dockerfile` (nginx:alpine serving public/ + src/ + the custom nginx.conf) and `docker-compose.yml` updated to add the `frontend` service on port 8080.
- Known gap: PWA icons (`icons/icon-192.png`, `icon-512.png`) referenced in `manifest.json` don't exist as real image files yet — not blocking functionality, just cosmetic/install-icon polish for later.
- Next step: Phase 2 — Take-Out flow (category selector, camera capture, POST /scan + POST /scan/:id/confirm, extraction + matching services, confirmation screen replacing the current placeholder).

### [Entry 2] Phase 0 — Project scaffolding completed
- Created full folder structure per architecture.md (backend/frontend split, all subfolders).
- Root files: `docker-compose.yml` (backend + Postgres services, healthcheck-gated startup), `.env.example`, `.gitignore`.
- Backend: `package.json` with approved dependency list only (express, pg, bcrypt, jsonwebtoken, dotenv, zod, fastest-levenshtein — no ORM), `Dockerfile`, `.dockerignore`.
- Backend core app: `config/env.js` (validates required env vars on startup, fails fast), `config/db.js` (single shared Postgres pool), `app.js` (Express setup + health-check endpoint + centralized error handler wiring), `index.js` (entrypoint), `middleware/errorHandler.js`.
- **Deviation from original phases.md note**: migration order was adjusted — `scan_events` had to be created *before* `stock_movements` (migration 003, not 004) because `stock_movements.scan_event_id` references `scan_events(id)`. Final order: 001 users, 002 products, 003 scan_events, 004 stock_movements. `bills`, `bill_line_items`, `price_history` migrations are deferred to Phase 4/5 as originally planned.
- `scripts/migrate.js` created — runs all `.sql` files in `/migrations` in filename order, idempotent (`CREATE TABLE IF NOT EXISTS`).
- `seedUsers.js` and the auth system itself are intentionally deferred to Phase 1 — removed the `seed:users` npm script reference from package.json until that file exists.
- Not yet built: any routes/controllers/services/models (all Phase 1+), frontend files (Phase 2+).
- Next step: Phase 1 — users table seed script, login endpoint, JWT middleware, role-gating middleware, minimal login screen.

### [Entry 1] Planning phase completed
- Defined full product scope through iterative discussion: started as general stock system idea, narrowed to inventory-only v1, added bill scanning, resolved no-QR-code reality (switched to photo+AI extraction for all flows), added pricing comparison, resolved single-table-with-JSONB-attributes data model question, added security/auth plan.
- Produced all five planning documents (prd, architecture, rules, phases, design).
- Next step: begin Phase 0 (project scaffolding, Docker setup, base Express app, initial migrations).

---

**Instructions for updating this file going forward**: after any decision, completed phase, schema change, or scope change, update the "Current State" section directly (don't leave it stale) and add a new dated/numbered entry to the Log describing what changed and why. Keep entries short — this file should stay fast to read in full at the start of a new session.
