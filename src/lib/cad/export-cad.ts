/**
 * DXF, PDF and IFC writers. All three read the live project (millimetres, plan
 * Y north) and write real files: DXF R12 entities on the project layers, a
 * vector A3 PDF sheet at a standard scale, and an IFC2X3 model with walls,
 * voided openings filled by doors and windows, columns, slabs and spaces.
 */
import { dist, openingOnWall, polygonArea, polygonCentroid, rectCorners, wallLength } from "./geometry";
import type { Entity, OpeningEnt, Project, Pt, WallEnt } from "./types";
import { projectSite } from "@/lib/gis/site";

type Prim =
  | { t: "line"; a: Pt; b: Pt; layer: string }
  | { t: "poly"; pts: Pt[]; closed: boolean; layer: string }
  | { t: "circle"; c: Pt; r: number; layer: string }
  | { t: "arc"; c: Pt; r: number; a0: number; a1: number; layer: string }
  | { t: "text"; p: Pt; text: string; size: number; rot: number; layer: string; align?: "left" | "center" };

const deg = (r: number) => (r * 180) / Math.PI;

function wallPrims(w: WallEnt, openings: OpeningEnt[], layer: string): Prim[] {
  const len = wallLength(w);
  if (len < 1) return [];
  const d = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
  const n = { x: -d.y, y: d.x };
  const h = w.thickness / 2;
  const at = (s: number, o: number): Pt => ({ x: w.a.x + d.x * s + n.x * o, y: w.a.y + d.y * s + n.y * o });
  const gaps = openings
    .map((o) => [Math.max(0, o.offset), Math.min(len, o.offset + o.width)] as const)
    .filter(([s0, s1]) => s1 > s0)
    .sort((p, q) => p[0] - q[0]);
  const out: Prim[] = [];
  let cur = 0;
  const solid: [number, number][] = [];
  for (const [s0, s1] of gaps) {
    if (s0 > cur) solid.push([cur, s0]);
    cur = Math.max(cur, s1);
  }
  if (cur < len) solid.push([cur, len]);
  for (const [s0, s1] of solid) {
    out.push({ t: "line", a: at(s0, h), b: at(s1, h), layer });
    out.push({ t: "line", a: at(s0, -h), b: at(s1, -h), layer });
  }
  // End caps and jambs.
  const cuts = new Set<number>([0, len]);
  for (const [s0, s1] of gaps) {
    cuts.add(s0);
    cuts.add(s1);
  }
  for (const s of cuts) out.push({ t: "line", a: at(s, h), b: at(s, -h), layer });
  return out;
}

function openingPrims(o: OpeningEnt, wall: WallEnt, layer: string): Prim[] {
  const on = openingOnWall(wall, o);
  const out: Prim[] = [];
  if (o.kind === "door") {
    const swing = o.swing === "left" ? 1 : -1;
    const r = dist(on.a, on.b);
    const leaf = { x: on.a.x + on.n.x * r * swing, y: on.a.y + on.n.y * r * swing };
    out.push({ t: "line", a: on.a, b: leaf, layer });
    let a0 = Math.atan2(leaf.y - on.a.y, leaf.x - on.a.x);
    let a1 = Math.atan2(on.b.y - on.a.y, on.b.x - on.a.x);
    // Arcs run counter-clockwise from a0 to a1.
    const cross = (leaf.x - on.a.x) * (on.b.y - on.a.y) - (leaf.y - on.a.y) * (on.b.x - on.a.x);
    if (cross < 0) [a0, a1] = [a1, a0];
    out.push({ t: "arc", c: on.a, r, a0, a1, layer });
  } else {
    const k = wall.thickness * 0.18;
    out.push({ t: "line", a: on.a, b: on.b, layer });
    out.push({ t: "line", a: { x: on.a.x + on.n.x * k, y: on.a.y + on.n.y * k }, b: { x: on.b.x + on.n.x * k, y: on.b.y + on.n.y * k }, layer });
    out.push({ t: "line", a: { x: on.a.x - on.n.x * k, y: on.a.y - on.n.y * k }, b: { x: on.b.x - on.n.x * k, y: on.b.y - on.n.y * k }, layer });
  }
  return out;
}

function columnCorners(c: Extract<Entity, { kind: "column" }>): Pt[] {
  const r = (c.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const hw = c.width / 2;
  const hd = c.depth / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, y]) => ({ x: c.c.x + x! * cos - y! * sin, y: c.c.y + x! * sin + y! * cos }));
}

function fmtLen(mm: number, units: Project["units"]) {
  if (units === "mm") return `${Math.round(mm)}`;
  if (units === "cm") return (mm / 10).toFixed(1);
  if (units === "ft") return `${(mm / 304.8).toFixed(2)}'`;
  return (mm / 1000).toFixed(3);
}

/** Every visible entity as plain 2D primitives in plan millimetres. */
export function planPrimitives(project: Project): Prim[] {
  const visible = (id: string) => project.layers.find((l) => l.id === id)?.visible !== false;
  const walls = project.entities.filter((e): e is WallEnt => e.kind === "wall");
  const openings = project.entities.filter((e): e is OpeningEnt => e.kind === "door" || e.kind === "window");
  const out: Prim[] = [];
  const textH = project.discipline === "mechanical" ? 4 : 200;
  for (const e of project.entities) {
    if (!visible(e.layerId)) continue;
    const L = e.layerId;
    switch (e.kind) {
      case "wall":
        out.push(...wallPrims(e, openings.filter((o) => o.wallId === e.id), L));
        break;
      case "door":
      case "window": {
        const w = walls.find((x) => x.id === e.wallId);
        if (w) out.push(...openingPrims(e, w, L));
        break;
      }
      case "room": {
        out.push({ t: "poly", pts: e.points, closed: true, layer: L });
        const c = polygonCentroid(e.points);
        if (e.name) out.push({ t: "text", p: { x: c.x, y: c.y + textH * 0.3 }, text: e.name, size: textH, rot: 0, layer: L, align: "center" });
        out.push({ t: "text", p: { x: c.x, y: c.y - textH * 1.2 }, text: `${(polygonArea(e.points) / 1e6).toFixed(1)} m2`, size: textH * 0.7, rot: 0, layer: L, align: "center" });
        break;
      }
      case "slab":
        out.push({ t: "poly", pts: e.points, closed: true, layer: L });
        break;
      case "column":
        out.push({ t: "poly", pts: columnCorners(e), closed: true, layer: L });
        break;
      case "line":
        out.push({ t: "line", a: e.a, b: e.b, layer: L });
        break;
      case "polyline":
        out.push({ t: "poly", pts: e.points, closed: e.closed, layer: L });
        break;
      case "rect":
        out.push({ t: "poly", pts: rectCorners(e.a, e.b), closed: true, layer: L });
        break;
      case "circle":
        out.push({ t: "circle", c: e.c, r: e.r, layer: L });
        break;
      case "dim": {
        const len = dist(e.a, e.b);
        if (len < 1e-6) break;
        const n = { x: -(e.b.y - e.a.y) / len, y: (e.b.x - e.a.x) / len };
        const a2 = { x: e.a.x + n.x * e.offset, y: e.a.y + n.y * e.offset };
        const b2 = { x: e.b.x + n.x * e.offset, y: e.b.y + n.y * e.offset };
        out.push({ t: "line", a: e.a, b: a2, layer: L }, { t: "line", a: e.b, b: b2, layer: L }, { t: "line", a: a2, b: b2, layer: L });
        const tick = textH * 0.4;
        for (const p of [a2, b2]) out.push({ t: "line", a: { x: p.x - tick, y: p.y - tick }, b: { x: p.x + tick, y: p.y + tick }, layer: L });
        let rot = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
        if (rot > Math.PI / 2 || rot <= -Math.PI / 2) rot += Math.PI;
        const m = { x: (a2.x + b2.x) / 2 + n.x * textH * 0.3, y: (a2.y + b2.y) / 2 + n.y * textH * 0.3 };
        out.push({ t: "text", p: m, text: fmtLen(len, project.units), size: textH * 0.8, rot: deg(rot), layer: L, align: "center" });
        break;
      }
      case "text":
        out.push({ t: "text", p: e.p, text: e.text, size: e.size, rot: e.rotation, layer: L });
        break;
      case "survey": {
        const s = textH * 0.6;
        const p = { x: e.e, y: e.n };
        out.push({ t: "poly", pts: [{ x: p.x, y: p.y + s }, { x: p.x + s * 0.87, y: p.y - s / 2 }, { x: p.x - s * 0.87, y: p.y - s / 2 }], closed: true, layer: L });
        out.push({ t: "text", p: { x: p.x + s * 1.3, y: p.y }, text: e.code, size: textH * 0.8, rot: 0, layer: L });
        break;
      }
    }
  }
  return out;
}

function bounds(prims: Prim[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const k = (p: Pt, r = 0) => {
    minX = Math.min(minX, p.x - r);
    minY = Math.min(minY, p.y - r);
    maxX = Math.max(maxX, p.x + r);
    maxY = Math.max(maxY, p.y + r);
  };
  for (const p of prims) {
    if (p.t === "line") { k(p.a); k(p.b); }
    else if (p.t === "poly") p.pts.forEach((q) => k(q));
    else if (p.t === "circle" || p.t === "arc") k(p.c, p.r);
    else k(p.p, p.size);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  return { minX, minY, maxX, maxY };
}

// ── DXF (AutoCAD R12 ASCII, millimetres) ───────────────────────────────────

function aci(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 7;
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const table: [number, number, number, number][] = [
    [1, 255, 0, 0],
    [2, 255, 255, 0],
    [3, 0, 255, 0],
    [4, 0, 255, 255],
    [5, 0, 0, 255],
    [6, 255, 0, 255],
    [7, 255, 255, 255],
    [8, 128, 128, 128],
    [9, 192, 192, 192],
  ];
  let best = 7;
  let bestD = Infinity;
  for (const [i, R, G, B] of table) {
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function dxfName(s: string) {
  return (s || "0").toUpperCase().replace(/[^A-Z0-9_$-]/g, "_").slice(0, 31) || "0";
}

function dxfText(s: string) {
  // R12 is ANSI: keep printable ASCII, write anything else as \U+XXXX (read by AutoCAD, LibreCAD, ezdxf).
  return s.replace(/[^\x20-\x7e]/g, (ch) => `\\U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
}

export function buildDxf(project: Project): string {
  const prims = planPrimitives(project);
  const b = bounds(prims);
  const o: string[] = [];
  const g = (code: number, v: string | number) => {
    o.push(String(code), typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : v);
  };
  g(0, "SECTION");
  g(2, "HEADER");
  g(9, "$ACADVER");
  g(1, "AC1009");
  g(9, "$INSUNITS");
  g(70, 4);
  g(9, "$EXTMIN");
  g(10, b.minX);
  g(20, b.minY);
  g(30, 0);
  g(9, "$EXTMAX");
  g(10, b.maxX);
  g(20, b.maxY);
  g(30, 0);
  g(0, "ENDSEC");
  g(0, "SECTION");
  g(2, "TABLES");
  g(0, "TABLE");
  g(2, "LTYPE");
  g(70, 1);
  g(0, "LTYPE");
  g(2, "CONTINUOUS");
  g(70, 0);
  g(3, "Solid line");
  g(72, 65);
  g(73, 0);
  g(40, 0);
  g(0, "ENDTAB");
  g(0, "TABLE");
  g(2, "LAYER");
  g(70, project.layers.length + 1);
  g(0, "LAYER");
  g(2, "0");
  g(70, 0);
  g(62, 7);
  g(6, "CONTINUOUS");
  for (const l of project.layers) {
    g(0, "LAYER");
    g(2, dxfName(l.name || l.id));
    g(70, 0);
    g(62, l.visible ? aci(l.color) : -aci(l.color));
    g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "TABLE");
  g(2, "STYLE");
  g(70, 1);
  g(0, "STYLE");
  g(2, "STANDARD");
  g(70, 0);
  g(40, 0);
  g(41, 1);
  g(50, 0);
  g(71, 0);
  g(42, 2.5);
  g(3, "txt");
  g(4, "");
  g(0, "ENDTAB");
  g(0, "ENDSEC");
  g(0, "SECTION");
  g(2, "ENTITIES");
  const layerName = (id: string) => dxfName(project.layers.find((l) => l.id === id)?.name ?? id);
  for (const p of prims) {
    const L = layerName(p.layer);
    if (p.t === "line") {
      g(0, "LINE");
      g(8, L);
      g(10, p.a.x);
      g(20, p.a.y);
      g(30, 0);
      g(11, p.b.x);
      g(21, p.b.y);
      g(31, 0);
    } else if (p.t === "poly") {
      g(0, "POLYLINE");
      g(8, L);
      g(66, 1);
      g(10, 0);
      g(20, 0);
      g(30, 0);
      g(70, p.closed ? 1 : 0);
      for (const q of p.pts) {
        g(0, "VERTEX");
        g(8, L);
        g(10, q.x);
        g(20, q.y);
        g(30, 0);
      }
      g(0, "SEQEND");
      g(8, L);
    } else if (p.t === "circle") {
      g(0, "CIRCLE");
      g(8, L);
      g(10, p.c.x);
      g(20, p.c.y);
      g(30, 0);
      g(40, p.r);
    } else if (p.t === "arc") {
      g(0, "ARC");
      g(8, L);
      g(10, p.c.x);
      g(20, p.c.y);
      g(30, 0);
      g(40, p.r);
      g(50, ((deg(p.a0) % 360) + 360) % 360);
      g(51, ((deg(p.a1) % 360) + 360) % 360);
    } else {
      g(0, "TEXT");
      g(8, L);
      g(10, p.p.x);
      g(20, p.p.y);
      g(30, 0);
      g(40, p.size);
      g(1, dxfText(p.text));
      if (p.rot) g(50, p.rot);
      if (p.align === "center") {
        g(72, 1);
        g(11, p.p.x);
        g(21, p.p.y);
        g(31, 0);
      }
    }
  }
  g(0, "ENDSEC");
  g(0, "EOF");
  return o.join("\r\n") + "\r\n";
}

// ── PDF (vector, A3 landscape, standard scale) ──────────────────────────────

const SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000];

// WinAnsi code points 0x80–0x9F that differ from Latin-1.
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94,
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99,
};

function pdfStr(s: string) {
  // Helvetica with WinAnsi covers Latin-1 (+ dashes/quotes); anything else prints as '?'.
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const b = c >= 0x20 && c < 0x7f ? c : c >= 0xa0 && c <= 0xff ? c : (WIN_ANSI[c] ?? 0x3f);
    const chr = String.fromCharCode(b);
    out += chr === "(" || chr === ")" || chr === "\\" ? `\\${chr}` : b > 0x7e ? `\\${b.toString(8).padStart(3, "0")}` : chr;
  }
  return `(${out})`;
}

export function buildPdf(project: Project, date = new Date()): Uint8Array {
  const prims = planPrimitives(project);
  const b = bounds(prims);
  const PW = 1190.55;
  const PH = 841.89;
  const margin = 28;
  const titleH = 56;
  const areaW = PW - margin * 2;
  const areaH = PH - margin * 2 - titleH;
  const ptPerMm = 72 / 25.4;
  const spanX = Math.max(b.maxX - b.minX, 1);
  const spanY = Math.max(b.maxY - b.minY, 1);
  const need = Math.max((spanX * ptPerMm) / areaW, (spanY * ptPerMm) / areaH);
  const scale = SCALES.find((s) => s >= need) ?? Math.ceil(need);
  const k = ptPerMm / scale;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const ox = margin + areaW / 2 - cx * k;
  const oy = margin + titleH + areaH / 2 - cy * k;
  const X = (x: number) => (ox + x * k).toFixed(2);
  const Y = (y: number) => (oy + y * k).toFixed(2);
  const c: string[] = [];
  c.push("1 J 1 j 0 0 0 RG 0 0 0 rg");
  // Sheet frame and title block.
  c.push("0.8 w", `${margin} ${margin} ${PW - margin * 2} ${PH - margin * 2} re S`, `${margin} ${margin + titleH} m ${PW - margin} ${margin + titleH} l S`);
  const tb = (x: number, y: number, size: number, s: string) => c.push(`BT /F1 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfStr(s)} Tj ET`);
  tb(margin + 10, margin + 32, 14, project.name);
  tb(margin + 10, margin + 14, 8, `${project.discipline.toUpperCase()}  ·  ${project.description}`.slice(0, 140));
  tb(PW - margin - 300, margin + 32, 11, `Scale 1:${scale}  ·  A3  ·  units ${project.units}`);
  const site = projectSite(project);
  tb(PW - margin - 300, margin + 14, 8, `Site ${site.lat.toFixed(5)} N ${site.lon.toFixed(5)} E  ·  ${date.toISOString().slice(0, 10)}  ·  Astranov BIMCAD`);
  c.push("0.35 w");
  for (const p of prims) {
    if (p.t === "line") c.push(`${X(p.a.x)} ${Y(p.a.y)} m ${X(p.b.x)} ${Y(p.b.y)} l S`);
    else if (p.t === "poly" && p.pts.length > 1) {
      c.push(`${X(p.pts[0]!.x)} ${Y(p.pts[0]!.y)} m ` + p.pts.slice(1).map((q) => `${X(q.x)} ${Y(q.y)} l`).join(" ") + (p.closed ? " h S" : " S"));
    } else if (p.t === "circle" || p.t === "arc") {
      const a0 = p.t === "arc" ? p.a0 : 0;
      let a1 = p.t === "arc" ? p.a1 : Math.PI * 2;
      if (a1 <= a0) a1 += Math.PI * 2;
      const steps = Math.max(12, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 72));
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        pts.push(`${X(p.c.x + Math.cos(a) * p.r)} ${Y(p.c.y + Math.sin(a) * p.r)} ${i ? "l" : "m"}`);
      }
      c.push(pts.join(" ") + " S");
    } else if (p.t === "text") {
      const size = Math.max(4, p.size * k);
      const r = (p.rot * Math.PI) / 180;
      const width = p.align === "center" ? p.text.length * size * 0.5 : 0;
      const tx = Number(X(p.p.x)) - (width / 2) * Math.cos(r);
      const ty = Number(Y(p.p.y)) - (width / 2) * Math.sin(r);
      c.push(`BT /F1 ${size.toFixed(2)} Tf ${Math.cos(r).toFixed(4)} ${Math.sin(r).toFixed(4)} ${(-Math.sin(r)).toFixed(4)} ${Math.cos(r).toFixed(4)} ${tx.toFixed(2)} ${ty.toFixed(2)} Tm ${pdfStr(p.text)} Tj ET`);
    }
  }
  const content = c.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfStr(project.name)} /Producer (Astranov BIMCAD) /CreationDate (D:${date.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z) >>`,
  ];
  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character above is a single byte (escapes keep the stream 7-bit except the binary marker).
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

// ── IFC2X3 (STEP physical file) ─────────────────────────────────────────────

const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

/** IFC compressed GlobalId (22 chars) from 128 random bits. */
export function ifcGuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  let n = 0n;
  for (const x of bytes) n = (n << 8n) | BigInt(x);
  let s = "";
  for (let i = 0; i < 22; i++) {
    s = B64[Number(n & 63n)] + s;
    n >>= 6n;
  }
  return s;
}

function ifcStr(s: string) {
  // ISO 10303-21: escape quotes and backslashes; non-ASCII as \X2\HHHH\X0\.
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "'") out += "''";
    else if (ch === "\\") out += "\\\\";
    else if (c >= 0x20 && c < 0x7f) out += ch;
    else if (c <= 0xffff) out += `\\X2\\${c.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
  }
  return `'${out}'`;
}

const f = (n: number) => {
  const s = (Math.round(n * 1e4) / 1e4).toString();
  return s.includes(".") || s.includes("e") ? s : `${s}.`;
};

function dms(v: number) {
  const sgn = v < 0 ? -1 : 1;
  let a = Math.abs(v);
  const d = Math.floor(a);
  a = (a - d) * 60;
  const m = Math.floor(a);
  a = (a - m) * 60;
  const s = Math.floor(a);
  const us = Math.round((a - s) * 1e6);
  return `(${sgn * d},${sgn * m},${sgn * s},${sgn * us})`;
}

export function buildIfc(project: Project, date = new Date()): string {
  const lines: string[] = [];
  let id = 0;
  const e = (body: string) => {
    id += 1;
    lines.push(`#${id}=${body};`);
    return `#${id}`;
  };
  const pt3 = (x: number, y: number, z: number) => e(`IFCCARTESIANPOINT((${f(x)},${f(y)},${f(z)}))`);
  const pt2 = (x: number, y: number) => e(`IFCCARTESIANPOINT((${f(x)},${f(y)}))`);
  const dir3 = (x: number, y: number, z: number) => e(`IFCDIRECTION((${f(x)},${f(y)},${f(z)}))`);
  const ax3 = (o: string, z?: string, x?: string) => e(`IFCAXIS2PLACEMENT3D(${o},${z ?? "$"},${x ?? "$"})`);

  const person = e(`IFCPERSON($,$,'',$,$,$,$,$)`);
  const org = e(`IFCORGANIZATION($,'Astranov',$,$,$)`);
  const po = e(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const app = e(`IFCAPPLICATION(${org},'1','Astranov BIMCAD','astranov-bimcad')`);
  const ts = Math.floor(date.getTime() / 1000);
  const oh = e(`IFCOWNERHISTORY(${po},${app},$,.ADDED.,$,$,$,${ts})`);
  const origin = pt3(0, 0, 0);
  const zUp = dir3(0, 0, 1);
  const xDir = dir3(1, 0, 0);
  const world = ax3(origin, zUp, xDir);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${world},$)`);
  const body = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const uLen = e(`IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)`);
  const uArea = e(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const uVol = e(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const uAng = e(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const units = e(`IFCUNITASSIGNMENT((${uLen},${uArea},${uVol},${uAng}))`);
  const proj = e(`IFCPROJECT('${ifcGuid()}',${oh},${ifcStr(project.name)},${ifcStr(project.description)},$,$,$,(${ctx}),${units})`);
  const site = projectSite(project);
  const sitePl = e(`IFCLOCALPLACEMENT($,${ax3(pt3(0, 0, 0))})`);
  const siteE = e(
    `IFCSITE('${ifcGuid()}',${oh},${ifcStr(site.label ?? "Site")},$,$,${sitePl},$,$,.ELEMENT.,${dms(site.lat)},${dms(site.lon)},0.,$,$)`,
  );
  const bldPl = e(`IFCLOCALPLACEMENT(${sitePl},${ax3(pt3(0, 0, 0))})`);
  const bld = e(`IFCBUILDING('${ifcGuid()}',${oh},${ifcStr(project.name)},$,$,${bldPl},$,$,.ELEMENT.,$,$,$)`);
  const stPl = e(`IFCLOCALPLACEMENT(${bldPl},${ax3(pt3(0, 0, 0))})`);
  const storey = e(`IFCBUILDINGSTOREY('${ifcGuid()}',${oh},'Level 00',$,$,${stPl},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${proj},(${siteE}))`);
  e(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${siteE},(${bld}))`);
  e(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${bld},(${storey}))`);

  const box = (x: number, y: number, z: number, w: number, d: number, h: number) => {
    // Rectangle centred at (x+w/2, y) in the element's frame, extruded up by h from z.
    const prof = e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${e(`IFCAXIS2PLACEMENT2D(${pt2(x + w / 2, y)},$)`)},${f(w)},${f(d)})`);
    const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${ax3(pt3(0, 0, z))},${zUp},${f(h)})`);
    return e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${solid}))`)}))`);
  };
  const polySolid = (pts: Pt[], z: number, h: number) => {
    const ring = pts.map((p) => pt2(p.x, p.y));
    const prof = e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${e(`IFCPOLYLINE((${[...ring, ring[0]].join(",")}))`)})`);
    const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${ax3(pt3(0, 0, z))},${zUp},${f(h)})`);
    return e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${solid}))`)}))`);
  };
  const placeAlong = (rel: string, at: Pt, dirX: number, dirY: number, z = 0) =>
    e(`IFCLOCALPLACEMENT(${rel},${ax3(pt3(at.x, at.y, z), zUp, dir3(dirX, dirY, 0))})`);

  const contained: string[] = [];
  const spaces: string[] = [];
  const walls = project.entities.filter((x): x is WallEnt => x.kind === "wall");
  const opens = project.entities.filter((x): x is OpeningEnt => x.kind === "door" || x.kind === "window");
  const wallRef = new Map<string, { el: string; pl: string; wall: WallEnt }>();
  for (const w of walls) {
    const len = wallLength(w);
    if (len < 1) continue;
    const dx = (w.b.x - w.a.x) / len;
    const dy = (w.b.y - w.a.y) / len;
    const pl = placeAlong(stPl, w.a, dx, dy);
    const shape = box(0, 0, 0, len, w.thickness, w.height);
    const mat = e(`IFCMATERIAL(${ifcStr(w.material || "Wall")})`);
    const layer = e(`IFCMATERIALLAYER(${mat},${f(w.thickness)},$)`);
    const lset = e(`IFCMATERIALLAYERSET((${layer}),$)`);
    const usage = e(`IFCMATERIALLAYERSETUSAGE(${lset},.AXIS2.,.POSITIVE.,${f(-w.thickness / 2)})`);
    const el = e(`IFCWALLSTANDARDCASE('${ifcGuid()}',${oh},${ifcStr(w.name ?? "Wall")},$,$,${pl},${shape},${ifcStr(w.id)})`);
    e(`IFCRELASSOCIATESMATERIAL('${ifcGuid()}',${oh},$,$,(${el}),${usage})`);
    contained.push(el);
    wallRef.set(w.id, { el, pl, wall: w });
  }
  for (const o of opens) {
    const host = wallRef.get(o.wallId);
    if (!host) continue;
    const len = wallLength(host.wall);
    const s0 = Math.max(0, Math.min(o.offset, len));
    const width = Math.max(1, Math.min(o.width, len - s0));
    const sill = o.kind === "door" ? 0 : o.sill;
    const height = Math.max(1, Math.min(o.height, host.wall.height - sill));
    const opPl = e(`IFCLOCALPLACEMENT(${host.pl},${ax3(pt3(s0, 0, sill))})`);
    const opShape = box(0, 0, 0, width, host.wall.thickness + 20, height);
    const op = e(`IFCOPENINGELEMENT('${ifcGuid()}',${oh},'Opening',$,$,${opPl},${opShape},$)`);
    e(`IFCRELVOIDSELEMENT('${ifcGuid()}',${oh},$,$,${host.el},${op})`);
    const fillPl = e(`IFCLOCALPLACEMENT(${opPl},${ax3(pt3(0, 0, 0))})`);
    const fillShape = box(0, 0, 0, width, o.kind === "door" ? 50 : 60, height);
    const fill =
      o.kind === "door"
        ? e(`IFCDOOR('${ifcGuid()}',${oh},${ifcStr(o.name ?? "Door")},$,$,${fillPl},${fillShape},${ifcStr(o.id)},${f(height)},${f(width)})`)
        : e(`IFCWINDOW('${ifcGuid()}',${oh},${ifcStr(o.name ?? "Window")},$,$,${fillPl},${fillShape},${ifcStr(o.id)},${f(height)},${f(width)})`);
    e(`IFCRELFILLSELEMENT('${ifcGuid()}',${oh},$,$,${op},${fill})`);
    contained.push(fill);
  }
  for (const x of project.entities) {
    if (x.kind === "column") {
      const pl = e(`IFCLOCALPLACEMENT(${stPl},${ax3(pt3(x.c.x, x.c.y, 0), zUp, dir3(Math.cos((x.rotation * Math.PI) / 180), Math.sin((x.rotation * Math.PI) / 180), 0))})`);
      const el = e(`IFCCOLUMN('${ifcGuid()}',${oh},${ifcStr(x.name ?? "Column")},$,$,${pl},${box(-x.width / 2, 0, 0, x.width, x.depth, x.height)},${ifcStr(x.id)})`);
      contained.push(el);
    } else if (x.kind === "slab" && x.points.length >= 3) {
      const pl = e(`IFCLOCALPLACEMENT(${stPl},${ax3(pt3(0, 0, 0))})`);
      const el = e(`IFCSLAB('${ifcGuid()}',${oh},${ifcStr(x.name ?? "Slab")},$,$,${pl},${polySolid(x.points, x.elevation - x.thickness, x.thickness)},${ifcStr(x.id)},.FLOOR.)`);
      contained.push(el);
    } else if (x.kind === "room" && x.points.length >= 3) {
      const pl = e(`IFCLOCALPLACEMENT(${stPl},${ax3(pt3(0, 0, 0))})`);
      const el = e(`IFCSPACE('${ifcGuid()}',${oh},${ifcStr(x.name ?? "Space")},${ifcStr(x.occupancy)},$,${pl},${polySolid(x.points, 0, project.wallHeight || 3000)},$,.ELEMENT.,.INTERNAL.,$)`);
      spaces.push(el);
    }
  }
  if (contained.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',${oh},$,$,(${contained.join(",")}),${storey})`);
  if (spaces.length) e(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${storey},(${spaces.join(",")}))`);

  const stamp = date.toISOString().slice(0, 19);
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    `FILE_NAME(${ifcStr(`${project.name}.ifc`)},'${stamp}',(''),('Astranov'),'Astranov BIMCAD','Astranov BIMCAD','');`,
    "FILE_SCHEMA(('IFC2X3'));",
    "ENDSEC;",
    "DATA;",
    ...lines,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bimcad";
}

function save(name: string, data: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportDxf(project: Project) {
  save(`${slug(project.name)}.dxf`, buildDxf(project), "application/dxf");
}
export function exportPdf(project: Project) {
  save(`${slug(project.name)}.pdf`, buildPdf(project) as BlobPart, "application/pdf");
}
export function exportIfc(project: Project) {
  save(`${slug(project.name)}.ifc`, buildIfc(project), "application/x-step");
}
