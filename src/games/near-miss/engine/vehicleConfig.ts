export type NearMissVehicleClass = "sports-coupe" | "sedan" | "van-truck";

export type NearMissVehicleConfig = {
  id: string;
  label: string;
  vehicleClass: NearMissVehicleClass;
  spritePath: string;
  uniformVisualScale: number;
  spawnWeight: number;
};

export const PLAYER_VEHICLE_ID = "player-sports-coupe";
export const DEFAULT_TRAFFIC_VEHICLE_ID = "traffic-sedan-blue";

export const NEAR_MISS_VEHICLE_CONFIGS = [
  {
    id: PLAYER_VEHICLE_ID,
    label: "Sports Coupe",
    vehicleClass: "sports-coupe",
    spritePath: "/games/near-miss/vehicles/player-sports-car.svg",
    uniformVisualScale: 1,
    spawnWeight: 0
  },
  {
    id: "traffic-sedan-blue",
    label: "Blue Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan-blue.svg",
    uniformVisualScale: 0.9,
    spawnWeight: 50
  },
  {
    id: "traffic-sedan-gold",
    label: "Gold Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan-gold.svg",
    uniformVisualScale: 0.9,
    spawnWeight: 50
  },
  {
    id: "traffic-van-truck",
    label: "Van Truck",
    vehicleClass: "van-truck",
    spritePath: "/games/near-miss/vehicles/traffic-van-truck.svg",
    uniformVisualScale: 1.22,
    spawnWeight: 12
  }
] as const satisfies readonly NearMissVehicleConfig[];

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
