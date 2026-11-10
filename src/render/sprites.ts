import type { ResolvedPalette } from "../types";
import { withAlpha } from "../helpers/color";

type Stop = readonly [offset: number, color: string];

/**
 * Pre-rendered radial gradients.
 *
 * The original code called `createRadialGradient` several times per frame per
 * strike (sky bloom, hot spot, six clouds) and filled the whole canvas with
 * it. Baking each gradient once into a small canvas and `drawImage`-ing it
 * (scaled, with `globalAlpha`) is far cheaper and allocation-free.
 *
 * Sky / hot / cloud sprites are baked at 1.5x alpha so that intensities above
 * 1.0 (the flash peaks at ~1.5) still reproduce exactly: draw with
 * `globalAlpha = I / ALPHA_HEADROOM`.
 */
export const ALPHA_HEADROOM = 1.5;

export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();

  /** Soft halo stamped along channels. */
  halo(p: ResolvedPalette): HTMLCanvasElement {
    const o = p.prefix.outer;
    return this.get(`halo|${p.rgb.outer}`, 128, [
      [0, "rgba(255,255,255,0.6)"],
      [0.15, withAlpha(o, 0.5)],
      [0.5, withAlpha(o, 0.13)],
      [1, withAlpha(o, 0)],
    ]);
  }

  /** Large sky bloom around the (possibly hidden) discharge. */
  sky(p: ResolvedPalette): HTMLCanvasElement {
    const f = p.prefix.flash;
    const c = p.prefix.cloud;
    const k = ALPHA_HEADROOM;
    return this.get(`sky|${p.rgb.flash}|${p.rgb.cloud}`, 256, [
      [0, "rgba(235,242,255," + (0.5 * k).toFixed(3) + ")"],
      [0.25, withAlpha(f, 0.26 * k)],
      [0.6, withAlpha(c, 0.09 * k)],
      [1, withAlpha(c, 0)],
    ]);
  }

  /** Tight hot spot glowing through the cloud deck (sheet lightning). */
  hot(p: ResolvedPalette): HTMLCanvasElement {
    const k = ALPHA_HEADROOM;
    return this.get(`hot|${p.rgb.inner}|${p.rgb.flash}`, 128, [
      [0, withAlpha(p.prefix.inner, 0.38 * k)],
      [0.5, withAlpha(p.prefix.flash, 0.14 * k)],
      [1, withAlpha(p.prefix.flash, 0)],
    ]);
  }

  /** A cloud lit from inside. Drawn squashed (ellipse) by the caller. */
  cloud(p: ResolvedPalette): HTMLCanvasElement {
    return this.get(`cloud|${p.rgb.inner}|${p.rgb.cloud}`, 128, [
      [0, withAlpha(p.prefix.inner, 0.9)],
      [0.4, withAlpha(p.prefix.cloud, 0.5)],
      [1, withAlpha(p.prefix.cloud, 0)],
    ]);
  }

  clear(): void {
    this.cache.clear();
  }

  private get(key: string, size: number, stops: readonly Stop[]): HTMLCanvasElement {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d")!;
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    for (const [offset, color] of stops) grad.addColorStop(offset, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.cache.set(key, canvas);
    return canvas;
  }
}
