export type Discipline = "architecture" | "mechanical" | "survey";
export type UnitSystem = "mm" | "cm" | "m" | "ft";
export type ViewMode = "globe" | "plan" | "model" | "split";
export type GlobeLayer = string;
export type Tool =
  | "select"
  | "pan"
  | "line"
  | "rect"
  | "circle"
  | "polyline"
  | "wall"
  | "door"
  | "window"
  | "column"
  | "room"
  | "dim"
  | "text"
  | "survey"
  | "measure";

export type Id = string;

export interface Pt {
  x: number;
  y: number;
}

export interface GlobeState {
  lat: number;
  lon: number;
  alt: number;
  layer: GlobeLayer;
  flyNonce: number;
}
