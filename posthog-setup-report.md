<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Soft Arcade. PostHog is initialized via `instrumentation-client.ts` using the Next.js 15.3+ pattern (no provider required). A reverse proxy is configured in `next.config.mjs` to route analytics through `/ingest`, reducing ad-blocker interference. Event capture has been added to both games: the React-based Near Miss game uses `posthog-js` directly, and the legacy jQuery-based Beat the Scrambler game uses `window.posthog` (available after the client-side init).

| Event | Description | File |
|---|---|---|
| `game_started` | Player starts a Near Miss run for the first time | `src/games/near-miss/NearMissGame.tsx` |
| `game_restarted` | Player restarts a Near Miss run after game over | `src/games/near-miss/NearMissGame.tsx` |
| `game_over` | Near Miss run ends; includes score, near misses, distance, elapsed time, avg speed | `src/games/near-miss/NearMissGame.tsx` |
| `score_submitted` | Player successfully submits a leaderboard score (Near Miss) | `src/games/near-miss/NearMissGame.tsx` |
| `score_submit_failed` | Leaderboard score submission fails (Near Miss) | `src/games/near-miss/NearMissGame.tsx` |
| `game_started` | Player selects a difficulty and begins a Beat the Scrambler puzzle | `src/games/beat-the-scrambler/mountBeatTheScrambler.js` |
| `puzzle_solved` | Player completes a Beat the Scrambler puzzle; includes difficulty, moves, time | `src/games/beat-the-scrambler/mountBeatTheScrambler.js` |
| `score_submitted` | Player successfully submits a leaderboard score (Beat the Scrambler) | `src/games/beat-the-scrambler/mountBeatTheScrambler.js` |
| `score_submit_failed` | Leaderboard score submission fails (Beat the Scrambler) | `src/games/beat-the-scrambler/mountBeatTheScrambler.js` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/449882/dashboard/1655400)
- [Game Starts by Game](https://us.posthog.com/project/449882/insights/6tptGfb4) — daily starts broken down by game
- [Near Miss: Score Submission Funnel](https://us.posthog.com/project/449882/insights/3i9p8LVV) — start → game over → score submitted conversion
- [Beat the Scrambler: Puzzle Completion Funnel](https://us.posthog.com/project/449882/insights/y9vyYLy1) — start → puzzle solved conversion
- [Near Miss: Average Final Score](https://us.posthog.com/project/449882/insights/odk0Xl7B) — average score at game over over time
- [Score Submit Success vs Failure](https://us.posthog.com/project/449882/insights/M4T1xQvK) — leaderboard submission reliability

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
