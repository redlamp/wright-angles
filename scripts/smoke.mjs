// Browser smoke test of the static export: loads the built app in
// headless Chromium, drives the main surfaces, and fails on any page
// error, console error, or request that leaves localhost (the
// local-only promise, decision-local-only-media.md).
//
//   NEXT_OUTPUT_EXPORT=1 bun run build && bun run smoke
//
// Serves `out/` under NEXT_PUBLIC_BASE_PATH when set, so it runs against
// the same build CI deploys. SMOKE_CHROMIUM overrides the browser binary
// (cloud sessions: /opt/pw-browsers/chromium); SMOKE_SHOT=path.png saves
// a final screenshot.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const OUT = join(import.meta.dir, "..", "out");
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

if (!existsSync(join(OUT, "index.html"))) {
  console.error("smoke: no out/index.html; run an export build first");
  process.exit(1);
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    let path = new URL(req.url).pathname;
    if (BASE && !path.startsWith(BASE)) return new Response("", { status: 404 });
    path = decodeURIComponent(path.slice(BASE.length)) || "/";
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(join(OUT, path));
    if (await file.exists()) return new Response(file);
    const html = Bun.file(join(OUT, `${path}.html`));
    return (await html.exists())
      ? new Response(html)
      : new Response("", { status: 404 });
  },
});
const origin = `http://localhost:${server.port}`;
const url = `${origin}${BASE}/`;

const problems = [];
const browser = await chromium.launch({
  executablePath: process.env.SMOKE_CHROMIUM || undefined,
});

/** One isolated browser context with error and network tracking. */
async function openPage({ onboarded }) {
  const context = await browser.newContext();
  if (onboarded) {
    await context.addInitScript(() => {
      localStorage.setItem(
        "wright-angles:settings",
        JSON.stringify({ state: { onboarded: true }, version: 0 }),
      );
    });
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    // A failed fetch logs a bare "Failed to load resource"; the response
    // handler below reports it with its URL instead.
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
      problems.push(`console error: ${m.text()}`);
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !/^(data|blob):/.test(u)) {
      problems.push(`remote request: ${u}`);
    }
  });
  await page.goto(url, { waitUntil: "load" });
  return page;
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    problems.push(`${name}: ${e.message.split("\n")[0]}`);
    console.log(`FAIL ${name}`);
  }
}

// First run: the setup assistant must greet a fresh profile.
{
  const page = await openPage({ onboarded: false });
  await step("first run shows the setup assistant", () =>
    page.getByRole("dialog").first().waitFor({ timeout: 10_000 }),
  );
  await page.context().close();
}

// Returning user: every surface, plus an import that runs auto-OCR.
{
  const page = await openPage({ onboarded: true });
  await step("app renders", () =>
    page.locator("canvas").first().waitFor({ timeout: 15_000 }),
  );
  await step("2D/3D toggle (Tab)", async () => {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);
  });
  for (const [key, label] of [
    ["d", "devices tab (D)"],
    ["p", "perception report tab (P)"],
    ["m", "media tab (M)"],
  ]) {
    await step(label, async () => {
      await page.keyboard.press(key);
      await page.waitForTimeout(400);
    });
  }
  await step("import an image", async () => {
    // A generated PNG with text in it, so auto-OCR has a line to find.
    const b64 = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1280;
      c.height = 720;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#000";
      g.font = "64px sans-serif";
      g.fillText("Smoke test reading 1234", 120, 360);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.locator('input[type="file"][accept^="image"]').setInputFiles({
      name: "smoke-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(b64, "base64"),
    });
    await page
      .getByText("smoke-test", { exact: false })
      .first()
      .waitFor({ timeout: 10_000 });
  });
  // Auto-OCR loads the vendored Tesseract worker; give it time to run
  // so its errors and any stray network fetches are caught too.
  await page.waitForTimeout(8_000);
  await step("settings (S) and comparison table (C)", async () => {
    for (const k of ["s", "s", "c", "c"]) {
      await page.keyboard.press(k);
      await page.waitForTimeout(300);
    }
  });
  if (process.env.SMOKE_SHOT) {
    await page.screenshot({ path: process.env.SMOKE_SHOT });
  }
  await page.context().close();
}

await browser.close();
server.stop(true);

if (problems.length) {
  console.error(`\nsmoke: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\nsmoke: clean");
