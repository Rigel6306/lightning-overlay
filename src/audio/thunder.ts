import type { SoundConfig, StrikeKind } from "../types/types";
import { clamp01 } from "../helpers/math";
import type { Rng } from "../helpers/random";

export interface Thunder {
  /** Schedule thunder for a strike of `kind`; `vis` is the current visibility. */
  play(kind: StrikeKind, vis: number): void;
  /** Call after options changed (starts fetching sounds that just became audible). */
  sync(): void;
  dispose(): void;
}

const GESTURES = ["pointerdown", "pointerup", "keydown", "touchend", "click"] as const;

type ActivationNavigator = Navigator & { userActivation?: { hasBeenActive: boolean } };

/**
 * Procedural thunder player on top of the Web Audio API.
 *
 * - The `AudioContext` is created lazily, after the first user gesture (or
 *   immediately if the browser says the page was already activated). That
 *   avoids the "AudioContext was not allowed to start" console warning and
 *   costs nothing for muted / silent setups.
 * - Sounds are fetched + decoded on demand and cached; a missing file is
 *   remembered and never re-requested.
 * - Strikes before audio is unlocked stay silent (never queued) instead of all
 *   firing at once later.
 *
 * Returns `null` where Web Audio isn't available (SSR, old browsers).
 */
export const createThunder = (getSound: () => SoundConfig, rng: Rng): Thunder | null => {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let comp: DynamicsCompressorNode | null = null;
  let active = 0;
  let disposed = false;
  let listening = false;

  const buffers = new Map<string, AudioBuffer>();
  const pending = new Set<string>();
  const failed = new Set<string>();

  const audible = () => {
    const s = getSound();
    return !s.muted && s.volume > 0;
  };

  const load = async (url: string) => {
    if (!ctx || buffers.has(url) || pending.has(url) || failed.has(url)) return;
    pending.add(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      if (!disposed) buffers.set(url, buf);
    } catch {
      failed.add(url); // missing file / decode error: that sound is skipped
    } finally {
      pending.delete(url);
    }
  };

  const prefetch = () => {
    if (!ctx || !audible()) return;
    const s = getSound();
    if (s.heavyUrl) void load(s.heavyUrl);
    s.lightUrls.forEach((u) => void load(u));
  };

  const unlock = () => {
    init();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  };

  const onState = () => {
    if (ctx?.state === "running") detach();
  };

  const attach = () => {
    if (listening) return;
    listening = true;
    GESTURES.forEach((g) => window.addEventListener(g, unlock, { passive: true }));
  };

  const detach = () => {
    if (!listening) return;
    listening = false;
    GESTURES.forEach((g) => window.removeEventListener(g, unlock));
  };

  function init() {
    if (ctx || disposed) return;
    ctx = new AC();
    // Master chain: boost -> compressor -> speakers. The compressor lets us
    // push the level up without clipping on the loud claps.
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(ctx.destination);
    ctx.addEventListener("statechange", onState);
    void ctx.resume().catch(() => {});
    prefetch();
  }

  const activated = () => (navigator as ActivationNavigator).userActivation?.hasBeenActive === true;

  const running = () => ctx?.state === "running";

  if (activated()) init();
  if (!running()) attach();

  const play: Thunder["play"] = (kind, vis) => {
    const s = getSound();
    if (disposed || s.muted || s.volume <= 0 || document.hidden || vis < s.minVisibility) return;

    if (!ctx || !master) {
      if (activated()) init(); // this strike is skipped; the next one plays
      return;
    }
    if (ctx.state !== "running") {
      void ctx.resume().catch(() => {});
      return;
    }
    if (active >= s.maxConcurrent) return;

    const cfg = s.distance[kind];
    const useHeavy = s.heavyUrl !== null && (s.lightUrls.length === 0 || rng.chance(cfg.heavy));
    const url = useHeavy ? s.heavyUrl : s.lightUrls.length ? rng.pick(s.lightUrls) : null;
    if (!url) return;
    const buf = buffers.get(url);
    if (!buf) {
      void load(url);
      return;
    }

    master.gain.value = s.boost;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rng.range(s.playbackRate[0], s.playbackRate[1]); // no two claps alike

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cfg.lowpass;

    const gain = ctx.createGain();
    const peak = clamp01(s.volume) * cfg.gain * rng.range(0.8, 1) * Math.min(1, vis);
    const at = ctx.currentTime + rng.range(cfg.delay[0], cfg.delay[1]) * s.delayScale;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.02);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(master);

    active++;
    src.onended = () => {
      active--;
      src.disconnect();
      lp.disconnect();
      gain.disconnect();
    };
    src.start(at);
  };

  const dispose = () => {
    disposed = true;
    detach();
    if (!ctx) return;
    ctx.removeEventListener("statechange", onState);
    master?.disconnect();
    comp?.disconnect();
    void ctx.close().catch(() => {});
    ctx = null;
  };

  return { play, sync: prefetch, dispose };
};
