# Article Spec: PostHog Analytics — Instrumenting Two Games on One Platform

## Summary

Soft Arcade tracks every meaningful player action in both games with PostHog, an open-source product analytics platform. This article maps every `posthog.capture()` call across both `mountBeatTheScrambler.js` and `NearMissGame.tsx`, explains what properties are captured with each event, describes how the two architectures differ in where and how PostHog is injected, and discusses what funnels and retention analyses can be derived from the data. It also covers the local-storage personal-best system that supplements server leaderboards with immediate, no-latency feedback.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/beat-the-scrambler/BeatTheScramblerGame.tsx` | Imports `posthog-js` and passes the `posthog` object into `mountBeatTheScrambler` | The handoff point — PostHog enters the jQuery world via function argument |
| `src/games/beat-the-scrambler/mountBeatTheScrambler.js` | Calls `posthog.capture(...)` for `game_started`, `game_restarted`, `puzzle_solved`, `score_auto_save_started`, `score_auto_save_success`, `score_auto_save_failed`, `score_submitted`, `score_submit_failed`, `arcade_name_set` | All Beat the Scrambler events |
| `src/games/near-miss/NearMissGame.tsx` | Calls `posthog.capture(...)` for `game_started`, `game_restarted`, `play_again_clicked`, `game_over`, `leaderboard_opened`, `score_auto_save_started`, `score_auto_save_success`, `score_auto_save_failed`, `score_submitted`, `score_submit_failed`, `arcade_name_set` | All Near Miss events |
| `src/app/layout.tsx` | Where PostHog is initialized (standard Next.js App Router client-side setup) | Global init, applies to both games |
| `instrumentation-client.ts` | Next.js client instrumentation entry point | Wires up PostHog before any page renders |

---

## Full Event Map

### Beat the Scrambler

| Event | Properties | When fired |
|---|---|---|
| `game_started` | `game: "beat-the-scrambler"`, `difficulty`, `board_size` | Player clicks a level button (Easy/Medium/Hard) |
| `game_restarted` | `game`, `difficulty` | Player confirms restart from HUD |
| `puzzle_solved` | `game`, `difficulty`, `board_size`, `moves`, `elapsed_seconds`, `is_new_best` | `isSolved()` returns true |
| `score_auto_save_started` | `game`, `difficulty` | Submit button pressed or auto-submit triggered |
| `score_auto_save_success` | `game`, `difficulty` | Server returned 200 |
| `score_auto_save_failed` | `game`, `difficulty`, `error` | Network or server error |
| `score_submitted` | `game`, `difficulty` | Duplicate of success event (legacy compatibility) |
| `score_submit_failed` | `game`, `difficulty`, `error` | Duplicate of failure event |
| `arcade_name_set` | `game` | Player saves or changes their arcade name without a pending score |

### Near Miss

| Event | Properties | When fired |
|---|---|---|
| `game_started` | `game: "near-miss"` | `startRun()` called |
| `game_restarted` | `game` | `restartRun()` called after game over |
| `play_again_clicked` | `game` | Same `restartRun()` path (enables funnel segmentation) |
| `game_over` | `game`, `score`, `near_misses`, `distance`, `elapsed_seconds`, `average_speed`, `is_new_best` | Snapshot status transitions to `"gameOver"` |
| `leaderboard_opened` | `game` | Player opens leaderboard from game-over modal |
| `score_auto_save_started` | `game` | Auto-submit begins on game-over |
| `score_auto_save_success` | `game` | Leaderboard API returned 2xx |
| `score_auto_save_failed` | `game`, `error` | API error |
| `score_submitted` | `game`, `score`, `near_misses`, `distance`, `elapsed_seconds`, `average_speed` | Success (includes full run stats) |
| `score_submit_failed` | `game`, `error` | Failure |
| `arcade_name_set` | `game` | Name changed without auto-submit |

---

## Key Design Patterns

### PostHog Injection Pattern: The Function Argument

Beat the Scrambler runs inside a jQuery environment where ES module imports are unavailable at runtime. Rather than bundling PostHog into the legacy script, `BeatTheScramblerGame.tsx` imports `posthog-js` as a React module and passes the resolved instance directly into the jQuery factory:

```tsx
const { mountBeatTheScrambler } = await import("./mountBeatTheScrambler.js");
cleanupGame = mountBeatTheScrambler(posthog);
```

Inside `mountBeatTheScrambler.js`, `posthog` is just a parameter, never imported. This keeps the jQuery file self-contained and testable without PostHog installed.

Near Miss is a TypeScript module and imports PostHog directly:

```ts
import posthog from "posthog-js";
// ...
posthog.capture("game_over", { game: "near-miss", score: ... });
```

### Event Timing: React Effect vs. Inline Call

In Near Miss, `game_over` is fired inside a `useEffect` that watches `snapshot.status`:

```ts
useEffect(() => {
  if (snapshot.status === "gameOver") {
    const s = snapshotRef.current;
    posthog.capture("game_over", {
      score: Math.floor(s.score),
      near_misses: Math.floor(s.nearMisses),
      // ...
    });
  }
}, [snapshot.status]);
```

`snapshotRef.current` is used rather than `snapshot` to read the latest values without stale closure issues — important because `snapshot` may already be the next render's value by the time the effect runs.

### Local Storage as the First-Party Analytics Supplement

Both games write personal bests to `localStorage` immediately on completion, before the server round-trip:

```ts
// Beat the Scrambler (game-utils.js)
function getUpdatedBest(previousBest, moveCount, timerSeconds) {
  const isNewBest = !previousBest
    || timerSeconds < previousBest.time
    || moveCount < previousBest.moves;

  if (!isNewBest) return { isNewBest: false, best: previousBest };

  return {
    isNewBest: true,
    best: {
      time: previousBest ? Math.min(previousBest.time, timerSeconds) : timerSeconds,
      moves: previousBest ? Math.min(previousBest.moves, moveCount) : moveCount
    }
  };
}
```

```ts
// Near Miss (NearMissGame.tsx)
const BEST_SCORE_KEY = "soft-arcade-near-miss-best-score";
window.localStorage.setItem(BEST_SCORE_KEY, String(score));
```

The `is_new_best` property on `puzzle_solved` and `game_over` events ties local storage truth to analytics — PostHog can report the true proportion of sessions that produced a personal best without querying the leaderboard API.

### Deduplication via Run ID

Near Miss tracks a `runIdRef` that increments on every `startRun` or `restartRun`. The score submission logic checks `submittedRunIdRef.current === runIdRef.current` before sending, preventing double-submission if the component re-renders between game-over and the auto-submit effect.

---

## Suggested Funnels (PostHog Setup)

```
[game_started]
    |
    v
[puzzle_solved or game_over]   -- conversion: did they finish?
    |
    v
[score_auto_save_started]      -- did the game attempt to save?
    |
    v
[score_auto_save_success]      -- did the save succeed?
    |
    v
[play_again_clicked / game_started (next run)]  -- retention: did they play again?
```

```
Breakdown by:
  - difficulty (beat-the-scrambler)
  - is_new_best
  - device type (PostHog session property)
  - score quartile (Near Miss game_over)
```

---

## Why It Matters

Instrumenting both games with a consistent event vocabulary (`game_started`, `game_over`, `score_submitted`) means PostHog funnels and retention queries work across the entire platform, not just one game. The function-argument injection pattern for the jQuery game is a practical solution to a real constraint: it avoids bundling PostHog twice, keeps the legacy script decoupled, and makes the analytics dependency explicit in the type signature of `mountBeatTheScrambler`. For a small studio, this level of instrumentation — start, solve/crash, submit — answers the most important product questions: is each game being discovered, completed, and replayed?
