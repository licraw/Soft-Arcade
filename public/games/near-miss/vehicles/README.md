# Near Miss Vehicle Sprites

Vehicle sprite assets for Near Miss.

## Shared Format

- Format: SVG
- ViewBox: `0 0 128 192`
- Background: transparent
- Orientation: facing upward
- Anchor: visually centered in the viewBox; intended draw anchor is center-center
- Scaling: vehicles use similar padding so traffic classes can be scaled by gameplay dimensions

Keep vehicle art inside the viewBox. Do not include checkerboard layers,
off-canvas rectangles, hidden backgrounds, watermarks, or editor export
artifacts. The renderer treats the SVG as a transparent image and draws it
centered over the gameplay body.

## Classes

- `player-sports-car.svg`
  - Class: `sports-car`
  - Role: player
  - Red, high contrast, stronger glow/accent treatment.

- `traffic-sedan.svg`
  - Class: `sedan`
  - Role: standard traffic
  - Gold body, slightly taller and blockier than the sports car.

- `traffic-suv.svg`
  - Class: `suv`
  - Role: medium traffic/blocker
  - Teal-blue body, wider stance, squared roofline.

- `traffic-van-truck.svg`
  - Class: `van-truck`
  - Role: large blocker traffic
  - Muted green-gray body, longest silhouette, simple panel lines.

## Notes

- `vehicleConfig.ts` is the gameplay registry for these assets.
- `spawnWeight: 0` means an asset is registered but not currently spawnable.
- Current live traffic rendering still uses the imported sedan SVG variants in
  `canvasRenderer.ts`; non-sedan traffic assets need renderer support before
  they should receive a positive spawn weight.
- Colors are intentionally simple and can be recolored by editing gradient stops and accent strokes.
- All sprites should avoid external image references and should render cleanly
  through a browser `Image` drawn onto canvas.

## Adding A Vehicle

1. Prepare the SVG in the shared `0 0 128 192` format above.
2. Save it under `public/games/near-miss/vehicles`.
3. Add or update a `NEAR_MISS_VEHICLE_CONFIGS` entry in
   `src/games/near-miss/engine/vehicleConfig.ts`.
4. Set `uniformVisualScale` for visual bulk only. This should not be used to
   tune collision or near-miss behavior.
5. Add renderer support in `src/games/near-miss/render/canvasRenderer.ts` if the
   vehicle is not already handled by the current sedan renderer.
6. Wire spawning through `src/games/near-miss/engine/spawner.ts` and then set a
   positive `spawnWeight`.
7. Use `NEAR_MISS_TUNING.debug` to verify hitboxes and near-miss shells after
   wiring.
