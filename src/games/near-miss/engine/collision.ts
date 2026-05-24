import type { CarBounds } from "@/games/shared/car/types";

export function intersects(a: CarBounds, b: CarBounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function isNearMiss(player: CarBounds, traffic: CarBounds) {
  const verticalOverlap = player.y < traffic.y + traffic.height * 0.92 && player.y + player.height > traffic.y + traffic.height * 0.08;
  const horizontalGap = Math.max(traffic.x - (player.x + player.width), player.x - (traffic.x + traffic.width));

  return verticalOverlap && horizontalGap > 0 && horizontalGap <= player.width * 0.58;
}

export function hasPlayerPassedTraffic(player: CarBounds, traffic: CarBounds) {
  return traffic.y > player.y + player.height * 0.5;
}
