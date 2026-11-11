import type {
  BranchConfig,
  CoreOptions,
  Quality,
  QualityProfile,
  RGB,
  PaletteKey,
} from "../types/types";

/**
 * Real lightning photographs as a blown-out white core wrapped in a pale
 * blue-violet glow (plasma at ~30,000 K emits broadband light, the cool tint
 * comes from nitrogen/oxygen emission lines and Rayleigh scattering).
 */
export const DEFAULT_PALETTE: Record<PaletteKey, RGB> = {
  outer: [92, 118, 245], // wide atmospheric halo
  mid: [150, 178, 255], // ionised air around the channel
  inner: [222, 233, 255], // hot plasma
  core: [250, 252, 255], // blown-out centre
  flash: [105, 172, 255], // sky illumination
  cloud: [108, 128, 232], // light scattered inside the clouds
};

export const DEFAULT_FRINGE: readonly [RGB, RGB] = [
  [255, 90, 120],
  [70, 120, 255],
];

export const GROUND_BRANCH: BranchConfig = {
  c1: 0.055,
  m1: 8,
  c2: 0.03,
  m2: 2,
  up: 0,
  drop: 0,
  angle: [0.35, 1.0],
  len: [0.05, 0.2],
  low: true,
};

export const CRAWLER_BRANCH: BranchConfig = {
  c1: 0.07,
  m1: 11,
  c2: 0.035,
  m2: 3,
  up: 0.25,
  drop: 0.35,
  angle: [0.3, 1.1],
  len: [0.04, 0.16],
  low: false,
};

export const DEFAULT_OPTIONS: CoreOptions = {
  interval: [1.5, 6.5],
  firstStrikeDelay: 1.2,
  doubleStrikeChance: 0.2,
  doubleStrikeDelay: [80, 220],
  weights: { ground: 40, crawler: 28, sheet: 32 },
  seed: null,
  paused: false,
  intensity: 1,
  thickness: 1,
  glow: 1,
  flash: 1,
  branching: 1,
  wind: 1,
  flicker: 0.1,
  fringe: true,
  quality: "auto",
  maxDpr: 2,

  render: {
    // Layered strokes, widest -> thinnest.
    passes: [
      { width: 34, alpha: 0.035, color: "outer" },
      { width: 16, alpha: 0.085, color: "outer" },
      { width: 7, alpha: 0.17, color: "mid" },
      { width: 3, alpha: 0.5, color: "inner" },
      { width: 1.3, alpha: 1, color: "core" },
    ],
    frontMs: 55,
    bloomRadius: 150,
    glowResolution: null,
  },

  ground: {
    leaderMs: [130, 190],
    returnDelayMs: 35,
    returnDecayMs: 70,
    restrikes: [2, 5],
    restrikeGapMs: [45, 130],
    restrikeAmp: [0.45, 0.95],
    restrikeDecayMs: [35, 75],
    endY: [0.72, 0.95],
    spread: 0.95,
    impact: 1,
    leaderGlow: 0.28,
    afterglow: 0.2,
    attackMs: 4,
    clouds: 5,
    branch: GROUND_BRANCH,
  },

  crawler: {
    leaderMs: [110, 200],
    returnDelayMs: 30,
    flickers: [3, 8],
    flickerGapMs: [35, 110],
    flickerAmp: [0.3, 0.8],
    dropChance: 0.3,
    spread: 0.75,
    impact: 0.5,
    leaderGlow: 0.3,
    afterglow: 0.22,
    attackMs: 6,
    clouds: 6,
    branch: CRAWLER_BRANCH,
  },

  sheet: {
    pulses: [2, 6],
    gapMs: [50, 170],
    amp: [0.3, 0.75],
    decayMs: [45, 110],
    spread: 0.7,
    afterglow: 0.08,
    attackMs: 14,
    clouds: 6,
  },

  sound: {
    volume: 0.7,
    muted: false,
    heavyUrl: "/sounds/heavyThunder.mp3",
    lightUrls: ["/sounds/thunder1.mp3", "/sounds/thunder2.mp3"],
    boost: 2.5,
    maxConcurrent: 3,
    playbackRate: [0.92, 1.06],
    minVisibility: 0.15,
    delayScale: 1,
    // Delays are kept short on purpose: the visual return stroke already lands
    // ~165-220 ms after the strike starts, so anything longer feels detached.
    distance: {
      ground: { delay: [0.05, 0.25], gain: 1, lowpass: 16000, heavy: 0.45 },
      crawler: { delay: [0.2, 0.6], gain: 0.85, lowpass: 8000, heavy: 0.12 },
      sheet: { delay: [0.5, 1.2], gain: 0.6, lowpass: 3500, heavy: 0 },
    },
  },
};

/**
 * Cost / fidelity presets. `quality: "auto"` starts at `high` and steps down
 * if the strike animation can't hold ~25 fps.
 */
export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  high: { dpr: 2, glow: 0.5, bloomSpacing: 1, chunk: 6, skipPasses: 0, fringe: true },
  medium: { dpr: 1.5, glow: 0.5, bloomSpacing: 1.5, chunk: 8, skipPasses: 0, fringe: true },
  low: { dpr: 1, glow: 0.35, bloomSpacing: 2.2, chunk: 12, skipPasses: 1, fringe: false },
};

export const QUALITY_ORDER: readonly Quality[] = ["high", "medium", "low"];
