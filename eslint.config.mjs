import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude session-history buffer, not project code.
    ".remember/**",
    // Vendored Tesseract.js runtime (minified), see public/ocr/README.md.
    "public/ocr/**",
    // Obsidian vault internals (gitignored, but eslint scans the disk):
    // community plugins drop their own JS here.
    "wiki/.obsidian/**",
    // Agent worktrees (each carries its own .next generated output).
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
