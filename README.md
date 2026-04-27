# jquery-tile-game

A tile game that uses jQuery methods for DOM manipulation.

Use the arrow keys to move the tiles until they are sequenced in proper numeric order.

## Cloudflare leaderboard

This repo now includes a free arcade-style leaderboard backend using Cloudflare Workers + D1.

When a player wins, they can enter a short arcade name and submit their score. Personal bests still stay in local storage, while the shared high-score list comes from the Worker API.

## Endpoints

The Worker exposes:

- `GET /api/scores?level=easy|medium|hard&limit=10`
- `POST /api/scores`
- `GET /api/health`

Example score payload:

```json
{
  "name": "AAA",
  "level": "medium",
  "moves": 82,
  "time": 64
}
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Log into Cloudflare:

```bash
npx wrangler login
```

3. Create the D1 database:

```bash
npx wrangler d1 create tile-game-scores
```

4. Copy the returned `database_id` into [wrangler.toml](/Users/dylancrawshaw/Desktop/jquery-tile-game/wrangler.toml).

5. Apply the schema to the remote D1 database:

```bash
npx wrangler d1 migrations apply tile-game-scores
```

6. Apply the schema for local Worker development:

```bash
npx wrangler d1 migrations apply tile-game-scores --local
```

7. Run the Worker locally:

```bash
npm run dev:worker
```

8. If your game HTML is not served from the same origin as the Worker, set `apiBaseUrl` in [game-config.js](/Users/dylancrawshaw/Desktop/jquery-tile-game/game-config.js) to your deployed Worker URL, for example:

```js
window.TILE_GAME_CONFIG = {
  apiBaseUrl: "https://tile-game-scores.<your-subdomain>.workers.dev"
};
```

9. Deploy the Worker:

```bash
npm run deploy:worker
```

## Notes

- The Worker allows anonymous score posts, so this is arcade-style, not secure identity.
- It includes a small per-IP cooldown to reduce spam, but it does not prevent cheating.
- The leaderboard currently ranks by fewest moves first, then fastest time.
- If you open the game as a raw `file://` page, browser fetch rules will be awkward. Serve the game over `http://localhost` during development.
