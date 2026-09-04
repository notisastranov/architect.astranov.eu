export type Discipline = "architecture" | "mechanical" | "survey";
export type UnitSystem = "mm" | "cm" | "m" | "ft";
export type ViewMode = "globe" | "plan" | "model" | "split";
export type GlobeLayer = "BASEMAP" | "off";
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

export interface Layer {
  id: Id;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

export interface BaseEnt {
  id: Id;
  layerId: Id;
  name?: string;
}

export interface WallEnt extends BaseEnt {
  kind: "wall";
  a: Pt;
  b: Pt;
  thickness: number;
  height: number;
  material: string;
  ifc: string;
}

export interface SlabEnt extends BaseEnt {
  kind: "slab";
  points: Pt[];
  thickness: number;
  elevation: number;
  material: string;
}

export interface ColumnEnt extends BaseEnt {
  kind: "column";
  c: Pt;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  material: string;
}

export interface OpeningEnt extends BaseEnt {
  kind: "door" | "window";
  wallId: Id;
  offset: number;
  width: number;
  height: number;
  sill: number;
  swing: "left" | "right";
}

export interface RoomEnt extends BaseEnt {
  kind: "room";
  points: Pt[];
  occupancy: string;
}

export interface LineEnt extends BaseEnt {
  kind: "line";
  a: Pt;
  b: Pt;
}

export interface PolylineEnt extends BaseEnt {
  kind: "polyline";
  points: Pt[];
  closed: boolean;
}

export interface RectEnt extends BaseEnt {
  kind: "rect";
  a: Pt;
  b: Pt;
  thickness?: number;
}

export interface CircleEnt extends BaseEnt {
  kind: "circle";
  c: Pt;
  r: number;
}

export interface DimEnt extends BaseEnt {
  kind: "dim";
  a: Pt;
  b: Pt;
  offset: number;
}

export interface TextEnt extends BaseEnt {
  kind: "text";
  p: Pt;
  text: string;
  size: number;
  rotation: number;
}

export interface SurveyEnt extends BaseEnt {
  kind: "survey";
  e: number;
  n: number;
  z: number;
  code: string;
  desc: string;
}

export type Entity =
  | WallEnt
  | SlabEnt
  | ColumnEnt
  | OpeningEnt
  | RoomEnt
  | LineEnt
  | PolylineEnt
  | RectEnt
  | CircleEnt
  | DimEnt
  | TextEnt
  | SurveyEnt;

export type EntityKind = Entity["kind"];

export interface Project {
  id: Id;
  name: string;
  discipline: Discipline;
  units: UnitSystem;
  description: string;
  layers: Layer[];
  entities: Entity[];
  wallHeight: number;
  wallThickness: number;
  gridSize: number;
}

export interface SnapConfig {
  grid: boolean;
  end: boolean;
  mid: boolean;
  center: boolean;
  int: boolean;
}

export interface SnapHit {
  pt: Pt;
  type: "grid" | "end" | "mid" | "center" | "int" | "near" | "perp";
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Draft {
  tool: Tool;
  points: Pt[];
  text?: string;
}

export interface AiOp {
  op: string;
  [key: string]: unknown;
}

export const MATERIALS = [
  "Brick",
  "Concrete",
  "Timber",
  "Steel S235",
  "Aluminium 6061",
  "Glass",
  "Gypsum",
  "Stone",
  "Earth",
] as const;

export const IFC_WALL = "IfcWallStandardCase";
export const IFC_SLAB = "IfcSlab";
export const IFC_DOOR = "IfcDoor";
export const IFC_WINDOW = "IfcWindow";
export const IFC_COL = "IfcColumn";
export const IFC_SPACE = "IfcSpace";
