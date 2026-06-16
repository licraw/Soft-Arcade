# Article Spec: Leaderboard Architecture — Cloudflare Workers, IP Hashing, and the Next.js Proxy

## Summary

Soft Arcade's leaderboards are backed by a Cloudflare Worker that owns the database, but browser clients never talk to it directly. All requests flow through a thin Next.js API proxy that attaches a bearer-token secret and a hashed client IP before forwarding. This article explains the full request path, why the proxy exists (secret isolation, CORS, IP privacy), how SHA-256 IP hashing enables rate-limiting without storing PII, how the leaderboard config system drives different column layouts for each game, and how Beat the Scrambler's jQuery-era score submission coexists with Near Miss's TypeScript fetch call under the same backend contract.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/lib/leaderboards/server.ts` | `proxyLeaderboardRequest` — attaches Authorization, hashes client IP, forwards to Cloudflare Worker | The single-file proxy implementation |
| `src/app/api/scores/route.ts` | Beat the Scrambler's Next.js route handler — delegates to `proxyLeaderboardRequest` | Exposes `/api/scores` to browser clients |
| `src/app/api/near-miss/scores/route.ts` | Near Miss's Next.js route handler | Exposes `/api/near-miss/scores` |
| `src/lib/leaderboards/config.ts` | `leaderboardConfigs` record, `getLeaderboardConfig` | Per-game column definitions: different games expose different stats |
| `src/lib/leaderboards/api.ts` | `submitLeaderboardScore`, `notifyLeaderboardUpdated` | Client-side fetch helpers used by `NearMissGame.tsx` |
| `src/lib/leaderboards/scoreNames.ts` | `sanitizePlayerName` — shared name normalization | Used server-side before the game even touches the API |
| `src/games/beat-the-scrambler/mountBeatTheScrambler.js` | `submitScore` — `fetch("/api/scores", { method: "POST", ... })` | The jQuery-era POST path |

---

## Key Design Patterns

### The Proxy Architecture

```
Browser
  POST /api/scores (or /api/near-miss/scores)
       |
Next.js Edge/Node route handler (src/app/api/...)
  proxyLeaderboardRequest(request, "/api/scores")
       |
       |-- reads LEADERBOARD_WORKER_URL from env (never exposed to browser)
       |-- reads LEADERBOARD_WORKER_SECRET from env
       |-- hashes client IP with SHA-256
       |-- forwards request to Cloudflare Worker with:
       |     Authorization: Bearer <secret>
       |     X-Soft-Arcade-Client-IP-Hash: <sha256(ip)>
       v
Cloudflare Worker (external, owns D1 database)
  validates bearer token, rate-limits by IP hash, writes score
       |
       v
Next.js proxy: strips worker headers, returns JSON to browser
```

The browser sees only `https://[yourdomain]/api/scores`. The Cloudflare Worker URL and the shared secret never leave the server environment.

### IP Hashing for Rate-Limiting Without PII

```ts
async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

// In proxyLeaderboardRequest:
const clientIp = getClientIp(request);
if (clientIp) {
  headers.set("X-Soft-Arcade-Client-IP-Hash", await sha256Hex(clientIp));
}
```

`getClientIp` checks `CF-Connecting-IP` (set by Cloudflare's CDN when the Next.js host is also behind Cloudflare), then `X-Real-IP`, then the first entry of `X-Forwarded-For`. The resulting hash can be used for per-IP submission rate-limiting in the Worker without the Worker ever seeing or logging the raw IP address.

### Leaderboard Configuration Per Game

`leaderboardConfigs` in `config.ts` maps game IDs to column definitions with optional format functions:

```ts
"near-miss": {
  gameId: "near-miss",
  fetchEndpoint: "/api/near-miss/scores?limit=5",
  submitEndpoint: "/api/near-miss/scores",
  columns: [
    { key: "name",         label: "Name",        align: "left" },
    { key: "score",        label: "Score",        align: "right", format: formatNumber },
    { key: "distance",     label: "Distance",     align: "right", format: formatMiles },
    { key: "nearMisses",   label: "Near Misses",  align: "right", format: formatNumber },
    { key: "averageSpeed", label: "Avg Speed",    align: "right", format: formatSpeed }
  ]
},
"beat-the-scrambler": {
  columns: [
    { key: "name",  label: "Name",  align: "left" },
    { key: "moves", label: "Moves", align: "right", format: formatNumber },
    { key: "time",  label: "Time",  align: "right", format: formatTime }
  ]
}
```

The `Leaderboard` React component in `src/components/Leaderboard.tsx` is table-driven off this config, so adding a new game requires only a new config entry, not a new component.

### Two Submit Paths, Same Proxy

**Beat the Scrambler (jQuery)** calls `fetch("/api/scores", { method: "POST", body: JSON.stringify({ name, level, moves, time }) })` directly from `mountBeatTheScrambler.js`. The response is `{ scores: [...] }` which the game uses to immediately refresh its local leaderboard cache.

**Near Miss (TypeScript)** calls `submitLeaderboardScore(endpoint, { name, score, distance, elapsed_seconds, near_misses, average_speed, scoring_version })` from `src/lib/leaderboards/api.ts`. The richer payload is needed because Near Miss tracks multiple stats per run. After a successful submit, `notifyLeaderboardUpdated(gameId)` dispatches a BroadcastChannel message so any open leaderboard tab can refresh without polling.

### Score Name Normalization

`sanitizePlayerName` (from `src/lib/leaderboards/scoreNames.ts`) trims whitespace, collapses interior spaces, truncates to 12 characters, and uppercases. It is called in both games before any display or submission:

```ts
// Beat the Scrambler
function sanitizePlayerName(name) {
  return normalizeArcadeName(name);   // delegates to shared lib
}

// Near Miss
const sanitizedName = sanitizePlayerName(nameOverride ?? playerName);
```

This ensures the leaderboard table always shows clean, consistent names regardless of which game generated the entry.

---

## Suggested Diagram

```
ENVIRONMENT VARIABLES (server only)
  LEADERBOARD_WORKER_URL=https://worker.example.com
  LEADERBOARD_WORKER_SECRET=<token>

                    ┌─────────────────────────────┐
  Browser fetch ──► │ Next.js /api/scores          │
  (no secret,       │ proxyLeaderboardRequest()    │
   no worker URL)   │  - hash client IP            │
                    │  - attach Bearer token       │
                    │  - forward to worker         │
                    └──────────────┬──────────────┘
                                   │  HTTPS
                    ┌──────────────▼──────────────┐
                    │ Cloudflare Worker            │
                    │  - validate Bearer token     │
                    │  - rate-limit by IP hash     │
                    │  - write to D1 database      │
                    │  - return { scores: [...] }  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Next.js proxy strips headers │
                    │ Returns JSON to browser      │
                    └─────────────────────────────┘
```

---

## Why It Matters

Proxying through Next.js instead of calling the Cloudflare Worker directly from the browser keeps secrets out of client bundles, provides a consistent `/api/*` URL namespace that is easy to CORS-allowlist, and creates a natural point to add server-side validation before the Worker ever sees a request. The SHA-256 IP hash is a lightweight privacy-preserving technique: the Worker can detect and block repeated submissions from the same source without recording who that source is. For a site that needs to satisfy AdSense content policies and general GDPR best practices, not storing raw IPs in a leaderboard database is a meaningful step.
