# WG团购群 — Project Knowledge & Setup Guide

**Read this file first in any new chat on this project.** It's the single source of
truth for how this project works and what to do next, whether the ask is "add this
week's group buy" or "set this whole thing up for a different group."

## What this project is

A receipt-style payment-collection dashboard for tracking group-buy (团购/接龙)
orders and who's paid. Live for WG团购群 at:

**https://wggrpbuy.cc**

Stack: a single static `index.html` (generic, reads `manifest.json` + one
`data-<date>.json` per round) hosted on **GitHub Pages** (custom domain
`wggrpbuy.cc` via a repo-root `CNAME` file + DNS at the registrar), with paid/unpaid status
synced live across every viewer via **Firebase Firestore**.

Files in this project:

| File | Purpose |
|---|---|
| `index.html` | The whole app. Generic — never hardcodes a group's data, only the Firebase project it talks to. Rarely needs editing. |
| `manifest.json` | Lists every round: `{ date, label, file }`, newest first. |
| `data-<date>.json` | One per round: `groupName`, `products`, `orders`. |
| `product-emoji-map.json` | Keyword → emoji lookup table used to prefix each product label with a matching icon (🍑 for peaches, 🐔 for chicken, etc.) across every round, current and future. See "Product emoji icons" below. |
| `message-template.json` | Wording for the "复制付款消息" copy-message button — greeting, item-line phrasing, adjustment phrasing, total line, closing lines. Edit this (not `index.html`) to change how the message reads. See "Copy WeChat payment message" below. |
| `firestore.rules` | Firestore security rules (open read/write, scoped to the `paidStatus` and `adjustments` collections only). |
| `README.md` | User-facing docs (Chinese + English) for this specific deployment. |

There used to be a Claude-artifact version (`.jsx`, `window.storage`-based) — abandoned
because of a platform postMessage cross-origin bug (`anthropics/claude-code#42064`).
Don't resurrect that approach unless asked; GitHub Pages + Firebase is the current and
working setup. **An `.html` twin of that same abandoned approach
(`groupbuy_dashboard.html` — embedded/baked-in data, `window.storage` for shared
state, no Firebase, no manifest fetch) had been sitting in this project's files;
it was never the live deployment and was deleted 2026-09-09** (see the dated entry
in Troubleshooting/A7 below for how it was found and why). If a chat ever finds a
similarly-named standalone file with baked-in `EMBEDDED_BUYS` data again, treat it
the same way: it's not `index.html`, don't edit it as if it were, and confirm with
the user before deleting anything, same as this time.

**Every file this project touches gets sent to the user as a downloadable file —
no exceptions, not just the ones that go to GitHub.** This means every repo file
that changes (`index.html`, `manifest.json`, `data-<date>.json`, `firestore.rules`,
`product-emoji-map.json`, `message-template.json`, `README.md`) — they deploy by
manually uploading each changed file to GitHub, so without the actual download they
have nothing to upload. It also means this file itself
(`wg-groupbuy-project-knowledge.md`) whenever it's updated, even though it never goes
to GitHub — the user has asked for a download of it regardless, just for their own
records. Saving a file to the project docs (`project_write`) is never a substitute
for sending it — do both, every time, for every file created or edited in this
project.

## First thing in a new chat: figure out which of these two the user wants

1. **Add a new round to the existing WG团购群 dashboard** (by far the more common ask —
   see "A" below), or
2. **Set up a brand-new dashboard for a different group** from scratch (see "B" below).

If it's ambiguous, ask — don't assume.

---

## A. Adding a new round to the existing dashboard

The user will paste a raw WeChat-style order thread (接龙): a product/price list
followed by numbered member lines, often written inconsistently — some list flavors
in order, some combine orders, some use shorthand like "各1" for one of each, or
"原味"/"鲜肉" as a bare alias for the base/signature flavor.

Steps:

1. Extract the product list into `products`: short English key → `{label (Chinese), price}`.
   Reuse existing keys across rounds when the product line is unchanged (`sig`, `corn`,
   `mush`, `seaweed`, `chive`, `shrimp`, `salted`, `century` are the ones seen so far) —
   give genuinely new products new keys.
2. Parse every member line into `orders`: `{ name, items: {key: qty, ...} }`. Preserve
   the name exactly as written, including emoji/symbols.
3. Resolve ambiguous flavor references using judgment (e.g. "原味"/bare "鲜肉" usually
   means the base/signature flavor), but flag the assumption to the user rather than
   silently guessing when it's genuinely unclear.
4. **Verify totals with a script, don't hand-total** — sum each member's cost, total
   quantity per unit, and grand total; sanity-check against any delivery minimum
   mentioned in the message.
5. Write `data-<date>.json` per the schema below. Use the date embedded in the message
   if there is one; otherwise ask, don't assume. `itemsLabel` is optional and no longer
   needs setting (see A4) — the "📢 复制到货通知" wording went generic on 2026-09-13 and
   doesn't read it anymore.
6. Add a new entry to `manifest.json`: `{ "date": "...", "label": "M/D", "file": "data-<date>.json" }`.
   Newest date goes first.
7. Get both files into the live repo (commit + push if this session has repo access;
   otherwise hand the user the full contents of both files and point them to GitHub's
   "Add file → Upload files"). `index.html` doesn't need to change. New product labels
   are automatically iconified by `product-emoji-map.json` at render time (see below) —
   no per-round work needed for that, unless a genuinely new product category shows up
   with no matching keyword (see "Extending the map").

### `data-<date>.json` schema

```json
{
  "groupName": "WG团购群",
  "itemsLabel": "小馄饨团购",
  "products": {
    "sig": { "label": "招牌鲜肉馄饨", "price": 6.5 },
    "pork_belly": { "label": "五花肉", "price": 12.0, "unit": "kg" }
  },
  "orders": [
    { "name": "Caroline 琛琛", "items": { "sig": 3 } },
    { "name": "Peter", "items": { "sig": 1, "shrimp": 1 } },
    { "name": "Amy", "items": { "pork_belly": 0.5 } },
    { "name": "Lesley & Choies", "items": { "corn": 2 } }
  ]
}
```

- `groupName` stays `"WG团购群"` across rounds unless told otherwise.
- `itemsLabel` (optional, dormant since 2026-09-13) — a short phrase for this round, e.g.
  "小馄饨团购". Used to feed the "📢 复制到货通知" group announcement button (see A4) before
  its wording went generic; not read by anything in `index.html` anymore, but harmless to
  set or leave out. No need to fill it in for new rounds.
- No `productLabel` or delivery-note field — removed from the display by request;
  don't reintroduce unless asked.
- All page UI text is Mandarin — keep any new strings in Mandarin to match.

**New product:** new snake_case key (never reuse/overload an existing one even if the
Chinese name looks similar). Set `price` per the message. Add `"unit"` whenever it's
not sold by the standard "盒" (box) — e.g. `"kg"` for anything priced "$X/斤" — using
whatever unit word the message uses; omit `unit` for standard box items. If a price or
unit changes between rounds, update only that round's file, never past dated files.

**Partial/fractional quantities:** any decimal is fine, not just whole numbers — this
is how "半份"/half-portion, "1.5kg" etc. get represented (`{ "pork_belly": 0.5 }`).
Don't round — enter exactly what was ordered.

**Combined/shared orders:** when two+ members order together and pay as one lump sum,
represent it as **one** `orders` entry with the names combined into one string, e.g.
`"Lesley & Choies"`. One line item, one "mark paid" toggle. Don't model per-person
cost-splitting within a combined order unless asked.

**Bulk items split among several individual buyers (do NOT combine these):** don't
confuse this with combined orders above. When a bulk-priced item (e.g. a whole cut of
meat at $25/kg) gets divided among several members who each pay for their own share,
keep them as **separate** `orders` entries under their own names — they are not paying
jointly, so they don't get merged into one combined entry. The catch: the exact split
(e.g. 300g vs. 700g) usually isn't known until the item is physically weighed out at
pickup/delivery. So:
1. At 接龙 time, enter each person's **estimated** share as their quantity (whatever
   split was discussed, or an even split if genuinely unknown) — it's a placeholder,
   not the final number.
2. Once it's actually weighed out, this is a job for the delivery-day adjustment
   feature (see A2 below): for each affected member, add an `"item"` adjustment with
   `qtyDelta = actual weight − estimated weight` for that product. The dashboard
   recomputes their cost automatically (`price × qtyDelta`) — don't hand-calculate it.
3. Tell the user this is coming rather than promising an exact split-cost up front, if
   the message doesn't already state firm weights.

**Missing/unverified items:** if a member orders something not on the vendor's price
list, or too ambiguous to price confidently, don't drop it or silently guess:
1. Still add it to that member's `items` with the stated quantity.
2. Give it a `products` key with `"price": null` and `"unverified": true`.
3. The dashboard highlights these in amber ("缺失/待确认"), shows "待确认" instead of
   an amount, excludes them from totals, and shows a warning banner.
4. Tell the user explicitly which items need confirming and why, so they can supply
   the real price/product and you can clear the `unverified` flag later.

### Design conventions already established (don't relitigate unless asked)

- Receipt-style aesthetic: warm parchment background, dashed dividers, monospace
  numbers, serif header font.
- Auto light/dark mode via `prefers-color-scheme` — no manual toggle.
- Responsive: single column on mobile, two-column member grid above 860px.
- Each member card = itemized line per flavor with its own subtotal, then a total line.
- Filter tabs: 全部 / 未付款 / 已付款.
- Pay toggle button text: "未付款" / "已付款 ✓" (renamed from "标记已付款" 2026-09-13).
- Totals grouped by unit, not blindly summed (separate "总数量（盒）" / "总数量（kg）" rows).
- Stocking list (备货清单) only shows products with ≥1 unit actually ordered.
- Missing/unverified items flagged amber, excluded from totals until confirmed.
- Every product label is rendered with an icon prefix looked up from
  `product-emoji-map.json` (e.g. "🍑 川中岛水蜜桃礼盒") — see next section.
- Each member shown with a "1." serial number matching their position in the raw
  接龙 (i.e. `data-<date>.json`'s `orders` array order, which is already 接龙 order —
  no separate field needed). Shown on the member card, the print report, and the
  🏠 门牌管理 panel, so any of these can be cross-checked against the original
  WeChat thread. Walk-ins (added later via adjustments, A2) were never in the
  接龙, so they're left unnumbered — only tagged "现场加购" like everywhere else.
- **A separate "Dashboard Template" design-system project exists (a different
  project) with an Apple-styled flat-gray, desktop/mobile-split, SVG-chart
  reporting-dashboard system.** After reviewing it (2026-09-09), the decision was
  to keep this dashboard's receipt visual identity as-is — it's a live,
  bidirectionally-editable consumer app, not the read-mostly internal reporting
  tool that template assumes — and only borrow its *engineering* discipline
  (escaping, keyboard accessibility, checked color contrast) where this page had
  real gaps. See "Accessibility & escaping hardening" under Troubleshooting below
  for exactly what was pulled in. Don't restyle toward that template's look
  (flat gray palette, sitebar chrome, desktop/mobile page split, SVG charts)
  unless explicitly asked again.

### Suggested first message for this ask

> "New group buy for [date]. Here's the 接龙: [paste message]"

---

## A1. Product emoji icons (`product-emoji-map.json`)

Every product label shown anywhere in `index.html` (order lines, stocking list, the
adjustment form's item dropdown, the print/PDF export) is prefixed with an emoji looked
up from `product-emoji-map.json`, via a small `productEmoji()`/`emojiLabel()` helper
near the top of the script. This was seeded from the icons WG团购群 already used in
their own raw WeChat posts (🍑 for peaches, 🐷 for pork, 🥬 for leafy greens, etc.), so
future rounds get consistent icons automatically without re-tagging every item by hand.

**How matching works:** the file is `{ defaultEmoji, categories: [{ emoji, keywords }] }`.
For a product's Chinese label, categories are checked top-to-bottom; the first category
whose `keywords` list contains a substring of the label wins, and its emoji is used. If
nothing matches, `defaultEmoji` (🛒) is used instead. Order matters — narrower/specific
categories must come before broader catch-alls, and (learned the hard way) before other
categories whose keyword could be a substring of a compound dish name — e.g. meat/poultry
categories are checked before seasoning categories like garlic (🧄) or ginger (🫚),
otherwise a dish like "蒜香无骨凤爪" (garlic chicken feet) would match on "蒜" (garlic)
before reaching "凤爪" (chicken feet).

**Extending it — do this whenever a new round's products fall back to the default 🛒:**
1. Add the new keyword to an existing category if it fits (e.g. a new citrus variety
   goes into the `🍊` category's `keywords` array).
2. Otherwise add a new category object in the right spot (specific before generic,
   proteins before seasonings — see ordering note above).
3. `index.html` fetches this file at `./product-emoji-map.json` (same directory,
   alongside `manifest.json`) — it needs to exist in the live repo for icons to show
   at all; a missing/failed fetch just falls back to 🛒 for everything, it doesn't break
   the page.

---

## A2. Delivery-day adjustments (shortages, refunds, walk-in extras)

On delivery day, reality often doesn't match the original 接龙: some items are missing
or short, some need a refund, and sometimes extra stuff gets sold on the spot. This is
handled as a **second, live layer on top of the frozen original order** — never by
editing `data-<date>.json` itself, so there's always a clean record of what was
originally ordered vs. what actually got charged.

**Where it lives:** a Firestore collection `adjustments/{date}` (same live-sync pattern
as `paidStatus`), one document per round. Each field is an auto-generated entry ID
mapping to:

```json
{
  "member": "Peter",
  "type": "item",
  "itemKey": "sig",
  "qtyDelta": -1,
  "amountDelta": -6.5,
  "note": "到货少一份",
  "ts": 1234567890
}
```

- `type: "item"` — a quantity change to an existing product line (negative = shortage,
  positive = extra sold). `amountDelta` is computed and frozen at entry time
  (`price × qtyDelta`), so a later price change never retroactively alters it.
- `type: "credit"` — a flat dollar adjustment not tied to any product (a refund or
  surcharge with just a note + `amountDelta`, no `itemKey`/`qtyDelta`).
- `type: "weight"` — **purely informational, never affects money.** For weight-priced
  items (`unit: "kg"`) that get portioned out by hand, the actual amount received almost
  never lands exactly on the ordered weight. Billing stays based on what was **ordered**
  (e.g. a member who ordered 2kg of peaches at $8/kg is charged $16 no matter what the
  actual portion weighs) — this entry just records what they actually got, so they can be
  told, even when it's slightly more than they paid for. Shape:
  `{ member, type: "weight", itemKey, actualGrams, note?, ts }` — no `amountDelta`/
  `qtyDelta` at all, so it's excluded from both the money total (`adjustmentTotal`) and the
  stocking-list/procurement total (`effectiveItems`) automatically. Shown inline on that
  product's own line in the copy-message (see A3) instead of the usual `x{qty}kg` quantity
  suffix (which is suppressed for any `kg`-unit item, weighed or not — the dollar amount
  already reflects the ordered weight), not as a separate `↳` line like the other two types.
- A member's final amount due = their original item total + the sum of their
  `amountDelta`s. The dashboard shows this automatically; nothing else needs updating.
- A brand-new `member` name (someone who bought on the spot but wasn't in the original
  接龙) automatically becomes its own row — no need to touch `data-<date>.json` for that.
- Quantity-type adjustments also feed into the stocking list / unit totals (so
  procurement numbers reflect reality), while money always comes from `amountDelta`
  specifically — the two are computed separately on purpose.

**Grams-to-quantity helper for weight-priced items (added 2026-09-08, broadened
same day).** Two distinct pain points, same fix. (1) Bulk produce sold in
pre-weighed bags is ordered in fractional package units, but when a bag gets
split between two or more people (e.g. one person orders 0.5包 of
`tangerine_seedless` "无籽蜜橘(2kg/包)") the split happens by weighing, not by
literally halving the bag — so the weight handed over rarely lands exactly on
the ordered fraction. (2) Plain `unit: "kg"` produce (脆甜大荔冬枣, 普罗旺斯番茄,
etc.) has the same problem in miniature: the field is denominated in kg, but a
kitchen scale reads grams, so someone will eventually type the grams reading
straight into a kg field (an early version of this feature only covered case 1
and a user did exactly this for case 2 the same day it shipped). Either way the
fix is still an ordinary `type: "item"` adjustment (NOT `type: "weight"`, which
is annotation-only and never touches money — see above); the only thing that
needed solving was converting a grams reading into the right number for
whatever unit that product happens to use, without the admin doing the
arithmetic (or the field silently accepting the raw gram count as if it were
that unit — e.g. "1200" read as "1200 more bags", or "600" read as "600 more
kilograms").

To fix this without inventing a new adjustment type (which would have meant
touching all four consumer functions again — `adjustmentLineHtml()`,
`buildMemberMessage()`, `effectiveItems()`, `printItemsLine()` — see
Troubleshooting below), the "品项数量变化" form gained an optional helper input
instead:

- `gramsPerUnit(key)` returns grams-per-unit for any weight-priced product, or
  `null` for anything else (count-based items like 盒/份/粒/只/瓶/袋 just use
  the plain qty field, unchanged). Two cases: `unit === "kg"` → `1000`,
  trivially; otherwise it extracts a per-unit weight straight out of the
  product's own `label` text via regex
  (`/\((\d+(?:\.\d+)?)\s*(kg|g)\s*\/[^)]*\)/i`) — e.g. "无籽蜜橘(2kg/包)" →
  `2000`. No new data field to keep in sync either way; it just reads what's
  already in `data-<date>.json`. The regex deliberately doesn't match
  count-based parenthetical labels ("红心奇异果(2盒/份)") or multi-pack ones
  ("娃娃菜(300g*2包/份)") — those aren't reweighed-bulk items.
- When the selected product in the "品项数量变化" form has a non-null
  `gramsPerUnit`, an extra "或输入实际到手重量（克）" input appears.
  Typing a grams value there calls `handleAdjGramsHelperInput(memberKey, value)`,
  which: rounds down to the nearest 10g (`roundGramsDown` — the house billing
  rule, in the member's favor), divides by the per-unit gram weight to get the
  correct quantity, subtracts `currentQtyFor(memberName, itemKey)` (base order
  qty + any prior `item`-type adjustment deltas for that same member+item, so a
  *second* correction nets against the already-corrected total rather than the
  original order), and writes the result straight into the `qtyDelta` field plus
  a preview line showing the conversion and dollar impact.
- **Important implementation detail:** `handleAdjGramsHelperInput` deliberately
  does **not** call `render()`. This whole page re-renders by replacing
  `app.innerHTML` wholesale (see the crash-bug note in Troubleshooting), which
  would destroy and recreate the very `<input>` being typed into on every
  keystroke and throw the cursor position away. Instead it writes straight to
  the two DOM nodes it needs (`#adjQtyDelta`'s `.value`, `#adjGramsPreview`'s
  `.textContent`/`.hidden`) while still keeping the `adjDraft`/`adjGramsPreview`
  module state in sync, so a render triggered by something else (a live
  Firestore update arriving mid-edit) still shows the right values. Any future
  "live preview as you type" input on this page should follow the same pattern,
  not call `render()` on every keystroke.
- The saved entry is a completely ordinary `type: "item"` record — this is a
  UI shortcut for computing the right `qtyDelta`, not a new persisted shape, so
  undo/report export/payment-message rendering all Just Work without any
  changes.
- Not offered for walk-ins (`memberKey === "__walkin__"`) — a walk-in's name
  isn't finalized until they type it into the separate name field, so there's
  no stable key yet to look up a "current quantity" against; walk-ins still use
  the plain `qtyDelta` field.

**Two ways entries get written to that same Firestore doc:**

1. **Live in-dashboard editing.** The organizer taps "✏️ 编辑" (renamed from "✏️
   编辑调整" 2026-09-13) in the toolbar,
   enters the PIN (`EDIT_PIN` constant near the top of `index.html`'s script — currently
   `"1117"`; this is a soft UI gate only, not real security, since Firestore rules stay
   open to anyone with the link, same as paid-status), then gets a "+ 调整" button per
   member (and a "+ 新增买家" button for walk-ins) that opens a small inline form. Saves
   go straight to Firestore — instant, no GitHub push needed.
2. **Chat-mediated bulk.** For a messy delivery-day recap pasted into a new chat, parse
   it into the same entry shape (member/type/itemKey?/qtyDelta?/amountDelta/note) as a
   JSON array, and give it to the user to paste into the dashboard's "📋 批量导入调整"
   panel (visible once edit mode is unlocked) — clicking "应用调整" writes them all to
   Firestore in one go. Example payload to hand the user:
   ```json
   [
     {"member": "Peter", "type": "item", "itemKey": "sig", "qtyDelta": -1, "amountDelta": -6.5, "note": "到货少一份"},
     {"member": "Amy", "type": "credit", "amountDelta": -3, "note": "退款：等太久"},
     {"member": "may", "type": "weight", "itemKey": "peach", "actualGrams": 2044}
   ]
   ```
   When computing `amountDelta` for an `"item"` type entry yourself, multiply by that
   product's `price` from the round's `data-<date>.json` — don't leave it for the page
   to infer, since the page trusts whatever `amountDelta` you send. A `"weight"` entry
   never takes `amountDelta`/`qtyDelta` — just `itemKey` + `actualGrams` (+ an optional
   `note`).

Entries can be undone individually from the dashboard (an "撤销" link next to each
adjustment line, visible in edit mode) — this deletes just that one Firestore field.

**Blocked while the round is auto-locked (see A5):** once every member is marked paid,
the round locks and adjustments/walk-ins can't be added (live or via bulk import) until
someone unlocks it with the edit PIN.

### Suggested first message for this ask

> "Delivery day for [date]: [describe what happened — shortages, refunds, extra sales]"

---

## A2b. 收/送 status (separate from payment)

Each member row has a "收/送" toggle button next to "未付款"/"已付款 ✓" — a second,
independent yes/no state for whether that member's order has been physically
received/delivered. (Renamed from "打包"/"已打包" to "收/送"/"已收/送" in 1.14.0 —
same collection and mechanics, label-only change, reframed as tracking
pickup/delivery rather than packing.) Lives in its own Firestore collection
`packedStatus/{date}` (name kept from before the rename — same live-sync
`onSnapshot`/`setDoc merge:true` pattern as `paidStatus`), so it
never clobbers or depends on payment status — a member can be received/delivered-not-paid
or paid-not-received/delivered, tracked independently. Unlike the pay toggle, it's never
blocked by `roundLocked` (this is an operational task, not something the
payment auto-lock should freeze). Visible in the stats ticket as "已收/送 X / Y
人" alongside the existing "已收 X / Y 人" line. Requires the Firestore rule for
`packedStatus/{groupBuyDate}` (open read/write, same shape as the other two) —
already added to `firestore.rules`; needs to be pasted into the Firebase
console's Rules tab like any other rules change, since that's a separate
deploy step from GitHub Pages.

## A2c. Inline per-item editors (faster alternative to the "+ 调整" form)

Each item line, when in edit mode, shows a compact inline editor right below it — a much
faster path for the common "fix this one item's quantity" case than opening the full
"+ 调整" form. **The old form is fully intact and unchanged** — both coexist; the new
editors are additive, not a replacement, until they've been tested live.

Every inline editor ultimately calls `saveInlineItemAdjustment()`, which writes the exact
same `type:"item"` `{qtyDelta, amountDelta, note}` shape the old form's "品项数量变化"
option already writes — so it's invisible to everything downstream (`effectiveItems()`,
totals, the ledger, undo). **Undo is free**: any entry an inline editor creates shows up
as a normal "↳" ledger line with the same 撤销 button every adjustment already has —
no separate revert mechanism was built, since one already existed.

**Which editor a product's line gets** is driven entirely by explicit fields on that
product in `DATA.products[key]` — never guessed from the label text:

- **`weighMode: "weight"`** → grams-input editor. Converts entered grams via
  `gramsPerUnit(key)` (explicit `gramsPerUnit` field first, falling back to the original
  `unit==="kg"`/regex-on-label logic for older round files that predate these fields),
  rounded down to the nearest 10g in the member's favor — same rule the old form's
  grams-helper already applies. Includes a "缺货（0g）" quick action and, if the product
  also declares `piecesPerUnit`, a "没有秤？改用数颗数" toggle to an alternate no-scale
  entry method (e.g. splitting a box of pears evenly by counting instead of weighing).
- **`weighMode: "proportional"`** → box-share calculator (bunch÷total), for boxes with no
  single fixed weight (e.g. a grape box whose bunches each weigh differently). Validates
  that a portion can't outweigh the box it came from — rejects the entry with an inline
  error instead of silently computing a nonsense price. Once one member sharing a box
  enters its total weight, the next member's edit for the same product key pre-fills it
  (session-only `boxTotalCache`, not persisted). Falls back to "改用直接输入比例" (manual
  fraction entry) for anything without a scale involved.
- **No `weighMode` (the default) + a declared `piecesPerUnit`** → piece-count partial
  editor, for damage/shortfall on a product that comes in known discrete pieces (e.g.
  "4粒/份" — 1 of 4 peaches arrived bad). Same underlying math as the proportional
  calculator's alternate mode: pieces received ÷ pieces expected = fraction of the price,
  no rounding needed since pieces are always whole numbers.
- **No `weighMode`, no `piecesPerUnit`** (the vast majority of products, and every product
  in a round file that predates these fields entirely) → the plain +/− stepper, one tap
  per whole unit, with a "缺货" quick action.

**A round with no `weighMode`/`piecesPerUnit` fields at all** (true of every round file as
of this writing) sees every single item default cleanly to the plain stepper — nothing
breaks, nothing silently misbehaves; the richer editors just aren't available until a
round's `products` entries carry the explicit fields. See `product-catalog-proposed.json`
(Claude-side reference, mirrors `product-catalog.json`'s "never deployed" status) for the
resolved classification of ~106 of ~115 real products, worked out interactively against
real 9/10 order data before any of this was built — including two label-parsing traps a
naive regex-based approach would have hit (a sealed single-serving package whose label
happens to state a weight, and a "约/左右" approximate-weight label that doesn't match a
strict numeric pattern) and one genuine three-way distinction (plain per-piece items vs.
weighed-by-scale items vs. box-shared-by-weight items with no single fixed total).

**Known state as of this writing:** implemented and syntax-checked, but not yet tested in
a live browser or deployed. `APP_VERSION` was introduced with this change (see A9) —
this file had no version tracking before it.

## A3. Copy WeChat payment message (per-member)

Each member row has a "💬 复制付款消息" button next to the total (visible always, not just in
edit mode). Tapping it builds a ready-to-paste WeChat message for that member's own order and
copies it to the clipboard (`navigator.clipboard.writeText`, with a `document.execCommand('copy')`
fallback for older/in-app browsers); the button briefly shows "已复制 ✓" for 1.5s as confirmation.

This is deliberately separate from the "未付款"/"已付款 ✓" toggle — one person can sort/collect payment
while another marks paid, so both stay independent and both are still needed. The PDF export
(print) is unchanged and stays as the paper-trail record.

**Message format**, built by `buildMemberMessage(m)` in `index.html`. Matches how WG团购群
already writes these messages by hand (reworked from an earlier, more formal draft after the
user shared a real example: no emoji, no "$", "@name" instead of a greeting sentence, and
"一共X～" instead of "合计：$X"):

```
@may

彩虹油蟠桃  16（2044g）
蜂糖李  6.7（673g）
哈密瓜  6.5
青龙菜  3.5
土鸡蛋  9.3

一共42～
```

With a shortage adjustment (A2), a member whose order was short one item on delivery looks
like:

```
@Peter

哈密瓜 x2盒  13
土鸡蛋  9.3
↳ 哈密瓜 -1盒（到货少一份） -6.5

一共9.3～
```

- `@{name}` greeting, then a blank line.
- One line per original ordered item — plain product name (no emoji, unlike everywhere else
  on the page), an ` x{qty}{unit}` suffix only when quantity isn't 1 *and* the item isn't
  priced by weight (so "2 boxes" shows "x2盒", but "2kg of peaches" never shows "x2kg" —
  the amount already reflects the ordered weight, and the actual weight, if known, is
  shown instead per below), then two spaces and the amount (trimmed of trailing zeros,
  no "$").
- A `（{grams}g）` suffix on an item's own line when a `"weight"` adjustment (A2) was
  recorded for that member+item — the actual amount portioned out, purely informational.
- One `↳`-prefixed line per non-`"weight"` delivery-day adjustment (A2) affecting that
  member, each with its own note (e.g. "到货少一份", "退款：等太久") so the person paying
  can see *why* the total differs from a simple add-up of the original order — this was
  an explicit requirement, not just a nice-to-have.
- A blank line, then `一共{total}～` — same number shown elsewhere in that member's card.
- No closing line by default (the real messages this group sends don't have one) — add
  one back via `message-template.json`'s `closingPaid`/`closingUnpaid` fields if wanted
  later.

**Scope note:** this is a per-member button only — there's no bulk "copy list of everyone unpaid"
variant. That was discussed during ideation but not requested for the build; don't add it unless
asked.

**index.html only:** `buildMemberMessage` depends on the adjustments/edit-mode data already
loaded into `index.html`'s state — this is the only place this feature exists.

**Wording lives in `message-template.json`, not `index.html`.** Same pattern as the emoji map
(A1): `index.html` fetches `./message-template.json` at boot and merges it over a built-in
default (identical wording), so a missing/failed fetch just silently keeps the current wording —
it never breaks the page. All of the *data* in the message (product names, prices, adjustment
notes, actual weights, totals) still comes from `data-<date>.json` / the live adjustments —
only the surrounding *phrasing* is templated. `{placeholders}` in the template are filled in
automatically (`fillTemplate()` in `index.html`); don't remove or rename them, just move the
words around them.

Fields in `message-template.json`: `greeting` (`@{name}`), `itemLine`
(`{item}{qtySuffix}  {amount}{weightSuffix}`), `weightSuffix` (the `"weight"`-adjustment
annotation, e.g. `（{grams}g）`), `unverifiedAmount`/`unverifiedSuffix` (for
missing/unconfirmed-price items), `adjItemLine`/`adjNoteSuffix` (a quantity-type delivery-day
adjustment), `adjOtherLine`/`adjDefaultNote` (a flat credit/refund adjustment), `totalLine`
(`一共{total}～`), and `closingPaid`/`closingUnpaid` (empty by default — set these if you want
a closing line back, shown depending on whether that member is already marked paid).

**To reword the message going forward:** just edit `message-template.json` and re-upload it —
`index.html` doesn't need to change. Only touch `index.html`'s `buildMemberMessage`/
`MESSAGE_TEMPLATE` default again if a genuinely new *kind* of line is needed (not just different
wording of an existing one).

---

## A4. Group arrival announcement ("📢 复制到货通知")

A second copy-message button, deliberately more prominent than the per-member one — a full-width
filled button right at the top of the page, under the group name, so it's the first thing visible
on load. Built for the "everything arrived, come collect" message the organizer posts to the whole
group, as opposed to A3's per-member payment message.

Tapping it copies (`buildGroupAnnouncement()` in `index.html`):

```
@Caroline 琛琛 @^_^Wu @W_W @Peter @Sherry Liu ... @等放假ing @木木三の柒

团购到了，我们在分装，有空的可以来107 06-02自取，会比较快。
需要送货的也可以小群弹一下时间，我们好安排。

*请尽快安排时间取/送，家里冰箱位置有限。
```

- One `@`-mention per member, in 接龙 order (original order first, then any walk-ins added via
  adjustments), space-separated on one line — matches how WG团购群 already posts these. Everyone
  gets mentioned regardless of paid status; this message is about pickup, not payment.
- A blank line, then the announcement body from `message-template.json`.
- Shows "已复制 ✓" for 1.5s after copying, same pattern as A3's button.

**Wording went generic (2026-09-13):** the message no longer names what arrived (was
"{arrived}到啦，欢迎来{location}自取，需要送货小群联系～", e.g. "小馄饨团购到啦…") — now it's
always the same "团购到了" wording regardless of round contents, plus an extra line about pinging
the small group for a delivery time and a fridge-space reminder. **`buildGroupAnnouncement()`
itself was not touched for this** — the whole change lives in `message-template.json`'s
`groupAnnouncementText` field, since `{arrived}`/`itemsLabel` simply isn't referenced by the new
template string anymore (an unused `{placeholder}` substitution is harmless — `fillTemplate()`
only fills placeholders that are actually present in the text).

**Data sources:**
- Member list: `DATA.orders` (+ walk-in names from `adjustments`) — same list and order used
  everywhere else on the page (factored into `allMemberNamesInOrder()`, shared logic with
  `render()`'s member list and with the A5 auto-lock check).
- `{location}` (pickup spot, now "107 06-02" — building number folded into the same string):
  `pickupLocation` in `message-template.json` — a fixed setting for this deployment, not
  per-round, so it normally only needs setting once.
- The rest of the wording (`groupAnnouncementText`, `mentionPrefix`, `mentionSeparator`) also lives
  in `message-template.json`, same reasoning as A3 — reword without touching `index.html`.

**`itemsLabel` is now a dormant field.** `data-<date>.json`'s optional `itemsLabel` (e.g. "小馄饨
团购") used to feed `{arrived}` above; since the wording went generic it's no longer read by
anything in `index.html`. Harmless to leave set on old rounds or to keep filling in out of habit,
but **no longer needed when creating a new round** — the "remember `itemsLabel`" reminder that used
to live in section A's new-round checklist has been removed accordingly. If this message is ever
made round-specific again, `itemsLabel` is still there ready to be wired back in.

**No new JSON file was needed for this button originally** — it reuses `message-template.json`
(fields: `mentionPrefix`, `mentionSeparator`, `pickupLocation`, `groupAnnouncementText`) and
`data-<date>.json`'s (now-dormant) `itemsLabel` field.

---

## A5. Auto-lock after full payment

Once every member in a round has been marked paid, the round automatically locks: no more
marking (un)paid, no delivery-day adjustments (A2), no adding walk-in buyers — for anyone
with the link — until someone with the edit PIN unlocks it again. Added to stop an
already-settled round from being changed by an accidental tap.

**Where it lives:** a `__locked` boolean field written directly into the same Firestore
document as paid status (`paidStatus/{date}`) — not a separate collection, so it needs no
new Firestore rule; the existing `allow read, write: if true` rule for `paidStatus` already
covers it. `__locked` is never a real member's name, so it's automatically excluded
everywhere the page iterates members by name (`paidCount`, `collected`, etc.).

**How it locks:** `togglePaid()` in `index.html` checks, on every "mark paid" tap, whether
this tap is the last outstanding member for the round — if so, it writes
`{ [name]: true, __locked: true }` in that same Firestore call. This only fires on that
specific transition (someone completing the round), never on a general page load or
render, so unlocking a round to fix something doesn't get immediately re-locked just
because everyone still shows as paid at that moment — it only re-locks the next time
someone explicitly completes the round again via the paid toggle.

**How it unlocks:** while locked, the toolbar's edit button is replaced with "🔓 解锁".
Tapping it opens a password prompt using the same `EDIT_PIN` as delivery-day adjustments;
entering it correctly clears `__locked` for everyone, live, same as paid status. Unlocking
always requires re-entering the PIN — even on a device that already has edit mode
remembered (`wg_edit_unlocked` in localStorage) — since settling/reopening a round is
meant to be a deliberate act each time, not something a remembered device skips. There is
**no auto-unlock on page reload**: the lock is shared Firestore state, so it reads the
same on every device until someone enters the PIN.

**Known edge case (rare, low-stakes, left unfixed on purpose):** if two different devices
mark the very last two outstanding members paid at nearly the same instant — before
either has received the other's Firestore update — the round can end up fully paid
without auto-locking, since each device's local check still thinks the other member is
unpaid. Nothing about money or paid-status breaks; the round just stays editable until
someone explicitly toggles a payment again. This wasn't patched with a render-time
recheck because that would also make the manual unlock re-lock itself instantly (since
right after unlocking, everyone typically still shows as paid) — defeating the point of
being able to unlock at all. Not worth the added complexity for a small group; revisit
only if it actually causes a problem in practice.

---

## A5b. Round tab coloring (past-round status at a glance)

Each round's tab in the `.buyTabs` bar is colored based on its date and payment status,
computed once at page load — not part of the live per-round subscriptions.

**The rule:**
- Round date ≥ today → left uncolored (default) — treated as "hasn't happened yet," even
  if it's today's own round still mid-collection.
- Round date < today, at least one base member unpaid → red (`.buyTab.pending`).
- Round date < today, every base member paid → green (`.buyTab.completed`).
- The currently-selected tab always keeps its existing dark "active" highlight regardless
  of status color (`.buyTab.completed:not(.active)` / `.buyTab.pending:not(.active)` — the
  color only shows on unselected tabs, so there's never a visual conflict between "this is
  open" and "this is selected").

**Known limitation, left as-is on purpose:** the paid-check only looks at `DATA.orders`
(the base 接龙 list) for each past round, not walk-ins added afterward via adjustments
(A2). A past round with every base member paid but one unpaid walk-in would still show
green. Not worth an extra adjustments-collection read per past round for how rarely that
specific combination would happen; revisit if it actually causes confusion.

**How it's computed:** `refreshRoundStatuses()` runs once at boot, after the manifest and
first round load. For every round dated before today, it does a one-time `getDoc()` read
of that round's `paidStatus/{date}` document (not a live `onSnapshot` — background tab
coloring doesn't need to update in real time the way the open round's own UI does) plus a
one-time `fetch()` of that round's own `data-<date>.json` (to get its member list), then
compares the two. Rounds dated today or later skip both fetches entirely. Runs in the
background without blocking the initial page render; re-renders once all statuses resolve
so the tabs pick up their colors. If a fetch or read fails for a given round, that round
is just left uncolored rather than showing a debug banner over a purely cosmetic feature.

Because this only runs once at boot from the manifest snapshot at that moment, a brand new
round added to `manifest.json` mid-session (rare, but possible if someone deploys while
the page is already open) won't get a color until the next page load — acceptable for a
decorative feature.

---

## A5d. Light-mode palette and green banner header (2026-09-13)

Light mode's `:root` CSS variables were swapped to a slate/emerald palette, to
match a set of future client-facing/admin pages. **Dark mode's `@media
(prefers-color-scheme: dark)` block was deliberately left untouched** at every
step of this — confirmed pixel-identical, not just "mostly the same."

**Variable mapping (light `:root` only):**

| Variable | Old | New |
|---|---|---|
| `--bg` | `#efe7d8` | `#f1f5f9` |
| `--paper` | `#fffcf6` | `#ffffff` |
| `--ink` | `#2b2420` | `#1e293b` |
| `--muted` | `#756a58` | `#64748b` |
| `--line` | `#ddd2bd` | `#e2e8f0` |
| `--green` / `--green-btn` | `#5c7a5e` / `#4f7f5b` | `#10b981` (both — was two close shades of the same green, now one) |

`--red`, `--pack-btn`, and the `--warn-*` set were left alone — none were in
the reference mapping given for this change, and there was nothing to
translate them to. The `--muted`-on-`--paper` contrast comment was re-verified
against the new white background (~4.6:1, still clears WCAG AA) rather than
left pointing at stale numbers from the old palette.

**Selected tabs and the 📢 announcement CTA stayed on `--ink`** (now
slate-800) rather than moving to a colored "primary" fill — asked explicitly
and the answer was to keep the existing dark-neutral-fill look, just
recolored, not introduce a new visual pattern for active/primary elements.

**New `--primary` variable, `#059669` (Emerald-600), separate from
`--green`/`--green-btn`'s Emerald-500:** added specifically for the new title
banner (below), after comparing directly against the real reference file
(`index_html.txt`, the order-intake form) and finding it uses **two**
distinct greens — Emerald-600 for nearly everything (header, buttons, active
tab, price text) and Emerald-500 *only* for the input focus ring. The banner
first shipped reusing `--green-btn` (Emerald-500) by mistake — wrong shade,
caught once the actual reference file was checked instead of going on the
mapping table alone. `--primary` is also declared inside the dark-mode block,
pinned to dark mode's existing `--green-btn` value (`#4f7f5b`) — not a new
color, purely so introducing the variable doesn't change dark mode's
rendering now that something references it.

**Title banner ("WG团购群"):** `.shopHead` gained a `.banner` modifier class
— background `var(--primary)`, white text, centered, full-bleed left/right/top
via negative margin (`margin: -20px -14px 18px`, canceling `body`'s own
padding) — applied only to the two on-screen views (round view, 会员 view).
**Deliberately not applied** to the PDF export's title (print stays plain
black/white — no colored background wasting ink or looking odd in grayscale)
or the load-error fallback screen (a green "success"-coded banner behind an
error message would send the wrong signal).

Two things had to be fixed after the first version shipped, both from
comparing actual screenshots against the intended full-bleed look:

1. **Top-edge gap:** the 中文/English language toggle was still rendered as a
   sibling *above* `.shopHead.banner`, in the plain body background — so only
   the banner bled to the edges, leaving the toggle inset above it with a
   visible gap/seam. Fixed by moving `.langPillWrap` to be the banner's first
   child instead of a preceding sibling, so nothing sits outside it and the
   whole block (toggle + title) bleeds together, top included.
2. **Bottom-corner notches:** the banner originally had rounded bottom
   corners (`border-radius: 0 0 22px 22px`), but the 📢 button directly below
   it is a normal inset card (`border-radius: 10px`, not bled to the edges) —
   at the banner's bottom-left/right corners, the curve pulled the green in
   just enough to expose a sliver of plain background before the
   square-cornered button started underneath. Fixed by dropping the
   border-radius entirely — the banner is now a plain flush rectangle with no
   curve to create that mismatch.

---

## A5c. Round tab grouping and two-row layout (2026-09-13)

The `.buyTabs` bar changed from one flex row (real + test rounds interleaved by date,
成员 tab hardcoded last) to two explicit rows, rendered by a new shared function,
`renderBuyTabsBar()`:

- **Row 1:** every real round (newest→oldest) + the 成员 tab.
- **Row 2:** every test/v2 round (newest→oldest) — only rendered at all when at least
  one exists.
- Both rows use `justify-content: center` independently (`.buyTabsWrap` is a column
  flex container holding two `.buyTabs` row divs).

**"Test round" is decided by a new shared helper, not a new data field:**

```js
function isTestRound(gb) {
  return gb.date.length !== 10 || (gb.label || "").includes("测试");
}
```

This is the exact same two-signal check `computeOverdueByMember()`/
`computeOwedProductsByMember()` (A6/Members) already used inline — pulled out into one
function so the tab-bar grouping, the boot sort, and the Members-tab exclusion can never
drift apart. **No `manifest.json` schema change was needed or made** — a round becomes
"test" for every one of these purposes just by getting a "测试"-labeled or non-plain-date
`date` key, same convention 9/11测试(v2) already used.

**Boot sort also changed, fixing a real bug:** `GROUP_BUYS` used to be one
`.sort((a,b) => b.date.localeCompare(a.date))` across all rounds. A "-v2"-style date key
is a *longer string* than its real counterpart with the same prefix (e.g.
`"2026-09-11-v2"` > `"2026-09-11"` lexically), so a test round could sort as "newest" and
become `GROUP_BUYS[0]` — meaning the site could **boot straight into a test round**
instead of the newest real one. Fixed by sorting real and test rounds as two separate
groups (`isTestRound()` again) and concatenating real-first:

```js
const mainRounds = all.filter(gb => !isTestRound(gb)).sort((a, b) => b.date.localeCompare(a.date));
const testRounds = all.filter(gb => isTestRound(gb)).sort((a, b) => b.date.localeCompare(a.date));
GROUP_BUYS = mainRounds.concat(testRounds);
```

`GROUP_BUYS[0]` (the boot default) and every other "newest round" assumption elsewhere in
the file now reliably mean the newest **real** round.

**`data-index` stays meaningful:** since `GROUP_BUYS` is ordered `[main rounds...,
test rounds...]`, `renderBuyTabsBar()` slices it at `mainCount` to build each row, so a
tab's `data-index` always equals its actual position in `GROUP_BUYS` — the existing
`data-index` → `loadGroupBuy(i)` click handler needed no changes.

**One prior design note this supersedes:** the 1.11.0 log entry below describes 成员 as
"positioned as the rightmost tab, after the oldest real round" — that's no longer the
layout; 成员 now sits at the end of row 1 (after real rounds, before any test rounds),
not necessarily the visually-last tab overall.

**Renamed-9/1 note:** 9/1's round (`data-2026-09-01.json`) was relabeled "9/1测试(v2)" to
reflect it was really an early test round, without changing its `date` key. Its `date`
stays `"2026-09-01"` (not `"2026-09-01-v2"`) specifically so Firestore's `paidStatus` /
`adjustments` / `packedStatus` / `sortedItems` docs (keyed by `date`) keep pointing at its
real, already-recorded payment history — only the *label* carries "测试", which is enough
to route it into row 2 via `isTestRound()`. Don't rename a round's `date` key to add it to
the test row unless its Firestore history genuinely doesn't matter — prefer a
"测试"-labeled `date` change only.

---

## A6. Member block/unit directory (for organizing deliveries)

Each member can have a block/unit number on file (free text, e.g. "12栋 06-02"),
used only to help sort/plan deliveries. This is real address information tied to
real names, so it's held to a higher bar than everything else in this project:

- **Never in the GitHub repo.** Unlike everything else the dashboard reads
  (`data-<date>.json`, `manifest.json`, etc.), this does **not** live in a file
  that gets pushed to GitHub. It lives entirely in a Firestore collection
  (`memberInfo/directory`, one doc, fields `{ name: "block/unit text" }`), so it's
  never sitting in the public repo or its permanent git history — the whole reason
  it's there is so it isn't casually discoverable just by browsing the repo.
  It's still technically reachable by anyone who has the dashboard link (same
  trust model as paid status/adjustments — Firestore rules stay open to anyone
  with the link, not just the organizer), just not by browsing GitHub.
- **Never fed into any message.** `buildMemberMessage()` (the per-member payment
  message, A3) and `buildGroupAnnouncement()` (the arrival announcement, A4) never
  read `memberUnits` — this data has no path into anything that gets copied to
  WeChat. This restriction is absolute and hasn't changed; only where it's *shown
  on the dashboard* has (see next point).
- **Persistent, not per-round.** A member's unit doesn't reset or need re-entering
  when a new round starts — it's one directory shared across every round's data,
  loaded once at boot (`subscribeToMemberUnits()`), not tied to any `date`.
- **Shown on every member's card, to anyone who opens the link — by explicit
  request (2026-09-08), not the original design.** It was originally kept out of
  the plain card view and visible only inside the edit-mode-gated "🏠 门牌管理"
  panel; the user asked for it to always show on the card instead, for
  convenience, and accepted that this removes that privacy boundary (still not
  in the GitHub repo, still readable by anyone with the link like everything
  else, just no longer hidden behind edit mode for *viewing*). See the
  `.unitDisplay` line in `render()`. **Editing** it still requires unlocking edit
  mode and using the "🏠 门牌管理" panel — only *reading* changed.

**Requires a Firestore rules change** (the one thing this feature needs that no
other feature in this project has needed so far, since it's a brand-new
collection, not reusing `paidStatus` or `adjustments`). Add this to the existing
rules in Firebase console → Firestore Database → Rules, alongside the
`paidStatus`/`adjustments` blocks:

```
match /memberInfo/{docId} {
  allow read, write: if true;
}
```

Tell the user explicitly when handing over an `index.html` that uses this feature
for the first time: **the panel will fail (a red 🔧 error banner) until this rule
is added** — `index.html` alone isn't enough for this one.

**Data shape choice:** one free-text field per member rather than separate
block/unit fields — matches how `pickupLocation` is already stored as one string
elsewhere in this project. Split it into two fields only if asked.

### Suggested first message for this ask

> "Here are everyone's block/unit numbers: [list]" — paste the list and this gets
> written into the directory (needs Firestore write access from this session, or
> hand the user the `{name: unit}` pairs to type into the "🏠 门牌管理" panel
> themselves).

---

## A7. Product lookup (商品查询 — who ordered a given product)

The old design had a **总数量（单位）** row per unit (盒/kg/份/etc.) in the top
summary ticket; tapping one popped up every product contributing to that unit
and its subtotal. This was removed (2026-09-09) as redundant — the 备货清单
card right below already lists every product with its price and quantity, so
the same information was shown twice, once grouped by unit and once by
product.

**What replaced it, in two steps (both 2026-09-09, same day):**

1. First pass: the 备货清单 card became **"商品查询 — 备货清单 & 认购明细"**,
   with a `<select>` dropdown above the stocking table. The dropdown lists
   **only products actually ordered this round** (`flavorTotals[k] > 0` —
   nothing from `products` that got zero orders appears as an option).
   Picking one swaps the panel below from the full stocking list into
   `renderProductMembers()`'s output for just that product: every buyer's
   name and original-order quantity, plus a subtotal — **not**
   `effectiveItems()`; this total is deliberately original-order-only, same
   reasoning as the always-visible 备货清单 (see the "ORIGINAL orders"
   comment in `render()`) — delivery-day corrections don't move it.
   (An earlier version of this doc incorrectly said this used
   `effectiveItems()`; it never has — corrected 2026-09-13, see below for
   what actually surfaces adjustments here.)
   Picking the first option ("📋 全部商品（本轮备货清单）", value `""`) — or
   just never touching the dropdown — shows the full list again
   (`renderAllProductsList()`).
   - Tried an in-between design first (a text search box filtering a
     tappable list of rows) before landing on a plain `<select>` — a native
     dropdown is the simpler control for "pick one item from a list you
     don't need to type-ahead search," and it's what got asked for
     specifically. Don't reintroduce the search-box version unless asked.
2. Second pass, same day: **every row in the always-visible 备货清单 table is
   now itself clickable**, independent of the dropdown. Clicking a product's
   name/qty/amount cells pops up the exact same per-product breakdown
   (`renderProductMembers()` again — no duplicate logic) in a modal overlay
   (`.productOverlay`/`.productOverlayCard`, styled like the old
   `.unitOverlay` this replaced), so you don't have to scroll/search the
   dropdown to check one product you're already looking at in the table.
   Click anywhere on the overlay (backdrop or card — no `stopPropagation`,
   matching the old unit overlay's "点击任意处关闭" behavior) to close it;
   Escape also closes it (`selectedProductOverlay` state, reset on round
   switch and before `exportReport()`'s print dialog, same handling the old
   `openUnit` state got).
   - Only the first cell of each stocking-list row carries
     `role="button" tabindex="0"` (for one keyboard stop per row via the
     existing delegated Enter/Space handler); the other two cells share the
     same `data-key` and click handler so the whole visual row is tappable,
     without adding two more redundant tab stops per product.

**Net result:** three ways to see who-ordered-what for a given product —
dropdown, or tap its row in the stocking list either while a specific product
is already selected or while viewing the full list — all backed by the same
`renderProductMembers()` function, so there's exactly one place to fix a bug
in that breakdown, not three.

### Per-buyer adjustment lines (2026-09-13)

`renderProductMembers()` now also lists, under each buyer's own line, any item-type
adjustment on that exact product — reusing `adjustmentLineHtml()` (the same formatting
and `editMode`-gated 撤销 button the member card's own item lines use), filtered to
`a.type === "item" && a.itemKey === key` via `adjustmentsForMember(m.name)`. Reason: this
view previously only showed the original order, so seeing whether a product had any
delivery-day corrections meant opening every member's card one at a time to find them —
now it's visible right where you're already looking.

- The top total/subtotal are **unchanged** — still original-order-only (see above).
- A buyer with an adjustment adding this product but no original order for it (e.g. a
  walk-in add) is now included in the list too (previously excluded outright, since the
  old buyer filter was `.filter(x => x.qty)`), shown with "—" in place of a quantity.
- Because the undo button reuses `adjustmentLineHtml()` verbatim, undoing an adjustment
  from this popup works exactly like undoing it from the member's own card — same
  `.adjUndo` global click handler, no separate wiring needed.

---

## A7b. PDF export (real PDF instead of `window.print()`, since 1.17.0)

`exportReport()` used to call `window.print()` and rely on `@media print` to hide
everything but `.printOnly`. That silently did nothing when this dashboard is opened
from WeChat's in-app browser, or as an iOS "Add to Home Screen" web app — neither
environment exposes `window.print()` at all, and the call just no-ops with no error to
catch, which is why the button looked broken with no clue why.

**Current approach:** generate the PDF client-side and trigger a real file download
instead, which works the same in every environment:

1. Reset UI state (filter→all, edit mode off, any open panel closed) and `render()`,
   same as before.
2. Force `.printOnly` (normally `display:none` outside an actual browser print) visible
   off-screen at a fixed 800px width, `left:-99999px`, so nothing flashes or shifts the
   page's own layout.
3. `html2canvas` renders that live DOM to a canvas — chosen over jsPDF's own text/table
   drawing API specifically because jsPDF's built-in fonts don't cover Chinese at all,
   and this report is entirely Mandarin. Capturing the real rendered output reuses its
   actual fonts, table layout, and shortage strike-throughs for free, instead of
   reimplementing all of that in jsPDF's drawing calls.
4. The canvas becomes one tall PNG, sliced across as many A4 pages as needed (standard
   jsPDF recipe: paginate by shifting the same image up page-by-page, not by trying to
   paginate the DOM itself).
5. `pdf.save()` triggers the download, named `{groupName}-{round label}.pdf` with
   filesystem-unsafe characters stripped.

Both libraries (`html2canvas` 1.4.1, `jspdf` 2.5.1) load lazily from cdnjs via
`loadScriptOnce()` — not bundled — the same pattern already used elsewhere for optional
CDN dependencies. A `"正在生成 PDF…"` banner shows while it runs (`exportStatus` state);
a second tap while one is already generating is ignored (`exportingReport` guard); any
failure shows `导出 PDF 出错：{message}` via the existing `storageDebug` banner rather
than failing silently.

**Also added in the same pass:** shortage strikethrough in the print report — a member's
own struck-through item line only (never the adjustment line correcting it, which would
make the correction itself look voided), and a struck-through row in the stocking list
for any product with a recorded shortage this round, with a "划线 = 本轮有短缺" note.
`printItemsLine()` was rebuilt into a flex two-column layout (label left, price
right-aligned in one consistent column) ending in a bold 合计 row per member, so amounts
line up regardless of item-name length instead of trailing at ragged positions.

---

## A7c. Copy stocking list as plain-text order (2026-09-13)

A **"💬 复制清单（下单用）"** button sits under the 商品查询 dropdown, always
rendered (not gated behind `showFullStockList`), copying a plain-text product
list formatted for pasting straight into a supplier's WeChat/order chat:

```
产品 · 数量 · 金额

🥟 招牌鲜肉馄饨 · $6.50/盒
10盒 · $65.00
🥟 玉米鲜肉馄饨 · $6.80/盒
3盒 · $20.40

合计 · 13盒 · $85.40
```

`buildStockListOrderText()` (self-contained, same pattern as
`buildGroupAnnouncement()`/`buildMemberMessage()` — recomputes from `DATA`
rather than reading render()'s local closure vars, so it stays correct
regardless of what's currently expanded/selected on screen):

- Rebuilds `flavorTotals`/`grandUnitTotals` from `DATA.orders` only — same
  "ORIGINAL orders, never `effectiveItems()`" rule as the on-screen 备货清单
  and `renderProductMembers()` (see A7) — this is a supplier order list, not
  a running tally of delivery-day corrections.
- Per product: `emojiLabel(info) · $price/unit`, then `qty+unit · $amount`,
  using the exact same `formatQty()`/`emojiLabel()` helpers the on-screen
  list uses, so the numbers can never drift from what's shown on screen.
- `isUnverified()` products get `（待确认）` in place of the price/amount and
  are excluded from 合计 — matches `renderAllProductsList()`'s handling.
- Closing line: `合计 · {formatUnitTotals(grandUnitTotals)} · ${grandTotal}` —
  `formatUnitTotals()` already joins mixed units with "+" (e.g. "45盒 +
  3kg") if a round mixes unit types, same helper the on-screen grand-total
  row and the print report use.

Copy mechanics (transient `stockListCopied` state, `.copied` CSS variant,
1.5s revert) mirror `announceCopied`/📢复制到货通知 exactly — reused
`copyTextToClipboard()`, no new clipboard logic.

---

## B. Setting up a brand-new dashboard from scratch (a different group)

`index.html` is fully generic — it only knows about `manifest.json`, the
`data-*.json` files it points to, `product-emoji-map.json`, and a Firebase project for
live paid-status sync. Nothing in it is specific to WG团购群 except the Firebase config.
To stand up an independent dashboard for a different group:

1. **New GitHub repo.** Create it, then enable Pages: Settings → Pages → Deploy from
   branch → `main` / root. Live URL will be `https://<github-username>.github.io/<repo>/`.
2. **Copy `index.html` and `product-emoji-map.json` as-is** from this project into the
   new repo — no changes needed yet except the Firebase config (step 4).
3. **New Firebase project.** console.firebase.google.com → create project → enable
   Firestore Database (start in production mode — the rules below lock it down anyway).
4. **Paste the new Firebase config** into `index.html`, replacing the
   `firebaseConfig` object (apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId) with the new project's values (Firebase console → Project
   settings → your web app, or "Add app" if none exists yet). These values aren't
   secrets and are fine to be public — access control comes from the security rules,
   not from hiding the config.
5. **Set Firestore security rules** (Firebase console → Firestore Database → Rules) —
   copy this project's `firestore.rules` as-is (scoped to `paidStatus` and
   `adjustments`, nothing else):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /paidStatus/{groupBuyDate} {
         allow read, write: if true;
       }
       match /adjustments/{groupBuyDate} {
         allow read, write: if true;
       }
     }
   }
   ```
   Also consider changing the `EDIT_PIN` constant near the top of `index.html`'s script
   if you don't want to share the same PIN across dashboards for different groups.
6. **Create the first round's files**: `manifest.json` with one entry, and
   `data-<date>.json` with that group's `groupName`, `products`, and `orders` (schema
   above in section A).
7. **Push everything** to the new repo (`index.html`, `manifest.json`,
   `data-<date>.json`, `product-emoji-map.json`, and the `firestore.rules` file for
   reference). Pages updates the live site within about a minute of a push to `main`.
8. Confirm the live URL loads, shows the first round, and that toggling paid status
   updates Firestore (check the Firebase console's Firestore data browser, or open the
   link in two tabs and confirm a toggle in one shows up in the other).

From then on, adding further rounds to that new dashboard follows the same steps as
section A. The emoji map (`product-emoji-map.json`) travels with `index.html` and keeps
working as-is since it's keyed on Chinese product-name keywords, not on any
group-specific data — extend it per-group only if that group sells product categories
the current map doesn't cover.

---

## Troubleshooting

**Two devices show different paid-status data shortly after a push:** almost always
GitHub Pages' CDN serving a stale cached `index.html`. Wait a minute or two, or reopen
in a private/incognito window. If still wrong, view page source and confirm the word
`firebase` appears (i.e. the live version really did update).

**Red 🔧 banner at the top of the page:** a Firestore read/write failed — the banner
shows the actual error message, which is the fastest way to debug it.

**"Pulling down doesn't refresh the page" when saved to the iOS Home Screen**
(added 2026-09-09): expected, not a bug — a page saved via "Add to Home Screen"
opens full-screen with no Safari chrome, and pull-to-refresh is a gesture Safari's
UI provides, not something the page itself can opt into or reimplement via a
manifest/meta tag. **Fix:** a `#refreshBtn` toolbar button (🔄 刷新) was added that
just calls `location.reload()` — a real navigation, not a custom re-fetch of
`manifest.json`/`data-<date>.json`, deliberately, so it re-runs every boot step
exactly once (product-emoji-map.json, message-template.json, Firestore
subscriptions, everything) with nothing to keep in sync by hand as future
boot-time fetches get added. If the person reports the button itself doesn't seem
to update anything, that's almost always the GitHub Pages CDN-caching issue above,
not this button — same fix (wait, or force-quit and reopen).

**"🖨️ 导出报告" needed several clicks before the print dialog actually opened**
(fixed 2026-09-08, **superseded 2026-09-13 — see "PDF export" note after A7 below**;
kept here for history since the underlying lesson about browser-gesture timing still
applies to anything else that opens a native dialog): `exportReport()` reset some UI
state (filter/edit mode/open
panels) and called `render()`, then called `window.print()` inside a
`requestAnimationFrame` callback — the reasoning at the time was probably "give the
DOM a frame to settle before printing," but it wasn't actually needed: the print
content (`renderPrintSection()`) is built from the full, unfiltered member list on
*every* render regardless of the on-screen filter, and `@media print` hides
everything else via pure CSS, so nothing about print correctness depended on that
delay. What it did cause: deferring `window.print()` even by one animation frame
pushes it just outside the "direct result of a user gesture" window some browsers
require before honoring `print()`/`open()` — Safari and, notably, WeChat's in-app
browser (the actual audience for a WeChat group-buy link) are both strict about
this. That's why it was flaky rather than consistently broken: whether a given
click's deferred call still landed inside that browser's grace window varied.
**Fix:** call `window.print()` synchronously, in the same tick as the click handler
— no `requestAnimationFrame`, no other async hop in between. General rule for
anything else that opens a native browser dialog (`print()`, `open()`, a file
picker, etc.): call it directly from the event handler, not after an intervening
`render()`-triggered layout wait, a `Promise`, or a timer — if state needs to
change first, do the state change and `render()` synchronously, then call the
dialog-opening API immediately after, still inside the same handler invocation.

**A product's icon shows the default 🛒 instead of something specific:** its Chinese
label doesn't match any keyword in `product-emoji-map.json`. Extend the map (see
"Product emoji icons" above) rather than hardcoding an icon into a product's `label`.

**A fully-paid round won't let you add an adjustment or new buyer:** it's auto-locked
(see A5) — tap "🔓 解锁" in the toolbar and enter the edit PIN.

**Wrong product pasted mid-接龙, right price but wrong pack size/version** (real
incident, 9/10 round, fixed 2026-09-13): a member copy-pasted the wrong product line
while replying in the 接龙 thread, so several buyers' orders got keyed against
辽宁巨峰(3串/箱) (`grape_jufeng_ln`) when the actual product delivered was 辽宁巨峰
家庭版(4串/箱) (`grape_jufeng_family`) — same $24.80 box price, so the dollar amounts
looked fine, but the proportional fraction denominator was wrong (÷3 instead of ÷4),
producing a suspicious non-whole total (four people's bunch-shares summed to 1.33
boxes instead of a clean 1.0). **Tell-tale sign to check for on any proportional
grape product:** do the fractions for one box sum to something other than a whole
number? If so, check whether the total bunch count actually matches a *different*
box-size product in the catalog before assuming a stray extra buyer or bad math.
**Fix:** add the correct product to that round's `products` map, re-key each affected
buyer's `items` entry to it, and recompute each fraction against the *correct* box's
bunch count (2 bunches ÷ 4 instead of 2 bunches ÷ 3, etc.) — the dollar total per
buyer is usually unchanged since it's still `fraction × same box price`. Drop the
wrong product from that round's `products` map entirely if, as here, none of its
other uses were legitimate. **Before applying a fix like this, check whether any of
the affected buyers already have a Firestore `adjustments/{date}` entry keyed to the
*wrong* `itemKey`** — re-keying the base order without also migrating a matching
adjustment orphans that adjustment (it'll stop rendering/attaching to anything).
Same class of risk as the `mango_pzh` cross-round key-reuse caution in the domain
rules — always audit a product key swap against what's already recorded before
applying it, not just against the round's `products`/`orders` data.

**The whole page is blank/frozen and nothing is clickable, with a
`TypeError: ... amountDelta.toFixed` (or similar) error in the browser console:**
two distinct things can cause this, both now fixed, but worth telling apart if it
ever recurs — check the browser console's expanded stack trace to know which:

1. **A genuinely malformed entry** in that round's `adjustments/{date}` Firestore
   doc — missing a field (`amountDelta`, `qtyDelta`, or `actualGrams`) for its type,
   e.g. from a bad hand-edit in the Firebase console. Guarded by
   `isValidAdjustmentShape()`, which filters anything malformed out before it can
   reach a `.toFixed()`/`formatQty()` call; a "🔧 发现 N 条调整记录格式有问题" banner
   appears with a one-tap "点击清理" button (in edit mode) that deletes the bad
   entries via `cleanupInvalidAdjustments()` — no Firebase console needed.
2. **A legitimate `"weight"` adjustment entry hitting code that never special-cased
   it.** This was the actual first real-world occurrence (2026-09-08): `printItemsLine()`
   (the print-report line-summary function) assumed every non-`"item"` adjustment was
   a dollar-amount `"credit"` and called `.toFixed()` on `a.amountDelta` — which
   `"weight"` entries never have by design (see A2). Unlike `adjustmentLineHtml()` and
   `buildMemberMessage()`, which both already special-cased `"weight"` correctly,
   `printItemsLine()` had been missed when the `"weight"` type was added. Fixed by
   giving it the same `if (a.type === "weight") { ... }` branch (shows
   `emojiLabel(info)}实收{grams}g`, informational only, matching the pattern
   elsewhere). **Lesson for next time a new adjustment `type` is added:** it has to be
   handled in *all four* places that iterate `adjustmentsForMember()` —
   `adjustmentLineHtml()`, `buildMemberMessage()`, `effectiveItems()`, and
   `printItemsLine()` — not just the on-screen card and the WeChat message. It's easy
   to update the two visible/obvious ones and forget the print-export path, since it's
   hidden by `@media print` and only becomes visible when someone actually prints —
   except it's built unconditionally on every single render (not just when printing),
   so a bug in it crashes the *entire* page, immediately, for everyone — not just the
   print feature.

Both fixes are defensive at the `adjustmentsForMember()`/render layer, not a promise
that every future adjustment type will be handled — check all four call sites by hand
whenever a new `type` value is introduced.

### Defensive audit (2026-09-08): missing/malformed data no longer crashes the page

The `printItemsLine()` bug above was one specific instance of a general risk this
architecture has: **the whole page is a single `app.innerHTML = ...` template string
(see `render()`), so any single thrown error while building it — anywhere — takes down
rendering for every visitor, not just the one feature that has the bug.** Prompted by
that bug recurring in spirit (a user report of "prevent this from happening again"),
every place that reads a *number* or a *product lookup* from data the organizer
hand-types was audited for the same failure shape: assuming a field exists/is the right
type, then immediately calling `.toFixed()` or doing arithmetic on it. Found and fixed:

- **A member's `items` referencing a product key that's missing from that round's
  `products` map** (a typo made while hand-authoring `data-<date>.json`, or a key
  renamed/removed after orders already referenced it) used to crash the *on-screen*
  member-card loop in `render()` outright (`info.price` on `undefined`) — this was the
  most likely one to actually get hit, since it's hand-authored data. Now shows a
  visible `⚠️ <key> 商品未找到，请检查 data 文件` line instead of throwing;
  `printItemsLine()` and `buildMemberMessage()` already had this guard (`if (!info)
  return`), the primary on-screen card loop just hadn't.
- **A member entry missing its `items` field entirely** (e.g. `{"name": "X"}` with no
  `items` key — an easy thing to drop while hand-typing a long `orders` array) used to
  crash `Object.entries(m.items)` wherever a member is touched (cost, the card loop,
  the message builder, the print line). Fixed once, at the single point every one of
  those reads from: `DATA.orders.map((m, i) => ({ ...m, items: m.items || {}, id: i
  }))` in `render()`.
- **A malformed entry in the `adjustments` Firestore doc** (e.g. a stray `null` — from
  a bad manual Firestore-console edit, or a bug in a bulk-import payload) used to crash
  `Object.values(adjustments).map(a => a.member)` in both `allMemberNamesInOrder()` and
  the walk-in-name computation inside `render()` — neither guarded `a` being truthy
  before reading `.member`, even though the established pattern for this exact risk
  (`e && e.member`) already existed in `invalidAdjustmentEntries()` a few lines away.
  Now both do `a && a.member`.
- **A product with a missing/`null` `price` but no explicit `unverified: true` flag**
  (forgetting to set the flag is an easy slip — two separate fields to remember) used to
  crash the on-screen 备货清单 stocking list AND its print-report twin
  (`info.price.toFixed(2)` on `null`/`undefined`). `isUnverified(key)` now treats
  `info.price == null` as unverified too, regardless of the explicit flag, so all three
  places that used to check `info.unverified` directly (备货清单 ×2, `renderUnitOverlay`)
  now call `isUnverified()` instead and get the fix automatically — as does anywhere
  that already called `isUnverified()` (the member card, `buildMemberMessage()`,
  `printItemsLine()`), with zero further changes needed there.
- **`cost()`** used to do `DATA.products[key].price * qty` unconditionally once the
  product existed — a `price` of `undefined` (field omitted, as opposed to explicitly
  `null`) produces `NaN`, which doesn't crash (`NaN.toFixed(2)` prints `"NaN"` rather
  than throwing) but silently poisons every downstream total (grand total, collected,
  per-member totals) into showing `$NaN`. Now explicitly treats `price == null` as $0,
  same as a missing product.
- **`formatQty()`/`formatAmt()`** called `.toFixed()` straight on their argument —
  `.toFixed` doesn't exist on strings, so a quantity accidentally written as a quoted
  string in `data-<date>.json` (`"0.5"` instead of `0.5` — an easy slip when hand-typing
  or copy-pasting JSON) would throw and, per the single-template-string architecture,
  crash the entire page. Both now do `Number(x)` first, so a string coerces cleanly
  and even a genuinely non-numeric value degrades to displaying `"NaN"` rather than
  throwing.
- **`loadGroupBuy()`** (switching rounds via the tab bar) had no `.catch()` at all on
  its fetch/JSON-parse chain — a 404'd or syntactically invalid `data-<date>.json`
  (again: hand-authored, so a missing comma/bracket/quote is a real possibility) failed
  completely silently; the tab click just did nothing, with no clue why, and no way to
  tell whether it was still loading or had already failed. Now catches the error, rolls
  `activeIndex` back to whichever round was already showing (so `DATA` still points at
  something real and the tab bar isn't stranded on a broken tab with no way back), and
  shows the actual error message in the same `storageDebug` 🔧 banner Firestore errors
  already use. The very first boot load (fetching `manifest.json` then the newest
  round) already had a fallback (`showLoadErrorFallback`, which replaces the whole page
  since there's no previously-working round to fall back to there) — its error message
  was hardcoded and uninformative regardless of cause; it now includes the real
  `Error.message` (e.g. the JSON parser's own syntax-error text and position).
- Added `if (!DATA) return;` at the very top of `render()` as cheap defense in depth —
  every current call path already only calls `render()` once `DATA` is set (or, on a
  failed round switch, leaves the *previous* round's `DATA` in place), so this
  shouldn't be reachable today, but costs nothing and means a future subscription or
  handler that forgets that invariant fails quietly instead of throwing on
  `DATA.orders`.

**The general principle, for anything added later:** any value that ultimately traces
back to hand-typed JSON (`data-<date>.json`'s `orders`/`products`, a bulk-import paste)
or an open-write Firestore doc should be treated as untrusted shape/type — check
existence before dereferencing (`DATA.products[k]` can be `undefined`), and wrap
anything reaching `.toFixed()` in `Number(...)` rather than assuming the caller already
passed a real number. Because `render()` is one giant template string, there is no
"just this one card fails to render" outcome — a single unguarded assumption anywhere
takes the *entire* page down for *every* visitor until someone finds and fixes it. When
in doubt, prefer degrading to a visible "⚠️ / 待确认" marker over either a silent wrong
number or a thrown error.

### Accessibility & escaping hardening (2026-09-09)

Prompted by reviewing a separate "Dashboard Template" design-system project (see the
new "Design conventions" bullet above) — its `DESIGN_SYSTEM.md` documents real
incidents in unescaped-HTML injection and unchecked color contrast, which turned out
to have live counterparts here. Three fixes, all invisible (no look-and-feel change):

1. **Unescaped member name reaching `innerHTML`.** A walk-in buyer's name comes from a
   free-text field (`adjDraft.name`), written to an open-write Firestore doc anyone
   with the link can write to, then was concatenated straight into `app.innerHTML`
   unescaped in two places — the on-screen row header (`.rowName`) and the print
   table's `<td>`. It was also written unescaped into `data-name="${m.name}"`/
   `data-member="${m.name}"` attribute values on the pay/copy/adjust buttons and inside
   `renderAdjForm()` — an unescaped `"` there could break out of the attribute.
   **Fixed:** every one of those spots now wraps the name in `escapeHtml()` (see
   `renderAdjForm()`'s `safeKey` for the attribute-value case). Also brought the local
   `escapeHtml()` up to parity with the Dashboard Template's canonical version, which
   additionally escapes `'` → `&#39;` (this file's copy previously didn't).
   **Standing rule:** any new user-editable string (a new form field, a new Firestore-
   backed value) that lands in `innerHTML` — as text OR as an attribute value — needs
   `escapeHtml()` around it, no exceptions; check both new call sites this creates.
2. **No interactive element was keyboard-reachable.** Every clickable control on this
   page (pay toggle, both tab bars, copy-message/announce/toolbar buttons, +调整,
   the unit-breakdown row, 撤销 undo links) is a plain `<div>` with a mouse-only click
   handler — no `tabindex`, no `role`, unusable without a mouse/touchscreen (this
   predates the receipt-style rewrite and was never revisited). **Fixed:** every one
   now carries `role="button"`/`role="tab"` + `tabindex="0"` (a locked pay button gets
   `tabindex="-1"` + `aria-disabled="true"` instead, since it's a no-op while locked),
   the two tab rows are wrapped in `role="tablist"` with `aria-selected` on each tab,
   the pay toggle exposes `aria-pressed`, "+ 调整" exposes `aria-expanded`, a `:focus-
   visible` outline was added for all of these (a `<div>` gets none by default), and a
   single delegated `keydown` listener on `#app` (added once at boot — `#app` itself is
   never replaced, only its `innerHTML`, so this survives every re-render) fires
   `el.click()` on Enter/Space for anything matching `role="button"`/`role="tab"`.
   Escape now also closes the unit-breakdown overlay (it already closed on click-
   outside). **Standing rule:** any new clickable element added later needs the same
   `role`/`tabindex` treatment — the delegated Enter/Space handler already covers it,
   so a new button just needs the attribute, not new JS; a real `<button>` element
   works too and needs neither.
3. **Light-theme `--muted` failed WCAG AA contrast.** Measured (relative-luminance
   formula) at ≈3.84:1 against `--paper` (`#fffcf6`) — below the 4.5:1 AA minimum for
   the many normal-size (11-14px) labels/item lines using it (`.statLabel`, `.itemLine`,
   `.progressLabel`, etc.). The dark-theme value was independently checked and already
   fine (≈6:1) — the two were never assumed to move together. **Fixed:** light-theme
   `--muted` changed from `#8a7f6e` to `#756a58` (≈5.18:1); dark theme untouched.
   Not audited yet, flagged for a future pass if it matters: `--warn-text`/`--warn-bg`,
   `.walkinTag`'s `--line`/`--muted` fill+text pairing.

None of this changed `README.md`'s feature list — nothing user-visible moved.

---

## A8b. Open proposals (not yet built)

**Proposal 1 — BUILT in 1.6.0.** Resolved differently from the original sketch below:
rather than annotating the adjusted figure with the original, the decision was that the
originally-built list must not be silently edited at all — so 商品查询 now shows the
**ordered** quantity as primary, striking it through and showing the actual beside it
only where a correction exists. The first card's round total stays exactly as it was.
A second piece was added that wasn't in the original proposal: a dedicated
缺货/退货明细（供索赔）card aggregating shortages by product, so refund claims can be
read off at a glance instead of reconstructed from individual member ledgers. The
original sketch is kept below for context.


The whole-round total on the first card already does this: it shows the current
总额 with "（原始订单总额：$X，已含调整）" underneath, and only when the two actually
differ (`Math.abs(grandTotal - baseGrandTotal) > 0.001`). Nothing further down the
hierarchy follows that pattern:

| View | Current behavior |
|---|---|
| Whole-round total (first card) | Shows both — current + original in parentheses, only when they differ |
| Individual member's card | Original frozen on the item line; correction shown only as a separate "↳" ledger line below |
| 商品查询 buyer list + 小计 | Silently shows the *corrected* (effective) quantity and subtotal, no trace a correction happened |

Note the member card and 商品查询 are actually inconsistent with each other (frozen-original
vs silently-corrected) — that's by deliberate choice for the member card (see A2c: the item
line stays frozen, corrections live in the ledger below), but 商品查询 was never explicitly
decided, it just fell out of using `effectiveItems()`.

The proposal: extend the first card's existing pattern down to 商品查询's 小计 — e.g.
"$X（原$Y）", shown only when that product has actually been adjusted this round. Reuses the
visual language already on the page rather than inventing a new one.

Also worth noting if this gets built: 商品查询's subtotal is computed as `effective qty ×
current price`, not via the "frozen at adjustment time" `amountDelta` convention money uses
everywhere else (A2). These agree in practice unless a price changes mid-round, but they're
architecturally different calculations.

---

## A10. Battery usage & offline behavior

**Offline: the dashboard does not work offline, by design.** No service worker, no
web app manifest (so "Add to Home Screen" gives a shortcut, not a true installable
PWA), and every data fetch deliberately defeats caching via `{cache:"no-store"}` plus
a cache-busting URL param — added on purpose to prevent stale data on GitHub Pages.
Firestore offline persistence isn't enabled either. With no connection: blank page or
an error banner.

**Battery investigation (prompted by a real user report of high drain).** Audited and
ruled out the usual suspects: no `setInterval`, no polling, no animation loops, no
`document`/`window` listener accumulation (both are registered once at module scope),
and all per-round Firestore listeners correctly unsubscribe before resubscribing.

Two real contributing factors were found:

1. **Four persistent Firestore listeners held a connection open even when the page was
   backgrounded.** This is the one fixed in 1.5.0 — on a weak signal the radio escalates
   transmit power, and a Home Screen app left open in a pocket paid that cost
   continuously. Now detached on `visibilitychange` and reattached on return.

2. **`render()` rebuilds the entire page via `app.innerHTML`, and is called from ~57
   places — including every Firestore snapshot.** With several people sorting
   simultaneously (the 打包/分拣 workflow), every tick by anyone triggers a full DOM
   teardown + rebuild and ~50 event-listener reattachments on *every* open device.
   **Not yet fixed.**

**Remaining proposed steps, in order of expected impact:**
- **Step 2 — scope the re-render. ON HOLD pending battery data from 1.5.0.**
  Scoped and estimated, deliberately not built yet: measure whether the visibility
  fix alone was enough before adding complexity.

  Key finding from scoping: of the ~57 `render()` calls, only **~10 are
  snapshot-driven** — the rest are user-action-driven, where a full rebuild happens
  at human pace and costs nothing perceptible. So the work is *not* "refactor
  render()"; it's "make the ~10 snapshot handlers targeted, leave the other ~47
  alone."

  | Snapshot | Genuinely affected | Frequency |
  |---|---|---|
  | `sortedItems` | One item line's ⬜/✅ — not even totals | Highest (every tick, everyone) |
  | `packedStatus` | One member's pack button + packed count | High |
  | `paidStatus` | Member's pay button, stats ticket, possibly lock state | Medium |
  | `adjustments` | Ledger, totals, 商品查询 — genuinely broad | Low |

  Recommended narrow scope if this gets built: `sortedItems` + `packedStatus` only
  (~1-2h, low risk — tightly bounded effects, no interaction with lock state, edit
  mode, or totals). `paidStatus` adds ~1h and moderate risk (it changes *which rows
  exist* when a paid/unpaid filter is active, and can trigger auto-lock — needs a
  full-render fallback in both cases). `adjustments` isn't worth optimizing.

  Known risks to design against: stale closures on patched DOM (reuse
  `refreshInlineArea()`'s rebinding pattern); filter interaction (a member marked
  paid while 未付款 is active must *disappear*, not sit there stale); patches landing
  mid-edit while someone's typing; and the real long-term one — two code paths that
  must stay in agreement, where a future feature updated in only one produces stale
  UI that appears solely after a *remote* update, which is miserable to reproduce.

- **Step 3 — enable Firestore offline persistence.** Helps battery *and* makes a
  degraded-but-functional offline mode possible, addressing the offline gap above.

---

## A9. Version log

`APP_VERSION` (near the top of `index.html`'s script, also shown in the page footer)
tracks what's actually deployed. Before any non-trivial `index.html` edit in a fresh
chat, check the file's `APP_VERSION` against the table below — a mismatch (or the
constant being missing) means this Project's stored copy is stale relative to what's
live, and the current file should be requested rather than edited blind. Bump this
alongside every edit, in the same response.

| Version | What changed |
|---|---|
| 1.24.1 | "WG团购群" title centered in the banner (was left-aligned). |
| 1.24.0 | New `--primary: #059669` (Emerald-600) variable for the title banner, replacing the mistaken reuse of `--green-btn` (Emerald-500) — caught by comparing against the actual reference file rather than a mapping table alone. `--primary` also added to the dark-mode block, pinned to the existing dark `--green-btn` value, so dark mode's rendering doesn't change. See A5d. |
| 1.23.2 | Dropped the title banner's bottom border-radius entirely — the rounded corners exposed background slivers where they met the square-cornered 📢 button below. Plain rectangle now. See A5d. |
| 1.23.1 | Moved the 中文/English language toggle inside the title banner (was a sibling above it) — fixes a gap at the top edge where the toggle stayed inset while only the banner bled to the screen edges. See A5d. |
| 1.23.0 | New green title banner for "WG团购群" (`.shopHead.banner`), full-bleed on the two on-screen views only (not the PDF export or error-fallback screen). See A5d. |
| 1.22.0 | Light-mode palette swap to slate/emerald (`--bg`, `--paper`, `--ink`, `--muted`, `--line`, `--green`/`--green-btn`) — dark mode untouched. Active tabs/📢 button kept their existing dark-neutral fill, just recolored to the new slate-800, per explicit choice not to introduce a colored "primary" fill at that point. See A5d for the full mapping table. |
| 1.21.1 | Icon-only fix: "📋 复制清单（下单用）" → "💬 复制清单（下单用）" — 📋 was already the 商品查询/备货清单 expand-collapse icon on the same card, so a second, different-meaning 📋 button right next to it read as confusing; 💬 matches the other one-tap copy-to-clipboard button, 💬复制付款消息. No behavior change. |
| 1.21.0 | New "📋 复制清单（下单用）" button under the 商品查询 dropdown — one-tap plain-text copy of the stocking list, formatted for pasting into a supplier order chat. See A7c. |
| 1.20.0 | Tab bar changed from one flex row to two explicit rows (this project is used mainly on phone/tablet — a guaranteed row break reads more reliably than relying on flex-wrap): row 1 is real rounds + 成员, row 2 is test/v2 rounds (only rendered when one exists), both centered independently. Replaces 1.18.0's single-row "gap spacer" approach — `.buyTabGap` removed, `renderBuyTabsBar()` now wraps two `.buyTabs` rows in a new `.buyTabsWrap` column container instead. See A5c. |
| 1.19.0 | `renderProductMembers()` (商品查询 dropdown/search detail panel and the 备货清单 popup — both already shared this one function) now lists each buyer's item-type adjustments on that product too, via the existing `adjustmentLineHtml()`, instead of only the original order — no more hunting through every member's card to find a correction on one product. Total/subtotal stay original-order-only, unchanged. A buyer with an adjustment but no original order for this product (e.g. a walk-in add) is now included too, shown with "—" instead of a quantity. See A7. |
| 1.18.0 | **Round tab reorganization (see A5c for full detail).** New shared `isTestRound(gb)` helper (test = "测试" in label, or a non-plain-`YYYY-MM-DD` date) reused by both the boot sort and the new `renderBuyTabsBar()` tab-bar renderer — real rounds now always sort/group ahead of test rounds. Fixes a real latent bug: a "-v2"-style date could previously sort as "newest" under a plain string comparison, meaning the site could boot straight into a test round instead of the newest real one. `manifest.json`: 9/1 relabeled "9/1测试(v2)" (its `date`/file deliberately left unchanged — see A5c for why). |
| 1.17.0 | **Retroactively documented 2026-09-13** — this version shipped from a different chat session with no log entry written at the time (the gap itself was caught and flagged in this doc, then traced back via chat history). Shortened several button labels: 编辑调整→编辑, 标记已付款→未付款, Edit adjustments→Edit, Mark paid→Unpaid, 完成编辑→完成, Done editing→Done, and (per 1.14.0's earlier 打包→收/送 rename) Receive/Deliver→Pending, Received/Delivered→Done. Also relabeled the 备货清单 header 口味→产品, and added the 🗑️ 重置测试场次 (reset test round) button gated to `-v2`-suffixed date keys (two sequential `window.confirm()` prompts, plus the `-v2` check enforced again inside `resetTestRound()` itself, not just in whether the button renders). **Replaced `window.print()`-based export with a real generated PDF** (`html2canvas` + `jsPDF`, loaded lazily from CDN) — see the new "PDF export" note right after A7 below for why and how. This is also the session that added shortage strikethrough to both the stocking list and each member's items in the print report, rebuilt `printItemsLine()` into a two-column flex layout ending in a bold 合计 row, and reworded the payment reminder message template. **Lesson from this gap:** when picking up a project after time away, checking `APP_VERSION` against the log catches a stale *local* copy, but not a genuinely undocumented version that's already the copy you're looking at — if the log's top entry doesn't match `APP_VERSION` and nothing seems missing from the file itself, the fix is to log what's actually in the code now, not just wait for a mismatch to explain itself. |
| 1.16.0 | **#5 — new "待收/送商品" (owed-products) card on the 会员 tab.** Cross-round, same lazy/cached pattern as `computeOverdueByMember()` (`computeOwedProductsByMember()`), but for physical fulfillment instead of money. Confirmed gating rule: a member drops off this card entirely once their 收/送 (`packedStatus`) is marked for that round — trusted at that point even if a line was left unchecked. While still un-收/送'd, every ORIGINAL-order item (`m.items` — walk-in-added items never get a sort checkbox in the UI either, so they're correctly left out here too, matching what's actually on-screen) that isn't fully shortaged (❌, current qty ≈ 0 — already covered by the refund/shortage flow, nothing left to hand over) and isn't yet checked off in `sortedItems` (⬜) counts as still owed. Sub-rows group by round date/label, then list the specific unchecked product(s), newest-last. Excludes test/v2 rounds the same two ways `computeOverdueByMember()` already does. |
| 1.15.0 | **#4 — payment-reminder copy button on the 会员 (Members/overdue) tab.** New `buildReminderMessage(name, overdueData)`, separate from `buildMemberMessage()`: greets the member, lists every past round they still owe from (reusing 1.14.0's per-round `byDate` breakdown — round label + amount, one line each), then a combined-total line and an optional closing line, all worded via new `message-template.json` fields (`reminderDateLine`, `reminderTotalLine`, `reminderClosing`) so wording stays editable there like the other two message builders. Deliberately cross-round and summary-only (no item-level detail) — this is a nudge, not a receipt. Button reuses the existing `.copyMsgBtn` styling/copied-feedback pattern with its own `reminderCopiedFor` state so it doesn't collide with the per-round payment-message button's `copiedFor`. |
| 1.14.0 | **#1-#3 from the new work-list.** (a) Renamed the 打包/已打包 toggle to 收/送・已收/送 — same `packedStatus` collection and toggle mechanics, label-only change, now framed as tracking delivery/collection rather than packing. (b) 会员 (Members) tab: each row now shows the member's address (🏠, from the existing `memberInfo` directory — same data already shown in the round view, no new source) beside their name. (c) `computeOverdueByMember()` now keeps each member's per-round breakdown instead of collapsing straight to one number — `overdueByMember[name]` is `{ total, byDate: [{date, label, amount}] }` — and the Members tab renders one indented sub-row per group-buy date/label under each member's total, sorted oldest-to-newest. |
| 1.0.0 | Baseline — represents everything before version tracking existed (packed-status toggle, product search-as-you-type, round-tab coloring, and everything prior). |
| 1.1.0 | Introduced `APP_VERSION`/this log. Added inline per-item editors (stepper/grams/pieces/box-share) as a faster alternative to the "+ 调整" form — see A2c. Old form left fully intact. Not yet tested live or deployed. |
| 1.1.1 | Style-drift fix: the new inline editors' `data-item` attributes weren't wrapped in `escapeHtml()`, violating this file's own standing rule ("any variable-backed value landing in innerHTML — text or attribute — needs escapeHtml(), no exceptions" — see the accessibility/security audit note above). `itemKey` values are always safe ASCII catalog keys in practice, so this was never exploitable, but fixed for consistency with the rule as written. |
| 1.2.0 | Added a 参团人数 breakdown in the stats ticket — sub-rows grouping this round's members by their assigned 门牌/block (from `memberUnits`, e.g. "107", "109", "印度小店+后门"), grouped by exact text match. Anyone with nothing entered groups under "未填写", always sorted last regardless of count. |
| 1.2.1 | Fixed sub-row number misalignment from 1.2.0 — the counts were right-aligned to each row's own edge via `justify-content: space-between`, which doesn't produce a consistent visual column when labels are different lengths ("107" vs "印度小店+后门"). Switched to a fixed-width, right-aligned value column (flex:1 label + flex-shrink:0 value) so the numbers line up regardless of label length. |
| 1.3.0 | **Replaced 1.2.0/1.2.1's subtotal breakdown entirely** — that wasn't the actual request. Added a proper 门牌/block filter: a search box + tappable chips above the stats ticket, narrowing the member list shown under 全部/未付款/已付款 down to one address (substring match against `memberUnits`, so searching "后门" also matches a combined entry like "印度小店+后门"). Combines with, doesn't replace, the paid/unpaid tab filter. Chips list only addresses actually used by this round's members. Typing genuinely needs a full `render()` (unlike the 商品查询 search box) since non-matching members' rows don't exist in the DOM at all to toggle — focus/cursor position is manually restored to the input right after each render() instead. |
| 1.3.1 | Replaced 1.3.0's free-text search + dynamic chips with a fixed 4-option dropdown (107/109/印度小店/后门 — a `<select>`, not derived from whatever values happen to exist in the data). Matching is still substring-based against `memberUnits`. Simpler than 1.3.0 in one respect: a `<select>` change event fires once per selection, not per keystroke, so the focus-restoration workaround from 1.3.0 is gone — dead code (`handleUnitFilterInput`, `distinctMemberUnits`) removed along with it. |
| 1.4.0 | Added per-item-line sorting checkboxes (⬜/✅) for physically pulling stock — a finer-grained cousin of the 打包 toggle, per member+item instead of just per member. New `sortedItems/{date}` Firestore collection, flat map keyed by `memberName::itemKey`, live-synced like paidStatus/packedStatus so multiple people sorting together see each other's ticks in real time. Deliberately ungated (no edit-mode check), matching 已付款/已打包. Independent of payment/packed/adjustments — purely a physical-sorting tracker, never touches money. Needs the updated `firestore-rules.md` (new `sortedItems/{groupBuyDate}` rule) pasted into the Firebase console — separate deploy step from the GitHub Pages upload, same as every other new collection this project has added. |
| 1.4.1 | Added a member name search box above the 门牌/address dropdown, for finding one particular person in a long roster. Substring match against `m.name`, combines with (doesn't replace) the address filter and paid/unpaid tabs. Same "genuinely needs a full render() per keystroke, restore focus/cursor manually after" approach as the address filter's original free-text version (1.3.0) — this one stayed a text input rather than becoming a fixed dropdown, since member names aren't a small fixed set the way the four addresses are. |
| 1.4.2 | Fixed a real bug found via testing: typing Chinese names into 1.4.1's member search box with a Pinyin IME duplicated characters (English keyboard was fine). Cause: the input's render()-per-keystroke recreates the `<input>` DOM node mid-keystroke, which is harmless for a complete English character but confuses an IME's in-progress composition (a Pinyin keyboard fires intermediate "input" events per candidate before the character is confirmed). Fix: skip processing while `e.isComposing` is true, and apply the filter on `compositionend` instead. Audited every other free-text input in the app (`adjNote`, `adjWalkinName`, `.unitInput`, `productSearchInput`) for the same pattern — none of them call render() per keystroke, so this was the only instance. |
| 1.13.0 | **#1, the last item from the work-list — collapsible stocking list.** The "all products" view in 商品查询 (`renderAllProductsList`, shown by default when no single product is selected) can run to 30-40+ rows — now starts collapsed behind a "📋 查看全部商品备货清单（N 种商品）" tap-to-expand summary, with a "收起备货清单" link to close it back down once open. Scoped narrowly: only affects that ONE default "nothing selected" view — picking a specific product (dropdown or search result) or typing into the search box already shows a focused result regardless of this flag, since neither of those is the lengthy list being collapsed. Resets to collapsed on every round switch. **This closes out the full 11-item work-list from this session.** |
| 1.12.0 | **#11 — per-card edit toggle**, added alongside (not replacing) the toolbar's "编辑调整" button, per explicit confirmation both should exist. Every member card now has its own "编辑调整"/"完成编辑" button next to 打包/标记已付款, so entering edit mode no longer requires scrolling to the toolbar and back up to the card actually being edited — tapping any card's button flips the same shared `editMode` state (there's still only one global edit mode, not per-card state; every card's inline editors appear/disappear together, same as before). Extracted the toggle logic into a shared `toggleEditMode()` function so the toolbar button and every card button behave identically, including the one edge case: first-ever unlock on a device (rare — `editUnlocked` persists afterward) needs a PIN, and that prompt only ever renders in the toolbar — so tapping a card's button in that specific case now auto-scrolls down to the prompt, rather than silently doing nothing from the person's point of view. `.rowBtns` gained `flex-wrap` so the third button doesn't overflow on narrow screens. |
| 1.11.0 | **#9 from the work-list — new 会员 (Members) tab**, showing each member's currently-unpaid total summed across every past round, not their lifetime spend. Positioned as the rightmost tab, after the oldest real round (9/1), in both the normal round view's tab bar and its own. A `currentView` state ("round"/"members") branches `render()` early into a separate, much smaller template for this tab — the lang pill, shop header, and tab bar are shared, everything else is a single card of name + amount owed, sorted biggest-owed-first.<br>Computed lazily via `computeOverdueByMember()` — only fetches/aggregates when the tab is actually opened (not on every page load), then caches for the rest of the session. For each real past round (a plain `YYYY-MM-DD` date, today or earlier — explicitly excludes anything with a "测试"/test-style date suffix, so 9/10测试(v2)-style rounds can never contaminate a real total), fetches that round's data file + `paidStatus` + `adjustments` (mirroring `refreshRoundStatuses`'s existing one-time-read pattern), computes each member's total the same way the per-round view does (`cost(items) + sum of amountDelta`), and adds it to their running total only if they're NOT marked paid for that specific round. Walk-in-only members (no `orders` entry, only adjustments) are included correctly since `cost()` of an empty item set is $0 and their total comes entirely from their adjustments. |
| 1.10.0 | **#4 from the work-list — interleave each adjustment with its own product**, fixed in all three places a member's items+adjustments render: the on-screen card, the copyable WeChat payment message, and the print report's compact summary line. Rule (same everywhere): an adjustment tied to a product on the member's ORIGINAL order (`m.items`) — item-type or weight-type — now renders directly under that product's own line, instead of every adjustment being dumped in one block after all the items regardless of which one it corrects. A flat-dollar credit, or an item-type addition of a product the member never originally ordered, has no original line to attach to and stays in a trailing block after the items, same as before. Confirmed scope directly from a live example (screenshots of 甘榜鸡/小条金钱腱 corrections both landing at the end instead of under their own items). Extracted the on-screen version into a new `renderMemberItemLines(m)` function so the interleaving logic isn't duplicated inline in the giant render() template.<br>**#8 — added 辽宁巨峰家庭版(4串/箱)** to the master catalog as `grape_jufeng_family`, `weighMode:"proportional"` — confirmed as the same bunch-varies grape as the standard 辽宁巨峰, just more bunches per box (4 vs 3) and a bigger box, not a fixed-weight item. No price stored in the catalog (per existing convention — price is round-specific), to be set whenever it's actually ordered in a round's own data file. |
| 1.9.0 | **Phase 2 (#6) and Phase 3 (#2, #3) from the work-list.**<br>**#6 — actual weight in payment messages, real regression fixed:** `actualWeightFor()` only ever checked for the legacy `type:"weight"` annotation entry (from the old form's dedicated radio option). The new inline weight/box-share editors never create that entry type — they save a structured `actualGrams`/`actualPieces` field directly on the ordinary `type:"item"` entry instead (`saveInlineItemAdjustment` gained an `extra` param for this). Result: the weight note silently stopped appearing in payment messages for anything corrected through the current normal UI — same shape of regression as the "$" sign bug in 1.8.0 (a feature's one true source moved, the reader kept checking only the old one). Fixed by having `actualWeightFor()` check both sources and pick whichever is most recent.<br>**#2 — new-member form position:** its trigger button lives in the toolbar, well below the member list, while the form itself renders right after that list — often a full screen or more above where the button actually is. Added `scrollIntoView({behavior:"smooth"})` on open (not on close, to avoid an unwanted jump when collapsing it).<br>**#3 — address auto-populate/entry for walk-ins:** added an address field to the walk-in form. Typing a name that matches an existing member in the 门牌 directory auto-fills the address (direct DOM write, not a full render, so it doesn't steal focus from the name field mid-keystroke) — but only while the address field is still blank, so it never overwrites a manual entry. On save, the address is written into the same shared `memberInfo/directory` doc the 门牌管理 panel uses, via the existing `saveMemberUnits()` helper — available for lookup next time, and for organizing this delivery like anyone else's address. |
| 1.8.0 | **Root-caused the recurring "$" sign regression (this is at least the second time it's disappeared).** Found the actual cause: `formatAmt()` deliberately stripped "$" with a comment explaining it "matches how this group writes messages by hand" — a real, once-correct decision that the person later explicitly overrode by asking for "$" back. Because the override was never written into the comment, a later session read the stale comment, saw no "$" in the output, and concluded that was correct-as-designed rather than a regression — reverting the fix without realizing it was one. Fixed properly this time: `formatAmt()` now includes "$", with the comment stating plainly that this is the current confirmed behavior and should not be "corrected" back to no-$ without the person explicitly asking for that specific change in-conversation. Also handled a sign-placement subtlety the naive fix would have gotten wrong: for a negative amount, `Number(x).toFixed(2)` already produces a leading "-", so blindly prepending "$" gives "$-6.6" instead of "-$6.6" — fixed to place "$" after any leading "-". Verified against all three call sites (item line, adjustment line — which separately prepends its own "+"/"" sign — and the total line). Also duplicated 9/11 as a fresh `data-2026-09-11-v2.json` + manifest entry ("2026-09-11-v2"), as a safe testing ground for the current work-list without touching the real 9/11 round's live data. |
| 1.7.5 | Since 1.7.2's finer 10g weight rounding, computed dollar amounts from weight/piece/ratio corrections could land on odd cents (e.g. 0.33kg × $22 = $7.26). Added `roundMoneyDown()` — same buyer-favor floor as `roundGramsDown`, applied to the dollar amount only, always rounding to the nearest 10 cents: a charge (positive) rounds down to a smaller amount owed; a refund (negative) rounds down too, which makes it *more* negative — i.e. a bigger refund. The kg/piece quantity itself is untouched (still shows e.g. 0.33kg) — only the resulting dollar figure rounds. Applied everywhere a dollar amount gets computed from a delta × price: both actual-save sites (the new inline editors' shared `saveInlineItemAdjustment`, and the old form) and all 5 live-preview computations, so what's shown before saving always matches what actually gets saved. |
| 1.7.4 | Fixed the real bug behind the 牛肋条 1300g-vs-1390g report. Root cause: the old "+ 调整" form's grams-helper computes its preview/auto-filled qtyDelta against `currentQtyFor()` **at typing time**, but the final "保存" click blindly trusted whatever number was left sitting in that field — never recomputing it. Deleting an old adjustment (via 撤销) and then saving a replacement *without retyping the grams* submitted the stale, pre-deletion delta. Fixed by recomputing the delta fresh, from current live state, at the moment "保存" is actually clicked, whenever the grams-helper was used — closing the staleness window entirely rather than just narrowing it. The new inline "实际到货克数" editor was never affected (it already recomputes `current` fresh every time it's opened), which is why switching to it "fixed" the symptom before the actual root cause was found. Also fixed a smaller latent bug surfaced while investigating: `#cleanupInvalidBtn` shared the `.adjUndo` class with per-entry undo buttons, so clicking it also fired the generic per-entry delete handler with an invalid id (harmless, but wasteful) — guarded that binding to skip elements with no `data-id`. |
| 1.7.3 | Fixed a real bug: member name search was case-sensitive (plain `.includes()`), so searching "jia" couldn't find "Jiamin" while "J" could. Now compares both sides lowercased, so "jia"/"Jia"/"JIA" all match the same way regardless of how the member's actual name is capitalized. Confirmed with the specific case that surfaced it (member 30, 9/11 round). |
| 1.7.2 | Changed the house billing rule from rounding actual weight down to the nearest 100g to the nearest **10g** (e.g. 1395g → 1390g, not 1300g) — still always in the member's favor, just finer-grained. Single change in `roundGramsDown()`; all three call sites (the live preview text, the actual save action, and the old form's gramsHelper) route through that one function, so the fix applies consistently everywhere without needing separate edits. Updated the UI text and this doc's own description of the rule to say 10g instead of 100g so neither lies about what the code actually does. |
| 1.7.1 | Fixed a real gap you caught from a live screenshot: fully-shortaged items had no visible marker on the item line itself — the ⬜ sort checkbox showed exactly the same for a real shortage as for "just haven't sorted this yet," making them indistinguishable at a glance without reading the separate ↳ adjustment line below. Restores the ❌ marker concept from the original mockup work, compatibly with the Option B decision (item's own qty/amount text stays frozen at the original order — only a visual badge/strikethrough is added, no numbers change): an item whose `currentQtyFor()` resolves to 0 now shows ❌ in place of the sort checkbox (nothing left to physically pull, so a checkbox there doesn't make sense either) and its row is struck through/muted. A partial shortage (some but not all arrived) keeps the normal sort checkbox — there's still something to sort — plus a small ⚠️ "部分到货" flag so it isn't mistaken for a full, untouched order. The separate ↳ ledger line and its exact dollar figure are unchanged. |
| 1.7.0 | **Bilingual UI chrome (Mandarin default, English toggle).** Pill switcher added above the group header, persisted per-device via `localStorage` (`wg_ui_lang`) — same pattern as `editUnlocked`. Data (member names, product labels, everything from `message-template.json`) always stays Mandarin regardless of this toggle, since buyers read the generated WeChat messages, not the admin. 89-key `UI_TEXT` dictionary + `t(key)`/`tFmt(key, values)` helpers, covering tabs, all pay/pack/shortage/save/cancel/undo buttons, every inline editor's buttons and placeholders (plus their computed preview/error sentences via three new formatter functions — `previewPieceCalc`/`previewGramsCalc`/`previewFracCalc` — since those assemble around live numbers, not fixed strings), stat labels, section titles, toolbar, locked-round banner, the shortage card, the old adjustment form, and the copy-message buttons. Verified every dictionary key is both defined and actually called (no dead entries, no missing lookups) via a scripted cross-check before shipping. **Deliberately left Mandarin-only:** anything written into an adjustment's `note` field (flows into buyer-facing messages) and the print/export report (likely handed out as a physical document). |
| 1.6.1 | Corrected 1.6.0's first half. The struck-through original-vs-actual display in 商品查询 was the wrong read of the requirement and is removed (along with its now-dead CSS). The requirement is simply that **the product list as published when the round opened stays untouched by delivery-day edits** — so 商品查询, 备货清单, their 合计/小计 lines, and the printed report now all build from `m.items` (original orders) instead of `effectiveItems()`, with no adjustment annotations anywhere. Walk-in members carry `items: {}`, so they're naturally excluded from these views too — correct, since they weren't in the published list. The stocking list's 合计 switched from `grandTotal` to `baseGrandTotal` to stay consistent with its now-original rows. The first card's round total is unchanged and still shows the adjusted figure with the 原始订单总额 footnote. Shortages are reported solely by the 缺货/退货明细 card from 1.6.0, which is unaffected. |
| 1.6.0 | **Proposal 1, built (see A8b).** Two changes. (a) 商品查询 no longer silently substitutes adjusted quantities for the ordered ones — the original is the primary figure, and where a correction exists the original is struck through with the actual received amount beside it (per-buyer, header total, and 小计). The first card's round total is untouched, by explicit decision. (b) New 缺货/退货明细（供索赔）card below 商品查询, aggregating every downward item correction by product: short quantity, refund owed, and who was affected (with notes), biggest loss first, plus an 应退合计 line. Only counts negative `qtyDelta` — upward corrections and walk-in adds don't offset a real shortage. Card hides entirely when nothing is short. No Firestore or rules change — it's derived from the existing `adjustments` data. |
| 1.5.0 | **Battery fix (step 1 of 3 — see A10).** Detach all four per-round Firestore listeners on `visibilitychange` when the page is hidden; reattach on return. Without this, a phone with the dashboard open in the background (common — it's a Home Screen app) held four live listeners open indefinitely, keeping the radio active on weak signal even with the screen off. Reattaching re-reads current state from the server, so nothing changed-while-hidden is missed. Refactored the four individual `subscribeToX(date)` calls behind `subscribeToRound(date)`/`unsubscribeFromRound()` so they can be managed as a group. The one-shot `refreshRoundStatuses()` and the single `memberUnits` listener are deliberately left running — neither is worth the extra state-juggling. |

