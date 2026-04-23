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

## Continuation Notes

- Read this file first when resuming work in a new conversation.
- Before touching code in a resumed session, inspect the dirty worktree and work with existing changes instead of reverting them.
- Differential Analysis frontend is currently split across `DifferentialAnalysisPage.jsx`, `DifferentialAnalysisSections.jsx`, `differentialAnalysisUtils.js`, `differentialAnalysisCharts.js`, and `differentialAnalysisExport.js`.
- Load Data shared controls are now split into `LoadDataPage.jsx` and `LoadDataShared.jsx`; keep modal and picker UI logic out of `LoadDataPage.jsx` when doing further cleanup.
- Preserve the current Differential Analysis subtab order and behavior: `Data`, `Volcano Plot`, `Heatmap`.
- Keep the Data tab behavior unchanged: 10 rows per page, search with an explicit Apply button, and page jump controls.
- Keep SVG-first export for volcano and heatmap figures. Prefer vector PDF export and do not reintroduce raster PDF workarounds or DOM screenshot fallbacks unless the user explicitly asks for them.
- Heatmap refresh from `Top genes` must only refresh the heatmap payload, not rerun the full differential analysis request.
- Heatmap detail modes must remain `Brush Selection` and `Gene IDs`.
- Keep Differential Analysis typography, sidebar sizing, export controls, and output panel styling aligned with Load Data and Mapping Statistics.
- The demo expression matrix flow now uses the human six-sample file `hsa_synthetic_raw_counts_6samples.txt` under `srnameta_job_root`; do not switch it back to the older maize demo unless explicitly requested.
- The target annotation file for Differential target-gene mapping currently resolves from `Conserved_Site_Context_Scores.txt` or `Conserved_Site_Context_Scores.hsa.txt` under `srnameta_job_root`.
- Differential target-gene mapping is currently intended for `miRNA` only and supports `Human` and `Mouse` species.
- `Target Gene Network` must remain visible only while Differential Analysis is on the `Data` subtab.
- `Target Gene Network` table behavior should stay aligned with the Differential Data table: 10 rows per page, search with Apply, page buttons, and page jump controls.
- Differential data export now produces a ZIP bundle, not a single CSV. Include `srnameta_differential_analysis.csv` and, when available, `srnameta_target_gene_network.csv`.
- `Query all in STRING` should continue to submit the batch list with stable identifiers derived from Ensembl IDs when available, while each target-gene row supports single-gene STRING navigation.
- Prefer lightweight validation only during handoff cleanup: `pnpm build` for frontend and targeted `parse()` checks for changed R files. Do not add or run regression tests unless the user explicitly asks for them.
- When doing further low-risk cleanup, prefer extracting self-contained presentational helpers or modal components. Avoid risky behavioral refactors in `DifferentialAnalysisSections.jsx` and `differential_analysis.data.R` unless a concrete bug requires it.
- Remove stale `tmp*` debug artifacts and redundant export fallback code before handing off a migrated session whenever those files are not part of the feature.

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
- `frontend/app_shell/src/components/DifferentialAnalysisPage.jsx`: Differential Analysis state orchestration and Shiny bridge wiring.
- `frontend/app_shell/src/components/DifferentialAnalysisSections.jsx`: Differential Analysis presentational sections, tables, tabs, heatmap panels, and export panel.
- `frontend/app_shell/src/components/DifferentialTargetNetworkPanel.jsx`: Differential target-gene and STRING table shown only on the Data subtab.
- `frontend/app_shell/src/components/LoadDataShared.jsx`: Load Data pickers, select controls, preview table, and sample-configuration modals.
- `frontend/app_shell/src/components/differentialAnalysisUtils.js`: Differential Analysis formatting helpers and heatmap subset utilities.
- `modules/differential_analysis/differential_analysis.target_network.R`: Target annotation loading, miRNA-to-gene aggregation, and STRING URL generation.
- `frontend/app_shell/src/styles`: frontend-only CSS imported by Vite.
- `frontend/app_shell/src/styles/differential-analysis`: Differential Analysis style partials imported through `differential-analysis.css`.
- `www/css`: Shiny shell CSS loaded before React assets.
