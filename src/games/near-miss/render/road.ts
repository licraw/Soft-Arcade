import type { LaneSystem } from "@/games/shared/car/types";

export function drawRoad(ctx: CanvasRenderingContext2D, laneSystem: LaneSystem, width: number, height: number, stripeOffset: number) {
  const roadGradient = ctx.createLinearGradient(0, 0, 0, height);
  roadGradient.addColorStop(0, "#171923");
  roadGradient.addColorStop(0.52, "#10121a");
  roadGradient.addColorStop(1, "#090a0f");

  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = roadGradient;
  ctx.fillRect(laneSystem.roadLeft, 0, laneSystem.roadWidth, height);

  ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
  ctx.fillRect(laneSystem.roadLeft - 2, 0, 2, height);
  ctx.fillRect(laneSystem.roadLeft + laneSystem.roadWidth, 0, 2, height);

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

  const horizon = ctx.createRadialGradient(width / 2, height * 0.08, 40, width / 2, height * 0.08, width * 0.68);
  horizon.addColorStop(0, "rgba(0, 229, 255, 0.12)");
  horizon.addColorStop(0.52, "rgba(255, 46, 209, 0.05)");
  horizon.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, width, height);
}
