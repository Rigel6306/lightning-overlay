import type { Strike } from "../types";
import { clamp01 } from "../helpers/math";
import { withAlpha } from "../helpers/color";
import type { RenderEnv } from "./env";
import { ALPHA_HEADROOM } from "./sprites";

/** Draw the sky / cloud illumination for one strike onto the glow canvas. */
export const drawFlash = (
  ctx: CanvasRenderingContext2D,
  s: Strike,
  I: number,
  t: number,
  env: RenderEnv
): void => {
  if (t < s.rs - 40) return;
  const { opts, sprites, w, h } = env;
  const { palette } = opts;
  const R = Math.max(w, h);
  const sheet = s.kind === "sheet";
  const F = I * opts.flash;
  if (F <= 0.001) return;

  // Ambient wash.
  ctx.globalAlpha = 1;
  ctx.fillStyle = withAlpha(palette.prefix.flash, (sheet ? 0.05 : 0.07) * F);
  ctx.fillRect(0, 0, w, h);

  // Big sky bloom around the (possibly hidden) discharge.
  const rad = R * s.spread;
  ctx.globalAlpha = clamp01(F / ALPHA_HEADROOM);
  ctx.drawImage(sprites.sky(palette), s.cx - rad, s.cy - rad, rad * 2, rad * 2);

  // Hidden discharge: a tight hot spot glowing through the cloud deck.
  if (sheet) {
    const r2 = R * 0.14;
    ctx.drawImage(sprites.hot(palette), s.cx - r2, s.cy - r2, r2 * 2, r2 * 2);
  }

  // Clouds lit from inside, each flickering on its own phase (squashed to 55 %).
  const cloud = sprites.cloud(palette);
  for (let i = 0; i < s.clouds.length; i++) {
    const c = s.clouds[i]!;
    const flick = 0.7 + 0.3 * (Math.sin(t * c.f + c.ph) * 0.5 + 0.5);
    ctx.globalAlpha = clamp01(0.45 * F * c.k * flick);
    ctx.drawImage(cloud, c.x - c.r, c.y - c.r * 0.55, c.r * 2, c.r * 1.1);
  }
  ctx.globalAlpha = 1;
};
