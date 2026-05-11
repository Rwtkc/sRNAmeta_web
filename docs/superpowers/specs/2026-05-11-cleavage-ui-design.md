# Cleavage UI Design

## Goal

Add a new top-level `Cleavage` analysis page to `sRNAmeta` with a Shiny wrapper and a React UI shell. This first pass only implements the page structure and input controls. It does not run cleavage analysis yet.

## Scope

Included:

- Add a new top-level navbar tab named `Cleavage`
- Add a new Shiny module under `modules/cleavage`
- Add a new React page component for the cleavage interface
- Reuse the existing app shell visual language and page layout patterns
- Read saved state from `Load Data`
- Support only the saved `jobid` flow from `Load Data`
- Show adjustable cleavage parameters in the sidebar
- Show a disabled `Run Cleavage Analysis` button
- Show an empty `Analysis Output` panel

Excluded:

- Running Perl or R cleavage scripts
- Reading cleavage results
- Rendering PNG, PDF, JSON, TXT, or other outputs
- Adding result tables, plots, or downloads
- Adding regression tests

## Product Behavior

`Cleavage` is a top-level page alongside `Welcome`, `Load Data`, `Mapping Statistics`, and `Differential Analysis`.

The page does not manage its own input source. It consumes the saved `Load Data` state, similar to `Mapping Statistics`.

The page should be considered enabled only when:

- `Load Data` has been saved
- the saved `dataSource` is `jobid`
- the saved `jobId` is non-empty

The page does not display the current `jobId` directly.

When cleavage is not enabled, the sidebar shows this guidance message:

`Enter one or more Job IDs in Load Data, then click Save to enable Cleavage.`

When cleavage is enabled, the sidebar message changes to a ready-state message indicating that parameters can be adjusted before running analysis.

The right-side output area remains an empty panel with the standard `Analysis Output` title and no detailed result placeholders.

## UI Structure

The page follows the same high-level two-column layout used by the existing analysis pages.

Left column:

- analysis setup card
- status or guidance message
- parameter controls
- disabled `Run Cleavage Analysis` button

Right column:

- `Analysis Output` card
- empty state only

## Parameters

The sidebar exposes the same user-facing parameters already present in the cleavage script flow:

- `Cleavage ratio`
- `P-value`
- `Fold change`
- `Input base coverage`
- `Treated count cutoff`
- `Non-noise threshold`

Default values:

- `Cleavage ratio = 0.2`
- `P-value = 0.001`
- `Fold change = 6`
- `Input base coverage = 10`
- `Treated count cutoff = 10`
- `Non-noise threshold = 3`

All controls remain visible even when cleavage is disabled, but they are disabled together with the run button until `Load Data` enables the page.

## Data Contract

The Shiny adapter should prepare a serializable React config payload shaped like:

- `view = "cleavage"`
- `cleavage.status`
- `cleavage.message`
- `cleavage.loadDataSettings`
- `cleavage.defaults`
- `cleavage.runRequestInputId`
- `cleavage.progressSlotId`
- `cleavage.output`

`cleavage.loadDataSettings` must include:

- `dataSource`
- `jobId`
- `species`

This page pass does not require a live run request, but `runRequestInputId` should still be defined so the layout does not need restructuring later.

## Module Boundaries

New files:

- `modules/cleavage/cleavage.ui.R`
- `modules/cleavage/cleavage.server.R`
- `modules/cleavage/cleavage.adapter.R`
- `frontend/app_shell/src/components/CleavagePage.jsx`
- `frontend/app_shell/src/styles/cleavage.css`

Existing files to update:

- `ui.R`
- `server.R`
- `frontend/app_shell/src/App.jsx`
- `frontend/app_shell/src/styles/app-shell.css`

Responsibilities:

- `cleavage.ui.R`: React mount point only
- `cleavage.server.R`: translate saved `Load Data` state into the adapter config
- `cleavage.adapter.R`: define defaults, enablement rules, and page config
- `CleavagePage.jsx`: render the sidebar, disabled controls, and empty output card
- `cleavage.css`: page-specific styling layered onto the existing shell

## State Rules

The page depends on `Load Data` saved state only. It should not read unsaved draft state from the frontend.

Enablement logic:

- disabled if `dataSource != "jobid"`
- disabled if `jobId` is empty
- enabled otherwise

If `Load Data` changes later, the cleavage page should refresh through the existing Shiny-to-React config update path, without custom client-side synchronization logic.

## Styling

Follow the current sRNAmeta visual language:

- porcelain white surfaces
- ink text
- fluorescent lime accent
- restrained cobalt signal highlights

The new page should feel visually aligned with `Load Data`, `Mapping Statistics`, and `Differential Analysis`, not like a separate design system.

## Risks

- Reusing too much `Differential Analysis` structure could create unnecessary coupling. Keep the cleavage page isolated.
- Showing hidden or inferred `jobId` details would break the chosen UX. Do not surface them on the page in this pass.
- Reading unsaved `Load Data` draft state would create inconsistent behavior. Use saved state only.

## Implementation Notes

This is intentionally a UI-first slice. It creates a stable page contract so the later backend work can focus on:

- mapping `jobId` to cleavage input files
- resolving species-specific reference files
- invoking the cleavage Perl and R pipeline
- returning output metadata to the page
