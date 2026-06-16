---
title: "Beat the Scrambler: From a College jQuery Project to a Modern Browser Game"
description: "How an old jQuery sliding puzzle became the first Soft Arcade browser game and shaped the platform around it."
slug: "beat-the-scrambler-origin"
publishedAt: "2026-06-16"
updatedAt: "2026-06-16"
category: "Devlog"
tags:
  - Browser Games
  - JavaScript
  - jQuery
  - React
canonicalPath: "/labs/beat-the-scrambler-origin"
---

# Beat the Scrambler: From a College jQuery Project to a Modern Browser Game

Beat the Scrambler started as the kind of project many developers have somewhere in their past: small, functional, and built to prove that a simple idea could work in the browser.

The first version was a sliding tile puzzle I built during college. It had numbered tiles, one empty space, a scramble button, and a win condition: put the board back in order. There was no character, no timer, no move counter, no leaderboard, no score submission, no mobile support, and no modern frontend framework around it. It was just HTML, CSS, JavaScript, and jQuery doing direct DOM work.

Years later, I came back to that project. I did not want to turn it into something bigger just for nostalgia. I wanted to see whether a tiny browser puzzle could become a complete arcade-style game without losing the directness that made the original satisfying to build.

That became Beat the Scrambler.

[IMAGE: Original puzzle board]

That experiment eventually became the start of Soft Arcade: lightweight browser-native games that are quick to load, easy to understand, and playable without accounts or installs. Old side projects can be useful raw material for that kind of work. They already contain something real: a mechanic, a constraint, a little proof that an interaction feels good enough to keep.

## The Original College Project

The college version of Beat the Scrambler was a standard sliding puzzle. The board started in order. One tile space was empty. The script scrambled the board, then the player used tile movement to restore the correct sequence.

At the time, jQuery was a normal choice for this kind of thing. If you wanted to select elements, attach handlers, move DOM nodes, animate positions, or update text, jQuery gave you a compact API that worked consistently across browsers. A puzzle board was also a good match: the game state was visible in the DOM, and every move had a direct visual consequence.

The original implementation was not trying to be a platform. It was not componentized or designed around routing, analytics, or a design system. It existed because the puzzle was easy to understand and fun to get working:

- create a grid
- leave the last cell empty
- assign numbers to the other cells
- move a tile into the gap
- check whether the numbers are back in order

That simplicity mattered later. The project was minimal, but it was not disposable.

## A Puzzle Must Be Solvable

The most important technical detail in a sliding puzzle is also one that is easy to miss: not every shuffled board can be solved.

In a 15-puzzle, the board has parity. If you take the solved board and randomly permute all the tiles, roughly half of the possible arrangements are unreachable through legal moves. The player can do everything right and still never solve the puzzle because the state was impossible from the start.

That is why "just shuffle the array" is dangerous here. It can create a puzzle that looks valid but is mathematically unwinnable.

Beat the Scrambler avoids that by scrambling the board through legal moves only. It starts from the solved state and performs a random walk by moving the empty space around the board. Since every scramble step is a valid move, the final board must be reachable from the solved board. The puzzle is solvable by construction.

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

[DIAGRAM: Solvable scramble algorithm]

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

The atomic move logic lives in `game-utils.js` as `moveGap`. Instead of having keyboard controls, touch controls, and scramble logic each understand board geometry separately, they all ask the same function what a move means:

```js
function moveGap(boardSize, gapX, gapY, direction) {
  // Returns { tileX, tileY, nextGapX, nextGapY, axis } or null
}
```

That return value says which tile moves, where the gap goes next, and whether the animation should run along the x-axis or y-axis. The jQuery runtime can then update the board state and call `.animate()` for presentation.

This is the kind of code I like in a small game. The rule is not hidden inside a UI handler. It is a reusable primitive. The scramble loop, arrow-key input, and touch swipe movement all pass through the same concept of a legal move.

## Revisiting the Project Years Later

When I came back to the game, the question was not "How do I make this look modern?" The better question was "What does a player expect from a browser game now?"

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

None of those features change the underlying puzzle. They change the shape around it.

The current game runs inside a Next.js App Router site. React owns the page shell, routing, layout, and static game surface. The jQuery runtime owns the live puzzle interaction after mount. The leaderboard API and shared arcade name utilities sit outside the game so they can be reused across Soft Arcade.

That was the point where the college project became a Soft Arcade game rather than a rescued code sample.

## The Project That Became Soft Arcade

The original goal was not to launch a platform.

At first, the project was much smaller than that: take an old puzzle, clean it up, make it playable on modern devices, and give it enough structure to feel like a complete browser game. That was already a reasonable amount of work. A sliding puzzle needs a fair scramble, readable controls, a start state, a solved state, and some feedback that makes a round feel finished.

But every feature I added started raising questions that were bigger than Beat the Scrambler.

A leaderboard meant there needed to be score persistence, validation, and a way to display rankings consistently. Score submission meant the player needed some kind of arcade identity, even without an account system. Analytics meant the game needed a vocabulary for events like starts, solves, restarts, and failed submissions. Mobile support meant the page shell had to respect the difference between reading a site and actively playing a game. Even the UI around menus, score panels, game cards, and win states started looking like something that should not be rebuilt from scratch for every future experiment.

None of those problems were unique to a tile puzzle.

That realization changed the shape of the work. I was no longer only improving an old puzzle. I was building infrastructure that another small browser game could also use: shared arcade identity, score submission, leaderboards, PostHog instrumentation, mobile play patterns, reusable game UI, and a hosting model that made each game feel like part of the same place.

Beat the Scrambler became the first game because it forced those questions early. It had enough surface area to need real systems, but it was small enough that I could still understand every part of the stack. In practice, it became the prototype for Soft Arcade. The platform grew out of the act of making one old game feel complete.

That is less dramatic than a grand plan, but it is more honest. I started modernizing a college project and gradually noticed that the useful work was not only inside the puzzle. It was in the repeatable layer forming around it.

## Why the jQuery Core Survived

It would have been easy to decide that the old jQuery code had to go. That is often the default posture toward older frontend code: if it does not match the current stack, rewrite it.

I did not do that here.

The puzzle logic already worked. The board interactions were reliable. jQuery's animation model was a natural fit for numbered tiles sliding into an empty space. A full React rewrite would have taken time, introduced new edge cases, and produced very little player-facing value.

So the modern version uses an island-style boundary. `BeatTheScramblerGame.tsx` renders the static scaffold: HUD, board container, menus, win modal, leaderboard modal, and confirm modal. In a `useEffect`, it dynamically imports jQuery, installs it on `window`, loads the game config and utility scripts, and then mounts the jQuery runtime:

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
- Shared TypeScript modules handle platform-level concerns like arcade names and leaderboard config.

There is nothing inherently virtuous about rewriting code into a newer framework. The valuable part is making the boundary clear enough that the old code can live safely inside the new application.

## Creating the Scrambler Mascot

The original puzzle had no character. It was just numbers.

That was fine for a college project, but Soft Arcade needed the game to have a little attitude. The mechanic is about restoring order after chaos, so the obvious antagonist was the thing that creates the chaos: the Scrambler.

[IMAGE: Scrambler mascot]

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

The full SVG adds arms, horns, asymmetric eyes, glitch bars, and a bent cubic-Bezier mouth. CSS animation gives the mascot movement without turning it into a separate rendering system.

The Scrambler appears in three important places:

- the start menu, where it taunts the player before a round
- the full-screen scramble overlay, where it "mixes up" the board
- win and confirm states, where it reacts to the player solving or abandoning a run

Small text lines help sell the character without overloading the interface. The runtime picks from arrays like:

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

Mobile support required more than making the board responsive. Touch swipes need to move tiles without the page drifting underneath the player's finger. On narrow viewports, the game enters a mobile play mode that fixes `document.body`, stores the previous scroll offset, and restores it when the run ends or pauses. It is not glamorous code, but it is the difference between "technically works on mobile" and "feels like a game on mobile."

The result is still a sliding puzzle, but the surrounding structure changes how it is played. Easy is approachable. Medium is the default competitive board. Hard is there for a longer, denser solve. The timer, move count, best badge, and leaderboard make each run feel like it counts.

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

That gives Soft Arcade enough data to answer practical questions. Which difficulty do players start? Do they finish? Do they submit scores? Are failures coming from the leaderboard API?

For a game this small, analytics should not become a surveillance project or a development distraction. The goal is basic product visibility.

## Lessons Learned

The biggest lesson from Beat the Scrambler is that old code is not automatically technical debt. Sometimes it is a working prototype with the right boundaries missing.

The original jQuery project had limitations, but the central mechanic was sound. The board could be generated. Tiles could move. The solved state could be detected. The scramble could be made fair. Those pieces were worth preserving.

The modernization work was mostly around the edges:

- mount the old runtime inside a modern React app
- make lifecycle cleanup explicit
- extract pure utilities where they clarify the rules
- add mobile behavior where browser defaults fight the interaction
- add score systems where replay value depends on comparison
- add a mascot where the game needs personality
- add analytics where decisions need feedback

Game design and technical design overlapped throughout the process. A timer is a technical feature, but it also changes player behavior. A difficulty setting is a config object, but it also defines the audience for a round. A mascot is SVG markup, but it changes the emotional texture of the game. A leaderboard API is backend plumbing, but it gives players a reason to care about shaving off a few moves.

That is what made the project worth revisiting. The interesting work was turning a working mechanic into a complete browser game while keeping the parts that already did their job.

## Conclusion

Beat the Scrambler now sits inside Soft Arcade as both a game and a small case study in incremental modernization. It still has the heart of the college project: numbered tiles, one empty space, a scrambled board, and the simple satisfaction of putting everything back where it belongs.

Around that core, it now has the pieces a modern browser game needs: responsive play, difficulty levels, score tracking, local bests, leaderboards, analytics, menus, win states, and a strange little Scrambler trying to undo your work.

It was also the first Soft Arcade game in a practical sense. The platform exists because rebuilding this puzzle exposed the systems a small arcade site would need: identity without accounts, scores that persist, reusable game surfaces, mobile play behavior, and enough instrumentation to learn from real rounds. Soft Arcade grew from those lessons rather than from a separate platform plan.

That is the Soft Arcade mission in miniature. Build browser-native games that are lightweight, readable, and quick to play. Learn through building. Keep the experience small enough to load instantly, but complete enough to feel intentional.

[IMAGE: Beat the Scrambler gameplay]

Play Beat the Scrambler.
