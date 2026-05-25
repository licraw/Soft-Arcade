import { drawRoad } from "./road";
import { drawArcadeCar, playerCarPalette, trafficCarPalettes } from "./sprites";
import { expandBounds, insetBounds } from "../engine/collision";
import type { NearMissRuntimeState } from "../engine/gameLoop";
import { NEAR_MISS_TUNING as TUNING } from "../engine/tuning";
import blueSedanAsset from "../ui/blue-sedan.svg";
import goldSedanAsset from "../ui/gold-sedan.svg";
import redCarAsset from "../ui/redcar.svg";

const redCarImage = typeof window !== "undefined" ? new Image() : null;
const redCarUrl = typeof redCarAsset === "string" ? redCarAsset : redCarAsset.src;
const blueSedanImage = typeof window !== "undefined" ? new Image() : null;
const blueSedanUrl = typeof blueSedanAsset === "string" ? blueSedanAsset : blueSedanAsset.src;
const goldSedanImage = typeof window !== "undefined" ? new Image() : null;
const goldSedanUrl = typeof goldSedanAsset === "string" ? goldSedanAsset : goldSedanAsset.src;

if (redCarImage) {
  redCarImage.src = redCarUrl;
}

if (blueSedanImage) {
  blueSedanImage.src = blueSedanUrl;
}

if (goldSedanImage) {
  goldSedanImage.src = goldSedanUrl;
}

export function renderNearMiss(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  drawRoad(ctx, state.laneSystem, state.width, state.height, state.stripeOffset);
  drawSpeedLines(ctx, state);

  for (const car of state.traffic) {
    ctx.save();
    ctx.globalAlpha = 0.86;
    drawTrafficSedan(ctx, car.x, car.y, car.width, car.height, car.paletteIndex);
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

function drawTrafficSedan(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, paletteIndex: number) {
  const sedanImage = paletteIndex % 2 === 0 ? blueSedanImage : goldSedanImage;
  const spriteScaleX = 2.28;
  const spriteScaleY = 1.42;
  const spriteWidth = width * spriteScaleX;
  const spriteHeight = height * spriteScaleY;

  ctx.shadowColor = paletteIndex % 2 === 0 ? "rgba(65, 171, 232, 0.22)" : "rgba(224, 172, 42, 0.18)";
  ctx.shadowBlur = 12;

  if (sedanImage?.complete && sedanImage.naturalWidth > 0) {
    ctx.drawImage(sedanImage, x + width / 2 - spriteWidth / 2, y + height / 2 - spriteHeight / 2, spriteWidth, spriteHeight);
    return;
  }

  drawArcadeCar(ctx, {
    x,
    y,
    width,
    height,
    palette: trafficCarPalettes[paletteIndex % trafficCarPalettes.length],
    direction: "up"
  });
}

function drawMainCar(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const { x, y, width, height, visualYaw } = state.player;
  const spriteScaleX = 2.08;
  const spriteScaleY = 1.2;
  const spriteWidth = width * spriteScaleX;
  const spriteHeight = height * spriteScaleY;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(((visualYaw + 180) * Math.PI) / 180);
  ctx.translate(-x - width / 2, -y - height / 2);
  ctx.shadowColor = "rgba(255, 77, 90, 0.46)";
  ctx.shadowBlur = 22;

  if (redCarImage?.complete && redCarImage.naturalWidth > 0) {
    ctx.drawImage(redCarImage, x + width / 2 - spriteWidth / 2, y + height / 2 - spriteHeight / 2, spriteWidth, spriteHeight);
  } else {
    drawArcadeCar(ctx, {
      x,
      y,
      width,
      height,
      palette: playerCarPalette,
      direction: "up"
    });
  }

  ctx.restore();
}

function drawDebugOverlays(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const playerHitbox = insetBounds(state.player, TUNING.playerHitboxWidth, TUNING.playerHitboxHeight);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(60, 255, 143, 0.85)";
  strokeBounds(ctx, playerHitbox);
  ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
  strokeBounds(ctx, expandBounds(playerHitbox, TUNING.nearMissGrowX, TUNING.nearMissGrowY));

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
    const trafficHitbox = insetBounds(car, TUNING.trafficHitboxWidth, TUNING.trafficHitboxHeight);
    ctx.strokeStyle = "rgba(255, 77, 90, 0.75)";
    strokeBounds(ctx, trafficHitbox);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.32)";
    strokeBounds(ctx, expandBounds(trafficHitbox, TUNING.nearMissGrowX * 0.7, TUNING.nearMissGrowY));
    ctx.strokeStyle = "rgba(60, 255, 143, 0.45)";
    const corridorX = state.laneSystem.centers[car.corridorLane];
    ctx.beginPath();
    ctx.moveTo(corridorX, Math.max(0, car.y - 12));
    ctx.lineTo(corridorX, Math.min(state.height, car.y + car.height + 12));
    ctx.stroke();
    ctx.fillStyle = "rgba(244, 242, 238, 0.72)";
    ctx.font = "700 10px Arial, Helvetica, sans-serif";
    ctx.fillText(`${car.packetId} c${car.corridorLane}`, car.x, Math.max(12, car.y - 4));
  }
  ctx.restore();
}

function strokeBounds(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }) {
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const intensity = Math.max(0, Math.min(1, (state.speed - 360) / 260));

  if (intensity <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.1 + intensity * 0.2;
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 1 + intensity * 2;

  for (let index = 0; index < 12; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side < 0 ? state.laneSystem.roadLeft - 18 - (index % 3) * 14 : state.laneSystem.roadLeft + state.laneSystem.roadWidth + 18 + (index % 3) * 14;
    const y = (index * 89 + Math.abs(state.stripeOffset) * 4) % (state.height + 120) - 80;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * 10, y + 56 + intensity * 52);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0, 229, 255, 0.06)";
  ctx.fillRect(state.laneSystem.roadLeft - 8, 0, 8, state.height);
  ctx.fillRect(state.laneSystem.roadLeft + state.laneSystem.roadWidth, 0, 8, state.height);
  ctx.restore();
}
