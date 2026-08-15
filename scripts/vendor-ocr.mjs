/**
 * Vendors the Tesseract.js runtime into public/ocr so OCR runs fully
 * offline from our origin (decision-local-only-media.md). Run after
 * upgrading tesseract.js / tesseract.js-core:
 *
 *   bun scripts/vendor-ocr.mjs
 *
 * Copies from node_modules:
 *   - tesseract.js/dist/worker.min.js       → public/ocr/worker.min.js
 *   - tesseract.js-core/tesseract-core-simd-lstm.{js,wasm}
 *
 * Only the SIMD LSTM core is shipped (see public/ocr/README.md). The
 * English traineddata (tessdata_fast, gzipped) is downloaded once if
 * missing — a dev-time fetch only; the app itself never calls out.
 */
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "ocr");
const langDest = join(dest, "lang");
mkdirSync(langDest, { recursive: true });

const copies = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.js",
    "tesseract-core-simd-lstm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
    "tesseract-core-simd-lstm.wasm",
  ],
];

for (const [from, to] of copies) {
  copyFileSync(join(root, from), join(dest, to));
}

const LANG_URL =
  "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";
const langFile = join(langDest, "eng.traineddata.gz");
if (!existsSync(langFile)) {
  console.log(`Downloading ${LANG_URL} …`);
  const res = await fetch(LANG_URL);
  if (!res.ok) throw new Error(`traineddata download failed: ${res.status}`);
  writeFileSync(langFile, new Uint8Array(await res.arrayBuffer()));
}

for (const f of [
  ...copies.map(([, to]) => join(dest, to)),
  langFile,
]) {
  console.log(`${f}  ${(statSync(f).size / 1024).toFixed(0)} KB`);
}
