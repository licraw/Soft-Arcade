export type NearMissVehicleClass = "sports-coupe" | "sedan" | "van-truck";

export type NearMissVehicleConfig = {
  id: string;
  label: string;
  vehicleClass: NearMissVehicleClass;
  spritePath: string;
  spriteAspectRatio: number;
  uniformVisualScale: number;
  occupancyWidthLanes: number;
  occupancyLengthScale: number;
  collisionWidthRatio: number;
  collisionHeightRatio: number;
  nearMissGrowX: number;
  nearMissGrowY: number;
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
    spriteAspectRatio: 128 / 192,
    uniformVisualScale: 1,
    occupancyWidthLanes: 0.48,
    occupancyLengthScale: 1,
    collisionWidthRatio: 0.78,
    collisionHeightRatio: 0.86,
    nearMissGrowX: 18,
    nearMissGrowY: 11,
    spawnWeight: 0
  },
  {
    id: "traffic-sedan-blue",
    label: "Blue Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan-blue.svg",
    spriteAspectRatio: 128 / 192,
    uniformVisualScale: 0.9,
    occupancyWidthLanes: 0.46,
    occupancyLengthScale: 1,
    collisionWidthRatio: 0.84,
    collisionHeightRatio: 0.9,
    nearMissGrowX: 13,
    nearMissGrowY: 11,
    spawnWeight: 50
  },
  {
    id: "traffic-sedan-gold",
    label: "Gold Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan-gold.svg",
    spriteAspectRatio: 128 / 192,
    uniformVisualScale: 0.9,
    occupancyWidthLanes: 0.46,
    occupancyLengthScale: 1,
    collisionWidthRatio: 0.84,
    collisionHeightRatio: 0.9,
    nearMissGrowX: 13,
    nearMissGrowY: 11,
    spawnWeight: 50
  },
  {
    id: "traffic-box-truck",
    label: "Box Truck",
    vehicleClass: "van-truck",
    spritePath: "/games/near-miss/vehicles/boxtruck.svg",
    spriteAspectRatio: 128 / 224,
    uniformVisualScale: 1.22,
    occupancyWidthLanes: 0.9,
    occupancyLengthScale: 1.28,
    collisionWidthRatio: 0.88,
    collisionHeightRatio: 0.94,
    nearMissGrowX: 16,
    nearMissGrowY: 13,
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
