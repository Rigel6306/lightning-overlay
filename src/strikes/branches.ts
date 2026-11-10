import type { BranchConfig, Channel } from "../types";
import type { Rng } from "../helpers/random";
import { jaggedPath } from "../helpers/geometry";
import { makeChannel } from "./channel";

/**
 * Recursively fork limbs off a channel. Branches inherit timing from the
 * parent so they appear as the leader passes their root.
 *
 * @param depth     1 = branch, 2 = sub-branch
 * @param scale     global branching multiplier (chance and count)
 * @param h         container height (limb length is a fraction of it)
 * @param rs        ms at which the return stroke lands
 */
export const spawnBranches = (
  rng: Rng,
  out: Channel[],
  parent: Channel,
  depth: number,
  cfg: BranchConfig,
  scale: number,
  h: number,
  rs: number
): void => {
  if (scale <= 0) return;
  const chance = (depth === 1 ? cfg.c1 : cfg.c2) * scale;
  const maxBranches = Math.round((depth === 1 ? cfg.m1 : cfg.m2) * scale);
  const pts = parent.pts;
  let count = 0;

  for (let i = 5; i < parent.n - 5 && count < maxBranches; i++) {
    const frac = parent.cum[i]! / parent.total;
    const p = chance * (cfg.low ? 0.5 + frac : 1);
    if (rng.next() > p) continue;

    const fx = pts[2 * i]!;
    const fy = pts[2 * i + 1]!;
    const heading = Math.atan2(
      pts[2 * i + 2]! - pts[2 * i - 2]!,
      pts[2 * i + 3]! - pts[2 * i - 1]!
    ); // angle from "down"
    const hangs = rng.chance(cfg.drop);
    const theta = hangs
      ? rng.range(-0.35, 0.35)
      : heading + rng.sign() * rng.range(cfg.angle[0], cfg.angle[1]);
    const len = (h * rng.range(cfg.len[0], cfg.len[1])) / depth;
    const up = !hangs && rng.chance(cfg.up) ? -1 : 1;
    const tx = fx + Math.sin(theta) * len;
    const ty = fy + up * Math.abs(Math.cos(theta)) * len;

    const t0 = parent.t0 + frac * parent.dur;
    const dur = Math.max(24, Math.min(35 + len * 0.12, rs - t0));
    const branch = makeChannel(jaggedPath(rng, fx, fy, tx, ty, len * 0.22, 5), {
      width: depth === 1 ? 0.55 : 0.32,
      depth,
      t0,
      dur,
      gain: depth === 1 ? 0.8 : 0.6,
      rootFrac: depth === 1 ? frac : parent.rootFrac,
      taper: 0.85, // limbs thin out to hair-fine tips
    });
    out.push(branch);
    count++;
    if (depth < 2) spawnBranches(rng, out, branch, depth + 1, cfg, scale, h, rs);
  }
};
