import type { OverlaySheet } from "@/lib/gis/overlay";
import { overlayImage, rememberOverlayImage, sheetCornersPlan } from "@/lib/gis/overlay";
import type { Palette } from "./draw2d";
import { worldToScreen, type Cam } from "./draw2d";

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
    if (!img.naturalWidth) {
      img.onload = () => {
        /* next frame redraws via store subscribe when user moves */
      };
      continue;
    }
    const [nw, ne, se, sw] = sheetCornersPlan(sheet);
    if (!nw || !ne || !se || !sw) continue;
    const a = worldToScreen(nw, cam, w, h);
    const b = worldToScreen(ne, cam, w, h);
    const d = worldToScreen(sw, cam, w, h);
    ctx.save();
    ctx.globalAlpha = sheet.opacity;
    ctx.setTransform(
      (b.x - a.x) / sheet.width,
      (b.y - a.y) / sheet.width,
      (d.x - a.x) / sheet.height,
      (d.y - a.y) / sheet.height,
      a.x,
      a.y,
    );
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = sheet.id === activeId ? pal.select : pal.axis;
    ctx.lineWidth = sheet.id === activeId ? 1.6 : 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(worldToScreen(se, cam, w, h).x, worldToScreen(se, cam, w, h).y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
    const label = worldToScreen({ x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 }, cam, w, h);
    ctx.fillStyle = pal.muted;
    ctx.font = "500 10px 'IBM Plex Mono', monospace";
    ctx.fillText(`${sheet.name}  1:${sheet.printedScale}`, label.x - 40, label.y);
    for (const g of sheet.gcps) {
      const p = worldToScreen(
        {
          x: nw.x + ((ne.x - nw.x) * g.imgX) / sheet.width + ((sw.x - nw.x) * g.imgY) / sheet.height,
          y: nw.y + ((ne.y - nw.y) * g.imgX) / sheet.width + ((sw.y - nw.y) * g.imgY) / sheet.height,
        },
        cam,
        w,
        h,
      );
      ctx.fillStyle = pal.snap;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
