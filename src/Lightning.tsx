"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import { LightningEngine } from "./engine/LightningEngine";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import type {
  LightningOptions,
  StrikeInfo,
  StrikeKind,
  VisibilityInput,
} from "./types/types";

export type LightningProps = LightningOptions & {
  /**
   * Master visibility, 0..1. Accepts a number, a getter, or a Motion
   * `MotionValue` (anything with `.get()`), so it can follow scroll without
   * re-rendering React. Default `1`.
   */
  visibility?: VisibilityInput;
  /** Shortcut for `sound.volume` (0..1). */
  volume?: number;
  /** Shortcut for `sound.muted`: silence thunder, keep the visuals. */
  muted?: boolean;
  /** Render nothing when the visitor prefers reduced motion. Default `true`. */
  respectReducedMotion?: boolean;
  /** Applied to both canvases. */
  className?: string;
  /** Merged over the default canvas styles (both canvases). */
  style?: CSSProperties;
  /** Stacking order of the channel canvas. Default `29`. */
  boltZIndex?: number;
  /** Stacking order of the sky-glow canvas. Default `31`. */
  glowZIndex?: number;
  /** Called every time a strike fires. */
  onStrike?: (info: StrikeInfo) => void;
};

/** Imperative handle, available through `ref`. */
export interface LightningHandle {
  /** Fire a strike now (random kind if omitted). */
  strike(kind?: StrikeKind): void;
  /** Stop scheduling new strikes. */
  pause(): void;
  /** Resume the automatic storm. */
  resume(): void;
  /** The underlying engine (null while reduced motion is active / unmounted). */
  readonly engine: LightningEngine | null;
}

const BASE_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

/**
 * Procedural lightning for a hero section: three kinds of strikes, thunder,
 * and a lot of knobs. Place it inside a `position: relative` container.
 *
 * Changing any prop never restarts the storm.
 */
const Lightning = forwardRef<LightningHandle, LightningProps>(function Lightning(props, ref) {
  const {
    visibility,
    volume,
    muted,
    respectReducedMotion = true,
    className,
    style,
    boltZIndex = 29,
    glowZIndex = 31,
    onStrike,
    ...options
  } = props;

  const reduced = usePrefersReducedMotion();
  const disabled = respectReducedMotion && reduced;

  const boltRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LightningEngine | null>(null);
  const onStrikeRef = useRef(onStrike);

  // Fold the volume / muted shortcuts into `sound`.
  const merged: LightningOptions =
    volume === undefined && muted === undefined
      ? options
      : {
          ...options,
          sound: {
            ...options.sound,
            ...(volume !== undefined && { volume }),
            ...(muted !== undefined && { muted }),
          },
        };

  // Create / destroy the engine only when the component mounts or reduced
  // motion toggles. Everything else is pushed in by the effects below.
  useEffect(() => {
    if (disabled) return;
    const bolt = boltRef.current;
    const glow = glowRef.current;
    if (!bolt || !glow) return;

    const engine = new LightningEngine({
      bolt,
      glow,
      visibility,
      options: merged,
      onStrike: (info) => onStrikeRef.current?.(info),
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    onStrikeRef.current = onStrike;
  });
  useEffect(() => {
    engineRef.current?.setVisibility(visibility);
  }, [visibility]);
  // Cheap: re-resolves options and rebuilds only what changed.
  useEffect(() => {
    engineRef.current?.setOptions(merged);
  });

  useImperativeHandle(
    ref,
    () => ({
      strike: (kind?: StrikeKind) => void engineRef.current?.fire(kind),
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      get engine() {
        return engineRef.current;
      },
    }),
    []
  );

  if (disabled) return null;

  return (
    <>
      {/* Bolt + bloom */}
      <canvas
        ref={boltRef}
        aria-hidden="true"
        className={className}
        style={{ ...BASE_STYLE, zIndex: boltZIndex, ...style }}
      />
      {/* Sky / cloud illumination */}
      <canvas
        ref={glowRef}
        aria-hidden="true"
        className={className}
        style={{ ...BASE_STYLE, zIndex: glowZIndex, mixBlendMode: "screen", ...style }}
      />
    </>
  );
});

export default Lightning;
