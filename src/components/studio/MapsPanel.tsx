import { toast } from "sonner";
import { useCad } from "@/lib/cad/store";
import { RHODES_IGM, igmSheet } from "@/lib/gis/igm";

export function MapsPanel() {
  const overlays = useCad((s) => s.overlays);
  const active = useCad((s) => s.activeOverlayId);
  const mode = useCad((s) => s.overlayMode);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Import the big Italian quadro d'unione and the small tavolette. Collage them, set the printed 1:N, then pin two points onto today's map so every particella sits on the live ground.
      </p>
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
            useCad.getState().setView("globe");
            useCad.getState().setGlobe({
              lat: (RHODES_IGM.south + RHODES_IGM.north) / 2,
              lon: (RHODES_IGM.west + RHODES_IGM.east) / 2,
              flyNonce: useCad.getState().globe.flyNonce + 1,
            });
          }}
        >
          Rodi IGM
        </Ghost>
      </div>
      <p className="font-mono text-[10px] tracking-wide text-subtle uppercase">
        {mode === "idle" ? `${overlays.length} sheets` : mode === "gcp-img" ? "Click old scan" : "Click today's map"}
      </p>
      <ul className="space-y-2">
        {overlays.map((s) => (
          <li
            key={s.id}
            className={`rounded-sm bg-elevated/70 p-2 ${active === s.id ? "ring-1 ring-primary/40" : ""}`}
          >
            <button type="button" className="w-full text-left" onClick={() => useCad.getState().setActiveOverlay(s.id)}>
              <div className="text-xs font-medium">{s.name}</div>
              <div className="font-mono text-[10px] text-subtle">
                {s.role} · 1:{s.printedScale} · {s.gcps.length} GCP
                {s.geo ? " · locked" : ""}
              </div>
            </button>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex-1 text-[10px] text-subtle">
                Opacity
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={s.opacity}
                  onChange={(e) => useCad.getState().patchOverlay(s.id, { opacity: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <select
                value={s.printedScale}
                onChange={(e) => useCad.getState().scaleOverlay(s.id, Number(e.target.value))}
                className="h-7 rounded-sm bg-bg px-1 font-mono text-[10px]"
              >
                {[1000, 2000, 5000, 10000, 25000, 50000, 100000].map((n) => (
                  <option key={n} value={n}>
                    1:{n}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-1 flex justify-between">
              <button
                type="button"
                className="text-[10px] text-muted hover:text-fg"
                onClick={() => useCad.getState().patchOverlay(s.id, { visible: !s.visible })}
              >
                {s.visible ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="text-[10px] text-muted hover:text-fg"
                onClick={() => useCad.getState().removeOverlay(s.id)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <IgmLookup />
    </div>
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
        st.setGlobe({
          lat: (sheet.south + sheet.north) / 2,
          lon: (sheet.west + sheet.east) / 2,
          flyNonce: st.globe.flyNonce + 1,
        });
        toast.success(`${sheet.id} · 1:${sheet.scale}`);
      }}
    >
      <label className="block text-[10px] font-medium tracking-wide text-subtle uppercase">IGM sheet</label>
      <input name="igm" placeholder="F.106 II N.O." className="h-8 w-full rounded-sm bg-elevated px-2 font-mono text-xs outline-none" />
    </form>
  );
}
