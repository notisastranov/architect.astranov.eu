import { useCallback, useEffect, useRef } from "react";
import {
  applyOrtho,
  findSnap,
  nid,
  pickEntity,
  projectExtents,
} from "@/lib/cad/geometry";
import { drawScene, fitCam, readPalette, screenToWorld } from "@/lib/cad/draw2d";
import { paintOverlaysFromStore } from "@/lib/cad/draw-overlay";
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
    paintOverlaysFromStore(ctx, w, h, st.cam, pal);
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
