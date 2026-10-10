import { useMemo, useState } from "react";
import { polygonArea } from "@/lib/cad/geometry";
import { cornerAngles, lengthOf } from "@/lib/cad/forensic";
import { useCad } from "@/lib/cad/store";
import type { Pt } from "@/lib/cad/types";
import { WAYBACK_YEARS } from "@/lib/gis/wayback";

const LAT = 36.38752;
const LON = 28.2225;

function signed(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function tile(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

function distToSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function LandSurvey() {
  const entities = useCad((s) => s.project.entities);
  const ring = useMemo(() => {
    const hit = entities.find((e) => e.kind === "polyline" && (e.id === "km257" || e.name === "Κ.Μ. 257"));
    return hit && hit.kind === "polyline" ? hit.points : [];
  }, [entities]);
  const [picks, setPicks] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);

  const survey = useMemo(() => {
    if (ring.length < 3) return null;
    const ccw = signed(ring) > 0;
    const sides = ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const len = lengthOf(a, b);
      return { i, a, b, m: len.chordMm / 1000, bearing: len.bearingDeg };
    });
    const corners = ring.map((v, i) => {
      const prev = ring[(i - 1 + ring.length) % ring.length]!;
      const next = ring[(i + 1) % ring.length]!;
      return { i, v, ...cornerAngles(prev, v, next, ccw) };
    });
    const area = polygonArea(ring) / 1_000_000;
    const angleSum = corners.reduce((s, c) => s + c.interiorDeg, 0);
    const expect = (ring.length - 2) * 180;
    return { sides, corners, area, angleSum, expect };
  }, [ring]);

  const box = useMemo(() => {
    if (!ring.length) return null;
    const xs = ring.map((p) => p.x);
    const ys = ring.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = Math.max(maxX - minX, maxY - minY) * 0.12;
    return { minX: minX - pad, minY: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [ring]);

  const years = WAYBACK_YEARS.filter((y) => [2014, 2018, 2022, 2024, 2026].includes(y.year));
  const t = tile(LAT, LON, 17);

  const toWorld = (svg: SVGSVGElement, clientX: number, clientY: number): Pt | null => {
    if (!box) return null;
    const r = svg.getBoundingClientRect();
    const x = box.minX + ((clientX - r.left) / r.width) * box.w;
    const svgY = -(box.minY + box.h) + ((clientY - r.top) / r.height) * box.h;
    const y = -svgY;
    let p: Pt = { x, y };
    let best = 1e18;
    for (const v of ring) {
      const d = Math.hypot(v.x - x, v.y - y);
      if (d < best) {
        best = d;
        p = v;
      }
    }
    if (best < box.w * 0.03) return p;
    return { x, y };
  };

  const live = hover && picks.length ? lengthOf(picks[picks.length - 1]!, hover).chordMm / 1000 : null;
  const pickedLen = picks.length >= 2 ? lengthOf(picks[0]!, picks[1]!).chordMm / 1000 : null;
  const pickedAng = picks.length >= 3 ? cornerAngles(picks[0]!, picks[1]!, picks[2]!, true).interiorDeg : null;

  return (
    <div className="mt-4">
      <p className="font-mono text-[10px] tracking-[0.18em] text-subtle">ΠΑΛΙΕΣ ΕΙΚΟΝΕΣ ΤΗΣ ΓΗΣ</p>
      <div className="mt-2 flex gap-2 overflow-x-auto">
        {years.map((y) => (
          <button
            key={y.year}
            type="button"
            onClick={() => useCad.getState().setGlobe({ layer: `wb:${y.release}`, flyNonce: useCad.getState().globe.flyNonce + 1 })}
            className="shrink-0 text-left"
          >
            <img
              src={`https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${y.release}/17/${t.y}/${t.x}`}
              alt={`${y.year}`}
              className="h-24 w-24 rounded-sm bg-elevated object-cover"
            />
            <span className="mt-1 block text-xs text-muted">{y.year}</span>
          </button>
        ))}
      </div>
      {survey && box && (
        <>
          <p className="mt-4 text-sm text-muted">
            Πολύγωνο Κ.Μ. 257. Εμβαδόν {survey.area.toFixed(2)} τ.μ. Το διάγραμμα γράφει 3.910 και οι κορυφές κλείνουν 3.836,23. Άθροισμα εσωτερικών γωνιών {survey.angleSum.toFixed(2)}° έναντι {(survey.expect).toFixed(0)}°.
          </p>
          <svg
            viewBox={`${box.minX} ${-(box.minY + box.h)} ${box.w} ${box.h}`}
            className="mt-3 h-[52dvh] w-full rounded-sm border border-border bg-[#f4f1ea]"
            onMouseMove={(e) => {
              const p = toWorld(e.currentTarget, e.clientX, e.clientY);
              if (p) setHover(p);
            }}
            onClick={(e) => {
              const p = toWorld(e.currentTarget, e.clientX, e.clientY);
              if (!p || !box) return;
              let edge = -1;
              let best = box.w * 0.02;
              survey.sides.forEach((s, i) => {
                const d = distToSeg(p, s.a, s.b);
                if (d < best) {
                  best = d;
                  edge = i;
                }
              });
              if (edge >= 0 && picks.length === 0) {
                const s = survey.sides[edge]!;
                setPicks([s.a, s.b]);
                return;
              }
              setPicks((cur) => (cur.length >= 3 ? [p] : [...cur, p]));
            }}
          >
            <polygon points={ring.map((p) => `${p.x},${-p.y}`).join(" ")} fill="rgba(90,110,70,0.18)" stroke="#1c1c1c" strokeWidth={box.w * 0.004} />
            {survey.sides.map((s) => (
              <text key={`s${s.i}`} x={(s.a.x + s.b.x) / 2} y={-((s.a.y + s.b.y) / 2)} fontSize={box.w * 0.028} fill="#1c1c1c">
                {s.m.toFixed(2)} m
              </text>
            ))}
            {survey.corners.map((c) => (
              <text key={`c${c.i}`} x={c.v.x} y={-c.v.y} fontSize={box.w * 0.022} fill="#6b3a2a">
                {c.interiorDeg.toFixed(1)}°
              </text>
            ))}
            {picks.map((p, i) => (
              <circle key={i} cx={p.x} cy={-p.y} r={box.w * 0.008} fill="#9a3412" />
            ))}
            {picks.length >= 2 && <line x1={picks[0]!.x} y1={-picks[0]!.y} x2={picks[1]!.x} y2={-picks[1]!.y} stroke="#9a3412" strokeWidth={box.w * 0.003} />}
            {picks.length >= 3 && <line x1={picks[1]!.x} y1={-picks[1]!.y} x2={picks[2]!.x} y2={-picks[2]!.y} stroke="#9a3412" strokeWidth={box.w * 0.003} />}
          </svg>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span>{live != null ? `Ποντίκι ${live.toFixed(2)} m` : "Πάτα πλευρά ή δύο σημεία."}</span>
            {pickedLen != null && <span>Τμήμα {pickedLen.toFixed(2)} m</span>}
            {pickedAng != null && <span>Γωνία {pickedAng.toFixed(2)}°</span>}
            <button type="button" onClick={() => setPicks([])} className="h-8 rounded-sm bg-elevated px-2 text-xs">Καθαρισμός</button>
          </div>
          <div className="mt-3 max-h-48 overflow-auto text-xs">
            {survey.sides.map((s) => (
              <div key={s.i} className="flex justify-between gap-3 border-b border-border py-1 font-mono">
                <span>Πλευρά {s.i + 1}</span>
                <span>{s.m.toFixed(3)} m</span>
                <span>{s.bearing.toFixed(2)}°</span>
                <span>κορυφή {s.i + 1}: {survey.corners[s.i]!.interiorDeg.toFixed(2)}°</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
