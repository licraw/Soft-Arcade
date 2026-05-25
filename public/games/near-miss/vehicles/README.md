# Near Miss Vehicle Sprites

Asset-only vehicle sprite set for a later Near Miss renderer integration pass.

## Shared Format

- Format: SVG
- ViewBox: `0 0 128 192`
- Background: transparent
- Orientation: facing upward
- Anchor: visually centered in the viewBox; intended draw anchor is center-center
- Scaling: vehicles use similar padding so traffic classes can be scaled by gameplay dimensions

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

- These files are not wired into gameplay yet.
- Current Near Miss renderer integration should happen in a later pass.
- Colors are intentionally simple and can be recolored by editing gradient stops and accent strokes.
- All sprites avoid external image references and use simple SVG shapes for fast canvas/image use later.
