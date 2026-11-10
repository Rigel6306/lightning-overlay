#!/usr/bin/env node
/**
 * Renders the README demo GIFs from the real engine.
 *
 *   npm i -D esbuild playwright      # once (plus a Chromium: `npx playwright install chromium`)
 *   node scripts/render-gifs.mjs [sceneName ...]
 *
 * Needs `ffmpeg` on PATH. Set CHROME_PATH to use an existing Chrome/Chromium
 * instead of Playwright's bundled one. Output: docs/gifs/<scene>.gif
 * (add `--keep` to keep the raw PNG frames in .frames/).
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const { chromium } = require("playwright");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const framesRoot = join(root, ".frames");
const outDir = join(root, "docs", "gifs");

const W = 640;
const H = 360;

/* -------------------------------------------------------------------------- */
/*  Scenes                                                                    */
/* -------------------------------------------------------------------------- */

const single = (name, kind, seed, caption, extra = {}) => ({
  name,
  w: W,
  h: H,
  fps: 50,
  gif: { colors: 112 },
  segments: [
    {
      caption,
      options: { seed, ...extra },
      fires: [{ at: 260, kind }],
      tailMs: 500,
    },
  ],
});

const SCENES = [
  single("ground", "ground", +(process.env.SEED_GROUND ?? 11), 'kind: "ground"'),
  single("crawler", "crawler", +(process.env.SEED_CRAWLER ?? 14), 'kind: "crawler"'),
  single("sheet", "sheet", +(process.env.SEED_SHEET ?? 5), 'kind: "sheet"'),
  {
    name: "storm",
    w: W,
    h: H,
    fps: 25,
    gif: { colors: 80, width: 512 },
    segments: [
      {
        options: { seed: 21 },
        caption: "a few seconds of <Lightning />",
        fires: [
          { at: 400, kind: "ground" },
          { at: 1900, kind: "sheet" },
          { at: 2900, kind: "crawler" },
          { at: 3900, kind: "ground" },
          { at: 4080, kind: "crawler" },
          { at: 5500, kind: "sheet" },
          { at: 6300, kind: "ground" },
        ],
        tailMs: 500,
      },
    ],
  },
  {
    name: "palettes",
    w: W,
    h: H,
    fps: 25,
    gif: { colors: 112 },
    segments: ["storm", "violet", "ember", "toxic"].map((palette, i) => ({
      options: { seed: 30 + i * 3, palette },
      caption: `palette="${palette}"`,
      fires: [{ at: 240, kind: "ground" }],
      tailMs: 360,
    })),
  },
  {
    name: "tuning",
    w: W,
    h: H,
    fps: 25,
    gif: { colors: 112 },
    segments: [
      { caption: "branching={0}", extra: { branching: 0 } },
      { caption: "defaults", extra: {} },
      { caption: "branching={2.5} thickness={1.7} glow={1.4}", extra: { branching: 2.5, thickness: 1.7, glow: 1.4 } },
    ].map(({ caption, extra }) => ({
      options: { seed: 11, ...extra },
      caption,
      fires: [{ at: 240, kind: "ground" }],
      tailMs: 360,
    })),
  },
];

/* -------------------------------------------------------------------------- */
/*  Run                                                                       */
/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const wanted = args.filter((a) => !a.startsWith("--"));
const scenes = wanted.length ? SCENES.filter((s) => wanted.includes(s.name)) : SCENES;
if (!scenes.length) throw new Error(`No scene matches: ${wanted.join(", ")}`);

console.log("bundling harness…");
const bundle = await build({
  entryPoints: [join(root, "scripts", "harness.ts")],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
  logLevel: "error",
});
const code = bundle.outputFiles[0].text;

mkdirSync(outDir, { recursive: true });
rmSync(framesRoot, { recursive: true, force: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1"],
});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.error("page error:", e));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));

await page.exposeFunction("saveFrame", (scene, index, dataUrl) => {
  const dir = join(framesRoot, scene);
  mkdirSync(dir, { recursive: true });
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  writeFileSync(join(dir, `${String(index).padStart(4, "0")}.png`), Buffer.from(b64, "base64"));
});
await page.setContent('<!doctype html><body style="margin:0;background:#000"></body>');
await page.addScriptTag({ content: code });

for (const scene of scenes) {
  process.stdout.write(`rendering ${scene.name}… `);
  const frames = await page.evaluate((spec) => window.renderScene(spec), scene);
  const gif = join(outDir, `${scene.name}.gif`);
  const scale = scene.gif.width ? `scale=${scene.gif.width}:-1:flags=lanczos,` : "";
  const filter =
    `fps=${scene.fps},${scale}split[a][b];` +
    `[a]palettegen=max_colors=${scene.gif.colors}:stats_mode=diff[p];` +
    `[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-framerate", String(scene.fps), "-i", join(framesRoot, scene.name, "%04d.png"), "-vf", filter, "-loop", "0", gif],
    { stdio: "inherit" }
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${scene.name}`);
  console.log(`${frames} frames -> docs/gifs/${scene.name}.gif`);
}

await browser.close();
if (!keep && existsSync(framesRoot)) rmSync(framesRoot, { recursive: true, force: true });
