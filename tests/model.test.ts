import assert from "node:assert/strict";
import test from "node:test";
import { overlayMarkup, type MarkupVisualState } from "../src/markup.js";
import {
  COURSE_REVISION_KEY,
  COURSE_TEMPLATES,
  MODEL_HISTORY_LIMIT,
  createApplicationModel,
  createModel,
  loadDiagramTemplate,
} from "../src/model.js";
import {
  deleteStoredDocument,
  documentKey,
  persistDocument,
  readDocument,
  reserveDocumentId,
  setActiveDocument,
  type StorageLike,
} from "../src/document-storage.js";
import { FORMAT_LIMITS, normalize } from "../src/format.js";
import type { Diagram, DiagramFile } from "../src/types.js";

interface TestUi {
  selectedId: string | null;
  zoom: number;
}

function file(title = "Alpha", nodeId = "a"): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title, catalogVersion: "1" },
    nodes: [{ id: nodeId, def: "api", x: 10, y: 20, label: title }],
    edges: [],
  };
}

function model(persisted: DiagramFile[] = []) {
  let scheduled: (() => void) | null = null;
  const store = createModel<TestUi>(
    { doc: file(), ui: { selectedId: null, zoom: 1 } },
    {
      persistence: {
        persist(doc) {
          persisted.push(doc);
        },
        schedule(callback) {
          scheduled = callback;
          return callback;
        },
        cancel(handle) {
          if (scheduled === handle) scheduled = null;
        },
      },
    },
  );
  return {
    store,
    runScheduled() {
      const callback = scheduled;
      scheduled = null;
      callback?.();
    },
  };
}

test("keeps transient, commit, and ui-only updates distinct", () => {
  const persisted: DiagramFile[] = [];
  const { store, runScheduled } = model(persisted);

  assert.equal(
    store.update((state) => {
      state.ui.zoom = 2;
    }, { mode: "transient" }),
    true,
  );
  assert.deepEqual(store.historyDepth, { undo: 0, redo: 0 });
  runScheduled();
  assert.equal(persisted.length, 0);

  store.update((state) => {
    state.doc.meta.title = "Committed";
  }, { mode: "commit" });
  assert.deepEqual(store.historyDepth, { undo: 1, redo: 0 });
  runScheduled();
  assert.equal(persisted[0]?.meta.title, "Committed");

  store.update((ui) => {
    ui.zoom = 3;
  }, { mode: "ui-only" });
  assert.equal(store.state.ui.zoom, 3);
  assert.equal(store.state.doc.meta.title, "Committed");
  assert.deepEqual(store.historyDepth, { undo: 1, redo: 0 });
  runScheduled();
  assert.equal(persisted.length, 1);
});

test("coalesces drag-style transient moves into one committed snapshot", () => {
  const { store } = model();

  for (const x of [20, 30, 40]) {
    store.update((state) => {
      state.doc.nodes[0]!.x = x;
    }, { mode: "transient" });
  }
  assert.deepEqual(store.historyDepth, { undo: 0, redo: 0 });

  assert.equal(store.update(() => {}, { mode: "commit" }), true);
  assert.deepEqual(store.historyDepth, { undo: 1, redo: 0 });
  assert.equal(store.state.doc.nodes[0]!.x, 40);
  assert.equal(store.undo(), true);
  assert.equal(store.state.doc.nodes[0]!.x, 10);
});

test("detects no-ops without history or persistence", () => {
  const persisted: DiagramFile[] = [];
  const { store, runScheduled } = model(persisted);

  assert.equal(store.update(() => {}, { mode: "commit" }), false);
  assert.equal(
    store.update((state) => {
      state.doc.meta.title = state.doc.meta.title;
    }, { mode: "transient" }),
    false,
  );
  assert.equal(store.update(() => {}, { mode: "ui-only" }), false);
  assert.deepEqual(store.historyDepth, { undo: 0, redo: 0 });
  runScheduled();
  assert.equal(persisted.length, 0);
});

test("invalidates redo only after a real committed document change", () => {
  const { store } = model();
  store.update((state) => {
    state.doc.meta.title = "One";
  }, { mode: "commit" });
  store.update((state) => {
    state.doc.meta.title = "Two";
  }, { mode: "commit" });
  store.undo();
  assert.equal(store.canRedo, true);

  store.update(() => {}, { mode: "commit" });
  assert.equal(store.canRedo, true);

  store.update((state) => {
    state.doc.meta.title = "Branch";
  }, { mode: "commit" });
  assert.equal(store.canRedo, false);
});

test("supports whole-document replacement and snapshot restoration", () => {
  const { store } = model();
  store.update((state) => {
    state.doc = file("Beta", "b");
  }, { mode: "commit" });

  assert.equal(store.nodeById("b")?.label, "Beta");
  assert.equal(store.undo(), true);
  assert.equal(store.state.doc.meta.title, "Alpha");
  assert.equal(store.nodeById("a")?.label, "Alpha");
  assert.equal(store.redo(), true);
  assert.equal(store.state.doc.meta.title, "Beta");
});

test("undo and redo render restored documents with the current UI overlay", () => {
  const overlays: string[] = [];
  const ui: MarkupVisualState = {
    selection: { kind: "node", id: "a" },
    connectFrom: "a",
    connectCursor: { x: 240, y: 140 },
  };
  const store = createModel(
    { doc: file(), ui },
    {
      onChange(state) {
        overlays.push(overlayMarkup(state.doc as unknown as Diagram, state.ui as MarkupVisualState));
      },
    },
  );
  store.update((state) => { state.doc.nodes[0]!.label = "Changed"; }, { mode: "commit" });
  store.undo();
  store.redo();

  assert.equal(overlays.length, 3);
  for (const overlay of overlays) {
    assert.match(overlay, /stroke="#6965DB"/);
    assert.match(overlay, /class="connection-source"/);
    assert.match(overlay, /L 240 140/);
  }
});

test("refreshes the derived node index for document update modes", () => {
  const { store } = model();

  store.update((state) => {
    state.doc.nodes.push({ id: "b", def: "db", x: 1, y: 2, label: "DB" });
  }, { mode: "transient" });
  assert.equal(store.nodeById("b")?.def, "db");

  store.update((state) => {
    state.doc.nodes = state.doc.nodes.filter(({ id }) => id !== "a");
  }, { mode: "commit" });
  assert.equal(store.nodeById("a"), undefined);
});

test("ui-only updates cannot mutate document state, history, or persistence", () => {
  const persisted: DiagramFile[] = [];
  const { store, runScheduled } = model(persisted);
  const before = structuredClone(store.state.doc);

  assert.equal(store.update((ui) => {
    ui.zoom = 2;
    (ui as unknown as { doc: DiagramFile }).doc = file("Injected", "injected");
  }, { mode: "ui-only" }), true);

  assert.deepEqual(store.state.doc, before);
  assert.equal(store.state.ui.zoom, 2);
  assert.deepEqual(store.historyDepth, { undo: 0, redo: 0 });
  assert.equal(store.dirty, false);
  runScheduled();
  assert.deepEqual(persisted, []);
});

test("selection, ports, guides, and presentation remain non-serialized UI state", () => {
  const store = createModel({
    doc: file(),
    ui: {
      selection: null as MarkupVisualState["selection"],
      portsVisible: false,
      guides: [] as number[],
      presentation: { active: false, revealed: 0 },
    },
  });
  const before = JSON.stringify(store.state.doc);

  store.update((ui) => {
    ui.selection = { kind: "node", id: "a" };
    ui.portsVisible = true;
    ui.guides = [10, 20];
    ui.presentation = { active: true, revealed: 1 };
  }, { mode: "ui-only" });

  assert.equal(JSON.stringify(store.state.doc), before);
  for (const forbidden of ["selection", "portsVisible", "guides", "presentation"]) {
    assert.equal(JSON.stringify(store.state.doc).includes(forbidden), false);
  }
});

test("caps undo and redo snapshots at one hundred entries", () => {
  const { store } = model();
  for (let index = 0; index < MODEL_HISTORY_LIMIT + 5; index += 1) {
    store.update((state) => {
      state.doc.meta.title = `Title ${index}`;
    }, { mode: "commit" });
  }
  assert.equal(store.historyDepth.undo, MODEL_HISTORY_LIMIT);

  for (let index = 0; index < MODEL_HISTORY_LIMIT; index += 1) store.undo();
  assert.equal(store.historyDepth.redo, MODEL_HISTORY_LIMIT);
});

test("debounces injected persistence and exposes an immediate flush", () => {
  const persisted: DiagramFile[] = [];
  const { store, runScheduled } = model(persisted);
  store.update((state) => {
    state.doc.meta.title = "One";
  }, { mode: "commit" });
  store.update((state) => {
    state.doc.meta.title = "Two";
  }, { mode: "commit" });

  assert.equal(store.flush(), true);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.meta.title, "Two");
  runScheduled();
  assert.equal(persisted.length, 1);
});

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWriteFor: ((key: string) => boolean) | null = null;
  get length(): number { return this.values.size; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWriteFor?.(key)) throw new Error("quota exceeded");
    this.values.set(key, value);
  }
  removeItem(key: string): void { this.values.delete(key); }
}

test("application model flushes before switching and preserves document metadata", () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `id-${sequence++}`);
  app.initialize();
  const firstId = app.currentDocumentId!;
  app.setTitle("First");
  app.createDocument(file("Second", "second"));
  const secondId = app.currentDocumentId!;
  app.setTitle("Second edited");

  assert.equal(app.switchDocument(firstId), true);
  assert.equal(app.file.meta.title, "First");
  assert.equal(app.switchDocument(secondId), true);
  assert.equal(app.file.meta.title, "Second edited");
  assert.equal(app.documents.find(({ id }) => id === secondId)?.title, "Second edited");
});

test("installs the four course lessons and retires Anatomia 1", async () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `id-${sequence++}`);
  app.initialize(file("Anatomia 1", "old-node"));
  const templates = new Map(COURSE_TEMPLATES.map((template, index) => [
    template.url,
    file(template.label, `aula-${index}-node`),
  ]));

  assert.equal(await app.installCourseDocuments(async (url) => {
    const next = templates.get(url);
    return {
      ok: Boolean(next),
      async text() { return JSON.stringify(next); },
    };
  }), true);
  assert.deepEqual(
    app.documents.map(({ title }) => title),
    COURSE_TEMPLATES.map(({ label }) => label),
  );
  assert.equal(app.file.meta.title, COURSE_TEMPLATES[0]?.label);
  assert.equal(app.documents.some(({ title }) => title === "Anatomia 1"), false);
});

test("replaces existing course lessons only when the course revision advances", async () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `id-${sequence++}`);
  app.initialize();
  const templates = new Map(COURSE_TEMPLATES.map((template, index) => [
    template.url,
    file(template.label, `aula-${index}-node`),
  ]));
  const request = async (url: string) => {
    const next = templates.get(url);
    return {
      ok: Boolean(next),
      async text() { return JSON.stringify(next); },
    };
  };

  assert.equal(await app.installCourseDocuments(request), true);
  const firstId = app.documents.find(({ title }) => title === COURSE_TEMPLATES[0]?.label)?.id;
  assert.ok(firstId);
  assert.equal(app.switchDocument(firstId), true);
  assert.equal(app.file.nodes[0]?.id, "aula-0-node");
  app.setTitle(COURSE_TEMPLATES[0]!.label);
  app.addNode("sql", 40, 40);
  const customizedCount = app.file.nodes.length;
  assert.ok(customizedCount > 1);

  assert.equal(await app.installCourseDocuments(request), true);
  assert.equal(app.switchDocument(firstId), true);
  assert.equal(app.file.nodes.length, customizedCount);

  storage.setItem(COURSE_REVISION_KEY, "1");
  assert.equal(await app.installCourseDocuments(request), true);
  assert.equal(app.switchDocument(firstId), true);
  assert.equal(app.file.nodes.length, 1);
  assert.equal(app.file.nodes[0]?.id, "aula-0-node");
});

test("creates a new document from a normalized template without replacing the current one", () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `id-${sequence++}`);
  app.initialize(file("Current", "current-node"));
  const currentId = app.currentDocumentId!;

  assert.equal(app.createDocumentFromTemplate(file("Lesson", "lesson-node")), true);
  const lessonId = app.currentDocumentId!;

  assert.notEqual(lessonId, currentId);
  assert.equal(app.file.meta.title, "Lesson");
  assert.equal(app.switchDocument(currentId), true);
  assert.equal(app.file.meta.title, "Current");
  assert.equal(app.file.nodes[0]?.id, "current-node");
  assert.equal(app.switchDocument(lessonId), true);
  assert.equal(app.file.nodes[0]?.id, "lesson-node");
});

test("inserts a template with remapped IDs as one undoable commit", () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `generated-${sequence++}`);
  app.initialize(file("Current", "shared"));
  const before = structuredClone(app.file);
  const template: DiagramFile = {
    format: "anatomia",
    version: 1,
    meta: { title: "Insert", catalogVersion: "1" },
    nodes: [
      { id: "shared", def: "api", x: 100, y: 100, label: "One" },
      { id: "other", def: "sql", x: 300, y: 100, label: "Two" },
    ],
    edges: [{ id: "shared", from: "shared", to: "other", label: "reads" }],
  };

  assert.equal(app.insertTemplate(template), true);
  assert.equal(app.file.nodes.length, 3);
  assert.equal(app.file.edges.length, 1);
  const allIds = [...app.file.nodes.map(({ id }) => id), ...app.file.edges.map(({ id }) => id)];
  assert.equal(new Set(allIds).size, allIds.length);
  assert.notEqual(app.file.nodes[1]?.id, "shared");
  assert.notEqual(app.file.nodes[2]?.id, "other");
  assert.notEqual(app.file.edges[0]?.id, "shared");
  assert.ok(app.file.nodes.some(({ id }) => id === app.file.edges[0]?.from));
  assert.ok(app.file.nodes.some(({ id }) => id === app.file.edges[0]?.to));

  app.undo();
  assert.deepEqual(app.file, before);
  app.undo();
  assert.deepEqual(app.file, before);
});

test("template failures preserve the active document and report a safe fallback", async () => {
  const storage = new MemoryStorage();
  const statuses: string[] = [];
  let sequence = 0;
  const app = createApplicationModel(storage, () => `id-${sequence++}`, {
    onStatus(message) { statuses.push(message); },
  });
  app.initialize(file("Current", "current"));
  const before = structuredClone(app.file);
  const currentId = app.currentDocumentId;

  assert.equal(app.createDocumentFromTemplate({ version: 99, nodes: [], edges: [] }), false);
  assert.equal(app.insertTemplate("{not json"), false);
  assert.equal(app.currentDocumentId, currentId);
  assert.deepEqual(app.file, before);

  const failedLoad = await loadDiagramTemplate(
    { id: "missing", label: "Ausente", url: "templates/missing.json" },
    async () => ({ ok: false, async text() { return ""; } }),
  );
  assert.equal(failedLoad.ok, false);
  assert.match(failedLoad.message ?? "", /diagrama atual foi preservado/i);
  assert.ok(statuses.some((message) => message.includes("preservado")));

  const fallbackStatuses: string[] = [];
  const fallback = createApplicationModel(new MemoryStorage(), () => "fallback", {
    onStatus(message) { fallbackStatuses.push(message); },
  });
  fallback.initialize();
  assert.equal(fallback.file.nodes.length, 0);
  assert.match(fallbackStatuses.at(-1) ?? "", /diagrama vazio/i);
});

test("failed flush aborts document creation and keeps the dirty document active", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current", "next"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "current-node"));
  const currentId = app.currentDocumentId!;
  app.setTitle("Unsaved");
  storage.failWriteFor = (key) => key === documentKey(currentId);

  app.createDocument(file("Next", "next-node"));

  assert.equal(app.currentDocumentId, currentId);
  assert.equal(app.file.meta.title, "Unsaved");
  assert.equal(app.documents.length, 1);
});

test("failed initial document write preserves the active store and permits a clean retry", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current", "retry", "retry"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "current-node"));
  const currentId = app.currentDocumentId!;
  let retryWrites = 0;
  storage.failWriteFor = (key) =>
    key === documentKey("retry") && ++retryWrites === 2;

  assert.equal(app.createDocument(file("First attempt", "failed-node")), false);
  assert.equal(app.currentDocumentId, currentId);
  assert.equal(app.file.meta.title, "Current");
  assert.equal(storage.getItem(documentKey("retry")), null);
  assert.equal(app.documents.some(({ id }) => id === "retry"), false);

  storage.failWriteFor = null;
  assert.equal(app.createDocument(file("Retried", "retry-node")), true);
  assert.equal(app.currentDocumentId, "retry");
  assert.equal(app.file.meta.title, "Retried");
  assert.equal(readDocument(storage, "retry")?.nodes[0]?.id, "retry-node");
});

test("failed startup write stays unready and initialization can retry safely", () => {
  const storage = new MemoryStorage();
  const ids = ["probe-one", "startup", "probe-two", "startup"];
  const readiness: boolean[] = [];
  const app = createApplicationModel(storage, () => ids.shift()!, {
    onReady(value) { readiness.push(value); },
  });
  let startupWrites = 0;
  storage.failWriteFor = (key) =>
    key === documentKey("startup") && ++startupWrites === 2;

  app.initialize();
  assert.equal(app.ready, false);
  assert.equal(app.currentDocumentId, null);
  assert.deepEqual(app.documents, []);
  assert.equal(storage.getItem(documentKey("startup")), null);
  assert.deepEqual(readiness, [false]);

  storage.failWriteFor = null;
  app.initialize();
  assert.equal(app.ready, true);
  assert.equal(app.currentDocumentId, "startup");
  assert.ok(readDocument(storage, "startup"));
  assert.deepEqual(readiness, [false, true]);
});

test("all public document creation normalizes malformed content before activation and export", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current", "normalized", "bounded"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "current-node"));
  const malformed = {
    format: "anatomia",
    version: 1,
    meta: { title: "T".repeat(FORMAT_LIMITS.titleCharacters + 20) },
    nodes: [
      {
        id: "safe",
        def: "api",
        x: FORMAT_LIMITS.coordinateMagnitude,
        y: -FORMAT_LIMITS.coordinateMagnitude,
        label: "L".repeat(FORMAT_LIMITS.labelCharacters + 20),
      },
      { id: "outside", def: "api", x: FORMAT_LIMITS.coordinateMagnitude + 1, y: 0, label: "drop" },
      { id: "unsafe id", def: "api", x: 0, y: 0, label: "drop" },
    ],
    edges: [
      { id: "dangling", from: "safe", to: "outside", label: "drop" },
      { id: "unsafe edge", from: "safe", to: "safe", label: "drop" },
    ],
  } as unknown as DiagramFile;

  assert.equal(app.createDocument(malformed), true);
  assert.equal(app.file.meta.title.length, FORMAT_LIMITS.titleCharacters);
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["safe"]);
  assert.equal(app.file.nodes[0]?.label.length, FORMAT_LIMITS.labelCharacters);
  assert.deepEqual(app.file.edges, []);

  const exported = app.exportFile();
  const roundTrip = normalize(JSON.stringify(exported));
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.file, exported);
  const persisted = readDocument(storage, app.currentDocumentId!);
  assert.ok(persisted);
  assert.deepEqual(persisted.nodes, exported.nodes);
  assert.deepEqual(persisted.edges, exported.edges);

  const overCapacity = {
    ...file("Over capacity", "unused"),
    nodes: Array.from({ length: FORMAT_LIMITS.nodes + 1 }, (_, index) => ({
      id: `node-${index}`,
      def: "api",
      x: 0,
      y: 0,
      label: "",
    })),
    edges: Array.from({ length: FORMAT_LIMITS.edges + 1 }, (_, index) => ({
      id: `edge-${index}`,
      from: "node-0",
      to: "node-0",
      label: "",
    })),
  };
  assert.equal(app.createDocument(overCapacity), true);
  assert.equal(app.file.nodes.length, FORMAT_LIMITS.nodes);
  assert.equal(app.file.edges.length, FORMAT_LIMITS.edges);
  const boundedRoundTrip = normalize(JSON.stringify(app.exportFile()));
  assert.equal(boundedRoundTrip.ok, true);
  assert.equal(boundedRoundTrip.file.nodes.length, FORMAT_LIMITS.nodes);
  assert.equal(boundedRoundTrip.file.edges.length, FORMAT_LIMITS.edges);
});

test("external deletion retires a clean active store and switches to persisted state", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "first", file("First", "first-node"));
  persistDocument(storage, "second", file("Second", "second-node"));
  setActiveDocument(storage, "first");
  const app = createApplicationModel(storage, () => "replacement");
  app.initialize();

  deleteStoredDocument(storage, "first");
  assert.equal(app.handleExternalStorageChange("first"), "missing");
  assert.equal(app.currentDocumentId, "second");
  assert.equal(app.file.meta.title, "Second");
  assert.equal(app.documents.some(({ id }) => id === "first"), false);

  app.setTitle("Second edited");
  assert.equal(app.flush(), true);
  assert.equal(storage.getItem(documentKey("first")), null);
  assert.equal(readDocument(storage, "second")?.meta.title, "Second edited");
});

test("external deletion reloads a clean cached fallback from current persisted state", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "fallback", file("Old A", "old-node"));
  persistDocument(storage, "deleted", file("Active B", "deleted-node"));
  setActiveDocument(storage, "fallback");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();
  assert.equal(app.file.meta.title, "Old A");
  assert.equal(app.switchDocument("deleted"), true);

  persistDocument(storage, "fallback", file("External A", "external-node"));
  deleteStoredDocument(storage, "deleted");
  assert.equal(app.handleExternalStorageChange("deleted"), "missing");
  assert.equal(app.currentDocumentId, "fallback");
  assert.equal(app.dirty, false);
  assert.equal(app.file.meta.title, "External A");
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["external-node"]);

  app.setTitle("Local edit on External A");
  assert.equal(app.flush(), true);
  const persisted = readDocument(storage, "fallback");
  assert.equal(persisted?.meta.title, "Local edit on External A");
  assert.deepEqual(persisted?.nodes.map(({ id }) => id), ["external-node"]);
});

test("inactive clean external update refreshes cache before switch, edit, and flush", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "inactive", file("Old A", "old-node"));
  persistDocument(storage, "active", file("Active B", "active-node"));
  setActiveDocument(storage, "inactive");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();
  assert.equal(app.switchDocument("active"), true);

  persistDocument(storage, "inactive", file("External A", "external-node"));
  assert.equal(app.handleExternalStorageChange("inactive"), "ignored");
  assert.equal(app.currentDocumentId, "active");
  assert.equal(app.switchDocument("inactive"), true);
  assert.equal(app.file.meta.title, "External A");
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["external-node"]);

  app.setTitle("Local on External A");
  assert.equal(app.flush(), true);
  const persisted = readDocument(storage, "inactive");
  assert.equal(persisted?.meta.title, "Local on External A");
  assert.deepEqual(persisted?.nodes.map(({ id }) => id), ["external-node"]);
});

test("inactive dirty external update and deletion remain recoverable conflicts", async () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "inactive", file("Local base", "local-node"));
  persistDocument(storage, "active", file("Active B", "active-node"));
  setActiveDocument(storage, "inactive");
  const conflicts: string[] = [];
  const app = createApplicationModel(storage, () => "inserted-node", {
    onExternalConflict(id) { conflicts.push(id); },
  });
  app.initialize();

  let resolveRequest!: (response: { ok: boolean; text(): Promise<string> }) => void;
  const request = new Promise<{ ok: boolean; text(): Promise<string> }>((resolve) => {
    resolveRequest = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => request) as unknown as typeof fetch;
  try {
    const applying = app.applyTemplate("login-seguro", true);
    assert.equal(app.switchDocument("active"), true);
    resolveRequest({
      ok: true,
      async text() { return JSON.stringify(file("Template", "template-node")); },
    });
    assert.equal(await applying, true);

    persistDocument(storage, "inactive", file("External update", "external-node"));
    assert.equal(app.handleExternalStorageChange("inactive"), "conflict");
    deleteStoredDocument(storage, "inactive");
    assert.equal(app.handleExternalStorageChange("inactive"), "conflict");
    assert.equal(app.currentDocumentId, "active");
    assert.deepEqual(conflicts, ["inactive", "inactive"]);
    assert.equal(app.documents.some(({ id }) => id === "inactive"), true);

    assert.equal(app.switchDocument("inactive"), true);
    assert.equal(app.dirty, true);
    assert.deepEqual(
      app.file.nodes.map(({ id }) => id),
      ["local-node", "inserted-node"],
    );
    app.undo();
    assert.deepEqual(app.file.nodes.map(({ id }) => id), ["local-node"]);
    assert.equal(app.flush(), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inactive clean external deletion retires cache and registry visibility", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "inactive", file("Inactive A", "inactive-node"));
  persistDocument(storage, "active", file("Active B", "active-node"));
  setActiveDocument(storage, "inactive");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();
  assert.equal(app.switchDocument("active"), true);

  deleteStoredDocument(storage, "inactive");
  assert.equal(app.handleExternalStorageChange("inactive"), "missing");
  assert.equal(app.currentDocumentId, "active");
  assert.equal(app.documents.some(({ id }) => id === "inactive"), false);
  assert.equal(app.switchDocument("inactive"), false);
  assert.equal(app.currentDocumentId, "active");
  assert.equal(app.file.meta.title, "Active B");
});

test("uncached inactive events update and remove registry entries without changing active state", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "active", file("Active B", "active-node"));
  setActiveDocument(storage, "active");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();

  persistDocument(storage, "uncached-update", file("External C", "external-node"));
  assert.equal(app.handleExternalStorageChange("uncached-update"), "ignored");
  assert.equal(app.documents.find(({ id }) => id === "uncached-update")?.title, "External C");
  assert.equal(app.currentDocumentId, "active");

  persistDocument(storage, "uncached-delete", file("External D", "delete-node"));
  assert.equal(app.handleExternalStorageChange("uncached-delete"), "ignored");
  deleteStoredDocument(storage, "uncached-delete");
  assert.equal(app.handleExternalStorageChange("uncached-delete"), "missing");
  assert.equal(app.documents.some(({ id }) => id === "uncached-delete"), false);
  assert.equal(app.currentDocumentId, "active");
  assert.equal(app.file.meta.title, "Active B");
});

test("external deletion reuses a dirty cached fallback with its undo history intact", async () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "fallback", file("Fallback", "fallback-node"));
  persistDocument(storage, "deleted", file("Deleted", "deleted-node"));
  setActiveDocument(storage, "fallback");
  const app = createApplicationModel(storage, () => "inserted-node");
  app.initialize();
  assert.equal(app.switchDocument("deleted"), true);
  assert.equal(app.switchDocument("fallback"), true);

  let resolveRequest!: (response: { ok: boolean; text(): Promise<string> }) => void;
  const request = new Promise<{ ok: boolean; text(): Promise<string> }>((resolve) => {
    resolveRequest = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => request) as unknown as typeof fetch;
  try {
    const applying = app.applyTemplate("login-seguro", true);
    assert.equal(app.switchDocument("deleted"), true);
    resolveRequest({
      ok: true,
      async text() { return JSON.stringify(file("Template", "template-node")); },
    });
    assert.equal(await applying, true);
    assert.equal(app.currentDocumentId, "deleted");
    assert.deepEqual(readDocument(storage, "fallback")?.nodes.map(({ id }) => id), ["fallback-node"]);

    deleteStoredDocument(storage, "deleted");
    assert.equal(app.handleExternalStorageChange("deleted"), "missing");
    assert.equal(app.currentDocumentId, "fallback");
    assert.equal(app.dirty, true);
    assert.deepEqual(
      app.file.nodes.map(({ id }) => id),
      ["fallback-node", "inserted-node"],
    );

    app.undo();
    assert.deepEqual(app.file.nodes.map(({ id }) => id), ["fallback-node"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("external deletion creates a safely persisted replacement when no document remains", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "only", file("Only", "only-node"));
  setActiveDocument(storage, "only");
  const app = createApplicationModel(storage, () => "replacement");
  app.initialize();

  deleteStoredDocument(storage, "only");
  assert.equal(app.handleExternalStorageChange("only"), "missing");
  assert.equal(app.currentDocumentId, "replacement");
  assert.deepEqual(app.file.nodes, []);
  assert.ok(readDocument(storage, "replacement"));
  assert.equal(storage.getItem(documentKey("only")), null);
});

test("failed replacement persistence keeps a ready dirty store for a safe later flush", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "only", file("Only", "only-node"));
  setActiveDocument(storage, "only");
  const app = createApplicationModel(storage, () => "replacement");
  app.initialize();
  deleteStoredDocument(storage, "only");
  let replacementWrites = 0;
  storage.failWriteFor = (key) =>
    key === documentKey("replacement") && ++replacementWrites === 2;

  assert.equal(app.handleExternalStorageChange("only"), "missing");
  assert.equal(app.ready, true);
  assert.equal(app.currentDocumentId, "replacement");
  assert.deepEqual(app.file.nodes, []);
  assert.deepEqual(app.ui, {
    selection: null,
    tool: "select",
    connectFrom: null,
    connectCursor: null,
  });
  assert.equal(app.dirty, true);
  assert.equal(readDocument(storage, "replacement"), null);
  assert.equal(reserveDocumentId(storage, "replacement"), false);

  persistDocument(storage, "unrelated", file("Unrelated", "unrelated-node"));
  storage.failWriteFor = null;
  assert.equal(app.flush(), true);
  assert.equal(app.dirty, false);
  assert.ok(readDocument(storage, "replacement"));
  assert.equal(readDocument(storage, "unrelated")?.meta.title, "Unrelated");
});

test("failed replacement reservation still retains a usable unreserved store", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "only", file("Only", "only-node"));
  setActiveDocument(storage, "only");
  const ids = ["replacement"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize();
  deleteStoredDocument(storage, "only");
  storage.failWriteFor = (key) => key === documentKey("replacement");

  assert.equal(app.handleExternalStorageChange("only"), "missing");
  assert.equal(app.ready, true);
  assert.equal(app.currentDocumentId, "replacement");
  assert.deepEqual(app.file.nodes, []);
  assert.equal(app.dirty, true);

  storage.failWriteFor = null;
  assert.equal(app.flush(), true);
  assert.equal(app.dirty, false);
  assert.ok(readDocument(storage, "replacement"));
});

test("external deletion keeps dirty local state as a recoverable conflict", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "dirty", file("Stored", "node"));
  setActiveDocument(storage, "dirty");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();
  app.setTitle("Local edits");

  deleteStoredDocument(storage, "dirty");
  assert.equal(app.handleExternalStorageChange("dirty"), "conflict");
  assert.equal(app.currentDocumentId, "dirty");
  assert.equal(app.file.meta.title, "Local edits");
  assert.equal(app.dirty, true);
  assert.equal(storage.getItem(documentKey("dirty")), null);
});

test("failed flush aborts document switching and keeps the dirty document active", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "first", file("First", "first-node"));
  persistDocument(storage, "second", file("Second", "second-node"));
  setActiveDocument(storage, "first");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();
  app.setTitle("Unsaved first");
  storage.failWriteFor = (key) => key === documentKey("first");

  assert.equal(app.switchDocument("second"), false);
  assert.equal(app.currentDocumentId, "first");
  assert.equal(app.file.meta.title, "Unsaved first");
});

test("failed flush aborts document deletion and preserves the stored document", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "first", file("First", "first-node"));
  persistDocument(storage, "second", file("Second", "second-node"));
  setActiveDocument(storage, "first");
  const app = createApplicationModel(storage, () => "unused");
  app.initialize();
  app.setTitle("Unsaved first");
  storage.failWriteFor = (key) => key === documentKey("first");

  app.deleteCurrentDocument();

  assert.equal(app.currentDocumentId, "first");
  assert.equal(app.file.meta.title, "Unsaved first");
  assert.ok(storage.getItem(documentKey("first")));
  assert.equal(app.documents.length, 2);
});

test("retries repeated document ID collisions without replacing an existing document", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "same", "same", "unique"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Original", "original-node"));
  const originalId = app.currentDocumentId!;

  app.createDocument(file("New", "new-node"));

  assert.equal(originalId, "same");
  assert.equal(app.currentDocumentId, "unique");
  assert.equal(readDocument(storage, originalId)?.meta.title, "Original");
  assert.equal(readDocument(storage, "unique")?.meta.title, "New");
});

test("post-edit title, label, and coordinates survive a storage round trip", () => {
  const storage = new MemoryStorage();
  const app = createApplicationModel(storage, (() => {
    const ids = ["migration-probe", "current"];
    return () => ids.shift()!;
  })());
  app.initialize(file("Current", "node"));
  const id = app.currentDocumentId!;
  const title = "T".repeat(FORMAT_LIMITS.titleCharacters + 1);
  const label = "L".repeat(FORMAT_LIMITS.labelCharacters + 1);
  const coordinate = FORMAT_LIMITS.coordinateMagnitude + 1;

  app.setTitle(title);
  app.rename({ kind: "node", id: "node" }, label);
  app.moveNode("node", coordinate, -coordinate);
  app.finishTransient();
  assert.equal(app.flush(), true);

  const persisted = readDocument(storage, id);
  assert.ok(persisted);
  assert.equal(persisted.meta.title, app.file.meta.title);
  assert.equal(persisted.nodes[0]?.label, app.file.nodes[0]?.label);
  assert.equal(persisted.nodes[0]?.x, app.file.nodes[0]?.x);
  assert.equal(persisted.nodes[0]?.y, app.file.nodes[0]?.y);
});

test("keeps each document undo history when switching between documents", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "first", "second"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("First", "first-node"));
  const firstId = app.currentDocumentId!;
  app.setTitle("First edited");
  app.createDocument(file("Second", "second-node"));

  assert.equal(app.switchDocument(firstId), true);
  app.undo();

  assert.equal(app.file.meta.title, "First");
});

test("undo preserves the selection that remains valid in the restored document", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "node"));
  app.select({ kind: "node", id: "node" });
  app.rename({ kind: "node", id: "node" }, "Renamed");

  app.undo();

  assert.deepEqual(app.ui.selection, { kind: "node", id: "node" });
  assert.equal(app.file.nodes[0]?.label, "Current");
});

test("connectNode rejects missing endpoints instead of creating a dangling edge", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current", "target", "edge"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "node"));

  app.connectNode("node");
  app.connectNode("missing");

  assert.deepEqual(app.file.edges, []);
  assert.equal(app.ui.connectFrom, null);
});

test("addConnectedNode creates one node and edge in one atomic history entry", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current", "new-node", "new-edge"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "source"));

  const created = app.addConnectedNode("source", "sql", 240, 24);

  assert.equal(created, "new-node");
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["source", "new-node"]);
  assert.deepEqual(app.file.edges, [{ id: "new-edge", from: "source", to: "new-node", label: "" }]);
  assert.deepEqual(app.ui.selection, { kind: "node", id: "new-node" });
  app.undo();
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["source"]);
  assert.deepEqual(app.file.edges, []);
  app.redo();
  assert.deepEqual(app.file.nodes.map(({ id }) => id), ["source", "new-node"]);
  assert.equal(app.file.edges.length, 1);
});

test("connected creation and direct connection reject invalid or duplicate state without partial writes", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current", "target", "edge"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "source"));
  const before = structuredClone(app.file);

  assert.equal(app.addConnectedNode("missing", "api", 0, 0), null);
  assert.deepEqual(app.file, before);
  app.addNode("sql", 240, 0);
  const target = app.file.nodes[1]!.id;
  assert.equal(app.connectNodes("source", target), true);
  const connected = structuredClone(app.file);
  assert.equal(app.connectNodes("source", target), false);
  assert.deepEqual(app.file, connected);
});

test("connections support fixed ports, opposite direction, parallels and self-loops", () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `gen-${sequence++}`);
  app.initialize(file("Current", "source"));
  app.addNode("sql", 240, 0);
  const target = app.file.nodes[1]!.id;

  // A→B flutuante, B→A simultânea e um par com portas fixas convivem.
  assert.equal(app.connectNodes("source", target), true);
  assert.equal(app.connectNodes(target, "source"), true);
  assert.equal(app.connectNodes("source", target, { fromSide: "right", toSide: "left" }), true);
  // Duplicata exata (mesmas portas) é rejeitada.
  assert.equal(app.connectNodes("source", target, { fromSide: "right", toSide: "left" }), false);
  // Auto-loop é permitido e persiste as faces.
  assert.equal(app.connectNodes("source", "source"), true);
  const loop = app.file.edges.find((edge) => edge.from === "source" && edge.to === "source");
  assert.ok(loop);
  const fixed = app.file.edges.find((edge) => edge.fromSide === "right");
  assert.equal(fixed?.toSide, "left");
});

test("edge line style and waypoints persist with undo and round-trip through export", () => {
  const storage = new MemoryStorage();
  let sequence = 0;
  const app = createApplicationModel(storage, () => `gen-${sequence++}`);
  app.initialize(file("Current", "source"));
  app.addNode("sql", 320, 200);
  const target = app.file.nodes[1]!.id;
  assert.equal(app.connectNodes("source", target), true);
  const edgeId = app.file.edges[0]!.id;

  app.setEdgeLine(edgeId, "ortho");
  assert.equal(app.file.edges[0]?.line, "ortho");
  assert.equal(app.insertEdgePoint(edgeId, 0, 100, 50), true);
  app.moveEdgePoint(edgeId, 0, 120, 60);
  app.finishTransient();
  assert.deepEqual(app.file.edges[0]?.points, [{ x: 120, y: 60 }]);

  // Undo desfaz o waypoint (inserção+arrasto viram um passo) e depois o estilo.
  app.undo();
  assert.equal(app.file.edges[0]?.points, undefined);
  app.undo();
  assert.equal(app.file.edges[0]?.line, undefined);
  app.redo();
  app.redo();
  assert.equal(app.file.edges[0]?.line, "ortho");
  assert.deepEqual(app.file.edges[0]?.points, [{ x: 120, y: 60 }]);

  app.removeEdgePoint(edgeId, 0);
  assert.equal(app.file.edges[0]?.points, undefined);
  app.undo();
  assert.deepEqual(app.file.edges[0]?.points, [{ x: 120, y: 60 }]);
  app.clearEdgePoints(edgeId);
  assert.equal(app.file.edges[0]?.points, undefined);

  // Estilo "straight" remove o campo (documentos ficam enxutos e compatíveis).
  app.setEdgeLine(edgeId, "straight");
  assert.equal(app.file.edges[0]?.line, undefined);
});

test("a delayed template insertion applies only to its originating document", async () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "first", "second", "inserted-node"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("First", "first-node"));
  const firstId = app.currentDocumentId!;
  app.createDocument(file("Second", "second-node"));
  const secondId = app.currentDocumentId!;
  assert.equal(app.switchDocument(firstId), true);

  let resolveRequest!: (response: { ok: boolean; text(): Promise<string> }) => void;
  const request = new Promise<{ ok: boolean; text(): Promise<string> }>((resolve) => {
    resolveRequest = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => request) as unknown as typeof fetch;
  try {
    const applying = app.applyTemplate("login-seguro", true);
    assert.equal(app.switchDocument(secondId), true);
    resolveRequest({
      ok: true,
      async text() {
        return JSON.stringify(file("Template", "template-node"));
      },
    });

    assert.equal(await applying, true);
    assert.equal(app.currentDocumentId, secondId);
    assert.deepEqual(app.file.nodes.map(({ id }) => id), ["second-node"]);
    assert.equal(app.switchDocument(firstId), true);
    assert.deepEqual(
      app.file.nodes.map(({ label }) => label),
      ["First", "Template"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public state snapshots cannot mutate model state outside update commands", () => {
  const storage = new MemoryStorage();
  const ids = ["migration-probe", "current"];
  const app = createApplicationModel(storage, () => ids.shift()!);
  app.initialize(file("Current", "node"));
  const exposed = app.file;

  exposed.meta.title = "Mutated externally";
  exposed.nodes[0]!.label = "Mutated externally";

  const exported = app.exportFile();
  assert.equal(exported.meta.title, "Current");
  assert.equal(exported.nodes[0]?.label, "Current");
});
