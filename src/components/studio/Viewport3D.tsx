import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { dist, lerp, openingOnWall, projectExtents, rectCorners, wallLength } from "@/lib/cad/geometry";
import { useCad } from "@/lib/cad/store";
import type { CircleEnt, Entity, OpeningEnt, Project, RectEnt, SurveyEnt, WallEnt } from "@/lib/cad/types";

const M = 0.001;

export function Viewport3D() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const project = useCad((s) => s.project);
  const selection = useCad((s) => s.selection);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">Loading model…</div>
    );
  }

  return (
    <div className="relative h-full w-full bg-bg">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [20, 14, 22], fov: 40, near: 0.05, far: 500 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        frameloop="always"
      >
        <color attach="background" args={["#121614"]} />
        <fog attach="fog" args={["#121614", 55, 120]} />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#e4e8e2", "#2a322e", 0.55]} />
        <directionalLight position={[18, 28, 12]} intensity={1.35} />
        <directionalLight position={[-12, 8, -8]} intensity={0.35} />
        <Ground />
        <BimModel project={project} selection={selection} />
        <FrameCamera project={project} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2 - 0.06}
          minDistance={0.4}
          maxDistance={200}
        />
      </Canvas>
    </div>
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#1a201c" roughness={1} />
      </mesh>
      <gridHelper args={[80, 80, "#4a5a62", "#243028"]} position={[0, 0, 0]} />
    </group>
  );
}

function FrameCamera({ project }: { project: Project }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;

  useLayoutEffect(() => {
    const box = projectExtents(project);
    const cx = box ? ((box.minX + box.maxX) / 2) * M : 6;
    const cz = box ? ((box.minY + box.maxY) / 2) * M : 4;
    const dx = box ? Math.max(0.4, (box.maxX - box.minX) * M) : 12;
    const dz = box ? Math.max(0.4, (box.maxY - box.minY) * M) : 8;
    const span = Math.max(dx, dz, 1);
    const distCam = span * 1.55 + 2;
    camera.position.set(cx + distCam * 0.72, Math.max(1.6, span * 0.85), cz + distCam * 0.92);
    camera.near = Math.max(0.02, span / 250);
    camera.far = Math.max(250, span * 50);
    camera.updateProjectionMatrix();
    const target = new THREE.Vector3(cx, Math.min(1.2, span * 0.15), cz);
    camera.lookAt(target);
    if (controls?.target) {
      controls.target.copy(target);
      controls.update?.();
    }
    invalidate();
  }, [project, camera, controls, invalidate]);

  return null;
}

function BimModel({ project, selection }: { project: Project; selection: string[] }) {
  const sel = useMemo(() => new Set(selection), [selection]);
  const walls = project.entities.filter((e): e is WallEnt => e.kind === "wall");
  const openings = project.entities.filter((e): e is OpeningEnt => e.kind === "door" || e.kind === "window");
  const slabs = project.entities.filter((e) => e.kind === "slab");
  const cols = project.entities.filter((e) => e.kind === "column");
  const surveys = project.entities.filter((e): e is SurveyEnt => e.kind === "survey");
  const rects = project.entities.filter((e): e is RectEnt => e.kind === "rect");
  const circles = project.entities.filter((e): e is CircleEnt => e.kind === "circle");
  const isMech = project.discipline === "mechanical";

  return (
    <group>
      {slabs.map((e) => (e.kind === "slab" ? <SlabMesh key={e.id} e={e} selected={sel.has(e.id)} /> : null))}
      {walls.map((w) => (
        <WallMesh key={w.id} wall={w} openings={openings.filter((o) => o.wallId === w.id)} selected={sel.has(w.id)} />
      ))}
      {cols.map((c) =>
        c.kind === "column" ? (
          <mesh key={c.id} position={[c.c.x * M, (c.height * M) / 2, c.c.y * M]}>
            <boxGeometry args={[c.width * M, c.height * M, c.depth * M]} />
            <meshStandardMaterial color={sel.has(c.id) ? "#f2f4f0" : "#9aa49c"} roughness={0.65} />
          </mesh>
        ) : null,
      )}
      {openings.map((o) => {
        const wall = walls.find((w) => w.id === o.wallId);
        if (!wall) return null;
        return <OpeningMesh key={o.id} opening={o} wall={wall} selected={sel.has(o.id)} />;
      })}
      {rects.map((r) => (
        <PlateMesh key={r.id} rect={r} holes={circles} selected={sel.has(r.id)} lift={isMech} />
      ))}
      {surveys.map((s) => (
        <SurveyStake key={s.id} s={s} selected={sel.has(s.id)} />
      ))}
    </group>
  );
}

function WallMesh({
  wall,
  openings,
  selected,
}: {
  wall: WallEnt;
  openings: OpeningEnt[];
  selected: boolean;
}) {
  const pieces = useMemo(() => splitWall(wall, openings), [wall, openings]);
  const len = wallLength(wall);
  const dirx = (wall.b.x - wall.a.x) / (len || 1);
  const diry = (wall.b.y - wall.a.y) / (len || 1);
  const yaw = Math.atan2(dirx, diry);
  const color = selected ? "#f2f4f0" : wall.material === "Gypsum" ? "#c8cbc4" : "#c2b8a8";

  return (
    <group>
      {pieces.map((p, i) => {
        const mid = lerp(wall.a, wall.b, (p.t0 + p.t1) / 2);
        const w = Math.max((p.t1 - p.t0) * len * M, 0.02);
        const height = Math.max(p.height * M, 0.05);
        const y = p.sill * M + height / 2;
        return (
          <mesh key={i} position={[mid.x * M, y, mid.y * M]} rotation={[0, yaw, 0]}>
            <boxGeometry args={[Math.max(wall.thickness * M, 0.08), height, w]} />
            <meshStandardMaterial color={color} roughness={0.78} metalness={0.04} />
          </mesh>
        );
      })}
    </group>
  );
}

function splitWall(wall: WallEnt, openings: OpeningEnt[]) {
  const len = wallLength(wall) || 1;
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  type Piece = { t0: number; t1: number; sill: number; height: number };
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const o of sorted) {
    const t0 = Math.max(0, o.offset);
    const t1 = Math.min(len, o.offset + o.width);
    if (t0 > cursor + 0.5) pieces.push({ t0: cursor, t1: t0, sill: 0, height: wall.height });
    if (o.sill > 1) pieces.push({ t0, t1, sill: 0, height: o.sill });
    const head = wall.height - (o.sill + o.height);
    if (head > 1) pieces.push({ t0, t1, sill: o.sill + o.height, height: head });
    cursor = t1;
  }
  if (cursor < len - 0.5) pieces.push({ t0: cursor, t1: len, sill: 0, height: wall.height });
  if (!pieces.length) pieces.push({ t0: 0, t1: len, sill: 0, height: wall.height });
  return pieces;
}

function OpeningMesh({
  opening,
  wall,
  selected,
}: {
  opening: OpeningEnt;
  wall: WallEnt;
  selected: boolean;
}) {
  const on = openingOnWall(wall, opening);
  const midPt = lerp(on.a, on.b, 0.5);
  const len = dist(on.a, on.b);
  const yaw = Math.atan2(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const y = (opening.sill + opening.height / 2) * M;
  if (opening.kind === "window") {
    return (
      <mesh position={[midPt.x * M, y, midPt.y * M]} rotation={[0, yaw, 0]}>
        <boxGeometry args={[0.05, Math.max(opening.height * M, 0.2), Math.max(len * M, 0.2)]} />
        <meshStandardMaterial
          color={selected ? "#dbe4ee" : "#9eb4c4"}
          transparent
          opacity={0.55}
          roughness={0.12}
          metalness={0.15}
        />
      </mesh>
    );
  }
  return (
    <mesh
      position={[midPt.x * M + on.n.x * 0.05, (opening.height * M) / 2, midPt.y * M + on.n.y * 0.05]}
      rotation={[0, yaw, 0]}
    >
      <boxGeometry args={[0.05, Math.max(opening.height * M, 0.4), Math.max((opening.width - 80) * M, 0.2)]} />
      <meshStandardMaterial color={selected ? "#f2f4f0" : "#7a5a42"} roughness={0.55} />
    </mesh>
  );
}

function SlabMesh({ e, selected }: { e: Extract<Entity, { kind: "slab" }>; selected: boolean }) {
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    e.points.forEach((p, i) => {
      const x = p.x * M;
      const y = p.y * M;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(e.thickness * M, 0.08),
      bevelEnabled: false,
      steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, (e.elevation - Math.max(e.thickness, 80)) * M, 0);
    g.computeVertexNormals();
    return g;
  }, [e]);

  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color={selected ? "#e8ece6" : "#5f6660"} roughness={0.92} />
    </mesh>
  );
}

function PlateMesh({
  rect,
  holes,
  selected,
  lift,
}: {
  rect: RectEnt;
  holes: CircleEnt[];
  selected: boolean;
  lift: boolean;
}) {
  const th = Math.max((rect.thickness ?? 12) * M, 0.006);
  const geom = useMemo(() => {
    const corners = rectCorners(rect.a, rect.b);
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    const shape = new THREE.Shape();
    shape.moveTo(minX * M, minY * M);
    shape.lineTo(maxX * M, minY * M);
    shape.lineTo(maxX * M, maxY * M);
    shape.lineTo(minX * M, maxY * M);
    shape.closePath();
    for (const h of holes) {
      if (h.c.x < minX - 0.1 || h.c.x > maxX + 0.1 || h.c.y < minY - 0.1 || h.c.y > maxY + 0.1) continue;
      const path = new THREE.Path();
      path.absellipse(h.c.x * M, h.c.y * M, Math.max(h.r * M, 0.001), Math.max(h.r * M, 0.001), 0, Math.PI * 2, false, 0);
      shape.holes.push(path);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, steps: 1, curveSegments: 28 });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [rect, holes, th]);

  return (
    <mesh geometry={geom} position={lift ? [0, 0.2, 0] : [0, 0.02, 0]}>
      <meshStandardMaterial color={selected ? "#e8ece6" : "#9aa3a8"} metalness={0.58} roughness={0.32} />
    </mesh>
  );
}

function SurveyStake({ s, selected }: { s: SurveyEnt; selected: boolean }) {
  return (
    <group position={[s.e * M, 0, s.n * M]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
        <meshStandardMaterial color={selected ? "#f2f4f0" : "#b8c4bc"} />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.13, 0.22, 3]} />
        <meshStandardMaterial color={selected ? "#f2f4f0" : "#d2dad3"} />
      </mesh>
      <mesh position={[0.02, 1.22, 0]}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshBasicMaterial color="#b8c4bc" />
      </mesh>
    </group>
  );
}
