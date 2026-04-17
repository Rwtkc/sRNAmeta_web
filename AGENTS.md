# sRNAmeta Web Agent Guide

## Project Shape

This project follows the same Shiny backend plus React frontend pattern used by the RNAmeta reference project.

- Shiny owns application bootstrapping, tab navigation, backend modules, and static asset injection.
- React owns the visible page interfaces mounted from Shiny DOM roots.
- Frontend code lives under `frontend/app_shell`.
- Built frontend assets are emitted to `www/react/app_shell` and loaded by Shiny.
- Shared Shiny helpers live under `shared`.
- Each Shiny page module owns its own `*.ui.R`, `*.server.R`, and optional `*.adapter.R`.

## Development Commands

Run frontend commands from `frontend/app_shell`.

```bash
pnpm install
pnpm build
```

Run the Shiny app from the project root.

```r
shiny::runApp()
```

## Frontend Standards

- Use Vite, pnpm, React 18, and small focused components.
- Keep page components in `src/components`.
- Keep global design tokens in `src/styles/tokens.css`.
- Import page-level styles from `src/styles/app-shell.css`.
- Avoid business logic in React until the Shiny contract is defined.
- Keep React props serializable because page config is passed from Shiny through `data-shell-config`.
- Prefer direct imports over barrel files.
- Do not define React components inside other components.
- Do not create implementation plans unless the user explicitly asks for one.
- Do not add or run regression tests unless the user explicitly asks for testing.

## Shiny Standards

- Use `app_path()` from `global.R` for all local sources and file paths.
- Local job ID reads default to `D:/OBS录像/桌面/sRNAmeta_dir` through `srnameta_job_root`.
- Server deployments should override the job ID root with the `SRNAMETA_JOB_ROOT` environment variable instead of editing code.
- Use `srnameta_job_path(job_id)` when resolving a user-provided job ID.
- Register static resources only from `ui.R`.
- Keep `server.R` as orchestration; page behavior belongs in modules.
- Use `react_shell_host()` for React page roots.
- Use adapters to prepare JSON config for React.

## Styling Standards

- Use the sRNAmeta visual language: porcelain white surfaces, ink text, fluorescent lime primary accents, and restrained cobalt signal highlights.
- Use `rem` units for layout and sizing.
- Keep card radius at or below `0.5rem` unless matching a reference component already uses a larger radius.
- Do not reuse the older RNAmeta warm paper, muted green, clay, beige, or brown palette.
- Do not reuse the RiboTE cold blue-gray, teal, and orange palette.
- Do not add unrelated color systems, decorative blob backgrounds, or generic dashboard mosaics.
- Preserve responsive behavior for desktop and mobile.

## File Ownership

- `global.R`: root path helper and package bootstrap only.
- `ui.R`: app shell, asset tags, navbar tabs, footer.
- `server.R`: module registration only.
- `shared/react_bridge.R`: React mount helpers and JSON serialization helpers.
- `modules/welcome`: Welcome page Shiny wrapper and config.
- `modules/load_data`: Load Data page Shiny wrapper and config.
- `modules/mapping_statistics`: Reads `allmappingstat.txt` for a job ID and prepares mapping-statistics chart config.
- `frontend/app_shell/src/App.jsx`: route selection between React page views.
- `frontend/app_shell/src/components`: visual React components.
- `frontend/app_shell/src/styles`: frontend-only CSS imported by Vite.
- `www/css`: Shiny shell CSS loaded before React assets.
