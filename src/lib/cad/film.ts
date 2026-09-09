import { drawScene, fitCam, type Palette } from "./draw2d";
import { projectExtents } from "./geometry";
import { useCad } from "./store";
import { DEFAULT_DECLARATION, DEFAULT_SITE, siteLine } from "./declaration";
import type { WallEnt } from "./types";

const W = 1920;
const H = 1080;
const FPS = 24;
const DURATION = 24;

const PAL: Palette = {
  grid: "#1a1e22",
  gridMajor: "#252b30",
  axis: "#4a5a62",
  geom: "#c5cdc6",
  wall: "#d2dad3",
  fill: "#1b2420",
  room: "#24302a",
  dim: "#9aafa8",
  select: "#f2f4f0",
  snap: "#7ec8c0",
  opening: "#8aa0c0",
  survey: "#c5cdc6",
  paper: "#0c0d0e",
  fg: "#ecece8",
  muted: "#8c9088",
};

export async function runProjectFilm() {
  const st = useCad.getState();
  st.setStatus("Recording film · area map → property → finished work");
  st.setView("globe");
  st.setGlobe({ flyNonce: st.globe.flyNonce + 1, lat: st.globe.lat, lon: st.globe.lon });

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;z-index:80;background:#05070d;display:flex;align-items:center;justify-content:center";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "width:min(100vw,160vh);height:auto;box-shadow:0 30px 80px rgba(0,0,0,.55)";
  wrap.appendChild(canvas);
  const label = document.createElement("div");
  label.style.cssText =
    "position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.16em;color:#8c9088;text-transform:uppercase";
  label.textContent = "Astranov Architect · recording";
  wrap.appendChild(label);
  document.body.appendChild(wrap);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    wrap.remove();
    throw new Error("No canvas");
  }

  const mime = pickMime();
  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "video/webm" }));
  });
  rec.start(200);

  const frames = DURATION * FPS;
  for (let i = 0; i <= frames; i++) {
    const t = i / FPS;
    paintFrame(ctx, t);
    await waitFrame();
  }

  rec.stop();
  const blob = await done;
  wrap.remove();
  const name = `${slug(st.project.name || "astranov")}-site-film.webm`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  useCad.getState().setView("model");
  useCad.getState().setStatus(`Film saved · ${name}`);
}

function pickMime() {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

function waitFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

function paintFrame(ctx: CanvasRenderingContext2D, t: number) {
  const st = useCad.getState();
  const site = st.site ?? DEFAULT_SITE;
  const dec = st.declaration ?? DEFAULT_DECLARATION;
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, W, H);

  if (t < 3.2) {
    titleCard(ctx, t / 3.2, site, dec);
    return;
  }
  if (t < 9) {
    areaMap(ctx, (t - 3.2) / 5.8, site);
    return;
  }
  if (t < 14.5) {
    propertyPlan(ctx, (t - 9) / 5.5);
    return;
  }
  if (t < 19.5) {
    finishedIsometric(ctx, (t - 14.5) / 5);
    return;
  }
  declarationCard(ctx, (t - 19.5) / 4.5, site, dec);
}

function titleCard(
  ctx: CanvasRenderingContext2D,
  k: number,
  site: typeof DEFAULT_SITE,
  dec: typeof DEFAULT_DECLARATION,
) {
  ctx.globalAlpha = Math.min(1, k * 1.6);
  ctx.fillStyle = "#7eb6ff";
  ctx.font = "500 13px 'IBM Plex Mono', monospace";
  ctx.fillText("ASTRANOV ARCHITECT BIMCAD", 120, 160);
  ctx.fillStyle = "#ecece8";
  ctx.font = "500 64px 'IBM Plex Sans', sans-serif";
  ctx.fillText(site.name, 120, 250);
  ctx.fillStyle = "#8c9088";
  ctx.font = "400 22px 'IBM Plex Sans', sans-serif";
  wrapText(ctx, dec.statement, 120, 330, 1680, 34);
  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillText(siteLine(site), 120, 980);
  ctx.globalAlpha = 1;
}

function areaMap(ctx: CanvasRenderingContext2D, k: number, site: typeof DEFAULT_SITE) {
  const zoom = 0.35 + k * 3.4;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  ctx.strokeStyle = "#1e3a28";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#3d6a4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(W * 0.28, H * 0.28, W * 0.44, H * 0.44);
  ctx.fillStyle = "#7eb6ff";
  ctx.beginPath();
  ctx.arc(W * 0.52, H * 0.48, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ecece8";
  ctx.font = "500 28px 'IBM Plex Sans', sans-serif";
  ctx.fillText("Real topographic diagram of the area", 80, 80);
  ctx.fillStyle = "#8c9088";
  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillText(site.cadastre, 80, 112);
  ctx.fillText(`${site.lat.toFixed(5)}° N   ${site.lon.toFixed(5)}° E   ·   focusing the plot`, 80, 1020);
}

function propertyPlan(ctx: CanvasRenderingContext2D, k: number) {
  const st = useCad.getState();
  const box = projectExtents(st.project);
  const cam = box ? fitCam(box, W, H) : { x: 6000, y: 4000, zoom: 0.08 };
  cam.zoom *= 0.72 + k * 0.55;
  drawScene(
    ctx,
    W,
    H,
    {
      project: st.project,
      cam,
      selection: st.selection,
      draft: null,
      snapHit: null,
      hover: null,
      ortho: false,
      units: st.units,
      tool: "select",
    },
    PAL,
  );
  ctx.fillStyle = "rgba(5,7,13,0.35)";
  ctx.fillRect(0, 0, W, 90);
  ctx.fillStyle = "#ecece8";
  ctx.font = "500 24px 'IBM Plex Sans', sans-serif";
  ctx.fillText("Own property  ·  BIM on the registered ground", 80, 58);
}

function finishedIsometric(ctx: CanvasRenderingContext2D, k: number) {
  const st = useCad.getState();
  ctx.fillStyle = "#0c0d0e";
  ctx.fillRect(0, 0, W, H);
  const walls = st.project.entities.filter((e): e is WallEnt => e.kind === "wall");
  const box = projectExtents(st.project);
  const cx = box ? (box.minX + box.maxX) / 2 : 6000;
  const cy = box ? (box.minY + box.maxY) / 2 : 4000;
  const scale = 0.045;
  const lift = 0.55 + k * 0.25;
  ctx.save();
  ctx.translate(W / 2, H * 0.62);
  for (const w of walls) {
    const a = iso(w.a.x - cx, w.a.y - cy, 0, scale);
    const b = iso(w.b.x - cx, w.b.y - cy, 0, scale);
    const ah = iso(w.a.x - cx, w.a.y - cy, w.height * lift, scale);
    const bh = iso(w.b.x - cx, w.b.y - cy, w.height * lift, scale);
    ctx.fillStyle = w.material === "Gypsum" ? "#3a403c" : "#5c5648";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(bh.x, bh.y);
    ctx.lineTo(ah.x, ah.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d2dad3";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#ecece8";
  ctx.font = "500 28px 'IBM Plex Sans', sans-serif";
  ctx.fillText("Finished work  ·  the BIM the owner can still edit", 80, 80);
  ctx.fillStyle = "#8c9088";
  ctx.font = "400 16px 'IBM Plex Mono', monospace";
  ctx.fillText(`${st.project.name}   ·   ${st.project.entities.length} entities   ·   millimetre kernel`, 80, 112);
}

function declarationCard(
  ctx: CanvasRenderingContext2D,
  k: number,
  site: typeof DEFAULT_SITE,
  dec: typeof DEFAULT_DECLARATION,
) {
  ctx.globalAlpha = Math.min(1, 0.2 + k * 1.2);
  ctx.fillStyle = "#7eb6ff";
  ctx.font = "500 13px 'IBM Plex Mono', monospace";
  ctx.fillText(dec.title.toUpperCase(), 120, 160);
  ctx.fillStyle = "#ecece8";
  ctx.font = "500 48px 'IBM Plex Sans', sans-serif";
  ctx.fillText(site.name, 120, 230);
  ctx.fillStyle = "#b8c4bc";
  ctx.font = "400 20px 'IBM Plex Sans', sans-serif";
  ctx.fillText(`Architect  ${dec.author}`, 120, 300);
  ctx.fillText(`Client  ${dec.client}`, 120, 334);
  ctx.fillText(`Program  ${dec.program}`, 120, 368);
  ctx.fillText(site.plot, 120, 402);
  ctx.fillStyle = "#8c9088";
  wrapText(ctx, dec.statement, 120, 470, 1680, 32);
  ctx.font = "400 15px 'IBM Plex Mono', monospace";
  ctx.fillText(siteLine(site), 120, 980);
  ctx.globalAlpha = 1;
}

function iso(x: number, y: number, z: number, s: number) {
  return { x: (x - y) * s * 0.86, y: (x + y) * s * 0.5 - z * s * 0.9 };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "astranov";
}
