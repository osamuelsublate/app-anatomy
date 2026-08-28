import assert from "node:assert/strict";
import test from "node:test";
import { createApplicationModel, createModel, DIAGRAM_TEMPLATES } from "../src/model.js";
import { documentKey, type StorageLike } from "../src/document-storage.js";
import type { DiagramFile } from "../src/types.js";

function file(title = "Alpha"): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title },
    nodes: [{ id: "node", def: "api", x: 10, y: 20, label: title }],
    edges: [],
  };
}

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

test("transient work stays in memory until one explicit commit is flushed", () => {
  const persisted: DiagramFile[] = [];
  const scheduled: Array<() => void> = [];
  const modes: string[] = [];
  const store = createModel(
    { doc: file(), ui: { selection: null as string | null } },
    {
      persistence: {
        persist(document) { persisted.push(document); },
        schedule(callback) {
          scheduled.push(callback);
          return callback;
        },
        cancel() {},
      },
      onChange(_state, mode) { modes.push(mode); },
    },
  );

  store.update((state) => { state.doc.nodes[0]!.x = 20; }, { mode: "transient" });
  store.update((state) => { state.doc.nodes[0]!.x = 30; }, { mode: "transient" });

  assert.deepEqual(modes, ["transient", "transient"]);
  assert.deepEqual(store.historyDepth, { undo: 0, redo: 0 });
  assert.equal(store.dirty, false);
  assert.equal(persisted.length, 0);
  assert.equal(scheduled.length, 0);

  store.update(() => {}, { mode: "commit" });
  assert.equal(store.dirty, true);
  assert.deepEqual(store.historyDepth, { undo: 1, redo: 0 });
  assert.equal(scheduled.length, 1);
  assert.equal(store.flush(), true);
  assert.equal(store.dirty, false);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.nodes[0]?.x, 30);
});

test("a quota failure remains dirty and a later flush retries the same state", () => {
  const storage = new MemoryStorage();
  const statuses: Array<{ message: string; error: boolean }> = [];
  const dirtyStates: boolean[] = [];
  const ids = ["migration", "current"];
  const app = createApplicationModel(storage, () => ids.shift()!, {
    onStatus(message, error = false) { statuses.push({ message, error }); },
    onDirtyChange(dirty) { dirtyStates.push(dirty); },
  });
  app.initialize(file());
  const id = app.currentDocumentId!;
  app.setTitle("Unsaved after quota");
  storage.failWriteFor = (key) => key === documentKey(id);

  assert.equal(app.flush(), false);
  assert.equal(app.dirty, true);
  assert.equal(
    statuses.some(({ message, error }) => error && message === "Não foi possível salvar neste navegador"),
    true,
  );

  storage.failWriteFor = null;
  assert.equal(app.flush(), true);
  assert.equal(app.dirty, false);
  assert.equal(JSON.parse(storage.getItem(documentKey(id))!).meta.title, "Unsaved after quota");
  assert.deepEqual(dirtyStates.slice(-2), [true, false]);
});

test("initialization reports readiness only after a delayed template resolves", async () => {
  let resolveRequest!: (response: { ok: boolean; text(): Promise<string> }) => void;
  const request = new Promise<{ ok: boolean; text(): Promise<string> }>((resolve) => {
    resolveRequest = resolve;
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => request) as unknown as typeof fetch;
  try {
    const readiness: boolean[] = [];
    const app = createApplicationModel(new MemoryStorage(), () => "initial", {
      onReady(ready) { readiness.push(ready); },
    });
    const initializing = app.initializeFromTemplate(DIAGRAM_TEMPLATES[0]!);

    assert.equal(app.ready, false);
    assert.deepEqual(readiness, []);

    resolveRequest({
      ok: true,
      async text() { return JSON.stringify(file("Loaded template")); },
    });
    await initializing;

    assert.equal(app.ready, true);
    assert.deepEqual(readiness, [true]);
    assert.equal(app.file.meta.title, "Loaded template");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed initial template still becomes ready with a safe empty document", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: false,
    text: async () => "",
  })) as unknown as typeof fetch;
  try {
    const statuses: Array<{ message: string; error: boolean }> = [];
    const app = createApplicationModel(new MemoryStorage(), () => "fallback", {
      onStatus(message, error = false) { statuses.push({ message, error }); },
    });

    await app.initializeFromTemplate(DIAGRAM_TEMPLATES[0]!);

    assert.equal(app.ready, true);
    assert.deepEqual(app.file.nodes, []);
    assert.equal(statuses.at(-1)?.error, true);
    assert.equal(statuses.at(-1)?.message.includes("diagrama vazio"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
