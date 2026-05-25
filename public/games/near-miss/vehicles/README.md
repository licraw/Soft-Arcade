# Near Miss Vehicle Sprites

This folder contains the browser-loadable copies of curated Near Miss vehicle
SVGs. The art source-of-truth is `src/games/near-miss/ui`; public files should
only be copied or cleaned from those curated UI assets.

Do not commit generated placeholder vehicles here.

## Asset Rules

- Use real curated SVG art only.
- Keep backgrounds transparent.
- Vehicles must face upward.
- Do not include checkerboard backgrounds, watermarks, hidden rectangles,
  oversized off-canvas paths, or export artifacts.
- Do not use external image references inside SVGs.
- Preserve each vehicle silhouette; do not stretch a truck into sedan
  proportions.

## Rendering

Near Miss renders vehicles through browser `Image` objects in
`src/games/near-miss/render/canvasRenderer.ts`.

- Runtime vehicle metadata lives in
  `src/games/near-miss/engine/vehicleConfig.ts`.
- `spritePath` points to one of the public SVG files in this folder.
- The renderer draws SVG images centered on the gameplay body.
- Aspect ratio is preserved. The renderer chooses one uniform scale that fits
  the SVG inside the configured render bounds.
- `uniformVisualScale` is the per-vehicle visual-size multiplier. Use it for
  visual bulk only; it does not change collision or near-miss math.
- Normal gameplay should not use procedurally drawn canvas cars as fallback art.

## Current Curated Assets

- `player-sports-car.svg`
  - Public copy of `src/games/near-miss/ui/redcar.svg`.
  - Player sports coupe.

- `traffic-sedan-blue.svg`
  - Public copy of `src/games/near-miss/ui/blue-sedan.svg`.
  - Blue traffic sedan.

- `traffic-sedan-gold.svg`
  - Public copy of `src/games/near-miss/ui/gold-sedan.svg`.
  - Gold traffic sedan.

- `traffic-sedan.svg`
  - Compatibility copy of the curated gold sedan.
  - Keep only while older references still expect this stable path.

- `traffic-van-truck.svg`
  - Cleaned public copy derived from `src/games/near-miss/ui/greentruck.svg`.
  - The public copy removes the source SVG's checkerboard/export background
    geometry and keeps only the truck artwork.

## Adding A Vehicle

1. Add the curated source SVG to `src/games/near-miss/ui`.
2. Copy or clean it into this folder without changing the vehicle silhouette.
3. Add a `NEAR_MISS_VEHICLE_CONFIGS` entry in
   `src/games/near-miss/engine/vehicleConfig.ts`.
4. Set `spawnWeight: 0` until the asset is verified in-game.
5. Use `uniformVisualScale` for visual size only.
6. Do not add SUV, police, or other future classes unless a curated real SVG
   exists for that class.
