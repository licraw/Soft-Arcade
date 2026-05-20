"use client";

import { useEffect } from "react";
import styles from "./styles.module.css";

type JQueryGlobal = {
  fn?: {
    jquery?: string;
  };
};

type JQueryFactory = JQueryGlobal | ((window: Window) => JQueryGlobal);

function installJQueryGlobal(jqueryModule: unknown) {
  let resolvedJQuery = (jqueryModule as { default?: JQueryFactory }).default || (jqueryModule as JQueryFactory);

  if (typeof resolvedJQuery === "function" && !(resolvedJQuery as JQueryGlobal).fn?.jquery) {
    resolvedJQuery = resolvedJQuery(window);
  }

  window.jQuery = window.jQuery || resolvedJQuery;
  window.$ = window.$ || resolvedJQuery;
}

export function BeatTheScramblerGame() {
  useEffect(() => {
    let isMounted = true;
    let cleanupGame: (() => void) | undefined;

    async function mountGame() {
      const jqueryModule = await import("./jquery-3.4.1.js");

      if (!isMounted) {
        return;
      }

      installJQueryGlobal(jqueryModule);
      await import("./game-config.js");
      await import("./game-utils.js");
      const { mountBeatTheScrambler } = await import("./mountBeatTheScrambler.js");

      if (isMounted) {
        cleanupGame = mountBeatTheScrambler();
      }
    }

    void mountGame();

    return () => {
      isMounted = false;
      cleanupGame?.();
    };
  }, []);

  return (
    <div className={styles.gameFrame} aria-label="Beat the Scrambler game">
      <div id="board">
        <div id="hud">
          <div className="hud-topline">
            <div className="hud-compact-level">
              <span className="hud-label">Level</span>
              <span id="hud-level-pill">Medium 4x4</span>
            </div>
            <p id="scrambler-hud-line" className="scrambler-line hud-scrambler-line">Let&apos;s mix this up.</p>
            <button id="hud-toggle-button" className="icon-button" type="button" aria-label="Toggle game menu" title="Game menu">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16"></path>
              </svg>
            </button>
          </div>
          <div id="hud-panel">
            <div className="hud-summary">
              <div className="hud-item">
                <span className="hud-label">Level</span>
                <span id="current-level">Medium 4x4</span>
              </div>
              <div className="hud-item">
                <span className="hud-label">Moves</span>
                <span id="move-count">0</span>
              </div>
              <div className="hud-item">
                <span className="hud-label">Time</span>
                <span id="timer">00:00</span>
              </div>
              <div id="personal-best-wrap" className="hud-item hud-best">
                <span className="hud-label">Best</span>
                <span id="personal-best">N/A</span>
              </div>
            </div>
            <div className="hud-actions">
              <button id="leaderboard-button" className="icon-button" type="button" aria-label="Open leaderboard" title="Leaderboard">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l2.3 4.8 5.2.8-3.8 3.8.9 5.4L12 15.3 7.4 18l.9-5.4-3.8-3.8 5.2-.8z"></path>
                </svg>
              </button>
              <button id="restart-button" className="icon-button hud-danger-button" type="button" aria-label="Restart level" title="Restart">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4v6h6M20 12a8 8 0 10-2.3 5.7"></path>
                </svg>
              </button>
              <button id="main-menu-button" className="icon-button hud-danger-button" type="button" aria-label="Return to main menu" title="Main menu">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 11.5L12 4l9 7.5M6.5 10.5V20h11v-9.5M10 20v-5h4v5"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div id="scrambler-overlay" className="scrambler-overlay hidden" aria-hidden="true">
          <div id="scrambler-overlay-character" className="scrambler-character"></div>
        </div>
      </div>
      <div id="start-menu" className="modal">
        <div className="modal-content">
          <div id="scrambler-menu-character" className="scrambler-character scrambler-menu" aria-hidden="true"></div>
          <h1 className="game-title">Soft Arcade</h1>
          <p className="game-subtitle">Beat the Scrambler</p>
          <p id="scrambler-menu-line" className="scrambler-line">Let&apos;s mix this up.</p>
          <div className="menu-actions">
            <button className="level-button" type="button" data-level="easy">Easy</button>
            <button className="level-button" type="button" data-level="medium">Medium</button>
            <button className="level-button" type="button" data-level="hard">Hard</button>
            <button id="menu-leaderboard-button" type="button">Leaderboard</button>
          </div>
        </div>
      </div>
      <div id="win-modal" className="modal hidden">
        <div className="modal-content">
          <h1>You Win</h1>
          <p>Congratulations. You solved the puzzle.</p>
          <p id="scrambler-win-line" className="scrambler-line">Not bad.</p>
          <p id="win-stats">Time: 00:00 | Moves: 0</p>
          <p id="win-best">Personal Best: No best yet</p>
          <p id="win-best-badge" className="hidden">New Personal Best</p>
          <label id="score-name-label" htmlFor="score-name">Arcade Name</label>
          <input id="score-name" type="text" maxLength={12} autoComplete="nickname" placeholder="AAA" />
          <p id="score-submit-status" className="modal-note">Enter a name to save your score.</p>
          <button id="submit-score-button" type="button">Save Score</button>
          <button id="win-modal-close" type="button">Back To Levels</button>
        </div>
      </div>
      <div id="leaderboard-modal" className="modal hidden">
        <div className="modal-content modal-leaderboard">
          <h1>Leaderboard</h1>
          <div id="leaderboard-level-switcher" className="leaderboard-level-switcher" role="tablist" aria-label="Leaderboard difficulty">
            <button className="leaderboard-level-button" type="button" data-level="easy">Easy</button>
            <button className="leaderboard-level-button" type="button" data-level="medium">Medium</button>
            <button className="leaderboard-level-button" type="button" data-level="hard">Hard</button>
          </div>
          <p id="leaderboard-level">Medium 4x4</p>
          <p id="leaderboard-status" className="modal-note hidden"></p>
          <div id="leaderboard-table-wrap">
            <table id="leaderboard-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Name</th>
                  <th scope="col">Moves</th>
                  <th scope="col">Time</th>
                  <th scope="col">Finished</th>
                </tr>
              </thead>
              <tbody id="leaderboard-list"></tbody>
            </table>
          </div>
          <p id="leaderboard-empty" className="hidden">No scores yet for this difficulty.</p>
          <button id="leaderboard-close" type="button">Close</button>
        </div>
      </div>
      <div id="confirm-modal" className="modal hidden">
        <div className="modal-content modal-confirm">
          <h1 id="confirm-title">Leave Game?</h1>
          <p id="confirm-message">Your current run will be lost.</p>
          <p id="scrambler-confirm-line" className="scrambler-line hidden">Already?</p>
          <div className="confirm-actions">
            <button id="confirm-cancel" type="button">Keep Playing</button>
            <button id="confirm-accept" className="modal-danger-button" type="button">Leave</button>
          </div>
        </div>
      </div>
    </div>
  );
}
