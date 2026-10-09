import { defaultLayers } from "./geometry";
import type { Entity, Project, Pt } from "./types";

/** Regular pentagon. Each side is two stock 6 m beams, trunk at the vertex and at the midpoint. */
const SIDE = 12000;
const R = SIDE / (2 * Math.sin(Math.PI / 5));

function pentagon(radius: number): Pt[] {
  return Array.from({ length: 5 }, (_, k) => {
    const t = Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return { x: radius * Math.cos(t), y: radius * Math.sin(t) };
  });
}

function midway(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Clear soffit of the olive beams. The deck lands on the trunks.
 * Walking surface is soffit + 420 beam + 20 rabote = 2440 mm.
 */
const SOFFIT = 2000;
const OLIVE_D = 420;
const DECK_TOP = SOFFIT + OLIVE_D + 20;

/** Κ.Μ. 257 Γαιών Κοσκινού, κορυφές 1–19, ΕΓΣΑ ’87. X ανατολή, Y βορράς. */
const C_E = 878647.8864;
const C_N = 4034931.4331;
const RING: [number, number][] = [
  [878582.094, 4034923.1835],
  [878606.7434, 4034944.1116],
  [878611.9091, 4034945.4404],
  [878636.2793, 4034951.7095],
  [878652.3956, 4034952.8398],
  [878665.8823, 4034952.6443],
  [878677.3027, 4034954.0361],
  [878680.5841, 4034958.1868],
  [878682.3561, 4034960.4282],
  [878688.5368, 4034955.8265],
  [878702.4408, 4034924.1279],
  [878685.457, 4034912.8012],
  [878677.848, 4034907.7268],
  [878667.744, 4034890.8835],
  [878664.8556, 4034916.5792],
  [878609.4942, 4034920.6492],
  [878583.6738, 4034905.5739],
  [878583.665, 4034910.4803],
  [878580.5405, 4034916.0173],
];

function fieldPt(e: number, n: number): Pt {
  return { x: (e - C_E) * 1000, y: (n - C_N) * 1000 };
}

const TRUNK_DIA = [560, 480, 620, 450, 540, 500, 430, 580, 470, 510];

function beam(
  id: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  breadth: number,
  depth: number,
  top: number,
  material: string,
): Entity {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (breadth / 2);
  const ny = (dx / len) * (breadth / 2);
  const a = { x: x0 + nx, y: y0 + ny };
  const b = { x: x1 + nx, y: y1 + ny };
  const c = { x: x1 - nx, y: y1 - ny };
  const d = { x: x0 - nx, y: y0 - ny };
  return {
    id,
    kind: "slab",
    layerId: "slabs",
    name: id,
    material,
    thickness: depth,
    elevation: top,
    points: [a, b, c, d],
  };
}

export function sampleOliveTreehouse(): Project {
  const entities: Entity[] = [];
  const push = (e: Entity) => entities.push(e);

  push({
    id: "km257",
    kind: "polyline",
    layerId: "site",
    name: "Κ.Μ. 257",
    closed: true,
    points: RING.map(([e, n]) => fieldPt(e, n)),
  });
  RING.forEach(([e, n], i) => {
    const p = fieldPt(e, n);
    push({
      id: `km-${i + 1}`,
      kind: "survey",
      layerId: "site",
      name: String(i + 1),
      e: p.x,
      n: p.y,
      z: 0,
      code: String(i + 1),
      desc: `Κορυφή ${i + 1} · Ε ${e.toFixed(3)} · Ν ${n.toFixed(3)}`,
    });
  });

  const verts = pentagon(R);
  const mids = verts.map((v, i) => midway(v, verts[(i + 1) % 5]!));
  const trunks = [...verts, ...mids];
  trunks.forEach((p, i) => {
    const n = i + 1;
    const dia = TRUNK_DIA[i] ?? 500;
    push({
      id: `elia-${n}`,
      kind: "column",
      layerId: "cols",
      name: `Ελιά ${n}`,
      c: p,
      width: dia,
      depth: dia,
      height: SOFFIT,
      rotation: 0,
      material: "Olive trunk",
    });
    push({ id: `elia-ring-${n}`, kind: "circle", layerId: "cols", c: p, r: dia / 2 });
    push({
      id: `elia-stn-${n}`,
      kind: "survey",
      layerId: "site",
      name: `E${n}`,
      e: p.x,
      n: p.y,
      z: 0,
      code: `E${n}`,
      desc: `Κορμός ελιάς Ø ${dia} mm · κορυφή πενταγώνου`,
    });
  });

  verts.forEach((v, i) => {
    const n = verts[(i + 1) % 5]!;
    const m = mids[i]!;
    push(beam(`side-a-${i}`, v.x, v.y, m.x, m.y, 220, OLIVE_D, SOFFIT + OLIVE_D, "Pine beam 6m"));
    push(beam(`side-b-${i}`, m.x, m.y, n.x, n.y, 220, OLIVE_D, SOFFIT + OLIVE_D, "Pine beam 6m"));
  });

  push({
    id: "penta",
    kind: "polyline",
    layerId: "walls",
    name: "Κανονικό πεντάγωνο",
    closed: true,
    points: verts,
  });
  push({
    id: "deck",
    kind: "slab",
    layerId: "slabs",
    name: "Ταβανοδάπεδο ραμποτέ 20×200",
    material: "Rabote deck",
    thickness: 20,
    elevation: DECK_TOP,
    points: verts,
  });

  const north = verts[0]!;
  push({
    id: "jacuzzi",
    kind: "slab",
    layerId: "slabs",
    name: "Τζακούζι 2.20×2.20",
    material: "Jacuzzi",
    thickness: 750,
    elevation: DECK_TOP + 750,
    points: [
      { x: north.x - 1100, y: north.y - 3600 },
      { x: north.x + 1100, y: north.y - 3600 },
      { x: north.x + 1100, y: north.y - 1400 },
      { x: north.x - 1100, y: north.y - 1400 },
    ],
  });
  const southMid = mids.reduce((a, b) => (a.y < b.y ? a : b));
  push({
    id: "solar",
    kind: "slab",
    layerId: "slabs",
    name: "Ηλιακός θερμοσίφωνας",
    material: "Solar heater",
    thickness: 110,
    elevation: DECK_TOP + 110,
    points: [
      { x: southMid.x - 1100, y: southMid.y + 400 },
      { x: southMid.x + 1100, y: southMid.y + 400 },
      { x: southMid.x + 1100, y: southMid.y + 1800 },
      { x: southMid.x - 1100, y: southMid.y + 1800 },
    ],
  });
  for (let i = 0; i < 3; i++) {
    const x0 = southMid.x - 2800 + i * 1900;
    push({
      id: `pv-${i + 1}`,
      kind: "slab",
      layerId: "slabs",
      name: `Φωτοβολταϊκό ${i + 1}`,
      material: "PV panel",
      thickness: 40,
      elevation: DECK_TOP + 80,
      points: [
        { x: x0, y: southMid.y + 1900 },
        { x: x0 + 1720, y: southMid.y + 1900 },
        { x: x0 + 1720, y: southMid.y + 3040 },
        { x: x0, y: southMid.y + 3040 },
      ],
    });
  }

  const glass = (id: string, a: Pt, b: Pt) =>
    push({
      id,
      kind: "wall",
      layerId: "walls",
      name: id,
      a,
      b,
      thickness: 15,
      height: 2030,
      base: DECK_TOP,
      material: "Plexiglass",
      ifc: "IfcPlate",
    });
  verts.forEach((v, i) => {
    const n = verts[(i + 1) % 5]!;
    const south = mids[i]!.y === southMid.y;
    if (!south) {
      glass(`gl-${i}`, v, n);
      return;
    }
    glass(`gl-${i}a`, v, { x: v.x + (n.x - v.x) * 0.35, y: v.y + (n.y - v.y) * 0.35 });
    glass(`gl-${i}b`, { x: v.x + (n.x - v.x) * 0.65, y: v.y + (n.y - v.y) * 0.65 }, n);
  });

  const curtainPts = pentagon(R - 200);
  curtainPts.forEach((v, i) => {
    const n = curtainPts[(i + 1) % 5]!;
    push({
      id: `cu-${i}`,
      kind: "wall",
      layerId: "walls",
      name: `Κουρτίνα ${i + 1}`,
      a: v,
      b: n,
      thickness: 8,
      height: 2030,
      base: DECK_TOP,
      material: "Silver curtain",
      ifc: "IfcCovering",
    });
  });

  push({
    id: "room-live",
    kind: "room",
    layerId: "rooms",
    name: "Καθιστικό",
    occupancy: "Living on the pentagon deck",
    points: pentagon(R * 0.62),
  });

  push({ id: "dim-side", kind: "dim", layerId: "dims", a: verts[2]!, b: mids[2]!, offset: 1400 });
  push({ id: "dim-side-2", kind: "dim", layerId: "dims", a: mids[2]!, b: verts[3]!, offset: 1400 });

  const sideM = SIDE / 1000;
  const radiusM = R / 1000;
  const lines: [number, number, number, string][] = [
    [-R - 500, -R - 1800, 240, "ΔΕΝΤΡΟΣΠΙΤΟ · ΚΑΝΟΝΙΚΟ ΠΕΝΤΑΓΩΝΟ · Κ.Μ. 257"],
    [-R - 500, -R - 2300, 150, `Πλευρά ${sideM.toFixed(2)} m = δύο δοκοί των 6,00 m. Ακτίνα ${radiusM.toFixed(2)} m. Εσωτερική γωνία 108°.`],
    [-R - 500, -R - 2750, 140, "Κέντρο ΕΓΣΑ ’87  Ε 878647,887   Ν 4034931,433  ·  36,38752° Β  28,22250° Α"],
    [-R - 500, -R - 3150, 140, "Δέκα ελιές: πέντε στις κορυφές, πέντε στη μέση κάθε πλευράς. Κάθαρση 2,00 m."],
    [-R - 500, -R - 3550, 140, "Ραμποτέ 20×200 στο πεντάγωνο. Πλέξιγκλας στις πλευρές, ασημί κουρτίνα από μέσα."],
    [-R - 500, -R - 3950, 140, "Τζακούζι στη βόρεια κορυφή. Ηλιακός και φωτοβολταϊκά προς το νότιο όριο."],
  ];
  lines.forEach(([x, y, size, text], i) => {
    push({ id: `note-${i}`, kind: "text", layerId: "notes", p: { x, y }, text, size, rotation: 0 });
  });

  return {
    id: "olive-treehouse-marmarades",
    name: "Δεντρόσπιτο Μαρμαράδες",
    discipline: "architecture",
    units: "m",
    description:
      "Regular pentagon, side 12 m as two 6 m beams, on ten olive trunks at the centre of the Marmarades field. Rabote deck, plexiglass, silver curtains, jacuzzi, solar heater, PV.",
    layers: defaultLayers("architecture"),
    entities,
    wallHeight: 2030,
    wallThickness: 15,
    gridSize: 400,
  };
}
