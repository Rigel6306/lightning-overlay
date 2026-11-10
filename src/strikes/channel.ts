import type { Channel } from "../types";

export type ChannelMeta = Omit<Channel, "pts" | "cum" | "n" | "total">;

/**
 * Pack an interleaved coordinate list into typed arrays and pre-compute the
 * cumulative length at every point (used for leader growth and stamping).
 */
export const makeChannel = (coords: number[], meta: ChannelMeta): Channel => {
  const n = coords.length >> 1;
  const pts = Float32Array.from(coords);
  const cum = new Float32Array(n);
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += Math.hypot(pts[2 * i]! - pts[2 * i - 2]!, pts[2 * i + 1]! - pts[2 * i - 1]!);
    cum[i] = total;
  }
  return { pts, cum, n, total, ...meta };
};
