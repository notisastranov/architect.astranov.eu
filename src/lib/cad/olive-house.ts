import { defaultLayers } from "./geometry";
import type { Entity, Project, Pt } from "./types";

/** Centre-to-centre bay. Stock beam, no splice. */
const BAY = 6000;
const XS = [-9000, -3000, 3000, 9000];
const YS = [-6000, 0, 6000];

/**
 * Clear soffit of the olive beams. The deck lands on the trunks.
 * Walking surface is soffit + 420 beam + 20 rabote = 2440 mm.
 */
const SOFFIT = 2000;
const OLIVE_D = 420;
const GIRDER_D = 360;
const JOIST_D = 100;
const DECK_TOP = SOFFIT + OLIVE_D + 20;

const TRUNKS: [number, number, number][] = [
  [-9000, -6000, 520],
  [-3000, -6000, 440],
  [3000, -6000, 610],
  [9000, -6000, 480],
  [-9000, 0, 560],
  [-3000, 0, 420],
  [3000, 0, 500],
  [9000, 0, 450],
  [-9000, 6000, 490],
  [-3000, 6000, 580],
  [3000, 6000, 430],
  [9000, 6000, 540],
];

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

  TRUNKS.forEach(([x, y, dia], i) => {
    const n = i + 1;
    push({
      id: `elia-${n}`,
      kind: "column",
      layerId: "cols",
      name: `Ελιά ${n}`,
      c: { x, y },
      width: dia,
      depth: dia,
      height: SOFFIT,
      rotation: 0,
      material: "Olive trunk",
    });
    push({ id: `elia-ring-${n}`, kind: "circle", layerId: "cols", c: { x, y }, r: dia / 2 });
    push({
      id: `elia-stn-${n}`,
      kind: "survey",
      layerId: "site",
      name: `E${n}`,
      e: x,
      n: y,
      z: 0,
      code: `E${n}`,
      desc: `Κορμός ελιάς Ø ${dia} mm · κολόνα`,
    });
  });

  for (const y of YS) {
    for (let i = 0; i < XS.length - 1; i++) {
      push(beam(`bx-${y}-${i}`, XS[i]!, y, XS[i + 1]!, y, 220, OLIVE_D, SOFFIT + OLIVE_D, "Pine beam 6m"));
    }
  }
  for (const x of XS) {
    for (let i = 0; i < YS.length - 1; i++) {
      push(beam(`by-${x}-${i}`, x, YS[i]!, x, YS[i + 1]!, 220, OLIVE_D, SOFFIT + OLIVE_D, "Pine beam 6m"));
    }
  }
  for (const y of [-4000, -2000, 2000, 4000]) {
    for (let i = 0; i < XS.length - 1; i++) {
      push(beam(`gx-${y}-${i}`, XS[i]!, y, XS[i + 1]!, y, 140, GIRDER_D, SOFFIT + OLIVE_D, "Pine girder 6m"));
    }
  }

  for (let x = -9000; x <= -3000; x += 400) {
    push(beam(`joist-${x}`, x, -6000, x, -4000, 50, JOIST_D, SOFFIT + OLIVE_D, "Pine joist"));
  }

  push({
    id: "deck",
    kind: "slab",
    layerId: "slabs",
    name: "Ταβανοδάπεδο ραμποτέ 20×200",
    material: "Rabote deck",
    thickness: 20,
    elevation: DECK_TOP,
    points: [
      { x: -9000, y: -6000 },
      { x: 9000, y: -6000 },
      { x: 9000, y: 6000 },
      { x: -9000, y: 6000 },
    ],
  });

  push({
    id: "jacuzzi",
    kind: "slab",
    layerId: "slabs",
    name: "Τζακούζι 2.20×2.20",
    material: "Jacuzzi",
    thickness: 750,
    elevation: DECK_TOP + 750,
    points: [
      { x: 6200, y: 3200 },
      { x: 8400, y: 3200 },
      { x: 8400, y: 5400 },
      { x: 6200, y: 5400 },
    ],
  });
  push({
    id: "solar",
    kind: "slab",
    layerId: "slabs",
    name: "Ηλιακός θερμοσίφωνας",
    material: "Solar heater",
    thickness: 110,
    elevation: DECK_TOP + 110,
    points: [
      { x: -800, y: -5400 },
      { x: 1400, y: -5400 },
      { x: 1400, y: -4000 },
      { x: -800, y: -4000 },
    ],
  });
  for (let i = 0; i < 4; i++) {
    const x0 = -8600 + i * 1900;
    push({
      id: `pv-${i + 1}`,
      kind: "slab",
      layerId: "slabs",
      name: `Φωτοβολταϊκό ${i + 1}`,
      material: "PV panel",
      thickness: 40,
      elevation: DECK_TOP + 80,
      points: [
        { x: x0, y: -5300 },
        { x: x0 + 1720, y: -5300 },
        { x: x0 + 1720, y: -4160 },
        { x: x0, y: -4160 },
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
  glass("gl-s1", { x: -9000, y: -6000 }, { x: -700, y: -6000 });
  glass("gl-s2", { x: 700, y: -6000 }, { x: 9000, y: -6000 });
  glass("gl-n", { x: 9000, y: 6000 }, { x: -9000, y: 6000 });
  glass("gl-w", { x: -9000, y: 6000 }, { x: -9000, y: -6000 });
  glass("gl-e", { x: 9000, y: -6000 }, { x: 9000, y: 6000 });

  const curtain = (id: string, a: Pt, b: Pt) =>
    push({
      id,
      kind: "wall",
      layerId: "walls",
      name: id,
      a,
      b,
      thickness: 8,
      height: 2030,
      base: DECK_TOP,
      material: "Silver curtain",
      ifc: "IfcCovering",
    });
  curtain("cu-s", { x: -8700, y: -5880 }, { x: 8700, y: -5880 });
  curtain("cu-n", { x: 8700, y: 5880 }, { x: -8700, y: 5880 });
  curtain("cu-w", { x: -8880, y: 5700 }, { x: -8880, y: -5700 });
  curtain("cu-e", { x: 8880, y: -5700 }, { x: 8880, y: 5700 });

  push({
    id: "room-live",
    kind: "room",
    layerId: "rooms",
    name: "Καθιστικό",
    occupancy: "Living on the deck",
    points: [
      { x: -8600, y: 400 },
      { x: -400, y: 400 },
      { x: -400, y: 5600 },
      { x: -8600, y: 5600 },
    ],
  });
  push({
    id: "room-sleep",
    kind: "room",
    layerId: "rooms",
    name: "Ύπνος",
    occupancy: "Sleeping",
    points: [
      { x: 400, y: 400 },
      { x: 5600, y: 400 },
      { x: 5600, y: 2800 },
      { x: 400, y: 2800 },
    ],
  });

  push({ id: "dim-len", kind: "dim", layerId: "dims", a: { x: -9000, y: -6000 }, b: { x: 9000, y: -6000 }, offset: -1600 });
  push({ id: "dim-wid", kind: "dim", layerId: "dims", a: { x: -9000, y: -6000 }, b: { x: -9000, y: 6000 }, offset: -1600 });
  push({ id: "dim-bay", kind: "dim", layerId: "dims", a: { x: -9000, y: -6000 }, b: { x: -3000, y: -6000 }, offset: -800 });
  push({ id: "dim-2m", kind: "dim", layerId: "dims", a: { x: -9000, y: -6000 }, b: { x: -9000, y: -4000 }, offset: -800 });
  push({ id: "dim-400", kind: "dim", layerId: "dims", a: { x: -9000, y: -4000 }, b: { x: -8600, y: -4000 }, offset: 350 });

  const lines: [number, number, number, string][] = [
    [-8800, -8600, 240, "ΔΕΝΤΡΟΣΠΙΤΟ · ΜΑΡΜΑΡΑΔΕΣ · ΚΕΝΤΡΟ ΧΩΡΑΦΙΟΥ"],
    [-8800, -9100, 150, "18,00 × 12,00 m · 3 × 2 φαντώματα των 6,00 m · 216 m² · 12 ελιές"],
    [-8800, -9550, 140, "Κάθαρση εδάφους 2,00 m ως το πέλμα. Η δοκός κάθεται κατευθείαν στον κορμό."],
    [-8800, -9950, 140, "Δοκός ελιάς 220×420×6000. Ενδιάμεση 140×360×6000 ανά 2,00 m. Και οι δύο είναι εξάμετρες."],
    [-8800, -10350, 140, "Δοκάρι 50×100 ανά 400 mm. Κόβεται 3 τεμάχια από κάθε εξάμετρο. Ραμποτέ 20×200, ωφέλιμο 185 mm."],
    [-8800, -10750, 140, "Πλέξιγκλας 15 mm, φύλλο 3050×2030, χωρίς παραγγελία. Ασημί κουρτίνα από μέσα. Όχι τοιχοποιία."],
    [-8800, -11150, 140, "Τζακούζι 2,20×2,20 σε διπλή δοκό. Ηλιακός νότια. Τέσσερα PV 1720×1134 νότια."],
    [-8800, -11550, 130, "Βέλος ραμποτέ στα 400 mm ≈ 0,1 mm. Βέλος 140×360 στα 6,00 m ≈ 14 mm (όριο L/300 = 20 mm)."],
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
      "18 × 12 m first floor on twelve olive trunks. 6 m beams, rabote 20 mm, plexiglass, silver curtains, jacuzzi, solar heater, PV. Centred on the Marmarades field.",
    layers: defaultLayers("architecture"),
    entities,
    wallHeight: 2030,
    wallThickness: 15,
    gridSize: BAY / 15,
  };
}
