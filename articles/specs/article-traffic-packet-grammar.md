# Article Spec: Traffic Packet Grammar — How Near Miss Designs Its Challenges

## Summary

Most endless-runner games spawn traffic cars randomly. Near Miss takes a different approach: every cluster of cars on screen comes from a named "traffic packet" that encodes lane offsets, staggered vertical positions, and relative speed ratios. This article explains the packet table, how the spawner selects packets based on elapsed time, why a one-lane "corridor" is always kept open, how the stack-safety check prevents cars from spawning on top of each other, and how subtle lateral offsets and edge-lane inward biases make traffic feel organic without random jitter.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/near-miss/engine/spawner.ts` | `TRAFFIC_PACKETS` table, `spawnTrafficPacket`, `choosePacket`, `chooseStartLane`, `packetWouldStack` | The entire traffic generation system |
| `src/games/near-miss/engine/tuning.ts` | `spawnIntervalBase`, `spawnDensityRampMax`, `corridorShiftFrequency`, `laneOffsetAmount`, `edgeLaneInwardBias` | All spawn rhythm and offset constants |
| `src/games/near-miss/engine/gameLoop.ts` | Calls `spawnTrafficPacket` on a timer, applies jitter to spawn interval, advances `elapsed` | Shows how the spawner integrates with the tick loop |
| `src/games/near-miss/engine/vehicleConfig.ts` | `spawnWeight` field on each vehicle config | Controls the probability that a given packet car becomes a truck vs. sedan |

---

## Key Design Patterns

### The Traffic Packet Table

Each packet is a named blueprint with a `minElapsed` gate (in seconds) and an array of car descriptors:

```ts
const TRAFFIC_PACKETS: TrafficPacket[] = [
  {
    id: "single-slow-blocker",
    minElapsed: 0,
    cars: [{ laneOffset: 0, yOffset: 0, speedRatio: 0.72 }]
  },
  {
    id: "convoy-squeeze-gap",
    minElapsed: 28,
    cars: [
      { laneOffset: 0, yOffset: 0,    speedRatio: 0.64, lateralOffset:  0.12 },
      { laneOffset: 0, yOffset: -2.55, speedRatio: 0.66, lateralOffset: -0.08 },
      { laneOffset: 2, yOffset: -1.25, speedRatio: 0.70, lateralOffset: -0.12 }
    ]
  },
  // ...
];
```

`laneOffset` is relative to the packet's randomly chosen start lane, so the same packet creates different screen layouts depending on where it spawns. `yOffset` is in car-height units, so staggering is proportional to car size. `speedRatio` is a multiplier applied to a randomized cruise speed, making cars in the same packet move at slightly different rates and naturally compress/spread over time.

### The Corridor: Always One Lane Open

Before choosing a start lane, the spawner computes the "corridor lane" — the one lane that must never be blocked:

```ts
function getCorridorLane(elapsed: number, laneCount: number) {
  return Math.floor(elapsed / TUNING.corridorShiftFrequency) % laneCount;
}
```

Every `corridorShiftFrequency` seconds (default 3.5 s) the safe lane rotates, nudging the player to change lanes rather than camping. `packetFits` rejects any placement that would block the corridor:

```ts
function packetFits(packet, startLane, laneCount, corridorLane) {
  const lanes = new Set(packet.cars.map(car => wrapLane(startLane + car.laneOffset, laneCount)));
  return lanes.size < laneCount && !lanes.has(corridorLane);
}
```

### Density Ramp: Harder Over Time

The base spawn interval shrinks as speed increases and as a density ramp accrues during the first 80 seconds:

```ts
export function getSpawnInterval(speed: number, elapsed: number) {
  const densityRamp = Math.min(TUNING.spawnDensityRampMax, elapsed / TUNING.spawnDensityRampSeconds);
  return Math.max(TUNING.spawnIntervalFloor, TUNING.spawnIntervalBase - speed / TUNING.spawnSpeedDivisor - densityRamp);
}
```

In addition, `choosePacket` unlocks more complex packet types over time by filtering `minElapsed <= elapsed` and then picking from an increasingly large pool.

### Stack-Safety Check

Before committing a packet spawn, `packetWouldStack` checks that no new car would overlap with existing off-screen traffic or with sibling cars in the same packet:

```ts
function packetWouldStack(packet, startLane, laneCount, carHeight, laneRecentEntries, minGapPx) {
  // For each car in the packet, compute its spawn Y and check against:
  //   1. Existing off-screen cars in that lane
  //   2. Sibling packet cars in the same lane
  // Returns true if any overlap is within minGapPx
}
```

This prevents the visual glitch of two cars materializing on top of each other when spawn timers fire close together.

### Subtle Lateral Offsets and Edge-Lane Bias

Cars in a packet are not pinned to lane centers. Each car gets a small lateral offset that oscillates with a slow sine wave:

```ts
function getSubtleLaneOffset(elapsed: number, index: number) {
  const phase = Math.sin(elapsed * 0.7 + index * 1.9);
  return phase * TUNING.laneOffsetAmount * TUNING.subtleLaneOffsetScale;
}
```

Cars in edge lanes are additionally biased inward (`edgeLaneInwardBias`) so they never graze the road boundary — keeping near-miss windows visually readable.

---

## Suggested Diagram

```
TRAFFIC_PACKETS (authored, named blueprints)
        |
        | choosePacket(elapsed) -- unlocks by minElapsed gate
        v
Selected packet (e.g. "staggered-triple")
        |
        | chooseStartLane(packet, availableStartLanes, corridorLane)
        v
Start lane determined (corridor lane guaranteed open)
        |
        | for each packet car:
        |   lane = wrapLane(startLane + laneOffset, laneCount)
        |   y = -height + yOffset * carHeight
        |   x = laneCenter + lateralOffset * laneWidth
        |   speed = randomCruiseMph * speedRatio
        v
TrafficCar[] pushed to state.traffic
        |
        | updateTrafficFollowing() -- AI car-following
        | moveTraffic()            -- screen Y advancement
        v
Player sees structured gap/squeeze scenario
```

---

## Why It Matters

Authoring traffic as named packets rather than random spawns gives designers exact control over what scenarios the player faces. The corridor mechanic is a form of "guaranteed escape hatch" — even the densest multi-car packet always leaves one lane open. The density ramp and `minElapsed` gates form a simple progression system: easy patterns dominate early runs, complex squeezes appear only after the player has had time to learn. This architecture makes difficulty tuning a matter of editing a readable table, not adjusting random probability weights.
