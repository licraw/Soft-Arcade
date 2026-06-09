import { createLaneSystem, getLaneCenter } from "@/games/shared/car/laneSystem";
import type { CarBounds, LaneSystem } from "@/games/shared/car/types";
import { hasPlayerPassedTraffic } from "./collision";
import type { NearMissInputState } from "./input";
import { NEAR_MISS_MODE_CONFIG, type NearMissMode } from "./modes";
import { chooseRunEndMessage } from "./runEndMessages";
import { getDistanceScore, getFeedbackForStreak, getNearMissBonus, getSpeedScore, getSurvivalScore, SCORE_TUNING } from "./scoring";
import { getSpawnInterval, spawnTrafficPacket, type TrafficCar } from "./spawner";
import {
  getBaselineSpeed,
  getDisplayedSpeed,
  internalSpeedFromMph,
  getPlayerBodySize,
  getTrafficBodySize,
  NEAR_MISS_TUNING as TUNING
} from "./tuning";
import {
  doVehicleZonesOverlap,
  getPlayerVehicleTransform,
  getTrafficVehicleTransform,
  getVehicleCollisionPolygons,
  getVehicleNearMissPolygons,
  isVehicleNearMissOverlap
} from "./vehicleGeometry";
import { getVehicleConfig } from "./vehicleConfig";
import { renderNearMiss } from "../render/canvasRenderer";

type GameStatus = "ready" | "running" | "crashing" | "gameOver";

export type NearMissSnapshot = {
  status: GameStatus;
  score: number;
  speed: number;
  averageSpeed: number;
  distance: number;
  elapsed: number;
  nearMisses: number;
  streak: number;
  bestScore: number;
  message: string;
  debug: boolean;
};

type Feedback = {
  id: number;
  text: string;
  x: number;
  y: number;
  age: number;
  life: number;
  tone: "bonus" | "danger";
  priority: FeedbackPriority;
  variant: "score" | "callout";
};

type FeedbackPriority = "low" | "medium" | "high";

type PlayerCar = CarBounds & {
  lanePosition: number;
  lateralVelocity: number;
  inputSteer: number;
  visualYaw: number;
};

export type CrashImpactSide = "front" | "rear" | "left" | "right" | "center";

export type CrashVehicleMotion = {
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  yawDeg: number;
  angularVelocityDeg: number;
};

export type CrashState = {
  age: number;
  duration: number;
  hitTrafficId: number;
  normalX: number;
  normalY: number;
  impactSide: CrashImpactSide;
  player: CrashVehicleMotion;
  traffic: CrashVehicleMotion;
  roadSpeedAtImpact: number;
  roadSlowdownRate: number;
  minRoadSpeedRatio: number;
  finalMessage: string;
};

export type NearMissRuntimeState = {
  status: GameStatus;
  mode: NearMissMode;
  width: number;
  height: number;
  laneSystem: LaneSystem;
  player: PlayerCar;
  traffic: TrafficCar[];
  feedbacks: Feedback[];
  nextFeedbackAt: number;
  score: number;
  bonusScore: number;
  speed: number;
  distance: number;
  elapsed: number;
  nearMisses: number;
  streak: number;
  comboTimer: number;
  laneSplitCooldown: number;
  safeChannelTimer: number;
  safeChannelActive: boolean;
  bestScore: number;
  stripeOffset: number;
  message: string;
  input: NearMissInputState;
  crash: CrashState | null;
  debug: boolean;
};

type NearMissGameLoopOptions = {
  canvas: HTMLCanvasElement;
  bestScore: number;
  onSnapshot: (snapshot: NearMissSnapshot) => void;
  onBestScore: (score: number) => void;
};

const READY_MESSAGE = "THREAD THE GAP";
const FEEDBACK_PRIORITY_WEIGHT: Record<FeedbackPriority, number> = {
  low: 1,
  medium: 2,
  high: 3
};

export class NearMissGameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrame = 0;
  private lastFrame = 0;
  private spawnTimer = 0;
  private nextTrafficId = 1;
  private nextFeedbackId = 1;
  private lastSnapshotAt = 0;
  private lastRunEndMessage = "";
  private onSnapshot: NearMissGameLoopOptions["onSnapshot"];
  private onBestScore: NearMissGameLoopOptions["onBestScore"];
  private state: NearMissRuntimeState;

  constructor(options: NearMissGameLoopOptions) {
    const ctx = options.canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Near Miss needs a 2D canvas context.");
    }

    this.canvas = options.canvas;
    this.ctx = ctx;
    this.onSnapshot = options.onSnapshot;
    this.onBestScore = options.onBestScore;
    this.state = this.createInitialState(options.bestScore);
  }

  start() {
    if (this.state.status === "crashing") {
      return;
    }

    this.stop();
    this.state.status = "running";
    this.state.crash = null;
    this.state.message = "CLEAN RUN";
    this.lastFrame = performance.now();
    this.animationFrame = requestAnimationFrame(this.tick);
    this.emitSnapshot();
  }

  restart(bestScore = this.state.bestScore) {
    this.stop();
    this.state = this.createInitialState(bestScore);
    this.start();
  }

  cancelRun(bestScore = this.state.bestScore) {
    this.stop();
    this.state = this.createInitialState(bestScore);
    this.render();
    this.emitSnapshot();
  }

  pause() {
    this.stop();
  }

  destroy() {
    this.stop();
  }

  resize(width: number, height: number) {
    const pixelRatio = window.devicePixelRatio || 1;
    const displayWidth = Math.max(320, Math.floor(width));
    const displayHeight = Math.max(420, Math.floor(height));

    this.canvas.width = Math.floor(displayWidth * pixelRatio);
    this.canvas.height = Math.floor(displayHeight * pixelRatio);
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const laneSystem = createNearMissLaneSystem(displayWidth);
    const playerBody = getPlayerBodySize(getVehicleSizingLaneWidth(laneSystem));
    const carWidth = playerBody.width;
    const carHeight = playerBody.height;
    const playerCenterRatio = this.state.width
      ? (this.state.player.x + this.state.player.width / 2 - this.state.laneSystem.roadLeft) / this.state.laneSystem.roadWidth
      : 0.5;
    const minX = laneSystem.roadLeft + TUNING.roadEdgePadding;
    const maxX = laneSystem.roadLeft + laneSystem.roadWidth - carWidth - TUNING.roadEdgePadding;
    const playerX = clamp(laneSystem.roadLeft + laneSystem.roadWidth * playerCenterRatio - carWidth / 2, minX, maxX);
    const lanePosition = (playerX + carWidth / 2 - laneSystem.roadLeft) / laneSystem.laneWidth - 0.5;

    this.state.width = displayWidth;
    this.state.height = displayHeight;
    this.state.laneSystem = laneSystem;
    this.state.player = {
      ...this.state.player,
      x: playerX,
      y: displayHeight - carHeight - TUNING.playerBottomMargin,
      width: carWidth,
      height: carHeight,
      lanePosition
    };

    for (const car of this.state.traffic) {
      const vehicleConfig = getVehicleConfig(car.vehicleConfigId);
      const trafficBody = getTrafficBodySize(laneSystem.laneWidth, playerBody, vehicleConfig);
      car.width = trafficBody.width;
      car.height = trafficBody.height;
      car.x = getLaneCenter(laneSystem, Math.min(car.lane, laneSystem.lanes - 1)) + car.laneCenterOffset * laneSystem.laneWidth - car.width / 2;
    }

    this.render();
  }

  setInput(input: NearMissInputState) {
    const hasActiveInput = input.steer !== 0 || input.throttle || input.brake;

    if (this.state.status === "ready" && hasActiveInput) {
      this.start();
    }

    if (this.state.status !== "ready" && this.state.status !== "running") {
      return;
    }

    this.state.input = input;
  }

  getSnapshot(): NearMissSnapshot {
    return {
      status: this.state.status,
      score: this.state.score,
      speed: getDisplayedSpeed(this.state.speed),
      averageSpeed: this.state.elapsed > 0 ? getDisplayedSpeed(this.state.distance / this.state.elapsed) : 0,
      distance: this.state.distance,
      elapsed: this.state.elapsed,
      nearMisses: this.state.nearMisses,
      streak: this.state.streak,
      bestScore: this.state.bestScore,
      message: this.state.message,
      debug: this.state.debug
    };
  }

  private createInitialState(bestScore: number): NearMissRuntimeState {
    const width = this.canvas.clientWidth || 720;
    const height = this.canvas.clientHeight || 620;
    const laneSystem = createNearMissLaneSystem(width);
    const playerBody = getPlayerBodySize(getVehicleSizingLaneWidth(laneSystem));
    const carWidth = playerBody.width;
    const carHeight = playerBody.height;
    const startLane = Math.floor(laneSystem.lanes / 2);
    const playerX = getLaneCenter(laneSystem, startLane) - carWidth / 2;

    return {
      status: "ready",
      mode: NEAR_MISS_MODE_CONFIG.defaultMode,
      width,
      height,
      laneSystem,
      player: {
        x: playerX,
        y: height - carHeight - TUNING.playerBottomMargin,
        width: carWidth,
        height: carHeight,
        lanePosition: startLane,
        lateralVelocity: 0,
        inputSteer: 0,
        visualYaw: 0
      },
      traffic: [],
      feedbacks: [],
      nextFeedbackAt: 0,
      score: 0,
      bonusScore: 0,
      speed: TUNING.cruiseSpeed,
      distance: 0,
      elapsed: 0,
      nearMisses: 0,
      streak: 0,
      comboTimer: 0,
      laneSplitCooldown: 0,
      safeChannelTimer: 0,
      safeChannelActive: false,
      bestScore,
      stripeOffset: 0,
      message: READY_MESSAGE,
      input: {
        steer: 0,
        throttle: false,
        brake: false
      },
      crash: null,
      debug: TUNING.debug
    };
  }

  private tick = (timestamp: number) => {
    const delta = Math.min(0.034, (timestamp - this.lastFrame) / 1000 || 0);
    this.lastFrame = timestamp;

    if (this.state.status === "running") {
      this.update(delta);
    } else if (this.state.status === "crashing") {
      this.updateCrashing(delta);
    }

    this.render();

    if (timestamp - this.lastSnapshotAt > 90 || this.state.status !== "running") {
      this.emitSnapshot();
      this.lastSnapshotAt = timestamp;
    }

    if (this.state.status === "running" || this.state.status === "crashing") {
      this.animationFrame = requestAnimationFrame(this.tick);
    }
  };

  private update(delta: number) {
    const state = this.state;
    const carHeight = state.player.height;
    const baselineSpeed = getBaselineSpeed(state.elapsed);

    // Internal speed is deliberately separate from displayed mph. Tune speed
    // response in tuning.ts before changing the update order here.
    state.elapsed += delta;
    if (state.input.throttle) {
      state.speed += TUNING.throttleAcceleration * delta;
    } else if (state.input.brake) {
      state.speed -= TUNING.brakeDeceleration * delta;
    } else {
      state.speed += (baselineSpeed - state.speed) * Math.min(1, TUNING.speedReturnRate * delta);
    }
    state.speed = clamp(state.speed, TUNING.minSpeed, TUNING.maxSpeed);
    state.distance += state.speed * delta;
    state.stripeOffset = (state.stripeOffset - state.speed * delta * TUNING.stripeSpeedScale) % TUNING.stripeRepeatDistance;
    this.updatePlayerHandling(delta);
    this.clampPlayerToRoad();
    state.comboTimer = Math.max(0, state.comboTimer - delta);
    state.laneSplitCooldown = Math.max(0, state.laneSplitCooldown - delta);

    if (state.comboTimer === 0 && state.streak > 0) {
      state.streak = 0;
    }

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      const spawned = spawnTrafficPacket({
        laneSystem: state.laneSystem,
        traffic: state.traffic,
        carHeight,
        nextId: this.nextTrafficId,
        elapsed: state.elapsed,
        playerSpeed: state.speed
      });

      if (spawned) {
        state.traffic.push(...spawned);
        this.nextTrafficId += spawned.length;
      }

      this.spawnTimer = getSpawnInterval(state.speed, state.elapsed) * (TUNING.spawnJitterMin + Math.random() * TUNING.spawnJitterRange);
    }

    this.updateTrafficFollowing(delta);

    this.moveTraffic(delta);

    for (const car of state.traffic) {
      const relativeYSpeed = getTrafficScreenYSpeed(state.speed, car.currentWorldSpeed);
      if (!car.nearMissed && hasPlayerPassedTraffic(state.player, car) && this.canAwardNearMiss(car, relativeYSpeed)) {
        this.awardNearMiss(car);
      }

      if (!car.passed && car.y > state.player.y + state.player.height) {
        car.passed = true;
        if (!car.nearMissed && !car.streakAccounted) {
          car.streakAccounted = true;
          state.streak = Math.max(0, state.streak - 1);
          state.comboTimer = state.streak > 0 ? Math.min(state.comboTimer, SCORE_TUNING.comboWindow * TUNING.missedCarComboWindowScale) : 0;
        }
      }

      if (this.isPlayerCollidingWithTraffic(car)) {
        this.startCrash(car, relativeYSpeed);
        return;
      }
    }

    this.updateLaneSplitPressure(delta);

    state.traffic = this.getActiveTraffic();
    state.feedbacks = state.feedbacks
      .map((feedback) => ({ ...feedback, age: feedback.age + delta }))
      .filter((feedback) => feedback.age < feedback.life);
    const speedScoreFactor = state.speed < baselineSpeed ? SCORE_TUNING.brakingScorePenalty : 1;
    const safeChannelScoreFactor = state.safeChannelTimer > TUNING.safeChannelWindow ? TUNING.safeChannelScorePenalty : 1;
    state.score = Math.floor(
      ((getDistanceScore(state.distance) + getSurvivalScore(state.elapsed) + getSpeedScore(state.speed, baselineSpeed, state.elapsed)) *
        speedScoreFactor +
        state.bonusScore +
        state.streak * TUNING.streakScoreStep) *
        safeChannelScoreFactor
    );
  }

  private updateTrafficFollowing(delta: number) {
    const accelStep = internalSpeedFromMph(TUNING.trafficAccelMphPerSecond) * delta;
    const brakeStep = internalSpeedFromMph(TUNING.trafficBrakeMphPerSecond) * delta;
    const emergencyBrakeStep = internalSpeedFromMph(TUNING.trafficEmergencyBrakeMphPerSecond) * delta;

    for (const car of this.state.traffic) {
      car.blockedById = null;
      car.followingGapPx = null;
      car.emergencyCorrected = false;
    }

    for (const laneCars of this.getTrafficByLaneSorted()) {
      for (let index = 0; index < laneCars.length; index += 1) {
        const rear = laneCars[index];
        let targetWorldSpeed = rear.desiredWorldSpeed;
        let speedStep = targetWorldSpeed >= rear.currentWorldSpeed ? accelStep : brakeStep;

        if (index > 0) {
          const front = laneCars[index - 1];
          const gapPx = rear.y - (front.y + front.height);
          const baseGapPx = Math.max(TUNING.trafficFollowingGapMinPx, rear.height * TUNING.trafficFollowingGapCars);
          const closingGapPx = Math.max(0, rear.currentWorldSpeed - front.currentWorldSpeed) * TUNING.trafficFollowingLookaheadSeconds;
          const safeGapPx = baseGapPx + closingGapPx;
          const deeplyCompressed = gapPx < baseGapPx * TUNING.trafficCompressionGapRatio;

          rear.followingGapPx = gapPx;

          if (gapPx < safeGapPx) {
            rear.blockedById = front.id;
            targetWorldSpeed = front.currentWorldSpeed;
            speedStep = targetWorldSpeed >= rear.currentWorldSpeed ? accelStep : deeplyCompressed ? emergencyBrakeStep : brakeStep;
          }
        }

        rear.currentWorldSpeed = moveToward(rear.currentWorldSpeed, targetWorldSpeed, speedStep);
      }
    }
  }

  private moveTraffic(delta: number) {
    const nextYById = new Map<number, number>();

    for (const car of this.state.traffic) {
      const relativeYSpeed = getTrafficScreenYSpeed(this.state.speed, car.currentWorldSpeed);
      nextYById.set(car.id, car.y + relativeYSpeed * delta);
    }

    for (const laneCars of this.getTrafficByLaneSorted((car) => nextYById.get(car.id) ?? car.y)) {
      for (let index = 1; index < laneCars.length; index += 1) {
        const front = laneCars[index - 1];
        const rear = laneCars[index];
        const frontY = nextYById.get(front.id) ?? front.y;
        const rearY = nextYById.get(rear.id) ?? rear.y;
        const minRearY = frontY + front.height + TUNING.trafficMinPhysicalGapPx;

        if (rearY < minRearY) {
          nextYById.set(rear.id, Math.max(rearY, minRearY));
          rear.emergencyCorrected = true;
        }
      }
    }

    for (const car of this.state.traffic) {
      car.y = nextYById.get(car.id) ?? car.y;
    }
  }

  private getTrafficByLaneSorted(getY: (car: TrafficCar) => number = (car) => car.y) {
    const lanes = new Map<number, TrafficCar[]>();

    for (const car of this.state.traffic) {
      const laneCars = lanes.get(car.lane);

      if (laneCars) {
        laneCars.push(car);
      } else {
        lanes.set(car.lane, [car]);
      }
    }

    return [...lanes.values()].map((laneCars) => laneCars.sort((a, b) => getY(a) - getY(b)));
  }

  private updateCrashing(delta: number) {
    const crash = this.state.crash;

    if (!crash) {
      this.finishRunAfterCrash();
      return;
    }

    crash.age += delta;
    this.state.speed = Math.max(
      crash.roadSpeedAtImpact * crash.minRoadSpeedRatio,
      this.state.speed * Math.exp(-crash.roadSlowdownRate * delta)
    );
    this.state.stripeOffset = (this.state.stripeOffset - this.state.speed * delta * TUNING.stripeSpeedScale) % TUNING.stripeRepeatDistance;
    this.updateCrashMotion(crash.player, delta);
    this.updateCrashMotion(crash.traffic, delta);

    for (const car of this.state.traffic) {
      if (car.id === crash.hitTrafficId) {
        continue;
      }

      const relativeYSpeed = getTrafficScreenYSpeed(this.state.speed, car.currentWorldSpeed);
      car.y += relativeYSpeed * delta;
    }

    this.state.traffic = this.getActiveTraffic();
    this.state.feedbacks = this.state.feedbacks
      .map((feedback) => ({ ...feedback, age: feedback.age + delta }))
      .filter((feedback) => feedback.age < feedback.life);

    if (crash.age >= crash.duration) {
      this.finishRunAfterCrash();
    }
  }

  private updateCrashMotion(motion: CrashVehicleMotion, delta: number) {
    motion.offsetX += motion.velocityX * delta;
    motion.offsetY += motion.velocityY * delta;
    motion.yawDeg += motion.angularVelocityDeg * delta;
    motion.velocityX *= Math.exp(-TUNING.crashLinearDamping * delta);
    motion.velocityY *= Math.exp(-TUNING.crashLinearDamping * delta);
    motion.angularVelocityDeg *= Math.exp(-TUNING.crashAngularDamping * delta);
  }

  private getActiveTraffic() {
    const upperOffscreenLimit = -this.state.height * TUNING.trafficOffscreenPullAwayScreens;

    return this.state.traffic.filter((car) => car.y < this.state.height + car.height && car.y + car.height > upperOffscreenLimit);
  }

  private updatePlayerHandling(delta: number) {
    const player = this.state.player;
    const steerTarget = this.state.input.steer;
    const steerDelta = steerTarget - player.inputSteer;
    player.inputSteer += steerDelta * Math.min(1, TUNING.steerRiseRate * delta);

    const speedRatio = clamp((this.state.speed - TUNING.minSpeed) / (TUNING.maxSpeed - TUNING.minSpeed), 0, 1);
    const maxLatSpeed = TUNING.maxLatSpeedLow + (TUNING.maxLatSpeedHigh - TUNING.maxLatSpeedLow) * speedRatio;
    const counterSteer =
      player.inputSteer !== 0 && Math.sign(player.inputSteer) !== Math.sign(player.lateralVelocity) ? TUNING.counterSteerBonus : 0;
    const damping = player.inputSteer === 0 ? TUNING.coastLateralDamping : TUNING.activeLateralDamping + counterSteer;

    player.lateralVelocity += player.inputSteer * TUNING.lateralAccel * delta;
    player.lateralVelocity -= player.lateralVelocity * Math.min(1, damping * delta);
    player.lateralVelocity = clamp(player.lateralVelocity, -maxLatSpeed, maxLatSpeed);
    player.lanePosition += player.lateralVelocity * delta;

    if (
      this.isBetweenLanes() &&
      this.state.speed > TUNING.cruiseSpeed + TUNING.safeChannelInstabilitySpeedOffset &&
      this.state.safeChannelTimer > TUNING.safeChannelWindow
    ) {
      player.lateralVelocity += Math.sin(this.state.elapsed * TUNING.safeChannelInstabilityFrequency) * TUNING.safeChannelInstability * delta;
    }

    player.x = this.getLanePositionCenter(player.lanePosition) - player.width / 2;

    const yawTarget =
      (player.lateralVelocity / maxLatSpeed) * TUNING.visualYawMaxDeg +
      player.inputSteer * TUNING.visualYawMaxDeg * TUNING.visualYawSteerInfluence;
    player.visualYaw += (clamp(yawTarget, -TUNING.visualYawMaxDeg, TUNING.visualYawMaxDeg) - player.visualYaw) * Math.min(1, TUNING.visualYawReturnRate * delta);
  }

  private canAwardNearMiss(car: TrafficCar, relativeYSpeed: number) {
    const vehicleConfig = getVehicleConfig(car.vehicleConfigId);
    const playerTransform = getPlayerVehicleTransform(this.state.player);
    const trafficTransform = getTrafficVehicleTransform(car, vehicleConfig);
    const playerCollisionZones = getVehicleCollisionPolygons(playerTransform);
    const trafficCollisionZones = getVehicleCollisionPolygons(trafficTransform);
    const playerNearMissZones = getVehicleNearMissPolygons(playerTransform);
    const trafficNearMissZones = getVehicleNearMissPolygons(trafficTransform);

    return (
      relativeYSpeed >= TUNING.minNearMissRelativeSpeed &&
      isVehicleNearMissOverlap(playerNearMissZones, trafficNearMissZones, playerCollisionZones, trafficCollisionZones)
    );
  }

  private awardNearMiss(car: TrafficCar) {
    const baselineSpeed = getBaselineSpeed(this.state.elapsed);
    const speedBonusFactor = this.state.input.brake || this.state.speed < baselineSpeed * 0.92 ? SCORE_TUNING.brakingNearMissPenalty : 1;
    const bonus = Math.round(getNearMissBonus(this.state.streak) * speedBonusFactor);

    car.nearMissed = true;
    car.streakAccounted = true;
    this.state.nearMisses += 1;
    this.state.streak += 1;
    this.state.comboTimer = SCORE_TUNING.comboWindow;
    this.state.bonusScore += bonus;
    this.state.message = `${getFeedbackForStreak(this.state.streak)} +${bonus}`;

    const isComboMilestone = this.state.streak > 0 && this.state.streak % TUNING.comboMilestoneInterval === 0;
    const isMajorNearMiss = bonus >= TUNING.minimumScoreForCallout;

    if (isComboMilestone || isMajorNearMiss) {
      this.addFeedback(this.state.message, car.x + car.width / 2, "bonus", isComboMilestone ? "high" : "medium", "callout");
      return;
    }

    this.addFeedback(`+${bonus}`, car.x + car.width / 2, "bonus", "low", "score");
  }

  private updateLaneSplitPressure(delta: number) {
    const betweenLanes = this.isBetweenLanes();
    const nearbySplitTraffic = this.getNearbySplitTrafficCount();
    this.state.safeChannelActive = betweenLanes;

    if (betweenLanes && nearbySplitTraffic === 0) {
      this.state.safeChannelTimer += delta;
      if (this.state.safeChannelTimer > TUNING.safeChannelWindow && this.state.comboTimer > 0) {
        this.state.comboTimer = Math.max(0, this.state.comboTimer - delta * TUNING.safeChannelComboDecayRate);
      }
      return;
    }

    if (!betweenLanes) {
      this.state.safeChannelTimer = Math.max(0, this.state.safeChannelTimer - delta * TUNING.safeChannelRecoveryRate);
      return;
    }

    this.state.safeChannelTimer = Math.max(0, this.state.safeChannelTimer - delta * TUNING.safeChannelTrafficRecoveryRate);

    if (
      nearbySplitTraffic >= TUNING.laneSplitBonusThreshold &&
      this.state.laneSplitCooldown === 0 &&
      Math.abs(this.state.player.lateralVelocity) >= TUNING.laneSplitMinLateralSpeed
    ) {
      const bonus = Math.round(TUNING.laneSplitBonus * (this.state.input.brake ? SCORE_TUNING.brakingNearMissPenalty : 1));
      this.state.bonusScore += bonus;
      this.state.nearMisses += 1;
      this.state.streak += 1;
      this.state.comboTimer = SCORE_TUNING.comboWindow;
      this.state.laneSplitCooldown = TUNING.laneSplitCooldown;
      this.state.message = this.state.streak >= 3 ? `THREAD THE GAP +${bonus}` : `LANE SPLIT +${bonus}`;
      this.addFeedback(this.state.message, this.state.player.x + this.state.player.width / 2, "bonus", "medium", "callout");
    }
  }

  private isBetweenLanes() {
    const fractionalLane = this.state.player.lanePosition - Math.floor(this.state.player.lanePosition);
    const distanceToSeam = Math.abs(fractionalLane - 0.5);

    return distanceToSeam <= TUNING.safeChannelBand;
  }

  private getNearbySplitTrafficCount() {
    const playerCenterX = this.state.player.x + this.state.player.width / 2;

    return this.state.traffic.filter((car) => {
      const trafficCenterX = car.x + car.width / 2;
      const inYRange = Math.abs((car.y + car.height / 2) - (this.state.player.y + this.state.player.height / 2)) <= TUNING.laneSplitTrafficYRange;
      const adjacentSide = Math.abs(trafficCenterX - playerCenterX) <= this.state.laneSystem.laneWidth * TUNING.laneSplitTrafficXRangeLanes;

      return inYRange && adjacentSide && !this.isPlayerCollidingWithTraffic(car);
    }).length;
  }

  private startCrash(hitCar: TrafficCar, relativeYSpeed: number) {
    const runEndMessage = chooseRunEndMessage(this.lastRunEndMessage);
    this.lastRunEndMessage = runEndMessage;
    const playerCenter = getBoundsCenter(this.state.player);
    const trafficCenter = getBoundsCenter(hitCar);
    const normal = normalizeVector(playerCenter.x - trafficCenter.x, playerCenter.y - trafficCenter.y, 0, -1);
    const impactSide = getImpactSide(normal.x, normal.y);
    const speedRatio = clamp(this.state.speed / TUNING.maxSpeed, 0.35, 1);
    const momentumRatio = getCrashMomentumRatio(this.state.speed);
    const sideSign = normal.x >= 0 ? 1 : -1;
    const playerLateralPixels = this.state.player.lateralVelocity * this.state.laneSystem.laneWidth;
    const rearEndFactor = normal.y > 0.35 ? 1.2 : 0.85;
    const crashDuration = lerp(TUNING.crashDurationLowSpeed, TUNING.crashDurationHighSpeed, momentumRatio);
    const roadSlowdownRate = lerp(TUNING.crashRoadSlowdownRateLowSpeed, TUNING.crashRoadSlowdownRateHighSpeed, momentumRatio);
    const minRoadSpeedRatio = lerp(TUNING.crashMinRoadSpeedRatioLowSpeed, TUNING.crashMinRoadSpeedRatioHighSpeed, momentumRatio);

    this.state.status = "crashing";
    this.state.message = runEndMessage;
    this.state.input = {
      steer: 0,
      throttle: false,
      brake: false
    };
    this.state.player.inputSteer = 0;
    this.state.crash = {
      age: 0,
      duration: crashDuration,
      hitTrafficId: hitCar.id,
      normalX: normal.x,
      normalY: normal.y,
      impactSide,
      roadSpeedAtImpact: this.state.speed,
      roadSlowdownRate,
      minRoadSpeedRatio,
      finalMessage: runEndMessage,
      player: {
        offsetX: 0,
        offsetY: 0,
        velocityX: playerLateralPixels * 0.55 + normal.x * TUNING.playerCrashImpulse * speedRatio,
        velocityY: -90 * speedRatio + normal.y * 90,
        yawDeg: 0,
        angularVelocityDeg: sideSign * (180 + TUNING.playerSpinIntensity * speedRatio) + this.state.player.lateralVelocity * 80
      },
      traffic: {
        offsetX: 0,
        offsetY: 0,
        velocityX: -normal.x * TUNING.trafficCrashImpulse * speedRatio + playerLateralPixels * 0.25,
        velocityY: relativeYSpeed * 0.55 * rearEndFactor + Math.max(60, this.state.speed * 0.12),
        yawDeg: 0,
        angularVelocityDeg: -sideSign * (120 + TUNING.trafficSpinIntensity * speedRatio)
      }
    };
    this.emitSnapshot();
  }

  private finishRunAfterCrash() {
    const crash = this.state.crash;
    const runEndMessage = crash?.finalMessage || chooseRunEndMessage(this.lastRunEndMessage);

    if (!crash) {
      this.lastRunEndMessage = runEndMessage;
    }

    this.state.status = "gameOver";
    this.state.message = runEndMessage;
    this.addFeedback(runEndMessage, this.state.player.x + this.state.player.width / 2, "danger", "high", "callout");

    if (this.state.score > this.state.bestScore) {
      this.state.bestScore = this.state.score;
      this.onBestScore(this.state.score);
      this.addFeedback("NEW BEST", this.state.player.x + this.state.player.width / 2, "bonus", "high", "callout");
    }

    this.emitSnapshot();
  }

  private addFeedback(text: string, preferredX: number, tone: Feedback["tone"], priority: FeedbackPriority, variant: Feedback["variant"]) {
    if (!this.canShowFeedback(priority, variant)) {
      return;
    }

    const position = this.getFeedbackPosition(preferredX, variant);

    if (variant === "callout") {
      this.state.nextFeedbackAt = this.state.elapsed + TUNING.feedbackCooldownMs / 1000;
    }

    this.state.feedbacks.push({
      id: this.nextFeedbackId,
      text,
      x: position.x,
      y: position.y,
      age: 0,
      life: (variant === "callout" ? TUNING.messageLifetimeMs : TUNING.scorePopupLifetimeMs) / 1000,
      tone,
      priority,
      variant
    });
    this.trimFeedbacks();
    this.nextFeedbackId += 1;
  }

  private canShowFeedback(priority: FeedbackPriority, variant: Feedback["variant"]) {
    const priorityWeight = FEEDBACK_PRIORITY_WEIGHT[priority];
    const hasHigherPriorityActive = this.state.feedbacks.some((feedback) => FEEDBACK_PRIORITY_WEIGHT[feedback.priority] > priorityWeight);

    if (hasHigherPriorityActive) {
      return false;
    }

    if (variant === "callout" && priority !== "high" && this.state.elapsed < this.state.nextFeedbackAt) {
      return false;
    }

    return true;
  }

  private trimFeedbacks() {
    this.state.feedbacks = [...this.state.feedbacks]
      .sort((a, b) => FEEDBACK_PRIORITY_WEIGHT[b.priority] - FEEDBACK_PRIORITY_WEIGHT[a.priority] || a.age - b.age)
      .slice(0, TUNING.maxActiveFeedbackMessages);
  }

  private getFeedbackPosition(preferredX: number, variant: Feedback["variant"]) {
    const side = preferredX < this.state.laneSystem.roadLeft + this.state.laneSystem.roadWidth / 2 ? "left" : "right";
    const sideX =
      side === "left"
        ? this.state.laneSystem.roadLeft + this.state.laneSystem.roadWidth * 0.18
        : this.state.laneSystem.roadLeft + this.state.laneSystem.roadWidth * 0.82;
    const activeOffset = Math.min(this.state.feedbacks.length, TUNING.maxActiveFeedbackMessages - 1) * 24;

    return {
      x: variant === "callout" ? clamp(sideX, 58, this.state.width - 58) : clamp(sideX, 44, this.state.width - 44),
      y: variant === "callout" ? 108 + activeOffset : 142 + activeOffset
    };
  }

  private render() {
    renderNearMiss(this.ctx, this.state);
  }

  private isPlayerCollidingWithTraffic(car: TrafficCar) {
    const vehicleConfig = getVehicleConfig(car.vehicleConfigId);
    const playerZones = getVehicleCollisionPolygons(getPlayerVehicleTransform(this.state.player));
    const trafficZones = getVehicleCollisionPolygons(getTrafficVehicleTransform(car, vehicleConfig));

    return doVehicleZonesOverlap(playerZones, trafficZones);
  }

  private clampPlayerToRoad() {
    const minX = this.state.laneSystem.roadLeft + TUNING.roadEdgePadding;
    const maxX = this.state.laneSystem.roadLeft + this.state.laneSystem.roadWidth - this.state.player.width - TUNING.roadEdgePadding;
    const minLane = (minX + this.state.player.width / 2 - this.state.laneSystem.roadLeft) / this.state.laneSystem.laneWidth - 0.5;
    const maxLane = (maxX + this.state.player.width / 2 - this.state.laneSystem.roadLeft) / this.state.laneSystem.laneWidth - 0.5;

    if (this.state.player.x < minX) {
      this.state.player.x = minX;
      this.state.player.lanePosition = minLane;
      this.state.player.lateralVelocity = Math.max(0, this.state.player.lateralVelocity * TUNING.edgeDamping);
    }

    if (this.state.player.x > maxX) {
      this.state.player.x = maxX;
      this.state.player.lanePosition = maxLane;
      this.state.player.lateralVelocity = Math.min(0, this.state.player.lateralVelocity * TUNING.edgeDamping);
    }
  }

  private getLanePositionCenter(lanePosition: number) {
    return this.state.laneSystem.roadLeft + this.state.laneSystem.laneWidth * (lanePosition + 0.5);
  }

  private emitSnapshot() {
    this.onSnapshot(this.getSnapshot());
  }

  private stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function moveToward(value: number, target: number, maxDelta: number) {
  if (value < target) {
    return Math.min(target, value + maxDelta);
  }

  return Math.max(target, value - maxDelta);
}

function getTrafficScreenYSpeed(playerWorldSpeed: number, trafficWorldSpeed: number) {
  const relativeSpeed = playerWorldSpeed - trafficWorldSpeed;
  const nearSpeedDeadzone = internalSpeedFromMph(TUNING.trafficNearSpeedDeadzoneMph);

  if (relativeSpeed >= 0) {
    if (relativeSpeed <= nearSpeedDeadzone) {
      return relativeSpeed * 0.35;
    }

    const adjustedRelativeSpeed = relativeSpeed - nearSpeedDeadzone;
    const approachCurveScale = internalSpeedFromMph(TUNING.trafficApproachCurveScaleMph);
    const maxApproachSpeed = internalSpeedFromMph(TUNING.trafficMaxApproachScreenSpeedMph);
    const shapedApproachSpeed = maxApproachSpeed * (1 - Math.exp(-adjustedRelativeSpeed / approachCurveScale));

    return Math.max(TUNING.minScreenApproachSpeed, Math.min(relativeSpeed, shapedApproachSpeed));
  }

  const pullAwaySpeed = Math.abs(relativeSpeed);

  if (pullAwaySpeed <= nearSpeedDeadzone) {
    return relativeSpeed * 0.25;
  }

  const adjustedPullAwaySpeed = pullAwaySpeed - nearSpeedDeadzone;
  const pullAwayCurveScale = internalSpeedFromMph(TUNING.trafficPullAwayCurveScaleMph);
  const maxPullAwaySpeed = internalSpeedFromMph(TUNING.trafficMaxPullAwayScreenSpeedMph);
  const shapedPullAwaySpeed = maxPullAwaySpeed * (1 - Math.exp(-adjustedPullAwaySpeed / pullAwayCurveScale));

  return -Math.min(pullAwaySpeed, shapedPullAwaySpeed);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function getCrashMomentumRatio(speed: number) {
  return clamp((speed - TUNING.cruiseSpeed) / (TUNING.crashSpeedMomentumThreshold - TUNING.cruiseSpeed), 0, 1);
}

function getBoundsCenter(bounds: CarBounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}

function normalizeVector(x: number, y: number, fallbackX: number, fallbackY: number) {
  const length = Math.hypot(x, y);

  if (length < 0.0001) {
    return {
      x: fallbackX,
      y: fallbackY
    };
  }

  return {
    x: x / length,
    y: y / length
  };
}

function getImpactSide(normalX: number, normalY: number): CrashImpactSide {
  if (Math.abs(normalX) < 0.2 && Math.abs(normalY) < 0.2) {
    return "center";
  }

  if (Math.abs(normalX) > Math.abs(normalY)) {
    return normalX > 0 ? "right" : "left";
  }

  return normalY > 0 ? "front" : "rear";
}

function createNearMissLaneSystem(width: number): LaneSystem {
  const laneSystem = createLaneSystem(width, TUNING.laneCount);
  const roadWidth = laneSystem.roadWidth * TUNING.roadWidthScale;
  const roadLeft = (width - roadWidth) / 2;
  const laneWidth = roadWidth / laneSystem.lanes;
  const centers = Array.from({ length: laneSystem.lanes }, (_, index) => roadLeft + laneWidth * (index + 0.5));

  return {
    ...laneSystem,
    roadLeft,
    roadWidth,
    laneWidth,
    centers
  };
}

function getVehicleSizingLaneWidth(laneSystem: LaneSystem) {
  return laneSystem.laneWidth / TUNING.roadWidthScale;
}
