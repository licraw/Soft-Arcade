import type { LaneSystem } from "./types";

export const LANE_SYSTEM_TUNING = {
  minLanes: 3,
  maxLanes: 5,
  roadWidthRatio: 0.86,
  maxRoadWidth: 560
};

export function createLaneSystem(width: number, lanes = 4): LaneSystem {
  // Lane centers, lane width, and road bounds are the geometry source of truth.
  // Near Miss gameplay bodies are then sized from laneWidth in its tuning module.
  const clampedLanes = Math.max(LANE_SYSTEM_TUNING.minLanes, Math.min(LANE_SYSTEM_TUNING.maxLanes, Math.round(lanes)));
  const roadWidth = Math.min(width * LANE_SYSTEM_TUNING.roadWidthRatio, LANE_SYSTEM_TUNING.maxRoadWidth);
  const roadLeft = (width - roadWidth) / 2;
  const laneWidth = roadWidth / clampedLanes;
  const centers = Array.from({ length: clampedLanes }, (_, index) => roadLeft + laneWidth * (index + 0.5));

  return {
    lanes: clampedLanes,
    roadLeft,
    roadWidth,
    laneWidth,
    centers
  };
}

export function getLaneCenter(laneSystem: LaneSystem, lane: number) {
  const safeLane = Math.max(0, Math.min(laneSystem.lanes - 1, lane));

  return laneSystem.centers[safeLane];
}
