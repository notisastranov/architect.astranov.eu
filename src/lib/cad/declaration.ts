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
  name: "Δεντρόσπιτο Μαρμαράδες",
  municipality: "Κοσκινού · Δ.Ε. Καλλιθέας · Ρόδος",
  plot: "Κέντρο χωραφιού, ελαιώνας Μαρμαράδων. Η αρχή του σχεδίου είναι το κέντρο του σπιτιού.",
  lat: 36.38752,
  lon: 28.2225,
  cadastre: "Κ.Μ. 257 Γαιών Κοσκινού · τόμος 3 · φύλλο 102 · φάκελος 496 · τοπογραφικό 10.04.2024",
};

export const DEFAULT_DECLARATION: ArchitecturalDeclaration = {
  title: "Architectural declaration · Δήλωση αρχιτέκτονα",
  author: "Astranov Architect",
  client: "Owner",
  program: "Μεγάλο δεντρόσπιτο 18 × 12 m στο κέντρο του ελαιώνα",
  statement:
    "Το δεντρόσπιτο κάθεται στο γεωμετρικό κέντρο της Κ.Μ. 257 Γαιών Κοσκινού, όπως κλείνει από τις κορυφές 1 έως 19 του τοπογραφικού της 10.04.2024. Ε 878647,887 · Ν 4034931,433 (ΕΓΣΑ ’87). Ο τίτλος γράφει 3.910,00 m². Οι ίδιες κορυφές δίνουν δακτύλιο 3.836,23 m². Το 18 × 12 m χωράει: το κοντινότερο όριο είναι 13,57 m. Το φύλλο βεβαιώνει ότι η μερίδα είναι εκτός οικισμού, μη άρτια και μη οικοδομήσιμη.",
};

export function siteLine(site: SiteContext) {
  return `${site.name} · ${site.municipality} · ${site.lat.toFixed(5)}° N ${site.lon.toFixed(5)}° E · ${site.cadastre}`;
}
