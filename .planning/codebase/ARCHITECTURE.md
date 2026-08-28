<!-- generated-by: gsd-doc-writer -->
<!-- refreshed: 2026-08-22 -->
# Architecture

**Analysis Date:** 2026-08-22

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Static browser shell                    │
│          `public/index.html` + `public/styles.css`           │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  DOM/event composition root                 │
│                        `src/main.ts`                         │
├──────────────────┬──────────────────┬───────────────────────┤
│ App/store model  │ Geometry         │ Markup/rendering      │
│ `src/model.ts`   │ `src/geometry.ts`│ `src/markup.ts`       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌──────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│ v1 normalization │ │ Shared types  │ │ Catalog + rough SVG │
│ `src/format.ts`  │ │ `src/types.ts`│ │ `src/catalog.ts`    │
└────────┬─────────┘ └───────────────┘ │ `src/rough.ts`      │
         ▼                              └─────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Multi-document browser persistence                          │
│ `src/document-storage.ts` → native `localStorage`           │
└─────────────────────────────────────────────────────────────┘
```

`src/main.ts` delegates downloads, lifecycle listeners, live status, text-entry
detection, and external-storage routing to the injected boundary in
`src/browser-io.ts`.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Static shell | Stable DOM IDs, controls, palette/canvas containers, module bootstrap | `public/index.html` |
| Composition root | Queries DOM, binds controls, owns viewport/gesture state, renders, and imports files | `src/main.ts` |
| Browser IO | Injected download/raster adapters, lifecycle listeners, live status, and browser-bound failure mapping | `src/browser-io.ts` |
| Application model | Owns active document, document sessions, edits, history, autosave, templates | `src/model.ts` |
| Normalization | Validates/migrates all JSON to canonical v1, bounds input, remaps inserted IDs | `src/format.ts` |
| Document storage | Maintains per-document keys, registry, active ID, and legacy migration | `src/document-storage.ts` |
| Geometry | Pure coordinate transforms, fitting, bounds, anchors, and label wrapping | `src/geometry.ts` |
| Markup | Pure palette, document SVG, overlay SVG, XML escaping, and export generation | `src/markup.ts` |
| Rough rendering | Deterministic seeded hand-drawn SVG path generation | `src/rough.ts` |
| Catalog | Versioned block/category definitions, aliases, and O(1) definition lookup | `src/catalog.ts` |
| Domain types | Canonical diagram, node, edge, metadata, and catalog contracts | `src/types.ts` |

## Pattern Overview

**Overall:** Static modular browser application with a functional core and imperative shell.

**Key Characteristics:**
- `src/main.ts` is the only browser-DOM composition root; reusable modules receive data through parameters.
- `createApplicationModel()` is the mutation boundary. UI code calls model methods instead of changing diagram state directly.
- `normalize()` is the single trust boundary for templates, imported files, stored documents, and v0 migration.
- Durable document SVG and ephemeral interaction SVG are generated separately into `documentLayer` and `overlayLayer`.
- Multi-document persistence separates document payloads from the registry and active-document pointer.
- Each open document owns a session store with independent dirty state and undo/redo history; public state/index accessors return clones.
- Public creation normalizes the complete supplied document; new/import/template documents persist payload and active pointer before their store is activated.
- Create, switch, and delete flush the active store first and abort on persistence failure. Failed first persistence cleans the reservation and retains the prior active store.
- Production JavaScript in `public/js/` is generated one-to-one from `src/` without bundling.

## Layers

**Static presentation:**
- Purpose: Declare stable controls and visual layout.
- Location: `public/index.html`, `public/styles.css`
- Contains: Topbar, document/template actions, palette, SVG canvas, label editor, responsive CSS.
- Depends on: Generated entry module `public/js/main.js`.
- Used by: Browser users and the frozen HTML ID contract in `tests/multi-document-ui.test.ts`.

**Browser orchestration:**
- Purpose: Translate DOM events into model actions and model state into DOM/SVG.
- Location: `src/main.ts`, `src/browser-io.ts`
- Contains: Event listeners, viewport state, gesture coalescing, file selection, lifecycle handling, downloads, and bounded PNG conversion.
- Depends on: `src/format.ts`, `src/geometry.ts`, `src/markup.ts`, `src/model.ts`, `src/document-storage.ts`.
- Used by: `public/js/main.js`.

**State and use cases:**
- Purpose: Encapsulate document mutations, transient UI state, history, persistence scheduling, document switching, and template use cases.
- Location: `src/model.ts`
- Contains: Generic `createModel()`, application facade, template catalog, frame coalescer.
- Depends on: `src/catalog.ts`, `src/document-storage.ts`, `src/format.ts`, markup types, domain types.
- Used by: `src/main.ts` and unit tests.

**Domain and normalization:**
- Purpose: Define canonical data and safely convert untrusted input into it.
- Location: `src/types.ts`, `src/format.ts`, `src/catalog.ts`
- Contains: v1 envelope, limits, v0 migration, aliases, ID remapping, block definitions.
- Depends on: Type-only domain contracts and catalog metadata.
- Used by: Model, storage, rendering, templates, tests.

**Rendering and geometry:**
- Purpose: Produce deterministic markup and pure spatial calculations.
- Location: `src/geometry.ts`, `src/markup.ts`, `src/rough.ts`
- Contains: Transforms, bounds, anchors, XML escaping, document/overlay markup, SVG export.
- Depends on: Domain types and catalog.
- Used by: `src/main.ts`, `src/model.ts` type contracts, tests.

**Persistence:**
- Purpose: Store multiple independent normalized documents in browser storage.
- Location: `src/document-storage.ts`
- Contains: Namespaced keys, index recovery, active selection, delete, legacy migration.
- Depends on: `normalize()` and `DiagramFile`.
- Used by: `src/model.ts`.

## Data Flow

### Primary Edit and Save Path

1. A DOM event is handled in `src/main.ts` and converted to diagram coordinates through `src/geometry.ts`.
2. `src/main.ts` invokes an `ApplicationModel` method from `src/model.ts`.
3. `createModel().update()` classifies the mutation as `transient`, `commit`, or `ui-only`; the last mode receives only a cloned UI object at runtime and cannot mutate the document.
4. Every update rebuilds the node `Map`; committed document changes add one history snapshot and schedule a 500 ms save.
5. The model change callback runs `render()` in `src/main.ts`.
6. `documentMarkup()` and `overlayMarkup()` in `src/markup.ts` update separate SVG `<g>` layers.
7. Persistence normalizes metadata through `prepareDiagramFile()` and writes per-document data through `src/document-storage.ts`.
8. Switching, creating, or deleting first flushes the active store; a failed flush leaves that document active and dirty.
9. Creation normalizes the full input, reserves an ID, persists the document and active pointer, and only then activates the new store. Failure cleans the reservation and restores the previous active pointer when possible.

### Document Load and Migration

1. `initialize()` in `src/model.ts` reads the registry via `readRegistry()` in `src/document-storage.ts`.
2. Stored payloads pass through `normalize()` in `src/format.ts`; only source version 1 is accepted as current storage.
3. If no v1 document is available, `migrateLegacyDocument()` normalizes the old single key, preserves a v0 backup when needed, and creates a v1 document.
4. If storage cannot be accessed, the model uses an in-memory `StorageLike` and keeps the editor usable for the session.
5. If no stored document exists, the first same-origin template is fetched and normalized; failure creates an empty document.

### Template and File Import

1. Template selection in `src/main.ts` calls `applyTemplate()` in `src/model.ts`; template bytes fetched from `public/templates/` pass through `normalize()`.
2. “New from template” and file import both route through normalized public creation and do not replace the current stored document until the new document's first persistence succeeds.
3. “Insert into current” calls `insertIntoDiagram()` in `src/format.ts`, remapping every imported node/edge ID and endpoint before one undoable commit.
4. File input in `src/main.ts` calls `readDiagramFile()` in `src/format.ts`; both read and parse failures preserve the active document.

### Export Path

1. JSON export calls `prepareDiagramFile()` through `app.exportFile()` in `src/model.ts`.
2. SVG export calls `buildExportSvg()` in `src/markup.ts`, which renders only canonical document markup.
3. `src/browser-io.ts` creates local downloads and maps Blob, object URL, click, cleanup, image, canvas/context, encoding and timeout failures to explicit `ExportResult` values.
4. PNG rasterizes at 2× and refuses output over 8,192 px per side or 32,000,000 total pixels before browser canvas allocation.
5. Image loading and `toBlob()` share a 10-second default timeout; settlement cancels the timer, clears handlers, revokes the source URL once, and ignores late callbacks.
6. Selection, connection source, and connection preview are generated only by `overlayMarkup()` and never enter SVG export.

### External Storage Path

1. `bindBrowserLifecycle()` listens only for safe namespaced document keys.
2. Active clean update replaces the store from normalized persisted bytes; active dirty update/deletion preserves local state/history and reports conflict.
3. Active clean deletion retires its store/summary and consults the current registry. A clean cached fallback is rebuilt from newest persisted bytes; a dirty cached fallback is reactivated with history intact.
4. If no active-deletion fallback is usable, the model persists an empty replacement or, on reservation/persistence failure, keeps a ready dirty recovery store whose later `flush()` rechecks its claim.
5. Inactive clean update refreshes its cache when present and always updates the summary; inactive clean deletion removes cache, recovery claim, and summary without changing active state.
6. Inactive dirty update/deletion preserves cache, local history, and registry visibility as conflict without switching active state.
7. Uncached inactive update adds or refreshes its summary; uncached inactive deletion removes it. Both leave active state unchanged.

**State Management:**
- Durable state is a `DiagramFile` inside `createModel()` in `src/model.ts`.
- Ephemeral selection/tool/connection state is colocated in `EditorUiState` but excluded from document snapshots and persistence.
- Viewport, panning, dragging, and label-editor placement remain DOM-local state in `src/main.ts`.
- Undo/redo uses capped JSON snapshots with a limit of 100 entries per document.
- A per-document session `Map` preserves independent dirty state, UI state, and history while browser persistence is debounced.
- `state`, `nodeIndex`, `nodeById()`, `file`, `ui`, and document-summary accessors return cloned snapshots so callers cannot mutate internal state.
- `ui-only` enforces its boundary at runtime by cloning `state.ui` and passing only that clone to the mutator; document bytes, history, and persistence cannot change through that mode.

## Key Abstractions

**`DiagramFile`:**
- Purpose: Canonical persistence/export envelope with `format: "anatomia"` and `version: 1`.
- Examples: `src/types.ts`, `public/templates/*.json`
- Pattern: Versioned data-transfer object.

**`normalize()`:**
- Purpose: Convert unknown JSON/v0/v1 input into bounded, canonical data with warnings/errors and optional ID remapping.
- Examples: `src/format.ts`, `src/document-storage.ts`, `src/model.ts`
- Pattern: Parse/validate/salvage trust boundary.

**`ModelStore`:**
- Purpose: Centralize mutations, history, derived node indexing, notifications, and debounced persistence.
- Examples: `src/model.ts`
- Pattern: Observable store with explicit update modes.

**`StorageLike`:**
- Purpose: Decouple persistence algorithms from browser `localStorage` and permit deterministic in-memory tests/fallback.
- Examples: `src/document-storage.ts`, `tests/document-storage.test.ts`
- Pattern: Narrow port/interface.

**`BrowserIo`:**
- Purpose: Keep browser download and raster side effects injectable and independently testable.
- Examples: `src/browser-io.ts`, `tests/browser-io.test.ts`, `tests/multi-document-ui.test.ts`
- Pattern: Capability adapter with typed success/failure results.

**Document and overlay markup:**
- Purpose: Keep durable/exportable SVG independent from selection and connection affordances.
- Examples: `src/markup.ts`, `src/main.ts`
- Pattern: Layered rendering.

## Entry Points

**Browser application:**
- Location: `public/index.html` → `public/js/main.js`
- Triggers: Static page load.
- Responsibilities: Instantiate the app, load storage/template state, wire interactions, render, and flush pending saves on lifecycle events.

**Source compilation:**
- Location: `tsconfig.json`
- Triggers: `npm run build`.
- Responsibilities: Emit each `src/*.ts` module into `public/js/*.js`.

**Test suite:**
- Location: `tests/*.test.ts`
- Triggers: `npm test`.
- Responsibilities: Compile to `.test-dist/` then run the Node built-in test runner.

## Architectural Constraints

- **Threading:** Single browser main thread; pointer moves are coalesced through `requestAnimationFrame` in `src/model.ts`/`src/main.ts`.
- **Global state:** Browser-local DOM references and viewport/gesture variables exist only in `src/main.ts`; reusable modules do not read application globals.
- **Circular imports:** No runtime circular chain detected. `src/model.ts` imports markup contracts with `import type`, while markup does not import model.
- **Mutation boundary:** Add/edit/delete/connect/title/template operations must go through `ApplicationModel`; render functions must stay side-effect-free with respect to persistence.
- **Format/mutation parity:** Model commands apply the same title, label, coordinate, ID and collection limits enforced by v1 ingestion so editor-created state round-trips unchanged.
- **Creation normalization:** Every public `createDocument()` input is fully normalized before persistence or activation; imports and new-from-template use the same path.
- **Snapshot boundary:** Treat all public model values as immutable snapshots; durable changes must go through model commands or `update()`.
- **UI-only boundary:** The `ui-only` callback operates only on cloned UI state at runtime, not merely through a TypeScript declaration.
- **Raster boundary:** Do not allocate PNG canvas beyond the limits exported by `src/browser-io.ts`; direct users to SVG instead.
- **Ingestion boundary:** Any new data source must call `normalize()` in `src/format.ts` before replacing or merging a document.
- **Generation boundary:** Edit `src/*.ts`, then generate `public/js/*.js`; do not hand-edit generated modules.
- **Deployment boundary:** Publish only `public/`, not repository root, source, tests, or dependencies.

## Anti-Patterns

### Persisting During Render

**What happens:** Rendering would couple pointer-frequency visual updates to storage writes.
**Why it's wrong:** It causes excessive synchronous storage work, history ambiguity, and accidental document overwrites.
**Do this instead:** Keep `render()` in `src/main.ts` limited to document/overlay DOM updates; schedule persistence from committed updates in `src/model.ts`.

### Bypassing Normalization

**What happens:** Assigning parsed JSON, template data, or storage data directly to model state bypasses limits, migration, aliasing, and dangling-edge cleanup.
**Why it's wrong:** Malformed data can corrupt rendering, collide IDs, or replace the active document.
**Do this instead:** Route every ingestion source through `normalize()`, `readDiagramFile()`, or `insertIntoDiagram()` in `src/format.ts`.

### Mixing Overlay Into Document SVG

**What happens:** Selection and connection preview markup can leak into exports or change when undo restores document snapshots.
**Why it's wrong:** Exported output becomes dependent on ephemeral UI state.
**Do this instead:** Render `documentMarkup()` and `overlayMarkup()` into the distinct layers created in `src/main.ts`.

### Editing Generated JavaScript

**What happens:** A direct edit under `public/js/` diverges from TypeScript source.
**Why it's wrong:** The next `npm run build` silently overwrites the fix.
**Do this instead:** Change the matching `src/*.ts` module and regenerate all `public/js/`.

## Error Handling

**Strategy:** Preserve the active document, salvage bounded valid data where safe, and report user-facing failures without introducing a remote dependency.

**Patterns:**
- `normalize()` returns structured `ok`, `warnings`, and `errors` rather than throwing for content errors.
- Template/file failures return Portuguese messages that state the active document was preserved.
- Storage operations use `try/catch`; dirty flush failures abort destructive navigation and callbacks surface errors through `#saveStatus`.
- Browser IO converts expected browser capability failures into typed `ExportResult` values rather than uncaught exceptions.
- Missing DOM contracts fail fast through `$()` in `src/main.ts`.
- Invalid/missing render references are omitted safely in `src/markup.ts`.

## Cross-Cutting Concerns

**Logging:** User-visible status only; no telemetry or runtime console logger.
**Validation:** Centralized in `src/format.ts`, with XML escaping in `src/markup.ts` and document-ID validation in `src/document-storage.ts`.
**Authentication:** Not applicable; all data is browser-local.
**Performance:** rAF coalescing, cached gesture rectangles, one-pass bounds, and derived node `Map`; full document markup still regenerates on transient movement.
**Residual validation (low):** The 120 Node tests across 12 files do not execute a real browser renderer, accessibility tree, font/emoji stack, pointer capture implementation, or download UI; manual cross-browser smoke remains required.
**Concurrency (low):** Document reservation is a non-atomic `localStorage` check-then-set, so separate tabs can still hit a rare same-ID TOCTOU race despite reservation and recovery-claim rechecks.
**Status wording (low):** `bindBrowserLifecycle()` presents any `"missing"` result as removal/unreadable text; for an inactive deletion this can sound active-scoped even though active model state is unchanged.
**Generated parity:** `npm run check:freshness` currently passes, so all ten `public/js/` modules contain the final source behavior. This remains a manually invoked local gate because no CI enforces it.
**Phase gate:** `docs/status-gate-fase-3.md` blocks Phase 3 until the remaining manual gate and feature-specific evidence are satisfied.

---

*Architecture analysis: 2026-08-22*
