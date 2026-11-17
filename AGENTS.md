<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wright Angles

A local-only web tool for UX designers that visualizes how displays compare
from where the viewer actually sits. Arc minutes are the canonical unit;
see `wiki/notes/decision-arcminute-rosetta-stone.md`.

## Where things live

- `AGENTS.md` files hold the agent instructions (here and `wiki/`); each
  `CLAUDE.md` is only an `@AGENTS.md` import. Edit `AGENTS.md`.
- `docs/PRD.md`: product spec, source of truth for scope.
- `wiki/`: project state, decisions, rationale, daily log. Start at
  `wiki/index.md`.
- `lib/display-math.ts`: the angular-size math. Its tests are pinned to
  Taylor's Disco Elysium font-sizing sheet; do not "fix" the math without
  reading `wiki/research/arc-minute-spreadsheet.md`.

## Commands

- `bun run dev`: dev server on port 7841 (pinned)
- `bun test`: unit tests (math lib)
- `bun run typecheck` / `bun run lint` / `bun run build`
- `bun run smoke`: headless-Chromium smoke test of an export build (`out/`);
  fails on page errors and on any request leaving localhost. Run after
  `NEXT_OUTPUT_EXPORT=1 bun run build`; cloud sessions set
  `SMOKE_CHROMIUM=/opt/pw-browsers/chromium`. First local run needs
  `bunx playwright install chromium`.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, the export
  build and the smoke test on pushes to `dev` and on PRs.

## Architectural rules

- **Strictly local media.** Images live in IndexedDB, devices/settings in
  localStorage. No uploads, no analytics, no remote calls. This is a core
  product promise for AAA-studio users (`decision-local-only-media.md`).
- **Geometry stays pure.** The geometry modules in `lib/` (display-math,
  viewing-geometry, fit, media-crop, calibration) are pure and
  unit-tested; other `lib/` helpers may touch the DOM, but `lib/` never
  imports React.
- **Canonical units:** diagonal inches, distance centimeters. Unit toggles
  convert at the UI edge only.
- `reactStrictMode` stays off (R3F WebGL context loss in dev).
- **Keep files small.** ESLint warns past 500 lines of code per file
  (`max-lines`). Split by concern into a sibling folder (see
  `components/panels/media-library/`), keeping the original path as the
  entry point so importers don't change.

## Git

- `origin/HEAD` here is `origin/main`, so agent worktrees start from `main`.
  Reset a new worktree to `origin/dev` before editing
  (`~/.claude/memory/tools/claude-code-worktree-branches-from-origin-head.md`).
