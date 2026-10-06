import type { Project, ProjectSite } from "@/lib/cad/types";
import { RHODES } from "./ktima";

/** The app's home ground when a project has not been placed on Earth yet. */
export const HOME_SITE: ProjectSite = { lat: RHODES.lat, lon: RHODES.lon, label: "Rhodes · default site" };

export function projectSite(p: Pick<Project, "site">): ProjectSite {
  return p.site ?? HOME_SITE;
}

/** Metres per degree of latitude on the WGS84 mean sphere. */
const M_PER_DEG = 111_320;

/**
 * Local plan ↔ WGS84 on a tangent plane at the site. Plan origin (0,0) sits on
 * the site; +X is east, +Y is north, plan units are millimetres. Good to a few
 * millimetres per hundred metres, which is the scale of a building plot.
 */
export function planToLatLon(site: ProjectSite, x: number, y: number) {
  const lat = site.lat + y / 1000 / M_PER_DEG;
  const lon = site.lon + x / 1000 / (M_PER_DEG * Math.cos((site.lat * Math.PI) / 180));
  return { lat, lon };
}

export function latLonToPlan(site: ProjectSite, lat: number, lon: number) {
  const y = (lat - site.lat) * M_PER_DEG * 1000;
  const x = (lon - site.lon) * M_PER_DEG * Math.cos((site.lat * Math.PI) / 180) * 1000;
  return { x, y };
}
