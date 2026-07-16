# Design — Visual & UX Guidelines

## 1. Design context
This is a **utility tool used in a godown/shop counter**, often in bright or uneven lighting, by staff who may have one hand occupied holding a product. It is not a marketing surface — the design goal is speed, legibility, and zero ambiguity, not visual flair. Every design choice below optimizes for "can this be read and tapped correctly in 2 seconds, one-handed, in a dim godown or under harsh shop lighting."

## 2. Color palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| Primary | Deep Slate Blue | `#2B4C6F` | Headers, primary buttons, active states |
| Primary Dark | Ink Navy | `#16293D` | Text on light backgrounds, header bar |
| Background | Warm Off-White | `#F7F5F0` | App background — easy on eyes, not stark white |
| Surface | Pure White | `#FFFFFF` | Cards, confirmation panels |
| Success | Pipe Green | `#2E7D5B` | Matched product, confirmed action, price same/decreased |
| Warning | Rust Amber | `#C77B23` | New product detected, price increased, needs review |
| Error | Brick Red | `#B33A3A` | Failed extraction, rejected action, destructive confirm |
| Neutral text | Charcoal | `#33322E` | Body text |
| Muted text | Warm Gray | `#7A776D` | Secondary labels, timestamps |

Rationale: this palette avoids the generic "cream + terracotta" AI-default look while still feeling warm and approachable rather than cold/corporate. Slate blue is deliberately chosen to feel steady and trustworthy (money/stock-relevant data) without reading as a generic SaaS blue. Green/amber/red map directly and unambiguously to the confirmation states used throughout the app (matched/new/error), which is the single most important color signal in this product.

## 3. Typography

- **Primary UI face**: system font stack (`-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`) — deliberate choice, not a placeholder. A custom webfont adds load time and a network dependency for zero benefit on a tool used on possibly-slow godown wifi/mobile data; system fonts render instantly and are already optimized for on-device legibility.
- **Numeric/data face**: same system stack, but numerals (quantities, prices) always use `font-variant-numeric: tabular-nums` so digits align cleanly in tables — matters for scanning a bill confirmation table at a glance.
- **Type scale**:
  - Screen title: 20px / semi-bold
  - Section label: 15px / semi-bold, uppercase, letter-spacing 0.02em (used sparingly — only for Owner view section headers, not on the daily scan screen)
  - Body/product name: 17px / regular
  - Data value (qty/price): 22px / semi-bold — deliberately larger than body text, since these are the numbers a user is there to check
  - Caption/meta: 13px / regular, muted color

## 4. Layout concept

**Daily scan screen (staff-facing)** — one job per screen, nothing else visible:
```
┌─────────────────────────┐
│  [Category: CPVC ▾]      │  ← only visible pre-scan
├─────────────────────────┤
│                          │
│     [ Camera view ]      │
│                          │
├─────────────────────────┤
│      ⬤ Tap to Scan       │  ← large, thumb-reachable, bottom of screen
└─────────────────────────┘
```

**Confirmation screen** — status-first, editable fields secondary:
```
┌─────────────────────────┐
│ ✅ Matched: CPVC Elbow ¾" │  ← green if matched, amber if new
│ Current stock: 45        │
├─────────────────────────┤
│ Qty taken:  [ 5 ]         │  ← large numeric input, +/- steppers
├─────────────────────────┤
│ [ Edit details ]          │  ← secondary, only if correction needed
│ [ Confirm ]                │  ← primary action, full width, bottom
└─────────────────────────┘
```

**Bill confirm table** — same status coloring, one row per item, scrollable:
```
✅ CPVC Elbow ¾"     qty 50   ₹18  (same as last)
⚠️ PVC Pipe 1"       qty 20   ₹230 (was ₹210, +9.5%)
⚠️ New: Enamel 1L    qty 12   ₹340 (first time)
[ Confirm All ]
```

**Owner view** — same visual language, more density permitted since this is a deliberate "look something up" screen rather than a fast-tap flow: simple table list of products with current qty, low-stock flag (amber row highlight), and a tap-through to per-product history.

## 5. Interaction principles
- **Primary action buttons are always full-width and bottom-anchored** — reachable by thumb regardless of hand size, consistent placement across every screen so muscle memory builds fast.
- **Status color always leads, text follows** — a user should be able to tell "this is fine" vs "this needs my attention" from color alone before reading a word, since they may be glancing at the screen quickly mid-task.
- **No unnecessary animation.** A brief (150–200ms) fade/confirm-check on successful submit is enough feedback; no elaborate transitions, loaders, or decorative motion — this is a tool, not a showcase, and animation on a low-end phone/slow connection just adds perceived lag.
- **Large tap targets** (minimum 44px height) throughout — accounts for use with slightly dirty/wet hands (paint, fittings) where precision taps are harder.
- **Visible focus states** on all inputs, for accessibility and for usability with a Bluetooth scanner (if adopted later) that behaves like keyboard input.

## 6. Signature element
The one deliberate, memorable design choice: the **status-color-coded confirmation card** (green = matched/no action needed, amber = needs a decision, red = failed/blocked) is used identically across all three flows (take-out, sticker add-stock, bill add-stock) and the owner's low-stock view. Rather than three different "success/error" visual languages per screen, this single consistent color-coded card pattern becomes the app's visual signature — the thing a user instantly recognizes and trusts after using the app a few times, and it directly encodes the app's core promise: nothing changes silently, every state is legible at a glance.

## 7. What to explicitly avoid
- No cream-background + terracotta-accent combination (common AI-generated default) — this palette uses slate blue + warm off-white instead.
- No dense broadsheet/newspaper-style layout — this is a mobile-first, single-task tool, not a content site.
- No decorative icons or illustrations that don't carry functional meaning — icons only appear where they reinforce a status (✅/⚠️/❌), not for decoration.
- No custom display/serif font — utilitarian system font only, for speed and universal legibility.
