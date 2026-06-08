# Soft Arcade Gameplay UI Audit

## 1. Current Implementation Inventory

### Near Miss

| Layer | Implementation |
|---|---|
| Shell/stage | `NearMissGame.tsx` — React, CSS module (`styles.module.css`) |
| Game state | Explicit `snapshot.status` string from game loop engine |
| HUD | `NearMissHud.tsx` + shared `ScorePill`, `Speedometer` from `shared/car/hud/` |
| Start screen | Inline JSX in `NearMissGame.tsx`, CSS module class `.startOverlay` / `.startPanel` |
| Game over screen | `NearMissGameOverModal.tsx` — React component, global CSS class names (`.near-miss-modal`, `.near-miss-modal-panel`, etc.) leaked from the CSS module via `:global()` |
| Mobile controls | Dedicated bottom bar + top Pause/Exit bar, built entirely in `NearMissGame.tsx` |
| Mobile scroll lock | `useEffect` sets `body.style.position = "fixed"` etc. |
| Arcade name | Reads/writes `arcadeName.ts` via `getArcadeName()` / `setArcadeName()` |
| Score submission | `useEffect` auto-triggers on `gameOver`; state machine in `NearMissGame.tsx` |
| Leaderboard | None in-game; sidebar-only via shared `Leaderboard.tsx` |

### Beat the Scrambler

| Layer | Implementation |
|---|---|
| Shell/stage | `BeatTheScramblerGame.tsx` — React wrapper, CSS module (`styles.module.css`), but all behavior is in `mountBeatTheScrambler.js` |
| Game state | Implicit boolean flags: `gameStarted`, `hasWon`, `mobilePaused`, `scrambleIntroActive` |
| HUD | Inline HTML in `BeatTheScramblerGame.tsx`, imperatively updated via jQuery |
| Start screen | `#start-menu` static HTML, jQuery `show/hide` |
| Win/game over screen | `#win-modal` static HTML, jQuery DOM mutation for all state transitions |
| Leaderboard modal | `#leaderboard-modal` static HTML inside the game frame, jQuery driven |
| Confirm dialog | `#confirm-modal` static HTML, jQuery driven |
| Mobile controls | Touch swipe detection on board (`handleBoardTouchStart/End`) + `#mobile-play-actions` bar |
| Mobile scroll lock | Imperative `body.style` mutations in `setMobileScrollLocked()` |
| Arcade name | Reads/writes same `arcadeName.ts` |
| Score submission | Async `submitScore()` with imperative state UI transitions |

### Shared Infrastructure

| What | Where |
|---|---|
| Leaderboard sidebar | `Leaderboard.tsx` — listens for `soft-arcade-leaderboard-updated` event |
| Leaderboard config | `leaderboards/config.ts` — column defs, endpoints per game |
| Arcade name persistence | `arcadeName.ts` — shared, cross-game |
| Score names | `leaderboards/scoreNames.ts` — `MAX_PLAYER_NAME_LENGTH`, `sanitizePlayerName` |
| Page shell | `GamePageShell.tsx` — stage + sidebar + leaderboard + how-to-play |
| Shared HUD components | `shared/car/hud/ScorePill.tsx`, `Speedometer.tsx` |

---

## 2. Pain Points

### Game Over

**Layout divergence.** Near Miss uses a stat grid (3 cards, flex/grid layout, prominent score number). Beat the Scrambler uses flat paragraph text: `"Time: 00:00 | Moves: 0"`. These are structurally incompatible and would feel jarring if shown side-by-side.

**Button hierarchy is inverted.** In Near Miss, "Play Again" is always visible at the bottom but styled as a secondary-weight button (small, light blue). In Beat the Scrambler, "Play Again" is hidden until the score saves, then it appears as a cyan primary button. There is no consistent answer to "what is the primary action right now?"

**Near Miss has no exit path.** The game over modal offers no way to return to the start screen. Players are forced to restart. Beat the Scrambler has "Back To Levels," a confirm dialog for mid-run exits, a leaderboard button, and restart in-HUD. Near Miss has none of these.

**Personal best is only in Beat the Scrambler.** Near Miss tracks `bestScore` in `localStorage` and the engine passes it through the snapshot, but the game over modal never shows it.

**Arcade name UI is different in every state.** NM toggles between a live form and a status line. BTS manipulates individual DOM elements with `show/hide`. Neither approach matches the other, and both duplicate the logic for "do I have a name already? Did I already submit this run?"

**`gameOver` auto-submit has a subtle race condition in Near Miss.** The `useEffect` on `snapshot.status` triggers `submitNearMissScore(savedName)` and also synchronously sets state. The `submitNearMissScore` callback closes over `snapshot`, which is stale at call time if the effect fires on the transition tick. This is worked around with `submittedRunIdRef` but it's fragile.

### Leaderboard

**Nested scrolling.** The Beat the Scrambler leaderboard modal sits inside `.gameFrame` (height-constrained, `overflow: hidden`). The outer modal panel has `max-height: 100%; overflow-y: auto`. The inner table wrapper has `max-height: min(52vh, 420px); overflow: auto`. On mobile this is three nested scroll regions in a constrained canvas area.

**Table requires horizontal scroll on phones.** `#leaderboard-table` has `min-width: 560px` on `@media (max-width: 720px)` — the exact breakpoint where the phone view kicks in. The table always requires horizontal scroll on mobile.

**No in-game leaderboard in Near Miss.** There is no way to view scores from inside the Near Miss game. The sidebar disappears under the game on mobile (the `game-layout` grid collapses to `1fr` at 900px). Players on mobile who want to see the leaderboard have to exit the game-canvas view entirely.

**Sidebar leaderboard is static per game.** BTS sidebar always shows `Medium 4x4` regardless of which difficulty the player just completed. It does not respond to in-game level changes.

**Leaderboard inside a modal inside a canvas feels like a pop-up within a pop-up.** The canvas is already a bounded island on the page. Opening a full-width scrollable table as an overlay within it is cramped, especially when the table is 760px wide inside a potentially 400px stage.

### Modal Architecture

**No shared modal component.** BTS and Near Miss both implement their own backdrop + panel from scratch. The patterns are similar (absolute inset, backdrop blur, centered card) but not shared. Future games copy-paste this pattern.

**Z-index levels differ.** Near Miss modals are `z-index: 5`. BTS modals are `z-index: 10`. The debug toolbar in Near Miss is `z-index: 6`. These are local to each game frame so they don't conflict now, but if shared UI is ever layered on top, the numbers would conflict.

**BTS uses `:global()` CSS that is structurally entangled with jQuery.** Styles like `#win-modal`, `#leaderboard-list`, `#score-name` are global ID selectors inside the CSS module. These can only work because the jQuery code targets the same IDs. Refactoring either breaks the other.

**Near Miss uses `:global()` for modal CSS that leaks globally.** `.near-miss-modal`, `.near-miss-modal-panel`, `.near-miss-run-stats`, etc. are emitted globally from the CSS module. The `near-miss-` prefix prevents immediate conflicts, but this pattern won't scale.

**Mobile modal alignment differs.** BTS modals on `max-width: 720px` align to `flex-start` (top of frame). Near Miss modal uses `grid; place-items: center` which centers it. Both have `overflow-y: auto` on the panel, but the visual result is different.

### Mobile Experience

**Scroll lock is duplicated.** `setMobileScrollLocked()` in BTS and the `useEffect` in Near Miss that sets `body.style.position = "fixed"` are functionally identical: capture `scrollY`, fix the body, restore on cleanup. Two independent implementations, one in jQuery, one in React.

**Mobile focus scroll is duplicated.** `focusMobileGame()` in BTS and `focusMobileGame()` in `NearMissGame.tsx` are character-for-character the same logic (with near-identical comments removed). Both scroll the viewport to center the game shell with a `bottomVisibilityBias`.

**Game stage height is special-cased globally for Near Miss.** In `globals.css`:

```css
.game-stage:has([data-game-shell="near-miss"]) {
  height: min(680px, 92svh);
}
```

This is a leak from game-specific requirements into the page layout. Future games will need similar hacks.

---

## 3. Recommended Shared Architecture

### Core Principle: Game State Machine

Every game should publish a single `GameStatus` enum. All UI reacts to this status. No multiple boolean flags.

```ts
type GameStatus =
  | "ready"         // Pre-game, start screen
  | "playing"       // Active run
  | "paused"        // Paused (mobile or universal)
  | "game_over"     // Run ended, game over screen
  | "leaderboard"   // Leaderboard screen (full-stage)
  | "settings"      // Future: settings/profile
```

The stage layer renders exactly one primary screen per status. Modals stack only for lightweight confirmations.

### Rendering Layers

```
┌─────────────────────────────────────────────────────┐
│  GameStage (position: relative, isolated)            │
│  ├── CanvasOrDOMGame  (z-index: 1)                   │
│  ├── HUD              (z-index: 3, pointer-events:none except buttons) │
│  ├── StatusScreen     (z-index: 5, full-stage)        │
│  │   • ReadyScreen                                    │
│  │   • GameOverScreen                                 │
│  │   • LeaderboardScreen                              │
│  │   • PauseScreen (mobile only)                      │
│  └── ConfirmDialog    (z-index: 8, lightweight modal only) │
└─────────────────────────────────────────────────────┘
```

`StatusScreen` renders at `position: absolute; inset: 0` — it is a full-stage overlay, not a constrained popup within the canvas. The leaderboard, game over, and start screens all occupy the full stage. Only the confirm dialog is a small modal card.

---

## 4. Shared Component Candidates

### `GameOverScreen`

Wraps the full-stage game over overlay. All games pass in a `summary` object and a set of `actions`.

```ts
type GameOverScreenProps = {
  kicker: string;                     // "Run Ended", "Puzzle Solved", etc.
  title: string;                      // Dynamic message or "You Win"
  score?: ScoreSummary;               // Primary metric display
  stats?: StatCard[];                 // Supporting stats (3-column grid)
  personalBest?: PersonalBestInfo;    // Always shown if available
  scoreSubmission: ScoreSubmissionState;
  playerName: string;
  showNameEntry: boolean;
  onPlayerNameChange: (name: string) => void;
  onSubmitName: () => void;
  onChangeName: () => void;
  onPlayAgain: () => void;
  onMainMenu: () => void;             // Required — exit path should always exist
};
```

### `LeaderboardScreen`

Full-stage leaderboard. Not a modal, not a table inside a scrolling panel.

```ts
type LeaderboardScreenProps = {
  gameId: string;
  tabs?: LeaderboardTab[];    // For BTS difficulty switcher
  onClose: () => void;
};
```

Renders at `position: absolute; inset: 0` filling the game stage. Uses a list (not a table) on mobile. Scrolls internally. No outer scroll container needed because it fills the stage.

### `ReadyScreen`

Pre-game start overlay. Consistent layout across games.

```ts
type ReadyScreenProps = {
  gameName: string;           // "Soft Arcade" kicker
  title: string;              // "Near Miss", "Beat the Scrambler"
  tagline: string;
  actions: ReadyAction[];     // For BTS: Easy/Medium/Hard. For NM: single "Start Run"
  onLeaderboard?: () => void;
};
```

### `ScoreSummary`

Reusable score display: label + large number + optional best marker.

```ts
type ScoreSummaryProps = {
  label: string;
  value: string | number;
  isNewBest?: boolean;
};
```

### `StatCard` / `StatGrid`

The 3-column stat grid cards from Near Miss, generalized for any game.

### `ArcadeNameEntry`

The entire name entry / auto-save status widget: handles the four states (idle/saving/saved/error), name input, "Change Name" toggle. Both games implement this identically in logic, differently in presentation.

### `AutoSaveStatus`

Status feedback only: displays the `scoreSubmission` state as a styled message. Used below the arcade name entry.

### `ConfirmDialog`

Small modal card for "are you sure?" flows. Shared between BTS restart/exit and any future game.

```ts
type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};
```

### `MobilePlayBar`

Top bar with Pause/Resume/Exit. Both games implement this. Extract once.

### `useArcadeName` hook

Encapsulates: initial load, state, save, `sanitizePlayerName`, the `setArcadeName` side effect. Both games duplicate this logic.

### `useMobilePlayMode` hook

Encapsulates: `focusMobileGame`, `enterMobilePlayMode`, the body scroll lock `useEffect`, `isMobileLayout`. Both games have identical implementations.

---

## 5. Game State Model

### Recommended Universal Model

```ts
type GameStatus =
  | "idle"          // Component mounted, not started
  | "ready"         // Start screen showing
  | "playing"       // Active gameplay
  | "paused"        // Paused, pause overlay showing
  | "game_over"     // Run ended, game over screen
  | "leaderboard"   // Leaderboard screen (full-stage, replaces game over)
  | "confirm"       // Destructive action confirmation pending
```

### Mapping Current States

| Current BTS | Current Near Miss | Recommended |
|---|---|---|
| `!gameStarted` (start menu) | `status === "ready"` | `"ready"` |
| `scrambleIntroActive` | — | `"playing"` (HUD overlay, not a state) |
| `gameStarted && !hasWon && !mobilePaused` | `status === "running"` | `"playing"` |
| `mobilePaused` | `status === "paused"` (implicit) | `"paused"` |
| `hasWon` | `status === "gameOver"` | `"game_over"` |
| `#leaderboard-modal` visible | — (no in-game leaderboard) | `"leaderboard"` |
| `#confirm-modal` visible | — (no confirm) | `"confirm"` |

### State Transition Rules

```
idle → ready               (on mount)
ready → playing            (start/level selected)
playing → paused           (pause button, visibility hidden)
playing → game_over        (run ends)
paused → playing           (resume)
paused → confirm           (exit/restart with active run)
game_over → playing        (play again)
game_over → leaderboard    (view leaderboard)
game_over → ready          (back to menu)
leaderboard → game_over    (close leaderboard, had just finished run)
leaderboard → ready        (close leaderboard, was at menu)
confirm → [previous]       (cancel)
confirm → ready            (confirmed exit)
confirm → playing          (confirmed restart → immediately transitions)
```

### Key Design Decisions

1. **Leaderboard is a first-class state**, not a modal layered on top. This solves the nested scroll problem.
2. **Paused state is universal**, not mobile-only. Desktop will eventually benefit from a pause state (visibility change currently handles this ad-hoc in Near Miss).
3. **Confirm is a lightweight overlay** on top of any state, not itself a full screen.
4. **No multi-flag combinations.** A single `status` value completely determines what UI is shown.

---

## 6. Leaderboard UX Recommendation

### Problem

Showing a scrollable data table inside a constrained canvas feels like a modal inside a modal. On mobile, this creates nested scroll, a `560px min-width` table, and a sub-optimal reading experience.

### Recommended: Full-Stage Leaderboard Screen

When the leaderboard state is active, replace the game canvas content entirely with a `LeaderboardScreen` component that fills the stage. This is not a modal — it is a game state.

```
┌─────────────────────────────────────────────────────┐
│  [← Back]                           Leaderboard      │
│                                                      │
│  Near Miss                                           │
│  ─────────────────────────────────────────           │
│  1.  SPIDER    12,440  2.1mi  14 near misses         │
│  2.  ACE        9,100  1.8mi   9 near misses         │
│  3.  ZAP        7,890  1.4mi   6 near misses         │
│  ...                                                  │
│                                                      │
│                                [Play Again]          │
└─────────────────────────────────────────────────────┘
```

For Beat the Scrambler, add difficulty tabs at the top (Easy / Medium / Hard) — same concept, no table, just a styled list.

**Layout:** Scrollable list, not a table. Each row is a flex item. No `min-width`. On mobile it reads vertically just fine.

**Access points:**
- From the `ReadyScreen` ("Leaderboard" button, same as current start menu)
- From the `GameOverScreen` ("View Leaderboard" secondary action)
- From the HUD during gameplay (optional scores icon, existing in BTS)

**The sidebar leaderboard** stays as-is — it is the page-level ambient context. The full-stage leaderboard is the intentional deep-dive view.

**Sidebar limitation fix:** The sidebar leaderboard config should update on difficulty change. This requires a simple event (`soft-arcade-leaderboard-level-changed`) or a React context that `GamePageShell` can subscribe to.

---

## 7. Game Over UX Recommendation

### What Should Always Appear

1. **Context kicker** (small caps, accent color): "Run Ended", "Puzzle Solved", "New Best", etc. Every game over needs context before the title.
2. **Title** (dynamic, large): the final message — could be "THREAD THE GAP", "You Win", future: "BUSTED".
3. **Primary score display** (`ScoreSummary`): one big number with label. Near Miss: points. BTS: time + moves. Always prominent.
4. **Personal best indicator** (if available): small badge or line — "New Best!" or "Best: 02:14". Beats buries this; Near Miss omits it entirely. Both should always show it.
5. **Run stats** (`StatGrid`): 2–4 supporting metrics in a card grid. Near Miss already has this. BTS has it as prose text — should be cards.
6. **Auto-save status** (`AutoSaveStatus`): single-line feedback — "Saving...", "Saved as ACE", "Could not save." Always visible, never hidden.
7. **Arcade name entry** (`ArcadeNameEntry`): shown when no name is set, or when user explicitly changes it.

### Primary Action

**"Play Again"** is always the primary action, always visible, always styled as the cyan CTA. It should never be hidden or revealed after a save.

The mental model: the player has finished a run. They want to play again. Score saving is ambient and automatic — it does not gate the primary action.

### Secondary Action

**"View Leaderboard"** — transitions to the full-stage leaderboard state. This replaces the BTS in-modal leaderboard trigger.

### Tertiary Action

**"Back to Menu"** — returns to `ready` state. This exists in BTS, is missing from Near Miss. Required for both.

### Button Order (consistent across all games)

```
[Play Again]          ← always primary, always cyan
[View Leaderboard]    ← secondary, ghost
[Back to Menu]        ← tertiary, muted
```

### Auto-Save Status Display

The status area should:
1. Appear immediately below the arcade name display (before buttons), not below the stats
2. Be a single line, always visible, never hidden/revealed
3. States: idle → "Enter a name to save your score." | saving → "Saving..." | saved → "Saved as ACE ✓" (green) | error → "Could not save." + retry link (red)

The name entry form appears inline only when the user has no saved name or clicks "Change Name." It replaces the idle message — it does not push buttons down.

### Rank Placement (future)

Reserve a slot in the `ScoreSummary` area for `#3 on the leaderboard`. This requires the score submission response to return the player's rank. The current API returns the leaderboard after submission — rank can be derived client-side from position in that array.

---

## 8. Refactor Plan Ordered by Impact/Risk

### Phase 0: Foundation — no visible change, low risk

| Task | What | Risk |
|---|---|---|
| Extract `useMobilePlayMode` | Deduplicate identical `focusMobileGame` + body scroll lock in both games | Low |
| Extract `useArcadeName` | Consolidate name load/save/sanitize logic used in both games | Low |
| Extract `useScoreSubmission` | Shared hook for the idle/saving/saved/error state machine | Low |
| Fix Near Miss stale-closure in `submitNearMissScore` | Capture snapshot values at submission time, not via hook closure | Low–Medium |

### Phase 1: Game Over Screen Parity — medium impact, medium risk

| Task | What | Risk |
|---|---|---|
| Add "Back to Menu" to Near Miss game over | NM needs an exit path | Low |
| Add personal best to Near Miss game over | Show `bestScore` from snapshot | Low |
| Reformat BTS win stats to card grid | Replace `"Time: 00:00 \| Moves: 0"` paragraph with `StatGrid` | Low–Medium |
| Add kicker to BTS win modal | "Puzzle Solved" above "You Win" | Low |
| Make "Play Again" always visible in BTS | Unhide immediately on win; promote to primary | Medium |
| Align button order across both games | Play Again → Leaderboard → Menu | Medium |

### Phase 2: Shared `GameOverScreen` Component — high impact, medium risk

| Task | What | Risk |
|---|---|---|
| Build `GameOverScreen` React component | Shared component matching the spec above | Medium |
| Migrate Near Miss to `GameOverScreen` | Replace `NearMissGameOverModal` | Medium |
| Move BTS win modal to React component | Extract from jQuery static HTML | High |

### Phase 3: Leaderboard UX — high impact, high risk

| Task | What | Risk |
|---|---|---|
| Build `LeaderboardScreen` component | Full-stage list-based view, shared | Medium |
| Add leaderboard state to Near Miss | Wire `status === "leaderboard"`, transitions from game over | Medium |
| Migrate BTS leaderboard modal to `LeaderboardScreen` | Replace `#leaderboard-modal` + `.modal-leaderboard` | High |
| Fix sidebar leaderboard for BTS difficulty | Fire event on difficulty change | Low–Medium |

### Phase 4: Shared `ConfirmDialog` — medium impact, medium risk

| Task | What | Risk |
|---|---|---|
| Build shared `ConfirmDialog` component | Replace BTS `#confirm-modal` | Medium |
| Add `ConfirmDialog` to Near Miss | For "exit mid-run?" flow (currently missing) | Medium |
| Unify modal z-index | Align all games to same z-index scale | Low |

### Phase 5: Unified `ReadyScreen` + State Model — high impact, high risk

| Task | What | Risk |
|---|---|---|
| Build `ReadyScreen` component | Unified start screen with consistent layout | Medium |
| Migrate Near Miss start overlay | Replace inline JSX start panel | Low |
| Migrate BTS start menu | From jQuery `#start-menu` to React | High |
| Formalize `GameStatus` type | Adopt across both games | High |

### Phase 6: CSS Cleanup — low visibility, ongoing

| Task | What | Risk |
|---|---|---|
| Replace `:global()` class leaks with scoped module classes | Both games | Medium |
| Move game-specific stage height out of `globals.css` | Replace `:has()` hack | Low |
| Align design tokens | BTS uses `--bg`/`--surface`; NM uses raw hex | Low |

---

### Summary: Highest Priorities Before Taxi Driver / Cop Chase

1. **`useMobilePlayMode` and `useScoreSubmission` hooks** — prevent a third duplicate of identical logic
2. **`GameOverScreen` component** — prevents three divergent game over screens
3. **`LeaderboardScreen` full-stage component** — solves the cramped modal problem before it multiplies
4. **`ConfirmDialog`** — BTS already has one; NM needs one; future games need one
5. **`GameStatus` type** — a stable contract all future games can implement against

**Safe to defer:** BTS full jQuery → React migration (high risk, gameplay is stable), CSS global cleanup (no user-visible impact), sidebar leaderboard difficulty sync (edge case).
