import type {
  ColorInput,
  CoreOptions,
  LightningOptions,
  PaletteInput,
  PaletteKey,
  ResolvedOptions,
  ResolvedPalette,
  RGB,
} from "../types/types";
import { parseColor, rgbaPrefix } from "../helpers/color";
import { DEFAULT_FRINGE, DEFAULT_OPTIONS, DEFAULT_PALETTE } from "./defaults";
import { PALETTES } from "./palettes";

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep merge where arrays (ranges, tuples, pass lists) are replaced whole. */
const deepMerge = (base: Record<string, unknown>, patch: Record<string, unknown>) => {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlain(value) && isPlain(current) ? deepMerge(current, value) : value;
  }
  return out;
};

const PALETTE_KEYS = Object.keys(DEFAULT_PALETTE) as PaletteKey[];

export const resolvePalette = (input?: PaletteInput): ResolvedPalette => {
  const preset = typeof input === "string" ? (PALETTES[input] ?? DEFAULT_PALETTE) : DEFAULT_PALETTE;
  const custom: Partial<Record<PaletteKey, ColorInput>> =
    typeof input === "object" && input !== null ? input : {};

  const rgb = {} as Record<PaletteKey, RGB>;
  const prefix = {} as Record<PaletteKey, string>;
  for (const k of PALETTE_KEYS) {
    const c = custom[k];
    rgb[k] = c === undefined ? preset[k] : parseColor(c, preset[k]);
    prefix[k] = rgbaPrefix(rgb[k]);
  }
  return { rgb, prefix, key: PALETTE_KEYS.map((k) => rgb[k].join(",")).join("|") };
};

const sortedRange = (r: readonly [number, number], min: number): readonly [number, number] => {
  const lo = Math.max(min, Math.min(r[0], r[1]));
  return [lo, Math.max(lo, r[0], r[1])];
};

/** Layer user options over the defaults and normalise colours / ranges. */
export const resolveOptions = (input?: LightningOptions): ResolvedOptions => {
  const { palette, fringeColors, ...rest } = input ?? {};
  const core = deepMerge(
    DEFAULT_OPTIONS as unknown as Record<string, unknown>,
    rest as Record<string, unknown>
  ) as unknown as CoreOptions;

  const fc = fringeColors ?? DEFAULT_FRINGE;
  const left = parseColor(fc[0], DEFAULT_FRINGE[0]);
  const right = parseColor(fc[1], DEFAULT_FRINGE[1]);

  return {
    ...core,
    interval: sortedRange(core.interval, 0.05),
    doubleStrikeDelay: sortedRange(core.doubleStrikeDelay, 0),
    palette: resolvePalette(palette),
    fringePrefix: [rgbaPrefix(left), rgbaPrefix(right)],
  };
};
