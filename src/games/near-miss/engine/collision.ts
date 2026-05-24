import type { CarBounds } from "@/games/shared/car/types";

export function intersects(a: CarBounds, b: CarBounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function insetBounds(bounds: CarBounds, widthScale: number, heightScale: number): CarBounds {
  const width = bounds.width * widthScale;
  const height = bounds.height * heightScale;

  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height
  };
}

export function expandBounds(bounds: CarBounds, growX: number, growY: number): CarBounds {
  return {
    x: bounds.x - growX,
    y: bounds.y - growY,
    width: bounds.width + growX * 2,
    height: bounds.height + growY * 2
  };
}

export function isNearMissShellOverlap(playerShell: CarBounds, trafficShell: CarBounds, playerHitbox: CarBounds, trafficHitbox: CarBounds) {
  return !intersects(playerHitbox, trafficHitbox) && intersects(playerShell, trafficShell);
}

export function hasPlayerPassedTraffic(player: CarBounds, traffic: CarBounds) {
  return traffic.y > player.y + player.height * 0.5;
}
