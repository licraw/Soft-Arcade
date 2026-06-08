# Rose City Commerce — Codex Prompt: Soft Arcade Games Portfolio Entry

## Context

You are working in the Rose City Commerce portfolio site. Your task is to add a new portfolio project entry for **Soft Arcade Games** (softarcadegames.com), a browser game platform built by Rose City Commerce as an owned internal product.

This entry should be crafted to stand out during a PostHog job application review. Emphasize the depth of the PostHog analytics implementation, the performance-conscious architecture, and the product thinking behind using gameplay data to understand and improve user behavior.

Do not guess at technical details. Every fact below was drawn directly from the source code and should be represented accurately.

---

## About the Project

Soft Arcade is a lightweight, no-login browser game platform built with Next.js 15, React 19, and TypeScript, deployed to Cloudflare Pages. It houses two polished arcade games — **Beat the Scrambler** (a neon sliding tile puzzle) and **Near Miss** (a real-time canvas traffic arcade driver) — alongside a shared leaderboard system backed by Cloudflare D1 and a Cloudflare Worker.

The project was instrumented with PostHog from the ground up: events fire for every meaningful player action, funnels capture the start → completion → score submission journey for both games, and a product dashboard tracks live engagement metrics.

---

## 1. Portfolio Card

### Recommended Card Title
**Soft Arcade Games**

### Recommended Tags
`Next.js`, `TypeScript`, `Canvas`, `PostHog`, `Product Analytics`, `Cloudflare`, `Browser Gaming`, `Performance`

### Recommended Card Summary (2–3 sentences)
A growing collection of small, polished browser games built for instant no-login play. Built with Next.js 15 and a custom Canvas game engine, and instrumented with PostHog to track gameplay funnels, score submission rates, difficulty drop-off, and session replays — giving the team real product data to iterate on game design.

### Suggested Hero Image or Screenshot
Capture the Near Miss canvas game in action — the soft-neon road with traffic in multiple lanes, the player car centered in a gap, and the "NEAR MISS +250" feedback text visible on the canvas. Alternatively, use the Beat the Scrambler puzzle board with the animated Scrambler mascot visible in the background and the neon cyan/magenta tiles in mid-solve. Both screenshots should show the HUD (score, speed, streak) to convey the full in-game product UI.

---

## 2. Case Study Page Structure

The case study should be organized as follows:

### Section 1 — Overview
**Soft Arcade Games** is a Rose City Commerce owned product: a lightweight arcade site built to demonstrate that browser games can be fast, fun, and instrumented with the same rigor as a SaaS product. No accounts. No installs. Play in two clicks.

The platform ships two games at launch, each with a live leaderboard, local personal best tracking, and PostHog analytics wired to every meaningful player action.

---

### Section 2 — Game Architecture

#### Two Games, Two Architectures

The platform demonstrates that modern browser game development does not require a uniform approach. Each game uses the architecture most appropriate to its interaction model.

**Near Miss** is built as a pure TypeScript class (`NearMissGameLoop`) that owns its own state machine, physics update loop, and Canvas 2D renderer. React is used only as the mounting shell and for UI overlays (the game-over modal, HUD, and mobile controls). During active gameplay, React receives a snapshot update at most once every 90ms — deliberately throttled to minimize re-renders while the canvas runs at full frame rate. This separation means the simulation never blocks on React reconciliation.

The game loop runs on `requestAnimationFrame`, with delta time capped at 34ms per frame to prevent physics instability after tab focus returns. The Canvas renderer reads from a plain JavaScript state object (`NearMissRuntimeState`) and draws a full scene each frame: the scrolling road with lane stripes (driven by a stripe offset accumulated from world speed), traffic vehicles as pre-loaded SVG sprites drawn via `ctx.drawImage`, and floating score feedback text that fades and drifts upward over its lifetime.

**Beat the Scrambler** is a jQuery-based game dynamically imported as client-side JavaScript, wrapped inside a React component that provides the DOM skeleton. The jQuery runtime and all game modules are loaded asynchronously at mount time using dynamic `import()`, keeping them entirely out of the initial bundle. The React component receives the `posthog` instance as a prop and passes it directly into the vanilla JS game function — a clean seam that lets the legacy game capture events without relying on `window.posthog`.

#### Shared Game Infrastructure

Both games share a common pattern:
- A centralized game registry (`src/games/registry.ts`) defines each game's metadata, slug, instructions, and component — enabling the dynamic route (`/games/[slug]`) to serve any game with a single page template.
- `GamePageShell` wraps every game with a consistent layout: the game stage, a side rail with the live leaderboard and an ad slot, and a how-to-play section.
- Leaderboard data is fetched through a Next.js API route that acts as an authenticated proxy to a Cloudflare Worker and Cloudflare D1 database. The score submission API is the only backend call in the entire product — gameplay itself is fully client-side.

#### Near Miss Engine Details

The Near Miss engine (`src/games/near-miss/engine/`) is split into focused modules:

- **`gameLoop.ts`** — The `NearMissGameLoop` class manages the game state machine (`ready → running → crashing → gameOver`), physics update, spawn timing, near-miss detection, streak accounting, scoring, and crash aftermath physics. It emits lightweight `NearMissSnapshot` objects to React for UI updates.
- **`tuning.ts`** — All numeric constants live in a single `NEAR_MISS_TUNING` object. Speed, handling feel, traffic density ramps, crash impulse magnitudes, and feedback timing are all tuned from one file. This makes game-feel iteration a single-file diff.
- **`spawner.ts`** — Traffic is spawned as named formation packets (e.g., `single-slow-blocker`, `convoy-squeeze-gap`, `close-triple`, `split-pinch`). Each packet defines lane offsets, stagger intervals, and speed ratios. A corridor system shifts the guaranteed open lane periodically, preventing the player from camping one lane. Density ramps up over the first 80 seconds and scales further with player speed.
- **`vehicleConfig.ts`** — Three traffic vehicle types (Blue Sedan, Gold Sedan, Box Truck) and a player Sports Coupe, each with per-vehicle collision zone polygons (defined as normalized fractions of the body), near-miss zone grow values, sprite aspect ratios, and spawn weights.
- **`vehicleGeometry.ts`** — Rotated polygon collision and near-miss zones, accounting for the visual yaw applied during steering.
- **`collision.ts`** — Near-miss eligibility: a traffic car that the player has passed within the near-miss zone at sufficient relative speed awards a streak point and bonus score.
- **`scoring.ts`** — Score is the sum of distance score, survival score, speed-above-baseline score, near-miss bonuses (with streak multiplier capped at 6x), and a rolling bonus score accumulator. A braking penalty (0.9×) applies to the total score when the player is below cruise speed, discouraging passive play.
- **`input.ts`** — A stateless input controller merges keyboard state (ArrowLeft/Right/Up/Down, A/D/W/S) with Pointer Events from on-screen mobile controls. Exclusive control pairs (left vs. right, throttle vs. brake) prevent simultaneous opposite inputs. Window blur clears all held keys.

#### Mobile and Responsive Handling

Both games implement a mobile play mode using `window.visualViewport`, `ResizeObserver`, and `document.body` scroll locking. When a player on a narrow screen starts a game, the page programmatically scrolls to center the game in the available viewport, then locks scroll with `position: fixed` for the duration of play. This is restored without scroll jump on game exit. Near Miss additionally reads `window.devicePixelRatio` to scale the canvas for HiDPI displays.

---

### Section 3 — Performance Decisions

- **No auth, no account gates.** Every game loads and plays instantly. The only optional async call is leaderboard score submission, which is non-blocking and recoverable.
- **Dynamic imports for heavy dependencies.** jQuery (71KB) and the Beat the Scrambler game modules are loaded only when that game page is mounted, completely absent from the initial page bundle.
- **Canvas renderer, not DOM.** Near Miss renders 60fps traffic, road, sprites, and floating text with a plain Canvas 2D context. No virtual DOM reconciliation touches the game scene during active play.
- **Throttled React state updates.** The game loop emits snapshots to React at most once every 90ms, not every animation frame. The canvas renders every frame regardless.
- **SVG sprites pre-loaded at module init.** Vehicle SVGs are loaded as `HTMLImageElement` objects when the renderer module is first imported, ensuring they are ready before the first frame.
- **Delta capping.** Frame delta is hard-capped at 34ms. If the browser suspends the tab and then resumes, the physics do not spiral.
- **PostHog via reverse proxy.** `next.config.mjs` rewrites `/ingest/*` to PostHog's ingestion endpoint, routing analytics through the first-party domain to reduce ad-blocker interference. PostHog is initialized via `instrumentation-client.ts` — the Next.js 15.3+ instrumentation hook — keeping it out of the React component tree entirely.
- **Cloudflare Pages + Worker + D1.** The full stack runs at the edge with zero server infrastructure to manage. The Next.js API routes are thin proxies; the Cloudflare Worker owns all score persistence logic with a D1 SQLite database.

---

### Section 4 — PostHog Implementation

#### Initialization

PostHog is initialized in `instrumentation-client.ts` using the Next.js 15.3+ `register` hook pattern. This runs once on the client, outside of any React component, with no provider wrapper required. Configuration:

```ts
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",          // proxied through Next.js to bypass ad blockers
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,     // automatic JS error capture enabled
  debug: process.env.NODE_ENV === "development",
});
```

#### Events Captured

Every meaningful player action in both games fires a PostHog event. All events include a `game` property identifying which game fired it.

**Near Miss (`src/games/near-miss/NearMissGame.tsx`)**

| Event | Trigger | Key Properties |
|---|---|---|
| `game_started` | Player clicks "Start Run" | `game: "near-miss"` |
| `game_restarted` | Player restarts after game over | `game: "near-miss"` |
| `game_over` | Run ends (crash) | `game`, `score`, `near_misses`, `distance`, `elapsed_seconds`, `average_speed`, `is_new_best` |
| `score_submitted` | Successful leaderboard submission | `game`, `score`, `near_misses`, `distance`, `elapsed_seconds`, `average_speed` |
| `score_submit_failed` | Submission API error | `game`, `error` |

**Beat the Scrambler (`src/games/beat-the-scrambler/mountBeatTheScrambler.js`)**

| Event | Trigger | Key Properties |
|---|---|---|
| `game_started` | Player selects a difficulty | `game: "beat-the-scrambler"`, `difficulty`, `board_size` |
| `game_restarted` | Player restarts mid-puzzle | `game`, `difficulty` |
| `puzzle_solved` | Player completes the puzzle | `game`, `difficulty`, `board_size`, `moves`, `elapsed_seconds`, `is_new_best` |
| `score_submitted` | Successful leaderboard submission | `game`, `difficulty` |
| `score_submit_failed` | Submission API error | `game`, `difficulty`, `error` |

#### Dashboards and Funnels Built

The PostHog integration shipped with a set of pre-built insights and a product dashboard:

- **Analytics Basics Dashboard** — session volume, active users, game starts by day
- **Game Starts by Game** — daily `game_started` events broken down by `game` property, showing relative popularity across both titles
- **Near Miss: Score Submission Funnel** — `game_started → game_over → score_submitted` conversion, identifying how many players survive long enough to submit and how many drop off at the score entry step
- **Beat the Scrambler: Puzzle Completion Funnel** — `game_started → puzzle_solved` conversion, segmentable by `difficulty` to see which board size drives the most drop-off
- **Near Miss: Average Final Score** — mean score at game over over time, useful for detecting if a tuning change affected player performance
- **Score Submit Success vs Failure** — `score_submitted` vs `score_submit_failed` over time, monitoring leaderboard API reliability

---

### Section 5 — Product Analytics Narrative

#### What the Data Enables

The PostHog instrumentation was designed around three product questions:

**1. Which games keep players coming back?**
`game_started` and `game_restarted` events, broken down by `game`, show not only which game attracts more first plays but how often players immediately retry — a strong signal of session depth and fun-factor.

**2. Where do players drop off in the post-game flow?**
The score submission funnels make the post-game funnel visible: of players who finish a run, what fraction bother to submit a score? A low submission rate suggests the game-over modal copy is weak, the leaderboard is not visible enough, or the name entry step has too much friction. The `score_submit_failed` event separately monitors API reliability so infrastructure issues do not get misread as product problems.

**3. Does difficulty selection match player capability?**
For Beat the Scrambler, `puzzle_solved` events with `difficulty`, `moves`, and `elapsed_seconds` properties allow comparison across Easy / Medium / Hard cohorts. If Hard has an extremely low solve rate but high start rate, the difficulty curve may be discouraging rather than challenging. The move count and time distributions can identify whether players are solving efficiently or getting stuck.

#### Near Miss-Specific Signals

The `game_over` event for Near Miss carries a rich payload: `near_misses`, `distance`, `elapsed_seconds`, `average_speed`, and `is_new_best`. These properties support questions like:

- What is the median run length in seconds? If most runs end in under 15 seconds, early-game traffic density may be too aggressive.
- Do players who chase near misses (high `near_misses`) score better on average? If not, the streak scoring incentive may not be landing.
- Does the `is_new_best` flag correlate with `score_submitted`? If new-best players are far more likely to submit, the game-over modal should surface personal bests more prominently to motivate others.
- Average speed at game over compared to baseline cruise speed indicates whether players are braking defensively or pushing speed, and whether the difficulty curve (speed ramp per second) is hitting the right balance.

#### Iteration Pathways

- **Traffic density ramp** — All spawn timing lives in `tuning.ts`. If analytics show most crashes happen in the first 20 seconds, reducing the density ramp or extending the grace period is a one-number change that can be A/B tested with a PostHog feature flag on the `game_started` event.
- **Difficulty curves** — Beat the Scrambler's scramble move counts (Easy: 12, Medium: 100, Hard: 180) are config constants. Completion rates by difficulty in PostHog directly measure whether these values produce engaging challenge or discouraging difficulty.
- **Score submission copy** — The score submission funnel measures the start → submission gap. Session replay on players who hit `game_over` but not `score_submitted` would surface exactly where they leave.

---

### Section 6 — Suggested Metrics to Capture for the Portfolio Entry

If screenshots of PostHog dashboards are available, the following are the highest-signal visuals for a portfolio audience:

1. **The Score Submission Funnel for Near Miss** — shows the three-step funnel (game started → game over → score submitted) with conversion percentages. This is the clearest demonstration that the analytics are wired to product outcomes, not just vanity metrics.
2. **Game Starts by Game over time** — a simple trend chart showing volume growth across both titles, demonstrating the multi-game platform strategy.
3. **Beat the Scrambler Puzzle Completion by Difficulty** — a breakdown funnel or bar chart showing solve rates at Easy / Medium / Hard, illustrating how analytics inform game balance decisions.
4. **Near Miss Average Final Score over time** — demonstrates that the team tracks gameplay performance trends, not just traffic metrics.

---

### Section 7 — Technical Highlights for Sidebar or Tags Section

These bullet points are suitable for a "Built With" or "Technical Decisions" sidebar on the case study page:

- **Next.js 15 App Router** with static params for game routes (`generateStaticParams`) and server-side metadata per game page
- **Custom TypeScript Canvas game engine** — no game framework dependencies; the Near Miss simulation is a pure class with no React in the hot path
- **PostHog via instrumentation hook** — initialized outside the React tree; reverse-proxied through the app domain to reduce ad-blocker interference; exception capture enabled
- **Gameplay funnels** tracking start → completion → score submission for both games, with per-difficulty segmentation for the tile puzzle
- **Cloudflare Pages + Worker + D1** — edge-deployed, no server infrastructure, leaderboard scores persisted in a Cloudflare D1 SQLite database through an authenticated API proxy
- **Mobile-native input** — Pointer Events with pointer capture for reliable multitouch, scroll lock during play, and viewport-aware game focus scrolling
- **Dynamic imports** — jQuery and Beat the Scrambler game modules load only when that game page mounts, entirely absent from the main bundle
- **No login required** — instant play with localStorage-backed personal bests; leaderboard submission is optional and uses a persisted arcade name

---

## Implementation Instructions for the Rose City Commerce Agent

1. Create a new portfolio project entry in whatever data structure or file the Rose City Commerce site uses to define project cards (likely a JSON file, MDX file, or TypeScript constant).

2. The project entry should include:
   - `title`: `"Soft Arcade Games"`
   - `slug` or `id`: `"soft-arcade-games"`
   - `url`: `"https://softarcadegames.com"`
   - `summary`: The 2–3 sentence card summary from Section 1 above
   - `tags`: The tag list from Section 1 above
   - `featured`: `true` (this is a flagship owned-product entry for a PostHog application)

3. Create the case study page content following the section structure in Section 2. Match the tone, terminology, and section depth of existing case study pages on the Rose City Commerce site. Do not use casual phrasing; write as a technical portfolio case study.

4. If the site supports hero images per project, use a placeholder path such as `/images/projects/soft-arcade-hero.png` and note in a comment or adjacent TODO that a screenshot of the Near Miss canvas gameplay should be placed there.

5. If the site supports dashboard screenshot embeds, use placeholders for the four PostHog chart screenshots described in Section 6 with descriptive alt text.

6. Do not invent technical details not listed in this prompt. Every architectural fact, event name, property name, and infrastructure component listed here is accurate and verifiable against the source code.

7. Position Soft Arcade as a **Rose City Commerce owned product** — not a client project — to match the "internal build / owned product" framing appropriate for a portfolio piece.
