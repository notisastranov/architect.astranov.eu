import { waybackProvider } from "./wayback";

export interface GlobeProvider {
  id: string;
  name: string;
  kind: "xyz" | "wms" | "base";
  url?: string;
  yFirst?: boolean;
  maxZ: number;
  attribution: string;
}

export const GLOBE_PROVIDERS: GlobeProvider[] = [
  { id: "marble", name: "Blue Marble", kind: "base", maxZ: 4, attribution: "NASA Blue Marble" },
  {
    id: "esri-imagery",
    name: "Esri imagery",
    kind: "xyz",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    yFirst: true,
    maxZ: 18,
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "esri-topo",
    name: "Esri topo",
    kind: "xyz",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    yFirst: true,
    maxZ: 16,
    attribution: "Esri, HERE, Garmin, USGS, NPS",
  },
  {
    id: "opentopo",
    name: "OpenTopoMap",
    kind: "xyz",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZ: 15,
    attribution: "OpenTopoMap (© OSM, SRTM)",
  },
  {
    id: "osm",
    name: "OSM",
    kind: "xyz",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZ: 18,
    attribution: "© OpenStreetMap contributors",
  },
  { id: "BASEMAP", name: "Ktimatologio", kind: "wms", maxZ: 18, attribution: "Ελληνικό Κτηματολόγιο" },
];

export function providerById(id: string) {
  if (id.startsWith("wb:")) return waybackProvider(id.slice(3));
  return GLOBE_PROVIDERS.find((p) => p.id === id) ?? GLOBE_PROVIDERS[1]!;
}

export function tileUrl(p: GlobeProvider, z: number, x: number, y: number) {
  return (p.url ?? "").replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
