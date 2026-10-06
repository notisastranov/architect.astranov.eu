import { geodesic, parcelArea } from "@/lib/cad/survey-math";
import { usePins } from "@/lib/gis/pins";
import { useCad } from "@/lib/cad/store";

export function SurveyMathPanel() {
  const pins = usePins((s) => s.pins);
  const add = usePins((s) => s.add);
  const clear = usePins((s) => s.clear);
  const globe = useCad((s) => s.globe);
  const area = parcelArea(pins);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Pins are WGS84 coordinates. Length is Vincenty on the ellipsoid. Area is the shoelace of the local tangent plane. Every step is shown.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="rounded-sm px-2 py-1.5 text-[11px] text-muted ring-1 ring-border hover:text-fg" onClick={() => add(globe.lat, globe.lon)}>
          Pin look-at
        </button>
        <button type="button" className="rounded-sm px-2 py-1.5 text-[11px] text-muted ring-1 ring-border hover:text-fg" onClick={() => clear()}>
          Clear pins
        </button>
      </div>
      <ul className="space-y-1 font-mono text-[11px]">
        {pins.map((p) => (
          <li key={p.id}>
            {p.label} {p.lat.toFixed(6)}° {p.lon.toFixed(6)}°
          </li>
        ))}
      </ul>
      {pins.length >= 2 &&
        pins.slice(0, -1).map((p, i) => {
          const seg = geodesic(p, pins[i + 1]!);
          return (
            <div key={p.id} className="rounded-sm bg-elevated/70 p-2">
              <div className="text-xs font-medium">
                {p.label}→{pins[i + 1]!.label} · {seg.metres.toFixed(3)} m · {seg.bearingDeg.toFixed(4)}°
              </div>
              {seg.steps.map((s) => (
                <div key={s.name} className="mt-1 font-mono text-[10px] text-subtle">
                  {s.name}: {s.formula} = {s.value}
                </div>
              ))}
            </div>
          );
        })}
      {pins.length >= 3 && (
        <div className="rounded-sm bg-elevated/70 p-2">
          <div className="text-xs font-medium">
            Parcel {area.m2.toFixed(2)} m² · {area.hectares.toFixed(4)} ha
          </div>
          {area.steps.map((s) => (
            <div key={s.name} className="mt-1 font-mono text-[10px] text-subtle">
              {s.name}: {s.formula} = {s.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
