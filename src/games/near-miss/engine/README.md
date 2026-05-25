# Near Miss Gameplay Systems

This directory owns the current canvas gameplay layer for Near Miss. The goal of
the current implementation is a soft-arcade highway weaving feel, not realistic
vehicle simulation.

## Source Of Truth

- Road and lane geometry comes from `src/games/shared/car/laneSystem.ts`.
  `createLaneSystem` defines road width, lane count clamping, lane width, and
  lane centers.
- Near Miss gameplay tuning comes from `tuning.ts`. Move constants there before
  changing formulas in `gameLoop.ts`, `spawner.ts`, or `canvasRenderer.ts`.
- Scoring weights come from `scoring.ts`, except for a few gameplay glue values
  in `tuning.ts` such as safe-channel penalties, streak score step, and feedback
  lifetime.

## Vehicle Size And Rendering

Gameplay body size is based on lane width:

- Player body: `getPlayerBodySize(laneWidth)`.
- Traffic body: `getTrafficBodySize(laneWidth, playerBody, vehicleConfig)`.
- Newly spawned traffic applies its existing random width/height variance after
  vehicle-class occupancy sizing in `spawner.ts`.

Rendered sprite bounds are calculated from the gameplay body, vehicle visual
scale, and `spriteAspectRatio`. Collision uses those unrotated rendered bounds
as its source of truth, then insets them for arcade forgiveness.

## Vehicles And Sprite Rendering

Vehicle metadata lives in `vehicleConfig.ts`. Each entry defines:

- `id`: stable runtime id stored on traffic cars as `vehicleConfigId`.
- `vehicleClass`: broad category for curated active assets, such as `sedan` or
  `van-truck`.
- `spritePath`: public SVG path for vehicle assets under
  `public/games/near-miss/vehicles`.
- `spriteAspectRatio`: intrinsic SVG aspect ratio used by both rendering and
  collision sprite-bound math.
- `uniformVisualScale`: render-only multiplier applied after the shared traffic
  sprite scale.
- `occupancyWidthLanes`: gameplay body width measured in current lane widths.
- `occupancyLengthScale`: gameplay body length relative to the player body.
- `collisionWidthRatio` and `collisionHeightRatio`: class-specific insets from
  rendered sprite bounds.
- `nearMissGrowX` and `nearMissGrowY`: class-specific expansion from collision
  boxes for reward/danger feedback only.
- `spawnWeight`: whether and how often a traffic vehicle can be selected. A
  weight of `0` means the vehicle is registered but not spawnable.

Traffic spawning selects from `getSpawnableTrafficVehicleConfigs()` in
`spawner.ts` and stores the selected id on each traffic car as
`vehicleConfigId`.

Traffic rendering in `canvasRenderer.ts` loads the configured public SVG
`spritePath` into a browser `Image`, draws it centered on the gameplay body, and
preserves aspect ratio with one uniform scale. Normal gameplay vehicles should
not use procedurally drawn canvas fallback art.

The player renderer uses `PLAYER_VEHICLE_ID` to resolve the curated public copy
of `src/games/near-miss/ui/redcar.svg`.

To add a new vehicle class end to end:

1. Add the curated source SVG to `src/games/near-miss/ui`.
2. Copy or clean it into `public/games/near-miss/vehicles` without adding
   checkerboards, watermarks, hidden backgrounds, or generated placeholder art.
3. Add a `NEAR_MISS_VEHICLE_CONFIGS` entry with a unique `id`, `vehicleClass`,
   `spritePath`, and render-only `uniformVisualScale`.
4. Keep `spawnWeight: 0` until the asset is verified in-game.
5. Only then raise `spawnWeight` above `0`.

Visual yaw is cosmetic only. Collision boxes stay axis-aligned and use unrotated
rendered sprite bounds.

## Collision And Near Misses

Rendered sprite bounds are derived through:

- `getPlayerSpriteBounds`
- `getTrafficSpriteBounds`

Hitboxes are inset from those rendered sprite bounds through:

- `getPlayerHitbox`
- `getTrafficHitbox`

Near-miss shells are derived from those hitboxes through:

- `getPlayerNearMissShell`
- `getTrafficNearMissShell`

Near-miss shells never cause crashes; they are checked only after confirming the
collision boxes do not intersect.

## Speed, Braking, And Displayed MPH

Internal speed uses arbitrary game units. HUD speed uses `getDisplayedSpeed`,
which currently preserves the existing linear divisor. Distance summaries use
`getDisplayedDistanceMiles`.

Baseline speed, throttle, braking, and speed return values live in `tuning.ts`.
`gameLoop.ts` preserves the update order: input changes speed, speed is clamped,
distance and road stripe motion advance, then handling and traffic update.

## Traffic Spawning And Packets

Traffic packets are authored in `spawner.ts` as lane-relative layouts:

- `laneOffset` is relative to the chosen packet start lane.
- `yOffset` is relative to traffic car height.
- `speedRatio` is relative to current player speed.
- `lateralOffset` is lane-width-relative visual/readability offset.

The current corridor lane remains a hard exclusion in `packetFits`. This is part
of the current good-feeling packet rhythm and should not be changed until a
dedicated Stage 1 fairness pass.

## Debug Overlays

`NEAR_MISS_TUNING.debug` is off by default. When enabled, the renderer draws:

- lane centers
- lane seams/safe-channel status
- player and traffic collision boxes
- player and traffic near-miss shells
- current packet id and corridor lane

Use this before tuning collision, body size, or packet layout.
