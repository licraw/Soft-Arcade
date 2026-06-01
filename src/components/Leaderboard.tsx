"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/leaderboards/api";
import { getLeaderboardConfig, type ColumnDefinition, type LeaderboardConfig } from "@/lib/leaderboards/config";

type LeaderboardProps = {
  gameId: string;
  config?: LeaderboardConfig;
};

function normalizeRows(scores: LeaderboardRow[]) {
  return scores.filter((score) => score && typeof score === "object" && typeof score.name === "string");
}

function getCellValue(row: LeaderboardRow, column: ColumnDefinition) {
  const value = row[column.key];

  if (column.format) {
    return column.format(value, row);
  }

  return value === null || value === undefined ? "" : String(value);
}

export function Leaderboard({ gameId, config }: LeaderboardProps) {
  const resolvedConfig = useMemo(() => config || getLeaderboardConfig(gameId), [config, gameId]);
  const [scores, setScores] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState("Loading scores...");
  const gridTemplateColumns = `24px ${resolvedConfig.columns.map((column) => (column.align === "left" ? "minmax(0, 1fr)" : "auto")).join(" ")}`;

  const loadScores = useCallback(async () => {
    try {
      const nextScores = normalizeRows(await fetchLeaderboard(resolvedConfig.fetchEndpoint));

      setScores(nextScores);
      setStatus(nextScores.length ? "" : resolvedConfig.emptyMessage);
    } catch (error) {
      setStatus("Leaderboard unavailable.");
    }
  }, [resolvedConfig.emptyMessage, resolvedConfig.fetchEndpoint]);

  useEffect(() => {
    let isMounted = true;

    async function loadMountedScores() {
      try {
        const nextScores = normalizeRows(await fetchLeaderboard(resolvedConfig.fetchEndpoint));

        if (!isMounted) {
          return;
        }

        setScores(nextScores);
        setStatus(nextScores.length ? "" : resolvedConfig.emptyMessage);
      } catch (error) {
        if (isMounted) {
          setStatus("Leaderboard unavailable.");
        }
      }
    }

    void loadMountedScores();

    return () => {
      isMounted = false;
    };
  }, [resolvedConfig.emptyMessage, resolvedConfig.fetchEndpoint]);

  useEffect(() => {
    function handleLeaderboardUpdate(event: Event) {
      const detail = event instanceof CustomEvent ? (event.detail as { gameId?: string }) : {};

      if (detail.gameId === resolvedConfig.gameId) {
        void loadScores();
      }
    }

    window.addEventListener("soft-arcade-leaderboard-updated", handleLeaderboardUpdate);

    return () => {
      window.removeEventListener("soft-arcade-leaderboard-updated", handleLeaderboardUpdate);
    };
  }, [loadScores, resolvedConfig.gameId]);

  return (
    <section className="side-panel" aria-labelledby={`${resolvedConfig.gameId}-leaderboard-title`}>
      <h2 id={`${resolvedConfig.gameId}-leaderboard-title`}>Leaderboard</h2>
      <p className="leaderboard-meta">{resolvedConfig.title}</p>
      {status ? <p className="leaderboard-status">{status}</p> : null}
      <ol className="rail-leaderboard" style={{ "--leaderboard-columns": gridTemplateColumns } as CSSProperties}>
        {scores.map((score, index) => (
          <li key={`${resolvedConfig.gameId}-${score.name}-${index}`}>
            <span>{index + 1}</span>
            {resolvedConfig.columns.map((column) => (
              <span key={column.key} data-align={column.align || "left"}>
                {getCellValue(score, column)}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
