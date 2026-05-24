import type { CarSpriteOptions } from "./types";

export const playerCarPalette = {
  body: "#7dd3fc",
  trim: "#facc15",
  glass: "#05070c",
  glow: "rgba(125, 211, 252, 0.52)"
};

export const trafficCarPalettes = [
  {
    body: "#ff4d5a",
    trim: "#ffd166",
    glass: "#171821",
    glow: "rgba(255, 77, 90, 0.22)"
  },
  {
    body: "#facc15",
    trim: "#f4f2ee",
    glass: "#171821",
    glow: "rgba(250, 204, 21, 0.2)"
  },
  {
    body: "#ff2ed1",
    trim: "#7dd3fc",
    glass: "#171821",
    glow: "rgba(255, 46, 209, 0.2)"
  },
  {
    body: "#3cff8f",
    trim: "#f4f2ee",
    glass: "#171821",
    glow: "rgba(60, 255, 143, 0.18)"
  }
];

export function drawArcadeCar(ctx: CanvasRenderingContext2D, options: CarSpriteOptions) {
  const { x, y, width, height, palette, direction = "up" } = options;
  const radius = Math.min(width, height) * 0.13;
  const noseInset = width * 0.18;
  const cabinY = direction === "up" ? y + height * 0.22 : y + height * 0.5;

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = palette.body;
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  roundedRect(ctx, x + width * 0.18, y + height * 0.08, width * 0.64, height * 0.12, radius * 0.6);
  ctx.fill();

  ctx.fillStyle = palette.glass;
  roundedRect(ctx, x + width * 0.2, cabinY, width * 0.6, height * 0.22, radius * 0.55);
  ctx.fill();

  ctx.strokeStyle = palette.trim;
  ctx.lineWidth = Math.max(2, width * 0.05);
  ctx.globalAlpha = 0.86;
  ctx.beginPath();
  if (direction === "up") {
    ctx.moveTo(x + noseInset, y + height * 0.16);
    ctx.lineTo(x + width / 2, y + height * 0.04);
    ctx.lineTo(x + width - noseInset, y + height * 0.16);
  } else {
    ctx.moveTo(x + noseInset, y + height * 0.84);
    ctx.lineTo(x + width / 2, y + height * 0.96);
    ctx.lineTo(x + width - noseInset, y + height * 0.84);
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(8, 10, 16, 0.52)";
  roundedRect(ctx, x - width * 0.05, y + height * 0.18, width * 0.12, height * 0.18, 3);
  roundedRect(ctx, x + width * 0.93, y + height * 0.18, width * 0.12, height * 0.18, 3);
  roundedRect(ctx, x - width * 0.05, y + height * 0.64, width * 0.12, height * 0.18, 3);
  roundedRect(ctx, x + width * 0.93, y + height * 0.64, width * 0.12, height * 0.18, 3);
  ctx.fill();
  ctx.restore();
}

export function drawPlayerCar(ctx: CanvasRenderingContext2D, options: CarSpriteOptions) {
  const { x, y, width, height } = options;

  ctx.save();
  ctx.shadowColor = "rgba(0, 229, 255, 0.58)";
  ctx.shadowBlur = 24;
  ctx.strokeStyle = "rgba(244, 242, 238, 0.92)";
  ctx.lineWidth = 3;
  roundedRect(ctx, x - 4, y - 4, width + 8, height + 8, Math.min(width, height) * 0.16);
  ctx.stroke();
  ctx.restore();

  drawArcadeCar(ctx, options);

  ctx.save();
  ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
  roundedRect(ctx, x + width * 0.18, y + height * 0.78, width * 0.64, height * 0.08, 4);
  ctx.fill();

  ctx.strokeStyle = "rgba(5, 7, 12, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.34, y + height * 0.2);
  ctx.lineTo(x + width * 0.5, y + height * 0.08);
  ctx.lineTo(x + width * 0.66, y + height * 0.2);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
