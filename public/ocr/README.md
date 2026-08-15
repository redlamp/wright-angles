# Vendored Tesseract.js runtime

OCR ("Detect text sizes" in the Media Library) runs entirely from these
files — no CDN, no remote calls, per `wiki/notes/decision-local-only-media.md`.
Re-vendor after upgrading tesseract.js with `bun scripts/vendor-ocr.mjs`.

| File | Source | Size |
| --- | --- | --- |
| `worker.min.js` | `tesseract.js@7.0.0` (`dist/worker.min.js`) | 109 KB |
| `tesseract-core-simd-lstm.js` | `tesseract.js-core@7.0.0` | 87 KB |
| `tesseract-core-simd-lstm.wasm` | `tesseract.js-core@7.0.0` | 2.8 MB |
| `lang/eng.traineddata.gz` | <https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz> (tessdata_fast, LSTM-only English) | 1.9 MB |

Only the **SIMD + LSTM-only** core variant is shipped (the split `.js` +
`.wasm` pair, ~1 MB smaller than the base64-inlined `.wasm.js`). Fixed-width
wasm SIMD has been in every evergreen browser since 2023 (Safari 16.4), so
the non-SIMD fallback cores are deliberately not vendored. The wasm is
fetched by the core JS relative to the worker's URL, which is why
`lib/ocr.ts` spawns the worker with `workerBlobURL: false`.

The traineddata is the small/fast variant and stays gzipped — the worker
detects gzip by magic bytes and inflates it in memory.
