import { useEffect, useState } from "react";
import { Download, Redo2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCad, adoptSession } from "@/lib/cad/store";
import { SAMPLE_CATALOG } from "@/lib/cad/samples";
import { exportSurveyCsv, exportSvg } from "@/lib/cad/export";
import { sampleOliveTreehouse } from "@/lib/cad/olive-house";
import { authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { accessState } from "@/lib/billing/api";
import { BrandMark } from "./Mark";
import { commitPolyline } from "./Viewport2D";
import { Work } from "./Work";
import { Welcome } from "./Welcome";
import type { Tool } from "@/lib/cad/types";

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
  const [dossier, setDossier] = useState(false);
  const [entered, setEntered] = useState(false);
  const { user, isPending } = useCurrentUserState();

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
      const tool = KEY_TOOLS[e.code];
      if (tool && !e.metaKey && !e.ctrlKey && !e.altKey) {
        st.setTool(tool);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("from") === "spacenet") setEntered(true);
  }, []);

  if (!user && !entered) {
    if (isPending) return <div className="min-h-dvh bg-bg" />;
    return <Welcome onEnter={() => setEntered(true)} />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <TopBar dossier={dossier} onDossier={setDossier} />
      <Work dossier={dossier} />
      {projectsOpen && <ProjectsOverlay onPoster={() => setPosterOpen(true)} />}
      {helpOpen && <HelpOverlay />}
      {posterOpen && <PosterOverlay onClose={() => setPosterOpen(false)} />}
    </div>
  );
}

function TopBar({ dossier, onDossier }: { dossier: boolean; onDossier: (open: boolean) => void }) {
  const undo = useCad((s) => s.undo);
  const redo = useCad((s) => s.redo);
  const { user } = useCurrentUserState();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("from") === "spacenet") localStorage.setItem("astranov-spacenet", "1");
  }, []);

  useEffect(() => {
    if (!user) return;
    const fromNet = new URLSearchParams(window.location.search).get("from") === "spacenet";
    if (!fromNet) return;
    void accessState()
      .then((row) => {
        if (!row.owner) return;
        const id = useCad.getState().project.id;
        const frame = id === "iron-olive-greenhouse-villa" ? "iron" : "timber";
        useCad.getState().loadProject(sampleOliveTreehouse(frame, true));
        onDossier(true);
      })
      .catch(() => undefined);
  }, [user, onDossier]);

  const openDossier = async () => {
    if (dossier) {
      const id = useCad.getState().project.id;
      const frame = id === "iron-olive-greenhouse-villa" ? "iron" : "timber";
      useCad.getState().loadProject(sampleOliveTreehouse(frame, false));
      onDossier(false);
      return;
    }
    if (!user) {
      if (!authEnabled) {
        toast.error("Η είσοδος δεν είναι ανοιχτή σε αυτή την προβολή.");
        return;
      }
      await signIn("grok-google", { callbackURL: "/?from=spacenet" });
      return;
    }
    try {
      const row = await accessState();
      if (!row.owner) {
        toast.error("Αυτός ο λογαριασμός δεν έχει ιδιωτικό φάκελο.");
        return;
      }
      const id = useCad.getState().project.id;
      const frame = id === "iron-olive-greenhouse-villa" ? "iron" : "timber";
      useCad.getState().loadProject(sampleOliveTreehouse(frame, true));
      onDossier(true);
    } catch {
      toast.error("Μπες με Google. Από το SpaceNet, ή από εδώ.");
    }
  };

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
        <button type="button" onClick={() => void openDossier()} className={`mr-1 h-9 rounded-sm px-2 text-xs ${dossier ? "bg-primary text-primary-fg" : "text-muted hover:bg-elevated"}`}>
          Ιδιωτικό
        </button>
        <IconBtn label="Undo" onClick={undo}><Undo2 className="size-4" /></IconBtn>
        <IconBtn label="Redo" onClick={redo}><Redo2 className="size-4" /></IconBtn>
      </div>
    </header>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="flex size-9 items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-fg">
      {children}
    </button>
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
              <span className="text-xs font-medium tracking-[0.18em]">ASTRANOV ARCHITECT FORENSIC TOPOBIMCAD</span>
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
            <div className="font-mono text-[10px] tracking-[0.18em] text-subtle">ASTRANOV ARCHITECT FORENSIC TOPOBIMCAD</div>
            <h2 className="mt-1 text-lg font-medium">Three fields</h2>
          </div>
          <button type="button" onClick={() => useCad.getState().setHelpOpen(false)} className="size-10 text-muted"><X className="mx-auto size-4" /></button>
        </div>
        <dl className="space-y-2 font-mono text-xs">
          {[
            ["Architect", "Photographs and a sentence. Pictures and film of the finished place."],
            ["BIMCAD", "Select, wall, dimension, note. Undo, fit, delete."],
            ["Topo", "Imported sheets, years, north, altitude. Old against new."],
            ["V / Esc", "Select / cancel"],
            ["F8", "Ortho"],
            ["Wheel / pinch", "Zoom"],
            ["Ctrl Z", "Undo"],
            ["Delete", "Erase the selection"],
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
            <h2 className="text-base font-medium">Astranov Architect Forensic TopoBimCad</h2>
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
