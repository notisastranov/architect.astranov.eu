/** Italian IGM sheet hierarchy and Rhodes occupation series. */

export type IgmCardinal = "I" | "II" | "III" | "IV";
export type IgmCorner = "N.O." | "N.E." | "S.O." | "S.E.";

export interface IgmSheet {
  id: string;
  kind: "foglio" | "quadrante" | "tavoletta";
  scale: 100000 | 50000 | 25000;
  west: number;
  south: number;
  east: number;
  north: number;
}

const FOGLIO_DLON = 30 / 60;
const FOGLIO_DLAT = 20 / 60;

const QUAD_ORDER: IgmCardinal[] = ["I", "II", "III", "IV"];
const CORNER_ORDER: IgmCorner[] = ["N.O.", "N.E.", "S.O.", "S.E."];

/** Origin of the classic Carta d'Italia 1:100 000 grid (approx. official IGM cut). */
const GRID_WEST = 6.5;
const GRID_SOUTH = 35.9166667;

export function parseIgmId(raw: string): { foglio: number; quad?: IgmCardinal; corner?: IgmCorner } | null {
  const t = raw.trim().toUpperCase().replace(/FOGLIO|F\./g, "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(\d{1,3})(?:\s+(I{1,3}|IV))?(?:\s+(N\.?[OE]|S\.?[OE]|N\.O\.|N\.E\.|S\.O\.|S\.E\.))?$/);
  if (!m) return null;
  const foglio = Number(m[1]);
  const quad = m[2] as IgmCardinal | undefined;
  let corner: IgmCorner | undefined;
  if (m[3]) {
    const c = m[3].replace(/\./g, "");
    corner = c === "NO" ? "N.O." : c === "NE" ? "N.E." : c === "SO" ? "S.O." : "S.E.";
  }
  return { foglio, quad, corner };
}

export function igmFoglioOrigin(n: number): { west: number; south: number } {
  const col = (n - 1) % 16;
  const row = Math.floor((n - 1) / 16);
  return { west: GRID_WEST + col * FOGLIO_DLON, south: GRID_SOUTH + row * FOGLIO_DLAT };
}

export function igmSheet(id: string): IgmSheet | null {
  const p = parseIgmId(id);
  if (!p) return null;
  const o = igmFoglioOrigin(p.foglio);
  let west = o.west;
  let south = o.south;
  let dlon = FOGLIO_DLON;
  let dlat = FOGLIO_DLAT;
  let kind: IgmSheet["kind"] = "foglio";
  let scale: IgmSheet["scale"] = 100000;
  if (p.quad) {
    const qi = QUAD_ORDER.indexOf(p.quad);
    const qx = qi % 2;
    const qy = qi < 2 ? 1 : 0;
    dlon = FOGLIO_DLON / 2;
    dlat = FOGLIO_DLAT / 2;
    west = o.west + qx * dlon;
    south = o.south + qy * dlat;
    kind = "quadrante";
    scale = 50000;
  }
  if (p.quad && p.corner) {
    const ci = CORNER_ORDER.indexOf(p.corner);
    const cx = ci % 2;
    const cy = ci < 2 ? 1 : 0;
    dlon = FOGLIO_DLON / 4;
    dlat = FOGLIO_DLAT / 4;
    west = west + cx * dlon;
    south = south + cy * dlat;
    kind = "tavoletta";
    scale = 25000;
  }
  return {
    id: `F.${p.foglio}${p.quad ? ` ${p.quad}` : ""}${p.corner ? ` ${p.corner}` : ""}`.
      replace(/\s+/g, " ")
      .trim(),
    kind,
    scale,
    west,
    south,
    east: west + dlon,
    north: south + dlat,
  };
}

export function igmChildrenLayout(kind: IgmSheet["kind"]): { key: string; col: number; row: number }[] {
  if (kind === "foglio") {
    return QUAD_ORDER.map((q, i) => ({ key: q, col: i % 2, row: i < 2 ? 0 : 1 }));
  }
  return CORNER_ORDER.map((c, i) => ({ key: c, col: i % 2, row: i < 2 ? 0 : 1 }));
}

/** IGM Carta dell'isola di Rodi / AMS M801 copies of 1924–34 Italian 1:25 000. */
export const RHODES_IGM = {
  name: "Carta dell'isola di Rodi",
  survey: "1922, aggiornata 1935",
  scale: 25000,
  west: 27.68,
  south: 35.84,
  east: 28.28,
  north: 36.48,
} as const;

export function guessPrintedScale(name: string): number {
  const n = name.toLowerCase();
  if (/1\s*[:\/]\s*1\s*000|1k|catasto|particell/.test(n)) return 1000;
  if (/1\s*[:\/]\s*2\s*000|foglio di mappa/.test(n)) return 2000;
  if (/1\s*[:\/]\s*5\s*000/.test(n)) return 5000;
  if (/1\s*[:\/]\s*10\s*000/.test(n)) return 10000;
  if (/50\s*000|quadrante/.test(n)) return 50000;
  if (/100\s*000|foglio[^i]|quadro/.test(n)) return 100000;
  if (/25\s*000|tavoletta|25v/.test(n)) return 25000;
  return 25000;
}
