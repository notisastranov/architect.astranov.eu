/** WGS84 ellipsoid. Distances are geodesic, not a flat-Earth shortcut. */
export const WGS84_A = 6378137;
export const WGS84_F = 1 / 298.257223563;
export const WGS84_B = WGS84_A * (1 - WGS84_F);

export interface GeoPt {
  lat: number;
  lon: number;
  label?: string;
}

export interface MathStep {
  name: string;
  formula: string;
  value: string;
}

export interface SegmentMath {
  metres: number;
  bearingDeg: number;
  steps: MathStep[];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Vincenty inverse on WGS84. Falls back to haversine if it does not converge. */
export function geodesic(a: GeoPt, b: GeoPt): SegmentMath {
  const f = WGS84_F;
  const L = rad(b.lon - a.lon);
  const U1 = Math.atan((1 - f) * Math.tan(rad(a.lat)));
  const U2 = Math.atan((1 - f) * Math.tan(rad(b.lat)));
  const sU1 = Math.sin(U1);
  const cU1 = Math.cos(U1);
  const sU2 = Math.sin(U2);
  const cU2 = Math.cos(U2);
  let lam = L;
  let lamPrev = 0;
  let cosSq = 0;
  let sinS = 0;
  let cosS = 0;
  let sigma = 0;
  let cos2 = 0;
  for (let i = 0; i < 80; i++) {
    const sinLam = Math.sin(lam);
    const cosLam = Math.cos(lam);
    sinS = Math.hypot(cU2 * sinLam, cU1 * sU2 - sU1 * cU2 * cosLam);
    if (sinS === 0) break;
    cosS = sU1 * sU2 + cU1 * cU2 * cosLam;
    sigma = Math.atan2(sinS, cosS);
    const sinA = (cU1 * cU2 * sinLam) / sinS;
    cosSq = 1 - sinA * sinA;
    cos2 = cosSq === 0 ? 0 : cosS - (2 * sU1 * sU2) / cosSq;
    const C = (f / 16) * cosSq * (2 + f * (4 - 3 * cosSq));
    lamPrev = lam;
    lam = L + (1 - C) * f * sinA * (sigma + C * sinS * (cos2 + C * cosS * (-1 + 2 * cos2 * cos2)));
    if (Math.abs(lam - lamPrev) < 1e-12) break;
  }
  if (sinS === 0 || !Number.isFinite(sigma)) return haversine(a, b);
  const uSq = (cosSq * (WGS84_A ** 2 - WGS84_B ** 2)) / WGS84_B ** 2;
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const dSig = B * sinS * (cos2 + (B / 4) * (cosS * (-1 + 2 * cos2 * cos2) - (B / 6) * cos2 * (-3 + 4 * sinS * sinS) * (-3 + 4 * cos2 * cos2)));
  const metres = WGS84_B * A * (sigma - dSig);
  const bearing = (deg(Math.atan2(cU2 * Math.sin(lam), cU1 * sU2 - sU1 * cU2 * Math.cos(lam))) + 360) % 360;
  return {
    metres,
    bearingDeg: bearing,
    steps: [
      { name: "Ellipsoid", formula: "a = 6378137 m, f = 1/298.257223563", value: "WGS84" },
      { name: "Reduced latitude", formula: "U = arctan((1−f) tan φ)", value: `${deg(U1).toFixed(6)}° → ${deg(U2).toFixed(6)}°` },
      { name: "Vincenty length", formula: "s = b A (σ − Δσ)", value: `${metres.toFixed(3)} m` },
      { name: "Forward azimuth", formula: "α = atan2(cos U2 sin λ, cos U1 sin U2 − sin U1 cos U2 cos λ)", value: `${bearing.toFixed(4)}°` },
    ],
  };
}

export function haversine(a: GeoPt, b: GeoPt): SegmentMath {
  const R = 6371008.8;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  const metres = 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  const bearing = (deg(Math.atan2(y, x)) + 360) % 360;
  return {
    metres,
    bearingDeg: bearing,
    steps: [
      { name: "Haversine", formula: "a = sin²(Δφ/2) + cos φ1 cos φ2 sin²(Δλ/2)", value: h.toFixed(8) },
      { name: "Sphere length", formula: "d = 2 R atan2(√a, √(1−a)), R = 6371008.8 m", value: `${metres.toFixed(3)} m` },
      { name: "Bearing", formula: "θ = atan2(sin Δλ cos φ2, cos φ1 sin φ2 − sin φ1 cos φ2 cos Δλ)", value: `${bearing.toFixed(4)}°` },
    ],
  };
}

/** Local tangent-plane shoelace. Accurate for a parcel, not a country. */
export function parcelArea(pts: GeoPt[]): { m2: number; hectares: number; steps: MathStep[] } {
  if (pts.length < 3) return { m2: 0, hectares: 0, steps: [] };
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lon0 = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  const en = pts.map((p) => {
    const north = rad(p.lat - lat0) * WGS84_A;
    const east = rad(p.lon - lon0) * WGS84_A * Math.cos(rad(lat0));
    return { east, north };
  });
  let sum = 0;
  for (let i = 0; i < en.length; i++) {
    const a = en[i]!;
    const b = en[(i + 1) % en.length]!;
    sum += a.east * b.north - b.east * a.north;
  }
  const m2 = Math.abs(sum) / 2;
  return {
    m2,
    hectares: m2 / 10000,
    steps: [
      { name: "Origin", formula: "φ0, λ0 = mean of pins", value: `${lat0.toFixed(6)}°, ${lon0.toFixed(6)}°` },
      { name: "Local east", formula: "E = (λ−λ0) cos φ0 · a", value: "metres" },
      { name: "Local north", formula: "N = (φ−φ0) · a", value: "metres" },
      { name: "Shoelace", formula: "A = ½ |Σ (Ei Ni+1 − Ei+1 Ni)|", value: `${m2.toFixed(2)} m² · ${(m2 / 10000).toFixed(4)} ha` },
    ],
  };
}
