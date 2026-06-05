# Recovery notifier (Cloudflare Worker)

The piece that actually emails your list when the service comes back up. The static
site can't do this — it only runs in an open browser tab and can't hold a secret API
key. This Worker runs on Cloudflare every minute, watches the official status feed,
and sends one Brevo campaign on each genuine **down → up** recovery.

## How it works

1. Cron fires every minute → `scheduled()` → `tick()`.
2. Fetches the same `summary.json` the site reads.
3. Keeps state in Workers KV (`inOutage`, `outageStart`, `upStreak`, `lastNotifiedAt`).
4. Sends a recovery campaign **only when** all of these hold:
   - we had recorded a real outage (indicator in `OUTAGE_INDICATORS`),
   - status is now **fully operational** (`indicator === "none"`),
   - confirmed for `UP_CONFIRM_TICKS` consecutive minutes (anti-flap),
   - the outage lasted at least `MIN_OUTAGE_MINUTES` (ignore tiny blips),
   - we're outside the `NOTIFY_COOLDOWN_MINUTES` window (no double-sends).
5. Sending = create a Brevo campaign to your list, then `sendNow`.

## One-time setup

Prereqs: a Cloudflare account, `npm i -g wrangler`, and `wrangler login`.

```bash
cd notifier

# 1. Create the KV namespace and paste the printed id into wrangler.toml (id = "...").
wrangler kv namespace create STATE

# 2. Set secrets (never commit these).
wrangler secret put BREVO_API_KEY     # from Brevo → SMTP & API → API Keys
wrangler secret put ADMIN_KEY         # any random string; guards the debug routes

# 3. Edit wrangler.toml [vars]:
#    BREVO_LIST_ID  → numeric id of your double-opt-in notify list (Brevo → Contacts → Lists)
#    SENDER_EMAIL   → a Brevo-VERIFIED sender (Brevo → Senders). Unverified = sends fail.
#    SENDER_NAME / PRODUCT / SITE_URL → branding

# 4. Deploy.
wrangler deploy
```

## Test without waiting for a real outage

```bash
# Inspect current state (no auth needed):
curl https://isclaudeup-notifier.<your-subdomain>.workers.dev/state

# Force-send a recovery email to the list (auth required):
curl "https://isclaudeup-notifier.<your-subdomain>.workers.dev/test-send?key=YOUR_ADMIN_KEY"

# Run one tick on demand and see what it decided:
curl "https://isclaudeup-notifier.<your-subdomain>.workers.dev/test-tick?key=YOUR_ADMIN_KEY"

# Watch live logs while it runs:
wrangler tail
```

> ⚠️ `/test-send` emails your **real list**. Point `BREVO_LIST_ID` at a test list with
> just your own address the first time.

## Forking to another site (iscodexup, etc.)

Copy this `notifier/` folder and change, in `wrangler.toml`: `name`, `STATUS_URL`,
`BREVO_LIST_ID`, `SENDER_EMAIL`, `PRODUCT`, `SITE_URL`. Re-create KV + secrets for the
new Worker. Logic is identical — same edge detection, same flap guards.

## Tuning the noise/speed trade-off

- Want to also notify on degraded recovery? Add `minor` to `OUTAGE_INDICATORS`.
- Getting paged for blips? Raise `MIN_OUTAGE_MINUTES`.
- Recovery edge flapping? Raise `UP_CONFIRM_TICKS` (each tick ≈ 1 min later, but surer).
