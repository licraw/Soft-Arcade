import type { LaneSystem } from "@/games/shared/car/types";
import { getLaneCenter } from "@/games/shared/car/laneSystem";

export type TrafficCar = {
  id: number;
  lane: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speedOffset: number;
  paletteIndex: number;
  nearMissed: boolean;
  passed: boolean;
};

type SpawnOptions = {
  laneSystem: LaneSystem;
  traffic: TrafficCar[];
  carWidth: number;
  carHeight: number;
  nextId: number;
  elapsed: number;
};

export function getSpawnInterval(speed: number) {
  return Math.max(0.42, 1.08 - speed / 860);
}

export function spawnTrafficCar(options: SpawnOptions) {
  const { laneSystem, traffic, carWidth, carHeight, nextId, elapsed } = options;
  const blockedLanes = new Set(
    traffic
      .filter((car) => car.y < carHeight * 1.7)
      .map((car) => car.lane)
  );
  const availableLanes = laneSystem.centers
    .map((_, lane) => lane)
    .filter((lane) => !blockedLanes.has(lane));

  if (!availableLanes.length) {
    return null;
  }

  const waveLane = Math.floor(elapsed / 4) % laneSystem.lanes;
  const lane = availableLanes.includes(waveLane)
    ? waveLane
    : availableLanes[Math.floor(Math.random() * availableLanes.length)];
  const width = carWidth * (0.92 + Math.random() * 0.16);
  const height = carHeight * (0.92 + Math.random() * 0.18);
  const x = getLaneCenter(laneSystem, lane) - width / 2;

  return {
    id: nextId,
    lane,
    x,
    y: -height - Math.random() * carHeight * 0.8,
    width,
    height,
    speedOffset: Math.random() * 54 - 12,
    paletteIndex: Math.floor(Math.random() * 4),
    nearMissed: false,
    passed: false
  };
}
