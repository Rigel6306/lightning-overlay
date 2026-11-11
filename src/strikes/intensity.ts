import type { Strike } from "../types/types";

/** Flash intensity of a strike `t` ms after it was born (0..1.4). */
export const intensityAt = (s: Strike, t: number): number => {
  if (t < s.rs) return s.lead; // faint leader
  let v = 0;
  const pulses = s.pulses;
  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i]!;
    const d = t - p.at;
    if (d >= 0) v += p.amp * Math.exp(-d / p.decay) * Math.min(1, d / s.attack + 0.15);
  }
  // continuing current / afterglow of the ionised channel
  v += s.afterglow * Math.exp(-(t - s.rs) / 280);
  return Math.min(1.4, v);
};
