# Keystone Console — Figma prototype

High-fidelity **NetApp BlueXP / Keystone console** UI built with React, Vite, Tailwind CSS v4, and Recharts. Design reference: [Figma — High-Fidelity Web App Prototype](https://www.figma.com/design/UpcxYGuYtIPg89T6V8UP0W/High-Fidelity-Web-App-Prototype).

## Prerequisites

- Node.js 20+ recommended
- npm 10+

## Scripts

| Command | Description |
|--------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server (port 8080) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | TypeScript check (no emit) |

## Figma asset imports

Imports like `figma:asset/<hash>.png` are resolved in local builds to `src/assets/figma-placeholder.png` via `vite.config.ts`. Raster assets used in the UI live under `src/assets/` (hashed filenames).

## Export / handoff

1. Clone or zip the project **without** `node_modules/` or `dist/` (both are gitignored).
2. Run `npm install`, then `npm run build` and `npm run typecheck` to verify a clean machine.
