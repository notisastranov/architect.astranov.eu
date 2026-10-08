import { auditRing, ringOf, shiftsAgainst, viewScale } from "@/lib/cad/sheet-audit";
import { useCad } from "@/lib/cad/store";

export function VaultAudit() {
  const project = useCad((s) => s.project);
  const cam = useCad((s) => s.cam);
  const overlays = useCad((s) => s.overlays);
  const rings = project.entities.map((e) => ({ e, pts: ringOf(e) })).filter((x) => x.pts);
  const vault = rings[0];
  const suspect = rings[1];
  const scale = viewScale(cam.zoom);
  const vaultAudit = vault?.pts ? auditRing(vault.pts) : null;
  const suspectAudit = suspect?.pts ? auditRing(suspect.pts) : null;
  const shifts = vault?.pts && suspect?.pts ? shiftsAgainst(vault.pts, suspect.pts) : [];

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Trace the Italian vault parcel, then the new topo, as closed polylines. Metres and degrees come from the ground, so 1:{scale} and 1:50 show the same numbers. A red edge is where the new sheet no longer matches the vault.
      </p>
      <div className="font-mono text-[11px] text-subtle">View scale 1:{scale} · {overlays.length} sheets · readings do not follow the zoom</div>
      <button
        type="button"
        className="rounded-sm px-2 py-1.5 text-[11px] text-muted ring-1 ring-border hover:text-fg"
        onClick={() => {
          useCad.getState().setView("plan");
          useCad.getState().setTool("polyline");
          useCad.getState().setStatus("Trace the Rodi vault boundary. Enter to close. Then trace the new sheet.");
        }}
      >
        Trace vault
      </button>
      {vaultAudit && (
        <RingList title={suspect ? "Italian vault (first ring)" : "Vault ring"} edges={vaultAudit.edges} area={vaultAudit.areaM2} />
      )}
      {suspectAudit && <RingList title="New topo (second ring)" edges={suspectAudit.edges} area={suspectAudit.areaM2} />}
      {shifts.length > 0 && (
        <div className="rounded-sm bg-elevated p-2 text-xs">
          <div className="font-medium">Boundary no longer matches the vault</div>
          <ul className="mt-1 space-y-1 font-mono text-[11px]">
            {shifts.map((s) => (
              <li key={s.i}>
                edge {s.i + 1}: vault {s.vaultM.toFixed(2)} m → new {s.suspectM.toFixed(2)} m · Δ {s.deltaM.toFixed(2)} m · {s.deltaDeg.toFixed(2)}°
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted">Marked on the plan. This is a shift against the older sheet, for a surveyor or a court — not a finding that names a thief.</p>
        </div>
      )}
    </div>
  );
}

function RingList({ title, edges, area }: { title: string; edges: { i: number; metres: number; angleDeg: number; exteriorDeg?: number; bearingDeg: number }[]; area: number }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest text-subtle uppercase">{title} · {area.toFixed(2)} m²</div>
      <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
        {edges.map((e) => (
          <li key={e.i}>
            L{e.i + 1} {e.metres.toFixed(2)} m · in {e.angleDeg.toFixed(2)}° · out {(e.exteriorDeg ?? 360 - e.angleDeg).toFixed(2)}°
          </li>
        ))}
      </ul>
    </div>
  );
}
