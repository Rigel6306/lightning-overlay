import type { VisibilityInput } from "../types/types";

/** Normalise a number / getter / `{ get() }` into a plain getter. */
export const toVisibilityGetter = (input: VisibilityInput | undefined): (() => number) => {
  if (input === undefined) return () => 1;
  if (typeof input === "number") return () => input;
  if (typeof input === "function") return input;
  return () => input.get();
};
