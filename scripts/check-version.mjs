#!/usr/bin/env node
// Keeps package.json's version honest against release tags.
//
// PASS when either:
//   - no tag `v<version>` exists yet (a release is pending), or
//   - `v<version>` points at HEAD (this commit IS the release commit).
// FAIL when `v<version>` exists at some OTHER commit — that means the
// version has already shipped and package.json needs to be bumped
// before more work lands on dev.
//
// No dependencies: only Node/Bun builtins. Requires git tags to be
// present locally (`git fetch --tags` / `actions/checkout` with
// `fetch-depth: 0`).

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(scriptDir, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = pkg.version;
const tag = `v${version}`;

function git(args, { silent = false } = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", silent ? "ignore" : "pipe"],
  }).trim();
}

function resolveTagSha(tagName) {
  try {
    // rev-list dereferences annotated tags to the commit they point at.
    return git(["rev-list", "-n", "1", tagName], { silent: true });
  } catch {
    return null;
  }
}

const tagSha = resolveTagSha(tag);

if (!tagSha) {
  console.log(`check-version: OK — ${tag} is not tagged yet (release pending).`);
  process.exit(0);
}

const headSha = git(["rev-parse", "HEAD"]);

if (tagSha === headSha) {
  console.log(`check-version: OK — ${tag} points at HEAD (this is the release commit).`);
  process.exit(0);
}

console.error(
  `check-version: FAIL — package.json is ${version} but ${tag} is already tagged at ${tagSha}; bump the version on dev.`,
);
process.exit(1);
