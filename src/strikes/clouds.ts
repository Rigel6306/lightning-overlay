import type { Cloud } from "../types/types";
import type { Rng } from "../helpers/random";

/** A cloud blob lit from inside; `f` / `ph` give it its own flicker phase. */
export const makeCloud = (rng: Rng, x: number, y: number, r: number): Cloud => ({
  x,
  y,
  r,
  k: rng.range(0.4, 1),
  f: rng.range(0.02, 0.05),
  ph: rng.range(0, Math.PI * 2),
});
