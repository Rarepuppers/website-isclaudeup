// ─────────────────────────────────────────────────────────────────────────
// isclaudeup recovery notifier — Cloudflare Worker (cron-triggered).
//
// Runs every minute (see wrangler.toml [triggers]). It polls the official
// Statuspage summary, remembers the previous state in KV, and when the service
// transitions from a real outage back to fully operational, it sends ONE Brevo
// campaign to the notify list. Flap protection stops blips from spamming people.
//
// The browser/static site can't do this (only runs in an open tab, can't hold a
// secret API key). This Worker is the always-on "watcher" that closes that gap.
//
// Config: see wrangler.toml [vars]. Secret: BREVO_API_KEY (wrangler secret put).
// ─────────────────────────────────────────────────────────────────────────

const STATE_KEY = "notifier:state";

function cfg(env) {
  return {
    statusUrl: env.STATUS_URL,
    listId: Number(env.BREVO_LIST_ID),
    senderName: env.SENDER_NAME,
    senderEmail: env.SENDER_EMAIL,
    product: env.PRODUCT || "the service",
    siteUrl: env.SITE_URL || "",
    // Which Statuspage indicators count as a real outage worth notifying recovery from.
    // Default: only major/critical (a "minor"/degraded blip won't trigger a blast).
    outageIndicators: (env.OUTAGE_INDICATORS || "major,critical")
      .split(",").map((s) => s.trim()).filter(Boolean),
    // An outage must last at least this long before its recovery is worth emailing.
    minOutageMs: Number(env.MIN_OUTAGE_MINUTES || "3") * 60000,
    // Require this many consecutive "fully operational" ticks before declaring recovery.
    upConfirmTicks: Number(env.UP_CONFIRM_TICKS || "2"),
    // Don't send two recovery emails within this window (belt-and-suspenders).
    cooldownMs: Number(env.NOTIFY_COOLDOWN_MINUTES || "30") * 60000,
  };
}

async function loadState(env) {
  const raw = await env.STATE.get(STATE_KEY);
  return raw ? JSON.parse(raw) : {
    inOutage: false,
    outageStart: null,
    upStreak: 0,
    lastIndicator: null,
    lastNotifiedAt: 0,
    lastNotifiedIncidentId: null,
  };
}

function saveState(env, state) {
  return env.STATE.put(STATE_KEY, JSON.stringify(state));
}

// Earliest active incident id (for de-dup / logging).
function activeIncidentId(data) {
  const inc = (data.incidents || [])[0];
  return inc ? inc.id : null;
}

async function tick(env, { force = false } = {}) {
  const c = cfg(env);
  const now = Date.now();
  const state = await loadState(env);
  const before = JSON.stringify(state); // only write KV if something actually changes (free-tier friendly)

  const res = await fetch(c.statusUrl, { cf: { cacheTtl: 0 }, headers: { "cache-control": "no-store" } });
  if (!res.ok) {
    console.log(`status fetch failed: ${res.status}`);
    return { action: "fetch-error", status: res.status };
  }
  const data = await res.json();
  const indicator = (data.status && data.status.indicator) || "none";
  const isOutageNow = c.outageIndicators.includes(indicator);
  const isFullyUp = indicator === "none";

  let action = "noop";

  if (isOutageNow) {
    if (!state.inOutage) {
      state.inOutage = true;
      state.outageStart = now;
      state.lastNotifiedIncidentId = activeIncidentId(data); // remember which incident
      action = "outage-detected";
    }
    state.upStreak = 0;
  } else {
    // Not in a counted outage. Only a *fully operational* reading advances recovery.
    // Cap the streak at the confirm threshold so steady-up ticks stop mutating state
    // (otherwise upStreak would grow every minute and force a KV write every minute).
    state.upStreak = isFullyUp ? Math.min(state.upStreak + 1, c.upConfirmTicks) : 0;

    const confirmed = force || state.upStreak >= c.upConfirmTicks;
    const lastedLongEnough = state.outageStart && (now - state.outageStart) >= c.minOutageMs;
    const outOfCooldown = (now - (state.lastNotifiedAt || 0)) >= c.cooldownMs;

    if (state.inOutage && confirmed) {
      if (lastedLongEnough && outOfCooldown) {
        await sendRecoveryCampaign(env, c, { outageStart: state.outageStart, now });
        state.lastNotifiedAt = now;
        action = "recovery-sent";
      } else {
        action = lastedLongEnough ? "recovery-skipped-cooldown" : "recovery-skipped-too-brief";
      }
      // Clear the outage either way (brief blips shouldn't linger as "in outage").
      state.inOutage = false;
      state.outageStart = null;
      state.lastNotifiedIncidentId = null;
    }
  }

  state.lastIndicator = indicator;
  // Write only when state changed — during steady operation this is a no-op, so KV
  // writes stay far under the free-tier 1,000/day (only transitions/recovery write).
  if (JSON.stringify(state) !== before) await saveState(env, state);
  console.log(`tick: indicator=${indicator} action=${action} upStreak=${state.upStreak}`);
  return { action, indicator, state };
}

function recoveryEmailHtml(c) {
  const link = c.siteUrl
    ? `<p style="margin:24px 0 0"><a href="${c.siteUrl}" style="color:#7c5cff">${c.siteUrl.replace(/^https?:\/\//, "")}</a></p>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f0f12;color:#eaeaf0;padding:32px">
    <div style="max-width:480px;margin:0 auto;text-align:center">
      <h1 style="font-size:32px;margin:0 0 8px">✅ ${c.product} is back up</h1>
      <p style="color:#a8a8b8;font-size:16px;line-height:1.5">The official status page is reporting all systems operational again. Back to work.</p>
      ${link}
      <p style="color:#6a6a78;font-size:12px;margin-top:32px">You're getting this because you asked to be notified when ${c.product} recovered.
      {{ unsubscribe }}</p>
    </div></body></html>`;
}

// Creates a Brevo campaign targeting the notify list, then sends it immediately.
async function sendRecoveryCampaign(env, c, { now }) {
  const stamp = new Date(now).toISOString().slice(0, 16).replace("T", " ");
  const body = {
    name: `${c.product} recovered ${stamp} UTC`,
    subject: `✅ ${c.product} is back up`,
    sender: { name: c.senderName, email: c.senderEmail },
    htmlContent: recoveryEmailHtml(c),
    recipients: { listIds: [c.listId] },
  };

  const create = await fetch("https://api.brevo.com/v3/emailCampaigns", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!create.ok) {
    const txt = await create.text();
    console.log(`brevo create campaign failed: ${create.status} ${txt}`);
    throw new Error(`brevo create ${create.status}`);
  }
  const { id } = await create.json();

  const send = await fetch(`https://api.brevo.com/v3/emailCampaigns/${id}/sendNow`, {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, accept: "application/json" },
  });
  if (!send.ok) {
    const txt = await send.text();
    console.log(`brevo sendNow failed: ${send.status} ${txt}`);
    throw new Error(`brevo sendNow ${send.status}`);
  }
  console.log(`recovery campaign ${id} sent to list ${c.listId}`);
}

export default {
  // Cron entrypoint — the real driver.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  },

  // HTTP entrypoint — debugging only. /state shows KV; /test-tick runs one tick
  // (guarded by ADMIN_KEY); /test-send forces a recovery email (guarded).
  async fetch(req, env) {
    const url = new URL(req.url);
    const authed = env.ADMIN_KEY && url.searchParams.get("key") === env.ADMIN_KEY;

    if (url.pathname === "/state") {
      const state = await loadState(env);
      return Response.json(state);
    }
    if (url.pathname === "/test-tick") {
      if (!authed) return new Response("unauthorized", { status: 401 });
      return Response.json(await tick(env));
    }
    if (url.pathname === "/test-send") {
      if (!authed) return new Response("unauthorized", { status: 401 });
      await sendRecoveryCampaign(env, cfg(env), { now: Date.now() });
      return new Response("sent");
    }
    return new Response("isclaudeup notifier: ok", { status: 200 });
  },
};
