# Order Intake Form — Notes

Planned customer-facing order-intake H5 cart + admin control page for
WG团购群, feeding into (not replacing) the existing dashboard/data-<date>.json
process — scoped but not yet built.

Superseded note: the repo is now being restructured into routed paths rather
than three flat standalone files — see `overview.md`, "Planned repo
restructure," for the confirmed `index.html` / `/admin/index.html` /
`/admin/dashboard.html` layout (this moves/renames the existing dashboard
file itself, rather than leaving it untouched).

## Member-facing cart
- On submit, writes `{name, items, timestamp}` to a Firestore db AND
  generates 接龙-style text for the customer to copy/paste into WeChat, for
  group visibility/audit
- The current manual process for producing `data-<date>.json` from a 接龙
  thread stays as-is for now — this tool doesn't replace that step

## Admin control page requirements
- Prompts whether this is a new order (new round) or reviewing an existing
  order
- If new: prompts for the round's date, to set the group-buy tab label
- Lets the admin scroll a list or cycle categories to turn products on/off
  for this round's available catalog
- On a later visit, or when choosing to review an existing order, admin can
  close ordering, which generates the data/JSON file directly to hand off
  into the current manual group-buy-tab creation process
- Confirmed: when toggling a product on, its last-used price/unit carries
  over as a starting point, but every product's price must be individually
  editable regardless
- Explicitly asked to hold off on any coding for this until next week, after
  the weekly Pro usage limit resets — this planning session was
  scoping/logging only

## Access control plan (Cloudflare Access)
- Single Cloudflare Access self-hosted Application on domain `wggrpbuy.cc`
  with path `admin*`, protecting both `/admin/index.html` (admin control
  panel) and `/admin/dashboard.html` (payment dashboard) under one wildcard
  rule; policy is Allow/Include/Emails with authorized admin email
  address(es); root `index.html` (client ordering page) stays open for
  members
- Prerequisite: `wggrpbuy.cc`'s DNS records in Cloudflare must be switched
  from "DNS only" to "Proxied" (orange cloud) before Access policies can
  apply — currently all "DNS only"
- Domain nameservers are already on Cloudflare, so no registrar-side
  migration needed — only the proxy-status toggle and Access policy setup
  remain
