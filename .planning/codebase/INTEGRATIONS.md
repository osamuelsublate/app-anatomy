<!-- generated-by: gsd-doc-writer -->
# External Integrations

**Analysis Date:** 2026-08-22

## APIs & External Services

**Application runtime:**
- No third-party APIs, SDKs, remote fonts, analytics, payment services, authentication services, or backend endpoints are integrated.
- Template loading uses native `fetch()` in `src/model.ts` against same-origin JSON paths under `public/templates/`.
- File import uses browser `File` APIs in `src/main.ts`; export and lifecycle capabilities are isolated behind injected adapters in `src/browser-io.ts`. Blob, object URL, SVG, Canvas and download operations remain local and no upload occurs.

**Static assets:**
- `public/index.html` loads only `public/styles.css` and `public/js/main.js`.
- The favicon is an inline `data:` SVG in `public/index.html`.
- `public/js/*.js` imports only sibling generated modules.

## Data Storage

**Databases:**
- Not applicable. There is no database or server-side storage.

**File Storage:**
- Browser downloads only: normalized v1 JSON, SVG, and PNG are created locally by `src/browser-io.ts`.
- Browser-opened JSON is read through `readDiagramFile()` and routed into `normalize()` in `src/format.ts`.
- Three bundled v1 templates live at `public/templates/anatomia-completa.json`, `public/templates/caminho-de-um-clique.json`, and `public/templates/login-seguro.json`.

**Browser persistence:**
- Native `localStorage` is adapted through `StorageLike` in `src/document-storage.ts`.
- Each diagram is stored independently under `app-anatomy:document:<id>`.
- The v1 registry is stored under `app-anatomy:document-index`; the selected document is stored under `app-anatomy:active-document`.
- Legacy single-document data under `app-anatomy:diagram` is normalized, copied once to `app-anatomy:backup-v0` when required, and migrated to per-document storage.
- If browser storage access throws, `src/model.ts` falls back to an in-memory `Map` for the session and reports a Portuguese status message.
- Direct creation, JSON import, and “new from template” normalize the full document and persist its payload plus active pointer before activating the new store; failed first persistence cleans the reservation and preserves the previous active store.
- Active clean update reloads normalized persisted bytes; active dirty update/deletion preserves local state/history and reports conflict.
- Active clean deletion retires its cache/summary, then reloads a clean cached fallback from current bytes, reuses a dirty cached fallback with history, or creates a replacement. Failed replacement reservation/persistence leaves a ready dirty in-memory document for later claim-rechecked flush.
- Inactive clean update refreshes a cached store and summary; inactive clean deletion retires cache, claim, and summary without changing active state.
- Inactive dirty update/deletion preserves the cached local state/history and reports conflict without switching documents. Uncached inactive update/deletion adds/updates or removes only the registry summary, keeping the active document unchanged.

**Caching:**
- No application cache, service worker, Cache API integration, or external cache exists.
- Future HTTP caching guidance, without a service worker, is documented in `docs/entrega-diferida.md`.

## Authentication & Identity

**Auth Provider:**
- None. The app has no accounts, sessions, authorization model, cookies, or server identity.
- Document IDs are local random base-36 strings generated in `src/main.ts`; they are storage identifiers, not security credentials.
- Reservation uses a `localStorage` read followed by a write. Separate tabs can race between those operations, so an extreme same-ID collision remains a low residual TOCTOU risk despite in-session collision checks, reservation markers, and claim rechecks before recovery flushes.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- No runtime logging framework and no application `console.*` calls are present in `src/`.
- User-visible failures are reported through the live `#saveStatus` region and safe fallback messages wired by `src/browser-io.ts`, `src/main.ts`, and `src/model.ts`.
- Low residual: browser lifecycle maps any `"missing"` event to removal/error text, so an inactive deletion can read as though it affected the active document even though model state and active selection remain correct.

## CI/CD & Deployment

**Hosting:**
- Not configured. The intended artifact is the complete `public/` directory on static HTTPS hosting.
- Hosting, CSP, cache, rollback, and release requirements are deferred in `docs/entrega-diferida.md`.

**CI Pipeline:**
- None. No `.github/` workflows or other provider pipeline files exist.
- The future gate sequence is documented, not automated: `npm ci`, `npm test`, `npm run check`, `npm run build`, then `npm run check:freshness`.
- Git is initialized on branch `master` with no commits and no remotes.

## Environment Configuration

**Required env vars:**
- None detected.

**Secrets location:**
- Not applicable. No secret-management mechanism is present because the static app uses no privileged external service.
- Future deployment credentials remain intentionally undefined in `docs/entrega-diferida.md`.

## Webhooks & Callbacks

**Incoming:**
- None. There is no HTTP application server, callback route, URL payload importer, or service worker.

**Outgoing:**
- None. Runtime network requests are limited to same-origin template fetches from `public/templates/`.

## Browser Security Boundary

**Untrusted input:**
- All JSON ingestion and public document creation flow through `normalize()` in `src/format.ts`, including templates, file imports, stored documents, direct `createDocument()` input, and legacy migration.
- IDs, coordinates, collection sizes, and text lengths are bounded in `src/format.ts`.
- Dynamic SVG/HTML values are escaped by `escapeXml()` in `src/markup.ts`.
- Exported SVG contains document markup only; selection and connection overlays remain in the separate overlay layer.
- PNG export is rejected before canvas allocation when the 2× raster exceeds 8,192 pixels on either side or 32,000,000 pixels total. Browser allocation, image, context, encoding, object-URL, cleanup and click failures return explicit user-facing results.
- Image loading and `toBlob()` share a bounded 10-second default timeout. Completion cancels the timer and clears handlers; timeout revokes the source URL exactly once and ignores late callbacks.

**Deferred integrations:**
- Phase 3 remains gated in `docs/status-gate-fase-3.md`: self-contained SVG metadata, embedded/font fallback decisions, shareable `#d=` URLs, PWA/offline support, and incident-edge O(1) drag are not implemented.

---

*Integration audit: 2026-08-22*
