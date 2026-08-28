import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_DOCUMENT_KEY,
  DOCUMENT_INDEX_KEY,
  LEGACY_BACKUP_KEY,
  LEGACY_DOCUMENT_KEY,
  deleteStoredDocument,
  documentIdExists,
  documentKey,
  isSafeDocumentId,
  migrateLegacyDocument,
  persistDocument,
  readDocument,
  readDocumentResult,
  readRegistry,
  reserveDocumentId,
  setActiveDocument,
  type StorageLike,
} from "../src/document-storage.js";
import type { DiagramFile } from "../src/types.js";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;
  failWriteFor: ((key: string) => boolean) | null = null;
  keyReads = 0;

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    this.keyReads += 1;
    return [...this.values.keys()][index] ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites || this.failWriteFor?.(key)) throw new Error("quota exceeded");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function file(title: string, nodeId: string): DiagramFile {
  return {
    format: "anatomia",
    version: 1,
    meta: { title, savedAt: "2026-08-21T12:00:00.000Z", catalogVersion: "1" },
    nodes: [{ id: nodeId, def: "api", x: 10, y: 20, label: title }],
    edges: [],
  };
}

function assertThrows(action: () => void, expected: RegExp): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, expected);
}

test("keeps two documents in independent v1 envelope keys", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "alpha", file("Alpha", "a"));
  persistDocument(storage, "beta", file("Beta", "b"));

  assert.equal(readDocument(storage, "alpha")?.nodes[0]?.id, "a");
  assert.equal(readDocument(storage, "beta")?.nodes[0]?.id, "b");
  assert.deepEqual(readRegistry(storage).documents.map(({ id }) => id).sort(), ["alpha", "beta"]);
  assert.equal(JSON.parse(storage.getItem(documentKey("alpha"))!).version, 1);
});

test("tracks switching separately and persists edited titles", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "alpha", file("Alpha", "a"));
  persistDocument(storage, "beta", file("Beta", "b"));
  setActiveDocument(storage, "beta");
  persistDocument(storage, "beta", file("Beta renomeado", "b"));

  assert.equal(readRegistry(storage).activeDocumentId, "beta");
  assert.equal(readRegistry(storage).documents.find(({ id }) => id === "beta")?.title, "Beta renomeado");
});

test("supports import-as-new coexistence and deletion", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "current", file("Atual", "a"));
  persistDocument(storage, "imported", file("Importado", "b"));
  setActiveDocument(storage, "imported");

  assert.equal(readDocument(storage, "current")?.meta.title, "Atual");
  assert.equal(readRegistry(storage).activeDocumentId, "imported");

  deleteStoredDocument(storage, "imported");
  setActiveDocument(storage, "current");
  assert.equal(storage.getItem(documentKey("imported")), null);
  assert.equal(readRegistry(storage).activeDocumentId, "current");
});

test("migrates the single legacy key and preserves backup-v0 once", () => {
  const storage = new MemoryStorage();
  const legacy = JSON.stringify({
    nodes: [{ id: "a", def: "api", x: 1, y: 2, label: "API" }],
    edges: [],
  });
  storage.setItem(LEGACY_DOCUMENT_KEY, legacy);
  storage.setItem(LEGACY_BACKUP_KEY, "existing-backup");

  const migrated = migrateLegacyDocument(storage, "migrated", "Legado");

  assert.equal(migrated.file?.version, 1);
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), "existing-backup");
  assert.equal(storage.getItem(LEGACY_DOCUMENT_KEY), null);
  assert.equal(storage.getItem(ACTIVE_DOCUMENT_KEY), "migrated");
  assert.ok(storage.getItem(DOCUMENT_INDEX_KEY));
  assert.equal(readDocument(storage, "migrated")?.meta.title, "Legado");
});

test("returns migrated data in memory when quota blocks registry writes", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_DOCUMENT_KEY, JSON.stringify({ nodes: [], edges: [] }));
  storage.failWrites = true;

  const migrated = migrateLegacyDocument(storage, "migrated", "Legado");

  assert.equal(migrated.persistenceFailed, true);
  assert.equal(migrated.backupFailed, true);
  assert.equal(migrated.file?.meta.title, "Legado");
  assert.ok(storage.getItem(LEGACY_DOCUMENT_KEY));
});

test("keeps the legacy document when only its backup write fails", () => {
  const storage = new MemoryStorage();
  const legacy = JSON.stringify({
    nodes: [{ id: "a", def: "api", x: 1, y: 2, label: "API" }],
    edges: [],
  });
  storage.setItem(LEGACY_DOCUMENT_KEY, legacy);
  storage.failWriteFor = (key) => key === LEGACY_BACKUP_KEY;

  const migrated = migrateLegacyDocument(storage, "migrated", "Legado");

  assert.equal(migrated.backupFailed, true);
  assert.equal(migrated.persistenceFailed, false);
  assert.equal(storage.getItem(LEGACY_DOCUMENT_KEY), legacy);
  assert.equal(readDocument(storage, "migrated")?.meta.title, "Legado");
});

test("preserves the exact legacy source when creating its backup", () => {
  const storage = new MemoryStorage();
  const legacy = '{\n  "edges": [],\n  "nodes": [],\n  "note": "áß🙂"\n}\n';
  storage.setItem(LEGACY_DOCUMENT_KEY, legacy);

  const migrated = migrateLegacyDocument(storage, "migrated", "Legado");

  assert.equal(migrated.persistenceFailed, false);
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), legacy);
  assert.equal(storage.getItem(LEGACY_DOCUMENT_KEY), null);
});

test("keeps v0 when its v1 document or index cannot be fully persisted", () => {
  for (const failedKey of [documentKey("migrated"), DOCUMENT_INDEX_KEY]) {
    const storage = new MemoryStorage();
    const legacy = '{ "nodes": [], "edges": [] }';
    storage.setItem(LEGACY_DOCUMENT_KEY, legacy);
    storage.failWriteFor = (key) => key === failedKey;

    const migrated = migrateLegacyDocument(storage, "migrated", "Legado");

    assert.equal(migrated.persistenceFailed, true);
    assert.equal(storage.getItem(LEGACY_BACKUP_KEY), legacy);
    assert.equal(storage.getItem(LEGACY_DOCUMENT_KEY), legacy);
  }
});

test("returns normalization warnings through the structured read API", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    documentKey("warned"),
    JSON.stringify({
      format: "wrong",
      version: 1,
      meta: { title: "Warned" },
      nodes: [{ id: "a", def: "api", x: 1, y: 2, label: 42 }],
      edges: [],
    }),
  );

  const result = readDocumentResult(storage, "warned");

  assert.equal(result.file?.meta.title, "Warned");
  assert.ok(result.warnings.some((warning) => warning.includes("format")));
  assert.ok(result.warnings.some((warning) => warning.includes("nodes[0].label")));
  assert.equal(readDocument(storage, "warned")?.meta.title, "Warned");
});

test("tests and reserves safe document IDs without replacing existing bytes", () => {
  const storage = new MemoryStorage();
  const original = JSON.stringify(file("Original", "a"));
  storage.setItem(documentKey("existing"), original);

  assert.equal(isSafeDocumentId("new-document_1"), true);
  assert.equal(isSafeDocumentId("../unsafe"), false);
  assert.equal(documentIdExists(storage, "existing"), true);
  assert.equal(reserveDocumentId(storage, "existing"), false);
  assert.equal(storage.getItem(documentKey("existing")), original);

  assert.equal(reserveDocumentId(storage, "reserved"), true);
  assert.equal(documentIdExists(storage, "reserved"), true);
  assert.equal(reserveDocumentId(storage, "reserved"), false);
  assertThrows(() => reserveDocumentId(storage, "../unsafe"), /invalid document id/);

  persistDocument(storage, "reserved", file("Reserved", "b"));
  assert.equal(readDocument(storage, "reserved")?.meta.title, "Reserved");
});

test("updates a valid index incrementally without scanning document keys", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "alpha", file("Alpha", "a"));
  storage.keyReads = 0;

  persistDocument(storage, "beta", file("Beta", "b"));
  deleteStoredDocument(storage, "alpha");

  assert.equal(storage.keyReads, 0);
  assert.deepEqual(readRegistry(storage).documents.map(({ id }) => id), ["beta"]);
});

test("recovers missing and corrupt indexes with a full document scan", () => {
  for (const brokenIndex of [null, "{not-json"]) {
    const storage = new MemoryStorage();
    storage.setItem(documentKey("alpha"), JSON.stringify(file("Alpha", "a")));
    if (brokenIndex !== null) storage.setItem(DOCUMENT_INDEX_KEY, brokenIndex);

    const registry = readRegistry(storage);

    assert.ok(storage.keyReads > 0);
    assert.deepEqual(registry.documents.map(({ id }) => id), ["alpha"]);
    assert.deepEqual(JSON.parse(storage.getItem(DOCUMENT_INDEX_KEY)!).documents, [
      { id: "alpha", title: "Alpha", updatedAt: "2026-08-21T12:00:00.000Z" },
    ]);
  }
});

test("recovers a document committed before its index write failed", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "alpha", file("Alpha", "a"));
  storage.failWriteFor = (key) => key === DOCUMENT_INDEX_KEY;

  assertThrows(() => persistDocument(storage, "beta", file("Beta", "b")), /quota exceeded/);
  assert.equal(storage.getItem(DOCUMENT_INDEX_KEY), null);

  storage.failWriteFor = null;
  assert.deepEqual(readRegistry(storage).documents.map(({ id }) => id).sort(), ["alpha", "beta"]);
});

test("recovers the old document when a document write fails after index invalidation", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "alpha", file("Alpha", "a"));
  storage.failWriteFor = (key) => key === documentKey("alpha");

  assertThrows(
    () => persistDocument(storage, "alpha", file("Changed", "a")),
    /quota exceeded/,
  );
  assert.equal(storage.getItem(DOCUMENT_INDEX_KEY), null);

  storage.failWriteFor = null;
  const registry = readRegistry(storage);
  assert.equal(registry.documents[0]?.title, "Alpha");
  assert.equal(readDocument(storage, "alpha")?.meta.title, "Alpha");
});

test("recovers a completed deletion when its index write fails", () => {
  const storage = new MemoryStorage();
  persistDocument(storage, "alpha", file("Alpha", "a"));
  persistDocument(storage, "beta", file("Beta", "b"));
  storage.failWriteFor = (key) => key === DOCUMENT_INDEX_KEY;

  assertThrows(() => deleteStoredDocument(storage, "alpha"), /quota exceeded/);
  assert.equal(storage.getItem(documentKey("alpha")), null);
  assert.equal(storage.getItem(DOCUMENT_INDEX_KEY), null);

  storage.failWriteFor = null;
  assert.deepEqual(readRegistry(storage).documents.map(({ id }) => id), ["beta"]);
});
