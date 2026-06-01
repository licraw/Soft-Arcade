import { proxyLeaderboardRequest } from "@/lib/leaderboards/server";

const WORKER_PATH = "/api/scores";

export async function GET(request: Request) {
  return proxyLeaderboardRequest(request, WORKER_PATH);
}

export async function POST(request: Request) {
  return proxyLeaderboardRequest(request, WORKER_PATH);
}
