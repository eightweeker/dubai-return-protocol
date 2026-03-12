# CLAUDE.md — Dubai Return Protocol

## Project Overview

A React-based decision support dashboard for tracking travel safety metrics to Dubai during a geopolitical crisis scenario (2026 Iran conflict). It calculates composite safety scores from 9 weighted factors and renders verdicts (GO / CONDITIONAL GO / HOLD / NO GO / RED) to support a family's return decision.

All data is client-side — no backend, no external APIs. Persistence is via `localStorage`.

## Tech Stack

- **Framework:** React 19 (functional components + hooks)
- **Build:** Vite 7
- **Styling:** Tailwind CSS 4 + CSS custom properties in `src/index.css`
- **Linting:** ESLint 9 (flat config)
- **Deployment:** GitHub Pages via GitHub Actions (push to `main`)
- **Node version:** 20 (per CI config)

## Repository Structure

```
src/
├── components/
│   ├── Overview.jsx      # Main dashboard: hero, day list, readiness checklist
│   ├── EntryForm.jsx     # Score input form with rubric dropdowns + day note
│   └── TrendChart.jsx    # SVG trend chart with smooth curves & animations
├── lib/
│   ├── constants.js      # FACTORS (9 weighted), VERDICTS, baseline scenario data
│   ├── scoring.js        # Composite calculation, verdict lookup, readiness check
│   └── storage.js        # localStorage persistence + JSON import/export
├── assets/
│   └── dubai-hero.jpg    # Hero background image
├── App.jsx               # Top-level state management & view routing
├── main.jsx              # React entry point
└── index.css             # CSS variables, Tailwind import, keyframe animations
```

Other key files: `vite.config.js`, `eslint.config.js`, `index.html`, `.github/workflows/deploy.yml`.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build (output: dist/)
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

## Data Model

Each daily entry:

```js
{
  date: "YYYY-MM-DD",
  scores: {
    flights, incidents, hormuz, oil, advisory,
    ceasefire, airport_threat, healthcare, exit
  },
  note: "Short summary",
  timestamp: "ISO string"
}
```

Scores are 1–5 per factor. Composite is a weighted normalization to 0–100 (total weight = 33).

### Return Readiness Criteria

All must be true: 3+ days uptrend, composite > 65, Exit factor >= 4, Healthcare factor >= 4.

## Code Conventions

- **Components:** Functional React with hooks (`useState`, `useMemo`, `useRef`, `useEffect`). No class components.
- **Styling:** Tailwind utility classes combined with inline styles where needed. Color palette defined as CSS variables in `index.css`.
- **Constants:** UPPER_SNAKE_CASE for module-level constants. Factor IDs are lowercase snake_case (e.g. `airport_threat`).
- **Files:** `.jsx` for React components, `.js` for plain modules. No TypeScript (type packages are present for editor support only).
- **Linting rules:** `no-unused-vars` is an error (ignores vars starting with uppercase or `_`). React hooks and refresh plugins enforced.
- **No tests:** The project has no test framework. Validate changes manually via `npm run dev` and `npm run lint`.

## Deployment

Production deploys happen automatically when code is pushed to `main`. The GitHub Actions workflow runs `npm ci && npm run build` and publishes `dist/` to GitHub Pages at base path `/dubai-return-protocol/`.

## Working on This Codebase

1. Run `npm install` if `node_modules/` is missing.
2. Run `npm run dev` to start the dev server.
3. Run `npm run lint` before committing to catch errors.
4. Keep the codebase small and focused — avoid adding unnecessary abstractions or dependencies.
5. Baseline scenario data lives in `src/lib/constants.js` (`BASELINE_ENTRIES`). New daily entries are added there.
