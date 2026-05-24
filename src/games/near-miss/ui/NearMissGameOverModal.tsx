import type { NearMissSnapshot } from "../engine/gameLoop";

type NearMissGameOverModalProps = {
  snapshot: NearMissSnapshot;
  onRestart: () => void;
};

export function NearMissGameOverModal({ snapshot, onRestart }: NearMissGameOverModalProps) {
  return (
    <div className="near-miss-modal" role="dialog" aria-modal="true" aria-labelledby="near-miss-game-over-title">
      <div className="near-miss-modal-panel">
        <p className="near-miss-modal-kicker">Run Ended</p>
        <h2 id="near-miss-game-over-title">Too Close</h2>
        <p>Final score: {snapshot.score.toLocaleString()}</p>
        <div className="near-miss-run-stats" aria-label="Run stats">
          <span>{snapshot.nearMisses} close calls</span>
          <span>{Math.floor(snapshot.distance / 100)} lanes cleared</span>
          <span>{Math.round(snapshot.elapsed)}s survived</span>
        </div>
        <button type="button" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </div>
  );
}
