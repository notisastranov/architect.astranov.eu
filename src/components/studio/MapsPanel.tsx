import { toast } from "sonner";
import { useCad } from "@/lib/cad/store";
import { runProjectFilm } from "@/lib/cad/film";
import { getDeclaration, getSite, patchDeclaration, patchSite } from "@/lib/cad/site-session";
import { SITE_PROPOSE_PROMPT } from "@/lib/cad/propose-site";
import { RHODES_IGM, igmSheet } from "@/lib/gis/igm";
import { useState } from "react";

export function MapsPanel() {
  const overlays = useCad((s) => s.overlays);
  const active = useCad((s) => s.activeOverlayId);
  const mode = useCad((s) => s.overlayMode);
  const [, bump] = useState(0);
  const site = getSite();
  const dec = getDeclaration();

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Real map of the area, then our plot. AI draughts the building; you edit the BIM; Film flies from the cadastre down to the finished work and the architectural declaration.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Ghost onClick={() => useCad.getState().collageOverlays()}>Collage</Ghost>
        <Ghost
          onClick={() => {
            useCad.getState().setView("plan");
            useCad.getState().setOverlayMode("gcp-img");
          }}
        >
          Georef
        </Ghost>
        <Ghost
          onClick={() => {
            useCad.getState().setRightTab("ai");
            useCad.getState().setAiOpen(true);
            useCad.getState().setPrompt(SITE_PROPOSE_PROMPT);
          }}
        >
          Propose
        </Ghost>
        <Ghost
          onClick={() => {
            toast.message("Recording site film");
            void runProjectFilm().then(() => toast.success("Film downloaded")).catch((e) => toast.error(String(e)));
          }}
        >
          Film
        </Ghost>
      </div>
      <label className="flex h-9 cursor-pointer items-center justify-center rounded-sm bg-elevated text-xs hover:text-fg">
        Import scans
        <input
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.tif,.tiff,.webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (!files.length) return;
            void useCad.getState().importOverlayFiles(files).then(() => toast.success("Scans on the plan"));
          }}
        />
      </label>
      <p className="font-mono text-[10px] tracking-wide text-subtle uppercase">
        {mode === "idle" ? `${overlays.length} sheets` : mode === "gcp-img" ? "Click old scan" : "Click today's map"}
      </p>
      <ul className="space-y-2">
        {overlays.map((s) => (
          <li key={s.id} className={`rounded-sm bg-elevated/70 p-2 ${active === s.id ? "ring-1 ring-primary/40" : ""}`}>
            <button type="button" className="w-full text-left" onClick={() => useCad.getState().setActiveOverlay(s.id)}>
              <div className="text-xs font-medium">{s.name}</div>
              <div className="font-mono text-[10px] text-subtle">
                {s.role} · 1:{s.printedScale} · {s.gcps.length} GCP{s.geo ? " · locked" : ""}
              </div>
            </button>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex-1 text-[10px] text-subtle">
                Opacity
                <input type="range" min={0.15} max={1} step={0.05} value={s.opacity} onChange={(e) => useCad.getState().patchOverlay(s.id, { opacity: Number(e.target.value) })} className="w-full" />
              </label>
              <select value={s.printedScale} onChange={(e) => useCad.getState().scaleOverlay(s.id, Number(e.target.value))} className="h-7 rounded-sm bg-bg px-1 font-mono text-[10px]">
                {[1000, 2000, 5000, 10000, 25000, 50000, 100000].map((n) => (
                  <option key={n} value={n}>1:{n}</option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5">
        <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">Architectural declaration</div>
        <Field label="Project" value={site.name} onChange={(v) => { patchSite({ name: v }); bump((n) => n + 1); }} />
        <Field label="Municipality" value={site.municipality} onChange={(v) => { patchSite({ municipality: v }); bump((n) => n + 1); }} />
        <Field label="Plot" value={site.plot} onChange={(v) => { patchSite({ plot: v }); bump((n) => n + 1); }} />
        <Field label="Architect" value={dec.author} onChange={(v) => { patchDeclaration({ author: v }); bump((n) => n + 1); }} />
        <Field label="Program" value={dec.program} onChange={(v) => { patchDeclaration({ program: v }); bump((n) => n + 1); }} />
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-subtle uppercase">Statement</span>
          <textarea value={dec.statement} onChange={(e) => { patchDeclaration({ statement: e.target.value }); bump((n) => n + 1); }} rows={4} className="w-full rounded-sm bg-elevated px-2 py-1.5 text-xs outline-none" />
        </label>
      </div>
      <IgmLookup />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-subtle uppercase">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-full rounded-sm bg-elevated px-2 text-xs outline-none" />
    </label>
  );
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-sm px-2 py-1.5 text-[11px] text-muted ring-1 ring-border hover:text-fg">
      {children}
    </button>
  );
}

function IgmLookup() {
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const id = String(fd.get("igm") ?? "");
        const sheet = igmSheet(id);
        if (!sheet) {
          toast.error("Try F.106 II N.O. or a Rodi tavoletta id");
          return;
        }
        const st = useCad.getState();
        st.setView("globe");
        st.setGlobe({ lat: (sheet.south + sheet.north) / 2, lon: (sheet.west + sheet.east) / 2, flyNonce: st.globe.flyNonce + 1 });
        toast.success(`${sheet.id} · 1:${sheet.scale}`);
      }}
    >
      <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">IGM sheet</label>
      <input name="igm" placeholder="F.106 II N.O." className="h-8 w-full rounded-sm bg-elevated px-2 font-mono text-xs outline-none" />
    </form>
  );
}
