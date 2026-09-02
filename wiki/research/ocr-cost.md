---
tags: [domain/product, status/verified]
---

# OCR Cost

What does a Tesseract.js scan actually cost, wall-clock and main-thread,
and does the vendored setup honour the local-only promise? Gathered
2026-08-20 ahead of auto-scan-on-import (issue #2,
[[plan-display-setup-wizard]]) — reading `lib/ocr.ts`, `lib/scan-actions.ts`,
`lib/scan-keyframes.ts`, `components/panels/media-library.tsx`, and
`public/ocr/README.md`, then benchmarking the real vendored runtime live
in-browser (`bun run dev` on :7841, driven headlessly) rather than
guessing. Numbers below are labelled **measured** (this session, this
machine) or **sourced** (someone else's number, cited) — never invented.

## The pipeline, as built today

`lib/ocr.ts` draws the (cropped) image to an offscreen canvas at 1:1
intrinsic pixels, then dynamically imports `tesseract.js` (client-only —
the comment is explicit that no worker code should touch prerender) and
calls `createWorker("eng", OEM.LSTM_ONLY, …)` with `workerPath`,
`corePath`, and `langPath` all pointed at `public/ocr/` and
`workerBlobURL: false`. Recognition runs at `PSM.AUTO` (full layout
analysis, not the library's single-block default) and the result is
walked as `blocks → paragraphs → lines → words`, filtered by
`MIN_CONFIDENCE = 55` / `MIN_LINE_HEIGHT_PX = 6`, then split at
cross-column word gaps (`splitWordsAtGaps`) before being handed back as
`DetectedLine[]`.

Two things worth flagging for the auto-scan design:

- **A worker is spawned and terminated per run.** The doc comment says
  so outright: "the worker is spawned and terminated per run —
  simplicity over pooling; the wasm and traineddata are cached by the
  browser/IndexedDB between runs." There is no persistent worker pool to
  reuse across an auto-scanned batch.
- **Only one scan runs at a time, process-wide.** `detectTextLines` keeps
  a module-level `inflight` promise; a concurrent call joins it rather
  than starting a second worker. `media-library.tsx`'s `runDetect` also
  no-ops re-entrant clicks (`if (scanRunning) return`). So a batch import
  is already forced into a serial queue by the existing code — auto-scan
  doesn't need new queueing logic to prevent parallel workers, it already
  can't happen.

Callers: `lib/scan-actions.ts`'s `detectTextForItem` (image path) and
`scanKeyframeAt` (timeline path, scans the current playhead frame onto a
keyframe). Both are invoked today only from the "Detect Text Size" button
in `components/panels/media-library.tsx` — `stores/media-store.ts`'s
`addFiles` (the import path) never calls either. Auto-scan-on-import is a
net-new call site, not a rewire of an existing one.

**Results are already cached per item, in IndexedDB, today.**
`MediaItem.scan` (`lib/types.ts:175`) holds `{ lines, medianPx }` and is
persisted via `persistMeta` → `idbPutMedia` alongside the rest of the
item's metadata (confirmed by reading it back out of the live
`wright-angles` IndexedDB database, not just the type). Re-detecting
replaces the old boxes rather than stacking. Auto-scan needs no new cache
layer — it just needs to call the existing save path automatically.

**Re-import has no dedup.** `addFiles` assigns a fresh `newId()` to every
imported file; there is no content hash or filename check. Dropping the
same screenshot in twice today produces two independent library items,
each with its own empty `scan`. Under auto-scan this means a re-import
scans again from zero — consistent with current behaviour, just worth
knowing it isn't free the second time.

## Measured cost

Benchmarked by driving the real dev server (`localhost:7841`) headlessly:
injected two synthetic PNGs (1280×720 and 3840×2160, each with three
lines of white text on a gradient) through the app's actual hidden file
input so they went through the real `addFiles` → IndexedDB path, then
clicked the real "Detect Text Size" button and timed click-to-completion
with `performance.now()`, polling every 100 ms (so figures below carry
roughly ±100 ms poll granularity) and running a parallel 50 ms heartbeat
timer to catch any main-thread stall.

| Case | Elapsed (click → done) | Main-thread max gap |
|---|---|---|
| **Cold start** — first scan this session, 1280×720 | **1517 ms** | 81 ms |
| Warm rerun, same 1280×720 image | 164–223 ms | 63 ms |
| Warm scan, seeded gradient card (1920×1080, the real default image, 6 text lines) | 216 ms | — |
| Warm scan, 3840×2160 (4K) | **368 ms** | 95 ms |

All measured, this session. Takeaways:

- **Cold start is the whole story.** ~1.3 s of the first scan's 1517 ms
  is worker spin-up + wasm compile + traineddata parse, paid once per
  session — every warm scan after it, at any tested resolution, lands
  under 400 ms. This matters directly for batch import: a 10-image drop
  pays the ~1.5 s tax once, then ~200–400 ms per image after, not 10×1.5 s.
- **Resolution barely moved the number** (223 ms at 1080p vs 368 ms at
  4K, both warm) — for these test images. That's a property of these
  synthetic images specifically (three short lines regardless of canvas
  size); Tesseract's layout-analysis cost scales more with the number and
  density of text regions than raw pixel count, so a screenshot with
  dozens of on-screen labels will scan slower than either figure here.
  Treat 368 ms as a floor for "big image, sparse text," not a ceiling for
  "big image, busy UI."
- **The main thread never stalls.** Heartbeat gaps stayed under 100 ms
  through every scan, cold or warm, small or 4K — recognition genuinely
  runs off-thread in the Worker, so "does the UI freeze" is answered:
  no. This is the strongest argument against needing a debounce purely
  for responsiveness; the existing single-flight lock already prevents
  parallel workers, and no individual scan blocks input.
- **Memory:** main-thread `performance.memory` moved by only ~1–2 MB
  across these scans, but that instrument only sees the page's own heap
  — the Worker's wasm memory (where Tesseract actually runs) isn't
  visible to it, and this environment has no DevTools access into the
  worker context to measure it directly. The only hard number available
  is the vendored payload itself (see below), which is a lower bound on
  what has to be resident, not a peak-usage figure. **Not measured**;
  flagging rather than guessing.
- **Not measured: real-network cold start.** This ran against `bun run
  dev` on localhost, so the worker/core/traineddata fetch was serving
  from local disk, near-zero latency. On the actual GH Pages deploy the
  same ~4.8 MB has to come over a real connection on a visitor's first
  load (still same-origin, still no CDN — see below); expect the cold
  figure to run higher there, by an amount this environment can't
  measure. Browser HTTP cache should make it a one-time cost per visitor
  regardless.

## The local-only constraint: honoured

Tesseract.js defaults to fetching its worker script, wasm core, and
traineddata from a CDN (`cdn.jsdelivr.net` / `tessdata.projectnaptha.com`)
unless every path is overridden — the kind of default that would be a
direct violation of [[decision-local-only-media]] if left alone. It is
**not** left alone here:

- `lib/ocr.ts:206-213` passes explicit `workerPath`, `corePath`, and
  `langPath`, all built from `BASE_PATH + "/ocr/..."`, plus
  `workerBlobURL: false` (needed because the split core fetches its
  `.wasm` relative to the worker's own URL, which only resolves
  correctly when the worker runs from the real `/ocr/` path rather than
  a blob: URL).
- `public/ocr/` vendors all four files locally: `worker.min.js` (111 KB),
  `tesseract-core-simd-lstm.js` (88 KB) + `.wasm` (2.8 MB), and
  `lang/eng.traineddata.gz` (1.9 MB, gzipped tessdata_fast, inflated by
  the worker in memory). `public/ocr/README.md` documents the exact
  source and re-vendor command (`bun scripts/vendor-ocr.mjs`).
- Confirmed live, not just by reading the source: the network panel
  during every benchmark scan above showed only `localhost:7841`
  requests (`GET /ocr/worker.min.js` etc.) — no request to any external
  host at any point.

Total vendored payload: **~4.86 MB** (2.8 MB wasm + 1.9 MB gz
traineddata + 88 KB core JS + 111 KB worker), all same-origin. No CDN
violation to flag — this is the one place the investigation expected bad
news and found the opposite.

## Recommendation: auto-scan on import

**Fire it automatically, no debounce needed for CPU/responsiveness
reasons** — the measured numbers don't support one. The existing
single-flight lock in `lib/ocr.ts` already serializes any batch (parallel
workers aren't possible today without new code), warm scans are
cheap (≤400 ms measured) and don't block the main thread, and the one
expensive step — cold start — happens exactly once per session no matter
how many images land in a batch.

Concretely:

- **Trigger per newly-added item after `addFiles` resolves for the whole
  batch**, not per file as each one lands. `addFiles` already loops
  through every file sequentially before returning, so this is free —
  no new timer or debounce code, just call `detectTextForItem` for each
  new id once the import loop is done. This also sidesteps firing scans
  for files that get immediately deleted mid-drop (rare, but a drag of
  many files can include a stray click-to-remove before the loop
  finishes).
- **Visible per-item progress, not a blocking modal.** The library row
  already has a "Detecting…" state for the manual button
  (`media-library.tsx:1133`); reuse it per row during auto-scan, plus a
  lightweight batch indicator ("Scanning 3 of 10…") since a 10-image
  drop is genuinely ~1.5 s + 9×~0.3 s ≈ 4 s of visible work.
- **"Cancel remaining" is cheap; "abort current" is not, yet.** The
  queue itself (items not yet started) can be cleared trivially. Killing
  an *in-flight* `recognize()` would need the caller to hold a reference
  to the live worker so it can call `worker.terminate()` early — `lib/
  ocr.ts` doesn't expose that today (it creates and terminates the
  worker entirely inside `runDetection`). Scope "cancel remaining
  queued scans" for v1; treat aborting the current recognize as a
  follow-up if it turns out to matter in practice.
- **Keep the manual "Detect Text Size" button.** Auto-scan on import
  doesn't cover re-scanning after a crop edit or a false-negative touch-
  up — that's still the button's job.
- **Re-import will rescan from scratch**, per the no-dedup finding above.
  Worth a one-line mention in whatever ships this, so nobody is surprised
  that dropping the same file in twice burns a second (cheap, warm) scan
  rather than reusing the first.

## The seeded gradient's detections can ship precomputed

`drawGenerated("gradient")` (`stores/media-store.ts:249`) is a pure
canvas draw — fixed gradient, fixed six-line label ladder, fixed
1920×1080 — so its OCR output is deterministic and can be captured once
and shipped as a static constant instead of run at first boot.
Confirmed by reading the actual scan back out of this session's
IndexedDB after running "Detect Text Size" on the real seeded card: **6
lines, confidence 88–95, serialized to 1505 bytes of JSON.** That's the
real number for the real default image, not an estimate — trivial to
inline as a TypeScript literal (same shape as `MediaItem.scan`) and
attach at seed time in place of the current empty `scan: undefined`,
skipping the ~200 ms warm-scan cost (or worse, a cold one, if seeding
happens to be the very first OCR call of the session) that a first-run
visitor would otherwise pay for zero benefit — the text is always the
same six lines. Font rendering could in principle shift a box by a pixel
or two across platforms, but since the shipped detections are pinned
static data rather than recomputed live, that's a non-issue the same way
the [[arc-minute-spreadsheet]] pinned rows are.

Related: [[decision-local-only-media]], [[plan-display-setup-wizard]],
[[screen-auto-detection]] (same "measure, don't guess" approach applied
to a different first-run question).
