import type { NearMissSnapshot } from "../engine/gameLoop";
import { getDisplayedDistanceMiles } from "../engine/tuning";
import { MAX_PLAYER_NAME_LENGTH } from "@/lib/leaderboards/scoreNames";

type NearMissGameOverModalProps = {
  playerName: string;
  scoreSubmission: {
    status: "idle" | "saving" | "saved" | "error";
    message: string;
  };
  snapshot: NearMissSnapshot;
  bestScore: number;
  isNewBest: boolean;
  onPlayerNameChange: (name: string) => void;
  onBackToMenu: () => void;
  onChangeName: () => void;
  onLeaderboard: () => void;
  onRestart: () => void;
  onSubmitScore: () => void;
  showNameEntry: boolean;
};

export function NearMissGameOverModal({
  playerName,
  scoreSubmission,
  snapshot,
  bestScore,
  isNewBest,
  onPlayerNameChange,
  onBackToMenu,
  onChangeName,
  onLeaderboard,
  onRestart,
  onSubmitScore,
  showNameEntry
}: NearMissGameOverModalProps) {
  const distanceMiles = getDisplayedDistanceMiles(snapshot.distance);
  const averageSpeed = Math.max(0, Math.round(snapshot.averageSpeed));
  const scoreSaved = scoreSubmission.status === "saved";
  const scoreSaving = scoreSubmission.status === "saving";

  return (
    <div className="near-miss-modal" role="dialog" aria-modal="true" aria-labelledby="near-miss-game-over-title">
      <div className="near-miss-modal-panel">
        <p className="near-miss-modal-kicker">Run Ended</p>
        <h2 id="near-miss-game-over-title" className="near-miss-run-end-title">
          {snapshot.message}
        </h2>
        <div className="near-miss-final-score">
          <span>Final Score</span>
          <strong>{snapshot.score.toLocaleString()}</strong>
        </div>
        <p className="near-miss-personal-best">
          Personal Best: {Math.max(0, Math.floor(bestScore)).toLocaleString()}
        </p>
        {isNewBest ? <p className="near-miss-best-badge">New Personal Best</p> : null}
        <div className="near-miss-run-stats" aria-label="Run stats">
          <span>
            <small>Near Misses</small>
            <strong>{snapshot.nearMisses}</strong>
          </span>
          <span>
            <small>Distance Traveled</small>
            <strong>{distanceMiles.toFixed(1)} miles</strong>
          </span>
          <span>
            <small>Average Speed</small>
            <strong>{averageSpeed} MPH</strong>
          </span>
        </div>
        {showNameEntry ? (
          <form
            className="near-miss-score-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitScore();
            }}
          >
            <label htmlFor="near-miss-score-name">Arcade Name</label>
            <input
              id="near-miss-score-name"
              type="text"
              maxLength={MAX_PLAYER_NAME_LENGTH}
              autoComplete="nickname"
              placeholder="AAA"
              value={playerName}
              disabled={scoreSaving}
              onChange={(event) => onPlayerNameChange(event.target.value)}
            />
            <p className={scoreSubmission.status === "error" ? "error" : scoreSubmission.status === "saved" ? "success" : undefined}>
              {scoreSubmission.message}
            </p>
            <button type="submit" disabled={scoreSaving}>
              {scoreSaving ? "Saving..." : scoreSaved ? "Save Name" : "Save Score"}
            </button>
          </form>
        ) : (
          <div className="near-miss-score-form" aria-live="polite">
            <p className={scoreSubmission.status === "error" ? "error" : scoreSubmission.status === "saved" ? "success" : undefined}>
              {scoreSubmission.message}
            </p>
            <button type="button" onClick={onChangeName} disabled={scoreSaving}>
              Change Name
            </button>
          </div>
        )}
        <div className="near-miss-game-over-actions">
          <button type="button" className="near-miss-primary-action" onClick={onRestart}>
            Play Again
          </button>
          <button type="button" className="near-miss-secondary-button" onClick={onLeaderboard}>
            View Leaderboard
          </button>
          <button type="button" className="near-miss-tertiary-button" onClick={onBackToMenu}>
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
