import { ScorePill } from "@/games/shared/car/hud/ScorePill";
import { Speedometer } from "@/games/shared/car/hud/Speedometer";
import type { NearMissSnapshot } from "../engine/gameLoop";

type NearMissHudProps = {
  snapshot: NearMissSnapshot;
};

export function NearMissHud({ snapshot }: NearMissHudProps) {
  return (
    <div className="near-miss-hud" aria-label="Near Miss status">
      <div className="near-miss-hud-group near-miss-hud-left">
        <ScorePill label="Score" value={snapshot.score.toLocaleString()} tone="cyan" />
        <ScorePill label="Best" value={snapshot.bestScore.toLocaleString()} tone="green" />
      </div>
      <div className="near-miss-hud-center">
        <span>Near</span>
        <strong>{snapshot.nearMisses}</strong>
      </div>
      <div className="near-miss-hud-group near-miss-hud-right">
        <Speedometer speed={snapshot.speed} />
        <ScorePill label="Streak" value={snapshot.streak ? `x${snapshot.streak}` : "0"} tone="pink" />
      </div>
    </div>
  );
}
