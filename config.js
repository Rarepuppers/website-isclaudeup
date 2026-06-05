// ─────────────────────────────────────────────────────────────────────────
// PER-SITE CONFIG — the only JS file you edit to fork this to another product.
// Loaded before script.js. For the static HTML/asset swaps (title, FAQ, brand,
// favicon, Stripe link, Brevo form), see FORK.md — those live in index.html.
// ─────────────────────────────────────────────────────────────────────────
window.SITE = {
  // The product whose status we report (used only in copy below).
  product: "Codex",

  // Status data source. MUST be a Statuspage v2 "summary.json" endpoint that
  // sends CORS `Access-Control-Allow-Origin: *` (most public Statuspage sites do).
  // Codex/OpenAI status feed:
  statusUrl: "https://status.openai.com/api/v2/summary.json",

  // Verdict copy per state. For degraded/down, the live incident description from
  // the API is used first; these strings are the fallback when none is provided.
  copy: {
    up:          { verdict: "YES",   subline: "Codex is up. Back to work. 🫡" },
    degraded:    { verdict: "KINDA", subline: "Some services are degraded." },
    down:        { verdict: "NO",    subline: "Codex is having a rough time." },
    unreachable: "Can't even reach the status page. That's rarely a good sign.",
  },

  // Service-breakdown list trimming. OpenAI exposes 25+ components; most are noise
  // for this audience, so we keep an allowlist of the Codex-surface ones. Names below
  // are matched (case-insensitive, exact) against the live feed at status.openai.com.
  //   include: exact component names to keep (case-insensitive). [] = show all.
  //   limit:   max rows after filtering. 0 = no limit.
  components: { include: ["Codex API", "CLI", "VS Code extension", "Login", "Realtime"], limit: 8 },

  // Mascot + button art per state. Swap the files in /assets, keep the keys.
  robots:  { up: "assets/codex-status-up-online-green-transparent.webp", degraded: "assets/codex-status-unknown-yellow-transparent.webp", down: "assets/codex-status-down-offline-red-transparent.webp" },
  buttons: { up: "assets/codex-button-green-transparent.webp", down: "assets/codex-button-red-transparent.webp", default: "assets/codex-button-yellow-transparent.webp" },

  // Panic-counter one-liners. Keep them in-character for the product's audience.
  // On iscodexup, Claude becomes the punchline when Codex is the one that's down.
  quotes: [
    "My assignment is due tomorrow and I just started.",
    "If Codex goes down, so does my productivity.",
    "I forgot how to code without it.",
    "Refreshing this page is my whole personality now.",
    "It was working FINE thirty seconds ago.",
    "I have 14 tabs of half-finished prompts.",
    "Please. I was so close.",
    "My standup is in 10 minutes and I have nothing.",
    "Switching to Stack Overflow like it's 2015.",
    "I will touch grass the moment it's back. Not before.",
    "Have you tried turning the AI off and on again?",
    "This is the longest 4 minutes of my life.",
    "I'm thinking of using Antigravit— haha, no one uses that.",
    "What's the URL for Claude again?",
    "Does this mean we get another usage reset?",
    "Guess I'll go open Cursor. Ugh.",
    "Copilot it is, then. May God have mercy.",
    "I'd ask Claude but I have my dignity.",
    "Is it down for everyone or just me being punished?",
    "My rate limit reset 3 minutes ago and now THIS.",
  ],
};
