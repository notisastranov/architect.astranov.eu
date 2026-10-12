import { useState } from "react";

const KM257: [number, number][] = [
  [878582.094, 4034923.1835],
  [878606.7434, 4034944.1116],
  [878611.9091, 4034945.4404],
  [878636.2793, 4034951.7095],
  [878652.3956, 4034952.8398],
  [878665.8823, 4034952.6443],
  [878677.3027, 4034954.0361],
  [878680.5841, 4034958.1868],
  [878682.3561, 4034960.4282],
  [878688.5368, 4034955.8265],
  [878702.4408, 4034924.1279],
  [878685.457, 4034912.8012],
  [878677.848, 4034907.7268],
  [878667.744, 4034890.8835],
  [878664.8556, 4034916.5792],
  [878609.4942, 4034920.6492],
  [878583.6738, 4034905.5739],
  [878583.665, 4034910.4803],
  [878580.5405, 4034916.0173],
];

const KM256A: [number, number][] = [
  [878573.23, 4034919.35],
  [878576.25, 4034945.14],
  [878582.67, 4034991.84],
  [878596.27, 4034988.39],
  [878611.31, 4034982.78],
  [878616.06, 4034978.39],
  [878612.18, 4034945.51],
  [878606.74, 4034944.11],
  [878582.09, 4034923.18],
];

const SERVITUDE: [number, number][] = [
  [878612.68, 4034949.77],
  [878635.6355, 4034955.6747],
  [878652.285, 4034956.842],
  [878665.6681, 4034956.6475],
  [878675.1856, 4034957.8075],
  [878678.3087, 4034961.7583],
  [878680.58, 4034958.19],
  [878677.3, 4034954.04],
  [878665.88, 4034952.64],
  [878652.4, 4034952.84],
  [878636.28, 4034951.71],
  [878612.18, 4034945.51],
];

const SHEETS = [
  { id: "m257", name: "257, ιταλικό", src: "/marmarades/merides/merida-257-1923.jpg" },
  { id: "m256", name: "256, ιταλικό 1923", src: "/marmarades/merides/merida-256-1923.jpg" },
  { id: "m250", name: "250, ιταλικό 1923", src: "/marmarades/merides/merida-250-1923.jpg" },
  { id: "m257a", name: "257Α, 1980", src: "/marmarades/merides/merida-257A-1980.jpg" },
  { id: "m257b", name: "257Β, 2008", src: "/marmarades/merides/merida-257B-2008.jpg" },
  { id: "t257", name: "257, 10.04.2024", src: "/marmarades/merides/topo-257-2024.jpg" },
  { id: "t256", name: "256 και 256Α, 06.05.2025", src: "/marmarades/merides/topo-256-2025.jpg" },
];

function ring(pts: [number, number][], ox: number, oy: number, k: number) {
  return (
    pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${((x - ox) * k).toFixed(1)} ${((oy - y) * k).toFixed(1)}`)
      .join(" ") + " Z"
  );
}

export function Merides() {
  const [on, setOn] = useState<Record<string, boolean>>({ t256: true, m257: true });
  const [fade, setFade] = useState(0.55);
  const ox = 878560;
  const oy = 4035005;
  const k = 1.35;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted">
        Διασταύρωση μερίδων. Μαρμαράδες, Κοσκινού, Καλλιθέα. Οι κορυφές του 257 και του 256Α στο ίδιο μέτρο.
        Η λωρίδα των 4 μ. είναι μέσα στο 256, ως δουλεία, και στο ίδιο φύλλο γράφεται δημοτική οδός.
      </p>
      <div className="overflow-hidden rounded-sm border border-border bg-elevated">
        <svg viewBox="0 0 280 200" className="h-72 w-full" role="img" aria-label="Κάτοψη 257, 256Α και δουλείας">
          <path d={ring(KM256A, ox, oy, k)} fill="rgba(224,177,90,0.4)" stroke="#e0b15a" strokeWidth="1.2" />
          <path d={ring(KM257, ox, oy, k)} fill="rgba(243,238,228,0.08)" stroke="#f3eee4" strokeWidth="1.2" />
          <path d={ring(SERVITUDE, ox, oy, k)} fill="rgba(197,106,82,0.8)" stroke="#c56a52" strokeWidth="1" />
          <text x="12" y="22" fill="#e0b15a" fontSize="7">256Α 1.930,74 από κορυφές · τίτλος 2.002</text>
          <text x="12" y="188" fill="#f3eee4" fontSize="7">257 3.836,23 από κορυφές · τίτλος 3.910</text>
          <text x="148" y="78" fill="#c56a52" fontSize="7">δουλεία 279,44 τ.μ.</text>
        </svg>
      </div>
      <ul className="space-y-1 text-xs text-muted">
        <li>Κοινή πλευρά: οι κορυφές συμπίπτουν. Δεν υπάρχει απαλλοτρίωση σε κανένα φύλλο.</li>
        <li>2024, Σαββάκης: «πρόσωπο σε μη χαρακτηρισμένη οδό». Διαφορά τίτλου και κορυφών 73,77 τ.μ.</li>
        <li>2025, Σακελλαρίδης: δουλεία 4,00 μ. υπέρ του 256Α, μέσα στο 256. Κτίρια 2/Π πάνω σε 2.002 τ.μ. τίτλου.</li>
        <li>1923 μονοπάτι. 1980 λεπτή λωρίδα 257Α. 27.11.2008 διάταξη για το περίγραμμα του 257Β. Αριθμοί αίτησης 15176/08 και 15178/08.</li>
      </ul>
      <div className="flex flex-wrap gap-1.5">
        {SHEETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setOn((v) => ({ ...v, [s.id]: !v[s.id] }))}
            className={`h-9 rounded-sm px-2 text-xs ${on[s.id] ? "bg-primary text-primary-fg" : "bg-elevated text-muted"}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <label className="block text-[10px] text-subtle">
        Διαφάνεια κολάζ {Math.round(fade * 100)}%
        <input type="range" min={0.2} max={1} step={0.05} value={fade} onChange={(e) => setFade(Number(e.target.value))} className="w-full" />
      </label>
      <div className="relative min-h-48 overflow-hidden rounded-sm border border-border bg-bg">
        {SHEETS.filter((s) => on[s.id]).map((s, i) => (
          <img
            key={s.id}
            src={s.src}
            alt={s.name}
            className="w-full object-contain"
            style={{ opacity: i === 0 ? 1 : fade }}
          />
        ))}
      </div>
    </div>
  );
}
