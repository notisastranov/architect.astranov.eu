export function lonToTileX(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

export function tileBbox(z: number, x: number, y: number) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = tileYToLat(y, z);
  const south = tileYToLat(y + 1, z);
  return { west, south, east, north };
}

function tileYToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/** Globe altitude is in sphere units (Earth radius = 100). */
export function zoomForAlt(alt: number, maxZ: number) {
  const km = Math.max(0.04, alt * 63.71);
  const z = Math.round(Math.log2(40000 / km));
  return Math.max(2, Math.min(maxZ, z));
}

/** XYZ tiles (z, x, y) covering a lat/lon box, capped to `max` tiles by stepping z down. */
export function tilesForBox(
  box: { west: number; south: number; east: number; north: number },
  z0: number,
  minZ = 1,
  max = 48,
) {
  for (let z = z0; z >= minZ; z--) {
    const x0 = lonToTileX(box.west, z);
    const x1 = lonToTileX(box.east, z);
    const y0 = latToTileY(Math.min(85, box.north), z);
    const y1 = latToTileY(Math.max(-85, box.south), z);
    const n = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (n > max && z > minZ) continue;
    const out: { z: number; x: number; y: number }[] = [];
    for (let y = Math.max(0, y0); y <= Math.min(2 ** z - 1, y1); y++) {
      for (let x = x0; x <= x1; x++) out.push({ z, x, y });
    }
    return out;
  }
  return [];
}
