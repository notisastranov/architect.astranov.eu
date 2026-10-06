import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCad } from "@/lib/cad/store";
import { inGreece, KTIMA_ARM_ALT, KTIMA_HOME } from "@/lib/gis/ktima";
import { GLOBE_PROVIDERS, providerById } from "@/lib/gis/layers";
import { usePins } from "@/lib/gis/pins";
import { projectSite } from "@/lib/gis/site";
import { latLonToVec } from "@/lib/gis/vec";
import { GlobeImagery, GlobePins, KtimaGlobeTiles, markerRadius } from "./GlobeImagery";

const R = 100;
const KM_PER_UNIT = 63.71;
/** Closest the camera may come to the ground (~250 m) and the default fly-in height (~19 km). */
const MIN_ALT = 0.004;
const MAX_ALT = R * 5;
export const FLY_ALT = 0.3;
const TEX_COLOR = "https://unpkg.com/three-globe@2.44.1/example/img/earth-blue-marble.jpg";
const TEX_BUMP = "https://unpkg.com/three-globe@2.44.1/example/img/earth-topology.png";

export { latLonToVec };

function vecToLatLon(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon: wrapped };
}

/** First hit of a camera ray with the globe, or null when the ray misses Earth. */
function raySphere(ray: THREE.Ray): THREE.Vector3 | null {
  const o = ray.origin;
  const d = ray.direction;
  const b = o.dot(d);
  const c = o.lengthSq() - R * R;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0) return null;
  return o.clone().addScaledVector(d, t);
}

/** Rotate unit vector `from` toward `to` by fraction t of their angle (t may be negative). */
function turnToward(from: THREE.Vector3, to: THREE.Vector3, t: number) {
  const axis = new THREE.Vector3().crossVectors(from, to);
  const len = axis.length();
  if (len < 1e-9) return from.clone();
  const angle = Math.atan2(len, from.dot(to)) * t;
  return from.clone().applyAxisAngle(axis.divideScalar(len), angle).normalize();
}

export function ViewportGlobe() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const layer = useCad((s) => s.globe.layer);
  const lat = useCad((s) => s.globe.lat);
  const lon = useCad((s) => s.globe.lon);
  const alt = useCad((s) => s.globe.alt);
  const site = useCad((s) => projectSite(s.project));
  const addPin = usePins((s) => s.add);
  const initialCam = useMemo(() => {
    const g = useCad.getState().globe;
    return latLonToVec(g.lat, g.lon, R + Math.min(Math.max(g.alt, FLY_ALT), R * 3.15)).toArray();
  }, []);

  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">Loading Earth…</div>;
  }

  return (
    <div className="relative h-full w-full bg-[#05070d]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: initialCam, fov: 38, near: 0.02, far: 4000 }}
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
        <SiteMarker lat={site.lat} lon={site.lon} alt={alt} />
        <GlobeImagery lat={lat} lon={lon} alt={alt} layer={layer} />
        {(layer === "BASEMAP" || layer === "ktima") && <KtimaGlobeTiles lat={lat} lon={lon} alt={alt} />}
        <GlobePins alt={alt} />
        <GlobeRig />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={R + MIN_ALT} maxDistance={R + MAX_ALT} enablePan={false} />
      </Canvas>
      <GlobeHud />
      <button
        type="button"
        onClick={() => addPin(useCad.getState().globe.lat, useCad.getState().globe.lon)}
        className="absolute right-3 bottom-12 rounded-sm bg-elevated/90 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-muted uppercase hover:text-fg"
      >
        Pin
      </button>
      <button
        type="button"
        title={site.label ?? "Project site"}
        onClick={() => {
          const st = useCad.getState();
          const s = projectSite(st.project);
          st.setGlobe({ flyNonce: st.globe.flyNonce + 1, lat: s.lat, lon: s.lon });
        }}
        className="absolute right-3 bottom-3 rounded-sm bg-elevated/90 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-muted uppercase hover:text-fg"
      >
        Site
      </button>
      <a href={KTIMA_HOME} target="_blank" rel="noreferrer" className="absolute bottom-3 left-3 max-w-[60%] font-mono text-[9px] tracking-wide text-subtle uppercase hover:text-muted">
        {providerById(layer).attribution}
        {providerById(layer).kind === "wms" ? " · Esri, Maxar, Earthstar Geographics" : ""}
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
      <sphereGeometry args={[R, 128, 96]} />
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

function SiteMarker({ lat, lon, alt }: { lat: number; lon: number; alt: number }) {
  const r = markerRadius(alt);
  return (
    <mesh position={latLonToVec(lat, lon, R + r)} renderOrder={3}>
      <sphereGeometry args={[r, 16, 12]} />
      <meshBasicMaterial color="#7eb6ff" />
    </mesh>
  );
}

type Fly = { fromDir: THREE.Vector3; toDir: THREE.Vector3; fromAlt: number; toAlt: number; t0: number; dur: number };

function GlobeRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as {
    update?: () => void;
    rotateSpeed: number;
    zoomSpeed: number;
  } | null;
  const flyNonce = useCad((s) => s.globe.flyNonce);
  const lastFly = useRef(0);
  const fly = useRef<Fly | null>(null);
  const armed = useRef<boolean | null>(null);

  const place = (dir: THREE.Vector3, alt: number) => {
    camera.position.copy(dir).multiplyScalar(R + alt);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    controls?.update?.();
  };

  useEffect(() => {
    if (!flyNonce || flyNonce === lastFly.current) return;
    lastFly.current = flyNonce;
    const { lat, lon, layer } = useCad.getState().globe;
    const fromAlt = camera.position.length() - R;
    fly.current = {
      fromDir: camera.position.clone().normalize(),
      toDir: latLonToVec(lat, lon, 1).normalize(),
      fromAlt,
      // Ktimatologio flies low enough to arm the cadastre; other layers stop at ~19 km.
      toAlt: Math.min(Math.max(fromAlt, MIN_ALT), (layer === "BASEMAP" || layer === "ktima") && inGreece(lat, lon) ? KTIMA_ARM_ALT * 0.75 : FLY_ALT),
      t0: performance.now(),
      dur: 2400,
    };
    useCad.getState().setStatus(`Flying in · ${providerById(layer).name}`);
  }, [flyNonce, camera]);

  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndcOf = (e: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };
    const hitOf = (e: { clientX: number; clientY: number }) => {
      ray.setFromCamera(ndcOf(e), camera);
      return raySphere(ray.ray);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      fly.current = null;
      const alt = camera.position.length() - R;
      const dy = THREE.MathUtils.clamp(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY, -400, 400);
      const next = THREE.MathUtils.clamp(alt * Math.exp(dy * 0.0022), MIN_ALT, MAX_ALT);
      const dir = camera.position.clone().normalize();
      const hit = hitOf(e);
      // Keep the ground under the cursor under the cursor: slide toward it by the zoom fraction.
      const toward = hit && alt < 40 ? turnToward(dir, hit.normalize(), 1 - next / alt) : dir;
      place(toward, next);
      const after = hitOf(e);
      useCad.getState().setGlobeCursor(after ? vecToLatLon(after) : null);
    };
    const onMove = (e: PointerEvent) => {
      const hit = hitOf(e);
      useCad.getState().setGlobeCursor(hit ? vecToLatLon(hit) : null);
    };
    const onLeave = () => useCad.getState().setGlobeCursor(null);
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      useCad.getState().setGlobeCursor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, controls]);

  useFrame(() => {
    const f = fly.current;
    if (f) {
      const k = Math.min(1, (performance.now() - f.t0) / f.dur);
      const e = (1 - Math.cos(Math.PI * k)) / 2;
      const dir = turnToward(f.fromDir, f.toDir, e);
      const alt = Math.exp(Math.log(f.fromAlt) + (Math.log(f.toAlt) - Math.log(f.fromAlt)) * e);
      place(dir, alt);
      if (k >= 1) fly.current = null;
    }
    const dist = camera.position.length() - R;
    if (controls) {
      // Drag moves the ground at hand speed whatever the height; pinch zooms in proportion.
      controls.rotateSpeed = THREE.MathUtils.clamp(dist * 0.0013, 0.00002, 0.7);
      controls.zoomSpeed = THREE.MathUtils.clamp((dist / R) * 2, 0.0005, 1);
    }
    const near = THREE.MathUtils.clamp(dist * 0.25, 0.0005, 2);
    if (Math.abs(camera.near - near) / near > 0.2) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    const { lat, lon } = vecToLatLon(camera.position);
    const prev = useCad.getState().globe;
    const moved = Math.abs(prev.lat - lat) > 1e-5 || Math.abs(prev.lon - lon) > 1e-5 || Math.abs(prev.alt - dist) / Math.max(dist, 1e-6) > 0.01;
    if (moved) useCad.getState().setGlobe({ lat, lon, alt: dist });
    const ktimaOn = prev.layer === "BASEMAP" || prev.layer === "ktima";
    const isArmed = ktimaOn && dist <= KTIMA_ARM_ALT && inGreece(lat, lon);
    if (armed.current !== null && isArmed !== armed.current) {
      useCad.getState().setStatus(isArmed ? "Ελληνικό Κτηματολόγιο armed · cadastre orthophoto draped on the ground" : "Cadastre layers off · zoom in over Greece to arm them");
    }
    armed.current = isArmed;
  });
  return null;
}

function GlobeHud() {
  const globe = useCad((s) => s.globe);
  const cursor = useCad((s) => s.globeCursor);
  const setGlobe = useCad((s) => s.setGlobe);
  const km = globe.alt * KM_PER_UNIT;
  const ktimaOn = globe.layer === "BASEMAP" || globe.layer === "ktima";
  const cadastre = !ktimaOn
    ? "Cadastre off · pick Ktimatologio"
    : !inGreece(globe.lat, globe.lon)
      ? "Cadastre covers Greece only"
      : globe.alt <= KTIMA_ARM_ALT
        ? "Ktimatologio armed"
        : `Cadastre arms below ${(KTIMA_ARM_ALT * KM_PER_UNIT).toFixed(0)} km`;
  const p = cursor ?? { lat: globe.lat, lon: globe.lon };
  return (
    <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
      <div className="rounded-sm bg-bg/85 px-2 py-1.5 font-mono text-[10px] text-muted">
        <div className="tracking-[0.16em] text-subtle uppercase">Earth · WGS84 · {cursor ? "cursor" : "centre"}</div>
        <div className="tabular text-fg" data-testid="globe-latlon">
          {fmtLat(p.lat)} · {fmtLon(p.lon)}
        </div>
        <div className="tabular text-subtle">
          alt {km < 10 ? km.toFixed(2) : km.toFixed(0)} km · {providerById(globe.layer).name}
        </div>
        <div className={ktimaOn && globe.alt <= KTIMA_ARM_ALT && inGreece(globe.lat, globe.lon) ? "text-primary" : "text-subtle"}>{cadastre}</div>
      </div>
      <div className="pointer-events-auto flex max-w-[58%] flex-wrap justify-end gap-1">
        {GLOBE_PROVIDERS.map((p) => (
          <LayerChip key={p.id} on={globe.layer === p.id} label={p.name} onClick={() => setGlobe(p.kind === "wms" ? { layer: p.id, flyNonce: globe.flyNonce + 1 } : { layer: p.id })} />
        ))}
      </div>
    </div>
  );
}

function fmtLat(v: number) {
  return `${Math.abs(v).toFixed(5)}° ${v >= 0 ? "N" : "S"}`;
}
function fmtLon(v: number) {
  return `${Math.abs(v).toFixed(5)}° ${v >= 0 ? "E" : "W"}`;
}

function LayerChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide uppercase ${on ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg"}`}>
      {label}
    </button>
  );
}
