import type { BBox, Entity, OpeningEnt, Pt, Project, SnapConfig, SnapHit, WallEnt } from "./types";

export const EPS = 1e-7;

export function nid(prefix = "e"): string {
  const a = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${a.replace(/-/g, "").slice(0, 10)}`;
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function mid(a: Pt, b: Pt): Pt {
  return lerp(a, b, 0.5);
}

export function norm(a: Pt, b: Pt): Pt {
  const len = dist(a, b) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

export function perp(v: Pt): Pt {
  return { x: -v.y, y: v.x };
}

export function scale(v: Pt, s: number): Pt {
  return { x: v.x * s, y: v.y * s };
}

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function closestOnSeg(p: Pt, a: Pt, b: Pt): { pt: Pt; t: number; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return { pt: { ...a }, t: 0, d: dist(p, a) };
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  const pt = { x: a.x + dx * t, y: a.y + dy * t };
  return { pt, t, d: dist(p, pt) };
}

export function segIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const det = dax * dby - day * dbx;
  if (Math.abs(det) < EPS) return null;
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / det;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / det;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}

export function polygonArea(pts: Pt[]): number {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(pts: Pt[]): Pt {
  if (!pts.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function rectCorners(a: Pt, b: Pt): Pt[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

export function pointInPoly(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    const hit =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y + EPS) + pi.x;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Azimuth in degrees, 0 = North, clockwise — survey convention. */
export function azimuthDeg(from: Pt, to: Pt): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function formatDms(deg: number): string {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${d}°${String(m).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0")}"`;
}

export function wallQuad(w: WallEnt): Pt[] {
  const n = perp(norm(w.a, w.b));
  const h = w.thickness / 2;
  const o1 = scale(n, h);
  const o2 = scale(n, -h);
  return [add(w.a, o1), add(w.b, o1), add(w.b, o2), add(w.a, o2)];
}

export function wallLength(w: WallEnt): number {
  return dist(w.a, w.b);
}

export function openingOnWall(
  wall: WallEnt,
  opening: OpeningEnt,
): { a: Pt; b: Pt; dir: Pt; n: Pt } {
  const len = wallLength(wall);
  const t0 = clamp(opening.offset / (len || 1), 0, 1);
  const t1 = clamp((opening.offset + opening.width) / (len || 1), 0, 1);
  const a = lerp(wall.a, wall.b, t0);
  const b = lerp(wall.a, wall.b, t1);
  const dir = norm(wall.a, wall.b);
  return { a, b, dir, n: perp(dir) };
}

export function emptyBBox(): BBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function expandBBox(box: BBox, p: Pt, pad = 0): void {
  box.minX = Math.min(box.minX, p.x - pad);
  box.minY = Math.min(box.minY, p.y - pad);
  box.maxX = Math.max(box.maxX, p.x + pad);
  box.maxY = Math.max(box.maxY, p.y + pad);
}

export function entityPoints(e: Entity): Pt[] {
  switch (e.kind) {
    case "wall":
    case "line":
    case "dim":
      return [e.a, e.b];
    case "rect":
      return rectCorners(e.a, e.b);
    case "circle":
      return [
        { x: e.c.x - e.r, y: e.c.y },
        { x: e.c.x + e.r, y: e.c.y },
        { x: e.c.x, y: e.c.y - e.r },
        { x: e.c.x, y: e.c.y + e.r },
      ];
    case "column":
      return [e.c];
    case "slab":
    case "room":
    case "polyline":
      return e.points;
    case "text":
      return [e.p];
    case "survey":
      return [{ x: e.e, y: e.n }];
    case "door":
    case "window":
      return [];
    default:
      return [];
  }
}

export function projectExtents(project: Project): BBox | null {
  const box = emptyBBox();
  let any = false;
  for (const e of project.entities) {
    const layer = project.layers.find((l) => l.id === e.layerId);
    if (layer && !layer.visible) continue;
    for (const p of entityPoints(e)) {
      expandBBox(box, p, e.kind === "circle" ? 0 : 0);
      any = true;
    }
    if (e.kind === "wall") {
      for (const p of wallQuad(e)) expandBBox(box, p);
    }
  }
  if (!any || !Number.isFinite(box.minX)) return null;
  const dx = box.maxX - box.minX;
  const dy = box.maxY - box.minY;
  const pad = Math.max(800, Math.max(dx, dy) * 0.08);
  expandBBox(box, { x: box.minX, y: box.minY }, pad);
  expandBBox(box, { x: box.maxX, y: box.maxY }, pad);
  return box;
}

export function segmentsOf(e: Entity): [Pt, Pt][] {
  switch (e.kind) {
    case "wall":
    case "line":
    case "dim":
      return [[e.a, e.b]];
    case "rect": {
      const c = rectCorners(e.a, e.b);
      return [
        [c[0]!, c[1]!],
        [c[1]!, c[2]!],
        [c[2]!, c[3]!],
        [c[3]!, c[0]!],
      ];
    }
    case "polyline": {
      const segs: [Pt, Pt][] = [];
      for (let i = 0; i < e.points.length - 1; i++) segs.push([e.points[i]!, e.points[i + 1]!]);
      if (e.closed && e.points.length > 2) segs.push([e.points[e.points.length - 1]!, e.points[0]!]);
      return segs;
    }
    case "room":
    case "slab": {
      const segs: [Pt, Pt][] = [];
      for (let i = 0; i < e.points.length; i++) {
        segs.push([e.points[i]!, e.points[(i + 1) % e.points.length]!]);
      }
      return segs;
    }
    default:
      return [];
  }
}

export function pickEntity(project: Project, world: Pt, tol: number): Entity | null {
  let bestE: Entity | null = null;
  let bestD = Infinity;
  const consider = (e: Entity, d: number) => {
    if (d <= tol && d < bestD) {
      bestE = e;
      bestD = d;
    }
  };
  for (const e of project.entities) {
    const layer = project.layers.find((l) => l.id === e.layerId);
    if (layer && (!layer.visible || layer.locked)) continue;
    if (e.kind === "survey") {
      consider(e, dist(world, { x: e.e, y: e.n }));
      continue;
    }
    if (e.kind === "circle") {
      consider(e, Math.abs(dist(world, e.c) - e.r));
      consider(e, dist(world, e.c));
      continue;
    }
    if (e.kind === "column") {
      consider(e, dist(world, e.c));
      continue;
    }
    if (e.kind === "text") {
      consider(e, dist(world, e.p));
      continue;
    }
    if (e.kind === "room") {
      if (pointInPoly(world, e.points)) consider(e, 0);
      continue;
    }
    if (e.kind === "door" || e.kind === "window") {
      const wall = project.entities.find((x) => x.id === e.wallId && x.kind === "wall") as
        | WallEnt
        | undefined;
      if (!wall) continue;
      const on = openingOnWall(wall, e);
      consider(e, closestOnSeg(world, on.a, on.b).d);
      continue;
    }
    for (const [a, b] of segmentsOf(e)) {
      consider(e, closestOnSeg(world, a, b).d);
    }
    if (e.kind === "wall") {
      if (pointInPoly(world, wallQuad(e))) consider(e, 0);
    }
  }
    return bestE;
}

export function findSnap(
  world: Pt,
  project: Project,
  snap: SnapConfig,
  gridSize: number,
  tol: number,
  extra: Pt[] = [],
): SnapHit | null {
  type Rank = SnapHit["type"];
  const rank: Record<Rank, number> = {
    end: 0,
    int: 1,
    mid: 2,
    center: 3,
    perp: 4,
    near: 5,
    grid: 6,
  };
  let best: (SnapHit & { d: number }) | null = null;
  const consider = (pt: Pt, type: Rank) => {
    const d = dist(world, pt);
    if (d > tol) return;
    if (!best || rank[type] < rank[best.type] || (rank[type] === rank[best.type] && d < best.d)) {
      best = { pt, type, d };
    }
  };

  for (const p of extra) consider(p, "end");

  const segs: [Pt, Pt][] = [];
  for (const e of project.entities) {
    const layer = project.layers.find((l) => l.id === e.layerId);
    if (layer && !layer.visible) continue;
    if (e.kind === "survey" && snap.end) consider({ x: e.e, y: e.n }, "end");
    if (e.kind === "circle" && snap.center) consider(e.c, "center");
    if (e.kind === "column" && snap.center) consider(e.c, "center");
    if (e.kind === "text" && snap.end) consider(e.p, "end");
    const s = segmentsOf(e);
    for (const seg of s) {
      segs.push(seg);
      if (snap.end) {
        consider(seg[0], "end");
        consider(seg[1], "end");
      }
      if (snap.mid) consider(mid(seg[0], seg[1]), "mid");
    }
    if (e.kind === "rect" && snap.center) consider(mid(e.a, e.b), "center");
    if ((e.kind === "room" || e.kind === "slab") && snap.center) {
      consider(polygonCentroid(e.points), "center");
    }
  }

  if (snap.int) {
    const n = Math.min(segs.length, 80);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const hit = segIntersect(segs[i]![0], segs[i]![1], segs[j]![0], segs[j]![1]);
        if (hit) consider(hit, "int");
      }
    }
  }

  if (snap.grid && gridSize > 0) {
    consider(
      {
        x: Math.round(world.x / gridSize) * gridSize,
        y: Math.round(world.y / gridSize) * gridSize,
      },
      "grid",
    );
  }

  return best;
}

export function applyOrtho(origin: Pt, p: Pt): Pt {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: p.x, y: origin.y };
  return { x: origin.x, y: p.y };
}

export function gridStepForZoom(zoom: number): number {
  const px = 14;
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  for (const g of candidates) {
    if (g * zoom >= px) return g;
  }
  return 100000;
}

export function cloneProject(p: Project): Project {
  return structuredClone(p);
}

export function defaultLayers(discipline: import("./types").Discipline): import("./types").Layer[] {
  const mk = (id: string, name: string, color: string): import("./types").Layer => ({
    id,
    name,
    visible: true,
    locked: false,
    color,
  });
  if (discipline === "mechanical") {
    return [
      mk("outline", "Outline", "#c5cdc6"),
      mk("holes", "Holes", "#8aa0a8"),
      mk("dims", "Dimensions", "#9aafa8"),
      mk("notes", "Notes", "#b8c4bc"),
    ];
  }
  if (discipline === "survey") {
    return [
      mk("control", "Control", "#b8c4bc"),
      mk("traverse", "Traverse", "#8aa0a8"),
      mk("site", "Site", "#6a7a72"),
      mk("dims", "Dimensions", "#9aafa8"),
      mk("notes", "Notes", "#b8c4bc"),
    ];
  }
  return [
    mk("walls", "Walls", "#c5cdc6"),
    mk("openings", "Openings", "#8aa0c0"),
    mk("slabs", "Slabs", "#6a7a72"),
    mk("rooms", "Rooms", "#4a5a52"),
    mk("cols", "Columns", "#a8b0aa"),
    mk("dims", "Dimensions", "#9aafa8"),
    mk("notes", "Notes", "#b8c4bc"),
    mk("site", "Site", "#6a7a72"),
  ];
}
