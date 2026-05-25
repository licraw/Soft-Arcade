import type { LaneSystem } from "@/games/shared/car/types";
import { getLaneCenter } from "@/games/shared/car/laneSystem";
import { NEAR_MISS_TUNING as TUNING } from "./tuning";
import { DEFAULT_TRAFFIC_VEHICLE_ID } from "./vehicleConfig";

export type TrafficCar = {
  id: number;
  packetId: string;
  lane: number;
  laneCenterOffset: number;
  corridorLane: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vehicleConfigId: string;
  forwardSpeed: number;
  paletteIndex: number;
  nearMissed: boolean;
  passed: boolean;
  streakAccounted: boolean;
};

type SpawnOptions = {
  laneSystem: LaneSystem;
  traffic: TrafficCar[];
  carWidth: number;
  carHeight: number;
  nextId: number;
  elapsed: number;
  playerSpeed: number;
};

type TrafficPacketCar = {
  laneOffset: number;
  yOffset: number;
  speedRatio: number;
  lateralOffset?: number;
};

type TrafficPacket = {
  id: string;
  minElapsed: number;
  cars: TrafficPacketCar[];
};

const TRAFFIC_PACKETS: TrafficPacket[] = [
  // Packet cars are authored in lane units and car-height units. Keep this
  // table readable; use tuning.ts for global spawn rhythm and variance.
  {
    id: "single-slow-blocker",
    minElapsed: 0,
    cars: [{ laneOffset: 0, yOffset: 0, speedRatio: 0.72 }]
  },
  {
    id: "offset-pair-clear-lane",
    minElapsed: 8,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.7 },
      { laneOffset: 2, yOffset: -1.65, speedRatio: 0.74, lateralOffset: -0.12 }
    ]
  },
  {
    id: "staggered-triple",
    minElapsed: 18,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.68, lateralOffset: 0.1 },
      { laneOffset: 1, yOffset: -2.2, speedRatio: 0.78, lateralOffset: -0.14 },
      { laneOffset: 3, yOffset: -4.25, speedRatio: 0.73 }
    ]
  },
  {
    id: "convoy-squeeze-gap",
    minElapsed: 28,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.64, lateralOffset: 0.12 },
      { laneOffset: 0, yOffset: -2.55, speedRatio: 0.66, lateralOffset: -0.08 },
      { laneOffset: 2, yOffset: -1.25, speedRatio: 0.7, lateralOffset: -0.12 }
    ]
  },
  {
    id: "split-pinch",
    minElapsed: 16,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.7, lateralOffset: 0.18 },
      { laneOffset: 1, yOffset: -0.95, speedRatio: 0.72, lateralOffset: -0.18 }
    ]
  },
  {
    id: "corridor-shift",
    minElapsed: 34,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.68, lateralOffset: -0.16 },
      { laneOffset: 1, yOffset: -1.7, speedRatio: 0.74, lateralOffset: 0.12 },
      { laneOffset: 2, yOffset: -3.5, speedRatio: 0.7, lateralOffset: -0.1 }
    ]
  }
];

export function getSpawnInterval(speed: number, elapsed: number) {
  const densityRamp = Math.min(TUNING.spawnDensityRampMax, elapsed / TUNING.spawnDensityRampSeconds);

  return Math.max(TUNING.spawnIntervalFloor, TUNING.spawnIntervalBase - speed / TUNING.spawnSpeedDivisor - densityRamp);
}

export function spawnTrafficPacket(options: SpawnOptions) {
  const { laneSystem, traffic, carWidth, carHeight, nextId, elapsed, playerSpeed } = options;
  const blockedLanes = new Set(
    traffic
      .filter((car) => car.y < carHeight * TUNING.spawnBlockedLaneLookaheadCars)
      .map((car) => car.lane)
  );

  const availableStartLanes = laneSystem.centers
    .map((_, lane) => lane)
    .filter((lane) => !blockedLanes.has(lane));

  if (!availableStartLanes.length) {
    return null;
  }

  const packet = choosePacket(elapsed);
  const corridorLane = getCorridorLane(elapsed, laneSystem.lanes);
  const startLane = chooseStartLane(packet, availableStartLanes, laneSystem.lanes, elapsed, corridorLane);
  const lanes = packet.cars.map((car) => wrapLane(startLane + car.laneOffset, laneSystem.lanes));
  const uniqueLanes = new Set(lanes);

  if (uniqueLanes.size >= laneSystem.lanes) {
    return null;
  }

  const packetCars: TrafficCar[] = [];
  let id = nextId;

  packet.cars.forEach((packetCar, index) => {
    const lane = lanes[index];
    const width = carWidth * (TUNING.trafficWidthRandomBase + Math.random() * TUNING.trafficWidthRandomRange);
    const height = carHeight * (TUNING.trafficHeightRandomBase + Math.random() * TUNING.trafficHeightRandomRange);
    const readableOffset = clamp(packetCar.lateralOffset || getSubtleLaneOffset(elapsed, index), -TUNING.laneOffsetAmount, TUNING.laneOffsetAmount);
    const x = getLaneCenter(laneSystem, lane) + readableOffset * laneSystem.laneWidth - width / 2;
    const speedVariance = TUNING.trafficSpeedRandomBase + Math.random() * TUNING.trafficSpeedRandomRange;

    packetCars.push({
      id,
      packetId: packet.id,
      lane,
      laneCenterOffset: readableOffset,
      corridorLane,
      x,
      y: -height + packetCar.yOffset * carHeight,
      width,
      height,
      vehicleConfigId: DEFAULT_TRAFFIC_VEHICLE_ID,
      forwardSpeed: Math.max(TUNING.minTrafficForwardSpeed, playerSpeed * packetCar.speedRatio * speedVariance),
      paletteIndex: Math.floor(Math.random() * 4),
      nearMissed: false,
      passed: false,
      streakAccounted: false
    });
    id += 1;
  });

  return packetCars;
}

function choosePacket(elapsed: number) {
  const available = TRAFFIC_PACKETS.filter((packet) => packet.minElapsed <= elapsed);
  const densityIndex = Math.min(available.length - 1, Math.floor(elapsed / TUNING.spawnDensityBandSeconds));

  return available[Math.floor(Math.random() * (densityIndex + 1))] || TRAFFIC_PACKETS[0];
}

function chooseStartLane(packet: TrafficPacket, availableStartLanes: number[], laneCount: number, elapsed: number, corridorLane: number) {
  const preferredLane = Math.floor(elapsed / TUNING.corridorShiftFrequency) % laneCount;

  if (availableStartLanes.includes(preferredLane) && packetFits(packet, preferredLane, laneCount, corridorLane)) {
    return preferredLane;
  }

  const fittingLanes = availableStartLanes.filter((lane) => packetFits(packet, lane, laneCount, corridorLane));

  return fittingLanes.length ? fittingLanes[Math.floor(Math.random() * fittingLanes.length)] : availableStartLanes[0];
}

function packetFits(packet: TrafficPacket, startLane: number, laneCount: number, corridorLane: number) {
  const lanes = new Set(packet.cars.map((car) => wrapLane(startLane + car.laneOffset, laneCount)));

  return lanes.size < laneCount && !lanes.has(corridorLane);
}

function wrapLane(lane: number, laneCount: number) {
  return ((lane % laneCount) + laneCount) % laneCount;
}

function getCorridorLane(elapsed: number, laneCount: number) {
  return Math.floor(elapsed / TUNING.corridorShiftFrequency) % laneCount;
}

function getSubtleLaneOffset(elapsed: number, index: number) {
  const phase = Math.sin(elapsed * TUNING.subtleLaneOffsetFrequency + index * TUNING.subtleLaneOffsetPhaseStep);

  return phase * TUNING.laneOffsetAmount * TUNING.subtleLaneOffsetScale;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
