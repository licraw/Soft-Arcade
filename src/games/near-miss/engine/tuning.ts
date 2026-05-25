import type { CarBounds, LaneSystem } from "@/games/shared/car/types";

export type NearMissVehicleKind = "player" | "traffic";

export const NEAR_MISS_TUNING = {
  laneCount: 4,
  debug: false,
  roadWidthFactor: 0.86,
  maxRoadWidth: 560,
  minShoulderClearance: 8,
  maxShoulderClearance: 12,
  minSpeed: 190,
  cruiseSpeed: 285,
  riskBandStart: 330,
  speedSoftCap: 430,
  maxSpeed: 520,
  speedRampPerSecond: 6,
  throttleAcceleration: 185,
  brakeDeceleration: 260,
  speedReturnRate: 1.8,
  steerRiseRate: 13,
  lateralAccel: 15,
  activeLateralDamping: 7.5,
  coastLateralDamping: 11,
  counterSteerBonus: 7,
  maxLatSpeedLow: 3.15,
  maxLatSpeedHigh: 2.35,
  visualYawMaxDeg: 10,
  visualYawReturnRate: 11,
  edgeDamping: 0.24,
  playerVisibleWidthLanes: 0.57,
  trafficVisibleWidthLanes: 0.61,
  vehicleBodyLengthRatio: 1.34,
  playerCollisionWidthScale: 0.84,
  trafficCollisionWidthScale: 0.86,
  collisionHeightScale: 0.9,
  nearMissGrowXLanes: 0.14,
  nearMissGrowYLengths: 0.24,
  sameCarNearMissCooldown: 0.8,
  minNearMissRelativeSpeed: 62,
  laneOffsetAmount: 0.18,
  corridorShiftMin: 4.8,
  corridorShiftMax: 5.4,
  safeChannelWindow: 1.2,
  safeChannelBand: 0.1,
  safeChannelScorePenalty: 0.82,
  safeChannelInstability: 0.42,
  laneSplitBonusThreshold: 2,
  laneSplitBonus: 325,
  laneSplitCooldown: 1.1,
  laneSplitMinLateralSpeed: 0.38,
  laneSplitTrafficYRange: 126,
  spawnIntervalFloor: 0.66,
  spawnValidationSeconds: 2.4,
  spawnValidationSteps: 12
};

export function createNearMissLaneSystem(width: number, lanes = NEAR_MISS_TUNING.laneCount): LaneSystem {
  const clampedLanes = Math.max(3, Math.min(5, Math.round(lanes)));
  const roadWidth = Math.min(width * NEAR_MISS_TUNING.roadWidthFactor, NEAR_MISS_TUNING.maxRoadWidth);
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

export function getShoulderClearance(laneWidth: number) {
  return clamp(laneWidth * 0.085, NEAR_MISS_TUNING.minShoulderClearance, NEAR_MISS_TUNING.maxShoulderClearance);
}

export function getVehicleFootprint(laneWidth: number, kind: NearMissVehicleKind): Pick<CarBounds, "width" | "height"> {
  const widthLanes = kind === "player" ? NEAR_MISS_TUNING.playerVisibleWidthLanes : NEAR_MISS_TUNING.trafficVisibleWidthLanes;
  const width = laneWidth * widthLanes;

  return {
    width,
    height: width * NEAR_MISS_TUNING.vehicleBodyLengthRatio
  };
}

export function getCollisionScales(kind: NearMissVehicleKind) {
  return {
    width: kind === "player" ? NEAR_MISS_TUNING.playerCollisionWidthScale : NEAR_MISS_TUNING.trafficCollisionWidthScale,
    height: NEAR_MISS_TUNING.collisionHeightScale
  };
}

export function getNearMissShellGrowth(laneWidth: number, vehicleHeight: number) {
  return {
    x: laneWidth * NEAR_MISS_TUNING.nearMissGrowXLanes,
    y: vehicleHeight * NEAR_MISS_TUNING.nearMissGrowYLengths
  };
}

export function getBaselineSpeed(elapsed: number) {
  return Math.min(NEAR_MISS_TUNING.speedSoftCap, NEAR_MISS_TUNING.cruiseSpeed + elapsed * NEAR_MISS_TUNING.speedRampPerSecond);
}

export function getDisplayedMph(internalSpeed: number) {
  const { minSpeed, cruiseSpeed, speedSoftCap, maxSpeed } = NEAR_MISS_TUNING;

  if (internalSpeed <= cruiseSpeed) {
    return lerp(72, 96, smoothstep((internalSpeed - minSpeed) / (cruiseSpeed - minSpeed)));
  }

  if (internalSpeed <= speedSoftCap) {
    return lerp(96, 130, smoothstep((internalSpeed - cruiseSpeed) / (speedSoftCap - cruiseSpeed)));
  }

  return lerp(130, 152, smoothstep((internalSpeed - speedSoftCap) / (maxSpeed - speedSoftCap)));
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);

  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
