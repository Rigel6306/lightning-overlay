# ⚡ Lightning

Procedural, physically-inspired lightning for hero sections. Pure Canvas 2D,
no images, no WebGL, no runtime dependencies except React (and the React
wrapper is optional — the core engine is framework-free).

![A few seconds of Lightning](./docs/gifs/storm.gif)

- **Three kinds of strikes**, each with its own behaviour and sound
  (cloud-to-ground, crawling cloud-to-cloud, and hidden "sheet" lightning).
- **Stepped leaders, return strokes, dart-leader restrikes, branching,
  ribboning, chromatic fringe, lit clouds** — all generated per strike, so no
  two are alike.
- **Thunder** via Web Audio, delayed and filtered by how "far away" the
  strike is.
- **Highly customisable**: ~30 simple props plus a deep `ground` / `crawler` /
  `sheet` / `render` / `sound` config for every constant that matters.
- **Cheap**: typed-array channels, cached gradient sprites, a half-resolution
  glow layer, automatic quality step-down, and no work at all when hidden.
- **Deterministic on demand** with `seed` (used to render the GIFs in this
  README from the real engine).
- Respects `prefers-reduced-motion`, SSR-safe, `"use client"` ready for the
  Next.js App Router.

---

## Contents

1. [Install](#install)
2. [Quick start](#quick-start)
3. [Strike kinds](#strike-kinds)
4. [Props reference](#props-reference)
5. [Palettes](#palettes)
6. [Tuning & recipes](#tuning--recipes)
7. [Imperative API](#imperative-api)
8. [Using the engine without React](#using-the-engine-without-react)
9. [Sound](#sound)
10. [Performance notes](#performance-notes)
11. [Architecture & folder structure](#architecture--folder-structure)
12. [Regenerating the GIFs](#regenerating-the-gifs)
13. [Migrating from the single-file version](#migrating-from-the-single-file-version)

---

## Install

Copy this folder into your project, e.g. `src/components/lightning/`.

Requirements: React 18+ (it uses `useSyncExternalStore`). TypeScript is
recommended; the code compiles under `strict` and `noUncheckedIndexedAccess`.
It does **not** need Tailwind or `motion`.

Optional thunder files — put them in `public/sounds/`:

```
public/sounds/heavyThunder.mp3
public/sounds/thunder1.mp3
public/sounds/thunder2.mp3
```

(Or point to your own, see [Sound](#sound). Missing files are simply skipped.)

---

## Quick start

`<Lightning />` fills its nearest positioned ancestor, so give the parent
`position: relative` (Tailwind: `relative`).

```tsx
import Lightning from "@/components/lightning";

export function Hero() {
  return (
    <section className="relative h-screen overflow-hidden bg-black">
      <Lightning />
      <h1 className="relative z-40">Storm warning</h1>
    </section>
  );
}
```

### Linked to scroll (Motion)

`visibility` accepts a number, a getter, or any object with `.get()` — so a
Motion `MotionValue` works directly and updates without re-rendering React.
When it drops to ~0 the component stops building strikes and drawing.

```tsx
"use client";
import { useRef } from "react";
import { useScroll, useTransform } from "motion/react";
import Lightning from "@/components/lightning";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const visibility = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative h-[200vh] bg-black">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Lightning visibility={visibility} palette="violet" interval={[2, 7]} />
      </div>
    </section>
  );
}
```

---

## Strike kinds

Every strike is one of three kinds, chosen by weighted random (`weights`).

### `ground` — cloud-to-ground

A stepped leader grows from the cloud toward the ground, then the bright
return stroke races back **up** the channel, followed by several weaker
dart-leader restrikes. Channels thin toward their tips, side branches fork
mostly near the bottom, and the channel "ribbons" sideways in the wind
between restrikes. Often paired with the heavy thunder clap.

![ground strike](./docs/gifs/ground.gif)

### `crawler` — cloud-to-cloud / intra-cloud

A horizontal discharge that grows in both directions from an initiation
point, with many short branches (some hanging like tendrils). Sometimes it
drops a long leg out of the cloud base. It shimmers through a run of softer,
closely spaced pulses.

![crawler strike](./docs/gifs/crawler.gif)

### `sheet` — hidden in the clouds

No visible channel: the bolt is buried in the cloud deck, so only the sky and
the clouds flicker irregularly around a hot spot. Quiet, distant, atmospheric.

![sheet lightning](./docs/gifs/sheet.gif)

---

## Props reference

`Lightning` props = **component props** + **options** (everything the engine
reads). Every prop is optional, and **changing any prop never restarts the
storm** — the new value is picked up by the next strike / frame.

### Component props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `visibility` | `number \| () => number \| { get(): number }` | `1` | Master visibility 0–1 (strikes are scaled by it, drawing stops near 0). Pass a Motion `MotionValue` to follow scroll. |
| `volume` | `number` | `0.7` | Shortcut for `sound.volume`. |
| `muted` | `boolean` | `false` | Shortcut for `sound.muted` – silence thunder, keep visuals. |
| `respectReducedMotion` | `boolean` | `true` | Render nothing when the visitor prefers reduced motion. |
| `className` | `string` | – | Applied to both canvases. |
| `style` | `CSSProperties` | – | Merged over the default canvas styles (both canvases). |
| `boltZIndex` | `number` | `29` | Stacking order of the channel canvas. |
| `glowZIndex` | `number` | `31` | Stacking order of the sky-glow canvas (it uses `mix-blend-mode: screen`). |
| `onStrike` | `(info: { kind, time }) => void` | – | Called every time a strike fires. |
| `ref` | `Ref<LightningHandle>` | – | See [Imperative API](#imperative-api). |

### Options — timing & randomness

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `interval` | `[min, max]` seconds | `[1.5, 6.5]` | Time between strikes. |
| `firstStrikeDelay` | seconds | `1.2` | Delay before the very first strike. |
| `doubleStrikeChance` | `0–1` | `0.2` | Chance that a strike is followed by a quick second one. |
| `doubleStrikeDelay` | `[min, max]` ms | `[80, 220]` | Delay of that second strike. |
| `weights` | `{ ground, crawler, sheet }` (partial OK) | `{ 40, 28, 32 }` | Relative frequency of each kind. `0` disables a kind. |
| `seed` | `number \| null` | `null` | Fixed seed for a reproducible storm. |
| `paused` | `boolean` | `false` | Stop scheduling new strikes (running ones finish). |

### Options — look

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `palette` | `PaletteName \| Partial<Record<PaletteKey, Color>>` | `"storm"` | Preset name or custom colours. See [Palettes](#palettes). |
| `intensity` | `number` | `1` | Global brightness multiplier. |
| `thickness` | `number` | `1` | Channel thickness multiplier. |
| `glow` | `number` | `1` | Halo / bloom around the channel (`0` = none). |
| `flash` | `number` | `1` | Sky + cloud illumination (`0` = none). |
| `branching` | `number` | `1` | Branch chance **and** count multiplier (`0` = clean bolts, `2.5` = very branchy). |
| `wind` | `number` | `1` | Ribboning (sideways drift between restrikes). `0` = none. |
| `flicker` | `number` | `0.1` | Per-frame plasma flicker amplitude. `0` = steady. |
| `fringe` | `boolean` | `true` | Subtle chromatic fringe on the main channel. |
| `fringeColors` | `[Color, Color]` | `[[255,90,120],[70,120,255]]` | Colours of that fringe. |

`Color` is `[r, g, b]`, `"#rgb"`, `"#rrggbb"`, `"rgb(…)"` or `"rgba(…)"`.

### Options — performance

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `quality` | `"auto" \| "high" \| "medium" \| "low"` | `"auto"` | `auto` starts at `high` and steps **down** if frames average slower than ~25 fps. |
| `maxDpr` | `number` | `2` | Hard cap for `devicePixelRatio`. |
| `render.glowResolution` | `number \| null` | `null` | Resolution of the sky-glow canvas (0–1). `null` = decided by `quality` (0.5 / 0.5 / 0.35). |

| Quality | DPR cap | Glow res. | Halo stamp spacing | Fringe | Widest stroke pass |
| --- | --- | --- | --- | --- | --- |
| `high` | 2 | 0.5 | 1× | on | on |
| `medium` | 1.5 | 0.5 | 1.5× | on | on |
| `low` | 1 | 0.35 | 2.2× | off | skipped |

### Options — `render` (deep config)

| Option | Default | Description |
| --- | --- | --- |
| `render.passes` | 5 passes, 34 px → 1.3 px | Layered strokes `{ width, alpha, color: "outer" \| "mid" \| "inner" \| "core" }`, widest first. |
| `render.frontMs` | `55` | ms for a ground return stroke to climb the whole channel. |
| `render.bloomRadius` | `150` | Halo radius (px) around a ground channel; crawlers / limbs scale from it. |

### Options — per-kind config

All ranges are `[min, max]`. Pass only what you want to change, e.g.
`ground={{ restrikes: [4, 8] }}`.

**`ground`**

| Key | Default | Description |
| --- | --- | --- |
| `leaderMs` | `[130, 190]` | Time (ms) the stepped leader takes to reach the ground. |
| `returnDelayMs` | `35` | Gap between the leader arriving and the return stroke. |
| `returnDecayMs` | `70` | Decay time of the main return stroke. |
| `restrikes` | `[2, 5]` | Number of dart-leader restrikes (upper bound exclusive). |
| `restrikeGapMs` / `restrikeAmp` / `restrikeDecayMs` | `[45,130]` / `[0.45,0.95]` / `[35,75]` | Spacing, strength and decay of the restrikes. |
| `endY` | `[0.72, 0.95]` | Where the bolt lands, as a fraction of container height. |
| `spread` | `0.95` | Sky-bloom radius relative to the larger container side. |
| `impact` | `1` | Strength of the glow at the touch-down point. |
| `leaderGlow` | `0.28` | Brightness of the faint leader before the return stroke. |
| `afterglow` | `0.2` | Lingering glow of the ionised channel. |
| `attackMs` | `4` | Rise time of each pulse (bigger = softer). |
| `clouds` | `5` | Number of illuminated cloud blobs. |
| `branch` | see below | Branching behaviour. |

**`crawler`**

| Key | Default | Description |
| --- | --- | --- |
| `leaderMs`, `returnDelayMs`, `spread`, `impact`, `leaderGlow`, `afterglow`, `attackMs`, `clouds`, `branch` | `[110,200]`, `30`, `0.75`, `0.5`, `0.3`, `0.22`, `6`, `6`, … | Same meaning as for `ground`. |
| `flickers` | `[3, 8]` | Number of shimmering follow-up pulses. |
| `flickerGapMs` / `flickerAmp` | `[35,110]` / `[0.3,0.8]` | Spacing and strength of those pulses. |
| `dropChance` | `0.3` | Chance of a long leg dropping out of the cloud base. |

**`sheet`**

| Key | Default | Description |
| --- | --- | --- |
| `pulses` | `[2, 6]` | Number of irregular flashes. |
| `gapMs` / `amp` / `decayMs` | `[50,170]` / `[0.3,0.75]` / `[45,110]` | Spacing, strength and decay of the flashes. |
| `spread`, `afterglow`, `attackMs`, `clouds` | `0.7`, `0.08`, `14`, `6` | As above. |

**`branch`** (`BranchConfig`, used by `ground.branch` and `crawler.branch`)

| Key | Ground / Crawler default | Description |
| --- | --- | --- |
| `c1`, `m1` | `0.055, 8` / `0.07, 11` | Fork chance per point and max count for branches. |
| `c2`, `m2` | `0.03, 2` / `0.035, 3` | Same for sub-branches. |
| `up`, `drop` | `0, 0` / `0.25, 0.35` | Chance a branch heads upward / hangs straight down. |
| `angle` | `[0.35,1.0]` / `[0.3,1.1]` | Fork angle range (radians). |
| `len` | `[0.05,0.2]` / `[0.04,0.16]` | Branch length as a fraction of container height. |
| `low` | `true` / `false` | Favour forks toward the bottom of the channel. |

### Options — `sound`

See [Sound](#sound).

---

## Palettes

Pass a preset name, or override individual colours (everything you omit keeps
the default blue-white look).

```tsx
<Lightning palette="ember" />

<Lightning palette={{ outer: "#ff4fd8", flash: "#ff7be5", cloud: [200, 70, 190] }} />
```

![palette presets](./docs/gifs/palettes.gif)

| Preset | Look |
| --- | --- |
| `storm` | Default pale blue-white (what real long-exposure photos look like). |
| `violet` | Purple-white. |
| `ember` | Orange-white. |
| `toxic` | Green-white. |
| `mono` | Neutral grey-white. |

Palette keys: `outer` (wide halo), `mid` (ionised air), `inner` (hot plasma),
`core` (blown-out centre), `flash` (sky illumination), `cloud` (light scattered
inside clouds). The presets live in [`config/palettes.ts`](./config/palettes.ts).

---

## Tuning & recipes

The same strike (same `seed`) with different knobs:

![tuning options](./docs/gifs/tuning.gif)

```tsx
{/* Subtle ambient flicker behind content */}
<Lightning intensity={0.6} interval={[4, 10]} weights={{ ground: 0, crawler: 20, sheet: 80 }} muted />

{/* Violent storm */}
<Lightning
  interval={[0.8, 3]}
  doubleStrikeChance={0.45}
  branching={1.8}
  thickness={1.3}
  ground={{ restrikes: [4, 8], restrikeGapMs: [30, 90] }}
/>

{/* Clean, minimal bolts – no side branches, no fringe */}
<Lightning branching={0} fringe={false} weights={{ ground: 100, crawler: 0, sheet: 0 }} />

{/* Battery saver / low-end devices */}
<Lightning quality="low" maxDpr={1} />

{/* Same storm every page load */}
<Lightning seed={42} />

{/* Your own thunder files */}
<Lightning sound={{ heavyUrl: "/audio/boom.mp3", lightUrls: ["/audio/rumble.mp3"], volume: 0.5 }} />

{/* React to strikes (e.g. flash UI, analytics, haptics) */}
<Lightning onStrike={({ kind }) => console.log("strike:", kind)} />
```

---

## Imperative API

```tsx
import { useRef } from "react";
import Lightning, { type LightningHandle } from "@/components/lightning";

const storm = useRef<LightningHandle>(null);

<Lightning ref={storm} />
<button onClick={() => storm.current?.strike("ground")}>Smite</button>
```

| Member | Description |
| --- | --- |
| `strike(kind?)` | Fire a strike now. `kind` is `"ground" \| "crawler" \| "sheet"`, random if omitted. |
| `pause()` / `resume()` | Stop / restart the automatic storm (independent of the `paused` prop). |
| `engine` | The underlying [`LightningEngine`](#using-the-engine-without-react), `null` while unmounted / reduced motion. |

---

## Using the engine without React

`LightningEngine` takes two canvases and has no dependencies. Give the second
one `mix-blend-mode: screen`.

```ts
import { LightningEngine } from "./lightning";

const engine = new LightningEngine({
  bolt: document.querySelector("#bolt")!,   // channels + halo
  glow: document.querySelector("#glow")!,   // sky / cloud illumination
  visibility: 1,
  options: { palette: "violet", seed: 7 },
  onStrike: (info) => console.log(info.kind),
});

engine.start();                     // automatic storm
engine.fire("ground");              // or fire one by hand
engine.setOptions({ intensity: 0.8 });  // live update, no restart
engine.pause(); engine.resume();
engine.dispose();                   // timers, observers, audio
```

**Manual mode** (`manual: true`) disables timers, the animation loop and audio.
You drive it with `fire(kind, now)` and `render(now)` — handy for tests and
offline rendering (that's how the GIFs above were made):

```ts
const engine = new LightningEngine({ bolt, glow, manual: true, options: { seed: 1 } });
engine.fire("ground", 0);
for (let t = 0; t < 1200; t += 20) engine.render(t);   // deterministic frames
```

---

## Sound

Thunder is synthesised from short samples with Web Audio. Each strike kind
behaves as if it were a different distance away: ground bolts are close and
loud (often the heavy clap), crawlers are further, sheet lightning is a distant
muffled rumble.

```tsx
<Lightning
  sound={{
    volume: 0.7,                // master volume 0–1 (same as the `volume` prop)
    muted: false,               // same as the `muted` prop
    heavyUrl: "/sounds/heavyThunder.mp3",   // null = never use a heavy clap
    lightUrls: ["/sounds/thunder1.mp3", "/sounds/thunder2.mp3"],
    boost: 2.5,                 // loudness after per-strike gain (a compressor prevents clipping)
    maxConcurrent: 3,           // overlapping voices
    playbackRate: [0.92, 1.06], // random pitch variation per clap
    minVisibility: 0.15,        // below this `visibility` there is no thunder
    delayScale: 1,              // 0 = instant, 2 = twice as far away
    distance: {
      ground:  { delay: [0.05, 0.25], gain: 1,    lowpass: 16000, heavy: 0.45 },
      crawler: { delay: [0.2, 0.6],   gain: 0.85, lowpass: 8000,  heavy: 0.12 },
      sheet:   { delay: [0.5, 1.2],   gain: 0.6,  lowpass: 3500,  heavy: 0 },
    },
  }}
/>
```

How it behaves:

- Browsers block audio until the visitor interacts with the page. The
  `AudioContext` is therefore created **lazily**, on the first real gesture (or
  immediately if the browser reports the page was already activated), so there
  is no console warning. Strikes before audio is unlocked stay silent — they are
  never queued up to fire all at once.
- Sound files are fetched on demand (and prefetched once audio is audible),
  decoded once, and cached. A file that fails to load is remembered and not
  requested again.
- Muted / zero volume costs nothing: no context work and no fetches.
- No thunder while the tab is hidden or the hero is scrolled away.

---

## Performance notes

An audit of the original single-file component turned up the following. All
are fixed in this version.

| # | Issue in the original | Fix |
| --- | --- | --- |
| 1 | The main effect depended on `interval[0]`, `interval[1]` and `visibility`; changing them tore down the whole storm **and the `AudioContext`**. | The engine is created once. Props flow in through `setOptions()`, which rebuilds only what changed (palette sprites, canvas sizes). |
| 2 | `AudioContext` was created and 3 MP3s fetched/decoded on mount even when muted or at volume 0, and before any user gesture (autoplay warning). | Audio is created lazily after a gesture, loads on demand, and costs nothing while muted. Failed loads aren't retried. |
| 3 | 8+ `createRadialGradient` calls **per strike per frame** (sky bloom, hot spot, every cloud) plus full-canvas `fillRect`s. | Gradients are baked once into small sprites and `drawImage`-d with `globalAlpha`; clouds use a destination rect instead of `save/translate/scale/restore`. |
| 4 | The sky/cloud layer was rendered at full resolution × DPR 2 though it only contains soft gradients. | Rendered at 0.5× (0.35× on `low`) and scaled by CSS: ~4× fewer pixels to fill. |
| 5 | Halo stamps every N *points* — spacing varied with the random path and heavily over-drew large soft sprites. | Stamped by **arc length**, with spacing scaled per quality and alpha compensated so the result is visually equivalent. |
| 6 | Every stroke pass (5) and both fringe passes rebuilt the entire path for every chunk. | One path per chunk, stroked for each pass (the canvas uses additive `lighter` blending, so order doesn't matter). Invisible passes (alpha < 0.004) are skipped. |
| 7 | Per-frame garbage: tuple arrays from `visibleOf`, `slice()` copies, `strikes.filter()`, fresh `rgba()` strings for every stroke, `findIndex` closures. | Channels are flat `Float32Array`s, sampled into a reusable scratch buffer; strikes are compacted in place; colours are prefix strings + an alpha; a reusable job buffer replaces per-call objects. |
| 8 | Strikes (geometry + audio) were generated even when nothing could be seen: hidden tab, hero scrolled away. | `tick()` skips building strikes when `document.hidden` or `visibility ≈ 0`. |
| 9 | No way to cope with slow devices. | `quality: "auto"` steps down `high → medium → low` if frames average slower than ~25 fps while a strike animates (never steps back up). |
| 10 | `Math.random` baked in everywhere; strikes couldn't be reproduced or tested. | Injectable seedable RNG (`seed`); strike generation and per-frame jitter use separate streams; audio has its own. |
| 11 | Hard dependency on `motion/react` for `useReducedMotion` and the `MotionValue` type; Tailwind-only `z-29` / `z-31`. | Own `usePrefersReducedMotion` (`useSyncExternalStore`); `visibility` is structurally typed (a `MotionValue` still works); z-index via props and inline styles. |
| 12 | Constants (colours, widths, timings, branching, thunder profile) were buried in the file. | Everything lives in [`config/defaults.ts`](./config/defaults.ts) and is overridable with typed, deep-partial options. |

Rendering cost is dominated by the halo stamps and stroke passes of whichever
strikes are currently animating; when no strike is animating the component does
no per-frame work at all (no `requestAnimationFrame`). The numbers will vary by
device and GPU — try `quality="low"` or `maxDpr={1}` first if you need to
squeeze more.

---

## Architecture & folder structure

```
lightning/
├── README.md
├── index.ts                    public exports
├── Lightning.tsx               React wrapper (thin; owns canvases + lifecycle)
├── types.ts                    all types (options, runtime shapes)
├── audio/
│   └── thunder.ts              lazy Web Audio thunder player
├── config/
│   ├── defaults.ts             DEFAULT_OPTIONS, default palette, quality profiles
│   ├── palettes.ts             palette presets (storm, violet, ember, toxic, mono)
│   └── resolve.ts              user options → fully-populated ResolvedOptions
├── engine/
│   └── LightningEngine.ts      framework-free scheduler + render loop
├── helpers/
│   ├── color.ts                colour parsing / rgba strings
│   ├── geometry.ts             jagged midpoint-displacement paths
│   ├── math.ts                 clamp helpers
│   ├── random.ts               seedable RNG
│   └── visibility.ts           number | getter | { get() } → getter
├── hooks/
│   └── usePrefersReducedMotion.ts
├── render/
│   ├── drawBolt.ts             halo, fringe, layered core, ribbon, tip, impact
│   ├── drawFlash.ts            sky bloom, hot spot, lit clouds
│   ├── env.ts                  shared per-engine render state
│   ├── sprites.ts              cached gradient sprites
│   └── strokes.ts              scratch buffers, channel sampling, chunked stroking
├── strikes/
│   ├── branches.ts             recursive limb forking
│   ├── channel.ts              typed-array channel builder
│   ├── clouds.ts               lit cloud blobs
│   ├── crawler.ts  ground.ts  sheet.ts      one builder per kind
│   ├── intensity.ts            flash envelope over time
│   └── index.ts                pickKind / buildStrike
├── scripts/
│   ├── harness.ts              offline renderer (runs in a page)
│   └── render-gifs.mjs         renders docs/gifs/*.gif
└── docs/gifs/                  demo GIFs used in this README
```

Data flow: `Lightning.tsx` → `LightningEngine` (timers + rAF) → `strikes/*`
builds a `Strike` (channels, pulses, clouds) → `render/*` draws it onto the two
canvases every frame, driven by `intensityAt(strike, t)`.

---

## Regenerating the GIFs

The GIFs are rendered from the real engine in manual mode with fixed seeds, so
they're reproducible.

```bash
npm i -D esbuild playwright
npx playwright install chromium     # or: export CHROME_PATH=/path/to/chrome
# ffmpeg must be on PATH

node scripts/render-gifs.mjs                 # all scenes
node scripts/render-gifs.mjs ground storm    # just some
node scripts/render-gifs.mjs --keep          # also keep raw PNG frames in .frames/
```

Scenes (edit `SCENES` in `scripts/render-gifs.mjs`): `ground`, `crawler`,
`sheet`, `storm`, `palettes`, `tuning`. Set `SEED_GROUND`, `SEED_CRAWLER` or
`SEED_SHEET` to try different bolts.

---

## Migrating from the single-file version

The existing props keep working unchanged:

```tsx
<Lightning visibility={motionValue} interval={[1.5, 6.5]} volume={0.7} muted={false} />
```

What's different:

- Default export is still `Lightning`; import from the folder
  (`@/components/lightning`) instead of the file.
- `visibility` is now **optional** (defaults to `1`) and no longer requires
  `motion` — a `MotionValue` still works.
- The canvases use inline styles for `position`, `z-index` (`29` / `31`, now
  `boltZIndex` / `glowZIndex`) and `mix-blend-mode: screen`; Tailwind isn't
  needed.
- Sound files and defaults are the same (`/sounds/heavyThunder.mp3`,
  `thunder1.mp3`, `thunder2.mp3`).
- With the same defaults the look is visually equivalent to the original (the
  sky glow is rendered at lower resolution and gradients are cached sprites, so
  pixels aren't bit-identical); palette, timings and thunder profile are now
  all overridable.
