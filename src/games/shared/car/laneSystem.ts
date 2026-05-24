import type { LaneSystem } from "./types";

export function createLaneSystem(width: number, lanes = 4): LaneSystem {
  const clampedLanes = Math.max(3, Math.min(5, Math.round(lanes)));
  const roadWidth = Math.min(width * 0.86, 560);
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
