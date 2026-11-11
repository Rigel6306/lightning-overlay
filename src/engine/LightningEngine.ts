import type {
  LightningOptions,
  Quality,
  ResolvedOptions,
  Strike,
  StrikeInfo,
  StrikeKind,
  VisibilityInput,
} from "../types/types";
import { QUALITY_ORDER, QUALITY_PROFILES } from "../config/defaults";
import { resolveOptions } from "../config/resolve";
import { createRng, type Rng } from "../helpers/random";
import { toVisibilityGetter } from "../helpers/visibility";
import { buildStrike, intensityAt, pickKind } from "../strikes";
import { SpriteCache } from "../render/sprites";
import { createJobBuffer, createScratch } from "../render/strokes";
import type { RenderEnv } from "../render/env";
import { drawBolt } from "../render/drawBolt";
import { drawFlash } from "../render/drawFlash";
import { createThunder, type Thunder } from "../audio/thunder";

export interface EngineInit {
  /** Canvas for the channels + halo (normal blending). */
  bolt: HTMLCanvasElement;
  /** Canvas for sky / cloud illumination (give it `mix-blend-mode: screen`). */
  glow: HTMLCanvasElement;
  visibility?: VisibilityInput;
  options?: LightningOptions;
  /**
   * Manual mode: no timers, no animation loop, no audio, no resize observer.
   * You call `fire()` and `render(now)` yourself – used for tests and for
   * rendering frames offline (e.g. the README GIFs).
   */
  manual?: boolean;
  onStrike?: (info: StrikeInfo) => void;
}

/** Hard cap so imperative `fire()` spam can't pile up unbounded work. */
const MAX_ACTIVE_STRIKES = 8;
/** Auto quality: step down when frames average slower than this (~25 fps). */
const SLOW_FRAME_MS = 40;
const SLOW_FRAMES_BEFORE_DOWNGRADE = 24;

/**
 * Framework-free lightning renderer. `<Lightning />` is a thin React wrapper
 * around this class, but you can use it directly in any environment with two
 * canvases.
 */
export class LightningEngine {
  onStrike: ((info: StrikeInfo) => void) | undefined;

  private readonly bolt: HTMLCanvasElement;
  private readonly glow: HTMLCanvasElement;
  private readonly bctx: CanvasRenderingContext2D;
  private readonly gctx: CanvasRenderingContext2D;
  private readonly manual: boolean;
  private readonly ro: ResizeObserver | null = null;
  private readonly thunder: Thunder | null = null;
  private readonly env: RenderEnv;

  private opts: ResolvedOptions;
  private getVisibility: () => number;
  private rng: Rng;
  private level: Quality = "high";
  private dpr = 1;
  private glowScale = 0.5;

  private strikes: Strike[] = [];
  private raf = 0;
  private timer = 0;
  private readonly extraTimers = new Set<number>();
  private running = false;
  private userPaused = false;
  private disposed = false;

  // adaptive quality bookkeeping
  private lastFrame = 0;
  private emaDt = 16;
  private frames = 0;

  constructor(init: EngineInit) {
    const bctx = init.bolt.getContext("2d");
    const gctx = init.glow.getContext("2d");
    if (!bctx || !gctx) throw new Error("LightningEngine: 2D canvas context unavailable");

    this.bolt = init.bolt;
    this.glow = init.glow;
    this.bctx = bctx;
    this.gctx = gctx;
    this.manual = init.manual ?? false;
    this.onStrike = init.onStrike;
    this.getVisibility = toVisibilityGetter(init.visibility);
    this.opts = resolveOptions(init.options);
    this.rng = createRng(this.opts.seed);
    this.level = this.initialLevel();

    this.env = {
      opts: this.opts,
      profile: QUALITY_PROFILES[this.level],
      sprites: new SpriteCache(),
      scratch: createScratch(),
      jobs: createJobBuffer(),
      fx: this.makeFxRng(),
      w: 0,
      h: 0,
    };

    this.resize();
    if (!this.manual) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.bolt);
      // Own RNG so audio never perturbs the (seedable) strike sequence.
      const seed = this.opts.seed;
      this.thunder = createThunder(
        () => this.opts.sound,
        createRng(seed === null ? null : (seed ^ 0x85ebca6b) >>> 0)
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /** Start the automatic storm (idempotent). */
  start(): void {
    if (this.running || this.disposed || this.manual) return;
    this.running = true;
    this.schedule(true);
  }

  /** Stop scheduling strikes. Strikes already in flight finish. */
  stop(): void {
    this.running = false;
    window.clearTimeout(this.timer);
    this.extraTimers.forEach((id) => window.clearTimeout(id));
    this.extraTimers.clear();
  }

  /** Imperatively stop scheduling new strikes (independent of the `paused` option). */
  pause(): void {
    this.userPaused = true;
    window.clearTimeout(this.timer);
  }

  /** Undo `pause()`. */
  resume(): void {
    if (!this.userPaused) return;
    this.userPaused = false;
    if (this.running && !this.opts.paused) {
      window.clearTimeout(this.timer);
      this.schedule(false);
    }
  }

  setVisibility(input: VisibilityInput | undefined): void {
    this.getVisibility = toVisibilityGetter(input);
  }

  /**
   * Apply new options. Safe to call at any time (e.g. on every React render):
   * the storm is not restarted and only what actually changed is rebuilt.
   */
  setOptions(input?: LightningOptions): void {
    if (this.disposed) return;
    const prev = this.opts;
    const next = resolveOptions(input);
    this.opts = next;
    this.env.opts = next;

    if (next.seed !== prev.seed) {
      this.rng = createRng(next.seed);
      this.env.fx = this.makeFxRng();
    }
    if (next.palette.key !== prev.palette.key) this.env.sprites.clear();

    if (
      next.quality !== prev.quality ||
      next.maxDpr !== prev.maxDpr ||
      next.render.glowResolution !== prev.render.glowResolution
    ) {
      if (next.quality !== prev.quality) this.level = this.initialLevel();
      this.applyQuality();
    }

    this.thunder?.sync();

    // pause / resume the scheduler
    if (next.paused !== prev.paused && this.running) {
      window.clearTimeout(this.timer);
      if (!next.paused && !this.userPaused) this.schedule(false);
    }
  }

  /**
   * Fire a strike right now.
   * @param kind which kind (default: weighted random pick)
   * @param now  timestamp in the same clock you pass to `render` (default `performance.now()`)
   */
  fire(kind?: StrikeKind, now: number = performance.now()): StrikeInfo | null {
    if (this.disposed || this.env.w === 0 || this.env.h === 0) return null;
    if (this.strikes.length >= MAX_ACTIVE_STRIKES) return null;

    const k = kind ?? pickKind(this.rng, this.opts.weights);
    const strike = buildStrike(k, {
      rng: this.rng,
      w: this.env.w,
      h: this.env.h,
      now,
      opts: this.opts,
    });
    this.strikes.push(strike);

    const info: StrikeInfo = { kind: k, time: now };
    this.thunder?.play(k, this.getVisibility());
    this.onStrike?.(info);

    if (!this.manual && !this.raf) {
      this.lastFrame = 0; // don't count the idle gap as a slow frame
      this.raf = requestAnimationFrame(this.loop);
    }
    return info;
  }

  /** Draw one frame for timestamp `now`. Called by the loop; call it yourself in manual mode. */
  render(now: number): void {
    const { bctx, gctx, env } = this;
    prep(bctx, this.bolt, this.dpr);
    prep(gctx, this.glow, this.dpr * this.glowScale);

    // Drop finished strikes in place (no per-frame array allocation).
    const list = this.strikes;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i]!;
      if (now - s.born < s.duration) list[n++] = s;
    }
    list.length = n;

    const vis = this.getVisibility();
    if (vis <= 0.01 || n === 0) return;

    const { flicker, intensity } = this.opts;
    for (let i = 0; i < n; i++) {
      const s = list[i]!;
      const t = now - s.born;
      const flick = 1 + (env.fx.next() * 2 - 1) * flicker; // per-frame plasma flicker
      const I = intensityAt(s, t) * vis * flick * intensity;
      const L = s.lead * vis * flick * intensity;
      drawFlash(gctx, s, I, t, env);
      if (s.channels.length) drawBolt(bctx, s, I, L, t, env);
    }
  }

  /** `true` while a strike is animating. */
  get isActive(): boolean {
    return this.strikes.length > 0;
  }

  /** Current quality level (changes over time with `quality: "auto"`). */
  get quality(): Quality {
    return this.level;
  }

  /** Re-measure the container (called automatically by a `ResizeObserver`). */
  resize(): void {
    if (this.disposed) return;
    const profile = this.env.profile;
    this.dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.opts.maxDpr, profile.dpr));
    this.glowScale = this.opts.render.glowResolution ?? profile.glow;
    const w = this.bolt.clientWidth;
    const h = this.bolt.clientHeight;
    this.env.w = w;
    this.env.h = h;

    this.bolt.width = Math.round(w * this.dpr);
    this.bolt.height = Math.round(h * this.dpr);
    this.glow.width = Math.max(1, Math.round(w * this.dpr * this.glowScale));
    this.glow.height = Math.max(1, Math.round(h * this.dpr * this.glowScale));
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro?.disconnect();
    this.thunder?.dispose();
    this.strikes.length = 0;
    this.env.sprites.clear();
  }

  /* ------------------------------------------------------------------ */
  /*  Internals                                                          */
  /* ------------------------------------------------------------------ */

  private readonly loop = (now: number) => {
    this.raf = 0;
    this.monitor(now);
    this.render(now);
    if (this.strikes.length) this.raf = requestAnimationFrame(this.loop);
  };

  private makeFxRng(): Rng {
    const seed = this.opts.seed;
    return createRng(seed === null ? null : (seed ^ 0x9e3779b9) >>> 0);
  }

  private initialLevel(): Quality {
    return this.opts.quality === "auto" ? "high" : this.opts.quality;
  }

  private applyQuality(): void {
    this.env.profile = QUALITY_PROFILES[this.level];
    this.resize();
  }

  /** Auto quality: if frames stay slow while a strike animates, step down. */
  private monitor(now: number): void {
    if (this.opts.quality !== "auto") return;
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    if (dt <= 0 || dt > 250 || dt === now) return; // first frame / tab was hidden

    this.emaDt = this.emaDt * 0.9 + dt * 0.1;
    if (++this.frames < SLOW_FRAMES_BEFORE_DOWNGRADE || this.emaDt < SLOW_FRAME_MS) return;

    const i = QUALITY_ORDER.indexOf(this.level);
    const next = QUALITY_ORDER[i + 1];
    if (next) {
      this.level = next;
      this.applyQuality();
    }
    this.frames = 0;
    this.emaDt = 16;
  }

  private schedule(first: boolean): void {
    if (!this.running || this.opts.paused || this.userPaused) return;
    const { interval, firstStrikeDelay } = this.opts;
    const wait = first ? firstStrikeDelay * 1000 : this.rng.range(interval[0], interval[1]) * 1000;
    this.timer = window.setTimeout(() => {
      this.tick();
      this.schedule(false);
    }, wait);
  }

  private tick(): void {
    // Don't build strikes nobody can see (hidden tab / hero scrolled away).
    if (document.hidden || this.getVisibility() <= 0.01) return;
    this.fire();
    // Sometimes a strike is followed by a quick second one.
    if (this.rng.chance(this.opts.doubleStrikeChance)) {
      const [lo, hi] = this.opts.doubleStrikeDelay;
      const id = window.setTimeout(() => {
        this.extraTimers.delete(id);
        this.fire();
      }, this.rng.range(lo, hi));
      this.extraTimers.add(id);
    }
  }
}

const prep = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scale: number): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = "lighter";
};
