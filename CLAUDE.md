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
- **Never start work from `main`.** `dev` is the base for everything.
  `origin/HEAD` here is `origin/main`, and isolated agent worktrees are
  cut from `origin/HEAD` — NOT from the branch that is checked out. So a
  worktree agent silently starts on `main` and drags main's release
  merges into `dev` when its branch is merged back. Any agent working in
  a worktree must, as its first action:

  ```sh
  git fetch origin && git reset --hard origin/dev   # confirm the base
  git log --oneline -1                              # verify before editing
  ```

  Whoever merges the branch back checks `git merge-base --is-ancestor
  origin/main HEAD` first: if that succeeds, the branch is main-based and
  needs rebasing onto `dev` before it lands.
- **Refactors run in a worktree, never in this tree.** Taylor keeps
  `bun run dev` pointed at the working tree; a multi-file refactor is
  inconsistent between its first edit and its last, so hot reload serves
  him a broken app. Additive or single-file work in place is fine.
