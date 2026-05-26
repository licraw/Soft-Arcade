import type { CarBounds } from "@/games/shared/car/types";
import { getPlayerSpriteBounds, getTrafficSpriteBounds } from "./tuning";
import { getVehicleConfig, PLAYER_VEHICLE_ID, type NearMissVehicleCollisionZone, type NearMissVehicleConfig } from "./vehicleConfig";

export type Point = {
  x: number;
  y: number;
};

export type VehicleZonePolygon = {
  id: string;
  points: [Point, Point, Point, Point];
};

export type VehicleSpriteTransform = {
  centerX: number;
  centerY: number;
  renderWidth: number;
  renderHeight: number;
  yawRadians: number;
  bounds: CarBounds;
  vehicleConfig: NearMissVehicleConfig;
};

const DEG_TO_RAD = Math.PI / 180;

export function getPlayerVehicleTransform(player: CarBounds & { visualYaw: number }): VehicleSpriteTransform {
  const vehicleConfig = getVehicleConfig(PLAYER_VEHICLE_ID);
  const bounds = getPlayerSpriteBounds(player);

  return createVehicleTransform(bounds, vehicleConfig, (player.visualYaw + 180) * DEG_TO_RAD);
}

export function getTrafficVehicleTransform(bounds: CarBounds, vehicleConfig: NearMissVehicleConfig, yawDeg = 0): VehicleSpriteTransform {
  return createVehicleTransform(getTrafficSpriteBounds(bounds, vehicleConfig), vehicleConfig, yawDeg * DEG_TO_RAD);
}

export function getVehicleCollisionPolygons(transform: VehicleSpriteTransform) {
  return transform.vehicleConfig.collisionZones.map((zone) => transformLocalZone(transform, zone, 0, 0));
}

export function getVehicleNearMissPolygons(transform: VehicleSpriteTransform) {
  return transform.vehicleConfig.collisionZones.map((zone) =>
    transformLocalZone(transform, zone, transform.vehicleConfig.nearMissGrowX, transform.vehicleConfig.nearMissGrowY)
  );
}

export function doVehicleZonesOverlap(a: readonly VehicleZonePolygon[], b: readonly VehicleZonePolygon[]) {
  for (const aZone of a) {
    for (const bZone of b) {
      if (polygonsOverlap(aZone.points, bZone.points)) {
        return true;
      }
    }
  }

  return false;
}

export function isVehicleNearMissOverlap(
  playerNearMissZones: readonly VehicleZonePolygon[],
  trafficNearMissZones: readonly VehicleZonePolygon[],
  playerCollisionZones: readonly VehicleZonePolygon[],
  trafficCollisionZones: readonly VehicleZonePolygon[]
) {
  return !doVehicleZonesOverlap(playerCollisionZones, trafficCollisionZones) && doVehicleZonesOverlap(playerNearMissZones, trafficNearMissZones);
}

function createVehicleTransform(bounds: CarBounds, vehicleConfig: NearMissVehicleConfig, yawRadians: number): VehicleSpriteTransform {
  return {
    centerX: bounds.x + bounds.width / 2,
    centerY: bounds.y + bounds.height / 2,
    renderWidth: bounds.width,
    renderHeight: bounds.height,
    yawRadians,
    bounds,
    vehicleConfig
  };
}

function transformLocalZone(
  transform: VehicleSpriteTransform,
  zone: NearMissVehicleCollisionZone,
  growX: number,
  growY: number
): VehicleZonePolygon {
  const halfWidth = (zone.width * transform.renderWidth) / 2 + growX;
  const halfHeight = (zone.height * transform.renderHeight) / 2 + growY;
  const centerX = zone.x * transform.renderWidth;
  const centerY = zone.y * transform.renderHeight;
  const cos = Math.cos(transform.yawRadians);
  const sin = Math.sin(transform.yawRadians);
  const localCorners: [Point, Point, Point, Point] = [
    { x: centerX - halfWidth, y: centerY - halfHeight },
    { x: centerX + halfWidth, y: centerY - halfHeight },
    { x: centerX + halfWidth, y: centerY + halfHeight },
    { x: centerX - halfWidth, y: centerY + halfHeight }
  ];

  return {
    id: zone.id,
    points: localCorners.map((point) => rotateAndTranslate(point, transform, cos, sin)) as [Point, Point, Point, Point]
  };
}

function rotateAndTranslate(point: Point, transform: VehicleSpriteTransform, cos: number, sin: number): Point {
  return {
    x: transform.centerX + point.x * cos - point.y * sin,
    y: transform.centerY + point.x * sin + point.y * cos
  };
}

function polygonsOverlap(a: readonly Point[], b: readonly Point[]) {
  return !hasSeparatingAxis(a, b) && !hasSeparatingAxis(b, a);
}

function hasSeparatingAxis(source: readonly Point[], target: readonly Point[]) {
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[(index + 1) % source.length];
    const axis = {
      x: -(next.y - current.y),
      y: next.x - current.x
    };
    const sourceProjection = projectPolygon(source, axis);
    const targetProjection = projectPolygon(target, axis);

    if (sourceProjection.max < targetProjection.min || targetProjection.max < sourceProjection.min) {
      return true;
    }
  }

  return false;
}

function projectPolygon(points: readonly Point[], axis: Point) {
  let min = dot(points[0], axis);
  let max = min;

  for (let index = 1; index < points.length; index += 1) {
    const projection = dot(points[index], axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }

  return { min, max };
}

function dot(point: Point, axis: Point) {
  return point.x * axis.x + point.y * axis.y;
}
