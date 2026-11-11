/**
 * Offline render harness (bundled by scripts/render-gifs.mjs, runs in a page).
 *
 * Drives the real `LightningEngine` in manual mode with a seeded RNG and a
 * fake clock, composites the two canvases over a night-sky backdrop exactly
 * like the browser does (bolt layer: normal blend, glow layer: `screen`), and
 * hands each frame back to Node as a PNG data URL.
 */
import { LightningEngine } from "../engine/LightningEngine";
import { createRng } from "../helpers/random";
import type { LightningOptions, StrikeKind } from "../types/types";

export interface Segment {
  options?: LightningOptions;
  caption?: string;
  /** Strikes to fire, `at` ms from the segment start. */
  fires: { at: number; kind: StrikeKind }[];
  /** Quiet time (ms) rendered after the last strike finishes. */
  tailMs: number;
}

export interface SceneSpec {
  name: string;
  w: number;
  h: number;
  fps: number;
  segments: Segment[];
}

declare global {
  interface Window {
    saveFrame: (scene: string, index: number, dataUrl: string) => Promise<void>;
    renderScene: (spec: SceneSpec) => Promise<number>;
  }
}

/** A deterministic stormy backdrop: gradient sky, soft cloud banks, dark hills. */
const makeBackground = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const rng = createRng(1234);

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#04060d");
  sky.addColorStop(0.55, "#0a0f20");
  sky.addColorStop(1, "#141a2e");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < 46; i++) {
    const x = rng.range(-0.1, 1.1) * w;
    const y = rng.range(0, 0.42) * h;
    const r = rng.range(0.1, 0.28) * w;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const l = rng.range(0.5, 1);
    grad.addColorStop(0, `rgba(34,42,72,${(0.5 * l).toFixed(3)})`);
    grad.addColorStop(1, "rgba(34,42,72,0)");
    g.fillStyle = grad;
    g.save();
    g.translate(x, y);
    g.scale(1, 0.45);
    g.translate(-x, -y);
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }

  // distant hills
  g.fillStyle = "#03050a";
  g.beginPath();
  g.moveTo(0, h);
  let hy = h * 0.9;
  for (let x = 0; x <= w; x += 16) {
    hy += rng.range(-5, 5);
    hy = Math.max(h * 0.86, Math.min(h * 0.95, hy));
    g.lineTo(x, hy);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  return c;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>) => {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  return e;
};

window.renderScene = async (spec) => {
  const { w, h } = spec;
  const stage = el("div", { position: "relative", width: `${w}px`, height: `${h}px` });
  const bolt = el("canvas", { position: "absolute", inset: "0", width: "100%", height: "100%" });
  const glow = el("canvas", { position: "absolute", inset: "0", width: "100%", height: "100%" });
  stage.append(bolt, glow);
  document.body.append(stage);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")!;
  const bg = makeBackground(w, h);

  let index = 0;
  const dt = 1000 / spec.fps;

  for (const seg of spec.segments) {
    const engine = new LightningEngine({
      bolt,
      glow,
      visibility: 1,
      manual: true,
      options: { maxDpr: 1, quality: "high", ...seg.options },
    });

    const fires = [...seg.fires].sort((a, b) => a.at - b.at);
    let next = 0;
    let idleFor = 0;

    for (let t = 0; ; t += dt) {
      while (next < fires.length && fires[next]!.at <= t) {
        engine.fire(fires[next]!.kind, fires[next]!.at);
        next++;
      }
      engine.render(t);

      o.globalCompositeOperation = "source-over";
      o.drawImage(bg, 0, 0);
      o.drawImage(bolt, 0, 0, w, h);
      o.globalCompositeOperation = "screen";
      o.drawImage(glow, 0, 0, w, h);
      o.globalCompositeOperation = "source-over";

      if (seg.caption) {
        o.font = "600 14px ui-monospace, SFMono-Regular, Menlo, monospace";
        o.fillStyle = "rgba(190,205,255,0.78)";
        o.fillText(seg.caption, 16, h - 14);
      }

      await window.saveFrame(spec.name, index++, out.toDataURL("image/png"));

      if (next >= fires.length && !engine.isActive) {
        idleFor += dt;
        if (idleFor >= seg.tailMs) break;
      }
    }
    engine.dispose();
  }

  stage.remove();
  return index;
};
