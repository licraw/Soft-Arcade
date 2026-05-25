import type { LaneSystem } from "@/games/shared/car/types";
import { getLaneCenter } from "@/games/shared/car/laneSystem";
import { validateTrafficPacket, type SolveMode } from "./spawnValidator";
import { NEAR_MISS_TUNING as TUNING } from "./tuning";

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
  forwardSpeed: number;
  paletteIndex: number;
  openingType: string;
  solveModes: SolveMode[];
  intensityBand: "intro" | "pressure" | "panic";
  solveMode?: SolveMode;
  nearMissed: boolean;
  passed: boolean;
  streakAccounted: boolean;
};

type SpawnOptions = {
  laneSystem: LaneSystem;
  traffic: TrafficCar[];
  carWidth: number;
  carHeight: number;
  playerLane: number;
  playerY: number;
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
  openingType: string;
  solveModes: SolveMode[];
  intensityBand: "intro" | "pressure" | "panic";
  cars: TrafficPacketCar[];
};

const TRAFFIC_PACKETS: TrafficPacket[] = [
  {
    id: "single-slow-blocker",
    minElapsed: 0,
    openingType: "single-lane-read",
    solveModes: ["flow-thread", "lift-merge"],
    intensityBand: "intro",
    cars: [{ laneOffset: 0, yOffset: 0, speedRatio: 0.72 }]
  },
  {
    id: "offset-pair-clear-lane",
    minElapsed: 8,
    openingType: "offset-late-gap",
    solveModes: ["flow-thread", "lift-merge", "hold-shift"],
    intensityBand: "intro",
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.7 },
      { laneOffset: 2, yOffset: -1.65, speedRatio: 0.74, lateralOffset: -0.12 }
    ]
  },
  {
    id: "staggered-triple",
    minElapsed: 18,
    openingType: "staggered-thread",
    solveModes: ["flow-thread", "lift-merge", "hold-shift"],
    intensityBand: "pressure",
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.68, lateralOffset: 0.1 },
      { laneOffset: 1, yOffset: -2.2, speedRatio: 0.78, lateralOffset: -0.14 },
      { laneOffset: 3, yOffset: -4.25, speedRatio: 0.73 }
    ]
  },
  {
    id: "convoy-squeeze-gap",
    minElapsed: 28,
    openingType: "brake-reset-gap",
    solveModes: ["lift-merge", "brake-reset"],
    intensityBand: "panic",
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.64, lateralOffset: 0.12 },
      { laneOffset: 0, yOffset: -2.55, speedRatio: 0.66, lateralOffset: -0.08 },
      { laneOffset: 2, yOffset: -1.25, speedRatio: 0.7, lateralOffset: -0.12 }
    ]
  },
  {
    id: "split-pinch",
    minElapsed: 16,
    openingType: "split-pinch",
    solveModes: ["flow-thread", "hold-shift"],
    intensityBand: "pressure",
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.7, lateralOffset: 0.18 },
      { laneOffset: 1, yOffset: -0.95, speedRatio: 0.72, lateralOffset: -0.18 }
    ]
  },
  {
    id: "corridor-shift",
    minElapsed: 34,
    openingType: "moving-corridor",
    solveModes: ["lift-merge", "brake-reset", "hold-shift"],
    intensityBand: "panic",
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.68, lateralOffset: -0.16 },
      { laneOffset: 1, yOffset: -1.7, speedRatio: 0.74, lateralOffset: 0.12 },
      { laneOffset: 2, yOffset: -3.5, speedRatio: 0.7, lateralOffset: -0.1 }
    ]
  }
];

export function getSpawnInterval(speed: number, elapsed: number) {
  const densityRamp = Math.min(0.26, elapsed / 180);

  return Math.max(TUNING.spawnIntervalFloor, 1.36 - speed / 900 - densityRamp);
}

export function spawnTrafficPacket(options: SpawnOptions) {
  const { laneSystem, traffic, carWidth, carHeight, nextId, elapsed, playerSpeed } = options;
  const blockedLanes = new Set(
    traffic
      .filter((car) => car.y < carHeight * 2.2)
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
  const startLanes = chooseStartLanes(packet, availableStartLanes, laneSystem.lanes, elapsed, corridorLane);

  for (const startLane of startLanes) {
    const packetCars = buildPacketCars(packet, startLane, corridorLane, laneSystem, carWidth, carHeight, nextId, elapsed, playerSpeed);

    if (!packetCars) {
      continue;
    }

    const validation = validateTrafficPacket({
      laneSystem,
      existingTraffic: traffic,
      packetCars,
      playerLane: options.playerLane,
      playerY: options.playerY,
      playerSpeed,
      allowedSolveModes: packet.solveModes
    });

    if (validation.accepted && validation.solveMode) {
      return packetCars.map((car) => ({ ...car, solveMode: validation.solveMode || undefined }));
    }
  }

  return null;
}

function choosePacket(elapsed: number) {
  const available = TRAFFIC_PACKETS.filter((packet) => packet.minElapsed <= elapsed);
  const densityIndex = Math.min(available.length - 1, Math.floor(elapsed / 22));

  return available[Math.floor(Math.random() * (densityIndex + 1))] || TRAFFIC_PACKETS[0];
}

function chooseStartLanes(packet: TrafficPacket, availableStartLanes: number[], laneCount: number, elapsed: number, corridorLane: number) {
  const preferredLane = getCorridorLane(elapsed + getCorridorShiftWindow(0), laneCount);
  const fittingLanes = availableStartLanes.filter((lane) => packetFits(packet, lane, laneCount));
  const corridorBiased = shuffle(fittingLanes).sort((a, b) => getCorridorBias(a, corridorLane) - getCorridorBias(b, corridorLane));
  const ordered = [...corridorBiased];

  if (availableStartLanes.includes(preferredLane) && packetFits(packet, preferredLane, laneCount)) {
    ordered.unshift(preferredLane);
  }

  return [...new Set(ordered.length ? ordered : availableStartLanes)];
}

function buildPacketCars(
  packet: TrafficPacket,
  startLane: number,
  corridorLane: number,
  laneSystem: LaneSystem,
  carWidth: number,
  carHeight: number,
  nextId: number,
  elapsed: number,
  playerSpeed: number
) {
  const lanes = packet.cars.map((car) => wrapLane(startLane + car.laneOffset, laneSystem.lanes));
  const uniqueLanes = new Set(lanes);

  if (uniqueLanes.size >= laneSystem.lanes) {
    return null;
  }

  const packetCars: TrafficCar[] = [];
  let id = nextId;

  packet.cars.forEach((packetCar, index) => {
    const lane = lanes[index];
    const width = carWidth;
    const height = carHeight;
    const readableOffset = clamp(packetCar.lateralOffset || getSubtleLaneOffset(elapsed, index), -TUNING.laneOffsetAmount, TUNING.laneOffsetAmount);
    const x = getLaneCenter(laneSystem, lane) + readableOffset * laneSystem.laneWidth - width / 2;
    const speedVariance = 0.94 + Math.random() * 0.1;

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
      forwardSpeed: Math.max(TUNING.minSpeed * 0.52, playerSpeed * packetCar.speedRatio * speedVariance),
      paletteIndex: Math.floor(Math.random() * 4),
      openingType: packet.openingType,
      solveModes: packet.solveModes,
      intensityBand: packet.intensityBand,
      nearMissed: false,
      passed: false,
      streakAccounted: false
    });
    id += 1;
  });

  return packetCars;
}

function packetFits(packet: TrafficPacket, startLane: number, laneCount: number) {
  const lanes = new Set(packet.cars.map((car) => wrapLane(startLane + car.laneOffset, laneCount)));

  return lanes.size < laneCount;
}

function getCorridorBias(startLane: number, corridorLane: number) {
  return startLane === corridorLane ? 0.35 : Math.random();
}

function wrapLane(lane: number, laneCount: number) {
  return ((lane % laneCount) + laneCount) % laneCount;
}

function getCorridorLane(elapsed: number, laneCount: number) {
  let cursor = 0;
  let shiftIndex = 0;

  while (shiftIndex < 64) {
    cursor += getCorridorShiftWindow(shiftIndex);

    if (elapsed < cursor) {
      return shiftIndex % laneCount;
    }

    shiftIndex += 1;
  }

  return Math.floor(elapsed / getCorridorShiftWindow(0)) % laneCount;
}

function getCorridorShiftWindow(index: number) {
  const wave = Math.sin(index * 12.9898) * 43758.5453;
  const amount = wave - Math.floor(wave);

  return TUNING.corridorShiftMin + (TUNING.corridorShiftMax - TUNING.corridorShiftMin) * amount;
}

function getSubtleLaneOffset(elapsed: number, index: number) {
  const phase = Math.sin(elapsed * 0.7 + index * 1.9);

  return phase * TUNING.laneOffsetAmount * 0.55;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
