import type { ColorInput, RGB } from "../types";
import { clamp01 } from "./math";

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/**
 * Accepts `[r, g, b]`, `#rgb`, `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)`.
 * Anything unparseable returns `fallback`.
 */
export const parseColor = (input: ColorInput, fallback: RGB): RGB => {
  if (typeof input !== "string") {
    return [byte(input[0]), byte(input[1]), byte(input[2])];
  }
  const s = input.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (fn) return [byte(+fn[1]!), byte(+fn[2]!), byte(+fn[3]!)];

  return fallback;
};

/** `"rgba(r,g,b,"` – cheap to precompute, then just append an alpha. */
export const rgbaPrefix = (c: RGB): string => `rgba(${c[0]},${c[1]},${c[2]},`;

/** Build a colour string from a precomputed prefix. Alpha is clamped to 0..1. */
export const withAlpha = (prefix: string, a: number): string =>
  `${prefix}${clamp01(a).toFixed(3)})`;
