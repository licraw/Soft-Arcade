import { createLaneSystem, getLaneCenter } from "@/games/shared/car/laneSystem";
import type { CarBounds, LaneSystem } from "@/games/shared/car/types";
import { hasPlayerPassedTraffic, intersects, isNearMissShellOverlap } from "./collision";
import type { NearMissInputState } from "./input";
import { NEAR_MISS_MODE_CONFIG, type NearMissMode } from "./modes";
import { chooseRunEndMessage } from "./runEndMessages";
import { getDistanceScore, getFeedbackForStreak, getNearMissBonus, getSpeedScore, getSurvivalScore, SCORE_TUNING } from "./scoring";
import { getSpawnInterval, spawnTrafficPacket, type TrafficCar } from "./spawner";
import {
  getBaselineSpeed,
  getDisplayedSpeed,
  getPlayerBodySize,
  getPlayerHitbox,
  getPlayerNearMissShell,
  getTrafficBodySize,
  getTrafficHitbox,
  getTrafficNearMissShell,
  NEAR_MISS_TUNING as TUNING
} from "./tuning";
import { getVehicleConfig } from "./vehicleConfig";
import { renderNearMiss } from "../render/canvasRenderer";

type GameStatus = "ready" | "running" | "gameOver";

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
};

type PlayerCar = CarBounds & {
  lanePosition: number;
  lateralVelocity: number;
  inputSteer: number;
  visualYaw: number;
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
  debug: boolean;
};

type NearMissGameLoopOptions = {
  canvas: HTMLCanvasElement;
  bestScore: number;
  onSnapshot: (snapshot: NearMissSnapshot) => void;
  onBestScore: (score: number) => void;
};

const READY_MESSAGE = "THREAD THE GAP";

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
    this.stop();
    this.state.status = "running";
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
    if (this.state.status === "ready") {
      this.start();
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
      debug: TUNING.debug
    };
  }

  private tick = (timestamp: number) => {
    const delta = Math.min(0.034, (timestamp - this.lastFrame) / 1000 || 0);
    this.lastFrame = timestamp;

    if (this.state.status === "running") {
      this.update(delta);
    }

    this.render();

    if (timestamp - this.lastSnapshotAt > 90 || this.state.status !== "running") {
      this.emitSnapshot();
      this.lastSnapshotAt = timestamp;
    }

    if (this.state.status === "running") {
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

    for (const car of state.traffic) {
      const relativeYSpeed = Math.max(TUNING.minRelativeTrafficSpeed, state.speed - car.forwardSpeed);
      car.y += relativeYSpeed * delta;

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

      if (intersects(this.getPlayerHitbox(), this.getTrafficHitbox(car))) {
        this.endRun();
        return;
      }
    }

    this.updateLaneSplitPressure(delta);

    state.traffic = state.traffic.filter((car) => car.y < state.height + car.height);
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
    const playerHitbox = this.getPlayerHitbox();
    const trafficHitbox = this.getTrafficHitbox(car);
    const playerShell = getPlayerNearMissShell(playerHitbox);
    const trafficShell = getTrafficNearMissShell(trafficHitbox, vehicleConfig);

    return relativeYSpeed >= TUNING.minNearMissRelativeSpeed && isNearMissShellOverlap(playerShell, trafficShell, playerHitbox, trafficHitbox);
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
    this.addFeedback(this.state.message, car.x + car.width / 2, Math.max(84, car.y), "bonus");
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
      this.addFeedback(this.state.message, this.state.player.x + this.state.player.width / 2, this.state.player.y - 22, "bonus");
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

      return inYRange && adjacentSide && !intersects(this.getPlayerHitbox(), this.getTrafficHitbox(car));
    }).length;
  }

  private endRun() {
    const runEndMessage = chooseRunEndMessage(this.lastRunEndMessage);
    this.lastRunEndMessage = runEndMessage;
    this.state.status = "gameOver";
    this.state.message = runEndMessage;
    this.addFeedback(runEndMessage, this.state.player.x + this.state.player.width / 2, this.state.player.y - 8, "danger");

    if (this.state.score > this.state.bestScore) {
      this.state.bestScore = this.state.score;
      this.onBestScore(this.state.score);
    }

    this.emitSnapshot();
  }

  private addFeedback(text: string, x: number, y: number, tone: Feedback["tone"]) {
    this.state.feedbacks.push({
      id: this.nextFeedbackId,
      text,
      x,
      y,
      age: 0,
      life: TUNING.feedbackLifeSeconds,
      tone
    });
    this.nextFeedbackId += 1;
  }

  private render() {
    renderNearMiss(this.ctx, this.state);
  }

  getPlayerHitbox() {
    return getPlayerHitbox(this.state.player);
  }

  getTrafficHitbox(car: TrafficCar) {
    return getTrafficHitbox(car, getVehicleConfig(car.vehicleConfigId));
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
