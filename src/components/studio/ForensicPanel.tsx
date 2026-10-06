import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCad } from "@/lib/cad/store";
import { angleAt, arcThrough, compareTraces, entityEnds, lengthOf, polylineLength } from "@/lib/cad/forensic";
import { formatMm } from "@/lib/cad/units";
import { blinkSheets, startForensicTool } from "@/lib/cad/forensic-actions";

export function ForensicPanel({ part = "all" }: { part?: "topo" | "measure" | "all" }) {
  const overlays = useCad((s) => s.overlays);
  const project = useCad((s) => s.project);
  const selection = useCad((s) => s.selection);
  const units = useCad((s) => s.units);
  const measureTrace = useCad((s) => s.measureTrace);
  const [tolM, setTolM] = useState(0.2);
  const [tolDeg, setTolDeg] = useState(0.5);

  const selected = useMemo(
    () => project.entities.filter((e) => selection.includes(e.id)),
    [project.entities, selection],
  );

  const traces = selected.map(entityEnds).filter((x): x is NonNullable<typeof x> => !!x);
  // One selected trace + the last Measure compares live against what was just measured.
  if (traces.length === 1 && measureTrace) traces.push(measureTrace);
  const cmp = traces.length >= 2 ? compareTraces(traces[0]!, traces[1]!, tolM, tolDeg) : null;

  const showTopo = part === "all" || part === "topo";
  const showMeasure = part === "all" || part === "measure";

  return (
    <div className="space-y-4 text-sm">
      {showTopo && (
        <>
          <p className="text-muted">
            ToPo keeps every year of ground under the sheet. Drag the bar above the work area — 2014 through this year — the way a historical globe does. Fade each scan and rotate it in degrees. A disagreement is evidence to review, not a verdict that someone cheated the land.
          </p>
          <div className="space-y-2">
            <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">Layered sheets</div>
            {overlays.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted">No sheets yet. Import a scanned topo (JPG, PNG, TIFF, WebP); each sheet gets its own transparency and angle here. The year bar swaps the live ground underneath.</p>
                <label className="flex h-9 cursor-pointer items-center justify-center rounded-sm bg-elevated text-xs hover:text-fg">
                  Import a sheet
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.tif,.tiff,.webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = [...(e.target.files ?? [])];
                      e.target.value = "";
                      if (!files.length) return;
                      void useCad.getState().importOverlayFiles(files).then(() => toast.success("Sheet on the plan"));
                    }}
                  />
                </label>
              </div>
            )}
            {overlays.map((s) => (
              <div key={s.id} className="rounded-sm bg-elevated/70 p-2">
                <div className="text-xs font-medium">{s.name}</div>
                <label className="mt-1 block text-[10px] text-subtle">
                  Transparency {Math.round(s.opacity * 100)}%
                  <input type="range" min={0.08} max={1} step={0.02} value={s.opacity} onChange={(e) => useCad.getState().patchOverlay(s.id, { opacity: Number(e.target.value) })} className="w-full" />
                </label>
                <label className="mt-1 flex items-center justify-between text-[10px] text-subtle">
                  Sheet angle °
                  <input type="number" step={0.1} value={s.rotationDeg} onChange={(e) => useCad.getState().patchOverlay(s.id, { rotationDeg: Number(e.target.value) })} className="h-7 w-24 rounded-sm bg-bg px-2 font-mono text-xs" />
                </label>
              </div>
            ))}
          </div>
        </>
      )}
      {showMeasure && (
        <>
      <div className="flex flex-wrap gap-1.5">
        <Ghost onClick={() => startForensicTool("length")}>Length</Ghost>
        <Ghost onClick={() => startForensicTool("angle")}>Angle</Ghost>
        <Ghost onClick={() => startForensicTool("curve")}>Curve</Ghost>
        <Ghost onClick={blinkSheets}>Blink</Ghost>
      </div>
      <div className="space-y-1">
        <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">Readings</div>
        {measureTrace && (() => {
          const m = lengthOf(measureTrace[0], measureTrace[1]);
          return (
            <div className="font-mono text-[11px] text-fg">
              measure · chord {formatMm(m.chordMm, units)} · bearing {m.bearingDeg.toFixed(3)}° ({m.bearingDms})
            </div>
          );
        })()}
        {selected.length === 0 && !measureTrace && <p className="text-xs text-muted">Select a line, wall or polyline (Shift adds a second trace), or use Length, Angle or Curve.</p>}
        {selected.map((e) => {
          const ends = entityEnds(e);
          if (!ends) return null;
          const len = lengthOf(ends[0], ends[1]);
          const poly = e.kind === "polyline" ? polylineLength(e.points) : null;
          return (
            <div key={e.id} className="font-mono text-[11px] text-fg">
              {e.kind} · chord {formatMm(len.chordMm, units)} · bearing {len.bearingDeg.toFixed(3)}° ({len.bearingDms})
              {poly != null ? ` · chain ${formatMm(poly, units)}` : ""}
            </div>
          );
        })}
        {traces.length >= 1 && selected[0]?.kind === "polyline" && selected[0].points.length >= 3 && (
          <CurveNote pts={selected[0].points} units={units} />
        )}
      </div>
      <div className="space-y-1">
        <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">Disagreement</div>
        <div className="flex gap-2">
          <label className="text-[10px] text-subtle">tol m<input type="number" step={0.05} value={tolM} onChange={(e) => setTolM(Number(e.target.value))} className="ml-1 h-7 w-16 rounded-sm bg-elevated px-1 font-mono text-xs" /></label>
          <label className="text-[10px] text-subtle">tol °<input type="number" step={0.1} value={tolDeg} onChange={(e) => setTolDeg(Number(e.target.value))} className="ml-1 h-7 w-16 rounded-sm bg-elevated px-1 font-mono text-xs" /></label>
        </div>
        {cmp ? (
          <div className="rounded-sm bg-elevated p-2 text-xs">
            <div className="font-medium">{cmp.flag}</div>
            <div className="font-mono text-[11px]">
              Δ length {cmp.lengthDeltaM.toFixed(3)} m · Δ bearing {cmp.angleDeltaDeg.toFixed(3)}°
            </div>
            <p className="mt-1 text-muted">{cmp.note}</p>
          </div>
        ) : (
          <p className="text-xs text-muted">Select two traces (Shift-click), or one trace plus a Length measure, to compare length and bearing.</p>
        )}
        <button type="button" className="text-[11px] text-muted hover:text-fg" onClick={() => toast.message(cmp ? cmp.flag : "Select two traces first")}>
          Copy flag to status
        </button>
      </div>
        </>
      )}
    </div>
  );
}

function CurveNote({ pts, units }: { pts: { x: number; y: number }[]; units: "mm" | "cm" | "m" | "ft" }) {
  const a = pts[0]!;
  const b = pts[Math.floor(pts.length / 2)]!;
  const c = pts[pts.length - 1]!;
  const arc = arcThrough(a, b, c);
  const ang = angleAt(a, b, c);
  return (
    <div className="font-mono text-[11px] text-fg">
      curve · arc {arc.arcMm != null ? formatMm(arc.arcMm, units) : "—"} · chord {formatMm(arc.chordMm, units)} · angle at mid {ang.degrees.toFixed(3)}° ({ang.dms})
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
