/** Small random toolkit so a storm can be seeded and replayed exactly. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [a, b). */
  range(a: number, b: number): number;
  /** Integer in [a, b) (i.e. `floor(range(a, b))`). */
  int(a: number, b: number): number;
  chance(p: number): boolean;
  sign(): 1 | -1;
  pick<T>(items: readonly T[]): T;
}

/** mulberry32 – tiny, fast, good enough for visuals. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createRng = (seed?: number | null): Rng => {
  const next = seed == null ? Math.random : mulberry32(seed);
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a)),
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
};
