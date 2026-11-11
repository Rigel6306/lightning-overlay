import type { Channel, Strike } from "../types/types";
import { clamp, clamp01 } from "../helpers/math";
import { withAlpha } from "../helpers/color";
import type { RenderEnv } from "./env";
import { pushJob, sampleVisible, stamp, strokeJobs } from "./strokes";

/** Base spacing (px) between halo stamps, for the main channel / for limbs. */
const SPACING_MAIN = 22;
const SPACING_LIMB = 32;

/**
 * Draw one strike's channels (halo, chromatic fringe, layered core, ribbon
 * ghost, leader tip, ground attachment glow) onto the bolt canvas.
 *
 * @param I current flash intensity
 * @param L intensity of the faint pre-stroke leader glow
 * @param t ms since the strike was born
 */
export const drawBolt = (
  ctx: CanvasRenderingContext2D,
  s: Strike,
  I: number,
  L: number,
  t: number,
  env: RenderEnv
): void => {
  const { opts, profile, sprites, scratch, jobs, fx } = env;
  const { palette, render } = opts;
  const halo = sprites.halo(palette);
  const passes = render.passes;
  const buf = scratch;

  const post = t - s.rs;
  // Ground strokes: the return stroke races UP the channel from the ground.
  // Intra-cloud strokes light nearly everything at once.
  const lf = s.front ? clamp01(post / render.frontMs) : clamp01(post / 14);
  const Ic = Math.min(I, 1);
  const widthScale = (0.7 + 0.5 * Ic) * opts.thickness;
  const jitter = 0.4 + Math.min(I, 1.2) * 1.1; // crackle

  // Ribboning: successive strokes drift sideways in the wind.
  let k = -1;
  for (let i = 0; i < s.pulses.length; i++) if (t >= s.pulses[i]!.at) k++;
  const ribbonOff = k > 0 ? clamp(s.ribbon * k, -14, 14) : 0;

  const mainBloom = (s.kind === "ground" ? 1 : 0.733) * render.bloomRadius;
  const limbBloom = 0.467 * render.bloomRadius;
  const bloomAlpha = 0.11 * opts.glow * profile.bloomSpacing; // spacing-compensated
  const allowFringe = opts.fringe && profile.fringe;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /** Paint points `from..to` of the sampled channel at the given strength. */
  const paint = (ch: Channel, from: number, to: number, strength: number, wScale: number) => {
    if (to - from < 1 || strength <= 0.002) return;
    const pts = buf.pts;
    const isMain = ch.depth === 0;

    // Bloom stamps along the channel, spaced by arc length.
    if (bloomAlpha > 0) {
      const r = (isMain ? mainBloom : limbBloom) * (0.6 + 0.5 * Ic);
      const spacing = (isMain ? SPACING_MAIN : SPACING_LIMB) * profile.bloomSpacing;
      ctx.globalAlpha = clamp01(bloomAlpha * strength);
      let next = ch.cum[from]!;
      for (let i = from; i <= to; i++) {
        const c = ch.cum[i]!;
        if (c >= next) {
          stamp(ctx, halo, pts[2 * i]!, pts[2 * i + 1]!, r);
          next = c + spacing;
        }
      }
    }
    ctx.globalAlpha = 1;

    jobs.n = 0;
    // Subtle chromatic fringe on the main channel (lens dispersion).
    if (isMain && allowFringe && strength > 0.35) {
      pushJob(jobs, 11 * wScale, withAlpha(opts.fringePrefix[0], 0.05 * strength), 1.8);
      pushJob(jobs, 11 * wScale, withAlpha(opts.fringePrefix[1], 0.07 * strength), -1.8);
    }
    // Layered core.
    for (let i = profile.skipPasses; i < passes.length; i++) {
      const pass = passes[i]!;
      const a = pass.alpha * strength;
      if (a < 0.004) continue;
      pushJob(jobs, pass.width * wScale, withAlpha(palette.prefix[pass.color], a));
    }
    strokeJobs(ctx, pts, from, to, ch.taper, jobs, profile.chunk);
  };

  for (let ci = 0; ci < s.channels.length; ci++) {
    const ch = s.channels[ci]!;
    const p = clamp01((t - ch.t0) / ch.dur);
    if (p <= 0) continue;

    const count = sampleVisible(ch, p, jitter, fx, buf);
    if (count < 2) continue;

    const wScale = widthScale * ch.width;
    // Side limbs fade much faster than the main channel.
    const fade =
      ch.depth === 0 || post < 0 ? 1 : 0.3 + 0.7 * Math.exp(-post / (190 / ch.depth));
    const gain = ch.gain * fade;

    // How "lit" this limb is by the return stroke (0 = leader glow only).
    const lit =
      ch.depth === 0 || !s.front ? lf : clamp01((lf - (1 - ch.rootFrac)) * 6);

    if (ch.depth === 0 && s.front && lf > 0 && lf < 1 && p >= 1) {
      // Front is mid-climb: bright below it, faint leader glow above it.
      const target = ch.total * (1 - lf);
      let idx = 1;
      while (idx < ch.n - 1 && ch.cum[idx]! < target) idx++;
      paint(ch, 0, idx, L * gain, wScale);
      paint(ch, idx - 1, count - 1, I * gain, wScale);
    } else {
      paint(ch, 0, count - 1, (L * (1 - lit) + I * lit) * gain, wScale);
    }

    // Ribbon ghost of the main channel on restrikes.
    if (ch.depth === 0 && ribbonOff !== 0 && lit >= 1) {
      jobs.n = 0;
      for (let i = Math.max(2, profile.skipPasses); i < passes.length; i++) {
        const pass = passes[i]!;
        const a = pass.alpha * I * gain * 0.4;
        if (a < 0.004) continue;
        pushJob(jobs, pass.width * wScale, withAlpha(palette.prefix[pass.color], a), ribbonOff);
      }
      strokeJobs(ctx, buf.pts, 0, count - 1, ch.taper, jobs, profile.chunk);
    }

    // Hot leader tip while still travelling.
    if (p < 1) {
      const hx = buf.pts[2 * (count - 1)]!;
      const hy = buf.pts[2 * (count - 1) + 1]!;
      ctx.globalAlpha = clamp01(
        (ch.depth === 0 ? 0.9 : 0.5) * (0.6 + 0.4 * fx.next())
      );
      stamp(ctx, halo, hx, hy, ch.depth === 0 ? 40 : 18);
      ctx.globalAlpha = 1;
    }
  }

  // Attachment glow where the channel meets the ground.
  if (s.end && t >= s.rs) {
    const [ex, ey] = s.end;
    ctx.globalAlpha = clamp01(0.7 * I * s.impact * opts.glow);
    stamp(ctx, halo, ex, ey, 260 * s.impact * (0.5 + 0.5 * Ic));
    ctx.globalAlpha = clamp01(0.9 * I * s.impact * opts.glow);
    stamp(ctx, halo, ex, ey, 80 * s.impact);
  }
  ctx.globalAlpha = 1;
};
