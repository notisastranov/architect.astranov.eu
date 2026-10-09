import { useEffect, useState } from "react";
import {
  Box,
  Download,
  FileImage,
  Globe2,
  HelpCircle,
  Layers,
  Maximize2,
  Redo2,
  Sparkles,
  SplitSquareHorizontal,
  Square,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCad, adoptSession } from "@/lib/cad/store";
import { SAMPLE_CATALOG } from "@/lib/cad/samples";
import { exportJson, exportSurveyCsv, exportSvg } from "@/lib/cad/export";
import { BrandMark } from "./Mark";
import { commitPolyline } from "./Viewport2D";
import { Work } from "./Work";
import type { Project, Tool, ViewMode } from "@/lib/cad/types";

const KEY_TOOLS: Record<string, Tool> = {
  KeyV: "select",
  KeyH: "pan",
  KeyL: "line",
  KeyW: "wall",
  KeyD: "door",
  KeyI: "window",
  KeyC: "circle",
  KeyG: "rect",
  KeyR: "room",
  KeyQ: "dim",
  KeyT: "text",
  KeyP: "survey",
  KeyM: "measure",
  KeyO: "column",
};

export function Studio() {
  const projectsOpen = useCad((s) => s.projectsOpen);
  const helpOpen = useCad((s) => s.helpOpen);
  const [posterOpen, setPosterOpen] = useState(false);

  useEffect(() => {
    const r = useCad.persist.rehydrate() as void | Promise<void>;
    if (r && typeof r.then === "function") void r.then(() => adoptSession());
    else adoptSession();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      const st = useCad.getState();
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyY") {
        e.preventDefault();
        st.redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "Digit0") {
        e.preventDefault();
        st.zoomExtents();
        return;
      }
      if (e.code === "F8") {
        e.preventDefault();
        st.setOrtho(!st.ortho);
        return;
      }
      if (e.code === "F1") {
        e.preventDefault();
        st.setHelpOpen(!st.helpOpen);
        return;
      }
      if (typing) {
        if (e.code === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.code === "Escape") {
        st.setDraft(null);
        st.clearSelection();
        st.setTool("select");
        return;
      }
      if (e.code === "Enter") {
        commitPolyline();
        return;
      }
      if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        st.deleteSelection();
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        const order: ViewMode[] = ["globe", "plan", "split", "model"];
        const i = order.indexOf(st.view);
        st.setView(order[(i + 1) % order.length]!);
        return;
      }
      const tool = KEY_TOOLS[e.code];
      if (tool && !e.metaKey && !e.ctrlKey && !e.altKey) {
        st.setTool(tool);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <TopBar />
      <Work />
      {projectsOpen && <ProjectsOverlay onPoster={() => setPosterOpen(true)} />}
      {helpOpen && <HelpOverlay />}
      {posterOpen && <PosterOverlay onClose={() => setPosterOpen(false)} />}
    </div>
  );
}

function TopBar() {
  const undo = useCad((s) => s.undo);
  const redo = useCad((s) => s.redo);
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border bg-bg px-3 py-2">
      <button type="button" onClick={() => useCad.getState().setProjectsOpen(true)} className="flex min-w-0 items-center gap-2 text-left">
        <BrandMark className="size-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-[10px] tracking-[0.16em] text-muted">HOME</span>
          <span className="block text-sm font-medium leading-tight">Astranov Architect Forensic TopoBimCad</span>
        </span>
      </button>
      <div className="ml-auto flex items-center">
        <IconBtn label="Undo" onClick={undo}><Undo2 className="size-4" /></IconBtn>
        <IconBtn label="Redo" onClick={redo}><Redo2 className="size-4" /></IconBtn>
      </div>
    </header>
  );
}

function ViewBtn({ id, view, setView, icon, label }: { id: ViewMode; view: ViewMode; setView: (v: ViewMode) => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={() => setView(id)} title={label} className={cn("hidden size-9 items-center justify-center rounded-sm sm:flex", view === id ? "bg-elevated text-fg" : "text-muted hover:text-fg")}>
      {icon}
    </button>
  );
}

function IconBtn({ children, onClick, label, className }: { children: React.ReactNode; onClick: () => void; label: string; className?: string }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={cn("flex size-9 items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-fg", className)}>
      {children}
    </button>
  );
}

function ExportMenu() {
  const project = useCad((s) => s.project);
  const loadProject = useCad((s) => s.loadProject);
  return (
    <>
      <IconBtn label="Export JSON" onClick={() => { exportJson(project); toast.success("Project JSON downloaded"); }}><Download className="size-4" /></IconBtn>
      <label className="flex size-9 cursor-pointer items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-fg" title="Import JSON">
        <Upload className="size-4" />
        <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const data = JSON.parse(await file.text()) as Project;
            if (!data?.entities || !data?.layers) throw new Error("Not an Astranov BIMCAD project");
            loadProject(data);
            toast.success("Project opened");
          } catch {
            toast.error("Could not read that file");
          }
        }} />
      </label>
    </>
  );
}

function ProjectsOverlay({ onPoster }: { onPoster: () => void }) {
  const load = useCad((s) => s.loadProject);
  const neu = useCad((s) => s.newProject);
  const project = useCad((s) => s.project);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/80" aria-label="Close projects" onClick={() => useCad.getState().setProjectsOpen(false)} />
      <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-xl bg-surface p-5 sm:rounded-xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <BrandMark className="size-6" />
              <span className="text-xs font-medium tracking-[0.18em]">ASTRANOV ARCHITECT BIMCAD</span>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-balance">Open a model</h1>
            <p className="mt-1 max-w-md text-sm text-muted text-pretty">Millimetre kernel. Architecture, mechanical, survey. Snap, ortho, IFC properties, quantities, inverse.</p>
          </div>
          <button type="button" onClick={() => useCad.getState().setProjectsOpen(false)} className="size-10 text-muted"><X className="mx-auto size-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SAMPLE_CATALOG.map((s) => (
            <button key={s.id} type="button" onClick={() => load(s.load())} className={cn("rounded-md bg-elevated p-4 text-left transition-colors hover:bg-border/40", project.id.includes(s.id) && "ring-1 ring-primary/40")}>
              <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">{s.discipline}</div>
              <div className="mt-1 text-base font-medium">{s.title}</div>
              <div className="mt-1 font-mono text-[11px] text-primary">{s.spec}</div>
              <p className="mt-2 text-xs text-muted">{s.blurb}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Ghost onClick={() => neu("architecture")}>New architectural</Ghost>
          <Ghost onClick={() => neu("mechanical")}>New mechanical</Ghost>
          <Ghost onClick={() => neu("survey")}>New survey</Ghost>
          <Ghost onClick={() => { exportSvg(useCad.getState().project); toast.success("SVG sheet downloaded"); }}>Export SVG</Ghost>
          <Ghost onClick={() => { exportSurveyCsv(useCad.getState().project); toast.success("CSV downloaded"); }}>Export CSV</Ghost>
          <Ghost onClick={() => { useCad.getState().setProjectsOpen(false); onPoster(); }}>Product poster</Ghost>
        </div>
      </div>
    </div>
  );
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-sm px-3 py-2 text-xs text-muted ring-1 ring-border hover:text-fg">{children}</button>;
}

function HelpOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/80" aria-label="Close help" onClick={() => useCad.getState().setHelpOpen(false)} />
      <div className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface p-6 sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-subtle">ASTRANOV ARCHITECT BIMCAD</div>
            <h2 className="mt-1 text-lg font-medium">Instruments</h2>
          </div>
          <button type="button" onClick={() => useCad.getState().setHelpOpen(false)} className="size-10 text-muted"><X className="mx-auto size-4" /></button>
        </div>
        <dl className="space-y-2 font-mono text-xs">
          {[
            ["V / Esc", "Select / cancel"],
            ["W L G C R D I", "Wall, line, plate, hole, room, door, window"],
            ["Click + snap", "End, mid, centre, intersection, grid"],
            ["F8", "Ortho constrain"],
            ["Wheel / pinch", "Zoom about cursor"],
            ["Middle / space-drag", "Pan the sheet"],
            ["@dx,dy  @dist<angle", "Relative / polar in the command line"],
            ["Tab", "Earth · Plan · Split · Model"],
            ["Earth view", "Globe first · zoom Greece for Ktimatologio layers"],
            ["Ctrl Z / Shift Z", "Undo / redo"],
            ["Delete", "Erase selection"],
            ["AI dock", "Natural language into millimetre geometry"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-border/60 py-1.5">
              <dt className="text-primary">{k}</dt>
              <dd className="text-right text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function PosterOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/85" aria-label="Close poster" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl bg-surface sm:rounded-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-subtle">A3 · POSTER-01</div>
            <h2 className="text-base font-medium">Astranov Architect BIMCAD</h2>
          </div>
          <div className="flex items-center gap-1">
            <a href="/poster.png" download="Astranov-Architect-BIMCAD-poster.png" className="flex size-10 items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-fg" title="Download PNG"><Download className="size-4" /></a>
            <a href="/poster.html" target="_blank" rel="noreferrer" className="hidden rounded-sm px-3 py-2 font-mono text-[10px] tracking-wide text-muted uppercase hover:bg-elevated hover:text-fg sm:inline">Print sheet</a>
            <button type="button" onClick={onClose} className="size-10 text-muted" aria-label="Close"><X className="mx-auto size-4" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-3 pb-4">
          <img src="/poster.png" alt="Astranov Architect BIMCAD product poster" className="mx-auto w-full max-w-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]" />
        </div>
      </div>
    </div>
  );
}
