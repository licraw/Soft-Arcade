const DEFAULT_WORKER_ERROR = "Leaderboard service unavailable.";

function getWorkerConfig() {
  const workerUrl = process.env.LEADERBOARD_WORKER_URL?.replace(/\/+$/, "");
  const workerSecret = process.env.LEADERBOARD_WORKER_SECRET;

  if (!workerUrl) {
    return null;
  }

  return { workerUrl, workerSecret };
}

export async function proxyLeaderboardRequest(request: Request, workerPath: string) {
  const config = getWorkerConfig();

  if (!config) {
    return Response.json({ error: DEFAULT_WORKER_ERROR }, { status: 500 });
  }

  const incomingUrl = new URL(request.url);
  const workerUrl = new URL(`${config.workerUrl}${workerPath}`);
  workerUrl.search = incomingUrl.search;

  const headers = new Headers({
    Accept: "application/json"
  });
  const contentType = request.headers.get("Content-Type");
  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store"
  };

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (config.workerSecret) {
    headers.set("Authorization", `Bearer ${config.workerSecret}`);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(workerUrl, init);
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8"
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    return Response.json({ error: DEFAULT_WORKER_ERROR }, { status: 502 });
  }
}
