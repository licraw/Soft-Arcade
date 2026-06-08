import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/leaderboards/api";

const NEAR_MISS_LEADERBOARD_ENDPOINT = "/api/near-miss/scores?limit=10";

type NearMissLeaderboardScreenProps = {
  onBack: () => void;
};

function formatNumber(value: LeaderboardRow[string]) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();
}

function formatMiles(value: LeaderboardRow[string]) {
  const distance = Number(value) || 0;
  const miles = Math.max(0.1, distance / 5.2 / 3600);

  return `${miles.toFixed(1)} mi`;
}

function formatSpeed(value: LeaderboardRow[string]) {
  return `${Math.max(0, Math.round(Number(value) || 0))} mph`;
}

export function NearMissLeaderboardScreen({ onBack }: NearMissLeaderboardScreenProps) {
  const [scores, setScores] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState("Loading scores...");

  useEffect(() => {
    let active = true;

    setStatus("Loading scores...");
    fetchLeaderboard(NEAR_MISS_LEADERBOARD_ENDPOINT)
      .then((rows) => {
        if (!active) {
          return;
        }

        setScores(rows);
        setStatus(rows.length ? "" : "No Near Miss scores yet.");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setScores([]);
        setStatus("Leaderboard unavailable right now.");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="near-miss-leaderboard-screen" role="dialog" aria-modal="true" aria-labelledby="near-miss-leaderboard-title">
      <p className="near-miss-modal-kicker">Leaderboard</p>
      <h2 id="near-miss-leaderboard-title">Near Miss</h2>
      {status ? <p className="near-miss-leaderboard-status">{status}</p> : null}
      <ol className="near-miss-leaderboard-list">
        {scores.map((score, index) => (
          <li key={`${score.name}-${index}`}>
            <span className="near-miss-rank">{index + 1}</span>
            <span className="near-miss-leaderboard-name">{String(score.name || "AAA")}</span>
            <strong>{formatNumber(score.score)}</strong>
            <small>
              {formatNumber(score.nearMisses)} near misses | {formatMiles(score.distance)} | {formatSpeed(score.averageSpeed)}
            </small>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
