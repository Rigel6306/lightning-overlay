import type { Rng } from "./random";

/**
 * Midpoint displacement perpendicular to each segment -> natural kinks.
 * Returns interleaved `x, y` coordinates from `a` to `b` (inclusive).
 *
 * Segments stop splitting once shorter than `minLen` (must be > 0).
 */
export const jaggedPath = (
  rng: Rng,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  disp: number,
  minLen: number
): number[] => {
  const out: number[] = [];

  const split = (x0: number, y0: number, x1: number, y1: number, d: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < minLen) {
      out.push(x0, y0);
      return;
    }
    let o = rng.range(-d, d);
    if (rng.chance(0.12)) o *= 1.8; // the occasional sharp, angular kink
    const mx = (x0 + x1) / 2 + (-dy / len) * o;
    const my = (y0 + y1) / 2 + (dx / len) * o;
    split(x0, y0, mx, my, d * 0.55);
    split(mx, my, x1, y1, d * 0.55);
  };

  split(ax, ay, bx, by, disp);
  out.push(bx, by);
  return out;
};
