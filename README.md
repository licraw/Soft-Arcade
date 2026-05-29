# Soft Arcade

Soft Arcade is a Next.js game portal for small browser games with shared routing, layout, and game-page infrastructure. The app currently hosts two games:

- `Beat the Scrambler`: a jQuery-powered sliding tile puzzle.
- `Near Miss`: a canvas arcade driving game.

The public game routes are generated from a central registry, so adding a game means adding its component and metadata under `src/games`, then registering it in `src/games/registry.ts`.

## Architecture

### Next.js App Router

The portal shell lives in `src/app`.

- `src/app/page.tsx`: home page
- `src/app/games/page.tsx`: game library page
- `src/app/games/[slug]/page.tsx`: generated game route
- `src/app/globals.css`: site-wide layout, arcade theme, and responsive shell styles

Game pages use `GamePageShell`, which provides the heading, playable stage, side rail, leaderboard, ads, and how-to-play section around each game component.

### Game Registry

`src/games/registry.ts` is the source of truth for available games. Each entry defines:

- stable `id`
- route `slug`
- title and descriptions
- how-to-play instructions
- implementation type
- React component to render

`generateStaticParams()` reads this registry to build all game detail pages.

### Game Modules

Each game is isolated under `src/games/<game-id>`.

- `src/games/beat-the-scrambler`: legacy jQuery sliding puzzle mounted from React
- `src/games/near-miss`: React/canvas driving game with separate engine, renderer, input, and UI modules
- `src/games/shared`: reusable game primitives, currently shared car HUD and lane-system helpers

Game-specific styles use CSS modules. Global classes are used only where a game needs stable class names across subcomponents or legacy DOM.

### Shared Components

`src/components` contains portal-level UI:

- `GamePageShell`
- `ArcadeGameCard`
- `Leaderboard`
- `DailyScramble`
- `AdSlot`
- header, footer, and mascot components

These components should stay game-agnostic. Game behavior belongs inside `src/games`.

### Leaderboards

`src/components/Leaderboard.tsx` is the portal-level leaderboard surface. Persistent leaderboard storage is not yet generalized across all games.

Games that need persistent scores should define their own score contract and document the backend in that game's folder.

## Local Development

Install dependencies:

```bash
npm install
```

Run the Next.js app:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

## Adding A Game

1. Create a folder under `src/games/<game-id>`.
2. Export the game component from `src/games/<game-id>/index.ts`.
3. Keep game engine, renderer, UI, assets, and styles inside that folder unless they are truly reusable.
4. Add a `GameDefinition` entry in `src/games/registry.ts`.
5. Confirm the game works in the shared `GamePageShell` at `/games/<slug>`.
6. Add game-specific documentation in the game folder if the implementation needs operational notes, backend setup, or asset guidance.
