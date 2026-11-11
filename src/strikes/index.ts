import type { BuildContext, Strike, StrikeKind } from "../types/types";
import { STRIKE_KINDS } from "../types/types";
import type { Rng } from "../helpers/random";
import { buildGround } from "./ground";
import { buildCrawler } from "./crawler";
import { buildSheet } from "./sheet";

export { intensityAt } from "./intensity";

/** Weighted random pick. Falls back to `ground` if every weight is 0. */
export const pickKind = (rng: Rng, weights: Record<StrikeKind, number>): StrikeKind => {
  let total = 0;
  for (const k of STRIKE_KINDS) total += Math.max(0, weights[k]);
  if (total <= 0) return "ground";
  let r = rng.next() * total;
  for (const k of STRIKE_KINDS) {
    r -= Math.max(0, weights[k]);
    if (r < 0) return k;
  }
  return "ground";
};

export const buildStrike = (kind: StrikeKind, ctx: BuildContext): Strike =>
  kind === "ground" ? buildGround(ctx) : kind === "crawler" ? buildCrawler(ctx) : buildSheet(ctx);
