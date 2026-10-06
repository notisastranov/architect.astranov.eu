import type { GlobeProvider } from "./layers";

/** One Esri Wayback release per calendar year. Tile ids are the public World Imagery archive. */
export const WAYBACK_YEARS: { year: number; date: string; release: string }[] = [
  { year: 2014, date: "2014-12-30", release: "5844" },
  { year: 2015, date: "2015-12-16", release: "28163" },
  { year: 2016, date: "2016-12-20", release: "18966" },
  { year: 2017, date: "2017-11-16", release: "25521" },
  { year: 2018, date: "2018-12-14", release: "23448" },
  { year: 2019, date: "2019-12-12", release: "4756" },
  { year: 2020, date: "2020-12-16", release: "29260" },
  { year: 2021, date: "2021-12-21", release: "26120" },
  { year: 2022, date: "2022-12-14", release: "45134" },
  { year: 2023, date: "2023-12-07", release: "56102" },
  { year: 2024, date: "2024-12-12", release: "16453" },
  { year: 2025, date: "2025-12-18", release: "13192" },
  { year: 2026, date: "2026-08-05", release: "26334" },
];

export function waybackProvider(release: string): GlobeProvider {
  const hit = WAYBACK_YEARS.find((y) => y.release === release);
  return {
    id: `wb:${release}`,
    name: hit ? `${hit.year} imagery` : `Imagery ${release}`,
    kind: "xyz",
    url: `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`,
    yFirst: true,
    maxZ: 17,
    attribution: hit ? `Esri Wayback ${hit.date}` : "Esri Wayback",
  };
}
