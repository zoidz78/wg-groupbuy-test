# BUILD PLAN — WG团购 H5 Order Intake + Admin Control (v2)

**Audience:** an implementing agent (Sonnet) with no prior context on this project.
**Status:** ✅ CODED. See the status banner immediately below before reading anything else.
**Working folder:** `/Users/effendy/multidev-deploy/WG GB WeChat /wggrpbuy/`
— note this is one level DEEPER than where this document itself lives
(`wggrpbuy/documentations/`). This corrects the original plan, which was
written before the domain-simulation folder existed.

---

## ⭐ STATUS AS OF 2026-09-15 — READ THIS FIRST

**If you are a fresh session with no memory of prior conversations, this
section is the fastest path to being useful. Everything below it is the
original plan plus inline ✅/❌ markers — read this banner, then Appendix A,
then only dive into the numbered sections for the specific area you're
touching.**

**Built and working, in `wggrpbuy/`:**
- `index.html` — member cart, fully built including custom-quantity ordering
  (half units, weight-in-grams, bunch/box-share fractions — see D80–D82,
  added AFTER this plan was originally written), the linked-gift mechanism
  (D83), and a remembered-cart mechanism (D87–D88) so a member's second visit
  is additive instead of a blind overwrite — still no server read, see D87.
- `admin/index.html` — control panel, fully built including the catalog
  screen, live orders, close+export, and the 💬 复制完整接龙（核对用） recap
  button (D84 — replaced an earlier, incorrect implementation).
- `test/run-tests.js` — 58/58 passing, self-updating (extracts and tests the
  live source of both files above against the real catalog/manifest data in
  this folder). Run it: `node test/run-tests.js` from `wggrpbuy/`.
- **BUG-1, a serious data-loss-adjacent bug, was found and fixed 2026-09-15**
  — see D85/D86 and `project-wggrpbuy-known-bugs.md` (Claude Code project memory
  — may not be visible from other Claude surfaces; this plan document and the
  bug's fix are what travel with the repo regardless of surface). **Its own fix
  briefly reintroduced the ORIGINAL date/label bug through a new path (BUG-1b,
  D86)** — fixed the same day. If you're extending anything near
  `labelManuallyEdited`/`rehydrateFromRound`/`startNewRoundFlow`, read D85+D86
  first; this exact class of mistake (a sticky flag with no reset on a
  "start fresh" path) has already happened twice here.

**Verified only by:** `node --check` syntax validation, an inline-handler-to-
`window` wiring diff, and the pure-function test suite above. **No real
browser has ever loaded these pages** — the sessions that built this could not
bind a local server (sandboxed environment). Effendy still needs to click
through it by hand at least once.

**Not done, and why:**
- `admin/dashboard.html` relocation (build step 8, §10) — gated on D57/D58
  (repo checkout location, staleness of the local copy). Effendy has also
  since **deliberately moved `dashboard.html` out** of `wggrpbuy/admin/` back
  to the parent folder — confirmed intentional, not drift.
- Build step 7 (`overview.md` update, new `firestore-rules-orders.md`) — see
  D56/D69, never applied.
- The whole two-Firebase-project security design (§8) — still
  `USE_FIRESTORE = false` on both pages, running on a `localStorage` adapter.
  Real cross-device sync needs: the new Firebase project (D73, not created)
  and admin email-link auth (D74/D79, not enabled).
- `CLOUDFLARE-CUTOVER.md`'s hosting migration — not started at all, entirely
  console/DNS work, independent of the code.

**If you're picking this up cold:** the honest next step is a real
browser click-through of both pages (publish a round, order from the cart,
verify the export), NOT more code. Nothing is currently blocking that except
that no session so far has been able to run a browser.

---

Read this whole document before writing code. Sections 0–3 are context and hard
constraints; sections 4–9 are the build.

**Appendix A is a numbered register of all decisions (D1–D88), each pointing at
its section.** Cite those IDs when discussing changes — "change D23" is unambiguous,
"change the error handling" is not. D57, D58, D60, D73 and D79 are still open and need the
human. If you change a decision, update both the register row and the section it
points at.

### Reference material in this folder

| File | What it is |
|---|---|
| `wg-groupbuy-project-knowledge.md` | **The authoritative project knowledge for the dashboard** (`dashboard.html` here, live as root `index.html`). ~120KB: architecture, the `data-<date>.json` schema, the three-way `weighMode` editor behaviour, the emoji map, and a full version log in section A9. **This document is a summary; that one is the source.** When the two disagree, it wins — and tell the human. |
| `README.md` | Repo structure + the Cloudflare Zero Trust setup for locking down `/admin`. Human console work, not code — except its final bullet, which has code consequences. See §8. |
| `CLOUDFLARE-CUTOVER.md` | **Runbook for the hosting migration** — GitHub Pages → Cloudflare Pages, private repo, Access. Independent of this build and can run before it. Its Stage 2 is the deploy procedure for this build. |
| `dashboard.html` | The dashboard itself. Copy its idioms (Firebase setup, `onSnapshot` error handling, cache busting, `productEmoji`) rather than inventing new ones. |
| `overview.md` | Short project/architecture summary. Needs two edits — see §9. |
| `WeChat-GrpBuy-Frontend.md` | The PRD this build implements. |
| `order-intake-form.md` | Earlier scoping notes for the same feature. |
| `secure.md` | Proposal for locking down Firestore. Its create-only rule pattern was **adopted** (§8.3); its anonymous-auth reasoning was **rejected** — see D63 for why. |
| `firestore-rules.md` | Rules for the **existing** `wg-group-buy` project's five collections. Do **not** append the new collections here — they belong to a separate project and a separate file (D69, §8.3). |

Before implementing anything that touches the `data-<date>.json` schema, the
`weighMode` editors, the emoji map, or the manifest, grep
`wg-groupbuy-project-knowledge.md` for the relevant term. Several fields there have
non-obvious history — the version log records at least two cases of a later session
"fixing" something that was actually a deliberate decision, because the reasoning
lived only in that doc.

---

## 0. What this project is

Effendy runs a recurring community WeChat group-buy (WG团购群). Members currently
type freeform 接龙 (chain-reply) messages into a WeChat group; someone then
hand-parses that chat thread into a `data-<date>.json` file that a payment
dashboard reads.

This build replaces **the typing-and-parsing step only** with a structured H5
cart + an admin control panel. It does **not** replace the dashboard, and it does
**not** change how `data-<date>.json` is consumed.

All user-facing UI text is Mandarin. Target environment is the mobile WebView
inside WeChat on iOS/Android.

### The three pages, once deployed

| URL | File in repo | What it is |
|---|---|---|
| `wggrpbuy.cc/` | `index.html` | **NEW** member-facing cart |
| `wggrpbuy.cc/admin` | `admin/index.html` | **NEW** organizer control panel |
| `wggrpbuy.cc/admin/dashboard.html` | `admin/dashboard.html` | existing payment dashboard, **relocated** |

---

## 1. Critical facts you must not get wrong

Read all six carefully. Each one has already caused, or is one step away from
causing, a real data bug.

### 1.1 `admin.html` and `index.html` in this folder are throwaway mockups

They were built to preview the WeChat look and feel. **They are not a codebase.**
Their JavaScript invented a data shape that does not match reality. Use them as a
*visual* reference only — palette, card layout, sticky footer, pill tabs, modal
pattern, Chinese copy — and write the JS fresh.

Specifically, do **not** carry forward any of these from the mockups:

- a `meta: {...}` wrapper in the export (the real schema has no such key)
- `emoji` stored on each product (emoji is derived at render time — see §1.3)
- `weighMode` as a boolean (it is a string — see §1.4)
- the `meat`/`seafood`/`fruit`/`frozen` categories (real ones are different — §1.5)
- the 6-product hardcoded `masterCatalog`

Archive both mockups to `_mockups/` rather than deleting them.

### 1.2 The live production file is named `index.html`, but it is the DASHBOARD

Today `wggrpbuy.cc/` serves the **payment dashboard**. In this staging folder that
same file is the local copy named `dashboard.html`.

The end state moves it to `/admin/dashboard.html` and frees up root for the new
member cart. **This is a cutover, not an addition.** The new root `index.html` and
the relocated `admin/dashboard.html` must ship in the *same* push — otherwise
either the dashboard vanishes from its current URL or two copies go live at once.

**Moving it is not a zero-code change.** The dashboard resolves four things
relative to its own directory. Dropped into `/admin/` unchanged, every one of them
404s and the page boots empty:

| What | Where in `dashboard.html` |
|---|---|
| `const MANIFEST_URL = "./manifest.json"` | line 506 |
| `const EMOJI_MAP_URL = "./product-emoji-map.json"` | line 530 |
| `const MESSAGE_TEMPLATE_URL = "./message-template.json"` | line 536 |
| every `gb.file` from the manifest (e.g. `"data-2026-09-10.json"`) | fetched at 976, 1020, 1092, 2354, 4005 |

The last one is data-driven — it comes from `manifest.json` entries, so a constant
rename does not cover it. See §7 for the exact fix.

### 1.3 Emoji is derived, never stored

Products carry no emoji field anywhere in the real data. The dashboard looks one up
at render time by substring-matching the Chinese label against
`product-emoji-map.json`. Both new pages must do the same, using the identical
function so all three pages agree:

```js
// Port verbatim from dashboard.html:1176-1189
function productEmoji(label) {
  const cats = EMOJI_MAP.categories || [];
  for (const cat of cats) {
    if ((cat.keywords || []).some(kw => label.includes(kw))) return cat.emoji;
  }
  return EMOJI_MAP.defaultEmoji || "🛒";
}
function emojiLabel(info) {
  return `${productEmoji(info.label)} ${info.label}`;
}
```

**The `categories` array order is load-bearing.** It runs specific → general (饺子
before 猪, 赠品 first). First match wins. Never sort or re-key that array.

Never write an emoji into the exported JSON.

### 1.4 `weighMode` is a string, not a boolean

In `product-catalog.json`: `"weight"` (82 products), `"proportional"` (4), or the
field is absent (85). The dashboard branches three ways on this to pick an inline
editor — a grams input, a bunch÷total box-share calculator, or plain `+/−`.
Flattening it to `true`/`false` silently breaks those editors. Pass the string
through untouched.

Related fields that must also survive into the export when present:
`gramsPerUnit` (56 products), `piecesPerUnit` (38).

### 1.5 `active` means two different things — do not conflate them

- In `product-catalog.json`, `active: true` means **"not discontinued."** All 171
  products currently have it. It is scaffolding for future use.
- In the mockup's `masterCatalog`, `active` meant **"on sale this round."**

If you reuse the catalog's `active` as the round-selection flag, **every product
publishes every round.** Keep a separate per-round `selected` Set in admin state.
Treat catalog `active` as a read-only pre-filter (hide `active: false` products).

### 1.6 `manifest.json` is cumulative — never emit a fresh one

**Shape — it is an object, not a bare array:**

```json
{
  "version": 6,
  "updatedAt": "2026-09-14T12:52:00.000Z",
  "groupBuys": [
    { "date": "2026-09-14",    "label": "9/14",        "file": "data-2026-09-14.json" },
    { "date": "2026-09-13-v2", "label": "9/13测试(v2)", "file": "data-2026-09-13-v2.json" },
    { "date": "2026-09-11",    "label": "9/11",        "file": "data-2026-09-11.json" }
  ]
}
```

The dashboard reads `manifest.groupBuys` and nothing else (`dashboard.html:3999`).
`version` and `updatedAt` are **new sibling fields added by this build** — safe,
because unknown keys are ignored. See §6.1 for what they're for.

`groupBuys` lists **every round ever**. The dashboard loads all of it into
`GROUP_BUYS` and uses it far beyond "which rounds exist": it walks every past round
to compute per-member payment totals (`:1014-1049`) and outstanding packing
(`:1086-1130`).

**Emitting a manifest containing only the new round wipes the entire round history
off the dashboard** — all totals, all history, in one deploy. This is the single
most destructive mistake available in this build. Fetch the existing file, insert
into it, emit the complete result.

**Array order is cosmetic — the dashboard re-sorts at boot.** `dashboard.html:3999-4001`
partitions on `isTestRound()` (`:573-577`: test = `date` not exactly 10 chars, or
`label` contains `测试`), sorts each group by date descending, and concatenates real
rounds ahead of test rounds. So file order cannot make the dashboard boot into the
wrong round — that bug existed and was fixed in v1.18.0.

Still prepend new entries for human readability, but do not add defensive sorting
logic on top; the consumer already handles it.

**Re-exporting the same round replaces its entry in place** rather than appending a
second entry with the same `date`.

If the manifest fetch fails, you cannot safely build one. See §6.1 for the required
degradation.

---

## 2. The real data you are working with

### 2.1 `product-catalog.json` — 171 products

Shape: `{ "_readme": "...", "products": { "<key>": {...}, ... } }`

| Field | Count | Notes |
|---|---|---|
| `label` | 171 | Chinese product name, often with a parenthetical spec |
| `category` | 171 | `Produce` 77 · `Frozen` 74 · `Meats` 9 · `Pantry` 9 · `Gifts` 2 |
| `unit` | 171 | `包`43 `份`31 `kg`28 `盒`18 `袋`18 `箱`13 `粒`7 `瓶`5 `只`3 `桶`2 `盘`2 `条`1 |
| `active` | 171 | all `true` — see §1.5 |
| `lastPrice` | 168 | **3 products have none** (see below) |
| `lastRound` | 150 | `2026-09-10` 76 · `2026-09-11` 37 · `2026-09-01` 29 · `2026-09-07` 8 · absent 21 |
| `weighMode` | 86 | `"weight"` 82 · `"proportional"` 4 |
| `gramsPerUnit` | 56 | |
| `piecesPerUnit` | 38 | |
| `note` | 20 | long internal supplier/pricing notes — admin display only, never exported |
| `aka` | 8 | alias array — must be searchable |

Example entry:

```json
"apple_envy": {
  "label": "Envy苹果(5粒/份)",
  "category": "Produce",
  "unit": "份",
  "lastPrice": 10.5,
  "lastRound": "2026-09-10",
  "piecesPerUnit": 5,
  "active": true
}
```

**The 3 products with no `lastPrice`:** `lotus_root`, `peach_rainbow_unclear`,
`gift_snack_random`. Their price field renders blank and **publish must be blocked
until a price is entered** for any selected product missing one. A product
published at `$0` or `undefined` corrupts the round.

### 2.2 `product-emoji-map.json`

`{ "defaultEmoji": "🛒", "categories": [ { "emoji": "🥟", "keywords": [...] }, ... ] }`
— 64 ordered categories. See §1.3.

### 2.3 The export target: `data-<date>.json`

This is the schema the dashboard already reads. **Match it exactly.**

```json
{
  "groupName": "WG团购群",
  "itemsLabel": "小馄饨团购",
  "products": {
    "sig":        { "label": "招牌鲜肉馄饨", "price": 6.5 },
    "pork_belly": { "label": "五花肉", "price": 12.0, "unit": "kg" }
  },
  "orders": [
    { "name": "Caroline 琛琛", "items": { "sig": 3 } },
    { "name": "Amy", "items": { "pork_belly": 0.5 } }
  ]
}
```

Rules, from the project knowledge doc:

- `groupName` is always `"WG团购群"`.
- `itemsLabel` is optional and dormant (nothing reads it anymore). Emit it if set.
- **Omit `unit` when it is `盒`** — that is the implied default. Emit it otherwise.
- Quantities may be fractional (`0.5` = 半份). Never round.
- Combined orders are one entry with names joined: `"Lesley & Choies"`.
- No `productLabel`, no delivery-note field, no `meta` wrapper, no `emoji`.

Companion `manifest.json` entry (newest first in that file):
`{ "date": "2026-09-13", "label": "9/13", "file": "data-2026-09-13.json" }`

---

## 3. Confirmed decisions

| Decision | Choice |
|---|---|
| Catalog source | **Deploy `product-catalog.json`** and `fetch()` it from the admin page. This deliberately retires the old "never deployed" rule in `overview.md` — update that line. |
| Backend this pass | **Firestore adapter behind a flag, plus a working localStorage bridge** so publish→cart and live orders are genuinely testable today. |
| Scope | **Real build, stubbed backend.** Production-bound code. |
| Layout | Final routed structure: root cart, `/admin/` panel, `/admin/dashboard.html`. |
| 支付看板 link | Admin header links to the dashboard. |
| **Firebase projects** | **Two.** A new project holds `rounds` + `orders` and is the only one the two new pages touch. The existing `wg-group-buy` project keeps the payment collections and stays reachable only from `dashboard.html`. **Reverses the PRD's one-project decision** — see §8. |
| **Hosting** | **Cloudflare Pages**, private repo, Access on `admin*`. Migration is `CLOUDFLARE-CUTOVER.md`, independent of this build. |
| **Access scope** | Viewing `/admin/*` restricted to 3–4 admin emails. The member cart stays fully public — there is no WeChat authentication available, and members self-identify by typing a nickname. |
| **Firebase Auth** | **Email-link, admins only, new project only.** Rules allowlist 3–4 UIDs. No anonymous auth (D63). `dashboard.html` gets none and needs none. |

### Out of scope — do not attempt

- Anything in `CLOUDFLARE-CUTOVER.md` — hosting, DNS, repo visibility, Access
  policies. Console work, not code.
- Rewriting dashboard logic or UI — §7 is a 6-line path fix, nothing more
- Touching the existing `wg-group-buy` project, its five collections, or its rules
- Making the dashboard read Firestore; `data-<date>.json` stays hand-authored
- Firebase Auth on `dashboard.html` or the member cart — admin panel only (§8.2)
- Anonymous Auth anywhere (D63)
- WeChat Pay, native Mini Program
- 拼单 combined orders, proportional box-splitting, 称重当天才知道 estimate-then-adjust
  — these stay manual, handled on top of whatever the export produces


### Prerequisite the human must resolve

**This folder is a staging folder, not the git repo.** `git rev-parse` resolves to
the home directory, not a project repo. The real repo is `zoidz78/wg-groupbuy`,
deployed to GitHub Pages behind `wggrpbuy.cc`.

`manifest.json` and some `data-*.json` files were copied in on 2026-09-14 so the
export path can be developed against real data — but **the set is incomplete and
internally inconsistent.** The manifest names five rounds; only some of their data
files are present:

| `manifest.json` names | present in folder? |
|---|---|
| `data-2026-09-14.json` | ❌ |
| `data-2026-09-13-v2.json` | ✅ |
| `data-2026-09-11.json` | ❌ (folder has `data-2026-09-11-v2.json`, which the manifest does not list) |
| `data-2026-09-10.json` | ❌ |
| `data-2026-09-07.json` | ✅ |

Also present but unlisted: `data-2026-09-01.json`. `message-template.json` is absent.

Consequences:
- **The manifest merge in §6.1 is fully testable** — that only needs `manifest.json`
  itself, which is real. Test it hard; it is the most destructive path in the build.
- **The dashboard cannot boot cleanly here** — three of its five rounds 404, and its
  message template is missing. Do not treat those 404s as a bug you introduced.
- `dashboard.html` here is a **copy** of what is live and may be stale.

**Build the new files in this staging folder.** Before the §7 path fix is applied to
anything that ships, confirm with the human where the real checkout is and whether
this copy is current. Do not deploy a possibly-stale dashboard copy over the live one.


---

## 4. File layout to produce

```
WG GB WeChat /
├── index.html                 NEW — member cart
├── admin/
│   ├── index.html             NEW — control panel
│   └── dashboard.html         moved copy + §7 path fix (see prerequisite above)
├── product-catalog.json       unchanged, now deployed
├── product-emoji-map.json     unchanged, already deployed
├── firestore-rules.md         EDIT — add rounds + orders
├── overview.md                EDIT — retire the "never deployed" line
└── _mockups/
    ├── admin.html             archived
    └── index.html             archived
```

Each page is a single self-contained HTML file: Tailwind via CDN, vanilla JS, no
build step. Same stack as the dashboard.

Duplicating the small shared helpers (`productEmoji`, `noCacheUrl`, the adapter)
across the two new files is acceptable and preferred over a shared `.js` — it
matches how the dashboard is written and avoids a second network round-trip in a
flaky WeChat WebView. Keep the duplicated blocks byte-identical.

---

## 5. Shared foundations (both new pages)

### 5.1 Cache busting — mandatory house rule

GitHub Pages sends `max-age` headers; a returning tab will re-serve stale JSON from
disk and never hit the network. Every static JSON fetch uses both a cache-busting
query param and `no-store`. Copy verbatim from `dashboard.html:521-525`:

```js
const BOOT_TS = Date.now();                       // one stamp per page load
function noCacheUrl(url) {
  return url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + BOOT_TS;
}
const NO_STORE = { cache: "no-store" };
```

Usage: `fetch(noCacheUrl(CATALOG_URL), NO_STORE)`

### 5.2 Categories

```js
const CATEGORIES = [
  { key: "all",     label: "全部"     },
  { key: "Produce", label: "生鲜果蔬" },
  { key: "Meats",   label: "肉类"     },
  { key: "Frozen",  label: "冷冻速食" },
  { key: "Pantry",  label: "杂货"     },
  { key: "Gifts",   label: "赠品"     },
];
```

Render each tab with a live count: `生鲜果蔬 77`.

### 5.3 The storage adapter

One interface, two implementations, one flag. This is the entire Firebase
abstraction — no scattered `// TODO` comments anywhere else in the code.

```js
const USE_FIRESTORE = false;   // flip to true to go live
const store = USE_FIRESTORE ? firestoreStore : localStore;
```

**Interface — eight methods.** Subscriptions return an unsubscribe function.

```js
signInAdmin()                                         -> Promise<user>   // admin only
publishRound(round)                                   -> Promise<void>   // admin only
closeRound(date)                                      -> Promise<void>   // admin only
subscribeRound(date | null, cb(round|null), onErr)    -> unsubscribe
subscribeOrders(date, cb(ordersArray), onErr)         -> unsubscribe     // admin only
submitOrder(date, payload)                            -> Promise<void>   // addDoc, auto-ID
updateOrderItem(date, orderId, itemKey, qty)          -> Promise<void>   // admin only
deleteOrder(date, orderId)                            -> Promise<void>   // admin only
```

`subscribeRound(null, ...)` means "whatever round is currently open" — the member
cart uses this, since a member does not know the date.

**Note what the member cart may call:** `subscribeRound` and `submitOrder`, nothing
else. The rest are admin-only and the rules will reject them from an
unauthenticated browser (§8.3). Do not wire them into the cart even defensively —
a call that cannot succeed is a bug waiting to be misread as a permissions problem.

`submitOrder` takes no member key. It uses `addDoc()` and lets Firestore generate
the ID (§5.4). `updateOrderItem` and `deleteOrder` take the `orderId` the admin read
back from its subscription.


#### `localStore` — works today

Back it with `localStorage` keys `wggb:round:<date>`, `wggb:openRound`,
`wggb:orders:<date>`. Implement subscriptions with a `window.addEventListener
("storage", ...)` listener **plus** an immediate synchronous first callback (the
`storage` event does not fire in the tab that wrote the value, so also re-emit
locally after your own writes).

This gives genuine cross-tab live sync: publish in the admin tab, watch the cart
tab update. That is the point — it makes the UI testable before Firebase exists.

#### `firestoreStore` — write it, leave it off

Write it fully, in the dashboard's exact idiom. Same CDN version, same shape of
config object, same `onSnapshot` / `setDoc({merge:true})` patterns.

**Use the NEW Firebase project, not `wg-group-buy`.** See §8.1 — the project split
is the entire security model for this build, and initializing the old project on
either of these pages would undo it. Both new pages connect only to the new project.

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot, getDoc, setDoc, deleteField }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// NEW project — holds only `rounds` and `orders`. Safe to ship in a public page.
// Do NOT paste the wg-group-buy config here: that project holds payment data and
// the member directory, and its config must stay confined to admin/dashboard.html.
const firebaseConfig = {
  apiKey:            "<new project — human supplies>",
  authDomain:        "<new project>.firebaseapp.com",
  projectId:         "<new project>",
  storageBucket:     "<new project>.firebasestorage.app",
  messagingSenderId: "<new project>",
  appId:             "<new project>"
};
```

The human creates the project and supplies these values. **Leave the placeholders
and flag them — do not substitute the `wg-group-buy` values to "make it run," even
temporarily.** `localStore` exists for exactly that purpose. A stray commit with the
old config in a public page is the one mistake this whole design exists to prevent.

For reference on style only, the existing project's setup is at
`dashboard.html:486-499`.

Note the pages must be `<script type="module">` for these imports to work, the
same as the dashboard.

Mirror the dashboard's error handling: every `onSnapshot` takes an error callback
that writes a Chinese message into a visible status line and falls back to empty
state rather than throwing.

**The one pattern with no precedent in this codebase:** the orders subcollection
needs `onSnapshot(collection(db, "orders", date, "submissions"), ...)`. The dashboard
only ever uses document-level listeners, so there is nothing to copy. Expect this
specific call to be where a problem surfaces when the flag is first flipped, and
comment it as such.


### 5.4 Firestore document shapes

Both live in the **new** project (§8.1). Orders are a subcollection of the round, per
`secure.md`.

**`rounds/{roundId}`** — doc ID is the ISO date, e.g. `2026-09-13`:

```js
{
  date: "2026-09-13",
  label: "9/13",                    // manifest label
  itemsLabel: "金钱腱、甘榜鸡、海鲜及水果",
  status: "open",                   // "open" | "closed"
  products: {                       // only the selected products, round prices
    beef_jinqian_jian: {
      label: "小条金钱腱", price: 18.0, unit: "kg", category: "Meats",
      weighMode: "weight", gramsPerUnit: 1000   // when present in catalog
    }
  },
  publishedAt: "2026-09-13T02:00:00.000Z",
  closedAt: null
}
```

`status` is **security-relevant, not just UI state** — the rules read it to decide
whether a submission is allowed (§8.3). Closing a round stops orders at the
database, not merely behind a disabled button.

Only one round should be `open` at a time. Publishing a new round while another is
open must warn the admin and require confirmation.

**`category` is carried into the round doc, but never into the export.** The member
cart needs it to render category tabs (§6.2); `buildExport()` (§6.1) constructs its
output field-by-field and simply never reads it, so it cannot leak into
`data-<date>.json`. This is a deliberate divergence between the round shape and the
export shape — do not "simplify" by making them match.

**`rounds/{roundId}/orders/{orderId}`** — **auto-generated** doc ID:

```js
{
  name: "Starry",                          // raw display name as typed
  memberKey: "starry",                     // normalized, for admin grouping
  items:         { beef_jinqian_jian: 1 },
  pricesAtOrder: { beef_jinqian_jian: 18.0 },
  submittedAt: "2026-09-13T10:15:00.000Z"
}
```

**The auto-ID is load-bearing.** An earlier draft keyed these by member name — but
every nickname is known to the whole group, so a guessable ID plus any write
permission means anyone can overwrite anyone. An unguessable ID is what makes
`allow create: if <round open>` safe to hand to the public.

`memberKey` = display name trimmed, inner whitespace collapsed to one space,
lowercased. It is a **field**, not the doc ID. The admin groups on it so
`"Alex 妈妈"` and `"alex  妈妈"` land together.

**Submissions are append-only from the member's side.** A member cannot read, edit
or delete anything — so resubmitting creates a *second* document. The admin
reconciles (§6.1). Use `addDoc()`, not `setDoc()`.

---

## 6. Page specs

### 6.1 `admin/index.html` — control panel

#### Header

Keep the mockup's dark slate header, the status badge, and the round-label subtitle.
The 支付看板 button links to `/admin/dashboard.html` — absolute, per `README.md`
Step 3. (A relative `./dashboard.html` resolves identically in production; the
absolute form is specified so it stays correct if the panel is ever reached via a
path that doesn't end in a trailing slash.)

#### Opening modal

Unchanged from the mockup: `➕ 发起新一期团购` / `📋 查看/管理当前活跃接龙`.
The second button must be disabled with an explanatory line when no round is open.

#### Tab 1 — 商品上架与定价

Round metadata inputs first: a date picker (drives both the doc ID and the default
`label`), the `团购期数` label, and the optional `到货通知提示词` (itemsLabel).

Then the catalog. **The mockup's flat list does not survive 171 products** — it was
designed against 6. Required additions:

```
[🔍 搜索商品名 / key / 别名                     ]      已选 0 项
[全部 171][生鲜果蔬 77][肉类 9][冷冻速食 74][杂货 9][赠品 2]  [✓ 仅看已选]
[ ⟳ 一键沿用上期 (2026-09-10 · 76 项) ]
┌──────────────────────────────────────────────┐
│ 🍎 Envy苹果(5粒/份)                [toggle ●]│
│ apple_envy · 上期 $10.50                      │
│ 本期价格 $[ 10.50 ] /份                       │
└──────────────────────────────────────────────┘
```

- **Search** matches `label`, the product key, and every entry in `aka`.
  Add the IME composition guard the dashboard already uses for its member search —
  without it, typing Chinese via pinyin fires a filter on every intermediate
  keystroke and the list thrashes. Listen for `compositionstart`/`compositionend`
  and skip filtering while composing.
- **一键沿用上期** preselects every product whose `lastRound` equals the most recent
  `lastRound` value in the catalog, seeding each at its `lastPrice`. Compute that
  date at load; do not hardcode `2026-09-10`. This is the single biggest time-saver
  available — 76 of 171 products qualify.
- **Toggling on** seeds the price input from `lastPrice`. The price is **always
  individually editable** regardless — this is an explicit requirement, no bulk or
  locked pricing.
- Products with no `lastPrice` render an empty, highlighted price field.
- Where `note` or `aka` exist, show them as a small muted line. Never export them.
- Badges from `weighMode`: `称重` for `"weight"`, `分箱` for `"proportional"`, none
  when absent.

**添加全新临时/季节商品 modal.** Keep the mockup's auto-generated snake_case key and
its collision warning — that guard exists because of a real past incident
(`mango_pzh`) where a reused key overwrote history. Strengthen it: check against all
171 catalog keys, and make a collision **block** the save rather than just warning.
Drop the emoji input (emoji is derived, §1.3). Add a category select and the
optional `weighMode` / `gramsPerUnit` / `piecesPerUnit` fields. A product added here
lives only in this round's state; appending it back into `product-catalog.json`
stays a manual step.

#### Tab 2 — 实时订单审核

Requires `signInAdmin()` first — the rules deny reads to anyone else (§8.3). If
sign-in has not happened, show a sign-in prompt rather than an empty list, or the
failure reads as "no orders yet."

`subscribeOrders(date, ...)`. Per-member cards with `+/−` writing through
`updateOrderItem`. Two summary tiles: 已接龙总人数 and 当前预估订单额.

**Group submissions by `memberKey`, do not render them raw.** Members cannot edit
their own orders (§8.3), so a correction arrives as a *second document*. One card
per member, built from their **latest** submission by `submittedAt`.

Where a member has more than one:

- badge the card `该成员提交了 N 次 · 已采用最新一次`
- let it expand to show the earlier submissions with their timestamps
- offer `删除` per superseded submission, via `deleteOrder`
- let the admin promote an earlier one if the latest looks wrong

Latest-wins is correct because the cart tells members plainly that resubmitting
replaces their previous order (§6.2), so a resubmission is a full restatement, not
an addition. **Never sum submissions** — a member who resubmits `{beef: 2}` after
`{beef: 1}` wants 2, not 3.

**Totals compute from `pricesAtOrder`, not the current round price.** Price is
frozen at order time by design — if the organizer edits a price after someone has
already ordered, that member's submitted total must not silently restate. Where a
line's `pricesAtOrder` differs from the round's current price, show a small drift
badge (`原价 $18.00 → 现价 $19.00`) rather than hiding the discrepancy or
auto-correcting it.

Sort cards by each member's **earliest** `submittedAt` ascending — that is 接龙
order, which the downstream manual process depends on. A member who resubmits keeps
their original place in the queue.

#### Sticky footer — two actions

**`🚀 上架/更新本期接龙`** → validation, then `publishRound()`.
Block and explain if: no products selected, any selected product has an empty or
zero price, no date set, or another round is already `open` (confirm to override).
Re-tappable mid-round to push price or selection edits.

**`🔒 截团并导出`** → `closeRound()` first (member submissions stop), then open the
export modal.

**The modal produces two files, not one.** Read §1.6 before writing this.

**Fetch the manifest at export time, not at boot.** `fetch(noCacheUrl("../manifest.json"),
NO_STORE)` when the export modal opens. Boot-time caching opens a staleness window:
if someone deploys a round while the admin tab sits open, a boot-time copy would
silently drop that round when re-emitted. Export-time fetch shrinks that window to
seconds.

**The `version` field is the backstop for what the fetch can't catch.** It is a
plain integer, incremented on every emit, with `updatedAt` alongside it:

```js
function buildManifest(existing, date, label, file) {
  const rounds = (existing.groupBuys || []).slice();
  const entry  = { date, label, file };
  const at     = rounds.findIndex(e => e.date === date);
  if (at >= 0) rounds[at] = entry;      // re-export: replace in place
  else         rounds.unshift(entry);   // new round: prepend (cosmetic — §1.6)
  return {
    version:   (Number(existing.version) || 0) + 1,
    updatedAt: new Date().toISOString(),
    groupBuys: rounds
  };
}
```

What this buys, concretely: the downloaded file sits in Downloads until someone
commits it, sometimes a day later. Before committing, the version in hand can be
compared against the deployed one. Equal or lower means the copy is stale and
committing it would roll back whatever landed in between. Without the field there
is nothing to compare — two manifests differing by one entry look interchangeable.

Surface it in the modal: `manifest.json · v6 → v7 · 共 6 场团购`. A version that
didn't advance, or a count that dropped, is then visible before the file ships
rather than after.

Modal contents:

1. **`⬇️ 下载 data-2026-09-13.json`** — Blob + `URL.createObjectURL` + a synthetic
   `<a download>`. Revoke the object URL after the click.
2. **`⬇️ 下载 manifest.json`** — same mechanism, the full updated object.
3. **`⬇️ 下载全部 (2 个文件)`** — fires both sequentially with a ~300ms gap. Browsers
   throttle or block rapid consecutive downloads, so the two individual buttons must
   remain available as the reliable path; this one is a convenience, not the only way.
4. **`📋 复制 JSON`** and **`📋 复制 manifest`** — keep both. WeChat's in-app WebView
   blocks downloads unpredictably, and a silent download failure on a just-closed
   round loses data that cannot be reconstructed. Two independent egress paths per
   file is not redundancy here, it is the safety margin.

**Required degradation when the manifest fetch fails** (404, offline, or the admin
page opened over `file://`): you have no existing history to preserve, so building
a manifest would destroy it. In that case —

- **disable** the manifest download and copy buttons,
- show a clear Mandarin warning that the existing manifest could not be read,
- fall back to a small copyable box containing only the single new entry
  `{ "date": "2026-09-13", "label": "9/13", "file": "data-2026-09-13.json" }`
  for the human to paste into the real file by hand.

Never emit a manifest built from an empty or partial fetch, and never emit one whose
`groupBuys` is shorter than what was fetched.

The `data-<date>.json` export builder — note the `盒` omission and the field
pass-through:

```js
function buildExport(round, orders) {
  const products = {};
  for (const [k, p] of Object.entries(round.products)) {
    const o = { label: p.label, price: p.price };
    if (p.unit && p.unit !== "盒") o.unit = p.unit;   // 盒 is the implied default
    if (p.weighMode)     o.weighMode     = p.weighMode;
    if (p.gramsPerUnit)  o.gramsPerUnit  = p.gramsPerUnit;
    if (p.piecesPerUnit) o.piecesPerUnit = p.piecesPerUnit;
    products[k] = o;
  }
  const sorted = [...orders].sort(
    (a, b) => (a.firstSubmittedAt || "").localeCompare(b.firstSubmittedAt || "")
  );
  const out = { groupName: "WG团购群" };
  if (round.itemsLabel) out.itemsLabel = round.itemsLabel;
  out.products = products;
  out.orders = sorted.map(o => ({ name: o.name, items: o.items }));
  return out;
}
```

Serialize with `JSON.stringify(out, null, 2)`.

---

### 6.2 `index.html` — member cart

Keep the mockup's emerald header, card list, sticky cart bar, and success toast.

**Boot:** `subscribeRound(null, ...)`. Render only that round's `products`, at that
round's prices. Category tabs derive from the published set, hiding categories with
zero products. If no round is open, or `status === "closed"`, show a friendly
Mandarin empty state and disable submit — do not render a dead cart.

**Identify:** the 微信昵称 field. Plain text entry, nothing else — **no lookup, no
pre-fill.**

An earlier draft had the cart read back a member's existing order and let them edit
it. That is no longer possible and must not be reintroduced: the rules give members
`create` only, with no read (§8.3). That restriction is what stops one member
reading or overwriting another's order, and it is worth more than the convenience.

Because of that, **tell the member clearly that resubmitting replaces their previous
order**, near the submit button, in Mandarin — e.g.
`重新提交将覆盖你之前的订单，请填写完整订单内容`.

This is not cosmetic. The admin reconciles duplicate submissions on a latest-wins
basis (§6.1), so a member who resubmits intending to *add* items would silently lose
their earlier ones. The warning is what makes latest-wins the right rule instead of
a trap.

**Submit:**

1. Validate: nickname non-empty, cart non-empty, round still `open`.
2. `submitOrder(date, memberKey, { name, items, pricesAtOrder, ... })`.
   `pricesAtOrder` snapshots the price of every item **at this moment** (§6.1).
   Preserve `firstSubmittedAt` if a prior submission exists; always bump `updatedAt`.
3. Build the 接龙 text and copy it to the clipboard:

   ```
   1. {name}
   {emoji}{label} ${price}/{unit}[，称重][ -要{qty}份]
   ```

   `，称重` appears when `weighMode` is set; ` -要{qty}份` only when `qty > 1`.
   Emoji comes from `productEmoji()` (§1.3).
4. Show the toast telling them to paste it back into the group.

Keep the mockup's clipboard fallback: try `navigator.clipboard` when
`window.isSecureContext`, else the hidden-textarea + `execCommand("copy")` path.
WeChat's WebView needs the fallback.

The Firestore write is the system of record; the pasted text is a social audit
trail only.

---

## 7. `dashboard.html` relocation fix

Only do this once the human has confirmed which copy is authoritative (§3
prerequisite). This is the whole change — do not refactor anything else in that
file.

Add near the other URL constants (~line 506):

```js
// This file now lives at /admin/dashboard.html, but every data file it reads
// (manifest.json, the data-<date>.json files it names, the emoji and message
// maps) still lives at the site root. Without this prefix every fetch below
// resolves against /admin/ and 404s, and the page boots to an empty shell.
const DATA_BASE = "../";
```

Then:

| Line | From | To |
|---|---|---|
| 506 | `"./manifest.json"` | `DATA_BASE + "manifest.json"` |
| 530 | `"./product-emoji-map.json"` | `DATA_BASE + "product-emoji-map.json"` |
| 536 | `"./message-template.json"` | `DATA_BASE + "message-template.json"` |

And wrap the manifest-supplied filenames at all five call sites — 976, 1020, 1092,
2354, 4005 — changing `noCacheUrl(gb.file)` to `noCacheUrl(DATA_BASE + gb.file)`.
Cleanest is a tiny helper next to `DATA_BASE`:

```js
function dataUrl(file) { return DATA_BASE + file; }
```

`DATA_BASE` must be declared before `MANIFEST_URL` uses it.

Leave `EDIT_PIN` alone. Cloudflare Access will eventually front this path, but the
PIN stays until the human decides otherwise.

---

## 8. Security — how the pieces fit

Four mechanisms protect four different things. **Conflating them is the trap in this
section**, and the reason two earlier proposals were rejected.

| Mechanism | Protects | Does NOT protect |
|---|---|---|
| Private repo | source code on github.com | anything the site serves |
| Cloudflare Access | HTTP requests for `/admin/*` | the database |
| Two Firebase projects | payment data + member directory | the new project's contents |
| Admin Firebase Auth | round writes, order reads/edits | the dashboard (doesn't need it) |

The first two are `CLOUDFLARE-CUTOVER.md`'s job — console work, **write no code for
them**. The last two are this build's.

### 8.1 Why two Firebase projects

Any browser page that talks to Firebase must carry its connection details in the
page source. That is inherent to Firebase on the web, not a misconfiguration — the
protection is supposed to come from the security rules.

The existing rules are `allow read, write: if true` on all five collections. So
whoever holds the config can read and write **everything in that project**:
`paidStatus`, `adjustments`, `packedStatus`, `sortedItems`, and `memberInfo` — the
member directory, names and addresses included. They do not need the admin page;
they talk to Google's servers directly, and Cloudflare Access never sees the request.

Today that config lives only in `dashboard.html`, a page three people can open.

**The member cart would change that.** It is public by design — the link goes into
the WeChat group. Every member's browser would download whatever config it carries,
and keep it after they leave the group or forward the link.

So the config is split:

| Project | Collections | Config appears in | Reachable by |
|---|---|---|---|
| **New** (create one) | `rounds`, `rounds/*/orders` | root `index.html`, `admin/index.html` | anyone with the cart link |
| **Existing** `wg-group-buy` | `paidStatus`, `adjustments`, `packedStatus`, `sortedItems`, `memberInfo` | `admin/dashboard.html` only | 3–4 admins, behind Access |

**The admin panel does not use the existing project at all.** Check what it actually
needs: `product-catalog.json` (static), `manifest.json` (static), `rounds` and
`orders` (new project). Nothing else. Do not initialize the old project there.

The split also unblocked admin auth (§8.2). With one project, requiring auth would
have denied every read and write on the live dashboard, which has no sign-in code.
With two, auth applies only to the new project and the dashboard is untouched.

**Consequence — keep member addresses out of the new project.** The cart does not
need them; members type a nickname. Adding the directory there would reverse the
whole arrangement. Standing rule (D68).

### 8.2 Admin auth — a real provider, admins only

Rules cannot distinguish your admin panel from a member's browser unless something
in the request proves it. Cloudflare Access cannot supply that proof — it issues its
own cookie for the HTML request, and Firebase never sees it. The two systems are
unconnected.

So the 3–4 organizers sign in to Firebase on `admin/index.html`, with a **real**
provider, and the rules check their UIDs.

**Use email-link (passwordless), not Google.** Google sign-in is blocked inside
WeChat's WebView. Email-link is a plain form plus a link, and survives there.

```js
function isAdmin() {
  return request.auth != null
      && request.auth.token.firebase.sign_in_provider != 'anonymous'
      && request.auth.uid in ['UID_1', 'UID_2', 'UID_3'];
}
```

The `sign_in_provider` check matters — see below.

**Do NOT use Anonymous Auth.** `secure.md` proposes it, on the reasoning that
Cloudflare Access gates it. It does not. `signInAnonymously()` hits
`identitytoolkit.googleapis.com` directly; anyone with the `apiKey` from the public
cart's source can mint a valid token from a terminal without ever touching your
domain. With Anonymous enabled, `request.auth != null` is `if true` plus two extra
HTTP requests. Restricting the API key by HTTP referrer slows this down; referrer
headers are trivially forged outside a browser.

Anonymous auth has one legitimate use here — stamping an owner UID so a member could
edit their own order — and that was considered and dropped (D47). It is not a gate.

**Setup the human must do, before the flag flips:**

1. Firebase Console → Authentication → Sign-in method → enable **Email link
   (passwordless sign-in)**
2. Each admin signs in once on `admin/index.html`
3. Collect the three UIDs from Authentication → Users
4. Paste them into the rules and publish

Until then `USE_FIRESTORE = false` and `localStore` covers development (D70).

### 8.3 Rules for the new project

New file, `firestore-rules-orders.md`. Do **not** append to `firestore-rules.md`,
which documents the existing project and must stay accurate for the dashboard (D69).
Put a cross-reference line in each.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // The 3-4 organizers, signed in with a real provider. Anonymous tokens are
    // rejected explicitly: anyone can mint one from the public cart's config,
    // so `request.auth != null` alone would be worth nothing here.
    function isAdmin() {
      return request.auth != null
          && request.auth.token.firebase.sign_in_provider != 'anonymous'
          && request.auth.uid in ['UID_1', 'UID_2', 'UID_3'];
    }

    // Is this round still taking submissions?
    function roundIsOpen(roundId) {
      return exists(/databases/$(database)/documents/rounds/$(roundId))
          && get(/databases/$(database)/documents/rounds/$(roundId)).data.status == 'open';
    }

    // The published round: catalog and prices for one group buy. Public read —
    // every member's cart needs it. Only organizers publish, re-price or close.
    match /rounds/{roundId} {
      allow read:  if true;
      allow write: if isAdmin();

      // Member submissions. Anyone may create, but ONLY while the round is
      // open — closing stops late orders at the database, not just behind a
      // disabled button. Doc IDs are auto-generated, so nobody can guess or
      // overwrite someone else's submission. Members cannot read, edit or
      // delete anything, including their own.
      match /orders/{orderId} {
        allow create: if roundIsOpen(roundId);
        allow read, update, delete: if isAdmin();
      }
    }
  }
}
```

Notes:

- `roundIsOpen()` performs a document read per submission, which counts toward
  billing. Negligible at this volume, and it is what makes the close enforceable.
- The `create`-only grant is safe **because** the doc ID is auto-generated (§5.4).
  Reintroduce a guessable ID and this rule becomes "anyone may overwrite anyone."
- This inherits `secure.md`'s create-only pattern, which is a real improvement over
  an earlier draft of this plan. Credit where due.

**Residual risk, stated plainly:** a member could submit junk orders while the round
is open, since `create` is necessarily public. Bounded — you can see and delete them,
and the export is regenerable. Everything else is closed.

---

## 9. Also update `overview.md`

Two lines are now wrong:

- `"product-catalog.json is Claude-side reference only — never deployed, never
  fetched by index.html"` → it is now deployed and fetched by `admin/index.html`.
- The "Planned repo restructure (not yet built)" section → mark built, and record
  that the relocation required the `DATA_BASE` fix rather than being a pure move.

---

## 10. Build order

Each step should leave the tree in a working state.

1. ✅ `_mockups/` archive; create `admin/`.
2. ✅ Shared foundations: cache-busting helpers, `CATEGORIES`, `productEmoji`,
   catalog + emoji-map loaders with a boot guard.
3. ✅ `localStore` fully implemented and working. `firestoreStore` written but
   left disconnected (`USE_FIRESTORE = false`) — needs the new Firebase
   project (D73) and email-link auth (D74/D79), neither exists yet.
4. ✅ `admin/index.html` Tab 1 — catalog screen, search, filters, carry-over,
   pricing, new-product modal, publish validation. Also includes work done
   AFTER this plan was written — see D80–D88 in Appendix A.
5. ✅ `index.html` — member cart reading the published round, submit, 接龙 text.
   Also extended post-plan — see D80–D82.
6. ✅ `admin/index.html` Tab 2 — live orders, drift badges, close, then the
   two-file export (`data-<date>.json` + merged `manifest.json`) with
   downloads and copies.
7. ❌ **NOT DONE.** `overview.md` still says "never deployed" (D56 not
   applied). No `firestore-rules-orders.md` exists for the new project's
   rules (D55/D69 not applied) — this is the file the new project's
   `rounds`/`orders` rules from §8.3 were supposed to land in.
8. ❌ **NOT DONE, deliberately.** `admin/dashboard.html` relocation + §7
   `DATA_BASE` fix — gated on D57/D58 (repo checkout location, staleness of
   the local copy), both still open. The `DATA_BASE` fix itself WAS applied
   to a copy of `dashboard.html` at one point, but Effendy has since
   **manually moved `dashboard.html` back out** of `wggrpbuy/admin/` to the
   parent folder — confirmed deliberate, not drift. Before this step can
   happen for real, confirm where it should end up.

---

## 11. Acceptance checks

Run these in two browser tabs against the same origin with `USE_FIRESTORE = false`.

**Catalog**
- [ ] All 171 products load; tab counts read 77 / 9 / 74 / 9 / 2 and sum to 171.
- [ ] Searching `番夫子` finds `cherry_tomato` via its `aka` entry.
- [ ] Typing Chinese via pinyin does not thrash the list mid-composition.
- [ ] 一键沿用上期 selects 76 products at their `lastPrice`.
- [ ] Selecting `lotus_root` (no `lastPrice`) leaves the price blank and **blocks**
      publish with a clear Mandarin message.
- [ ] Adding a new product with key `apple_envy` is refused, not merely warned.

**Publish → cart**
- [ ] Publish in tab A; tab B's cart updates without a reload.
- [ ] Cart shows only selected products, at the round's prices, with correct emoji.
- [ ] No round open → cart shows an empty state, submit disabled.

**Orders**
- [ ] Submit from tab B; the card appears in tab A's 实时订单审核 without a reload.
- [ ] Resubmit under the same name → **one** member card, built from the latest
      submission, badged `该成员提交了 2 次`, expandable to show the earlier one.
- [ ] Quantities are **not** summed: `{beef:1}` then `{beef:2}` shows 2, not 3.
- [ ] Deleting the superseded submission leaves the card intact.
- [ ] Member ordering is by each member's **earliest** `submittedAt` — a member who
      resubmits keeps their original queue position.
- [ ] `"Alex 妈妈"` and `"alex  妈妈"` resolve to one member.
- [ ] The cart shows the `重新提交将覆盖你之前的订单` warning near submit.
- [ ] The cart never calls `subscribeOrders` / `updateOrderItem` / `deleteOrder`.
- [ ] Order doc IDs are auto-generated, not the member name.
- [ ] Raise a price in admin after an order exists → that order's total does **not**
      change, and a drift badge appears.
- [ ] 接龙 text matches `{emoji}{label} ${price}/{unit}` with 称重 and `-要N份`
      suffixes only where applicable.

**Export**
- [ ] Downloaded file is named `data-<date>.json` and parses.
- [ ] Top level is exactly `groupName`, optional `itemsLabel`, `products`, `orders`
      — no `meta`, no `emoji` anywhere.
- [ ] A `盒` product omits `unit`; a `kg` product includes it.
- [ ] `weighMode` is the string `"weight"`/`"proportional"`, never a boolean.
- [ ] `gramsPerUnit` / `piecesPerUnit` survive where the catalog had them.
- [ ] `orders` is sorted by `firstSubmittedAt`.
- [ ] Fractional quantity `0.5` round-trips exactly.
- [ ] The clipboard button produces identical JSON to the downloaded file.

**Manifest** (the destructive-mistake surface — test these deliberately)
- [ ] Downloaded `manifest.json` keeps the `{ version, updatedAt, groupBuys }` object
      shape — **not** a bare array. A bare array boots the dashboard to
      `manifest.json 里没有任何 groupBuys 条目`.
- [ ] `groupBuys` contains **every** pre-existing entry plus the new one. Count it
      against the source file before believing it.
- [ ] Test-round entries (`2026-09-13-v2`, label `"9/13测试(v2)"`) survive untouched.
- [ ] The new entry is at index 0; existing entries keep their relative order.
- [ ] Re-exporting the same round **replaces** its entry — `groupBuys.length` does
      not grow.
- [ ] `version` increments by exactly 1 each emit; a source file with no `version`
      yields `1`. `updatedAt` is a fresh ISO string.
- [ ] The modal header shows the version transition and round count
      (`v6 → v7 · 共 6 场团购`) and both match the emitted file.
- [ ] With `../manifest.json` unreachable, the manifest download and copy buttons are
      **disabled**, a warning shows, and the single-entry fallback box appears.
      A one-entry `manifest.json` must never be downloadable.
- [ ] `⬇️ 下载全部` yields two files; if the browser blocks the second, the individual
      buttons still work.

---

## Appendix A — Decision register (D1–D79)

Every commitment this plan makes, with a stable ID. **Cite these IDs when discussing
changes** — "change D23" is unambiguous; "change the search behaviour" is not. The
§ column points at the full spec.

If you are asked to change a decision, update both the register row and the section
it points at, or they drift.

**Status markers, added 2026-09-15 for cross-session continuity:**
- ✅ — genuinely implemented and working code, verified by `node --check` +
  wiring diff + the test suite (or, for pure UI/console decisions with nothing
  to test, confirmed by direct inspection of the file).
- ⚠️ — partially true, or true in a way that needs the caveat right after it
  read in full before trusting it. Several of these are the Security-section
  rows where the CODE reflects the intended design but no actual
  Firebase project/rules file exists yet to enforce it — see D64/D77 in
  particular before assuming any of this is actually protecting anything live.
- ❌ — not done. Mostly Security/Docs rows blocked on D57/D58/D69/D71/D73/D74
  (repo location, the new Firestore project, hosting migration, admin auth) —
  none of which are code problems, all of which need the human.
- 🔲 — pure console/human work, not a code decision at all; nothing to verify.

### Structure & files

| ID | Decision | § |
|---|---|---|
| D1 | ⚠️ Root `index.html` = member cart (new, ✅ done); `admin/index.html` = control panel (new, ✅ done); `admin/dashboard.html` = relocated dashboard (❌ NOT done — see D54) | 4 |
| D2 | ✅ Old `admin.html` + `index.html` archived to `_mockups/`, not deleted | 4 |
| D3 | ✅ Each page self-contained: Tailwind CDN, vanilla JS, no build step | 4 |
| D4 | ✅ Shared helpers duplicated per page rather than a shared `.js` — matches the dashboard, avoids a second fetch in WeChat's WebView | 4 |
| D5 | ✅ `product-catalog.json` gets deployed (retires the "never deployed" rule) | 3, 9 |

### Data contracts

| ID | Decision | § |
|---|---|---|
| D6 | ✅ Export = `{groupName, itemsLabel?, products, orders}` — no `meta`, no `emoji` | 2.3 |
| D7 | ✅ `groupName` always `"WG团购群"` | 2.3 |
| D8 | ✅ `unit` omitted when `盒`, emitted otherwise | 2.3, 6.1 |
| D9 | ✅ `weighMode` stays a string (`"weight"`/`"proportional"`/absent), never boolean | 1.4 |
| D10 | ✅ `gramsPerUnit` / `piecesPerUnit` pass through where present | 1.4, 6.1 |
| D11 | ✅ `note` / `aka` are admin-display only, never exported | 2.1, 6.1 |
| D12 | ✅ Fractional quantities preserved exactly, never rounded | 2.3 |
| D13 | ✅ `rounds/{date}` = `{date, label, itemsLabel, status, products, publishedAt, closedAt}` | 5.4 |
| D14 | ✅ `rounds/{roundId}/orders/{orderId}` (**auto-ID**) = `{name, memberKey, items, pricesAtOrder, submittedAt}`. Append-only from the member side | 5.4 |
| D15 | ✅ `memberKey` = trimmed, whitespace-collapsed, lowercased name — a **field**, not the doc ID. A guessable ID plus any write grant lets anyone overwrite anyone | 5.4 |
| D16 | ✅ Only one round `open` at a time; publishing over an open one needs confirmation | 5.4, 6.1 |

### Shared behaviour

| ID | Decision | § |
|---|---|---|
| D17 | ✅ Cache busting on every JSON fetch: `?v=BOOT_TS` **and** `cache:"no-store"` | 5.1 |
| D18 | ✅ Emoji derived via `productEmoji()` ported verbatim; `categories` array order preserved | 1.3 |
| D19 | ✅ Categories 全部 / 生鲜果蔬 77 / 肉类 9 / 冷冻速食 74 / 杂货 9 / 赠品 2, with live counts | 5.2 |
| D20 | ✅ Storage adapter: 6 methods, two implementations, `USE_FIRESTORE = false` | 5.3 |
| D21 | ✅ `localStore` via localStorage + `storage` event, with local re-emit after own writes | 5.3 |
| D22 | ✅ `firestoreStore` written fully in the dashboard's idiom, same CDN 12.18.0 + config | 5.3 |
| D23 | ✅ Every `onSnapshot` gets an error callback writing a Chinese status line | 5.3 |

### Admin — catalog tab

| ID | Decision | § |
|---|---|---|
| D24 | ✅ Search across `label`, key, and `aka`, with IME composition guard | 6.1 |
| D25 | ✅ Category tabs with counts + `仅看已选` filter | 6.1 |
| D26 | ✅ `一键沿用上期` preselects the most recent `lastRound` cohort at `lastPrice` — date computed, not hardcoded | 6.1 |
| D27 | ✅ Toggling on seeds price from `lastPrice`; price always individually editable | 6.1 |
| D28 | ✅ The 3 products with no `lastPrice` render blank and **block** publish | 2.1, 6.1 |
| D29 | ✅ New-product modal: key collision **blocks** save; emoji field dropped; category + weigh fields added | 6.1 |
| D30 | ✅ New products live in round state only; writing back to the catalog stays manual | 6.1 |

### Admin — orders tab

| ID | Decision | § |
|---|---|---|
| D31 | ✅ Live subscription, cards sorted by `firstSubmittedAt` (= 接龙 order) | 6.1 |
| D32 | ✅ Totals from `pricesAtOrder`, **not** current price | 6.1 |
| D33 | ✅ Price drift shown as a badge (`原价 $18.00 → 现价 $19.00`), not auto-corrected | 6.1 |
| D34 | ✅ Inline `+/−` writes through `updateOrderItem`; `deleteOrder` removes superseded submissions. Survives because admin auth (D74) gives the rules something to check | 6.1 |

### Export & manifest

| ID | Decision | § |
|---|---|---|
| D35 | ✅ Close flips `status:"closed"` first, then opens the modal | 6.1 |
| D36 | ✅ Manifest fetched **at export time**, not boot | 6.1 |
| D37 | ✅ Manifest keeps `{version, updatedAt, groupBuys}` object shape | 1.6 |
| D38 | ✅ `version` increments by 1 per emit; modal shows `v6 → v7 · 共 6 场团购` | 6.1 |
| D39 | ✅ New entry prepended; same-date re-export replaces in place | 1.6, 6.1 |
| D40 | ✅ No defensive sorting — dashboard re-sorts at boot via `isTestRound()` | 1.6 |
| D41 | ✅ Two downloads + a `下载全部` convenience button (~300ms gap) | 6.1 |
| D42 | ✅ Clipboard copy kept for **both** files | 6.1 |
| D43 | ✅ Manifest fetch failure ⇒ manifest buttons disabled, warning, single-entry fallback box | 6.1 |

### Member cart

| ID | Decision | § |
|---|---|---|
| D44 | ✅ Renders only the open round's products at that round's prices | 6.2 |
| D45 | ✅ No open round, or closed ⇒ empty state, submit disabled | 6.2 |
| D46 | ✅ **Dropped, server-side, still true.** No SERVER lookup, no pre-fill from Firestore — members have `create` only, no read. Do not reintroduce a server read. **UX cost later mitigated by D87 via a client-only mechanism** — see that row before assuming this gap is unsolved. | 6.2 |
| D47 | ✅ **Dropped, still true.** Resubmitting creates a second document; the cart warns `重新提交将覆盖你之前的订单`. Admin reconciles latest-wins (D75). **D87 reduces how often this warning matters in practice** by pre-filling the cart so a member's second visit is naturally additive instead of a blind overwrite — the server-side mechanics here are unchanged. | 6.2 |
| D48 | ✅ `pricesAtOrder` snapshotted at submit; `firstSubmittedAt` preserved across resubmits | 6.2 |
| D49 | ⚠️ **Superseded by D80–D82.** The literal format here is stale: 称重 suffix was removed entirely (client-facing decision, 2026-09-15), and the quantity tail was redesigned into `qtyTail()` (kg → bare "0.7kg", proportional → bare fraction, else → "x{qty}") to support D80's custom-quantity ordering. `execCommand` fallback is still accurate. | 6.2 |

### Dashboard relocation

| ID | Decision | § |
|---|---|---|
| D50 | ⚠️ Fix was written and applied to a copy of `dashboard.html`, but Effendy has since **deliberately moved `dashboard.html` out** of `wggrpbuy/admin/` back to the parent folder — so this fix is not currently "live" in the domain simulation. Not blocking anything; just don't assume the file is where D1 says it should end up. | 7 |
| D51 | ⚠️ Three URL constants rewritten (506, 530, 536) | 7 |
| D52 | ⚠️ `gb.file` wrapped at five call sites (976, 1020, 1092, 2354, 4005) | 7 |
| D53 | ✅ `EDIT_PIN` left alone | 7 |
| D54 | ❌ Not shipped. Still gated on D57/D58, both open. See D50's caveat too — the file has moved OUT of the domain folder since the fix was applied. | 7, 10 |

### Docs

| ID | Decision | § |
|---|---|---|
| D55 | ❌ New project gets `rounds` and `orders/{date}/submissions` rules (see D69 — separate file) | 8.3 |
| D56 | ❌ `overview.md` — retire the "never deployed" line, mark the restructure built | 9 |

### Security

| ID | Decision | § |
|---|---|---|
| D61 | 🔲 Cloudflare Zero Trust app (`Group Buy Admin Suite`, `wggrpbuy.cc`, path `admin*`, Allow/Include/Emails, 3–4 addresses) is **human console work — write no code for it** | 8, cutover |
| D62 | ✅ 支付看板 nav link is absolute `/admin/dashboard.html`, per `README.md` Step 3 | 6.1 |
| D63 | ✅ **No Anonymous Auth, ever.** `secure.md` proposes it on the reasoning that Cloudflare Access gates it — it does not. Anyone can mint a token from the public cart's `apiKey` without touching the domain, making `request.auth != null` equivalent to `if true` | 8.2 |
| D64 | ⚠️ This describes a rule intended for `firestore-rules-orders.md` (D69), which **does not exist as a file yet**, and a Firebase project (D73) that **does not exist yet either**. The residual-risk reasoning is sound and should carry over verbatim once both exist — right now there is nothing deployed for this risk to apply to. | 8.3 |
| D66 | ✅ **Two Firebase projects.** New project = `rounds` + `orders`, used by both new pages. Existing `wg-group-buy` = payment collections, config confined to `admin/dashboard.html`. **Reverses the PRD's one-project decision** | 8.1 |
| D67 | ✅ The admin panel does **not** initialize `wg-group-buy`. It needs only static files + the new project | 8.1 |
| D68 | ✅ **Standing rule: keep member addresses out of the new project.** Members self-identify by nickname; the cart never needs the directory. Adding it would reverse D66 | 8.1 |
| D69 | ❌ New project gets its own `firestore-rules-orders.md`. Do **not** append to `firestore-rules.md`, which documents the existing project | 8.3 |
| D70 | ✅ Firestore config in `firestoreStore` stays a **placeholder** until the human supplies the new project's values. Never substitute the `wg-group-buy` values, even temporarily — use `localStore` instead | 5.3 |
| D71 | ❌ **Hosting moves to Cloudflare Pages with a private repo.** Procedure is `CLOUDFLARE-CUTOVER.md`, independent of this build and runnable first | cutover |
| D72 | ✅ Member cart stays fully public — no WeChat authentication exists, members self-identify by typing a nickname | 3, 8.1 |
| D74 | ❌ **Admin Firebase Auth: email-link (passwordless), 3–4 UIDs allowlisted in the rules.** Not Google — WeChat's WebView blocks it. Only possible because the split (D66) keeps `dashboard.html` out of scope | 8.2 |
| D75 | ✅ Admin groups submissions by `memberKey` and takes the **latest** by `submittedAt`. **Never sum them.** Duplicates are shown, expandable and deletable | 6.1 |
| D76 | ✅ Cart warns `重新提交将覆盖你之前的订单，请填写完整订单内容`. This is what makes latest-wins correct rather than a silent trap | 6.2 |
| D77 | ⚠️ **App-level enforcement exists** — `index.html`'s `submitOrder()` checks `currentRound.status === "open"` before allowing a submission. The RULES-level enforcement this row actually describes (`roundIsOpen()` as a Firestore security rule) is not deployed anywhere, since D69's rules file was never created. Do not treat the app-level check as equivalent — it only stops a normal user of the page, not anyone calling Firestore directly. | 8.3 |
| D78 | ❌ Same status as D77 — this is a rules-file decision, and no rules file (D69) or Firebase project (D73) exists yet for it to apply to. `admin/index.html`'s `publishOrUpdateRound()` has no write restriction of its own; it relies entirely on the (not yet existing) rules. | 8.3 |

### Post-plan additions (D80–D88) — built after this document was originally written

These were never part of the original spec — they came from direct feedback
after the first build was already coded and tested. Recorded here so the
decision register stays the complete, authoritative list.

| ID | Decision | § / file |
|---|---|---|
| D80 | ✅ **Custom-quantity ordering.** The original cart only supported whole-number +/- stepping. Added an expandable "自定义数量" row per product: a number field + a unit dropdown, alongside the stepper (not replacing it). Unit list computed per-product from the same fields `dashboard.html` already uses for its own post-order correction editors — native unit always offered, `gramsPerUnit` → adds a 克(g) option, `piecesPerUnit` → adds a 颗 option. | `index.html`: `unitOptionsFor`, `computeCustomQty`, `applyCustomQty` |
| D81 | ✅ Weight-in-grams conversion (`gramsPerUnitFor`) and buyer-favor rounding (`roundGramsDown`, floors to nearest 10g) ported verbatim from `dashboard.html`'s `gramsPerUnit()`/`roundGramsDown()` — same 3-tier convention (explicit field → `unit==="kg"` → parsed off the label's `(Ng/unit)` parenthetical), same rounding rule, so the cart's behavior at order time matches the dashboard's behavior at correction time exactly. | `index.html` |
| D82 | ✅ `computeCustomQty(p, raw, unitChoice)` kept as a pure function separate from its DOM-reading caller — this is what determines what a member actually gets billed, same reasoning as keeping `buildExport`/`buildManifest` pure. Proportional (box-share) native entry capped at 1 (max one whole shared box per line); piece-count entry capped at `piecesPerUnit`. | `index.html` |
| D83 | ✅ **Generic linked-gift mechanism.** A catalog PARENT entry carries `linkedGift: {key, ratio}` (e.g. `mooncake_maoshanwang` → `gift_insulated_bag` @ ratio 1). Explicitly NOT hardcoded — Effendy stated the pairing "is not a given... won't be tied to another product from the same supplier" in future rounds, so retiring or reassigning it is purely a `product-catalog.json` edit, zero code changes. Cart auto-syncs the gift's cart quantity to the sum of every linked parent's quantity (two different parents linking to the same gift key sum, not overwrite), hides the gift from the normal browsable grid, shows an inline note on the parent's card. Admin mirrors the hide+badge behavior and auto-injects the gift's catalog entry into `round.products` at publish time whenever a linked parent is selected — priced from the catalog (usually $0), which deliberately bypasses D28's price validation since that only checks manually-selected keys. | `index.html` + `admin/index.html`: `computeLinkedGiftTotals`, `giftTargetKeys` |
| D84 | ✅ **Admin's 💬 button corrected.** First build mistakenly reimplemented `dashboard.html`'s `buildStockListOrderText()` (aggregated supplier order-quantity list) under the `💬` house-style prefix. Effendy clarified the actual ask: compile every current member's LATEST order into one long message, in the exact numbered format members already see on their own clipboard copy, for pasting back into the group chat as a verification recap. Rebuilt as `buildFullJielongRecap()` / `💬 复制完整接龙（核对用）`. Still uses `groupOrdersByMember()`'s latest-wins output (a resubmission must never appear/count twice either way) — that part of the reasoning carried over even though the feature itself changed. | `admin/index.html` |
| D85 | ✅ **BUG-1 fixed.** `selected`/`roundPrices` used to start blank on every admin page load regardless of an already-open round, so "adding a new product" and republishing silently REPLACED the whole round with just the newly-checked items — wiping every previously-published product, and blanking any member's order line for whatever disappeared (in the on-screen orders tab, the 💬 recap, AND the real `data-<date>.json` export — all three skip a line whose product no longer exists in `round.products`, rather than erroring). Fixed with `computeRehydrationFromRound()` (pure) + `rehydrateFromRound()` (DOM wrapper, restores date/label fields too, or "updating" would publish under today's date instead of the round's real date). Runs once per page load; `startNewRoundFlow()` explicitly overrides it since "start a new round" is a deliberate blank slate. Full writeup: `project-wggrpbuy-known-bugs.md` (Claude Code project memory). | `admin/index.html`: `computeRehydrationFromRound`, `rehydrateFromRound` |
| D86 | ✅ **BUG-1b fixed (same day, ~30min after D85).** D85's `rehydrateFromRound()` sets `labelManuallyEdited = true` whenever it restores a real round's label — correct in isolation, but `startNewRoundFlow()` never reset that flag, so once ANY round had been seen in the page session, the date field silently stopped driving the label for the rest of the session — reproducing the ORIGINAL date/label bug through a new path. `startNewRoundFlow()` now resets `labelManuallyEdited = false` and re-seeds date/label/itemsLabel to fresh defaults. No new tests (same DOM/event-wiring class the harness can't reach). Full writeup: `project-wggrpbuy-known-bugs.md`. | `admin/index.html`: `startNewRoundFlow` |
| D87 | ✅ **Remembered-cart mechanism.** Admin screenshots showed a real member submitting twice — once with 3 fruit items, once with 4 completely different items — and the SECOND submission silently replaced the first (correct per D46/D47's design), losing the fruit items because the cart had no memory of them. Effendy asked for a way to append rather than replace. Solution keeps D46/D47's server-side security model completely intact — **no server read added** — by reading back only what THIS BROWSER already wrote to its own `localStorage`, keyed by `wggb:memberCart:<roundDate>:<memberKey>`. On username blur, if a remembered cart exists for that name+round AND the current cart is still empty, it loads automatically with a visible banner ("已载入你上次提交的订单...") and the submit button relabels to `更新并复制接龙`. Confirmed with Effendy this correctly supports testing multiple pseudo-members from one device/browser, since the lookup is keyed by the typed name, not the device. | `index.html`: `loadRememberedCart`, `saveRememberedCart`, `onUsernameBlur`, `resetSubmitUiToDefault` |
| D88 | ✅ **`filterCartToRoundProducts(cartItems, products)`** — pure function factoring out a defensive guard that both `submitOrder()` and D87's cart-restore now share: a cart key with no matching entry in the round's current `products` (e.g. the admin removed that product, or a remembered cart survived past that point) is silently dropped rather than crashing on `.price` of `undefined`. Always re-derives `pricesAtOrder` from the LIVE round at call time, never from anything baked into the cart itself. | `index.html` |

**On D87 specifically — this does not reopen D46/D47.** No new server permission
was added; `orders` is still `create`-only with no read (§8.3). This mechanism
only ever reads a member's own browser's own prior write. Its one real
limitation: it does not follow a member across devices, browsers, or a cleared
cache — same category of limitation as everything else built on
`localStorage` here (D20/D21), and it goes away entirely once real accounts
or a different identity mechanism exist. Not treated as a blocker for this
build.

**Confirmed independently, same day (2026-09-15):** Firebase/Firestore would
NOT have prevented D85/BUG-1. The defect was entirely in what the admin's
client-side JS constructed before ever reaching storage —
`firestoreStore.publishRound()` uses a full `setDoc()` with no `merge: true`,
so it would have overwritten the round doc exactly the same way `localStorage`
did. Not a reason to deprioritize the localStorage-vs-Firestore migration,
just a note that it wouldn't have been a free fix for this specific bug.


### Open — not decided, needs the human

| ID | Question | Blocks |
|---|---|---|
| D57 | Where is the real repo checkout? | D54 |
| D58 | Is this folder's `dashboard.html` current with live? If stale, applying D50–D52 and deploying rolls the dashboard back. | D54 |
| D60 | Cutover sequencing — new root `index.html`, `admin/index.html` and `admin/dashboard.html` must land in one push. Procedure in `CLOUDFLARE-CUTOVER.md` Stage 2. | deploy |
| D73 | New Firebase project not yet created; its config values are needed before D70's placeholders can be filled. | D70, flag flip |
| D79 | Email-link sign-in not yet enabled, and the 3–4 admin UIDs do not exist until each admin signs in once. Rules cannot be published with real values until then. | D74, D78, flag flip |

### Resolved

| ID | Was | Resolution |
|---|---|---|
| D59 | How to secure Firestore | **Two-project split (D66).** No auth. Sensitive data stays in a project whose config never appears on a public page. |
| D65 | Has DNS been switched to "Proxied"? | Folded into `CLOUDFLARE-CUTOVER.md` Phase 2 — the domain move sets proxied records automatically. |



### Incident-driven — do not "simplify" these

**D9, D12, D17, D18, D28, D29, D32, D33, D40, D42, D43.**

Each exists because of a specific past failure recorded in
`wg-groupbuy-project-knowledge.md`'s version log or in the PRD. In isolation several
look like over-engineering. They are not. Before removing or relaxing any of them,
grep the version log for the relevant term and read why it is there — that log
records at least two cases of a later session "fixing" something that was a
deliberate decision, because the reasoning lived only in the doc.


