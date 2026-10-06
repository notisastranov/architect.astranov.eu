# Astranov Architect Forensic TopoBimCad

Forensic topographic BIMCAD: layered historical and live sheets, adjustable transparency, sheet angle in degrees, and length on lines and curves.

**Domain:** [architect.astranov.eu](https://architect.astranov.eu)  
**Source:** [github.com/notisastranov/architect.astranov.eu](https://github.com/notisastranov/architect.astranov.eu)

Formerly Astranov Architect BIMCAD. The millimetre kernel, globe, Ktimatologio drape and Italian collage remain.

## Forensic use

1. Import the old topo and the live cadastre (`overlay`, Maps).
2. Open the **Forensic** dock. Fade each sheet independently. Set sheet angle in degrees if a scan was placed rotated.
3. Trace the old boundary and today's boundary as lines.
4. Select both. The panel reports chord length, chain length on a polyline, arc length through three points, bearing in decimal degrees and DMS, and the disagreement (Δ length, Δ bearing).

A flag of `review` or `strong disagreement` is geometric evidence for a surveyor or a court. It is not a finding that a particular topographer cheated. Paper stretch, a bad control point, or a wrong printed scale produce the same numbers.

Commands: `forensic`, `angle`, `length`, `blink`, plus `overlay`, `collage`, `georef`.
