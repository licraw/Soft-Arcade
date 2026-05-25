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
- Existing traffic resize behavior: `getTrafficResizeBodySize(playerBody)`.
- Newly spawned traffic still applies its existing random width/height variance
  in `spawner.ts`.

Renderer sprite scales in `tuning.ts` intentionally overdraw the gameplay body.
Those scales change visuals only. Collision and near-miss math should continue
to use gameplay bodies.

## Collision And Near Misses

Hitboxes are derived from gameplay bodies through:

- `getPlayerHitbox`
- `getTrafficHitbox`

Near-miss shells are derived from those hitboxes through:

- `getPlayerNearMissShell`
- `getTrafficNearMissShell`

The current traffic near-miss shell is narrower on X than the player shell via
`trafficNearMissGrowXScale`. This preserves the current collision feel.

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
