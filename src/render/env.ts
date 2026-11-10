import type { QualityProfile, ResolvedOptions } from "../types";
import type { Rng } from "../helpers/random";
import type { SpriteCache } from "./sprites";
import type { JobBuffer, Scratch } from "./strokes";

/** Everything the draw functions need, owned and mutated by the engine. */
export interface RenderEnv {
  opts: ResolvedOptions;
  profile: QualityProfile;
  sprites: SpriteCache;
  scratch: Scratch;
  jobs: JobBuffer;
  /** Per-frame randomness (jitter, flicker); separate from strike generation. */
  fx: Rng;
  /** Container size in CSS px. */
  w: number;
  h: number;
}
