# Article Spec: Beat the Scrambler — From jQuery Puzzle to Modern Arcade Game

## Summary

Beat the Scrambler started life as a plain HTML/jQuery sliding-tile puzzle and has been rebuilt into a full-featured browser game hosted inside a Next.js App Router site. This article traces that evolution: how the solvable-by-construction scramble algorithm works, why jQuery was kept as a deliberate embedded dependency rather than rewritten in React, how the Scrambler mascot character was built purely in SVG, and how every player action from difficulty selection to score submission fires a PostHog analytics event. The result is a case study in pragmatic legacy-code preservation inside a modern stack.

---

## Relevant Modules

| File | What it does | Why it matters |
|---|---|---|
| `src/games/beat-the-scrambler/mountBeatTheScrambler.js` | The entire game runtime — event binding, board state, scrambling, tile animation, score submission — in a single IIFE-style factory function | Shows the jQuery-first architecture and how it is mounted/unmounted by React |
| `src/games/beat-the-scrambler/BeatTheScramblerGame.tsx` | React component that dynamically imports jQuery and the game scripts, passes `posthog` into the mount function, and returns the static HTML shell | Demonstrates the "island" pattern: React owns the DOM scaffold, jQuery owns the live interactions |
| `src/games/beat-the-scrambler/game-utils.js` | Pure utility functions: `createEmptyGrid`, `isSolvedBoard`, `moveGap`, `randomDirection`, `getUpdatedBest` | The solvable scramble algorithm lives here; `moveGap` is the atomic unit of every move |
| `src/games/beat-the-scrambler/game-config.js` | Minimal config — just sets `window.TILE_GAME_CONFIG.apiBaseUrl` | Shows how the jQuery script gets its API URL without bundler globals |
| `src/lib/arcadeName.ts` | Reads/writes the player's arcade name from `localStorage` | Shared across both games; a single source of truth for the player identity |
| `src/lib/leaderboards/config.ts` | Declares column definitions (Name, Moves, Time) for the Beat the Scrambler leaderboard table | Shows how leaderboard shape is decoupled from the game itself |

---

## Key Design Patterns

### Solvable-by-Construction Scrambling

The board is never randomly permuted (which could produce unsolvable states in a 15-puzzle). Instead, `scramble()` in `mountBeatTheScrambler.js` calls `moveDirection(randomDirection())` in a loop — every iteration applies a valid gap move, so the board is always reachable from the solved state:

```js
function scramble() {
  do {
    for (let i = 0; i < scrambleMoves; i++) {
      moveDirection(utils.randomDirection());
    }
  } while (isSolved());
}
```

`scrambleMoves` scales by difficulty: 12 for Easy (3×3), 100 for Medium (4×4), 180 for Hard (5×5). The `do...while` guard prevents the rare case where random walks return to the solved position.

### `moveGap` as the Atomic Primitive

All game mechanics funnel through one function in `game-utils.js`:

```js
function moveGap(boardSize, gapX, gapY, direction) {
  // Returns { tileX, tileY, nextGapX, nextGapY, axis } or null
}
```

`mountBeatTheScrambler.js` calls it for keyboard input, touch swipe, and the scramble loop. The `axis` field (`"x"` or `"y"`) tells `slideTile` which CSS property to animate, keeping jQuery's `.animate()` responsible only for presentation.

### React as a Scaffold, jQuery as Runtime

`BeatTheScramblerGame.tsx` uses `useEffect` to dynamically import jQuery and the game scripts in dependency order, then calls `mountBeatTheScrambler(posthog)`. The mount function returns a `cleanup` callback that unbinds every jQuery event listener under a `.beatTheScrambler` namespace, preventing leaks when the React component unmounts:

```tsx
useEffect(() => {
  async function mountGame() {
    const jqueryModule = await import("./jquery-3.4.1.js");
    installJQueryGlobal(jqueryModule);
    await import("./game-config.js");
    await import("./game-utils.js");
    const { mountBeatTheScrambler } = await import("./mountBeatTheScrambler.js");
    cleanupGame = mountBeatTheScrambler(posthog);
  }
  void mountGame();
  return () => cleanupGame?.();
}, []);
```

### The Scrambler Mascot

The villain character is entirely inline SVG, rendered by `getScramblerMarkup()` inside `mountBeatTheScrambler.js`. Glitch bars (`<line class="scrambler-glitch-bar">`), asymmetric pupils, and a cubic-Bezier mouth are CSS-animated. The character appears at three moments: the start menu, a full-screen overlay during the scramble animation, and the win/confirm modals — giving it a consistent personality without any image assets.

### Mobile Scroll Lock

When a player starts a game on a narrow viewport, the game enters "mobile play mode": it fixes `document.body` position to prevent scroll drift during touch swipes, stores the previous scroll offset, and restores everything on exit. The pattern is duplicated in both `mountBeatTheScrambler.js` and `NearMissGame.tsx`, making it a platform convention worth extracting into a shared utility.

---

## Suggested Diagram

A flowchart showing the game state machine:

```
[Start Menu] --level click--> [Scrambler Overlay animates] --> [Board Active]
     ^                                                                |
     |                                                         [Move tiles]
     |                                                                |
     +<--- [Main Menu click / confirm] <-- [isSolved? No] <----------+
                                                |
                                          [isSolved? Yes]
                                                |
                                         [Win Modal]
                                         posthog: puzzle_solved
                                                |
                                    [Submit Score to API]
                                    posthog: score_submitted
```

---

## Why It Matters

Keeping the jQuery game logic intact rather than rewriting it demonstrates that modern toolchains can host legacy code without destructive migrations. The dynamic-import mounting pattern lets Next.js handle routing, SEO, and layout while jQuery owns the fine-grained DOM interactions it was designed for. The solvable scramble algorithm is a clean teaching example: by only ever applying legal moves during setup, the game guarantees every puzzle is winnable without needing parity checks.
