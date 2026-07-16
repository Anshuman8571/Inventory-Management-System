# Rules — Libraries, Conventions, Error Handling

## 1. Libraries — use these
| Purpose | Library | Notes |
|---|---|---|
| Web server | `express` | Minimal, well-known, matches skillset |
| DB access | `pg` (node-postgres) | Raw SQL via query modules — no heavy ORM needed at this scale |
| Password hashing | `bcrypt` | Industry standard, simple API |
| Auth tokens | `jsonwebtoken` | Lightweight session handling |
| Env config | `dotenv` | Standard `.env` loading |
| QR/photo capture (frontend) | Native browser `<input type="file" capture="environment">` or `getUserMedia` | No extra QR library needed since we're not decoding QR codes — we're just capturing photos |
| Fuzzy matching | `fastest-levenshtein` or `string-similarity` | Small, dependency-light, sufficient for product-name matching |
| AI extraction | Anthropic API directly via `fetch`/`node-fetch` | No SDK bloat needed for a handful of endpoints |
| Validation | `zod` | Lightweight schema validation for request bodies |

## 2. Libraries — avoid
- **Full ORMs** (Prisma, TypeORM, Sequelize) — adds abstraction and build complexity not needed for ~7 tables and a small team. Raw parameterized SQL is easier to reason about and debug at this scale.
- **Heavy frontend frameworks** (Next.js, Angular) — this is a small number of screens; a lightweight vanilla JS or minimal React setup is enough. Avoid SSR complexity entirely.
- **Barcode/QR scanning libraries** (`jsQR`, `html5-qrcode`) — not needed since v1 has no QR codes; only add these back if a future phase reintroduces printed QR stickers.
- **Multiple competing OCR libraries** (Tesseract.js, Google Vision, etc.) — stick to one extraction path (Claude API vision) rather than juggling fallback OCR engines; keeps extraction logic in one place per the architecture doc.
- **Session-store add-ons** (Redis, connect-session) — JWT is sufficient for 2-3 users; don't add session infrastructure that isn't needed yet.
- **Global state managers** (Redux, MobX) on the frontend — unnecessary for a handful of screens.

## 3. Error handling rules
- Every route handler wraps logic in try/catch and passes errors to a single centralized Express error-handling middleware — no ad-hoc error responses scattered per route.
- API errors return a consistent shape: `{ error: { message, code } }` — frontend always parses errors the same way.
- **AI extraction failures** (Claude API timeout, malformed response, low-confidence extraction) must never silently apply a stock change — if extraction fails or confidence is low, the confirmation screen shows an explicit "Could not read this clearly, please enter manually" state rather than guessing.
- **Never auto-commit a fuzzy match** — any match below a defined confidence threshold must be shown to the user as "possible match, please confirm" rather than applied automatically.
- Database writes for a single confirm action (e.g., bill confirm affecting multiple line items) must be wrapped in a **transaction** — partial application of a bill (some items updated, others failed) is not acceptable; either the whole confirm succeeds or none of it applies.
- Log errors server-side (simple file or console logging is fine at this scale — no need for a full logging platform yet) but never expose raw stack traces or DB errors to the frontend.

## 4. Coding conventions
- **Reuse over duplication**: shared logic (extraction, matching, stock mutation) lives in one service file each, called from multiple controllers — never copy-pasted per flow (see architecture.md §5).
- Keep controllers thin — they parse the request, call a service, return a response. Business logic lives in services, not controllers.
- All SQL lives in named, parameterized queries — no string-concatenated SQL (prevents SQL injection and keeps queries auditable).
- Environment-specific values (DB credentials, JWT secret, API keys) only via environment variables, never hardcoded, never committed to version control.
- Keep the frontend confirmation UI as one shared, parameterized component used by all three entry flows (sticker take-out, sticker add-stock, bill add-stock) rather than three separate implementations.

## 5. Token/cost efficiency rules (for AI extraction calls)
- Keep the AI extraction prompt tight and structured — request only the fields needed (name, size, type, company, qty, price where applicable), returned as JSON, nothing more.
- Compress/resize images client-side before sending to the API (no need to send a 12MP photo when a smaller image reads just as clearly for OCR purposes) — reduces cost per call.
- Don't re-call the extraction API on retries for the same photo unless the user explicitly asks to re-scan — cache the raw extraction result until the confirm/reject action is taken.
- Batch bill line-item extraction into a single API call per bill (one photo, one call returning all items) rather than one call per line item.
