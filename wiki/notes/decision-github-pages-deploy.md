---
tags: [domain/tooling, status/adopted]
---

# Decision: GitHub Pages Deploy from `main`

**Date:** 2026-08-14 · **Status:** adopted

## Context

Hosting starts free on GitHub Pages ("gh pages to start"), with Vercel as
a possible later move. starry-night already proved the pattern: static
export gated behind env vars so local dev is untouched, deployed by a
workflow on push to `main`.

## Decision

- `next.config.ts` enables `output: "export"` + `basePath`/`assetPrefix`
  only when `NEXT_OUTPUT_EXPORT=1`; base path `/wright-angles`.
- `.github/workflows/deploy-pages.yml` fires on push to `main`: builds
  `main` at `/wright-angles` and `dev` at `/wright-angles/dev` (dev slot
  `continue-on-error` so a broken dev never blocks production), adds
  `.nojekyll`, uploads one artifact, deploys.
- Branch flow: `main` ← `dev` ← `feature/*`. `main` is the deploy source;
  dev → main promotion only on Taylor's explicit go-ahead.

## Why

- Free, zero-config hosting matched to a fully static, local-only app.
- The dev slot gives a shareable preview URL without Vercel.

## Constraints carried forward

- Site must stay statically exportable: no server actions, no Next image
  optimization (`images.unoptimized`), IndexedDB/localStorage only.
- GH Pages gotchas from memory: environment deployment-branch-policy can
  pin to a stale branch name; a wedged deployment record is keyed to the
  commit SHA — push a new commit rather than rerunning.
- Live URL (once first deploy runs): https://redlamp.github.io/wright-angles/
