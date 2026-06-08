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
  onPlayerNameChange: (name: string) => void;
  onChangeName: () => void;
  onRestart: () => void;
  onSubmitScore: () => void;
  showNameEntry: boolean;
};

export function NearMissGameOverModal({
  playerName,
  scoreSubmission,
  snapshot,
  onPlayerNameChange,
  onChangeName,
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
        <button type="button" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </div>
  );
}
