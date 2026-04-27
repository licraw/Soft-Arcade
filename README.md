# Tile Game Arcade

https://tile-game-arcade.pages.dev/

Tile Game Arcade is a browser-based sliding puzzle built with jQuery. Players choose a difficulty, solve the board using directional moves, and submit a short arcade-style name to a shared high-score table when they win.

The project uses a static frontend for the game itself and a small Cloudflare backend for leaderboard storage. Personal bests are stored locally in the browser, while the shared leaderboard is stored remotely in D1 and served through a Worker API.

## Gameplay

The board is a classic sliding-number puzzle. One tile space is empty, and each move slides a neighboring tile into that gap. The goal is to restore the grid to numeric order.

Difficulty levels:

- `Easy`: 3x3 board
- `Medium`: 4x4 board
- `Hard`: 5x5 board

Controls:

- Desktop: arrow keys
- Mobile: swipe in the direction you want to move

The game tracks:

- current level
- move count
- elapsed time
- local personal best per difficulty

When a run is completed, the player can submit a short name to the shared leaderboard.

## Interface

The UI has two modes:

- Desktop: full HUD with stats and action buttons visible in the top bar
- Mobile: compact header with a collapsible game menu

The top bar includes:

- leaderboard
- restart level
- return to main menu

Restarting or leaving an active run requires confirmation to avoid accidental progress loss.

## Leaderboard Behavior

The leaderboard is anonymous and arcade-style. There are no user accounts or sign-in flows.

Each score submission includes:

- player name
- difficulty
- move count
- completion time

Scores are ranked by:

1. fewest moves
2. fastest time

The Worker applies basic validation and a small per-IP cooldown to reduce spam. It is not intended to be cheat-proof.

## Architecture

The project is split into three parts.

### 1. Static frontend

Files:

- `game.html`
- `game.css`
- `game.js`
- `game-config.js`
- `jquery-3.4.1.js`

Responsibilities:

- render the puzzle board and UI
- handle keyboard and swipe input
- track timer, moves, and local personal bests
- fetch leaderboard data
- submit completed runs

### 2. Cloudflare Worker API

File:

- `worker/src/index.js`

Responsibilities:

- expose leaderboard endpoints
- validate incoming score submissions
- read and write leaderboard data
- return the top scores for a difficulty

Endpoints:

- `GET /api/health`
- `GET /api/scores?level=easy|medium|hard&limit=10`
- `POST /api/scores`

Example payload:

```json
{
  "name": "AAA",
  "level": "medium",
  "moves": 82,
  "time": 64
}
```

### 3. Cloudflare D1 database

Files:

- `worker/migrations/0001_create_scores.sql`
- `wrangler.toml`

Responsibilities:

- persist submitted scores
- support sorted leaderboard queries by difficulty

## Local Development

Install dependencies:

```bash
npm install
```

Serve the frontend over HTTP:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/game.html
```

If you open the frontend with `file://`, browser fetch behavior will be inconsistent and the leaderboard API may not work correctly.

## Cloudflare Setup

Authenticate Wrangler:

```bash
npx wrangler login
```

Create the D1 database:

```bash
npx wrangler d1 create tile-game-scores
```

Apply the remote migration:

```bash
npx wrangler d1 migrations apply tile-game-scores --remote
```

Apply the local migration for local Worker development:

```bash
npx wrangler d1 migrations apply tile-game-scores --local
```

Run the Worker locally:

```bash
npm run dev:worker
```

Deploy the Worker:

```bash
npm run deploy:worker
```

If the frontend is not served from the same origin as the Worker, set the Worker URL in `game-config.js`.

## Pages Deployment

The frontend is deployed as a static Cloudflare Pages site.

Build the Pages bundle:

```bash
npm run build:pages
```

Deploy the frontend:

```bash
npm run deploy:pages
```

The Pages build copies the static client files into `pages-dist/`, including an `index.html` entrypoint for the deployed site root.

## Repository Notes

Safe to commit:

- frontend source files
- Worker source
- D1 migration files
- `wrangler.toml`
- public Worker URL in `game-config.js`
- D1 database identifier in `wrangler.toml`

Do not commit:

- `.env`
- `.dev.vars`
- Cloudflare API tokens
- local Wrangler auth/config directories

Ignored local/generated directories:

- `node_modules/`
- `.wrangler/`
- `.wrangler-config/`
- `pages-dist/`
