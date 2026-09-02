import {
  azimuthDeg,
  dist,
  formatDms,
  gridStepForZoom,
  lerp,
  mid,
  openingOnWall,
  polygonCentroid,
  polygonArea,
  perp,
  rectCorners,
  scale,
  wallQuad,
} from "./geometry";
import type { Entity, OpeningEnt, Project, Pt, SnapHit, WallEnt } from "./types";
import { formatMm, formatMmNum } from "./units";
import type { CadState } from "./store";

export interface Cam {
  x: number;
  y: number;
  zoom: number;
}

export interface Palette {
  grid: string;
  gridMajor: string;
  axis: string;
  geom: string;
  wall: string;
  fill: string;
  room: string;
  dim: string;
  select: string;
  snap: string;
  opening: string;
  survey: string;
  paper: string;
  fg: string;
  muted: string;
}

export function readPalette(el: HTMLElement): Palette {
  const s = getComputedStyle(el);
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    grid: v("--color-cad-grid", "#1a1e22"),
    gridMajor: v("--color-cad-grid-major", "#252b30"),
    axis: v("--color-cad-axis", "#4a5a62"),
    geom: v("--color-cad-geom", "#c5cdc6"),
    wall: v("--color-cad-wall", "#d2dad3"),
    fill: v("--color-cad-fill", "#1b2420"),
    room: v("--color-cad-room", "#24302a"),
    dim: v("--color-cad-dim", "#9aafa8"),
    select: v("--color-cad-select", "#f2f4f0"),
    snap: v("--color-cad-snap", "#7ec8c0"),
    opening: v("--color-cad-opening", "#8aa0c0"),
    survey: v("--color-cad-survey", "#c5cdc6"),
    paper: v("--color-cad-paper", "#0c0d0e"),
    fg: v("--color-fg", "#ecece8"),
    muted: v("--color-muted", "#8c9088"),
  };
}

export function worldToScreen(p: Pt, cam: Cam, w: number, h: number): Pt {
  return {
    x: (p.x - cam.x) * cam.zoom + w / 2,
    y: -(p.y - cam.y) * cam.zoom + h / 2,
  };
}

export function screenToWorld(p: Pt, cam: Cam, w: number, h: number): Pt {
  return {
    x: (p.x - w / 2) / cam.zoom + cam.x,
    y: -(p.y - h / 2) / cam.zoom + cam.y,
  };
}

function layerOf(project: Project, id: string) {
  return project.layers.find((l) => l.id === id);
}

function vis(project: Project, id: string) {
  const l = layerOf(project, id);
  return !l || l.visible;
}

function col(project: Project, e: Entity, pal: Palette) {
  return layerOf(project, e.layerId)?.color || pal.geom;
}

function pathPts(ctx: CanvasRenderingContext2D, pts: Pt[], cam: Cam, w: number, h: number, close = false) {
  if (!pts.length) return;
  const s0 = worldToScreen(pts[0]!, cam, w, h);
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < pts.length; i++) {
    const s = worldToScreen(pts[i]!, cam, w, h);
    ctx.lineTo(s.x, s.y);
  }
  if (close) ctx.closePath();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: Pick<CadState, "project" | "cam" | "selection" | "draft" | "snapHit" | "hover" | "ortho" | "units" | "tool">,
  pal: Palette,
) {
  const { project, cam, selection, draft, snapHit, hover, units } = state;
  ctx.save();
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, w, h);

  drawGrid(ctx, w, h, cam, pal);
  drawAxes(ctx, w, h, cam, pal);

  const selected = new Set(selection);

  for (const e of project.entities) {
    if (!vis(project, e.layerId)) continue;
    if (e.kind === "room" || e.kind === "slab") drawFilled(ctx, e, cam, w, h, pal, selected.has(e.id));
  }
  for (const e of project.entities) {
    if (!vis(project, e.layerId)) continue;
    if (e.kind === "wall") drawWall(ctx, e, project, cam, w, h, pal, selected.has(e.id));
  }
  for (const e of project.entities) {
    if (!vis(project, e.layerId)) continue;
    if (e.kind === "door" || e.kind === "window") {
      const wall = project.entities.find((x) => x.id === e.wallId && x.kind === "wall") as WallEnt | undefined;
      if (wall) drawOpening(ctx, e, wall, cam, w, h, pal, selected.has(e.id));
    }
  }
  for (const e of project.entities) {
    if (!vis(project, e.layerId)) continue;
    if (e.kind === "rect" || e.kind === "line" || e.kind === "polyline" || e.kind === "circle" || e.kind === "column") {
      drawGeom(ctx, e, cam, w, h, pal, selected.has(e.id), project);
    }
  }
  for (const e of project.entities) {
    if (!vis(project, e.layerId)) continue;
    if (e.kind === "survey") drawSurvey(ctx, e, cam, w, h, pal, selected.has(e.id), units);
  }
  for (const e of project.entities) {
    if (!vis(project, e.layerId)) continue;
    if (e.kind === "dim") drawDim(ctx, e, cam, w, h, pal, selected.has(e.id), units);
    if (e.kind === "text") drawText(ctx, e, cam, w, h, pal, selected.has(e.id));
    if (e.kind === "room") drawRoomLabel(ctx, e, cam, w, h, pal, units);
  }

  if (draft && draft.points.length) {
    drawDraft(ctx, draft, hover, cam, w, h, pal, units);
  }

  if (snapHit) drawSnap(ctx, snapHit, cam, w, h, pal);
  drawNorth(ctx, w, h, pal);
  drawScale(ctx, w, h, cam, pal, units);

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, pal: Palette) {
  const step = gridStepForZoom(cam.zoom);
  const major = step * 5;
  const worldMin = screenToWorld({ x: 0, y: h }, cam, w, h);
  const worldMax = screenToWorld({ x: w, y: 0 }, cam, w, h);
  const x0 = Math.floor(worldMin.x / step) * step;
  const y0 = Math.floor(worldMin.y / step) * step;

  ctx.lineWidth = 1;
  for (let x = x0; x <= worldMax.x + step; x += step) {
    const s = worldToScreen({ x, y: 0 }, cam, w, h);
    const isMajor = Math.abs(x % major) < 1e-6 || Math.abs(Math.abs(x % major) - major) < 1e-6;
    ctx.strokeStyle = isMajor ? pal.gridMajor : pal.grid;
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, h);
    ctx.stroke();
  }
  for (let y = y0; y <= worldMax.y + step; y += step) {
    const s = worldToScreen({ x: 0, y }, cam, w, h);
    const isMajor = Math.abs(y % major) < 1e-6 || Math.abs(Math.abs(y % major) - major) < 1e-6;
    ctx.strokeStyle = isMajor ? pal.gridMajor : pal.grid;
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(w, s.y);
    ctx.stroke();
  }
}

function drawAxes(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, pal: Palette) {
  const o = worldToScreen({ x: 0, y: 0 }, cam, w, h);
  ctx.strokeStyle = pal.axis;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, o.y);
  ctx.lineTo(w, o.y);
  ctx.moveTo(o.x, 0);
  ctx.lineTo(o.x, h);
  ctx.stroke();
  ctx.fillStyle = pal.axis;
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.fillText("E / X", w - 42, o.y - 6);
  ctx.fillText("N / Y", o.x + 8, 14);
}

function drawFilled(
  ctx: CanvasRenderingContext2D,
  e: Extract<Entity, { kind: "room" | "slab" }>,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
) {
  pathPts(ctx, e.points, cam, w, h, true);
  ctx.fillStyle = e.kind === "room" ? pal.room : pal.fill;
  ctx.globalAlpha = sel ? 0.85 : 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  e: WallEnt,
  project: Project,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
) {
  const q = wallQuad(e);
  pathPts(ctx, q, cam, w, h, true);
    ctx.fillStyle = sel ? "rgba(242,244,240,0.16)" : "rgba(197,205,198,0.08)";
  ctx.fill();
  ctx.strokeStyle = sel ? pal.select : col(project, e, pal) || pal.wall;
  ctx.lineWidth = sel ? 2 : 1.4;
  ctx.stroke();
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  e: OpeningEnt,
  wall: WallEnt,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
) {
  const on = openingOnWall(wall, e);
  const a = worldToScreen(on.a, cam, w, h);
  const b = worldToScreen(on.b, cam, w, h);
  ctx.strokeStyle = sel ? pal.select : pal.opening;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  if (e.kind === "door") {
    const swing = e.swing === "left" ? 1 : -1;
    const n = scale(on.n, e.width * swing);
    const leaf = { x: on.a.x + n.x, y: on.a.y + n.y };
    const ls = worldToScreen(leaf, cam, w, h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(ls.x, ls.y);
    ctx.stroke();
    const radius = dist(a, b);
    const start = Math.atan2(ls.y - a.y, ls.x - a.x);
    const end = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(a.x, a.y, radius, start, end, swing < 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    const n = scale(on.n, wall.thickness * 0.7);
    const a1 = worldToScreen({ x: on.a.x + n.x, y: on.a.y + n.y }, cam, w, h);
    const b1 = worldToScreen({ x: on.b.x + n.x, y: on.b.y + n.y }, cam, w, h);
    const a2 = worldToScreen({ x: on.a.x - n.x, y: on.a.y - n.y }, cam, w, h);
    const b2 = worldToScreen({ x: on.b.x - n.x, y: on.b.y - n.y }, cam, w, h);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();
  }
}

function drawGeom(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
  project: Project,
) {
  ctx.strokeStyle = sel ? pal.select : col(project, e, pal);
  ctx.lineWidth = sel ? 2 : 1.35;
  if (e.kind === "line") {
    const a = worldToScreen(e.a, cam, w, h);
    const b = worldToScreen(e.b, cam, w, h);
    ctx.setLineDash(e.layerId === "traverse" ? [6, 4] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (e.kind === "rect") {
    pathPts(ctx, rectCorners(e.a, e.b), cam, w, h, true);
    ctx.stroke();
  } else if (e.kind === "polyline") {
    pathPts(ctx, e.points, cam, w, h, e.closed);
    ctx.stroke();
  } else if (e.kind === "circle") {
    const c = worldToScreen(e.c, cam, w, h);
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(1, e.r * cam.zoom), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x - 4, c.y);
    ctx.lineTo(c.x + 4, c.y);
    ctx.moveTo(c.x, c.y - 4);
    ctx.lineTo(c.x, c.y + 4);
    ctx.stroke();
  } else if (e.kind === "column") {
    const hw = e.width / 2;
    const hd = e.depth / 2;
    pathPts(
      ctx,
      [
        { x: e.c.x - hw, y: e.c.y - hd },
        { x: e.c.x + hw, y: e.c.y - hd },
        { x: e.c.x + hw, y: e.c.y + hd },
        { x: e.c.x - hw, y: e.c.y + hd },
      ],
      cam,
      w,
      h,
      true,
    );
    ctx.fillStyle = sel ? pal.select : pal.geom;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
}

function drawSurvey(
  ctx: CanvasRenderingContext2D,
  e: Extract<Entity, { kind: "survey" }>,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
  units: CadState["units"],
) {
  const s = worldToScreen({ x: e.e, y: e.n }, cam, w, h);
  ctx.strokeStyle = sel ? pal.select : pal.survey;
  ctx.fillStyle = pal.paper;
  ctx.lineWidth = 1.6;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - r);
  ctx.lineTo(s.x + r, s.y + r * 0.7);
  ctx.lineTo(s.x - r, s.y + r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.fillStyle = pal.fg;
  ctx.font = "500 11px 'IBM Plex Mono', monospace";
  ctx.fillText(e.code, s.x + 10, s.y - 4);
  ctx.fillStyle = pal.muted;
  ctx.font = "400 10px 'IBM Plex Mono', monospace";
  ctx.fillText(`Z ${formatMmNum(e.z, units)}`, s.x + 10, s.y + 10);
}

function drawDim(
  ctx: CanvasRenderingContext2D,
  e: Extract<Entity, { kind: "dim" }>,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
  units: CadState["units"],
) {
  const n = perp({ x: e.b.x - e.a.x, y: e.b.y - e.a.y });
  const len = Math.hypot(n.x, n.y) || 1;
  const off = { x: (n.x / len) * e.offset, y: (n.y / len) * e.offset };
  const a2 = { x: e.a.x + off.x, y: e.a.y + off.y };
  const b2 = { x: e.b.x + off.x, y: e.b.y + off.y };
  const sa = worldToScreen(e.a, cam, w, h);
  const sb = worldToScreen(e.b, cam, w, h);
  const sa2 = worldToScreen(a2, cam, w, h);
  const sb2 = worldToScreen(b2, cam, w, h);
  ctx.strokeStyle = sel ? pal.select : pal.dim;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sa2.x, sa2.y);
  ctx.lineTo(sb2.x, sb2.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  tick(ctx, sa2, sb2);
  tick(ctx, sb2, sa2);
  const label = formatMm(dist(e.a, e.b), units);
  const m = worldToScreen(mid(a2, b2), cam, w, h);
  ctx.font = "500 11px 'IBM Plex Mono', monospace";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(m.x - tw / 2 - 4, m.y - 9, tw + 8, 14);
  ctx.fillStyle = pal.dim;
  ctx.fillText(label, m.x - tw / 2, m.y + 3);
}

function tick(ctx: CanvasRenderingContext2D, from: Pt, toward: Pt) {
  const ang = Math.atan2(toward.y - from.y, toward.x - from.x);
  ctx.beginPath();
  ctx.moveTo(from.x + Math.cos(ang + 0.7) * 7, from.y + Math.sin(ang + 0.7) * 7);
  ctx.lineTo(from.x, from.y);
  ctx.lineTo(from.x + Math.cos(ang - 0.7) * 7, from.y + Math.sin(ang - 0.7) * 7);
  ctx.stroke();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  e: Extract<Entity, { kind: "text" }>,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  sel: boolean,
) {
  const s = worldToScreen(e.p, cam, w, h);
  const px = Math.max(10, e.size * cam.zoom);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(-e.rotation);
  ctx.fillStyle = sel ? pal.select : pal.fg;
  ctx.font = `500 ${px}px 'IBM Plex Sans', sans-serif`;
  ctx.fillText(e.text, 0, 0);
  ctx.restore();
}

function drawRoomLabel(
  ctx: CanvasRenderingContext2D,
  e: Extract<Entity, { kind: "room" }>,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  units: CadState["units"],
) {
  const c = polygonCentroid(e.points);
  const s = worldToScreen(c, cam, w, h);
  const area = polygonArea(e.points);
  const areaStr =
    units === "m" ? `${(area / 1e6).toFixed(1)} m²` : units === "mm" ? `${area.toFixed(0)} mm²` : `${(area / 1e6).toFixed(1)} m²`;
  ctx.textAlign = "center";
  ctx.fillStyle = pal.fg;
  ctx.font = "500 12px 'IBM Plex Sans', sans-serif";
  ctx.fillText(e.name ?? "Room", s.x, s.y - 6);
  ctx.fillStyle = pal.muted;
  ctx.font = "400 10px 'IBM Plex Mono', monospace";
  ctx.fillText(areaStr, s.x, s.y + 8);
  ctx.textAlign = "left";
}

function drawDraft(
  ctx: CanvasRenderingContext2D,
  draft: NonNullable<CadState["draft"]>,
  hover: Pt | null,
  cam: Cam,
  w: number,
  h: number,
  pal: Palette,
  units: CadState["units"],
) {
  const pts = hover ? [...draft.points, hover] : draft.points;
  ctx.strokeStyle = pal.snap;
  ctx.fillStyle = pal.snap;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  if (draft.tool === "circle" && pts.length >= 2) {
    const c = worldToScreen(pts[0]!, cam, w, h);
    const r = dist(pts[0]!, pts[1]!) * cam.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (draft.tool === "rect" && pts.length >= 2) {
    pathPts(ctx, rectCorners(pts[0]!, pts[1]!), cam, w, h, true);
    ctx.stroke();
  } else {
    pathPts(ctx, pts, cam, w, h, false);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (pts.length >= 2) {
    const a = pts[pts.length - 2]!;
    const b = pts[pts.length - 1]!;
    const m = worldToScreen(mid(a, b), cam, w, h);
    const d = dist(a, b);
    const az = azimuthDeg(a, b);
    const label = `${formatMm(d, units)}  ${formatDms(az)}`;
    ctx.font = "500 11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = pal.paper;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(m.x - tw / 2 - 4, m.y - 16, tw + 8, 16);
    ctx.fillStyle = pal.snap;
    ctx.fillText(label, m.x - tw / 2, m.y - 4);
  }
}

function drawSnap(ctx: CanvasRenderingContext2D, snap: SnapHit, cam: Cam, w: number, h: number, pal: Palette) {
  const s = worldToScreen(snap.pt, cam, w, h);
  ctx.strokeStyle = pal.snap;
  ctx.lineWidth = 1.4;
  const r = 7;
  ctx.beginPath();
  ctx.rect(s.x - r, s.y - r, r * 2, r * 2);
  ctx.stroke();
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.fillStyle = pal.snap;
  ctx.fillText(snap.type.toUpperCase(), s.x + 10, s.y - 8);
}

function drawNorth(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette) {
  const x = w - 28;
  const y = 36;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = pal.fg;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(5, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.font = "600 10px 'IBM Plex Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -18);
  ctx.restore();
}

function drawScale(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  pal: Palette,
  units: CadState["units"],
) {
  const targetPx = 96;
  const world = targetPx / cam.zoom;
  const nice = niceLength(world);
  const px = nice * cam.zoom;
  const x = 16;
  const y = h - 18;
  ctx.strokeStyle = pal.fg;
  ctx.fillStyle = pal.fg;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + px, y - 4);
  ctx.lineTo(x + px, y + 4);
  ctx.stroke();
  ctx.font = "400 10px 'IBM Plex Mono', monospace";
  ctx.fillText(formatMm(nice, units), x, y - 8);
}

function niceLength(mm: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(mm)));
  const n = mm / pow;
  const m = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return m * pow;
}

export function fitCam(box: { minX: number; minY: number; maxX: number; maxY: number }, w: number, h: number): Cam {
  const dx = Math.max(1, box.maxX - box.minX);
  const dy = Math.max(1, box.maxY - box.minY);
  const zoom = Math.min(w / dx, h / dy) * 0.86;
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    zoom: Math.max(0.0005, Math.min(40, zoom)),
  };
}

export { lerp };
