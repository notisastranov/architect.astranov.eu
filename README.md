# Astranov Architect BIMCAD

Millimetre-kernel CAD, BIM and survey studio for architects, mechanical engineers and topographers.

**Live:** [architect.astranov.eu](https://architect.astranov.eu)

Plan, split and 3D model views. Walls, doors, windows, slabs, plates, holes, survey traverses. Snap, ortho, command line, quantities, IFC properties, and an AI draughtsman.

## Stack

TanStack Start · React 19 · Three.js · Zustand · Vercel (Nitro)

Internal units are millimetres. Display units: mm, cm, m, ft.

## Environment

Set these on the Vercel project (never commit them):

| Variable | Required | Purpose |
|---|---|---|
| `XAI_API_KEY` | for AI draughtsman | xAI chat — user-initiated only |
| `VITE_AUTH_ENABLED` | `false` | this studio has no accounts |

## Local

```bash
npm ci
npm run dev
```

Production build: `npm run build`.
