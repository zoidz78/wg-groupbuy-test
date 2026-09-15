# WG团购群 — Overview

Effendy manages a recurring community WeChat group-buy operation (WG团购群)
covering fresh produce, meats, frozen goods, dumplings, and specialty items.
The operation runs multiple rounds per week across member units organized by
address: 107, 109, 印度小店, 后门. Claude's role: parse raw 接龙 order
threads, build structured data files, and maintain a web dashboard for
tracking orders, payments, packing, and delivery-day adjustments. All UI
text is in Mandarin.

## Architecture
- Frontend: vanilla JS, single-page app in `index.html`, hosted on GitHub
  Pages (repo `zoidz78/wg-groupbuy`)
- Custom domain `wggrpbuy.cc` registered and live, pointing to the GitHub
  Pages site; DNS is hosted on Cloudflare (nameservers already migrated
  there) — 4 A records to GitHub Pages IPs (185.199.108–111.153) plus a
  `www` CNAME to `zoidz78.github.io`, all currently set to "DNS only" (not
  proxied)
- Backend: Firebase/Firestore for real-time payment sync (project
  `wg-group-buy`), ES module SDK via CDN
- Round data lives in dated JSON files (`data-<date>.json`) plus
  `manifest.json`
- `manifest.json` entry format: `{date, label, file}`, newest first
- Firestore collections in use: `paidStatus`, `adjustments`, `memberInfo`,
  `packedStatus`, `sortedItems`
- Firestore rules are documented in `firestore-rules.md`
- `product-catalog.json` is Claude-side reference only — never deployed,
  never fetched by `index.html`
- `wg-groupbuy-project-knowledge.md` tracks architecture and a version log
  (version log lives in section A9)
- All `fetch()` calls use `{ cache: "no-store" }` to prevent stale data on
  GitHub Pages

## Planned repo restructure (not yet built)
Repo will be reorganized into three routed HTML files instead of one root
`index.html`:
- root `index.html` → becomes the client-facing H5 ordering page (currently
  referred to as order-form.html), serving at `wggrpbuy.cc/`
- `/admin/index.html` → the admin control panel (currently referred to as
  order-admin.html), serving at `wggrpbuy.cc/admin`
- `/admin/dashboard.html` → the existing payment dashboard, moved from root,
  serving at `wggrpbuy.cc/admin/dashboard.html`

This supersedes the earlier plan to leave the existing dashboard's
`index.html` completely untouched — the dashboard file itself will be
relocated/renamed to `/admin/dashboard.html` as part of this restructure.
`/admin/index.html` will link directly to `/admin/dashboard.html` via a
plain `<a href="/admin/dashboard.html">` nav link.

Cloudflare Access will be configured as a single self-hosted Application
(name "Group Buy Admin Suite", domain `wggrpbuy.cc`, path `admin*` wildcard)
so one Access policy (Allow/Include/Emails, authorized admin emails)
protects both `/admin/index.html` and `/admin/dashboard.html` at once.

Firestore rules should enforce `request.auth != null` for write access on
product data and for read/write on payment-tracking collections, so data
stays protected even if client-side code is inspected.

## Key project files
- `index.html`, `manifest.json`, `data-<date>.json`, `product-catalog.json`,
  `product-emoji-map.json`, `message-template.json`, `firestore-rules.md`,
  `README.md`, `wg-groupbuy-project-knowledge.md`
- `wg-groupbuy-order-instructions.md` — Chinese-language prompt for a
  helper's Claude instance to generate per-round JSON files, shared via an
  iCloud folder
- `stepper-mockup.html` — standalone test page for complex UI changes
- `product-catalog-proposed.json` — staging file for product classification
  work

## Current state
- Recent development spans v1.0.0 through v1.4.2
- Shipped: inline per-item editors (plain +/−, grams/weight, piece-count,
  and proportional bunch÷total for grape varieties)
- Shipped: member-name search with an IME composition fix
- Shipped: address filter dropdown (107 / 109 / 印度小店 / 后门)
- Shipped: per-item sorting checkboxes backed by the `sortedItems/{date}`
  Firestore collection
- Shipped: 打包 (packed) toggle per member row, backed by the
  `packedStatus` Firestore collection
- Shipped: round-tab coloring — future = default, past with unpaid = red,
  past all-paid = green
- Shipped: type-to-search on the 商品查询 product dropdown
- A test round (`data-2026-09-10-v2.json`) exists for safe live testing
  without touching real payment records
- The old `+ 调整` adjustment form remains intact alongside all new inline
  editors as a fallback, pending full live testing confirmation

## On the horizon
- Unresolved: missing `$` signs in copied payment message text — flagged
  but not yet investigated
- Ongoing: classification of all ~153 products in
  `product-catalog-proposed.json`
- Ongoing: continued live testing of inline editors before retiring the
  fallback adjustment form
