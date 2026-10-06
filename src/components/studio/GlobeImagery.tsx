import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { providerById, tileUrl, type GlobeProvider } from "@/lib/gis/layers";
import { tileBbox, lonToTileX, latToTileY, zoomForAlt } from "@/lib/gis/slippy";
import { inGreece, KTIMA_ARM_ALT } from "@/lib/gis/ktima";
import { loadKtimaImage } from "@/lib/gis/ktima-image";
import { usePins } from "@/lib/gis/pins";
import { GLOBE_R, latLonToVec } from "@/lib/gis/vec";


/** Base imagery for a globe layer id. Ktimatologio drapes over Esri imagery so the ground is never black. */
export function baseImageryFor(layer: string): GlobeProvider | null {
  const p = providerById(layer);
  if (p.kind === "xyz") return p;
  if (p.kind === "wms") return providerById("esri-imagery");
  return null;
}

/** XYZ tiles around the look-at point, sized to the camera altitude. */
function tilesAroundView(lat: number, lon: number, alt: number, maxZ: number, boost: number, radius: number) {
  const z = Math.min(maxZ, zoomForAlt(alt, maxZ) + boost);
  const cx = lonToTileX(lon, z);
  const cy = latToTileY(lat, z);
  const n = 2 ** z;
  const out: { z: number; x: number; y: number }[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const y = cy + dy;
      if (y < 0 || y >= n) continue;
      out.push({ z, x: (((cx + dx) % n) + n) % n, y });
    }
  }
  return out;
}

export function GlobeImagery({ lat, lon, alt, layer }: { lat: number; lon: number; alt: number; layer: string }) {
  const provider = baseImageryFor(layer);
  const tiles = useMemo(() => {
    if (!provider || alt > 55) return [];
    return tilesAroundView(lat, lon, alt, provider.maxZ, 2, 2);
  }, [provider, lat, lon, alt]);
  if (!provider) return null;
  return (
    <group>
      {tiles.map((t) => (
        <SlippyTile key={`${provider.id}:${t.z}:${t.x}:${t.y}`} provider={provider} z={t.z} x={t.x} y={t.y} />
      ))}
    </group>
  );
}

const cache = new Map<string, THREE.Texture | "fail">();
function remember(key: string, v: THREE.Texture | "fail") {
  cache.set(key, v);
  if (cache.size > 400) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest) {
      const t = cache.get(oldest);
      if (t instanceof THREE.Texture) t.dispose();
      cache.delete(oldest);
    }
  }
}

function SlippyTile({ provider, z, x, y }: { provider: GlobeProvider; z: number; x: number; y: number }) {
  const key = `${provider.id}:${z}:${x}:${y}`;
  const [tex, setTex] = useState<THREE.Texture | null>(() => {
    const hit = cache.get(key);
    return hit instanceof THREE.Texture ? hit : null;
  });
  useEffect(() => {
    const hit = cache.get(key);
    if (hit instanceof THREE.Texture) {
      setTex(hit);
      return;
    }
    if (hit === "fail") return;
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      remember(key, t);
      if (live) setTex(t);
    };
    img.onerror = () => remember(key, "fail");
    img.src = tileUrl(provider, z, x, y);
    return () => {
      live = false;
    };
  }, [key, provider, z, x, y]);
  const box = useMemo(() => tileBbox(z, x, y), [z, x, y]);
  if (!tex) return null;
  return <GeoTileMesh box={box} tex={tex} mercator order={1} />;
}

const latToMercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * A curved patch of the globe between lat/lon bounds. Vertices are relative to
 * the patch centre so close-in views stay steady, and depth testing is off so
 * draped tiles never z-fight the Earth sphere (they sit on the visible side only).
 */
export function GeoTileMesh({ box, tex, mercator, order }: { box: { west: number; south: number; east: number; north: number }; tex: THREE.Texture; mercator: boolean; order: number }) {
  const { geom, center } = useMemo(() => {
    const segs = 10;
    const r = GLOBE_R * 1.00001;
    const c = latLonToVec((box.south + box.north) / 2, (box.west + box.east) / 2, r);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const my0 = latToMercY(box.south);
    const my1 = latToMercY(box.north);
    for (let i = 0; i <= segs; i++) {
      const v = i / segs;
      const lat = mercator
        ? (Math.atan(Math.sinh(my0 + (my1 - my0) * v)) * 180) / Math.PI
        : box.south + (box.north - box.south) * v;
      for (let j = 0; j <= segs; j++) {
        const u = j / segs;
        const p = latLonToVec(lat, box.west + (box.east - box.west) * u, r).sub(c);
        pos.push(p.x, p.y, p.z);
        uv.push(u, v);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * (segs + 1) + j;
        const b = a + 1;
        const d = a + segs + 1;
        const e = d + 1;
        idx.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return { geom: g, center: c };
  }, [box.west, box.south, box.east, box.north, mercator]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} position={center} renderOrder={order}>
      <meshBasicMaterial map={tex} toneMapped={false} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Ελληνικό Κτηματολόγιο orthophoto drape, armed when the camera closes in over Greece. */
export function KtimaGlobeTiles({ lat, lon, alt }: { lat: number; lon: number; alt: number }) {
  const tiles = useMemo(() => {
    if (alt > KTIMA_ARM_ALT || !inGreece(lat, lon)) return [];
    return tilesAroundView(lat, lon, alt, 18, 1, 1);
  }, [lat, lon, alt]);
  return (
    <group>
      {tiles.map((t) => (
        <KtimaTile key={`k:${t.z}:${t.x}:${t.y}`} z={t.z} x={t.x} y={t.y} />
      ))}
    </group>
  );
}

const ktimaCache = new Map<string, THREE.Texture | "pending" | "fail">();

function KtimaTile({ z, x, y }: { z: number; x: number; y: number }) {
  const key = `k:${z}:${x}:${y}`;
  const box = useMemo(() => tileBbox(z, x, y), [z, x, y]);
  const [tex, setTex] = useState<THREE.Texture | null>(() => {
    const hit = ktimaCache.get(key);
    return hit instanceof THREE.Texture ? hit : null;
  });
  useEffect(() => {
    const hit = ktimaCache.get(key);
    if (hit instanceof THREE.Texture) {
      setTex(hit);
      return;
    }
    if (hit === "pending" || hit === "fail") return;
    let live = true;
    ktimaCache.set(key, "pending");
    loadKtimaImage(box)
      .then((img) => {
        if (!img) {
          ktimaCache.set(key, "fail");
          return;
        }
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        ktimaCache.set(key, t);
        if (live) setTex(t);
      })
      .catch(() => ktimaCache.set(key, "fail"));
    return () => {
      live = false;
    };
  }, [key, box]);
  if (!tex) return null;
  return <GeoTileMesh box={box} tex={tex} mercator={false} order={2} />;
}

/** Marker radius that stays a few pixels wide at any camera altitude. */
export function markerRadius(alt: number) {
  return Math.min(0.28, Math.max(0.0004, alt * 0.012));
}

export function GlobePins({ alt }: { alt: number }) {
  const pins = usePins((s) => s.pins);
  const r = markerRadius(alt) * 0.6;
  return (
    <group>
      {pins.map((p) => {
        const at = latLonToVec(p.lat, p.lon, GLOBE_R + r);
        return (
          <mesh key={p.id} position={at} renderOrder={3}>
            <sphereGeometry args={[r, 12, 10]} />
            <meshBasicMaterial color="#f2c14e" />
          </mesh>
        );
      })}
    </group>
  );
}
