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
  lat: 36.372,
  lon: 28.198,
  cadastre: "Ελληνικό Κτηματολόγιο BASEMAP · αεροφωτογραφία. Το φύλλο που θα μπει κλειδώνει το ίδιο κέντρο.",
};

export const DEFAULT_DECLARATION: ArchitecturalDeclaration = {
  title: "Architectural declaration · Δήλωση αρχιτέκτονα",
  author: "Astranov Architect",
  client: "Owner",
  program: "Μεγάλο δεντρόσπιτο 18 × 12 m στο κέντρο του ελαιώνα",
  statement:
    "Δώδεκα κορμοί ελιάς μένουν ζωντανοί και γίνονται κολόνες. Η κάθαρση από το έδαφος είναι 2,00 m και εκεί τελειώνει η κολόνα: η εξάμετρη δοκός κάθεται κατευθείαν στον κορμό. Το ταβανοδάπεδο είναι ραμποτέ 20 × 200 mm. Αντί τοιχοποιίας, πλέξιγκλας και ασημί ανακλαστική κουρτίνα. Στο δάπεδο-ταβάνι: τζακούζι, ηλιακός, φωτοβολταϊκά. Όταν μπει το τοπογραφικό με τις αεροφωτογραφίες, το ίδιο περίγραμμα δένει στο κέντρο του χωραφιού.",
};

export function siteLine(site: SiteContext) {
  return `${site.name} · ${site.municipality} · ${site.lat.toFixed(5)}° N ${site.lon.toFixed(5)}° E · ${site.cadastre}`;
}
