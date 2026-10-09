import { nid } from "./geometry";
import type { Entity, Layer, PolylineEnt, Project, Pt, SlabEnt } from "./types";
import { useCad } from "./store";

export type ServiceKind = "electrical" | "plumbing" | "pump";

const LAYERS: Record<string, Layer> = {
  elec: { id: "elec", name: "Electrical", visible: true, locked: false, color: "#e2b340" },
  water: { id: "water", name: "Plumbing", visible: true, locked: false, color: "#7eb6d6" },
  equip: { id: "equip", name: "Equipment", visible: true, locked: false, color: "#d27a55" },
};

function ringOf(project: Project): Pt[] {
  const penta = project.entities.find((e): e is PolylineEnt => e.kind === "polyline" && e.id === "penta");
  if (penta && penta.points.length >= 3) return penta.points;
  const deck = project.entities.find((e): e is SlabEnt => e.kind === "slab" && e.id === "deck");
  if (deck && deck.points.length >= 3) return deck.points;
  return [
    { x: -6000, y: -4000 },
    { x: 6000, y: -4000 },
    { x: 6000, y: 4000 },
    { x: -6000, y: 4000 },
  ];
}

function center(pts: Pt[]): Pt {
  const c = pts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  return { x: c.x / pts.length, y: c.y / pts.length };
}

function scaled(pts: Pt[], k: number): Pt[] {
  const c = center(pts);
  return pts.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
}

function jacuzzi(project: Project): Pt {
  const slab = project.entities.find((e): e is SlabEnt => e.kind === "slab" && e.id === "jacuzzi");
  if (slab) return center(slab.points);
  const pts = ringOf(project);
  const north = pts.reduce((a, b) => (a.y > b.y ? a : b));
  return { x: north.x, y: north.y - 2200 };
}

function ensure(project: Project, id: string) {
  if (!project.layers.some((l) => l.id === id)) project.layers.push({ ...LAYERS[id]! });
}

function drop(project: Project, prefix: string) {
  project.entities = project.entities.filter((e) => !e.id.startsWith(prefix));
}

function build(project: Project, kind: ServiceKind): Entity[] {
  const pts = ringOf(project);
  const c = center(pts);
  const made: Entity[] = [];
  if (kind === "electrical") {
    ensure(project, "elec");
    const loop = scaled(pts, 0.78);
    made.push({ id: "svc-elec-ring", kind: "polyline", layerId: "elec", name: "Κύκλωμα φωτισμού", points: loop, closed: true });
    loop.forEach((p, i) => {
      made.push({ id: `svc-elec-drop-${i}`, kind: "line", layerId: "elec", a: c, b: p });
      made.push({ id: `svc-elec-lamp-${i}`, kind: "circle", layerId: "elec", c: p, r: 180 });
    });
    made.push({ id: "svc-elec-board", kind: "circle", layerId: "elec", c: { x: c.x - 900, y: c.y - 900 }, r: 420 });
    made.push({
      id: "svc-elec-note",
      kind: "text",
      layerId: "elec",
      p: { x: c.x - 1600, y: c.y - 1600 },
      text: "Πίνακας · φωτισμός καταστρώματος · γραμμή προς τον ηλιακό",
      size: 180,
      rotation: 0,
    });
  }
  if (kind === "plumbing") {
    ensure(project, "water");
    const bath = jacuzzi(project);
    const south = pts.reduce((a, b) => (a.y < b.y ? a : b));
    made.push({ id: "svc-water-supply", kind: "line", layerId: "water", name: "Ύδρευση", a: { x: south.x, y: south.y + 800 }, b: bath });
    made.push({ id: "svc-water-drain", kind: "line", layerId: "water", name: "Αποχέτευση", a: bath, b: { x: south.x + 600, y: south.y + 400 } });
    made.push({ id: "svc-water-bath", kind: "circle", layerId: "water", c: bath, r: 260 });
    made.push({
      id: "svc-water-note",
      kind: "text",
      layerId: "water",
      p: { x: bath.x + 400, y: bath.y },
      text: "Ύδρευση και αποχέτευση τζακούζι",
      size: 180,
      rotation: 0,
    });
  }
  if (kind === "pump") {
    ensure(project, "equip");
    const bath = jacuzzi(project);
    const at = { x: bath.x + 1600, y: bath.y - 400 };
    made.push({ id: "svc-pump", kind: "circle", layerId: "equip", name: "Αντλία", c: at, r: 480 });
    made.push({ id: "svc-pump-link", kind: "line", layerId: "equip", a: bath, b: at });
    made.push({
      id: "svc-pump-note",
      kind: "text",
      layerId: "equip",
      p: { x: at.x + 560, y: at.y },
      text: "Αντλία ανακυκλοφορίας",
      size: 180,
      rotation: 0,
    });
    made.push({
      id: nid("svc-equip"),
      kind: "text",
      layerId: "equip",
      p: { x: c.x - 2200, y: c.y + 400 },
      text: "Ηλιακός · φωτοβολταϊκά · πίνακας",
      size: 180,
      rotation: 0,
    });
  }
  return made;
}

export function installService(kind: ServiceKind) {
  const prefix = kind === "electrical" ? "svc-elec" : kind === "plumbing" ? "svc-water" : "svc-pump";
  useCad.getState().commit((project) => {
    const next = structuredClone(project);
    drop(next, prefix);
    next.entities.push(...build(next, kind));
    return next;
  }, kind === "electrical" ? "Electrical is on the drawing." : kind === "plumbing" ? "Plumbing is on the drawing." : "The pump is on the drawing.");
}

export function installAllServices() {
  useCad.getState().commit((project) => {
    const next = structuredClone(project);
    drop(next, "svc-elec");
    drop(next, "svc-water");
    drop(next, "svc-pump");
    next.entities.push(...build(next, "electrical"), ...build(next, "plumbing"), ...build(next, "pump"));
    return next;
  }, "Electrical, plumbing and the pump are on the drawing.");
}
