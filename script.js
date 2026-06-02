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
    verdict = "NO";
    subline = "Claude is up. Back to work. 🫡";
  } else if (indicator === "minor") {
    state = "degraded";
    verdict = "KINDA";
    subline = data.status.description || "Some services are degraded.";
  } else {
    state = "down";
    verdict = "YES";
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
  // adjust how fast the panic counter climbs based on severity
  counter.setRate(CLICK_RATE[state]);

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
];

// ---------- PANIC COUNTER (split-flap odometer) ----------
// Fully faked for now (no backend). Represents "checks in the last 24h".
// It drifts upward on its own — slowly when Claude is fine, fast during an
// outage — and jumps when the user smashes the button. Swap in a real API later.

const CLICK_RATE = {
  up: 0.18,        // ~ a tick every few seconds (calm)
  degraded: 1.4,   // noticeably busier
  down: 5.5,       // frantic refreshing
};

// Split-flap renderer: one .cell per character, flips only the digits that change.
const counter = (() => {
  let value = 0;       // the "true" target value
  let shown = 0;       // what's currently displayed (eases toward value)
  let rate = CLICK_RATE.up;
  let lastChars = [];

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

  // ease the displayed number toward the target so big jumps roll up
  function tick() {
    if (shown < value) {
      const step = Math.max(1, Math.round((value - shown) / 12));
      shown = Math.min(value, shown + step);
      paint(shown);
    }
  }
  setInterval(tick, 90);

  // ambient drift: add checks over time based on the current rate
  setInterval(() => {
    // Poisson-ish: rate is per second; this runs every 1s with jitter
    const added = Math.random() < (rate % 1) ? Math.ceil(rate) : Math.floor(rate);
    if (added > 0) value += added;
  }, 1000);

  return {
    seed(n) { value = n; shown = n; paint(n); },
    bump(n = 1) { value += n; },
    setRate(r) { if (typeof r === "number") rate = r; },
  };
})();

// Seed a plausible "last 24h" baseline that shifts a little each day,
// so reloads don't snap back to one fixed number.
const daySalt = new Date().getUTCDate() * 137 + new Date().getUTCHours() * 53;
counter.seed(16000 + (daySalt % 4000));

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
