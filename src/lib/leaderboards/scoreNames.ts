import { getArcadeName, MAX_ARCADE_NAME_LENGTH, normalizeArcadeName, setArcadeName } from "@/lib/arcadeName";

export const PLAYER_NAME_STORAGE_KEY = "softArcade.arcadeName";
export const MAX_PLAYER_NAME_LENGTH = MAX_ARCADE_NAME_LENGTH;

export const sanitizePlayerName = normalizeArcadeName;

export function loadStoredPlayerName() {
  return getArcadeName();
}

export function saveStoredPlayerName(name: string) {
  setArcadeName(name);
}
