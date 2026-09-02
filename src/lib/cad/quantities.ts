import { azimuthDeg, dist, polygonArea, wallLength } from "./geometry";
import type { Entity, Project, SurveyEnt, WallEnt } from "./types";
import { formatArea, formatMm, formatVol } from "./units";

export interface QtyRow {
  id: string;
  group: string;
  label: string;
  value: string;
  detail?: string;
}

export function quantities(project: Project): QtyRow[] {
  const rows: QtyRow[] = [];
  const walls = project.entities.filter((e): e is WallEnt => e.kind === "wall");
  let wallLen = 0;
  let wallVol = 0;
  let wallArea = 0;
  for (const w of walls) {
    const L = wallLength(w);
    wallLen += L;
    wallArea += L * w.height;
    wallVol += L * w.height * w.thickness;
  }
  if (walls.length) {
    rows.push({
      id: "walls-n",
      group: "Architecture",
      label: "Walls",
      value: String(walls.length),
      detail: "count",
    });
    rows.push({
      id: "walls-l",
      group: "Architecture",
      label: "Centreline length",
      value: formatMm(wallLen, project.units),
    });
    rows.push({
      id: "walls-a",
      group: "Architecture",
      label: "Wall face area",
      value: formatArea(wallArea, project.units),
    });
    rows.push({
      id: "walls-v",
      group: "Architecture",
      label: "Masonry volume",
      value: formatVol(wallVol, project.units),
    });
  }

  for (const r of project.entities.filter((e) => e.kind === "room")) {
    if (r.kind !== "room") continue;
    const a = polygonArea(r.points);
    rows.push({
      id: `room-${r.id}`,
      group: "Spaces",
      label: r.name ?? "Room",
      value: formatArea(a, project.units),
      detail: r.occupancy,
    });
  }

  const doors = project.entities.filter((e) => e.kind === "door");
  const windows = project.entities.filter((e) => e.kind === "window");
  if (doors.length) {
    rows.push({
      id: "doors",
      group: "Openings",
      label: "Doors",
      value: String(doors.length),
      detail: doors.map((d) => d.name ?? d.id).join(", "),
    });
  }
  if (windows.length) {
    rows.push({
      id: "windows",
      group: "Openings",
      label: "Windows",
      value: String(windows.length),
      detail: windows.map((d) => d.name ?? d.id).join(", "),
    });
  }

  const plates = project.entities.filter((e) => e.kind === "rect");
  const circles = project.entities.filter((e) => e.kind === "circle");
  for (const p of plates) {
    if (p.kind !== "rect") continue;
    const w = Math.abs(p.b.x - p.a.x);
    const h = Math.abs(p.b.y - p.a.y);
    const th = p.thickness ?? 0;
    rows.push({
      id: `plate-${p.id}`,
      group: "Mechanical",
      label: p.name ?? "Plate",
      value: `${formatMm(w, project.units)} × ${formatMm(h, project.units)}${th ? ` × ${formatMm(th, project.units)}` : ""}`,
    });
    if (th) {
      const vol = w * h * th;
      rows.push({
        id: `plate-v-${p.id}`,
        group: "Mechanical",
        label: "Stock volume",
        value: formatVol(vol, project.units),
      });
    }
  }
  for (const c of circles) {
    if (c.kind !== "circle") continue;
    rows.push({
      id: `hole-${c.id}`,
      group: "Mechanical",
      label: c.name ?? "Circle",
      value: `Ø ${formatMm(c.r * 2, project.units)}`,
    });
  }

  const surveys = project.entities.filter((e): e is SurveyEnt => e.kind === "survey");
  if (surveys.length) {
    rows.push({
      id: "stn",
      group: "Survey",
      label: "Stations",
      value: String(surveys.length),
    });
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of surveys) {
      minZ = Math.min(minZ, s.z);
      maxZ = Math.max(maxZ, s.z);
    }
    rows.push({
      id: "rel",
      group: "Survey",
      label: "Elevation range",
      value: `${formatMm(minZ, project.units)} – ${formatMm(maxZ, project.units)}`,
    });
  }

  const traverse = traverseStats(project);
  if (traverse) {
    rows.push({
      id: "trav-len",
      group: "Survey",
      label: "Traverse length",
      value: formatMm(traverse.length, project.units),
    });
    rows.push({
      id: "trav-mis",
      group: "Survey",
      label: "Linear misclosure",
      value: formatMm(traverse.misclosure, project.units),
      detail: traverse.closed ? "closed" : "open",
    });
  }

  rows.push({
    id: "ents",
    group: "Model",
    label: "Entities",
    value: String(project.entities.length),
  });

  return rows;
}

export function traverseStats(project: Project): { length: number; misclosure: number; closed: boolean } | null {
  const lines = project.entities.filter((e) => e.kind === "line" && e.layerId === "traverse");
  if (lines.length < 2) return null;
  let length = 0;
  for (const l of lines) {
    if (l.kind !== "line") continue;
    length += dist(l.a, l.b);
  }
  const surveys = project.entities.filter((e): e is SurveyEnt => e.kind === "survey");
  const stns = surveys.filter((s) => s.code.startsWith("STN"));
  if (stns.length < 3) return { length, misclosure: 0, closed: false };
  let sx = 0;
  let sy = 0;
  for (const l of lines) {
    if (l.kind !== "line") continue;
    sx += l.b.x - l.a.x;
    sy += l.b.y - l.a.y;
  }
  const mis = Math.hypot(sx, sy);
  return { length, misclosure: mis, closed: mis < 50 };
}

export function inverse(a: SurveyEnt, b: SurveyEnt) {
  const d = dist({ x: a.e, y: a.n }, { x: b.e, y: b.n });
  const az = azimuthDeg({ x: a.e, y: a.n }, { x: b.e, y: b.n });
  const dH = b.z - a.z;
  return { d, az, dH };
}

export function compactModel(project: Project): string {
  const bits: string[] = [];
  bits.push(`name=${project.name}; discipline=${project.discipline}; units=${project.units}`);
  bits.push(`defaults wallT=${project.wallThickness} wallH=${project.wallHeight} grid=${project.gridSize} (mm)`);
  for (const e of project.entities) {
    bits.push(summarize(e));
  }
  return bits.join("\n");
}

function summarize(e: Entity): string {
  switch (e.kind) {
    case "wall":
      return `WALL id=${e.id} name=${e.name ?? ""} (${e.a.x},${e.a.y})-(${e.b.x},${e.b.y}) t=${e.thickness} h=${e.height} mat=${e.material}`;
    case "door":
    case "window":
      return `${e.kind.toUpperCase()} id=${e.id} name=${e.name ?? ""} wall=${e.wallId} offset=${e.offset} w=${e.width} h=${e.height} sill=${e.sill}`;
    case "room":
      return `ROOM id=${e.id} name=${e.name ?? ""} pts=${e.points.map((p) => `${p.x},${p.y}`).join(" ")}`;
    case "rect":
      return `RECT id=${e.id} name=${e.name ?? ""} (${e.a.x},${e.a.y})-(${e.b.x},${e.b.y}) t=${e.thickness ?? ""}`;
    case "circle":
      return `CIRCLE id=${e.id} name=${e.name ?? ""} c=${e.c.x},${e.c.y} r=${e.r}`;
    case "survey":
      return `SURVEY id=${e.id} code=${e.code} E=${e.e} N=${e.n} Z=${e.z} ${e.desc}`;
    case "line":
      return `LINE id=${e.id} (${e.a.x},${e.a.y})-(${e.b.x},${e.b.y})`;
    case "dim":
      return `DIM id=${e.id} (${e.a.x},${e.a.y})-(${e.b.x},${e.b.y}) off=${e.offset}`;
    case "text":
      return `TEXT id=${e.id} @${e.p.x},${e.p.y} "${e.text}"`;
    case "column":
      return `COL id=${e.id} @${e.c.x},${e.c.y} ${e.width}x${e.depth} h=${e.height}`;
    case "slab":
      return `SLAB id=${e.id} name=${e.name ?? ""} t=${e.thickness}`;
    case "polyline":
      return `PLINE id=${e.id} n=${e.points.length} closed=${e.closed}`;
  }
}
