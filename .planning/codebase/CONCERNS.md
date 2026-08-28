<!-- generated-by: gsd-doc-writer -->
# Codebase Concerns

**Analysis Date:** 2026-08-22

## Tech Debt

**Local gates are not enforced by CI:**
- Issue: Clean compilation and generated-byte parity are available through `npm test`, `npm run build`, and `npm run check:freshness`, but no pipeline runs them automatically.
- Files: `package.json`, `docs/entrega-diferida.md`
- Impact: Contributors can still omit a local gate before review or publication.
- Fix approach: Keep using the local gate sequence; automate it only after the deferred remote/provider/CI decision.

**Cross-tab conflict resolution is intentionally manual:**
- Issue: Dirty active or inactive caches preserve local state/history and report conflicts, but provide no merge, compare, or explicit “reload theirs” action. Clean caches refresh/retire and uncached registry entries synchronize automatically.
- Files: `src/model.ts`, `src/browser-io.ts`, `tests/multi-document-ui.test.ts`
- Impact: Two tabs editing the same document avoid silent data loss, but the user must decide how to preserve/export one version.
- Fix approach: Keep the visible conflict and no-last-write-wins contract; add a resolution UI only after a concrete multi-tab workflow requires it.

**Compiler is a dated development preview:**
- Issue: The sole dev dependency is `@typescript/native-preview` `7.0.0-dev.20260707.2`.
- Files: `package.json`, `package-lock.json`
- Impact: Preview compiler behavior/tool availability may shift, and contributors must use a compatible Node/npm platform.
- Fix approach: Keep the lockfile authoritative, verify upgrades with check/build/all tests, and move to a stable compiler when the project deliberately chooses one.

## Known Bugs

No confirmed source/generated divergence or medium-or-higher implementation defect remains in the final local certification. All ten generated modules are fresh; residual browser, visual, accessibility, concurrency, and delivery risks are listed below.

**Local serve command may collide on fixed port 8137:**
- Symptoms: `npm run serve` exits with `OSError: [Errno 98] Address already in use` when the port is occupied.
- Files: `package.json`
- Trigger: Run another process on port 8137, then execute `npm run serve`.
- Workaround: Stop the conflicting process or invoke another static server/port manually.

## Security Considerations

**Dynamic markup uses `innerHTML`:**
- Risk: Any new unescaped field introduced into palette, node, edge, or overlay markup can create DOM/SVG injection.
- Files: `src/markup.ts`, `src/main.ts`
- Current mitigation: `escapeXml()` escapes current dynamic IDs, labels, descriptions, names, and icons; `normalize()` rejects unsafe IDs and bounds text; `tests/markup.test.ts` exercises hostile content.
- Recommendations: Keep all dynamic values behind `escapeXml()`, add a hostile-input test for every new interpolated field, and do not bypass `normalize()` for imported data.

**Browser storage is untrusted and synchronous:**
- Risk: Same-origin scripts/users can alter values, storage can throw for privacy/quota reasons, and large writes block the UI thread.
- Files: `src/document-storage.ts`, `src/model.ts`, `src/format.ts`
- Current mitigation: Every read passes through `normalize()`, payload sizes/counts are bounded, saves are debounced, and storage exceptions retain session data with visible status.
- Recommendations: Preserve the `StorageLike` boundary and normalized reads. Do not treat local document IDs or storage contents as authenticated.

**Deployment headers are not enforceable in the repository:**
- Risk: Static hosting without CSP, HTTPS, MIME correctness, and anti-framing headers weakens browser protections or breaks modules.
- Files: `docs/entrega-diferida.md`, `public/index.html`
- Current mitigation: A proposed CSP and host contract are documented.
- Recommendations: Validate CSP in report-only mode and configure headers at the selected host before production release.

**Random document IDs are not cryptographic:**
- Risk: `Math.random()` IDs are unsuitable for secrets, authorization, or globally shared identifiers.
- Files: `src/main.ts`, `src/document-storage.ts`
- Current mitigation: IDs are local storage keys only and are validated against a safe character/length pattern.
- Recommendations: Keep IDs non-security-sensitive; use `crypto.randomUUID()` or a server identity model if future sharing introduces identity/security requirements.

**Document reservation has a cross-tab TOCTOU window:**
- Risk: `reserveDocumentId()` checks `localStorage` and then writes a reservation in separate operations; two tabs generating the same ID can both observe absence before either write.
- Files: `src/document-storage.ts`, `src/model.ts`, `src/main.ts`
- Current mitigation: Safe ID validation, retries, in-session registry/store collision checks, and reservation markers prevent ordinary overwrite paths, but cannot make Web Storage compare-and-set atomic.
- Recommendations: Treat IDs as local non-security identifiers. If real concurrent editing/sharing requires collision-proof allocation, move reservation to a transactional store such as IndexedDB or introduce a coordinating authority.
- Residual severity: Low; IDs are random local identifiers, recovery flushes recheck claims, and no authorization/security decision depends on them.

## Performance Bottlenecks

**Full SVG string regeneration during transient movement:**
- Problem: Every model change calls `render()`, rebuilding all document and overlay markup with `innerHTML`.
- Files: `src/main.ts`, `src/markup.ts`, `src/model.ts`
- Cause: The architecture separates pure rendering but does not patch only the dragged node and incident edges.
- Improvement path: Retain rAF coalescing, gesture-rect caching, and the node index. Activate Phase 3.5 only after reproducible hardware/browser measurements satisfy `docs/status-gate-fase-3.md`.

**Registry recovery can rescan and renormalize stored documents:**
- Problem: Normal operations use the stored index, but a missing/corrupt index triggers a full namespaced localStorage scan.
- Files: `src/document-storage.ts`
- Cause: Removing the index is the transaction recovery marker for partial save/delete writes.
- Improvement path: Keep indexed incremental operations and the recovery scan. Profile corrupt-index recovery before changing consistency semantics.

**Snapshot history serializes whole documents:**
- Problem: Each committed edit stores a full JSON snapshot; undo and redo deserialize complete documents.
- Files: `src/model.ts`
- Cause: Simple bounded snapshot history (`MODEL_HISTORY_LIMIT = 100`) favors correctness over delta complexity.
- Improvement path: Retain until real diagrams near `FORMAT_LIMITS` demonstrate memory or latency issues; then measure command/delta history against current semantics.

## Fragile Areas

**Normalization and compatibility boundary:**
- Files: `src/format.ts`, `src/types.ts`, `src/catalog.ts`, `tests/format.test.ts`, `tests/fixtures/legacy/v0-representative.json`
- Why fragile: Version handling, salvage rules, aliases, ID remapping, and limits jointly define persistence/import compatibility.
- Safe modification: Add fixtures and migration tests first; preserve unknown definitions; never replace a current document on failed input.
- Test coverage: Strong automated unit coverage, but no fuzz/property testing.

**Multi-document storage consistency:**
- Files: `src/document-storage.ts`, `src/model.ts`, `tests/document-storage.test.ts`, `tests/model.test.ts`
- Why fragile: Payload, registry, and active ID are separate synchronous writes; quota failure can occur between them.
- Safe modification: Keep individual documents independently readable, reconstruct registry from namespaced keys, and retain in-memory session state on failure.
- Test coverage: Covers coexistence, partial writes, index rebuild, transactional switching, active/inactive clean/dirty cached events, uncached registry events, replacement recovery, and quota retry; not every browser-specific localStorage ordering is reproducible in Node.

**Document/overlay rendering contract:**
- Files: `src/markup.ts`, `src/main.ts`, `tests/markup.test.ts`, `tests/fixtures/golden/diagram-export.svg`
- Why fragile: A small layer mix-up can leak selection/connection preview into exports or alter the visual golden.
- Safe modification: Generate document and overlay independently, retain two SVG groups, and compare exact export output.
- Test coverage: Strong string/golden coverage; no cross-browser visual screenshot coverage.

**Source-generated artifact pairing:**
- Files: `src/*.ts`, `public/js/*.js`, `tsconfig.json`, `docs/entrega-diferida.md`
- Why fragile: Production serves generated JavaScript, while tests compile current TypeScript separately.
- Safe modification: Build after all source changes and run `npm run check:freshness`; source and generated counterparts must be reviewed together.
- Test coverage: The local byte-for-byte freshness script currently passes for all ten modules, but no CI invokes or enforces it.

**Browser behavior boundary:**
- Files: `tests/write-pipeline.test.ts`, `tests/gesture-hygiene.test.ts`, `tests/multi-document-ui.test.ts`
- Why fragile: The contracts now test exported commands, adapters, status, lifecycle effects and storage interactions, but they still run in Node with lightweight fakes.
- Safe modification: Keep browser capabilities injectable and preserve the small frozen HTML ID fixture.
- Test coverage: Strong behavioral adapter coverage; no actual browser DOM/layout/download implementation is executed.

## Scaling Limits

**Normalized document size:**
- Current capacity: Up to 2,000,000 input characters, 1,000 nodes, 5,000 edges, 500 characters per label, and coordinates within ±1,000,000.
- Limit: Ingestion truncates/discards over-limit external content with warnings; model mutation rejects excess collections, clamps coordinates, truncates text, validates IDs, and reports the adjustment so editor-produced state round-trips without silent loss.
- Scaling path: Change limits only with browser memory/render/storage measurements and compatibility tests in `tests/format.test.ts`.

**Browser localStorage:**
- Current capacity: Browser-dependent quota, generally shared per origin; no quota estimate is queried.
- Limit: Saves throw when quota/storage policy blocks writes; multiple large documents increase pressure.
- Scaling path: Keep session fallback for resilience. Adopt IndexedDB/export guidance only if real multi-document usage exceeds localStorage capacity.

**History:**
- Current capacity: 100 undo snapshots and 100 redo snapshots maximum.
- Limit: Large near-limit documents multiply memory and JSON serialization cost.
- Scaling path: Measure before replacing snapshots with command/delta history.

**Rendering:**
- Current capacity: Bounded to at most 1,000 normalized nodes and 5,000 edges, but full markup regeneration cost grows with the entire document.
- Limit: No measured classroom-device threshold exists.
- Scaling path: Use the explicit Phase 3.5 trigger and acceptance criteria in `docs/status-gate-fase-3.md`.

**PNG rasterization:**
- Current capacity: 2× raster, at most 8,192 pixels per side and 32,000,000 pixels total.
- Limit: Larger diagrams return `raster-too-large` before canvas allocation and direct the user to SVG.
- Timeout: Stalled image loading or `toBlob()` is bounded to 10 seconds by default, with timer/handler cleanup, one-time source URL revocation, and late callback suppression.
- Scaling path: Do not raise limits without browser/device memory measurements; SVG remains the fallback for large diagrams.

## Dependencies at Risk

**`@typescript/native-preview`:**
- Risk: Preview-only compiler, platform-specific optional binaries, and one pinned dated build.
- Impact: Install/build/check/test can fail on unsupported environments or after careless lockfile changes.
- Migration plan: Evaluate a stable TypeScript compiler or a newer validated native-preview build, preserving NodeNext output and zero runtime dependencies.

**System emoji/fonts:**
- Risk: SVG text appearance differs across operating systems, especially Linux/Android and multi-codepoint emoji.
- Impact: Exported diagrams may not render identically despite deterministic SVG paths.
- Migration plan: Phase 3.2 remains gated behind SVG circulation evidence and platform comparison in `docs/status-gate-fase-3.md`; PNG remains the safer circulation format.

## Missing Critical Features

**Automated CI and static deployment:**
- Problem: No clean-checkout gate, remote, hosting provider, protected branch, or deploy/rollback automation exists.
- Blocks: Reproducible release enforcement and production publication.
- Files: `docs/entrega-diferida.md`, `package.json`

**Recorded full manual smoke:**
- Problem: The 120 automated tests across 12 files exercise pure and injected behavior but do not execute real browser create/connect/move/edit/undo/save/open/export flows.
- Blocks: Formal completion of the Phase 2 gate.
- Files: `docs/status-gate-fase-3.md`, `docs/entrega-diferida.md`
- Residual severity: Low for the implemented contracts; smoke remains required because browser APIs, layout, focus, downloads, and rendering are not executed by Node.

**Phase 3 features are intentionally absent:**
- Problem: Self-contained SVG metadata/reimport, portable fonts, shareable `#d=` URLs, PWA/offline behavior, and incident-edge O(1) drag are not implemented.
- Blocks: Their respective future user workflows, but none is currently authorized without evidence.
- Files: `docs/status-gate-fase-3.md`

**Full accessibility and design pass is deferred:**
- Problem: Keyboard/focus protections cover current text-entry controls, but complete assistive-technology validation, responsive design refinement, pedagogical shortcuts, deterministic fonts/emoji, and illustrated empty states are not implemented.
- Blocks: Claims of complete accessibility, portable visual identity, or final product design.
- Files: `docs/plano-design.md`, `docs/status-gate-fase-3.md`

## Test Coverage Gaps

**Real browser interactions:**
- What's not tested: Native pointer capture and `lostpointercapture`, drag/drop data transfer, wheel zoom, focus/blur order, actual download prompts, Canvas rendering/encoding, and browser `localStorage` event timing. Adapters and routing are tested, not browser implementations.
- Files: `src/main.ts`, `public/index.html`, `public/styles.css`
- Risk: Browser-specific regressions can pass the Node suite.
- Priority: Low residual implementation risk, but mandatory manual release evidence; consider browser automation after delivery infrastructure exists.

**Generated artifact parity enforcement:**
- What's not tested: No CI or protected branch guarantees that `npm run check:freshness` ran, although the current local comparison passes for all ten modules.
- Files: `src/`, `public/js/`, `tsconfig.json`
- Risk: A future source-only change can still be reviewed or published without its generated counterpart.
- Priority: High before release; keep the local freshness gate mandatory.

**Browser-specific persistence failures:**
- What's not tested: Every engine/quota/privacy-mode ordering around synchronous localStorage writes and cross-tab delivery.
- Files: `src/document-storage.ts`, `src/model.ts`
- Risk: Recovery logic proven with injected failures may still surface different timing or quota behavior in real browsers.
- Priority: Low residual implementation risk; complete multi-tab/quota manual smoke.

**Inactive deletion status wording:**
- What's imperfect: `bindBrowserLifecycle()` shows removal/unreadable text for any `"missing"` result, including deletion of an inactive document.
- State impact: None observed; cache/registry retirement is correct and the active document remains unchanged.
- Priority: Low residual UX risk; clarify the message if real users interpret it as active-document loss.

**Cross-browser visual output:**
- What's not tested: Emoji/font metrics and PNG/SVG rendering across Chromium, Firefox, Safari, Linux, Android, and high-DPI displays.
- Files: `src/markup.ts`, `src/browser-io.ts`, `src/main.ts`, `public/styles.css`
- Risk: Layout/export appearance differs while string golden remains green.
- Priority: Low residual implementation risk; cross-platform evidence is still required before claiming deterministic output.

**Accessibility and keyboard interaction:**
- What's not tested: Focus order, screen-reader behavior, keyboard-only editing, responsive toolbar controls, and announcements beyond static attribute contracts.
- Files: `public/index.html`, `public/styles.css`, `src/main.ts`
- Risk: Controls can regress for keyboard/assistive-technology users unnoticed.
- Priority: Low residual implementation risk; accessibility remains explicitly incomplete until manual assistive-technology validation.

---

*Concerns audit: 2026-08-22*
