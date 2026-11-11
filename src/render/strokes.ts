import type { Channel } from "../types/types";
import type { Rng } from "../helpers/random";

/* -------------------------------------------------------------------------- */
/*  Reusable buffers (no per-frame allocation)                                */
/* -------------------------------------------------------------------------- */

/** Scratch space for the jittered, partially-grown copy of a channel. */
export interface Scratch {
  pts: Float32Array;
}

export const createScratch = (): Scratch => ({ pts: new Float32Array(2048) });

/** A flat list of stroke jobs: width / style / x-offset, reused every paint. */
export interface JobBuffer {
  n: number;
  width: number[];
  style: string[];
  dx: number[];
}

export const createJobBuffer = (): JobBuffer => ({ n: 0, width: [], style: [], dx: [] });

export const pushJob = (jobs: JobBuffer, width: number, style: string, dx = 0): void => {
  jobs.width[jobs.n] = width;
  jobs.style[jobs.n] = style;
  jobs.dx[jobs.n] = dx;
  jobs.n++;
};

/* -------------------------------------------------------------------------- */
/*  Channel sampling                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Copy the part of `ch` the leader has reached (`p` = 0..1 of its length)
 * into `out`, adding per-frame crackle jitter. The last point is interpolated
 * so the tip grows smoothly. Returns the number of points written.
 */
export const sampleVisible = (
  ch: Channel,
  p: number,
  jitter: number,
  fx: Rng,
  out: Scratch
): number => {
  if (out.pts.length < ch.n * 2) out.pts = new Float32Array(ch.n * 2 * 2);
  const o = out.pts;
  const pts = ch.pts;
  const cum = ch.cum;
  const target = ch.total * p;
  let count = 0;

  for (let i = 0; i < ch.n; i++) {
    const c = cum[i]!;
    const x = pts[2 * i]!;
    const y = pts[2 * i + 1]!;
    if (c <= target) {
      if (i === 0) {
        o[0] = x;
        o[1] = y;
      } else {
        o[2 * i] = x + fx.range(-jitter, jitter);
        o[2 * i + 1] = y + fx.range(-jitter, jitter);
      }
      count++;
    } else {
      const px = pts[2 * i - 2]!;
      const py = pts[2 * i - 1]!;
      const f = (target - cum[i - 1]!) / (c - cum[i - 1]! || 1);
      o[2 * i] = px + (x - px) * f;
      o[2 * i + 1] = py + (y - py) * f;
      count++;
      break;
    }
  }
  return count;
};

/* -------------------------------------------------------------------------- */
/*  Stroking                                                                  */
/* -------------------------------------------------------------------------- */

const trace = (
  ctx: CanvasRenderingContext2D,
  pts: Float32Array,
  from: number,
  to: number,
  dx: number
) => {
  ctx.beginPath();
  ctx.moveTo(pts[2 * from]! + dx, pts[2 * from + 1]!);
  for (let k = from + 1; k <= to; k++) ctx.lineTo(pts[2 * k]! + dx, pts[2 * k + 1]!);
};

/**
 * Stroke points `from..to` with every job, in chunks so the width tapers
 * toward the tip.
 *
 * Optimisation: the path of each chunk is built **once** and stroked for each
 * job (the original rebuilt the whole path for every pass). Drawing order is
 * irrelevant because the canvas composites with `lighter` (additive).
 */
export const strokeJobs = (
  ctx: CanvasRenderingContext2D,
  pts: Float32Array,
  from: number,
  to: number,
  taper: number,
  jobs: JobBuffer,
  chunk: number
): void => {
  const last = to - from;
  if (last < 1 || jobs.n === 0) return;

  for (let i = 0; i < last; i += chunk) {
    const end = Math.min(i + chunk, last);
    const k = 1 - taper * (i / last);
    let dx = Number.NaN;
    for (let j = 0; j < jobs.n; j++) {
      const jdx = jobs.dx[j]!;
      if (jdx !== dx) {
        trace(ctx, pts, from + i, from + end, jdx);
        dx = jdx;
      }
      ctx.lineWidth = Math.max(0.5, jobs.width[j]! * k);
      ctx.strokeStyle = jobs.style[j]!;
      ctx.stroke();
    }
  }
};

/** Draw a sprite centred on `(x, y)` with radius `r`. Alpha must already be set. */
export const stamp = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  r: number
): void => {
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
};
