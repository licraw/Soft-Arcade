# Article Spec: SAT Collision Detection and Multi-Zone Near-Miss Geometry

## Summary

Near Miss uses the Separating Axis Theorem (SAT) to detect both crashes and near-misses, but the two detection layers are deliberately different shapes. Each vehicle is divided into multiple convex collision zones (bumper tapers, cabin body, cargo box) defined in local normalized coordinates. Near-miss detection inflates those same zones by a fixed pixel margin. A near-miss registers only when the inflated zones overlap but the exact collision zones do not — the mathematical definition of "just barely missed." This article explains the zone table, the SAT polygon test, the coordinate transform pipeline, and why separating "near-miss geometry" from "collision geometry" makes the game feel fair even at high speed.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/near-miss/engine/vehicleGeometry.ts` | `transformLocalZone`, `getVehicleCollisionPolygons`, `getVehicleNearMissPolygons`, `doVehicleZonesOverlap`, `isVehicleNearMissOverlap`, SAT implementation (`hasSeparatingAxis`, `projectPolygon`) | The entire collision/near-miss math |
| `src/games/near-miss/engine/vehicleConfig.ts` | `collisionZones`, `nearMissGrowX`, `nearMissGrowY` per vehicle | The authored zone tables — different shapes for sports coupe, sedan, and box truck |
| `src/games/near-miss/engine/gameLoop.ts` | `isPlayerCollidingWithTraffic`, `canAwardNearMiss` — calls into vehicleGeometry per-car per-frame | Shows the hot path: zone tests run for every traffic car every tick |
| `src/games/near-miss/engine/tuning.ts` | `playerSpriteScaleX/Y`, `trafficSpriteScaleX/Y` — sprite bounds derived here, which collision zones scale from | Links render size to physics size |

---

## Key Design Patterns

### Multi-Zone Vehicle Bodies

Rather than using a single bounding rectangle per vehicle, each vehicle config declares 2–3 named collision zones in normalized local coordinates (origin at sprite center, ranging roughly –0.5 to +0.5):

```ts
// Blue Sedan
collisionZones: [
  { id: "center-cabin", x: 0, y: 0.04,  width: 0.56, height: 0.54 },
  { id: "front-taper",  x: 0, y: -0.30, width: 0.44, height: 0.25 },
  { id: "rear-taper",   x: 0, y:  0.32, width: 0.48, height: 0.23 }
],
// Box Truck
collisionZones: [
  { id: "cargo-box",    x: 0, y:  0.18, width: 0.68, height: 0.58 },
  { id: "cab",          x: 0, y: -0.28, width: 0.56, height: 0.31 },
  { id: "rear-bumper",  x: 0, y:  0.46, width: 0.64, height: 0.08 }
]
```

The tapered front/rear zones mean a player can slip past a car's corner without triggering a crash — intentionally matching the visual silhouette of the SVG sprites.

### The Coordinate Transform Pipeline

`transformLocalZone` maps a local zone rectangle into four world-space points, rotating by the vehicle's current yaw:

```ts
function transformLocalZone(transform, zone, growX, growY): VehicleZonePolygon {
  const halfWidth  = (zone.width  * transform.renderWidth)  / 2 + growX;
  const halfHeight = (zone.height * transform.renderHeight) / 2 + growY;
  const centerX = zone.x * transform.renderWidth;
  const centerY = zone.y * transform.renderHeight;
  const cos = Math.cos(transform.yawRadians);
  const sin = Math.sin(transform.yawRadians);

  const localCorners = [
    { x: centerX - halfWidth, y: centerY - halfHeight },
    { x: centerX + halfWidth, y: centerY - halfHeight },
    { x: centerX + halfWidth, y: centerY + halfHeight },
    { x: centerX - halfWidth, y: centerY + halfHeight }
  ];

  return { id: zone.id, points: localCorners.map(p => rotateAndTranslate(p, transform, cos, sin)) };
}
```

During crashes, traffic vehicles have a non-zero `yawDeg` that feeds into `getTrafficVehicleTransform`, so collision zones rotate with the spinning car.

### The SAT Test

`polygonsOverlap` uses the classic SAT: try each edge of polygon A as a separating axis, project both polygons onto it, and check for gap. If no separating axis exists in either polygon's edge set, the polygons overlap:

```ts
function hasSeparatingAxis(source, target) {
  for (let i = 0; i < source.length; i++) {
    const axis = edgeNormal(source[i], source[(i + 1) % source.length]);
    const sp = projectPolygon(source, axis);
    const tp = projectPolygon(target, axis);
    if (sp.max < tp.min || tp.max < sp.min) return true; // gap found
  }
  return false;
}
```

This runs for every pair of (player zone, traffic zone) per car per frame. Because cars typically have 3 zones each and there are rarely more than 8 traffic cars on screen, the total SAT tests per frame stays well under 50.

### Near-Miss Detection: Inflated Zones with Exact Exclusion

`isVehicleNearMissOverlap` requires:
1. The near-miss zones (collision zones expanded by `nearMissGrowX` / `nearMissGrowY` pixels) **do** overlap.
2. The exact collision zones **do not** overlap.

```ts
export function isVehicleNearMissOverlap(
  playerNearMissZones, trafficNearMissZones,
  playerCollisionZones, trafficCollisionZones
) {
  return (
    !doVehicleZonesOverlap(playerCollisionZones, trafficCollisionZones) &&
     doVehicleZonesOverlap(playerNearMissZones,  trafficNearMissZones)
  );
}
```

For sedans, `nearMissGrowX = 13` and `nearMissGrowY = 11`. For the box truck, `nearMissGrowX = 16` and `nearMissGrowY = 13`. The larger truck margin makes slipping past a truck feel correspondingly more dramatic.

### Speed Requirement for Near-Miss Awards

A near-miss is also gated by relative screen speed: `canAwardNearMiss` checks that `relativeYSpeed >= TUNING.minNearMissRelativeSpeed` (62 internal units). This prevents the player from parking beside a slow-moving car and farming near-miss points. See `gameLoop.ts:834`.

---

## Suggested Diagram

```
Vehicle Local Space (normalized, origin = sprite center)
  ┌──────────────────────────────────────┐
  │          [front-taper zone]          │  y ≈ -0.30
  │    ┌──────────────────────────┐      │
  │    │      [center-cabin]      │  y ≈  0.04
  │    └──────────────────────────┘      │
  │          [rear-taper zone]           │  y ≈  0.32
  └──────────────────────────────────────┘

Transform pipeline:
  LocalZone → scale by (renderWidth, renderHeight) → grow by (growX, growY)
  → rotate by yawRadians around sprite center → translate to world position

Near-miss check (per traffic car, per frame):
  collision zones overlap?  YES → crash
  collision zones overlap?  NO
  near-miss zones overlap?  YES + relativeSpeed ≥ 62 → award near miss
  near-miss zones overlap?  NO → pass silently
```

---

## Why It Matters

Using SAT on multiple per-vehicle convex zones achieves two things simultaneously: crash detection that matches the visual silhouette (not a padded rectangle), and a near-miss "halo" that can be tuned independently per vehicle class. The strict ordering — exact zones must NOT overlap for a near-miss to register — means players can never accidentally collect a near-miss bonus while already crashing. For a score-sensitive arcade game, correctness of the detection boundary directly affects trust in the scoring system.
