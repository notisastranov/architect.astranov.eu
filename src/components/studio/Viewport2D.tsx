import { useCallback, useEffect, useRef } from "react";
import {
  applyOrtho,
  findSnap,
  nid,
  pickEntity,
  projectExtents,
} from "@/lib/cad/geometry";
import { drawScene, fitCam, readPalette, screenToWorld } from "@/lib/cad/draw2d";
import { parsePoint } from "@/lib/cad/units";
import { useCad } from "@/lib/cad/store";
import type { Entity, OpeningEnt, Pt, Tool, WallEnt } from "@/lib/cad/types";

const DRAW_TOOLS: Tool[] = [
  "line",
  "rect",
  "circle",
  "polyline",
  "wall",
  "room",
  "dim",
  "text",
  "survey",
  "measure",
  "column",
];

export function Viewport2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const spaceRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 4 || h < 4) return;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = useCad.getState();
    if (s.dirtyFit) {
      const box = projectExtents(s.project);
      if (box) useCad.setState({ cam: fitCam(box, w, h), dirtyFit: false });
      else useCad.setState({ dirtyFit: false });
    }
    const pal = readPalette(wrap);
    const st = useCad.getState();
    drawScene(ctx, w, h, st, pal);
  }, []);

  useEffect(() => {
    redraw();
    const unsub = useCad.subscribe(() => redraw());
    const wrap = wrapRef.current;
    if (!wrap) return () => unsub();
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [redraw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = e.type === "keydown";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const resolveWorld = (clientX: number, clientY: number): Pt => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const st = useCad.getState();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    let world = screenToWorld({ x: sx, y: sy }, st.cam, rect.width, rect.height);
    const extra = st.draft?.points ?? [];
    const last = extra[extra.length - 1];
    if (st.ortho && last && st.tool !== "select" && st.tool !== "pan") {
      world = applyOrtho(last, world);
    }
    const tol = 12 / st.cam.zoom;
    const hit = findSnap(world, st.project, st.snap, st.project.gridSize, tol, extra);
    const pt = hit?.pt ?? world;
    useCad.getState().setHover(pt, hit);
    return pt;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const st = useCad.getState();
    if (e.button === 1 || e.button === 2 || spaceRef.current || st.tool === "pan") {
      panRef.current = { x: e.clientX, y: e.clientY, camX: st.cam.x, camY: st.cam.y };
      return;
    }
    if (e.button !== 0) return;
    const world = resolveWorld(e.clientX, e.clientY);
    handleClick(world, e.shiftKey);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current;
    const st = useCad.getState();
    if (pan) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      useCad.getState().setCam({
        x: pan.camX - dx / st.cam.zoom,
        y: pan.camY + dy / st.cam.zoom,
      });
      return;
    }
    resolveWorld(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    panRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const st = useCad.getState();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const before = screenToWorld({ x: sx, y: sy }, st.cam, rect.width, rect.height);
    const factor = e.deltaY > 0 ? 0.9 : 1.12;
    const zoom = Math.max(0.0004, Math.min(80, st.cam.zoom * factor));
    const cam = { ...st.cam, zoom };
    const after = screenToWorld({ x: sx, y: sy }, cam, rect.width, rect.height);
    useCad.getState().setCam({
      zoom,
      x: cam.x + (before.x - after.x),
      y: cam.y + (before.y - after.y),
    });
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full min-h-0 overflow-hidden bg-bg touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}

function handleClick(world: Pt, shift: boolean) {
  const st = useCad.getState();
  const tool = st.tool;

  if (tool === "select") {
    const tol = 10 / st.cam.zoom;
    const hit = pickEntity(st.project, world, tol);
    if (hit) st.select([hit.id], shift);
    else if (!shift) st.clearSelection();
    return;
  }

  if (tool === "door" || tool === "window") {
    const hit = pickEntity(st.project, world, 14 / st.cam.zoom);
    const wall =
      hit?.kind === "wall"
        ? hit
        : (st.project.entities.find((e) => e.kind === "wall" && distPointToWall(world, e as WallEnt) < 14 / st.cam.zoom) as
            | WallEnt
            | undefined);
    if (!wall) {
      st.setStatus("Click a wall to host the opening.");
      return;
    }
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1;
    const t = ((world.x - wall.a.x) * (wall.b.x - wall.a.x) + (world.y - wall.a.y) * (wall.b.y - wall.a.y)) / (len * len);
    const width = tool === "door" ? 900 : 1200;
    const offset = Math.max(0, t * len - width / 2);
    const e: OpeningEnt = {
      id: nid(tool),
      kind: tool,
      layerId: st.project.layers.some((l) => l.id === "openings") ? "openings" : st.project.layers[0]!.id,
      wallId: wall.id,
      offset,
      width,
      height: tool === "door" ? 2100 : 1400,
      sill: tool === "door" ? 0 : 900,
      swing: "left",
      name: tool === "door" ? "Door" : "Window",
    };
    st.addEntity(e);
    return;
  }

  if (tool === "column") {
    st.addEntity({
      id: nid("col"),
      kind: "column",
      layerId: st.project.layers.some((l) => l.id === "cols") ? "cols" : st.project.layers[0]!.id,
      c: world,
      width: 300,
      depth: 300,
      height: st.project.wallHeight || 3000,
      rotation: 0,
      material: "Concrete",
      name: "Column",
    });
    return;
  }

  if (!DRAW_TOOLS.includes(tool)) return;

  const draft = st.draft ?? { tool, points: [] };
  const points = [...draft.points, world];

  const finish = (entity: Entity | null, keepTool = true) => {
    if (entity) st.addEntity(entity);
    st.setDraft(keepTool ? { tool, points: [] } : null);
    if (!keepTool) useCad.setState({ tool: "select" });
  };

  if (tool === "line" && points.length >= 2) {
    finish({
      id: nid("ln"),
      kind: "line",
      layerId: defaultLayer(st, "traverse", "notes"),
      a: points[0]!,
      b: points[1]!,
    });
    return;
  }
  if (tool === "wall" && points.length >= 2) {
    finish({
      id: nid("wall"),
      kind: "wall",
      layerId: defaultLayer(st, "walls", "outline"),
      a: points[0]!,
      b: points[1]!,
      thickness: st.project.wallThickness || 200,
      height: st.project.wallHeight || 3000,
      material: st.project.discipline === "mechanical" ? "Steel S235" : "Brick",
      ifc: "IfcWallStandardCase",
    });
    return;
  }
  if (tool === "rect" && points.length >= 2) {
    finish({
      id: nid("rect"),
      kind: "rect",
      layerId: defaultLayer(st, "outline", "walls"),
      a: points[0]!,
      b: points[1]!,
      thickness: st.project.discipline === "mechanical" ? st.project.wallHeight : undefined,
    });
    return;
  }
  if (tool === "circle" && points.length >= 2) {
    const r = Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
    finish({
      id: nid("cir"),
      kind: "circle",
      layerId: defaultLayer(st, "holes", "openings"),
      c: points[0]!,
      r,
    });
    return;
  }
  if (tool === "dim" && points.length >= 2) {
    const a = points[0]!;
    const b = points[1]!;
    finish({
      id: nid("dim"),
      kind: "dim",
      layerId: defaultLayer(st, "dims", "notes"),
      a,
      b,
      offset: st.project.discipline === "mechanical" ? 16 : 600,
    });
    return;
  }
  if (tool === "measure" && points.length >= 2) {
    st.setDraft({ tool, points: [] });
    return;
  }
  if (tool === "text") {
    const existing = st.command.trim();
    st.setPrompt("text");
    st.setStatus("Type the note in the command line, then Enter.");
    st.setDraft({ tool, points });
    if (existing) {
      finish({
        id: nid("txt"),
        kind: "text",
        layerId: defaultLayer(st, "notes", "notes"),
        p: world,
        text: existing,
        size: st.project.discipline === "mechanical" ? 5 : 250,
        rotation: 0,
      });
      st.setCommand("");
    }
    return;
  }
  if (tool === "survey") {
    const code = st.command.trim() || `P${st.project.entities.filter((e) => e.kind === "survey").length + 1}`;
    finish({
      id: nid("stn"),
      kind: "survey",
      layerId: defaultLayer(st, "control", "notes"),
      e: world.x,
      n: world.y,
      z: 0,
      code,
      desc: "",
      name: code,
    });
    st.setCommand("");
    return;
  }
  if (tool === "polyline" || tool === "room") {
    st.setDraft({ tool, points });
    st.setStatus(`${tool === "room" ? "Room" : "Polyline"} · ${points.length} pts · Enter to close`);
    return;
  }

  st.setDraft({ tool, points });
}

function defaultLayer(st: ReturnType<typeof useCad.getState>, prefer: string, fallback: string) {
  if (st.project.layers.some((l) => l.id === prefer)) return prefer;
  if (st.project.layers.some((l) => l.id === fallback)) return fallback;
  return st.project.layers[0]!.id;
}

function distPointToWall(p: Pt, w: WallEnt) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2));
  return Math.hypot(p.x - (w.a.x + dx * t), p.y - (w.a.y + dy * t));
}

export function commitPolyline() {
  const st = useCad.getState();
  const d = st.draft;
  if (!d) return;
  if (d.tool === "polyline" && d.points.length >= 2) {
    st.addEntity({
      id: nid("pl"),
      kind: "polyline",
      layerId: defaultLayer(st, "outline", "notes"),
      points: d.points,
      closed: true,
    });
  }
  if (d.tool === "room" && d.points.length >= 3) {
    st.addEntity({
      id: nid("space"),
      kind: "room",
      layerId: defaultLayer(st, "rooms", "notes"),
      points: d.points,
      occupancy: "Residential",
      name: "Room",
    });
  }
  if (d.tool === "text" && d.points[0] && st.command.trim()) {
    st.addEntity({
      id: nid("txt"),
      kind: "text",
      layerId: defaultLayer(st, "notes", "notes"),
      p: d.points[0],
      text: st.command.trim(),
      size: st.project.discipline === "mechanical" ? 5 : 250,
      rotation: 0,
    });
    st.setCommand("");
  }
  st.setDraft({ tool: d.tool, points: [] });
}

export function tryCommandPoint(input: string): boolean {
  const st = useCad.getState();
  const origin = st.draft?.points[st.draft.points.length - 1] ?? st.hover ?? undefined;
  const p = parsePoint(input, st.units, origin);
  if (!p) return false;
  handleClick(p, false);
  return true;
}
