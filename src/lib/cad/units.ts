import type { Pt, UnitSystem } from "./types";

/** Internal storage is always millimetres. */

export function mmToUnit(mm: number, unit: UnitSystem): number {
  switch (unit) {
    case "mm":
      return mm;
    case "cm":
      return mm / 10;
    case "m":
      return mm / 1000;
    case "ft":
      return mm / 304.8;
  }
}

export function unitToMm(value: number, unit: UnitSystem): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "m":
      return value * 1000;
    case "ft":
      return value * 304.8;
  }
}

export function unitLabel(unit: UnitSystem): string {
  return unit;
}

export function precisionFor(unit: UnitSystem): number {
  switch (unit) {
    case "mm":
      return 1;
    case "cm":
      return 2;
    case "m":
      return 3;
    case "ft":
      return 4;
  }
}

export function formatMm(mm: number, unit: UnitSystem, digits?: number): string {
  if (!Number.isFinite(mm)) return "—";
  const d = digits ?? precisionFor(unit);
  if (unit === "ft") {
    const totalIn = mm / 25.4;
    const sign = totalIn < 0 ? "-" : "";
    const abs = Math.abs(totalIn);
    const feet = Math.floor(abs / 12);
    const inches = abs - feet * 12;
    return `${sign}${feet}'-${inches.toFixed(2)}"`;
  }
  const v = mmToUnit(mm, unit);
  const abs = Math.abs(v);
  const body = abs.toFixed(d);
  return `${v < 0 ? "-" : ""}${body} ${unit}`;
}

export function formatMmNum(mm: number, unit: UnitSystem, digits?: number): string {
  if (!Number.isFinite(mm)) return "—";
  const d = digits ?? precisionFor(unit);
  return mmToUnit(mm, unit).toFixed(d);
}

export function formatArea(mm2: number, unit: UnitSystem): string {
  if (!Number.isFinite(mm2)) return "—";
  if (unit === "m") return `${(mm2 / 1e6).toFixed(2)} m²`;
  if (unit === "ft") return `${(mm2 / 92903.04).toFixed(2)} ft²`;
  if (unit === "cm") return `${(mm2 / 100).toFixed(1)} cm²`;
  return `${mm2.toFixed(0)} mm²`;
}

export function formatVol(mm3: number, unit: UnitSystem): string {
  if (unit === "m") return `${(mm3 / 1e9).toFixed(3)} m³`;
  if (unit === "ft") return `${(mm3 / 28316846.6).toFixed(3)} ft³`;
  return `${(mm3 / 1000).toFixed(1)} cm³`;
}

export function formatCoord(p: Pt, unit: UnitSystem): string {
  return `${formatMmNum(p.x, unit)} , ${formatMmNum(p.y, unit)} ${unit}`;
}

export function parseLength(input: string, unit: UnitSystem): number | null {
  const t = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const m = t.match(/^(-?\d+(?:\.\d+)?)(mm|cm|m|ft|'|")?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = m[2];
  if (!u) return unitToMm(n, unit);
  if (u === "mm") return n;
  if (u === "cm") return n * 10;
  if (u === "m") return n * 1000;
  if (u === "ft" || u === "'") return n * 304.8;
  if (u === '"') return n * 25.4;
  return unitToMm(n, unit);
}

export function parsePoint(input: string, unit: UnitSystem, origin?: Pt): Pt | null {
  const t = input.trim();
  const polar = t.match(/^@\s*(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (polar && origin) {
    const r = unitToMm(Number(polar[1]), unit);
    const ang = (Number(polar[2]) * Math.PI) / 180;
    if (!Number.isFinite(r) || !Number.isFinite(ang)) return null;
    return { x: origin.x + r * Math.cos(ang), y: origin.y + r * Math.sin(ang) };
  }
  const rel = t.match(/^@\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (rel && origin) {
    const x = unitToMm(Number(rel[1]), unit);
    const y = unitToMm(Number(rel[2]), unit);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: origin.x + x, y: origin.y + y };
  }
  const abs = t.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!abs) return null;
  const x = unitToMm(Number(abs[1]), unit);
  const y = unitToMm(Number(abs[2]), unit);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
