import { drawScene, fitCam, readPalette } from "./draw2d";
import { projectExtents } from "./geometry";
import type { CadState } from "./store";
import type { Project } from "./types";

/** Plan as a 3508×2480 PNG (A4 landscape at 300 dpi), framed to the model, drawn by the same renderer as the screen. */
export async function exportPng(project: Project, units: CadState["units"]) {
  const W = 3508;
  const H = 2480;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const box = projectExtents(project);
  if (!box) throw new Error("Nothing to export — the model is empty");
  // Draw at half size and scale ×2 so text and line weights read at print size.
  const w = W / 2;
  const h = H / 2;
  ctx.scale(2, 2);
  const cam = fitCam(box, w, h);
  drawScene(
    ctx,
    w,
    h,
    { project, cam, selection: [], draft: null, snapHit: null, hover: null, ortho: false, units, tool: "select" },
    readPalette(document.documentElement),
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
