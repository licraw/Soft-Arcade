# Article Spec: Building Near Miss Traffic — From Ghost Cars to Lane Following

## Summary

Near Miss is a top-down traffic-dodge arcade game where the entire experience lives or dies by how traffic cars behave. Getting that behavior right turned out to be a multi-phase engineering problem: early traffic was simple and predictable to the point of feeling fake; attempts to make it "smarter" created jams, exploits, and confusing physics; and a series of deliberate tradeoffs gradually produced a system that feels believable without sacrificing arcade fun. This article tells that story from ghost cars with a hard-coded minimum speed, through a discarded packet-validation experiment, to the current world-speed decoupling model and lane-following system.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/near-miss/engine/spawner.ts` | `TRAFFIC_PACKETS` table, `spawnTrafficPacket`, `choosePacket`, `chooseStartLane`, `packetWouldStack`, `buildLaneRecentEntries`, `getEdgeLaneInwardBias` | The entire traffic generation and placement system |
| `src/games/near-miss/engine/gameLoop.ts` | `updateTrafficFollowing`, `moveTraffic`, `getTrafficByLaneSorted`, `getTrafficScreenYSpeed`, `updateLaneSplitPressure` | Traffic physics, car-following AI, and screen-projection math |
| `src/games/near-miss/engine/tuning.ts` | `trafficFollowingGapCars`, `trafficFollowingGapMinPx`, `trafficFollowingLookaheadSeconds`, `trafficEmergencyBrakeMphPerSecond`, `trafficCompressionGapRatio`, `trafficMinPhysicalGapPx`, `trafficNearSpeedDeadzoneMph`, `trafficApproachCurveScaleMph`, `corridorShiftFrequency`, `edgeLaneInwardBias` | All constants that were tuned across iterations |
| `src/games/near-miss/engine/vehicleConfig.ts` | `spawnWeight`, `crashMass`, `crashSpinResistance`, `crashSlideResistance` per vehicle class | Per-vehicle physics properties used by spawner and crash engine |
| `src/games/near-miss/engine/collision.ts` | `hasPlayerPassedTraffic` | The one-line gate that determines when to award a near-miss |
| `src/games/near-miss/engine/modes.ts` | `NEAR_MISS_MODE_CONFIG` | Mode scaffolding that anticipated multiple difficulty settings |

---

## Key Design Topics

### Phase 1: Ghost Cars and a Hard-Coded Floor

The first working version of traffic generation was intentionally minimal. Each car was given a `forwardSpeed` set at spawn time — a fraction of the player's current speed at that moment — and moved each tick with a single expression:

```ts
// near-miss-stage1-attempt branch, gameLoop.ts
const relativeYSpeed = Math.max(28, state.speed - car.forwardSpeed);
car.y += relativeYSpeed * delta;
```

The `Math.max(28, ...)` floor guaranteed that traffic always appeared to scroll toward the player at some minimum rate. This made the game legible immediately — traffic never stalled on screen — but created two problems that would take multiple iterations to solve.

**Problem one: ghosting.** With no inter-car awareness, traffic cars could and did occupy the same position when packets were spawned close together or when fast cars caught up to slow ones. The overlap was visually jarring and made the road feel fake.

**Problem two: speed anchoring.** `forwardSpeed` was derived from the player's speed at the moment the car spawned. A convoy spawned while the player was accelerating would move at a reasonable pace — but if the player then braked, the same convoy would appear to freeze or even reverse direction. The minimum floor of 28 masked the worst cases but could not hide the discontinuity on hard braking.

**What worked:** The simplicity meant the game loop was easy to reason about, and traffic density and variety could be tuned quickly without worrying about emergent physics. Early playtesting confirmed the core mechanic — threading gaps at speed — was genuinely fun before any of the complexity was added.

---

### Phase 2: The Solve-Mode Experiment (and Why It Was Abandoned)

Before fixing the speed problem, there was a parallel attempt to make traffic generation provably fair. A separate file, `spawnValidator.ts`, was written to simulate whether the player could actually survive each spawn before it was committed. Every packet declared its allowed `solveModes` and `intensityBand`:

```ts
// near-miss-stage1-attempt branch, spawner.ts
{
  id: "staggered-triple",
  minElapsed: 18,
  openingType: "staggered-thread",
  solveModes: ["flow-thread", "lift-merge", "hold-shift"],
  intensityBand: "pressure",
  cars: [...]
}
```

Four `SolveProfile` types defined different player behaviors the validator would try:

```ts
// near-miss-stage1-attempt branch, spawnValidator.ts
const SOLVE_PROFILES: SolveProfile[] = [
  { mode: "flow-thread",  brakeSeconds: 0,    waitSeconds: 0,    speedAfterBrake: 1    },
  { mode: "lift-merge",   brakeSeconds: 0.35, waitSeconds: 0.18, speedAfterBrake: 0.9  },
  { mode: "brake-reset",  brakeSeconds: 0.82, waitSeconds: 0.42, speedAfterBrake: 0.72 },
  { mode: "hold-shift",   brakeSeconds: 0,    waitSeconds: 0.92, speedAfterBrake: 1    }
];
```

The validator ran up to 12 simulation steps over 2.4 seconds per profile per target lane. The `SpawnOptions` struct included `playerLane` and `playerY` so the validator knew exactly where the player was.

**Why it was removed:** The simulation was expensive, and — more critically — it made assumptions about player behavior that didn't hold. Real players don't commit to a lane smoothly; they hesitate, oversteer, and change plans mid-approach. A packet that the validator declared solvable via "lift-merge" was often unsolvable by a real player whose entry angle was wrong. The validator also couldn't account for traffic that had been on screen before the new packet arrived. The entire `spawnValidator.ts` file and all associated packet metadata fields were eventually deleted. What survived were the packet shapes themselves — the named blueprints proved useful even without the validation layer.

**Lesson:** Forward simulation of player decisions is hard. The game's randomness made the guarantees false in practice. Better to tune density and corridor width empirically than to prove solvability analytically.

---

### Phase 3: Lane Following and the Emergence of Traffic Jams

With the validator experiment shelved, the next iteration added inter-car awareness. The `improve-traffic-generation` branch introduced `updateTrafficFlow`, giving each car a `compression` value that recorded how much it was being pushed into the car ahead:

```ts
// improve-traffic-generation branch, gameLoop.ts
private updateTrafficFlow(delta: number) {
  for (const carsInLane of laneGroups.values()) {
    carsInLane.sort((a, b) => b.y - a.y);

    for (let index = 0; index < carsInLane.length; index++) {
      const car = carsInLane[index];
      const desiredRelativeYSpeed = getTrafficRelativeYSpeed(state.speed, car.forwardSpeed);
      const frontCar = index > 0 ? carsInLane[index - 1] : null;
      let nextY = car.y + desiredRelativeYSpeed * delta;

      if (frontCar) {
        const maxFollowingY = frontCar.y - car.height - followingGap;
        if (nextY > maxFollowingY) {
          car.blockedById = frontCar.id;
          car.compression = nextY - maxFollowingY;
          nextY = maxFollowingY;
        }
      }
      car.y = nextY;
    }
  }
}
```

A `logTrafficFlowDebug` function was added alongside it — the fact that it was needed at all signals that the team was watching real traffic jams form during playtesting and needed tooling to understand why.

The jams had two causes. First, when the player braked hard, `state.speed` dropped sharply, which drove every car's `desiredRelativeYSpeed` (still computed as `max(28, playerSpeed - forwardSpeed)`) toward the floor simultaneously. All cars decelerated to the same minimum screen speed at the same moment, and the cars closest to the player compressed against their gap constraint — creating an accordion effect that looked like a highway pileup. Second, because `forwardSpeed` was anchored to the player's speed at spawn time, cars spawned during a boost phase moved faster than cars spawned during cruise, and would naturally catch up to and compress into the convoy ahead.

**What worked:** The `compression` model correctly prevented cars from occupying the same space. Traffic now formed believable platoons rather than ghosting through each other. The problem was that the platoons could freeze as a wall when the player braked.

---

### Phase 4: Decoupling World Speed from Screen Speed

The fundamental fix was separating two concepts that had been conflated from the start: how fast a car is traveling in the simulated world, and how fast it appears to move on screen.

In the current system each traffic car has `desiredWorldSpeed` and `currentWorldSpeed` in absolute MPH (ranging from 60–80), set at spawn time independently of the player:

```ts
// Current spawner.ts
const cruiseMph = TUNING.trafficMinCruiseMph + Math.random() * (TUNING.trafficMaxCruiseMph - TUNING.trafficMinCruiseMph);
const cruiseWorldSpeed = internalSpeedFromMph(cruiseMph);

packetCars.push({
  desiredWorldSpeed: cruiseWorldSpeed,
  currentWorldSpeed: cruiseWorldSpeed,
  // ...
});
```

`playerSpeed` was removed from `SpawnOptions` entirely. The screen projection is now handled by a dedicated function that uses exponential curves with a near-speed deadzone:

```ts
// Current gameLoop.ts
function getTrafficScreenYSpeed(playerWorldSpeed: number, trafficWorldSpeed: number) {
  const relativeSpeed = playerWorldSpeed - trafficWorldSpeed;
  const nearSpeedDeadzone = internalSpeedFromMph(TUNING.trafficNearSpeedDeadzoneMph); // 3 mph

  if (relativeSpeed >= 0) {
    if (relativeSpeed <= nearSpeedDeadzone) {
      return relativeSpeed * 0.35; // damp near-zero approach
    }
    const maxApproachSpeed = internalSpeedFromMph(TUNING.trafficMaxApproachScreenSpeedMph); // 70 mph equiv
    return Math.max(TUNING.minScreenApproachSpeed, Math.min(relativeSpeed, shapedApproachSpeed));
  }

  // Player is slower: cap pull-away speed so cars don't vanish instantly
  const maxPullAwaySpeed = internalSpeedFromMph(TUNING.trafficMaxPullAwayScreenSpeedMph); // 12 mph equiv
  return -Math.min(pullAwaySpeed, shapedPullAwaySpeed);
}
```

Three specific behaviors this unlocks: when the player brakes hard, fast traffic does approach faster on screen — but the exponential cap prevents the jarring sudden lurch of the old linear model. When the player and a car are moving at nearly the same speed, the deadzone prevents micro-oscillation in screen position. When a car overtakes the player (player is slower), it pulls away smoothly rather than snapping off screen.

The car-following model was rebuilt alongside this. Cars now accelerate and decelerate toward a target world speed with separate rates for normal following, braking, and emergency braking:

```ts
// Current gameLoop.ts – updateTrafficFollowing
const accelStep  = internalSpeedFromMph(TUNING.trafficAccelMphPerSecond)  * delta; //  5 mph/s
const brakeStep  = internalSpeedFromMph(TUNING.trafficBrakeMphPerSecond)  * delta; // 18 mph/s
const emergencyBrakeStep = internalSpeedFromMph(TUNING.trafficEmergencyBrakeMphPerSecond) * delta; // 35 mph/s

// Compressed gap uses emergency brake; otherwise use normal brake
speedStep = deeplyCompressed ? emergencyBrakeStep : brakeStep;
rear.currentWorldSpeed = moveToward(rear.currentWorldSpeed, targetWorldSpeed, speedStep);
```

A second pass in `moveTraffic` enforces a physical minimum gap regardless of speed:

```ts
// Current gameLoop.ts – moveTraffic
const minRearY = frontY + front.height + TUNING.trafficMinPhysicalGapPx; // 6px
if (rearY < minRearY) {
  nextYById.set(rear.id, Math.max(rearY, minRearY));
  rear.emergencyCorrected = true;
}
```

The `emergencyCorrected` flag is still tracked on each car — a remnant of the debug-logging era, kept because it signals when the physical constraint is firing and may be useful for future telemetry.

---

### Phase 5: Spawn Stack Safety and Edge-Lane Tuning

Even with lane following fixed, traffic could still spawn in ways that created immediate jams. If the spawn timer fired twice in quick succession, a new car could appear directly behind one that had just entered the road. `packetWouldStack` was introduced to check every car in a candidate packet against both existing off-screen traffic and sibling packet cars before committing:

```ts
// Current spawner.ts
function packetWouldStack(packet, startLane, laneCount, carHeight, laneRecentEntries, minGapPx) {
  const maxVehicleHeight = TUNING.trafficMaxOccupancyLengthScale *
    (TUNING.trafficHeightRandomBase + TUNING.trafficHeightRandomRange) * carHeight;

  for (const packetCar of packet.cars) {
    const spawnY = -carHeight + packetCar.yOffset * carHeight;
    const existingEntries = laneRecentEntries.get(lane);

    if (existingEntries?.some(e => wouldPhysicallyOverlap(e.y, e.height, spawnY, carHeight, minGapPx))) {
      return true;
    }
    // also checks against sibling packet cars...
  }
  return false;
}
```

The check uses a conservative `maxVehicleHeight` (accounting for trucks and size variance) so the constraint errs toward more space, not less.

Edge-lane bias was introduced at the same time. Cars in the leftmost or rightmost lane are nudged slightly inward so they never appear to hang off the road boundary:

```ts
// Current spawner.ts
function getEdgeLaneInwardBias(lane: number, laneCount: number) {
  if (lane === 0)           return  TUNING.edgeLaneInwardBias; //  0.10
  if (lane === laneCount-1) return -TUNING.edgeLaneInwardBias; // -0.10
  return 0;
}
```

The `minElapsed` for the `staggered-triple` packet was reduced from 18 seconds (improve-traffic-generation era) to 12 seconds in the current version, reflecting confidence that the stack-safety check made tighter early spawning safe.

---

### Phase 6: Pressure vs. Fairness — The Ongoing Balancing Act

With traffic that felt physically believable, a new problem emerged: the game was too easy. Players discovered they could ride the gap between two lane centers indefinitely, braking into near-misses to farm points while rarely being in genuine danger. Two systems were added in sequence to close this.

**The corridor system** ensures every packet leaves exactly one lane fully open, but that open lane rotates every `corridorShiftFrequency` seconds (3.5 s). Players must actively track the corridor rather than committing to a single lane:

```ts
// Current spawner.ts
function getCorridorLane(elapsed: number, laneCount: number) {
  return Math.floor(elapsed / TUNING.corridorShiftFrequency) % laneCount;
}

function packetFits(packet, startLane, laneCount, corridorLane) {
  const lanes = new Set(packet.cars.map(car => wrapLane(startLane + car.laneOffset, laneCount)));
  return lanes.size < laneCount && !lanes.has(corridorLane);
}
```

**The safe-channel pressure system** penalizes riding the lane seam without traffic nearby. Idling between lanes for more than 1.2 seconds without adjacent traffic activates a 0.82× score multiplier and drains the combo timer faster. At high speeds, the car also develops lateral instability while in the safe channel — a subtle physical nudge toward committing to a lane. When the lane seam has traffic on either side, the channel can instead award a `laneSplitBonus` (325 points), but only if the player has lateral velocity above a minimum threshold and hasn't collected one in the last 1.1 seconds. Camping earns nothing; threading earns a bonus.

The brake exploit was closed on the `fix-brake-exploit-in-nearmiss` branch. The fix introduced parallel scoring accumulators (`scoreDistance`, `scoreElapsed`, `scoreSpeed`) that stop advancing while the brake is held. The original approach had scored based on `state.elapsed` and `state.distance` directly — which continued increasing even during braking, so a player could hold a near-zero speed and still accumulate survival time. The fix also silently records near-misses during braking (to prevent double-counting) but awards no bonus and does not advance the streak.

---

## Suggested Diagrams

### Diagram 1: World Speed vs. Screen Speed

```
World space (absolute mph):
  Player  ──────────────────────────────►  80 mph
  Traffic ────────────────────►           65 mph
  Relative speed: +15 mph → car approaches screen

If player brakes to 40 mph:
  Player  ──────────────►                 40 mph
  Traffic ────────────────────────────►   65 mph
  Relative speed: -25 mph → car overtakes and pulls away

OLD model (forwardSpeed anchored at spawn):
  Traffic speed stored as: playerSpeedAtSpawn × 0.72
  When player brakes, this becomes *wrong* — car appears too slow

NEW model (worldSpeed decoupled):
  Traffic always travels at 60–80 mph in world space
  getTrafficScreenYSpeed() maps this to screen pixels per second
  Exponential curve caps approach/pull-away so transitions feel gradual
```

### Diagram 2: Traffic Packet Spawn Flow

```
Tick: spawnTimer <= 0
  │
  ├─► choosePacket(elapsed)
  │     filters TRAFFIC_PACKETS by minElapsed ≤ elapsed
  │     picks from unlocked pool (earlier = simpler patterns)
  │
  ├─► getCorridorLane(elapsed)     ← rotates every 3.5 seconds
  │
  ├─► for each available start lane:
  │     packetWouldStack()?        ← rejects if any car would spawn
  │     packetFits(corridorLane)?  ←  on top of existing traffic
  │                                   or would block the corridor
  │
  └─► spawn cars: x = laneCenter + lateralOffset + edgeLaneInwardBias
                  y = -height + yOffset * carHeight
                  speed = randomMph in [60, 80]  ← NOT player-relative
```

### Diagram 3: Lane-Following Car-Following Model

```
Cars in lane, sorted top-to-bottom (front → rear):

  [ Car A ]  y=120  worldSpeed=65 mph
      ↑ gap: 48px (> safeGap → not blocked)
  [ Car B ]  y=200  worldSpeed=70 mph
      ↑ gap: 12px (< safeGap → blocked by A)
  [ Car C ]  y=220  worldSpeed=72 mph

updateTrafficFollowing:
  Car A: targetWorldSpeed = desiredWorldSpeed (65)  → free to cruise
  Car B: blockedById = A.id
         targetWorldSpeed = A.currentWorldSpeed (65) → match front car
         gap < baseGap×0.55 → deeplyCompressed → use emergencyBrakeStep (35 mph/s)
  Car C: blocked by B → matches B's speed

moveTraffic (second pass):
  enforces minPhysicalGapPx = 6px regardless
  sets emergencyCorrected = true if constraint fires
```

### Diagram 4: Safe Channel Pressure

```
Player position (fractional lane):
  ──── lane 0 center ────|──── lane seam ────|──── lane 1 center ────
                          ↑
                    isBetweenLanes() = true  when |fractional - 0.5| ≤ 0.10

  Scenario A: between lanes, no nearby traffic
    safeChannelTimer accumulates → after 1.2s:
      score multiplier → 0.82×
      combo timer drains 1.6× faster
      at high speed: lateral instability wobble added

  Scenario B: between lanes, traffic on both sides, player moving
    laneSplitBonus = +325 pts  (if cooldown = 0, lateralVelocity ≥ threshold)
    cooldown → 1.1s

  Scenario C: in lane center
    safeChannelTimer decays at 2×/s
    no penalty
```

---

## Suggested Code Snippets

### 1. The Original Speed Floor vs. the Current Projection Function

```ts
// Stage 1 — simple, but breaks on braking
const relativeYSpeed = Math.max(28, state.speed - car.forwardSpeed);
car.y += relativeYSpeed * delta;

// Current — decoupled world/screen speed with exponential cap
function getTrafficScreenYSpeed(playerWorldSpeed: number, trafficWorldSpeed: number) {
  const relativeSpeed = playerWorldSpeed - trafficWorldSpeed;
  const nearSpeedDeadzone = internalSpeedFromMph(TUNING.trafficNearSpeedDeadzoneMph);

  if (relativeSpeed >= 0) {
    if (relativeSpeed <= nearSpeedDeadzone) return relativeSpeed * 0.35;
    const shapedApproachSpeed = maxApproachSpeed * (1 - Math.exp(-adjustedRelativeSpeed / approachCurveScale));
    return Math.max(TUNING.minScreenApproachSpeed, Math.min(relativeSpeed, shapedApproachSpeed));
  }
  // pull-away: symmetric exponential cap
  const shapedPullAwaySpeed = maxPullAwaySpeed * (1 - Math.exp(-adjustedPullAwaySpeed / pullAwayCurveScale));
  return -Math.min(pullAwaySpeed, shapedPullAwaySpeed);
}
```

### 2. Car-Following with Three Brake Rates

```ts
// Current gameLoop.ts – updateTrafficFollowing
const accelStep         = internalSpeedFromMph(TUNING.trafficAccelMphPerSecond)         * delta;
const brakeStep         = internalSpeedFromMph(TUNING.trafficBrakeMphPerSecond)         * delta;
const emergencyBrakeStep= internalSpeedFromMph(TUNING.trafficEmergencyBrakeMphPerSecond)* delta;

const gapPx = rear.y - (front.y + front.height);
const closingGapPx = Math.max(0, rear.currentWorldSpeed - front.currentWorldSpeed)
                     * TUNING.trafficFollowingLookaheadSeconds;
const safeGapPx = baseGapPx + closingGapPx;
const deeplyCompressed = gapPx < baseGapPx * TUNING.trafficCompressionGapRatio;

if (gapPx < safeGapPx) {
  rear.blockedById = front.id;
  targetWorldSpeed = front.currentWorldSpeed;
  speedStep = deeplyCompressed ? emergencyBrakeStep : brakeStep;
}
rear.currentWorldSpeed = moveToward(rear.currentWorldSpeed, targetWorldSpeed, speedStep);
```

### 3. Packet Stack-Safety Check

```ts
// Current spawner.ts
function packetWouldStack(packet, startLane, laneCount, carHeight, laneRecentEntries, minGapPx) {
  const maxVehicleHeight = TUNING.trafficMaxOccupancyLengthScale *
    (TUNING.trafficHeightRandomBase + TUNING.trafficHeightRandomRange) * carHeight;

  for (const packetCar of packet.cars) {
    const lane   = wrapLane(startLane + packetCar.laneOffset, laneCount);
    const spawnY = -carHeight + packetCar.yOffset * carHeight;

    if (laneRecentEntries.get(lane)?.some(e =>
        wouldPhysicallyOverlap(e.y, e.height, spawnY, carHeight, minGapPx))) {
      return true;
    }
  }
  return false;
}
```

### 4. Corridor Guarantee

```ts
// Current spawner.ts
function getCorridorLane(elapsed: number, laneCount: number) {
  return Math.floor(elapsed / TUNING.corridorShiftFrequency) % laneCount;
}

function packetFits(packet, startLane, laneCount, corridorLane) {
  const lanes = new Set(packet.cars.map(c => wrapLane(startLane + c.laneOffset, laneCount)));
  return lanes.size < laneCount && !lanes.has(corridorLane);
}
```

### 5. Brake Exploit Closure: Parallel Score Accumulators

```ts
// Current gameLoop.ts – scoring during the update loop
if (!state.input.brake) {
  state.scoreDistance += state.speed * delta;
  state.scoreElapsed  += delta;
  state.scoreSpeed     = state.speed;
}
// score is computed from scoreDistance/scoreElapsed/scoreSpeed — not
// from the raw elapsed and distance counters, which keep running always
```

---

## Why It Matters

Traffic is not scenery in Near Miss — it is the entire game. Every mechanical decision about how cars spawn, move, and respond to the player directly determines whether a run feels exciting or tedious, fair or arbitrary.

The evolution of the traffic system exposes a tension that runs through all arcade games: realism and fun are not the same thing, and optimizing for one can undermine the other. The solve-mode validator was a rigorous attempt to prove fairness mathematically; it failed because real players do not behave like the simulation assumed. The original `forwardSpeed` model was simple and fast; it failed because it produced physically absurd behavior the moment the player did something unexpected.

What the current system gets right is that it simulates enough physics to feel believable — world-space speeds, car-following, exponential speed curves — while retaining explicit arcade design decisions: a rotating escape corridor, a near-miss detection halo, and a penalty system that nudges players toward exciting behavior instead of punishing them for making safe choices. The constants in `tuning.ts` are not arbitrary; each one represents a session of playtesting where the game was either too easy, too hard, or too confusing, and a single number changed to fix it.

The remaining `emergencyCorrected` flag on each traffic car, the tight `minElapsed` ramp on multi-car packets, and the asymmetric pull-away speed cap are all small artifacts of that tuning history. A codebase that appears clean on the surface carries the memory of every failed experiment in the values it chose not to remove.
