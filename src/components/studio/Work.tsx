import { useState } from "react";
import { toast } from "sonner";
import { useCad } from "@/lib/cad/store";
import { exportJson } from "@/lib/cad/export";
import { exportDxf, importDxf } from "@/lib/cad/dxf";
import { installAllServices, installService } from "@/lib/cad/services";
import { raiseBuilding, raiseFilm, raiseFilmStatus } from "@/lib/billing/api";
import { Viewport2D } from "./Viewport2D";
import { ViewportGlobe } from "./ViewportGlobe";
import { YearTimeline } from "./YearTimeline";
import { MapsPanel } from "./MapsPanel";
import { VaultAudit } from "./VaultAudit";
import { Properties } from "./DockPanels";
import { sampleOliveTreehouse } from "@/lib/cad/olive-house";
import { talk, anotherVideo } from "./ai-talk";

function Field({ scope, placeholder }: { scope: string; placeholder: string }) {
  const [text, setText] = useState("");
  const busy = useCad((s) => s.aiBusy);
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text;
        setText("");
        void talk(q, scope);
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={scope}
        className="h-12 min-w-0 flex-1 rounded-sm bg-elevated px-3 text-sm outline-none placeholder:text-subtle"
      />
      <button type="submit" disabled={busy || !text.trim()} className="h-12 shrink-0 rounded-sm bg-primary px-4 text-sm text-primary-fg disabled:opacity-40">
        {busy ? "…" : "AI"}
      </button>
    </form>
  );
}

function Exchange() {
  const project = useCad((s) => s.project);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => exportDxf(project)} className="h-10 rounded-sm bg-elevated px-3 text-xs">
        Export AutoCAD
      </button>
      <button type="button" onClick={() => exportJson(project)} className="h-10 rounded-sm bg-elevated px-3 text-xs">
        Export OpenCAD
      </button>
      <label className="flex h-10 cursor-pointer items-center rounded-sm bg-elevated px-3 text-xs">
        Import
        <input
          type="file"
          accept=".dxf,.json,application/json,application/dxf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const text = await file.text();
            if (file.name.toLowerCase().endsWith(".json")) {
              try {
                const data = JSON.parse(text) as { entities?: unknown; layers?: unknown };
                if (!data.entities || !data.layers) throw new Error("not a project");
                useCad.getState().loadProject(data as never);
                toast.success("OpenCAD project opened");
              } catch {
                toast.error("That JSON is not an OpenCAD project");
              }
              return;
            }
            const entities = importDxf(text);
            if (!entities.length) {
              toast.error("No drawing entities in that DXF");
              return;
            }
            useCad.getState().commit((p) => ({ ...p, entities: [...p.entities, ...entities] }), `${entities.length} entities from AutoCAD`);
            toast.success("AutoCAD drawing added");
          }}
        />
      </label>
    </div>
  );
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

export function Work() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-16 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Three fields. The vision, then the building, then the land.</p>
        <Architect />
        <Bim />
        <Topo />
      </div>
    </div>
  );
}

function Architect() {
  const images = useCad((s) => s.aiImages);
  const videos = useCad((s) => s.aiVideos);
  const [note, setNote] = useState("The finished pentagon treehouse, on the real olive field, at the centre of the plot.");
  const [sheet, setSheet] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const make = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const spacenet = localStorage.getItem("astranov-spacenet") === "1";
      const res = await raiseBuilding({ data: { prompt: note, imageDataUrl: sheet, spacenet } });
      if (!res.ok) {
        toast.error("error" in res ? res.error : "code" in res && res.code === "unpaid" ? `The hour is ${res.hourEur} €.` : "It did not finish.");
        return;
      }
      if (Array.isArray(res.ops) && res.ops.length) useCad.getState().applyAi(res.ops as never);
      if (res.photoUrl) useCad.getState().pushAiMedia("images", res.photoUrl);
      toast.success(res.message);
      if (res.photoUrl) {
        const started = await raiseFilm({ data: { photoUrl: res.photoUrl, prompt: res.photoPrompt || note, spacenet } });
        if (started.ok && "requestId" in started) {
          for (let i = 0; i < 24; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            const row = await raiseFilmStatus({ data: { requestId: started.requestId } });
            if (row.url) {
              useCad.getState().pushAiMedia("videos", row.url);
              toast.success("The film is at the top.");
              break;
            }
            if (row.status === "failed" || row.status === "expired") break;
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <p className="font-mono text-[10px] tracking-[0.18em] text-subtle">01 — ARCHITECT</p>
      <h2 className="mt-2 text-xl font-medium">The AI</h2>
      <p className="mt-2 text-sm text-muted">Drop the photographs and the notes of the place. It makes the pictures and the film of the finished work, on the real ground.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => useCad.getState().loadProject(sampleOliveTreehouse("timber"))} className="overflow-hidden rounded-sm border border-border text-left">
          <img src="/marmarades/pentagon-aerial.jpg?v=2" alt="Timber pentagon treehouse" className="h-36 w-full object-cover" />
          <span className="block px-2 py-2 text-xs">Pentagon olive treehouse · timber</span>
        </button>
        <button type="button" onClick={() => useCad.getState().loadProject(sampleOliveTreehouse("iron"))} className="overflow-hidden rounded-sm border border-border text-left">
          <img src="/marmarades/iron-villa.jpg?v=1" alt="Iron Olive Tree Greenhouse Villa" className="h-36 w-full object-cover" />
          <span className="block px-2 py-2 text-xs">Iron Olive Tree Greenhouse Villa</span>
        </button>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {images.map((src) => (
          <img key={src} src={src} alt="Finished project" className="h-44 w-auto shrink-0 rounded-sm object-cover" />
        ))}
        {videos.map((src) => (
          <video key={src} src={src} poster="/marmarades/house.jpg" controls playsInline className="h-44 w-auto shrink-0 rounded-sm bg-black" />
        ))}
      </div>
      <label className="mt-4 flex h-12 cursor-pointer items-center justify-center rounded-sm border border-dashed border-border text-sm text-muted">
        {sheet ? "Photograph ready" : "Drop photographs of the project"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void readImage(file)
              .then((url) => {
                setSheet(url);
                useCad.getState().pushAiMedia("images", url);
              })
              .catch(() => toast.error("The picture did not read"));
          }}
        />
      </label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-3 w-full rounded-sm bg-elevated px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void make()} className="h-11 rounded-sm bg-primary px-4 text-sm text-primary-fg disabled:opacity-40">
          {busy ? "Making it…" : "Picture and film"}
        </button>
        <button type="button" onClick={() => void anotherVideo(note)} className="h-11 rounded-sm bg-elevated px-4 text-sm">
          Another film
        </button>
      </div>
      <Field scope="Architect" placeholder="Change the vision. Say what the finished place should be." />
      <Exchange />
    </section>
  );
}

function Bim() {
  const project = useCad((s) => s.project);
  const tool = useCad((s) => s.tool);
  const ortho = useCad((s) => s.ortho);
  const selected = useCad((s) => s.selection.length);
  const penta = project.entities.find((e) => e.kind === "polyline" && e.id === "penta");
  const olives = project.entities.filter((e) => e.kind === "column" && e.material === "Olive trunk").length;
  const deck = project.entities.find((e) => e.id === "deck");
  const deckMat = deck && deck.kind === "slab" ? deck.material : "Deck";
  const services = [
    project.entities.some((e) => e.id.startsWith("svc-elec")) ? "Electrical" : "",
    project.entities.some((e) => e.id.startsWith("svc-water")) ? "Plumbing" : "",
    project.entities.some((e) => e.id.startsWith("svc-pump")) ? "Pump" : "",
  ].filter(Boolean);
  const tools = [
    ["select", "Select"],
    ["pan", "Pan"],
    ["wall", "Wall"],
    ["door", "Door"],
    ["window", "Window"],
    ["column", "Column"],
    ["line", "Line"],
    ["dim", "Dimension"],
    ["text", "Note"],
  ] as const;
  return (
    <section>
      <p className="font-mono text-[10px] tracking-[0.18em] text-subtle">02 — BIMCAD</p>
      <h2 className="mt-2 text-xl font-medium">The building</h2>
      <p className="mt-2 text-sm text-muted">Correct the drawing with the tools, or say the change. Select a part and its sizes are underneath.</p>
      <div className="mt-4 overflow-hidden rounded-sm border border-border">
        <div className="flex flex-wrap gap-1 border-b border-border p-1">
          {tools.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              onClick={() => useCad.getState().setTool(id)}
              className={`h-9 rounded-sm px-2.5 text-xs ${tool === id ? "bg-primary text-primary-fg" : "bg-elevated text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 border-b border-border p-1">
          <button type="button" onClick={() => useCad.getState().undo()} className="h-9 rounded-sm bg-elevated px-2.5 text-xs">Undo</button>
          <button type="button" onClick={() => useCad.getState().redo()} className="h-9 rounded-sm bg-elevated px-2.5 text-xs">Redo</button>
          <button type="button" onClick={() => useCad.getState().zoomExtents()} className="h-9 rounded-sm bg-elevated px-2.5 text-xs">Fit</button>
          <button type="button" onClick={() => useCad.getState().deleteSelection()} className="h-9 rounded-sm bg-elevated px-2.5 text-xs">Delete</button>
          <button type="button" aria-pressed={ortho} onClick={() => useCad.getState().setOrtho(!ortho)} className={`h-9 rounded-sm px-2.5 text-xs ${ortho ? "bg-primary text-primary-fg" : "bg-elevated text-muted"}`}>Ortho</button>
        </div>
        <div className="h-[68dvh]">
          <Viewport2D />
        </div>
      </div>
      {selected > 0 && (
        <div className="mt-3 rounded-sm border border-border p-3">
          <Properties />
        </div>
      )}
      <ul className="mt-4 space-y-1 text-sm text-muted">
        <li>{project.name}</li>
        <li>{penta && penta.kind === "polyline" ? "Regular pentagon, side 12.00 m, interior angle 108°." : "No pentagon on this sheet yet."}</li>
        <li>{olives} olive trunks as columns. {deckMat}. Glass screens.</li>
        <li>{services.length ? services.join(" · ") + " drawn." : "Services not drawn yet."}</li>
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => installService("electrical")} className="h-10 rounded-sm bg-elevated px-3 text-xs">Electrical</button>
        <button type="button" onClick={() => installService("plumbing")} className="h-10 rounded-sm bg-elevated px-3 text-xs">Plumbing</button>
        <button type="button" onClick={() => installService("pump")} className="h-10 rounded-sm bg-elevated px-3 text-xs">Pump</button>
        <button type="button" onClick={() => installAllServices()} className="h-10 rounded-sm bg-primary px-3 text-xs text-primary-fg">All equipment</button>
      </div>
      <Field scope="BIMCAD" placeholder="Add the electrical, move the jacuzzi, change a size." />
      <Exchange />
    </section>
  );
}

function Topo() {
  const project = useCad((s) => s.project);
  const overlays = useCad((s) => s.overlays);
  const points = project.entities.filter((e) => e.kind === "survey");
  const zs = points.map((e) => (e.kind === "survey" ? e.z : 0));
  const zMin = zs.length ? Math.min(...zs) : 0;
  const zMax = zs.length ? Math.max(...zs) : 0;
  return (
    <section className="pb-16">
      <p className="font-mono text-[10px] tracking-[0.18em] text-subtle">03 — TOPO</p>
      <h2 className="mt-2 text-xl font-medium">The land</h2>
      <p className="mt-2 text-sm text-muted">Your imported sheets stay here, on the drawing below them. Altitude, north, old against new. A shift is evidence, not a verdict.</p>
      {overlays.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No imported sheet is in this browser. Import it again under the map. From now on it is kept.</p>
      ) : (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {overlays.map((s) => (
            <button key={s.id} type="button" onClick={() => useCad.getState().setActiveOverlay(s.id)} className="shrink-0 text-left">
              <img src={s.src} alt={s.name} className="h-36 w-auto rounded-sm object-cover" />
              <span className="mt-1 block text-xs text-muted">{s.name}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="mt-4 space-y-1 text-sm text-muted">
        <li>North is up. The pentagon point faces north.</li>
        <li>
          {points.length} survey points. Altitude {zMin === zMax ? `${zMin.toFixed(2)} m` : `${zMin.toFixed(2)} to ${zMax.toFixed(2)} m`}.
        </li>
        <li>Centre of the parcel, EGSA ’87: E 878647.887 · N 4034931.433.</li>
      </ul>
      <div className="mt-4 overflow-hidden rounded-sm border border-border">
        <YearTimeline />
      </div>
      <div className="mt-4 h-[46dvh] overflow-hidden rounded-sm border border-border">
        <ViewportGlobe />
      </div>
      <div className="mt-4">
        <MapsPanel />
      </div>
      <div className="mt-4">
        <VaultAudit />
      </div>
      <Field scope="Topo" placeholder="Compare the old sheet with the new one. Ask where they disagree." />
      <Exchange />
    </section>
  );
}
