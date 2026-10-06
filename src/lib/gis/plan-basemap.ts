import { screenToWorld, worldToScreen, type Cam } from "@/lib/cad/draw2d";
import type { ProjectSite } from "@/lib/cad/types";
import { providerById, tileUrl } from "./layers";
import { loadKtimaImage } from "./ktima-image";
import { inGreece } from "./ktima";
import { tileBbox, tilesForBox } from "./slippy";
import { latLonToPlan, planToLatLon } from "./site";

type Tile = HTMLImageElement | HTMLCanvasElement;
const cache = new Map<string, Tile | "pending" | "fail">();

function remember(key: string, v: Tile | "pending" | "fail") {
  cache.set(key, v);
  if (cache.size > 600) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest) cache.delete(oldest);
  }
}

/** Plan-view basemaps: real XYZ tiles or the Ktimatologio WMS, placed by the project site. */
export const PLAN_BASEMAPS = ["none", "osm", "esri-imagery", "esri-topo", "opentopo", "BASEMAP"] as const;

/**
 * Paint basemap tiles under the plan. Plan origin is the project site; tiles
 * are positioned on a local tangent plane (east = +X, north = +Y, millimetres).
 * Returns the attribution to print, or null when nothing is drawn.
 */
export function paintBasemap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  site: ProjectSite,
  id: string,
  opacity: number,
  onLoad: () => void,
): string | null {
  if (id === "none") return null;
  const p = providerById(id);
  if (p.kind === "base") return null;
  const wms = p.kind === "wms";
  if (wms && !inGreece(site.lat, site.lon)) return null;
  const tl = screenToWorld({ x: 0, y: 0 }, cam, w, h);
  const br = screenToWorld({ x: w, y: h }, cam, w, h);
  const nw = planToLatLon(site, tl.x, tl.y);
  const se = planToLatLon(site, br.x, br.y);
  const box = { west: nw.lon, east: se.lon, north: nw.lat, south: se.lat };
  const metresPerPx = 1 / cam.zoom / 1000;
  const ideal = Math.log2((156543.03 * Math.cos((site.lat * Math.PI) / 180)) / metresPerPx);
  const z = Math.max(1, Math.min(p.maxZ, Math.round(ideal)));
  const tiles = tilesForBox(box, z, 1, 64);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = true;
  for (const t of tiles) {
    const key = `${p.id}:${t.z}:${t.x}:${t.y}`;
    const bb = tileBbox(t.z, t.x, t.y);
    const hit = cache.get(key);
    if (hit === undefined) {
      remember(key, "pending");
      if (wms) {
        void loadKtimaImage(bb)
          .then((c) => {
            remember(key, c ?? "fail");
            if (c) onLoad();
          })
          .catch(() => remember(key, "fail"));
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          remember(key, img);
          onLoad();
        };
        img.onerror = () => remember(key, "fail");
        img.src = tileUrl(p, t.z, t.x, t.y);
      }
      continue;
    }
    if (hit === "pending" || hit === "fail") continue;
    const a = worldToScreen(latLonToPlan(site, bb.north, bb.west), cam, w, h);
    const b = worldToScreen(latLonToPlan(site, bb.south, bb.east), cam, w, h);
    ctx.drawImage(hit, a.x, a.y, b.x - a.x, b.y - a.y);
  }
  ctx.restore();
  return wms ? `${p.attribution} · WMS` : p.attribution;
}
