# Article Spec: Scoring Design and Cheat Prevention in Near Miss

## Summary

Near Miss uses a multi-component score formula that rewards distance covered, time survived, and speed above baseline — then applies a suite of behavioral penalties that prevent the most obvious exploits: braking to farm near-miss bonuses, parking between lanes to exploit the corridor, and submitting runs from mismatched scoring versions. This article dissects every score component, explains the `scoreOffset` ratchet that keeps the displayed number from ever going backwards, maps the anti-exploit pressure systems (safe-channel penalty, braking penalty, lane-split cooldown), and shows how the Cloudflare Worker backend enforces a `scoring_version` field to support formula updates without invalidating old leaderboard entries.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/near-miss/engine/scoring.ts` | `getDistanceScore`, `getSurvivalScore`, `getSpeedScore`, `getNearMissBonus`, `getFeedbackForStreak`, `SCORE_TUNING` | The pure math: no game state dependencies |
| `src/games/near-miss/engine/gameLoop.ts` | Applies `brakingScorePenalty`, `safeChannelScorePenalty`, `scoreOffset` ratchet, streak combo decay, `laneSplitBonus` | The game loop integrates the score components each tick |
| `src/games/near-miss/engine/tuning.ts` | `safeChannelWindow`, `safeChannelBand`, `safeChannelScorePenalty`, `laneSplitBonus`, `laneSplitCooldown`, `streakScoreStep` | All numeric constants for the anti-exploit systems |
| `src/games/near-miss/NearMissGame.tsx` | Submits `{ score, distance, elapsed_seconds, near_misses, average_speed, scoring_version }` to the leaderboard API | Defines the schema the backend validates |
| `src/lib/leaderboards/server.ts` | Next.js API proxy that hashes client IP before forwarding to Cloudflare Worker | Server-side cheat-surface reduction |

---

## Key Design Patterns

### The Three-Component Base Score

Every tick that the player is NOT braking, three counters accumulate:

```ts
// scoring.ts
export function getDistanceScore(distance: number) {
  return Math.floor(distance * 0.018);       // rewards covering ground
}
export function getSurvivalScore(elapsed: number) {
  return Math.floor(elapsed * 8);            // rewards staying alive
}
export function getSpeedScore(speed: number, baselineSpeed: number, elapsed: number) {
  const speedRatio = Math.max(0, speed / baselineSpeed - 0.75);
  return Math.floor(speedRatio * elapsed * 0.24 * 100); // rewards running fast
}
```

`getSpeedScore` is designed so that at exactly the baseline speed, `speedRatio = 0.25` — a positive contribution — and above it, the contribution grows. Below 75% of baseline the speed score zeroes out.

### The scoreOffset Ratchet

The raw score can temporarily dip if the player's speed drops after a fast burst (because `getSpeedScore` is speed-dependent). Rather than showing a score that ticks backwards, `scoreOffset` preserves the highest value ever displayed:

```ts
const candidateScore = rawScore + state.scoreOffset;

if (candidateScore < state.score) {
  state.scoreOffset += state.score - candidateScore;
}

state.score = Math.max(state.score, Math.floor(rawScore + state.scoreOffset));
```

This means the displayed score is monotonically non-decreasing, matching player expectation from classic arcade games.

### Braking Suppresses Score Entirely

While `state.input.brake` is held, the game stops advancing `scoreDistance`, `scoreElapsed`, and `scoreSpeed`. Additionally, any near-miss earned during braking receives only `SCORE_TUNING.brakingNearMissPenalty` (0.82×) of the normal bonus. And in `awardNearMiss`, if the player is currently braking, the near-miss is recorded but **no bonus is awarded at all**:

```ts
private awardNearMiss(car: TrafficCar) {
  if (this.state.input.brake) {
    car.nearMissed = true;   // prevents double-counting
    car.streakAccounted = true;
    return;                  // no points, no streak increment
  }
  // ...normal award logic
}
```

This prevents the tactic of tapping the brake to stop beside a car and harvesting a stationary near-miss.

### Safe-Channel (Between-Lane) Penalty

The "safe channel" is the gap between two lane centers. If the player rides this gap without nearby traffic for more than `safeChannelWindow` seconds (1.2 s), a 0.82× score multiplier kicks in and the combo timer drains faster:

```ts
const safeChannelScoreFactor = state.safeChannelTimer > TUNING.safeChannelWindow
  ? TUNING.safeChannelScorePenalty   // 0.82
  : 1;
```

Additionally, at high speed, the player's car develops a lateral wobble while between lanes (`safeChannelInstability`), making sustained camping physically uncomfortable.

### Lane-Split Bonus with Cooldown

Squeezing between two adjacent cars while traveling in the safe channel earns a `laneSplitBonus` (325 points) — but only if at least 2 cars are nearby and the player has lateral velocity above a minimum threshold. A 1.1-second cooldown prevents rapid-fire triggering:

```ts
if (
  !this.state.input.brake &&
  nearbySplitTraffic >= TUNING.laneSplitBonusThreshold &&
  this.state.laneSplitCooldown === 0 &&
  Math.abs(this.state.player.lateralVelocity) >= TUNING.laneSplitMinLateralSpeed
) {
  this.state.bonusScore += bonus;
  this.state.laneSplitCooldown = TUNING.laneSplitCooldown; // 1.1s
}
```

### Near-Miss Streak and Combo Window

Consecutive near-misses build a streak. Each additional miss within the `comboWindow` (2.35 s) adds `streakStep` (75 pts) to the next bonus, capped at `streakCap` (6× multiplier). Missing a car while the combo timer is running resets the streak. The combo window shrinks proportionally when a missed car passes — a streakless player loses their combo faster:

```ts
state.comboTimer = Math.max(0, state.comboTimer - delta);
if (state.comboTimer === 0 && state.streak > 0) {
  state.streak = 0;
}
```

### Server-Side: scoring_version and IP Hashing

When the player's run ends, `NearMissGame.tsx` posts `scoring_version: 1` alongside the score. If the scoring formula changes, the backend can reject or bucket old-version submissions separately, preserving leaderboard integrity across formula updates. The Next.js proxy in `leaderboards/server.ts` computes a SHA-256 hash of the client IP before forwarding to the Cloudflare Worker, so the worker never sees a raw IP — only a one-way hash usable for rate-limiting without storing PII.

---

## Suggested Diagram

```
Each tick (while NOT braking):
  scoreDistance += speed * delta
  scoreElapsed  += delta
  scoreSpeed     = speed

rawScore =
  ( getDistanceScore(scoreDistance)
  + getSurvivalScore(scoreElapsed)
  + getSpeedScore(scoreSpeed, baseline, scoreElapsed)
  ) * brakingFactor           // 0.9 if speed < 92% baseline, else 1.0
  + bonusScore                // cumulative near-miss bonuses
  + streak * streakScoreStep  // active streak bonus
  ) * safeChannelFactor       // 0.82 if camping between lanes, else 1.0

score = max(score, floor(rawScore + scoreOffset))
        ↑ ratchet: never goes backwards

Leaderboard POST payload:
  { score, distance, elapsed_seconds, near_misses,
    average_speed, scoring_version: 1 }
```

---

## Why It Matters

Score systems that allow braking exploits, position camping, or version-skew submissions erode player trust in leaderboards. Near Miss's multi-layered approach — braking stops accrual, safe-channel camping incurs a multiplier penalty, combo cooldowns prevent bonus farming — makes honest fast play the optimal strategy, not the discovery of a loophole. The `scoring_version` field is cheap to add but invaluable when iterating on game balance: old runs stay valid under their original formula, new runs opt into the latest one.
