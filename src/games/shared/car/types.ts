export type LaneSystem = {
  lanes: number;
  roadLeft: number;
  roadWidth: number;
  laneWidth: number;
  centers: number[];
};

export type CarBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CarPalette = {
  body: string;
  trim: string;
  glass: string;
  glow: string;
};

export type CarSpriteOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  palette: CarPalette;
  direction?: "up" | "down";
};
