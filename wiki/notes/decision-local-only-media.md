---
tags: [domain/product, status/adopted]
---

# Decision: Media Never Leaves the Machine

**Date:** 2026-08-14 · **Status:** adopted

## Context

The target users include AAA game studios where sharing pre-release
screenshots with any third-party server is a non-starter. Taylor: "nothing
sent up to a server or cloud... which is a big issue for AAA game studios,
where I come from." The PRD lists no-remote-storage as a non-goal
boundary and a success condition.

## Decision

- Images imported by drag-and-drop are stored as blobs in **IndexedDB**,
  surfaced via object URLs at runtime. No upload endpoint exists; the app
  ships as a static site with no backend at all.
- Device list and settings persist in **localStorage**.
- Settings panel carries a privacy statement and a **wipe local data**
  button that clears both stores.

## Why

- Removes the entire trust conversation for studio users.
- Keeps the app deployable as a static page forever.

## Constraints carried forward

- Never add analytics, remote logging, or URL-fetch proxying without a
  new decision note. External image URLs (a PRD idea) would leak referrer
  traffic — if added, it must be direct browser fetch, clearly labeled.
- IndexedDB is origin-scoped: moving domains (GH Pages → custom domain)
  silently "loses" user libraries. Flag in release notes if that happens.
