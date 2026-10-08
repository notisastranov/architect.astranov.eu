import { worldToScreen, type Cam, type Palette } from "./draw2d";
import { auditRing, ringOf, shiftsAgainst } from "./sheet-audit";
import { useCad } from "./store";
import type { Pt } from "./types";

function sweep(a0: number, a1: number, target: number) {
  let cw = a1 - a0;
  while (cw < 0) cw += Math.PI * 2;
  while (cw >= Math.PI * 2) cw -= Math.PI * 2;
  const ccw = cw - Math.PI * 2;
  if (Math.abs(cw - target) <= Math.abs(-ccw - target)) return { delta: cw, anti: false };
  return { delta: ccw, anti: true };
}

function cornerMark(
  ctx: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  armA: number,
  armB: number,
  degrees: number,
  radius: number,
  weight: number,
  color: string,
  paper: string,
) {
  const target = (degrees * Math.PI) / 180;
  const sw = sweep(armA, armB, target);
  const mid = armA + sw.delta / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.beginPath();
  ctx.moveTo(vx + Math.cos(armA) * 5, vy + Math.sin(armA) * 5);
  ctx.lineTo(vx + Math.cos(armA) * radius, vy + Math.sin(armA) * radius);
  ctx.moveTo(vx + Math.cos(armB) * 5, vy + Math.sin(armB) * 5);
  ctx.lineTo(vx + Math.cos(armB) * radius, vy + Math.sin(armB) * radius);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(vx, vy, radius, armA, armA + sw.delta, sw.anti);
  ctx.stroke();
  const inset = Math.max(11, radius * 0.62);
  const lx = vx + Math.cos(mid) * inset;
  const ly = vy + Math.sin(mid) * inset;
  const label = `${degrees.toFixed(1)}°`;
  ctx.font = `500 ${Math.round(8 + weight * 1.4)}px 'IBM Plex Mono', monospace`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.88;
  ctx.fillRect(lx - tw / 2 - 2, ly - 8, tw + 4, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(label, lx, ly + 2);
  ctx.textAlign = "left";
}

export function paintSheetAudit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  pal: Palette,
) {
  const st = useCad.getState();
  if (!st.boards.forensic) return;
  const weight = Math.max(0.6, Math.min(5, st.measureWeight || 1.6));
  const rings = st.project.entities
    .map((e) => ({ e, pts: ringOf(e) }))
    .filter((x): x is { e: (typeof st.project.entities)[number]; pts: Pt[] } => !!x.pts);
  if (!rings.length) return;

  const vault = rings[0]!.pts;
  const suspect = rings[1]?.pts;
  const bad = suspect ? new Set(shiftsAgainst(vault, suspect).map((s) => s.i)) : new Set<number>();

  const boundary = rings.filter((r) => r.e.kind === "polyline");
  const selected = new Set(st.selection);
  const drawn = boundary.length
    ? [...boundary, ...rings.filter((r) => r.e.kind !== "polyline" && selected.has(r.e.id))]
    : rings;

  drawn.forEach((ring, ri) => {
    const audit = auditRing(ring.pts);
    const screen = ring.pts.map((p) => worldToScreen(p, cam, w, h));
    let cx = 0;
    let cy = 0;
    screen.forEach((p) => {
      cx += p.x;
      cy += p.y;
    });
    cx /= screen.length;
    cy /= screen.length;

    audit.edges.forEach((edge) => {
      const shift = ri === 1 && bad.has(edge.i);
      const color = shift ? "#e07a5f" : pal.dim;
      const a = worldToScreen(edge.a, cam, w, h);
      const b = worldToScreen(edge.b, cam, w, h);
      const prev = screen[(edge.i - 1 + screen.length) % screen.length]!;
      const here = screen[edge.i]!;
      if (shift) {
        ctx.strokeStyle = "#e07a5f";
        ctx.lineWidth = weight + 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      let nx = b.y - a.y;
      let ny = a.x - b.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      if ((mx + nx - cx) * (mx - cx) + (my + ny - cy) * (my - cy) < (mx - cx) * (mx - cx) + (my - cy) * (my - cy)) {
        nx = -nx;
        ny = -ny;
      }
      const off = 14 + weight * 4;
      const label = shift ? `${edge.metres.toFixed(2)} m  SHIFT` : `${edge.metres.toFixed(2)} m`;
      ctx.font = `500 ${Math.round(8 + weight * 1.4)}px 'IBM Plex Mono', monospace`;
      const tw = ctx.measureText(label).width;
      const lx = mx + nx * off;
      const ly = my + ny * off;
      ctx.fillStyle = "rgba(12,13,14,0.82)";
      ctx.fillRect(lx - tw / 2 - 3, ly - 9, tw + 6, 13);
      ctx.fillStyle = shift ? "#e07a5f" : pal.fg;
      ctx.textAlign = "center";
      ctx.fillText(label, lx, ly + 1);
      ctx.textAlign = "left";

      const armBack = Math.atan2(prev.y - here.y, prev.x - here.x);
      const armFore = Math.atan2(b.y - here.y, b.x - here.x);
      const insideR = 26 + weight * 7;
      const outsideR = 48 + weight * 10;
      cornerMark(ctx, here.x, here.y, armBack, armFore, edge.angleDeg, insideR, weight, color, "rgba(12,13,14,0.9)");
      cornerMark(ctx, here.x, here.y, armBack, armFore, edge.exteriorDeg, outsideR, Math.max(0.8, weight * 0.85), pal.muted, "rgba(12,13,14,0.9)");
    });
  });
}
