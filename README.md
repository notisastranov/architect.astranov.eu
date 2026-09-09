# Astranov Architect BIMCAD

Millimetre-kernel CAD, BIM and survey studio for architects, mechanical engineers and topographers.

**Domain:** [architect.astranov.eu](https://architect.astranov.eu)  
**Source:** [github.com/notisastranov/architect.astranov.eu](https://github.com/notisastranov/architect.astranov.eu)

Plan, split and 3D model views. Walls, doors, windows, slabs, plates, holes, survey traverses. Snap, ortho, command line, quantities, IFC properties, and an AI draughtsman.

A3 product poster: `public/poster.png` / `public/poster.html`.

## Stack

TanStack Start · React 19 · Three.js · Zustand · Vercel (Nitro)

Internal units are millimetres. Display units: mm, cm, m, ft.

## Hosting (architect.astranov.eu)

Zone `astranov.eu` is on Cloudflare. Sister hosts (`www`, `grok`, `frogschool`, `yachts`, …) already sit on Vercel.

1. Import this GitHub repo as a Vercel project (`fra1`, `VITE_AUTH_ENABLED=false`, `XAI_API_KEY` for the draughtsman).
2. Add domain `architect.astranov.eu`.
3. In Cloudflare DNS:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `architect` | `cname.vercel-dns.com` | DNS only (grey) |

Vercel will ask for a `vc-domain-verify=architect.astranov.eu,…` TXT on `_vercel` — same record set as `grok` / `yachts` / `www`.

Until that CNAME exists the hostname does not resolve.

## Environment

Set these on the Vercel project (never commit them):

| Variable | Required | Purpose |
|---|---|---|
| `XAI_API_KEY` | for AI draughtsman | xAI chat — user-initiated only |
| `VITE_AUTH_ENABLED` | `false` | this studio has no accounts |

## Historical Italian sheets

BIMCAD can collage old IGM / catasto scans (the big quadro d'unione plus the small tavolette) and lock them onto today's Ktimatologio / globe.

1. Open the **Maps** dock tab or type `overlay`.
2. Import the parent sheet and the singles.
3. Type `collage` to assemble them at printed scale (`1:25000`, `1:2000`, …).
4. Type `georef`, click a church or road fork on the old scan, then the same point on the modern plan — or type `lon,lat`. Two points scale, rotate and place the collage so particelle sit on live ground.
5. Zoom the globe: registered sheets carry geographic bounds for draping over Rhodes / Greece orthophoto.

Commands: `overlay`, `collage`, `georef`, `1:25000`, `rodi`.
