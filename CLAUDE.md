@AGENTS.md

# Wright Angles

A local-only web tool for UX designers that visualizes how displays compare
from where the viewer actually sits. Arc minutes are the canonical unit —
see `wiki/notes/decision-arcminute-rosetta-stone.md`.

## Where things live

- `docs/PRD.md` — product spec, source of truth for scope.
- `wiki/` — Obsidian vault: project state, decisions, rationale, daily log.
  Conventions in `wiki/CLAUDE.md`. Start at `wiki/index.md`.
- `lib/display-math.ts` — the angular-size math. Its tests are pinned to
  Taylor's Disco Elysium font-sizing sheet; do not "fix" the math without
  reading `wiki/research/arc-minute-spreadsheet.md`.

If a request conflicts with the PRD or a `decision-*.md` note, surface the
conflict before coding.

## Commands

- `bun run dev` — dev server on port 7841 (pinned)
- `bun test` — unit tests (math lib)
- `bun run typecheck` / `bun run lint` / `bun run build`

## Architectural rules

- **Strictly local media.** Images live in IndexedDB, devices/settings in
  localStorage. No uploads, no analytics, no remote calls. This is a core
  product promise for AAA-studio users (`decision-local-only-media.md`).
- **Math stays pure.** `lib/` has no React or DOM dependencies; components
  consume it. devicePixelRatio handling belongs to the view layer.
- **Canonical units:** diagonal inches, distance centimeters. Unit toggles
  convert at the UI edge only.
- `reactStrictMode` stays off (R3F WebGL context loss in dev).

## Git

- Branches: `main` ← `dev` ← `feature/<name>`; merge `--no-ff` into dev.
- `main` is the GitHub Pages deploy source; promote dev → main only on
  Taylor's explicit go-ahead.
- Commit by concept, not by prompt. Author email: `taylor@redlamp.org`.
