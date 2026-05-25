export type NearMissVehicleClass = "sports-coupe" | "sedan" | "suv" | "van-truck" | "police";

export type NearMissVehicleConfig = {
  id: string;
  label: string;
  vehicleClass: NearMissVehicleClass;
  spritePath: string;
  occupancyWidthLanes: number;
  collisionScale: number;
  nearMissScale: number;
  uniformVisualScale: number;
  spawnWeight: number;
};

export const PLAYER_VEHICLE_ID = "player-sports-coupe";
export const DEFAULT_TRAFFIC_VEHICLE_ID = "traffic-sedan";

export const NEAR_MISS_VEHICLE_CONFIGS = [
  {
    id: PLAYER_VEHICLE_ID,
    label: "Sports Coupe",
    vehicleClass: "sports-coupe",
    spritePath: "/games/near-miss/vehicles/player-sports-car.svg",
    occupancyWidthLanes: 0.62,
    collisionScale: 1,
    nearMissScale: 1,
    uniformVisualScale: 1,
    spawnWeight: 0
  },
  {
    id: DEFAULT_TRAFFIC_VEHICLE_ID,
    label: "Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan.svg",
    occupancyWidthLanes: 0.72,
    collisionScale: 1,
    nearMissScale: 1,
    uniformVisualScale: 1,
    spawnWeight: 100
  },
  {
    id: "traffic-suv",
    label: "SUV",
    vehicleClass: "suv",
    spritePath: "/games/near-miss/vehicles/traffic-suv.svg",
    occupancyWidthLanes: 0.8,
    collisionScale: 1,
    nearMissScale: 1,
    uniformVisualScale: 1.18,
    spawnWeight: 0
  },
  {
    id: "traffic-van-truck",
    label: "Van Truck",
    vehicleClass: "van-truck",
    spritePath: "/games/near-miss/vehicles/traffic-van-truck.svg",
    occupancyWidthLanes: 0.9,
    collisionScale: 1,
    nearMissScale: 1,
    uniformVisualScale: 1.32,
    spawnWeight: 0
  }
] as const satisfies readonly NearMissVehicleConfig[];

// Add police metadata only after a real police SVG exists. Missing assets should
// not spawn, and current SVG rendering should stay the visual source of truth.

export function getVehicleConfig(id: string): NearMissVehicleConfig {
  const config = NEAR_MISS_VEHICLE_CONFIGS.find((entry) => entry.id === id);
  const fallbackConfig = NEAR_MISS_VEHICLE_CONFIGS.find((entry) => entry.id === DEFAULT_TRAFFIC_VEHICLE_ID);

  if (!config && !fallbackConfig) {
    throw new Error("Near Miss vehicle registry is missing its default traffic vehicle.");
  }

  return config || fallbackConfig!;
}

export function getSpawnableTrafficVehicleConfigs() {
  return NEAR_MISS_VEHICLE_CONFIGS.filter((config) => config.spawnWeight > 0 && config.id !== PLAYER_VEHICLE_ID);
}
