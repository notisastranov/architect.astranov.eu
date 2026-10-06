import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { providerById, tileUrl } from "@/lib/gis/layers";
import { tileBbox, lonToTileX, latToTileY, zoomForAlt } from "@/lib/gis/slippy";
import { usePins } from "@/lib/gis/pins";
import { latLonToVec } from "./ViewportGlobe";

const R = 100;

export function GlobeImagery({ lat, lon, alt, layer }: { lat: number; lon: number; alt: number; layer: string }) {
  const provider = providerById(layer);
  const tiles = useMemo(() => {
    if (provider.kind !== "xyz" || alt > 55) return [];
    const z = zoomForAlt(alt, provider.maxZ);
    const cx = lonToTileX(lon, z);
    const cy = latToTileY(lat, z);
    const out: { key: string; z: number; x: number; y: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (y < 0 || y >= 2 ** z) continue;
        out.push({ key: `${provider.id}:${z}:${x}:${y}`, z, x, y });
      }
    }
    return out;
  }, [provider, lat, lon, alt]);

  return (
    <group>
      {tiles.map((t) => (
        <SlippyTile key={t.key} providerId={provider.id} z={t.z} x={t.x} y={t.y} />
      ))}
    </group>
  );
}

const cache = new Map<string, THREE.Texture | "fail">();

function SlippyTile({ providerId, z, x, y }: { providerId: string; z: number; x: number; y: number }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const box = tileBbox(z, x, y);
  useEffect(() => {
    const key = `${providerId}:${z}:${x}:${y}`;
    const hit = cache.get(key);
    if (hit instanceof THREE.Texture) {
      setTex(hit);
      return;
    }
    if (hit === "fail") return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      cache.set(key, t);
      setTex(t);
    };
    img.onerror = () => cache.set(key, "fail");
    img.src = tileUrl(providerById(providerId), z, x, y);
  }, [providerId, z, x, y]);

  const geom = useMemo(() => {
    const sw = latLonToVec(box.south, box.west, R * 1.003);
    const se = latLonToVec(box.south, box.east, R * 1.003);
    const ne = latLonToVec(box.north, box.east, R * 1.003);
    const nw = latLonToVec(box.north, box.west, R * 1.003);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...sw.toArray(), ...se.toArray(), ...ne.toArray(), ...nw.toArray()]), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, [box.west, box.south, box.east, box.north]);

  if (!tex) return null;
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export function GlobePins() {
  const pins = usePins((s) => s.pins);
  return (
    <group>
      {pins.map((p) => {
        const at = latLonToVec(p.lat, p.lon, R * 1.012);
        return (
          <mesh key={p.id} position={at}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <meshBasicMaterial color="#f2c14e" />
          </mesh>
        );
      })}
    </group>
  );
}
