export const PLAYER_NAME_STORAGE_KEY = "tileGameLastPlayerName";
export const MAX_PLAYER_NAME_LENGTH = 12;

export function sanitizePlayerName(name: unknown) {
  if (typeof name !== "string") {
    return "";
  }

  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .slice(0, MAX_PLAYER_NAME_LENGTH)
    .toUpperCase();
}

export function loadStoredPlayerName() {
  if (typeof window === "undefined") {
    return "";
  }

  return sanitizePlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY));
}

export function saveStoredPlayerName(name: string) {
  if (typeof window === "undefined") {
    return;
  }

  const sanitizedName = sanitizePlayerName(name);

  if (sanitizedName) {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, sanitizedName);
  }
}
