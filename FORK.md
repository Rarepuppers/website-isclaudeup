# Forking this site to another product (e.g. iscodexup.com)

This site is built to be cloned per product. Copy the whole folder, then make the
changes below. Two buckets: **config.js** (runtime) and **static swaps** (HTML, assets,
third-party accounts).

Target time: ~20–30 min once you have the new accounts (Brevo list, Stripe link,
Cloudflare site).

---

## 1. config.js — runtime values (one file)

Edit `config.js` → `window.SITE`:

- `product` — the product name used in verdict copy (e.g. `"Codex"`).
- `statusUrl` — the new product's Statuspage `summary.json`. Must send CORS `*`.
  - Codex / OpenAI: `https://status.openai.com/api/v2/summary.json`
  - Verify in a browser console: `fetch(url).then(r=>r.json()).then(console.log)` — if it
    errors on CORS, this template won't work for that product without a proxy.
- `copy.up/degraded/down/unreachable` — reword the sublines for the new product.
- `quotes[]` — rewrite the panic one-liners in-character (the current ones name Codex,
  Cursor, Copilot, Gemini — on iscodexup, Claude becomes the punchline instead).
- `components` — optional service-breakdown trimming. `include: []` + `limit: 0` shows
  everything (right for Claude's ~6). For OpenAI/Codex (25+ components) set an allowlist,
  e.g. `include: ["API", "ChatGPT", "Codex", "Playground"], limit: 8`, so the page doesn't
  render a wall of irrelevant rows. Names are matched case-insensitively against the feed.
- `robots` / `buttons` — keep the keys, just replace the image **files** in `/assets`.

That's all the JavaScript. `script.js` reads everything from `SITE` — don't edit it.

---

## 2. Static swaps in index.html (kept in HTML for SEO — must be real text, not JS)

Search-and-replace "Claude" → new product, then check these specific spots:

| Spot | Line-ish | What to change |
|---|---|---|
| `<title>` | head | "Is Claude Down? — Live Claude & Claude Code Status" |
| `<meta name="description">` | head | outage description |
| `og:title` / `og:description` | head | social share text |
| `og:url` + `<link rel="canonical">` | head | new domain |
| `<link rel="icon">` | head | new favicon file in `/assets` |
| `<link rel="preload">` ×2 | head | only if you rename the art files |
| `.brand` | topbar | `isclaudeup<span class="dot">.com</span>` |
| mascot `alt` | `.tv` | "Claude status robot" |
| `.question` | `.tv` | "Is Claude up?" (good SEO H-text — keep it real) |
| `.alternatives` list | backup-tools | the "stuck while it's down" alternatives (on iscodexup, **Claude itself** becomes a top alternative) |
| `.companions` block | staged | product-appropriate complementary tool |
| Brevo `<form action>` | signup | **new Brevo list endpoint** (per-site) |
| Brevo witty error strings | bottom `<script>` | "about as broken as Claude right now" |
| `.finehint` | signup | "One email when Claude's back" |
| FAQ `<section class="faq">` | FAQ | every Q&A names Claude / Claude Code / Anthropic / status.claude.com |
| `.donate` Stripe link + aria-label | support-card | **new Stripe payment link** (per-site) |
| footer product name | footer | "Is Claude Up" |
| footer status-source link | footer | `status.claude.com` |
| "Not affiliated with … Anthropic" | footer | new vendor name |
| Cloudflare `data-cf-beacon` token | bottom | **new Cloudflare Web Analytics token** (per-site) |

**Stays the same** (same business entity): `Snackpack Universe`, the GitHub link, and the
ABN in `.foot-legal`. Reuse `privacy.html` / `sponsor.html` with the same find-replace.

---

## 3. New third-party accounts to create (the only real setup cost)

These are per-site and can't be copied:

1. **Brevo** — a new contact list + embed form → paste its `action` URL into the form.
2. **Stripe** — a new payment link → into the `.donate` href.
3. **Cloudflare Web Analytics** — add the new domain → paste the new beacon token.
4. **Domain + hosting** — point the new domain at the copied static folder.
5. **Recovery notifier** — copy `notifier/`, set its `wrangler.toml` and deploy. This is
   what actually emails the list on recovery — the static site can't. See section 5 below
   and `notifier/README.md`.

---

## 4. Sanity check before launch

- Open the page: verdict renders YES/NO, mascot + button art swap, component list fills in.
- Console: no errors (a `SITE is not defined` error means `config.js` didn't load before
  `script.js` — check the two `<script>` tags near the bottom of index.html).
- Submit the signup form with a test email → confirm it lands in the **new** Brevo list.
- Smash button cycles quotes; panic counter ticks.
- Notifier: `/state` returns JSON; `/test-send` delivers a recovery email whose **From** is
  your authenticated `notify@<domain>` (see section 5).

---

## 5. Recovery notifier setup (Cloudflare Worker)

Full command-by-command guide is in `notifier/README.md`. The end-to-end order that
worked for isclaudeup, including the email-deliverability part people miss:

1. **Brevo notify list** — create it; note its numeric **list id** (Contacts → Lists → URL).
2. **Authenticate the sending domain in Brevo** (do this, not just a freemail sender —
   campaigns from `@gmail.com` etc. get spam-foldered/blocked):
   - Brevo → Senders, Domains & Dedicated IPs → **Domains** → Authenticate `<domain>`.
   - Brevo gives ~4 DNS records: a `brevo-code` TXT, two DKIM **CNAME**s
     (`brevo1._domainkey`, `brevo2._domainkey`), and a `_dmarc` TXT.
   - Add them at your **DNS host** (Porkbun for these sites — *not* Cloudflare; CF only
     runs the analytics beacon + Worker). Host field = the part before the domain only.
     Existing GitHub Pages A/CNAME records are untouched.
   - Back in Brevo, Verify → domain shows DKIM ✓ / DMARC ✓.
3. **Add a sender** `notify@<domain>` — on an authenticated domain it verifies instantly.
   Optional: add a DNS-host email **forward** `notify@<domain> → your inbox` so replies
   don't bounce (or set the campaign Reply-To to an address that already forwards).
4. **Deploy the Worker** (`cd notifier`):
   - `npx wrangler login`
   - `npx wrangler kv namespace create STATE` → paste the id into `wrangler.toml`.
   - `npx wrangler secret put BREVO_API_KEY` (Brevo → SMTP & API → API Keys).
   - `npx wrangler secret put ADMIN_KEY` (any random string; guards the test routes).
   - In `wrangler.toml` set: `name`, `STATUS_URL`, `BREVO_LIST_ID`, `SENDER_EMAIL`
     (`notify@<domain>`), `SENDER_NAME`, `PRODUCT`, `SITE_URL`.
   - `npx wrangler deploy` → first run prompts you to pick a workers.dev subdomain (once
     per account; all Workers share it).
5. **Test safely** — point `BREVO_LIST_ID` at a list containing only your own address the
   first time, then:
   `curl.exe "https://<worker>.<subdomain>.workers.dev/test-send?key=YOUR_ADMIN_KEY"`
   Expect `sent` and an email From `notify@<domain>`.

Gotchas learned the hard way:
- **Secrets only ever go into the `wrangler secret put` prompt** — never into a URL, file,
  or chat. If one leaks, rotate it (regenerate in Brevo / re-run `secret put`).
- A brand-new sending domain may hit **spam for the first several sends** (no reputation
  yet, shared IP). It warms up; marking "Not spam" once helps. Not a bug.
- On Windows PowerShell, `curl` is aliased to `Invoke-WebRequest` (prompts + verbose
  output). Use **`curl.exe`** for clean requests.
