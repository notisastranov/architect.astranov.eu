import { defaultLayers, nid } from "./geometry";
import type { Entity, Project } from "./types";

function wallsRect(
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  height: number,
  layerId: string,
  material: string,
  prefix: string,
): Entity[] {
  const pts = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  const out: Entity[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 4]!;
    out.push({
      id: `${prefix}-w${i}`,
      kind: "wall",
      layerId,
      a,
      b,
      thickness: t,
      height,
      material,
      ifc: "IfcWallStandardCase",
      name: ["South", "East", "North", "West"][i],
    });
  }
  return out;
}

export function sampleArchitecture(): Project {
  const layers = defaultLayers("architecture");
  const t = 200;
  const H = 3000;
  const entities: Entity[] = [];

  entities.push(...wallsRect(0, 0, 12000, 8000, t, H, "walls", "Brick", "ext"));

  entities.push({
    id: "int-v",
    kind: "wall",
    layerId: "walls",
    name: "Partition E",
    a: { x: 8000, y: 0 },
    b: { x: 8000, y: 8000 },
    thickness: 100,
    height: H,
    material: "Gypsum",
    ifc: "IfcWallStandardCase",
  });
  entities.push({
    id: "int-h",
    kind: "wall",
    layerId: "walls",
    name: "Partition N",
    a: { x: 8000, y: 4000 },
    b: { x: 12000, y: 4000 },
    thickness: 100,
    height: H,
    material: "Gypsum",
    ifc: "IfcWallStandardCase",
  });

  entities.push({
    id: "door-entry",
    kind: "door",
    layerId: "openings",
    name: "Entry D01",
    wallId: "ext-w0",
    offset: 1800,
    width: 900,
    height: 2100,
    sill: 0,
    swing: "left",
  });
  entities.push({
    id: "door-kitchen",
    kind: "door",
    layerId: "openings",
    name: "Kitchen D02",
    wallId: "int-v",
    offset: 1200,
    width: 800,
    height: 2100,
    sill: 0,
    swing: "right",
  });
  entities.push({
    id: "door-bed",
    kind: "door",
    layerId: "openings",
    name: "Bedroom D03",
    wallId: "int-v",
    offset: 5200,
    width: 800,
    height: 2100,
    sill: 0,
    swing: "left",
  });

  entities.push({
    id: "win-s",
    kind: "window",
    layerId: "openings",
    name: "W01",
    wallId: "ext-w0",
    offset: 5200,
    width: 1800,
    height: 1400,
    sill: 900,
    swing: "left",
  });
  entities.push({
    id: "win-n",
    kind: "window",
    layerId: "openings",
    name: "W02",
    wallId: "ext-w2",
    offset: 3500,
    width: 2400,
    height: 1400,
    sill: 900,
    swing: "left",
  });
  entities.push({
    id: "win-e-bed",
    kind: "window",
    layerId: "openings",
    name: "W03",
    wallId: "ext-w1",
    offset: 5200,
    width: 1400,
    height: 1200,
    sill: 1000,
    swing: "left",
  });
  entities.push({
    id: "win-e-kit",
    kind: "window",
    layerId: "openings",
    name: "W04",
    wallId: "ext-w1",
    offset: 1400,
    width: 1200,
    height: 1200,
    sill: 1000,
    swing: "left",
  });
  entities.push({
    id: "win-w",
    kind: "window",
    layerId: "openings",
    name: "W05",
    wallId: "ext-w3",
    offset: 2800,
    width: 1600,
    height: 1400,
    sill: 900,
    swing: "left",
  });

  entities.push({
    id: "col-1",
    kind: "column",
    layerId: "cols",
    name: "C1",
    c: { x: 0, y: 0 },
    width: 300,
    depth: 300,
    height: H,
    rotation: 0,
    material: "Concrete",
  });
  entities.push({
    id: "col-2",
    kind: "column",
    layerId: "cols",
    name: "C2",
    c: { x: 12000, y: 0 },
    width: 300,
    depth: 300,
    height: H,
    rotation: 0,
    material: "Concrete",
  });
  entities.push({
    id: "col-3",
    kind: "column",
    layerId: "cols",
    name: "C3",
    c: { x: 12000, y: 8000 },
    width: 300,
    depth: 300,
    height: H,
    rotation: 0,
    material: "Concrete",
  });
  entities.push({
    id: "col-4",
    kind: "column",
    layerId: "cols",
    name: "C4",
    c: { x: 0, y: 8000 },
    width: 300,
    depth: 300,
    height: H,
    rotation: 0,
    material: "Concrete",
  });

  entities.push({
    id: "slab-1",
    kind: "slab",
    layerId: "slabs",
    name: "Ground slab",
    points: [
      { x: 0, y: 0 },
      { x: 12000, y: 0 },
      { x: 12000, y: 8000 },
      { x: 0, y: 8000 },
    ],
    thickness: 180,
    elevation: 0,
    material: "Concrete",
  });

  entities.push({
    id: "room-living",
    kind: "room",
    layerId: "rooms",
    name: "Living",
    occupancy: "Residential",
    points: [
      { x: 100, y: 100 },
      { x: 7950, y: 100 },
      { x: 7950, y: 7900 },
      { x: 100, y: 7900 },
    ],
  });
  entities.push({
    id: "room-kitchen",
    kind: "room",
    layerId: "rooms",
    name: "Kitchen",
    occupancy: "Residential",
    points: [
      { x: 8050, y: 100 },
      { x: 11900, y: 100 },
      { x: 11900, y: 3950 },
      { x: 8050, y: 3950 },
    ],
  });
  entities.push({
    id: "room-bed",
    kind: "room",
    layerId: "rooms",
    name: "Bedroom",
    occupancy: "Residential",
    points: [
      { x: 8050, y: 4050 },
      { x: 11900, y: 4050 },
      { x: 11900, y: 7900 },
      { x: 8050, y: 7900 },
    ],
  });

  entities.push({
    id: "dim-s",
    kind: "dim",
    layerId: "dims",
    a: { x: 0, y: 0 },
    b: { x: 12000, y: 0 },
    offset: -900,
  });
  entities.push({
    id: "dim-w",
    kind: "dim",
    layerId: "dims",
    a: { x: 0, y: 0 },
    b: { x: 0, y: 8000 },
    offset: -900,
  });
  entities.push({
    id: "dim-living",
    kind: "dim",
    layerId: "dims",
    a: { x: 0, y: 8000 },
    b: { x: 8000, y: 8000 },
    offset: 700,
  });

  entities.push({
    id: "txt-title",
    kind: "text",
    layerId: "notes",
    p: { x: 200, y: -1600 },
    text: "ASTRANOV BIMCAD  ·  COURT HOUSE  ·  LEVEL 00",
    size: 280,
    rotation: 0,
  });
  entities.push({
    id: "txt-scale",
    kind: "text",
    layerId: "notes",
    p: { x: 200, y: -2100 },
    text: "1 : 100   ·   Brick 200 / Gypsum 100   ·   FFL +0.00",
    size: 180,
    rotation: 0,
  });

  return {
    id: "arch-court-house",
    name: "Court House",
    discipline: "architecture",
    units: "m",
    description: "12 × 8 m dwelling — living, kitchen, bedroom. Load-bearing brick shell.",
    layers,
    entities,
    wallHeight: H,
    wallThickness: t,
    gridSize: 500,
  };
}

export function sampleMechanical(): Project {
  const layers = defaultLayers("mechanical");
  const entities: Entity[] = [];
  const W = 200;
  const H = 120;
  const t = 12;

  entities.push({
    id: "plate",
    kind: "rect",
    layerId: "outline",
    name: "Plate A3 S235",
    a: { x: 0, y: 0 },
    b: { x: W, y: H },
    thickness: t,
  });

  const holeR = 4;
  const inset = 15;
  const holes = [
    { id: "h1", c: { x: inset, y: inset } },
    { id: "h2", c: { x: W - inset, y: inset } },
    { id: "h3", c: { x: W - inset, y: H - inset } },
    { id: "h4", c: { x: inset, y: H - inset } },
  ];
  for (const h of holes) {
    entities.push({
      id: h.id,
      kind: "circle",
      layerId: "holes",
      name: "Ø8 through",
      c: h.c,
      r: holeR,
    });
  }
  entities.push({
    id: "h5",
    kind: "circle",
    layerId: "holes",
    name: "Ø20 bore",
    c: { x: W / 2, y: H / 2 },
    r: 10,
  });

  entities.push({
    id: "dim-w",
    kind: "dim",
    layerId: "dims",
    a: { x: 0, y: 0 },
    b: { x: W, y: 0 },
    offset: -18,
  });
  entities.push({
    id: "dim-h",
    kind: "dim",
    layerId: "dims",
    a: { x: 0, y: 0 },
    b: { x: 0, y: H },
    offset: -18,
  });
  entities.push({
    id: "dim-inset",
    kind: "dim",
    layerId: "dims",
    a: { x: 0, y: H },
    b: { x: inset, y: H },
    offset: 14,
  });
  entities.push({
    id: "dim-bore",
    kind: "dim",
    layerId: "dims",
    a: { x: W / 2 - 10, y: H / 2 },
    b: { x: W / 2 + 10, y: H / 2 },
    offset: 16,
  });

  entities.push({
    id: "note",
    kind: "text",
    layerId: "notes",
    p: { x: 0, y: -36 },
    text: "PLATE  200 × 120 × 12  ·  S235JR  ·  4×Ø8 THRU  ·  Ø20 H7",
    size: 6,
    rotation: 0,
  });
  entities.push({
    id: "tol",
    kind: "text",
    layerId: "notes",
    p: { x: 0, y: -48 },
    text: "ISO 2768-mK   ·   Deburr 0.3   ·   Mill finish",
    size: 5,
    rotation: 0,
  });

  return {
    id: "mech-plate-a3",
    name: "Plate A3",
    discipline: "mechanical",
    units: "mm",
    description: "200 × 120 × 12 mm steel plate, four Ø8 holes and a central Ø20 bore.",
    layers,
    entities,
    wallHeight: t,
    wallThickness: 1,
    gridSize: 5,
  };
}

export function sampleSurvey(): Project {
  const layers = defaultLayers("survey");
  const entities: Entity[] = [];

  const pts: { code: string; e: number; n: number; z: number; desc: string }[] = [
    { code: "BM1", e: -4200, n: -3800, z: 12400, desc: "Brass benchmark, church wall" },
    { code: "STN1", e: 0, n: 0, z: 12450, desc: "Traverse station SW" },
    { code: "STN2", e: 18420, n: 640, z: 12462, desc: "Traverse station SE" },
    { code: "STN3", e: 19110, n: 14280, z: 12510, desc: "Traverse station NE" },
    { code: "STN4", e: 380, n: 13640, z: 12498, desc: "Traverse station NW" },
    { code: "IP-SW", e: 5000, n: 5000, z: 12480, desc: "Building corner SW" },
    { code: "IP-SE", e: 17000, n: 5000, z: 12484, desc: "Building corner SE" },
    { code: "IP-NE", e: 17000, n: 13000, z: 12502, desc: "Building corner NE" },
    { code: "IP-NW", e: 5000, n: 13000, z: 12496, desc: "Building corner NW" },
  ];

  for (const p of pts) {
    entities.push({
      id: `sp-${p.code}`,
      kind: "survey",
      layerId: p.code.startsWith("STN") || p.code === "BM1" ? "control" : "site",
      name: p.code,
      e: p.e,
      n: p.n,
      z: p.z,
      code: p.code,
      desc: p.desc,
    });
  }

  const loop = ["STN1", "STN2", "STN3", "STN4", "STN1"];
  for (let i = 0; i < loop.length - 1; i++) {
    const a = pts.find((p) => p.code === loop[i])!;
    const b = pts.find((p) => p.code === loop[i + 1])!;
    entities.push({
      id: `tr-${i}`,
      kind: "line",
      layerId: "traverse",
      name: `${loop[i]}–${loop[i + 1]}`,
      a: { x: a.e, y: a.n },
      b: { x: b.e, y: b.n },
    });
  }

  entities.push({
    id: "bldg",
    kind: "rect",
    layerId: "site",
    name: "Building footprint",
    a: { x: 5000, y: 5000 },
    b: { x: 17000, y: 13000 },
  });

  entities.push({
    id: "dim-e",
    kind: "dim",
    layerId: "dims",
    a: { x: 5000, y: 5000 },
    b: { x: 17000, y: 5000 },
    offset: -1400,
  });
  entities.push({
    id: "dim-n",
    kind: "dim",
    layerId: "dims",
    a: { x: 5000, y: 5000 },
    b: { x: 5000, y: 13000 },
    offset: -1400,
  });

  entities.push({
    id: "title",
    kind: "text",
    layerId: "notes",
    p: { x: -4200, y: -5600 },
    text: "TRA-04  ·  SITE CONTROL  ·  LOCAL GRID",
    size: 420,
    rotation: 0,
  });
  entities.push({
    id: "crs",
    kind: "text",
    layerId: "notes",
    p: { x: -4200, y: -6300 },
    text: "CRS local · E/N metres · elevations to BM1 12.400 m",
    size: 280,
    rotation: 0,
  });

  return {
    id: "survey-tra04",
    name: "Site TRA-04",
    discipline: "survey",
    units: "m",
    description: "Closed traverse around a 12 × 8 m building with benchmark BM1.",
    layers,
    entities,
    wallHeight: 0,
    wallThickness: 0,
    gridSize: 2000,
  };
}

export function blankProject(discipline: Project["discipline"]): Project {
  const units = discipline === "mechanical" ? "mm" : "m";
  const gridSize = discipline === "mechanical" ? 5 : discipline === "survey" ? 1000 : 500;
  return {
    id: nid("prj"),
    name: discipline === "architecture" ? "Untitled model" : discipline === "mechanical" ? "Untitled part" : "Untitled survey",
    discipline,
    units,
    description: "",
    layers: defaultLayers(discipline),
    entities: [],
    wallHeight: discipline === "mechanical" ? 10 : 3000,
    wallThickness: discipline === "architecture" ? 200 : 1,
    gridSize,
  };
}

export const SAMPLE_CATALOG = [
  {
    id: "architecture",
    title: "Court House",
    discipline: "architecture" as const,
    spec: "12 × 8 m  ·  3 spaces  ·  BIM walls",
    blurb: "Load-bearing brick dwelling with doors, windows, rooms and quantities.",
    load: sampleArchitecture,
  },
  {
    id: "mechanical",
    title: "Plate A3",
    discipline: "mechanical" as const,
    spec: "200 × 120 × 12 mm  ·  S235  ·  Ø8 / Ø20",
    blurb: "Milled steel plate with through-holes, bore and ISO dimensions.",
    load: sampleMechanical,
  },
  {
    id: "survey",
    title: "Site TRA-04",
    discipline: "survey" as const,
    spec: "Closed traverse  ·  9 stations  ·  local grid",
    blurb: "Control network, building footprint, bearings and elevations.",
    load: sampleSurvey,
  },
];
