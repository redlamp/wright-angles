---
tags: [domain/tooling, status/adopted]
---

# Decision: Next.js 16 + Bun + Tailwind v4 + shadcn + R3F

**Date:** 2026-08-14 · **Status:** adopted

## Context

Taylor specified Next.js, shadcn, and three.js/R3F/drei up front, with Bun
as the runtime/package manager. Four prior attempts used Vue/Nuxt/Godot
and none reached the core feature ([[prior-wright-angles-attempts]]); this
build aligns with the stack of Taylor's recent projects (starry-night,
color-taylor) so conventions and gotchas carry over.

## Decision

- Next.js 16 App Router, TypeScript, Bun. Dev port pinned to **7841**.
- Tailwind v4 (CSS-first, `@theme inline`) + shadcn (base-ui era).
- three + @react-three/fiber + @react-three/drei for the 3D view.
- zustand for state.
- Visual language: the "Anodised" neutral-oklch system from color-taylor
  (hairline alpha borders, shadow-stack elevation, Barlow + Share Tech
  Mono, 32px control height). Dark theme is the default; device key
  colors are the only saturated chrome.

## Why

- Static-exportable to GitHub Pages while leaving a Vercel path open.
- shadcn/base-ui + Tailwind v4 matches muscle memory from color-taylor.
- R3F's declarative scene fits the 3D comparison view directly.

## Constraints carried forward

- `reactStrictMode: false` — R3F WebGL context is disposed by StrictMode's
  dev double-mount; canvas also wires `webglcontextlost` recovery.
- Next 16: `dynamic({ ssr: false })` only inside Client Components.
- shadcn ships base-ui primitives, not Radix — check prop shapes before
  assuming Radix APIs.
