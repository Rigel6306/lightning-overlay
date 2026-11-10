import type { BuildContext, Cloud, Pulse, Strike } from "../types";
import { makeCloud } from "./clouds";

/** Bolt hidden inside the clouds: only the sky lights up, irregularly. */
export const buildSheet = ({ rng, w, h, now, opts }: BuildContext): Strike => {
  const c = opts.sheet;
  const cx = rng.range(0.1, 0.9) * w;
  const cy = h * rng.range(0.03, 0.35);

  const pulses: Pulse[] = [];
  let t = 0;
  const n = rng.int(c.pulses[0], c.pulses[1]);
  for (let i = 0; i < n; i++) {
    pulses.push({
      at: t,
      amp: rng.range(c.amp[0], c.amp[1]) * (i === 0 ? 1.15 : 1),
      decay: rng.range(c.decayMs[0], c.decayMs[1]),
    });
    t += rng.range(c.gapMs[0], c.gapMs[1]);
  }

  const R = Math.max(w, h);
  const clouds: Cloud[] = Array.from({ length: c.clouds }, () =>
    makeCloud(rng, cx + rng.range(-0.35, 0.35) * w, cy + rng.range(-0.1, 0.15) * h, rng.range(0.2, 0.5) * R)
  );

  return {
    kind: "sheet",
    born: now,
    channels: [],
    pulses,
    clouds,
    cx,
    cy,
    spread: c.spread,
    end: null,
    impact: 0,
    rs: 0,
    lead: 0,
    afterglow: c.afterglow,
    attack: c.attackMs,
    front: false,
    ribbon: 0,
    duration: t + 500,
  };
};
