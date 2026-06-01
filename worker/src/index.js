const LEVELS = new Set(["easy", "medium", "hard"]);
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 12;
const MIN_SUBMIT_INTERVAL_MS = 15000;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/api/scores" && request.method === "GET") {
      return handleGetScores(request, env);
    }

    if (url.pathname === "/api/scores" && request.method === "POST") {
      return handlePostScore(request, env);
    }

    if (url.pathname === "/api/near-miss/scores" && request.method === "GET") {
      return handleGetNearMissScores(request, env);
    }

    if (url.pathname === "/api/near-miss/scores" && request.method === "POST") {
      return handlePostNearMissScore(request, env);
    }

    return json({ error: "Not found." }, 404);
  }
};

async function handleGetScores(request, env) {
  const url = new URL(request.url);
  const level = normalizeLevel(url.searchParams.get("level"));
  const limit = clampLimit(url.searchParams.get("limit"));

  if (!level) {
    return json({ error: "Invalid level." }, 400);
  }

  const { results } = await env.DB.prepare(
    `SELECT player_name, moves, time_seconds, created_at
     FROM scores
     WHERE level = ?
     ORDER BY moves ASC, time_seconds ASC, created_at ASC
     LIMIT ?`
  )
    .bind(level, limit)
    .all();

  return json({
    level,
    scores: formatScores(results)
  });
}

async function handlePostScore(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const level = normalizeLevel(body.level);
  const name = normalizeName(body.name);
  const moves = normalizePositiveInt(body.moves);
  const time = normalizePositiveInt(body.time);

  if (!level) {
    return json({ error: "Invalid level." }, 400);
  }

  if (!name) {
    return json({ error: "Name must be 1-12 characters." }, 400);
  }

  if (moves === null || time === null || moves < 1) {
    return json({ error: "Invalid score payload." }, 400);
  }

  const ipHash = await sha256Hex(request.headers.get("CF-Connecting-IP") || "local");
  const now = new Date();
  const createdAt = now.toISOString();
  const cutoff = new Date(now.getTime() - MIN_SUBMIT_INTERVAL_MS).toISOString();

  const recentSubmission = await env.DB.prepare(
    `SELECT created_at
     FROM scores
     WHERE ip_hash = ?
       AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(ipHash, cutoff)
    .first();

  if (recentSubmission) {
    return json({ error: "Please wait a few seconds before posting another score." }, 429);
  }

  await env.DB.prepare(
    `INSERT INTO scores (level, player_name, moves, time_seconds, created_at, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(level, name, moves, time, createdAt, ipHash)
    .run();

  const { results } = await env.DB.prepare(
    `SELECT player_name, moves, time_seconds, created_at
     FROM scores
     WHERE level = ?
     ORDER BY moves ASC, time_seconds ASC, created_at ASC
     LIMIT ?`
  )
    .bind(level, DEFAULT_LIMIT)
    .all();

  return json({
    ok: true,
    level,
    scores: formatScores(results)
  });
}

async function handleGetNearMissScores(request, env) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));

  const { results } = await env.DB.prepare(
    `SELECT player_name, score, distance, elapsed_seconds, near_misses, average_speed, scoring_version, created_at
     FROM near_miss_scores
     ORDER BY score DESC, created_at ASC
     LIMIT ?`
  )
    .bind(limit)
    .all();

  return json({
    scores: formatNearMissScores(results)
  });
}

async function handlePostNearMissScore(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const name = normalizeName(body.name);
  const score = normalizePositiveInt(body.score);
  const distance = normalizePositiveInt(body.distance);
  const elapsedSeconds = normalizePositiveInt(body.elapsed_seconds);
  const nearMisses = normalizePositiveInt(body.near_misses);
  const averageSpeed = normalizePositiveInt(body.average_speed);
  const scoringVersion = normalizePositiveInt(body.scoring_version ?? 1);

  if (!name) {
    return json({ error: "Name must be 1-12 characters." }, 400);
  }

  if (
    score === null ||
    distance === null ||
    elapsedSeconds === null ||
    nearMisses === null ||
    averageSpeed === null ||
    scoringVersion === null
  ) {
    return json({ error: "Invalid score payload." }, 400);
  }

  const ipHash = await sha256Hex(request.headers.get("CF-Connecting-IP") || "local");
  const now = new Date();
  const createdAt = now.toISOString();
  const cutoff = new Date(now.getTime() - MIN_SUBMIT_INTERVAL_MS).toISOString();
  const recentSubmission = await getRecentSubmission(env, "near_miss_scores", ipHash, cutoff);

  if (recentSubmission) {
    return json({ error: "Please wait a few seconds before posting another score." }, 429);
  }

  await env.DB.prepare(
    `INSERT INTO near_miss_scores
       (player_name, score, distance, elapsed_seconds, near_misses, average_speed, scoring_version, created_at, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(name, score, distance, elapsedSeconds, nearMisses, averageSpeed, scoringVersion, createdAt, ipHash)
    .run();

  const { results } = await env.DB.prepare(
    `SELECT player_name, score, distance, elapsed_seconds, near_misses, average_speed, scoring_version, created_at
     FROM near_miss_scores
     ORDER BY score DESC, created_at ASC
     LIMIT ?`
  )
    .bind(DEFAULT_LIMIT)
    .all();

  return json({
    ok: true,
    scores: formatNearMissScores(results)
  });
}

function normalizeLevel(level) {
  if (typeof level !== "string") {
    return null;
  }

  const normalized = level.trim().toLowerCase();

  return LEVELS.has(normalized) ? normalized : null;
}

function clampLimit(value) {
  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function normalizeName(name) {
  if (typeof name !== "string") {
    return null;
  }

  const normalized = name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .slice(0, MAX_NAME_LENGTH)
    .toUpperCase();

  if (normalized.length < MIN_NAME_LENGTH) {
    return null;
  }

  return normalized;
}

function normalizePositiveInt(value) {
  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function formatScores(rows) {
  return (rows || []).map((row) => ({
    name: row.player_name,
    moves: row.moves,
    time: row.time_seconds,
    completedAt: row.created_at
  }));
}

function formatNearMissScores(rows) {
  return (rows || []).map((row) => ({
    name: row.player_name,
    score: row.score,
    distance: row.distance,
    elapsedSeconds: row.elapsed_seconds,
    nearMisses: row.near_misses,
    averageSpeed: row.average_speed,
    scoringVersion: row.scoring_version,
    completedAt: row.created_at
  }));
}

async function getRecentSubmission(env, tableName, ipHash, cutoff) {
  const safeTables = new Set(["scores", "near_miss_scores"]);

  if (!safeTables.has(tableName)) {
    throw new Error("Invalid rate limit table.");
  }

  return env.DB.prepare(
    `SELECT created_at
     FROM ${tableName}
     WHERE ip_hash = ?
       AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(ipHash, cutoff)
    .first();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
