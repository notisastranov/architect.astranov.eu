import type { OverlaySheet } from "@/lib/gis/overlay";
import { overlayImage, rememberOverlayImage, sheetCornersPlan } from "@/lib/gis/overlay";
import type { Palette } from "./draw2d";
import { worldToScreen, type Cam } from "./draw2d";
import { useCad } from "./store";

export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sheets: OverlaySheet[] | undefined,
  cam: Cam,
  pal: Palette,
  activeId: string | null,
) {
  if (!sheets?.length) return;
  for (const sheet of sheets) {
    if (!sheet.visible) continue;
    const img = overlayImage(sheet.id) ?? rememberOverlayImage(sheet.id, sheet.src);
    if (!img.naturalWidth) continue;
    const [nw, ne, se, sw] = sheetCornersPlan(sheet);
    if (!nw || !ne || !se || !sw) continue;
    const a = worldToScreen(nw, cam, w, h);
    const b = worldToScreen(ne, cam, w, h);
    const d = worldToScreen(sw, cam, w, h);
    ctx.save();
    ctx.globalAlpha = sheet.opacity;
    ctx.setTransform((b.x - a.x) / sheet.width, (b.y - a.y) / sheet.width, (d.x - a.x) / sheet.height, (d.y - a.y) / sheet.height, a.x, a.y);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = sheet.id === activeId ? pal.select : pal.axis;
    ctx.lineWidth = sheet.id === activeId ? 1.6 : 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(worldToScreen(se, cam, w, h).x, worldToScreen(se, cam, w, h).y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

/** Called from drawScene without changing its signature. */
export function paintOverlaysFromStore(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, pal: Palette) {
  const st = useCad.getState();
  drawOverlays(ctx, w, h, st.overlays, cam, pal, st.activeOverlayId);
}
