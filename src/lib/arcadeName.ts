export const ARCADE_NAME_STORAGE_KEY = "softArcade.arcadeName";
export const LEGACY_PLAYER_NAME_STORAGE_KEY = "tileGameLastPlayerName";
export const MAX_ARCADE_NAME_LENGTH = 12;

export function normalizeArcadeName(name: unknown) {
  if (typeof name !== "string") {
    return "";
  }

  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .slice(0, MAX_ARCADE_NAME_LENGTH)
    .toUpperCase();
}

export function getArcadeName() {
  if (typeof window === "undefined") {
    return "";
  }

  const arcadeName = normalizeArcadeName(window.localStorage.getItem(ARCADE_NAME_STORAGE_KEY));

  if (arcadeName) {
    return arcadeName;
  }

  const legacyName = normalizeArcadeName(window.localStorage.getItem(LEGACY_PLAYER_NAME_STORAGE_KEY));

  if (legacyName) {
    window.localStorage.setItem(ARCADE_NAME_STORAGE_KEY, legacyName);
    return legacyName;
  }

  return "";
}

export function setArcadeName(name: string) {
  if (typeof window === "undefined") {
    return "";
  }

  const normalizedName = normalizeArcadeName(name);

  if (!normalizedName) {
    return "";
  }

  window.localStorage.setItem(ARCADE_NAME_STORAGE_KEY, normalizedName);
  return normalizedName;
}

export function clearArcadeName() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ARCADE_NAME_STORAGE_KEY);
}

export function hasArcadeName() {
  return Boolean(getArcadeName());
}
