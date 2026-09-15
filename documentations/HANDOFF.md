# WG团购 — Group Buy Platform

Planning and specification repo for the WG团购群 WeChat group-buy system.

> **UPDATE 2026-09-15: the code now exists.** This file originally described
> a not-yet-started build ("no application code lives here yet"). That is no
> longer true — both new pages are built, tested, and living in `wggrpbuy/`.
> This doc has been rewritten for a DIFFERENT handoff purpose now: picking up
> an in-progress project, not commissioning a build from scratch. See §2
> immediately below.

**Last updated:** 2026-09-15

---

## 1. What this is, in five lines

User runs a recurring community group-buy in a WeChat group. Today members type
freeform 接龙 (chain-reply) messages into the chat, and someone hand-parses that
thread into a JSON file that a payment dashboard reads.

**This project replaces the typing-and-parsing step** with a proper ordering page
for members and a control panel for organizers. The payment dashboard keeps working
exactly as it does now.

---

## 2. Where things stand — READ THIS FIRST

**If you're a fresh Claude session (web, chat, or terminal) with no memory of
prior work here, this section — plus `BUILD-PLAN-admin-v2.md`'s "STATUS AS OF"
banner at the very top of that file — is everything you need before doing
anything else.**

| | Status |
|---|---|
| Architecture | ✅ Decided |
| Specification | ✅ Written and kept current (`BUILD-PLAN-admin-v2.md`, 88 numbered decisions) |
| Member cart (`index.html`) | ✅ Built, including custom-quantity ordering and the linked-gift mechanism (D80–D83) |
| Admin panel (`admin/index.html`) | ✅ Built, including the 💬 verification-recap button (D84) |
| Automated tests | ✅ 58/58 passing (`test/run-tests.js`, self-updating) |
| **Real browser verification** | ❌ **Never done, by any session.** The environment these were built in cannot bind a local server. This is the single most important gap — see §7. |
| A serious data-loss-adjacent bug (BUG-1 + BUG-1b) | ✅ Found and fixed same day (2026-09-15) | 
| Dashboard relocation | ❌ Not done — see the open items below |
| Two-Firebase-project security design | ❌ Not deployed — `USE_FIRESTORE = false`, running on `localStorage` only |
| Hosting migration | 📋 Runbook ready (`CLOUDFLARE-CUTOVER.md`), not started |

**Six things are waiting on a human** — none of them block further coding, but
several block actually going live:

| | What's needed | Blocks |
|---|---|---|
| D57 | Where is the local checkout of the deployment repo? | Moving the dashboard |
| D58 | Is the local `dashboard.html` copy current with what's live? | Moving the dashboard |
| D60 | Cutover must land as one push (procedure written) | Deploying |
| D69 | `firestore-rules-orders.md` was never created | Real Firestore rules |
| D73 | Create the second Firebase project, get its config | Going live |
| D79 | Enable email-link sign-in, collect 3 admin UIDs | Going live |

**One thing worth knowing about `wggrpbuy/admin/dashboard.html`:** it isn't
there. Effendy deliberately moved it back out to the parent folder — confirmed
intentional, not something to "fix" by moving it back.

---

## 3. Architecture

### The three pages

| URL | File | Who uses it | Protected by |
|---|---|---|---|
| `wggrpbuy.cc/` | `index.html` | Group members | nothing — public by design |
| `wggrpbuy.cc/admin` | `admin/index.html` | 3–4 organizers | Cloudflare Access |
| `wggrpbuy.cc/admin/dashboard.html` | `admin/dashboard.html` | 3–4 organizers | Cloudflare Access |

The first two are new. The third already exists and is **live right now at the
site root** — moving it is part of this project.

### How data flows

```
   MEMBER                      ORGANIZER                    ORGANIZER
   (public)                    (behind Access)              (behind Access)
   ─────────                   ───────────────              ───────────────
   index.html                  admin/index.html             admin/dashboard.html
   pick items,                 pick what's on sale,         who paid, who's packed,
   type nickname,              set prices, watch            adjustments
   submit                      orders arrive, close
        │                            │                            │
        │      ┌─────────────────────┘                            │
        │      │                                                  │
        ▼      ▼                                                  │
   ╔═══════════════════════╗                                      │
   ║  NEW Firebase project ║                                       │
   ║  rounds + orders      ║                                       │
   ╚═══════════════════════╝                                       │
                │                                                  │
                │  ⬇ organizer downloads 2 files                   │
                │  ✋ organizer commits them to the repo            │
                ▼                                                  │
        data-<date>.json  ──────────────────────────────────►      │
        manifest.json                                              │
                                                                   ▼
                                              ╔═══════════════════════════════╗
                                              ║  EXISTING Firebase project    ║
                                              ║  wg-group-buy                 ║
                                              ║  payments, packing, members   ║
                                              ╚═══════════════════════════════╝
```

**Two databases, deliberately.** They never talk to each other. The only thing
crossing the gap is two JSON files, moved by hand through git — the same manual step
that happens today.

### Hosting

| | Now | After migration |
|---|---|---|
| Code | GitHub, **public** | GitHub, **private** |
| Served by | GitHub Pages | Cloudflare Pages |
| DNS | Cloudflare, unproxied | Cloudflare, proxied |
| Admin protection | a 4-digit PIN in the page | Cloudflare Access, email allowlist |

---

## 4. Three decisions that look strange without the reasoning

### Why two Firebase projects instead of one

Any web page that talks to Firebase has to include the database address in its
source code. That's normal — protection is supposed to come from the database's
security rules.

The problem: the member cart is **public**. Its link goes into the WeChat group. So
whatever database it connects to, every member gets the address for — permanently,
including after they leave the group.

The existing database holds payment history and the member directory with home
addresses. So it gets its own project, whose address only ever appears in the
dashboard — a page 3 people can open. The new project holds only "what's on sale"
and "who ordered what," which is already public in the group chat anyway.

### Why Cloudflare Access isn't enough on its own

Access stops people **opening the admin pages**. It does nothing about the
**database**, which lives on Google's servers and is reached directly by the
browser. Someone can ignore your site entirely and query the database. Two separate
problems needing two separate solutions.

### Why members can't edit their own orders

Members can submit, and that's all — they can't read or change anything, including
their own order. That's what stops one member reading or overwriting another's.

The cost: correcting an order means resubmitting, which creates a second entry. The
control panel groups them by name, shows the newest, and lets the organizer delete
the stale one. The cart warns members that resubmitting **replaces** their previous
order, so they know to re-enter everything.

**Update 2026-09-15 (D87):** the "resubmitting replaces everything" cost above
turned out to cause real data loss in practice — a member's second submission
silently dropped their first order's items because the cart never showed them
what they'd already ordered. Fixed WITHOUT touching this security model: the
cart now remembers a member's last submission in that browser's own
`localStorage` (keyed by round + name) and pre-fills on their next visit. No
server read was added — it only ever reads back what that same browser
already wrote.

---

## 5. Things that confuse everyone (including me, repeatedly)

**`index.html` means two different things.** The file live at `wggrpbuy.cc/` today
is the *payment dashboard*. After this project, `index.html` will be the *member
cart* and the dashboard moves to `/admin/dashboard.html`. When reading old notes,
check which one is meant.

**The working folder is not the repo.** Planning happens in a local folder that
holds *copies* of some deployed files. The real repo is `zoidz78/wg-groupbuy`.
Copies drift — verify before deploying anything from there.

**`manifest.json` is cumulative.** It lists every round ever, and the dashboard uses
all of it to compute member payment totals. Generating a fresh one wipes the entire
history. It must always be fetched, added to, and re-emitted whole.

**Moving the dashboard is not a pure file move.** It reads four things by relative
path. Dropped into `/admin/` unchanged, they all 404 and it boots to an empty page.

---

## 6. The documents

All of these now live in `wggrpbuy/documentations/` (moved here 2026-09-15
from a separate parent planning folder). Read in this order.

| File | What it is | Length |
|---|---|---|
| `HANDOFF.md` | This file — orientation, now for CONTINUING work, not commissioning it | short |
| `overview.md` | Architecture summary. **Stale** — still says `product-catalog.json` is "never deployed" (D56, never applied) | short |
| `WeChat-GrpBuy-Frontend.md` | Original product requirements | medium |
| **`BUILD-PLAN-admin-v2.md`** | **The spec, and the primary source of truth for status.** Has a "STATUS AS OF 2026-09-15" banner right at the top — read that before the rest. 88 numbered decisions (Appendix A), all marked ✅/⚠️/❌/🔲 for implementation status | long |
| `CLOUDFLARE-CUTOVER.md` | Hosting migration runbook, step by step. Not started | medium |
| `wg-groupbuy-project-knowledge.md` | Dashboard's authoritative history and schema. **Wins over everything else when they disagree** | very long |
| `secure.md` | A security proposal — partly adopted (create-only rules pattern), partly rejected (anonymous auth, D63) | short |
| `firestore-rules.md` | Rules for the EXISTING `wg-group-buy` project only. The NEW project's rules (D55/D69) were never written into a file — still owed | short |
| `order-intake-form.md` | Early scoping notes, fully superseded by the build plan | short |

**Decisions are numbered D1–D86** in `BUILD-PLAN-admin-v2.md` Appendix A —
D80 onward were added AFTER the original build, from direct feedback. Refer
to them by number — "change D75" is unambiguous, "change the dedup logic" is
not.

The actual code — `index.html`, `admin/index.html`, `product-catalog.json`,
`product-emoji-map.json`, `manifest.json`, `test/run-tests.js` — lives one
level UP from this folder, at `wggrpbuy/` itself.

---

## 7. Handing off to continue the work

**This section originally described how to commission a build from scratch.
That build is done (2026-09-15).** Rewritten below for the actual current
need: picking up in-progress work. If you're picking this up now, here is
what actually needs doing, roughly in priority order:

1. **Real browser verification.** Nobody has ever loaded either page in an
   actual browser. Every "done" claim in this project rests on `node --check`
   syntax validation, a static wiring check, and a Node-based test suite that
   extracts and tests pure functions — none of that catches a DOM/event bug.
   Two have already slipped through this way (BUG-1b, a stuck flag never
   reset on a "start fresh" path — see D86). Serve `wggrpbuy/` over
   `python3 -m http.server` and click through both pages: publish a round,
   order from the cart with each of the three custom-quantity paths (half
   unit, grams, bunch fraction), close and export, verify the manifest.
2. **Resolve D57/D58** (where's the real repo, is the local `dashboard.html`
   current) before touching the dashboard relocation at all.
3. **`firestore-rules-orders.md`** (D55/D69) — write the new project's rules
   into an actual file. The rules TEXT already exists in §8.3 of the build
   plan; it just needs to become its own file, the way `firestore-rules.md`
   already exists for the old project.
4. **Create the second Firebase project** (D73) and enable email-link
   sign-in (D74/D79) — this is what actually turns on `USE_FIRESTORE`.
5. **`CLOUDFLARE-CUTOVER.md`** — entirely separate, entirely console work,
   can happen any time independent of the above.

If you're a fresh coding session being asked to "keep building" without more
specific direction, (1) is the correct next step — not more features.

### If you DO need to hand this to a fresh implementing session

Same file list as before still applies for context, updated for current
paths:

**Required:**

| File | Why |
|---|---|
| `BUILD-PLAN-admin-v2.md` | The specification AND the current-status source of truth |
| `../product-catalog.json` | The 173 real products (grew from 171 — see catalog reconciliation notes in `project-wg-groupbuy-h5.md`) |
| `../product-emoji-map.json` | Emoji lookup |
| `../manifest.json` | Real data for the manifest-merge tests |
| `../index.html`, `../admin/index.html` | **The actual current code** — read these before assuming anything needs building from scratch |
| `../test/run-tests.js` | Run it. 58/58 should pass before any new change, and after |

**Do not give it:** `CLOUDFLARE-CUTOVER.md` (console work, an agent may try
to implement it), `Product_Catalog_Updated.xlsx`, or any `.txt` duplicates.

### What a coding session can and can't verify

It can serve the pages locally (if its sandbox permits binding a port — this
project's sessions so far could not) and unit-test pure logic against real
data. It cannot render pages, click anything, or test the WeChat WebView
without that server access. It cannot test Firebase either — `USE_FIRESTORE`
stays `false` until the new project exists.

---

## 8. Suggested order of work (updated 2026-09-15 — see §7 for the current version)

This numbered list is the ORIGINAL pre-build plan, kept for history. Step 2
("Build the two pages") is done. The current priority order is §7 above —
follow that, not this.

1. **Hosting migration** — `CLOUDFLARE-CUTOVER.md` Stage 1. Still not started.
   Still closes a real, present-day exposure: the public repo contains the
   database address for payment and member data.
2. ~~Build the two pages~~ — ✅ done, 2026-09-15.
3. **Create the second Firebase project** (D73) and enable email-link sign-in
   (D74/D79). Still not done.
4. **Deploy** — `CLOUDFLARE-CUTOVER.md` Stage 2. Still not started. Also
   still needs D57/D58 resolved first (repo location, dashboard staleness).

Steps 1 and 3 remain independent of each other and can happen in either order.
