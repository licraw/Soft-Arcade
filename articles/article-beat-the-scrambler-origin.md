---
title: "Beat the Scrambler: From a College jQuery Project to a Modern Browser Game"
description: "How a jQuery sliding puzzle built in college became the first Soft Arcade browser game—and the technical seed for the entire platform."
slug: "beat-the-scrambler-origin"
publishedAt: "2026-06-16"
updatedAt: "2026-06-18"
category: "Devlog"
tags:
  - Browser Games
  - JavaScript
  - jQuery
  - React
  - Next.js
  - PostHog
  - Game Development
canonicalPath: "/labs/beat-the-scrambler-origin"
---

Beat the Scrambler is the first game on Soft Arcade. It is also the project that created the platform.

That was not the plan. At first, I just wanted to take a jQuery sliding puzzle I built in college, clean it up, and make it feel like a finished browser game. But each new feature revealed problems that went beyond tile puzzles, like saving scores, creating an arcade identity, supporting mobile play, and building reusable game interfaces. Solving those issues the right way led to Soft Arcade.

The first version was a sliding tile puzzle built during my time at Portland Community College. It had numbered tiles, one empty space, a scramble button, and a win condition: put the board back in order. There was no character, no timer, no move counter, no leaderboard, no score submission, no mobile support, and no modern frontend framework. It was just HTML, CSS, JavaScript, and jQuery doing direct DOM work.

Years later, I returned to that project. I was not interested in making it bigger just for nostalgia's sake. I wanted to find out if a small browser puzzle could become a full arcade-style game without losing the straightforward feel that made the original fun to build.

![The original Beat the Scrambler numbered-tile puzzle board, before any modernisation](/labs/bts-original-puzzle-board.png)

Old side projects can be great starting points for this kind of work. They already have something real, like a mechanic, a constraint, or a small proof that an interaction feels good. Soft Arcade is based on that idea: lightweight browser games that load quickly, are easy to understand, and can be played without accounts or installs.

## The Original College Project

The college version of Beat the Scrambler was a standard sliding puzzle. The board started in order. One tile space was empty. The script scrambled the board, then the player used tile movement to restore the correct sequence.

At the time, jQuery was a normal choice for this kind of thing. If you wanted to select elements, attach handlers, move DOM nodes, animate positions, or update text, jQuery gave you a compact API that worked consistently across browsers. A puzzle board was also a good match: the game state was visible in the DOM, and every move had a direct visual consequence.

The earliest implementation was not trying to be a platform. It was not componentized or designed around routing, analytics, or a design system. It existed because the puzzle was easy to understand and fun to get working:

- create a grid
- leave the last cell empty
- assign numbers to the other cells
- move a tile into the gap
- check whether the numbers are back in order

That simplicity became important later. The project was basic, but it was not something to throw away.

## A Puzzle Must Be Solvable

The most important technical detail in a sliding puzzle is also one that is easy to miss: not every shuffled board can be solved.

In a 15-puzzle, the board has parity. If you take the solved board and randomly permute all the tiles, roughly half of the possible arrangements are unreachable through legal moves. The player can do everything right and still never solve the puzzle because the state was impossible from the start.

That is why simply shuffling the array is risky here. It can make a puzzle that looks fine but cannot actually be solved.

Beat the Scrambler avoids that by scrambling the board only with legal moves. It starts from the solved state and performs a random walk by moving the empty space around the board. Since every scramble step is a valid move, the final board must be reachable from the solved board. The puzzle is solvable by construction.

The core loop is intentionally small:

```js
function scramble() {
  do {
    for (let i = 0; i < scrambleMoves; i++) {
      moveDirection(utils.randomDirection());
    }
  } while (isSolved());
}
```

The `do...while` guard handles the rare case where the random walk comes back to the solved state. If it does, the game simply scrambles again.

![Diagram showing the random-walk approach: starting from the solved state and applying legal gap moves to guarantee a solvable board](/labs/beat-the-scrambler-origin/solvable-scramble-algorithm.png)

The number of scramble moves scales with difficulty:

- Easy: `3x3`, 12 scramble moves
- Medium: `4x4`, 100 scramble moves
- Hard: `5x5`, 180 scramble moves

Those values live in the runtime configuration:

```js
let LEVELS = {
  easy: { size: 3, scrambleMoves: 12, label: "Easy 3x3" },
  medium: { size: 4, scrambleMoves: 100, label: "Medium 4x4" },
  hard: { size: 5, scrambleMoves: 180, label: "Hard 5x5" }
};
```

The atomic move logic is in `game-utils.js`, in the `moveGap` function. Instead of having keyboard controls, touch controls, and scramble logic each understand board geometry separately, they all ask the same function what a move means:

```js
function moveGap(boardSize, gapX, gapY, direction) {
  // Returns { tileX, tileY, nextGapX, nextGapY, axis } or null
}
```

That return value says which tile moves, where the gap goes next, and whether the animation should run along the x-axis or y-axis. The jQuery runtime can then update the board state and call `.animate()` to update the presentation.

This is the kind of code I like in a small game. The rule is not buried in a UI handler. It is a reusable building block. The scramble loop, arrow keys, and touch swipes all use the same idea of a legal move.

## Revisiting the Project Years Later

When I returned to the game, I was not asking, "How do I make this look modern?" Instead, I wondered, "What does a player expect from a browser game today?"

The old version worked as a puzzle, but it did not behave like a complete game. It needed the things that make a round measurable and replayable:

- difficulty levels
- a move counter
- a timer
- local personal bests
- score submission
- leaderboards
- mobile controls
- a start menu
- win states
- some personality
- analytics

None of those features changes the underlying puzzle. They change the shape around it.

The current game runs inside a Next.js App Router site. React owns the page shell, routing, layout, and static game surface. The jQuery runtime owns the live puzzle interaction after mount. The leaderboard API and shared arcade name utilities are external to the game, allowing them to be reused across Soft Arcade.

That was the moment when the college project turned into a Soft Arcade game, instead of just being an old code sample I fixed up.

## The Project That Became Soft Arcade

The earliest goal was not to launch a platform.

At first, the project was much smaller: take an old puzzle, clean it up, make it work on modern devices, and give it enough structure to feel like a real browser game. That was already a good amount of work. A sliding puzzle needs a fair scramble, clear controls, a starting state, a solved state, and some feedback to make each round feel complete.

But each feature I added brought up bigger questions than just Beat the Scrambler.

A leaderboard meant there needed to be score persistence, validation, and a way to display rankings consistently. Score submission meant the player needed some kind of arcade identity, even without an account system. Analytics meant the game needed a vocabulary for events like starts, solves, restarts, and failed submissions. Mobile support meant the page shell had to respect the difference between reading a site and actively playing a game. Even the UI elements around menus, score panels, game cards, and win states started to look like something that should not be rebuilt from scratch for every future experiment.

None of those problems were unique to a tile puzzle.

That realization changed the shape of the work. I was no longer only improving an old puzzle. I was building infrastructure that another small browser game could also use: shared arcade identity, score submission, leaderboards, PostHog instrumentation, mobile play patterns, reusable game UI, and a hosting model that made each game feel like part of the same place.

Beat the Scrambler became the first game because it raised these questions early on. It was big enough to need real systems, but still small enough for me to understand every part. In the end, it became the prototype for Soft Arcade. The platform grew out of making one old game feel finished.

That is not as dramatic as having a big plan, but it is more honest. I started by updating a college project and slowly realized the real value was in the reusable layer I was building around the puzzle.

## Why the jQuery Core Survived

It would have been easy to decide to throw out the old jQuery code. That is often the default approach with older frontend code: if it does not fit the current stack, just rewrite it.

I did not do that here.

The puzzle logic already worked. The board interactions were solid. jQuery's animation was a good fit for sliding numbered tiles into an empty space. Rewriting everything in React would have taken time, created new bugs, and added little value for players.

So the modern version uses an island-style boundary. React owns the static scaffold; jQuery owns the live interaction. In practice, this means `BeatTheScramblerGame.tsx` renders the HUD, board container, menus, and modals as ordinary HTML—and then a `useEffect` dynamically imports jQuery, loads the game scripts in dependency order, and hands control to the jQuery runtime:

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

The important part is the cleanup boundary. `mountBeatTheScrambler(posthog)` returns a cleanup callback. The jQuery code also namespaces its event bindings with `.beatTheScrambler`, which makes unmounting predictable when React tears down the component.

This split is pragmatic:

- React handles routing, layout, bundling, and the page shell.
- jQuery handles the puzzle runtime and direct DOM animation.
- Shared TypeScript modules handle platform-level concerns such as arcade names and leaderboard configuration.

There is nothing inherently virtuous about rewriting code into a newer framework. The valuable part is making the boundary clear enough for the old code to live safely within the new application.

## Creating the Scrambler Mascot

The original puzzle had no character. It was just numbers.

That was fine for a college project, but Soft Arcade needed the game to have some personality. Since the mechanic is about restoring order after chaos, it made sense for the main troublemaker to be the Scrambler.

![The Scrambler mascot: a hexagonal face with asymmetric eyes, glitch bars, and a bent cubic-Bezier mouth, rendered entirely in inline SVG](/labs/beat-the-scrambler-origin/scrambler-mascot.svg)

The Scrambler is implemented entirely as inline SVG returned by `getScramblerMarkup()` in `mountBeatTheScrambler.js`. There are no image assets involved:

```js
function getScramblerMarkup() {
  return '' +
    '<div class="scrambler-character-inner">' +
      '<svg viewBox="-28 0 176 120" role="presentation" focusable="false" aria-hidden="true">' +
        '<line class="scrambler-glitch-bar" x1="15" y1="42" x2="29" y2="42"></line>' +
        '<path class="scrambler-face" d="M60 16 L92 34 L102 60 L92 88 L60 104 L28 88 L18 60 L28 34 Z"></path>' +
        '<circle class="scrambler-pupil" cx="46" cy="55" r="2.4"></circle>' +
        '<path class="scrambler-mouth" d="M42 75 C48 72, 52 81, 58 78 C65 74, 68 85, 78 72"></path>' +
      '</svg>' +
    '</div>';
}
```

The full SVG adds arms, horns, asymmetric eyes, glitch bars, and a bent cubic-Bezier mouth. CSS animation gives the mascot movement without introducing a separate rendering system.

The Scrambler appears in three important places:

- The start menu, where it taunts the player before a round
- the full-screen scramble overlay, where it "mixes up" the board
- win and confirm states, where it reacts to the player solving or abandoning a run

Short text lines help give the character personality without cluttering the interface. The game picks from arrays like:

```js
let SCRAMBLER_LINES = {
  menu: [
    "Fix it. If you can.",
    "Order is overrated.",
    "Try not to embarrass yourself."
  ],
  win: [
    "The Scrambler wants a rematch.",
    "You fixed it. Barely.",
    "Order restored. For now."
  ]
};
```

This changed the feel of the game more than I expected. The puzzle did not need a story. It needed a face.

## Adding Modern Game Features

The replay loop came from adding measurement.

The move counter increments after successful player moves. The timer starts on the first move, not when the board appears, which avoids punishing players while they are still reading the board after the scramble animation. When the puzzle is solved, the game stores a pending score submission with the level, moves, and elapsed time.

Local bests are stored in `localStorage` under `tileGamePersonalBests`. The helper `getUpdatedBest` keeps time and moves as separate best values:

```js
function getUpdatedBest(previousBest, moveCount, timerSeconds) {
  let isNewBest = false;

  if (!previousBest || timerSeconds < previousBest.time) {
    isNewBest = true;
  }

  if (!previousBest || moveCount < previousBest.moves) {
    isNewBest = true;
  }

  if (!isNewBest) {
    return {
      isNewBest: false,
      best: previousBest
    };
  }

  return {
    isNewBest: true,
    best: {
      time: previousBest ? Math.min(previousBest.time, timerSeconds) : timerSeconds,
      moves: previousBest ? Math.min(previousBest.moves, moveCount) : moveCount
    }
  };
}
```

Server leaderboards use the shared score API. The Beat the Scrambler columns are intentionally simple: name, moves, and time. The player's arcade name is shared across games through `src/lib/arcadeName.ts`, which normalizes names to a 12-character uppercase format and migrates the older `tileGameLastPlayerName` key if it exists.

Supporting mobile took more than just making the board responsive. Touch swipes had to move tiles without the page sliding under the player's finger. On small screens, the game switches to a mobile mode that locks the page, remembers the scroll position, and restores it when the run ends or pauses. It is not fancy code, but it is what makes the difference between "technically works on mobile" and "actually feels like a game on mobile."

It is still a sliding puzzle at its core, but the features around it change how you play. Easy mode is approachable. Medium is the main competitive board. Hard is for a longer, tougher solve. The timer, move counter, best badge, and leaderboard make every run feel meaningful.

## Instrumenting the Game

Even a small game benefits from analytics. Without instrumentation, it is hard to tell the difference between "people saw the game" and "people actually played a round."

Beat the Scrambler receives the initialized PostHog instance from React:

```tsx
cleanupGame = mountBeatTheScrambler(posthog);
```

The jQuery runtime does not import PostHog. It just accepts it as a dependency and captures events at meaningful points:

- `game_started` when a player chooses a difficulty
- `game_restarted` when a run restarts
- `puzzle_solved` when the board returns to the solved state
- `score_auto_save_started` when a score submission begins
- `score_auto_save_success` and `score_auto_save_failed` for the API result
- `score_submitted` and `score_submit_failed` for compatibility with the broader event vocabulary
- `arcade_name_set` when the player saves a name without a pending score

The solve event carries the properties that matter:

```js
posthog.capture("puzzle_solved", {
  game: "beat-the-scrambler",
  difficulty: currentLevelName,
  board_size: boardSize,
  moves: moveCount,
  elapsed_seconds: timerSeconds,
  is_new_best: isNewBest
});
```

That gives Soft Arcade enough data to answer practical questions. Which difficulty do players start with? Do they finish? Do they submit scores? Are failures coming from the leaderboard API?

For a game this small, analytics should not turn into surveillance or become a distraction. The goal is just to have basic visibility into how the product is used.

## Lessons Learned

The biggest lesson from Beat the Scrambler is that old code is not always technical debt. Sometimes it is just a working prototype that needs better boundaries.

The original jQuery project had its limits, but the main mechanic worked well. The board could be created, tiles could move, the solved state could be checked, and the scramble could be fair. Those parts were worth keeping.

The modernization work was mostly around the edges:

- mount the old runtime inside a modern React app
- make lifecycle cleanup explicit
- extract pure utilities where they clarify the rules
- add mobile behavior where browser defaults fight the interaction
- add score systems where replay value depends on comparison
- add a mascot where the game needs personality
- add analytics where decisions need feedback

Game design and technical design mixed together throughout the process. A timer is a technical feature, but it also affects how players act. A difficulty setting is just a config object, but it also shapes who plays each round. A mascot is just SVG code, but it changes how the game feels. A leaderboard API is backend work, but it gives players a reason to care about improving their scores.

That is what made the project worth coming back to. The real challenge was turning a working mechanic into a full browser game while keeping the parts that already worked.

## Conclusion

Beat the Scrambler is now part of Soft Arcade, both as a game and as a small example of gradual modernization. It still has the heart of the college project: numbered tiles, one empty space, a scrambled board, and the simple satisfaction of putting everything back in order.

Around that core, it now has everything a modern browser game needs: responsive play, difficulty levels, score tracking, local bests, leaderboards, analytics, menus, win states, and a quirky Scrambler trying to mess up your progress.

The platform exists because rebuilding this puzzle showed what a small arcade site really needs: identity without accounts, scores that stick around, reusable game layouts, mobile-friendly play, and enough tracking to learn from real games. Soft Arcade grew from those lessons, not from a separate plan. The design principles that came out of it—no-login play, performance as user experience, and real-time analytics from the start—now guide every game on the site.

That sums up the Soft Arcade mission: build browser-native games that are lightweight, easy to read, and quick to play. Learn by building. Keep the experience small enough to load instantly, but complete enough to feel intentional.

![Beat the Scrambler running on a 4x4 board in Medium difficulty, showing the move counter, timer, and Scrambler mascot in the corner](/labs/beat-the-scrambler-origin/beat-the-scrambler-gameplay.png)

[Try Beat the Scrambler](/games/beat-the-scrambler) and see the puzzle in action. If you want to learn how Soft Arcade's second game handles more complex features—real-time traffic, SAT collision detection, and an evolving difficulty system—the [Near Miss traffic evolution article](/labs/near-miss-traffic-evolution) covers those systems in the same level of detail.
