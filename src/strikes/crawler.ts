import type { BuildContext, Channel, Cloud, Point, Pulse, Strike } from "../types/types";
import { jaggedPath } from "../helpers/geometry";
import { makeChannel } from "./channel";
import { makeCloud } from "./clouds";
import { spawnBranches } from "./branches";

/** Horizontal cloud-to-cloud / intra-cloud discharge. */
export const buildCrawler = ({ rng, w, h, now, opts }: BuildContext): Strike => {
  const c = opts.crawler;
  const lead = rng.range(c.leaderMs[0], c.leaderMs[1]);
  const rs = lead + c.returnDelayMs;
  const dir = rng.sign();
  const x0 = rng.range(0.15, 0.85) * w;
  const y0 = h * rng.range(0.04, 0.3);

  const lenA = w * rng.range(0.25, 0.6);
  const lenB = w * rng.range(0.08, 0.3);
  const clampX = (x: number) => Math.max(-30, Math.min(w + 30, x));
  const ax = clampX(x0 + dir * lenA);
  const ay = y0 + h * rng.range(-0.04, 0.1);
  const bx = clampX(x0 - dir * lenB);
  const by = y0 + h * rng.range(-0.05, 0.06);

  // Intra-cloud leaders grow in both directions from the initiation point.
  const A = makeChannel(jaggedPath(rng, x0, y0, ax, ay, lenA * 0.1, 6), {
    width: 1,
    depth: 0,
    t0: 0,
    dur: lead,
    gain: 1,
    rootFrac: 0,
    taper: 0.45,
  });
  const B = makeChannel(jaggedPath(rng, x0, y0, bx, by, lenB * 0.12, 5), {
    width: 0.85,
    depth: 0,
    t0: 0,
    dur: lead * rng.range(0.5, 0.9),
    gain: 0.9,
    rootFrac: 0,
    taper: 0.45,
  });
  const channels: Channel[] = [A, B];
  spawnBranches(rng, channels, A, 1, c.branch, opts.branching, h, rs);
  spawnBranches(rng, channels, B, 1, c.branch, opts.branching, h, rs);

  // Sometimes the discharge drops a long leg out of the cloud base.
  let end: Point | null = null;
  if (rng.chance(c.dropChance)) {
    const i = Math.floor(A.n * rng.range(0.3, 0.8));
    const fx = A.pts[2 * i]!;
    const fy = A.pts[2 * i + 1]!;
    const frac = A.cum[i]! / A.total;
    const tx = fx + rng.range(-0.08, 0.08) * w;
    const ty = h * rng.range(0.4, 0.75);
    const len = Math.hypot(tx - fx, ty - fy);
    const t0 = A.t0 + frac * A.dur;
    const leg = makeChannel(jaggedPath(rng, fx, fy, tx, ty, len * 0.15, 6), {
      width: 0.8,
      depth: 1,
      t0,
      dur: Math.max(30, Math.min(rng.range(60, 100), rs - t0)),
      gain: 0.9,
      rootFrac: frac,
      taper: 0.6,
    });
    channels.push(leg);
    spawnBranches(rng, channels, leg, 2, opts.ground.branch, opts.branching, h, rs);
    end = [tx, ty];
  }

  // Intra-cloud flashes shimmer: a run of softer, closely spaced pulses.
  const pulses: Pulse[] = [{ at: rs, amp: 0.85, decay: 55 }];
  let t = rs + rng.range(35, 90);
  const flickers = rng.int(c.flickers[0], c.flickers[1]);
  for (let i = 0; i < flickers; i++) {
    pulses.push({
      at: t,
      amp: rng.range(c.flickerAmp[0], c.flickerAmp[1]),
      decay: rng.range(30, 70),
    });
    t += rng.range(c.flickerGapMs[0], c.flickerGapMs[1]);
  }

  const lo = Math.min(x0, bx, ax);
  const hi = Math.max(x0, bx, ax);
  const R = Math.max(w, h);
  const clouds: Cloud[] = Array.from({ length: c.clouds }, () =>
    makeCloud(rng, rng.range(lo, hi), y0 + rng.range(-0.05, 0.1) * h, rng.range(0.14, 0.32) * R)
  );

  return {
    kind: "crawler",
    born: now,
    channels,
    pulses,
    clouds,
    cx: (lo + hi) / 2,
    cy: y0,
    spread: c.spread,
    end,
    impact: c.impact,
    rs,
    lead: c.leaderGlow,
    afterglow: c.afterglow,
    attack: c.attackMs,
    front: false,
    ribbon: 0,
    duration: t + 450,
  };
};
