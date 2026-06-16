# Article Spec: Near Miss Engine — A Canvas Game Loop Inside a React App

## Summary

Near Miss is a real-time traffic-dodge game rendered entirely on an HTML5 Canvas element, yet it lives inside a React/Next.js App Router application. This article explains how the `NearMissGameLoop` class isolates simulation state from React's rendering model, why the team chose a `requestAnimationFrame` class rather than a React-owned loop, how `NearMissSnapshot` acts as the thin read-only bridge between the simulation and the UI, and how the canvas is kept pixel-perfect across device pixel ratios and dynamic viewport resizing. It is a blueprint for embedding high-frequency game loops in React without fighting the framework.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/near-miss/engine/gameLoop.ts` | The `NearMissGameLoop` class: tick loop, physics update, crash state machine, feedback queue | The authoritative source for how the game advances in time |
| `src/games/near-miss/NearMissGame.tsx` | React component: instantiates `NearMissGameLoop`, wires `ResizeObserver`, fires PostHog events, renders UI overlays | Shows the React ↔ simulation boundary |
| `src/games/near-miss/render/canvasRenderer.ts` | `renderNearMiss(ctx, state)` — draws road, traffic, player car, and floating feedback text each frame | Stateless renderer: takes the runtime state and produces pixels |
| `src/games/near-miss/engine/tuning.ts` | `NEAR_MISS_TUNING` — all numeric constants, `getBaselineSpeed`, `getDisplayedSpeed` | Centralizing constants prevents magic numbers from spreading across files |
| `src/games/near-miss/engine/input.ts` | `createInputController` — maps keyboard, pointer, and touch events to an `NearMissInputState` struct | Abstracts input devices so the game loop only sees `{ steer, throttle, brake }` |
| `src/games/shared/car/laneSystem.ts` | `createLaneSystem`, `getLaneCenter` — shared lane geometry calculations | Used by both the game loop and the renderer to stay in sync |

---

## Key Design Patterns

### The Simulation/React Boundary

`NearMissGameLoop` is a plain TypeScript class. It holds all mutable game state (`NearMissRuntimeState`), runs its own `requestAnimationFrame` loop, and never imports from React. The component in `NearMissGame.tsx` stores the loop in a `useRef`, creates it once in a `useEffect`, and receives updates through two callbacks:

```ts
const loop = new NearMissGameLoop({
  canvas,
  bestScore,
  onSnapshot: setSnapshot,   // React state setter — called at ~11 Hz
  onBestScore: persistBestScore
});
```

`onSnapshot` is called at most every 90 ms (not every frame), so React re-renders are decoupled from the 60 fps canvas tick:

```ts
if (timestamp - this.lastSnapshotAt > 90 || this.state.status !== "running") {
  this.emitSnapshot();
  this.lastSnapshotAt = timestamp;
}
```

### NearMissSnapshot: Read-Only Window Into the Simulation

`NearMissSnapshot` is a plain object with no functions — score, speed, distance, elapsed, nearMisses, streak, bestScore, message, and status. The HUD and game-over modal read only from snapshots. Neither component can mutate game state; they call back into the loop via imperative handles (`loop.start()`, `loop.restart()`, `loop.pause()`).

### The Tick Loop

The loop delta is clamped to 34 ms (≈30 fps minimum) so a tab that was backgrounded cannot advance physics by multiple seconds when it regains focus:

```ts
private tick = (timestamp: number) => {
  const delta = Math.min(0.034, (timestamp - this.lastFrame) / 1000 || 0);
  this.lastFrame = timestamp;

  if (this.state.status === "running") {
    this.update(delta);
  } else if (this.state.status === "crashing") {
    this.updateCrashing(delta);
  }

  this.render();
  // ...
};
```

After each `this.render()` call the loop immediately calls `renderNearMiss(this.ctx, this.state)`, keeping rendering synchronous with physics within the same frame.

### Device Pixel Ratio and Responsive Resize

The `resize(width, height)` method scales the canvas backing store by `window.devicePixelRatio` while setting CSS dimensions to the display size, preventing blurry output on Retina screens:

```ts
resize(width: number, height: number) {
  const pixelRatio = window.devicePixelRatio || 1;
  this.canvas.width = Math.floor(displayWidth * pixelRatio);
  this.canvas.height = Math.floor(displayHeight * pixelRatio);
  this.canvas.style.width = `${displayWidth}px`;
  this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  // ... recompute lane system, reposition player and traffic
}
```

`NearMissGame.tsx` wires a `ResizeObserver` on the frame `<div>` — not on `window` — so the canvas adapts to layout-driven size changes, not just viewport changes.

### Game Status State Machine

The loop transitions through four states: `"ready"` → `"running"` → `"crashing"` → `"gameOver"`. The `"crashing"` state runs a separate `updateCrashing(delta)` update that advances vehicle slide/spin physics and detects secondary chain-reaction impacts, all while the road continues scrolling. This state machine is the core architectural decision that keeps crash animations deterministic and frame-rate-independent.

---

## Suggested Diagram

```
NearMissGame.tsx (React)
  |
  |-- useEffect --> new NearMissGameLoop({ canvas, onSnapshot, onBestScore })
  |                       |
  |                       +-- requestAnimationFrame(tick)
  |                              |
  |                              +--> update(delta)        [running]
  |                              |      physics, spawning, scoring
  |                              |
  |                              +--> updateCrashing(delta) [crashing]
  |                              |      slide/spin motion, chain impacts
  |                              |
  |                              +--> renderNearMiss(ctx, state)
  |                              |      road + traffic + player + HUD text
  |                              |
  |                              +--> emitSnapshot()        [every ~90ms]
  |                                     |
  |                              onSnapshot(snapshot) --> setSnapshot (React state)
  |                                                              |
  |                                                    NearMissHud re-renders
  |                                                    NearMissGameOverModal (if gameOver)
  |
  |-- ResizeObserver --> loop.resize(width, height)
  |-- visibility API --> loop.pause() / loop.start()
  +-- user controls  --> loop.setInput({ steer, throttle, brake })
```

---

## Why It Matters

Separating a high-frequency simulation class from the React component tree is the key to smooth canvas games inside React apps. React's reconciler is not designed to run at 60 fps; offloading the loop to a class ref avoids re-render cascades and state-batching surprises. The `NearMissSnapshot` pattern is reusable: any high-performance loop (physics sim, audio engine, WebGL renderer) can expose its state to React through a low-frequency snapshot callback without coupling to the component lifecycle.
