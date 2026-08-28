<!-- generated-by: gsd-doc-writer -->
# Testing Patterns

**Analysis Date:** 2026-08-22

## Test Framework

**Runner:**
- Node built-in `node:test`.
- Config: `tsconfig.test.json` compiles source and tests into `.test-dist/`; runner selection is in `package.json`.
- Current verified suite: 120 tests, 120 passing, across 12 `tests/*.test.ts` files.

**Assertion Library:**
- Node built-in `node:assert/strict`.
- Minimal declarations for compiler support are maintained in `tests/node.d.ts`.

**Run Commands:**
```bash
npm test              # Clean, compile, and run all 120 tests
npm run test:compile  # Compile source/tests to `.test-dist/` only
npm run check         # Strict no-emit production type check
npm run build         # Generate browser modules in `public/js/`
npm run check:freshness # Compare a clean temporary emit with `public/js/`
```

No watch or coverage command is configured.

## Test File Organization

**Location:**
- Tests are separate from source in `tests/`, with one file per module/contract area.
- Fixtures are under `tests/fixtures/`.
- Generated test JavaScript is under ignored `.test-dist/`.

**Naming:**
- `<concept>.test.ts`, for example `tests/geometry.test.ts`.
- Cross-cutting behavioral tests use behavior names: `tests/write-pipeline.test.ts`, `tests/gesture-hygiene.test.ts`, `tests/multi-document-ui.test.ts`.

**Structure:**
```text
tests/
├── browser-io.test.ts
├── catalog.test.ts
├── document-storage.test.ts
├── format.test.ts
├── geometry.test.ts
├── gesture-hygiene.test.ts
├── markup.test.ts
├── model.test.ts
├── multi-document-ui.test.ts
├── rough.test.ts
├── templates.test.ts
├── write-pipeline.test.ts
├── node.d.ts
└── fixtures/
    ├── legacy/v0-representative.json
    ├── golden/diagram-input.json
    ├── golden/diagram-export.svg
    └── contracts/multi-document-ui.ids.json
```

## Test Structure

**Suite Organization:**
```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { normalize } from "../src/format.js";

test("returns explicit errors for malformed input", () => {
  const result = normalize("{not-json");
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});
```

**Patterns:**
- Tests use top-level `test()` calls; no nested suite API or hooks are used.
- Build small local helpers (`file()`, `node()`, `fixture()`) close to the tests that consume them.
- Inject storage, ID generators, schedulers, requests, and frame functions for deterministic behavior.
- Use `assert.deepEqual()` for full canonical structures, `assert.equal()` for scalar contracts, and `assert.match()` for markup/source invariants.
- Async fixture/template/file tests return promises from the test callback.
- Keep production modules importable in Node by avoiding browser-global access at module initialization outside `src/main.ts`.

## Mocking

**Framework:** No mocking library.

**Patterns:**
```typescript
class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}
```

```typescript
const failedLoad = await loadDiagramTemplate(
  { id: "missing", label: "Ausente", url: "templates/missing.json" },
  async () => ({ ok: false, async text() { return ""; } }),
);
```

**What to Mock:**
- Browser storage through `StorageLike`.
- Template fetch through the request callback in `loadDiagramTemplate()`.
- Persistence scheduling through `schedule`/`cancel` callbacks.
- Frame scheduling through `createFrameCoalescer()` parameters.
- File reads through the narrow `DiagramFileSource` interface.
- Blob, image, canvas, object URL, anchor, lifecycle, and status capabilities through `BrowserIoDependencies` and narrow browser contracts.
- PNG timers through injected `scheduleTimeout`/`cancelTimeout`, including stalled image and missing `toBlob()` callback cases.

**What NOT to Mock:**
- Pure format, geometry, markup, catalog, and rough-rendering functions.
- JSON serialization/normalization behavior.
- Fixture files and golden SVG output.

## Fixtures and Factories

**Test Data:**
```typescript
function file(title: string, nodeId: string): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title, catalogVersion: "1" },
    nodes: [{ id: nodeId, def: "api", x: 10, y: 20, label: title }],
    edges: [],
  };
}
```

**Location:**
- Local factories live in the relevant test file.
- v0 compatibility input: `tests/fixtures/legacy/v0-representative.json`.
- Representative SVG input/output: `tests/fixtures/golden/diagram-input.json` and `tests/fixtures/golden/diagram-export.svg`.
- Stable DOM ID contract: `tests/fixtures/contracts/multi-document-ui.ids.json`.
- Fixture intent and update rules: `tests/fixtures/README.md`.

## Coverage

**Requirements:** No percentage threshold or instrumentation is configured.

**View Coverage:**
```bash
# Not configured
```

Behavioral breadth covers format migration and mutation parity, transactional persistence/switching, per-document history, immutable snapshots, runtime-safe `ui-only`, delayed templates, the complete active/inactive and cached/uncached external update/deletion matrix, ready/dirty replacement recovery, browser export failures/raster limits/timeouts/cleanup, lifecycle and pointer coalescing, deterministic rendering, escaping, generated SVG, and stable DOM IDs.

## Test Types

**Unit Tests:**
- Pure algorithms in `tests/format.test.ts`, `tests/geometry.test.ts`, `tests/rough.test.ts`, `tests/catalog.test.ts`, and `tests/markup.test.ts`.
- Store/use-case behavior with injected capabilities in `tests/model.test.ts`.
- Storage algorithms with `MemoryStorage` in `tests/document-storage.test.ts`.
- Export/raster failure behavior with injected browser capabilities in `tests/browser-io.test.ts`.
- `tests/model.test.ts` covers active clean reload/deletion fallback, active dirty conflicts, inactive clean cache refresh/retirement, inactive dirty history-preserving conflicts, uncached registry update/removal, replacement persistence failure/retry, and runtime `ui-only` document immutability.

**Integration Tests:**
- Templates load from real JSON and round-trip through normalization in `tests/templates.test.ts`.
- Golden SVG output validates geometry, rough rendering, escaping, and export composition in `tests/markup.test.ts`.
- `tests/write-pipeline.test.ts`, `tests/gesture-hygiene.test.ts`, and `tests/multi-document-ui.test.ts` exercise exported commands/adapters and observable effects; only the intentionally frozen HTML ID contract remains a source/fixture check.

**E2E Tests:**
- Not used. There is no real-browser automation or complete DOM runtime harness.
- Manual smoke remains required for create/connect/move/edit/undo/save/open/export, template failure/races, pointer capture loss, multi-document switching, multi-tab conflicts, and actual downloads as documented in `docs/status-gate-fase-3.md` and `docs/entrega-diferida.md`.

## Common Patterns

**Async Testing:**
```typescript
test("lesson templates survive a normalized JSON load round-trip", async () => {
  const loaded = normalize(await loadTemplate("anatomia-completa.json"));
  const roundTrip = normalize(JSON.stringify(loaded.file));
  assert.deepEqual(roundTrip.file, loaded.file);
});
```

**Error Testing:**
```typescript
const failed = await readDiagramFile({
  name: "indisponivel.json",
  text: async () => {
    throw new Error("read failed");
  },
});
assert.equal(failed.ok, false);
assert.match(failed.message ?? "", /diagrama atual foi preservado/);
```

**Security Testing:**
- Use XML-sensitive labels and hostile-looking IDs in `tests/markup.test.ts`.
- Assert generated markup contains escaped entities and no executable `<script>`/`<image>` injection.
- Feed unsafe IDs, non-finite coordinates, oversized collections/text, duplicate IDs, unsupported versions, and dangling edges into `normalize()` in `tests/format.test.ts`.

**Performance/scale Testing:**
- `tests/geometry.test.ts` exercises `diagramBounds()` with 200,000 nodes to ensure a one-pass implementation without spread-based argument limits.
- `tests/gesture-hygiene.test.ts` behaviorally verifies rAF coalescing, cancellation, lifecycle flush/refresh routing, external storage event filtering, and text-entry detection.
- `tests/browser-io.test.ts` verifies the 8,192-pixel side and 32,000,000-pixel total PNG limits before browser allocation.
- It also verifies timeout cleanup for stalled image loading and absent `toBlob()` callbacks, including one-time URL revocation and ignored late completion.

**Golden Testing:**
- Compare `buildExportSvg()` exactly with `tests/fixtures/golden/diagram-export.svg`.
- Keep overlays out of both `documentMarkup()` and exported SVG.
- Update the golden only after intentional reviewed rendering changes.

**Release Verification:**
- Current `npm test` (120/120), `npm run check`, clean build, and `npm run check:freshness` pass; final certification reports no medium-or-higher defect.
- Current `npm run check:freshness` passes: all ten generated browser modules match the final TypeScript. The repository still has no CI to enforce this local gate.
- The repository has no automated CI.
- Future release verification must also run the clean `npm run build`; local freshness checking exists, while CI/deploy automation remains deferred.

---

*Testing analysis: 2026-08-22*
