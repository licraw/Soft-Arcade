import type { LeaderboardRow } from "./api";

export type ColumnDefinition = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: (value: LeaderboardRow[string], row: LeaderboardRow) => string;
};

export type LeaderboardConfig = {
  gameId: string;
  title: string;
  fetchEndpoint: string;
  submitEndpoint?: string;
  columns: ColumnDefinition[];
  emptyMessage: string;
};

function formatTime(totalSeconds: LeaderboardRow[string]) {
  const secondsValue = Number(totalSeconds) || 0;
  const minutes = Math.floor(secondsValue / 60);
  const seconds = secondsValue % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatNumber(value: LeaderboardRow[string]) {
  return (Number(value) || 0).toLocaleString();
}

function formatMiles(value: LeaderboardRow[string]) {
  const distance = Number(value) || 0;
  const miles = Math.max(0.1, distance / 5.2 / 3600);

  return `${miles.toFixed(1)} mi`;
}

function formatSpeed(value: LeaderboardRow[string]) {
  return `${Math.max(0, Math.round(Number(value) || 0))} mph`;
}

export const leaderboardConfigs: Record<string, LeaderboardConfig> = {
  "beat-the-scrambler": {
    gameId: "beat-the-scrambler",
    title: "Medium 4x4",
    fetchEndpoint: "/api/scores?level=medium&limit=5",
    submitEndpoint: "/api/scores",
    emptyMessage: "No medium scores yet.",
    columns: [
      { key: "name", label: "Name", align: "left" },
      { key: "moves", label: "Moves", align: "right", format: formatNumber },
      { key: "time", label: "Time", align: "right", format: formatTime }
    ]
  },
  "near-miss": {
    gameId: "near-miss",
    title: "Near Miss",
    fetchEndpoint: "/api/near-miss/scores?limit=5",
    submitEndpoint: "/api/near-miss/scores",
    emptyMessage: "No Near Miss scores yet.",
    columns: [
      { key: "name", label: "Name", align: "left" },
      { key: "score", label: "Score", align: "right", format: formatNumber },
      { key: "distance", label: "Distance", align: "right", format: formatMiles },
      { key: "nearMisses", label: "Near Misses", align: "right", format: formatNumber },
      { key: "averageSpeed", label: "Avg Speed", align: "right", format: formatSpeed }
    ]
  }
};

export function getLeaderboardConfig(gameId: string) {
  return leaderboardConfigs[gameId] || leaderboardConfigs["beat-the-scrambler"];
}
