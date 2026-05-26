import type { CarBounds } from "@/games/shared/car/types";

export function hasPlayerPassedTraffic(player: CarBounds, traffic: CarBounds) {
  return traffic.y > player.y + player.height * 0.5;
}
