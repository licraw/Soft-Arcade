import { drawRoad } from "./road";
import type { NearMissRuntimeState } from "../engine/gameLoop";
import {
  getPlayerHitbox,
  getPlayerNearMissShell,
  getTrafficHitbox,
  getTrafficNearMissShell,
  NEAR_MISS_TUNING as TUNING
} from "../engine/tuning";
import { getVehicleConfig, NEAR_MISS_VEHICLE_CONFIGS, PLAYER_VEHICLE_ID } from "../engine/vehicleConfig";

const vehicleImages = new Map<string, HTMLImageElement>();

if (typeof window !== "undefined") {
  for (const config of NEAR_MISS_VEHICLE_CONFIGS) {
    const image = new Image();
    image.src = config.spritePath;
    vehicleImages.set(config.id, image);
  }
}

export function renderNearMiss(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  drawRoad(ctx, state.laneSystem, state.width, state.height, state.stripeOffset);
  drawSpeedLines(ctx, state);

  for (const car of state.traffic) {
    ctx.save();
    ctx.globalAlpha = TUNING.trafficRenderAlpha;
    drawTrafficVehicle(ctx, car.x, car.y, car.width, car.height, car.vehicleConfigId);
    ctx.restore();
  }

  drawMainCar(ctx, state);

  if (state.debug) {
    drawDebugOverlays(ctx, state);
  }

  for (const feedback of state.feedbacks) {
    const age = feedback.age / feedback.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = feedback.tone === "danger" ? "#ff4d5a" : "#facc15";
    ctx.font = "700 18px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = feedback.tone === "danger" ? "rgba(255, 77, 90, 0.5)" : "rgba(250, 204, 21, 0.45)";
    ctx.shadowBlur = 14;
    ctx.fillText(feedback.text, feedback.x, feedback.y - age * 34);
    ctx.restore();
  }
}

function drawTrafficVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, vehicleConfigId: string) {
  const vehicleConfig = getVehicleConfig(vehicleConfigId);
  const vehicleImage = vehicleImages.get(vehicleConfig.id);
  const maxSpriteWidth = width * TUNING.trafficSpriteScaleX * vehicleConfig.uniformVisualScale;
  const maxSpriteHeight = height * TUNING.trafficSpriteScaleY * vehicleConfig.uniformVisualScale;

  ctx.shadowColor = vehicleConfig.vehicleClass === "van-truck" ? "rgba(60, 255, 143, 0.18)" : "rgba(65, 171, 232, 0.2)";
  ctx.shadowBlur = 12;

  if (vehicleImage?.complete && vehicleImage.naturalWidth > 0) {
    drawImagePreservingAspectRatio(ctx, vehicleImage, x + width / 2, y + height / 2, maxSpriteWidth, maxSpriteHeight);
    return;
  }

  drawMissingVehicleAsset(ctx, x + width / 2, y + height / 2, maxSpriteWidth, maxSpriteHeight);
}

function drawMainCar(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const { x, y, width, height, visualYaw } = state.player;
  const vehicleConfig = getVehicleConfig(PLAYER_VEHICLE_ID);
  const vehicleImage = vehicleImages.get(vehicleConfig.id);
  const maxSpriteWidth = width * TUNING.playerSpriteScaleX * vehicleConfig.uniformVisualScale;
  const maxSpriteHeight = height * TUNING.playerSpriteScaleY * vehicleConfig.uniformVisualScale;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(((visualYaw + 180) * Math.PI) / 180);
  ctx.translate(-x - width / 2, -y - height / 2);
  ctx.shadowColor = "rgba(255, 77, 90, 0.46)";
  ctx.shadowBlur = 22;

  if (vehicleImage?.complete && vehicleImage.naturalWidth > 0) {
    drawImagePreservingAspectRatio(ctx, vehicleImage, x + width / 2, y + height / 2, maxSpriteWidth, maxSpriteHeight);
  } else {
    drawMissingVehicleAsset(ctx, x + width / 2, y + height / 2, maxSpriteWidth, maxSpriteHeight);
  }

  ctx.restore();
}

function drawImagePreservingAspectRatio(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number
) {
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  ctx.drawImage(image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
}

function drawMissingVehicleAsset(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, maxWidth: number, maxHeight: number) {
  const width = Math.min(maxWidth, 28);
  const height = Math.min(maxHeight, 42);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 77, 90, 0.72)";
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
  ctx.beginPath();
  ctx.moveTo(centerX - width / 2, centerY - height / 2);
  ctx.lineTo(centerX + width / 2, centerY + height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawDebugOverlays(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const playerHitbox = getPlayerHitbox(state.player);
  const playerConfig = getVehicleConfig(PLAYER_VEHICLE_ID);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(60, 255, 143, 0.85)";
  strokeBounds(ctx, playerHitbox);
  ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
  strokeBounds(ctx, getPlayerNearMissShell(playerHitbox));
  ctx.fillStyle = "rgba(244, 242, 238, 0.72)";
  ctx.font = "700 10px Arial, Helvetica, sans-serif";
  ctx.fillText(
    `${playerConfig.label} / ${playerConfig.vehicleClass} / visual yaw ${state.player.visualYaw.toFixed(1)}deg only`,
    state.player.x,
    Math.max(12, state.player.y - 4)
  );

  for (const center of state.laneSystem.centers) {
    ctx.strokeStyle = "rgba(125, 211, 252, 0.26)";
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, state.height);
    ctx.stroke();
  }

  for (let lane = 0; lane < state.laneSystem.lanes - 1; lane += 1) {
    const seamX = state.laneSystem.roadLeft + state.laneSystem.laneWidth * (lane + 1);
    ctx.strokeStyle = state.safeChannelActive ? "rgba(250, 204, 21, 0.68)" : "rgba(250, 204, 21, 0.22)";
    ctx.beginPath();
    ctx.moveTo(seamX, 0);
    ctx.lineTo(seamX, state.height);
    ctx.stroke();
  }

  for (const car of state.traffic) {
    const vehicleConfig = getVehicleConfig(car.vehicleConfigId);
    const trafficHitbox = getTrafficHitbox(car);
    ctx.strokeStyle = "rgba(255, 77, 90, 0.75)";
    strokeBounds(ctx, trafficHitbox);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.32)";
    strokeBounds(ctx, getTrafficNearMissShell(trafficHitbox));
    ctx.strokeStyle = "rgba(60, 255, 143, 0.45)";
    const corridorX = state.laneSystem.centers[car.corridorLane];
    ctx.beginPath();
    ctx.moveTo(corridorX, Math.max(0, car.y - 12));
    ctx.lineTo(corridorX, Math.min(state.height, car.y + car.height + 12));
    ctx.stroke();
    ctx.fillStyle = "rgba(244, 242, 238, 0.72)";
    ctx.font = "700 10px Arial, Helvetica, sans-serif";
    ctx.fillText(`${vehicleConfig.label} / ${vehicleConfig.vehicleClass} / ${car.packetId} c${car.corridorLane}`, car.x, Math.max(12, car.y - 4));
  }
  ctx.restore();
}

function strokeBounds(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }) {
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const intensity = Math.max(0, Math.min(1, (state.speed - TUNING.speedLineStartSpeed) / TUNING.speedLineSpeedRange));

  if (intensity <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = TUNING.speedLineBaseAlpha + intensity * TUNING.speedLineAlphaRange;
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = TUNING.speedLineBaseWidth + intensity * TUNING.speedLineWidthRange;

  for (let index = 0; index < TUNING.speedLineCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const sideOffset = TUNING.speedLineSideOffset + (index % 3) * TUNING.speedLineSideStep;
    const x =
      side < 0
        ? state.laneSystem.roadLeft - sideOffset
        : state.laneSystem.roadLeft + state.laneSystem.roadWidth + sideOffset;
    const y =
      (index * TUNING.speedLineSpacing + Math.abs(state.stripeOffset) * TUNING.speedLineStripeOffsetScale) %
        (state.height + TUNING.speedLineModuloPadding) -
      TUNING.speedLineYOffset;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * TUNING.speedLineSideDrift, y + TUNING.speedLineBaseLength + intensity * TUNING.speedLineLengthRange);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0, 229, 255, 0.06)";
  ctx.fillRect(state.laneSystem.roadLeft - TUNING.speedLineShoulderGlowWidth, 0, TUNING.speedLineShoulderGlowWidth, state.height);
  ctx.fillRect(state.laneSystem.roadLeft + state.laneSystem.roadWidth, 0, TUNING.speedLineShoulderGlowWidth, state.height);
  ctx.restore();
}
