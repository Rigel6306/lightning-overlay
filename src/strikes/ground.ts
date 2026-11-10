import type { BuildContext, Channel, Cloud, Pulse, Strike } from "../types";
import { jaggedPath } from "../helpers/geometry";
import { makeChannel } from "./channel";
import { makeCloud } from "./clouds";
import { spawnBranches } from "./branches";

/** Classic cloud-to-ground bolt. */
export const buildGround = ({ rng, w, h, now, opts }: BuildContext): Strike => {
  const c = opts.ground;
  const lead = rng.range(c.leaderMs[0], c.leaderMs[1]);
  const rs = lead + c.returnDelayMs;
  const x0 = rng.range(0.12, 0.88) * w;
  const y0 = -20;
  const x1 = x0 + rng.range(-0.16, 0.16) * w;
  const y1 = h * rng.range(c.endY[0], c.endY[1]);
  const mainLen = Math.hypot(x1 - x0, y1 - y0);

  const main = makeChannel(jaggedPath(rng, x0, y0, x1, y1, mainLen * 0.15, 6), {
    width: 1,
    depth: 0,
    t0: 0,
    dur: lead,
    gain: 1,
    rootFrac: 0,
    taper: 0.5,
  });
  const channels: Channel[] = [main];
  spawnBranches(rng, channels, main, 1, c.branch, opts.branching, h, rs);

  // One big return stroke, then weaker dart-leader restrikes (the "flicker").
  const pulses: Pulse[] = [{ at: rs, amp: 1, decay: c.returnDecayMs }];
  let t = rs + rng.range(60, 110);
  const restrikes = rng.int(c.restrikes[0], c.restrikes[1]);
  for (let i = 0; i < restrikes; i++) {
    pulses.push({
      at: t,
      amp: rng.range(c.restrikeAmp[0], c.restrikeAmp[1]),
      decay: rng.range(c.restrikeDecayMs[0], c.restrikeDecayMs[1]),
    });
    t += rng.range(c.restrikeGapMs[0], c.restrikeGapMs[1]);
  }

  const R = Math.max(w, h);
  const clouds: Cloud[] = Array.from({ length: c.clouds }, () =>
    makeCloud(rng, x0 + rng.range(-0.25, 0.25) * w, rng.range(0, 0.25) * h, rng.range(0.18, 0.4) * R)
  );

  return {
    kind: "ground",
    born: now,
    channels,
    pulses,
    clouds,
    cx: x0,
    cy: h * 0.08,
    spread: c.spread,
    end: [x1, y1],
    impact: c.impact,
    rs,
    lead: c.leaderGlow,
    afterglow: c.afterglow,
    attack: c.attackMs,
    front: true,
    ribbon: rng.sign() * rng.range(2, 6) * opts.wind,
    duration: t + 450,
  };
};
