import type { CarBounds } from "@/games/shared/car/types";
import { expandBounds, insetBounds } from "./collision";

// Near Miss tuning is intentionally centralized here. Prefer moving literals into
// this file before changing formulas in the game loop, spawner, or renderer.
export const NEAR_MISS_TUNING = {
  // Road/lane geometry. The road width formula itself lives in shared laneSystem.
  laneCount: 4,
  roadWidthScale: 0.95,
  debug: true,

  // Internal speed units. HUD mph is a simple display transform, not simulation.
  minSpeed: 190,
  cruiseSpeed: 285,
  maxSpeed: 880,
  baselineSpeedReserve: 80,
  speedRampPerSecond: 6.8,
  throttleAcceleration: 185,
  brakeDeceleration: 250,
  speedReturnRate: 1.8,
  displayedSpeedDivisor: 5.2,
  secondsPerHour: 3600,
  minimumDisplayedMiles: 0.1,

  // Player lateral controller. These numbers define the current handling feel.
  steerRiseRate: 13,
  lateralAccel: 15,
  activeLateralDamping: 7.5,
  coastLateralDamping: 11,
  counterSteerBonus: 7,
  maxLatSpeedLow: 3.15,
  maxLatSpeedHigh: 2.35,
  visualYawMaxDeg: 10,
  visualYawReturnRate: 11,
  visualYawSteerInfluence: 0.22,
  edgeDamping: 0.24,
  roadEdgePadding: 8,
  playerBottomMargin: 34,

  // Authoritative gameplay body sizing. Renderer sprites may visually overhang.
  carWidthRatio: 0.48,
  carHeightRatio: 1.34,
  trafficResizeWidthScale: 0.98,
  trafficResizeHeightScale: 1.02,

  // Collision and near-miss shells are derived from gameplay bodies.
  playerHitboxWidth: 0.82,
  playerHitboxHeight: 0.92,
  trafficHitboxWidth: 0.85,
  trafficHitboxHeight: 0.92,
  nearMissGrowX: 18,
  nearMissGrowY: 11,
  trafficNearMissGrowXScale: 0.7,
  minNearMissRelativeSpeed: 62,
  minRelativeTrafficSpeed: 28,

  // Traffic packet grammar. Offsets are lane-relative, y offsets are car-height-relative.
  laneOffsetAmount: 0.18,
  corridorShiftFrequency: 5.5,
  spawnBlockedLaneLookaheadCars: 2.2,
  spawnIntervalFloor: 0.58,
  spawnIntervalBase: 1.36,
  spawnSpeedDivisor: 900,
  spawnDensityRampMax: 0.26,
  spawnDensityRampSeconds: 180,
  spawnJitterMin: 0.86,
  spawnJitterRange: 0.28,
  spawnDensityBandSeconds: 22,
  trafficWidthRandomBase: 0.9,
  trafficWidthRandomRange: 0.12,
  trafficHeightRandomBase: 0.94,
  trafficHeightRandomRange: 0.12,
  trafficSpeedRandomBase: 0.94,
  trafficSpeedRandomRange: 0.1,
  minTrafficForwardSpeed: 90,
  subtleLaneOffsetFrequency: 0.7,
  subtleLaneOffsetPhaseStep: 1.9,
  subtleLaneOffsetScale: 0.55,

  // Anti-safe-channel pressure and lane-split scoring.
  safeChannelWindow: 1.2,
  safeChannelBand: 0.1,
  safeChannelScorePenalty: 0.82,
  safeChannelInstability: 0.42,
  safeChannelInstabilitySpeedOffset: 70,
  safeChannelInstabilityFrequency: 9.5,
  safeChannelComboDecayRate: 1.6,
  safeChannelRecoveryRate: 2,
  safeChannelTrafficRecoveryRate: 0.75,
  laneSplitBonusThreshold: 2,
  laneSplitBonus: 325,
  laneSplitCooldown: 1.1,
  laneSplitMinLateralSpeed: 0.38,
  laneSplitTrafficYRange: 126,
  laneSplitTrafficXRangeLanes: 0.78,

  // Run feedback and score glue values that are outside scoring.ts.
  missedCarComboWindowScale: 0.5,
  streakScoreStep: 40,
  feedbackLifeSeconds: 0.92,

  // Road motion and render-only speed effects.
  stripeSpeedScale: 0.52,
  stripeRepeatDistance: 54,
  speedLineStartSpeed: 360,
  speedLineSpeedRange: 260,
  speedLineBaseAlpha: 0.1,
  speedLineAlphaRange: 0.2,
  speedLineBaseWidth: 1,
  speedLineWidthRange: 2,
  speedLineCount: 12,
  speedLineSpacing: 89,
  speedLineStripeOffsetScale: 4,
  speedLineModuloPadding: 120,
  speedLineYOffset: 80,
  speedLineBaseLength: 56,
  speedLineLengthRange: 52,
  speedLineSideOffset: 18,
  speedLineSideStep: 14,
  speedLineSideDrift: 10,
  speedLineShoulderGlowWidth: 8,

  // Sprite overdraw. These are visual scales only; gameplay bodies stay unchanged.
  trafficSpriteScaleX: 2.28,
  trafficSpriteScaleY: 1.42,
  playerSpriteScaleX: 2.08,
  playerSpriteScaleY: 1.2,
  trafficRenderAlpha: 0.86
};

export function getPlayerBodySize(laneWidth: number) {
  const width = Math.min(62, laneWidth * NEAR_MISS_TUNING.carWidthRatio);

  return {
    width,
    height: width * NEAR_MISS_TUNING.carHeightRatio
  };
}

export function getTrafficResizeBodySize(playerBody: Pick<CarBounds, "width" | "height">) {
  return {
    width: playerBody.width * NEAR_MISS_TUNING.trafficResizeWidthScale,
    height: playerBody.height * NEAR_MISS_TUNING.trafficResizeHeightScale
  };
}

export function getBaselineSpeed(elapsedSeconds: number) {
  return Math.min(
    NEAR_MISS_TUNING.maxSpeed - NEAR_MISS_TUNING.baselineSpeedReserve,
    NEAR_MISS_TUNING.cruiseSpeed + elapsedSeconds * NEAR_MISS_TUNING.speedRampPerSecond
  );
}

export function getDisplayedSpeed(speed: number) {
  return speed / NEAR_MISS_TUNING.displayedSpeedDivisor;
}

export function getDisplayedDistanceMiles(distance: number) {
  return Math.max(
    NEAR_MISS_TUNING.minimumDisplayedMiles,
    distance / NEAR_MISS_TUNING.displayedSpeedDivisor / NEAR_MISS_TUNING.secondsPerHour
  );
}

export function getPlayerHitbox(bounds: CarBounds) {
  // Collision boxes are stable, axis-aligned gameplay bounds. Visual yaw is
  // cosmetic in the renderer and must not affect collision math.
  return insetBounds(bounds, NEAR_MISS_TUNING.playerHitboxWidth, NEAR_MISS_TUNING.playerHitboxHeight);
}

export function getTrafficHitbox(bounds: CarBounds) {
  return insetBounds(bounds, NEAR_MISS_TUNING.trafficHitboxWidth, NEAR_MISS_TUNING.trafficHitboxHeight);
}

export function getPlayerNearMissShell(playerHitbox: CarBounds) {
  return expandBounds(playerHitbox, NEAR_MISS_TUNING.nearMissGrowX, NEAR_MISS_TUNING.nearMissGrowY);
}

export function getTrafficNearMissShell(trafficHitbox: CarBounds) {
  return expandBounds(
    trafficHitbox,
    NEAR_MISS_TUNING.nearMissGrowX * NEAR_MISS_TUNING.trafficNearMissGrowXScale,
    NEAR_MISS_TUNING.nearMissGrowY
  );
}
