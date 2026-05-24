export type NearMissMode = "cruise";

export const NEAR_MISS_MODE_CONFIG = {
  defaultMode: "cruise" satisfies NearMissMode
} as const;

// TODO: Add future modes: two-way, wrong-way, challenge, daily run.
