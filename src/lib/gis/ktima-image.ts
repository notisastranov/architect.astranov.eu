import { fetchKtimaTile } from "./ktima";

type Box = { west: number; south: number; east: number; north: number };

/**
 * One WMS GetMap through the server proxy (EPSG:4326 bbox). The service paints
 * "no data" (sea, outside coverage) pure white, so near-white pixels are keyed
 * out and the imagery underneath shows through instead of a white sheet.
 * Tiles that are ≥90% no-data are dropped entirely.
 */
export async function loadKtimaImage(box: Box): Promise<HTMLCanvasElement | null> {
  const res = await fetchKtimaTile({ data: { ...box, width: 256, height: 256 } });
  if (!res.ok) return null;
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = `data:${res.mime};base64,${res.b64}`;
  });
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  let solid = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i]! > 246 && px[i + 1]! > 246 && px[i + 2]! > 246) px[i + 3] = 0;
    else solid++;
  }
  // Mostly "no data" (open sea, outside coverage): the service still stamps its
  // logo there, so skip the tile and let the imagery underneath show.
  if (solid < (px.length / 4) * 0.1) return null;
  ctx.putImageData(data, 0, 0);
  return c;
}
