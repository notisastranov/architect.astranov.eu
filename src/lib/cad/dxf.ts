import { nid } from "./geometry";
import type { Entity, Project } from "./types";
import { download } from "./export";

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** AutoCAD ASCII DXF, millimetres, the drawing only. */
export function exportDxf(project: Project) {
  const lines: string[] = ["0", "SECTION", "2", "ENTITIES"];
  const push = (...pairs: (string | number)[]) => {
    for (let i = 0; i < pairs.length; i += 2) {
      lines.push(String(pairs[i]), String(pairs[i + 1]));
    }
  };
  for (const e of project.entities) {
    const layer = e.layerId || "0";
    if ((e.kind === "line" || e.kind === "wall" || e.kind === "dim") && "a" in e && "b" in e) {
      push("0", "LINE", "8", layer, "10", e.a.x, "20", e.a.y, "30", 0, "11", e.b.x, "21", e.b.y, "31", 0);
    } else if (e.kind === "polyline" || e.kind === "slab" || e.kind === "room") {
      const pts = e.points;
      if (pts.length < 2) continue;
      push("0", "LWPOLYLINE", "8", layer, "90", pts.length, "70", e.kind === "polyline" && !e.closed ? 0 : 1);
      for (const p of pts) push("10", p.x, "20", p.y);
    } else if (e.kind === "circle") {
      push("0", "CIRCLE", "8", layer, "10", e.c.x, "20", e.c.y, "30", 0, "40", e.r);
    } else if (e.kind === "column") {
      push("0", "CIRCLE", "8", layer, "10", e.c.x, "20", e.c.y, "30", 0, "40", Math.max(e.width, e.depth) / 2);
    } else if (e.kind === "text") {
      push("0", "TEXT", "8", layer, "10", e.p.x, "20", e.p.y, "30", 0, "40", e.size, "1", e.text);
    } else if (e.kind === "survey") {
      push("0", "POINT", "8", layer, "10", e.e, "20", e.n, "30", e.z);
    }
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  download(`${project.name.replace(/\s+/g, "-")}.dxf`, lines.join("\n"), "application/dxf");
}

/** Reads LINE, LWPOLYLINE, CIRCLE and TEXT from an ASCII DXF. */
export function importDxf(text: string): Entity[] {
  const rows = text.split(/\r?\n/).map((s) => s.trim());
  const out: Entity[] = [];
  let i = 0;
  const pair = () => {
    const code = rows[i++] ?? "";
    const value = rows[i++] ?? "";
    return { code, value };
  };
  while (i < rows.length - 1) {
    const start = pair();
    if (start.code !== "0") continue;
    const kind = start.value.toUpperCase();
    if (!["LINE", "LWPOLYLINE", "CIRCLE", "TEXT", "POINT"].includes(kind)) continue;
    let layer = "site";
    let x = 0;
    let y = 0;
    let x2 = 0;
    let y2 = 0;
    let r = 0;
    let size = 200;
    let label = "";
    const pts: { x: number; y: number }[] = [];
    let closed = false;
    while (i < rows.length - 1) {
      const look = rows[i];
      if (look === "0") break;
      const { code, value } = pair();
      if (code === "8") layer = value || "site";
      else if (code === "10") {
        x = num(value);
        pts.push({ x, y: 0 });
      } else if (code === "20") {
        y = num(value);
        const last = pts[pts.length - 1];
        if (last) last.y = y;
      } else if (code === "11") x2 = num(value);
      else if (code === "21") y2 = num(value);
      else if (code === "40") {
        const n = num(value);
        if (kind === "CIRCLE") r = n;
        else size = n || 200;
      } else if (code === "1") label = value;
      else if (code === "70" && kind === "LWPOLYLINE") closed = (num(value) & 1) === 1;
    }
    const id = nid("dxf");
    if (kind === "LINE") out.push({ id, kind: "line", layerId: "site", a: { x, y }, b: { x: x2, y: y2 } });
    else if (kind === "CIRCLE") out.push({ id, kind: "circle", layerId: "site", c: { x, y }, r: r || 100 });
    else if (kind === "TEXT" && label) out.push({ id, kind: "text", layerId: "notes", p: { x, y }, text: label, size, rotation: 0 });
    else if (kind === "POINT") out.push({ id, kind: "survey", layerId: "site", name: label || id, e: x, n: y, z: 0, code: id.slice(-4), desc: "DXF point" });
    else if (kind === "LWPOLYLINE" && pts.length >= 2) out.push({ id, kind: "polyline", layerId: "site", points: pts, closed });
    void layer;
  }
  return out;
}
