export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
