import { useCad } from "@/lib/cad/store";
import { formatMmNum } from "@/lib/cad/units";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const hover = useCad((s) => s.hover);
  const snapHit = useCad((s) => s.snapHit);
  const units = useCad((s) => s.units);
  const ortho = useCad((s) => s.ortho);
  const snap = useCad((s) => s.snap);
  const setOrtho = useCad((s) => s.setOrtho);
  const setSnap = useCad((s) => s.setSnap);
  const setUnits = useCad((s) => s.setUnits);
  const cam = useCad((s) => s.cam);
  const project = useCad((s) => s.project);

  const x = hover ? formatMmNum(hover.x, units) : "—";
  const y = hover ? formatMmNum(hover.y, units) : "—";
  const scale = cam.zoom > 0 ? Math.round(96 / 25.4 / cam.zoom) : 0;

  return (
    <div className="flex h-[var(--height-status)] min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-bg px-2 font-mono text-[10px] text-muted">
      <span className="tabular shrink-0">
        E {x}
        <span className="text-subtle"> · </span>
        N {y}
        <span className="text-subtle"> {units}</span>
      </span>
      <span className="hidden shrink-0 text-subtle sm:inline">{snapHit ? snapHit.type.toUpperCase() : "FREE"}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Toggle on={ortho} onClick={() => setOrtho(!ortho)} label="ORTHO" />
        <Toggle on={snap.grid} onClick={() => setSnap({ grid: !snap.grid })} label="GRID" />
        <Toggle on={snap.end} onClick={() => setSnap({ end: !snap.end })} label="END" />
        <Toggle on={snap.mid} onClick={() => setSnap({ mid: !snap.mid })} label="MID" />
        <select
          value={units}
          onChange={(e) => setUnits(e.target.value as typeof units)}
          className="h-5 rounded-xs bg-transparent text-[10px] text-muted outline-none"
          aria-label="Units"
        >
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="m">m</option>
          <option value="ft">ft</option>
        </select>
        <span className="hidden tabular text-subtle md:inline">1:{scale || "—"}</span>
        <span className="hidden tabular text-subtle lg:inline">{project.entities.length} ent</span>
      </span>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
  className,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-xs px-1.5 py-0.5 tracking-wider", on ? "text-primary" : "text-subtle", className)}
    >
      {label}
    </button>
  );
}
