const DEFAULT_WORKER_ERROR = "Leaderboard service unavailable.";
const CLIENT_IP_HASH_HEADER = "X-Soft-Arcade-Client-IP-Hash";

function getWorkerConfig() {
  const workerUrl = process.env.LEADERBOARD_WORKER_URL?.replace(/\/+$/, "");
  const workerSecret = process.env.LEADERBOARD_WORKER_SECRET;

  if (!workerUrl) {
    return null;
  }

  return { workerUrl, workerSecret };
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(request: Request) {
  const cfConnectingIp = request.headers.get("CF-Connecting-IP");
  const realIp = request.headers.get("X-Real-IP");
  const forwardedFor = request.headers.get("X-Forwarded-For");
  const forwardedClientIp = forwardedFor?.split(",")[0]?.trim();

  return cfConnectingIp || realIp || forwardedClientIp || null;
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

  const clientIp = getClientIp(request);

  if (clientIp) {
    headers.set(CLIENT_IP_HASH_HEADER, await sha256Hex(clientIp));
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
