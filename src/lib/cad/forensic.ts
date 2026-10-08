import { azimuthDeg, dist, formatDms } from "./geometry";
import type { Entity, Pt } from "./types";

export const BRAND = "Astranov Architect Forensic TopoBimCad";
export const BRAND_SHORT = "Forensic TopoBimCad";

export interface AngleReading {
  degrees: number;
  dms: string;
  interior: number;
}

export interface LengthReading {
  chordMm: number;
  arcMm: number | null;
  bearingDeg: number;
  bearingDms: string;
}

export interface Disagreement {
  lengthDeltaM: number;
  angleDeltaDeg: number;
  flag: "within tolerance" | "review" | "strong disagreement";
  note: string;
}

/** Interior angle at vertex b, in degrees 0–180. */
export function angleAt(a: Pt, b: Pt, c: Pt): AngleReading {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y) || 1;
  const n2 = Math.hypot(v2x, v2y) || 1;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  const degrees = (Math.acos(cos) * 180) / Math.PI;
  return { degrees, dms: formatDms(degrees), interior: degrees };
}

/** Interior and exterior degrees at vertex v. ccw is the ring's winding in y-up coordinates. */
export function cornerAngles(prev: Pt, v: Pt, next: Pt, ccw: boolean): { interiorDeg: number; exteriorDeg: number } {
  const d1x = v.x - prev.x;
  const d1y = v.y - prev.y;
  const d2x = next.x - v.x;
  const d2y = next.y - v.y;
  let turn = Math.atan2(d2y, d2x) - Math.atan2(d1y, d1x);
  while (turn <= -Math.PI) turn += Math.PI * 2;
  while (turn > Math.PI) turn -= Math.PI * 2;
  let interior = ccw ? Math.PI - turn : Math.PI + turn;
  while (interior <= 0) interior += Math.PI * 2;
  while (interior > Math.PI * 2) interior -= Math.PI * 2;
  const exterior = Math.PI * 2 - interior;
  return { interiorDeg: (interior * 180) / Math.PI, exteriorDeg: (exterior * 180) / Math.PI };
}

export function lengthOf(a: Pt, b: Pt): LengthReading {
  const chordMm = dist(a, b);
  const bearingDeg = azimuthDeg(a, b);
  return { chordMm, arcMm: null, bearingDeg, bearingDms: formatDms(bearingDeg) };
}

/** Circle through three points. Arc length is the minor arc unless major=true. */
export function arcThrough(a: Pt, b: Pt, c: Pt, major = false): LengthReading & { radiusMm: number } {
  const circle = circleFrom3(a, b, c);
  const chord = dist(a, c);
  if (!circle) {
    const straight = lengthOf(a, c);
    return { ...straight, radiusMm: Infinity };
  }
  const a0 = Math.atan2(a.y - circle.cy, a.x - circle.cx);
  const a2 = Math.atan2(c.y - circle.cy, c.x - circle.cx);
  let sweep = a2 - a0;
  while (sweep < 0) sweep += Math.PI * 2;
  while (sweep >= Math.PI * 2) sweep -= Math.PI * 2;
  const minor = Math.min(sweep, Math.PI * 2 - sweep);
  const use = major ? Math.PI * 2 - minor : minor;
  const arcMm = circle.r * use;
  const bearingDeg = azimuthDeg(a, c);
  return { chordMm: chord, arcMm, bearingDeg, bearingDms: formatDms(bearingDeg), radiusMm: circle.r };
}

export function polylineLength(pts: Pt[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1]!, pts[i]!);
  return n;
}

export function entityEnds(e: Entity): [Pt, Pt] | null {
  if (e.kind === "line" || e.kind === "wall" || e.kind === "dim") return [e.a, e.b];
  if (e.kind === "polyline" && e.points.length >= 2) return [e.points[0]!, e.points[e.points.length - 1]!];
  return null;
}

/** Compare two traced boundaries. A flag is geometric evidence for review, not a finding of fraud. */
export function compareTraces(a: [Pt, Pt], b: [Pt, Pt], tolM = 0.2, tolDeg = 0.5): Disagreement {
  const la = lengthOf(a[0], a[1]);
  const lb = lengthOf(b[0], b[1]);
  const lengthDeltaM = Math.abs(la.chordMm - lb.chordMm) / 1000;
  let angleDeltaDeg = Math.abs(la.bearingDeg - lb.bearingDeg);
  if (angleDeltaDeg > 180) angleDeltaDeg = 360 - angleDeltaDeg;
  const lengthBad = lengthDeltaM > tolM;
  const angleBad = angleDeltaDeg > tolDeg;
  const strong = lengthDeltaM > tolM * 4 || angleDeltaDeg > tolDeg * 4;
  const flag = strong ? "strong disagreement" : lengthBad || angleBad ? "review" : "within tolerance";
  const note =
    flag === "within tolerance"
      ? "The two traces agree inside the set tolerance. Residual can still be paper stretch or georef error."
      : "Lengths or bearings disagree. Check control, scale, and whether the older sheet was rotated or shortened. This is measurement evidence for a surveyor or court — not a verdict that a topographer cheated.";
  return { lengthDeltaM, angleDeltaDeg, flag, note };
}

function circleFrom3(a: Pt, b: Pt, c: Pt): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) };
}
