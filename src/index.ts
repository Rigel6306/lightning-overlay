/**
 * Lightning – procedural storm for hero sections.
 *
 *   import Lightning from "@/components/lightning";
 *   <Lightning visibility={scrollProgress} palette="violet" />
 */
export { default, default as Lightning } from "./Lightning";
export type { LightningProps, LightningHandle } from "./Lightning";

// Framework-free core (usable without React)
export { LightningEngine } from "./engine/LightningEngine";
export type { EngineInit } from "./engine/LightningEngine";

// Config
export { DEFAULT_OPTIONS, DEFAULT_PALETTE, QUALITY_PROFILES } from "./config/defaults";
export { PALETTES } from "./config/palettes";
export { resolveOptions, resolvePalette } from "./config/resolve";

// Types
export { STRIKE_KINDS } from "./types/types";
export type {
  BranchConfig,
  ColorInput,
  CoreOptions,
  CrawlerConfig,
  DeepPartial,
  DistanceProfile,
  GroundConfig,
  LightningOptions,
  PaletteInput,
  PaletteKey,
  PaletteName,
  Quality,
  QualityProfile,
  Range,
  RenderConfig,
  ResolvedOptions,
  RGB,
  SheetConfig,
  SoundConfig,
  StrikeInfo,
  StrikeKind,
  StrokePass,
  VisibilityInput,
} from "./types/types";
