# PRD — Stock Inventory Management System

## 1. Purpose
A simple stock inventory system for a shop dealing in CPVC fittings, PVC fittings, and paints. The system tracks stock **in** (new deliveries) and stock **out** (godown pickups) using phone-photo scanning of product stickers and supplier bills, with AI-based extraction and mandatory human confirmation before any inventory change is applied.

The system does not aim to be a full ERP/POS. It is scoped tightly to: inventory quantity tracking + purchase price tracking.

## 2. Problem statement
- No QR codes or barcodes exist on products — products only have manufacturer-printed stickers with details like name, size, type, and company.
- Stock counts are currently manual/untracked, making it hard to know real-time quantity or catch price changes from suppliers.
- The shop owner wants a low-friction way for staff to update inventory without needing technical knowledge.

## 3. Target users
- **Owner** (Anshuman): full access — manages products, views reports, price history, stock history. Only person who can edit/delete products directly or view certain sensitive data (cost prices, if desired).
- **Staff** (1-2 people): daily operational users — use scan flows only (take-out / add-stock). No access to editing product master data directly, no deletion rights.
- Expected concurrent usage: 2-3 users max. No public/customer-facing access.

## 4. Core features (v1 scope)

### 4.1 Take-Out Flow (godown → use/sale)
- Select product category (CPVC / PVC / Paint).
- Photograph product sticker.
- AI extracts: name, size, type, company.
- System fuzzy-matches to existing product, or flags as "new product."
- User confirms/edits extracted data and enters quantity taken.
- Confirmed action decrements stock and logs the movement.

### 4.2 Add-Stock Flow (supplier delivery → inventory)
Two supported entry methods:
- **Bill photo (bulk)**: photograph the whole supplier bill → AI extracts all line items (name, qty, unit, price) → confirmation table → bulk confirm → all increments + price records applied.
- **Individual sticker scan**: same mechanics as take-out, but incrementing stock instead of decrementing.

### 4.3 Price Tracking
- Every bill-based add-stock event records a price per unit against the product.
- System compares new price to the last recorded price for that product and flags increase/decrease at confirmation time.
- Price history is retained per product for trend visibility.

### 4.4 New Product Detection
- If a scanned/extracted item does not match any known product (within a fuzzy-match confidence threshold), the system flags it as new and prompts the user to review extracted fields and add it.

### 4.5 Roles & Access
- Owner: full access (products, history, pricing, reports, user management).
- Staff: scan flows only (take-out, add-stock), no delete rights, no cost-price visibility (configurable).

### 4.6 Audit Trail
- Every stock change is traceable to: the photo used, the raw AI extraction, the human-corrected final data, who confirmed it, and when.

## 5. Explicitly out of scope for v1
- Full POS / billing / sales-side pricing.
- Multi-location / multi-godown support.
- Expiry/batch tracking for paints.
- Paint tinting/colorant formula tracking (future idea, tied to a separate tinting machine integration).
- Supplier/purchase-order management workflows.
- Customer-facing features of any kind.

## 6. Success criteria for v1
- Staff can complete a take-out scan in under ~15 seconds per item, without needing help.
- Add-stock via bill photo correctly extracts and books the majority of line items with only minor manual correction.
- Owner can see accurate current stock and price history for any product at any time.
- No inventory or price change happens without an explicit human confirmation step.

## 7. Non-functional requirements
- Must run acceptably on a low-cost cloud host initially, and migrate later to a Raspberry Pi without a rewrite.
- Must be usable by non-technical staff with zero training beyond "scan, check, confirm."
- Must keep hosting/running costs minimal (small shop budget).
- Security: only the owner and designated staff can access or modify data; no public exposure of inventory data.
