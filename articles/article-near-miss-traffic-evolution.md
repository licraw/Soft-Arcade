---
title: "Building Near Miss Traffic: From Ghost Cars to Lane Following"
description: "How Near Miss traffic went from a hard-coded speed floor and overlapping ghost cars through a discarded validation experiment to a world-speed-decoupled system that feels believable without breaking arcade fun."
slug: "near-miss-traffic-evolution"
publishedAt: "2026-06-19"
updatedAt: "2026-06-19"
category: "Devlog"
tags:
  - Browser Games
  - TypeScript
  - Game Development
  - Arcade
canonicalPath: "/labs/near-miss-traffic-evolution"
---

[Near Miss](/games/near-miss) is a top-down traffic-dodge game. The player drives forward at speed, and traffic fills the road ahead. The goal is to thread gaps and collect near-misses without being caught.

Playing it well means staying fast. Braking costs score, and the real reward is in the threading — nudging past a bumper close enough to trigger the near-miss flash without clipping it. A good run is about reading the open lane ahead, committing to it before the gap closes, and finding the next one before you run out of road. That rhythm only works if the traffic feels real.

Traffic is not scenery in Near Miss — it is the entire game. Every decision about how cars spawn, move, and respond to the player directly determines whether a run feels exciting or tedious, fair or arbitrary. Getting that right turned out to be a multi-phase problem that spanned several branches, a full deleted module, and a lot of playtesting sessions that exposed things the code could not anticipate.

This is the story of that evolution, from ghost cars with a hard-coded minimum speed to the world-speed-decoupled car-following system running now.

[IMAGE: Traffic evolution overview — Phase 1 ghost cars overlapping, Phase 3 lane-following platoons, Phase 4 world-speed-decoupled traffic with smooth approach curves]

---

## Phase 1: Ghost Cars and a Speed Floor

The first working version of traffic was intentionally minimal. Each car received a `forwardSpeed` set at spawn time — a fraction of the player's current speed at that moment — and moved each tick with a single expression:

```ts
// near-miss-stage1-attempt branch
const relativeYSpeed = Math.max(28, state.speed - car.forwardSpeed);
car.y += relativeYSpeed * delta;
```

The `Math.max(28, ...)` floor guaranteed traffic always appeared to scroll toward the player at some minimum rate. The game was immediately legible: traffic never stalled on screen, density and variety were easy to tune, and early playtesting confirmed the core mechanic — threading gaps at speed — was genuinely fun before any complexity was added.

Two problems came with this simplicity.

**Ghosting.** With no inter-car awareness, traffic cars could and did occupy the same position when packets spawned close together or when fast cars caught a slow one. From the player's perspective, the overlap broke the core illusion — two cars occupying the same space made it impossible to read which gaps were real.

**Speed anchoring.** `forwardSpeed` was derived from the player's speed at the moment each car spawned. A convoy spawned during acceleration moved at a reasonable pace — but if the player then braked, the same convoy appeared to freeze or reverse direction. The `Math.max` floor masked the worst cases but could not hide the discontinuity on hard braking.

[IMAGE: Split-screen comparison — ghost cars overlapping on the left, the speed-anchoring freeze moment on the right]

---

## Phase 2: The Solve-Mode Experiment

Before fixing the speed problem, there was a parallel attempt to make traffic generation provably fair.

A separate file, `spawnValidator.ts`, was written to simulate whether the player could actually survive each spawn before it was committed. Every packet declared its allowed `solveModes` and `intensityBand`:

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

The validator ran up to 12 simulation steps over 2.4 seconds per profile per target lane. A packet only made it through if at least one profile could thread it.

**Why it was removed:** the simulation was expensive, and it made assumptions about player behavior that did not hold. Real players do not commit to a lane smoothly — they hesitate, oversteer, and change plans mid-approach. A packet the validator declared solvable via "lift-merge" was often unsolvable by a real player whose entry angle was wrong. The validator also could not account for traffic already on screen before the new packet arrived. The entire `spawnValidator.ts` file and all associated packet metadata fields were deleted.

What survived were the packet shapes themselves. The named blueprints proved useful even without the validation layer.

The lesson: forward simulation of player decisions is hard. The game's randomness made the guarantees false in practice. Better to tune density and corridor width empirically than to prove solvability analytically.

---

## Phase 3: Lane Following and the Emergence of Traffic Jams

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

A `logTrafficFlowDebug` function was added alongside this — the fact that it was needed at all signals that real traffic jams were forming during playtesting and the team needed tooling to understand why.

The jams had two causes. First, when the player braked hard, `state.speed` dropped sharply, which drove every car's `desiredRelativeYSpeed` toward the floor simultaneously. All cars decelerated to the same minimum screen speed at the same moment, and the cars closest to the player compressed against their gap constraint — creating an accordion effect that looked like a highway pileup. Second, because `forwardSpeed` was anchored to the player's speed at spawn time, cars spawned during a boost phase moved faster than cars spawned during cruise and would naturally catch up to and compress into the convoy ahead.

From the player's side, this made braking feel punishing in the wrong way. Braking should buy time and space. Instead, it triggered a wall of traffic that seemed to materialize from nowhere. The tool meant to manage risk was creating danger instead.

What worked: the `compression` model correctly prevented cars from occupying the same space. Traffic now formed believable platoons rather than ghosting through each other. The problem was that those platoons could freeze as a wall when the player braked.

[DIAGRAM: Lane-following car-following model — Cars in lane sorted top-to-bottom, showing blocked/compression state]

---

## Phase 4: Decoupling World Speed from Screen Speed

The fundamental fix was separating two concepts that had been conflated from the start: how fast a car is traveling in the simulated world, and how fast it appears to move on screen.

In the current system, each traffic car has `desiredWorldSpeed` and `currentWorldSpeed` in absolute MPH (ranging from 60–80 mph), set at spawn time independently of the player:

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
    const shapedApproachSpeed = maxApproachSpeed * (1 - Math.exp(-adjustedRelativeSpeed / approachCurveScale));
    return Math.max(TUNING.minScreenApproachSpeed, Math.min(relativeSpeed, shapedApproachSpeed));
  }

  // Player is slower: cap pull-away speed so cars don't vanish instantly
  const shapedPullAwaySpeed = maxPullAwaySpeed * (1 - Math.exp(-adjustedPullAwaySpeed / pullAwayCurveScale));
  return -Math.min(pullAwaySpeed, shapedPullAwaySpeed);
}
```

Three specific behaviors this unlocks:

- When the player brakes hard, fast traffic does approach faster on screen — but the exponential cap prevents the jarring sudden lurch of the old linear model.
- When the player and a car are moving at nearly the same speed, the deadzone prevents micro-oscillation in screen position.
- When a car overtakes the player, it pulls away smoothly rather than snapping off screen.

[DIAGRAM: World speed vs. screen speed — player at 80 mph, traffic at 65 mph showing relative approach; then player braking to 40 mph with traffic pulling away cleanly]

The car-following model was rebuilt alongside this. Cars now accelerate and decelerate toward a target world speed with separate rates for normal following, braking, and emergency braking:

```ts
// Current gameLoop.ts – updateTrafficFollowing
const accelStep          = internalSpeedFromMph(TUNING.trafficAccelMphPerSecond)          * delta; //  5 mph/s
const brakeStep          = internalSpeedFromMph(TUNING.trafficBrakeMphPerSecond)          * delta; // 18 mph/s
const emergencyBrakeStep = internalSpeedFromMph(TUNING.trafficEmergencyBrakeMphPerSecond) * delta; // 35 mph/s

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

A second pass in `moveTraffic` enforces a physical minimum gap regardless of speed, setting an `emergencyCorrected` flag on any car where the hard constraint fires. That flag is a remnant of the debug-logging era, kept because it marks when the physical constraint is actually doing work and may be useful for future telemetry.

---

## Phase 5: Spawn Stack Safety and Edge-Lane Tuning

Even with lane following fixed, traffic could still spawn in ways that created immediate jams. If the spawn timer fired twice in quick succession, a new car could appear directly behind one that had just entered the road.

`packetWouldStack` was introduced to check every car in a candidate packet against both existing off-screen traffic and sibling packet cars before committing:

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

The check uses a conservative `maxVehicleHeight` that accounts for trucks and size variance, so the constraint errs toward more space, not less.

Edge-lane bias was introduced at the same time. Cars in the leftmost or rightmost lane are nudged slightly inward (+0.10 and −0.10 in lane-fraction units) so they never appear to hang off the road boundary. The `minElapsed` for the `staggered-triple` packet was also reduced from 18 seconds to 12 seconds in the current version, reflecting confidence that the stack-safety check made tighter early spawning safe.

[DIAGRAM: Packet spawn flow — timer fires, choosePacket, getCorridorLane, packetWouldStack check, packetFits check, spawn with edgeLaneInwardBias applied]

---

## Phase 6: Pressure vs. Fairness

With traffic that felt physically believable, a new problem emerged: the game was too easy. Players discovered they could ride the gap between two lane centers indefinitely, braking into near-misses to farm points while rarely being in genuine danger.

Two systems were added in sequence to close this.

**The corridor system** ensures every packet leaves exactly one lane fully open, but that open lane rotates every `corridorShiftFrequency` seconds (3.5 s). Players must actively track the corridor rather than committing to a single lane:

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

**The safe-channel pressure system** penalizes riding the lane seam without traffic nearby. Idling between lanes for more than 1.2 seconds without adjacent traffic activates a 0.82× score multiplier and drains the combo timer faster. At high speeds, the car also develops lateral instability — a subtle physical nudge toward committing to a lane. When the lane seam has traffic on either side, the channel can instead award a `laneSplitBonus` (325 points), but only if the player has lateral velocity above a minimum threshold and hasn't collected one in the last 1.1 seconds. Camping earns nothing; threading earns a bonus.

[DIAGRAM: Safe channel pressure — player between lanes with no traffic (penalty accumulates), then player threading with traffic on both sides (laneSplitBonus awarded)]

The brake exploit was closed on a separate branch. The original scoring had used `state.elapsed` and `state.distance` directly — which continued increasing during braking, so a player could hold near-zero speed and still accumulate survival time. That made the leaderboard a patience test rather than a skill test, which is exactly the wrong signal for a game built around threading fast gaps. The fix introduced parallel scoring accumulators that stop advancing while the brake is held:

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

Near-misses during braking are still recorded silently (to prevent double-counting), but award no bonus and do not advance the streak.

---

## What the Constants Remember

The constants in `tuning.ts` are not arbitrary. Each one represents a playtesting session where the game was too easy, too hard, or physically broken, and a single number changed to fix it. The 3 mph near-speed deadzone. The 35 mph/s emergency brake rate. The 1.2-second safe-channel timer. The 3.5-second corridor rotation.

The remaining `emergencyCorrected` flag on each traffic car, the conservative `maxVehicleHeight` in the stack check, and the asymmetric pull-away speed cap are all small artifacts of that tuning history. The deleted `spawnValidator.ts` left no code behind, but it left a design principle: proving solvability analytically costs more than it's worth when the player is the variable.

A codebase that appears clean on the surface carries the memory of every failed experiment in the values it chose not to remove. Near Miss traffic looks simple from the outside — cars come down the road, you avoid them. The dozen or so constants and functions it took to make that feel right are the whole story.

[Try Near Miss](/games/near-miss) to see the system in action.
