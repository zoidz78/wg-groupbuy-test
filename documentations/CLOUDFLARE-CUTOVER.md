# CLOUDFLARE CUTOVER — Runbook

**Purpose:** move `wggrpbuy.cc` off GitHub Pages onto Cloudflare Pages, make the
repo private, and put Cloudflare Access in front of the admin tooling.

**Status:** not started. Written 2026-09-14.

**Companion document:** `BUILD-PLAN-admin-v2.md` (the member cart + admin panel
build). **These two are independent.** This runbook can be executed today against
the site as it exists now, with the new pages not yet written. Doing it first is
recommended — see "Why now" below.

---

## Two stages

This is deliberately split so you are never migrating hosting and shipping new
pages at the same time.

| | When | What |
|---|---|---|
| **Stage 1** | Now, standalone | Move hosting, privatise the repo, protect the whole domain with Access. One file involved. |
| **Stage 2** | When the new pages ship | Narrow Access from the whole domain to `admin*`, so the member cart can be public. |

If anything goes wrong in Stage 1, the only thing affected is a dashboard used by
three people, and rollback is minutes (see "Rollback").

---

## Current state

- **Repo:** `zoidz78/wg-groupbuy`, **public**
- **Host:** GitHub Pages
- **Live site:** `wggrpbuy.cc/` serves `index.html`, which **is the payment
  dashboard** (not a public landing page — the only thing on the site today)
- **Protection:** client-side `EDIT_PIN` only
- **DNS:** Cloudflare-managed; 4 A records → `185.199.108–111.153`, plus a `www`
  CNAME → `zoidz78.github.io`. All **"DNS only"** (grey cloud).
- **Users:** 3 admins

## Target state after Stage 1

- **Repo:** same repo, **private**
- **Host:** Cloudflare Pages, deploying on push to `main`
- **DNS:** Cloudflare, **proxied** (orange cloud)
- **Protection:** Cloudflare Access — email allowlist, 3–4 addresses, whole domain
- **Live site:** unchanged from a user's point of view, except an email code on
  first visit

---

## Why now, before the build

**Your Firebase connection details are currently public.** `index.html` (the
dashboard) contains the `wg-group-buy` project config, and the repo is public — so
anyone who finds `github.com/zoidz78/wg-groupbuy` can read it. Combined with your
Firestore rules (`allow read, write: if true` on all five collections), that means
payment status, adjustments, packing state and the member directory — names and
addresses — are readable and writable by anyone who looks.

This is true today. It is not a new risk introduced by the upcoming build; the build
would widen it, but it already exists. Making the repo private closes it.

**Two other things it buys you:**

- Proxied DNS is a prerequisite for Access, and it happens automatically as part of
  the domain move here rather than as a separate step later.
- The dashboard stops relying on a client-side PIN — which never protected the file
  itself, only what the page did after it had already loaded and handed over the
  source.

---

## Before you start

Record these so rollback is mechanical rather than reconstructive.

- [ ] Screenshot the current DNS records (Cloudflare → DNS → Records) — all four A
      records and the `www` CNAME, with their proxy status
- [ ] Screenshot GitHub → Settings → Pages (source branch, folder, custom domain)
- [ ] Confirm a `CNAME` file exists in the repo root containing `wggrpbuy.cc`
- [ ] Confirm which GitHub account owns the repo and that you can change its
      visibility
- [ ] Have the 3–4 admin email addresses to hand

**Do not make the repo private yet.** On a free plan that stops GitHub Pages
immediately, and until Cloudflare is serving, the site is down. Visibility changes
in Phase 3, not before.

---

## Stage 1

### Phase 1 — Stand up Cloudflare Pages

No impact on the live site. Both hosts will serve the same content in parallel.

- [ ] Cloudflare Dashboard → **Workers & Pages** → Create → **Pages** →
      **Connect to Git**
- [ ] Authorize the Cloudflare GitHub App; select `zoidz78/wg-groupbuy`
- [ ] Production branch: `main`
- [ ] Build settings — **this is where static sites go wrong:**
  - Framework preset: **None**
  - Build command: **empty**
  - Build output directory: **`/`**

  If Cloudflare autodetects a framework, override it. There is nothing to build;
  it is copying files.
- [ ] Deploy. Note the assigned URL, e.g. `wg-groupbuy.pages.dev`
- [ ] Open that URL. The dashboard should load and behave normally — rounds list,
      Firestore sync, the lot.

**If the page loads but is empty or 404s on data:** check the build output
directory. `/` is correct for this repo, since `index.html`, `manifest.json` and
the `data-*.json` files all sit at root.

### Phase 2 — Move the domain

- [ ] Pages project → **Custom domains** → **Set up a custom domain** →
      `wggrpbuy.cc`
- [ ] Cloudflare will refuse while the GitHub A records exist. **Delete all four A
      records** (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`)
- [ ] Let Cloudflare create the apex record pointing at the Pages project (a CNAME
      at the apex — this works because Cloudflare flattens it)
- [ ] Repoint the `www` CNAME (currently `zoidz78.github.io`) at the Pages project,
      or set up a redirect to the apex
- [ ] Confirm the new records show as **Proxied** (orange cloud). They should by
      default. This also satisfies the Access prerequisite.
- [ ] Wait, then load `wggrpbuy.cc` in a **private window**

Propagation is usually minutes since DNS is already Cloudflare-managed. Allow up to
an hour before concluding something is wrong.

**How to tell which host answered:** check response headers. Cloudflare Pages sends
`server: cloudflare`; GitHub Pages sends `server: GitHub.com`.

### Phase 3 — Make the repo private

- [ ] GitHub → Settings → General → Danger Zone → **Change repository visibility**
      → Private
- [ ] Confirm Cloudflare Pages still deploys: push a trivial commit and watch the
      Pages build run

The Cloudflare GitHub App keeps its access. GitHub Pages will stop serving — that is
expected and no longer matters.

### Phase 4 — Clean up GitHub Pages

- [ ] GitHub → Settings → Pages → Source: **None**
- [ ] Delete the `CNAME` file from the repo root

`CNAME` is a GitHub Pages artifact. Cloudflare ignores it. Leaving it causes no harm
but will confuse whoever reads the repo next. If you ever roll back, re-add it.

### Phase 5 — Cloudflare Access

**Scope it to the whole domain for now.** There is no public page on this site yet —
everything on it is the dashboard, for three people. Narrowing to `admin*` happens
in Stage 2, when the member cart arrives.

- [ ] Cloudflare Dashboard → **Zero Trust** → Access → Applications → **Add an
      Application** → **Self-hosted**
- [ ] Application name: `Group Buy Admin Suite`
- [ ] Application domain: `wggrpbuy.cc` — **leave the path empty** (whole domain)
- [ ] Policy: Action **Allow**, Rule type **Include**, Selector **Emails**, Value =
      the 3–4 admin addresses
- [ ] Save
- [ ] Private window → `wggrpbuy.cc` → you should get Cloudflare's email
      one-time-passcode screen
- [ ] Complete the OTP and confirm the dashboard loads normally afterwards

**Email OTP works inside WeChat's WebView** — it is a plain form plus a code, with no
OAuth popup. If you open the dashboard from a WeChat message, this will not break.

### Phase 6 — Close the `.pages.dev` hole

**Do not skip this.** Cloudflare Pages assigns a public `.pages.dev` URL to every
deployment, and an Access application scoped to `wggrpbuy.cc` **does not cover
them.** Left alone, `wg-groupbuy.pages.dev` serves your dashboard to anyone, with no
email check — and every branch or PR gets its own equally open preview URL.

Same class of bypass as the GitHub Pages origin-IP problem, different door.

- [ ] Either add `*.pages.dev` for this project as an additional domain on the same
      Access application, **or** disable preview deployments and cover the
      production `.pages.dev` hostname
- [ ] Private window → paste the `.pages.dev` URL → **confirm you are stopped**

Verify it directly. Do not assume it inherited the rule from the custom domain.

---

## Stage 1 verification

Run all of these in a **private window**, signed out.

- [ ] `wggrpbuy.cc` → Access OTP screen, not the dashboard
- [ ] After OTP with an allowed email → dashboard loads, rounds render, Firestore
      live sync works (toggle something and watch it persist)
- [ ] After OTP with a **non**-allowed email → denied
- [ ] `wg-groupbuy.pages.dev` → stopped, not served
- [ ] A preview/branch URL → stopped, not served
- [ ] `github.com/zoidz78/wg-groupbuy` signed out → 404
- [ ] `zoidz78.github.io/wg-groupbuy` → no longer serves the site
- [ ] Push a commit → Cloudflare Pages builds and the change appears live
- [ ] Response header shows `server: cloudflare`

---

## Rollback

Nothing here is one-way. Worth reading before you start, so you are not improvising.

1. GitHub → Settings → General → visibility → **Public**
2. Restore the `CNAME` file containing `wggrpbuy.cc`
3. GitHub → Settings → Pages → Source: `main` / root
4. Cloudflare DNS → delete the Pages record, re-add the four A records
   (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`), set to **DNS only**
5. Disable or delete the Access application
6. Optionally delete the Pages project

Minutes, not a rebuild. The slowest part is DNS propagation.

---

## Stage 2 — when the new pages ship

Do **not** run this until `BUILD-PLAN-admin-v2.md` is built and ready to deploy.
Until then, Stage 1's whole-domain Access is correct.

The member cart is public and lives at the site root. So Access must be narrowed
**before** that page goes live, or members hit an OTP screen they cannot pass.

- [ ] **Narrow the Access application first.** Edit it: Application domain
      `wggrpbuy.cc`, Path **`admin*`**. Save. Same single policy now protects
      `/admin/index.html` and `/admin/dashboard.html` and nothing else.
- [ ] Re-check the `.pages.dev` coverage from Phase 6 — narrowing the path may have
      changed what the additional domain matches. Verify again in a private window.
- [ ] **Then** deploy the restructure in one push (see `BUILD-PLAN-admin-v2.md` D60):
      new `index.html` at root, `admin/index.html`, and `dashboard.html` moved to
      `admin/dashboard.html` with the `DATA_BASE` path fix (§7 of that doc).

All three must land together. Deploy the new root `index.html` without moving the
dashboard and the dashboard is gone; move the dashboard without the new root and the
site has no landing page.

### Stage 2 verification

- [ ] `wggrpbuy.cc/` → member cart, **no OTP**, loads for anyone
- [ ] `wggrpbuy.cc/admin` → OTP screen
- [ ] `wggrpbuy.cc/admin/dashboard.html` → OTP screen, then loads with all rounds
      present (this confirms the `DATA_BASE` fix — a wrong prefix shows an empty
      shell rather than an error)
- [ ] The `.pages.dev` equivalents of all three behave the same way
- [ ] Historical rounds, member totals and payment state all still render

---

## Notes and gotchas

**`_headers` for cache control.** Cloudflare Pages supports a `_headers` file;
GitHub Pages does not. That is the root cause of the stale-JSON problem the
dashboard already works around. You could set sensible `Cache-Control` on the data
files and make that class of bug much less likely. **Do not remove the existing
cache-busting** (`BUILD-PLAN-admin-v2.md` D17) — it is cheap and it has caught real
problems before. Belt and braces.

**Build minutes.** Cloudflare Pages' free tier includes a generous monthly build
allowance. A static copy with no build step uses almost nothing.

**Custom domain on a private repo is free here.** The paid-plan requirement is a
GitHub Pages constraint, not a Cloudflare one. That is the main reason this route
beats paying for GitHub Pro.

**Access is not a Firestore control.** It gates HTTP requests for the HTML files.
Firestore is a separate origin the browser talks to directly, using a config that is
visible in whatever page loads it. Making the repo private removes that config from
public view; it does not restrict the database. See `BUILD-PLAN-admin-v2.md` §8.

---

## What I could not verify

Written without network access, so:

- **Cloudflare dashboard labels drift.** The sequence and concepts hold; menu names
  and button text may differ.
- **GitHub plan terms** — the private-repo-Pages requirement and GitHub Pro pricing
  should be confirmed directly before you make a decision that depends on them.
- **Cloudflare Pages free-tier limits** — verify current build minutes and any
  bandwidth caps.
- I have not seen the live site, the repo's actual contents, or your DNS records.
  Everything here derives from `overview.md`, `WeChat-GrpBuy-Frontend.md` and the
  local copy of `dashboard.html`.
