import { drawRoad } from "./road";
import { drawArcadeCar, drawPlayerCar, playerCarPalette, trafficCarPalettes } from "./sprites";
import type { NearMissRuntimeState } from "../engine/gameLoop";

export function renderNearMiss(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  drawRoad(ctx, state.laneSystem, state.width, state.height, state.stripeOffset);
  drawSpeedLines(ctx, state);

  for (const car of state.traffic) {
    ctx.save();
    ctx.globalAlpha = 0.86;
    drawArcadeCar(ctx, {
      x: car.x,
      y: car.y,
      width: car.width,
      height: car.height,
      palette: trafficCarPalettes[car.paletteIndex % trafficCarPalettes.length],
      direction: "down"
    });
    ctx.restore();
  }

  drawPlayerCar(ctx, {
    x: state.player.x,
    y: state.player.y,
    width: state.player.width,
    height: state.player.height,
    palette: playerCarPalette,
    direction: "up"
  });

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
