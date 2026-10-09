import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCad } from "@/lib/cad/store";
import { WAYBACK_YEARS } from "@/lib/gis/wayback";

function applyLayer(id: string, label: string) {
  const globe = useCad.getState().globe;
  useCad.getState().setGlobe({ layer: id, flyNonce: globe.flyNonce + 1 });
  useCad.getState().setStatus(`${label} · historical ground under the sheet`);
}

export function YearTimeline() {
  const layer = useCad((s) => s.globe.layer);
  const sub = useCad((s) => s.forensicSub);
  const setSub = useCad((s) => s.setForensicSub);
  const weight = useCad((s) => s.measureWeight);
  const [playing, setPlaying] = useState(false);
  const yearIndex = WAYBACK_YEARS.findIndex((y) => layer === `wb:${y.release}`);
  const activeYear = yearIndex >= 0 ? WAYBACK_YEARS[yearIndex] : null;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const current = useCad.getState().globe.layer;
      const i = WAYBACK_YEARS.findIndex((y) => current === `wb:${y.release}`);
      const next = WAYBACK_YEARS[i + 1];
      if (!next) {
        setPlaying(false);
        return;
      }
      applyLayer(`wb:${next.release}`, String(next.year));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div className="order-2 shrink-0 border-b border-border bg-surface px-2 py-2 sm:px-3 md:order-1">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-[10px] tracking-[0.16em] text-subtle">FORENSIC</span>
        {(["topo", "vault", "measure"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={cn(
              "shrink-0 rounded-sm px-2 py-1 text-[11px]",
              sub === id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {id === "topo" ? "ToPo" : id === "vault" ? "Vault" : "Measure"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          className="shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide text-muted uppercase hover:bg-elevated hover:text-fg"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          aria-label="Imagery year"
          type="range"
          min={0}
          max={WAYBACK_YEARS.length - 1}
          step={1}
          value={yearIndex < 0 ? WAYBACK_YEARS.length - 1 : yearIndex}
          onChange={(e) => {
            const y = WAYBACK_YEARS[Number(e.target.value)];
            if (!y) return;
            setPlaying(false);
            applyLayer(`wb:${y.release}`, String(y.year));
          }}
          className="h-8 min-w-0 flex-1 accent-[var(--color-primary,currentColor)]"
        />
        <span className="shrink-0 font-mono text-[10px] tracking-wide text-subtle">WT</span>
        <input
          aria-label="Measurement weight"
          type="range"
          min={0.6}
          max={5}
          step={0.1}
          value={weight}
          onChange={(e) => useCad.getState().setMeasureWeight(Number(e.target.value))}
          className="h-8 w-16 shrink-0 accent-[var(--color-primary,currentColor)]"
        />
        <span className="shrink-0 font-mono text-xs tabular-nums text-fg">
          {activeYear ? activeYear.year : layer === "BASEMAP" ? "Ktima" : "Now"}
        </span>
      </div>
      <div className="mt-1 flex gap-1 overflow-x-auto scroll-thin pb-0.5">
        {WAYBACK_YEARS.map((y) => {
          const on = layer === `wb:${y.release}`;
          return (
            <button
              key={y.release}
              type="button"
              title={y.date}
              onClick={() => {
                setPlaying(false);
                applyLayer(`wb:${y.release}`, String(y.year));
              }}
              className={cn(
                "shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] tabular-nums",
                on ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg",
              )}
            >
              {y.year}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            applyLayer("BASEMAP", "Ktimatologio");
          }}
          className={cn(
            "shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide",
            layer === "BASEMAP" ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg",
          )}
        >
          Ktima
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            applyLayer("esri-imagery", "Live imagery");
          }}
          className={cn(
            "shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide",
            layer === "esri-imagery" ? "bg-primary text-primary-fg" : "bg-elevated text-muted hover:text-fg",
          )}
        >
          Now
        </button>
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-subtle">
        {activeYear
          ? `${activeYear.date} · Esri Wayback imagery · drag a year, the ground changes under the drawing`
          : "Live ground · pick a year to step backward"}
      </p>
    </div>
  );
}
