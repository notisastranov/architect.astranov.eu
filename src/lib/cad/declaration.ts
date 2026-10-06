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

/** Empty until the owner fills it in. Coordinates come from the project site. */
export const DEFAULT_SITE: SiteContext = {
  name: "",
  municipality: "",
  plot: "",
  lat: 36.434,
  lon: 28.217,
  cadastre: "",
};

export const DEFAULT_DECLARATION: ArchitecturalDeclaration = {
  title: "Architectural declaration · Δήλωση αρχιτέκτονα",
  author: "",
  client: "",
  program: "",
  statement: "",
};

export function siteLine(site: SiteContext) {
  return [site.name, site.municipality, `${site.lat.toFixed(5)}° N ${site.lon.toFixed(5)}° E`, site.cadastre]
    .filter((x) => x && x.trim())
    .join(" · ");
}
