import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Official Hellenic Cadastre public WMS (orthophoto / topographic basemap). */
export const KTIMA_WMS = "https://gis.ktimanet.gr/wms/wmsopen/wmsserver.aspx";
export const KTIMA_LAYER = "BASEMAP";
export const KTIMA_HOME = "https://www.ktimatologio.gr";

/** Approximate coverage of the Ktimatologio WMS. */
export const GREECE_BBOX = { west: 19.153, south: 32.4, east: 31.962, north: 41.625 };

export const RHODES = { lat: 36.434, lon: 28.217 };

export function inGreece(lat: number, lon: number, pad = 0.4) {
  return (
    lon >= GREECE_BBOX.west - pad &&
    lon <= GREECE_BBOX.east + pad &&
    lat >= GREECE_BBOX.south - pad &&
    lat <= GREECE_BBOX.north + pad
  );
}

export interface GeoTile {
  key: string;
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Geographic tiles around a look-at point. Span shrinks as the camera closes in. */
export function tilesAround(lat: number, lon: number, spanDeg: number, grid = 2): GeoTile[] {
  const west0 = lon - spanDeg / 2;
  const south0 = lat - spanDeg / 2;
  const step = spanDeg / grid;
  const tiles: GeoTile[] = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const west = west0 + j * step;
      const south = south0 + i * step;
      const east = west + step;
      const north = south + step;
      if (east < GREECE_BBOX.west || west > GREECE_BBOX.east) continue;
      if (north < GREECE_BBOX.south || south > GREECE_BBOX.north) continue;
      const tile: GeoTile = {
        key: `${west.toFixed(5)},${south.toFixed(5)},${east.toFixed(5)},${north.toFixed(5)}`,
        west,
        south,
        east,
        north,
      };
      tiles.push(tile);
    }
  }
  return tiles;
}

const Input = z.object({
  west: z.number(),
  south: z.number(),
  east: z.number(),
  north: z.number(),
  width: z.number().int().min(64).max(1024).optional(),
  height: z.number().int().min(64).max(1024).optional(),
});

export const fetchKtimaTile = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; mime: string; b64: string } | { ok: false; error: string }> => {
    const west = Math.min(data.west, data.east);
    const east = Math.max(data.west, data.east);
    const south = Math.min(data.south, data.north);
    const north = Math.max(data.south, data.north);
    if (east - west > 12 || north - south > 12) {
      return { ok: false, error: "bbox too large" };
    }
    if (east < GREECE_BBOX.west - 1 || west > GREECE_BBOX.east + 1) {
      return { ok: false, error: "outside Greece" };
    }
    const width = data.width ?? 512;
    const height = data.height ?? 512;
    const qs = new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.1.0",
      REQUEST: "GetMap",
      LAYERS: KTIMA_LAYER,
      STYLES: "",
      SRS: "EPSG:4326",
      BBOX: `${west},${south},${east},${north}`,
      WIDTH: String(width),
      HEIGHT: String(height),
      FORMAT: "image/jpeg",
    });
    const res = await fetch(`${KTIMA_WMS}?${qs.toString()}`, {
      headers: { Accept: "image/jpeg" },
    });
    if (!res.ok) return { ok: false, error: `WMS ${res.status}` };
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    if (!mime.startsWith("image/")) return { ok: false, error: "WMS did not return an image" };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 800) return { ok: false, error: "empty tile" };
    return { ok: true, mime, b64: buf.toString("base64") };
  });
