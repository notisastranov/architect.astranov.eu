import { cornerAngles, lengthOf } from "./forensic";
import { dist } from "./geometry";
import type { Entity, Pt } from "./types";

export interface EdgeRead {
  i: number;
  metres: number;
  bearingDeg: number;
  /** Inside the parcel. */
  angleDeg: number;
  /** Outside the parcel, the other wedge of the same corner. */
  exteriorDeg: number;
  a: Pt;
  b: Pt;
}

export interface Shift {
  i: number;
  deltaM: number;
  deltaDeg: number;
  mid: Pt;
  vaultM: number;
  suspectM: number;
}

export function ringOf(e: Entity): Pt[] | null {
  if (e.kind === "polyline" && e.points.length >= 3) return e.points;
  if (e.kind === "room" || e.kind === "slab") return e.points;
  if (e.kind === "rect") {
    const x1 = Math.min(e.a.x, e.b.x);
    const x2 = Math.max(e.a.x, e.b.x);
    const y1 = Math.min(e.a.y, e.b.y);
    const y2 = Math.max(e.a.y, e.b.y);
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }
  return null;
}

/** Ground metres and degrees. Independent of view scale. */
export function auditRing(pts: Pt[]): { edges: EdgeRead[]; areaM2: number } {
  const edges: EdgeRead[] = [];
  const n = pts.length;
  let signed = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    signed += p.x * q.y - q.x * p.y;
  }
  const ccw = signed >= 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const prev = pts[(i - 1 + n) % n]!;
    const len = lengthOf(a, b);
    const ang = cornerAngles(prev, a, b, ccw);
    edges.push({
      i,
      metres: len.chordMm / 1000,
      bearingDeg: len.bearingDeg,
      angleDeg: ang.interiorDeg,
      exteriorDeg: ang.exteriorDeg,
      a,
      b,
    });
  }
  return { edges, areaM2: Math.abs(signed) / 2 / 1e6 };
}

/** Pair each new edge with the nearest vault edge. A shift is geometric, not a verdict. */
export function shiftsAgainst(vault: Pt[], suspect: Pt[], tolM = 0.3, tolDeg = 0.5): Shift[] {
  const old = auditRing(vault).edges;
  const neu = auditRing(suspect).edges;
  const out: Shift[] = [];
  for (const e of neu) {
    const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
    let best = old[0]!;
    let bestD = Infinity;
    for (const o of old) {
      const om = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 };
      const d = dist(mid, om);
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    const deltaM = e.metres - best.metres;
    let deltaDeg = Math.abs(e.bearingDeg - best.bearingDeg);
    if (deltaDeg > 180) deltaDeg = 360 - deltaDeg;
    if (Math.abs(deltaM) > tolM || deltaDeg > tolDeg) {
      out.push({ i: e.i, deltaM, deltaDeg, mid, vaultM: best.metres, suspectM: e.metres });
    }
  }
  return out;
}

/** Nominal paper scale at 96 dpi. Changes with zoom; ground metres do not. */
export function viewScale(zoom: number) {
  if (zoom <= 0) return 0;
  const mmPerPx = 1 / zoom;
  const paperMmPerPx = 25.4 / 96;
  return Math.max(1, Math.round(mmPerPx / paperMmPerPx));
}
