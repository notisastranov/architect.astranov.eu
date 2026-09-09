import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cloneProject, nid, projectExtents } from "./geometry";
import { applyOps, type ApplyResult } from "./ops";
import { blankProject, sampleArchitecture } from "./samples";
import {
  applyPrintedScale,
  assembleCollage,
  forgetOverlayImage,
  geoFromGcps,
  rememberOverlayImage,
  sheetFromFile,
  type OverlayGcp,
  type OverlayMode,
  type OverlaySheet,
} from "@/lib/gis/overlay";
import type {
  AiOp,
  Discipline,
  Draft,
  Entity,
  GlobeState,
  Id,
  Project,
  Pt,
  SnapConfig,
  SnapHit,
  Tool,
  UnitSystem,
  ViewMode,
} from "./types";

const MAX_HIST = 40;

const DEFAULT_GLOBE: GlobeState = {
  lat: 36.434,
  lon: 28.217,
  alt: 215,
  layer: "BASEMAP",
  flyNonce: 0,
};

export interface CadState {
  project: Project;
  past: Project[];
  future: Project[];
  selection: Id[];
  tool: Tool;
  draft: Draft | null;
  snap: SnapConfig;
  ortho: boolean;
  units: UnitSystem;
  view: ViewMode;
  globe: GlobeState;
  cam: { x: number; y: number; zoom: number };
  hover: Pt | null;
  snapHit: SnapHit | null;
  command: string;
  status: string;
  prompt: string;
  aiOpen: boolean;
  aiBusy: boolean;
  aiLog: { role: "user" | "assistant"; text: string }[];
  inspectOpen: boolean;
  helpOpen: boolean;
  projectsOpen: boolean;
  rightTab: "properties" | "layers" | "quantities" | "survey" | "ai" | "maps";
  fitNonce: number;
  dirtyFit: boolean;
  overlays: OverlaySheet[];
  overlayMode: OverlayMode;
  activeOverlayId: string | null;
  pendingGcp: { imgX: number; imgY: number } | null;

  setTool: (t: Tool) => void;
  setView: (v: ViewMode) => void;
  setGlobe: (p: Partial<GlobeState>) => void;
  setOrtho: (v: boolean) => void;
  setSnap: (p: Partial<SnapConfig>) => void;
  setUnits: (u: UnitSystem) => void;
  setCam: (c: Partial<CadState["cam"]>) => void;
  setHover: (p: Pt | null, snap: SnapHit | null) => void;
  setCommand: (s: string) => void;
  setStatus: (s: string) => void;
  setPrompt: (s: string) => void;
  setRightTab: (t: CadState["rightTab"]) => void;
  setAiOpen: (v: boolean) => void;
  setInspectOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setProjectsOpen: (v: boolean) => void;
  setAiBusy: (v: boolean) => void;
  pushAi: (role: "user" | "assistant", text: string) => void;

  loadProject: (p: Project) => void;
  newProject: (d: Discipline) => void;
  commit: (mutate: (p: Project) => Project, status?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: Id[], additive?: boolean) => void;
  clearSelection: () => void;
  deleteSelection: () => void;
  updateEntity: (id: Id, patch: Partial<Entity>) => void;
  toggleLayer: (id: Id, field: "visible" | "locked") => void;
  setDraft: (d: Draft | null) => void;
  addEntity: (e: Entity) => void;
  applyAi: (ops: AiOp[]) => ApplyResult;
  zoomExtents: () => void;
  requestFit: () => void;

  importOverlayFiles: (files: File[]) => Promise<void>;
  patchOverlay: (id: string, patch: Partial<OverlaySheet>) => void;
  removeOverlay: (id: string) => void;
  setActiveOverlay: (id: string | null) => void;
  setOverlayMode: (m: OverlayMode) => void;
  collageOverlays: () => void;
  scaleOverlay: (id: string, printedScale: number, dpi?: number) => void;
  addOverlayGcp: (id: string, gcp: OverlayGcp) => void;
  setPendingGcp: (p: { imgX: number; imgY: number } | null) => void;
  finishGcp: (world: Pt, geo?: { lon: number; lat: number }) => void;
}

function pushHist(s: CadState, next: Project): Pick<CadState, "project" | "past" | "future"> {
  return {
    project: next,
    past: [...s.past, s.project].slice(-MAX_HIST),
    future: [],
  };
}

export const useCad = create<CadState>()(
  persist(
    (set, get) => ({
      project: sampleArchitecture(),
      past: [],
      future: [],
      selection: [],
      tool: "select",
      draft: null,
      snap: { grid: true, end: true, mid: true, center: true, int: true },
      ortho: true,
      units: "m",
      view: "globe",
      globe: { ...DEFAULT_GLOBE },
      cam: { x: 6000, y: 3500, zoom: 0.06 },
      hover: null,
      snapHit: null,
      command: "",
      status: "Earth · wheel into Greece for Ελληνικό Κτηματολόγιο layers.",
      prompt: "",
      aiOpen: false,
      aiBusy: false,
      aiLog: [],
      inspectOpen: false,
      helpOpen: false,
      projectsOpen: false,
      rightTab: "properties",
      fitNonce: 1,
      dirtyFit: true,
      overlays: [],
      overlayMode: "idle",
      activeOverlayId: null,
      pendingGcp: null,

      setTool: (t) =>
        set({
          tool: t,
          draft: t === "select" || t === "pan" ? null : { tool: t, points: [] },
          status: toolStatus(t),
        }),
      setView: (v) =>
        set({
          view: v,
          status:
            v === "globe"
              ? "Earth · wheel into Greece for Ελληνικό Κτηματολόγιο layers."
              : get().status,
        }),
      setGlobe: (p) => set({ globe: { ...get().globe, ...p } }),
      setOrtho: (v) => set({ ortho: v }),
      setSnap: (p) => set({ snap: { ...get().snap, ...p } }),
      setUnits: (u) => set({ units: u, project: { ...get().project, units: u } }),
      setCam: (c) => set({ cam: { ...get().cam, ...c } }),
      setHover: (p, snap) => set({ hover: p, snapHit: snap }),
      setCommand: (s) => set({ command: s }),
      setStatus: (s) => set({ status: s }),
      setPrompt: (s) => set({ prompt: s }),
      setRightTab: (t) => set({ rightTab: t, aiOpen: t === "ai" ? true : get().aiOpen }),
      setAiOpen: (v) => set({ aiOpen: v, rightTab: v ? "ai" : get().rightTab }),
      setInspectOpen: (v) => set({ inspectOpen: v }),
      setHelpOpen: (v) => set({ helpOpen: v }),
      setProjectsOpen: (v) => set({ projectsOpen: v }),
      setAiBusy: (v) => set({ aiBusy: v }),
      pushAi: (role, text) => set({ aiLog: [...get().aiLog, { role, text }].slice(-40) }),

      loadProject: (p) =>
        set({
          project: p,
          past: [],
          future: [],
          selection: [],
          draft: null,
          units: p.units,
          tool: "select",
          dirtyFit: true,
          fitNonce: get().fitNonce + 1,
          status: `${p.name} loaded.`,
          projectsOpen: false,
        }),
      newProject: (d) => get().loadProject(blankProject(d)),
      commit: (mutate, status) => {
        const next = mutate(cloneProject(get().project));
        set({ ...pushHist(get(), next), ...(status ? { status } : {}) });
      },
      undo: () => {
        const { past, project, future } = get();
        const prev = past[past.length - 1];
        if (!prev) return;
        set({
          project: prev,
          past: past.slice(0, -1),
          future: [project, ...future].slice(0, MAX_HIST),
          selection: [],
          draft: null,
          status: "Undo",
        });
      },
      redo: () => {
        const { past, project, future } = get();
        const nxt = future[0];
        if (!nxt) return;
        set({
          project: nxt,
          future: future.slice(1),
          past: [...past, project].slice(-MAX_HIST),
          selection: [],
          status: "Redo",
        });
      },
      select: (ids, additive) => {
        if (additive) {
          const cur = new Set(get().selection);
          for (const id of ids) {
            if (cur.has(id)) cur.delete(id);
            else cur.add(id);
          }
          set({ selection: [...cur], inspectOpen: true });
        } else {
          set({ selection: ids, inspectOpen: ids.length > 0 });
        }
      },
      clearSelection: () => set({ selection: [], inspectOpen: false }),
      deleteSelection: () => {
        const ids = new Set(get().selection);
        if (!ids.size) return;
        get().commit((p) => {
          p.entities = p.entities.filter((e) => !ids.has(e.id));
          return p;
        }, `Deleted ${ids.size}`);
        set({ selection: [] });
      },
      updateEntity: (id, patch) => {
        get().commit((p) => {
          p.entities = p.entities.map((e) => (e.id === id ? ({ ...e, ...patch } as Entity) : e));
          return p;
        });
      },
      toggleLayer: (id, field) => {
        set({
          project: {
            ...get().project,
            layers: get().project.layers.map((l) => (l.id === id ? { ...l, [field]: !l[field] } : l)),
          },
        });
      },
      setDraft: (d) => set({ draft: d }),
      addEntity: (e) => {
        get().commit((p) => {
          p.entities.push(e);
          return p;
        }, `Placed ${e.kind}`);
        set({ selection: [e.id] });
      },
      applyAi: (ops) => {
        const result = applyOps(get().project, ops);
        set({
          ...pushHist(get(), result.project),
          selection: result.selected,
          status: result.message,
          dirtyFit: true,
          fitNonce: get().fitNonce + 1,
        });
        return result;
      },
      zoomExtents: () => {
        if (get().view === "globe") {
          set({
            globe: { ...get().globe, flyNonce: get().globe.flyNonce + 1, lat: 36.434, lon: 28.217 },
          });
          return;
        }
        set({ dirtyFit: true, fitNonce: get().fitNonce + 1 });
      },
      requestFit: () => {
        const ext = projectExtents(get().project);
        if (!ext) {
          set({ dirtyFit: false });
          return;
        }
        set({ dirtyFit: false });
      },

      importOverlayFiles: async (files) => {
        const sheets: OverlaySheet[] = [];
        for (const file of files) {
          try {
            sheets.push(await sheetFromFile(file, files.length > 1 ? "single" : "parent"));
          } catch {
            /* skip unreadable */
          }
        }
        if (!sheets.length) {
          set({ status: "No readable scans." });
          return;
        }
        const offset = get().overlays.length;
        const placed = sheets.map((s, i) => ({
          ...s,
          ox: (offset + i) * Math.max(s.width * s.scaleMmPerPx * 0.15, 20000),
          oy: 0,
        }));
        set({
          overlays: [...get().overlays, ...placed],
          activeOverlayId: placed[0]!.id,
          rightTab: "maps",
          view: get().view === "globe" ? "plan" : get().view,
          dirtyFit: true,
          fitNonce: get().fitNonce + 1,
          status:
            placed.length === 1
              ? `Imported ${placed[0]!.name} at 1:${placed[0]!.printedScale}. Type collage or georef.`
              : `Imported ${placed.length} sheets. Type collage to assemble the quadro d'unione.`,
        });
      },
      patchOverlay: (id, patch) => {
        set({
          overlays: get().overlays.map((s) => {
            if (s.id !== id) return s;
            const next = { ...s, ...patch };
            next.geo = geoFromGcps(next);
            return next;
          }),
        });
      },
      removeOverlay: (id) => {
        forgetOverlayImage(id);
        set({
          overlays: get().overlays.filter((s) => s.id !== id),
          activeOverlayId: get().activeOverlayId === id ? null : get().activeOverlayId,
        });
      },
      setActiveOverlay: (id) => set({ activeOverlayId: id }),
      setOverlayMode: (m) =>
        set({
          overlayMode: m,
          pendingGcp: m === "idle" ? null : get().pendingGcp,
          status:
            m === "gcp-img"
              ? "Georef · click a mark on the old scan (church, road fork, sheet tick)."
              : m === "gcp-map"
                ? "Georef · click the same point on today's plan, or type lon,lat."
                : get().status,
        }),
      collageOverlays: () => {
        const next = assembleCollage(get().overlays);
        set({
          overlays: next,
          dirtyFit: true,
          fitNonce: get().fitNonce + 1,
          view: "plan",
          rightTab: "maps",
          status: `Collage of ${next.length} sheets. Set 1:N scale, then georef onto the live map.`,
        });
      },
      scaleOverlay: (id, printedScale, dpi) => {
        set({
          overlays: get().overlays.map((s) => (s.id === id ? applyPrintedScale(s, printedScale, dpi) : s)),
          dirtyFit: true,
          fitNonce: get().fitNonce + 1,
          status: `Sheet scaled at 1:${printedScale}.`,
        });
      },
      addOverlayGcp: (id, gcp) => {
        set({
          overlays: get().overlays.map((s) => {
            if (s.id !== id) return s;
            const next = { ...s, gcps: [...s.gcps, gcp] };
            next.geo = geoFromGcps(next);
            return next;
          }),
        });
      },
      setPendingGcp: (p) => set({ pendingGcp: p }),
      finishGcp: (world, geo) => {
        const st = get();
        const pending = st.pendingGcp;
        const id = st.activeOverlayId;
        if (!pending || !id) {
          set({ status: "Click the old scan first." });
          return;
        }
        const gcp: OverlayGcp = {
          id: nid("gcp"),
          imgX: pending.imgX,
          imgY: pending.imgY,
          x: world.x,
          y: world.y,
          lon: geo?.lon ?? (st.view === "globe" ? st.globe.lon : undefined),
          lat: geo?.lat ?? (st.view === "globe" ? st.globe.lat : undefined),
        };
        const overlays = st.overlays.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, gcps: [...s.gcps, gcp] };
          next.geo = geoFromGcps(next);
          return next;
        });
        const n = overlays.find((s) => s.id === id)?.gcps.length ?? 0;
        set({
          overlays,
          pendingGcp: null,
          overlayMode: n < 2 ? "gcp-img" : "idle",
          status:
            n < 2
              ? "One control point set. Click a second mark on the scan."
              : "Sheet locked to the modern map. Opacity in Maps. Properties now sit on today's ground.",
        });
      },
    }),
    {
      name: "astranov-bimcad-v1",
      skipHydration: true,
      partialize: (s) => ({
        project: s.project,
        snap: s.snap,
        ortho: s.ortho,
        units: s.units,
        cam: s.cam,
        globe: { ...s.globe, flyNonce: 0 },
      }),
    },
  ),
);

function toolStatus(t: Tool): string {
  switch (t) {
    case "select":
      return "Select · click geometry · Shift additive · Del to erase";
    case "pan":
      return "Pan · drag the sheet · wheel zooms about cursor";
    case "line":
      return "Line · two points · @dx,dy or @dist<angle in the command line";
    case "rect":
      return "Rectangle · two corners";
    case "circle":
      return "Circle · centre, then radius";
    case "polyline":
      return "Polyline · click vertices · Enter to close";
    case "wall":
      return "Wall · two points · thickness and height from project defaults";
    case "door":
      return "Door · click a wall, then offset along it";
    case "window":
      return "Window · click a wall";
    case "column":
      return "Column · click centre";
    case "room":
      return "Room · click the polygon · Enter to close";
    case "dim":
      return "Aligned dimension · two points, then offset";
    case "text":
      return "Text · click insertion, then type in the command line";
    case "survey":
      return "Survey point · click, then code in the command line";
    case "measure":
      return "Measure · two points · distance, bearing, ΔE ΔN";
    default:
      return "";
  }
}

export function layerColor(project: Project, layerId: string): string {
  return project.layers.find((l) => l.id === layerId)?.color ?? "#c5cdc6";
}

export function visible(project: Project, id: Id): boolean {
  const l = project.layers.find((x) => x.id === id);
  return !l || l.visible;
}

export { nid };
