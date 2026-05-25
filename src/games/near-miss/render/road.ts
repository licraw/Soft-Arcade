import type { LaneSystem } from "@/games/shared/car/types";

export function drawRoad(ctx: CanvasRenderingContext2D, laneSystem: LaneSystem, width: number, height: number, stripeOffset: number) {
  drawRoadside(ctx, laneSystem, width, height, stripeOffset);

  const roadGradient = ctx.createLinearGradient(0, 0, 0, height);
  roadGradient.addColorStop(0, "#242733");
  roadGradient.addColorStop(0.55, "#171a22");
  roadGradient.addColorStop(1, "#101219");

  const roadLeft = laneSystem.roadLeft;
  const roadRight = laneSystem.roadLeft + laneSystem.roadWidth;

  ctx.fillStyle = roadGradient;
  ctx.fillRect(roadLeft, 0, laneSystem.roadWidth, height);

  drawShoulders(ctx, roadLeft, roadRight, height);
  drawBarriers(ctx, laneSystem, width, height, stripeOffset);

  ctx.fillStyle = "rgba(244, 242, 238, 0.12)";
  ctx.fillRect(roadLeft, 0, 2, height);
  ctx.fillRect(roadRight - 2, 0, 2, height);

  ctx.strokeStyle = "rgba(244, 242, 238, 0.16)";
  ctx.lineWidth = 2;
  ctx.setLineDash([28, 26]);
  ctx.lineDashOffset = stripeOffset;

  for (let lane = 1; lane < laneSystem.lanes; lane += 1) {
    const x = laneSystem.roadLeft + laneSystem.laneWidth * lane;
    ctx.beginPath();
    ctx.moveTo(x, -60);
    ctx.lineTo(x, height + 60);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawRoadside(ctx: CanvasRenderingContext2D, laneSystem: LaneSystem, width: number, height: number, stripeOffset: number) {
  const roadLeft = laneSystem.roadLeft;
  const roadRight = laneSystem.roadLeft + laneSystem.roadWidth;
  const grassGradient = ctx.createLinearGradient(0, 0, 0, height);
  grassGradient.addColorStop(0, "#183021");
  grassGradient.addColorStop(0.55, "#13271c");
  grassGradient.addColorStop(1, "#0d1d15");

  ctx.fillStyle = grassGradient;
  ctx.fillRect(0, 0, width, height);

  drawGrassTexture(ctx, 0, roadLeft, height, stripeOffset, -1);
  drawGrassTexture(ctx, roadRight, width - roadRight, height, stripeOffset, 1);
}

function drawGrassTexture(ctx: CanvasRenderingContext2D, x: number, width: number, height: number, stripeOffset: number, side: -1 | 1) {
  if (width <= 3) {
    return;
  }

  const spacing = 42;
  const offset = positiveModulo(Math.abs(stripeOffset) * 0.72, spacing);
  const bladeCount = Math.max(1, Math.floor(width / 10));

  ctx.save();
  ctx.strokeStyle = "rgba(91, 129, 74, 0.24)";
  ctx.lineWidth = 1;

  for (let y = -spacing; y < height + spacing; y += spacing) {
    const row = Math.floor((y + offset) / spacing);

    for (let index = 0; index < bladeCount; index += 1) {
      const localX = ((index + 0.35 + (row % 3) * 0.21) / bladeCount) * width;
      const startX = x + localX;
      const startY = y + offset + (index % 2) * 8;
      const bladeHeight = 5 + ((index + row) % 3) * 2;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + side * 3, startY - bladeHeight);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawShoulders(ctx: CanvasRenderingContext2D, roadLeft: number, roadRight: number, height: number) {
  const shoulderWidth = 12;

  ctx.fillStyle = "rgba(65, 63, 55, 0.45)";
  ctx.fillRect(roadLeft, 0, shoulderWidth, height);
  ctx.fillRect(roadRight - shoulderWidth, 0, shoulderWidth, height);

  ctx.fillStyle = "rgba(244, 242, 238, 0.22)";
  ctx.fillRect(roadLeft + shoulderWidth, 0, 1.5, height);
  ctx.fillRect(roadRight - shoulderWidth - 1.5, 0, 1.5, height);
}

function drawBarriers(ctx: CanvasRenderingContext2D, laneSystem: LaneSystem, width: number, height: number, stripeOffset: number) {
  const roadLeft = laneSystem.roadLeft;
  const roadRight = laneSystem.roadLeft + laneSystem.roadWidth;
  const leftRailX = Math.max(4, roadLeft - 5);
  const rightRailX = Math.min(width - 4, roadRight + 5);

  ctx.save();
  ctx.strokeStyle = "rgba(184, 181, 162, 0.34)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(leftRailX, 0);
  ctx.lineTo(leftRailX, height);
  ctx.moveTo(rightRailX, 0);
  ctx.lineTo(rightRailX, height);
  ctx.stroke();

  ctx.strokeStyle = "rgba(58, 56, 50, 0.42)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftRailX + 3, 0);
  ctx.lineTo(leftRailX + 3, height);
  ctx.moveTo(rightRailX - 3, 0);
  ctx.lineTo(rightRailX - 3, height);
  ctx.stroke();

  const postSpacing = 64;
  const postOffset = positiveModulo(Math.abs(stripeOffset) * 0.9, postSpacing);
  ctx.fillStyle = "rgba(214, 208, 177, 0.48)";

  for (let y = -postSpacing; y < height + postSpacing; y += postSpacing) {
    const postY = y + postOffset;
    ctx.fillRect(leftRailX - 2, postY, 4, 10);
    ctx.fillRect(rightRailX - 2, postY + postSpacing * 0.5, 4, 10);
  }

  ctx.restore();
}

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}
