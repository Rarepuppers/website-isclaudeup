# isclaudeup.com

[![Claude status](https://isclaudeup-notifier.snackpackuniverse.workers.dev/badge.svg)](https://isclaudeup.com)

Live "Is Claude up?" status page for Anthropic's Claude and Claude Code. The
original of the pair; [website-iscodexup](../website-iscodexup) is the fork.

The badge above is live: it is the same endpoint anyone can embed, rendering the
current status right now. [Grab it for your own README →](https://isclaudeup.com/badge.html)

- **Status source:** Anthropic Statuspage — `https://status.claude.com/api/v2/summary.json`
- **Runtime config:** `config.js` (product, status URL, copy, quotes, components, art)
- **Static content:** `index.html`, `history.html`, `guides.html`, `badge.html`, `sponsor.html`, `privacy.html`
- **Claude Code status:** `claude-code-status.html` — tracks the Claude Code component on its own
- **Guides:** `claude-rate-limits.html`, `claude-code-not-working.html`, `anthropic-status-vs-claude-status.html`
- **Recovery notifier + badge endpoints:** `notifier/` (Cloudflare Worker — see `notifier/README.md`)

Not affiliated with, endorsed by, or sponsored by Anthropic.

## Embeddable status badge

Three endpoints, all served by the notifier Worker, all free and uncredentialed:

| Endpoint | Use |
|---|---|
| `/badge.svg` | Drop straight into Markdown or HTML |
| `/badge.svg?label=claude` | Same, with a custom left-hand label |
| `/badge.json` | [Shields](https://shields.io) endpoint, so it matches your other badges |

```markdown
[![Claude status](https://isclaudeup-notifier.snackpackuniverse.workers.dev/badge.svg)](https://isclaudeup.com)
```

States are **operational**, **degraded**, **major outage** and **outage**. If the
feed cannot be reached the badge says **unknown** rather than lying about it.
Cached for 60 seconds.

## Why Claude Code has its own page

Anthropic publishes six components — claude.ai, Claude API, Claude Console,
Claude Code, Claude Cowork and Claude for Government — and they fail
independently. A headline "All Systems Operational" banner averages all six, so
Claude Code can be broken while the banner stays green. `claude-code-status.html`
reads the feed and reports that one component on its own.

The homepage verdict is scoped to claude.ai, Console, API and Claude Code. A
Cowork-only or Government-only incident therefore does not report ordinary
Claude as down; Anthropic's wider incident indicator can still surface it as a
degraded state.

If Anthropic ever renames or retires the component, the page reports **unknown**
rather than falsely reporting up — see the `FAIL LOUD, NOT SILENT` comment in its
inline script, and `scopeComponents()` in `script.js` for the same principle.

## Local preview

The site is fully static. From the monorepo root:

```bash
npx -y http-server website-isclaudeup -p 4180 -c-1
```

Then open http://localhost:4180. (There is also an `isclaudeup` entry in
`.claude/launch.json`.)

## Page chrome is generated

The top nav and the theme snippet are injected into every page by a build step —
do not hand-edit the blocks between `<!-- nav:generated -->` and
`<!-- theme:generated -->` markers:

```bash
node scripts/build-chrome.mjs
```

`scripts/build-chrome.mjs` is a **shared file** and must stay byte-identical with
the copy in `website-iscodexup`. Add a page to the site, add it to `sitemap.xml`
and (if it belongs in the nav) to the `LINKS` array in that script — in both repos.

## Forking / maintenance

See [FORK.md](FORK.md) for the full per-product swap checklist.
