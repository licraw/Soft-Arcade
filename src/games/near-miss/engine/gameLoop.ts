import { createLaneSystem, getLaneCenter } from "@/games/shared/car/laneSystem";
import type { CarBounds, LaneSystem } from "@/games/shared/car/types";
import { hasPlayerPassedTraffic, intersects, isNearMiss } from "./collision";
import type { NearMissInputState } from "./input";
import { getDistanceScore, getFeedbackForStreak, getNearMissBonus, getSurvivalScore } from "./scoring";
import { getSpawnInterval, spawnTrafficCar, type TrafficCar } from "./spawner";
import { renderNearMiss } from "../render/canvasRenderer";

type GameStatus = "ready" | "running" | "gameOver";

export type NearMissSnapshot = {
  status: GameStatus;
  score: number;
  speed: number;
  distance: number;
  elapsed: number;
  nearMisses: number;
  streak: number;
  bestScore: number;
  message: string;
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
  velocityX: number;
};

export type NearMissRuntimeState = {
  status: GameStatus;
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
  bestScore: number;
  stripeOffset: number;
  message: string;
  input: NearMissInputState;
};

type NearMissGameLoopOptions = {
  canvas: HTMLCanvasElement;
  bestScore: number;
  onSnapshot: (snapshot: NearMissSnapshot) => void;
  onBestScore: (score: number) => void;
};

const TUNING = {
  laneCount: 4,
  minSpeed: 190,
  cruiseSpeed: 285,
  maxSpeed: 680,
  speedRampPerSecond: 6.8,
  throttleAcceleration: 185,
  brakeDeceleration: 250,
  speedReturnRate: 1.8,
  steeringAcceleration: 1900,
  maxSteerVelocity: 520,
  steerFriction: 7.6,
  edgeDamping: 0.24,
  carWidthRatio: 0.48,
  carHeightRatio: 1.34
};

const READY_MESSAGE = "THREAD THE GAP";
const GAME_OVER_MESSAGE = "TOO CLOSE";

export class NearMissGameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrame = 0;
  private lastFrame = 0;
  private spawnTimer = 0;
  private nextTrafficId = 1;
  private nextFeedbackId = 1;
  private lastSnapshotAt = 0;
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

    const laneSystem = createLaneSystem(displayWidth, TUNING.laneCount);
    const carWidth = Math.min(62, laneSystem.laneWidth * TUNING.carWidthRatio);
    const carHeight = carWidth * TUNING.carHeightRatio;
    const playerCenterRatio = this.state.width
      ? (this.state.player.x + this.state.player.width / 2 - this.state.laneSystem.roadLeft) / this.state.laneSystem.roadWidth
      : 0.5;
    const minX = laneSystem.roadLeft + 8;
    const maxX = laneSystem.roadLeft + laneSystem.roadWidth - carWidth - 8;
    const playerX = clamp(laneSystem.roadLeft + laneSystem.roadWidth * playerCenterRatio - carWidth / 2, minX, maxX);

    this.state.width = displayWidth;
    this.state.height = displayHeight;
    this.state.laneSystem = laneSystem;
    this.state.player = {
      ...this.state.player,
      x: playerX,
      y: displayHeight - carHeight - 34,
      width: carWidth,
      height: carHeight
    };

    for (const car of this.state.traffic) {
      car.width = carWidth * 0.98;
      car.height = carHeight * 1.02;
      car.x = getLaneCenter(laneSystem, Math.min(car.lane, laneSystem.lanes - 1)) - car.width / 2;
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
      speed: this.state.speed / 5.2,
      distance: this.state.distance,
      elapsed: this.state.elapsed,
      nearMisses: this.state.nearMisses,
      streak: this.state.streak,
      bestScore: this.state.bestScore,
      message: this.state.message
    };
  }

  private createInitialState(bestScore: number): NearMissRuntimeState {
    const width = this.canvas.clientWidth || 720;
    const height = this.canvas.clientHeight || 620;
    const laneSystem = createLaneSystem(width, TUNING.laneCount);
    const carWidth = Math.min(62, laneSystem.laneWidth * TUNING.carWidthRatio);
    const carHeight = carWidth * TUNING.carHeightRatio;
    const startLane = Math.floor(laneSystem.lanes / 2);
    const playerX = getLaneCenter(laneSystem, startLane) - carWidth / 2;

    return {
      status: "ready",
      width,
      height,
      laneSystem,
      player: {
        x: playerX,
        y: height - carHeight - 34,
        width: carWidth,
        height: carHeight,
        velocityX: 0
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
      bestScore,
      stripeOffset: 0,
      message: READY_MESSAGE,
      input: {
        steer: 0,
        throttle: false,
        brake: false
      }
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
    const carWidth = state.player.width;
    const carHeight = state.player.height;
    const baselineSpeed = Math.min(TUNING.maxSpeed - 80, TUNING.cruiseSpeed + state.elapsed * TUNING.speedRampPerSecond);

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
    state.stripeOffset = (state.stripeOffset - state.speed * delta * 0.52) % 54;
    state.player.velocityX += state.input.steer * TUNING.steeringAcceleration * delta;

    if (state.input.steer === 0) {
      state.player.velocityX -= state.player.velocityX * Math.min(1, TUNING.steerFriction * delta);
    }

    state.player.velocityX = clamp(state.player.velocityX, -TUNING.maxSteerVelocity, TUNING.maxSteerVelocity);
    state.player.x += state.player.velocityX * delta;
    this.clampPlayerToRoad();

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      const spawned = spawnTrafficCar({
        laneSystem: state.laneSystem,
        traffic: state.traffic,
        carWidth,
        carHeight,
        nextId: this.nextTrafficId,
        elapsed: state.elapsed
      });

      if (spawned) {
        state.traffic.push(spawned);
        this.nextTrafficId += 1;
      }

      this.spawnTimer = getSpawnInterval(state.speed) * (0.82 + Math.random() * 0.34);
    }

    for (const car of state.traffic) {
      car.y += (state.speed + car.speedOffset) * delta;

      if (!car.nearMissed && isNearMiss(state.player, car) && hasPlayerPassedTraffic(state.player, car)) {
        this.awardNearMiss(car);
      }

      if (!car.passed && car.y > state.player.y + state.player.height) {
        car.passed = true;
        state.streak = Math.max(0, state.streak - 1);
      }

      if (intersects(state.player, car)) {
        this.endRun();
        return;
      }
    }

    state.traffic = state.traffic.filter((car) => car.y < state.height + car.height);
    state.feedbacks = state.feedbacks
      .map((feedback) => ({ ...feedback, age: feedback.age + delta }))
      .filter((feedback) => feedback.age < feedback.life);
    const speedScoreFactor = state.speed < baselineSpeed ? 0.92 : 1;
    state.score = Math.floor(
      (getDistanceScore(state.distance) + getSurvivalScore(state.elapsed)) * speedScoreFactor + state.bonusScore + state.streak * 40
    );
  }

  private awardNearMiss(car: TrafficCar) {
    const baselineSpeed = Math.min(TUNING.maxSpeed - 80, TUNING.cruiseSpeed + this.state.elapsed * TUNING.speedRampPerSecond);
    const speedBonusFactor = this.state.input.brake || this.state.speed < baselineSpeed * 0.92 ? 0.84 : 1;
    const bonus = Math.round(getNearMissBonus(this.state.streak) * speedBonusFactor);

    car.nearMissed = true;
    this.state.nearMisses += 1;
    this.state.streak += 1;
    this.state.bonusScore += bonus;
    this.state.message = `${getFeedbackForStreak(this.state.streak)} +${bonus}`;
    this.addFeedback(this.state.message, car.x + car.width / 2, Math.max(84, car.y), "bonus");
  }

  private endRun() {
    this.state.status = "gameOver";
    this.state.message = GAME_OVER_MESSAGE;
    this.addFeedback(GAME_OVER_MESSAGE, this.state.player.x + this.state.player.width / 2, this.state.player.y - 8, "danger");

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
      life: 0.92,
      tone
    });
    this.nextFeedbackId += 1;
  }

  private render() {
    renderNearMiss(this.ctx, this.state);
  }

  private clampPlayerToRoad() {
    const minX = this.state.laneSystem.roadLeft + 8;
    const maxX = this.state.laneSystem.roadLeft + this.state.laneSystem.roadWidth - this.state.player.width - 8;

    if (this.state.player.x < minX) {
      this.state.player.x = minX;
      this.state.player.velocityX = Math.max(0, this.state.player.velocityX * TUNING.edgeDamping);
    }

    if (this.state.player.x > maxX) {
      this.state.player.x = maxX;
      this.state.player.velocityX = Math.min(0, this.state.player.velocityX * TUNING.edgeDamping);
    }
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
