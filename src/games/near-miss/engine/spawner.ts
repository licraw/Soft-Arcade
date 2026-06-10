import type { LaneSystem } from "@/games/shared/car/types";
import { getLaneCenter } from "@/games/shared/car/laneSystem";
import { getTrafficBodySize, internalSpeedFromMph, NEAR_MISS_TUNING as TUNING } from "./tuning";
import { DEFAULT_TRAFFIC_VEHICLE_ID, getSpawnableTrafficVehicleConfigs } from "./vehicleConfig";

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
  desiredWorldSpeed: number;
  currentWorldSpeed: number;
  blockedById: number | null;
  followingGapPx: number | null;
  emergencyCorrected: boolean;
  paletteIndex: number;
  nearMissed: boolean;
  passed: boolean;
  streakAccounted: boolean;
};

type SpawnOptions = {
  laneSystem: LaneSystem;
  traffic: TrafficCar[];
  carHeight: number;
  nextId: number;
  elapsed: number;
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
    minElapsed: 12,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.68, lateralOffset: 0.1 },
      { laneOffset: 1, yOffset: -1.5, speedRatio: 0.78, lateralOffset: -0.14 },
      { laneOffset: 3, yOffset: -3.0, speedRatio: 0.73 }
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
    // Covers three of four lanes with staggered-but-close blockers; the one open
    // lane is always the current corridor. Forces an explicit lane commitment.
    id: "close-triple",
    minElapsed: 14,
    cars: [
      { laneOffset: 0, yOffset: 0, speedRatio: 0.7, lateralOffset: 0.12 },
      { laneOffset: 3, yOffset: -0.55, speedRatio: 0.68, lateralOffset: 0.1 },
      { laneOffset: 1, yOffset: -1.1, speedRatio: 0.72, lateralOffset: -0.14 }
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
  const { laneSystem, traffic, carHeight, nextId, elapsed } = options;
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

  const minSpawnGapPx = Math.max(TUNING.laneSpawnMinGapPx, TUNING.laneSpawnMinGapCars * carHeight);
  const laneRecentEntries = buildLaneRecentEntries(traffic);
  const stackSafeLanes = availableStartLanes.filter(
    (startLane) => !packetWouldStack(packet, startLane, laneSystem.lanes, carHeight, laneRecentEntries, minSpawnGapPx)
  );

  if (!stackSafeLanes.length) {
    if (TUNING.debug) console.debug("[NearMiss] spawn skipped: all lanes throttled");
    return null;
  }

  const startLane = chooseStartLane(packet, stackSafeLanes, laneSystem.lanes, elapsed, corridorLane);
  const lanes = packet.cars.map((car) => wrapLane(startLane + car.laneOffset, laneSystem.lanes));
  const uniqueLanes = new Set(lanes);

  if (uniqueLanes.size >= laneSystem.lanes) {
    return null;
  }

  const packetCars: TrafficCar[] = [];
  let id = nextId;

  packet.cars.forEach((packetCar, index) => {
    const vehicleConfig = chooseTrafficVehicleConfig();
    const lane = lanes[index];
    const trafficBody = getTrafficBodySize(
      laneSystem.laneWidth,
      { height: carHeight },
      vehicleConfig,
      TUNING.trafficWidthRandomBase + Math.random() * TUNING.trafficWidthRandomRange,
      TUNING.trafficHeightRandomBase + Math.random() * TUNING.trafficHeightRandomRange
    );
    const width = trafficBody.width;
    const height = trafficBody.height;
    const baseLateralOffset = packetCar.lateralOffset ?? getSubtleLaneOffset(elapsed, index);
    const readableOffset = getReadableLaneOffset(baseLateralOffset, lane, laneSystem.lanes);
    const x = getLaneCenter(laneSystem, lane) + readableOffset * laneSystem.laneWidth - width / 2;
    const cruiseMph = TUNING.trafficMinCruiseMph + Math.random() * (TUNING.trafficMaxCruiseMph - TUNING.trafficMinCruiseMph);
    const cruiseWorldSpeed = internalSpeedFromMph(cruiseMph);

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
      vehicleConfigId: vehicleConfig.id,
      desiredWorldSpeed: cruiseWorldSpeed,
      currentWorldSpeed: cruiseWorldSpeed,
      blockedById: null,
      followingGapPx: null,
      emergencyCorrected: false,
      paletteIndex: Math.floor(Math.random() * 4),
      nearMissed: false,
      passed: false,
      streakAccounted: false
    });
    id += 1;
  });

  return packetCars;
}

type LaneEntry = { y: number; height: number };

function buildLaneRecentEntries(traffic: TrafficCar[]): Map<number, LaneEntry[]> {
  const map = new Map<number, LaneEntry[]>();

  for (const car of traffic) {
    if (car.y < 0) {
      const entries = map.get(car.lane);
      if (entries) {
        entries.push({ y: car.y, height: car.height });
      } else {
        map.set(car.lane, [{ y: car.y, height: car.height }]);
      }
    }
  }

  return map;
}

function packetWouldStack(
  packet: TrafficPacket,
  startLane: number,
  laneCount: number,
  carHeight: number,
  laneRecentEntries: Map<number, LaneEntry[]>,
  minGapPx: number
): boolean {
  // Worst-case height for intra-packet upper-car estimates (truck + max height variance).
  const maxVehicleHeight = TUNING.trafficMaxOccupancyLengthScale * (TUNING.trafficHeightRandomBase + TUNING.trafficHeightRandomRange) * carHeight;
  const packetLaneEntries = new Map<number, LaneEntry[]>();

  for (const packetCar of packet.cars) {
    const lane = wrapLane(startLane + packetCar.laneOffset, laneCount);
    // spawnY is the top edge of this new car. Actual spawn uses -height, but carHeight is a
    // close proxy for sedans; trucks spawn slightly higher, making this check conservative.
    const spawnY = -carHeight + packetCar.yOffset * carHeight;

    const existingEntries = laneRecentEntries.get(lane);
    if (existingEntries?.some((e) => wouldPhysicallyOverlap(e.y, e.height, spawnY, carHeight, minGapPx))) {
      return true;
    }

    const siblingEntries = packetLaneEntries.get(lane);
    if (siblingEntries?.some((e) => wouldPhysicallyOverlap(e.y, e.height, spawnY, maxVehicleHeight, minGapPx))) {
      return true;
    }

    const entry: LaneEntry = { y: spawnY, height: maxVehicleHeight };
    if (siblingEntries) {
      siblingEntries.push(entry);
    } else {
      packetLaneEntries.set(lane, [entry]);
    }
  }

  return false;
}

function wouldPhysicallyOverlap(aY: number, aH: number, bY: number, bH: number, minGap: number): boolean {
  const upperY = aY <= bY ? aY : bY;
  const upperH = aY <= bY ? aH : bH;
  const lowerY = aY <= bY ? bY : aY;

  return lowerY - (upperY + upperH) < minGap;
}

function chooseTrafficVehicleConfig() {
  const configs = getSpawnableTrafficVehicleConfigs();
  const fallbackConfig = configs.find((config) => config.id === DEFAULT_TRAFFIC_VEHICLE_ID) || configs[0];

  if (!fallbackConfig) {
    throw new Error("Near Miss traffic spawner needs at least one curated spawnable vehicle.");
  }

  const totalWeight = configs.reduce((total, config) => total + config.spawnWeight, 0);

  if (totalWeight <= 0) {
    return fallbackConfig;
  }

  let roll = Math.random() * totalWeight;

  for (const config of configs) {
    roll -= config.spawnWeight;

    if (roll <= 0) {
      return config;
    }
  }

  return fallbackConfig;
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

function getReadableLaneOffset(baseLateralOffset: number, lane: number, laneCount: number) {
  return clamp(baseLateralOffset + getEdgeLaneInwardBias(lane, laneCount), -TUNING.laneOffsetAmount, TUNING.laneOffsetAmount);
}

function getEdgeLaneInwardBias(lane: number, laneCount: number) {
  if (lane === 0) {
    return TUNING.edgeLaneInwardBias;
  }

  if (lane === laneCount - 1) {
    return -TUNING.edgeLaneInwardBias;
  }

  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
