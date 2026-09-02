import { dist, nid, polygonArea, rectCorners } from "./geometry";
import type { AiOp, Entity, OpeningEnt, Project, Pt, WallEnt } from "./types";

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length ? v : fallback;
}

function pt(op: AiOp, xKey: string, yKey: string): Pt {
  return { x: num(op[xKey]), y: num(op[yKey]) };
}

function layerOr(project: Project, want: string, fallback: string): string {
  if (project.layers.some((l) => l.id === want)) return want;
  if (project.layers.some((l) => l.id === fallback)) return fallback;
  return project.layers[0]?.id ?? "walls";
}

function findWall(project: Project, hint: unknown): WallEnt | undefined {
  const walls = project.entities.filter((e): e is WallEnt => e.kind === "wall");
  if (!walls.length) return undefined;
  if (typeof hint === "string") {
    const byId = walls.find((w) => w.id === hint || w.name?.toLowerCase() === hint.toLowerCase());
    if (byId) return byId;
    const key = hint.toLowerCase();
    const named: Record<string, (w: WallEnt) => boolean> = {
      south: (w) => Math.abs(w.a.y - w.b.y) < 1 && (w.a.y + w.b.y) / 2 <= bounds(walls).minY + 1,
      north: (w) => Math.abs(w.a.y - w.b.y) < 1 && (w.a.y + w.b.y) / 2 >= bounds(walls).maxY - 1,
      west: (w) => Math.abs(w.a.x - w.b.x) < 1 && (w.a.x + w.b.x) / 2 <= bounds(walls).minX + 1,
      east: (w) => Math.abs(w.a.x - w.b.x) < 1 && (w.a.x + w.b.x) / 2 >= bounds(walls).maxX - 1,
    };
    const pred = named[key];
    if (pred) return walls.find(pred);
  }
  return walls[0];
}

function bounds(walls: WallEnt[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  return { minX, minY, maxX, maxY };
}

export interface ApplyResult {
  project: Project;
  message: string;
  selected: string[];
}

export function applyOps(project: Project, ops: AiOp[]): ApplyResult {
  const next: Project = structuredClone(project);
  const selected: string[] = [];
  const notes: string[] = [];

  const push = (e: Entity) => {
    next.entities.push(e);
    selected.push(e.id);
    return e.id;
  };

  for (const raw of ops) {
    const op = str(raw.op, "").toLowerCase();
    if (!op) continue;

    if (op === "addwall" || op === "wall") {
      const e: WallEnt = {
        id: str(raw.id, nid("wall")),
        kind: "wall",
        layerId: layerOr(next, str(raw.layerId, "walls"), "outline"),
        name: str(raw.name) || undefined,
        a: pt(raw, "x1", "y1"),
        b: pt(raw, "x2", "y2"),
        thickness: num(raw.thickness, next.wallThickness || 200),
        height: num(raw.height, next.wallHeight || 3000),
        material: str(raw.material, "Brick"),
        ifc: "IfcWallStandardCase",
      };
      push(e);
      continue;
    }

    if (op === "addrectroom" || op === "rectroom" || op === "roomrect") {
      const x = num(raw.x);
      const y = num(raw.y);
      const w = num(raw.w, num(raw.width));
      const h = num(raw.h, num(raw.depth, num(raw.height)));
      const t = num(raw.thickness, next.wallThickness || 200);
      const wh = num(raw.wallHeight, next.wallHeight || 3000);
      const prefix = nid("rm");
      const pts = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      const names = ["South", "East", "North", "West"];
      for (let i = 0; i < 4; i++) {
        push({
          id: `${prefix}-w${i}`,
          kind: "wall",
          layerId: layerOr(next, "walls", "outline"),
          name: `${str(raw.name, "Room")} ${names[i]}`,
          a: pts[i]!,
          b: pts[(i + 1) % 4]!,
          thickness: t,
          height: wh,
          material: str(raw.material, "Brick"),
          ifc: "IfcWallStandardCase",
        });
      }
      const inset = t / 2 + 20;
      push({
        id: `${prefix}-space`,
        kind: "room",
        layerId: layerOr(next, "rooms", "notes"),
        name: str(raw.name, "Room"),
        occupancy: str(raw.occupancy, "Residential"),
        points: [
          { x: x + inset, y: y + inset },
          { x: x + w - inset, y: y + inset },
          { x: x + w - inset, y: y + h - inset },
          { x: x + inset, y: y + h - inset },
        ],
      });
      push({
        id: `${prefix}-slab`,
        kind: "slab",
        layerId: layerOr(next, "slabs", "outline"),
        name: `${str(raw.name, "Room")} slab`,
        points: pts,
        thickness: 180,
        elevation: 0,
        material: "Concrete",
      });
      notes.push(`Drew ${str(raw.name, "room")} ${w}×${h} mm.`);
      continue;
    }

    if (op === "adddoor" || op === "addwindow" || op === "door" || op === "window") {
      const kind = op.includes("window") || str(raw.kind) === "window" ? "window" : "door";
      const wall = findWall(next, raw.wallId ?? raw.wall ?? raw.side);
      if (!wall) {
        notes.push("No wall found for opening.");
        continue;
      }
      const e: OpeningEnt = {
        id: str(raw.id, nid(kind)),
        kind,
        layerId: layerOr(next, "openings", "holes"),
        name: str(raw.name) || undefined,
        wallId: wall.id,
        offset: num(raw.offset, 400),
        width: num(raw.width, kind === "door" ? 900 : 1200),
        height: num(raw.height, kind === "door" ? 2100 : 1400),
        sill: num(raw.sill, kind === "door" ? 0 : 900),
        swing: str(raw.swing, "left") === "right" ? "right" : "left",
      };
      push(e);
      continue;
    }

    if (op === "addrect" || op === "rect" || op === "plate") {
      push({
        id: str(raw.id, nid("rect")),
        kind: "rect",
        layerId: layerOr(next, str(raw.layerId, "outline"), "walls"),
        name: str(raw.name) || undefined,
        a: pt(raw, "x1", "y1"),
        b: pt(raw, "x2", "y2"),
        thickness: raw.thickness != null ? num(raw.thickness) : undefined,
      });
      continue;
    }

    if (op === "addcircle" || op === "circle" || op === "hole") {
      push({
        id: str(raw.id, nid("cir")),
        kind: "circle",
        layerId: layerOr(next, str(raw.layerId, "holes"), "openings"),
        name: str(raw.name) || undefined,
        c: { x: num(raw.x, num(raw.cx)), y: num(raw.y, num(raw.cy)) },
        r: num(raw.r, num(raw.radius, num(raw.diameter, 0) / 2)),
      });
      continue;
    }

    if (op === "addline" || op === "line") {
      push({
        id: str(raw.id, nid("ln")),
        kind: "line",
        layerId: layerOr(next, str(raw.layerId, "traverse"), "notes"),
        name: str(raw.name) || undefined,
        a: pt(raw, "x1", "y1"),
        b: pt(raw, "x2", "y2"),
      });
      continue;
    }

    if (op === "addcolumn" || op === "column") {
      push({
        id: str(raw.id, nid("col")),
        kind: "column",
        layerId: layerOr(next, "cols", "outline"),
        name: str(raw.name) || undefined,
        c: { x: num(raw.x), y: num(raw.y) },
        width: num(raw.width, 300),
        depth: num(raw.depth, 300),
        height: num(raw.height, next.wallHeight || 3000),
        rotation: num(raw.rotation),
        material: str(raw.material, "Concrete"),
      });
      continue;
    }

    if (op === "addsurvey" || op === "survey" || op === "point") {
      push({
        id: str(raw.id, nid("stn")),
        kind: "survey",
        layerId: layerOr(next, "control", "notes"),
        name: str(raw.code, str(raw.name, "STN")),
        e: num(raw.e, num(raw.x)),
        n: num(raw.n, num(raw.y)),
        z: num(raw.z),
        code: str(raw.code, str(raw.name, "STN")),
        desc: str(raw.desc, str(raw.description)),
      });
      continue;
    }

    if (op === "adddim" || op === "dim" || op === "dimension") {
      push({
        id: str(raw.id, nid("dim")),
        kind: "dim",
        layerId: layerOr(next, "dims", "notes"),
        a: pt(raw, "x1", "y1"),
        b: pt(raw, "x2", "y2"),
        offset: num(raw.offset, 400),
      });
      continue;
    }

    if (op === "addtext" || op === "text" || op === "note") {
      push({
        id: str(raw.id, nid("txt")),
        kind: "text",
        layerId: layerOr(next, "notes", "notes"),
        p: { x: num(raw.x), y: num(raw.y) },
        text: str(raw.text, str(raw.name, "Note")),
        size: num(raw.size, next.discipline === "mechanical" ? 5 : 250),
        rotation: num(raw.rotation),
      });
      continue;
    }

    if (op === "addroom" || op === "room") {
      const points = Array.isArray(raw.points)
        ? (raw.points as { x: number; y: number }[])
        : rectCorners(pt(raw, "x1", "y1"), pt(raw, "x2", "y2"));
      push({
        id: str(raw.id, nid("space")),
        kind: "room",
        layerId: layerOr(next, "rooms", "notes"),
        name: str(raw.name, "Room"),
        occupancy: str(raw.occupancy, "Residential"),
        points,
      });
      continue;
    }

    if (op === "delete" || op === "remove") {
      const ids = Array.isArray(raw.ids)
        ? (raw.ids as unknown[]).map(String)
        : raw.id
          ? [String(raw.id)]
          : [];
      next.entities = next.entities.filter((e) => !ids.includes(e.id));
      notes.push(`Removed ${ids.length} entit${ids.length === 1 ? "y" : "ies"}.`);
      continue;
    }

    if (op === "setproperty" || op === "update") {
      const id = str(raw.id);
      const e = next.entities.find((x) => x.id === id);
      if (!e) continue;
      const key = str(raw.key);
      if (key && key in e) {
        (e as unknown as Record<string, unknown>)[key] = raw.value;
      }
      continue;
    }

    if (op === "dimensionextents" || op === "dimall") {
      const walls = next.entities.filter((e): e is WallEnt => e.kind === "wall");
      for (const w of walls) {
        if (w.name?.startsWith("Partition")) continue;
        push({
          id: nid("dim"),
          kind: "dim",
          layerId: layerOr(next, "dims", "notes"),
          a: w.a,
          b: w.b,
          offset: 700,
        });
      }
      continue;
    }

    if (op === "query") {
      const kind = str(raw.kind, "summary");
      if (kind === "area") {
        const rooms = next.entities.filter((e) => e.kind === "room");
        const total = rooms.reduce((s, e) => (e.kind === "room" ? s + polygonArea(e.points) : s), 0);
        notes.push(`Floor area ${ (total / 1e6).toFixed(2) } m².`);
      }
      continue;
    }
  }

  if (!notes.length && selected.length) notes.push(`Added ${selected.length} entit${selected.length === 1 ? "y" : "ies"}.`);
  if (!notes.length) notes.push("No model changes.");
  return { project: next, message: notes.join(" "), selected };
}

export function measureLabel(a: Pt, b: Pt): { d: number; ang: number } {
  const d = dist(a, b);
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return { d, ang };
}
