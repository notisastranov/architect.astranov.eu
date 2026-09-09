export interface SiteContext {
  name: string;
  municipality: string;
  plot: string;
  lat: number;
  lon: number;
  cadastre: string;
}

export interface ArchitecturalDeclaration {
  title: string;
  author: string;
  client: string;
  program: string;
  statement: string;
}

export const DEFAULT_SITE: SiteContext = {
  name: "Rose Stone Villa",
  municipality: "Rhodes / Ρόδος",
  plot: "Own property on the live Hellenic Cadastre sheet",
  lat: 36.434,
  lon: 28.217,
  cadastre: "Ελληνικό Κτηματολόγιο BASEMAP · IGM Carta dell'isola di Rodi 1922/35",
};

export const DEFAULT_DECLARATION: ArchitecturalDeclaration = {
  title: "Architectural declaration · Δήλωση αρχιτέκτονα",
  author: "Astranov Architect",
  client: "Owner",
  program: "Residence and landscape on the registered plot",
  statement:
    "The proposal sits on the real topographic diagram of the area — Hellenic Cadastre orthophoto and, where they survive, the Italian IGM sheets of Rhodes. Development and building are drawn in millimetres on that ground. The owner may edit the BIM; the film begins from the whole map and focuses down to the finished work.",
};

export function siteLine(site: SiteContext) {
  return `${site.name} · ${site.municipality} · ${site.lat.toFixed(5)}° N ${site.lon.toFixed(5)}° E · ${site.cadastre}`;
}
