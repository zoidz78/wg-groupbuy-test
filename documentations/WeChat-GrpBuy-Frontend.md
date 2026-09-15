# PRD: WeChat Group Buy H5 Ordering App — Order Intake + Admin Control

## Status
Scoped and confirmed 2026-09-13. Repo structure and access-control approach
confirmed 2026-09-13 (this revision). **Build scheduled for next week**, after
the weekly Pro usage limit resets — nothing in this document has been coded
yet.

Three HTML files, routed by path on the same repo/site, replacing the earlier
"two new standalone files, dashboard untouched" plan:

- `index.html` (root) — customer-facing cart (member workflow) → serves at
  `wggrpbuy.cc/`
- `/admin/index.html` — organizer-facing round control (admin workflow) →
  serves at `wggrpbuy.cc/admin`
- `/admin/dashboard.html` — the existing payment dashboard, **relocated** from
  root → serves at `wggrpbuy.cc/admin/dashboard.html`

**Correction from the previous revision of this PRD:** that version stated
the dashboard's `index.html` would be left completely untouched. That is no
longer the plan — the dashboard file itself is being **moved and renamed** to
`/admin/dashboard.html` so that the root `index.html` slot can serve the
client ordering page instead. The dashboard's own code and behavior are not
being rewritten as part of this move — only its location and filename change.
Anywhere else in this document or in project memory that still says "the
dashboard's `index.html`," read that as `/admin/dashboard.html` going forward.

---

## Hosting and domain
- **Repo/host:** same GitHub Pages repo as today (`zoidz78/wg-groupbuy`) — no
  separate repo, no separate branches. Routing between the three files is by
  file path, not branch.
- **Custom domain:** `wggrpbuy.cc`, already live and pointed at this GitHub
  Pages site.
- **DNS:** hosted on Cloudflare — nameservers already migrated there. Current
  records: 4 A records to GitHub Pages' IPs (185.199.108–111.153) plus a
  `www` CNAME to `zoidz78.github.io`. All currently set to **"DNS only"**
  (grey cloud) — these must be switched to **"Proxied"** (orange cloud)
  before Cloudflare Access can enforce anything on them. This toggle is the
  first concrete step next week, before wiring up Access.

---

## Relationship to the existing dashboard
An earlier version of this PRD assumed the dashboard would read live orders
directly from Firestore ("zero parsing overhead"). **That is not the current
plan.** The dashboard keeps working exactly as it does today, reading
`data-<date>.json` + `manifest.json`, hand-authored the same way as now
(including, when needed, a separate helper Claude conversation using
`wg-groupbuy-order-instructions.md`) — only its file location changes, from
root `index.html` to `/admin/dashboard.html`.

What this build actually replaces is the *free-text-typing* step: instead of
members hand-typing a 接龙 message and someone parsing raw chat text
afterward, members fill out a structured cart. `/admin/index.html`'s export
produces a `products` / `orders` block in the **same shape**
`data-<date>.json` already uses, for the organizer to hand into the existing
manual round-creation process — a drop-in replacement for the
typing/parsing step, not a new data pipeline for the dashboard itself.

---

## Target tech stack
* **Frontend:** HTML5 + Tailwind CSS (CDN) + vanilla JS — same stack as the
  `Order-intake_html.txt` sample this is based on.
* **Database:** Firebase Firestore — new collection(s) inside the **existing**
  `wg-group-buy` project (confirmed — not a separate Firebase project).
* **Hosting:** Same repo, three routed files, on the existing GitHub Pages
  site behind the custom domain `wggrpbuy.cc`.
* **Target environment:** Mobile WebView inside WeChat iOS/Android.

---

## Member workflow — `index.html` (root)
1. **Access:** member taps a link/QR code shared in the WeChat group, going
   to `wggrpbuy.cc/`.
2. **Identification:** member enters their 微信昵称 (WeChat display name).
3. **Product selection:** category tabs + cart UI (per the uploaded sample),
   showing only the products the organizer has toggled **on** for the
   currently-open round.
4. **Submit:** on tap,
   - writes `{ name, items: {key: qty}, pricesAtOrder: {key: price}, timestamp }`
     to Firestore for this round. **Resubmitting under the same name merges
     into their existing order for that round**, per item key: a new item
     gets added in; resubmitting the same item updates its quantity in place
     rather than creating a duplicate line. This is a running/cumulative cart
     across multiple submits within the round, not a full overwrite and not
     append-as-duplicate,
   - generates the 接龙-style text for the round (same pattern as the sample:
     `{index}. {name}` then one line per item: `{emoji}{label} ${price}/{unit}`
     with 称重/quantity suffixes as needed) and copies it to the clipboard.
5. **Optional:** member pastes the text back into the WeChat group for social
   visibility — this is an audit trail, not the system of record; the Firestore
   write is.
6. Submission is disabled once the organizer closes the round.

**Price is frozen at order time** (`pricesAtOrder`), not looked up live at
close — if the organizer edits a price after some people have already
ordered, already-submitted totals must not silently change. This is the same
category of bug as the dashboard's "$" sign and actual-weight regressions
already logged in `wg-groupbuy-project-knowledge.md` — a value's true source
quietly moving and nothing catching it.

---

## Admin workflow — `/admin/index.html`
Sits behind Cloudflare Access (see below) rather than the dashboard's old
client-side PIN pattern.

1. **On open, prompt:** *New order* (start a new round) or *Review existing
   order* (manage a round already open).

2. **New order:**
   - Prompt for the round's date → sets the group-buy label the same way
     `manifest.json` already does (e.g. `"9/13"`).
   - Optional one-line `itemsLabel` prompt (matches the field the manual
     process already asks for, used for the 到货通知 message).
   - **Catalog toggle screen:** scroll a list, or cycle categories, to turn
     products on/off for this round.
     - Toggling a product **on** carries over its last-used price/unit as a
       starting default — **but every product's price is individually
       editable, always**, regardless of the carried-over default (explicitly
       confirmed — no bulk/locked pricing).
     - A genuinely new product gets an auto-suggested snake_case key (editable)
       derived from its label, with a warning if that key already exists under
       a different label/price — guards the same cross-round key-reuse trap
       `domain-rules.md` already flags (the `mango_pzh` case).
   - Publishing the round flips it to "open" in Firestore; `index.html`
     starts accepting submissions for it.

3. **Review existing order** (a round already open or just closed):
   - View live submissions as they arrive (name, items, running count) for a
     quick sanity check before closing.
   - **Close ordering** — locks out further submissions.
   - **Export** — generates the `products` / `orders` JSON block, in the same
     shape `data-<date>.json` already uses, sorted by submission timestamp (so
     the order matches the sequence people actually submitted in, for the
     audit trail). Handed to the existing manual process for creating the
     round's `data-<date>.json` + `manifest.json` entry — same as today, just
     starting from structured data instead of a raw chat thread.

4. **Navigation:** includes a plain link to the dashboard —
   `<a href="/admin/dashboard.html">Go to Payment Dashboard</a>` — so both
   admin tools are reachable from one place once authenticated.

---

## Access control — Cloudflare Access
Replaces relying on the dashboard's client-side PIN alone (GitHub Pages has
no built-in access control — every file is publicly reachable at its own URL
regardless of what links to it or what a PIN gate checks after the page has
already loaded).

- **One Cloudflare Access Application** covers both admin files at once,
  since they share a path prefix:
  - Application name: `Group Buy Admin Suite`
  - Application domain: `wggrpbuy.cc`
  - Path: `admin*` (wildcard — matches both `/admin/index.html` and
    `/admin/dashboard.html`)
  - Policy: Action = Allow, Rule type = Include, Selector = Emails, Value =
    authorized admin email address(es)
- **Effect:** an unauthenticated visit to `wggrpbuy.cc/admin` or
  `wggrpbuy.cc/admin/dashboard.html` is intercepted by Cloudflare before
  either file is served, and requires an email one-time-passcode. Root
  `index.html` (the client ordering page) is not covered by this rule and
  stays open to anyone with the link.
- **Prerequisite:** the domain's DNS records must be "Proxied" (not "DNS
  only") in Cloudflare for Access to apply at all — see Hosting and domain,
  above.
- **Firestore-level backstop:** even with Access in front of the pages,
  Firestore rules should enforce `request.auth != null` for write access on
  product data, and for read/write access on payment-tracking collections —
  so the data itself stays protected even if someone inspects client-side
  code or the network tab.

---

## Confirmed decisions (this conversation)
- Three routed files on one site: root `index.html` (client), `/admin/index.html`
  (admin control), `/admin/dashboard.html` (payment dashboard, relocated from
  root) — supersedes the earlier "two new files, dashboard fully untouched"
  plan.
- Dual capture on submit: Firestore write (system of record) + 接龙 text to
  clipboard (social visibility/audit) — not one or the other.
- The manual `data-<date>.json` creation process stays as-is; this build feeds
  into it, doesn't replace it.
- Admin control page's 4-step flow (new-vs-review prompt → date/label →
  catalog toggle → close-and-export) as specified above.
- Price is always individually editable per product, even when a last-used
  value is carried over as a starting default.
- Same repo as the dashboard, routed by path — no separate GitHub repo, no
  separate branches.
- New Firestore collections live inside the existing `wg-group-buy` project —
  not a separate Firebase project.
- Resubmission merges into the member's existing order for the round, per
  item key (new items added in, repeated items update qty in place, no
  duplicate lines) — not a full overwrite.
- Custom domain `wggrpbuy.cc` is live, DNS-hosted on Cloudflare (nameservers
  already migrated).
- Cloudflare Access (single wildcard rule on `admin*`) replaces the old
  client-side PIN pattern for both admin files; root client page stays open.

## Open questions before starting next week
- **Per-product order caps:** default proposed is "none for v1" — not yet
  explicitly confirmed.
- **Cloudflare Access setup order:** DNS records need to be switched from
  "DNS only" to "Proxied" before the Access Application/policy is created —
  first concrete step next week.

## Out of scope for this build
- Rewriting the dashboard's own logic or UI — this build relocates it to
  `/admin/dashboard.html`, it does not modify its behavior.
- No live Firestore read by the dashboard — `data-<date>.json` stays
  hand-authored.
- No WeChat Pay integration, no native Mini Program.
- Edge cases the manual process already handles specially (拼单 combined
  orders, proportional box-splitting, "称重当天才知道" estimate-then-adjust
  items) are **not** solved by this build — those still get handled the way
  they are today, on top of whatever the export produces.
