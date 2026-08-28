<!-- generated-by: gsd-doc-writer -->
# Coding Conventions

**Analysis Date:** 2026-08-22

## Naming Patterns

**Files:**
- Use lowercase concept names (`src/model.ts`) and kebab-case for multiword modules (`src/document-storage.ts`).
- Mirror modules with `<concept>.test.ts` under `tests/`.
- Keep generated JavaScript basenames identical to TypeScript source under `public/js/`.

**Functions:**
- Use camelCase verbs for behavior: `createApplicationModel()`, `createBrowserIo()`, `readRegistry()`, `buildExportSvg()`, `screenToDiagram()`.
- Prefix factories with `create`, readers with `read`, pure renderers with the output concept (`documentMarkup`, `overlayMarkup`), and event helpers with an action (`finishPointerGesture`).
- Keep module-private helpers unexported unless tests/other modules require a stable API.

**Variables:**
- Use camelCase and domain-specific names: `activeId`, `nodeIndex`, `gestureRect`, `saveHandle`.
- Use uppercase snake case for shared immutable constants: `FORMAT_LIMITS`, `MODEL_HISTORY_LIMIT`, `DOCUMENT_INDEX_KEY`.
- Use short local names only for tightly scoped primitives (`b()` in `src/catalog.ts`, `$()` in `src/main.ts`).

**Types:**
- Use PascalCase interfaces/type aliases: `DiagramFile`, `StorageLike`, `MarkupVisualState`, `UpdateMode`.
- Prefer interfaces for object contracts and unions/type aliases for modes, selections, tuples, and conditional types.
- Use discriminated unions with a `kind` field for node/edge selections.

## Code Style

**Formatting:**
- No formatter is configured.
- Follow existing two-space indentation, semicolons, double quotes, trailing commas in multiline constructs, and braces for multi-line control flow.
- Prefer compact one-line accessors/listeners only when the body remains obvious; keep domain algorithms expanded and readable.
- Import browser-relative modules with explicit `.js` extensions from TypeScript because `moduleResolution` is `NodeNext`.

**Linting:**
- No ESLint, Biome, or other linter is configured.
- `tsconfig.json` enforces `strict`, `noUnusedLocals`, and `noFallthroughCasesInSwitch`.
- `npm run check` is the static quality gate.
- Treat generated drift under `public/js/` as a release-gate failure; run `npm run check:freshness` locally and keep future automation deferred to `docs/entrega-diferida.md`.

## Import Organization

**Order:**
1. Runtime imports from sibling modules.
2. Type-only imports, using `import type` or inline `type`.
3. In tests, Node built-ins first, then a blank line, then project modules.

**Path Aliases:**
- None. Use explicit relative paths such as `../src/format.js` in tests and `./geometry.js` in source.

**Dependency direction:**
- Keep `src/main.ts` at the top as the composition root.
- Keep geometry/rough/types independent of model and browser globals.
- Use type-only imports to avoid runtime cycles, as in `src/model.ts` importing markup contracts.

## Error Handling

**Patterns:**
- Return result objects for expected invalid external data. `normalize()` in `src/format.ts` returns `ok`, warnings, errors, source version, and safe fallback data.
- Catch browser capability failures at boundaries in `src/browser-io.ts` and `src/model.ts`, then preserve active data and show a Portuguese message.
- Return discriminated `ExportResult` values for expected Blob, object URL, click, image, canvas/context and encoding failures.
- Bound asynchronous image/`toBlob()` work with an injected timeout; every settlement path must cancel the timer, clear handlers, revoke the source URL once, and ignore late callbacks.
- Use `try/catch` around `localStorage`, file reads, template fetches, and persistence flushes.
- Throw only for programmer/contract failures, such as a missing required DOM element in `$()` or an invalid internal document ID in `documentKey()`.
- Do not expose raw exceptions or untrusted payloads in user-facing messages.

## Logging

**Framework:** No logger; user-visible status is the observability mechanism.

**Patterns:**
- Use `onStatus(message, isError)` in `src/model.ts` for save/storage/template state.
- Render non-blocking save errors through `#saveStatus` in `src/main.ts`.
- Use `alert()` only for explicit file-open failures and destructive confirmation dialogs for delete/clear.
- Do not add telemetry or `console.*` logging without a deliberate product/integration decision.

## Comments

**When to Comment:**
- Explain non-obvious contracts and intent: format insertion requirements in `src/format.ts`, catalog alias compatibility in `src/catalog.ts`, and deterministic rough-rendering rationale in `src/rough.ts`.
- Keep comments focused on invariants or why an implementation exists, not line-by-line narration.
- Track deferred product work in `docs/status-gate-fase-3.md` or `docs/entrega-diferida.md`, not ad hoc source TODOs.

**JSDoc/TSDoc:**
- Use JSDoc on public options and algorithms whose constraints are not obvious, such as `NormalizeOptions` and `insertIntoDiagram()` in `src/format.ts`.
- Most self-explanatory exported functions rely on TypeScript signatures rather than mandatory JSDoc.

## Function Design

**Size:**
- Keep reusable algorithms cohesive and pure where practical (`src/geometry.ts`, `src/rough.ts`, `src/markup.ts`).
- Keep DOM composition in `src/main.ts`; isolate reusable browser lifecycle/download capabilities in `src/browser-io.ts`.
- `src/main.ts` is 299 lines and satisfies the Phase 2 size requirement of fewer than 300 lines.

**Parameters:**
- Pass data and capabilities explicitly. Examples include injected `StorageLike`, ID factories, schedulers, frame callbacks, and template request functions.
- Accept `unknown` at trust boundaries and narrow in `src/format.ts`.
- Prefer narrow structural interfaces (`RectLike`, `TemplateResponse`, `DiagramFileSource`) over concrete browser classes when behavior is testable.

**Return Values:**
- Return typed result objects for parsing/import operations.
- Return booleans for state changes that can be no-ops or fail safely.
- Return `null` for absence where no diagnostic is required, such as empty SVG export or missing stored document.
- Keep rendering functions deterministic strings derived only from arguments.

## Module Design

**Exports:**
- Export domain-facing constants, interfaces, and functions directly from their owning module.
- Keep implementation helpers private.
- Use `Readonly`, `readonly`, `Object.freeze()`, and `DeepReadonly` for contracts that callers must not mutate.
- Public model getters must return clones/snapshots; do not mutate `ApplicationModel.file`, `ui`, `nodeIndex`, `documents`, `ModelStore.state`, or `nodeById()` results.
- Expose commands on `ApplicationModel` and route all durable mutation through `update()`.

**Barrel Files:**
- Not used. Import directly from the owning module to preserve dependency clarity.

**State updates:**
- Use `mode: "transient"` for visual interaction changes that do not create history or persistence.
- Use `mode: "commit"` for durable document mutations; this records history and schedules save.
- Use `mode: "ui-only"` for UI-only changes that notify without creating history or scheduling persistence. Its callback receives only a cloned `UiState` at runtime; never add document access back to this path.
- Finish drag with `finishTransient()` so many pointer moves become one undoable change.
- Flush before create/switch/delete; if flush fails, leave the current dirty store active and abort the destructive navigation.
- Normalize every public creation input, then persist the new payload and active pointer before activating its store. On failure, clean the reservation and preserve the prior active store.
- Preserve one store and one capped history per document during the browser session.
- On external deletion of a clean active store, reload any clean cached fallback from current persisted bytes, reactivate any dirty cached fallback with history intact, or create a replacement.
- If replacement persistence fails, keep the recovery store ready and dirty for a later claim-rechecked flush. Preserve a dirty deleted/updated active store as a visible recoverable conflict.
- For inactive external events, refresh or retire clean caches, preserve dirty caches/history as conflicts, and synchronize uncached summaries without switching active state.

**Normalization:**
- Route every imported/stored/template payload through `normalize()` in `src/format.ts`.
- Route direct `createDocument()` callers through the same full normalization boundary.
- Preserve unknown block definitions for forward compatibility while translating known aliases.
- For insertion, remap every source ID and edge endpoint through `insertIntoDiagram()`.
- Apply `FORMAT_LIMITS` helpers at mutation boundaries so editor-produced titles, labels, coordinates, IDs, nodes, and edges survive a v1 round trip.

**Rendering:**
- Keep durable document output in `documentMarkup()` and transient affordances in `overlayMarkup()`.
- Escape every dynamic label/ID with `escapeXml()`.
- Build export SVG from document state only.

**Generated artifacts:**
- Change `src/*.ts`, run the clean `npm run build`, review matching `public/js/*.js`, and run `npm run check:freshness`.
- Never repair generated output manually.

---

*Convention analysis: 2026-08-22*
