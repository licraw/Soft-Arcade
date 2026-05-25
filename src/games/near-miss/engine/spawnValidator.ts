import type { LaneSystem } from "@/games/shared/car/types";
import { getLaneCenter } from "@/games/shared/car/laneSystem";
import { insetBounds, intersects } from "./collision";
import type { TrafficCar } from "./spawner";
import {
  getCollisionScales,
  getVehicleFootprint,
  NEAR_MISS_TUNING as TUNING
} from "./tuning";

export type SolveMode = "flow-thread" | "lift-merge" | "brake-reset" | "hold-shift";

type SpawnValidationOptions = {
  laneSystem: LaneSystem;
  existingTraffic: TrafficCar[];
  packetCars: TrafficCar[];
  playerLane: number;
  playerY: number;
  playerSpeed: number;
  allowedSolveModes?: SolveMode[];
};

type SolveProfile = {
  mode: SolveMode;
  brakeSeconds: number;
  waitSeconds: number;
  speedAfterBrake: number;
};

const SOLVE_PROFILES: SolveProfile[] = [
  { mode: "flow-thread", brakeSeconds: 0, waitSeconds: 0, speedAfterBrake: 1 },
  { mode: "lift-merge", brakeSeconds: 0.35, waitSeconds: 0.18, speedAfterBrake: 0.9 },
  { mode: "brake-reset", brakeSeconds: 0.82, waitSeconds: 0.42, speedAfterBrake: 0.72 },
  { mode: "hold-shift", brakeSeconds: 0, waitSeconds: 0.92, speedAfterBrake: 1 }
];

export function validateTrafficPacket(options: SpawnValidationOptions) {
  const traffic = [...options.existingTraffic, ...options.packetCars];

  const profiles = options.allowedSolveModes?.length
    ? SOLVE_PROFILES.filter((profile) => options.allowedSolveModes?.includes(profile.mode))
    : SOLVE_PROFILES;

  for (const profile of profiles) {
    for (let targetLane = 0; targetLane < options.laneSystem.lanes; targetLane += 1) {
      if (profileCanSolve(options, traffic, profile, targetLane)) {
        return {
          accepted: true,
          solveMode: profile.mode
        };
      }
    }
  }

  return {
    accepted: false,
    solveMode: null
  };
}

function profileCanSolve(
  options: SpawnValidationOptions,
  traffic: TrafficCar[],
  profile: SolveProfile,
  targetLane: number
) {
  const stepSeconds = TUNING.spawnValidationSeconds / TUNING.spawnValidationSteps;
  const playerFootprint = getVehicleFootprint(options.laneSystem.laneWidth, "player");
  const playerScales = getCollisionScales("player");
  const playerLaneAtCommit = options.playerLane;
  const laneDelta = targetLane - playerLaneAtCommit;
  const commitSeconds = Math.abs(laneDelta) / getLateralReachPerSecond(options.playerSpeed);

  for (let step = 0; step <= TUNING.spawnValidationSteps; step += 1) {
    const time = step * stepSeconds;
    const speed = getProfileSpeed(options.playerSpeed, profile, time);
    const playerLane = getProfileLane(playerLaneAtCommit, targetLane, profile.waitSeconds, commitSeconds, time);
    const playerCenterX = getLaneCenter(options.laneSystem, 0) + playerLane * options.laneSystem.laneWidth;
    const playerBounds = {
      x: playerCenterX - playerFootprint.width / 2,
      y: options.playerY,
      width: playerFootprint.width,
      height: playerFootprint.height
    };
    const playerHitbox = insetBounds(playerBounds, playerScales.width, playerScales.height);

    for (const car of traffic) {
      const relativeYSpeed = Math.max(28, speed - car.forwardSpeed);
      const trafficBounds = {
        ...car,
        y: car.y + relativeYSpeed * time
      };
      const trafficScales = getCollisionScales("traffic");
      const trafficHitbox = insetBounds(trafficBounds, trafficScales.width, trafficScales.height);

      if (intersects(playerHitbox, trafficHitbox)) {
        return false;
      }
    }
  }

  return true;
}

function getProfileSpeed(playerSpeed: number, profile: SolveProfile, time: number) {
  if (profile.brakeSeconds <= 0 || time <= 0) {
    return playerSpeed;
  }

  const brakeAmount = Math.min(time, profile.brakeSeconds) * TUNING.brakeDeceleration;
  const minimumProfileSpeed = Math.max(TUNING.minSpeed, playerSpeed * profile.speedAfterBrake);

  return Math.max(minimumProfileSpeed, playerSpeed - brakeAmount);
}

function getProfileLane(startLane: number, targetLane: number, waitSeconds: number, commitSeconds: number, time: number) {
  if (time <= waitSeconds || commitSeconds <= 0) {
    return startLane;
  }

  const amount = Math.min(1, (time - waitSeconds) / commitSeconds);

  return startLane + (targetLane - startLane) * easeInOut(amount);
}

function getLateralReachPerSecond(speed: number) {
  const speedRatio = clamp((speed - TUNING.minSpeed) / (TUNING.maxSpeed - TUNING.minSpeed), 0, 1);

  return TUNING.maxLatSpeedLow + (TUNING.maxLatSpeedHigh - TUNING.maxLatSpeedLow) * speedRatio;
}

function easeInOut(value: number) {
  return value * value * (3 - 2 * value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
