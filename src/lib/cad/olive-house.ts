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

export function sampleOliveTreehouse(frame: "timber" | "iron" = "timber"): Project {
  const iron = frame === "iron";
  const beamDepth = iron ? 210 : OLIVE_D;
  const beamBreadth = 220;
  const deckThick = iron ? 8 : 20;
  const deckTop = SOFFIT + beamDepth + deckThick;
  const storyH = 2100;
  const roofSoffit = deckTop + storyH;
  const roofTop = roofSoffit + beamDepth + deckThick;
  const roomR = R * 0.68;
  const beamName = iron ? "HEA 220 S235" : "Pine beam 6m";
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
    if (iron) {
      push({
        id: `col-${n}`,
        kind: "column",
        layerId: "cols",
        name: `Κολόνα Η ${n}`,
        c: p,
        width: 220,
        depth: 210,
        height: SOFFIT,
        rotation: i < 5 ? (Math.PI / 2 + i * (2 * Math.PI) / 5) : 0,
        material: "HEA 220 column",
      });
      push({
        id: `plate-${n}`,
        kind: "rect",
        layerId: "cols",
        a: { x: p.x - 280, y: p.y - 280 },
        b: { x: p.x + 280, y: p.y + 280 },
      });
      push({
        id: `col-stn-${n}`,
        kind: "survey",
        layerId: "site",
        name: `H${n}`,
        e: p.x,
        n: p.y,
        z: 0,
        code: `H${n}`,
        desc: "HEA 220 στο πέλμα, ως το κατάστρωμα. Όχι εμπήξιμο.",
      });
      return;
    }
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
    push(beam(`side-a-${i}`, v.x, v.y, m.x, m.y, beamBreadth, beamDepth, SOFFIT + beamDepth, beamName));
    push(beam(`side-b-${i}`, m.x, m.y, n.x, n.y, beamBreadth, beamDepth, SOFFIT + beamDepth, beamName));
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
    name: iron ? "Λαμαρίνα δαπέδου" : "Ταβανοδάπεδο ραμποτέ 20×200",
    material: iron ? "Iron sheet" : "Rabote deck",
    thickness: deckThick,
    elevation: deckTop,
    points: verts,
  });

  const north = verts[0]!;
  const southMid = mids.reduce((a, b) => (a.y < b.y ? a : b));
  const shell = iron ? pentagon(roomR) : verts;
  const shellNorth = shell[0]!;
  const shellSouth = shell.reduce((a, b) => (a.y < b.y ? a : b));
  const equip = iron ? roofTop : deckTop;

  if (iron) {
    shell.forEach((p, i) => {
      push({
        id: `up-${i + 1}`,
        kind: "column",
        layerId: "cols",
        name: `Κολόνα ορόφου ${i + 1}`,
        c: p,
        width: 220,
        depth: 210,
        height: roofSoffit,
        rotation: Math.PI / 2 + (i * 2 * Math.PI) / 5,
        material: "HEA 220 column",
      });
      const n = shell[(i + 1) % 5]!;
      push(beam(`roof-${i}`, p.x, p.y, n.x, n.y, beamBreadth, beamDepth, roofSoffit + beamDepth, beamName));
    });
    push({
      id: "roof",
      kind: "slab",
      layerId: "slabs",
      name: "Λαμαρίνα στέγης",
      material: "Iron sheet roof",
      thickness: deckThick,
      elevation: roofTop,
      points: shell,
    });
    push({
      id: "room-ring",
      kind: "polyline",
      layerId: "walls",
      name: "Πεντάγωνο ορόφου",
      closed: true,
      points: shell,
    });
  }

  push({
    id: "jacuzzi",
    kind: "slab",
    layerId: "slabs",
    name: "Τζακούζι 2.20×2.20",
    material: "Jacuzzi",
    thickness: 750,
    elevation: equip + 750,
    points: [
      { x: shellNorth.x - 1100, y: shellNorth.y - 3600 },
      { x: shellNorth.x + 1100, y: shellNorth.y - 3600 },
      { x: shellNorth.x + 1100, y: shellNorth.y - 1400 },
      { x: shellNorth.x - 1100, y: shellNorth.y - 1400 },
    ],
  });
  push({
    id: "solar",
    kind: "slab",
    layerId: "slabs",
    name: "Ηλιακός θερμοσίφωνας",
    material: "Solar heater",
    thickness: 110,
    elevation: equip + 110,
    points: [
      { x: shellSouth.x - 1100, y: shellSouth.y + 400 },
      { x: shellSouth.x + 1100, y: shellSouth.y + 400 },
      { x: shellSouth.x + 1100, y: shellSouth.y + 1800 },
      { x: shellSouth.x - 1100, y: shellSouth.y + 1800 },
    ],
  });
  for (let i = 0; i < 3; i++) {
    const x0 = shellSouth.x - 2800 + i * 1900;
    push({
      id: `pv-${i + 1}`,
      kind: "slab",
      layerId: "slabs",
      name: `Φωτοβολταϊκό ${i + 1}`,
      material: "PV panel",
      thickness: 40,
      elevation: equip + 80,
      points: [
        { x: x0, y: shellSouth.y + 1900 },
        { x: x0 + 1720, y: shellSouth.y + 1900 },
        { x: x0 + 1720, y: shellSouth.y + 3040 },
        { x: x0, y: shellSouth.y + 3040 },
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
      height: iron ? storyH : 2030,
      base: deckTop,
      material: "Plexiglass",
      ifc: "IfcPlate",
    });
  shell.forEach((v, i) => {
    const n = shell[(i + 1) % 5]!;
    const mid = midway(v, n);
    const south = !iron && mid.y === southMid.y;
    if (!south) {
      glass(`gl-${i}`, v, n);
      return;
    }
    glass(`gl-${i}a`, v, { x: v.x + (n.x - v.x) * 0.35, y: v.y + (n.y - v.y) * 0.35 });
    glass(`gl-${i}b`, { x: v.x + (n.x - v.x) * 0.65, y: v.y + (n.y - v.y) * 0.65 }, n);
  });

  const curtainPts = pentagon(iron ? roomR - 200 : R - 200);
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
      height: iron ? storyH : 2030,
      base: deckTop,
      material: "Silver curtain",
      ifc: "IfcCovering",
    });
  });

  push({
    id: "room-live",
    kind: "room",
    layerId: "rooms",
    name: "Καθιστικό",
    occupancy: iron ? "Upper room of the iron treehouse" : "Living on the pentagon deck",
    points: pentagon(iron ? roomR * 0.72 : R * 0.62),
  });

  push({ id: "dim-side", kind: "dim", layerId: "dims", a: verts[2]!, b: mids[2]!, offset: 1400 });
  push({ id: "dim-side-2", kind: "dim", layerId: "dims", a: mids[2]!, b: verts[3]!, offset: 1400 });

  const sideM = SIDE / 1000;
  const radiusM = R / 1000;
  const lines: [number, number, number, string][] = iron
    ? [
        [-R - 500, -R - 1800, 280, "ΣΙΔΕΡΕΝΙΟ ΔΙΩΡΟΦΟ ΔΕΝΤΡΟΣΠΙΤΟ"],
        [-R - 500, -R - 2300, 150, "Ίδια γεωμετρία με το ξύλινο. Πεντάγωνο 12,00 m. Εσωτερική γωνία 108°."],
        [-R - 500, -R - 2750, 140, "Κάτω: ανοιχτό κατάστρωμα από λαμαρίνα, σε δοκούς ΗΕΑ 220. Κάθαρση 2,00 m."],
        [-R - 500, -R - 3150, 140, "Πάνω: γυάλινος όροφος με ασημί κουρτίνα. Στέγη από λαμαρίνα."],
        [-R - 500, -R - 3550, 140, "Στη στέγη: τζακούζι, ηλιακός, φωτοβολταϊκά. Πέλμα 560×560. Όχι εμπήξιμο."],
        [-R - 500, -R - 3950, 140, "Κέντρο ΕΓΣΑ ’87  Ε 878647,887   Ν 4034931,433  ·  36,38752° Β  28,22250° Α"],
      ]
    : [
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

  if (iron) {
    const x0 = R + 4500;
    const ground = -1500;
    const head = ground + SOFFIT;
    const floorY = head + beamDepth;
    const roomHead = floorY + storyH;
    const roofY = roomHead + beamDepth;
    const span = 6000;
    const line = (id: string, a: Pt, b: Pt) => push({ id, kind: "line", layerId: "dims", a, b });
    line("elev-ground", { x: x0 - 1800, y: ground }, { x: x0 + span + 1800, y: ground });
    for (const x of [x0, x0 + span]) {
      line(`elev-web-${x}`, { x, y: ground }, { x, y: roofY });
      line(`elev-fl-a-${x}`, { x: x - 110, y: ground }, { x: x - 110, y: roofY });
      line(`elev-fl-b-${x}`, { x: x + 110, y: ground }, { x: x + 110, y: roofY });
    }
    line("elev-floor-bot", { x: x0 - 110, y: head }, { x: x0 + span + 110, y: head });
    line("elev-floor-top", { x: x0 - 110, y: floorY }, { x: x0 + span + 110, y: floorY });
    line("elev-roof-bot", { x: x0 + 900, y: roomHead }, { x: x0 + span - 900, y: roomHead });
    line("elev-roof-top", { x: x0 + 900, y: roofY }, { x: x0 + span - 900, y: roofY });
    line("elev-glass-a", { x: x0 + 900, y: floorY }, { x: x0 + 900, y: roomHead });
    line("elev-glass-b", { x: x0 + span - 900, y: floorY }, { x: x0 + span - 900, y: roomHead });
    push({ id: "elev-plate-1", kind: "rect", layerId: "cols", a: { x: x0 - 280, y: ground - 20 }, b: { x: x0 + 280, y: ground + 16 } });
    push({ id: "elev-plate-2", kind: "rect", layerId: "cols", a: { x: x0 + span - 280, y: ground - 20 }, b: { x: x0 + span + 280, y: ground + 16 } });
    push({ id: "elev-title", kind: "text", layerId: "notes", p: { x: x0 - 400, y: roofY + 900 }, text: "ΟΨΗ · διώροφο σιδερένιο δεντρόσπιτο", size: 180, rotation: 0 });
    push({ id: "elev-note", kind: "text", layerId: "notes", p: { x: x0 - 400, y: ground - 500 }, text: "Πέλμα στο έδαφος. Κατάστρωμα στα 2,00 m. Όροφος από πάνω.", size: 140, rotation: 0 });
    push({ id: "elev-dim-h", kind: "dim", layerId: "dims", a: { x: x0 - 900, y: ground }, b: { x: x0 - 900, y: head }, offset: 0 });
    push({ id: "elev-dim-s", kind: "dim", layerId: "dims", a: { x: x0 + span + 900, y: floorY }, b: { x: x0 + span + 900, y: roomHead }, offset: 0 });
  }

  return {
    id: iron ? "iron-two-storey-treehouse" : "olive-treehouse-marmarades",
    name: iron ? "Σιδερένιο διώροφο δεντρόσπιτο" : "Δεντρόσπιτο Μαρμαράδες",
    discipline: "architecture",
    units: "m",
    description: iron
      ? "Iron edition of the two-storey pentagon treehouse. Open iron-sheet deck on HEA 220, glass room and iron roof above, jacuzzi on the roof. Columns on base plates, not driven into the ground."
      : "Regular pentagon, side 12 m as two 6 m beams, on ten olive trunks at the centre of the Marmarades field. Rabote deck, plexiglass, silver curtains, jacuzzi, solar heater, PV.",
    layers: defaultLayers("architecture"),
    entities,
    wallHeight: 2030,
    wallThickness: 15,
    gridSize: 400,
  };
}
