import type { NearMissSnapshot } from "../engine/gameLoop";

type NearMissGameOverModalProps = {
  snapshot: NearMissSnapshot;
  onRestart: () => void;
};

const GAME_SPEED_UNITS_PER_MPH = 5.2;
const SECONDS_PER_HOUR = 3600;

export function NearMissGameOverModal({ snapshot, onRestart }: NearMissGameOverModalProps) {
  const distanceMiles = Math.max(0.1, snapshot.distance / GAME_SPEED_UNITS_PER_MPH / SECONDS_PER_HOUR);
  const averageSpeed = Math.max(0, Math.round(snapshot.averageSpeed));

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
        <button type="button" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </div>
  );
}
