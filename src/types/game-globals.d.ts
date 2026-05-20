export {};

declare global {
  interface Window {
    jQuery?: unknown;
    $?: unknown;
    TileGameUtils?: unknown;
    TILE_GAME_CONFIG?: {
      apiBaseUrl?: string;
    };
  }
}
