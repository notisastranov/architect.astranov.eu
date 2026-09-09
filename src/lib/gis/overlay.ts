import { nid } from "@/lib/cad/geometry";
import type { Pt } from "@/lib/cad/types";
import { guessPrintedScale } from "./igm";

export type OverlayRole = "parent" | "single" | "mosaic";
export type OverlayMode = "idle" | "gcp-img" | "gcp-map";

export interface OverlayGcp {
  id: string;
  imgX: number;
  imgY: number;
  x?: number;
  y?: number;
  lon?: number;
  lat?: number;
}

export interface OverlayAffine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface OverlaySheet {
  id: string;
  name: string;
  role: OverlayRole;
  parentId: string | null;
  src: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  printedScale: number;
  dpi: number;
  ox: number;
  oy: number;
  rotationDeg: number;
  scaleMmPerPx: number;
  gcps: OverlayGcp[];
  igmId?: string;
  geo?: { west: number; south: number; east: number; north: number };
}

const images = new Map<string, HTMLImageElement>();

export function rememberOverlayImage(id: string, src: string): HTMLImageElement {
  const existing = images.get(id);
  if (existing && existing.src === src) return existing;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  images.set(id, img);
  return img;
}

export function overlayImage(id: string): HTMLImageElement | undefined {
  return images.get(id);
}

export function forgetOverlayImage(id: string) {
  const img = images.get(id);
  if (img?.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  images.delete(id);
}

export function mmPerPixel(printedScale: number, dpi: number): number {
  return (25.4 / Math.max(1, dpi)) * printedScale;
}

export function applyPrintedScale(sheet: OverlaySheet, printedScale: number, dpi = sheet.dpi): OverlaySheet {
  return { ...sheet, printedScale, dpi, scaleMmPerPx: mmPerPixel(printedScale, dpi) };
}

export async function sheetFromFile(file: File, role: OverlayRole = "single"): Promise<OverlaySheet> {
  const src = URL.createObjectURL(file);
  const dims = await readImageSize(src);
  const printedScale = guessPrintedScale(file.name);
  const dpi = 300;
  const id = nid("map");
  rememberOverlayImage(id, src);
  return {
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    role: /unione|quadro|index|mosaic/i.test(file.name) ? "parent" : role,
    parentId: null,
    src,
    width: dims.w,
    height: dims.h,
    visible: true,
    opacity: 0.72,
    printedScale,
    dpi,
    ox: 0,
    oy: 0,
    rotationDeg: 0,
    scaleMmPerPx: mmPerPixel(printedScale, dpi),
    gcps: [],
  };
}

function readImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read scan"));
    img.src = src;
  });
}

export function parseWorldFile(text: string): OverlayAffine | null {
  const n = text
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((v) => Number.isFinite(v));
  if (n.length < 6) return null;
  return { a: n[0]!, d: n[1]!, b: n[2]!, e: n[3]!, c: n[4]!, f: n[5]! };
}

export function applyAffine(aff: OverlayAffine, x: number, y: number): Pt {
  return { x: aff.a * x + aff.b * y + aff.c, y: aff.d * x + aff.e * y + aff.f };
}

export function similarity(from: Pt[], to: Pt[]): OverlayAffine | null {
  if (from.length < 2 || to.length < 2) return null;
  const a0 = from[0]!;
  const a1 = from[1]!;
  const b0 = to[0]!;
  const b1 = to[1]!;
  const vx = a1.x - a0.x;
  const vy = a1.y - a0.y;
  const ux = b1.x - b0.x;
  const uy = b1.y - b0.y;
  const sl = Math.hypot(vx, vy);
  if (sl < 1e-9) return null;
  const s = Math.hypot(ux, uy) / sl;
  const ang = Math.atan2(uy, ux) - Math.atan2(vy, vx);
  const ca = Math.cos(ang) * s;
  const sa = Math.sin(ang) * s;
  return {
    a: ca,
    b: -sa,
    c: b0.x - (ca * a0.x - sa * a0.y),
    d: sa,
    e: ca,
    f: b0.y - (sa * a0.x + ca * a0.y),
  };
}

export function sheetPlacement(sheet: OverlaySheet): OverlayAffine {
  const paired = sheet.gcps.filter((g) => g.x != null && g.y != null);
  if (paired.length >= 2) {
    const aff = similarity(
      paired.map((g) => ({ x: g.imgX, y: g.imgY })),
      paired.map((g) => ({ x: g.x!, y: g.y! })),
    );
    if (aff) return aff;
  }
  const s = sheet.scaleMmPerPx;
  const rad = (sheet.rotationDeg * Math.PI) / 180;
  const ca = Math.cos(rad) * s;
  const sa = Math.sin(rad) * s;
  return {
    a: ca,
    b: sa,
    c: sheet.ox,
    d: sa,
    e: -ca,
    f: sheet.oy,
  };
}

export function imgToPlan(sheet: OverlaySheet, imgX: number, imgY: number): Pt {
  return applyAffine(sheetPlacement(sheet), imgX, imgY);
}

export function planToImg(sheet: OverlaySheet, p: Pt): Pt {
  const aff = sheetPlacement(sheet);
  const det = aff.a * aff.e - aff.b * aff.d;
  if (Math.abs(det) < 1e-12) return { x: 0, y: 0 };
  const x = p.x - aff.c;
  const y = p.y - aff.f;
  return { x: (aff.e * x - aff.b * y) / det, y: (-aff.d * x + aff.a * y) / det };
}

export function sheetCornersPlan(sheet: OverlaySheet): Pt[] {
  const w = sheet.width;
  const h = sheet.height;
  return [
    imgToPlan(sheet, 0, 0),
    imgToPlan(sheet, w, 0),
    imgToPlan(sheet, w, h),
    imgToPlan(sheet, 0, h),
  ];
}

export function hitOverlay(sheets: OverlaySheet[], world: Pt): OverlaySheet | null {
  for (let i = sheets.length - 1; i >= 0; i--) {
    const s = sheets[i]!;
    if (!s.visible) continue;
    const p = planToImg(s, world);
    if (p.x >= 0 && p.y >= 0 && p.x <= s.width && p.y <= s.height) return s;
  }
  return null;
}

export function geoFromGcps(sheet: OverlaySheet): OverlaySheet["geo"] | undefined {
  const paired = sheet.gcps.filter((g) => g.lon != null && g.lat != null);
  if (paired.length < 2) return sheet.geo;
  const aff = similarity(
    paired.map((g) => ({ x: g.imgX, y: g.imgY })),
    paired.map((g) => ({ x: g.lon!, y: g.lat! })),
  );
  if (!aff) return sheet.geo;
  const corners = [
    applyAffine(aff, 0, 0),
    applyAffine(aff, sheet.width, 0),
    applyAffine(aff, sheet.width, sheet.height),
    applyAffine(aff, 0, sheet.height),
  ];
  return {
    west: Math.min(...corners.map((c) => c.x)),
    east: Math.max(...corners.map((c) => c.x)),
    south: Math.min(...corners.map((c) => c.y)),
    north: Math.max(...corners.map((c) => c.y)),
  };
}

export function assembleCollage(sheets: OverlaySheet[]): OverlaySheet[] {
  if (sheets.length < 2) return sheets;
  const parent = sheets.find((s) => s.role === "parent") ?? sheets[0]!;
  const kids = sheets.filter((s) => s.id !== parent.id);
  const cellW = Math.max(...kids.map((s) => s.width * s.scaleMmPerPx), parent.width * parent.scaleMmPerPx);
  const cellH = Math.max(...kids.map((s) => s.height * s.scaleMmPerPx), parent.height * parent.scaleMmPerPx);
  const cols = kids.length <= 2 ? kids.length : 2;
  return sheets.map((s) => {
    if (s.id === parent.id) {
      return { ...s, role: "parent", ox: 0, oy: cellH * Math.ceil(kids.length / cols), parentId: null };
    }
    const i = kids.findIndex((k) => k.id === s.id);
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...s,
      role: "single" as const,
      parentId: parent.id,
      ox: col * cellW,
      oy: (Math.ceil(kids.length / cols) - 1 - row) * cellH,
      rotationDeg: 0,
    };
  });
}
