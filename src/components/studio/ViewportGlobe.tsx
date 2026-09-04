import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCad } from "@/lib/cad/store";
import { fetchKtimaTile, inGreece, tilesAround, type GeoTile, KTIMA_HOME } from "@/lib/gis/ktima";

const R = 100;
const TEX_COLOR = "https://unpkg.com/three-globe@2.44.1/example/img/earth-blue-marble.jpg";
const TEX_BUMP = "https://unpkg.com/three-globe@2.44.1/example/img/earth-topology.png";

export function latLonToVec(lat: number, lon: number, r = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function vecToLatLon(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon: wrapped };
}

export function ViewportGlobe() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const layer = useCad((s) => s.globe.layer);
  const setGlobe = useCad((s) => s.setGlobe);

  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">Loading Earth…</div>;
  }

  return (
    <div className="relative h-full w-full bg-[#05070d]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: latLonToVec(24, 22, R * 3.15).toArray(), fov: 38, near: 0.05, far: 4000 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#05070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[180, 80, 40]} intensity={1.35} />
        <directionalLight position={[-80, -20, -120]} intensity={0.18} />
        <Stars radius={900} depth={80} count={5000} factor={3.2} saturation={0} fade speed={0.35} />
        <Earth />
        <Atmosphere />
        <GreeceMarker />
        {layer !== "off" && <KtimaOverlay />}
        <GlobeRig />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          minDistance={R + 0.18}
          maxDistance={R * 6}
          enablePan={false}
          zoomSpeed={0.85}
        />
      </Canvas>
      <GlobeHud />
      <button
        type="button"
        onClick={() => setGlobe({ flyNonce: useCad.getState().globe.flyNonce + 1, lat: 36.434, lon: 28.217 })}
        className="absolute right-3 bottom-3 rounded-sm bg-elevated/90 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-muted uppercase hover:text-fg"
      >
        Rhodes
      </button>
      <a
        href={KTIMA_HOME}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 left-3 font-mono text-[9px] tracking-wide text-subtle uppercase hover:text-muted"
      >
        Layers · Ελληνικό Κτηματολόγιο
      </a>
    </div>
  );
}

function Earth() {
  const color = useMemo(() => new THREE.TextureLoader().load(TEX_COLOR), []);
  const bump = useMemo(() => new THREE.TextureLoader().load(TEX_BUMP), []);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  return (
    <mesh>
      <sphereGeometry args={[R, 96, 64]} />
      <meshStandardMaterial map={color} bumpMap={bump} bumpScale={0.55} roughness={0.82} metalness={0.04} />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <mesh scale={1.035}>
      <sphereGeometry args={[R, 64, 48]} />
      <meshBasicMaterial color="#3a7cff" transparent opacity={0.11} side={THREE.BackSide} />
    </mesh>
  );
}

function GreeceMarker() {
  const p = latLonToVec(36.434, 28.217, R * 1.012);
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.28, 16, 12]} />
      <meshBasicMaterial color="#7eb6ff" />
    </mesh>
  );
}

function GlobeRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
    minDistance?: number;
  } | null;
  const flyNonce = useCad((s) => s.globe.flyNonce);
  const lastFly = useRef(0);

  useEffect(() => {
    if (!flyNonce || flyNonce === lastFly.current) return;
    lastFly.current = flyNonce;
    const { lat, lon } = useCad.getState().globe;
    const target = latLonToVec(lat, lon, R);
    const cam = latLonToVec(lat, lon, R + 7);
    camera.position.copy(cam);
    if (controls?.target) {
      controls.target.copy(target);
      controls.update?.();
    }
    useCad.getState().setStatus("Flying to site · Κτηματολόγιο layers arm when you close in");
  }, [flyNonce, camera, controls]);

  useFrame(() => {
    const look = camera.position.clone().normalize().multiplyScalar(R);
    const { lat, lon } = vecToLatLon(look);
    const dist = camera.position.length() - R;
    const prev = useCad.getState().globe;
    if (Math.abs(prev.lat - lat) > 0.002 || Math.abs(prev.lon - lon) > 0.002 || Math.abs(prev.alt - dist) > 0.04) {
      useCad.getState().setGlobe({ lat, lon, alt: dist });
    }
  });
  return null;
}

function KtimaOverlay() {
  const globe = useCad((s) => s.globe);
  const [tiles, setTiles] = useState<GeoTile[]>([]);

  useEffect(() => {
    if (!inGreece(globe.lat, globe.lon) || globe.alt > 28) {
      setTiles([]);
      return;
    }
    const span = THREE.MathUtils.clamp(globe.alt * 0.22, 0.012, 6.5);
    const grid = span < 0.08 ? 3 : span < 0.6 ? 2 : 1;
    setTiles(tilesAround(globe.lat, globe.lon, span, grid));
  }, [globe.lat, globe.lon, globe.alt, globe.layer]);

  if (!tiles.length) return null;
  return (
    <group>
      {tiles.map((t) => (
        <KtimaTile key={t.key} tile={t} />
      ))}
    </group>
  );
}

const texCache = new Map<string, THREE.Texture | "pending" | "fail">();

function KtimaTile({ tile }: { tile: GeoTile }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let live = true;
    const cached = texCache.get(tile.key);
    if (cached instanceof THREE.Texture) {
      setTex(cached);
      return;
    }
    if (cached === "pending" || cached === "fail") return;
    texCache.set(tile.key, "pending");
    void fetchKtimaTile({ data: { west: tile.west, south: tile.south, east: tile.east, north: tile.north } })
      .then((res) => {
        if (!live) return;
        if (!res.ok) {
          texCache.set(tile.key, "fail");
          return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const t = new THREE.Texture(img);
          t.colorSpace = THREE.SRGBColorSpace;
          t.needsUpdate = true;
          t.anisotropy = 8;
          texCache.set(tile.key, t);
          if (live) setTex(t);
        };
        img.onerror = () => texCache.set(tile.key, "fail");
        img.src = `data:${res.mime};base64,${res.b64}`;
      })
      .catch(() => texCache.set(tile.key, "fail"));
    return () => {
      live = false;
    };
  }, [tile.key, tile.west, tile.south, tile.east, tile.north]);

  const mesh = useMemo(() => {
    const sw = latLonToVec(tile.south, tile.west, R * 1.004);
    const se = latLonToVec(tile.south, tile.east, R * 1.004);
    const ne = latLonToVec(tile.north, tile.east, R * 1.004);
    const nw = latLonToVec(tile.north, tile.west, R * 1.004);
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([...sw.toArray(), ...se.toArray(), ...ne.toArray(), ...nw.toArray()]);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, [tile.west, tile.south, tile.east, tile.north]);

  if (!tex) return null;
  return (
    <mesh geometry={mesh}>
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function GlobeHud() {
  const globe = useCad((s) => s.globe);
  const setGlobe = useCad((s) => s.setGlobe);
  const armed = inGreece(globe.lat, globe.lon) && globe.alt < 28;
  return (
    <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
      <div className="rounded-sm bg-bg/70 px-2 py-1.5 font-mono text-[10px] text-muted">
        <div className="tracking-[0.16em] text-subtle uppercase">Earth · site</div>
        <div className="tabular text-fg">
          {globe.lat.toFixed(4)}° N · {globe.lon.toFixed(4)}° E
        </div>
        <div className="text-subtle">{armed ? "Κτηματολόγιο BASEMAP live" : "Zoom into Greece for cadastre layers"}</div>
      </div>
      <div className="pointer-events-auto flex gap-1">
        <LayerChip
          on={globe.layer === "BASEMAP"}
          label="Orthophoto"
          onClick={() => setGlobe({ layer: globe.layer === "BASEMAP" ? "off" : "BASEMAP" })}
        />
      </div>
    </div>
  );
}

function LayerChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide uppercase ${
        on ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}
