"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = "https://tile-game-scores.ltcrawshaw.workers.dev";

type Score = {
  name: string;
  moves: number;
  time: number;
  completedAt: string;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeScores(scores: unknown): Score[] {
  if (!Array.isArray(scores)) {
    return [];
  }

  return scores
    .filter((score): score is Partial<Score> & { name: string } => {
      return !!score && typeof score === "object" && typeof (score as Score).name === "string";
    })
    .map((score) => ({
      name: score.name.trim().slice(0, 12).toUpperCase(),
      moves: Number(score.moves) || 0,
      time: Number(score.time) || 0,
      completedAt: score.completedAt || new Date().toISOString()
    }));
}

export function Leaderboard() {
  const [scores, setScores] = useState<Score[]>([]);
  const [status, setStatus] = useState("Loading scores...");

  useEffect(() => {
    let isMounted = true;

    async function loadScores() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/scores?level=medium&limit=5`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Unable to load leaderboard.");
        }

        const payload = await response.json();
        const nextScores = normalizeScores(payload.scores);

        if (!isMounted) {
          return;
        }

        setScores(nextScores);
        setStatus(nextScores.length ? "" : "No medium scores yet.");
      } catch (error) {
        if (isMounted) {
          setStatus("Leaderboard unavailable.");
        }
      }
    }

    void loadScores();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="side-panel" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">Leaderboard</h2>
      <p className="leaderboard-meta">Medium 4x4</p>
      {status ? <p className="leaderboard-status">{status}</p> : null}
      <ol className="rail-leaderboard">
        {scores.map((score, index) => (
          <li key={`${score.name}-${score.moves}-${score.time}-${index}`}>
            <span>{index + 1}</span>
            <span>{score.name}</span>
            <span>{score.moves}</span>
            <span>{formatTime(score.time)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
