// After an export build, give out/ an empty sample manifest when the
// build didn't carry one. The media library fetches
// reference/manifest.json on load; public/reference/ is a gitignored dev
// convenience, so deployed builds 404'd on every visit. Committing an
// empty file there would clash with a local manifest on pull, so it's
// written here instead. No-op for non-export builds (no out/).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(import.meta.dirname, "..", "out");
const manifest = join(out, "reference", "manifest.json");

if (process.env.NEXT_OUTPUT_EXPORT && existsSync(out) && !existsSync(manifest)) {
  mkdirSync(join(out, "reference"), { recursive: true });
  writeFileSync(manifest, "[]\n");
  console.log("wrote empty out/reference/manifest.json");
}
