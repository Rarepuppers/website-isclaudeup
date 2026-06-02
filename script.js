// isclaudeup.com — pure client-side, no backend.
// Reads the official Statuspage API live (CORS is open: Access-Control-Allow-Origin: *).

const STATUS_URL = "https://status.claude.com/api/v2/summary.json";

const els = {
  body: document.body,
  verdict: document.getElementById("verdict"),
  subline: document.getElementById("subline"),
  components: document.getElementById("components"),
  updated: document.getElementById("updated"),
  smash: document.getElementById("smash"),
  quote: document.getElementById("quote"),
  count: document.getElementById("count"),
  mascot: document.getElementById("mascot-img"),
  smashImg: document.getElementById("smash-img"),
};

const ROBOTS = {
  up: "assets/robot-up.webp",
  degraded: "assets/robot-degraded.webp",
  down: "assets/robot-down.webp",
};
// Button: default (resting) until status is known, then green (up) / red (down).
const DEFAULT_BUTTON = "assets/smash-button.webp";
const BUTTONS = {
  up: "assets/button-green.webp",
  degraded: DEFAULT_BUTTON, // intermittent: keep the neutral button
  down: "assets/button-red.webp",
};
// Warm the cache for the other states so swaps are instant
[...Object.values(ROBOTS), ...Object.values(BUTTONS), DEFAULT_BUTTON].forEach((src) => {
  const i = new Image();
  i.src = src;
});

// ---------- THE VERDICT ----------
// Statuspage indicator values: "none" | "minor" | "major" | "critical"
function render(data) {
  const indicator = data?.status?.indicator || "none";
  let state, verdict, subline;

  if (indicator === "none") {
    state = "up";
    verdict = "YES";
    subline = "Claude is up. Back to work. 🫡";
  } else if (indicator === "minor") {
    state = "degraded";
    verdict = "KINDA";
    subline = data.status.description || "Some services are degraded.";
  } else {
    state = "down";
    verdict = "NO";
    subline = data.status.description || "Claude is having a rough time.";
  }

  els.body.dataset.state = state;
  els.verdict.textContent = verdict;
  els.subline.textContent = subline;
  if (els.mascot && els.mascot.getAttribute("src") !== ROBOTS[state]) {
    els.mascot.src = ROBOTS[state];
  }
  if (els.smashImg && els.smashImg.getAttribute("src") !== BUTTONS[state]) {
    els.smashImg.src = BUTTONS[state];
  }
  // feed status + severity to the panic counter (drives calm vs outage scaling)
  counter.setStatus(state, data);

  // Component breakdown
  els.components.innerHTML = "";
  (data.components || [])
    .filter((c) => !c.group) // skip group containers
    .forEach((c) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = c.name;
      const pill = document.createElement("span");
      pill.className = "pill " + c.status;
      pill.textContent = (c.status || "unknown").replace(/_/g, " ");
      li.append(name, pill);
      els.components.appendChild(li);
    });

  els.updated.textContent = new Date().toLocaleTimeString();
}

async function checkStatus() {
  try {
    const res = await fetch(STATUS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("bad response " + res.status);
    render(await res.json());
  } catch (err) {
    // If the official page is itself unreachable, that's usually... a sign.
    els.body.dataset.state = "down";
    els.verdict.textContent = "?";
    els.subline.textContent =
      "Can't even reach the status page. That's rarely a good sign.";
    els.updated.textContent = new Date().toLocaleTimeString();
  }
}

// ---------- SMASH BUTTON + QUOTES ----------
const quotes = [
  "My assignment is due tomorrow and I just started.",
  "If Claude goes down, so does my productivity.",
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
  "What's the URL for Codex again?",
  "Does this mean we get another usage reset?",
  "Guess I'll go open Cursor. Ugh.",
  "Copilot it is, then. May God have mercy.",
  "I'd ask Gemini but I have my dignity.",
  "Is it down for everyone or just me being punished?",
  "My rate limit reset 3 minutes ago and now THIS.",
];

// ---------- PANIC COUNTER (split-flap odometer) ----------
// Fully faked for now (no backend). Represents "panic-checks in the last 24h".
//   • Calm days: a LOW number (0–5000) that resets at UTC midnight and creeps
//     up slowly through the day.
//   • Outages: a MUCH higher number, scaled by how long the outage has lasted
//     (using the incident start time from the status API), climbing fast.
// The number never drops mid-day (those checks already happened); it only
// resets at UTC midnight. Swap in a real API later via counter.bump().

const CLICK_RATE = {        // extra per-second jitter (only applied during issues)
  up: 0,
  degraded: 1.2,
  down: 4.5,
};

// per-day deterministic pseudo-random in [0,1) — stable for the whole UTC day
function daySeed() {
  const d = new Date();
  const n = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
}
function utcDayStart() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

// Split-flap renderer: one .cell per character, flips only the digits that change.
const counter = (() => {
  let value = 0;            // the target value
  let shown = 0;            // what's displayed (eases toward value)
  let bonus = 0;            // user smashes, folded in each second
  let state = "up";
  let data = null;          // latest status payload (for outage timing)
  let curDay = dayKey();
  let outageSeenAt = Number(localStorage.getItem("outageSeenAt")) || 0;
  let lastChars = [];

  // calm baseline: 0 → (2500–5000) across the UTC day, random per day
  function calmBase(now) {
    const target = 2500 + Math.floor(daySeed() * 2500); // 2500–5000
    const frac = Math.min(1, (now - utcDayStart()) / 86400000);
    return Math.floor(target * frac);
  }

  // outage contribution: 0 when up; otherwise scales with outage duration
  function outageBase(now) {
    const ind = data?.status?.indicator || "none";
    if (ind === "none") {
      outageSeenAt = 0;
      localStorage.removeItem("outageSeenAt");
      return 0;
    }
    const severe = ind !== "minor"; // major / critical
    // earliest active incident start from the API, else first time WE saw it
    let start = null;
    (data?.incidents || []).forEach((inc) => {
      const t = Date.parse(inc.started_at || inc.created_at || "");
      if (!isNaN(t)) start = start === null ? t : Math.min(start, t);
    });
    if (!start) {
      if (!outageSeenAt) {
        outageSeenAt = now;
        localStorage.setItem("outageSeenAt", String(now));
      }
      start = outageSeenAt;
    }
    const minutes = Math.max(0, (now - start) / 60000);
    const perMin = severe ? 320 : 80;   // panic-checks per minute
    const jump = severe ? 4000 : 1200;  // instant spike the moment it's detected
    const wobble = 0.85 + daySeed() * 0.4;
    return Math.floor((jump + minutes * perMin) * wobble);
  }

  function floorNow(now) {
    return calmBase(now) + outageBase(now);
  }

  function paint(n) {
    const str = Math.floor(n).toLocaleString("en-US");
    const chars = str.split("");

    // rebuild the cell structure if the length changed
    if (chars.length !== lastChars.length) {
      els.count.innerHTML = "";
      chars.forEach((ch) => {
        const cell = document.createElement("span");
        cell.className = ch === "," ? "cell comma" : "cell";
        cell.textContent = ch;
        els.count.appendChild(cell);
      });
      lastChars = chars;
      return;
    }

    // flip only the cells whose character changed
    const cells = els.count.children;
    chars.forEach((ch, i) => {
      if (lastChars[i] !== ch) {
        const cell = cells[i];
        cell.classList.remove("flipping");
        void cell.offsetWidth; // restart animation
        cell.classList.add("flipping");
        setTimeout(() => { cell.textContent = ch; }, 120); // swap mid-flip
      }
    });
    lastChars = chars;
  }

  // ease the displayed number toward the target (rolls up big jumps, snaps down)
  function ease() {
    if (shown === value) return;
    const diff = value - shown;
    shown = diff > 0 ? Math.min(value, shown + Math.max(1, Math.round(diff / 12))) : value;
    paint(shown);
  }
  setInterval(ease, 90);

  // once a second: recompute floor, fold in smashes + outage jitter, daily reset
  setInterval(() => {
    const now = Date.now();
    if (dayKey() !== curDay) {        // UTC midnight → reset to a fresh low base
      curDay = dayKey();
      value = calmBase(now);
      shown = value;
      paint(shown);
    }
    const floor = floorNow(now);
    if (floor > value) value = floor;  // never below the time/outage floor
    const rate = CLICK_RATE[state] || 0;
    if (rate > 0) {                    // frantic jitter only during issues
      value += Math.random() < (rate % 1) ? Math.ceil(rate) : Math.floor(rate);
    }
    value += bonus;
    bonus = 0;
  }, 1000);

  // start straight at the right number (high if we load mid-outage)
  value = shown = calmBase(Date.now());
  paint(shown);

  return {
    setStatus(s, d) { state = s; data = d; },
    bump(n = 1) { bonus += n; },
  };
})();

let lastQuote = -1;
function smash() {
  // never repeat the same quote twice in a row
  let i;
  do { i = Math.floor(Math.random() * quotes.length); } while (i === lastQuote);
  lastQuote = i;

  els.quote.classList.remove("show");
  // force reflow so the fade re-triggers
  void els.quote.offsetWidth;
  els.quote.textContent = quotes[i];
  els.quote.classList.add("show");

  els.smash.classList.remove("pop");
  void els.smash.offsetWidth;
  els.smash.classList.add("pop");

  counter.bump(1); // the user's own smash counts
  checkStatus();   // every smash re-checks for real
}

els.smash.addEventListener("click", smash);

// ---------- INIT ----------
checkStatus();
// auto-refresh every 30s while the tab is open
setInterval(() => {
  if (!document.hidden) checkStatus();
}, 30000);
