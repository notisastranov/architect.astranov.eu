import { drawOverlays } from "@/lib/cad/draw-overlay";
import type { Palette } from "@/lib/cad/draw2d";
import type { Cam } from "@/lib/cad/draw2d";
import type { Pt } from "@/lib/cad/types";
import { useCad } from "@/lib/cad/store";
import { hitOverlay, planToImg } from "@/lib/gis/overlay";

export function paintOverlays(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  pal: Palette,
) {
  const st = useCad.getState();
  drawOverlays(ctx, w, h, st.overlays, cam, pal, st.activeOverlayId);
}

export function handleOverlayClick(world: Pt): boolean {
  const st = useCad.getState();
  if (st.overlayMode === "gcp-img") {
    const hit = hitOverlay(st.overlays, world);
    if (!hit) {
      st.setStatus("Click a point on the old scan.");
      return true;
    }
    const img = planToImg(hit, world);
    st.setActiveOverlay(hit.id);
    st.setPendingGcp({ imgX: img.x, imgY: img.y });
    st.setOverlayMode("gcp-map");
    return true;
  }
  if (st.overlayMode === "gcp-map") {
    st.finishGcp(world, st.view === "globe" ? { lon: st.globe.lon, lat: st.globe.lat } : undefined);
    return true;
  }
  return false;
}
