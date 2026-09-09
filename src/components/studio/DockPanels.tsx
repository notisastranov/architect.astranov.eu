import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock, LockOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCad } from "@/lib/cad/store";
import { askDatum } from "@/lib/cad/ask-datum";
import { compactModel, inverse, quantities } from "@/lib/cad/quantities";
import { formatArea, formatMm, formatMmNum } from "@/lib/cad/units";
import { azimuthDeg, dist, formatDms, polygonArea, wallLength } from "@/lib/cad/geometry";
import type { AiOp, Entity, SurveyEnt, UnitSystem } from "@/lib/cad/types";
import { MATERIALS } from "@/lib/cad/types";

export function Properties() {
  const project = useCad((s) => s.project);
  const selection = useCad((s) => s.selection);
  const update = useCad((s) => s.updateEntity);
  const units = useCad((s) => s.units);
  const entity = project.entities.find((e) => e.id === selection[0]);

  if (!entity) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted">No selection. Click geometry in the plan, or describe a change in AI.</p>
        <Meta label="Project" value={project.name} />
        <Meta label="Discipline" value={project.discipline} />
        <Meta label="Entities" value={String(project.entities.length)} />
        <Meta label="Wall default" value={formatMm(project.wallThickness, units)} />
        <Meta label="Storey height" value={formatMm(project.wallHeight, units)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">{entity.kind}</div>
        <div className="text-sm font-medium">{entity.name || entity.id}</div>
      </div>
      <Field label="Name" value={entity.name ?? ""} onChange={(v) => update(entity.id, { name: v } as Partial<Entity>)} />
      <EntityFields e={entity} units={units} onChange={(patch) => update(entity.id, patch)} />
    </div>
  );
}

function EntityFields({
  e,
  units,
  onChange,
}: {
  e: Entity;
  units: UnitSystem;
  onChange: (p: Partial<Entity>) => void;
}) {
  if (e.kind === "wall") {
    return (
      <>
        <Num label="Thickness" mm={e.thickness} units={units} onMm={(v) => onChange({ thickness: v } as Partial<Entity>)} />
        <Num label="Height" mm={e.height} units={units} onMm={(v) => onChange({ height: v } as Partial<Entity>)} />
        <Select label="Material" value={e.material} options={MATERIALS as unknown as string[]} onChange={(v) => onChange({ material: v } as Partial<Entity>)} />
        <Meta label="Length" value={formatMm(wallLength(e), units)} />
        <Meta label="IFC" value={e.ifc} />
      </>
    );
  }
  if (e.kind === "door" || e.kind === "window") {
    return (
      <>
        <Num label="Width" mm={e.width} units={units} onMm={(v) => onChange({ width: v } as Partial<Entity>)} />
        <Num label="Height" mm={e.height} units={units} onMm={(v) => onChange({ height: v } as Partial<Entity>)} />
        <Num label="Offset" mm={e.offset} units={units} onMm={(v) => onChange({ offset: v } as Partial<Entity>)} />
        {e.kind === "window" && <Num label="Sill" mm={e.sill} units={units} onMm={(v) => onChange({ sill: v } as Partial<Entity>)} />}
        <Meta label="Host wall" value={e.wallId} />
      </>
    );
  }
  if (e.kind === "room") {
    return (
      <>
        <Field label="Occupancy" value={e.occupancy} onChange={(v) => onChange({ occupancy: v } as Partial<Entity>)} />
        <Meta label="Area" value={formatArea(polygonArea(e.points), units)} />
      </>
    );
  }
  if (e.kind === "survey") {
    return (
      <>
        <Field label="Code" value={e.code} onChange={(v) => onChange({ code: v, name: v } as Partial<Entity>)} />
        <Num label="Easting" mm={e.e} units={units} onMm={(v) => onChange({ e: v } as Partial<Entity>)} />
        <Num label="Northing" mm={e.n} units={units} onMm={(v) => onChange({ n: v } as Partial<Entity>)} />
        <Num label="Elevation" mm={e.z} units={units} onMm={(v) => onChange({ z: v } as Partial<Entity>)} />
        <Field label="Description" value={e.desc} onChange={(v) => onChange({ desc: v } as Partial<Entity>)} />
      </>
    );
  }
  if (e.kind === "circle") return <Num label="Radius" mm={e.r} units={units} onMm={(v) => onChange({ r: v } as Partial<Entity>)} />;
  if (e.kind === "rect") {
    return (
      <>
        <Meta label="Width" value={formatMm(Math.abs(e.b.x - e.a.x), units)} />
        <Meta label="Depth" value={formatMm(Math.abs(e.b.y - e.a.y), units)} />
        {e.thickness != null && <Num label="Thickness" mm={e.thickness} units={units} onMm={(v) => onChange({ thickness: v } as Partial<Entity>)} />}
      </>
    );
  }
  if (e.kind === "text") return <Field label="Text" value={e.text} onChange={(v) => onChange({ text: v } as Partial<Entity>)} />;
  if (e.kind === "column") {
    return (
      <>
        <Num label="Width" mm={e.width} units={units} onMm={(v) => onChange({ width: v } as Partial<Entity>)} />
        <Num label="Depth" mm={e.depth} units={units} onMm={(v) => onChange({ depth: v } as Partial<Entity>)} />
        <Num label="Height" mm={e.height} units={units} onMm={(v) => onChange({ height: v } as Partial<Entity>)} />
      </>
    );
  }
  if (e.kind === "line" || e.kind === "dim") {
    return (
      <>
        <Meta label="Length" value={formatMm(dist(e.a, e.b), units)} />
        <Meta label="Azimuth" value={formatDms(azimuthDeg(e.a, e.b))} />
      </>
    );
  }
  return <Meta label="Id" value={e.id} />;
}

export function Layers() {
  const project = useCad((s) => s.project);
  const toggle = useCad((s) => s.toggleLayer);
  return (
    <ul className="space-y-1">
      {project.layers.map((l) => (
        <li key={l.id} className="flex items-center gap-2 rounded-sm px-1 py-1.5 hover:bg-elevated/60">
          <span className="size-2 rounded-full" style={{ background: l.color }} />
          <span className="flex-1 text-sm">{l.name}</span>
          <button type="button" onClick={() => toggle(l.id, "visible")} className="text-muted hover:text-fg" aria-label="Visibility">
            {l.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button type="button" onClick={() => toggle(l.id, "locked")} className="text-muted hover:text-fg" aria-label="Lock">
            {l.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Quantities() {
  const project = useCad((s) => s.project);
  const rows = useMemo(() => quantities(project), [project]);
  let last = "";
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const head = r.group !== last;
        last = r.group;
        return (
          <div key={r.id}>
            {head && <div className="mb-1 font-mono text-[10px] tracking-widest text-subtle uppercase">{r.group}</div>}
            <div className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="text-sm text-muted">{r.label}</span>
              <span className="font-mono text-xs tabular text-fg">{r.value}</span>
            </div>
            {r.detail && <div className="text-[11px] text-subtle">{r.detail}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function Survey() {
  const project = useCad((s) => s.project);
  const units = useCad((s) => s.units);
  const points = project.entities.filter((e): e is SurveyEnt => e.kind === "survey");
  const [a, setA] = useState(points[0]?.id ?? "");
  const [b, setB] = useState(points[1]?.id ?? "");
  const pa = points.find((p) => p.id === a);
  const pb = points.find((p) => p.id === b);
  const inv = pa && pb ? inverse(pa, pb) : null;
  if (!points.length) return <p className="text-sm text-muted">No survey stations. Use the Station tool or ask AI to place control.</p>;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="text-subtle">
            <tr>
              <th className="py-1 font-medium">Code</th>
              <th className="py-1 font-medium">E</th>
              <th className="py-1 font-medium">N</th>
              <th className="py-1 font-medium">Z</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-1 text-fg">{p.code}</td>
                <td className="py-1 tabular">{formatMmNum(p.e, units)}</td>
                <td className="py-1 tabular">{formatMmNum(p.n, units)}</td>
                <td className="py-1 tabular">{formatMmNum(p.z, units)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="mb-1 font-mono text-[10px] tracking-widest text-subtle uppercase">Inverse</div>
        <div className="flex gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="flex-1 rounded-sm bg-elevated px-2 py-1.5 text-xs">
            {points.map((p) => (
              <option key={p.id} value={p.id}>{p.code}</option>
            ))}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="flex-1 rounded-sm bg-elevated px-2 py-1.5 text-xs">
            {points.map((p) => (
              <option key={p.id} value={p.id}>{p.code}</option>
            ))}
          </select>
        </div>
        {inv && (
          <div className="mt-2 space-y-1 font-mono text-xs">
            <Meta label="Distance" value={formatMm(inv.d, units)} />
            <Meta label="Azimuth" value={formatDms(inv.az)} />
            <Meta label="dH" value={formatMm(inv.dH, units)} />
          </div>
        )}
      </div>
    </div>
  );
}

const AI_HINTS = [
  "Draw a 10 x 6 m room with 200 mm brick walls and a 900 mm door on the south side",
  "Add aligned dimensions to the exterior walls",
  "Place a survey station at each building corner",
  "Four 8 mm holes, 15 mm in from each plate corner",
];

export function AiPanel() {
  const prompt = useCad((s) => s.prompt);
  const setPrompt = useCad((s) => s.setPrompt);
  const busy = useCad((s) => s.aiBusy);
  const log = useCad((s) => s.aiLog);
  const project = useCad((s) => s.project);

  const send = async (text?: string) => {
    const q = (text ?? prompt).trim();
    if (!q || busy) return;
    const st = useCad.getState();
    st.setPrompt("");
    st.pushAi("user", q);
    st.setAiBusy(true);
    try {
      const res = await askDatum({
        data: { prompt: q, model: compactModel(st.project).slice(0, 11000), discipline: st.project.discipline, units: st.units },
      });
      if (!res.ok) {
        st.pushAi("assistant", res.error);
        toast.error(res.error);
      } else {
        let ops: AiOp[] = [];
        try {
          const parsed = JSON.parse(res.opsText) as unknown;
          if (Array.isArray(parsed)) ops = parsed as AiOp[];
        } catch {
          ops = [];
        }
        if (ops.length) st.applyAi(ops);
        st.pushAi("assistant", res.message);
        toast.success(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      st.pushAi("assistant", msg);
      toast.error(msg);
    } finally {
      useCad.getState().setAiBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-[240px] flex-col gap-3">
      <p className="text-sm text-muted">Describe a room, a plate, a traverse. Coordinates land in millimetres; the model stays parametric.</p>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scroll-thin">
        {log.length === 0 && AI_HINTS.map((h) => (
          <button key={h} type="button" onClick={() => send(h)} className="rounded-sm bg-elevated px-2.5 py-2 text-left text-xs text-muted transition-colors hover:text-fg">{h}</button>
        ))}
        {log.map((m, i) => (
          <div key={i} className={cn("text-xs leading-relaxed", m.role === "user" ? "text-fg" : "text-muted")}>
            <span className="font-mono text-[10px] tracking-widest text-subtle uppercase">{m.role === "user" ? "You" : "Architect"}</span>
            <p className="mt-0.5">{m.text}</p>
          </div>
        ))}
        {busy && <p className="font-mono text-[10px] tracking-widest text-subtle uppercase">Thinking</p>}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Instruct the model…" className="h-10 min-w-0 flex-1 rounded-sm bg-elevated px-2.5 text-sm outline-none placeholder:text-subtle" />
        <button type="submit" disabled={busy || !prompt.trim()} className="inline-flex size-10 items-center justify-center rounded-sm bg-primary text-primary-fg disabled:opacity-40" aria-label="Send">
          <Sparkles className="size-4" strokeWidth={1.6} />
        </button>
      </form>
      <p className="text-[11px] text-subtle">{project.name} · {project.discipline}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xs tabular text-fg">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-subtle uppercase">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-sm bg-elevated px-2 text-sm outline-none" />
    </label>
  );
}

function Num({ label, mm, units, onMm }: { label: string; mm: number; units: UnitSystem; onMm: (v: number) => void }) {
  const shown = formatMmNum(mm, units);
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-subtle uppercase">{label} ({units})</span>
      <input defaultValue={shown} key={`${label}-${shown}`} onBlur={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        const factor = units === "mm" ? 1 : units === "cm" ? 10 : units === "m" ? 1000 : 304.8;
        onMm(n * factor);
      }} className="h-9 w-full rounded-sm bg-elevated px-2 font-mono text-sm tabular outline-none" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-subtle uppercase">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-sm bg-elevated px-2 text-sm outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
