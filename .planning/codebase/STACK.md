<!-- generated-by: gsd-doc-writer -->
# Technology Stack

**Analysis Date:** 2026-08-22

## Languages

**Primary:**
- TypeScript (ES2022 target) - application source in `src/*.ts` and tests in `tests/*.test.ts`.
- JavaScript ES modules - generated browser runtime in `public/js/*.js` and generated Node test output in `.test-dist/`.

**Secondary:**
- HTML5 - single static entry document at `public/index.html`.
- CSS - application styling and responsive layout at `public/styles.css`.
- JSON - v1 diagram templates in `public/templates/*.json`, fixtures in `tests/fixtures/`, and package/compiler configuration.
- Markdown - architecture plans and delivery gates in `docs/`.

## Runtime

**Environment:**
- Browser with native DOM, SVG, Canvas, File, Blob, Fetch, `localStorage`, and ES module support; runtime entry is `public/index.html`.
- Node.js `>=18.0.0` is the declared development runtime in `package.json`; the local suite uses built-in `node:test`.
- Python 3 is used only by the local static-server script in `package.json`; local version is `3.10.12`.

**Package Manager:**
- npm; local verification used `11.11.0`.
- Lockfile: present at `package-lock.json`, lockfile version 3.

## Frameworks

**Core:**
- No runtime framework and no runtime package dependencies. The shipped app is native browser APIs plus generated ES modules under `public/js/`.

**Testing:**
- Node built-in `node:test` runner and `node:assert/strict`; declarations needed by the native-preview compiler are in `tests/node.d.ts`.
- Current suite: 120 tests across 12 `tests/*.test.ts` files. `npm test` passes all 120 in the current tree.

**Build/Dev:**
- `@typescript/native-preview` `7.0.0-dev.20260707.2` supplies `tsgo`.
- `npm run build` compiles `src/` to generated, source-map-free modules in `public/js/`.
- `npm run check` performs strict no-emit checking with `tsconfig.json`.
- `npm run clean:test` and `npm run clean:build` remove complete output directories before compilation.
- `npm run check:freshness` emits into temporary `.freshness-dist/`, compares all generated module names and bytes with `public/js/`, then removes the temporary directory.
- The current freshness check passes: all ten generated browser modules match the authoritative TypeScript byte-for-byte. No CI currently enforces this local gate.
- `npm run serve` serves `public/` at port 8137 via `python3 -m http.server`.
- No bundler, transpilation framework, linter, formatter, or CSS preprocessor is configured.

## Key Dependencies

**Critical:**
- Browser platform APIs - runtime behavior is split among `src/main.ts`, `src/browser-io.ts`, `src/model.ts`, and `src/markup.ts`.
- `@typescript/native-preview` - sole development dependency and compiler/test emitter.

**Infrastructure:**
- None at runtime. `package.json` has no `dependencies` section.
- Static JSON templates are fetched from same-origin paths listed in `src/model.ts`.

## Configuration

**Environment:**
- No environment-variable files or runtime environment-variable reads are detected.
- No credentials, API keys, backend URLs, or provider configuration are required.
- Browser persistence uses namespaced keys declared in `src/document-storage.ts`.

**Build:**
- `tsconfig.json`: ES2022, NodeNext modules/resolution, DOM libraries, strict mode, unused-local checking, fallthrough checking, `src/` to `public/js/`.
- `tsconfig.test.json`: extends production config, compiles `src/**/*.ts` and `tests/**/*.ts` into ignored `.test-dist/`.
- `.gitignore`: excludes dependencies, test outputs, caches, logs, and editor artifacts; it does not exclude `public/js/`.

## Platform Requirements

**Development:**
- Node.js `>=18.0.0` and npm with lockfile-v3 support.
- Python 3 only for the provided local server; any static server can serve `public/`.
- Keep all ten generated `public/js/*.js` modules synchronized with `src/*.ts`; do not edit generated files manually. Use `npm run build` followed by `npm run check:freshness` to restore and verify parity locally.

**Production:**
- Static HTTPS hosting of the contents of `public/` at the site root.
- Correct MIME types for ES modules, CSS, JSON, SVG, and PNG flows.
- Relative paths must remain valid for `styles.css`, `js/*.js`, and `templates/*.json`.
- No SPA fallback, server runtime, database, build-on-host, service worker, CI pipeline, or deployment target is currently configured; the deferred contract is in `docs/entrega-diferida.md`.

---

*Stack analysis: 2026-08-22*
