<!-- generated-by: gsd-doc-writer -->
# Codebase Structure

**Analysis Date:** 2026-08-22

## Directory Layout

```text
app-anatomy/
├── src/                         # Authoritative TypeScript application modules
│   ├── main.ts                  # Browser composition root and DOM events
│   ├── browser-io.ts            # Browser lifecycle and export adapters
│   ├── model.ts                 # Store, use cases, history, templates, autosave
│   ├── format.ts                # v0/v1 normalization, imports, insertion
│   ├── document-storage.ts      # Multi-document localStorage adapter
│   ├── geometry.ts              # Pure geometry and viewport calculations
│   ├── markup.ts                # Palette/document/overlay/export markup
│   ├── rough.ts                 # Deterministic rough SVG paths
│   ├── catalog.ts               # Versioned block catalog and aliases
│   └── types.ts                 # Shared domain interfaces
├── public/                      # Complete static deployment artifact
│   ├── index.html               # Page shell and stable DOM contracts
│   ├── styles.css               # Layout and interaction styling
│   ├── js/                      # Generated ES modules from `src/`
│   └── templates/               # Three bundled v1 lesson templates
├── tests/                       # Node built-in tests
│   ├── *.test.ts                # 12 files, 120 current tests
│   ├── node.d.ts                # Minimal built-in Node declarations
│   └── fixtures/                # Legacy, golden, and DOM-contract fixtures
├── docs/                        # Architecture/design plans and delivery gates
├── .planning/codebase/          # Current-state maps used by GSD workflows
├── .test-dist/                  # Ignored generated test output
├── node_modules/                # Ignored development dependencies
├── package.json                 # Scripts and sole development dependency
├── package-lock.json            # npm lockfile v3
├── tsconfig.json                # Production compiler configuration
├── tsconfig.test.json           # Test compiler configuration
└── .gitignore                   # Generated/test/editor exclusions
```

## Directory Purposes

**`src/`:**
- Purpose: Authoritative application implementation.
- Contains: Ten dependency-light ES modules split by domain, state, storage, rendering, geometry, browser IO, and DOM wiring.
- Key files: `src/main.ts`, `src/browser-io.ts`, `src/model.ts`, `src/format.ts`, `src/document-storage.ts`, `src/markup.ts`.
- Rule: Add runtime behavior here first; generated `public/js/` is not an authoring location.

**`public/`:**
- Purpose: Entire deployable static site.
- Contains: HTML, CSS, generated JavaScript, and template JSON.
- Key files: `public/index.html`, `public/styles.css`, `public/js/main.js`.
- Rule: Publish the contents of this directory at the host root; do not publish repository root.

**`public/js/`:**
- Purpose: Browser-consumable output from `src/`.
- Contains: One `.js` file for every `.ts` file in `src/`.
- Key files: `public/js/main.js`, `public/js/browser-io.js`, `public/js/model.js`, `public/js/format.js`.
- Rule: Generate with `npm run build`; never edit manually. Source and generated counterparts must change together.

**`public/templates/`:**
- Purpose: Same-origin lesson starter diagrams.
- Contains: `public/templates/anatomia-completa.json`, `public/templates/caminho-de-um-clique.json`, `public/templates/login-seguro.json`.
- Key files: All three are canonical v1 `DiagramFile` envelopes.
- Rule: Validate with `normalize()` and keep IDs unique within each file.

**`tests/`:**
- Purpose: Regression and contract coverage using Node built-ins.
- Contains: Co-located-by-module tests plus behavioral adapter/command tests and one frozen HTML ID contract.
- Key files: `tests/format.test.ts`, `tests/model.test.ts`, `tests/document-storage.test.ts`, `tests/browser-io.test.ts`, `tests/multi-document-ui.test.ts`.
- Rule: Use `node:test` and `node:assert/strict`; avoid runtime test dependencies.

**`tests/fixtures/`:**
- Purpose: Stable compatibility and rendering baselines.
- Contains: `tests/fixtures/legacy/v0-representative.json`, `tests/fixtures/golden/diagram-input.json`, `tests/fixtures/golden/diagram-export.svg`, `tests/fixtures/contracts/multi-document-ui.ids.json`.
- Key files: `tests/fixtures/README.md` defines intended use.
- Rule: Update golden/contract data only for deliberate reviewed behavior changes.

**`docs/`:**
- Purpose: Product/architecture decisions and deferred delivery records.
- Contains: `docs/plano-arquitetura.md`, `docs/plano-design.md`, `docs/status-gate-fase-3.md`, `docs/entrega-diferida.md`.
- Key files: `docs/status-gate-fase-3.md` is the current Phase 3 gate; `docs/entrega-diferida.md` is the CI/hosting contract.

**`.planning/codebase/`:**
- Purpose: Generated current-state reference for planning and execution.
- Contains: `STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`.
- Rule: Describe implementation reality and cite concrete repository paths.

## Key File Locations

**Entry Points:**
- `public/index.html`: Static browser entry and stable element IDs.
- `public/js/main.js`: Generated browser module loaded by the page.
- `src/main.ts`: Authoritative browser composition root.
- `package.json`: Build, check, test, and local-server commands.

**Configuration:**
- `tsconfig.json`: Strict production compile to `public/js/`.
- `tsconfig.test.json`: Source/test compile to `.test-dist/`.
- `package-lock.json`: Exact compiler/toolchain resolution.
- `.gitignore`: Excludes `.test-dist/`, `.freshness-dist/`, dependencies, caches, logs, and editor files.

**Core Logic:**
- `src/model.ts`: Central mutation API, transactional persistence/history, and the active/inactive cached/uncached external-event matrix.
- `src/browser-io.ts`: Typed browser export boundary, raster limits, lifecycle listeners, and live status.
- `src/format.ts`: Canonical v1 ingestion and insertion.
- `src/document-storage.ts`: Multi-document persistence keys and migration.
- `src/geometry.ts`: Pure spatial logic.
- `src/markup.ts`: Pure render/export string generation.
- `src/catalog.ts`: 62-block catalog and compatibility aliases.
- `src/types.ts`: Data contracts.

**Testing:**
- `tests/*.test.ts`: Executable tests.
- `tests/node.d.ts`: Minimal declarations for Node built-in imports.
- `tests/fixtures/`: Compatibility/golden/contract data.
- `.test-dist/`: Ignored generated test modules.

**Plans and Gates:**
- `docs/plano-arquitetura.md`: Intended phased architecture.
- `docs/status-gate-fase-3.md`: Blocks Phase 3 items 3.1–3.5.
- `docs/entrega-diferida.md`: Defers CI, remote, hosting, and deployment.

## Naming Conventions

**Files:**
- Lowercase kebab-case for multiword TypeScript modules: `src/document-storage.ts`.
- Lowercase module names for single concepts: `src/model.ts`, `src/markup.ts`.
- Tests mirror the source concept with `.test.ts`: `tests/document-storage.test.ts`.
- Generated browser files preserve the source basename: `src/geometry.ts` → `public/js/geometry.js`.
- Documentation uses uppercase canonical map names in `.planning/codebase/`.

**Directories:**
- Lowercase semantic names: `src/`, `tests/`, `public/templates/`.
- Dot-prefixed generated/configuration areas: `.test-dist/`, `.planning/`.
- Fixture directories express contract role: `tests/fixtures/legacy/`, `golden/`, `contracts/`.

## Where to Add New Code

**New Browser Feature:**
- DOM contract: `public/index.html`.
- Styling: `public/styles.css`.
- Event wiring only: `src/main.ts`.
- Reusable browser capability/lifecycle adapter: `src/browser-io.ts`.
- State-changing use case: `src/model.ts`.
- Tests: matching `tests/*.test.ts`.
- Generated output: run `npm run build` to update `public/js/`.

**New Data Field or File Version:**
- Domain contract: `src/types.ts`.
- Validation/migration/defaulting: `src/format.ts`.
- Persistence compatibility: `src/document-storage.ts`.
- Fixtures/tests: `tests/fixtures/` and `tests/format.test.ts`.
- Do not deserialize directly in `src/main.ts` or `src/model.ts`.

**New Model Operation:**
- Public API and implementation: `src/model.ts`.
- Call site: `src/main.ts`.
- Unit coverage: `tests/model.test.ts`.
- Use `transient`, `commit`, or `ui-only` according to persistence/history semantics.
- Keep `ui-only` restricted to cloned UI state at runtime; document changes require `transient` or `commit`.

**New Rendering Behavior:**
- Pure SVG/HTML generation: `src/markup.ts`.
- Coordinate math: `src/geometry.ts`.
- Hand-drawn path primitive: `src/rough.ts`.
- Rendering/golden coverage: `tests/markup.test.ts`, `tests/geometry.test.ts`, `tests/rough.test.ts`, and `tests/fixtures/golden/`.
- Keep document and overlay outputs separate.

**New Persistence Behavior:**
- Storage key/index mechanics: `src/document-storage.ts`.
- Application lifecycle/use cases: `src/model.ts`.
- Tests: `tests/document-storage.test.ts` and `tests/model.test.ts`.
- Use `StorageLike`; do not couple storage algorithms directly to `window`.
- Preserve first-persistence-before-activation and cleanup/previous-pointer restoration for every new/import/template document.
- On clean external deletion, reload clean cached fallback from current storage, retain dirty cached fallback/history, and keep a failed replacement as ready/dirty in-memory state for later flush.
- Preserve the deleted/updated active store itself when dirty and report a conflict.
- For inactive events, refresh/retire clean caches, preserve dirty caches/history as conflicts, and keep uncached registry summaries synchronized without changing active state.

**New Export or Lifecycle Behavior:**
- Browser capability contract and error mapping: `src/browser-io.ts`.
- DOM binding/composition: `src/main.ts`.
- Pure SVG source: `src/markup.ts`.
- Tests: `tests/browser-io.test.ts`, `tests/gesture-hygiene.test.ts`, and `tests/multi-document-ui.test.ts`.
- Keep PNG allocation under the exported side/pixel limits and return an explicit `ExportResult`.

**New Catalog Block or Alias:**
- Definitions/version: `src/catalog.ts`.
- Compatibility normalization: aliases are consumed by `src/format.ts`.
- Tests: `tests/catalog.test.ts`.
- Increment `CATALOG_VERSION` intentionally when the public catalog baseline changes.

**New Template:**
- Data: `public/templates/<kebab-case>.json`.
- Registry: `DIAGRAM_TEMPLATES` in `src/model.ts`.
- UI option: `public/index.html`.
- Tests: extend `tests/templates.test.ts` and `tests/multi-document-ui.test.ts`.

**Utilities:**
- Keep helpers private in the owning module unless multiple modules require the same domain behavior.
- Shared domain types belong in `src/types.ts`.
- Avoid generic catch-all utility directories; current structure is concept-oriented.

## Special Directories

**`public/js/`:**
- Purpose: Production compiler output.
- Generated: Yes, by `npm run build`.
- Committed: Intended yes; Git currently has no commits.
- Current state: all ten modules are fresh relative to authoritative TypeScript according to `npm run check:freshness`; no CI enforces this local gate.

**`.test-dist/`:**
- Purpose: Test compiler output consumed by `node --test`.
- Generated: Yes, by `npm run test:compile`.
- Committed: No; ignored by `.gitignore`.

**`.freshness-dist/`:**
- Purpose: Temporary clean production compilation used only for source/generated byte comparison.
- Generated: Yes, and removed by `npm run check:freshness`.
- Committed: No; ignored by `.gitignore`.

**`tests/fixtures/golden/`:**
- Purpose: Stable visual/export contract.
- Generated: No; reviewed expected output.
- Committed: Intended yes; Git currently has no commits.

**`node_modules/`:**
- Purpose: Local compiler/toolchain installation.
- Generated: Yes, by npm.
- Committed: No; ignored by `.gitignore`.

**`.planning/codebase/`:**
- Purpose: Current-state repository maps.
- Generated: Yes, by mapping workflow.
- Committed: Not yet; repository has no commits.

---

*Structure analysis: 2026-08-22*
