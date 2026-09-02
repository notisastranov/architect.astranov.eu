import { dist, polygonArea, wallQuad } from "./geometry";
import type { Project } from "./types";
import { formatMmNum } from "./units";

export function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJson(project: Project) {
  download(
    `${slug(project.name)}.bimcad.json`,
    JSON.stringify(project, null, 2),
    "application/json",
  );
}

export function exportSurveyCsv(project: Project) {
  const rows = ["Code,Easting,Northing,Elevation,Description"];
  for (const e of project.entities) {
    if (e.kind !== "survey") continue;
    rows.push(
      [e.code, formatMmNum(e.e, "m", 3), formatMmNum(e.n, "m", 3), formatMmNum(e.z, "m", 3), csv(e.desc)].join(","),
    );
  }
  download(`${slug(project.name)}.csv`, rows.join("\n"), "text/csv");
}

export function exportSvg(project: Project) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const e of project.entities) {
    if (e.kind === "wall") {
      consider(e.a.x, e.a.y);
      consider(e.b.x, e.b.y);
    } else if (e.kind === "survey") {
      consider(e.e, e.n);
    } else if (e.kind === "rect") {
      consider(e.a.x, e.a.y);
      consider(e.b.x, e.b.y);
    } else if (e.kind === "line" || e.kind === "dim") {
      consider(e.a.x, e.a.y);
      consider(e.b.x, e.b.y);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1000;
    maxY = 1000;
  }
  const pad = Math.max(400, (maxX - minX) * 0.08);
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const W = maxX - minX;
  const H = maxY - minY;
  const yx = (y: number) => maxY - y;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${W} ${H}" width="1200" height="${(1200 * H) / W}">`,
  );
  parts.push(`<rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="#0c0d0e"/>`);
  for (const e of project.entities) {
    if (e.kind === "wall") {
      const q = wallQuad(e);
      const d = q.map((p, i) => `${i ? "L" : "M"}${p.x},${yx(p.y)}`).join(" ") + " Z";
      parts.push(`<path d="${d}" fill="none" stroke="#d2dad3" stroke-width="${Math.max(20, e.thickness * 0.15)}"/>`);
    } else if (e.kind === "line") {
      parts.push(
        `<line x1="${e.a.x}" y1="${yx(e.a.y)}" x2="${e.b.x}" y2="${yx(e.b.y)}" stroke="#9aafa8" stroke-dasharray="80 40" stroke-width="20"/>`,
      );
    } else if (e.kind === "rect") {
      const x = Math.min(e.a.x, e.b.x);
      const y = Math.min(e.a.y, e.b.y);
      parts.push(
        `<rect x="${x}" y="${yx(Math.max(e.a.y, e.b.y))}" width="${Math.abs(e.b.x - e.a.x)}" height="${Math.abs(e.b.y - e.a.y)}" fill="none" stroke="#c5cdc6" stroke-width="20"/>`,
      );
    } else if (e.kind === "circle") {
      parts.push(
        `<circle cx="${e.c.x}" cy="${yx(e.c.y)}" r="${e.r}" fill="none" stroke="#8aa0a8" stroke-width="12"/>`,
      );
    } else if (e.kind === "survey") {
      parts.push(
        `<polygon points="${e.e},${yx(e.n + 180)} ${e.e + 160},${yx(e.n - 120)} ${e.e - 160},${yx(e.n - 120)}" fill="none" stroke="#b8c4bc" stroke-width="24"/>`,
      );
      parts.push(
        `<text x="${e.e + 220}" y="${yx(e.n)}" fill="#ecece8" font-size="280" font-family="IBM Plex Mono, monospace">${escapeXml(e.code)}</text>`,
      );
    } else if (e.kind === "room") {
      const c = e.points.reduce((a, p) => ({ x: a.x + p.x / e.points.length, y: a.y + p.y / e.points.length }), {
        x: 0,
        y: 0,
      });
      const area = polygonArea(e.points);
      parts.push(
        `<text x="${c.x}" y="${yx(c.y)}" fill="#ecece8" text-anchor="middle" font-size="280" font-family="IBM Plex Sans, sans-serif">${escapeXml(e.name ?? "")}</text>`,
      );
      parts.push(
        `<text x="${c.x}" y="${yx(c.y) + 320}" fill="#8c9088" text-anchor="middle" font-size="200" font-family="IBM Plex Mono, monospace">${(area / 1e6).toFixed(1)} m²</text>`,
      );
    } else if (e.kind === "text") {
      parts.push(
        `<text x="${e.p.x}" y="${yx(e.p.y)}" fill="#ecece8" font-size="${e.size}" font-family="IBM Plex Sans, sans-serif">${escapeXml(e.text)}</text>`,
      );
    } else if (e.kind === "dim") {
      parts.push(
        `<line x1="${e.a.x}" y1="${yx(e.a.y)}" x2="${e.b.x}" y2="${yx(e.b.y)}" stroke="#9aafa8" stroke-width="16"/>`,
      );
      const mx = (e.a.x + e.b.x) / 2;
      const my = (e.a.y + e.b.y) / 2;
      parts.push(
        `<text x="${mx}" y="${yx(my) - 80}" fill="#9aafa8" text-anchor="middle" font-size="220" font-family="IBM Plex Mono, monospace">${(dist(e.a, e.b) / 1000).toFixed(2)} m</text>`,
      );
    }
  }
  parts.push("</svg>");
  download(`${slug(project.name)}.svg`, parts.join("\n"), "image/svg+xml");
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bimcad";
}
function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function escapeXml(s: string) {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
