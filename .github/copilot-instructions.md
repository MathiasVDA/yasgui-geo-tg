# Copilot instructions for yasgui-geo-tg

## Project shape

- This package is an ESM YASR plugin that renders geographic SPARQL results in Leaflet.
- The package entry point is `index.js`; keep public option names reflected in `index.d.ts` and `docs/options.md`.
- Feature helpers live in `src/` and should be small, testable modules.
- The demo app lives in `demo/` and uses Vite.

## Development rules

- Keep changes focused and consistent with the existing plain JavaScript style.
- Preserve XSS safety: never render SPARQL binding values through `innerHTML`; use DOM APIs and `textContent`.
- Preserve CRS semantics: CRS84 is lon/lat; EPSG:4326 CRS URI/URN forms are authority-order lat/lon and must be swapped before Leaflet rendering.
- Prefer pure helper functions for parsing, formatting, filtering and serialization so Vitest can cover behavior without a browser map.
- When adding plugin options, update `DEFAULT_OPTIONS`, `index.d.ts`, `docs/options.md`, and README feature notes when user-facing.
- When adding supported geometry datatypes, update the converter map, tests, and the supported-datatypes table in `docs/options.md`.

## Verification

- Run focused tests for the files touched while developing.
- Before finishing broad feature work, run `npm test` and `npm run build`.
- The build output is produced by `node build.mjs` into `dist/`; `dist/` may be ignored locally.

## Commits

- Use conventional commits similar to the repository history: `feat(scope):`, `fix(scope):`, `test:`, `docs:`, `ci:`, or `chore(scope):`.
- Keep separate user-facing features in separate commits.
