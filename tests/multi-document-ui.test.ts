import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  bindBrowserExports,
  createBrowserLiveStatus,
  type BrowserIo,
  type ExportResult,
} from "../src/browser-io.js";
import {
  documentKey,
  persistDocument,
  setActiveDocument,
  type StorageLike,
} from "../src/document-storage.js";
import { readDiagramFile } from "../src/format.js";
import { createApplicationModel } from "../src/model.js";
import type { DiagramFile } from "../src/types.js";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function file(title: string, nodeId: string): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title },
    nodes: [{ id: nodeId, def: "api", x: 10, y: 20, label: title }],
    edges: [],
  };
}

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

test("keeps only the frozen HTML ID contract", async () => {
  const contract = JSON.parse(
    await source("tests/fixtures/contracts/multi-document-ui.ids.json"),
  ) as Record<string, string>;
  const html = await source("public/index.html");

  for (const id of Object.values(contract)) {
    assert.equal(html.includes(`id="${id}"`), true);
  }
});

test("minimal chrome keeps actions reachable, local, and accessible", async () => {
  const html = await source("public/index.html");
  const topbar = html.match(/<header id="topbar"[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? "";
  const restingTopbar = topbar.replace(/<div id="fileMenu"[\s\S]*?<\/div>/, "");
  const actionIds = [...restingTopbar.matchAll(/<button id="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(actionIds, ["btnFileMenu", "btnTheme", "btnUndo", "btnRedo", "btnPresent"]);
  assert.match(html, /id="saveStatus" role="status" aria-live="polite"/);
  assert.match(html, /id="btnFileMenu"[\s\S]*aria-expanded="false"/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(topbar), "chrome must not contain emoji");
  assert.ok(!html.includes("http://") && !html.includes("https://"), "UI assets must be local");

  const notice = await source("public/icons/THIRD_PARTY_NOTICES.md");
  assert.match(notice, /Lucide/);
  assert.match(notice, /ISC/);
});

test("theme and presentation controls are enabled with reduced-motion and UI-only contracts", async () => {
  const html = await source("public/index.html");
  const css = await source("public/styles.css");
  const main = await source("src/main.ts");

  assert.match(html, /id="btnTheme"/);
  assert.match(html, /id="btnPresent"[^>]*>/);
  assert.ok(!/id="btnPresent"[^>]*disabled/.test(html));
  assert.match(css, /body\.presentation-mode #topbar/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /transition-duration: \.01ms !important/);
  assert.match(main, /THEME_STORAGE_KEY/);
  assert.match(main, /presentationDiagram/);
  assert.match(main, /session\.returnFocus\?\.focus\(\)/);
});

test("canvas node focus is captured to expose the selected node ports", async () => {
  const main = await source("src/main.ts");

  assert.match(main, /canvas\.addEventListener\("focus",[\s\S]*focusedNodeId\(event\.target\)[\s\S]*,\s*true\);/);
});

test("regression: JSON import never overwrites the active document storage bytes", async () => {
  const storage = new MemoryStorage();
  const ids = ["migration", "current", "imported"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "current-node"));
  const currentId = app.currentDocumentId!;
  const currentBytesBefore = storage.getItem(documentKey(currentId));
  const imported = await readDiagramFile({
    name: "lesson.json",
    async text() { return JSON.stringify(file("Imported", "imported-node")); },
  });

  assert.equal(imported.ok, true);
  app.createDocument(imported.file);
  const importedId = app.currentDocumentId!;
  app.setTitle("Imported edited");
  assert.equal(app.flush(), true);

  assert.notEqual(importedId, currentId);
  assert.equal(app.file.meta.title, "Imported edited");
  assert.equal(storage.getItem(documentKey(currentId)), currentBytesBefore);
  assert.notEqual(storage.getItem(documentKey(importedId)), currentBytesBefore);
  assert.equal(app.switchDocument(currentId), true);
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["current-node"]);
  assert.equal(app.switchDocument(importedId), true);
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["imported-node"]);
  assert.equal(JSON.parse(storage.getItem(documentKey(currentId))!).nodes[0].id, "current-node");
  assert.equal(JSON.parse(storage.getItem(documentKey(importedId))!).nodes[0].id, "imported-node");
});

test("a delayed template insertion updates its origin after the user switches away", async () => {
  const storage = new MemoryStorage();
  const ids = ["migration", "first", "second", "inserted"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("First", "first-node"));
  const firstId = app.currentDocumentId!;
  app.createDocument(file("Second", "second-node"));
  const secondId = app.currentDocumentId!;
  app.switchDocument(firstId);

  let resolveRequest!: (response: { ok: boolean; text(): Promise<string> }) => void;
  const request = new Promise<{ ok: boolean; text(): Promise<string> }>((resolve) => {
    resolveRequest = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => request) as unknown as typeof fetch;
  try {
    const applying = app.applyTemplate("login-seguro", true);
    app.switchDocument(secondId);
    resolveRequest({
      ok: true,
      async text() { return JSON.stringify(file("Template", "template-node")); },
    });

    assert.equal(await applying, true);
    assert.equal(app.currentDocumentId, secondId);
    assert.deepEqual(app.file.nodes.map(({ id }) => id), ["second-node"]);
    app.switchDocument(firstId);
    assert.deepEqual(app.file.nodes.map(({ label }) => label), ["First", "Template"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("two application instances expose conflicts and reload clean external changes", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "shared", file("Original", "shared-node"));
  setActiveDocument(storage, "shared");
  const conflicts: string[] = [];
  const warnings: string[] = [];
  const appA = createApplicationModel(storage, () => "a-unused", {
    onExternalConflict(id) { conflicts.push(id); },
    onStorageWarning(issue) { warnings.push(...issue.warnings); },
  });
  const appB = createApplicationModel(storage, () => "b-unused");
  appA.initialize();
  appB.initialize();

  appA.setTitle("Local draft");
  appB.setTitle("External one");
  assert.equal(appB.flush(), true);

  assert.equal(appA.handleExternalStorageChange("shared"), "conflict");
  assert.equal(appA.file.meta.title, "Local draft");
  assert.deepEqual(conflicts, ["shared"]);
  assert.equal(warnings.includes("external update conflicts with local edits"), true);

  assert.equal(appA.flush(), true);
  appB.setTitle("External two");
  assert.equal(appB.flush(), true);
  assert.equal(appA.handleExternalStorageChange("shared"), "reloaded");
  assert.equal(appA.file.meta.title, "External two");

  storage.removeItem(documentKey("shared"));
  assert.equal(appA.handleExternalStorageChange("shared"), "missing");
});

class FakeControl {
  listener: (() => void) | null = null;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "click" && typeof listener === "function") {
      this.listener = () => listener(new Event("click"));
    }
  }
  click(): void { this.listener?.(); }
}

test("export controls route current state and report explicit success and failure results", async () => {
  const png = new FakeControl();
  const svg = new FakeControl();
  const json = new FakeControl();
  const calls: string[] = [];
  const reports: ExportResult[] = [];
  const failure: ExportResult = {
    ok: false,
    code: "png-encoding-failed",
    message: "PNG failed",
  };
  const io: BrowserIo = {
    async exportPng(diagram) {
      calls.push(`png:${diagram.nodes[0]?.label}`);
      return failure;
    },
    downloadSvg(diagram) {
      calls.push(`svg:${diagram.nodes[0]?.label}`);
      return { ok: true, message: "SVG ok" };
    },
    downloadJson(document) {
      calls.push(`json:${document.meta.title}`);
      return { ok: true, message: "JSON ok" };
    },
  };
  const current = file("Current", "node");

  bindBrowserExports(
    {
      png: png as unknown as HTMLElement,
      svg: svg as unknown as HTMLElement,
      json: json as unknown as HTMLElement,
    },
    { diagram: () => current, file: () => current },
    (result) => reports.push(result),
    io,
  );
  png.click();
  svg.click();
  json.click();
  await Promise.resolve();

  assert.deepEqual(calls, ["png:Current", "svg:Current", "json:Current"]);
  assert.deepEqual(reports, [
    { ok: true, message: "SVG ok" },
    { ok: true, message: "JSON ok" },
    failure,
  ]);
});

test("live status prioritizes an external conflict over a routine model message", () => {
  const classes = new Set<string>();
  const element = {
    textContent: "",
    classList: {
      toggle(name: string, active: boolean) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  const status = createBrowserLiveStatus(element as unknown as HTMLElement);

  status.reportStorage({
    source: "external",
    warnings: ["external update conflicts with local edits"],
    errors: [],
  });
  status.reportModel("Salvando…");

  assert.equal(element.textContent, "Conflito com outra aba: suas alterações locais foram preservadas.");
  assert.equal(classes.has("error"), true);
});
