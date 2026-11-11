/* -------------------------------------------------------------------------- */
/*  Primitives                                                                */
/* -------------------------------------------------------------------------- */

export type Point = readonly [number, number];
export type RGB = readonly [number, number, number];
/** `[min, max]` – every random range in the config uses this shape. */
export type Range = readonly [number, number];
/** An `[r, g, b]` tuple, a `#rgb` / `#rrggbb` string, or `rgb()/rgba()`. */
export type ColorInput = RGB | string;

/** Recursively optional, but arrays / tuples are replaced as a whole. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * ground  - classic cloud-to-ground bolt (stepped leader, return stroke
 *           climbing from the ground, dart-leader restrikes, ribboning)
 * crawler - horizontal cloud-to-cloud / intra-cloud discharge that propagates
 *           both ways from an initiation point; sometimes drops a leg down
 * sheet   - no visible channel at all: the bolt is hidden inside the clouds
 *           and only the sky flickers
 */
export type StrikeKind = "ground" | "crawler" | "sheet";

export const STRIKE_KINDS: readonly StrikeKind[] = ["ground", "crawler", "sheet"];

/** A visibility source: a constant, a getter, or anything with `.get()` (e.g. a Motion `MotionValue`). */
export type VisibilityInput = number | (() => number) | { get(): number };

/* -------------------------------------------------------------------------- */
/*  Palette                                                                   */
/* -------------------------------------------------------------------------- */

export type PaletteKey = "outer" | "mid" | "inner" | "core" | "flash" | "cloud";
export type PaletteName = "storm" | "violet" | "ember" | "toxic" | "mono";
/** A preset name, or a (partial) set of colours layered over the default. */
export type PaletteInput = PaletteName | Partial<Record<PaletteKey, ColorInput>>;

export interface ResolvedPalette {
  rgb: Record<PaletteKey, RGB>;
  /** `"rgba(r,g,b,"` – append an alpha and `)` to get a colour string. */
  prefix: Record<PaletteKey, string>;
  /** Stable identity, used to invalidate cached sprites. */
  key: string;
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export type PassColor = "outer" | "mid" | "inner" | "core";

/** One layered stroke of the channel (drawn widest -> thinnest). */
export interface StrokePass {
  /** Width in CSS px for the main channel. */
  width: number;
  alpha: number;
  color: PassColor;
}

export interface BranchConfig {
  /** Fork chance per point (depth 1). */
  c1: number;
  /** Max branches (depth 1). */
  m1: number;
  /** Fork chance per point (depth 2). */
  c2: number;
  /** Max sub-branches. */
  m2: number;
  /** Chance a branch heads upward. */
  up: number;
  /** Chance a branch hangs straight down like a tendril. */
  drop: number;
  /** Fork angle range (radians). */
  angle: Range;
  /** Length range as a fraction of the container height. */
  len: Range;
  /** Favour forks toward the bottom of the channel. */
  low: boolean;
}

export interface RenderConfig {
  /** Layered strokes making up every channel. */
  passes: readonly StrokePass[];
  /** Time (ms) for a ground return stroke to climb the whole channel. */
  frontMs: number;
  /** Base halo radius (px) around a ground channel. Crawlers / limbs scale from it. */
  bloomRadius: number;
  /** Resolution of the sky-glow canvas (0..1). `null` = decided by quality. */
  glowResolution: number | null;
}

export interface GroundConfig {
  /** Time (ms) the stepped leader takes to reach the ground. */
  leaderMs: Range;
  /** Gap (ms) between the leader arriving and the return stroke. */
  returnDelayMs: number;
  returnDecayMs: number;
  /** Number of dart-leader restrikes. */
  restrikes: Range;
  restrikeGapMs: Range;
  restrikeAmp: Range;
  restrikeDecayMs: Range;
  /** Where the bolt lands, as a fraction of the container height. */
  endY: Range;
  /** Sky-bloom radius relative to the larger container side. */
  spread: number;
  /** Strength of the glow where the bolt touches down. */
  impact: number;
  /** Brightness of the faint leader before the return stroke. */
  leaderGlow: number;
  /** Lingering glow of the ionised channel. */
  afterglow: number;
  /** Rise time (ms) of each pulse (bigger = softer). */
  attackMs: number;
  /** Number of illuminated cloud blobs. */
  clouds: number;
  branch: BranchConfig;
}

export interface CrawlerConfig {
  leaderMs: Range;
  returnDelayMs: number;
  /** Number of shimmering follow-up pulses. */
  flickers: Range;
  flickerGapMs: Range;
  flickerAmp: Range;
  /** Chance the discharge drops a long leg out of the cloud base. */
  dropChance: number;
  spread: number;
  impact: number;
  leaderGlow: number;
  afterglow: number;
  attackMs: number;
  clouds: number;
  branch: BranchConfig;
}

export interface SheetConfig {
  /** Number of irregular flashes. */
  pulses: Range;
  gapMs: Range;
  amp: Range;
  decayMs: Range;
  spread: number;
  afterglow: number;
  attackMs: number;
  clouds: number;
}

/**
 * Sound travels ~1 km per 3 s, so thunder trails the flash. Each kind of
 * strike behaves like it is a different distance away.
 */
export interface DistanceProfile {
  /** Delay (s) between flash and thunder. */
  delay: Range;
  gain: number;
  /** Low-pass cut-off (Hz) – distant thunder is muffled. */
  lowpass: number;
  /** Chance of using the heavy clap instead of a light rumble. */
  heavy: number;
}

export interface SoundConfig {
  /** Master thunder volume, 0..1. */
  volume: number;
  /** Silence the thunder without touching the visuals. */
  muted: boolean;
  /** URL of the heavy clap, or `null` to never use one. */
  heavyUrl: string | null;
  /** URLs of lighter rumbles. */
  lightUrls: readonly string[];
  /** Loudness boost after per-strike gain (a compressor prevents clipping). */
  boost: number;
  /** Max overlapping thunder voices. */
  maxConcurrent: number;
  playbackRate: Range;
  /** Below this visibility the flash is "off screen", so no thunder. */
  minVisibility: number;
  /** Multiplies every distance delay (0 = instant, 2 = further away). */
  delayScale: number;
  distance: Record<StrikeKind, DistanceProfile>;
}

export type Quality = "low" | "medium" | "high";

export interface QualityProfile {
  /** Device-pixel-ratio ceiling for the bolt canvas. */
  dpr: number;
  /** Resolution of the sky-glow canvas. */
  glow: number;
  /** Spacing multiplier for halo stamps (alpha is compensated). */
  bloomSpacing: number;
  /** Polyline points stroked per path chunk. */
  chunk: number;
  /** Number of widest passes skipped. */
  skipPasses: number;
  /** Whether the chromatic fringe is allowed. */
  fringe: boolean;
}

/** Everything the engine reads, fully populated. */
export interface CoreOptions {
  /** Seconds between strikes `[min, max]`. */
  interval: Range;
  /** Seconds before the very first strike. */
  firstStrikeDelay: number;
  /** Chance a strike is followed by a quick second one. */
  doubleStrikeChance: number;
  /** Delay (ms) of that second strike. */
  doubleStrikeDelay: Range;
  /** Relative frequency of each strike kind. */
  weights: Record<StrikeKind, number>;
  /** Fixed seed for a reproducible storm; `null` = `Math.random`. */
  seed: number | null;
  /** Stop scheduling new strikes (running ones finish). */
  paused: boolean;
  /** Global brightness multiplier. */
  intensity: number;
  /** Channel thickness multiplier. */
  thickness: number;
  /** Halo / bloom multiplier around the channel. */
  glow: number;
  /** Sky + cloud illumination multiplier. */
  flash: number;
  /** Branch count / chance multiplier (0 = no branches). */
  branching: number;
  /** Ribboning (sideways drift between restrikes) multiplier. */
  wind: number;
  /** Per-frame plasma flicker amplitude (0 = steady). */
  flicker: number;
  /** Subtle chromatic fringe on the main channel. */
  fringe: boolean;
  quality: Quality | "auto";
  /** Hard cap for devicePixelRatio. */
  maxDpr: number;
  render: RenderConfig;
  ground: GroundConfig;
  crawler: CrawlerConfig;
  sheet: SheetConfig;
  sound: SoundConfig;
}

/** What you pass in: everything optional, colours accept strings. */
export type LightningOptions = DeepPartial<CoreOptions> & {
  palette?: PaletteInput;
  /** Two colours for the chromatic fringe `[left, right]`. */
  fringeColors?: readonly [ColorInput, ColorInput];
};

/** What the engine uses. */
export type ResolvedOptions = CoreOptions & {
  palette: ResolvedPalette;
  /** `rgba(` prefixes for the two chromatic fringe colours. */
  fringePrefix: readonly [string, string];
};

/* -------------------------------------------------------------------------- */
/*  Runtime                                                                   */
/* -------------------------------------------------------------------------- */

/** One continuous channel: the main bolt, a branch, or a sub-branch. */
export interface Channel {
  /** Interleaved `x0, y0, x1, y1, ...`. */
  pts: Float32Array;
  /** Cumulative length at each point. */
  cum: Float32Array;
  /** Point count. */
  n: number;
  total: number;
  /** Relative thickness. */
  width: number;
  /** 0 = main, 1 = branch, 2 = sub-branch. */
  depth: number;
  /** ms after strike birth when the leader reaches the start. */
  t0: number;
  /** ms the leader takes to travel this channel. */
  dur: number;
  /** Brightness multiplier. */
  gain: number;
  /** Where along the main channel this limb forks off (0..1). */
  rootFrac: number;
  /** How much the channel thins toward its tip (0..1). */
  taper: number;
}

/** A return stroke: fast attack, exponential decay. */
export interface Pulse {
  at: number;
  amp: number;
  decay: number;
}

export interface Cloud {
  x: number;
  y: number;
  r: number;
  k: number;
  f: number;
  ph: number;
}

export interface Strike {
  kind: StrikeKind;
  born: number;
  channels: Channel[];
  pulses: Pulse[];
  clouds: Cloud[];
  /** Centre of the sky illumination. */
  cx: number;
  cy: number;
  /** Radius of the sky bloom relative to max(w, h). */
  spread: number;
  /** Ground / drop attachment point. */
  end: Point | null;
  impact: number;
  /** ms when the first return stroke / main flash hits. */
  rs: number;
  /** Brightness of the faint leader before that. */
  lead: number;
  afterglow: number;
  attack: number;
  /** Return stroke climbs the channel from the ground. */
  front: boolean;
  /** px the channel shifts between restrikes (wind). */
  ribbon: number;
  duration: number;
}

export interface BuildContext {
  rng: import("../helpers/random").Rng;
  w: number;
  h: number;
  now: number;
  opts: ResolvedOptions;
}

export interface StrikeInfo {
  kind: StrikeKind;
  /** `performance.now()` timestamp of the strike. */
  time: number;
}
