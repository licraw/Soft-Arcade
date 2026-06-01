export const LEADERBOARD_API_BASE_URL = "https://tile-game-scores.ltcrawshaw.workers.dev";

export type LeaderboardRow = Record<string, string | number | null | undefined>;

export type LeaderboardResponse = {
  scores?: unknown;
};

export async function fetchLeaderboard(endpoint: string) {
  const response = await fetch(`${LEADERBOARD_API_BASE_URL}${endpoint}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to load leaderboard.");
  }

  const payload = (await response.json()) as LeaderboardResponse;

  return Array.isArray(payload.scores) ? (payload.scores as LeaderboardRow[]) : [];
}

export async function submitLeaderboardScore<TPayload extends Record<string, unknown>>(endpoint: string, payload: TPayload) {
  const response = await fetch(`${LEADERBOARD_API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const responsePayload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof responsePayload.error === "string" ? responsePayload.error : "Score submission failed.");
  }

  return responsePayload;
}

export function notifyLeaderboardUpdated(gameId: string) {
  window.dispatchEvent(
    new CustomEvent("soft-arcade-leaderboard-updated", {
      detail: { gameId }
    })
  );
}
