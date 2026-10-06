import { worldToScreen, type Cam, type Palette } from "./draw2d";
import { auditRing, ringOf, shiftsAgainst } from "./sheet-audit";
import { useCad } from "./store";
import type { Pt } from "./types";

export function paintSheetAudit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  pal: Palette,
) {
  const st = useCad.getState();
  const rings = st.project.entities
    .map((e) => ({ e, pts: ringOf(e) }))
    .filter((x): x is { e: (typeof st.project.entities)[number]; pts: Pt[] } => !!x.pts);
  if (!rings.length) return;

  const vault = rings[0]!.pts;
  const suspect = rings[1]?.pts;
  const bad = suspect ? new Set(shiftsAgainst(vault, suspect).map((s) => s.i)) : new Set<number>();

  rings.forEach((ring, ri) => {
    const audit = auditRing(ring.pts);
    audit.edges.forEach((edge) => {
      const shift = ri === 1 && bad.has(edge.i);
      const a = worldToScreen(edge.a, cam, w, h);
      const b = worldToScreen(edge.b, cam, w, h);
      if (shift) {
        ctx.strokeStyle = "#e07a5f";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const label = shift
        ? `${edge.metres.toFixed(2)} m  ${edge.angleDeg.toFixed(2)}°  SHIFT`
        : `${edge.metres.toFixed(2)} m  ${edge.angleDeg.toFixed(2)}°`;
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(12,13,14,0.82)";
      ctx.fillRect(mx - tw / 2 - 3, my - 14, tw + 6, 14);
      ctx.fillStyle = shift ? "#e07a5f" : pal.fg;
      ctx.fillText(label, mx - tw / 2, my - 3);
    });
  });
}
