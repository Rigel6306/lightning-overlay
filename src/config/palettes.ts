import type { PaletteKey, PaletteName, RGB } from "../types";
import { DEFAULT_PALETTE } from "./defaults";

type PaletteRGB = Record<PaletteKey, RGB>;

/** Ready-made colour schemes. Pass a name as `palette="ember"`. */
export const PALETTES: Record<PaletteName, PaletteRGB> = {
  /** The default pale blue-white storm. */
  storm: DEFAULT_PALETTE,
  violet: {
    outer: [150, 80, 255],
    mid: [190, 140, 255],
    inner: [235, 215, 255],
    core: [252, 248, 255],
    flash: [170, 110, 255],
    cloud: [140, 90, 230],
  },
  ember: {
    outer: [255, 110, 40],
    mid: [255, 160, 80],
    inner: [255, 222, 180],
    core: [255, 250, 240],
    flash: [255, 140, 70],
    cloud: [230, 100, 60],
  },
  toxic: {
    outer: [60, 230, 120],
    mid: [130, 255, 170],
    inner: [205, 255, 225],
    core: [245, 255, 250],
    flash: [90, 240, 150],
    cloud: [60, 200, 120],
  },
  mono: {
    outer: [180, 180, 190],
    mid: [210, 210, 220],
    inner: [235, 235, 240],
    core: [255, 255, 255],
    flash: [200, 205, 215],
    cloud: [160, 165, 180],
  },
};
